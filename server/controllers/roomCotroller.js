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

export const accessOrCreatePrivateChat = async (req, res) => {
    const { targetUserId } = req.body; 

    if (!targetUserId) {
        return res.status(400).json({ message: "Target User ID not sent with request" });
    }

    if (req.user._id.toString() === targetUserId) {
        return res.status(400).json({ message: "Cannot create a chat with yourself" });
    }

    try {
        let chat = await Room.findOne({
            isGroupChat: false,
            $and: [
                { participants: { $elemMatch: { $eq: req.user._id } } },
                { participants: { $elemMatch: { $eq: targetUserId } } },
            ],
        })
        .populate("participants", "-password")
        .populate({
            path: 'lastMessage',
            populate: { path: 'sender', select: 'username avatar' }
        });

        if (chat) {
            return res.status(200).json(chat);
        } else {
            const newChatData = {
                isGroupChat: false,
                participants: [req.user._id, targetUserId],
            };
            const createdChat = await Room.create(newChatData);
            const fullChat = await Room.findById(createdChat._id)
                .populate("participants", "-password");

            await User.findByIdAndUpdate(req.user._id, { $addToSet: { rooms: fullChat._id } });
            await User.findByIdAndUpdate(targetUserId, { $addToSet: { rooms: fullChat._id } });

            return res.status(201).json(fullChat);
        }
    } catch (error) {
        console.error("Error accessing/creating private chat:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const createGroupChat = async (req, res) => {
    let { name, participantIds } = req.body; 

    if (!name || !participantIds || participantIds.length < 1) {
        return res.status(400).json({ message: "Please provide a group name and at least one participant" });
    }

    const allParticipantIds = [...new Set([req.user._id.toString(), ...participantIds])];

    if (allParticipantIds.length < 2) {
         return res.status(400).json({ message: "Group chat must have at least two participants (including creator)" });
    }

    try {
        const groupChat = await Room.create({
            name,
            participants: allParticipantIds,
            isGroupChat: true,
            admin: req.user._id,
        });

        const fullGroupChat = await Room.findById(groupChat._id)
            .populate("participants", "-password")
            .populate("admin", "-password");

        await User.updateMany(
            { _id: { $in: allParticipantIds } },
            { $addToSet: { rooms: fullGroupChat._id } }
        );

        res.status(201).json(fullGroupChat);
    } catch (error) {
        console.error("Error creating group chat:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};