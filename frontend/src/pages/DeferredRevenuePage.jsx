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
  Clock,
  DollarSign,
  TrendingUp,
  BarChart3,
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
  ArrowUpCircle,
  Calendar,
  Hash,
} from 'lucide-react'

// ====== HELPERS ======

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

const today = () => new Date().toISOString().split('T')[0]

const STATUS_CONFIG = {
  deferred: { label: 'مؤجل', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  partial: { label: 'معترف جزئياً', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  recognized: { label: 'معترف بالكامل', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'ملغى', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

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

// ====== MAIN COMPONENT ======

const DeferredRevenuePage = () => {
  const [items, setItems] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRecognizeModal, setShowRecognizeModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [recognizing, setRecognizing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [form, setForm] = useState({
    clientId: '',
    projectId: '',
    description: '',
    totalAmount: '',
    receivedDate: today(),
    expectedCompletion: '',
    notes: '',
  })

  const [recognizeForm, setRecognizeForm] = useState({
    recognizedAmount: '',
    status: '',
    notes: '',
  })

  // --- Fetch ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, clientsRes, projectsRes] = await Promise.all([
        api.get('/deferred-revenue'),
        api.get('/clients'),
        api.get('/projects'),
      ])
      setItems(itemsRes.data.data || itemsRes.data || [])
      setClients(clientsRes.data.data || clientsRes.data || [])
      setProjects(projectsRes.data.data || projectsRes.data || [])
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحميل البيانات', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Stats ---
  const stats = {
    totalDeferred: items.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0),
    totalRecognized: items.reduce((sum, i) => sum + (Number(i.recognizedAmount) || 0), 0),
    totalRemaining: items.reduce((sum, i) => sum + (Number(i.remainingAmount) || 0), 0),
    count: items.length,
  }

  // --- Open add ---
  const openAdd = () => {
    setEditing(null)
    setForm({ clientId: '', projectId: '', description: '', totalAmount: '', receivedDate: today(), expectedCompletion: '', notes: '' })
    setShowAddModal(true)
  }

  // --- Open edit ---
  const openEdit = (item) => {
    setEditing(item)
    setForm({
      clientId: item.clientId || '',
      projectId: item.projectId || '',
      description: item.description || '',
      totalAmount: item.totalAmount || '',
      receivedDate: item.receivedDate ? item.receivedDate.split('T')[0] : today(),
      expectedCompletion: item.expectedCompletion ? item.expectedCompletion.split('T')[0] : '',
      notes: item.notes || '',
    })
    setShowAddModal(true)
  }

  // --- Open recognize ---
  const openRecognize = (item) => {
    setRecognizing(item)
    setRecognizeForm({
      recognizedAmount: '',
      status: item.status || 'partial',
      notes: item.notes || '',
    })
    setShowRecognizeModal(true)
  }

  // --- Submit add/edit ---
  const handleSubmit = async () => {
    if (!form.totalAmount || !form.description) {
      setToast({ message: 'يرجى ملء الحقول المطلوبة', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        totalAmount: Number(form.totalAmount),
      }
      if (editing) {
        await api.put(`/deferred-revenue/${editing._id}`, payload)
        setToast({ message: 'تم تحديث السجل بنجاح', type: 'success' })
      } else {
        await api.post('/deferred-revenue', payload)
        setToast({ message: 'تم إضافة السجل بنجاح', type: 'success' })
      }
      setShowAddModal(false)
      setEditing(null)
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حفظ السجل', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // --- Submit recognize ---
  const handleRecognize = async () => {
    if (!recognizeForm.recognizedAmount || Number(recognizeForm.recognizedAmount) <= 0) {
      setToast({ message: 'يرجى إدخال المبلغ المعترف به', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const newRecognized = (Number(recognizing.recognizedAmount) || 0) + Number(recognizeForm.recognizedAmount)
      const remaining = (Number(recognizing.totalAmount) || 0) - newRecognized
      let status = recognizeForm.status
      if (remaining <= 0) status = 'recognized'
      else if (newRecognized > 0) status = 'partial'

      await api.put(`/deferred-revenue/${recognizing._id}`, {
        recognizedAmount: newRecognized,
        status,
        notes: recognizeForm.notes,
      })
      setToast({ message: 'تم الاعتراف بالإيراد بنجاح', type: 'success' })
      setShowRecognizeModal(false)
      setRecognizing(null)
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في تحديث السجل', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // --- Delete ---
  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return
    try {
      await api.delete(`/deferred-revenue/${id}`)
      setToast({ message: 'تم حذف السجل بنجاح', type: 'success' })
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في حذف السجل', type: 'error' })
    }
  }

  // --- Filter ---
  const filteredItems = items.filter(item => {
    const term = search.toLowerCase()
    const matchesSearch = !term ||
      (item.referenceNumber || '').toLowerCase().includes(term) ||
      (item.clientName || '').includes(term) ||
      (item.projectName || '').includes(term) ||
      (item.description || '').includes(term)
    const matchesStatus = !filterStatus || item.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // --- Loading ---
  if (loading && items.length === 0) {
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
            <Clock className="w-8 h-8 text-blue-500" />
            الإيرادات المؤجلة
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">تتبع المبالغ المقبوضة مقابل خدمات لم تكتمل بعد</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 ml-2" />
          إضافة إيراد مؤجل
        </Button>
      </div>

      {/* ========== STATS ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي المؤجل</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt(stats.totalDeferred)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إجمالي المبالغ المقبوضة</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">المعترف به</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{fmt(stats.totalRecognized)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إيرادات تم الاعتراف بها</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">المتبقي</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{fmt(stats.totalRemaining)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إيرادات لم يعترف بها</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-purple-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">عدد السجلات</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.count}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إيراد مؤجل</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                placeholder="بحث بالرقم المرجعي، العميل، المشروع..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
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
            <FileText className="w-5 h-5 text-blue-500" />
            سجل الإيرادات المؤجلة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الرقم المرجعي</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">العميل</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المشروع</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المبلغ الإجمالي</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المعترف به</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المتبقي</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">تاريخ الاستلام</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الاكتمال المتوقع</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, idx) => {
                    const total = Number(item.totalAmount) || 0
                    const recognized = Number(item.recognizedAmount) || 0
                    const remaining = Number(item.remainingAmount) || (total - recognized)
                    const pct = total > 0 ? (recognized / total) * 100 : 0

                    return (
                      <TableRow key={item._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                        <TableCell className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                          {item.referenceNumber || '-'}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {item.clientName || '-'}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {item.projectName || '-'}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 dark:text-white">
                          {fmt(total)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              {fmt(recognized)}
                            </span>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#3b82f6',
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-orange-600 dark:text-orange-400">
                          {fmt(remaining)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.deferred
                            return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.classes}`}>{s.label}</span>
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {fmtDate(item.receivedDate)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {fmtDate(item.expectedCompletion)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {item.status !== 'recognized' && item.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRecognize(item)}
                                className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-xs px-2 py-1 h-8"
                                title="اعتراف بالإيراد"
                              >
                                <ArrowUpCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
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
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Ban className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">لا توجد إيرادات مؤجلة</p>
              <p className="text-sm mt-1">اضغط على "إضافة إيراد مؤجل" لإضافة أول سجل</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== ADD/EDIT MODAL ========== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editing ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                {editing ? 'تعديل إيراد مؤجل' : 'إضافة إيراد مؤجل جديد'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">العميل</Label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="">اختر العميل...</option>
                  {clients.map(c => (
                    <option key={c._id} value={c._id}>{c.name || c.nameAr || c.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">المشروع</Label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="">اختر المشروع...</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.name || p.nameAr}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الوصف *</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف الإيراد المؤجل..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ الإجمالي *</Label>
                <Input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الاستلام</Label>
                  <Input
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الاكتمال المتوقع</Label>
                  <Input
                    type="date"
                    value={form.expectedCompletion}
                    onChange={(e) => setForm({ ...form, expectedCompletion: e.target.value })}
                    className="mt-1"
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

            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>إلغاء</Button>
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

      {/* ========== RECOGNIZE MODAL ========== */}
      {showRecognizeModal && recognizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRecognizeModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-green-500" />
                الاعتراف بالإيراد
              </h2>
              <button onClick={() => setShowRecognizeModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">الرقم المرجعي</span>
                  <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{recognizing.referenceNumber || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">المبلغ الإجمالي</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{fmt(recognizing.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">المعترف به سابقاً</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{fmt(recognizing.recognizedAmount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t dark:border-gray-700 pt-2">
                  <span className="text-gray-500 dark:text-gray-400">المتبقي</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">{fmt(recognizing.remainingAmount || ((Number(recognizing.totalAmount) || 0) - (Number(recognizing.recognizedAmount) || 0)))}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ المعترف به الآن *</Label>
                <Input
                  type="number"
                  value={recognizeForm.recognizedAmount}
                  onChange={(e) => setRecognizeForm({ ...recognizeForm, recognizedAmount: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  max={Number(recognizing.remainingAmount) || ((Number(recognizing.totalAmount) || 0) - (Number(recognizing.recognizedAmount) || 0))}
                />
                <p className="text-xs text-gray-400 mt-1">
                  الحد الأقصى: {fmt(recognizing.remainingAmount || ((Number(recognizing.totalAmount) || 0) - (Number(recognizing.recognizedAmount) || 0)))}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</Label>
                <Textarea
                  value={recognizeForm.notes}
                  onChange={(e) => setRecognizeForm({ ...recognizeForm, notes: e.target.value })}
                  placeholder="ملاحظات حول الاعتراف..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowRecognizeModal(false)}>إلغاء</Button>
              <Button
                onClick={handleRecognize}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ArrowUpCircle className="w-4 h-4 ml-2" />}
                اعتراف بالإيراد
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeferredRevenuePage
