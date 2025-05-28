import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    avatar: { type: String, default: 'default_avatar.png' },
    onlineStatus: { type: Boolean, default: false },
    lastSeen: { type: Date },
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }]
}, { timestamps: true });


const User = mongoose.model('User', userSchema);
export default User;