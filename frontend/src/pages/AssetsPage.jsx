import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import LossesPage from './LossesPage'
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
  Package,
  Wrench,
  AlertTriangle,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  Search,
  DollarSign,
  Monitor,
  Cpu,
  Car,
  Briefcase,
  Box,
  ShieldCheck,
  Activity,
  Settings,
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

const ASSET_TYPES = [
  { value: 'hardware', label: 'أجهزة' },
  { value: 'software', label: 'برمجيات' },
  { value: 'office', label: 'أثاث مكتبي' },
  { value: 'vehicle', label: 'مركبات' },
  { value: 'other', label: 'أخرى' },
]

const CONDITION_CONFIG = {
  new: { label: 'جديد', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  good: { label: 'جيد', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  fair: { label: 'مقبول', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  poor: { label: 'سيء', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  damaged: { label: 'تالف', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const ASSET_STATUS_CONFIG = {
  active: { label: 'نشط', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  inactive: { label: 'غير نشط', classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  maintenance: { label: 'صيانة', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  retired: { label: 'متقاعد', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  disposed: { label: 'مستبعد', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const REPAIR_TYPES = [
  { value: 'repair', label: 'إصلاح' },
  { value: 'maintenance', label: 'صيانة دورية' },
  { value: 'new_purchase', label: 'شراء جديد' },
  { value: 'upgrade', label: 'ترقية' },
]

const REPAIR_STATUS_CONFIG = {
  pending: { label: 'معلق', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  in_progress: { label: 'جاري', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'مكتمل', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'ملغي', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const assetTypeLabel = (v) => ASSET_TYPES.find((t) => t.value === v)?.label || v
const repairTypeLabel = (v) => REPAIR_TYPES.find((t) => t.value === v)?.label || v

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

// ====== DEFAULT FORMS ======

const defaultAssetForm = () => ({
  name: '',
  type: 'hardware',
  serialNumber: '',
  purchaseDate: today(),
  purchasePrice: '',
  currentCondition: 'new',
  assignedToName: '',
  location: '',
  warrantyExpiry: '',
  status: 'active',
})

const defaultRepairForm = () => ({
  assetId: '',
  date: today(),
  type: 'repair',
  description: '',
  cost: '',
  vendor: '',
  notes: '',
})

// ====== MAIN COMPONENT ======

const AssetsPage = () => {
  const [activeTab, setActiveTab] = useState('assets')
  const [assets, setAssets] = useState([])
  const [repairs, setRepairs] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Asset modal
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [assetForm, setAssetForm] = useState(defaultAssetForm())
  const [submittingAsset, setSubmittingAsset] = useState(false)

  // Repair modal
  const [showRepairModal, setShowRepairModal] = useState(false)
  const [editingRepair, setEditingRepair] = useState(null)
  const [repairForm, setRepairForm] = useState(defaultRepairForm())
  const [submittingRepair, setSubmittingRepair] = useState(false)

  // --- Fetch ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const assetParams = {}
      if (filterType) assetParams.type = filterType
      if (filterStatus) assetParams.status = filterStatus
      if (search) assetParams.search = search

      const [assetsRes, repairsRes, statsRes] = await Promise.all([
        api.get('/assets-repairs/assets', { params: assetParams }),
        api.get('/assets-repairs/repairs'),
        api.get('/assets-repairs/stats'),
      ])
      setAssets(assetsRes.data.data || assetsRes.data || [])
      setRepairs(repairsRes.data.data || repairsRes.data || [])
      setStats(statsRes.data.data || statsRes.data || {})
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحميل البيانات', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Asset Handlers ---
  const openAddAsset = () => {
    setEditingAsset(null)
    setAssetForm(defaultAssetForm())
    setShowAssetModal(true)
  }

  const openEditAsset = (item) => {
    setEditingAsset(item)
    setAssetForm({
      name: item.name || '',
      type: item.type || 'hardware',
      serialNumber: item.serialNumber || '',
      purchaseDate: item.purchaseDate ? item.purchaseDate.split('T')[0] : today(),
      purchasePrice: item.purchasePrice || '',
      currentCondition: item.currentCondition || 'good',
      assignedToName: item.assignedToName || '',
      location: item.location || '',
      warrantyExpiry: item.warrantyExpiry ? item.warrantyExpiry.split('T')[0] : '',
      status: item.status || 'active',
    })
    setShowAssetModal(true)
  }

  const handleSubmitAsset = async () => {
    if (!assetForm.name || !assetForm.purchasePrice) {
      setToast({ message: 'يرجى ملء الحقول المطلوبة', type: 'error' })
      return
    }
    setSubmittingAsset(true)
    try {
      const payload = {
        ...assetForm,
        purchasePrice: Number(assetForm.purchasePrice),
      }
      if (editingAsset) {
        await api.put(`/assets-repairs/assets/${editingAsset._id}`, payload)
        setToast({ message: 'تم تحديث الأصل بنجاح', type: 'success' })
      } else {
        await api.post('/assets-repairs/assets', payload)
        setToast({ message: 'تم إضافة الأصل بنجاح', type: 'success' })
      }
      setShowAssetModal(false)
      setAssetForm(defaultAssetForm())
      setEditingAsset(null)
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حفظ الأصل', type: 'error' })
    } finally {
      setSubmittingAsset(false)
    }
  }

  const handleDeleteAsset = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الأصل؟')) return
    try {
      await api.delete(`/assets-repairs/assets/${id}`)
      setToast({ message: 'تم حذف الأصل', type: 'success' })
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في حذف الأصل', type: 'error' })
    }
  }

  // --- Repair Handlers ---
  const openAddRepair = () => {
    setEditingRepair(null)
    setRepairForm(defaultRepairForm())
    setShowRepairModal(true)
  }

  const openEditRepair = (item) => {
    setEditingRepair(item)
    setRepairForm({
      assetId: item.assetId || '',
      date: item.date ? item.date.split('T')[0] : today(),
      type: item.type || 'repair',
      description: item.description || '',
      cost: item.cost || '',
      vendor: item.vendor || '',
      notes: item.notes || '',
    })
    setShowRepairModal(true)
  }

  const handleSubmitRepair = async () => {
    if (!repairForm.description || !repairForm.cost) {
      setToast({ message: 'يرجى ملء الحقول المطلوبة', type: 'error' })
      return
    }
    setSubmittingRepair(true)
    try {
      const payload = {
        ...repairForm,
        cost: Number(repairForm.cost),
      }
      if (editingRepair) {
        await api.put(`/assets-repairs/repairs/${editingRepair._id}`, payload)
        setToast({ message: 'تم تحديث سجل الصيانة بنجاح', type: 'success' })
      } else {
        await api.post('/assets-repairs/repairs', payload)
        setToast({ message: 'تم إضافة سجل الصيانة بنجاح', type: 'success' })
      }
      setShowRepairModal(false)
      setRepairForm(defaultRepairForm())
      setEditingRepair(null)
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في حفظ سجل الصيانة', type: 'error' })
    } finally {
      setSubmittingRepair(false)
    }
  }

  const handleDeleteRepair = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف سجل الصيانة؟')) return
    try {
      await api.delete(`/assets-repairs/repairs/${id}`)
      setToast({ message: 'تم حذف سجل الصيانة', type: 'success' })
      fetchData()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في حذف سجل الصيانة', type: 'error' })
    }
  }

  // --- Loading ---
  if (loading && assets.length === 0 && repairs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    )
  }

  const isWarrantyExpired = (d) => {
    if (!d) return false
    return new Date(d) < new Date()
  }

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ========== HEADER ========== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            الأصول والخسائر
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">إدارة الأصول وسجلات الصيانة والخسائر</p>
        </div>
        <Button
          onClick={activeTab === 'assets' ? openAddAsset : openAddRepair}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 ml-2" />
          {activeTab === 'assets' ? 'إضافة أصل' : 'إضافة صيانة'}
        </Button>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي الأصول</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalAssets || assets.length || 0}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">عدد الأصول المسجلة</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">قيمة الأصول</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{fmt(stats.assetsValue)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إجمالي قيمة الشراء</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-purple-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">الأصول النشطة</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.activeCount || 0}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">قيد الاستخدام</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">تكاليف الصيانة</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{fmt(stats.totalRepairsCost)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">إجمالي الإصلاحات</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== TABS ========== */}
      <div className="flex border-b dark:border-gray-700">
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assets'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            الأصول
          </span>
        </button>
        <button
          onClick={() => setActiveTab('repairs')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'repairs'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            الصيانة
          </span>
        </button>
        <button
          onClick={() => setActiveTab('losses')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'losses'
              ? 'border-red-500 text-red-600 dark:text-red-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            الخسائر
          </span>
        </button>
      </div>

      {activeTab === 'losses' && <LossesPage />}

      {activeTab !== 'losses' && (<>
      {/* ========== FILTERS ========== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            {activeTab === 'assets' && (
              <>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="">كل الأنواع</option>
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="">كل الحالات</option>
                  {Object.entries(ASSET_STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ========== ASSETS TAB ========== */}
      {activeTab === 'assets' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              سجل الأصول
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">رقم الأصل</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الاسم</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">النوع</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة الفنية</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">مسند إلى</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الموقع</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">سعر الشراء</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الضمان</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((item, idx) => {
                      const cond = CONDITION_CONFIG[item.currentCondition] || CONDITION_CONFIG.good
                      const st = ASSET_STATUS_CONFIG[item.status] || ASSET_STATUS_CONFIG.active
                      const warrantyExpired = isWarrantyExpired(item.warrantyExpiry)
                      return (
                        <TableRow key={item._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                          <TableCell className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">{item.assetNumber || '-'}</TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white">{item.name}</TableCell>
                          <TableCell>
                            <Badge className={
                              item.type === 'hardware' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              item.type === 'software' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              item.type === 'office' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              item.type === 'vehicle' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }>
                              {assetTypeLabel(item.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cond.classes}`}>
                              {cond.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{item.assignedToName || '-'}</TableCell>
                          <TableCell className="text-gray-500 dark:text-gray-400">{item.location || '-'}</TableCell>
                          <TableCell className="font-semibold text-green-600 dark:text-green-400">{fmt(item.purchasePrice)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.classes}`}>
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.warrantyExpiry ? (
                              <span className={`text-xs font-medium ${warrantyExpired ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                {fmtDate(item.warrantyExpiry)}
                                {warrantyExpired && <span className="block text-[10px] text-red-400">منتهي</span>}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditAsset(item)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs px-2 py-1 h-8"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteAsset(item._id)}
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
                <p className="text-lg font-medium">لا توجد أصول مسجلة</p>
                <p className="text-sm mt-1">اضغط على "إضافة أصل" لإضافة أول أصل</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== REPAIRS TAB ========== */}
      {activeTab === 'repairs' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              سجل الصيانة والإصلاح
            </CardTitle>
          </CardHeader>
          <CardContent>
            {repairs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">رقم الصيانة</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">التاريخ</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">النوع</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الوصف</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">التكلفة</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المورد</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الأصل</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairs.map((item, idx) => {
                      const rs = REPAIR_STATUS_CONFIG[item.status] || REPAIR_STATUS_CONFIG.pending
                      return (
                        <TableRow key={item._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                          <TableCell className="font-mono text-sm font-medium text-orange-600 dark:text-orange-400">{item.repairNumber || '-'}</TableCell>
                          <TableCell>{fmtDate(item.date)}</TableCell>
                          <TableCell>
                            <Badge className={
                              item.type === 'repair' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              item.type === 'maintenance' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              item.type === 'new_purchase' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              item.type === 'upgrade' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }>
                              {repairTypeLabel(item.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-gray-700 dark:text-gray-300">{item.description || '-'}</TableCell>
                          <TableCell className="font-semibold text-orange-600 dark:text-orange-400">{fmt(item.cost)}</TableCell>
                          <TableCell className="text-gray-500 dark:text-gray-400">{item.vendor || '-'}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{item.assetName || '-'}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${rs.classes}`}>
                              {rs.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditRepair(item)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs px-2 py-1 h-8"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteRepair(item._id)}
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
                <p className="text-lg font-medium">لا توجد سجلات صيانة</p>
                <p className="text-sm mt-1">اضغط على "إضافة صيانة" لإضافة أول سجل</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      </>)}

      {/* ========== ASSET MODAL ========== */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAssetModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editingAsset ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                {editingAsset ? 'تعديل أصل' : 'إضافة أصل جديد'}
              </h2>
              <button onClick={() => setShowAssetModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم الأصل *</Label>
                  <Input
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    placeholder="اسم الأصل..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">النوع *</Label>
                  <select
                    value={assetForm.type}
                    onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الرقم التسلسلي</Label>
                  <Input
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    placeholder="الرقم التسلسلي..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">سعر الشراء *</Label>
                  <Input
                    type="number"
                    value={assetForm.purchasePrice}
                    onChange={(e) => setAssetForm({ ...assetForm, purchasePrice: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الشراء</Label>
                  <Input
                    type="date"
                    value={assetForm.purchaseDate}
                    onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">انتهاء الضمان</Label>
                  <Input
                    type="date"
                    value={assetForm.warrantyExpiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الحالة الفنية</Label>
                  <select
                    value={assetForm.currentCondition}
                    onChange={(e) => setAssetForm({ ...assetForm, currentCondition: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {Object.entries(CONDITION_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">حالة الأصل</Label>
                  <select
                    value={assetForm.status}
                    onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {Object.entries(ASSET_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">مسند إلى</Label>
                  <Input
                    value={assetForm.assignedToName}
                    onChange={(e) => setAssetForm({ ...assetForm, assignedToName: e.target.value })}
                    placeholder="اسم الموظف..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الموقع</Label>
                  <Input
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    placeholder="موقع الأصل..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowAssetModal(false)}>إلغاء</Button>
              <Button
                onClick={handleSubmitAsset}
                disabled={submittingAsset}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submittingAsset ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {editingAsset ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== REPAIR MODAL ========== */}
      {showRepairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRepairModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editingRepair ? <Edit3 className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-orange-500" />}
                {editingRepair ? 'تعديل سجل صيانة' : 'إضافة سجل صيانة'}
              </h2>
              <button onClick={() => setShowRepairModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
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
                    value={repairForm.date}
                    onChange={(e) => setRepairForm({ ...repairForm, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">النوع *</Label>
                  <select
                    value={repairForm.type}
                    onChange={(e) => setRepairForm({ ...repairForm, type: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {REPAIR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الأصل</Label>
                <select
                  value={repairForm.assetId}
                  onChange={(e) => setRepairForm({ ...repairForm, assetId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="">اختر الأصل...</option>
                  {assets.map((a) => (
                    <option key={a._id} value={a._id}>{a.name} ({a.assetNumber || '-'})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الوصف *</Label>
                <Input
                  value={repairForm.description}
                  onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value })}
                  placeholder="وصف العملية..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">التكلفة *</Label>
                  <Input
                    type="number"
                    value={repairForm.cost}
                    onChange={(e) => setRepairForm({ ...repairForm, cost: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">المورد / الفني</Label>
                  <Input
                    value={repairForm.vendor}
                    onChange={(e) => setRepairForm({ ...repairForm, vendor: e.target.value })}
                    placeholder="اسم المورد..."
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</Label>
                <Textarea
                  value={repairForm.notes}
                  onChange={(e) => setRepairForm({ ...repairForm, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowRepairModal(false)}>إلغاء</Button>
              <Button
                onClick={handleSubmitRepair}
                disabled={submittingRepair}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submittingRepair ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {editingRepair ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetsPage
