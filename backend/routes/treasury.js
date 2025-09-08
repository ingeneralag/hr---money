const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const Treasury = require("../models/Treasury");
const Transaction = require("../models/Transaction");
const sendError = require("../utils/sendError");
const { logTreasuryUpdate } = require("../middleware/logging");

// GET الحصول على معلومات الخزنة
router.get("/", requireAuth, async (req, res) => {
  try {
    let treasury = await Treasury.findOne({ isActive: true });
    
    if (!treasury) {
      // إنشاء خزنة جديدة إذا لم تكن موجودة
      treasury = new Treasury({
        currentBalance: 0,
        initialBalance: 0,
        createdBy: req.user.username || req.user.name || 'admin'
      });
      await treasury.save();
    }

    // حساب الرصيد الحالي من المعاملات
    const transactions = await Transaction.find({});
    
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebts = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaidDebts = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.paidAmount || 0), 0);

    const totalRemainingDebts = totalDebts - totalPaidDebts;

    // حساب الرسوم المحصلة من المديونيات (مكسب صافي)
    const totalFeesCollected = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.totalFeesCollected || 0), 0);

    // حساب الرصيد الحالي (إضافة الرسوم كإيرادات)
    const calculatedBalance = treasury.initialBalance + totalIncome - totalExpenses - totalRemainingDebts + totalFeesCollected;

    // تحديث الخزنة إذا كان هناك تغيير
    if (treasury.currentBalance !== calculatedBalance) {
      treasury.currentBalance = calculatedBalance;
      treasury.totalIncome = totalIncome;
      treasury.totalExpenses = totalExpenses;
      treasury.totalDebts = totalDebts;
      treasury.totalPaidDebts = totalPaidDebts;
      treasury.totalRemainingDebts = totalRemainingDebts;
      treasury.totalFeesCollected = totalFeesCollected;
      treasury.updatedBy = req.user.username || req.user.name || 'admin';
      await treasury.save();
    }

    res.json({
      success: true,
      data: {
        currentBalance: treasury.currentBalance,
        initialBalance: treasury.initialBalance,
        totalIncome,
        totalExpenses,
        totalDebts,
        totalPaidDebts,
        totalRemainingDebts,
        totalFeesCollected, // الرسوم المحصلة (مكسب صافي)
        lastUpdated: treasury.lastUpdated,
        currency: treasury.currency,
        balanceHistory: treasury.balanceHistory.slice(-10) // آخر 10 عمليات
      }
    });
  } catch (error) {
    console.error("خطأ في جلب معلومات الخزنة:", error);
    sendError(res, 500, "خطأ في جلب معلومات الخزنة", "SERVER_ERROR", error.message);
  }
});

// POST تحديث الرصيد الابتدائي
router.post("/initial-balance", requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { initialBalance, notes } = req.body;
    
    if (typeof initialBalance !== 'number') {
      return sendError(res, 400, "الرصيد الابتدائي يجب أن يكون رقم", "VALIDATION_ERROR");
    }

    let treasury = await Treasury.findOne({ isActive: true });
    
    if (!treasury) {
      treasury = new Treasury({
        currentBalance: initialBalance,
        initialBalance: initialBalance,
        createdBy: req.user.username || req.user.name || 'admin'
      });
    } else {
      const oldBalance = treasury.initialBalance;
      treasury.initialBalance = initialBalance;
      treasury.currentBalance = treasury.currentBalance - oldBalance + initialBalance;
      treasury.updatedBy = req.user.username || req.user.name || 'admin';
      
      // إضافة سجل في التاريخ
      treasury.addBalanceHistory({
        amount: initialBalance - oldBalance,
        type: 'manual_adjustment',
        description: `تحديث الرصيد الابتدائي: ${notes || 'بدون ملاحظات'}`,
        updatedBy: req.user.username || req.user.name || 'admin'
      });
    }

    if (notes) {
      treasury.notes = notes;
    }

    await treasury.save();

    res.json({
      success: true,
      message: "تم تحديث الرصيد الابتدائي بنجاح",
      data: {
        currentBalance: treasury.currentBalance,
        initialBalance: treasury.initialBalance
      }
    });
  } catch (error) {
    console.error("خطأ في تحديث الرصيد الابتدائي:", error);
    sendError(res, 500, "خطأ في تحديث الرصيد الابتدائي", "SERVER_ERROR", error.message);
  }
});

// POST تعديل يدوي للرصيد
router.post("/adjust", requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { amount, description, type } = req.body;
    
    if (typeof amount !== 'number') {
      return sendError(res, 400, "المبلغ يجب أن يكون رقم", "VALIDATION_ERROR");
    }

    if (!description) {
      return sendError(res, 400, "الوصف مطلوب", "VALIDATION_ERROR");
    }

    let treasury = await Treasury.findOne({ isActive: true });
    
    if (!treasury) {
      treasury = new Treasury({
        currentBalance: 0,
        initialBalance: 0,
        createdBy: req.user.username || req.user.name || 'admin'
      });
    }

    // إضافة سجل في التاريخ
    treasury.addBalanceHistory({
      amount: amount,
      type: type || 'manual_adjustment',
      description: description,
      updatedBy: req.user.username || req.user.name || 'admin'
    });

    await treasury.save();

    res.json({
      success: true,
      message: "تم تعديل الرصيد بنجاح",
      data: {
        currentBalance: treasury.currentBalance,
        adjustment: amount,
        description: description
      }
    });
  } catch (error) {
    console.error("خطأ في تعديل الرصيد:", error);
    sendError(res, 500, "خطأ في تعديل الرصيد", "SERVER_ERROR", error.message);
  }
});

// GET تاريخ الخزنة
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const treasury = await Treasury.findOne({ isActive: true });
    
    if (!treasury) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: parseInt(limit),
          pages: 0
        }
      });
    }

    const history = treasury.balanceHistory
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));

    res.json({
      success: true,
      data: history,
      pagination: {
        total: treasury.balanceHistory.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(treasury.balanceHistory.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("خطأ في جلب تاريخ الخزنة:", error);
    sendError(res, 500, "خطأ في جلب تاريخ الخزنة", "SERVER_ERROR", error.message);
  }
});

// POST إعادة حساب الرصيد
router.post("/recalculate", requireAuth, requireRole('admin'), logTreasuryUpdate, async (req, res) => {
  try {
    const transactions = await Transaction.find({});
    
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebts = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaidDebts = transactions
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.paidAmount || 0), 0);

    const totalRemainingDebts = totalDebts - totalPaidDebts;

    let treasury = await Treasury.findOne({ isActive: true });
    
    if (!treasury) {
      treasury = new Treasury({
        currentBalance: 0,
        initialBalance: 0,
        createdBy: req.user.username || req.user.name || 'admin'
      });
    }

    const oldBalance = treasury.currentBalance;
    treasury.currentBalance = treasury.initialBalance + totalIncome - totalExpenses - totalRemainingDebts;
    treasury.totalIncome = totalIncome;
    treasury.totalExpenses = totalExpenses;
    treasury.totalDebts = totalDebts;
    treasury.totalPaidDebts = totalPaidDebts;
    treasury.totalRemainingDebts = totalRemainingDebts;
    treasury.updatedBy = req.user.username || req.user.name || 'admin';

    // إضافة سجل في التاريخ
    treasury.addBalanceHistory({
      amount: treasury.currentBalance - oldBalance,
      type: 'manual_adjustment',
      description: 'إعادة حساب الرصيد من المعاملات',
      updatedBy: req.user.username || req.user.name || 'admin'
    });

    await treasury.save();

    res.json({
      success: true,
      message: "تم إعادة حساب الرصيد بنجاح",
      data: {
        currentBalance: treasury.currentBalance,
        previousBalance: oldBalance,
        totalIncome,
        totalExpenses,
        totalDebts,
        totalPaidDebts,
        totalRemainingDebts
      }
    });
  } catch (error) {
    console.error("خطأ في إعادة حساب الرصيد:", error);
    sendError(res, 500, "خطأ في إعادة حساب الرصيد", "SERVER_ERROR", error.message);
  }
});

module.exports = router;
