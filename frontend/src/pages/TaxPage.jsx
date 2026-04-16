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
  Landmark,
  Receipt,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Calculator,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  FileText,
  BarChart3,
  Percent,
  CreditCard,
  Building2,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react'

// ====== HELPERS ======

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'

const TAX_TYPES = [
  { value: 'CIT', label: 'ضريبة الدخل' },
  { value: 'VAT', label: 'ضريبة القيمة المضافة' },
  { value: 'WHT', label: 'ضريبة الخصم والإضافة' },
  { value: 'SI', label: 'التأمينات الاجتماعية' },
]

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

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

// ====== PROGRESS BAR ======

const ProgressBar = ({ paid, total, color = 'blue' }) => {
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
  const colorMap = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
  }
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>المدفوع: {fmt(paid)}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color] || colorMap.blue}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ====== MAIN COMPONENT ======

const TaxPage = () => {
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [toast, setToast] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    type: 'CIT',
    period: '',
    year: new Date().getFullYear(),
    quarter: '',
    month: '',
    amount: '',
    dueDate: '',
    notes: '',
  })

  // --- Fetch ---
  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/tax/dashboard?year=${year}`)
      setDashboard(res.data.data || res.data)
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحميل بيانات الضرائب', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // --- Handlers ---
  const handleAddRecord = async () => {
    if (!form.amount || !form.type) {
      setToast({ message: 'يرجى ملء الحقول المطلوبة', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await api.post('/tax/records', {
        ...form,
        amount: Number(form.amount),
        year: Number(form.year),
        quarter: form.quarter ? Number(form.quarter) : undefined,
        month: form.month ? Number(form.month) : undefined,
      })
      setToast({ message: 'تم إضافة السجل بنجاح', type: 'success' })
      setShowModal(false)
      setForm({ type: 'CIT', period: '', year: new Date().getFullYear(), quarter: '', month: '', amount: '', dueDate: '', notes: '' })
      fetchDashboard()
    } catch (err) {
      console.error(err)
      setToast({ message: err.response?.data?.message || 'فشل في إضافة السجل', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkPaid = async (id) => {
    try {
      await api.put(`/tax/records/${id}`, { status: 'paid', paidDate: new Date().toISOString().split('T')[0] })
      setToast({ message: 'تم تسجيل الدفع بنجاح', type: 'success' })
      fetchDashboard()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في تحديث السجل', type: 'error' })
    }
  }

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return
    try {
      await api.delete(`/tax/records/${id}`)
      setToast({ message: 'تم حذف السجل', type: 'success' })
      fetchDashboard()
    } catch (err) {
      console.error(err)
      setToast({ message: 'فشل في حذف السجل', type: 'error' })
    }
  }

  const s = dashboard?.summary || {}
  const monthly = dashboard?.monthlyData || []
  const records = dashboard?.taxRecords || []

  // --- Loading ---
  if (loading && !dashboard) {
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
            <Landmark className="w-8 h-8 text-blue-500" />
            مركز الضرائب والامتثال
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">النظام الضريبي المصري</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm text-gray-600 dark:text-gray-300">السنة:</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28 text-center"
            min={2020}
            max={2040}
          />
          <Button onClick={() => { setShowModal(true) }} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 ml-2" />
            إضافة سجل ضريبي
          </Button>
        </div>
      </div>

      {/* ========== SUMMARY CARDS ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-blue-700 dark:text-blue-400">صافي الأرباح</p><p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{fmt(s.netProfit)}</p><p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">الإيرادات: {fmt(s.totalRevenue)} | المصروفات: {fmt(s.totalExpenses)}</p></div><TrendingUp className="w-7 h-7 text-blue-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-red-700 dark:text-red-400">ضريبة الدخل {s.citRate || 22.5}%</p><p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">{fmt(s.estimatedCIT)}</p><p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">على صافي الأرباح</p></div><Receipt className="w-7 h-7 text-red-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-orange-700 dark:text-orange-400">ض.ق.م {s.vatRate || 14}%</p><p className="text-xl font-bold text-orange-900 dark:text-orange-100 mt-1">{fmt(s.netVAT)}</p><p className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">مخرجات: {fmt(s.outputVAT)} | مدخلات: {fmt(s.inputVAT)}</p></div><Percent className="w-7 h-7 text-orange-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-purple-700 dark:text-purple-400">التأمينات الاجتماعية</p><p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">{fmt(s.totalSI)}</p><p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">موظف: {fmt(s.siEmployee)} | عمل: {fmt(s.siEmployer)}</p></div><Users className="w-7 h-7 text-purple-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-amber-700 dark:text-amber-400">إجمالي الضرائب المقدرة</p><p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">{fmt(s.totalEstimatedTax)}</p><p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">المتبقي: {fmt(s.remainingTax)}</p></div><Calculator className="w-7 h-7 text-amber-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-green-700 dark:text-green-400">المدفوع من الضرائب</p><p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{fmt(s.totalPaidTax)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {s.totalEstimatedTax > 0 ? `${((s.totalPaidTax / s.totalEstimatedTax) * 100).toFixed(1)}%` : '0%'} من الإجمالي
                </p></div><CheckCircle className="w-7 h-7 text-green-500" /></div></CardContent>
        </Card>
      </div>

      {/* ========== TAX BREAKDOWN ========== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* CIT Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-500" />
              ضريبة الدخل (CIT {s.citRate || 22.5}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الإيرادات</span>
                <span className="font-medium">{fmt(s.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">المصروفات</span>
                <span className="font-medium text-red-500">- {fmt(s.totalExpenses)}</span>
              </div>
              <div className="border-t dark:border-gray-700 pt-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">صافي الربح</span>
                <span className="font-bold">{fmt(s.netProfit)}</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>الضريبة ({s.citRate || 22.5}%)</span>
                <span className="font-bold">{fmt(s.estimatedCIT)}</span>
              </div>
            </div>
            <ProgressBar paid={s.totalPaidTax ? (s.estimatedCIT > 0 ? Math.min(s.totalPaidTax, s.estimatedCIT) : 0) : 0} total={s.estimatedCIT} color="red" />
          </CardContent>
        </Card>

        {/* VAT Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-5 h-5 text-orange-500" />
              ضريبة القيمة المضافة (VAT {s.vatRate || 14}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-orange-500" /> ضريبة المخرجات
                </span>
                <span className="font-medium">{fmt(s.outputVAT)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" /> ضريبة المدخلات
                </span>
                <span className="font-medium text-green-500">- {fmt(s.inputVAT)}</span>
              </div>
              <div className="border-t dark:border-gray-700 pt-2 flex justify-between text-orange-600 dark:text-orange-400">
                <span>صافي الضريبة المستحقة</span>
                <span className="font-bold">{fmt(s.netVAT)}</span>
              </div>
            </div>
            <ProgressBar paid={0} total={s.netVAT} color="orange" />
          </CardContent>
        </Card>

        {/* WHT */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              ضريبة الخصم (WHT)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">إجمالي الخصم المحصل</span>
                <span className="font-medium">{fmt(s.totalWHT)}</span>
              </div>
              <div className="border-t dark:border-gray-700 pt-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الحالة</span>
                <Badge className={s.totalWHT > 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}>
                  {s.totalWHT > 0 ? 'مستحقة' : 'لا يوجد'}
                </Badge>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-500 dark:text-gray-400 text-center">
              {s.totalWHT > 0 ? 'يجب توريدها خلال الربع التالي' : 'لا توجد ضرائب خصم مستحقة'}
            </div>
          </CardContent>
        </Card>

        {/* Social Insurance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              التأمينات الاجتماعية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">حصة الموظف ({s.siEmployeeRate || 11}%)</span>
                <span className="font-medium">{fmt(s.siEmployee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">حصة صاحب العمل ({s.siEmployerRate || 18.75}%)</span>
                <span className="font-medium">{fmt(s.siEmployer)}</span>
              </div>
              <div className="border-t dark:border-gray-700 pt-2 flex justify-between text-purple-600 dark:text-purple-400">
                <span>الإجمالي السنوي</span>
                <span className="font-bold">{fmt(s.totalSI)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الإجمالي الشهري</span>
                <span className="font-medium">{fmt((s.totalSI || 0) / 12)}</span>
              </div>
            </div>
            <ProgressBar paid={0} total={s.totalSI} color="purple" />
          </CardContent>
        </Card>
      </div>

      {/* ========== MONTHLY DATA ========== */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            البيانات الشهرية - {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  {['الشهر','الإيرادات','المصروفات','الأرباح','ض.ق.م'].map((h,i) => (
                    <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {monthly.length > 0 ? monthly.map((m, idx) => (
                  <tr key={m.month} className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} ${(m.income > 0 || m.expense > 0) ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200">{MONTHS_AR[(m.month || 1) - 1]}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-semibold text-green-600 dark:text-green-400">{m.income > 0 ? fmt(m.income) : <span className="text-gray-300 dark:text-gray-600">-</span>}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-semibold text-red-500">{m.expense > 0 ? fmt(m.expense) : <span className="text-gray-300 dark:text-gray-600">-</span>}</td>
                    <td className={`px-4 py-2.5 text-sm font-mono font-bold ${m.profit > 0 ? 'text-blue-600 dark:text-blue-400' : m.profit < 0 ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`}>{m.profit !== 0 ? fmt(m.profit) : '-'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-semibold text-orange-600 dark:text-orange-400">{m.vat > 0 ? fmt(m.vat) : <span className="text-gray-300 dark:text-gray-600">-</span>}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">لا توجد بيانات</td></tr>
                )}
                {monthly.length > 0 && (
                  <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="px-4 py-3 text-sm font-black text-gray-900 dark:text-white">الإجمالي</td>
                    <td className="px-4 py-3 text-sm font-mono font-black text-green-600 dark:text-green-400">{fmt(s.totalRevenue)}</td>
                    <td className="px-4 py-3 text-sm font-mono font-black text-red-500">{fmt(s.totalExpenses)}</td>
                    <td className="px-4 py-3 text-sm font-mono font-black text-blue-600 dark:text-blue-400">{fmt(s.netProfit)}</td>
                    <td className="px-4 py-3 text-sm font-mono font-black text-orange-600 dark:text-orange-400">{fmt(s.netVAT)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mini Bar Chart */}
          {monthly.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">الإيرادات الشهرية</p>
              <div className="flex items-end gap-1.5 h-24">
                {monthly.map((m) => {
                  const maxIncome = Math.max(...monthly.map((x) => x.income || 0), 1)
                  const barH = ((m.income || 0) / maxIncome) * 100
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${MONTHS_AR[(m.month || 1) - 1]}: ${fmt(m.income)}`}>
                      <div
                        className={`w-full rounded-t transition-all duration-300 min-h-[2px] ${m.income > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                        style={{ height: `${Math.max(barH, 2)}%` }}
                      />
                      <span className="text-[9px] text-gray-400 font-mono">{(m.month || 1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== TAX RECORDS ========== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            سجلات الضرائب والمدفوعات
          </CardTitle>
          <Button onClick={() => setShowModal(true)} variant="outline" className="text-sm">
            <Plus className="w-4 h-4 ml-1" />
            إضافة
          </Button>
        </CardHeader>
        <CardContent>
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">النوع</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الفترة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">المبلغ</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">الحالة</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">تاريخ الاستحقاق</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">ملاحظات</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => {
                    const typeLabel = TAX_TYPES.find((t) => t.value === rec.type)?.label || rec.type
                    const isPaid = rec.status === 'paid'
                    return (
                      <TableRow key={rec._id || rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <TableCell>
                          <Badge className={
                            rec.type === 'CIT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            rec.type === 'VAT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            rec.type === 'WHT' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }>
                            {typeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>{rec.period || `${rec.year || year}`}{rec.quarter ? ` - ر${rec.quarter}` : ''}{rec.month ? ` - ${MONTHS_AR[(rec.month || 1) - 1]}` : ''}</TableCell>
                        <TableCell className="font-semibold">{fmt(rec.amount)}</TableCell>
                        <TableCell>
                          <Badge className={isPaid
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }>
                            {isPaid ? 'مدفوع' : 'معلق'}
                          </Badge>
                        </TableCell>
                        <TableCell>{rec.dueDate ? new Date(rec.dueDate).toLocaleDateString('ar-EG') : '-'}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400 text-sm max-w-[200px] truncate">{rec.notes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!isPaid && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkPaid(rec._id || rec.id)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-8"
                              >
                                <CheckCircle className="w-3.5 h-3.5 ml-1" />
                                دفع
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRecord(rec._id || rec.id)}
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
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">لا توجد سجلات ضريبية</p>
              <p className="text-sm mt-1">اضغط على "إضافة سجل ضريبي" لإضافة أول سجل</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== ADD RECORD MODAL ========== */}
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
                <Plus className="w-5 h-5 text-blue-500" />
                إضافة سجل ضريبي
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Type */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">نوع الضريبة *</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TAX_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Period */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">الفترة</Label>
                <Input
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="مثال: الربع الأول 2026"
                />
              </div>

              {/* Year, Quarter, Month */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">السنة</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    min={2020}
                    max={2040}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">الربع</Label>
                  <select
                    value={form.quarter}
                    onChange={(e) => setForm({ ...form, quarter: e.target.value })}
                    className="w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-</option>
                    <option value="1">الأول</option>
                    <option value="2">الثاني</option>
                    <option value="3">الثالث</option>
                    <option value="4">الرابع</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">الشهر</Label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                    className="w-full h-10 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-</option>
                    {MONTHS_AR.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">المبلغ (EGP) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  min={0}
                />
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={submitting}>
                إلغاء
              </Button>
              <Button
                onClick={handleAddRecord}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
                {submitting ? 'جاري الحفظ...' : 'حفظ السجل'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaxPage
