const express = require('express');
const router = express.Router();
const sendError = require('../utils/sendError');
const { requireAuth, requireRole, requireViewerOrHigher } = require('../middleware/auth');
const { supabase } = require('../config/database');

// Helper: map snake_case client to camelCase for frontend
function mapClient(c) {
  if (!c) return c;
  return {
    ...c,
    _id: c.id,
    clientNumber: c.client_number,
    alternativePhone: c.alternative_phone,
    addressStreet: c.address_street,
    addressCity: c.address_city,
    addressGovernorate: c.address_governorate,
    addressCountry: c.address_country,
    addressPostalCode: c.address_postal_code,
    address: {
      street: c.address_street || '',
      city: c.address_city || '',
      governorate: c.address_governorate || '',
      country: c.address_country || 'Egypt',
      postalCode: c.address_postal_code || '',
    },
    contactPerson: {
      name: c.contact_person_name || '',
      position: c.contact_person_position || '',
      email: c.contact_person_email || '',
      phone: c.contact_person_phone || '',
    },
    financialInfo: {
      creditLimit: c.credit_limit || 0,
      paymentTerms: c.payment_terms || 30,
      taxNumber: c.tax_number || '',
      currency: c.currency || 'EGP',
    },
    creditLimit: c.credit_limit || 0,
    paymentTerms: c.payment_terms,
    taxNumber: c.tax_number,
    businessType: c.business_type,
    foundedYear: c.founded_year,
    employeeCount: c.employee_count,
    annualRevenue: c.annual_revenue,
    totalProjects: c.total_projects || 0,
    activeProjects: c.active_projects || 0,
    completedProjects: c.completed_projects || 0,
    totalPayments: c.total_payments || 0,
    outstandingPayments: c.outstanding_payments || 0,
    lastPaymentDate: c.last_payment_date,
    contractStartDate: c.contract_start_date,
    contractEndDate: c.contract_end_date,
    logoUrl: c.logo_url,
    createdBy: c.created_by,
    updatedBy: c.updated_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    // Computed fields for frontend stats
    currentBalance: (c.total_payments || 0) - (c.outstanding_payments || 0),
    joinDate: c.contract_start_date || c.created_at,
  };
}

// Helper: map frontend camelCase to snake_case for DB insert/update
function mapClientBody(body) {
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.company !== undefined) data.company = body.company;
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.alternativePhone || body.alternative_phone) data.alternative_phone = body.alternativePhone || body.alternative_phone;
  if (body.website !== undefined) data.website = body.website;
  if (body.industry !== undefined) data.industry = body.industry;
  if (body.status !== undefined) data.status = body.status;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.source !== undefined) data.source = body.source;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.tags !== undefined) data.tags = body.tags;

  // Address - accept both flat and nested
  if (body.address && typeof body.address === 'object') {
    data.address_street = body.address.street || '';
    data.address_city = body.address.city || '';
    data.address_governorate = body.address.governorate || '';
    data.address_country = body.address.country || 'Egypt';
    data.address_postal_code = body.address.postalCode || '';
  }
  if (body.address_street !== undefined) data.address_street = body.address_street;
  if (body.address_city !== undefined) data.address_city = body.address_city;

  // Contact person
  if (body.contactPerson && typeof body.contactPerson === 'object') {
    data.contact_person_name = body.contactPerson.name || '';
    data.contact_person_position = body.contactPerson.position || '';
    data.contact_person_email = body.contactPerson.email || '';
    data.contact_person_phone = body.contactPerson.phone || '';
  }

  // Financial info
  if (body.financialInfo && typeof body.financialInfo === 'object') {
    data.credit_limit = body.financialInfo.creditLimit || 0;
    data.payment_terms = body.financialInfo.paymentTerms || 30;
    data.tax_number = body.financialInfo.taxNumber || '';
    data.currency = body.financialInfo.currency || 'EGP';
  }
  if (body.creditLimit !== undefined) data.credit_limit = body.creditLimit;
  if (body.taxNumber !== undefined) data.tax_number = body.taxNumber;

  // Business info
  if (body.businessType !== undefined) data.business_type = body.businessType;
  if (body.foundedYear !== undefined) data.founded_year = body.foundedYear;

  // Contract dates
  if (body.contractStartDate) data.contract_start_date = body.contractStartDate;
  if (body.contractEndDate) data.contract_end_date = body.contractEndDate;

  // Social media
  if (body.facebook !== undefined) data.facebook = body.facebook;
  if (body.linkedin !== undefined) data.linkedin = body.linkedin;
  if (body.twitter !== undefined) data.twitter = body.twitter;
  if (body.logoUrl !== undefined || body.logo_url !== undefined) data.logo_url = body.logoUrl || body.logo_url;

  return data;
}

// GET all clients
router.get('/', requireAuth, requireViewerOrHigher, async (req, res) => {
  try {
    const { industry, status, priority, search, page = 1, limit = 10000 } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10000;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('clients').select('*', { count: 'exact' });

    if (industry) query = query.eq('industry', industry);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: clients, count: total, error } = await query;
    if (error) throw error;

    const pages = Math.ceil(total / pageSize);
    res.json({
      success: true,
      data: (clients || []).map(mapClient),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
      }
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب العملاء', 'INTERNAL_ERROR', err.message);
  }
});

// GET single client
router.get('/:id', requireAuth, requireViewerOrHigher, async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');

    res.json({ success: true, data: mapClient(client) });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب بيانات العميل', 'INTERNAL_ERROR', err.message);
  }
});

// POST add client
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (!req.body.name || !req.body.phone) {
      return sendError(res, 400, 'الاسم ورقم الهاتف مطلوبان', 'VALIDATION_ERROR');
    }

    // Auto-generate client number
    const { data: lastClient } = await supabase
      .from('clients')
      .select('client_number')
      .not('client_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastClient?.client_number) {
      const match = lastClient.client_number.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const clientNumber = `CLT-${String(nextNum).padStart(3, '0')}`;

    const insertData = {
      ...mapClientBody(req.body),
      client_number: clientNumber,
      created_by: req.user?.id || null,
    };

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'تم إضافة العميل بنجاح', data: mapClient(newClient) });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة العميل', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update client
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const updateData = {
      ...mapClientBody(req.body),
      updated_by: req.user?.id || null,
    };

    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');

    res.json({ success: true, message: 'تم تحديث العميل بنجاح', data: mapClient(client) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث العميل', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE client
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!client) return sendError(res, 404, 'العميل غير موجود', 'NOT_FOUND');

    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف العميل', 'VALIDATION_ERROR', err.message);
  }
});

module.exports = router;
