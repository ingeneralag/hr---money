import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  AlertTriangle,
  TrendingDown,
  ShieldCheck,
  DollarSign,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  Search,
  FileText,
  Ban,
} from 'lucide-react'

// ====== HELPERS ======

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

const today = () => new Date().toISOString().split('T')[0]

// ====== CONSTANTS ======

const CATEGORIES = [
  { value: 'equipment_damage', label: 'تلف معدات' },
  { value: 'theft', label: 'سرقة' },
  { value: 'bad_debt', label: 'ديون معدومة' },
  { value: 'natural_disaster', label: 'كوارث طبيعية' },
  { value: 'other', label: 'أخرى' },
]

const STATUS_CONFIG = {
  recorded: { label: 'مسجلة', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  claimed: { label: 'مطالب بها', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  resolved: { label: 'تمت التسوية', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  written_off: { label: 'مشطوبة', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v

// ====== TOAST ======

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
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-lg text-white shadow-xl ${colors[type] || colors.info} flex items-center gap-2 animate-slide-down`}>
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="mr-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  )
}

// ====== DEFAULT FORM ======

const defaultForm = () => ({
  date: today(),
  category: 'equipment_damage',
  description: '',
  originalValue: '',
  insuranceClaim: '',
  notes: '',
})

// ====== MAIN COMPONENT ======

const LossesPage = () => {
  const [losses, setLosses] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // --- Fetch ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterCategory) params.category = filterCategory
      if (filterStatus) params.status = filterStatus
      if (search) params.search = search

      const [lossesRes, statsRes] = await Promise.all([
        api.get('/losses', { params }),
        api.get('/losses/stats'),
      ])
      setLosses(lossesRes.data.data || lossesRes.data || [])
      setStats(statsRes.data.data || statsRes.data || {})
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحميل البيانات', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterStatus, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Handlers ---
  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      date: item.date ? item.date.split('T')[0] : today(),
      category: item.category || 'equipment_damage',
      description: item.description || '',
      originalValue: item.originalValue || '',
      insuranceClaim: item.insuranceClaim || '',
      notes: item.notes || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.description || !form.originalValue) {
      setToast({ message: 'يرجى ملء الحقول المطلوبة', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        originalValue: Number(form.originalValue),
        insuranceClaim: Number(form.insuranceClaim) || 0,
      }
      if (editing) {
        await api.put(`/losses/${editing._id}`, payload)
        setToast({ message: 'تم تحديث السجل بنجاح', type: 'success' })
      } else {
        await api.post('/losses', payload)
        setToast({ message: 'تم إضافة السجل بنجاح', type: 'success' })
      }
      setShowModal(false)
      setForm(defaultForm())
      setEditing(null)
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حفظ السجل', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return
    try {
      await api.delete(`/losses/${id}`)
      setToast({ message: 'تم حذف السجل', type: 'success' })
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في حذف السجل', type: 'error' })
    }
  }

  // --- Loading ---
  if (loading && losses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ========== HEADER ========== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            الخسائر والشطب
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">تتبع وإدارة الخسائر والأصول المشطوبة</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 ml-2" />
          إضافة خسارة
        </Button>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي الخسائر</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalCount || losses.length || 0}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">عدد السجلات</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي القيمة</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{fmt(stats.totalValue)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">القيمة الأصلية للخسائر</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">تعويضات التأمين</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{fmt(stats.insuranceRecovered)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">المبالغ المستردة</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">صافي الخسائر</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{fmt(stats.netLoss)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">بعد التعويضات</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== FILTERS ========== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="بحث بالوصف أو الرقم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="">كل الفئات</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ========== TABLE ========== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            سجل الخسائر
          </CardTitle>
        </CardHeader>
        <CardContent>
          {losses.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">رقم الخسارة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">التاريخ</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الفئة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الوصف</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">القيمة الأصلية</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">تعويض التأمين</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">صافي الخسارة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {losses.map((item, idx) => (
                    <TableRow key={item._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                      <TableCell className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">{item.lossNumber || '-'}</TableCell>
                      <TableCell>{fmtDate(item.date)}</TableCell>
                      <TableCell>
                        <Badge className={
                          item.category === 'equipment_damage' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          item.category === 'theft' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          item.category === 'bad_debt' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          item.category === 'natural_disaster' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }>
                          {categoryLabel(item.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-gray-700 dark:text-gray-300">{item.description || '-'}</TableCell>
                      <TableCell className="font-semibold text-red-600 dark:text-red-400">{fmt(item.originalValue)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">{fmt(item.insuranceClaim)}</TableCell>
                      <TableCell className="font-bold text-orange-600 dark:text-orange-400">{fmt(item.netLoss)}</TableCell>
                      <TableCell>
                        {(() => {
                          const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.recorded
                          return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.classes}`}>{s.label}</span>
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(item)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs px-2 py-1 h-8"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item._id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs px-2 py-1 h-8"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Ban className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">لا توجد سجلات خسائر</p>
              <p className="text-sm mt-1">اضغط على "إضافة خسارة" لإضافة أول سجل</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== ADD/EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editing ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                {editing ? 'تعديل خسارة' : 'إضافة خسارة جديدة'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">التاريخ *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الفئة *</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الوصف *</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف الخسارة..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">القيمة الأصلية *</Label>
                  <Input
                    type="number"
                    value={form.originalValue}
                    onChange={(e) => setForm({ ...form, originalValue: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">تعويض التأمين</Label>
                  <Input
                    type="number"
                    value={form.insuranceClaim}
                    onChange={(e) => setForm({ ...form, insuranceClaim: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {editing ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LossesPage
