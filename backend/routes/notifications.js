const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    const unreadCount = (data || []).filter(n => !n.is_read).length;
    res.json({ success: true, data: (data || []).map(n => ({ ...n, _id: n.id, userId: n.user_id, isRead: n.is_read, createdAt: n.created_at })), unreadCount });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// PUT mark as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { sendError(res, 400, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// PUT mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
    res.json({ success: true, message: 'تم تعليم الكل كمقروء' });
  } catch (err) { sendError(res, 400, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Helper: create notification (used by other modules)
async function createNotification(userId, type, title, message, link = null) {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, message, link });
  } catch (e) { console.error('Notification error:', e.message); }
}

module.exports = router;
module.exports.createNotification = createNotification;
