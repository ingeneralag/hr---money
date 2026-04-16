const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// ====== TAX CALCULATION HELPERS ======

// Egyptian Corporate Income Tax: 22.5%
const CIT_RATE = 0.225;
// VAT: 14%
const VAT_RATE = 0.14;
// Social Insurance: Employee 11%, Employer 18.75%
const SI_EMPLOYEE_RATE = 0.11;
const SI_EMPLOYER_RATE = 0.1875;

// ====== ROUTES ======

// GET tax dashboard summary
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get all income transactions for the year
    const { data: incomes } = await supabase.from('transactions')
      .select('amount, date').eq('type', 'income').gte('date', startDate).lte('date', endDate);
    const totalRevenue = (incomes || []).reduce((s, t) => s + (t.amount || 0), 0);

    // Get all expense transactions for the year
    const { data: expenses } = await supabase.from('transactions')
      .select('amount, date').eq('type', 'expense').gte('date', startDate).lte('date', endDate);
    const totalExpenses = (expenses || []).reduce((s, t) => s + (t.amount || 0), 0);

    // Net profit
    const netProfit = totalRevenue - totalExpenses;
    const estimatedCIT = Math.max(0, netProfit * CIT_RATE);

    // VAT from invoices
    const { data: invoices } = await supabase.from('invoices')
      .select('vat_amount, total, status, date').gte('date', startDate).lte('date', endDate);
    const outputVAT = (invoices || []).reduce((s, i) => s + (i.vat_amount || 0), 0);

    // Input VAT (from expenses - estimate 14% of deductible expenses)
    const inputVAT = totalExpenses * VAT_RATE;
    const netVAT = Math.max(0, outputVAT - inputVAT);

    // WHT from invoices
    const { data: whtInvoices } = await supabase.from('invoices')
      .select('wht_amount').gte('date', startDate).lte('date', endDate).gt('wht_amount', 0);
    const totalWHT = (whtInvoices || []).reduce((s, i) => s + (i.wht_amount || 0), 0);

    // Social Insurance from employees
    const { data: employees } = await supabase.from('employees')
      .select('base_salary').in('status', ['نشط', 'active']);
    const totalSalaries = (employees || []).reduce((s, e) => s + (e.base_salary || 0), 0);
    const siEmployee = totalSalaries * SI_EMPLOYEE_RATE;
    const siEmployer = totalSalaries * SI_EMPLOYER_RATE;
    const totalSI = siEmployee + siEmployer;

    // Monthly breakdown
    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const mStart = `${year}-${String(m).padStart(2, '0')}-01`;
      const mEnd = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
      const mIncome = (incomes || []).filter(t => t.date >= mStart && t.date <= mEnd).reduce((s, t) => s + (t.amount || 0), 0);
      const mExpense = (expenses || []).filter(t => t.date >= mStart && t.date <= mEnd).reduce((s, t) => s + (t.amount || 0), 0);
      const mVAT = (invoices || []).filter(i => i.date >= mStart && i.date <= mEnd).reduce((s, i) => s + (i.vat_amount || 0), 0);
      monthlyData.push({ month: m, income: mIncome, expense: mExpense, profit: mIncome - mExpense, vat: mVAT });
    }

    // Tax records for this year
    const { data: taxRecords } = await supabase.from('tax_records')
      .select('*').eq('year', year).order('created_at', { ascending: false });

    const totalPaidTax = (taxRecords || []).filter(r => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0);

    res.json({
      success: true,
      data: {
        year,
        summary: {
          totalRevenue, totalExpenses, netProfit,
          estimatedCIT, citRate: CIT_RATE * 100,
          outputVAT, inputVAT, netVAT, vatRate: VAT_RATE * 100,
          totalWHT,
          siEmployee, siEmployer, totalSI, siEmployeeRate: SI_EMPLOYEE_RATE * 100, siEmployerRate: SI_EMPLOYER_RATE * 100,
          totalEstimatedTax: estimatedCIT + netVAT + totalWHT + totalSI,
          totalPaidTax,
          remainingTax: (estimatedCIT + netVAT + totalWHT + totalSI) - totalPaidTax,
        },
        monthlyData,
        taxRecords: (taxRecords || []).map(r => ({
          ...r, _id: r.id,
          paymentDate: r.payment_date, paymentReference: r.payment_reference,
          dueDate: r.due_date, createdBy: r.created_by, createdAt: r.created_at,
        })),
        rates: { cit: CIT_RATE * 100, vat: VAT_RATE * 100, siEmployee: SI_EMPLOYEE_RATE * 100, siEmployer: SI_EMPLOYER_RATE * 100 },
      },
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب بيانات الضرائب', 'INTERNAL_ERROR', err.message);
  }
});

// POST record tax payment
router.post('/records', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { type, period, year, quarter, month, amount, dueDate, notes } = req.body;
    if (!type || !amount) return sendError(res, 400, 'النوع والمبلغ مطلوبان', 'VALIDATION_ERROR');

    const { data, error } = await supabase.from('tax_records').insert({
      type, period: period || `${year}-Q${quarter || Math.ceil((month || 1) / 3)}`,
      year: year || new Date().getFullYear(), quarter, month,
      amount: parseFloat(amount), due_date: dueDate || null, notes,
      created_by: req.user?.id,
    }).select().single();
    if (error) throw error;

    res.json({ success: true, message: 'تم تسجيل الضريبة', data: { ...data, _id: data.id } });
  } catch (err) {
    sendError(res, 400, 'خطأ في تسجيل الضريبة', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update tax record (mark as paid)
router.put('/records/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const updateData = {};
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.paymentDate) updateData.payment_date = req.body.paymentDate;
    if (req.body.paymentReference) updateData.payment_reference = req.body.paymentReference;
    if (req.body.amount) updateData.amount = parseFloat(req.body.amount);
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;

    const { data, error } = await supabase.from('tax_records').update(updateData).eq('id', req.params.id).select().single();
    if (error) throw error;

    res.json({ success: true, message: 'تم التحديث', data: { ...data, _id: data.id } });
  } catch (err) {
    sendError(res, 400, 'خطأ في التحديث', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE tax record
router.delete('/records/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase.from('tax_records').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    sendError(res, 400, 'خطأ في الحذف', 'VALIDATION_ERROR', err.message);
  }
});

module.exports = router;
