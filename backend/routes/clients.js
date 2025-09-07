const express = require('express');
const router = express.Router();
const { clientValidation } = require('../middleware/validation');
const sendError = require('../utils/sendError');
const { requireAuth, requireRole, requireViewerOrHigher } = require('../middleware/auth');
const Client = require('../models/Client');

// GET all clients (with filtering, search, pagination)
router.get('/', requireAuth, requireViewerOrHigher, async (req, res) => {
  try {
    const { industry, status, priority, search, page = 1, limit = 10000 } = req.query;
    const filter = {};
    if (industry) filter.industry = industry;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10000;
    const total = await Client.countDocuments(filter);
    const pages = Math.ceil(total / pageSize);
    const clients = await Client.find(filter)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize);
    res.json({
      success: true,
      data: clients,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
        nextPage: pageNum < pages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب العملاء', 'INTERNAL_ERROR', err.message);
  }
});

// GET single client
router.get('/:id', requireAuth, requireViewerOrHigher, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');
    res.json({ success: true, data: client });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب بيانات العميل', 'INTERNAL_ERROR', err.message);
  }
});

// POST add client
router.post('/', requireAuth, requireRole('admin'), clientValidation, async (req, res) => {
  try {
    const newClient = new Client({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    await newClient.save();
    res.json({ success: true, message: 'تم إضافة العميل بنجاح', data: newClient });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة العميل', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update client
router.put('/:id', requireAuth, requireRole('admin'), clientValidation, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم تحديث العميل بنجاح', data: client });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث العميل', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE client
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف العميل', 'VALIDATION_ERROR', err.message);
  }
});

module.exports = router; 