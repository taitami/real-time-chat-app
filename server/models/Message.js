import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    content: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    isEdited: { type: Boolean, default: false },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;