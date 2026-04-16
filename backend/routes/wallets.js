const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

function mapWallet(w) {
  if (!w) return w;
  return { ...w, _id: w.id, nameEn: w.name_en, currentBalance: parseFloat(w.current_balance) || 0, initialBalance: parseFloat(w.initial_balance) || 0, isActive: w.is_active, sortOrder: w.sort_order, createdBy: w.created_by, createdAt: w.created_at, updatedAt: w.updated_at };
}

// GET all wallets with balances
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('wallets').select('*').eq('is_active', true).order('sort_order');
    if (error) throw error;

    const wallets = (data || []).map(mapWallet);
    const totalBalance = wallets.reduce((s, w) => s + (w.currentBalance || 0), 0);

    res.json({ success: true, data: { wallets, totalBalance } });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// GET wallet with history
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: wallet, error } = await supabase.from('wallets').select('*').eq('id', req.params.id).single();
    if (error || !wallet) return sendError(res, 404, 'المحفظة غير موجودة', 'NOT_FOUND');

    const { data: history } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', req.params.id).order('date', { ascending: false }).limit(50);

    res.json({ success: true, data: { ...mapWallet(wallet), history: (history || []).map(h => ({ ...h, _id: h.id, walletId: h.wallet_id, previousBalance: h.previous_balance, newBalance: h.new_balance, transactionId: h.transaction_id, sourceWalletId: h.source_wallet_id, createdBy: h.created_by })) } });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// POST create wallet
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const initial = parseFloat(req.body.initialBalance) || 0;
    const { data, error } = await supabase.from('wallets').insert({
      name: req.body.name, name_en: req.body.nameEn, type: req.body.type,
      initial_balance: initial, current_balance: initial,
      icon: req.body.icon, color: req.body.color,
      metadata: req.body.metadata || {}, sort_order: req.body.sortOrder || 0,
      created_by: req.user?.id,
    }).select().single();
    if (error) throw error;

    if (initial > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: data.id, amount: initial, type: 'manual_adjustment',
        description: 'رصيد افتتاحي', previous_balance: 0, new_balance: initial,
        created_by: req.user?.id,
      });
    }

    res.json({ success: true, message: 'تم إنشاء المحفظة', data: mapWallet(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// PUT update wallet
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.name) d.name = req.body.name;
    if (req.body.nameEn) d.name_en = req.body.nameEn;
    if (req.body.icon) d.icon = req.body.icon;
    if (req.body.color) d.color = req.body.color;
    if (req.body.isActive !== undefined) d.is_active = req.body.isActive;
    if (req.body.sortOrder !== undefined) d.sort_order = req.body.sortOrder;

    const { data, error } = await supabase.from('wallets').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapWallet(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// POST adjust wallet balance manually
router.post('/:id/adjust', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount) return sendError(res, 400, 'المبلغ مطلوب', 'VALIDATION_ERROR');

    const { data: wallet } = await supabase.from('wallets').select('current_balance').eq('id', req.params.id).single();
    const prev = wallet?.current_balance || 0;
    const adj = parseFloat(amount);
    const newBal = prev + adj;

    await supabase.from('wallets').update({ current_balance: newBal }).eq('id', req.params.id);
    await supabase.from('wallet_transactions').insert({
      wallet_id: req.params.id, amount: adj, type: 'manual_adjustment',
      description: description || 'تعديل يدوي', previous_balance: prev, new_balance: newBal,
      created_by: req.user?.id,
    });

    res.json({ success: true, message: 'تم تعديل الرصيد', data: { previousBalance: prev, newBalance: newBal } });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// POST transfer between wallets
router.post('/transfer', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { fromWalletId, toWalletId, amount, description } = req.body;
    if (!fromWalletId || !toWalletId || !amount) return sendError(res, 400, 'بيانات ناقصة', 'VALIDATION_ERROR');
    if (fromWalletId === toWalletId) return sendError(res, 400, 'لا يمكن التحويل لنفس المحفظة', 'VALIDATION_ERROR');

    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) return sendError(res, 400, 'المبلغ يجب أن يكون أكبر من صفر', 'VALIDATION_ERROR');

    // Get both wallets
    const [{ data: from }, { data: to }] = await Promise.all([
      supabase.from('wallets').select('*').eq('id', fromWalletId).single(),
      supabase.from('wallets').select('*').eq('id', toWalletId).single(),
    ]);

    if (!from || !to) return sendError(res, 404, 'محفظة غير موجودة', 'NOT_FOUND');
    if (from.current_balance < parsedAmount) return sendError(res, 400, 'رصيد غير كافي', 'VALIDATION_ERROR');

    const fromPrev = from.current_balance;
    const toPrev = to.current_balance;
    const fromNew = fromPrev - parsedAmount;
    const toNew = toPrev + parsedAmount;
    const desc = description || `تحويل من ${from.name} إلى ${to.name}`;

    // Update balances
    await Promise.all([
      supabase.from('wallets').update({ current_balance: fromNew }).eq('id', fromWalletId),
      supabase.from('wallets').update({ current_balance: toNew }).eq('id', toWalletId),
    ]);

    // Record history
    await supabase.from('wallet_transactions').insert([
      { wallet_id: fromWalletId, amount: -parsedAmount, type: 'transfer_out', description: desc, previous_balance: fromPrev, new_balance: fromNew, source_wallet_id: toWalletId, created_by: req.user?.id },
      { wallet_id: toWalletId, amount: parsedAmount, type: 'transfer_in', description: desc, previous_balance: toPrev, new_balance: toNew, source_wallet_id: fromWalletId, created_by: req.user?.id },
    ]);

    res.json({ success: true, message: `تم تحويل ${parsedAmount} من ${from.name} إلى ${to.name}`, data: { from: { id: fromWalletId, newBalance: fromNew }, to: { id: toWalletId, newBalance: toNew } } });
  } catch (err) { sendError(res, 400, 'خطأ في التحويل', 'VALIDATION_ERROR', err.message); }
});

// DELETE wallet (soft - deactivate)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: wallet } = await supabase.from('wallets').select('current_balance').eq('id', req.params.id).single();
    if (wallet?.current_balance > 0) return sendError(res, 400, 'لا يمكن حذف محفظة فيها رصيد. حوّل الرصيد أولاً', 'VALIDATION_ERROR');

    await supabase.from('wallets').update({ is_active: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'تم تعطيل المحفظة' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

module.exports = router;
