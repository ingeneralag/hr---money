const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET current rates
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get latest rate for each currency
    const { data, error } = await supabase.from('exchange_rates')
      .select('*').eq('currency_to', 'EGP').order('date', { ascending: false });
    if (error) throw error;

    // Deduplicate - keep latest per currency
    const seen = {};
    const rates = (data || []).filter(r => {
      if (seen[r.currency_from]) return false;
      seen[r.currency_from] = true;
      return true;
    }).map(r => ({
      ...r, _id: r.id, currencyFrom: r.currency_from, currencyTo: r.currency_to, createdBy: r.created_by, createdAt: r.created_at,
    }));

    res.json({ success: true, data: rates });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب أسعار الصرف', 'INTERNAL_ERROR', err.message);
  }
});

// GET historical rates for a currency
router.get('/history/:currency', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('exchange_rates')
      .select('*').eq('currency_from', req.params.currency.toUpperCase()).eq('currency_to', 'EGP')
      .order('date', { ascending: false }).limit(30);
    if (error) throw error;

    res.json({ success: true, data: (data || []).map(r => ({ ...r, _id: r.id })) });
  } catch (err) {
    sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message);
  }
});

// POST add/update rate
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { currencyFrom, rate, date } = req.body;
    if (!currencyFrom || !rate) return sendError(res, 400, 'العملة والسعر مطلوبان', 'VALIDATION_ERROR');

    const rateDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('exchange_rates').upsert({
      currency_from: currencyFrom.toUpperCase(),
      currency_to: 'EGP',
      rate: parseFloat(rate),
      date: rateDate,
      source: 'manual',
      created_by: req.user?.id,
    }, { onConflict: 'currency_from,currency_to,date' }).select().single();
    if (error) throw error;

    res.json({ success: true, message: 'تم تحديث سعر الصرف', data: { ...data, _id: data.id } });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث سعر الصرف', 'VALIDATION_ERROR', err.message);
  }
});

// GET convert amount
router.get('/convert', requireAuth, async (req, res) => {
  try {
    const { from, to = 'EGP', amount } = req.query;
    if (!from || !amount) return sendError(res, 400, 'العملة والمبلغ مطلوبان', 'VALIDATION_ERROR');

    if (from.toUpperCase() === to.toUpperCase()) {
      return res.json({ success: true, data: { from, to, rate: 1, amount: parseFloat(amount), converted: parseFloat(amount) } });
    }

    const { data: rateData } = await supabase.from('exchange_rates')
      .select('rate').eq('currency_from', from.toUpperCase()).eq('currency_to', to.toUpperCase())
      .order('date', { ascending: false }).limit(1).single();

    const rate = rateData?.rate || 1;
    res.json({ success: true, data: { from, to, rate, amount: parseFloat(amount), converted: parseFloat(amount) * rate } });
  } catch (err) {
    sendError(res, 500, 'خطأ في التحويل', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
