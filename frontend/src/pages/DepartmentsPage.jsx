import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import CategoriesPage from './CategoriesPage'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import {
  Building2,
  FolderTree,
  Layers,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Save,
  Edit3,
  ChevronDown,
  ChevronRight,
  Search,
  GripVertical,
  Tag,
  Circle,
  ToggleLeft,
  ToggleRight,
  Hash,
  Sparkles,
} from 'lucide-react'

// ====== HELPERS ======

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl text-white shadow-2xl ${colors[type] || colors.info} flex items-center gap-2 animate-slide-down backdrop-blur-sm`}>
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="mr-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  )
}

// ====== MAIN COMPONENT ======

const DepartmentsPage = () => {
  const [activeMainTab, setActiveMainTab] = useState('departments')
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [expandedDepts, setExpandedDepts] = useState({})
  const [expandedCats, setExpandedCats] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    icon: '🏢',
    color: '#3b82f6',
    sortOrder: 0,
    status: 'active',
  })

  const emojiOptions = ['🏢', '💰', '📊', '👥', '🔧', '📋', '💼', '🏗️', '📦', '🎯', '⚙️', '📁', '🛒', '🚚', '📱', '🖥️', '🔬', '📈', '🏦', '🎨']

  // --- Fetch ---
  const fetchDepartments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/departments')
      setDepartments(res.data.data || res.data || [])
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحميل الأقسام', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDepartments() }, [fetchDepartments])

  const toggleDeptExpand = (deptId) => setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  const toggleCatExpand = (catId) => setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }))

  const openAdd = () => {
    setEditing(null)
    setForm({ nameAr: '', nameEn: '', icon: '🏢', color: '#3b82f6', sortOrder: 0, status: 'active' })
    setShowModal(true)
  }

  const openEdit = (dept) => {
    setEditing(dept)
    setForm({
      nameAr: dept.nameAr || '', nameEn: dept.nameEn || '', icon: dept.icon || '🏢',
      color: dept.color || '#3b82f6', sortOrder: dept.sortOrder || 0, status: dept.status || 'active',
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.nameAr) { setToast({ message: 'يرجى إدخال اسم القسم بالعربية', type: 'error' }); return }
    setSubmitting(true)
    try {
      if (editing) {
        await api.put(`/departments/${editing._id}`, form)
        setToast({ message: 'تم تحديث القسم بنجاح', type: 'success' })
      } else {
        await api.post('/departments', form)
        setToast({ message: 'تم إضافة القسم بنجاح', type: 'success' })
      }
      setShowModal(false)
      setEditing(null)
      fetchDepartments()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حفظ القسم', type: 'error' })
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (dept) => {
    if (!window.confirm(`هل أنت متأكد من حذف قسم "${dept.nameAr}"؟`)) return
    try {
      await api.delete(`/departments/${dept._id}`)
      setToast({ message: 'تم حذف القسم بنجاح', type: 'success' })
      fetchDepartments()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حذف القسم', type: 'error' })
    }
  }

  const filteredDepartments = departments.filter(d => {
    const term = search.toLowerCase()
    return !term || (d.nameAr || '').includes(term) || (d.nameEn || '').toLowerCase().includes(term)
  })

  const totalCategories = departments.reduce((sum, d) => sum + (d.categories?.length || 0), 0)
  const activeDepts = departments.filter(d => d.status === 'active').length
  const totalSubcategories = departments.reduce((sum, d) =>
    sum + (d.categories || []).reduce((s, c) => s + (c.subcategories?.length || 0), 0), 0)

  if (loading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل الأقسام...</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-5 max-w-[1600px] mx-auto">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ========== HEADER ========== */}
      <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 dark:from-gray-800/90 dark:via-gray-800/70 dark:to-gray-800/90 rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              إدارة الأقسام والتصنيفات
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm mr-[52px]">تنظيم الأقسام والتصنيفات الفرعية للنظام</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-700/60 rounded-xl p-1">
              <button
                onClick={() => setActiveMainTab('departments')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeMainTab === 'departments'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                الأقسام
              </button>
              <button
                onClick={() => setActiveMainTab('categories')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeMainTab === 'categories'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                التصنيفات
              </button>
            </div>
            {activeMainTab === 'departments' && (
              <Button onClick={openAdd} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20 gap-2">
                <Plus className="w-4 h-4" />
                إضافة قسم
              </Button>
            )}
          </div>
        </div>
      </div>

      {activeMainTab === 'categories' ? (
        <CategoriesPage />
      ) : (<></>)}

      {activeMainTab === 'departments' && (<>
        {/* ========== STATS ========== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="إجمالي الأقسام" value={departments.length} sub="قسم مسجل" color="blue" />
          <StatCard icon={CheckCircle} label="أقسام نشطة" value={activeDepts} sub="قسم مفعل" color="green" />
          <StatCard icon={FolderTree} label="إجمالي التصنيفات" value={totalCategories} sub="تصنيف رئيسي" color="purple" />
          <StatCard icon={Layers} label="التصنيفات الفرعية" value={totalSubcategories} sub="تصنيف فرعي" color="orange" />
        </div>

        {/* ========== SEARCH ========== */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="البحث في الأقسام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-12 h-12 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-base shadow-sm focus:ring-2 focus:ring-blue-500/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* ========== DEPARTMENTS LIST ========== */}
        <div className="space-y-3">
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">لا توجد أقسام</p>
              <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة قسم" للبدء</p>
              <Button onClick={openAdd} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
                <Plus className="w-4 h-4" />
                إضافة قسم جديد
              </Button>
            </div>
          ) : (
            filteredDepartments.map(dept => {
              const isExpanded = expandedDepts[dept._id]
              const categories = dept.categories || []

              return (
                <Card key={dept._id} className="overflow-hidden border border-gray-200/80 dark:border-gray-700/80 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl">
                  {/* Level 1: Department */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer group"
                    style={{ borderRight: `4px solid ${dept.color || '#3b82f6'}` }}
                  >
                    <button onClick={() => toggleDeptExpand(dept._id)} className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        : <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      }
                    </button>

                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: `${dept.color || '#3b82f6'}15`, border: `1px solid ${dept.color || '#3b82f6'}30` }}
                    >
                      {dept.icon || '🏢'}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => toggleDeptExpand(dept._id)}>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{dept.nameAr}</h3>
                        {dept.nameEn && (
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-medium" dir="ltr">{dept.nameEn}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[10px] px-2 py-0.5 rounded-md ${
                          dept.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {dept.status === 'active' ? 'نشط' : 'غير نشط'}
                        </Badge>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <FolderTree className="w-3 h-3" />
                          {categories.length} تصنيف
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(dept) }}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(dept) }}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Level 2: Categories */}
                  {isExpanded && categories.length > 0 && (
                    <div className="border-t dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/30">
                      {categories.map((cat, catIdx) => {
                        const isCatExpanded = expandedCats[cat._id]
                        const subcategories = cat.subcategories || []

                        return (
                          <div key={cat._id}>
                            <div
                              className={`flex items-center gap-3 pr-14 pl-4 py-3 hover:bg-gray-100/60 dark:hover:bg-gray-700/30 transition-colors ${
                                catIdx < categories.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''
                              }`}
                            >
                              <div className="relative flex items-center">
                                <div className="absolute -right-6 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                                <div className="absolute -right-6 top-1/2 w-3 h-px bg-gray-200 dark:bg-gray-700" />
                              </div>

                              {subcategories.length > 0 ? (
                                <button onClick={() => toggleCatExpand(cat._id)} className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                  {isCatExpanded
                                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                                  }
                                </button>
                              ) : (
                                <div className="w-5 flex justify-center"><Circle className="w-2 h-2 text-gray-300 dark:text-gray-600" /></div>
                              )}

                              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <Tag className="w-3.5 h-3.5 text-gray-400" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{cat.name}</span>
                                  {cat.nameEn && <span className="text-xs text-gray-400" dir="ltr">{cat.nameEn}</span>}
                                  <Badge className={`text-[10px] px-1.5 py-0 rounded ${
                                    cat.type === 'income'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {cat.type === 'income' ? 'إيراد' : 'مصروف'}
                                  </Badge>
                                  {cat.isActive === false && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">معطل</Badge>
                                  )}
                                </div>
                              </div>

                              {subcategories.length > 0 && (
                                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                  {subcategories.length} فرعي
                                </span>
                              )}
                            </div>

                            {/* Level 3: Sub-categories */}
                            {isCatExpanded && subcategories.length > 0 && (
                              <div className="bg-gray-50/80 dark:bg-gray-800/50">
                                {subcategories.map((sub, subIdx) => (
                                  <div
                                    key={sub._id || subIdx}
                                    className={`flex items-center gap-3 pr-24 pl-4 py-2.5 hover:bg-gray-100/60 dark:hover:bg-gray-700/20 transition-colors ${
                                      subIdx < subcategories.length - 1 ? 'border-b border-dashed border-gray-100 dark:border-gray-700/40' : ''
                                    }`}
                                  >
                                    <div className="relative flex items-center">
                                      <div className="absolute -right-6 top-0 bottom-0 w-px border-r border-dashed border-gray-200 dark:border-gray-700" />
                                      <div className="absolute -right-6 top-1/2 w-3 h-px border-t border-dashed border-gray-200 dark:border-gray-700" />
                                    </div>

                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />

                                    <span className="text-sm text-gray-600 dark:text-gray-400">{sub.name || sub.nameAr || sub}</span>
                                    {sub.nameEn && <span className="text-xs text-gray-400" dir="ltr">{sub.nameEn}</span>}
                                    {sub.isActive === false && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">معطل</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {isExpanded && categories.length === 0 && (
                    <div className="border-t dark:border-gray-700/80 p-8 text-center bg-gray-50/50 dark:bg-gray-800/30">
                      <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد تصنيفات لهذا القسم</p>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </>)}

      {/* ========== ADD/EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  {editing ? <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
                {editing ? 'تعديل القسم' : 'إضافة قسم جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم القسم (عربي) *</Label>
                <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="مثال: قسم المحاسبة" className="mt-1.5 rounded-xl" />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم القسم (إنجليزي)</Label>
                <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Accounting" className="mt-1.5 rounded-xl" dir="ltr" />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">الأيقونة</Label>
                <div className="flex flex-wrap gap-1.5">
                  {emojiOptions.map(emoji => (
                    <button
                      key={emoji} type="button"
                      onClick={() => setForm({ ...form, icon: emoji })}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                        form.icon === emoji
                          ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 scale-110 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="أو اكتب إيموجي..." className="text-center text-lg mt-2 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اللون</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <input
                      type="color" value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-12 h-10 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-500 font-mono" dir="ltr">{form.color}</span>
                    <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: form.color }} />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">ترتيب العرض</Label>
                  <Input
                    type="number" value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                    className="mt-1.5 rounded-xl" min="0"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الحالة</Label>
                <div className="flex items-center gap-3 mt-2">
                  <button type="button" onClick={() => setForm({ ...form, status: form.status === 'active' ? 'inactive' : 'active' })} className="flex items-center gap-2">
                    {form.status === 'active'
                      ? <ToggleRight className="w-8 h-8 text-green-500" />
                      : <ToggleLeft className="w-8 h-8 text-gray-400" />
                    }
                    <span className={`text-sm font-medium ${form.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                      {form.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-xl">إلغاء</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ====== STAT CARD ======
const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colors = {
    blue: { bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', value: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', value: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10', icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400', value: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400', value: 'text-orange-600 dark:text-orange-400' },
  }
  const c = colors[color]

  return (
    <Card className={`bg-gradient-to-br ${c.bg} border border-gray-200/60 dark:border-gray-700/60 overflow-hidden`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${c.value}`}>{value}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
          </div>
          <div className={`p-3 rounded-xl ${c.icon}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DepartmentsPage
