import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
    } catch (err) {
        console.error(err.message)
        process.exit(1); 
    }
}

export default connectDB;