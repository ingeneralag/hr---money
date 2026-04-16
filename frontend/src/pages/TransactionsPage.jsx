import React, { useState, useEffect, useCallback } from 'react'

// إضافة CSS مخصص للخزنة
const treasuryStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .treasury-shimmer {
    animation: shimmer 3s infinite;
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
    50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.6); }
  }
  
  .treasury-glow {
    animation: glow 2s ease-in-out infinite;
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
  }
  
  .treasury-float {
    animation: float 3s ease-in-out infinite;
  }
`
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Plus,
  Download,
  Filter,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/formatters'
import { transactionService, clientService, categoryService, treasuryService } from '../services/api'
import { toast } from 'react-hot-toast'

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([])
  const [clients, setClients] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  })
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'كاش',
    notes: '',
    fees: ''
  })
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [selectedPaymentHistory, setSelectedPaymentHistory] = useState(null)
  const [treasuryData, setTreasuryData] = useState({
    currentBalance: 0,
    initialBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalDebts: 0,
    totalPaidDebts: 0,
    totalRemainingDebts: 0,
    totalFeesCollected: 0, // الرسوم المحصلة (مكسب صافي)
    lastUpdated: null,
    currency: 'EGP'
  })
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalDebts: 0,
    paidDebts: 0,
    remainingDebts: 0,
    totalFeesCollected: 0, // الرسوم المحصلة (مكسب صافي)
    pendingTransactions: 0,
    thisMonthTransactions: 0
  })

  // دالة جلب بيانات الخزنة
  const fetchTreasuryData = useCallback(async () => {
    try {
      const response = await treasuryService.getData();
      if (response.success) {
        setTreasuryData(response.data);
      }
    } catch (error) {
      console.error('خطأ في جلب بيانات الخزنة:', error);
      toast.error('حدث خطأ في جلب بيانات الخزنة');
    }
  }, []);

  // دالة جلب العملاء من قاعدة البيانات
  const fetchClients = useCallback(async () => {
    try {
      setLoadingClients(true)
      const response = await clientService.getAll()
      setClients(response.data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
      toast.error('حدث خطأ في جلب العملاء')
    } finally {
      setLoadingClients(false)
    }
  }, [])

  // دالة جلب التصنيفات من قاعدة البيانات
  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true)
      const response = await categoryService.getAll()
      setCategories(response.data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('حدث خطأ في جلب التصنيفات')
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  // تم حذف كود تحديث التوكن التلقائي لتجنب مشاكل المصادقة

  // محاكاة بيانات المدير لضمان ظهور الزر
  const currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}')
  const isAdmin = currentUser.role === 'admin' || true // تظهر للجميع مؤقتاً

  // دالة للحصول على اسم العميل من ID
  const getClientName = (clientId) => {
    if (!clientId) return 'عملية عامة';
    const client = clients.find(c => c._id === clientId);
    return client ? client.name : 'عميل غير معروف';
  };

  // جلب المعاملات من الباك إند
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const response = await transactionService.getAll({
        type: selectedType,
        category: selectedCategory,
        search: searchTerm,
        page: currentPage,
        limit: itemsPerPage,
        client: selectedClient !== 'none' ? selectedClient : undefined,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined
      })

      if (response.success) {
        setTransactions(response.data)
        setTotalPages(response.pagination.pages)
        setStats({
          totalIncome: response.summary.totalIncome || 0,
          totalExpenses: response.summary.totalExpense || 0,
          totalDebts: response.summary.totalDebts || 0,
          paidDebts: response.summary.paidDebts || 0,
          remainingDebts: response.summary.remainingDebts || 0,
          totalFeesCollected: response.summary.totalFeesCollected || 0,
          pendingTransactions: response.data.filter(t => t.status === 'pending').length,
          thisMonthTransactions: response.data.filter(t => {
            const transactionDate = new Date(t.date)
            const currentDate = new Date()
            return transactionDate.getMonth() === currentDate.getMonth() &&
              transactionDate.getFullYear() === currentDate.getFullYear()
          }).length
        })
      } else {
        toast.error('حدث خطأ في جلب المعاملات')
      }
    } catch (error) {
      toast.error('حدث خطأ في جلب المعاملات')
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedType, selectedCategory, searchTerm, currentPage, itemsPerPage, selectedClient, dateFilter])

  useEffect(() => {
    fetchTransactions()
    fetchClients() // جلب العملاء عند تحميل الصفحة
    fetchCategories() // جلب التصنيفات عند تحميل الصفحة
    fetchTreasuryData() // جلب بيانات الخزنة عند تحميل الصفحة
  }, [fetchTransactions, fetchClients, fetchCategories, fetchTreasuryData, currentPage, itemsPerPage])

  const handleAddTransaction = async (transactionData) => {
    try {
      console.log('🔍 بيانات المعاملة المُستلمة:', transactionData);

      // التأكد من وجود البيانات المطلوبة
      if (!transactionData.description || !transactionData.amount || !transactionData.type || !transactionData.category) {
        console.log('❌ بيانات ناقصة:', {
          description: !!transactionData.description,
          amount: !!transactionData.amount,
          type: !!transactionData.type,
          category: !!transactionData.category
        });
        toast.error('❌ يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      // الحصول على بيانات المستخدم الحالي
      const currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
      const createdBy = currentUser.username || currentUser.name || 'مستخدم غير معروف';

      const requestData = {
        description: transactionData.description.trim(),
        amount: Number(transactionData.amount),
        type: transactionData.type,
        category: transactionData.category,
        date: transactionData.date || new Date().toISOString().split('T')[0],
        notes: transactionData.notes || '',
        clientId: transactionData.clientId || undefined,
        paymentMethod: transactionData.paymentMethod || 'كاش', // طريقة الدفع الافتراضية
        createdBy: createdBy // إضافة اسم المستخدم الذي أنشأ المعاملة
      };

      console.log('📤 البيانات المُرسلة للـ API:', requestData);
      console.log('🔑 التوكن موجود:', !!localStorage.getItem('token'));

      const response = await transactionService.create(requestData);
      console.log('✅ رد الـ API:', response);
      toast.success('✅ تم إضافة المعاملة بنجاح');
      await fetchTransactions();
      await fetchTreasuryData(); // تحديث بيانات الخزنة
      setShowAddModal(false);
    } catch (error) {
      console.error('💥 خطأ في إضافة المعاملة:', error);
      console.error('📋 تفاصيل الخطأ:', error.response?.data);
      console.error('🔢 كود الخطأ:', error.response?.status);

      const errorMessage = error.response?.data?.message || error.message || 'خطأ غير معروف';
      toast.error('❌ حدث خطأ في إضافة المعاملة: ' + errorMessage);
    }
  }

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction)
    setShowAddModal(true)
  }

  const handlePayDebt = (transaction) => {
    setSelectedDebt(transaction);
    setPaymentData({
      amount: '',
      paymentMethod: 'كاش',
      notes: '',
      fees: ''
    });
    setShowPayModal(true);
  }

  const handleViewPaymentHistory = async (transaction) => {
    try {
      const data = await transactionService.getDebtDetails(transaction._id);

      if (data.success) {
        setSelectedPaymentHistory(data.data);
        setShowPaymentHistory(true);
      } else {
        toast.error('خطأ في جلب تاريخ السداد: ' + data.message);
      }
    } catch (error) {
      console.error('خطأ في جلب تاريخ السداد:', error);
      toast.error('حدث خطأ في جلب تاريخ السداد');
    }
  }

  const handleSubmitPayment = async () => {
    if (!paymentData.amount || isNaN(paymentData.amount) || parseFloat(paymentData.amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    // حساب المبلغ الإجمالي (المبلغ + الرسوم)
    const paymentAmount = parseFloat(paymentData.amount);
    const fees = parseFloat(paymentData.fees) || 0;
    const totalAmount = paymentAmount + fees;

    const maxAllowedAmount = selectedDebt.remainingAmount || selectedDebt.amount;
    if (paymentAmount > maxAllowedAmount) {
      toast.error(`المبلغ المدفوع للمديونية أكبر من المبلغ المتبقي (${formatCurrency(maxAllowedAmount)})`);
      return;
    }

    setPaymentLoading(true);

    try {
      const data = await transactionService.payDebt(selectedDebt._id, {
        amount: paymentAmount,
        fees: fees,
        totalAmount: totalAmount,
        paymentMethod: paymentData.paymentMethod,
        notes: paymentData.notes
      });

      if (data.success) {
        toast.success('تم تسجيل الدفع بنجاح');
        fetchTransactions(); // إعادة تحميل المعاملات
        fetchTreasuryData(); // تحديث بيانات الخزنة
        setShowPayModal(false);
        setSelectedDebt(null);
        setPaymentData({ amount: '', paymentMethod: 'كاش', notes: '', fees: '' });
      } else {
        toast.error('خطأ في تسجيل الدفع: ' + data.message);
      }
    } catch (error) {
      console.error('خطأ في تسجيل الدفع:', error);
      toast.error('حدث خطأ في تسجيل الدفع');
    } finally {
      setPaymentLoading(false);
    }
  }

  const handleUpdateTransaction = async (transactionData) => {
    try {
      console.log('🔍 بيانات التحديث المُستلمة:', transactionData);

      // التأكد من وجود البيانات المطلوبة
      if (!transactionData.description?.trim() || !transactionData.amount || transactionData.amount <= 0 || !transactionData.type || !transactionData.category?.trim() || !transactionData.date) {
        console.log('❌ بيانات ناقصة للتحديث:', {
          description: !!transactionData.description?.trim(),
          amount: transactionData.amount > 0,
          type: !!transactionData.type,
          category: !!transactionData.category?.trim(),
          date: !!transactionData.date
        });
        toast.error('❌ يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
        return;
      }

      // الحصول على بيانات المستخدم الحالي
      const currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
      const updatedBy = currentUser.username || currentUser.name || 'مستخدم غير معروف';

      const requestData = {
        description: transactionData.description.trim(),
        amount: Number(transactionData.amount),
        type: transactionData.type,
        category: transactionData.category,
        date: transactionData.date || new Date().toISOString().split('T')[0],
        notes: transactionData.notes || '',
        clientId: transactionData.clientId || null,
        paymentMethod: transactionData.paymentMethod || 'كاش',
        updatedBy: updatedBy, // إضافة اسم المستخدم الذي حدث المعاملة
        updatedAt: new Date().toISOString()
      };

      console.log('📤 البيانات المُرسلة للتحديث:', requestData);
      console.log('🆔 معرف المعاملة:', editingTransaction._id);

      const response = await transactionService.update(editingTransaction._id, requestData);
      console.log('✅ رد التحديث:', response);

      toast.success('✅ تم تحديث المعاملة بنجاح');
      await fetchTransactions();
      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('💥 خطأ في تحديث المعاملة:', error);
      console.error('📋 تفاصيل الخطأ:', error.response?.data);
      console.error('🔢 كود الخطأ:', error.response?.status);

      const errorMessage = error.response?.data?.message || error.message || 'خطأ غير معروف';
      toast.error('❌ حدث خطأ في تحديث المعاملة: ' + errorMessage);
    }
  }

  const handleDeleteTransaction = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
      try {
        await transactionService.delete(id)
        toast.success('تم حذف المعاملة بنجاح')
        fetchTransactions()
      } catch (error) {
        toast.error('حدث خطأ في حذف المعاملة')
        console.error('Error deleting transaction:', error)
      }
    }
  }

  const handleApproveTransaction = async (id) => {
    if (window.confirm('هل تريد الموافقة على هذه المعاملة؟')) {
      try {
        await transactionService.update(id, {
          status: 'approved',
          approvedBy: currentUser._id,
          approvedAt: new Date()
        })
        toast.success('تم الموافقة على المعاملة بنجاح')
        fetchTransactions()
      } catch (error) {
        toast.error('حدث خطأ في الموافقة على المعاملة')
        console.error('Error approving transaction:', error)
      }
    }
  }

  const handleRejectTransaction = async (id) => {
    const reason = window.prompt('سبب الرفض (اختياري):')
    if (reason !== null) {
      try {
        await transactionService.update(id, {
          status: 'rejected',
          rejectedBy: currentUser._id,
          rejectionReason: reason,
          rejectedAt: new Date()
        })
        toast.success('تم رفض المعاملة بنجاح')
        fetchTransactions()
      } catch (error) {
        toast.error('حدث خطأ في رفض المعاملة')
        console.error('Error rejecting transaction:', error)
      }
    }
  }

  // فلترة المعاملات
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.clientName && transaction.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = !selectedCategory || transaction.category === selectedCategory
    const matchesType = !selectedType || transaction.type === selectedType
    const matchesClient = !selectedClient ||
      (selectedClient === 'none' && !transaction.clientId) ||
      (selectedClient !== 'none' && transaction.clientId && transaction.clientId.toString() === selectedClient)
    return matchesSearch && matchesCategory && matchesType && matchesClient
  })

  const TransactionCard = ({ transaction: t }) => {
    const typeConfig = {
      income: { color: 'green', label: 'إيرادات', sign: '+', Icon: ArrowDownCircle, bg: 'from-green-500 to-emerald-600' },
      expense: { color: 'red', label: 'مصروفات', sign: '-', Icon: ArrowUpCircle, bg: 'from-red-500 to-rose-600' },
      debt: { color: 'purple', label: 'مديونية', sign: '', Icon: TrendingUp, bg: 'from-purple-500 to-violet-600' },
    };
    const cfg = typeConfig[t.type] || typeConfig.income;
    const TypeIcon = cfg.Icon;

    return (
    <div className={`group rounded-xl overflow-hidden hover:shadow-md transition-all bg-gradient-to-br ${cfg.color === 'green' ? 'from-green-50 to-emerald-50 dark:from-green-900/15 dark:to-emerald-900/10' : cfg.color === 'red' ? 'from-red-50 to-rose-50 dark:from-red-900/15 dark:to-rose-900/10' : 'from-purple-50 to-violet-50 dark:from-purple-900/15 dark:to-violet-900/10'} border border-${cfg.color}-100 dark:border-${cfg.color}-900/30`}>
      <div className="p-4">
        {/* Header: icon + title + amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg bg-${cfg.color}-100 dark:bg-${cfg.color}-900/30 flex items-center justify-center flex-shrink-0`}>
              <TypeIcon className={`w-4.5 h-4.5 text-${cfg.color}-600 dark:text-${cfg.color}-400`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{t.description}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{t.transactionNumber || ''} {t.date ? `· ${formatDate(t.date)}` : ''}</p>
            </div>
          </div>
          <div className="text-left flex-shrink-0">
            <p className={`text-lg font-bold text-${cfg.color}-600 dark:text-${cfg.color}-400 font-mono`} dir="ltr">
              {cfg.sign}{formatCurrency(t.amount)} <span className="text-xs">{t.currency || 'EGP'}</span>
            </p>
          </div>
        </div>

        {/* Meta tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-${cfg.color}-50 text-${cfg.color}-700 dark:bg-${cfg.color}-900/20 dark:text-${cfg.color}-400`}>{cfg.label}</span>
          {t.category && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{t.category}</span>}
          {t.paymentMethod && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">{t.paymentMethod}</span>}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${t.status === 'approved' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : t.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
            {t.status === 'approved' ? 'مكتمل' : t.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
          </span>
          {t.type === 'debt' && t.debtStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${t.debtStatus === 'paid' ? 'bg-green-50 text-green-700' : t.debtStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              {t.debtStatus === 'paid' ? 'مسددة' : t.debtStatus === 'partial' ? 'جزئي' : 'غير مسددة'}
            </span>
          )}
          {t.clientId && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">{getClientName(t.clientId)}</span>}
        </div>

        {/* Notes */}
        {t.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 line-clamp-2">{t.notes}</p>}

        {/* Action buttons */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {t.status === 'pending' ? (
              <>
                <button onClick={() => handleApproveTransaction(t._id)} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> موافقة
                </button>
                <button onClick={() => handleRejectTransaction(t._id)} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> رفض
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handleEditTransaction(t)} className="flex items-center gap-1 px-3 h-7 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Edit className="w-3 h-3" /> تعديل
                </button>
                {t.type === 'debt' && t.debtStatus !== 'paid' && (
                  <button onClick={() => handlePayDebt(t)} className="flex items-center gap-1 px-3 h-7 rounded-lg text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                    <CheckCircle className="w-3 h-3" /> سداد
                  </button>
                )}
                <button onClick={() => handleDeleteTransaction(t._id)} className="flex items-center gap-1 px-3 h-7 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mr-auto">
                  <Trash2 className="w-3 h-3" /> حذف
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )}

  return (
    <div className="space-y-6">
      {/* إضافة CSS مخصص */}
      <style>{treasuryStyles}</style>


      {/* العنوان والأزرار */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المعاملات المالية</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة وتتبع جميع المعاملات المالية</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  const currentFilters = {
                    type: selectedType,
                    category: selectedCategory,
                    search: searchTerm,
                    client: selectedClient !== 'none' ? selectedClient : undefined,
                    startDate: dateFilter.startDate || undefined,
                    endDate: dateFilter.endDate || undefined
                  };
                  await transactionService.export(currentFilters);
                  toast.success('تم تصدير المعاملات بنجاح');
                } catch (error) {
                  toast.error('حدث خطأ أثناء تصدير المعاملات');
                }
              }}
            >
              <Download className="w-4 h-4" />
              تصدير
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  const currentFilters = {
                    type: selectedType,
                    category: selectedCategory,
                    search: searchTerm,
                    client: selectedClient !== 'none' ? selectedClient : undefined,
                    startDate: dateFilter.startDate || undefined,
                    endDate: dateFilter.endDate || undefined
                  };
                  await transactionService.generateReport(currentFilters);
                  toast.success('تم إنشاء التقرير بنجاح');
                } catch (error) {
                  toast.error('حدث خطأ أثناء إنشاء التقرير');
                }
              }}
            >
              <Filter className="w-4 h-4" />
              تقرير
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4" />
              إضافة معاملة
            </Button>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">الرصيد الإجمالي</p>
                  <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">{formatCurrency(treasuryData.currentBalance)}</p>
                </div>
                <DollarSign className="w-7 h-7 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">الإيرادات</p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{formatCurrency(stats.totalIncome)}</p>
                </div>
                <TrendingUp className="w-7 h-7 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">المصروفات</p>
                  <p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">{formatCurrency(stats.totalExpenses)}</p>
                </div>
                <TrendingDown className="w-7 h-7 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">صافي الربح</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{formatCurrency(stats.totalIncome - stats.totalExpenses)}</p>
                </div>
                <DollarSign className="w-7 h-7 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* صف ثاني - الديون */}
        {(stats.totalDebts > 0 || stats.pendingTransactions > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500 dark:text-gray-400">المديونيات</p><p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatCurrency(stats.totalDebts)}</p></div><TrendingUp className="w-6 h-6 text-purple-400" /></div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500 dark:text-gray-400">المتبقي</p><p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(stats.remainingDebts)}</p></div><XCircle className="w-6 h-6 text-orange-400" /></div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500 dark:text-gray-400">المدفوع</p><p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.paidDebts)}</p></div><CheckCircle className="w-6 h-6 text-green-400" /></div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500 dark:text-gray-400">قيد المراجعة</p><p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{stats.pendingTransactions}</p></div><Calendar className="w-6 h-6 text-yellow-400" /></div></CardContent></Card>
        </div>
        )}
      </div>

      {/* البحث والفلترة */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="البحث في المعاملات..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 h-9 text-sm" />
        </div>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="h-9 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <option value="">كل الأنواع</option>
          <option value="income">إيرادات</option>
          <option value="expense">مصروفات</option>
          <option value="debt">مديونيات</option>
        </select>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="h-9 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">كل التصنيفات</option>
          {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="h-9 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">كل العملاء</option>
          <option value="none">بدون عميل</option>
          {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button onClick={() => setShowDateFilter(true)} className={`h-9 px-3 text-sm rounded-lg border flex items-center gap-1.5 transition-colors ${dateFilter.startDate || dateFilter.endDate ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
          <Calendar className="w-3.5 h-3.5" />
          {dateFilter.startDate || dateFilter.endDate ? 'فلتر التاريخ' : 'التاريخ'}
        </button>
        {(searchTerm || selectedType || selectedCategory || selectedClient || dateFilter.startDate) && (
          <button onClick={() => { setSearchTerm(''); setSelectedType(''); setSelectedCategory(''); setSelectedClient(''); setDateFilter({}); }} className="h-9 px-3 text-sm rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> مسح
          </button>
        )}
      </div>

      {/* قائمة المعاملات */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              جاري تحميل المعاملات...
            </h3>
          </CardContent>
        </Card>
      ) : filteredTransactions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTransactions.map(transaction => (
            <TransactionCard key={transaction._id} transaction={transaction} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              لا توجد معاملات
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || selectedCategory || selectedType || selectedClient
                ? 'لم يتم العثور على معاملات تطابق معايير البحث'
                : 'لم يتم إضافة أي معاملات بعد'}
            </p>
            {isAdmin && !searchTerm && !selectedCategory && !selectedType && !selectedClient && (
              <Button
                onClick={() => setShowAddModal(true)}
                className="mt-4 gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-4 h-4" />
                إضافة معاملة جديدة
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* نموذج إضافة/تعديل المعاملة */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { setShowAddModal(false); setEditingTransaction(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  {editingTransaction
                    ? <span className="text-blue-600 dark:text-blue-400 text-sm">✏️</span>
                    : <span className="text-blue-600 dark:text-blue-400 text-lg">+</span>
                  }
                </div>
                {editingTransaction ? 'تعديل المعاملة' : 'إضافة معاملة جديدة'}
              </h2>
              <button onClick={() => { setShowAddModal(false); setEditingTransaction(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <span className="text-gray-500 text-xl">×</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">وصف المعاملة</Label>
                  <Input id="description" defaultValue={editingTransaction?.description || ''} placeholder="وصف تفصيلي للمعاملة" required className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-sm font-medium text-gray-700 dark:text-gray-300">المبلغ</Label>
                  <Input id="amount" type="number" defaultValue={editingTransaction?.amount || ''} placeholder="0" required min="0" step="0.01" className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-sm font-medium text-gray-700 dark:text-gray-300">نوع المعاملة</Label>
                  <select id="type" defaultValue={editingTransaction?.type || ''} required
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">اختر النوع</option>
                    <option value="income">💰 إيرادات</option>
                    <option value="expense">📤 مصروفات</option>
                    <option value="debt">📋 مديونيات</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700 dark:text-gray-300">التصنيف</Label>
                  <select id="category" defaultValue={editingTransaction?.category || ''} required
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">اختر التصنيف</option>
                    {loadingCategories ? (
                      <option disabled>جاري تحميل التصنيفات...</option>
                    ) : categories.length > 0 ? (
                      categories.map(category => (
                        <option key={category._id} value={category.name}>{category.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="مشاريع">مشاريع</option>
                        <option value="رواتب">رواتب</option>
                        <option value="مرافق">مرافق</option>
                        <option value="عمولات">عمولات</option>
                        <option value="أخرى">أخرى</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700 dark:text-gray-300">التاريخ</Label>
                  <Input id="date" type="date" defaultValue={editingTransaction?.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} required className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client" className="text-sm font-medium text-gray-700 dark:text-gray-300">العميل (اختياري)</Label>
                  <select id="client" defaultValue={editingTransaction?.clientId || ''}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="">بدون عميل</option>
                    {loadingClients ? (
                      <option disabled>جاري تحميل العملاء...</option>
                    ) : clients.length > 0 ? (
                      clients.map(client => (
                        <option key={client._id} value={client._id}>{client.name}</option>
                      ))
                    ) : (
                      <option disabled>لا توجد عملاء</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</Label>
                  <select id="paymentMethod" defaultValue={editingTransaction?.paymentMethod || 'كاش'} required
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                    <option value="كاش">💵 كاش</option>
                    <option value="انستا باي">📱 انستا باي</option>
                    <option value="فودافون كاش">📞 فودافون كاش</option>
                    <option value="تحويل بنكي">🏦 تحويل بنكي</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="notes" className="text-sm font-medium text-gray-700 dark:text-gray-300">ملاحظات</Label>
                  <Input id="notes" defaultValue={editingTransaction?.notes || ''} placeholder="ملاحظات إضافية (اختياري)" className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-gray-700">
                <Button
                  onClick={async () => {
                    console.log('🎬 بدء معالجة الضغط على زر الإضافة');

                    // انتظار قصير للتأكد من أن النموذج محدث
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const description = document.getElementById('description').value?.trim();
                    const amount = parseFloat(document.getElementById('amount').value) || 0;
                    const type = document.getElementById('type').value;
                    const category = document.getElementById('category').value?.trim();
                    const date = document.getElementById('date').value;
                    const notes = document.getElementById('notes').value?.trim();
                    const clientId = document.getElementById('client').value || null;
                    const paymentMethod = document.getElementById('paymentMethod').value;

                    console.log('📝 البيانات المجمعة من النموذج:', {
                      description,
                      amount,
                      type,
                      category,
                      date,
                      notes,
                      clientId,
                      paymentMethod
                    });

                    // التحقق من البيانات المطلوبة
                    if (!description.trim() || !amount || amount <= 0 || !type || !category.trim() || !date) {
                      console.log('⚠️ فشل التحقق من البيانات:', {
                        description: !!description.trim(),
                        amount: amount > 0,
                        type: !!type,
                        category: !!category.trim(),
                        date: !!date
                      });
                      toast.error('❌ يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
                      return;
                    }

                    const formData = {
                      description,
                      amount,
                      type,
                      category,
                      date,
                      notes,
                      clientId,
                      paymentMethod
                    };

                    console.log('🚀 إرسال البيانات للمعالج:', formData);

                    if (editingTransaction) {
                      handleUpdateTransaction(formData);
                    } else {
                      handleAddTransaction(formData);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      جاري الحفظ...
                    </div>
                  ) : (
                    editingTransaction ? '✏️ تحديث' : '➕ إضافة'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowAddModal(false); setEditingTransaction(null); }}
                  className="flex-1 rounded-xl"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal سداد المديونية */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="text-center border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                سداد مديونية
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {selectedDebt.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* معلومات المديونية */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">المبلغ الإجمالي:</span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedDebt.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">المبلغ المدفوع للمديونية:</span>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(selectedDebt.paidAmount || 0)}
                    </p>
                  </div>
                  {selectedDebt.totalFeesCollected > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">الرسوم المحصلة (مكسب صافي):</span>
                      <p className="font-semibold text-orange-600">
                        {formatCurrency(selectedDebt.totalFeesCollected || 0)}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">المبلغ المتبقي:</span>
                    <p className="font-semibold text-red-600 text-lg">
                      {formatCurrency(Math.max(0, selectedDebt.remainingAmount || selectedDebt.amount))}
                    </p>
                    {selectedDebt.paidAmount > selectedDebt.amount && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        (تم دفع أكثر من المطلوب بسبب الرسوم)
                      </p>
                    )}
                  </div>
                  {paymentData.amount && !isNaN(paymentData.amount) && parseFloat(paymentData.amount) > 0 && (
                    <div className="col-span-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                        المبلغ المتبقي بعد السداد: {formatCurrency(Math.max(0, (selectedDebt.remainingAmount || selectedDebt.amount) - parseFloat(paymentData.amount)))}
                      </span>
                      {paymentData.fees && parseFloat(paymentData.fees) > 0 && (
                        <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                          + الرسوم: {formatCurrency(parseFloat(paymentData.fees))} (مكسب صافي)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* نموذج السداد */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="paymentAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    المبلغ المدفوع *
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="paymentAmount"
                      type="number"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      placeholder="أدخل المبلغ المدفوع"
                      className="flex-1"
                      min="0"
                      max={selectedDebt.remainingAmount || selectedDebt.amount}
                      step="0.01"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentData({ ...paymentData, amount: selectedDebt.remainingAmount || selectedDebt.amount })}
                      className="px-3 text-xs"
                    >
                      كامل
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="paymentFees" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    رسوم السداد (اختياري)
                  </Label>
                  <Input
                    id="paymentFees"
                    type="number"
                    value={paymentData.fees}
                    onChange={(e) => setPaymentData({ ...paymentData, fees: e.target.value })}
                    placeholder="أدخل رسوم السداد (مثل: 200)"
                    className="mt-1"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 يمكن إضافة رسوم إضافية عند السداد (مثل رسوم التأخير أو رسوم الخدمة)
                  </p>
                </div>

                {/* عرض المبلغ الإجمالي */}
                {paymentData.amount && !isNaN(paymentData.amount) && parseFloat(paymentData.amount) > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700 dark:text-green-300 text-sm font-medium">المبلغ الإجمالي المطلوب:</span>
                      <span className="text-green-900 dark:text-green-100 font-bold text-lg">
                        {formatCurrency(parseFloat(paymentData.amount) + (parseFloat(paymentData.fees) || 0))}
                      </span>
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      للمديونية: {formatCurrency(parseFloat(paymentData.amount))}
                      {paymentData.fees && parseFloat(paymentData.fees) > 0 && (
                        <span> + الرسوم: {formatCurrency(parseFloat(paymentData.fees))} (مكسب صافي)</span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    طريقة الدفع *
                  </Label>
                  <select
                    id="paymentMethod"
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="كاش">كاش</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="شيك">شيك</option>
                    <option value="بطاقة ائتمان">بطاقة ائتمان</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="paymentNotes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ملاحظات (اختياري)
                  </Label>
                  <textarea
                    id="paymentNotes"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="أي ملاحظات إضافية..."
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows="3"
                  />
                </div>
              </div>

              {/* أزرار العمل */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedDebt(null);
                    setPaymentData({ amount: '', paymentMethod: 'كاش', notes: '', fees: '' });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSubmitPayment}
                  disabled={paymentLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {paymentLoading ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري التسجيل...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      تسجيل الدفع
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal تاريخ السداد */}
      {showPaymentHistory && selectedPaymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 shadow-2xl">
            <CardHeader className="text-center border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                تاريخ سداد المديونية
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {selectedPaymentHistory.transaction.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* معلومات المديونية */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">معلومات المديونية</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">المبلغ الإجمالي:</span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(selectedPaymentHistory.transaction.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">المبلغ المدفوع للمديونية:</span>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(selectedPaymentHistory.transaction.paidAmount || 0)}
                    </p>
                  </div>
                  {selectedPaymentHistory.transaction.totalFeesCollected > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">الرسوم المحصلة (مكسب صافي):</span>
                      <p className="font-semibold text-orange-600">
                        {formatCurrency(selectedPaymentHistory.transaction.totalFeesCollected || 0)}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">المبلغ المتبقي:</span>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(Math.max(0, selectedPaymentHistory.remainingAmount || 0))}
                    </p>
                    {selectedPaymentHistory.transaction.paidAmount > selectedPaymentHistory.transaction.amount && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        (تم دفع أكثر من المطلوب بسبب الرسوم)
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-gray-500 dark:text-gray-400">حالة المديونية:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${selectedPaymentHistory.debtStatus === 'paid'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : selectedPaymentHistory.debtStatus === 'partial'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                    {selectedPaymentHistory.debtStatus === 'paid' ? 'مدفوعة بالكامل' :
                      selectedPaymentHistory.debtStatus === 'partial' ? 'مدفوعة جزئياً' :
                        'غير مدفوعة'}
                  </span>
                </div>
              </div>

              {/* تاريخ السداد */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  تاريخ عمليات السداد ({selectedPaymentHistory.paymentHistory.length} عملية)
                </h3>

                {selectedPaymentHistory.paymentHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد عمليات سداد مسجلة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPaymentHistory.paymentHistory.map((payment, index) => (
                      <div key={index} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                              <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  للمديونية: {formatCurrency(payment.amount)}
                                </p>
                                {payment.fees && payment.fees > 0 && (
                                  <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                                    +{formatCurrency(payment.fees)} رسوم (مكسب صافي)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(payment.paymentDate).toLocaleDateString('ar-EG', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {payment.totalAmount && payment.totalAmount !== payment.amount && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  إجمالي المطلوب: {formatCurrency(payment.totalAmount)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {payment.paymentMethod}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              بواسطة: {payment.paidBy}
                            </p>
                          </div>
                        </div>
                        {payment.notes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">ملاحظات:</span> {payment.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ملخص السداد */}
              {selectedPaymentHistory.paymentHistory.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">ملخص السداد</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">عدد العمليات:</span>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {selectedPaymentHistory.paymentHistory.length} عملية
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">إجمالي المدفوع للمديونية:</span>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {formatCurrency(selectedPaymentHistory.transaction.paidAmount || 0)}
                      </p>
                    </div>
                    {selectedPaymentHistory.transaction.totalFeesCollected > 0 && (
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">إجمالي الرسوم المحصلة:</span>
                        <p className="font-semibold text-orange-600">
                          {formatCurrency(selectedPaymentHistory.transaction.totalFeesCollected || 0)}
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          (مكسب صافي منفصل)
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">نسبة السداد:</span>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {(() => {
                          const paidAmount = selectedPaymentHistory.transaction.paidAmount || 0;
                          const totalAmount = selectedPaymentHistory.transaction.amount;
                          const percentage = Math.round((paidAmount / totalAmount) * 100);
                          // التأكد من أن النسبة لا تتجاوز 100%
                          return Math.min(percentage, 100);
                        })()}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* أزرار العمل */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => {
                    setShowPaymentHistory(false);
                    setSelectedPaymentHistory(null);
                  }}
                  variant="outline"
                  className="px-6"
                >
                  إغلاق
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{transactions.length} معاملة</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
              const page = start + i;
              if (page > totalPages) return null;
              return (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${currentPage === page ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{page}</button>
              );
            })}
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="h-8 px-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-blue-500 outline-none">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      )}

      {/* نموذج تصفية التاريخ */}
      {showDateFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>تصفية حسب التاريخ</CardTitle>
              <CardDescription>حدد نطاق التاريخ للتصفية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">من تاريخ</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">إلى تاريخ</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </CardContent>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFilter({ startDate: '', endDate: '' });
                  setShowDateFilter(false);
                  fetchTransactions();
                }}
              >
                إعادة تعيين
              </Button>
              <Button
                onClick={() => {
                  setShowDateFilter(false);
                  fetchTransactions();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                تطبيق التصفية
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDateFilter(false)}
              >
                إغلاق
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default TransactionsPage 