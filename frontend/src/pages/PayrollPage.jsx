import React, { useState, useEffect, useCallback } from 'react'
import api, { payrollService, employeeService } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
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
  Search,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileSpreadsheet,
  Printer,
  X,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  Eye,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

// ====== HELPERS ======

const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('en-US').format(num) + ' EGP'
}

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getMonthLabel = (monthStr) => {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })
}

// ====== TOAST COMPONENT ======

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

// ====== MAIN COMPONENT ======

const PayrollPage = () => {
  // --- State ---
  const [employees, setEmployees] = useState([])
  const [payrollData, setPayrollData] = useState([])
  const [stats, setStats] = useState({ totalSalaries: 0, paidAmount: 0, remainingAmount: 0, employeeCount: 0, paidCount: 0, partialCount: 0, pendingCount: 0 })
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth())
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [attendanceLink, setAttendanceLink] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState(null)

  // Modal sub-state
  const [modalTab, setModalTab] = useState('breakdown')
  const [salaryDetails, setSalaryDetails] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [modalLoading, setModalLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Salary editing
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryForm, setSalaryForm] = useState({})
  const [savingSalary, setSavingSalary] = useState(false)

  // Adjustment form
  const [adjType, setAdjType] = useState('bonus')
  const [adjCategory, setAdjCategory] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjDescription, setAdjDescription] = useState('')

  // Payment form
  const [paymentType, setPaymentType] = useState('full')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('كاش')
  const [paymentNote, setPaymentNote] = useState('')

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  // --- Data Fetching ---

  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        (process.env.REACT_APP_API_URL || 'http://localhost:5001/api') + '/settings',
        { headers: { Authorization: 'Bearer ' + token } }
      )
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const linkSetting = json.data.find((s) => s.key === 'payroll_attendance_link')
        if (linkSetting) {
          setAttendanceLink(linkSetting.value === true || linkSetting.value === 'true')
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, payRes, statsRes] = await Promise.all([
        api.get('/employees'),
        api.get(`/payroll?month=${currentMonth}`),
        api.get(`/payroll/stats/summary?month=${currentMonth}`),
      ])

      const emps = empRes.data?.data || empRes.data || []
      const payrolls = payRes.data?.data || payRes.data || []
      const summaryStats = statsRes.data?.data || statsRes.data || {}

      setEmployees(Array.isArray(emps) ? emps : [])
      setPayrollData(Array.isArray(payrolls) ? payrolls : [])

      // Build stats from API or compute locally
      const totalSalaries = summaryStats.totalSalaries || summaryStats.totalNetSalaries || 0
      const paidAmount = summaryStats.paidAmount || summaryStats.totalPaid || 0
      const remainingAmount = summaryStats.remainingAmount || summaryStats.totalRemaining || (totalSalaries - paidAmount)
      const employeeCount = summaryStats.employeeCount || summaryStats.totalEmployees || (Array.isArray(emps) ? emps.length : 0)
      const paidCount = summaryStats.paidCount || 0
      const partialCount = summaryStats.partialCount || 0
      const pendingCount = summaryStats.pendingCount || (employeeCount - paidCount - partialCount)

      setStats({ totalSalaries, paidAmount, remainingAmount, employeeCount, paidCount, partialCount, pendingCount })
    } catch (err) {
      console.error('Error fetching payroll data:', err)
      showToast('حدث خطأ في تحميل البيانات', 'error')
    } finally {
      setLoading(false)
    }
  }, [currentMonth, showToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Helpers ---

  const getPayrollForEmployee = (empId) => {
    return payrollData.find((p) => (p.employeeId === empId || p.employeeId?._id === empId || p.employee === empId || p.employee?._id === empId))
  }

  const calcAllowancesTotal = (emp) => {
    if (!emp?.allowances) return 0
    return (emp.allowances.transportation || 0) + (emp.allowances.housing || 0) + (emp.allowances.meal || 0)
  }

  const calcFixedDeductions = (emp) => {
    if (!emp?.deductions) return 0
    return (emp.deductions.socialInsurance || 0) + (emp.deductions.tax || 0)
  }

  const getEmployeeRow = (emp) => {
    const pr = getPayrollForEmployee(emp._id || emp.id)
    const baseSalary = emp.baseSalary || 0
    const allowances = calcAllowancesTotal(emp)
    const fixedDeductions = calcFixedDeductions(emp)
    const bonuses = pr?.bonusesTotal || pr?.totalBonuses || 0
    const manualDeductions = pr?.deductionsTotal || pr?.totalManualDeductions || 0
    const latenessDeduction = attendanceLink ? (pr?.latenessDeduction || pr?.attendanceDeduction || 0) : 0
    const totalDeductions = fixedDeductions + manualDeductions + latenessDeduction
    const netSalary = pr?.netSalary || (baseSalary + allowances + bonuses - totalDeductions)
    const paid = pr?.paidAmount || pr?.totalPaid || 0
    const remaining = pr?.remainingAmount ?? (netSalary - paid)
    const status = pr?.status || (paid >= netSalary && netSalary > 0 ? 'paid' : paid > 0 ? 'partial' : pr ? 'pending' : 'not_generated')

    return { baseSalary, allowances, fixedDeductions, bonuses, manualDeductions, latenessDeduction, totalDeductions, netSalary, paid, remaining, status, payrollRecord: pr }
  }

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))]

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch = !searchTerm || emp.name?.includes(searchTerm) || emp.employeeNumber?.includes(searchTerm) || emp.department?.includes(searchTerm)
    const matchDept = departmentFilter === 'all' || emp.department === departmentFilter
    return matchSearch && matchDept
  })

  // --- Actions ---

  const handleGeneratePayroll = async () => {
    setGenerating(true)
    try {
      await api.post('/payroll/generate', { month: currentMonth })
      showToast('تم حساب رواتب الشهر بنجاح', 'success')
      await fetchData()
    } catch (err) {
      console.error('Error generating payroll:', err)
      showToast(err.response?.data?.message || 'حدث خطأ في حساب الرواتب', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const openEmployeeModal = async (emp) => {
    setSelectedEmployee(emp)
    setShowModal(true)
    setModalTab('breakdown')
    setModalLoading(true)
    setSalaryDetails(null)
    setPaymentHistory([])
    setEditingSalary(false)
    setSalaryForm({
      baseSalary: emp.baseSalary || 0,
      transportation: emp.allowances?.transportation || 0,
      housing: emp.allowances?.housing || 0,
      meal: emp.allowances?.meal || 0,
      socialInsurance: emp.deductions?.socialInsurance || 0,
      tax: emp.deductions?.tax || 0,
    })
    // Reset forms
    setAdjType('bonus')
    setAdjCategory('')
    setAdjAmount('')
    setAdjDescription('')
    setPaymentType('full')
    setPaymentMethod('كاش')
    setPaymentNote('')

    try {
      const [salaryRes, historyRes] = await Promise.all([
        api.get(`/employees/${emp._id || emp.id}/salary/${currentMonth}`).catch(() => null),
        api.get(`/employees/payment-history/${currentMonth}`).catch(() => null),
      ])

      if (salaryRes?.data?.data) {
        setSalaryDetails(salaryRes.data.data)
      } else if (salaryRes?.data) {
        setSalaryDetails(salaryRes.data)
      }

      const allHistory = historyRes?.data?.data || historyRes?.data || []
      const empHistory = Array.isArray(allHistory)
        ? allHistory.filter((h) => (h.employeeId === (emp._id || emp.id) || h.employee === (emp._id || emp.id) || h.employeeId?._id === (emp._id || emp.id)))
        : []
      setPaymentHistory(empHistory)

      // Set payment amount
      const row = getEmployeeRow(emp)
      setPaymentAmount(String(row.remaining > 0 ? row.remaining : row.netSalary))
    } catch (err) {
      console.error('Error loading employee details:', err)
    } finally {
      setModalLoading(false)
    }
  }

  const handleAddAdjustment = async () => {
    if (!adjCategory || !adjAmount) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'warning')
      return
    }
    setActionLoading(true)
    try {
      const empId = selectedEmployee._id || selectedEmployee.id
      await api.put(`/payroll/${empId}/adjustments`, {
        type: adjType,
        category: adjCategory,
        amount: Number(adjAmount),
        description: adjDescription,
        month: currentMonth,
      })
      showToast(adjType === 'bonus' ? 'تمت إضافة المكافأة بنجاح' : 'تمت إضافة الخصم بنجاح', 'success')
      setAdjCategory('')
      setAdjAmount('')
      setAdjDescription('')
      await fetchData()
      // Reload salary details
      const salaryRes = await api.get(`/employees/${empId}/salary/${currentMonth}`).catch(() => null)
      if (salaryRes?.data?.data) setSalaryDetails(salaryRes.data.data)
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteAdjustment = async (adjustmentId, type) => {
    setActionLoading(true)
    try {
      const empId = selectedEmployee._id || selectedEmployee.id
      await api.delete(`/payroll/${empId}/adjustments/${adjustmentId}?type=${type}&month=${currentMonth}`)
      showToast('تم الحذف بنجاح', 'success')
      await fetchData()
      const salaryRes = await api.get(`/employees/${empId}/salary/${currentMonth}`).catch(() => null)
      if (salaryRes?.data?.data) setSalaryDetails(salaryRes.data.data)
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في الحذف', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleProcessPayment = async () => {
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'warning')
      return
    }
    setActionLoading(true)
    try {
      const empId = selectedEmployee._id || selectedEmployee.id
      const row = getEmployeeRow(selectedEmployee)
      const endpoint = paymentType === 'full' ? `/payroll/${empId}/pay` : `/payroll/${empId}/partial-pay`
      await api.post(endpoint, {
        month: currentMonth,
        amount,
        paymentMethod,
        note: paymentNote,
      })
      showToast('تم تسجيل الدفع بنجاح', 'success')
      setPaymentNote('')
      await fetchData()
      // Reload history
      const historyRes = await api.get(`/employees/payment-history/${currentMonth}`).catch(() => null)
      const allHistory = historyRes?.data?.data || historyRes?.data || []
      const empHistory = Array.isArray(allHistory)
        ? allHistory.filter((h) => (h.employeeId === empId || h.employee === empId || h.employeeId?._id === empId))
        : []
      setPaymentHistory(empHistory)
      // Reload salary
      const salaryRes = await api.get(`/employees/${empId}/salary/${currentMonth}`).catch(() => null)
      if (salaryRes?.data?.data) setSalaryDetails(salaryRes.data.data)
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في عملية الدفع', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleAttendanceLink = async () => {
    try {
      const newVal = !attendanceLink
      const token = localStorage.getItem('token')
      await fetch(
        (process.env.REACT_APP_API_URL || 'http://localhost:5001/api') + '/settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ key: 'payroll_attendance_link', value: newVal }),
        }
      )
      setAttendanceLink(newVal)
      showToast(newVal ? 'تم تفعيل ربط الحضور' : 'تم إلغاء ربط الحضور', 'info')
    } catch (err) {
      showToast('حدث خطأ في تغيير الإعداد', 'error')
    }
  }

  // --- Export ---

  const handleExportExcel = () => {
    const header = ['الموظف', 'القسم', 'الوظيفة', 'الراتب الأساسي', 'البدلات', 'المكافآت', 'الخصومات', 'صافي الراتب', 'المدفوع', 'المتبقي', 'الحالة']
    const rows = filteredEmployees.map((emp) => {
      const r = getEmployeeRow(emp)
      const statusLabel = r.status === 'paid' ? 'مدفوع' : r.status === 'partial' ? 'جزئي' : r.status === 'not_generated' ? 'لم يتم الحساب' : 'لم يتم الدفع'
      return [emp.name, emp.department, emp.position, r.baseSalary, r.allowances, r.bonuses, r.totalDeductions, r.netSalary, r.paid, r.remaining, statusLabel]
    })

    const csvContent = '\uFEFF' + [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll_${currentMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('تم تصدير البيانات بنجاح', 'success')
  }

  const handleExportPDF = () => {
    window.print()
  }

  // --- Status Badge ---

  const StatusBadge = ({ status }) => {
    const config = {
      paid: { label: 'مدفوع', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      partial: { label: 'جزئي', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
      pending: { label: 'لم يتم الدفع', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
      not_generated: { label: 'لم يتم الحساب', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    }
    const c = config[status] || config.not_generated
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.classes}`}>{c.label}</span>
  }

  // ====== RENDER ======

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">جاري تحميل بيانات الرواتب...</p>
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
              <DollarSign className="w-7 h-7" />
            </div>
            إدارة الرواتب والمدفوعات
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 mr-14">إدارة شاملة لرواتب الموظفين والمكافآت والخصومات</p>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">الشهر:</label>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-10 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[140px]"
            >
              <option value="all">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الموظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pr-10 pl-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Attendance Link Toggle */}
          <button
            onClick={handleToggleAttendanceLink}
            className={`flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors ${attendanceLink ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'}`}
          >
            {attendanceLink ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            ربط بالحضور
          </button>

          {/* Actions */}
          <Button
            onClick={handleGeneratePayroll}
            disabled={generating}
            className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Calculator className="w-4 h-4 ml-2" />}
            حساب رواتب الشهر
          </Button>

          <Button variant="outline" onClick={handleExportExcel} size="sm">
            <FileSpreadsheet className="w-4 h-4 ml-1" />
            Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} size="sm">
            <Printer className="w-4 h-4 ml-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* ====== STATISTICS CARDS ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-blue-700 dark:text-blue-400">إجمالي الرواتب</p><p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{formatCurrency(stats.totalSalaries)}</p><p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">{getMonthLabel(currentMonth)}</p></div><DollarSign className="w-7 h-7 text-blue-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-green-700 dark:text-green-400">المبلغ المدفوع</p><p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{formatCurrency(stats.paidAmount)}</p><p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">{stats.totalSalaries > 0 ? `${Math.round((stats.paidAmount / stats.totalSalaries) * 100)}%` : '0%'} من الإجمالي</p></div><TrendingUp className="w-7 h-7 text-green-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-red-700 dark:text-red-400">المبلغ المتبقي</p><p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">{formatCurrency(stats.remainingAmount)}</p><p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{stats.totalSalaries > 0 ? `${Math.round((stats.remainingAmount / stats.totalSalaries) * 100)}%` : '0%'} متبقي</p></div><TrendingDown className="w-7 h-7 text-red-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-purple-700 dark:text-purple-400">عدد الموظفين</p><p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">{stats.employeeCount}</p><div className="flex items-center gap-2 mt-1 text-[10px]"><span className="text-green-600">{stats.paidCount} مدفوع</span><span className="text-red-500">{stats.pendingCount} معلق</span></div></div><Users className="w-7 h-7 text-purple-500" /></div></CardContent>
        </Card>
      </div>

      {/* ====== PAYROLL TABLE ====== */}
      <Card className="overflow-hidden border border-gray-200 dark:border-gray-700">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              كشف رواتب شهر {getMonthLabel(currentMonth)}
            </CardTitle>
            <Badge variant="outline" className="text-sm px-3 py-1">
              <Users className="w-3.5 h-3.5 ml-1.5" />
              {filteredEmployees.length} موظف
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-l from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850">
                  {[
                    'الموظف',
                    'الأساسي',
                    'البدلات',
                    'المكافآت',
                    'الخصومات',
                    ...(attendanceLink ? ['خصم التأخير'] : []),
                    'الصافي',
                    'المدفوع',
                    'المتبقي',
                    'الحالة',
                    '',
                  ].map((h, i) => (
                    <th key={i} className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${i === 0 ? 'text-right' : 'text-center'} whitespace-nowrap`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={attendanceLink ? 11 : 10} className="text-center py-16 text-gray-400 dark:text-gray-500">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">لا يوجد موظفين مطابقين</p>
                      <p className="text-sm mt-1">جرب تغيير الفلتر أو البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp, index) => {
                    const row = getEmployeeRow(emp)
                    return (
                      <tr
                        key={emp._id || emp.id}
                        className={`group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                        onClick={() => openEmployeeModal(emp)}
                      >
                        {/* Employee Info */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {emp.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{emp.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{emp.department}</p>
                            </div>
                          </div>
                        </td>
                        {/* Base Salary */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(row.baseSalary)}</span>
                        </td>
                        {/* Allowances */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-semibold font-mono">
                            <TrendingUp className="w-3 h-3" />
                            {formatCurrency(row.allowances)}
                          </span>
                        </td>
                        {/* Bonuses */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold font-mono ${row.bonuses > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {row.bonuses > 0 && <Plus className="w-3 h-3" />}
                            {formatCurrency(row.bonuses)}
                          </span>
                        </td>
                        {/* Deductions */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold font-mono ${(row.fixedDeductions + row.manualDeductions) > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            <TrendingDown className="w-3 h-3" />
                            {formatCurrency(row.fixedDeductions + row.manualDeductions)}
                          </span>
                        </td>
                        {/* Lateness */}
                        {attendanceLink && (
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-semibold font-mono">
                              <Clock className="w-3 h-3" />
                              {formatCurrency(row.latenessDeduction)}
                            </span>
                          </td>
                        )}
                        {/* Net Salary */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">{formatCurrency(row.netSalary)}</span>
                        </td>
                        {/* Paid */}
                        <td className="px-4 py-4 text-center">
                          <span className={`font-mono text-xs font-semibold ${row.paid > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>{formatCurrency(row.paid)}</span>
                        </td>
                        {/* Remaining */}
                        <td className="px-4 py-4 text-center">
                          <span className={`font-mono text-xs font-semibold ${row.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(row.remaining)}</span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <StatusBadge status={row.status} />
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEmployeeModal(emp)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full w-8 h-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ====== EMPLOYEE DETAILS MODAL (Slide-over) ====== */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 flex justify-start" style={{zIndex: 200}} dir="rtl">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto animate-slide-in-right" style={{marginTop: '0', height: '100vh'}}>
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-l from-blue-600 to-blue-700 text-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedEmployee.name}</h2>
                  <p className="text-blue-100 text-sm mt-0.5">{selectedEmployee.department} - {selectedEmployee.position}</p>
                  <p className="text-blue-200 text-xs mt-0.5">{selectedEmployee.employeeNumber}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                {[
                  { key: 'breakdown', label: 'تفاصيل الراتب', icon: DollarSign },
                  { key: 'adjustment', label: 'مكافآت وخصومات', icon: Plus },
                  { key: 'payment', label: 'الدفع', icon: CreditCard },
                  { key: 'history', label: 'السجل', icon: Clock },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setModalTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      modalTab === key
                        ? 'bg-white/20 text-white'
                        : 'text-blue-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {modalLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* ===== BREAKDOWN TAB ===== */}
                  {modalTab === 'breakdown' && (() => {
                    const row = getEmployeeRow(selectedEmployee)
                    const sd = salaryDetails?.salaryCalculation || salaryDetails || {}
                    const bonusesList = sd.bonusesBreakdown || sd.bonuses || []
                    const deductionsList = sd.deductionsBreakdown?.adjustments || sd.manualDeductions || sd.deductions || []

                    const handleSaveSalary = async () => {
                      setSavingSalary(true);
                      try {
                        await api.put(`/employees/${selectedEmployee._id || selectedEmployee.id}`, {
                          baseSalary: Number(salaryForm.baseSalary),
                          allowances: {
                            transportation: Number(salaryForm.transportation),
                            housing: Number(salaryForm.housing),
                            meal: Number(salaryForm.meal),
                          },
                          deductions: {
                            socialInsurance: Number(salaryForm.socialInsurance),
                            tax: Number(salaryForm.tax),
                          },
                        });
                        showToast('تم حفظ التعديلات بنجاح', 'success');
                        setEditingSalary(false);
                        fetchData();
                      } catch (err) {
                        showToast('خطأ في حفظ التعديلات', 'error');
                      }
                      setSavingSalary(false);
                    };

                    return (
                      <div className="space-y-3">
                        {/* Edit Toggle */}
                        <div className="flex justify-end">
                          {!editingSalary ? (
                            <button onClick={() => setEditingSalary(true)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> تعديل</button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={handleSaveSalary} disabled={savingSalary} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center gap-1">{savingSalary ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} حفظ</button>
                              <button onClick={() => setEditingSalary(false)} className="text-xs text-gray-500 px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">إلغاء</button>
                            </div>
                          )}
                        </div>

                        {/* Salary Summary Table */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                          {/* Base Salary */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">الراتب الأساسي</span>
                            {editingSalary ? <Input type="number" value={salaryForm.baseSalary} onChange={(e) => setSalaryForm({...salaryForm, baseSalary: e.target.value})} className="w-28 h-8 text-sm bg-white dark:bg-gray-800" /> : <span className="text-lg font-bold text-gray-900 dark:text-white font-mono" dir="ltr">{formatCurrency(row.baseSalary)}</span>}
                          </div>

                          {/* Allowances */}
                          <div className="border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10">
                              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">البدلات</span>
                            </div>
                            {[
                              { label: 'بدل المواصلات', key: 'transportation', value: selectedEmployee.allowances?.transportation },
                              { label: 'بدل السكن', key: 'housing', value: selectedEmployee.allowances?.housing },
                              { label: 'بدل الطعام', key: 'meal', value: selectedEmployee.allowances?.meal },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0">
                                <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                                {editingSalary ? <Input type="number" value={salaryForm[item.key]} onChange={(e) => setSalaryForm({...salaryForm, [item.key]: e.target.value})} className="w-28 h-7 text-sm bg-white dark:bg-gray-800" /> : <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-semibold">+{formatCurrency(item.value || 0)}</span>}
                              </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2 bg-blue-50/50 dark:bg-blue-900/5">
                              <span className="text-xs font-bold text-blue-800 dark:text-blue-300">إجمالي البدلات</span>
                              <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-300">+{formatCurrency(editingSalary ? (Number(salaryForm.transportation) + Number(salaryForm.housing) + Number(salaryForm.meal)) : row.allowances)}</span>
                            </div>
                          </div>

                          {/* Deductions */}
                          <div className="border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10">
                              <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                              <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">الاستقطاعات</span>
                            </div>
                            {[
                              { label: 'التأمينات الاجتماعية', key: 'socialInsurance', value: selectedEmployee.deductions?.socialInsurance },
                              { label: 'الضريبة', key: 'tax', value: selectedEmployee.deductions?.tax },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0">
                                <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                                {editingSalary ? <Input type="number" value={salaryForm[item.key]} onChange={(e) => setSalaryForm({...salaryForm, [item.key]: e.target.value})} className="w-28 h-7 text-sm bg-white dark:bg-gray-800" /> : <span className="font-mono text-sm text-red-600 dark:text-red-400 font-semibold">-{formatCurrency(item.value || 0)}</span>}
                              </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2 bg-red-50/50 dark:bg-red-900/5">
                              <span className="text-xs font-bold text-red-800 dark:text-red-300">إجمالي الاستقطاعات</span>
                              <span className="font-mono text-sm font-bold text-red-700 dark:text-red-300">-{formatCurrency(editingSalary ? (Number(salaryForm.socialInsurance) + Number(salaryForm.tax)) : row.fixedDeductions)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Monthly Bonuses */}
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                          <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> المكافآت الشهرية
                          </h3>
                          {Array.isArray(bonusesList) && bonusesList.length > 0 ? (
                            <div className="space-y-2">
                              {bonusesList.map((b, i) => (
                                <div key={b._id || i} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded-lg">
                                  <div>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{b.category || b.description || 'مكافأة'}</span>
                                    {b.description && b.category && <p className="text-xs text-gray-500 dark:text-gray-400">{b.description}</p>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(b.amount)}</span>
                                    <button
                                      onClick={() => handleDeleteAdjustment(b._id || b.id, 'bonus')}
                                      disabled={actionLoading}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد مكافآت لهذا الشهر</p>
                          )}
                        </div>

                        {/* Monthly Deductions */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                          <h3 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <TrendingDown className="w-3.5 h-3.5" /> الخصومات الشهرية
                          </h3>
                          {Array.isArray(deductionsList) && deductionsList.length > 0 ? (
                            <div className="space-y-2">
                              {deductionsList.map((d, i) => (
                                <div key={d._id || i} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded-lg">
                                  <div>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{d.category || d.description || 'خصم'}</span>
                                    {d.description && d.category && <p className="text-xs text-gray-500 dark:text-gray-400">{d.description}</p>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-600 dark:text-red-400 font-medium">- {formatCurrency(d.amount)}</span>
                                    <button
                                      onClick={() => handleDeleteAdjustment(d._id || d.id, 'deduction')}
                                      disabled={actionLoading}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد خصومات إضافية لهذا الشهر</p>
                          )}
                        </div>

                        {/* Lateness Deduction */}
                        {attendanceLink && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> خصم التأخير والغياب
                            </h3>
                            <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">- {formatCurrency(row.latenessDeduction)}</p>
                          </div>
                        )}

                        {/* Net Salary Summary */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-green-700 dark:text-green-400">صافي الراتب</span>
                            <span className="text-2xl font-black text-green-700 dark:text-green-300 font-mono" dir="ltr">{formatCurrency(row.netSalary)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-xs text-green-600 dark:text-green-400">
                            <span>المدفوع: {formatCurrency(row.paid)}</span>
                            <span>المتبقي: {formatCurrency(row.remaining)}</span>
                          </div>
                          <div className="mt-3 w-full bg-green-200 dark:bg-green-800 rounded-full h-1.5">
                            <div
                              className="bg-green-600 rounded-full h-1.5 transition-all"
                              style={{ width: `${row.netSalary > 0 ? Math.min(100, (row.paid / row.netSalary) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ===== ADJUSTMENT TAB ===== */}
                  {modalTab === 'adjustment' && (
                    <div className="space-y-5">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">إضافة مكافأة أو خصم</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Type Selector */}
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300 mb-2 block">النوع</Label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAdjType('bonus')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                                  adjType === 'bonus'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-2 ring-green-500'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                <Plus className="w-4 h-4 inline ml-1" /> مكافأة
                              </button>
                              <button
                                onClick={() => setAdjType('deduction')}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                                  adjType === 'deduction'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-2 ring-red-500'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                <TrendingDown className="w-4 h-4 inline ml-1" /> خصم
                              </button>
                            </div>
                          </div>

                          {/* Category */}
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300 mb-2 block">التصنيف</Label>
                            <Input
                              value={adjCategory}
                              onChange={(e) => setAdjCategory(e.target.value)}
                              placeholder={adjType === 'bonus' ? 'مثال: مكافأة أداء' : 'مثال: غياب بدون إذن'}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>

                          {/* Amount */}
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300 mb-2 block">المبلغ</Label>
                            <Input
                              type="number"
                              value={adjAmount}
                              onChange={(e) => setAdjAmount(e.target.value)}
                              placeholder="0"
                              min="0"
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300 mb-2 block">الوصف (اختياري)</Label>
                            <Textarea
                              value={adjDescription}
                              onChange={(e) => setAdjDescription(e.target.value)}
                              placeholder="تفاصيل إضافية..."
                              rows={2}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                          </div>

                          <Button
                            onClick={handleAddAdjustment}
                            disabled={actionLoading || !adjCategory || !adjAmount}
                            className={adjType === 'bonus' ? 'w-full bg-green-600 hover:bg-green-700 text-white' : 'w-full bg-red-600 hover:bg-red-700 text-white'}
                          >
                            {actionLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin ml-2" />
                            ) : adjType === 'bonus' ? (
                              <Plus className="w-4 h-4 ml-2" />
                            ) : (
                              <TrendingDown className="w-4 h-4 ml-2" />
                            )}
                            {adjType === 'bonus' ? 'إضافة مكافأة' : 'إضافة خصم'}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* ===== PAYMENT TAB ===== */}
                  {modalTab === 'payment' && (() => {
                    const row = getEmployeeRow(selectedEmployee)
                    return (
                      <div className="space-y-5">
                        {/* Payment Status */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500 dark:text-gray-400">حالة الدفع</span>
                            <StatusBadge status={row.status} />
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">صافي الراتب</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(row.netSalary)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">المدفوع</p>
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(row.paid)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">المتبقي</p>
                              <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(row.remaining)}</p>
                            </div>
                          </div>
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">تسجيل دفعة</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Payment Type */}
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">نوع الدفع</Label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setPaymentType('full')
                                    setPaymentAmount(String(row.remaining > 0 ? row.remaining : row.netSalary))
                                  }}
                                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    paymentType === 'full'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  <Banknote className="w-4 h-4 inline ml-1" /> دفع كامل
                                </button>
                                <button
                                  onClick={() => {
                                    setPaymentType('partial')
                                    setPaymentAmount('')
                                  }}
                                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                                    paymentType === 'partial'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-2 ring-yellow-500'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  <CreditCard className="w-4 h-4 inline ml-1" /> دفع جزئي
                                </button>
                              </div>
                            </div>

                            {/* Amount */}
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">المبلغ</Label>
                              <Input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              />
                            </div>

                            {/* Payment Method */}
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">طريقة الدفع</Label>
                              <div className="flex gap-2">
                                {['كاش', 'تحويل بنكي', 'شيك'].map((method) => (
                                  <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                      paymentMethod === method
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                                    }`}
                                  >
                                    {method}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Notes */}
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">ملاحظات (اختياري)</Label>
                              <Textarea
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                                placeholder="ملاحظات إضافية..."
                                rows={2}
                                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                              />
                            </div>

                            <Button
                              onClick={handleProcessPayment}
                              disabled={actionLoading || !paymentAmount || Number(paymentAmount) <= 0}
                              className="w-full bg-gradient-to-l from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md"
                            >
                              {actionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                              ) : (
                                <CheckCircle className="w-4 h-4 ml-2" />
                              )}
                              تأكيد الدفع - {formatCurrency(paymentAmount)}
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })()}

                  {/* ===== HISTORY TAB ===== */}
                  {modalTab === 'history' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        سجل المدفوعات
                      </h3>

                      {paymentHistory.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>لا توجد مدفوعات مسجلة لهذا الشهر</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {paymentHistory.map((payment, idx) => (
                            <div
                              key={payment._id || idx}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(payment.amount)}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {payment.createdAt || payment.date
                                    ? new Date(payment.createdAt || payment.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{payment.paymentMethod || payment.method || '-'}</span>
                                {(payment.note || payment.notes) && (
                                  <span className="truncate">{payment.note || payment.notes}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== PRINT STYLES ====== */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-6, .space-y-6 * { visibility: visible; }
          .space-y-6 { position: absolute; left: 0; top: 0; width: 100%; }
          button, .fixed { display: none !important; }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
      `}</style>
    </div>
  )
}

export default PayrollPage
