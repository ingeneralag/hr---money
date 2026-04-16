const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// Income Statement (P&L)
router.get('/income-statement', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || `${new Date().getFullYear()}-01-01`;
    const end = endDate || new Date().toISOString().split('T')[0];

    const [{ data: incomes }, { data: expenses }, { data: payrolls }] = await Promise.all([
      supabase.from('transactions').select('amount, category, date').eq('type', 'income').gte('date', start).lte('date', end),
      supabase.from('transactions').select('amount, category, date').eq('type', 'expense').gte('date', start).lte('date', end),
      supabase.from('payroll').select('net_salary, month').eq('status', 'paid'),
    ]);

    const totalRevenue = (incomes || []).reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpenses = (expenses || []).reduce((s, t) => s + (t.amount || 0), 0);
    const totalPayroll = (payrolls || []).reduce((s, p) => s + (p.net_salary || 0), 0);
    const totalCosts = totalExpenses + totalPayroll;
    const grossProfit = totalRevenue - totalCosts;
    const taxRate = 0.225;
    const estimatedTax = Math.max(0, grossProfit * taxRate);
    const netProfit = grossProfit - estimatedTax;

    // Revenue by category
    const revByCat = {};
    (incomes || []).forEach(t => { revByCat[t.category || 'أخرى'] = (revByCat[t.category || 'أخرى'] || 0) + (t.amount || 0); });
    // Expenses by category
    const expByCat = {};
    (expenses || []).forEach(t => { expByCat[t.category || 'أخرى'] = (expByCat[t.category || 'أخرى'] || 0) + (t.amount || 0); });

    res.json({ success: true, data: {
      period: { start, end },
      revenue: { total: totalRevenue, byCategory: revByCat },
      expenses: { total: totalExpenses, byCategory: expByCat },
      payroll: totalPayroll,
      totalCosts, grossProfit, estimatedTax, netProfit,
      profitMargin: totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 100) : 0,
    }});
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Cash Flow
router.get('/cash-flow', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const monthlyData = [];

    for (let m = 1; m <= 12; m++) {
      const start = `${year}-${String(m).padStart(2, '0')}-01`;
      const end = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;

      const [{ data: inc }, { data: exp }] = await Promise.all([
        supabase.from('transactions').select('amount').eq('type', 'income').gte('date', start).lte('date', end),
        supabase.from('transactions').select('amount').eq('type', 'expense').gte('date', start).lte('date', end),
      ]);

      const inflow = (inc || []).reduce((s, t) => s + (t.amount || 0), 0);
      const outflow = (exp || []).reduce((s, t) => s + (t.amount || 0), 0);
      monthlyData.push({ month: m, inflow, outflow, net: inflow - outflow });
    }

    let runningBalance = 0;
    monthlyData.forEach(m => { runningBalance += m.net; m.balance = runningBalance; });

    res.json({ success: true, data: { year, monthly: monthlyData, totalInflow: monthlyData.reduce((s, m) => s + m.inflow, 0), totalOutflow: monthlyData.reduce((s, m) => s + m.outflow, 0) } });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Balance Sheet (Simplified)
router.get('/balance-sheet', requireAuth, async (req, res) => {
  try {
    const [{ data: treasury }, { data: receivables }, { data: payables }, { data: assets }] = await Promise.all([
      supabase.from('treasury').select('current_balance').eq('is_active', true).single(),
      supabase.from('transactions').select('remaining_amount').eq('type', 'debt').eq('debt_status', 'pending'),
      supabase.from('transactions').select('remaining_amount').eq('type', 'debt'),
      supabase.from('assets').select('purchase_price').eq('status', 'active'),
    ]);

    const cash = treasury?.current_balance || 0;
    const totalReceivables = (receivables || []).reduce((s, t) => s + (t.remaining_amount || 0), 0);
    const totalAssets = (assets || []).reduce((s, a) => s + (a.purchase_price || 0), 0);
    const totalPayables = (payables || []).reduce((s, t) => s + (t.remaining_amount || 0), 0);

    res.json({ success: true, data: {
      assets: { cash, receivables: totalReceivables, fixedAssets: totalAssets, total: cash + totalReceivables + totalAssets },
      liabilities: { payables: totalPayables, total: totalPayables },
      equity: cash + totalReceivables + totalAssets - totalPayables,
    }});
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Client Aging Report
router.get('/client-aging', requireAuth, async (req, res) => {
  try {
    const { data: invoices } = await supabase.from('invoices')
      .select('*, clients!invoices_client_id_fkey(name)')
      .gt('remaining_amount', 0).in('status', ['sent', 'partially_paid', 'overdue']);

    const now = new Date();
    const aging = (invoices || []).map(inv => {
      const due = new Date(inv.due_date || inv.date);
      const daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      let bucket = 'current';
      if (daysOverdue > 90) bucket = '90+';
      else if (daysOverdue > 60) bucket = '61-90';
      else if (daysOverdue > 30) bucket = '31-60';
      else if (daysOverdue > 0) bucket = '1-30';

      return { invoiceNumber: inv.invoice_number, clientName: inv.clients?.name, amount: inv.remaining_amount, dueDate: inv.due_date, daysOverdue, bucket };
    });

    res.json({ success: true, data: aging });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Project Profitability
router.get('/project-profitability', requireAuth, async (req, res) => {
  try {
    const { data: projects } = await supabase.from('projects')
      .select('*, clients!projects_client_id_fkey(name)');

    const report = (projects || []).map(p => ({
      projectNumber: p.project_number, name: p.name, clientName: p.clients?.name,
      totalAmount: p.total_amount, totalPaid: p.total_paid, remaining: p.remaining_amount,
      status: p.status, progress: p.total_amount > 0 ? Math.round(p.total_paid / p.total_amount * 100) : 0,
    }));

    res.json({ success: true, data: report });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// Scheduled reports CRUD
router.get('/scheduled', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('scheduled_reports').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(r => ({ ...r, _id: r.id, lastRun: r.last_run, nextRun: r.next_run, isActive: r.is_active, createdBy: r.created_by })) });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

router.post('/scheduled', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('scheduled_reports').insert({
      name: req.body.name, type: req.body.type, frequency: req.body.frequency,
      recipients: req.body.recipients || [], filters: req.body.filters || {},
      format: req.body.format || 'pdf', is_active: true, created_by: req.user?.id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم إنشاء التقرير المجدول', data: { ...data, _id: data.id } });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.delete('/scheduled/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('scheduled_reports').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم حذف التقرير' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

module.exports = router;
