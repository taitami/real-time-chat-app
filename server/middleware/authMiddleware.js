import passport from 'passport';

export const protect = (req, res, next) => {
    passport.authenticate('jwt', {session: false}, (err, user, info) => {
        if (err || !user) {
            let message = 'Not authorized, token failed';
            if (info && info.name === 'TokenExpiredError') {
                message = 'Not authorized, token expired';
            } else if (info && info.name === 'JsonWebTokenError') {
                message = 'Not authorized, invalid token';
            }
            return res.status(401).json({ message });
        }
        req.user = user;
        next();
    })(req, res, next);
};