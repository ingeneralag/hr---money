const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// ====== HELPERS ======
function mapInvoice(inv) {
  if (!inv) return inv;
  return {
    ...inv, _id: inv.id,
    invoiceNumber: inv.invoice_number, clientId: inv.client_id, projectId: inv.project_id,
    dueDate: inv.due_date, discountType: inv.discount_type, discountValue: inv.discount_value,
    discountAmount: inv.discount_amount, vatRate: inv.vat_rate, vatAmount: inv.vat_amount,
    whtRate: inv.wht_rate, whtAmount: inv.wht_amount, exchangeRate: inv.exchange_rate,
    totalEgp: inv.total_egp, paidAmount: inv.paid_amount, remainingAmount: inv.remaining_amount,
    paymentMethod: inv.payment_method, createdBy: inv.created_by, createdAt: inv.created_at,
    updatedAt: inv.updated_at,
    clientName: inv.clients?.name || null, clientLogoUrl: inv.clients?.logo_url || null, projectName: inv.projects?.name || null,
    items: (inv._items || []).map(it => ({ ...it, _id: it.id, invoiceId: it.invoice_id, unitPrice: it.unit_price, sortOrder: it.sort_order })),
    payments: (inv._payments || []).map(p => ({ ...p, _id: p.id, invoiceId: p.invoice_id, paymentDate: p.payment_date, createdBy: p.created_by })),
  };
}

function calcTotals(items, discountType, discountValue, vatRate, whtRate) {
  const subtotal = items.reduce((s, it) => s + ((it.quantity || 1) * (it.unitPrice || it.unit_price || 0) - (it.discount || 0)), 0);
  const discountAmount = discountType === 'percentage' ? subtotal * (discountValue || 0) / 100 : (discountValue || 0);
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * (vatRate || 0) / 100;
  const whtAmount = afterDiscount * (whtRate || 0) / 100;
  const total = afterDiscount + vatAmount - whtAmount;
  return { subtotal: Math.round(subtotal * 100) / 100, discountAmount: Math.round(discountAmount * 100) / 100, vatAmount: Math.round(vatAmount * 100) / 100, whtAmount: Math.round(whtAmount * 100) / 100, total: Math.round(total * 100) / 100 };
}

// ====== ROUTES ======

// GET all invoices
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, client_id, search, page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page); const pageSize = parseInt(limit);
    const from = (pageNum - 1) * pageSize;

    let query = supabase.from('invoices').select('*, clients!invoices_client_id_fkey(name, logo_url), projects!invoices_project_id_fkey(name)', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (client_id) query = query.eq('client_id', client_id);
    if (search) query = query.or(`invoice_number.ilike.%${search}%,notes.ilike.%${search}%`);
    query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map(inv => mapInvoice({ ...inv, _items: [], _payments: [] })),
      pagination: { page: pageNum, limit: pageSize, total: count, pages: Math.ceil(count / pageSize) },
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب الفواتير', 'INTERNAL_ERROR', err.message);
  }
});

// GET single invoice with items & payments
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: inv, error } = await supabase.from('invoices')
      .select('*, clients!invoices_client_id_fkey(name, email, phone, address_street, address_city, tax_number, logo_url), projects!invoices_project_id_fkey(name)')
      .eq('id', req.params.id).single();
    if (error || !inv) return sendError(res, 404, 'الفاتورة غير موجودة', 'NOT_FOUND');

    const [itemsRes, paymentsRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', req.params.id).order('sort_order'),
      supabase.from('invoice_payments').select('*').eq('invoice_id', req.params.id).order('payment_date', { ascending: false }),
    ]);

    res.json({ success: true, data: mapInvoice({ ...inv, _items: itemsRes.data || [], _payments: paymentsRes.data || [] }) });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب الفاتورة', 'INTERNAL_ERROR', err.message);
  }
});

// POST create invoice
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { items, clientId, projectId, dueDate, discountType, discountValue, vatRate, whtRate, currency, notes, terms, paymentMethod } = req.body;
    if (!items || items.length === 0) return sendError(res, 400, 'عناصر الفاتورة مطلوبة', 'VALIDATION_ERROR');

    // Auto number
    const { data: last } = await supabase.from('invoices').select('invoice_number').not('invoice_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1;
    if (last?.invoice_number) { const m = last.invoice_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;

    const totals = calcTotals(items, discountType, discountValue, vatRate || 14, whtRate || 0);
    const exchRate = parseFloat(req.body.exchangeRate) || 1;

    const { data: invoice, error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: clientId || null, project_id: projectId || null,
      date: req.body.date || new Date().toISOString().split('T')[0],
      due_date: dueDate || null,
      subtotal: totals.subtotal, discount_type: discountType || 'fixed', discount_value: discountValue || 0,
      discount_amount: totals.discountAmount, vat_rate: vatRate || 14, vat_amount: totals.vatAmount,
      wht_rate: whtRate || 0, wht_amount: totals.whtAmount,
      total: totals.total, currency: currency || 'EGP', exchange_rate: exchRate,
      total_egp: totals.total * exchRate,
      remaining_amount: totals.total,
      payment_method: paymentMethod || null, notes, terms,
      created_by: req.user?.id,
    }).select().single();
    if (error) throw error;

    // Insert items
    const itemRows = items.map((it, i) => ({
      invoice_id: invoice.id,
      description: it.description,
      quantity: parseFloat(it.quantity) || 1,
      unit_price: parseFloat(it.unitPrice || it.unit_price) || 0,
      discount: parseFloat(it.discount) || 0,
      subtotal: (parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice || it.unit_price) || 0) - (parseFloat(it.discount) || 0),
      sort_order: i,
    }));
    await supabase.from('invoice_items').insert(itemRows);

    res.json({ success: true, message: 'تم إنشاء الفاتورة بنجاح', data: { ...mapInvoice({ ...invoice, _items: [], _payments: [] }), invoiceNumber } });
  } catch (err) {
    sendError(res, 400, 'خطأ في إنشاء الفاتورة', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update invoice
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { items, clientId, projectId, dueDate, discountType, discountValue, vatRate, whtRate, currency, notes, terms, status } = req.body;

    const updateData = { updated_by: req.user?.id };
    if (clientId !== undefined) updateData.client_id = clientId;
    if (projectId !== undefined) updateData.project_id = projectId;
    if (dueDate !== undefined) updateData.due_date = dueDate;
    if (req.body.date) updateData.date = req.body.date;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (terms !== undefined) updateData.terms = terms;
    if (currency) updateData.currency = currency;
    if (req.body.paymentMethod) updateData.payment_method = req.body.paymentMethod;

    if (items && items.length > 0) {
      const totals = calcTotals(items, discountType, discountValue, vatRate || 14, whtRate || 0);
      Object.assign(updateData, {
        subtotal: totals.subtotal, discount_type: discountType, discount_value: discountValue,
        discount_amount: totals.discountAmount, vat_rate: vatRate, vat_amount: totals.vatAmount,
        wht_rate: whtRate, wht_amount: totals.whtAmount, total: totals.total,
        remaining_amount: totals.total - (updateData.paid_amount || 0),
      });
      // Replace items
      await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
      await supabase.from('invoice_items').insert(items.map((it, i) => ({
        invoice_id: req.params.id, description: it.description,
        quantity: parseFloat(it.quantity) || 1, unit_price: parseFloat(it.unitPrice || it.unit_price) || 0,
        discount: parseFloat(it.discount) || 0,
        subtotal: (parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice || it.unit_price) || 0) - (parseFloat(it.discount) || 0),
        sort_order: i,
      })));
    }

    const { data, error } = await supabase.from('invoices').update(updateData).eq('id', req.params.id).select().single();
    if (error) throw error;

    res.json({ success: true, message: 'تم تحديث الفاتورة', data: mapInvoice({ ...data, _items: [], _payments: [] }) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث الفاتورة', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE invoice
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await supabase.from('invoice_payments').delete().eq('invoice_id', req.params.id);
    await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
    const { error } = await supabase.from('invoices').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'تم حذف الفاتورة' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الفاتورة', 'VALIDATION_ERROR', err.message);
  }
});

// POST record payment
router.post('/:id/payments', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;
    if (!amount) return sendError(res, 400, 'المبلغ مطلوب', 'VALIDATION_ERROR');

    const { data: payment, error } = await supabase.from('invoice_payments').insert({
      invoice_id: req.params.id, amount: parseFloat(amount),
      payment_date: req.body.paymentDate || new Date().toISOString().split('T')[0],
      method: method || 'كاش', reference, notes, created_by: req.user?.id,
    }).select().single();
    if (error) throw error;

    // Recalculate
    const { data: allPay } = await supabase.from('invoice_payments').select('amount').eq('invoice_id', req.params.id);
    const totalPaid = (allPay || []).reduce((s, p) => s + (p.amount || 0), 0);
    const { data: inv } = await supabase.from('invoices').select('total').eq('id', req.params.id).single();
    const remaining = Math.max(0, (inv?.total || 0) - totalPaid);
    const newStatus = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'sent';

    await supabase.from('invoices').update({ paid_amount: totalPaid, remaining_amount: remaining, status: newStatus }).eq('id', req.params.id);

    res.json({ success: true, message: 'تم تسجيل الدفعة', data: { ...payment, _id: payment.id } });
  } catch (err) {
    sendError(res, 400, 'خطأ في تسجيل الدفعة', 'VALIDATION_ERROR', err.message);
  }
});

// POST convert quotation to invoice
router.post('/from-quotation/:quoteId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: quote, error: qErr } = await supabase.from('quotations').select('*').eq('id', req.params.quoteId).single();
    if (qErr || !quote) return sendError(res, 404, 'عرض السعر غير موجود', 'NOT_FOUND');

    const { data: qItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', req.params.quoteId);

    // Create invoice from quotation data
    const { data: last } = await supabase.from('invoices').select('invoice_number').not('invoice_number', 'is', null).order('created_at', { ascending: false }).limit(1).single();
    let num = 1;
    if (last?.invoice_number) { const m = last.invoice_number.match(/(\d+)$/); if (m) num = parseInt(m[1]) + 1; }
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;

    const { data: invoice, error: iErr } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber, client_id: quote.client_id, project_id: quote.project_id,
      date: new Date().toISOString().split('T')[0], due_date: null,
      subtotal: quote.subtotal, discount_type: quote.discount_type, discount_value: quote.discount_value,
      discount_amount: quote.discount_amount, vat_rate: quote.vat_rate, vat_amount: quote.vat_amount,
      total: quote.total, currency: quote.currency, remaining_amount: quote.total,
      notes: quote.notes, terms: quote.terms, created_by: req.user?.id,
    }).select().single();
    if (iErr) throw iErr;

    // Copy items
    if (qItems && qItems.length > 0) {
      await supabase.from('invoice_items').insert(qItems.map((it, i) => ({
        invoice_id: invoice.id, description: it.description,
        quantity: it.quantity, unit_price: it.unit_price, discount: it.discount, subtotal: it.subtotal, sort_order: i,
      })));
    }

    // Mark quotation as accepted
    await supabase.from('quotations').update({ status: 'accepted', converted_invoice_id: invoice.id }).eq('id', req.params.quoteId);

    res.json({ success: true, message: 'تم تحويل عرض السعر لفاتورة', data: { invoiceId: invoice.id, invoiceNumber } });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحويل عرض السعر', 'VALIDATION_ERROR', err.message);
  }
});

// GET stats
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const { data: invs } = await supabase.from('invoices').select('status, total, paid_amount, remaining_amount, vat_amount');
    const all = invs || [];
    res.json({
      success: true,
      data: {
        totalInvoices: all.length,
        totalAmount: all.reduce((s, i) => s + (i.total || 0), 0),
        totalPaid: all.reduce((s, i) => s + (i.paid_amount || 0), 0),
        totalRemaining: all.reduce((s, i) => s + (i.remaining_amount || 0), 0),
        totalVat: all.reduce((s, i) => s + (i.vat_amount || 0), 0),
        byStatus: {
          draft: all.filter(i => i.status === 'draft').length,
          sent: all.filter(i => i.status === 'sent').length,
          paid: all.filter(i => i.status === 'paid').length,
          partially_paid: all.filter(i => i.status === 'partially_paid').length,
          overdue: all.filter(i => i.status === 'overdue').length,
        },
      },
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في إحصائيات الفواتير', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
