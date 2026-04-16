import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import {
  Wallet,
  DollarSign,
  Building2,
  Phone,
  BarChart3,
  PieChart,
  Plus,
  ArrowLeftRight,
  Eye,
  Edit,
  Trash2,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Calendar,
  Banknote,
  Landmark,
  Smartphone,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import api from '../services/api'

// -------- constants --------
const fmt = n => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'

const WALLET_TYPES = [
  { value: 'cash', label: 'كاش' },
  { value: 'bank', label: 'حساب بنكي' },
  { value: 'instapay', label: 'انستا باي' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'orange_cash', label: 'أورانج كاش' },
  { value: 'etisalat_cash', label: 'اتصالات كاش' },
  { value: 'we_pay', label: 'وي باي' },
  { value: 'fawry', label: 'فوري' },
  { value: 'other', label: 'أخرى' },
]

const typeLabel = v => WALLET_TYPES.find(t => t.value === v)?.label || v

const typeIcon = v => {
  switch (v) {
    case 'cash': return <Banknote className="w-5 h-5" />
    case 'bank': return <Landmark className="w-5 h-5" />
    case 'instapay':
    case 'vodafone_cash':
    case 'orange_cash':
    case 'etisalat_cash':
    case 'we_pay': return <Smartphone className="w-5 h-5" />
    case 'fawry': return <CreditCard className="w-5 h-5" />
    default: return <Wallet className="w-5 h-5" />
  }
}

const HISTORY_TYPE_CONFIG = {
  income: { label: 'إيراد', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  expense: { label: 'مصروف', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  transfer_in: { label: 'تحويل وارد', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  transfer_out: { label: 'تحويل صادر', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  manual: { label: 'تعديل يدوي', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
}

const DEFAULT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316']

// -------- Overlay / Modal shell --------
const Modal = ({ open, onClose, title, wide, children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ======== MAIN PAGE ========
const WalletsPage = () => {
  // ---- state ----
  const [wallets, setWallets] = useState([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  // modals
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [editingWallet, setEditingWallet] = useState(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustWallet, setAdjustWallet] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyWallet, setHistoryWallet] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // forms
  const emptyForm = { name: '', nameEn: '', type: 'cash', icon: '💰', color: '#3b82f6', initialBalance: '' }
  const [form, setForm] = useState(emptyForm)
  const [transferForm, setTransferForm] = useState({ fromWalletId: '', toWalletId: '', amount: '', description: '' })
  const [adjustForm, setAdjustForm] = useState({ amount: '', description: '' })

  // history filters
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')

  // ---- data fetching ----
  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/wallets')
      const d = res.data?.data || res.data
      setWallets(d.wallets || [])
      setTotalBalance(d.totalBalance || 0)
    } catch (err) {
      console.error('Error fetching wallets:', err)
      toast.error('حدث خطأ في جلب المحافظ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWallets() }, [fetchWallets])

  // ---- history ----
  const openHistory = async (wallet) => {
    setHistoryWallet(wallet)
    setShowHistory(true)
    setHistoryDateFrom('')
    setHistoryDateTo('')
    await fetchHistory(wallet._id)
  }

  const fetchHistory = async (id, from, to) => {
    try {
      setHistoryLoading(true)
      const params = {}
      if (from) params.startDate = from
      if (to) params.endDate = to
      const res = await api.get(`/wallets/${id}`, { params })
      const d = res.data?.data || res.data
      setHistoryData(d.history || [])
      // update wallet info if returned
      if (d.wallet) {
        setHistoryWallet(prev => ({ ...prev, ...d.wallet }))
      }
    } catch (err) {
      console.error('Error fetching wallet history:', err)
      toast.error('حدث خطأ في جلب سجل المحفظة')
    } finally {
      setHistoryLoading(false)
    }
  }

  const applyHistoryFilter = () => {
    if (historyWallet) fetchHistory(historyWallet._id, historyDateFrom, historyDateTo)
  }

  // ---- CRUD ----
  const openAddModal = () => {
    setEditingWallet(null)
    setForm(emptyForm)
    setShowAddEdit(true)
  }

  const openEditModal = (w) => {
    setEditingWallet(w)
    setForm({
      name: w.name || '',
      nameEn: w.nameEn || '',
      type: w.type || 'cash',
      icon: w.icon || '💰',
      color: w.color || '#3b82f6',
      initialBalance: w.initialBalance || '',
    })
    setShowAddEdit(true)
  }

  const handleSaveWallet = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المحفظة'); return }
    try {
      setSubmitting(true)
      if (editingWallet) {
        await api.put(`/wallets/${editingWallet._id}`, {
          name: form.name,
          nameEn: form.nameEn,
          type: form.type,
          icon: form.icon,
          color: form.color,
        })
        toast.success('تم تعديل المحفظة بنجاح')
      } else {
        await api.post('/wallets', {
          name: form.name,
          nameEn: form.nameEn,
          type: form.type,
          icon: form.icon,
          color: form.color,
          initialBalance: Number(form.initialBalance) || 0,
        })
        toast.success('تم إضافة المحفظة بنجاح')
      }
      setShowAddEdit(false)
      fetchWallets()
    } catch (err) {
      console.error('Error saving wallet:', err)
      toast.error(err.response?.data?.message || 'حدث خطأ في حفظ المحفظة')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (w) => {
    if (!window.confirm(`هل أنت متأكد من حذف محفظة "${w.name}"؟`)) return
    try {
      await api.delete(`/wallets/${w._id}`)
      toast.success('تم حذف المحفظة بنجاح')
      fetchWallets()
    } catch (err) {
      console.error('Error deleting wallet:', err)
      toast.error(err.response?.data?.message || 'حدث خطأ في حذف المحفظة')
    }
  }

  // ---- adjust ----
  const openAdjust = (w) => {
    setAdjustWallet(w)
    setAdjustForm({ amount: '', description: '' })
    setShowAdjust(true)
  }

  const handleAdjust = async () => {
    const amt = Number(adjustForm.amount)
    if (!amt) { toast.error('يرجى إدخال مبلغ صحيح'); return }
    try {
      setSubmitting(true)
      await api.post(`/wallets/${adjustWallet._id}/adjust`, {
        amount: amt,
        description: adjustForm.description,
      })
      toast.success('تم تعديل الرصيد بنجاح')
      setShowAdjust(false)
      fetchWallets()
    } catch (err) {
      console.error('Error adjusting wallet:', err)
      toast.error(err.response?.data?.message || 'حدث خطأ في تعديل الرصيد')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- transfer ----
  const openTransfer = () => {
    setTransferForm({ fromWalletId: '', toWalletId: '', amount: '', description: '' })
    setShowTransfer(true)
  }

  const handleTransfer = async () => {
    if (!transferForm.fromWalletId || !transferForm.toWalletId) { toast.error('يرجى اختيار المحافظ'); return }
    if (transferForm.fromWalletId === transferForm.toWalletId) { toast.error('لا يمكن التحويل لنفس المحفظة'); return }
    const amt = Number(transferForm.amount)
    if (!amt || amt <= 0) { toast.error('يرجى إدخال مبلغ صحيح'); return }
    const fromW = wallets.find(w => w._id === transferForm.fromWalletId)
    if (fromW && amt > fromW.currentBalance) { toast.error('المبلغ أكبر من رصيد المحفظة المصدر'); return }
    try {
      setSubmitting(true)
      await api.post('/wallets/transfer', {
        fromWalletId: transferForm.fromWalletId,
        toWalletId: transferForm.toWalletId,
        amount: amt,
        description: transferForm.description,
      })
      toast.success('تم التحويل بنجاح')
      setShowTransfer(false)
      fetchWallets()
    } catch (err) {
      console.error('Error transferring:', err)
      toast.error(err.response?.data?.message || 'حدث خطأ في عملية التحويل')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- active wallets for display ----
  const activeWallets = wallets.filter(w => w.isActive !== false)

  // ========== RENDER ==========
  return (
    <div dir="rtl" className="min-h-screen space-y-6 p-4 md:p-6">
      {/* -------- Header -------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-600" />
            المحافظ المالية
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            إدارة وتتبع الأرصدة في جميع المحافظ والحسابات
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openTransfer}
            className="bg-gradient-to-l from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            تحويل بين المحافظ
          </Button>
          <Button
            onClick={openAddModal}
            className="bg-gradient-to-l from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة محفظة
          </Button>
        </div>
      </div>

      {/* -------- Loading -------- */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="mr-3 text-gray-500 dark:text-gray-400">جاري تحميل المحافظ...</span>
        </div>
      )}

      {!loading && (<>
      {/* -------- الكروت -------- */}
      {(() => {
        const walletConfigs = [
          { type: 'cash', label: 'الكاش', gradient: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20', textColor: 'text-green-700 dark:text-green-300', valueColor: 'text-green-900 dark:text-green-100', Icon: Banknote, iconColor: 'text-green-600 dark:text-green-400' },
          { type: 'bank', label: 'البنك', gradient: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20', textColor: 'text-blue-700 dark:text-blue-300', valueColor: 'text-blue-900 dark:text-blue-100', Icon: Building2, iconColor: 'text-blue-600 dark:text-blue-400' },
          { type: 'instapay', label: 'انستا باي', gradient: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20', textColor: 'text-purple-700 dark:text-purple-300', valueColor: 'text-purple-900 dark:text-purple-100', Icon: Smartphone, iconColor: 'text-purple-600 dark:text-purple-400' },
          { type: 'vodafone_cash', label: 'فودافون كاش', gradient: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20', textColor: 'text-red-700 dark:text-red-300', valueColor: 'text-red-900 dark:text-red-100', Icon: Phone, iconColor: 'text-red-600 dark:text-red-400' },
          { type: 'orange_cash', label: 'أورانج كاش', gradient: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20', textColor: 'text-orange-700 dark:text-orange-300', valueColor: 'text-orange-900 dark:text-orange-100', Icon: Phone, iconColor: 'text-orange-600 dark:text-orange-400' },
          { type: 'etisalat_cash', label: 'اتصالات كاش', gradient: 'from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20', textColor: 'text-cyan-700 dark:text-cyan-300', valueColor: 'text-cyan-900 dark:text-cyan-100', Icon: Phone, iconColor: 'text-cyan-600 dark:text-cyan-400' },
        ];
        return null;
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* الرصيد الإجمالي */}
        <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-600 shadow-lg relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200">الرصيد الإجمالي</p>
                </div>
                <p className="text-3xl font-black text-amber-900 dark:text-amber-100" dir="ltr">{fmt(totalBalance)}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{activeWallets.length} محفظة نشطة</p>
              </div>
              <DollarSign className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        {/* كروت المحافظ */}
        {activeWallets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(w => {
          const configs = { cash: { g: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20', t: 'text-green-700 dark:text-green-300', v: 'text-green-900 dark:text-green-100', ic: 'text-green-600 dark:text-green-400', I: Banknote },
            bank: { g: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20', t: 'text-blue-700 dark:text-blue-300', v: 'text-blue-900 dark:text-blue-100', ic: 'text-blue-600 dark:text-blue-400', I: Building2 },
            instapay: { g: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20', t: 'text-purple-700 dark:text-purple-300', v: 'text-purple-900 dark:text-purple-100', ic: 'text-purple-600 dark:text-purple-400', I: Smartphone },
            vodafone_cash: { g: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20', t: 'text-red-700 dark:text-red-300', v: 'text-red-900 dark:text-red-100', ic: 'text-red-600 dark:text-red-400', I: Phone },
            orange_cash: { g: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20', t: 'text-orange-700 dark:text-orange-300', v: 'text-orange-900 dark:text-orange-100', ic: 'text-orange-600 dark:text-orange-400', I: Phone },
          };
          const c = configs[w.type] || { g: 'from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20', t: 'text-gray-700 dark:text-gray-300', v: 'text-gray-900 dark:text-gray-100', ic: 'text-gray-600 dark:text-gray-400', I: Wallet };
          const WIcon = c.I;
          return (
          <Card key={w._id} className={`bg-gradient-to-br ${c.g} group cursor-pointer hover:shadow-lg transition-all`} onClick={() => openHistory(w)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${c.t}`}>{w.name}</p>
                  <p className={`text-2xl font-bold ${c.v}`} dir="ltr">{fmt(w.currentBalance)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{typeLabel(w.type)}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openAdjust(w); }} className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-700" title="تعديل الرصيد"><SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" /></button>
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(w); }} className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-700" title="تعديل"><Edit className="w-3.5 h-3.5 text-gray-500" /></button>
                    </div>
                  </div>
                </div>
                <WIcon className={`w-8 h-8 ${c.ic}`} />
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {/* -------- رسم بياني - توزيع الأرصدة -------- */}
      {activeWallets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* توزيع الأرصدة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                توزيع الأرصدة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {activeWallets.filter(w => w.currentBalance > 0).sort((a, b) => b.currentBalance - a.currentBalance).map(w => {
                  const pct = totalBalance > 0 ? Math.round(w.currentBalance / totalBalance * 100) : 0;
                  const colors = { cash: '#22C55E', bank: '#3B82F6', instapay: '#8B5CF6', vodafone_cash: '#E11D48', orange_cash: '#EA580C' };
                  const clr = colors[w.type] || w.color || '#6B7280';
                  return (
                    <div key={w._id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{w.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-white" dir="ltr">{fmt(w.currentBalance)}</span>
                          <span className="text-xs text-gray-500 font-mono">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                        <div className="h-3 rounded-full transition-all duration-500" style={{width: `${pct}%`, background: clr}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* نسبة كل محفظة - دائري */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                نسبة كل محفظة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  {(() => {
                    const colors = { cash: '#22C55E', bank: '#3B82F6', instapay: '#8B5CF6', vodafone_cash: '#E11D48', orange_cash: '#EA580C' };
                    let cumulative = 0;
                    const segments = activeWallets.filter(w => w.currentBalance > 0).map(w => {
                      const pct = totalBalance > 0 ? w.currentBalance / totalBalance * 100 : 0;
                      const start = cumulative;
                      cumulative += pct;
                      return { ...w, pct, start, color: colors[w.type] || w.color || '#6B7280' };
                    });
                    const gradientParts = segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');
                    return (
                      <div className="w-48 h-48 rounded-full relative" style={{background: `conic-gradient(${gradientParts || '#e5e7eb 0% 100%'})`}}>
                        <div className="absolute inset-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center flex-col">
                          <p className="text-lg font-black text-gray-900 dark:text-white" dir="ltr">{fmt(totalBalance)}</p>
                          <p className="text-[10px] text-gray-500">إجمالي</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {activeWallets.filter(w => w.currentBalance > 0).map(w => {
                  const colors = { cash: '#22C55E', bank: '#3B82F6', instapay: '#8B5CF6', vodafone_cash: '#E11D48' };
                  return (
                    <div key={w._id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <div className="w-2.5 h-2.5 rounded-full" style={{background: colors[w.type] || w.color || '#6B7280'}} />
                      {w.name}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeWallets.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">لا توجد محافظ حتى الآن</p>
        </div>
      )}
      </>)}

      {/* =============== MODALS =============== */}

      {/* -------- Add / Edit Wallet Modal -------- */}
      <Modal open={showAddEdit} onClose={() => setShowAddEdit(false)} title={editingWallet ? 'تعديل المحفظة' : 'إضافة محفظة جديدة'}>
        <div className="space-y-5">
          {/* name ar */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">اسم المحفظة (عربي)</Label>
            <Input
              className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="مثال: الخزنة الرئيسية"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          {/* name en */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">اسم المحفظة (إنجليزي)</Label>
            <Input
              className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              dir="ltr"
              placeholder="e.g. Main Cash"
              value={form.nameEn}
              onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
            />
          </div>
          {/* type */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">نوع المحفظة</Label>
            <select
              className="mt-1.5 w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            >
              {WALLET_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {/* icon */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">الأيقونة (إيموجي)</Label>
            <Input
              className="mt-1.5 text-2xl text-center dark:bg-gray-700 dark:border-gray-600"
              value={form.icon}
              onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
              maxLength={4}
            />
          </div>
          {/* color */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">اللون</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              />
              <div className="flex gap-1.5 flex-wrap">
                {DEFAULT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* initial balance - only create */}
          {!editingWallet && (
            <div>
              <Label className="text-gray-700 dark:text-gray-300">الرصيد الافتتاحي</Label>
              <Input
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="ltr"
                type="number"
                min="0"
                placeholder="0"
                value={form.initialBalance}
                onChange={e => setForm(p => ({ ...p, initialBalance: e.target.value }))}
              />
            </div>
          )}
          {/* submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAddEdit(false)} className="dark:border-gray-600 dark:text-gray-300">
              إلغاء
            </Button>
            <Button
              onClick={handleSaveWallet}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingWallet ? 'حفظ التعديلات' : 'إضافة المحفظة'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* -------- Transfer Modal -------- */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="تحويل بين المحافظ">
        <div className="space-y-5">
          {/* from */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">من محفظة</Label>
            <select
              className="mt-1.5 w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={transferForm.fromWalletId}
              onChange={e => setTransferForm(p => ({ ...p, fromWalletId: e.target.value }))}
            >
              <option value="">اختر المحفظة</option>
              {activeWallets.map(w => (
                <option key={w._id} value={w._id}>
                  {w.icon} {w.name} — {fmt(w.currentBalance)}
                </option>
              ))}
            </select>
          </div>
          {/* to */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">إلى محفظة</Label>
            <select
              className="mt-1.5 w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={transferForm.toWalletId}
              onChange={e => setTransferForm(p => ({ ...p, toWalletId: e.target.value }))}
            >
              <option value="">اختر المحفظة</option>
              {activeWallets
                .filter(w => w._id !== transferForm.fromWalletId)
                .map(w => (
                  <option key={w._id} value={w._id}>
                    {w.icon} {w.name} — {fmt(w.currentBalance)}
                  </option>
                ))}
            </select>
          </div>
          {/* amount */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">المبلغ</Label>
            <Input
              className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              dir="ltr"
              type="number"
              min="0"
              max={wallets.find(w => w._id === transferForm.fromWalletId)?.currentBalance || undefined}
              placeholder="0"
              value={transferForm.amount}
              onChange={e => setTransferForm(p => ({ ...p, amount: e.target.value }))}
            />
            {transferForm.fromWalletId && (
              <p className="text-xs text-gray-400 mt-1">
                الحد الأقصى: {fmt(wallets.find(w => w._id === transferForm.fromWalletId)?.currentBalance)}
              </p>
            )}
          </div>
          {/* description */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">الوصف</Label>
            <Textarea
              className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows={2}
              placeholder="سبب التحويل (اختياري)"
              value={transferForm.description}
              onChange={e => setTransferForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          {/* submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTransfer(false)} className="dark:border-gray-600 dark:text-gray-300">
              إلغاء
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              تنفيذ التحويل
            </Button>
          </div>
        </div>
      </Modal>

      {/* -------- Adjust Balance Modal -------- */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="تعديل الرصيد">
        {adjustWallet && (
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">الرصيد الحالي لـ {adjustWallet.name}</p>
              <p className="text-2xl font-bold" dir="ltr" style={{ color: adjustWallet.color || '#3b82f6' }}>
                {fmt(adjustWallet.currentBalance)}
              </p>
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">المبلغ (موجب للإضافة، سالب للخصم)</Label>
              <Input
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                dir="ltr"
                type="number"
                placeholder="مثال: 1000 أو -500"
                value={adjustForm.amount}
                onChange={e => setAdjustForm(p => ({ ...p, amount: e.target.value }))}
              />
              {adjustForm.amount && (
                <p className={`text-xs mt-1 ${Number(adjustForm.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  الرصيد بعد التعديل: {fmt((adjustWallet.currentBalance || 0) + Number(adjustForm.amount || 0))}
                </p>
              )}
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">السبب / الوصف</Label>
              <Textarea
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={2}
                placeholder="سبب تعديل الرصيد"
                value={adjustForm.description}
                onChange={e => setAdjustForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAdjust(false)} className="dark:border-gray-600 dark:text-gray-300">
                إلغاء
              </Button>
              <Button
                onClick={handleAdjust}
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                تعديل الرصيد
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------- Wallet History Modal -------- */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`سجل محفظة: ${historyWallet?.name || ''}`} wide>
        {historyWallet && (
          <div className="space-y-5">
            {/* wallet summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{historyWallet.icon || '💰'}</span>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{historyWallet.name}</h3>
                  <Badge className="text-[11px] bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 border-0 mt-1">
                    {typeLabel(historyWallet.type)}
                  </Badge>
                </div>
              </div>
              <div className="text-left" dir="ltr">
                <p className="text-xs text-gray-400 dark:text-gray-500">الرصيد الحالي</p>
                <p className="text-xl font-bold" style={{ color: historyWallet.color || '#3b82f6' }}>
                  {fmt(historyWallet.currentBalance)}
                </p>
              </div>
            </div>

            {/* date filter */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-gray-700 dark:text-gray-300 text-xs">من تاريخ</Label>
                <Input
                  type="date"
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={historyDateFrom}
                  onChange={e => setHistoryDateFrom(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label className="text-gray-700 dark:text-gray-300 text-xs">إلى تاريخ</Label>
                <Input
                  type="date"
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={historyDateTo}
                  onChange={e => setHistoryDateTo(e.target.value)}
                />
              </div>
              <Button
                onClick={applyHistoryFilter}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm gap-1.5 h-10"
              >
                <Calendar className="w-4 h-4" /> تصفية
              </Button>
            </div>

            {/* table */}
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="mr-2 text-gray-400">جاري التحميل...</span>
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p>لا توجد حركات في هذه المحفظة</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300">
                      <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                      <th className="px-4 py-3 text-right font-semibold">النوع</th>
                      <th className="px-4 py-3 text-right font-semibold">الوصف</th>
                      <th className="px-4 py-3 text-left font-semibold" dir="ltr">المبلغ</th>
                      <th className="px-4 py-3 text-left font-semibold" dir="ltr">الرصيد بعد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, i) => {
                      const cfg = HISTORY_TYPE_CONFIG[h.type] || HISTORY_TYPE_CONFIG.manual
                      const isPositive = ['income', 'transfer_in', 'manual'].includes(h.type) ? (h.amount >= 0) : false
                      const isNegative = ['expense', 'transfer_out'].includes(h.type) || (h.type === 'manual' && h.amount < 0)
                      return (
                        <tr
                          key={h._id || i}
                          className={`border-t border-gray-100 dark:border-gray-700/50 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} hover:bg-blue-50/40 dark:hover:bg-gray-700/40`}
                        >
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs" dir="ltr">
                            {h.date ? new Date(h.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                            {h.description || '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold whitespace-nowrap" dir="ltr">
                            <span className={isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                              {isNegative ? '' : '+'}{new Intl.NumberFormat('en-US').format(Number(h.amount) || 0)} EGP
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap" dir="ltr">
                            {fmt(h.newBalance)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default WalletsPage
