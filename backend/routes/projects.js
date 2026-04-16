const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// ====== HELPERS ======

function mapProject(p) {
  if (!p) return p;
  return {
    ...p, _id: p.id,
    projectNumber: p.project_number,
    clientId: p.client_id,
    subCategory: p.sub_category,
    startDate: p.start_date,
    endDateExpected: p.end_date_expected,
    endDateActual: p.end_date_actual,
    totalAmount: p.total_amount,
    exchangeRate: p.exchange_rate,
    amountEgp: p.amount_egp,
    paymentMethod: p.payment_method,
    totalPaid: p.total_paid,
    remainingAmount: p.remaining_amount,
    assignedTo: p.assigned_to,
    createdBy: p.created_by,
    updatedBy: p.updated_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    // Joined data
    clientName: p.clients?.name || null,
    logoUrl: p.logo_url,
    assignedToName: p.users?.first_name ? `${p.users.first_name} ${p.users.last_name || ''}`.trim() : null,
  };
}

function mapBody(b) {
  const d = {};
  if (b.name !== undefined) d.name = b.name;
  if (b.clientId || b.client_id) d.client_id = b.clientId || b.client_id;
  if (b.department !== undefined) d.department = b.department;
  if (b.category !== undefined) d.category = b.category;
  if (b.subCategory || b.sub_category) d.sub_category = b.subCategory || b.sub_category;
  if (b.description !== undefined) d.description = b.description;
  if (b.startDate || b.start_date) d.start_date = b.startDate || b.start_date;
  if (b.endDateExpected || b.end_date_expected) d.end_date_expected = b.endDateExpected || b.end_date_expected;
  if (b.endDateActual || b.end_date_actual) d.end_date_actual = b.endDateActual || b.end_date_actual;
  if (b.status !== undefined) d.status = b.status;
  if (b.priority !== undefined) d.priority = b.priority;
  if (b.totalAmount !== undefined || b.total_amount !== undefined) d.total_amount = parseFloat(b.totalAmount || b.total_amount) || 0;
  if (b.currency !== undefined) d.currency = b.currency;
  if (b.exchangeRate !== undefined) d.exchange_rate = parseFloat(b.exchangeRate) || 1;
  if (b.paymentMethod || b.payment_method) d.payment_method = b.paymentMethod || b.payment_method;
  if (b.assignedTo || b.assigned_to) d.assigned_to = b.assignedTo || b.assigned_to;
  if (b.notes !== undefined) d.notes = b.notes;
  if (b.tags !== undefined) d.tags = b.tags;
  if (b.logoUrl || b.logo_url) d.logo_url = b.logoUrl || b.logo_url;
  // Calculate EGP amount
  if (d.total_amount && d.exchange_rate) d.amount_egp = d.total_amount * (d.exchange_rate || 1);
  d.remaining_amount = d.total_amount || 0;
  return d;
}

function mapSchedule(s) {
  if (!s) return s;
  return { ...s, _id: s.id, projectId: s.project_id, dueDate: s.due_date, paidDate: s.paid_date, paymentRef: s.payment_ref, sortOrder: s.sort_order, createdAt: s.created_at };
}

function mapPayment(p) {
  if (!p) return p;
  return { ...p, _id: p.id, projectId: p.project_id, scheduleId: p.schedule_id, exchangeRate: p.exchange_rate, amountEgp: p.amount_egp, paymentDate: p.payment_date, createdBy: p.created_by, createdAt: p.created_at };
}

// ====== ROUTES ======

// GET all projects
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, priority, department, client_id, search, page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page); const pageSize = parseInt(limit);
    const from = (pageNum - 1) * pageSize;

    let query = supabase.from('projects').select('*, clients!projects_client_id_fkey(name)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (department) query = query.eq('department', department);
    if (client_id) query = query.eq('client_id', client_id);
    if (search) query = query.or(`name.ilike.%${search}%,project_number.ilike.%${search}%,description.ilike.%${search}%`);

    query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map(mapProject),
      pagination: { page: pageNum, limit: pageSize, total: count, pages: Math.ceil(count / pageSize) },
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب المشاريع', 'INTERNAL_ERROR', err.message);
  }
});

// GET single project with schedules & payments
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects').select('*, clients!projects_client_id_fkey(name, email, phone)')
      .eq('id', req.params.id).single();
    if (error || !project) return sendError(res, 404, 'المشروع غير موجود', 'NOT_FOUND');

    const [schedulesRes, paymentsRes] = await Promise.all([
      supabase.from('payment_schedules').select('*').eq('project_id', req.params.id).order('sort_order'),
      supabase.from('project_payments').select('*').eq('project_id', req.params.id).order('payment_date', { ascending: false }),
    ]);

    res.json({
      success: true,
      data: {
        ...mapProject(project),
        schedules: (schedulesRes.data || []).map(mapSchedule),
        payments: (paymentsRes.data || []).map(mapPayment),
      },
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب المشروع', 'INTERNAL_ERROR', err.message);
  }
});

// POST create project
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (!req.body.name) return sendError(res, 400, 'اسم المشروع مطلوب', 'VALIDATION_ERROR');

    // Auto-generate project number
    const { data: last } = await supabase.from('projects').select('project_number')
      .not('project_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1;
    if (last?.project_number) { const m = last.project_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const year = new Date().getFullYear();
    const projectNumber = `PRJ-${year}-${String(num).padStart(4, '0')}`;

    const insertData = { ...mapBody(req.body), project_number: projectNumber, created_by: req.user?.id };
    const { data: project, error } = await supabase.from('projects').insert(insertData).select().single();
    if (error) throw error;

    // Auto-create payment schedules if installments/milestones
    if (req.body.paymentMethod === 'installments' && req.body.installments) {
      const total = parseFloat(req.body.totalAmount) || 0;
      const count = parseInt(req.body.installments) || 1;
      const each = Math.round(total / count * 100) / 100;
      const startDate = new Date(req.body.startDate || new Date());
      const schedules = [];
      for (let i = 0; i < count; i++) {
        const due = new Date(startDate);
        due.setMonth(due.getMonth() + i);
        schedules.push({
          project_id: project.id, type: 'installment',
          label: `القسط ${i + 1}`, amount: i === count - 1 ? total - each * (count - 1) : each,
          due_date: due.toISOString().split('T')[0], sort_order: i,
        });
      }
      await supabase.from('payment_schedules').insert(schedules);
    }

    if (req.body.paymentMethod === 'milestones' && req.body.milestones) {
      const milestones = req.body.milestones.map((m, i) => ({
        project_id: project.id, type: 'milestone',
        label: m.label || `مرحلة ${i + 1}`, amount: parseFloat(m.amount) || 0,
        due_date: m.dueDate || null, sort_order: i,
      }));
      await supabase.from('payment_schedules').insert(milestones);
    }

    res.json({ success: true, message: 'تم إنشاء المشروع بنجاح', data: mapProject(project) });
  } catch (err) {
    sendError(res, 400, 'خطأ في إنشاء المشروع', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update project
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const updateData = { ...mapBody(req.body), updated_by: req.user?.id };
    // Don't overwrite remaining_amount on general updates
    delete updateData.remaining_amount;

    const { data, error } = await supabase.from('projects').update(updateData).eq('id', req.params.id).select().single();
    if (error) throw error;

    res.json({ success: true, message: 'تم تحديث المشروع', data: mapProject(data) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث المشروع', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE project
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await supabase.from('project_payments').delete().eq('project_id', req.params.id);
    await supabase.from('payment_schedules').delete().eq('project_id', req.params.id);
    const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم حذف المشروع' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف المشروع', 'VALIDATION_ERROR', err.message);
  }
});

// POST record payment for project
router.post('/:id/payments', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { amount, method, reference, notes, scheduleId } = req.body;
    if (!amount) return sendError(res, 400, 'المبلغ مطلوب', 'VALIDATION_ERROR');

    const parsedAmount = parseFloat(amount);

    // Insert payment
    const { data: payment, error } = await supabase.from('project_payments').insert({
      project_id: req.params.id,
      schedule_id: scheduleId || null,
      amount: parsedAmount,
      currency: req.body.currency || 'EGP',
      exchange_rate: parseFloat(req.body.exchangeRate) || 1,
      amount_egp: parsedAmount * (parseFloat(req.body.exchangeRate) || 1),
      payment_date: req.body.paymentDate || new Date().toISOString().split('T')[0],
      method: method || 'كاش',
      reference, notes,
      created_by: req.user?.id,
    }).select().single();
    if (error) throw error;

    // Update schedule status if linked
    if (scheduleId) {
      await supabase.from('payment_schedules').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', scheduleId);
    }

    // Recalculate project totals
    const { data: allPayments } = await supabase.from('project_payments').select('amount').eq('project_id', req.params.id);
    const totalPaid = (allPayments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const { data: project } = await supabase.from('projects').select('total_amount').eq('id', req.params.id).single();
    const remaining = Math.max(0, (project?.total_amount || 0) - totalPaid);

    await supabase.from('projects').update({
      total_paid: totalPaid,
      remaining_amount: remaining,
      status: remaining <= 0 ? 'completed' : undefined,
    }).eq('id', req.params.id);

    res.json({ success: true, message: 'تم تسجيل الدفعة', data: mapPayment(payment) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تسجيل الدفعة', 'VALIDATION_ERROR', err.message);
  }
});

// GET project stats
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const { data: projects } = await supabase.from('projects').select('status, total_amount, total_paid, remaining_amount');
    const all = projects || [];
    const stats = {
      totalProjects: all.length,
      totalValue: all.reduce((s, p) => s + (p.total_amount || 0), 0),
      totalPaid: all.reduce((s, p) => s + (p.total_paid || 0), 0),
      totalRemaining: all.reduce((s, p) => s + (p.remaining_amount || 0), 0),
      byStatus: {
        new: all.filter(p => p.status === 'new').length,
        in_progress: all.filter(p => p.status === 'in_progress').length,
        completed: all.filter(p => p.status === 'completed').length,
        on_hold: all.filter(p => p.status === 'on_hold').length,
        cancelled: all.filter(p => p.status === 'cancelled').length,
      },
    };
    res.json({ success: true, data: stats });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب إحصائيات المشاريع', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
