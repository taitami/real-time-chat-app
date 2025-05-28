import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    name: { type: String, trim: true }, 
    isGroupChat: { type: Boolean, default: false },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);
export default Room;