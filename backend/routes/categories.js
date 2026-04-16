const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const sendError = require("../utils/sendError");
const { supabase } = require("../config/database");

// Helper: map snake_case category to camelCase for frontend
function mapCategory(c) {
  if (!c) return c;
  return {
    ...c,
    _id: c.id,
    nameEn: c.name_en,
    parentId: c.parent_id,
    budgetLimit: c.budget_limit || 0,
    isActive: c.is_active !== false,
    sortOrder: c.sort_order || 0,
    defaultTaxRate: c.default_tax_rate || 0,
    accountingCode: c.accounting_code,
    createdBy: c.created_by,
    updatedBy: c.updated_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    // Will be populated from transactions
    spent: c._spent || 0,
    transactionCount: c._transactionCount || 0,
  };
}

// Helper: map frontend camelCase to snake_case for DB
function mapCategoryBody(body) {
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.nameEn !== undefined || body.name_en !== undefined) data.name_en = body.nameEn || body.name_en;
  if (body.type !== undefined) data.type = body.type;
  if (body.description !== undefined) data.description = body.description;
  if (body.color !== undefined) data.color = body.color;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.parentId !== undefined || body.parent_id !== undefined) data.parent_id = body.parentId || body.parent_id;
  if (body.budgetLimit !== undefined || body.budget_limit !== undefined) data.budget_limit = parseFloat(body.budgetLimit || body.budget_limit) || 0;
  if (body.isActive !== undefined || body.is_active !== undefined) data.is_active = body.isActive !== undefined ? body.isActive : body.is_active;
  if (body.sortOrder !== undefined || body.sort_order !== undefined) data.sort_order = parseInt(body.sortOrder || body.sort_order) || 0;
  if (body.defaultTaxRate !== undefined || body.default_tax_rate !== undefined) data.default_tax_rate = parseFloat(body.defaultTaxRate || body.default_tax_rate) || 0;
  if (body.accountingCode !== undefined || body.accounting_code !== undefined) data.accounting_code = body.accountingCode || body.accounting_code;
  if (body.tags !== undefined) data.tags = body.tags;
  return data;
}

// Helper: enrich categories with transaction stats
async function enrichWithTransactionStats(categories) {
  if (!categories || categories.length === 0) return categories;

  // Get all transaction amounts grouped by category
  const { data: transactions } = await supabase
    .from('transactions')
    .select('category, amount, type');

  const statsMap = {};
  (transactions || []).forEach(t => {
    const cat = t.category;
    if (!cat) return;
    if (!statsMap[cat]) statsMap[cat] = { spent: 0, count: 0 };
    if (t.type === 'expense') statsMap[cat].spent += (t.amount || 0);
    statsMap[cat].count += 1;
  });

  return categories.map(c => ({
    ...c,
    _spent: statsMap[c.name]?.spent || 0,
    _transactionCount: statsMap[c.name]?.count || 0,
  }));
}

// GET all categories
router.get("/", async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10000 } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10000;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("categories").select("*", { count: "exact" });

    if (type) query = query.eq("type", type);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,name_en.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    query = query.order("sort_order", { ascending: true }).range(from, to);

    const { data: cats, count: total, error } = await query;
    if (error) throw error;

    // Enrich with transaction stats
    const enriched = await enrichWithTransactionStats(cats || []);

    const pages = Math.ceil(total / pageSize);
    res.json({
      success: true,
      data: enriched.map(mapCategory),
      pagination: { page: pageNum, limit: pageSize, total, pages },
    });
  } catch (err) {
    sendError(res, 500, "خطأ في جلب التصنيفات", "INTERNAL_ERROR", err.message);
  }
});

// POST add category
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    if (!req.body.name || !req.body.type) {
      return sendError(res, 400, "الاسم والنوع مطلوبان", "VALIDATION_ERROR");
    }

    // Generate next category code
    const { data: lastCat } = await supabase
      .from("categories")
      .select("code")
      .not("code", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextCode = "cat_001";
    if (lastCat?.code) {
      const match = lastCat.code.match(/cat_(\d+)/);
      if (match) nextCode = `cat_${(parseInt(match[1]) + 1).toString().padStart(3, "0")}`;
    }

    const insertData = {
      ...mapCategoryBody(req.body),
      code: nextCode,
      created_by: req.user?.id || null,
    };

    const { data: newCat, error } = await supabase
      .from("categories")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: "تم إضافة التصنيف بنجاح", data: mapCategory(newCat) });
  } catch (err) {
    sendError(res, 400, "خطأ في إضافة التصنيف", "VALIDATION_ERROR", err.message);
  }
});

// PUT update category
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const updateData = {
      ...mapCategoryBody(req.body),
      updated_by: req.user?.id || null,
    };

    const { data: cat, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!cat) return sendError(res, 404, "التصنيف غير موجود", "NOT_FOUND");

    res.json({ success: true, message: "تم تحديث التصنيف بنجاح", data: mapCategory(cat) });
  } catch (err) {
    sendError(res, 400, "خطأ في تحديث التصنيف", "VALIDATION_ERROR", err.message);
  }
});

// DELETE category
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { data: cat, error } = await supabase
      .from("categories")
      .delete()
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!cat) return sendError(res, 404, "التصنيف غير موجود", "NOT_FOUND");

    res.json({ success: true, message: "تم حذف التصنيف بنجاح" });
  } catch (err) {
    sendError(res, 400, "خطأ في حذف التصنيف", "VALIDATION_ERROR", err.message);
  }
});

module.exports = router;
