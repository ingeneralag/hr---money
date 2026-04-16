const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

function mapDR(d) { return d ? { ...d, _id: d.id, referenceNumber: d.reference_number, clientId: d.client_id, projectId: d.project_id, totalAmount: d.total_amount, recognizedAmount: d.recognized_amount, remainingAmount: d.remaining_amount, receivedDate: d.received_date, expectedCompletion: d.expected_completion, createdBy: d.created_by, createdAt: d.created_at, clientName: d.clients?.name, projectName: d.projects?.name } : d; }

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('deferred_revenue').select('*, clients(name), projects(name)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(mapDR) });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: last } = await supabase.from('deferred_revenue').select('reference_number').not('reference_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1; if (last?.reference_number) { const m = last.reference_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const ref = `DFR-${String(num).padStart(4, '0')}`;
    const total = parseFloat(req.body.totalAmount) || 0;

    const { data, error } = await supabase.from('deferred_revenue').insert({
      reference_number: ref, client_id: req.body.clientId, project_id: req.body.projectId,
      description: req.body.description, total_amount: total, remaining_amount: total,
      received_date: req.body.receivedDate, expected_completion: req.body.expectedCompletion,
      notes: req.body.notes, created_by: req.user?.id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم تسجيل الإيراد المؤجل', data: mapDR(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.recognizedAmount !== undefined) {
      d.recognized_amount = parseFloat(req.body.recognizedAmount);
      const { data: existing } = await supabase.from('deferred_revenue').select('total_amount').eq('id', req.params.id).single();
      d.remaining_amount = (existing?.total_amount || 0) - d.recognized_amount;
      d.status = d.remaining_amount <= 0 ? 'recognized' : d.recognized_amount > 0 ? 'partial' : 'deferred';
    }
    if (req.body.status) d.status = req.body.status;
    if (req.body.notes !== undefined) d.notes = req.body.notes;
    const { data, error } = await supabase.from('deferred_revenue').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapDR(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase.from('deferred_revenue').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

module.exports = router;
