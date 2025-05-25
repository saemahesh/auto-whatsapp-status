const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // Import the protect middleware

// Route to update user settings
// This route is protected, meaning a valid JWT is required
router.put('/settings', protect, userController.updateSettings);

module.exports = router;
