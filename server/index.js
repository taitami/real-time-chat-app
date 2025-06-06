import express from "express";
import { Server } from "socket.io";
import {fileURLToPath} from "url";
import path from "path";
import http from "http"
import dotenv from "dotenv"
import cors from "cors"
import passport from 'passport'
import passportConfig from './config/passport.js'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import User from '../models/User.js';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import userRoutes from "./routes/userRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import { createMemoizationLru } from '../utils/memoizeLru.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const PORT = process.env.PORT || 3500;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN = "Admin"

app.use(cors({ 
    origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"], 
}));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
passportConfig(passport);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

connectDB();

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const userSocketMap = new Map();

async function* messageHistoryIterator(roomId, batchSize = 10, delay = 500) {
    let skip = 0;
    let hasMoreMessages = true;

    while (hasMoreMessages) {
        const messages = await Message.find({ room: roomId })
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(batchSize)
            .populate('sender', 'username avatar');

        if (messages.length > 0) {
            yield messages.reverse(); 
            skip += messages.length;
            await new Promise(resolve => setTimeout(resolve, delay));
        } else {
            hasMoreMessages = false;
        }
    }
}

function _prepareSenderData(senderDbObject) {
    if (!senderDbObject) return null;
    return {
        _id: senderDbObject._id,
        username: senderDbObject.username,
        avatar: senderDbObject.avatar,
    };
}

const getPreparedSenderData = createMemoizationLru(
    _prepareSenderData,
    {
        cacheSize: 100,
        keyGenerator: (args) => args[0] && args[0]._id ? `sender_socket_${args[0]._id.toString()}` : 'invalid_sender_key'
    }
);

export default function initializeSocketHandlers(io) {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            socket.user = user
            next();
        } catch (err) {
            console.error("Socket auth error:", err.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User ${socket.user.username} (ID: ${socket.user._id}, Socket: ${socket.id}) connected`);
        userSocketMap.set(socket.user._id.toString(), socket.id);

        User.findByIdAndUpdate(socket.user._id, { onlineStatus: true, lastSeen: new Date() }).catch(console.error);

        socket.on('joinRoom', async ({ roomId }) => {
            try {
                const room = await Room.findById(roomId).populate('participants', 'username avatar onlineStatus');
                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }
                if (!room.participants.some(p => p._id.equals(socket.user._id))) {
                    socket.emit('error', { message: 'You are not a member of this room' });
                    return;
                }

                socket.join(roomId);
                console.log(`${socket.user.username} joined room ${roomId}`);

                socket.to(roomId).emit('userJoined', {
                    userId: socket.user._id,
                    username: socket.user.username,
                    message: `${socket.user.username} has joined the room.`
                });

                io.to(roomId).emit('roomUsers', {
                    roomId: roomId,
                    users: room.participants 
                });

                const historyIterator = messageHistoryIterator(roomId, 10, 300); 
                for await (const messageBatch of historyIterator) {
                     if (socket.connected) { 
                        socket.emit('messageHistoryBatch', { roomId, messages: messageBatch });
                    } else {
                        break; 
                    }
                }
  socket.emit('messageHistoryComplete', { roomId });

            } catch (error) {
                console.error('Join room error:', error);
                socket.emit('error', { message: 'Error joining room' });
            }
        });

        socket.on('sendMessage', async ({ roomId, content }) => {
            if (!content || !content.trim()) return; 
            try {
                const room = await Room.findById(roomId);
                if (!room) {
                    socket.emit('error', { message: 'Room not found for message' });
                    return;
                }
                if (!room.participants.some(p => p._id.equals(socket.user._id))) {
                    socket.emit('error', { message: 'Cannot send message to a room you are not part of' });
                    return;
                }

                const message = new Message({
                    sender: socket.user._id, 
                    room: roomId,
                    content: content.trim()
                });
                await message.save();
                await message.populate('sender', 'username avatar _id'); 

                const senderObjectForMemo = message.sender.toObject ? message.sender.toObject() : message.sender;
                const preparedSenderData = getMemoizedSenderDataForSocket(senderObjectForMemo);

                room.lastMessage = message._id;
                await room.save();

                const messageForClient = {
                    _id: message._id,
                    content: message.content,
                    room: message.room, 
                    sender: preparedSenderData, 
                    createdAt: message.createdAt,
                    isEdited: message.isEdited,
                };

                io.to(roomId).emit('newMessage', messageForClient);

            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Error sending message' });
            }
        });

        socket.on('editMessage', async ({ messageId, newContent }) => {
            if (!newContent || !newContent.trim()) {
                return socket.emit('error', { message: 'Message content cannot be empty' });
            }
            try {
                const message = await Message.findById(messageId);
                if (!message) {
                    return socket.emit('error', { message: 'Message not found' });
                }
      
                if (message.sender.toString() !== socket.user._id.toString()) {
                    return socket.emit('error', { message: 'You are not authorized to edit this message' });
                }
      
                message.content = newContent.trim();
                message.isEdited = true;
      
                await message.save();
                await message.populate('sender', 'username avatar');

                io.to(message.room.toString()).emit('messageUpdated', message);
            } catch (error) {
                console.error('Edit message error:', error);
                socket.emit('error', { message: 'Error editing message' });
            }
        });

        socket.on('deleteMessage', async ({ messageId }) => {
            try {
                const message = await Message.findById(messageId);
        
                if (!message) {
                    return socket.emit('error', { message: 'Message not found' });
                }
        
                const roomId = message.room.toString(); 
        
                if (message.sender.toString() !== socket.user._id.toString()) {
                   
                    return socket.emit('error', { message: 'You are not authorized to delete this message' });
                }
        
                await Message.findByIdAndDelete(messageId);
        
                const room = await Room.findById(roomId);
                if (room) {
                    if (room.lastMessage && room.lastMessage.toString() === messageId) {
                        const previousMessages = await Message.find({ room: roomId })
                            .sort({ createdAt: -1 }) 
                            .limit(1);         
        
                        if (previousMessages.length > 0) {
                            room.lastMessage = previousMessages[0]._id;
                        } else {
                            room.lastMessage = null;
                        }
                        await room.save();
                    }
                }
        
                io.to(roomId).emit('messageDeleted', {
                    messageId: messageId,
                    roomId: roomId,       
                })
            } catch (error) {
                console.error('Delete message error:', error);
                socket.emit('error', { message: 'Error deleting message' });
            }
        });

        socket.on('disconnect', async () => {
            console.log(`User ${socket.user.username} (ID: ${socket.user._id}, Socket: ${socket.id}) disconnected`);
            userSocketMap.delete(socket.user._id.toString());
            try {
               const user = await User.findByIdAndUpdate(socket.user._id, { onlineStatus: false, lastSeen: new Date() });
               if (user) {
                   user.rooms.forEach(roomId => {
                       io.to(roomId.toString()).emit('userLeft', {
                           userId: user._id,
                           username: user.username,
                           message: `${user.username} has left.`
                       });
                   });
               }
            } catch (error) {
                console.error("Error updating user status on disconnect:", error);
            }
        });
    });
}