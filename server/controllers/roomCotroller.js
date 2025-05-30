import Room from '../models/Room.js'
import User from '../models/User.js'

export const getUserRooms = async (req, res) => {
    try {
        const rooms = await Room.find({ participants: req.user._id })
            .populate('participants', 'username avatar onlineStatus')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'username avatar' }
            })
            .sort({ updatedAt: -1 });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching rooms' });
    }
};
