const express = require("express");
const router = express.Router();
const { categoryValidation } = require("../middleware/validation");
const { requireAuth, requireRole } = require("../middleware/auth");
const sendError = require("../utils/sendError");
const Category = require("../models/Category");

// GET all categories (filter, search, pagination)
router.get("/", async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10000 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (search) {
      const s = new RegExp(search, "i");
      filter.$or = [{ name: s }, { nameEn: s }, { description: s }];
    }
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10000;
    const total = await Category.countDocuments(filter);
    const pages = Math.ceil(total / pageSize);
    const cats = await Category.find(filter)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize);
    res.json({
      success: true,
      data: cats,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
        nextPage: pageNum < pages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
      },
    });
  } catch (err) {
    sendError(res, 500, "خطأ في جلب الفئات", "INTERNAL_ERROR", err.message);
  }
});

// POST add category
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  categoryValidation,
  async (req, res) => {
    try {
      const lastCat = await Category.findOne().sort({ createdAt: -1 });
      let nextId = "cat_001";
      if (lastCat && lastCat.id) {
        const match = lastCat.id.match(/cat_(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10) + 1;
          nextId = `cat_${num.toString().padStart(3, "0")}`;
        }
      }
      const newCat = new Category({
        ...req.body,
        id: nextId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await newCat.save();
      res.json({
        success: true,
        message: "تم إضافة الفئة بنجاح",
        data: newCat,
      });
    } catch (err) {
      sendError(
        res,
        400,
        "خطأ في إضافة الفئة",
        "VALIDATION_ERROR",
        err.message
      );
    }
  }
);

// PUT update category
router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  categoryValidation,
  async (req, res) => {
    try {
      const cat = await Category.findOneAndUpdate(
        { _id: req.params.id },
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      if (!cat) return sendError(res, 404, "الفئة غير موجودة", "NOT_FOUND");
      res.json({ success: true, message: "تم تحديث الفئة بنجاح", data: cat });
    } catch (err) {
      sendError(
        res,
        400,
        "خطأ في تحديث الفئة",
        "VALIDATION_ERROR",
        err.message
      );
    }
  }
);

// DELETE category
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const cat = await Category.findByIdAndRemove(req.params.id);
    if (!cat) return sendError(res, 404, "الفئة غير موجودة", "NOT_FOUND");
    res.json({ success: true, message: "تم حذف الفئة بنجاح" });
  } catch (err) {
    sendError(res, 400, "خطأ في حذف الفئة", "VALIDATION_ERROR", err.message);
  }
});

module.exports = router;

