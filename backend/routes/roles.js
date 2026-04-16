const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET all roles
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('roles').select('*').order('created_at');
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(r => ({ ...r, _id: r.id, nameAr: r.name_ar, isSystem: r.is_system, createdAt: r.created_at })) });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

// PUT update role permissions
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const updateData = {};
    if (req.body.permissions) updateData.permissions = req.body.permissions;
    if (req.body.nameAr) updateData.name_ar = req.body.nameAr;
    if (req.body.description) updateData.description = req.body.description;
    const { data, error } = await supabase.from('roles').update(updateData).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم تحديث الصلاحيات', data: { ...data, _id: data.id } });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// POST create custom role
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('roles').insert({
      name: req.body.name, name_ar: req.body.nameAr, description: req.body.description,
      permissions: req.body.permissions || {}, is_system: false,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم إنشاء الدور', data: { ...data, _id: data.id } });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

// DELETE custom role
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: role } = await supabase.from('roles').select('is_system').eq('id', req.params.id).single();
    if (role?.is_system) return sendError(res, 400, 'لا يمكن حذف دور نظامي', 'VALIDATION_ERROR');
    const { error } = await supabase.from('roles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم حذف الدور' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

module.exports = router;
