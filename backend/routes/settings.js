const express = require('express');
const router = express.Router();
const { settingsValidation } = require('../middleware/validation');
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET all settings
router.get('/', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*');

    if (error) throw error;

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST add settings
router.post('/', requireAuth, requireRole('admin'), settingsValidation, async (req, res) => {
  try {
    const { data: newSetting, error } = await supabase
      .from('settings')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(newSetting);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update settings
router.put('/:id', requireAuth, requireRole('admin'), settingsValidation, async (req, res) => {
  try {
    const { data: setting, error } = await supabase
      .from('settings')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!setting) return sendError(res, 404, 'الإعدادات غير موجودة', 'NOT_FOUND');

    res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح', data: setting });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث الإعدادات', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE settings
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: setting, error } = await supabase
      .from('settings')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!setting) return sendError(res, 404, 'الإعدادات غير موجودة', 'NOT_FOUND');

    res.json({ success: true, message: 'تم حذف الإعدادات بنجاح' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الإعدادات', 'VALIDATION_ERROR', err.message);
  }
});

module.exports = router;
