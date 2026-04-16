const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

function mapAsset(a) {
  if (!a) return a;
  return { ...a, _id: a.id, assetNumber: a.asset_number, serialNumber: a.serial_number, purchaseDate: a.purchase_date, purchasePrice: a.purchase_price, currentCondition: a.current_condition, assignedTo: a.assigned_to, warrantyExpiry: a.warranty_expiry, depreciationRate: a.depreciation_rate, createdBy: a.created_by, createdAt: a.created_at, assignedToName: a.employees?.name || null };
}

function mapRepair(r) {
  if (!r) return r;
  return { ...r, _id: r.id, repairNumber: r.repair_number, assetId: r.asset_id, warrantyDate: r.warranty_date, receiptUrl: r.receipt_url, createdBy: r.created_by, createdAt: r.created_at, assetName: r.assets?.name || null };
}

// ====== ASSETS ======
router.get('/assets', requireAuth, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = supabase.from('assets').select('*, employees(name)', { count: 'exact' });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(mapAsset), total: count });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

router.post('/assets', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: last } = await supabase.from('assets').select('asset_number').not('asset_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1; if (last?.asset_number) { const m = last.asset_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const assetNumber = `AST-${String(num).padStart(4, '0')}`;

    const { data, error } = await supabase.from('assets').insert({
      asset_number: assetNumber, name: req.body.name, type: req.body.type,
      serial_number: req.body.serialNumber || req.body.serial_number,
      purchase_date: req.body.purchaseDate || req.body.purchase_date,
      purchase_price: parseFloat(req.body.purchasePrice || req.body.purchase_price) || 0,
      current_condition: req.body.currentCondition || req.body.current_condition || 'new',
      assigned_to: req.body.assignedTo || req.body.assigned_to || null,
      location: req.body.location,
      warranty_expiry: req.body.warrantyExpiry || req.body.warranty_expiry || null,
      notes: req.body.notes, created_by: req.user?.id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم إضافة الأصل', data: mapAsset(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.put('/assets/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.name) d.name = req.body.name;
    if (req.body.type) d.type = req.body.type;
    if (req.body.serialNumber) d.serial_number = req.body.serialNumber;
    if (req.body.currentCondition) d.current_condition = req.body.currentCondition;
    if (req.body.assignedTo !== undefined) d.assigned_to = req.body.assignedTo || null;
    if (req.body.location !== undefined) d.location = req.body.location;
    if (req.body.status) d.status = req.body.status;
    if (req.body.notes !== undefined) d.notes = req.body.notes;
    const { data, error } = await supabase.from('assets').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapAsset(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.delete('/assets/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await supabase.from('repairs').delete().eq('asset_id', req.params.id);
    const { error } = await supabase.from('assets').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// ====== REPAIRS ======
router.get('/repairs', requireAuth, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = supabase.from('repairs').select('*, assets(name)', { count: 'exact' });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('description', `%${search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(mapRepair), total: count });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

router.post('/repairs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: last } = await supabase.from('repairs').select('repair_number').not('repair_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1; if (last?.repair_number) { const m = last.repair_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const repairNumber = `REP-${String(num).padStart(4, '0')}`;

    const { data, error } = await supabase.from('repairs').insert({
      repair_number: repairNumber, date: req.body.date || new Date().toISOString().split('T')[0],
      type: req.body.type, description: req.body.description, category: req.body.category,
      cost: parseFloat(req.body.cost) || 0, currency: req.body.currency || 'EGP',
      vendor: req.body.vendor, asset_id: req.body.assetId || req.body.asset_id || null,
      status: req.body.status || 'planned', notes: req.body.notes, created_by: req.user?.id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم إضافة عملية الصيانة', data: mapRepair(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.put('/repairs/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.type) d.type = req.body.type;
    if (req.body.description) d.description = req.body.description;
    if (req.body.cost) d.cost = parseFloat(req.body.cost);
    if (req.body.vendor) d.vendor = req.body.vendor;
    if (req.body.status) d.status = req.body.status;
    if (req.body.notes !== undefined) d.notes = req.body.notes;
    const { data, error } = await supabase.from('repairs').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapRepair(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// Stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [{ data: assets }, { data: repairs }] = await Promise.all([
      supabase.from('assets').select('purchase_price, status, type'),
      supabase.from('repairs').select('cost, type, status'),
    ]);
    res.json({ success: true, data: {
      totalAssets: (assets || []).length, totalAssetsValue: (assets || []).reduce((s, a) => s + (a.purchase_price || 0), 0),
      activeAssets: (assets || []).filter(a => a.status === 'active').length,
      totalRepairs: (repairs || []).length, totalRepairsCost: (repairs || []).reduce((s, r) => s + (r.cost || 0), 0),
    }});
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

module.exports = router;
