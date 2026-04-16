const express = require('express');
const router = express.Router();
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET all logs
router.get('/', async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST add log
router.post('/', async (req, res) => {
  try {
    const { data: newLog, error } = await supabase
      .from('logs')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(newLog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET logs stats
router.get('/stats', async (req, res) => {
  try {
    // Total logs count
    const { count: totalLogs, error: countErr } = await supabase
      .from('logs')
      .select('id', { count: 'exact', head: true });
    if (countErr) throw countErr;

    // Today's logs count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { count: todayLogs, error: todayErr } = await supabase
      .from('logs')
      .select('id', { count: 'exact', head: true })
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString());
    if (todayErr) throw todayErr;

    // Breakdown by action
    const { data: allLogs, error: allErr } = await supabase
      .from('logs')
      .select('action, "user"');
    if (allErr) throw allErr;

    const actionBreakdown = {};
    const userActivity = {};
    allLogs.forEach(log => {
      // Action breakdown
      if (log.action) {
        actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
      }
      // User activity
      if (log.user) {
        userActivity[log.user] = (userActivity[log.user] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        totalLogs,
        todayLogs,
        actionBreakdown,
        userActivity
      }
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب إحصائيات السجلات', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
