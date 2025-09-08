const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const SystemLog = require('../models/SystemLog');
const Transaction = require('../models/Transaction');
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

    // بناء الفلتر
    const filter = {};

    if (action) {
      filter.action = action;
    }

    if (severity) {
      filter.severity = severity;
    }

    if (status) {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    // فلترة بالتاريخ
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // البحث في التفاصيل
    if (search) {
      filter.$or = [
        { details: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    // حساب العدد الإجمالي
    const total = await SystemLog.countDocuments(filter);

    // جلب البيانات مع التصفح
    const logs = await SystemLog.find(filter)
      .populate('transactionId', 'description amount type category date')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // إحصائيات
    const stats = await SystemLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          highSeverityCount: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
          },
          criticalSeverityCount: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          }
        }
      }
    ]);

    // إحصائيات حسب نوع العملية
    const actionStats = await SystemLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: stats[0] || {
        totalLogs: 0,
        successCount: 0,
        failedCount: 0,
        highSeverityCount: 0,
        criticalSeverityCount: 0
      },
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
    
    const logs = await SystemLog.find({ transactionId })
      .sort({ createdAt: -1 });

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

    const stats = await SystemLog.aggregate([
      { $match: { createdAt: { $gte: dateFrom } } },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          highSeverityCount: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
          },
          criticalSeverityCount: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          }
        }
      }
    ]);

    // إحصائيات يومية
    const dailyStats = await SystemLog.aggregate([
      { $match: { createdAt: { $gte: dateFrom } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalLogs: 0,
          successCount: 0,
          failedCount: 0,
          highSeverityCount: 0,
          criticalSeverityCount: 0
        },
        dailyStats
      }
    });

  } catch (error) {
    console.error('خطأ في جلب إحصائيات اللوجات:', error);
    sendError(res, 500, 'خطأ في جلب إحصائيات اللوجات', 'SERVER_ERROR', error.message);
  }
});


module.exports = router;
