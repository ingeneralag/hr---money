const express = require("express");
const router = express.Router();
const { transactionValidation } = require("../middleware/validation");
const sendError = require("../utils/sendError");
const { requireAuth, requireRole } = require("../middleware/auth");
const { supabase } = require('../config/database');
const {
  logTransactionCreation,
  logTransactionUpdate,
  logTransactionDeletion,
  logDebtPayment
} = require("../middleware/logging");

// Helper: map snake_case transaction to camelCase for frontend
function mapTransaction(t) {
  if (!t) return t;
  return {
    ...t,
    _id: t.id,
    transactionNumber: t.transaction_number,
    paymentMethod: t.payment_method,
    paymentStatus: t.payment_status,
    debtStatus: t.debt_status,
    paidAmount: t.paid_amount,
    remainingAmount: t.remaining_amount,
    totalFeesCollected: t.total_fees_collected,
    clientId: t.client_id,
    employeeId: t.employee_id,
    projectId: t.project_id,
    departmentId: t.department_id,
    dueDate: t.due_date,
    invoiceNumber: t.invoice_number,
    taxRate: t.tax_rate,
    taxAmount: t.tax_amount,
    taxIncluded: t.tax_included,
    isRecurring: t.is_recurring,
    createdBy: t.created_by_name || 'مدير النظام',
    updatedBy: t.updated_by,
    approvedBy: t.approved_by,
    approvedAt: t.approved_at,
    rejectedBy: t.rejected_by,
    rejectionReason: t.rejection_reason,
    rejectedAt: t.rejected_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

// GET all transactions (with filtering, search, pagination)
router.get("/", async (req, res) => {
  try {
    try {
      // Pagination, status, and date filters
      const { page = 1, limit = 10000, status, startDate, endDate, type, category, search, client } = req.query;

      // Build Supabase query for count and data
      let query = supabase.from('transactions').select('*', { count: 'exact' });

      // Status filter
      if (status) {
        query = query.eq('status', status);
      }

      // Date range filter
      if (startDate) {
        query = query.gte('date', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('date', new Date(endDate).toISOString());
      }

      // Type filter
      if (type) {
        query = query.eq('type', type);
      }

      // Category filter
      if (category) {
        query = query.eq('category', category);
      }

      // Client filter
      if (client && client !== 'none') {
        query = query.eq('client_id', client);
      } else if (client === 'none') {
        query = query.is('client_id', null);
      }

      // Search filter
      if (search) {
        query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%,category.ilike.%${search}%`);
      }

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Get paginated results
      query = query.order('date', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data: transactions, error, count: totalCount } = await query;

      if (error) throw error;

      // Build a separate query for the full summary (not just current page)
      let summaryQuery = supabase.from('transactions').select('type, amount, paid_amount, total_fees_collected');

      if (status) summaryQuery = summaryQuery.eq('status', status);
      if (startDate) summaryQuery = summaryQuery.gte('date', new Date(startDate).toISOString());
      if (endDate) summaryQuery = summaryQuery.lte('date', new Date(endDate).toISOString());
      if (type) summaryQuery = summaryQuery.eq('type', type);
      if (category) summaryQuery = summaryQuery.eq('category', category);
      if (client && client !== 'none') {
        summaryQuery = summaryQuery.eq('client_id', client);
      } else if (client === 'none') {
        summaryQuery = summaryQuery.is('client_id', null);
      }
      if (search) {
        summaryQuery = summaryQuery.or(`description.ilike.%${search}%,reference.ilike.%${search}%,category.ilike.%${search}%`);
      }

      const { data: allTransactions, error: summaryError } = await summaryQuery;
      if (summaryError) throw summaryError;

      const totalSummary = {
        totalIncome: allTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        totalExpense: allTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
        totalDebts: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + t.amount, 0),
        paidDebts: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + (t.paid_amount || 0), 0),
        totalFeesCollected: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + (t.total_fees_collected || 0), 0),
      };

      totalSummary.remainingDebts = totalSummary.totalDebts - totalSummary.paidDebts;
      totalSummary.netAmount = totalSummary.totalIncome - totalSummary.totalExpense + totalSummary.totalFeesCollected;

      const totalPages = Math.ceil(totalCount / limitNum);

      res.json({
        success: true,
        data: (transactions || []).map(mapTransaction),
        summary: totalSummary,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: totalPages,
        },
      });
    } catch (dbError) {
      console.error("قاعدة البيانات غير متاحة:", dbError.message);

      return res.status(500).json({
        success: false,
        message: "خطأ في الاتصال بقاعدة البيانات",
        error: "قاعدة البيانات غير متاحة",
      });
    }
  } catch (error) {
    console.error("خطأ في جلب المعاملات:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المعاملات",
      error: error.message,
    });
  }
});

// POST add transaction (now allows 'accountant' role to add pending transactions)
router.post("/", requireAuth, transactionValidation, logTransactionCreation, async (req, res) => {
  try {
    // تحقق من وجود clientId وemployeeId
    if (req.body.clientId) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', req.body.clientId)
        .single();
      if (clientError || !client)
        return sendError(res, 400, "العميل غير موجود", "VALIDATION_ERROR");
    }
    if (req.body.employeeId) {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', req.body.employeeId)
        .single();
      if (empError || !emp)
        return sendError(res, 400, "الموظف غير موجود", "VALIDATION_ERROR");
    }
    // المدير (admin) → approved مباشرة | المحاسب وأي role تاني → pending تحتاج موافقة
    const isAdmin = req.user.role === "admin";
    const isAutoPayroll = req.body._source === "auto_payroll";
    const status = (isAdmin && !isAutoPayroll) ? "approved" : "pending";

    // Auto-generate transaction number
    const { data: lastTxn } = await supabase
      .from('transactions')
      .select('transaction_number')
      .not('transaction_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastTxn?.transaction_number) {
      const match = lastTxn.transaction_number.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const year = new Date().getFullYear();
    const transactionNumber = `TXN-${year}-${String(nextNum).padStart(3, '0')}`;

    const insertData = {
      transaction_number: transactionNumber,
      type: req.body.type,
      amount: req.body.amount,
      currency: req.body.currency || 'EGP',
      description: req.body.description,
      category: req.body.category,
      subcategory: req.body.subcategory,
      date: req.body.date || new Date().toISOString(),
      due_date: req.body.dueDate || req.body.due_date || null,
      status,
      payment_method: req.body.paymentMethod || req.body.payment_method || null,
      payment_status: req.body.paymentStatus || req.body.payment_status || 'pending',
      debt_status: req.body.debtStatus || req.body.debt_status || null,
      paid_amount: req.body.paidAmount || req.body.paid_amount || 0,
      remaining_amount: req.body.remainingAmount || req.body.remaining_amount || (req.body.type === 'debt' ? req.body.amount : 0),
      client_id: req.body.clientId || req.body.client_id || null,
      employee_id: req.body.employeeId || req.body.employee_id || null,
      project_id: req.body.projectId || req.body.project_id || null,
      department_id: req.body.departmentId || req.body.department_id || null,
      invoice_number: req.body.invoiceNumber || req.body.invoice_number || null,
      tax_rate: req.body.taxRate || req.body.tax_rate || 0,
      tax_amount: req.body.taxAmount || req.body.tax_amount || 0,
      reference: req.body.reference || null,
      tags: req.body.tags || [],
      notes: req.body.notes || null,
      created_by: req.user?.id || null,
    };

    const { data: newTxn, error } = await supabase
      .from('transactions')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "تم إضافة المعاملة بنجاح",
      data: mapTransaction(newTxn),
    });
  } catch (err) {
    sendError(
      res,
      400,
      "خطأ في إضافة المعاملة",
      "VALIDATION_ERROR",
      err.message
    );
  }
});

// PUT update transaction (now allows 'manager' role to approve/reject transactions)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    console.log("Transaction update request:", {
      id: req.params.id,
      body: req.body,
      user: req.user?.username || "unknown",
    });

    // التحقق من وجود المعاملة أولاً
    const { data: existingTransaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !existingTransaction) {
      console.log("Transaction not found:", req.params.id);
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    // التحقق من العميل إذا تم تمريره
    if (
      req.body.clientId &&
      req.body.clientId !== "" &&
      req.body.clientId !== "null"
    ) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', req.body.clientId)
        .single();
      if (clientError || !client) {
        console.log("Client not found:", req.body.clientId);
        return sendError(res, 400, "العميل غير موجود", "VALIDATION_ERROR");
      }
    }

    // التحقق من الموظف إذا تم تمريره
    if (
      req.body.employeeId &&
      req.body.employeeId !== "" &&
      req.body.employeeId !== "null"
    ) {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', req.body.employeeId)
        .single();
      if (empError || !emp) {
        console.log("Employee not found:", req.body.employeeId);
        return sendError(res, 400, "الموظف غير موجود", "VALIDATION_ERROR");
      }
    }

    // تنظيف البيانات
    const updateData = {};
    if (req.body.type) updateData.type = req.body.type;
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.amount !== undefined) updateData.amount = req.body.amount;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.subcategory !== undefined) updateData.subcategory = req.body.subcategory;
    if (req.body.date) updateData.date = req.body.date;
    if (req.body.dueDate || req.body.due_date) updateData.due_date = req.body.dueDate || req.body.due_date;
    if (req.body.paymentMethod || req.body.payment_method) updateData.payment_method = req.body.paymentMethod || req.body.payment_method;
    if (req.body.paymentStatus || req.body.payment_status) updateData.payment_status = req.body.paymentStatus || req.body.payment_status;
    if (req.body.currency) updateData.currency = req.body.currency;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.reference !== undefined) updateData.reference = req.body.reference;
    if (req.body.tags) updateData.tags = req.body.tags;
    // Approval/Rejection fields
    if (req.body.approvedBy || req.body.approved_by) updateData.approved_by = req.user?.id || null;
    if (req.body.approvedAt || req.body.approved_at) updateData.approved_at = req.body.approvedAt || req.body.approved_at;
    if (req.body.rejectedBy || req.body.rejected_by) updateData.rejected_by = req.user?.id || null;
    if (req.body.rejectionReason || req.body.rejection_reason) updateData.rejection_reason = req.body.rejectionReason || req.body.rejection_reason;
    if (req.body.rejectedAt || req.body.rejected_at) updateData.rejected_at = req.body.rejectedAt || req.body.rejected_at;
    updateData.client_id = (req.body.clientId === "" || req.body.clientId === "null") ? null : (req.body.clientId || req.body.client_id || null);
    updateData.employee_id = (req.body.employeeId === "" || req.body.employeeId === "null") ? null : (req.body.employeeId || req.body.employee_id || null);
    updateData.updated_by = req.user?.id || null;

    console.log("Cleaned update data:", updateData);

    const { data: txn, error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Save approval/rejection to audit trail
    if (req.body.status === 'approved' || req.body.status === 'rejected') {
      await supabase.from('transaction_approvals').insert({
        transaction_id: req.params.id,
        action: req.body.status,
        approved_by: req.user?.id || null,
        comment: req.body.rejectionReason || req.body.rejection_reason || null,
        date: new Date().toISOString(),
      });
    }

    console.log("Transaction updated successfully:", txn);

    // تسجيل العملية في اللوجات
    const { logAction } = require('../middleware/logging');
    const description = `تم تحديث معاملة: ${txn.description} - ${txn.amount} جنيه`;

    console.log('تسجيل تحديث معاملة:', description);

    await logAction(req, 'transaction_updated', description, {
      transactionId: req.params.id,
      transactionType: txn.type,
      amount: txn.amount,
      description: txn.description,
      oldAmount: existingTransaction?.amount,
      oldDescription: existingTransaction?.description
    });

    res.json({ success: true, message: "تم تحديث المعاملة بنجاح", data: mapTransaction(txn) });
  } catch (err) {
    console.error("Transaction update error:", err);
    sendError(
      res,
      400,
      "خطأ في تحديث المعاملة",
      "VALIDATION_ERROR",
      err.message
    );
  }
});

// DELETE transaction (allow all authenticated users to delete)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    console.log('محاولة حذف معاملة:', req.params.id);

    // جلب تفاصيل المعاملة قبل الحذف
    const { data: txn, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !txn) return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");

    // Delete related payment records first
    await supabase
      .from('transaction_payments')
      .delete()
      .eq('transaction_id', req.params.id);

    // Delete related approval records
    await supabase
      .from('transaction_approvals')
      .delete()
      .eq('transaction_id', req.params.id);

    // حذف المعاملة
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    // تسجيل العملية في اللوجات
    const { logAction } = require('../middleware/logging');
    const description = `تم حذف معاملة: ${txn.description} - ${txn.amount} جنيه`;

    console.log('تسجيل حذف معاملة:', description);

    await logAction(req, 'transaction_deleted', description, {
      transactionId: req.params.id,
      transactionType: txn.type,
      amount: txn.amount,
      description: txn.description
    });

    console.log('تم حذف المعاملة بنجاح:', txn.id);
    res.json({ success: true, message: "تم حذف المعاملة بنجاح" });
  } catch (err) {
    console.log('خطأ في حذف المعاملة:', err.message);
    sendError(res, 400, "خطأ في حذف المعاملة", "VALIDATION_ERROR", err.message);
  }
});

// GET recent transactions (last 10)
router.get("/recent", async (req, res) => {
  try {
    const { data: recentTransactions, error } = await supabase
      .from('transactions')
      .select('*, clients:client_id(name), employees:employee_id(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      data: (recentTransactions || []).map(mapTransaction),
    });
  } catch (error) {
    console.error("خطأ في جلب المعاملات الحديثة:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب المعاملات الحديثة",
      error: error.message,
    });
  }
});

// POST سداد مديونية
router.post("/:id/pay", requireAuth, logDebtPayment, async (req, res) => {
  try {
    const { amount, fees = 0, totalAmount, paymentMethod, notes } = req.body;

    if (!amount || amount <= 0) {
      return sendError(res, 400, "المبلغ المدفوع يجب أن يكون أكبر من صفر", "VALIDATION_ERROR");
    }

    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !transaction) {
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    if (transaction.type !== 'debt') {
      return sendError(res, 400, "هذه المعاملة ليست مديونية", "VALIDATION_ERROR");
    }

    // حساب المبلغ الإجمالي (المبلغ + الرسوم)
    const paymentFees = parseFloat(fees) || 0;
    const paymentTotal = totalAmount || (parseFloat(amount) + paymentFees);

    // Get existing payments from transaction_payments table
    const { data: existingPayments, error: paymentsError } = await supabase
      .from('transaction_payments')
      .select('amount')
      .eq('transaction_id', req.params.id);

    if (paymentsError) throw paymentsError;

    // حساب المبلغ المدفوع للمديونية فقط (بدون الرسوم)
    const currentPaidForDebt = (existingPayments || []).reduce((total, payment) => {
      return total + payment.amount;
    }, 0);

    const newPaidForDebt = currentPaidForDebt + parseFloat(amount);

    // التحقق من أن المبلغ المدفوع للمديونية لا يتجاوز المبلغ المطلوب
    if (newPaidForDebt > transaction.amount) {
      return sendError(res, 400, "المبلغ المدفوع للمديونية أكبر من المبلغ المستحق", "VALIDATION_ERROR");
    }

    // إضافة سجل الدفع في جدول transaction_payments
    const paymentRecord = {
      transaction_id: req.params.id,
      amount: parseFloat(amount),
      fees: paymentFees,
      total_amount: paymentTotal,
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod || 'كاش',
      notes: notes || '',
      paid_by: req.user.username || req.user.name || 'مستخدم غير معروف',
      created_at: new Date().toISOString(),
    };

    const { data: insertedPayment, error: insertError } = await supabase
      .from('transaction_payments')
      .insert(paymentRecord)
      .select()
      .single();

    if (insertError) throw insertError;

    // تحديث المبلغ المدفوع في المعاملة
    // Calculate total fees collected
    const { data: allPayments } = await supabase
      .from('transaction_payments')
      .select('fees')
      .eq('transaction_id', req.params.id);

    const totalFeesCollected = (allPayments || []).reduce((sum, p) => sum + (p.fees || 0), 0);

    // Determine debt status
    const remainingAmount = transaction.amount - newPaidForDebt;
    let debtStatus = 'unpaid';
    if (remainingAmount <= 0) debtStatus = 'paid';
    else if (newPaidForDebt > 0) debtStatus = 'partial';

    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        paid_amount: newPaidForDebt,
        remaining_amount: remainingAmount,
        total_fees_collected: totalFeesCollected,
        debt_status: debtStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "تم تسجيل الدفع بنجاح",
      data: {
        transaction: updatedTransaction,
        paymentRecord: insertedPayment,
        remainingAmount: remainingAmount
      }
    });
  } catch (error) {
    console.error("خطأ في تسجيل الدفع:", error);
    sendError(res, 500, "خطأ في تسجيل الدفع", "SERVER_ERROR", error.message);
  }
});

// تصدير المعاملات
router.get("/export", requireAuth, async (req, res) => {
  try {
    // استخدام نفس فلاتر البحث من الـ GET route
    const { status, startDate, endDate, type, category, search, client } = req.query;

    let query = supabase.from('transactions').select('*');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('date', new Date(startDate).toISOString());
    if (endDate) query = query.lte('date', new Date(endDate).toISOString());
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (client && client !== 'none') {
      query = query.eq('client_id', client);
    } else if (client === 'none') {
      query = query.is('client_id', null);
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%,category.ilike.%${search}%`);
    }

    query = query.order('date', { ascending: false });

    const { data: transactions, error } = await query;
    if (error) throw error;

    // تحويل البيانات إلى تنسيق Excel
    const excel = require('exceljs');
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('المعاملات');

    // تعريف الأعمدة
    worksheet.columns = [
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'النوع', key: 'type', width: 15 },
      { header: 'المبلغ', key: 'amount', width: 15 },
      { header: 'التصنيف', key: 'category', width: 20 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'ملاحظات', key: 'notes', width: 30 }
    ];

    // إضافة البيانات
    transactions.forEach(txn => {
      worksheet.addRow({
        date: new Date(txn.date).toLocaleDateString('ar-EG'),
        description: txn.description,
        type: txn.type === 'income' ? 'إيرادات' : txn.type === 'expense' ? 'مصروفات' : 'مديونيات',
        amount: txn.amount,
        category: txn.category,
        status: txn.status === 'approved' ? 'معتمد' : txn.status === 'pending' ? 'قيد المراجعة' : 'مرفوض',
        notes: txn.notes || ''
      });
    });

    // تنسيق الملف
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // إرسال الملف
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("خطأ في تصدير المعاملات:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تصدير المعاملات",
      error: error.message
    });
  }
});

// تقرير المعاملات
router.get("/report", requireAuth, async (req, res) => {
  try {
    // استخدام نفس فلاتر البحث
    const { status, startDate, endDate, type, category, search, client } = req.query;

    let query = supabase.from('transactions').select('*');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('date', new Date(startDate).toISOString());
    if (endDate) query = query.lte('date', new Date(endDate).toISOString());
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (client && client !== 'none') {
      query = query.eq('client_id', client);
    } else if (client === 'none') {
      query = query.is('client_id', null);
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%,category.ilike.%${search}%`);
    }

    query = query.order('date', { ascending: false });

    const { data: transactions, error } = await query;
    if (error) throw error;

    // إنشاء PDF مع دعم اللغة العربية
    const PDFDocument = require('pdfkit');
    const path = require('path');

    // دالة لعكس أرقام الأرقام
    function reverseNumberDigits(number) {
      const formatted = number.toLocaleString('en-US');
      return formatted.split('').reverse().join('');
    }

    // تحميل الخط العربي
    const CAIRO_FONT_PATH = path.join(__dirname, '..', 'fonts', 'Cairo-Regular.ttf');

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
      autoFirstPage: true,
      layout: 'portrait',
      info: {
        Title: 'تقرير المعاملات المالية',
        Author: 'نظام إدارة المعاملات',
        Subject: 'تقرير المعاملات',
        Producer: 'PDFKit'
      }
    });

    // تحميل الخط العربي
    doc.registerFont('Cairo', CAIRO_FONT_PATH);
    doc.font('Cairo');

    // تنسيق العنوان
    doc.fontSize(24);
    doc.text('تقرير المعاملات المالية', 0, 50, {
      align: 'center',
      features: ['rtla']  // Enable RTL alignment
    });
    doc.moveDown(2);

    // إضافة التاريخ والوقت
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('ar-EG');

    doc.fontSize(12);
    doc.text(`تاريخ التقرير: ${dateStr}`, {
      align: 'right',
      features: ['rtla']
    });
    doc.text(`وقت الإنشاء: ${timeStr}`, {
      align: 'right',
      features: ['rtla']
    });
    doc.moveDown();

    // إضافة الملخص
    const summary = {
      totalIncome: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      totalExpense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      totalDebts: transactions.filter(t => t.type === 'debt').reduce((sum, t) => sum + t.amount, 0)
    };

    // عنوان قسم الملخص
    doc.fontSize(16);
    doc.text('ملخص المعاملات', { align: 'right', features: ['rtla'] });
    doc.moveDown();

    // رسم جدول الملخص
    const summaryStartY = doc.y;
    const summaryRowHeight = 30;

    // رسم رأس الجدول
    doc.rect(50, summaryStartY, 500, summaryRowHeight).stroke();
    doc.fontSize(12);

    // عناوين الأعمدة
    doc.text('البيان', 400, summaryStartY + 8, { features: ['rtla'] });
    doc.text('المبلغ', 150, summaryStartY + 8, { features: ['rtla'] });

    // إضافة الصفوف
    let summaryY = summaryStartY + summaryRowHeight;

    // صف الإيرادات
    doc.rect(50, summaryY, 500, summaryRowHeight).stroke();
    doc.text('إجمالي الإيرادات', 400, summaryY + 8, { features: ['rtla'] });
    doc.text(`${reverseNumberDigits(summary.totalIncome)} جنيه`, 150, summaryY + 8, { features: ['rtla'] });

    // صف المصروفات
    summaryY += summaryRowHeight;
    doc.rect(50, summaryY, 500, summaryRowHeight).stroke();
    doc.text('إجمالي المصروفات', 400, summaryY + 8, { features: ['rtla'] });
    doc.text(`${reverseNumberDigits(summary.totalExpense)} جنيه`, 150, summaryY + 8, { features: ['rtla'] });

    // صف المديونيات
    summaryY += summaryRowHeight;
    doc.rect(50, summaryY, 500, summaryRowHeight).stroke();
    doc.text('إجمالي المديونيات', 400, summaryY + 8, { features: ['rtla'] });
    doc.text(`${reverseNumberDigits(summary.totalDebts)} جنيه`, 150, summaryY + 8, { features: ['rtla'] });

    // صف صافي الرصيد
    summaryY += summaryRowHeight;
    doc.rect(50, summaryY, 500, summaryRowHeight).stroke();
    doc.text('صافي الرصيد', 400, summaryY + 8, { features: ['rtla'] });
    doc.text(`${reverseNumberDigits(summary.totalIncome - summary.totalExpense)} جنيه`, 150, summaryY + 8, { features: ['rtla'] });

    // إضافة مسافة بعد جدول الملخص
    doc.y = summaryY + summaryRowHeight + 40; // 40 pixels extra space
    doc.moveDown(2);

    // عنوان الجدول
    doc.fontSize(16);
    doc.text('تفاصيل المعاملات', { align: 'right', features: ['rtla'] });
    doc.moveDown();

    // رسم الجدول
    const startY = doc.y;
    const rowHeight = 100;
    const colWidths = {
      date: 100,
      desc: 120,
      type: 80,
      amount: 100,
      category: 100
    };

    // رسم رأس الجدول
    doc.rect(50, startY, 500, 30).stroke();
    doc.fontSize(10);
    let currentX = 50;

    // عناوين الأعمدة
    doc.text('التاريخ', currentX + 10, startY + 10, { features: ['rtla'] });
    currentX += colWidths.date;

    doc.text('الوصف', currentX + 10, startY + 10, { features: ['rtla'] });
    currentX += colWidths.desc;

    doc.text('النوع', currentX + 10, startY + 10, { features: ['rtla'] });
    currentX += colWidths.type;

    doc.text('المبلغ', currentX + 10, startY + 10, { features: ['rtla'] });
    currentX += colWidths.amount;

    doc.text('التصنيف', currentX + 10, startY + 10, { features: ['rtla'] });

    // إضافة البيانات
    let currentY = startY + 30;

    transactions.forEach((txn, index) => {
      // رسم إطار الصف
      doc.rect(50, currentY, 500, rowHeight).stroke();

      currentX = 50;
      doc.fontSize(10);

      // التاريخ
      doc.text(
        new Date(txn.date).toLocaleDateString('ar-EG'),
        currentX + 10,
        currentY + 10,
        { features: ['rtla'] }
      );
      currentX += colWidths.date;

      // الوصف
      doc.text(
        txn.description,
        currentX + 10,
        currentY + 10,
        { features: ['rtla'] }
      );
      currentX += colWidths.desc;

      // النوع
      const typeText = txn.type === 'income' ? 'إيرادات' :
        txn.type === 'expense' ? 'مصروفات' : 'مديونيات';
      doc.text(
        typeText,
        currentX + 10,
        currentY + 10,
        { features: ['rtla'] }
      );
      currentX += colWidths.type;

      // المبلغ
      doc.text(
        `${reverseNumberDigits(txn.amount)} جنيه`,
        currentX + 10,
        currentY + 10,
        { features: ['rtla'] }
      );
      currentX += colWidths.amount;

      // التصنيف
      doc.text(
        txn.category,
        currentX + 10,
        currentY + 10,
        { features: ['rtla'] }
      );

      // الحالة
      const statusText = txn.status === 'approved' ? 'معتمد' :
        txn.status === 'pending' ? 'قيد المراجعة' : 'مرفوض';
      doc.text(
        statusText,
        currentX + 10,
        currentY + 30,
        { features: ['rtla'] }
      );

      currentY += rowHeight;

      // إضافة صفحة جديدة إذا لزم الأمر
      if (currentY > 700 && index < transactions.length - 1) {
        doc.addPage();
        currentY = 50;
      }
    });

    // إرسال الملف
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=transactions-report-${new Date().toISOString().split('T')[0]}.pdf`);
    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error("خطأ في إنشاء تقرير المعاملات:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إنشاء تقرير المعاملات",
      error: error.message
    });
  }
});

// GET تفاصيل مديونية مع سجل المدفوعات
router.get("/:id/debt-details", requireAuth, async (req, res) => {
  try {
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError || !transaction) {
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    if (transaction.type !== 'debt') {
      return sendError(res, 400, "هذه المعاملة ليست مديونية", "VALIDATION_ERROR");
    }

    // Get payment history from transaction_payments table
    const { data: paymentHistory, error: paymentsError } = await supabase
      .from('transaction_payments')
      .select('*')
      .eq('transaction_id', req.params.id)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;

    res.json({
      success: true,
      data: {
        transaction: transaction,
        paymentHistory: paymentHistory || [],
        debtStatus: transaction.debt_status,
        remainingAmount: transaction.remaining_amount
      }
    });
  } catch (error) {
    console.error("خطأ في جلب تفاصيل المديونية:", error);
    sendError(res, 500, "خطأ في جلب تفاصيل المديونية", "SERVER_ERROR", error.message);
  }
});

module.exports = router;
