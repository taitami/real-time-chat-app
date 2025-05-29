import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    })
}

export const registerUser = async (req, res) => {
    const {username, email, password} = req.body;
    try {
        const userExists = await User.findOne({ $or: [{email}, {username}] });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({username, email, password})

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    }
}

export const loginUser = async (req, res) => {
    const {emailOrUsername, password} = req.body;
    try {
        const user = await User.findOne({
            $or: [{email: emailOrUsername}, {username: emailOrUsername}]
        })

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            })
        } else {
            res.status(401).json({ message: 'Invalid email/username or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during login' });
    }
}

export const getCurrentUser = async (req, res) => {
    if (req.user) {
        res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            avatar: req.user.avatar
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}