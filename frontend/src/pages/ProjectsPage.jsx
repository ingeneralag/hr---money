import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Search,
  Plus,
  Eye,
  Edit3,
  Trash2,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Briefcase,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ====== HELPERS ======

const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('en-US').format(num) + ' EGP'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const statusConfig = {
  new: { label: 'جديد', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: 'قيد التنفيذ', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { label: 'مكتمل', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  on_hold: { label: 'معلق', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: 'ملغى', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const priorityConfig = {
  low: { label: 'منخفضة', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  medium: { label: 'متوسطة', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'عالية', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'عاجلة', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const departmentOptions = [
  'تطوير البرمجيات',
  'التصميم',
  'التسويق',
  'المبيعات',
  'الموارد البشرية',
  'المالية',
  'الدعم الفني',
  'العمليات',
  'الإدارة',
  'أخرى',
]

const emptyForm = {
  name: '',
  clientId: '',
  department: '',
  category: '',
  subCategory: '',
  description: '',
  startDate: '',
  endDateExpected: '',
  status: 'new',
  priority: 'medium',
  totalAmount: '',
  currency: 'EGP',
  paymentMethod: 'cash',
  installments: 3,
  milestones: [],
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
    warning: 'bg-yellow-500',
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

// ====== STATUS / PRIORITY BADGES ======

const StatusBadge = ({ status }) => {
  const c = statusConfig[status] || statusConfig.new
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.classes}`}>{c.label}</span>
}

const PriorityBadge = ({ priority }) => {
  const c = priorityConfig[priority] || priorityConfig.medium
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.classes}`}>{c.label}</span>
}

// ====== PROGRESS BAR ======

const ProgressBar = ({ value, className = '' }) => {
  const pct = Math.min(Math.max(value, 0), 100)
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-yellow-500' : 'bg-gray-300'
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 ${className}`}>
      <div className={`h-2.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ====== MAIN COMPONENT ======

const ProjectsPage = () => {
  // Data state
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({ totalProjects: 0, totalValue: 0, totalPaid: 0, totalRemaining: 0 })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 })

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Modals
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })

  // Details modal state
  const [detailProject, setDetailProject] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'كاش', reference: '', notes: '', scheduleId: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  // ====== DATA FETCHING ======

  const fetchProjects = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = { page, limit: pagination.limit }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter

      const res = await api.get('/projects', { params })
      const data = res.data?.data || res.data || []
      const pag = res.data?.pagination || {}

      setProjects(Array.isArray(data) ? data : [])
      setPagination((prev) => ({
        ...prev,
        page: pag.page || page,
        total: pag.total || data.length || 0,
        pages: pag.pages || Math.ceil((pag.total || data.length || 0) / prev.limit),
      }))
    } catch (err) {
      console.error('Error fetching projects:', err)
      showToast('حدث خطأ في تحميل المشاريع', 'error')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter, priorityFilter, pagination.limit, showToast])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/projects/stats/summary')
      const d = res.data?.data || res.data || {}
      setStats({
        totalProjects: d.totalProjects || d.total || 0,
        totalValue: d.totalValue || d.totalAmount || 0,
        totalPaid: d.totalPaid || 0,
        totalRemaining: d.totalRemaining || d.remainingAmount || 0,
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/clients')
      const data = res.data?.data || res.data || []
      setClients(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
  }, [])

  useEffect(() => {
    fetchProjects(1)
    fetchStats()
    fetchClients()
  }, []) // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter, priorityFilter]) // eslint-disable-line

  // ====== FORM HANDLERS ======

  const handleOpenAdd = () => {
    setEditingProject(null)
    setForm({ ...emptyForm })
    setShowFormModal(true)
  }

  const handleOpenEdit = (project) => {
    setEditingProject(project)
    setForm({
      name: project.name || '',
      clientId: project.clientId || '',
      department: project.department || '',
      category: project.category || '',
      subCategory: project.subCategory || '',
      description: project.description || '',
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDateExpected: project.endDateExpected ? project.endDateExpected.slice(0, 10) : '',
      status: project.status || 'new',
      priority: project.priority || 'medium',
      totalAmount: project.totalAmount || '',
      currency: project.currency || 'EGP',
      paymentMethod: project.paymentMethod || 'cash',
      installments: project.installments || 3,
      milestones: project.milestones || [],
    })
    setShowFormModal(true)
  }

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddMilestone = () => {
    setForm((prev) => ({
      ...prev,
      milestones: [...prev.milestones, { label: '', amount: '', dueDate: '' }],
    }))
  }

  const handleMilestoneChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.milestones]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, milestones: updated }
    })
  }

  const handleRemoveMilestone = (index) => {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }))
  }

  const handleSubmitForm = async () => {
    if (!form.name) {
      showToast('يرجى إدخال اسم المشروع', 'warning')
      return
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      showToast('يرجى إدخال قيمة المشروع', 'warning')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        totalAmount: Number(form.totalAmount),
        installments: form.paymentMethod === 'installments' ? Number(form.installments) : undefined,
        milestones: form.paymentMethod === 'milestones' ? form.milestones.map((m) => ({ ...m, amount: Number(m.amount) })) : undefined,
      }

      if (editingProject) {
        await api.put(`/projects/${editingProject._id || editingProject.id}`, payload)
        showToast('تم تحديث المشروع بنجاح', 'success')
      } else {
        await api.post('/projects', payload)
        showToast('تم إضافة المشروع بنجاح', 'success')
      }

      setShowFormModal(false)
      fetchProjects(pagination.page)
      fetchStats()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في حفظ المشروع', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (project) => {
    if (!window.confirm(`هل أنت متأكد من حذف المشروع "${project.name}"؟`)) return
    try {
      await api.delete(`/projects/${project._id || project.id}`)
      showToast('تم حذف المشروع بنجاح', 'success')
      fetchProjects(pagination.page)
      fetchStats()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في حذف المشروع', 'error')
    }
  }

  // ====== DETAILS MODAL ======

  const handleOpenDetails = async (project) => {
    setDetailLoading(true)
    setShowDetailsModal(true)
    setPaymentForm({ amount: '', method: 'كاش', reference: '', notes: '', scheduleId: '' })
    try {
      const res = await api.get(`/projects/${project._id || project.id}`)
      const d = res.data?.data || res.data || project
      setDetailProject(d)
    } catch (err) {
      console.error('Error fetching project details:', err)
      setDetailProject(project)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'warning')
      return
    }
    setPaymentSaving(true)
    try {
      const projectId = detailProject._id || detailProject.id
      await api.post(`/projects/${projectId}/payments`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        scheduleId: paymentForm.scheduleId || undefined,
      })
      showToast('تم تسجيل الدفعة بنجاح', 'success')
      setPaymentForm({ amount: '', method: 'كاش', reference: '', notes: '', scheduleId: '' })
      // Reload detail
      const res = await api.get(`/projects/${projectId}`)
      setDetailProject(res.data?.data || res.data || detailProject)
      fetchProjects(pagination.page)
      fetchStats()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في تسجيل الدفعة', 'error')
    } finally {
      setPaymentSaving(false)
    }
  }

  // ====== RENDER ======

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">جاري تحميل المشاريع...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ====== HEADER ====== */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white shadow-lg">
              <Briefcase className="w-7 h-7" />
            </div>
            إدارة المشاريع
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 mr-14">تتبع وإدارة جميع مشاريع الشركة والمدفوعات</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم المشروع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pr-10 pl-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[140px]"
          >
            <option value="">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="completed">مكتمل</option>
            <option value="on_hold">معلق</option>
            <option value="cancelled">ملغى</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[130px]"
          >
            <option value="">كل الأولويات</option>
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
            <option value="urgent">عاجلة</option>
          </select>

          {/* Add Button */}
          <Button
            onClick={handleOpenAdd}
            className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة مشروع
          </Button>
        </div>
      </div>

      {/* ====== STATISTICS CARDS ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">إجمالي المشاريع</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.totalProjects}</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">مشروع</p>
              </div>
              <FolderOpen className="w-7 h-7 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">قيمة المشاريع</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{formatCurrency(stats.totalValue)}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">إجمالي القيمة</p>
              </div>
              <DollarSign className="w-7 h-7 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">المبلغ المحصل</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.totalValue > 0 ? `${Math.round((stats.totalPaid / stats.totalValue) * 100)}%` : '0%'} من الإجمالي</p>
              </div>
              <TrendingUp className="w-7 h-7 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-700 dark:text-red-400">المتبقي</p>
                <p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">{formatCurrency(stats.totalRemaining)}</p>
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{stats.totalValue > 0 ? `${Math.round((stats.totalRemaining / stats.totalValue) * 100)}%` : '0%'} متبقي</p>
              </div>
              <TrendingDown className="w-7 h-7 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== PROJECTS TABLE ====== */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            قائمة المشاريع
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 mr-2">{pagination.total}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-l from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">المشروع</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">القسم</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">القيمة</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">المحصل</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">المتبقي</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">التقدم</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">الحالة</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">الأولوية</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>لا توجد مشاريع</p>
                    </td>
                  </tr>
                ) : (
                  projects.map((project, idx) => {
                    const total = Number(project.totalAmount) || 0
                    const paid = Number(project.totalPaid) || 0
                    const remaining = Number(project.remainingAmount) || (total - paid)
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0

                    return (
                      <tr
                        key={project._id || project.id || idx}
                        className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                      >
                        {/* Project name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                              {(project.name || '?')[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{project.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {project.projectNumber && <span className="ml-2">#{project.projectNumber}</span>}
                                {project.clientName && <span> - {project.clientName}</span>}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 text-sm">{project.department || '-'}</td>

                        {/* Total */}
                        <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white text-sm">{formatCurrency(total)}</td>

                        {/* Paid */}
                        <td className="py-3 px-4 text-green-600 dark:text-green-400 font-medium text-sm">{formatCurrency(paid)}</td>

                        {/* Remaining */}
                        <td className="py-3 px-4 text-red-600 dark:text-red-400 font-medium text-sm">{formatCurrency(remaining)}</td>

                        {/* Progress */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={pct} />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-left">{pct}%</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={project.status} />
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-4 text-center">
                          <PriorityBadge priority={project.priority} />
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenDetails(project)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                              title="عرض"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(project)}
                              className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                              title="تعديل"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(project)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                صفحة {new Intl.NumberFormat('en-US').format(pagination.page)} من {new Intl.NumberFormat('en-US').format(pagination.pages)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchProjects(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => fetchProjects(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== ADD / EDIT MODAL ====== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowFormModal(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                {editingProject ? 'تعديل المشروع' : 'إضافة مشروع جديد'}
              </h2>
              <button onClick={() => setShowFormModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Section 1: Basic Info */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  المعلومات الأساسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">اسم المشروع *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="أدخل اسم المشروع"
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">العميل</Label>
                    <select
                      value={form.clientId}
                      onChange={(e) => handleFormChange('clientId', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">اختر العميل</option>
                      {clients.map((c) => (
                        <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">القسم</Label>
                    <select
                      value={form.department}
                      onChange={(e) => handleFormChange('department', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">اختر القسم</option>
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">التصنيف</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                      placeholder="مثال: تطبيق ويب"
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">الوصف</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      placeholder="وصف المشروع..."
                      rows={3}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Dates & Priority */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-green-500 rounded-full" />
                  التواريخ والأولوية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">تاريخ البدء</Label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => handleFormChange('startDate', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">تاريخ الانتهاء المتوقع</Label>
                    <Input
                      type="date"
                      value={form.endDateExpected}
                      onChange={(e) => handleFormChange('endDateExpected', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">الحالة</Label>
                    <select
                      value={form.status}
                      onChange={(e) => handleFormChange('status', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {Object.entries(statusConfig).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">الأولوية</Label>
                    <select
                      value={form.priority}
                      onChange={(e) => handleFormChange('priority', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {Object.entries(priorityConfig).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Financial */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                  المالية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">قيمة المشروع *</Label>
                    <Input
                      type="number"
                      value={form.totalAmount}
                      onChange={(e) => handleFormChange('totalAmount', e.target.value)}
                      placeholder="0"
                      min="0"
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">العملة</Label>
                    <select
                      value={form.currency}
                      onChange={(e) => handleFormChange('currency', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="EGP">EGP - جنيه مصري</option>
                      <option value="USD">USD - دولار أمريكي</option>
                      <option value="EUR">EUR - يورو</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">طريقة الدفع</Label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => handleFormChange('paymentMethod', e.target.value)}
                      className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="cash">كاش</option>
                      <option value="installments">أقساط</option>
                      <option value="milestones">مراحل</option>
                    </select>
                  </div>
                </div>

                {/* Installments */}
                {form.paymentMethod === 'installments' && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <Label className="text-gray-700 dark:text-gray-300 mb-1 block text-sm">عدد الأقساط</Label>
                    <Input
                      type="number"
                      value={form.installments}
                      onChange={(e) => handleFormChange('installments', e.target.value)}
                      min="1"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 max-w-[200px]"
                    />
                    {form.totalAmount && Number(form.installments) > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        قيمة القسط الواحد: {formatCurrency(Math.ceil(Number(form.totalAmount) / Number(form.installments)))}
                      </p>
                    )}
                  </div>
                )}

                {/* Milestones */}
                {form.paymentMethod === 'milestones' && (
                  <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">المراحل</span>
                      <Button size="sm" variant="outline" onClick={handleAddMilestone}>
                        <Plus className="w-4 h-4 ml-1" />
                        إضافة مرحلة
                      </Button>
                    </div>
                    {form.milestones.map((ms, i) => (
                      <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-white dark:bg-gray-800 p-3 rounded-lg">
                        <div>
                          <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">اسم المرحلة</Label>
                          <Input
                            value={ms.label}
                            onChange={(e) => handleMilestoneChange(i, 'label', e.target.value)}
                            placeholder="مثال: التصميم"
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">المبلغ</Label>
                          <Input
                            type="number"
                            value={ms.amount}
                            onChange={(e) => handleMilestoneChange(i, 'amount', e.target.value)}
                            placeholder="0"
                            min="0"
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">تاريخ الاستحقاق</Label>
                          <Input
                            type="date"
                            value={ms.dueDate}
                            onChange={(e) => handleMilestoneChange(i, 'dueDate', e.target.value)}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveMilestone(i)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors self-end"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {form.milestones.length === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">لم يتم إضافة مراحل بعد</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowFormModal(false)}>إلغاء</Button>
              <Button
                onClick={handleSubmitForm}
                disabled={saving}
                className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {editingProject ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====== DETAILS MODAL ====== */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetailsModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                تفاصيل المشروع
              </h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : detailProject ? (
              <div className="p-6 space-y-6">
                {/* Project Header */}
                <div className="flex flex-wrap items-start gap-4 p-4 bg-gradient-to-l from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-700">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
                    {(detailProject.name || '?')[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{detailProject.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {detailProject.projectNumber && <span>#{detailProject.projectNumber}</span>}
                      {detailProject.clientName && <span>| {detailProject.clientName}</span>}
                      {detailProject.department && <span>| {detailProject.department}</span>}
                    </div>
                    {detailProject.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{detailProject.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={detailProject.status} />
                    <PriorityBadge priority={detailProject.priority} />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <Calendar className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ البدء</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{formatDate(detailProject.startDate)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <Calendar className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">الانتهاء المتوقع</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{formatDate(detailProject.endDateExpected)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <Briefcase className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">المسؤول</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{detailProject.assignedToName || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <CreditCard className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">طريقة الدفع</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                      {detailProject.paymentMethod === 'cash' ? 'كاش' : detailProject.paymentMethod === 'installments' ? 'أقساط' : detailProject.paymentMethod === 'milestones' ? 'مراحل' : detailProject.paymentMethod || '-'}
                    </p>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 bg-gradient-to-l from-emerald-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-emerald-100 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">الملخص المالي</h4>
                  {(() => {
                    const total = Number(detailProject.totalAmount) || 0
                    const paid = Number(detailProject.totalPaid) || 0
                    const remaining = Number(detailProject.remainingAmount) || (total - paid)
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0
                    return (
                      <div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">إجمالي القيمة</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">المحصل</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(paid)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">المتبقي</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(remaining)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ProgressBar value={pct} className="flex-1" />
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{pct}%</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Payment Schedule */}
                {detailProject.schedules && detailProject.schedules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      جدول الدفعات
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-xs">#</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-xs">الوصف</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-xs">المبلغ</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-xs">تاريخ الاستحقاق</th>
                            <th className="text-center py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-xs">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailProject.schedules.map((s, i) => (
                            <tr key={s._id || i} className={`border-b border-gray-100 dark:border-gray-700/50 ${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{i + 1}</td>
                              <td className="py-2.5 px-3 text-gray-900 dark:text-white">{s.label || s.description || `دفعة ${i + 1}`}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{formatCurrency(s.amount)}</td>
                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{formatDate(s.dueDate)}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  s.status === 'paid'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : s.status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {s.status === 'paid' ? 'مدفوع' : s.status === 'partial' ? 'جزئي' : 'معلق'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payment History */}
                {detailProject.payments && detailProject.payments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      سجل المدفوعات
                    </h4>
                    <div className="space-y-2">
                      {detailProject.payments.map((p, i) => (
                        <div key={p._id || i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(p.amount)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {p.method || 'كاش'} {p.reference && `- ${p.reference}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(p.date || p.createdAt)}</p>
                            {p.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Record Payment Form */}
                <div className="p-4 bg-gradient-to-l from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    تسجيل دفعة جديدة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 mb-1 block text-xs">المبلغ *</Label>
                      <Input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 mb-1 block text-xs">طريقة الدفع</Label>
                      <select
                        value={paymentForm.method}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                        className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="كاش">كاش</option>
                        <option value="تحويل بنكي">تحويل بنكي</option>
                        <option value="شيك">شيك</option>
                        <option value="بطاقة">بطاقة</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-600 dark:text-gray-400 mb-1 block text-xs">المرجع</Label>
                      <Input
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                        placeholder="رقم الإيصال أو التحويل"
                        className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                      />
                    </div>
                    {/* Schedule link if schedules exist */}
                    {detailProject.schedules && detailProject.schedules.length > 0 && (
                      <div>
                        <Label className="text-gray-600 dark:text-gray-400 mb-1 block text-xs">ربط بالجدول</Label>
                        <select
                          value={paymentForm.scheduleId}
                          onChange={(e) => setPaymentForm((prev) => ({ ...prev, scheduleId: e.target.value }))}
                          className="h-9 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">بدون ربط</option>
                          {detailProject.schedules.map((s, i) => (
                            <option key={s._id || i} value={s._id || i}>
                              {s.label || `دفعة ${i + 1}`} - {formatCurrency(s.amount)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={detailProject.schedules && detailProject.schedules.length > 0 ? 'md:col-span-2' : ''}>
                      <Label className="text-gray-600 dark:text-gray-400 mb-1 block text-xs">ملاحظات</Label>
                      <Input
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="ملاحظات إضافية..."
                        className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={handleRecordPayment}
                      disabled={paymentSaving}
                      className="bg-gradient-to-l from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                    >
                      {paymentSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                      <DollarSign className="w-4 h-4 ml-1" />
                      تسجيل الدفعة
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">لا توجد بيانات</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectsPage
