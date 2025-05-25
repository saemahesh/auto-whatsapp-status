const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Route to list all users (admin only)
router.get('/users', protect, authorize(['admin']), adminController.listUsers);

// Route to approve a user (admin only)
router.put('/users/:userId/approve', protect, authorize(['admin']), adminController.approveUser);

module.exports = router;
