// routes/notificationRoutes.js
'use strict';

const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

// GET /api/v1/notifications
// Returns unread + recent read notifications for the logged-in user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    console.error('[NOTIFICATIONS] GET error:', err);
    res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

module.exports = router;