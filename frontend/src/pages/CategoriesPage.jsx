import {
  Activity,
  DollarSign,
  Edit,
  Folder,
  Loader2,
  Plus,
  Save,
  Search,
  Target,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { categoryService } from "../services/api";
import { formatCurrency } from "../utils/formatters";

const CategoriesPage = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const [formData, setFormData] = useState({
    name: "", nameEn: "", type: "expense", description: "", color: "#3b82f6",
    icon: "📁", parentId: "", subcategories: [], budgetLimit: "", isActive: true,
    sortOrder: 0, defaultTaxRate: "", accountingCode: "", tags: [],
    createdBy: "", createdAt: "", updatedBy: "", updatedAt: "",
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.getAll();
      setCategories(response.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("حدث خطأ في جلب التصنيفات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const filteredCategories = categories.filter((category) => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || category.type === selectedType;
    return matchesSearch && matchesType;
  });

  const categoryStats = {
    totalCategories: categories.length,
    activeCategories: categories.filter((cat) => cat.isActive).length,
    totalBudget: categories.reduce((sum, cat) => sum + (parseFloat(cat.budgetLimit) || 0), 0),
    totalSpent: categories.reduce((sum, cat) => sum + (parseFloat(cat.spent) || 0), 0),
    totalTransactions: categories.reduce((sum, cat) => sum + (parseInt(cat.transactionCount) || 0), 0),
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await categoryService.create({ ...formData, budgetLimit: parseFloat(formData.budgetLimit) || 0, spent: 0, transactionCount: 0, createdAt: new Date().toISOString() });
      toast.success("تم إضافة التصنيف بنجاح");
      fetchCategories(); resetForm();
    } catch (error) { console.error(error); toast.error("حدث خطأ في إضافة التصنيف"); }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    try {
      await categoryService.update(editingCategory._id || editingCategory.id, { ...formData, budgetLimit: parseFloat(formData.budgetLimit) || 0, updatedAt: new Date().toISOString() });
      toast.success("تم تحديث التصنيف بنجاح");
      fetchCategories(); resetForm();
    } catch (error) { console.error(error); toast.error("حدث خطأ في تحديث التصنيف"); }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
      try { await categoryService.delete(id); toast.success("تم حذف التصنيف بنجاح"); fetchCategories(); }
      catch (error) { console.error(error); toast.error("حدث خطأ في حذف التصنيف"); }
    }
  };

  const toggleCategoryStatus = async (category) => {
    try {
      await categoryService.update(category._id || category.id, { ...category, isActive: !category.isActive, updatedAt: new Date().toISOString() });
      toast.success(`تم ${category.isActive ? "إلغاء تفعيل" : "تفعيل"} التصنيف بنجاح`);
      fetchCategories();
    } catch (error) { console.error(error); toast.error("حدث خطأ في تحديث حالة التصنيف"); }
  };

  const startEdit = (category) => {
    setFormData({
      name: category.name, nameEn: category.nameEn || "", type: category.type,
      description: category.description || "", color: category.color || "#3b82f6",
      icon: category.icon || "📁", parentId: category.parentId || "",
      subcategories: category.subcategories || [], budgetLimit: category.budgetLimit || "",
      isActive: category.isActive, sortOrder: category.sortOrder || 0,
      defaultTaxRate: category.defaultTaxRate || "", accountingCode: category.accountingCode || "",
      tags: category.tags || [], createdBy: category.createdBy || "",
      createdAt: category.createdAt || "", updatedBy: category.updatedBy || "",
      updatedAt: category.updatedAt || "",
    });
    setEditingCategory(category);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "", nameEn: "", type: "expense", description: "", color: "#3b82f6",
      icon: "📁", parentId: "", subcategories: [], budgetLimit: "", isActive: true,
      sortOrder: 0, defaultTaxRate: "", accountingCode: "", tags: [],
      createdBy: "", createdAt: "", updatedBy: "", updatedAt: "",
    });
    setEditingCategory(null);
    setShowAddModal(false);
  };

  const budgetUsagePercent = categoryStats.totalBudget > 0
    ? ((categoryStats.totalSpent / categoryStats.totalBudget) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            إدارة التصنيفات
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">تنظيم وإدارة تصنيفات المعاملات المالية</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-md shadow-purple-500/20 gap-2">
          <Plus className="w-4 h-4" />
          إضافة تصنيف جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Folder} label="إجمالي التصنيفات" value={categoryStats.totalCategories} sub={`${categoryStats.activeCategories} نشط`} color="blue" />
        <StatCard icon={DollarSign} label="الميزانية الإجمالية" value={formatCurrency(categoryStats.totalBudget)} sub="مخطط للعام" color="green" />
        <StatCard icon={Target} label="إجمالي المستخدم" value={formatCurrency(categoryStats.totalSpent)} sub={`${budgetUsagePercent}% من الميزانية`} color="red" />
        <StatCard icon={Activity} label="إجمالي المعاملات" value={categoryStats.totalTransactions} sub="معاملة مالية" color="purple" />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="البحث في التصنيفات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-12 h-11 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute left-4 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-700/60 rounded-xl p-1 self-start">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'income', label: 'إيرادات' },
            { key: 'expense', label: 'مصروفات' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setSelectedType(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedType === opt.key
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل التصنيفات...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Folder className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">لا توجد تصنيفات</h3>
          <p className="text-sm text-gray-400">
            {searchTerm || selectedType !== "all" ? "لم يتم العثور على تصنيفات تطابق معايير البحث" : "لم يتم إضافة أي تصنيفات بعد"}
          </p>
          {!searchTerm && selectedType === "all" && (
            <Button onClick={() => setShowAddModal(true)} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2">
              <Plus className="w-4 h-4" />
              إضافة تصنيف جديد
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => {
            const budgetPercentage = category.budgetLimit > 0 ? ((category.spent || 0) / category.budgetLimit) * 100 : 0;
            const barColor = budgetPercentage > 90 ? '#ef4444' : budgetPercentage > 70 ? '#f59e0b' : '#10b981';

            return (
              <Card
                key={category._id || category.id}
                className={`overflow-hidden border border-gray-200/80 dark:border-gray-700/80 rounded-xl hover:shadow-lg transition-all duration-300 group ${
                  !category.isActive ? "opacity-60" : ""
                }`}
                style={{ borderTop: `3px solid ${category.color || '#3b82f6'}` }}
              >
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm flex-shrink-0"
                        style={{ backgroundColor: `${category.color}15`, border: `1px solid ${category.color}30` }}
                      >
                        {category.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{category.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(category)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCategory(category._id || category.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={`text-[11px] px-2.5 py-0.5 rounded-lg font-medium ${
                      category.type === "income"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {category.type === "income" ? (
                        <><TrendingUp className="w-3 h-3 inline ml-1" />إيراد</>
                      ) : (
                        <><TrendingDown className="w-3 h-3 inline ml-1" />مصروف</>
                      )}
                    </Badge>

                    <button onClick={() => toggleCategoryStatus(category)}>
                      <Badge className={`text-[11px] px-2.5 py-0.5 rounded-lg font-medium cursor-pointer transition-colors ${
                        category.isActive
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}>
                        {category.isActive ? (
                          <><CheckCircle className="w-3 h-3 inline ml-1" />نشط</>
                        ) : (
                          <><XCircle className="w-3 h-3 inline ml-1" />غير نشط</>
                        )}
                      </Badge>
                    </button>
                  </div>

                  {/* Budget Progress */}
                  {category.budgetLimit > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">الميزانية المستخدمة</span>
                        <span className="font-bold" style={{ color: barColor }}>{budgetPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(budgetPercentage, 100)}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                        <span>{formatCurrency(category.spent || 0)}</span>
                        <span>{formatCurrency(category.budgetLimit)}</span>
                      </div>
                    </div>
                  )}

                  {/* Transaction Count */}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100 dark:border-gray-700/50">
                    <span className="text-gray-500 dark:text-gray-400">عدد المعاملات</span>
                    <span className="font-bold text-gray-900 dark:text-white">{category.transactionCount || 0}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200/50 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  {editingCategory ? <Edit className="w-4 h-4 text-purple-600 dark:text-purple-400" /> : <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                </div>
                {editingCategory ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={editingCategory ? handleEditCategory : handleAddCategory} className="p-5 space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم التصنيف *</Label>
                <Input id="name" defaultValue={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="مثال: رواتب، إيجار، عمولات" className="mt-1.5 rounded-xl" />
              </div>

              <div>
                <Label htmlFor="type" className="text-sm font-medium text-gray-700 dark:text-gray-300">نوع التصنيف</Label>
                <div className="flex gap-2 mt-1.5">
                  <button type="button" onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      formData.type === 'expense'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    <TrendingDown className="w-4 h-4" /> مصروف
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      formData.type === 'income'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-2 ring-green-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    <TrendingUp className="w-4 h-4" /> إيراد
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">الوصف</Label>
                <Input id="description" defaultValue={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف مختصر للتصنيف" className="mt-1.5 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color" className="text-sm font-medium text-gray-700 dark:text-gray-300">اللون</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input id="color" type="color" defaultValue={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-12 h-10 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer" />
                    <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: formData.color }} />
                    <span className="text-xs text-gray-400 font-mono" dir="ltr">{formData.color}</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="icon" className="text-sm font-medium text-gray-700 dark:text-gray-300">الأيقونة</Label>
                  <Input id="icon" defaultValue={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} placeholder="📁" className="text-center text-lg mt-1.5 rounded-xl" />
                </div>
              </div>

              <div>
                <Label htmlFor="budget" className="text-sm font-medium text-gray-700 dark:text-gray-300">الميزانية المخططة</Label>
                <Input id="budget" type="number" defaultValue={formData.budgetLimit} onChange={(e) => setFormData({ ...formData, budgetLimit: e.target.value })} placeholder="0" className="mt-1.5 rounded-xl" />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded-md w-4 h-4 text-purple-600" />
                <Label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">تصنيف نشط</Label>
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-gray-700">
                <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl gap-2">
                  <Save className="w-4 h-4" />
                  {editingCategory ? "حفظ التغييرات" : "إضافة التصنيف"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">إلغاء</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ====== STAT CARD ======
const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colors = {
    blue: { bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', value: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', value: 'text-green-600 dark:text-green-400' },
    red: { bg: 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10', icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400', value: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10', icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400', value: 'text-purple-600 dark:text-purple-400' },
  };
  const c = colors[color];

  return (
    <Card className={`bg-gradient-to-br ${c.bg} border border-gray-200/60 dark:border-gray-700/60 overflow-hidden rounded-xl`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 truncate ${c.value}`}>{value}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
          </div>
          <div className={`p-3 rounded-xl flex-shrink-0 ${c.icon}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoriesPage;
