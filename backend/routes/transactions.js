const express = require("express");
const router = express.Router();
const { transactionValidation } = require("../middleware/validation");
const sendError = require("../utils/sendError");
const { requireAuth, requireRole } = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const Client = require("../models/Client");
const {
  logTransactionCreation,
  logTransactionUpdate,
  logTransactionDeletion,
  logDebtPayment
} = require("../middleware/logging");

// تم حذف البيانات الوهمية - النظام يعرض البيانات الحقيقية من قاعدة البيانات فقط

// GET all transactions (with filtering, search, pagination)
router.get("/", async (req, res) => {
  try {
    try {
      // Pagination and status filter
      const { page = 1, limit = 10000, status } = req.query;
      const query = {};
      if (status) {
        query.status = status;
      }

      // First get total count of all documents
      const totalCount = await Transaction.countDocuments(query);

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const totalPages = Math.ceil(totalCount / limitNum);

      // Get paginated results
      const transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      // عرض البيانات الحقيقية من قاعدة البيانات فقط - لا توجد بيانات وهمية

      // حساب الملخص من البيانات الحقيقية
      const totalIncome = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      // حساب المديونيات
      const totalDebts = transactions
        .filter((t) => t.type === "debt")
        .reduce((sum, t) => sum + t.amount, 0);

      const paidDebts = transactions
        .filter((t) => t.type === "debt")
        .reduce((sum, t) => sum + (t.paidAmount || 0), 0);

      const remainingDebts = totalDebts - paidDebts;

      // حساب الرسوم المحصلة من المديونيات (مكسب صافي)
      const totalFeesCollected = transactions
        .filter((t) => t.type === "debt")
        .reduce((sum, t) => sum + (t.totalFeesCollected || 0), 0);

      // Get total summary (not just for current page)
      const allTransactions = await Transaction.find(query);
      const totalSummary = {
        totalIncome: allTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        totalExpense: allTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
        totalDebts: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + t.amount, 0),
        paidDebts: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + (t.paidAmount || 0), 0),
        totalFeesCollected: allTransactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + (t.totalFeesCollected || 0), 0),
      };

      totalSummary.remainingDebts = totalSummary.totalDebts - totalSummary.paidDebts;
      totalSummary.netAmount = totalSummary.totalIncome - totalSummary.totalExpense + totalSummary.totalFeesCollected;

      res.json({
        success: true,
        data: transactions,
        summary: totalSummary,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: totalPages,
        },
      });
    } catch (dbError) {
      console.error("❌ قاعدة البيانات غير متاحة:", dbError.message);

      // في حالة عدم توفر قاعدة البيانات، إرجاع خطأ - لا بيانات وهمية
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
      const client = await Client.findById(req.body.clientId);
      if (!client)
        return sendError(res, 400, "العميل غير موجود", "VALIDATION_ERROR");
    }
    if (req.body.employeeId) {
      const emp = await Employee.findById(req.body.employeeId);
      if (!emp)
        return sendError(res, 400, "الموظف غير موجود", "VALIDATION_ERROR");
    }
    // إذا كان المستخدم محاسب، ضع المعاملة في حالة 'pending'
    const status = req.user.role === "accountant" ? "pending" : "approved";
    const newTxn = new Transaction({
      ...req.body,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await newTxn.save();
    res.json({
      success: true,
      message: "تم إضافة المعاملة بنجاح",
      data: newTxn,
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
router.put("/:id", requireAuth, transactionValidation, async (req, res) => {
  try {
    console.log("🔄 Transaction update request:", {
      id: req.params.id,
      body: req.body,
      user: req.user?.username || "unknown",
    });

    // التحقق من وجود المعاملة أولاً
    const existingTransaction = await Transaction.findById(req.params.id);
    if (!existingTransaction) {
      console.log("❌ Transaction not found:", req.params.id);
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    // التحقق من العميل إذا تم تمريره
    if (
      req.body.clientId &&
      req.body.clientId !== "" &&
      req.body.clientId !== "null"
    ) {
      const client = await Client.findById(req.body.clientId);
      if (!client) {
        console.log("❌ Client not found:", req.body.clientId);
        return sendError(res, 400, "العميل غير موجود", "VALIDATION_ERROR");
      }
    }

    // التحقق من الموظف إذا تم تمريره
    if (
      req.body.employeeId &&
      req.body.employeeId !== "" &&
      req.body.employeeId !== "null"
    ) {
      const emp = await Employee.findById(req.body.employeeId);
      if (!emp) {
        console.log("❌ Employee not found:", req.body.employeeId);
        return sendError(res, 400, "الموظف غير موجود", "VALIDATION_ERROR");
      }
    }

    // تنظيف البيانات
    const updateData = {
      ...req.body,
      clientId:
        req.body.clientId === "" || req.body.clientId === "null"
          ? null
          : req.body.clientId,
      employeeId:
        req.body.employeeId === "" || req.body.employeeId === "null"
          ? null
          : req.body.employeeId,
      updatedAt: new Date(),
    };

    console.log("🔄 Cleaned update data:", updateData);

    const txn = await Transaction.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    console.log("✅ Transaction updated successfully:", txn);

    // تسجيل العملية في اللوجات
    const { logAction } = require('../middleware/logging');
    const description = `تم تحديث معاملة: ${txn.description} - ${txn.amount} جنيه`;

    console.log('📝 تسجيل تحديث معاملة:', description);

    await logAction(req, 'transaction_updated', description, {
      transactionId: req.params.id,
      transactionType: txn.type,
      amount: txn.amount,
      description: txn.description,
      oldAmount: existingTransaction?.amount,
      oldDescription: existingTransaction?.description
    });

    res.json({ success: true, message: "تم تحديث المعاملة بنجاح", data: txn });
  } catch (err) {
    console.error("❌ Transaction update error:", err);
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
    console.log('🗑️ محاولة حذف معاملة:', req.params.id);

    // جلب تفاصيل المعاملة قبل الحذف
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");

    // حذف المعاملة
    await Transaction.findByIdAndDelete(req.params.id);

    // تسجيل العملية في اللوجات
    const { logAction } = require('../middleware/logging');
    const description = `تم حذف معاملة: ${txn.description} - ${txn.amount} جنيه`;

    console.log('📝 تسجيل حذف معاملة:', description);

    await logAction(req, 'transaction_deleted', description, {
      transactionId: req.params.id,
      transactionType: txn.type,
      amount: txn.amount,
      description: txn.description
    });

    console.log('✅ تم حذف المعاملة بنجاح:', txn._id);
    res.json({ success: true, message: "تم حذف المعاملة بنجاح" });
  } catch (err) {
    console.log('❌ خطأ في حذف المعاملة:', err.message);
    sendError(res, 400, "خطأ في حذف المعاملة", "VALIDATION_ERROR", err.message);
  }
});

// GET recent transactions (last 10)
router.get("/recent", async (req, res) => {
  try {
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("clientId", "name")
      .populate("employeeId", "name");

    res.json({
      success: true,
      data: recentTransactions,
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

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    if (transaction.type !== 'debt') {
      return sendError(res, 400, "هذه المعاملة ليست مديونية", "VALIDATION_ERROR");
    }

    // حساب المبلغ الإجمالي (المبلغ + الرسوم)
    const paymentFees = parseFloat(fees) || 0;
    const paymentTotal = totalAmount || (parseFloat(amount) + paymentFees);

    // حساب المبلغ المدفوع للمديونية فقط (بدون الرسوم)
    const currentPaidForDebt = transaction.paymentHistory.reduce((total, payment) => {
      return total + payment.amount; // فقط المبلغ الأساسي
    }, 0);

    const newPaidForDebt = currentPaidForDebt + parseFloat(amount);

    // التحقق من أن المبلغ المدفوع للمديونية لا يتجاوز المبلغ المطلوب
    if (newPaidForDebt > transaction.amount) {
      return sendError(res, 400, "المبلغ المدفوع للمديونية أكبر من المبلغ المستحق", "VALIDATION_ERROR");
    }

    // إضافة سجل الدفع
    const paymentRecord = {
      amount: parseFloat(amount),
      fees: paymentFees,
      totalAmount: paymentTotal,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'كاش',
      notes: notes || '',
      paidBy: req.user.username || req.user.name || 'مستخدم غير معروف'
    };

    transaction.paymentHistory = transaction.paymentHistory || [];
    transaction.paymentHistory.push(paymentRecord);

    // تحديث المبلغ المدفوع للمديونية فقط (بدون الرسوم)
    transaction.paidAmount = newPaidForDebt;

    await transaction.save();

    res.json({
      success: true,
      message: "تم تسجيل الدفع بنجاح",
      data: {
        transaction: transaction,
        paymentRecord: paymentRecord,
        remainingAmount: transaction.remainingAmount
      }
    });
  } catch (error) {
    console.error("خطأ في تسجيل الدفع:", error);
    sendError(res, 500, "خطأ في تسجيل الدفع", "SERVER_ERROR", error.message);
  }
});

// GET تفاصيل مديونية مع سجل المدفوعات
router.get("/:id/debt-details", requireAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    }

    if (transaction.type !== 'debt') {
      return sendError(res, 400, "هذه المعاملة ليست مديونية", "VALIDATION_ERROR");
    }

    res.json({
      success: true,
      data: {
        transaction: transaction,
        paymentHistory: transaction.paymentHistory || [],
        debtStatus: transaction.debtStatus,
        remainingAmount: transaction.remainingAmount
      }
    });
  } catch (error) {
    console.error("خطأ في جلب تفاصيل المديونية:", error);
    sendError(res, 500, "خطأ في جلب تفاصيل المديونية", "SERVER_ERROR", error.message);
  }
});

module.exports = router;
