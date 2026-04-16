const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

function mapLoss(l) {
  if (!l) return l;
  return { ...l, _id: l.id, lossNumber: l.loss_number, originalValue: l.original_value, insuranceClaim: l.insurance_claim, netLoss: l.net_loss, assetId: l.asset_id, evidenceUrls: l.evidence_urls, createdBy: l.created_by, createdAt: l.created_at, updatedAt: l.updated_at };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, status, search } = req.query;
    let query = supabase.from('losses').select('*', { count: 'exact' });
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('description', `%${search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(mapLoss), total: count });
  } catch (err) { sendError(res, 500, 'خطأ في جلب الخسائر', 'INTERNAL_ERROR', err.message); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: last } = await supabase.from('losses').select('loss_number').not('loss_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1; if (last?.loss_number) { const m = last.loss_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const lossNumber = `LOS-${String(num).padStart(4, '0')}`;

    const origVal = parseFloat(req.body.originalValue || req.body.original_value) || 0;
    const insClaim = parseFloat(req.body.insuranceClaim || req.body.insurance_claim) || 0;

    const { data, error } = await supabase.from('losses').insert({
      loss_number: lossNumber, date: req.body.date || new Date().toISOString().split('T')[0],
      category: req.body.category, description: req.body.description,
      original_value: origVal, insurance_claim: insClaim, net_loss: origVal - insClaim,
      notes: req.body.notes, status: req.body.status || 'recorded', created_by: req.user?.id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم تسجيل الخسارة', data: mapLoss(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.category) d.category = req.body.category;
    if (req.body.description) d.description = req.body.description;
    if (req.body.originalValue) { d.original_value = parseFloat(req.body.originalValue); d.net_loss = d.original_value - (parseFloat(req.body.insuranceClaim) || 0); }
    if (req.body.insuranceClaim !== undefined) { d.insurance_claim = parseFloat(req.body.insuranceClaim); d.net_loss = (parseFloat(req.body.originalValue || d.original_value) || 0) - d.insurance_claim; }
    if (req.body.status) d.status = req.body.status;
    if (req.body.notes !== undefined) d.notes = req.body.notes;
    const { data, error } = await supabase.from('losses').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapLoss(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase.from('losses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase.from('losses').select('original_value, insurance_claim, net_loss, category, status');
    const all = data || [];
    res.json({ success: true, data: {
      totalLosses: all.length, totalValue: all.reduce((s, l) => s + (l.original_value || 0), 0),
      totalInsurance: all.reduce((s, l) => s + (l.insurance_claim || 0), 0), totalNetLoss: all.reduce((s, l) => s + (l.net_loss || 0), 0),
    }});
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

module.exports = router;
