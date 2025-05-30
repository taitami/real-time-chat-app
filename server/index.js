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

}