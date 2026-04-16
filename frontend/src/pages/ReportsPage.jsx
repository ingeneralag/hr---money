import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter
} from '../components/ui/table'
import {
  FileText, TrendingUp, TrendingDown, Wallet, Users, FolderKanban,
  Download, AlertTriangle, RefreshCw, DollarSign, BarChart3, PieChart,
  Printer, ArrowUpRight, ArrowDownRight, Minus, Calendar
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell,
  AreaChart, Area
} from 'recharts'
import api from '../services/api'

// ---- helpers ----
const fmt = n => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'
const fmtShort = n => {
  const num = Number(n) || 0
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(0) + 'K'
  return num.toFixed(0)
}

const today = () => new Date().toISOString().slice(0, 10)
const firstOfYear = () => `${new Date().getFullYear()}-01-01`

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

const TABS = [
  { key: 'income', label: 'قائمة الدخل', icon: FileText },
  { key: 'cashflow', label: 'التدفقات النقدية', icon: TrendingUp },
  { key: 'balance', label: 'الميزانية', icon: Wallet },
  { key: 'aging', label: 'تقادم العملاء', icon: Users },
  { key: 'profitability', label: 'ربحية المشاريع', icon: FolderKanban },
]

const BUCKET_ORDER = ['current', '1-30', '31-60', '61-90', '90+']
const BUCKET_LABELS = {
  current: 'جاري', '1-30': '1 - 30 يوم', '31-60': '31 - 60 يوم',
  '61-90': '61 - 90 يوم', '90+': 'أكثر من 90 يوم',
}
const BUCKET_COLORS = {
  current: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  '1-30': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '31-60': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  '61-90': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '90+': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316']
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1']

// Custom label renderer for pie charts - positions labels outside with lines
const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent, index }) => {
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 30
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const textAnchor = x > cx ? 'start' : 'end'
  const pct = (percent * 100).toFixed(0)

  return (
    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central"
      className="text-xs" fill="#9ca3af" fontWeight={600} fontSize={12}>
      {name} ({pct}%)
    </text>
  )
}

const renderCustomLabelLine = ({ cx, cy, midAngle, innerRadius, outerRadius }) => {
  const RADIAN = Math.PI / 180
  const startX = cx + (outerRadius + 5) * Math.cos(-midAngle * RADIAN)
  const startY = cy + (outerRadius + 5) * Math.sin(-midAngle * RADIAN)
  const endX = cx + (outerRadius + 25) * Math.cos(-midAngle * RADIAN)
  const endY = cy + (outerRadius + 25) * Math.sin(-midAngle * RADIAN)

  return <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#6b7280" strokeWidth={1} />
}

// ---- CSV export ----
const downloadCSV = (headers, rows, filename) => {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Print helper ----
const handlePrint = (title) => {
  const printContent = document.getElementById('report-content')
  if (!printContent) return
  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; direction: rtl; color: #1f2937; }
        h1 { font-size: 24px; margin-bottom: 5px; color: #1e40af; }
        .subtitle { color: #6b7280; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: right; font-size: 13px; }
        th { background: #f3f4f6; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-box { border: 2px solid #e5e7eb; border-radius: 10px; padding: 15px; text-align: center; }
        .summary-box .label { font-size: 12px; color: #6b7280; }
        .summary-box .value { font-size: 20px; font-weight: 700; margin-top: 5px; }
        .green { color: #059669; border-color: #a7f3d0; background: #ecfdf5; }
        .red { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
        .blue { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
        @media print { body { padding: 15px; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="subtitle">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      ${printContent.innerHTML}
      <div class="footer">HR-Fee System - تم الإنشاء تلقائياً</div>
    </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
}

// ---- Custom Tooltip for Charts ----
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ---- Main Component ----
const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('income')
  const [startDate, setStartDate] = useState(firstOfYear())
  const [endDate, setEndDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [income, setIncome] = useState(null)
  const [cashflow, setCashflow] = useState(null)
  const [balance, setBalance] = useState(null)
  const [aging, setAging] = useState([])
  const [profitability, setProfitability] = useState([])

  // ---- fetchers ----
  const fetchIncome = useCallback(async () => {
    const res = await api.get('/reports/income-statement', { params: { startDate, endDate } })
    setIncome(res.data?.data || res.data)
  }, [startDate, endDate])

  const fetchCashflow = useCallback(async () => {
    const year = new Date(endDate).getFullYear()
    const res = await api.get('/reports/cash-flow', { params: { year } })
    setCashflow(res.data?.data || res.data)
  }, [endDate])

  const fetchBalance = useCallback(async () => {
    const res = await api.get('/reports/balance-sheet')
    setBalance(res.data?.data || res.data)
  }, [])

  const fetchAging = useCallback(async () => {
    const res = await api.get('/reports/client-aging')
    setAging(res.data?.data || res.data || [])
  }, [])

  const fetchProfitability = useCallback(async () => {
    const res = await api.get('/reports/project-profitability')
    setProfitability(res.data?.data || res.data || [])
  }, [])

  const FETCHERS = { income: fetchIncome, cashflow: fetchCashflow, balance: fetchBalance, aging: fetchAging, profitability: fetchProfitability }

  const loadTab = useCallback(async (tab) => {
    setLoading(true)
    setError(null)
    try { await FETCHERS[tab]() }
    catch (err) { console.error(err); setError('فشل في تحميل التقرير. يرجى المحاولة مرة أخرى.') }
    finally { setLoading(false) }
  }, [fetchIncome, fetchCashflow, fetchBalance, fetchAging, fetchProfitability])

  useEffect(() => { loadTab(activeTab) }, [activeTab, loadTab])

  // ---- CSV exports ----
  const exportIncome = () => {
    if (!income) return
    const headers = ['البند', 'المبلغ']
    const rows = []
    if (income.revenue?.byCategory) Object.entries(income.revenue.byCategory).forEach(([k, v]) => rows.push([k, v]))
    rows.push(['إجمالي الإيرادات', income.revenue?.total])
    if (income.expenses?.byCategory) Object.entries(income.expenses.byCategory).forEach(([k, v]) => rows.push([k, v]))
    rows.push(['إجمالي المصروفات', income.expenses?.total], ['الرواتب', income.payroll],
      ['إجمالي التكاليف', income.totalCosts], ['إجمالي الربح', income.grossProfit],
      ['الضريبة المقدرة', income.estimatedTax], ['صافي الربح', income.netProfit],
      ['هامش الربح %', income.profitMargin])
    downloadCSV(headers, rows, `income-statement-${startDate}-${endDate}`)
  }

  const exportCashflow = () => {
    if (!cashflow?.monthly) return
    const headers = ['الشهر', 'التدفقات الداخلة', 'التدفقات الخارجة', 'الصافي', 'الرصيد']
    const rows = cashflow.monthly.map(m => [MONTHS_AR[m.month - 1], m.inflow, m.outflow, m.net, m.balance])
    downloadCSV(headers, rows, `cash-flow-${cashflow.year || ''}`)
  }

  const exportBalance = () => {
    if (!balance) return
    const headers = ['البند', 'المبلغ']
    const rows = [
      ['النقدية', balance.assets?.cash], ['المستحقات', balance.assets?.receivables],
      ['الأصول الثابتة', balance.assets?.fixedAssets], ['إجمالي الأصول', balance.assets?.total],
      ['المطلوبات', balance.liabilities?.payables], ['إجمالي المطلوبات', balance.liabilities?.total],
      ['حقوق الملكية', balance.equity],
    ]
    downloadCSV(headers, rows, 'balance-sheet')
  }

  const exportAging = () => {
    if (!aging.length) return
    const headers = ['رقم الفاتورة', 'العميل', 'المبلغ', 'تاريخ الاستحقاق', 'أيام التأخير', 'الفئة']
    const rows = aging.map(r => [r.invoiceNumber, r.clientName, r.amount, r.dueDate, r.daysOverdue, r.bucket])
    downloadCSV(headers, rows, 'client-aging')
  }

  const exportProfitability = () => {
    if (!profitability.length) return
    const headers = ['رقم المشروع', 'المشروع', 'العميل', 'القيمة الإجمالية', 'المدفوع', 'المتبقي', 'الحالة', 'التقدم %']
    const rows = profitability.map(p => [p.projectNumber, p.name, p.clientName, p.totalAmount, p.totalPaid, p.remaining, p.status, p.progress])
    downloadCSV(headers, rows, 'project-profitability')
  }

  const EXPORTERS = { income: exportIncome, cashflow: exportCashflow, balance: exportBalance, aging: exportAging, profitability: exportProfitability }
  const PRINT_TITLES = { income: 'قائمة الدخل', cashflow: 'التدفقات النقدية', balance: 'الميزانية العمومية', aging: 'تقادم العملاء', profitability: 'ربحية المشاريع' }

  // ---- status helpers ----
  const statusColor = (status) => {
    switch (status) {
      case 'active': case 'نشط': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'completed': case 'مكتمل': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'on-hold': case 'معلق': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'cancelled': case 'ملغي': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }
  const statusLabel = (status) => ({ active: 'نشط', completed: 'مكتمل', 'on-hold': 'معلق', cancelled: 'ملغي' }[status] || status)

  // ======== TAB RENDERERS ========

  // ---- Income Statement ----
  const renderIncome = () => {
    if (!income) return null

    // Prepare chart data
    const revCatData = income.revenue?.byCategory
      ? Object.entries(income.revenue.byCategory).map(([name, value]) => ({ name, value: Number(value) || 0 }))
      : []
    const expCatData = income.expenses?.byCategory
      ? Object.entries(income.expenses.byCategory).map(([name, value]) => ({ name, value: Number(value) || 0 }))
      : []

    const overviewData = [
      { name: 'الإيرادات', value: Number(income.revenue?.total) || 0 },
      { name: 'المصروفات', value: Number(income.expenses?.total) || 0 },
      { name: 'الرواتب', value: Number(income.payroll) || 0 },
      { name: 'صافي الربح', value: Number(income.netProfit) || 0 },
    ]

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="إجمالي الإيرادات" value={fmt(income.revenue?.total)} icon={TrendingUp} color="green" trend="up" />
          <SummaryCard title="إجمالي التكاليف" value={fmt(income.totalCosts)} icon={TrendingDown} color="red" trend="down" />
          <SummaryCard title="صافي الربح" value={fmt(income.netProfit)} icon={DollarSign} color="blue"
            trend={Number(income.netProfit) > 0 ? 'up' : Number(income.netProfit) < 0 ? 'down' : 'neutral'} />
          <SummaryCard title="هامش الربح" value={`${Number(income.profitMargin || 0).toFixed(1)}%`} icon={PieChart} color="purple"
            trend={Number(income.profitMargin) > 20 ? 'up' : Number(income.profitMargin) > 0 ? 'neutral' : 'down'} />
        </div>

        {/* Overview Bar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              نظرة عامة على الأداء المالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={fmtShort} className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="المبلغ" radius={[0, 6, 6, 0]}>
                    {overviewData.map((entry, i) => (
                      <Cell key={i} fill={CHART_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Expenses Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {revCatData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-700 dark:text-green-300">الإيرادات حسب الفئة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={revCatData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value"
                        label={renderCustomPieLabel} labelLine={renderCustomLabelLine} strokeWidth={2} stroke="rgba(0,0,0,0.1)">
                        {revCatData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {revCatData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{item.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {expCatData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-700 dark:text-red-300">المصروفات حسب الفئة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={expCatData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value"
                        label={renderCustomPieLabel} labelLine={renderCustomLabelLine} strokeWidth={2} stroke="rgba(0,0,0,0.1)">
                        {expCatData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {expCatData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[(i + 3) % PIE_COLORS.length] }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{item.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Income Statement Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ملخص قائمة الدخل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <SummaryRow label="إجمالي الإيرادات" value={fmt(income.revenue?.total)} positive />
              <SummaryRow label="إجمالي المصروفات" value={fmt(income.expenses?.total)} />
              <SummaryRow label="الرواتب" value={fmt(income.payroll)} />
              <SummaryRow label="إجمالي التكاليف" value={fmt(income.totalCosts)} />
              <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
              <SummaryRow label="إجمالي الربح" value={fmt(income.grossProfit)} positive={Number(income.grossProfit) > 0} bold />
              <SummaryRow label="الضريبة المقدرة (22.5%)" value={fmt(income.estimatedTax)} />
              <div className="border-t-2 border-gray-300 dark:border-gray-600 my-2" />
              <SummaryRow label="صافي الربح" value={fmt(income.netProfit)} positive={Number(income.netProfit) > 0} bold />
              <SummaryRow label="هامش الربح" value={`${Number(income.profitMargin || 0).toFixed(1)}%`} bold />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Cash Flow ----
  const renderCashflow = () => {
    if (!cashflow) return null

    const chartData = (cashflow.monthly || []).map(m => ({
      ...m,
      monthName: MONTHS_AR[m.month - 1] || m.month,
    }))

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="إجمالي التدفقات الداخلة" value={fmt(cashflow.totalInflow)} icon={TrendingUp} color="green" trend="up" />
          <SummaryCard title="إجمالي التدفقات الخارجة" value={fmt(cashflow.totalOutflow)} icon={TrendingDown} color="red" trend="down" />
          <SummaryCard title="صافي التدفق" value={fmt((Number(cashflow.totalInflow) || 0) - (Number(cashflow.totalOutflow) || 0))} icon={BarChart3} color="blue"
            trend={(Number(cashflow.totalInflow) || 0) > (Number(cashflow.totalOutflow) || 0) ? 'up' : 'down'} />
        </div>

        {/* Bar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              التدفقات النقدية الشهرية - {cashflow.year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="monthName" className="text-xs" />
                  <YAxis tickFormatter={fmtShort} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="inflow" name="التدفقات الداخلة" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="التدفقات الخارجة" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Balance Area Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              الرصيد التراكمي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="monthName" className="text-xs" />
                  <YAxis tickFormatter={fmtShort} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="balance" name="الرصيد" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#balanceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">التفاصيل الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead>التدفقات الداخلة</TableHead>
                  <TableHead>التدفقات الخارجة</TableHead>
                  <TableHead>الصافي</TableHead>
                  <TableHead>الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.monthName}</TableCell>
                    <TableCell className="text-green-600 dark:text-green-400">{fmt(m.inflow)}</TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">{fmt(m.outflow)}</TableCell>
                    <TableCell className={Number(m.net) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {Number(m.net) >= 0 ? '+' : ''}{fmt(m.net)}
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(m.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">الإجمالي</TableCell>
                  <TableCell className="font-bold text-green-600 dark:text-green-400">{fmt(cashflow.totalInflow)}</TableCell>
                  <TableCell className="font-bold text-red-600 dark:text-red-400">{fmt(cashflow.totalOutflow)}</TableCell>
                  <TableCell className="font-bold">{fmt((Number(cashflow.totalInflow) || 0) - (Number(cashflow.totalOutflow) || 0))}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Balance Sheet ----
  const renderBalance = () => {
    if (!balance) return null

    const assetsData = [
      { name: 'النقدية', value: Number(balance.assets?.cash) || 0 },
      { name: 'المستحقات', value: Number(balance.assets?.receivables) || 0 },
      { name: 'الأصول الثابتة', value: Number(balance.assets?.fixedAssets) || 0 },
    ].filter(d => d.value > 0)

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="إجمالي الأصول" value={fmt(balance.assets?.total)} icon={TrendingUp} color="green" />
          <SummaryCard title="إجمالي المطلوبات" value={fmt(balance.liabilities?.total)} icon={TrendingDown} color="red" />
          <SummaryCard title="حقوق الملكية" value={fmt(balance.equity)} icon={Wallet} color="blue"
            trend={Number(balance.equity) > 0 ? 'up' : 'down'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets Pie */}
          {assetsData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-green-500" />
                  توزيع الأصول
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={assetsData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={4} dataKey="value"
                        label={renderCustomPieLabel} labelLine={renderCustomLabelLine} strokeWidth={2} stroke="rgba(0,0,0,0.1)">
                        {assetsData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance equation visual */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">معادلة الميزانية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">الأصول</div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{fmt(balance.assets?.total)}</div>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  <span className="text-2xl font-bold text-gray-400">=</span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">المطلوبات</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(balance.liabilities?.total)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">حقوق الملكية</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(balance.equity)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                الأصول
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <BalanceRow label="النقدية" value={fmt(balance.assets?.cash)} />
                <BalanceRow label="المستحقات" value={fmt(balance.assets?.receivables)} />
                <BalanceRow label="الأصول الثابتة" value={fmt(balance.assets?.fixedAssets)} />
                <div className="border-t-2 border-green-300 dark:border-green-700 my-2" />
                <div className="flex justify-between items-center px-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">إجمالي الأصول</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{fmt(balance.assets?.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                الالتزامات وحقوق الملكية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <BalanceRow label="المطلوبات (الموردين)" value={fmt(balance.liabilities?.payables)} />
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                <div className="flex justify-between items-center px-3">
                  <span className="font-bold text-gray-900 dark:text-white">إجمالي المطلوبات</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{fmt(balance.liabilities?.total)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                <div className="flex justify-between items-center px-3">
                  <span className="font-bold text-gray-900 dark:text-white">حقوق الملكية</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{fmt(balance.equity)}</span>
                </div>
                <div className="border-t-2 border-red-300 dark:border-red-700 my-2" />
                <div className="flex justify-between items-center px-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">الإجمالي</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {fmt((Number(balance.liabilities?.total) || 0) + (Number(balance.equity) || 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Client Aging ----
  const renderAging = () => {
    if (!aging.length) return <EmptyState message="لا توجد بيانات تقادم" />

    const grouped = {}
    BUCKET_ORDER.forEach(b => { grouped[b] = [] })
    aging.forEach(inv => {
      const b = inv.bucket || 'current'
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(inv)
    })

    const bucketTotals = {}
    BUCKET_ORDER.forEach(b => {
      bucketTotals[b] = (grouped[b] || []).reduce((s, inv) => s + (Number(inv.amount) || 0), 0)
    })

    const agingChartData = BUCKET_ORDER.map(b => ({
      name: BUCKET_LABELS[b],
      amount: bucketTotals[b],
      count: (grouped[b] || []).length,
    }))

    const totalOverdue = aging.reduce((s, inv) => s + (Number(inv.amount) || 0), 0)

    return (
      <div className="space-y-6">
        {/* Total overdue card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SummaryCard title="إجمالي المستحقات" value={fmt(totalOverdue)} icon={DollarSign} color="blue" />
          <SummaryCard title="عدد الفواتير" value={`${aging.length} فاتورة`} icon={FileText} color="purple" />
          <SummaryCard title="متأخرة > 60 يوم" value={fmt(bucketTotals['61-90'] + bucketTotals['90+'])} icon={AlertTriangle} color="red" trend="down" />
        </div>

        {/* Aging Bar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              توزيع التقادم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={fmtShort} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" name="المبلغ" radius={[6, 6, 0, 0]}>
                    {agingChartData.map((_, i) => (
                      <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bucket summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BUCKET_ORDER.map(b => (
            <div key={b} className={`rounded-xl p-4 text-center ${BUCKET_COLORS[b]} transition-transform hover:scale-105`}>
              <div className="text-xs font-medium mb-1">{BUCKET_LABELS[b]}</div>
              <div className="text-lg font-bold">{fmt(bucketTotals[b])}</div>
              <div className="text-xs mt-1">{(grouped[b] || []).length} فاتورة</div>
            </div>
          ))}
        </div>

        {/* Full table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">تفاصيل تقادم العملاء</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>أيام التأخير</TableHead>
                  <TableHead>الفئة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((inv, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell>{fmt(inv.amount)}</TableCell>
                    <TableCell>{inv.dueDate}</TableCell>
                    <TableCell>
                      <span className={Number(inv.daysOverdue) > 60 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                        {inv.daysOverdue}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={BUCKET_COLORS[inv.bucket] || BUCKET_COLORS.current}>
                        {BUCKET_LABELS[inv.bucket] || inv.bucket}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Project Profitability ----
  const renderProfitability = () => {
    if (!profitability.length) return <EmptyState message="لا توجد بيانات مشاريع" />

    const totalAmount = profitability.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0)
    const totalPaid = profitability.reduce((s, p) => s + (Number(p.totalPaid) || 0), 0)
    const totalRemaining = profitability.reduce((s, p) => s + (Number(p.remaining) || 0), 0)
    const avgProgress = profitability.length > 0 ? Math.round(profitability.reduce((s, p) => s + (Number(p.progress) || 0), 0) / profitability.length) : 0

    const chartData = profitability.slice(0, 10).map(p => ({
      name: p.name?.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
      مدفوع: Number(p.totalPaid) || 0,
      متبقي: Number(p.remaining) || 0,
    }))

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="إجمالي قيمة المشاريع" value={fmt(totalAmount)} icon={FolderKanban} color="blue" />
          <SummaryCard title="إجمالي المدفوع" value={fmt(totalPaid)} icon={TrendingUp} color="green" trend="up" />
          <SummaryCard title="إجمالي المتبقي" value={fmt(totalRemaining)} icon={TrendingDown} color="red" />
          <SummaryCard title="متوسط التقدم" value={`${avgProgress}%`} icon={PieChart} color="purple" />
        </div>

        {/* Stacked Bar Chart */}
        {chartData.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                المدفوع vs المتبقي (أعلى 10 مشاريع)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" className="text-xs" angle={-30} textAnchor="end" height={60} />
                    <YAxis tickFormatter={fmtShort} className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="مدفوع" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="متبقي" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">تفاصيل ربحية المشاريع</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم المشروع</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>القيمة الإجمالية</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التقدم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitability.map((p, i) => {
                  const progress = Number(p.progress) || 0
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.projectNumber}</TableCell>
                      <TableCell className="font-semibold">{p.name}</TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell>{fmt(p.totalAmount)}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">{fmt(p.totalPaid)}</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">{fmt(p.remaining)}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(p.status)}>{statusLabel(p.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold w-10 text-left">{progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">الإجمالي</TableCell>
                  <TableCell className="font-bold">{fmt(totalAmount)}</TableCell>
                  <TableCell className="font-bold text-green-600 dark:text-green-400">{fmt(totalPaid)}</TableCell>
                  <TableCell className="font-bold text-red-600 dark:text-red-400">{fmt(totalRemaining)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  const TAB_RENDERERS = { income: renderIncome, cashflow: renderCashflow, balance: renderBalance, aging: renderAging, profitability: renderProfitability }

  // ======== RENDER ========
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 dark:from-gray-800/90 dark:via-gray-800/70 dark:to-gray-800/90 rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
        {/* Row 1: Title + Date Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              التقارير المتقدمة
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
              تحليل مالي شامل للمؤسسة
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-700/60 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-600">
              <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex items-center gap-2">
                <div>
                  <Label className="text-[10px] text-gray-400 dark:text-gray-500 block">من</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-36 text-sm bg-transparent border-0 p-0 h-6 focus:ring-0 text-gray-900 dark:text-white" />
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
                <div>
                  <Label className="text-[10px] text-gray-400 dark:text-gray-500 block">إلى</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-36 text-sm bg-transparent border-0 p-0 h-6 focus:ring-0 text-gray-900 dark:text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => loadTab(activeTab)}
            className="gap-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span>تحديث</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePrint(PRINT_TITLES[activeTab])}
            className="gap-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <Printer className="w-4 h-4 text-purple-500" />
            <span>طباعة</span>
          </Button>
          <Button
            onClick={() => EXPORTERS[activeTab]?.()}
            className="gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md shadow-blue-500/20"
          >
            <Download className="w-4 h-4" />
            <span>تصدير CSV</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div id="report-content">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل التقرير...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-2" />
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{error}</h3>
            <Button onClick={() => loadTab(activeTab)} className="mt-3 bg-red-600 hover:bg-red-700 rounded-xl">
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          TAB_RENDERERS[activeTab]?.()
        )}
      </div>
    </div>
  )
}

// ======== SUB-COMPONENTS ========

const SummaryCard = ({ title, value, icon: Icon, color, trend }) => {
  const colors = {
    green: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
    red: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800',
    blue: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800',
  }
  const iconColors = { green: 'text-green-600 dark:text-green-400', red: 'text-red-600 dark:text-red-400', blue: 'text-blue-600 dark:text-blue-400', purple: 'text-purple-600 dark:text-purple-400' }
  const trendIcons = { up: ArrowUpRight, down: ArrowDownRight, neutral: Minus }
  const trendColors = { up: 'text-green-500', down: 'text-red-500', neutral: 'text-gray-400' }
  const TrendIcon = trend ? trendIcons[trend] : null

  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border overflow-hidden relative`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</CardTitle>
        <div className="flex items-center gap-1">
          {TrendIcon && <TrendIcon className={`w-4 h-4 ${trendColors[trend]}`} />}
          <Icon className={`h-5 w-5 ${iconColors[color]} opacity-70`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${iconColors[color]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

const SummaryRow = ({ label, value, positive, bold }) => (
  <div className={`flex justify-between items-center py-1.5 ${bold ? 'text-base' : 'text-sm'}`}>
    <span className={`${bold ? 'font-bold' : 'font-medium'} text-gray-700 dark:text-gray-300`}>{label}</span>
    <span className={`${bold ? 'font-bold text-lg' : 'font-semibold'} ${
      positive === true ? 'text-green-600 dark:text-green-400' : positive === false ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
    }`}>{value}</span>
  </div>
)

const BalanceRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2.5 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
    <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
    <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
  </div>
)

const EmptyState = ({ message }) => (
  <div className="text-center py-16">
    <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
    <p className="text-gray-500 dark:text-gray-400 text-lg">{message}</p>
  </div>
)

export default ReportsPage
