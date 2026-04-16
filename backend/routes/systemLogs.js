const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { supabase } = require('../config/database');
const sendError = require('../utils/sendError');

// GET - جلب جميع اللوجات مع الفلترة والبحث
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      severity,
      status,
      userId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const pageNum = parseInt(page);
    const pageSize = parseInt(limit);
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build main query with count
    let query = supabase.from('system_logs').select('*', { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (userId) query = query.eq('user_id', userId);
    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte('created_at', new Date(dateTo).toISOString());
    if (search) {
      query = query.or(
        `action.ilike.%${search}%,username.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: logs, count: total, error } = await query;
    if (error) throw error;

    // Fetch related transaction data if logs have transaction_id
    const transactionIds = logs
      .filter(l => l.transaction_id)
      .map(l => l.transaction_id);

    let transactionsMap = {};
    if (transactionIds.length > 0) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, description, amount, type, category, date')
        .in('id', transactionIds);
      if (transactions) {
        transactions.forEach(t => { transactionsMap[t.id] = t; });
      }
    }

    // Attach transaction data to logs
    const logsWithTransactions = logs.map(log => ({
      ...log,
      transaction: log.transaction_id ? transactionsMap[log.transaction_id] || null : null
    }));

    // Build stats query with same filters
    let statsQuery = supabase.from('system_logs').select('status, severity');
    if (action) statsQuery = statsQuery.eq('action', action);
    if (severity) statsQuery = statsQuery.eq('severity', severity);
    if (status) statsQuery = statsQuery.eq('status', status);
    if (userId) statsQuery = statsQuery.eq('user_id', userId);
    if (dateFrom) statsQuery = statsQuery.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) statsQuery = statsQuery.lte('created_at', new Date(dateTo).toISOString());
    if (search) {
      statsQuery = statsQuery.or(
        `action.ilike.%${search}%,username.ilike.%${search}%`
      );
    }

    const { data: statsData, error: statsErr } = await statsQuery;
    if (statsErr) throw statsErr;

    // Compute stats manually
    const stats = {
      totalLogs: statsData.length,
      successCount: statsData.filter(s => s.status === 'success').length,
      failedCount: statsData.filter(s => s.status === 'failed').length,
      highSeverityCount: statsData.filter(s => s.severity === 'high').length,
      criticalSeverityCount: statsData.filter(s => s.severity === 'critical').length
    };

    // Action stats - build query with same filters
    let actionQuery = supabase.from('system_logs').select('action');
    if (action) actionQuery = actionQuery.eq('action', action);
    if (severity) actionQuery = actionQuery.eq('severity', severity);
    if (status) actionQuery = actionQuery.eq('status', status);
    if (userId) actionQuery = actionQuery.eq('user_id', userId);
    if (dateFrom) actionQuery = actionQuery.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) actionQuery = actionQuery.lte('created_at', new Date(dateTo).toISOString());
    if (search) {
      actionQuery = actionQuery.or(
        `action.ilike.%${search}%,username.ilike.%${search}%`
      );
    }

    const { data: actionData, error: actionErr } = await actionQuery;
    if (actionErr) throw actionErr;

    // Group by action
    const actionMap = {};
    actionData.forEach(row => {
      actionMap[row.action] = (actionMap[row.action] || 0) + 1;
    });
    const actionStats = Object.entries(actionMap)
      .map(([_id, count]) => ({ _id, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: logsWithTransactions,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        pages: Math.ceil(total / pageSize)
      },
      stats,
      actionStats
    });

  } catch (error) {
    console.error('خطأ في جلب اللوجات:', error);
    sendError(res, 500, 'خطأ في جلب اللوجات', 'SERVER_ERROR', error.message);
  }
});

// GET - جلب لوجات معاملة محددة
router.get('/transaction/:transactionId', requireAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error('خطأ في جلب لوجات المعاملة:', error);
    sendError(res, 500, 'خطأ في جلب لوجات المعاملة', 'SERVER_ERROR', error.message);
  }
});

// GET - إحصائيات اللوجات
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    // Fetch all logs from the period for stats computation
    const { data: logsData, error: logsErr } = await supabase
      .from('system_logs')
      .select('status, severity, created_at')
      .gte('created_at', dateFrom.toISOString());

    if (logsErr) throw logsErr;

    // Summary stats
    const summary = {
      totalLogs: logsData.length,
      successCount: logsData.filter(l => l.status === 'success').length,
      failedCount: logsData.filter(l => l.status === 'failed').length,
      highSeverityCount: logsData.filter(l => l.severity === 'high').length,
      criticalSeverityCount: logsData.filter(l => l.severity === 'critical').length
    };

    // Daily stats - group by date
    const dailyMap = {};
    logsData.forEach(log => {
      const d = new Date(log.created_at);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!dailyMap[key]) {
        dailyMap[key] = {
          _id: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
          count: 0,
          successCount: 0,
          failedCount: 0
        };
      }
      dailyMap[key].count++;
      if (log.status === 'success') dailyMap[key].successCount++;
      if (log.status === 'failed') dailyMap[key].failedCount++;
    });

    const dailyStats = Object.values(dailyMap).sort((a, b) => {
      const da = new Date(a._id.year, a._id.month - 1, a._id.day);
      const db = new Date(b._id.year, b._id.month - 1, b._id.day);
      return da - db;
    });

    res.json({
      success: true,
      data: {
        summary,
        dailyStats
      }
    });

  } catch (error) {
    console.error('خطأ في جلب إحصائيات اللوجات:', error);
    sendError(res, 500, 'خطأ في جلب إحصائيات اللوجات', 'SERVER_ERROR', error.message);
  }
});


module.exports = router;
