const jwt = require('jsonwebtoken');
// TODO: Replace with a more secure way to get the secret, e.g., environment variable
const JWT_SECRET = 'your-very-secret-and-complex-key-for-now'; 

exports.protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Add user from payload to request object
            // We will typically fetch the user from DB here to ensure they still exist and are active
            // For this project, we'll attach the decoded payload directly
            req.user = decoded; 

            next();
        } catch (error) {
            console.error('Token verification failed:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Optional: Middleware to check for specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles || !roles.some(role => req.user.roles.includes(role))) {
            // User does not have any of the required roles
            return res.status(403).json({ message: 'Forbidden: You do not have the required role.' });
        }
        next();
    };
};
