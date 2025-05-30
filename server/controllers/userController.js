import User from '../models/User.js';

export const searchUsers = async (req, res) => {
    const keyword = req.query.search
        ? {
            $or: [
                { username: { $regex: req.query.search, $options: 'i' } }, 
                { email: { $regex: req.query.search, $options: 'i' } },
            ],
        }
        : {};

    try {
        const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error during user search' });
    }
};