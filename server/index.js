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

                const messages = await Message.find({ room: roomId })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .populate('sender', 'username avatar');
                socket.emit('messageHistory', { roomId, messages: messages.reverse() });

            } catch (error) {
                console.error('Join room error:', error);
                socket.emit('error', { message: 'Error joining room' });
            }
        });

        socket.on('sendMessage', async ({ roomId, content }) => {
            if (!content.trim()) return;
            try {
                const room = await Room.findById(roomId);
                if (!room) return socket.emit('error', { message: 'Room not found for message' });
                if (!room.participants.some(p => p._id.equals(socket.user._id))) {
                    return socket.emit('error', { message: 'Cannot send message to a room you are not part of' });
                }

                const message = new Message({
                    sender: socket.user._id,
                    room: roomId,
                    content: content
                });
                await message.save();
                await message.populate('sender', 'username avatar'); 

                room.lastMessage = message._id;
                await room.save();

                io.to(roomId).emit('newMessage', message);
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Error sending message' });
            }
        });

        socket.on('typing', ({ roomId, isTyping }) => {
            socket.to(roomId).emit('userTyping', {
                userId: socket.user._id,
                username: socket.user.username,
                isTyping: isTyping
            });
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