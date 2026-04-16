const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { supabase } = require('../config/database');
const sendError = require("../utils/sendError");
const { logTreasuryUpdate } = require("../middleware/logging");

// GET الحصول على معلومات الخزنة
router.get("/", requireAuth, async (req, res) => {
  try {
    let { data: treasury, error: findError } = await supabase
      .from('treasury')
      .select('*')
      .eq('is_active', true)
      .single();

    if (findError || !treasury) {
      // إنشاء خزنة جديدة إذا لم تكن موجودة
      const { data: newTreasury, error: insertError } = await supabase
        .from('treasury')
        .insert({
          current_balance: 0,
          initial_balance: 0,
          is_active: true,
          currency: 'EGP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      treasury = newTreasury;
    }

    // حساب الرصيد الحالي من المعاملات
    const { data: transactions, error: txnError } = await supabase
      .from('transactions')
      .select('type, amount, paid_amount, total_fees_collected');

    if (txnError) throw txnError;

    const totalIncome = (transactions || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = (transactions || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebts = (transactions || [])
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaidDebts = (transactions || [])
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.paid_amount || 0), 0);

    const totalRemainingDebts = totalDebts - totalPaidDebts;

    // حساب الرسوم المحصلة من المديونيات (مكسب صافي)
    const totalFeesCollected = (transactions || [])
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.total_fees_collected || 0), 0);

    // حساب الرصيد الحالي (إضافة الرسوم كإيرادات)
    const calculatedBalance = treasury.initial_balance + totalIncome - totalExpenses - totalRemainingDebts + totalFeesCollected;

    // تحديث الخزنة إذا كان هناك تغيير
    if (treasury.current_balance !== calculatedBalance) {
      const { error: updateError } = await supabase
        .from('treasury')
        .update({
          current_balance: calculatedBalance,
          total_income: totalIncome,
          total_expenses: totalExpenses,
          total_debts: totalDebts,
          total_paid_debts: totalPaidDebts,
          total_remaining_debts: totalRemainingDebts,
          total_fees_collected: totalFeesCollected,
          updated_at: new Date().toISOString(),
        })
        .eq('id', treasury.id);

      if (updateError) throw updateError;
      treasury.current_balance = calculatedBalance;
    }

    // Get last 10 history entries from treasury_history table
    const { data: balanceHistory, error: historyError } = await supabase
      .from('treasury_history')
      .select('*')
      .eq('treasury_id', treasury.id)
      .order('date', { ascending: false })
      .limit(10);

    if (historyError) throw historyError;

    res.json({
      success: true,
      data: {
        currentBalance: treasury.current_balance,
        initialBalance: treasury.initial_balance,
        totalIncome,
        totalExpenses,
        totalDebts,
        totalPaidDebts,
        totalRemainingDebts,
        totalFeesCollected,
        lastUpdated: treasury.last_updated || treasury.updated_at,
        currency: treasury.currency,
        balanceHistory: balanceHistory || []
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

    let { data: treasury, error: findError } = await supabase
      .from('treasury')
      .select('*')
      .eq('is_active', true)
      .single();

    if (findError || !treasury) {
      const { data: newTreasury, error: insertError } = await supabase
        .from('treasury')
        .insert({
          current_balance: initialBalance,
          initial_balance: initialBalance,
          is_active: true,
          currency: 'EGP',
          notes: notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      treasury = newTreasury;
    } else {
      const oldBalance = treasury.initial_balance;
      const newCurrentBalance = treasury.current_balance - oldBalance + initialBalance;

      const { error: updateError } = await supabase
        .from('treasury')
        .update({
          initial_balance: initialBalance,
          current_balance: newCurrentBalance,
          notes: notes || treasury.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', treasury.id);

      if (updateError) throw updateError;

      // إضافة سجل في التاريخ
      const { error: historyError } = await supabase
        .from('treasury_history')
        .insert({
          treasury_id: treasury.id,
          amount: initialBalance - oldBalance,
          type: 'manual_adjustment',
          description: `تحديث الرصيد الابتدائي: ${notes || 'بدون ملاحظات'}`,
          previous_balance: treasury.current_balance,
          new_balance: newCurrentBalance,
          date: new Date().toISOString(),
          updated_by: req.user.username || req.user.name || 'admin',
        });

      if (historyError) throw historyError;

      treasury.current_balance = newCurrentBalance;
      treasury.initial_balance = initialBalance;
    }

    res.json({
      success: true,
      message: "تم تحديث الرصيد الابتدائي بنجاح",
      data: {
        currentBalance: treasury.current_balance,
        initialBalance: treasury.initial_balance
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

    let { data: treasury, error: findError } = await supabase
      .from('treasury')
      .select('*')
      .eq('is_active', true)
      .single();

    if (findError || !treasury) {
      const { data: newTreasury, error: insertError } = await supabase
        .from('treasury')
        .insert({
          current_balance: 0,
          initial_balance: 0,
          is_active: true,
          currency: 'EGP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      treasury = newTreasury;
    }

    const previousBalance = treasury.current_balance;
    const newBalance = previousBalance + amount;

    // Update treasury balance
    const { error: updateError } = await supabase
      .from('treasury')
      .update({
        current_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', treasury.id);

    if (updateError) throw updateError;

    // إضافة سجل في التاريخ
    const { error: historyError } = await supabase
      .from('treasury_history')
      .insert({
        treasury_id: treasury.id,
        amount: amount,
        type: type || 'manual_adjustment',
        description: description,
        previous_balance: previousBalance,
        new_balance: newBalance,
        date: new Date().toISOString(),
        updated_by: req.user.username || req.user.name || 'admin',
      });

    if (historyError) throw historyError;

    res.json({
      success: true,
      message: "تم تعديل الرصيد بنجاح",
      data: {
        currentBalance: newBalance,
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

    const { data: treasury, error: findError } = await supabase
      .from('treasury')
      .select('id')
      .eq('is_active', true)
      .single();

    if (findError || !treasury) {
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const { count, error: countError } = await supabase
      .from('treasury_history')
      .select('*', { count: 'exact', head: true })
      .eq('treasury_id', treasury.id);

    if (countError) throw countError;

    // Get paginated history
    const { data: history, error: historyError } = await supabase
      .from('treasury_history')
      .select('*')
      .eq('treasury_id', treasury.id)
      .order('date', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (historyError) throw historyError;

    res.json({
      success: true,
      data: history || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((count || 0) / limitNum)
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
    const { data: transactions, error: txnError } = await supabase
      .from('transactions')
      .select('type, amount, paid_amount');

    if (txnError) throw txnError;

    const totalIncome = (transactions || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = (transactions || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebts = (transactions || [])
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPaidDebts = (transactions || [])
      .filter(t => t.type === 'debt')
      .reduce((sum, t) => sum + (t.paid_amount || 0), 0);

    const totalRemainingDebts = totalDebts - totalPaidDebts;

    let { data: treasury, error: findError } = await supabase
      .from('treasury')
      .select('*')
      .eq('is_active', true)
      .single();

    if (findError || !treasury) {
      const { data: newTreasury, error: insertError } = await supabase
        .from('treasury')
        .insert({
          current_balance: 0,
          initial_balance: 0,
          is_active: true,
          currency: 'EGP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      treasury = newTreasury;
    }

    const oldBalance = treasury.current_balance;
    const newBalance = treasury.initial_balance + totalIncome - totalExpenses - totalRemainingDebts;

    // Update treasury
    const { error: updateError } = await supabase
      .from('treasury')
      .update({
        current_balance: newBalance,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_debts: totalDebts,
        total_paid_debts: totalPaidDebts,
        total_remaining_debts: totalRemainingDebts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', treasury.id);

    if (updateError) throw updateError;

    // إضافة سجل في التاريخ
    const { error: historyError } = await supabase
      .from('treasury_history')
      .insert({
        treasury_id: treasury.id,
        amount: newBalance - oldBalance,
        type: 'manual_adjustment',
        description: 'إعادة حساب الرصيد من المعاملات',
        previous_balance: oldBalance,
        new_balance: newBalance,
        date: new Date().toISOString(),
        updated_by: req.user.username || req.user.name || 'admin',
      });

    if (historyError) throw historyError;

    res.json({
      success: true,
      message: "تم إعادة حساب الرصيد بنجاح",
      data: {
        currentBalance: newBalance,
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
