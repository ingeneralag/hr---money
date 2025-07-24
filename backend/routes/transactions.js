const express = require("express");
const router = express.Router();
const { transactionValidation } = require("../middleware/validation");
const sendError = require("../utils/sendError");
const { requireAuth, requireRole } = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const Client = require("../models/Client");

// تم حذف البيانات الوهمية - النظام يعرض البيانات الحقيقية من قاعدة البيانات فقط

// GET all transactions (with filtering, search, pagination)
router.get("/", async (req, res) => {
  try {
    // محاولة جلب البيانات من قاعدة البيانات
    try {
      // Pagination and status filter
      const { page = 1, limit = 10, status } = req.query;
      const query = {};
      if (status) {
        query.status = status;
      }
      const transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      // عرض البيانات الحقيقية من قاعدة البيانات فقط - لا توجد بيانات وهمية

      // حساب الملخص من البيانات الحقيقية
      const totalIncome = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      res.json({
        success: true,
        data: transactions,
        summary: {
          totalIncome,
          totalExpense,
          netAmount: totalIncome - totalExpense,
        },
        pagination: {
          total: transactions.length,
          page: 1,
          limit: 10,
          pages: Math.ceil(transactions.length / 10),
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
router.post("/", requireAuth, transactionValidation, async (req, res) => {
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
    const txn = await Transaction.findByIdAndDelete(req.params.id);
    if (!txn) return sendError(res, 404, "المعاملة غير موجودة", "NOT_FOUND");
    res.json({ success: true, message: "تم حذف المعاملة بنجاح" });
  } catch (err) {
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

module.exports = router;
