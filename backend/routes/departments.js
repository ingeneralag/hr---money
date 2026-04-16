const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

function mapDept(d) { return d ? { ...d, _id: d.id, nameAr: d.name_ar, nameEn: d.name_en, sortOrder: d.sort_order, createdAt: d.created_at } : d; }

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('departments').select('*').order('sort_order');
    if (error) throw error;

    // Get categories per department
    const { data: cats } = await supabase.from('categories').select('id, name, name_en, type, department_id, is_active');
    const deptData = (data || []).map(d => ({
      ...mapDept(d),
      categories: (cats || []).filter(c => c.department_id === d.id).map(c => ({ ...c, _id: c.id, nameEn: c.name_en, isActive: c.is_active })),
    }));

    res.json({ success: true, data: deptData });
  } catch (err) { sendError(res, 500, 'خطأ', 'INTERNAL_ERROR', err.message); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('departments').insert({
      name_ar: req.body.nameAr || req.body.name, name_en: req.body.nameEn,
      icon: req.body.icon, color: req.body.color, sort_order: req.body.sortOrder || 0,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم إضافة القسم', data: mapDept(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const d = {};
    if (req.body.nameAr || req.body.name) d.name_ar = req.body.nameAr || req.body.name;
    if (req.body.nameEn) d.name_en = req.body.nameEn;
    if (req.body.icon) d.icon = req.body.icon;
    if (req.body.color) d.color = req.body.color;
    if (req.body.sortOrder !== undefined) d.sort_order = req.body.sortOrder;
    if (req.body.status) d.status = req.body.status;
    const { data, error } = await supabase.from('departments').update(d).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'تم التحديث', data: mapDept(data) });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await supabase.from('categories').update({ department_id: null }).eq('department_id', req.params.id);
    const { error } = await supabase.from('departments').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم حذف القسم' });
  } catch (err) { sendError(res, 400, 'خطأ', 'VALIDATION_ERROR', err.message); }
});

module.exports = router;
