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
      const response = await fetch(`http://localhost:5001/api/transactions/${transaction._id}/debt-details`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

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
      const response = await fetch(`http://localhost:5001/api/transactions/${selectedDebt._id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: paymentAmount,
          fees: fees,
          totalAmount: totalAmount,
          paymentMethod: paymentData.paymentMethod,
          notes: paymentData.notes
        })
      });

      const data = await response.json();

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

  const TransactionCard = ({ transaction }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-full ${transaction.type === 'income'
                ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                : transaction.type === 'expense'
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                }`}>
                {transaction.type === 'income' ? (
                  <ArrowDownCircle className="w-4 h-4" />
                ) : transaction.type === 'expense' ? (
                  <ArrowUpCircle className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {transaction.description}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span>رقم المعاملة: </span>
                  <span className="font-semibold">{transaction.transactionNumber || 'غير محدد'}</span>
                  {transaction.reference && <span> • {transaction.reference}</span>}
                  {transaction.date && <span> • {formatDate(transaction.date)}</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className={`text-xl font-bold ${transaction.type === 'income'
              ? 'text-green-600 dark:text-green-400'
              : transaction.type === 'expense'
                ? 'text-red-600 dark:text-red-400'
                : 'text-purple-600 dark:text-purple-400'
              }`}>
              {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '='}{formatCurrency(transaction.amount)}
              {transaction.currency && <span className="text-base ml-1">{transaction.currency}</span>}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full mt-1 ${transaction.status === 'approved'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : transaction.status === 'rejected'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              }`}>
              {transaction.status === 'approved' ? 'مكتمل' :
                transaction.status === 'rejected' ? 'مرفوض' :
                  'قيد المراجعة'}
            </div>
            {/* عرض حالة المديونية */}
            {transaction.type === 'debt' && (
              <div className={`text-xs px-2 py-1 rounded-full mt-1 ${transaction.debtStatus === 'paid'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : transaction.debtStatus === 'partial'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                {transaction.debtStatus === 'paid' ? 'مدفوعة بالكامل' :
                  transaction.debtStatus === 'partial' ? 'مدفوعة جزئياً' :
                    'غير مدفوعة'}
                {transaction.debtStatus !== 'paid' && transaction.remainingAmount && (
                  <span className="ml-1">({formatCurrency(transaction.remainingAmount)} متبقي)</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">التصنيف: </span>
            <span className="font-medium text-gray-900 dark:text-white">{transaction.category || 'غير محدد'}</span>
            {transaction.subcategory && (
              <span className="ml-2 text-gray-500 dark:text-gray-400">({transaction.subcategory})</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">طريقة الدفع: </span>
            <span className="font-medium text-gray-900 dark:text-white">{transaction.paymentMethod || 'غير محدد'}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">الحالة: </span>
            <span className="font-medium text-gray-900 dark:text-white">{transaction.status || 'غير محدد'}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">أنشأ بواسطة: </span>
            <span className="font-medium text-gray-900 dark:text-white">{transaction.createdBy || 'غير محدد'}</span>
          </div>
          {/* عرض العميل أو الموظف إذا وجد */}
          {transaction.clientId && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">العميل: </span>
              <span className="font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                {getClientName(transaction.clientId)}
              </span>
            </div>
          )}
          {transaction.employeeId && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">الموظف: </span>
              <span className="font-medium text-gray-900 dark:text-white">{transaction.employeeId}</span>
            </div>
          )}
          {transaction.approvedBy && (
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">اعتمد بواسطة: </span>
              <span className="font-medium text-gray-900 dark:text-white">{transaction.approvedBy}</span>
            </div>
          )}
          {transaction.rejectedBy && (
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">رفض بواسطة: </span>
              <span className="font-medium text-red-600 dark:text-red-400">{transaction.rejectedBy}</span>
              {transaction.rejectionReason && (
                <p className="text-sm text-gray-500 mt-1">السبب: {transaction.rejectionReason}</p>
              )}
            </div>
          )}
        </div>

        {transaction.notes && (
          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
            <span className="text-gray-500 dark:text-gray-400">ملاحظات: </span>
            <span className="text-gray-700 dark:text-gray-300">{transaction.notes}</span>
          </div>
        )}
        {/* عرض المرفقات إذا وجدت */}
        {transaction.attachments && transaction.attachments.length > 0 && (
          <div className="mb-4">
            <span className="text-gray-500 dark:text-gray-400 text-sm">المرفقات: </span>
            <ul className="list-disc ml-6 mt-1">
              {transaction.attachments.map((file, idx) => (
                <li key={idx} className="text-blue-600 dark:text-blue-400 underline cursor-pointer">{file}</li>
              ))}
            </ul>
          </div>
        )}
        {/* أزرار العمليات */}
        {isAdmin && transaction.status === 'pending' && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => handleApproveTransaction(transaction._id)}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
              size="lg"
            >
              <CheckCircle className="w-5 h-5" />
              ✅ موافقة
            </Button>
            <Button
              onClick={() => handleRejectTransaction(transaction._id)}
              variant="outline"
              className="flex-1 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-semibold py-3"
              size="lg"
            >
              <XCircle className="w-5 h-5" />
              ❌ رفض
            </Button>
          </div>
        )}

        {isAdmin && transaction.status !== 'pending' && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditTransaction(transaction)}
              className="flex-1 gap-2"
            >
              <Filter className="w-4 h-4" />
              تعديل
            </Button>
            {transaction.type === 'debt' && transaction.debtStatus !== 'paid' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePayDebt(transaction)}
                className="flex-1 gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4" />
                سداد
              </Button>
            )}
            {transaction.type === 'debt' && transaction.paymentHistory && transaction.paymentHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewPaymentHistory(transaction)}
                className="flex-1 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <TrendingUp className="w-4 h-4" />
                تاريخ السداد
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteTransaction(transaction._id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Filter className="w-4 h-4" />
              حذف
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* إضافة CSS مخصص */}
      <style>{treasuryStyles}</style>


      {/* العنوان والإحصائيات */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">المعاملات المالية</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              إدارة وتتبع جميع المعاملات المالية
            </p>
          </div>
          <div className="flex gap-3">
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
              className="gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              ✨ إضافة معاملة جديدة ✨
            </Button>
          </div>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">الإحصائيات المالية</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full border border-amber-300 dark:border-amber-600">
              <span className="text-amber-600 dark:text-amber-400">💰</span>
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">الخزنة</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await treasuryService.recalculate();
                if (response.success) {
                  toast.success('تم إعادة حساب الخزنة بنجاح');
                  await fetchTreasuryData();
                }
              } catch (error) {
                toast.error('خطأ في إعادة حساب الخزنة');
              }
            }}
            className="gap-2 text-blue-600 hover:text-blue-700"
          >
            <TrendingUp className="w-4 h-4" />
            إعادة حساب الخزنة
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* بطاقة الخزنة - مميزة وواضحة */}
          <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-orange-900/30 border-4 border-amber-300 dark:border-amber-600 shadow-2xl transform hover:scale-105 transition-all duration-300 relative overflow-hidden ring-4 ring-amber-200 dark:ring-amber-800 ring-opacity-50 treasury-glow treasury-float">
            {/* تأثير لامع في الخلفية */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 treasury-shimmer"></div>

            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">💰 الخزنة الحالية</p>
                    <div className="ml-auto px-2 py-1 bg-amber-200 dark:bg-amber-800 rounded-full">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-200">VIP</span>
                    </div>
                  </div>

                  <div className="relative">
                    <p className="text-3xl font-black text-amber-900 dark:text-amber-100 mb-1 drop-shadow-lg relative z-10">
                      {formatCurrency(treasuryData.currentBalance)}
                    </p>
                    {/* تأثير خلفية للرقم */}
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-200/30 to-yellow-200/30 dark:from-amber-800/30 dark:to-yellow-800/30 rounded-lg blur-sm -z-10"></div>
                  </div>

                  {/* مؤشر الحالة المبسط */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${treasuryData.currentBalance >= 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'
                      }`}></div>
                    <span className={`text-xs font-semibold ${treasuryData.currentBalance >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      }`}>
                      {treasuryData.currentBalance >= 0 ? 'رصيد إيجابي' : 'رصيد سالب'}
                    </span>
                  </div>
                </div>

                <div className="text-center ml-3">
                  <div className="relative group">
                    <DollarSign className="w-10 h-10 text-amber-600 dark:text-amber-400 drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center animate-bounce">
                      <span className="text-xs font-bold text-white">💎</span>
                    </div>
                    {/* تأثير دائري حول الأيقونة */}
                    <div className="absolute inset-0 rounded-full border-2 border-amber-300 dark:border-amber-600 opacity-30 group-hover:opacity-60 transition-opacity duration-300"></div>
                  </div>

                  {/* أيقونات إضافية مبسطة */}
                  <div className="mt-1 flex justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {formatCurrency(stats.totalIncome)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">إجمالي المصروفات</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {formatCurrency(stats.totalExpenses)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">صافي الربح</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">(يشمل الرسوم)</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {formatCurrency(stats.totalIncome - stats.totalExpenses + stats.totalFeesCollected)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          {/* بطاقة المديونيات الإجمالية */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">إجمالي المديونيات</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {formatCurrency(stats.totalDebts)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          {/* بطاقة المديونيات المدفوعة */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">المديونيات المدفوعة</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {formatCurrency(stats.paidDebts)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          {/* بطاقة المديونيات المتبقية */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">المديونيات المتبقية</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {formatCurrency(stats.remainingDebts)}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">قيد المراجعة</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {stats.pendingTransactions}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          {/* بطاقة الرسوم المحصلة (مكسب صافي) */}
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">الرسوم المحصلة</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">(مكسب صافي)</p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {formatCurrency(stats.totalFeesCollected)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* البحث والفلترة */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="البحث في المعاملات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">جميع الأنواع</option>
              <option value="income">إيرادات</option>
              <option value="expense">مصروفات</option>
              <option value="debt">مديونيات</option>
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">جميع التصنيفات</option>
              {loadingCategories ? (
                <option disabled>جاري تحميل التصنيفات...</option>
              ) : categories.length > 0 ? (
                categories.map(category => (
                  <option key={category._id} value={category.name}>{category.name}</option>
                ))
              ) : (
                <option disabled>لا توجد تصنيفات</option>
              )}
            </select>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">جميع العملاء</option>
              <option value="none">عمليات عامة (بدون عميل)</option>
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
            <Button
              variant="outline"
              className={`gap-2 ${dateFilter.startDate || dateFilter.endDate ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
              onClick={() => setShowDateFilter(true)}
            >
              <Calendar className="w-4 h-4" />
              {dateFilter.startDate || dateFilter.endDate ? 'تصفية حسب التاريخ' : 'تاريخ محدد'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingTransaction ? 'تعديل المعاملة' : 'إضافة معاملة جديدة'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">وصف المعاملة</Label>
                  <Input
                    id="description"
                    defaultValue={editingTransaction?.description || ''}
                    placeholder="وصف تفصيلي للمعاملة"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ</Label>
                  <Input
                    id="amount"
                    type="number"
                    defaultValue={editingTransaction?.amount || ''}
                    placeholder="0"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">نوع المعاملة</Label>
                  <select
                    id="type"
                    defaultValue={editingTransaction?.type || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    required
                  >
                    <option value="">اختر النوع</option>
                    <option value="income">إيرادات</option>
                    <option value="expense">مصروفات</option>
                    <option value="debt">مديونيات</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">التصنيف</Label>
                  <select
                    id="category"
                    defaultValue={editingTransaction?.category || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    required
                  >
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
                <div className="space-y-2">
                  <Label htmlFor="date">التاريخ</Label>
                  <Input
                    id="date"
                    type="date"
                    defaultValue={editingTransaction?.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">العميل (اختياري)</Label>
                  <select
                    id="client"
                    defaultValue={editingTransaction?.clientId || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
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
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">طريقة الدفع</Label>
                  <select
                    id="paymentMethod"
                    defaultValue={editingTransaction?.paymentMethod || 'كاش'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    required
                  >
                    <option value="كاش">💵 كاش</option>
                    <option value="انستا باي">📱 انستا باي</option>
                    <option value="فودافون كاش">📞 فودافون كاش</option>
                    <option value="تحويل بنكي">🏦 تحويل بنكي</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Input
                    id="notes"
                    defaultValue={editingTransaction?.notes || ''}
                    placeholder="ملاحظات إضافية (اختياري)"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
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
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTransaction(null);
                  }}
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal سداد المديونية */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl">
            <CardHeader className="text-center border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                سداد مديونية
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {selectedDebt.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
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

      {/* Pagination Controls */}
      {!loading && filteredTransactions.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">عناصر في الصفحة:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1) // Reset to first page when changing items per page
              }}
              className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2"
            >
              السابق
            </Button>

            <div className="flex items-center gap-1">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = Number(e.target.value)
                  if (page > 0 && page <= totalPages) {
                    setCurrentPage(page)
                  }
                }}
                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <span className="text-gray-600 dark:text-gray-400">من {totalPages}</span>
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2"
            >
              التالي
            </Button>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            إجمالي النتائج: {transactions.length}
          </div>
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