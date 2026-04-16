import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle
} from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/formatters'
import { transactionService } from '../services/api'

const ApprovalsPage = () => {
  // حالات المكون
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // جلب المعاملات المعلقة
  const fetchPendingTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await transactionService.getAll({ status: 'pending' });
      setPendingTransactions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch pending transactions:', err);
      setError('فشل في جلب المعاملات المعلقة. يرجى المحاولة لاحقاً.');
      setPendingTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  // معلومات المستخدم الحالي
  const getCurrentUser = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        id: user.id || 'unknown',
        name: user.name || 'غير معروف',
        role: user.role || 'user'
      };
    } catch (e) {
      console.error('Error parsing user data:', e);
      return {
        id: 'unknown',
        name: 'غير معروف',
        role: 'user'
      };
    }
  };

  const currentUser = getCurrentUser();
  const canApprove = ['admin', 'manager'].includes(currentUser.role);

  // معالجة الموافقة على المعاملة
  const handleApprove = async (id) => {
    if (!window.confirm('هل تريد الموافقة على هذه المعاملة؟')) return;
    
    try {
      await transactionService.update(id, { 
        status: 'approved', 
        approvedBy: currentUser.name,
        approvedAt: new Date().toISOString()
      });
      setPendingTransactions(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      console.error('Failed to approve transaction:', err);
      alert('فشل في الموافقة على المعاملة. يرجى المحاولة لاحقاً.');
    }
  };

  // معالجة رفض المعاملة
  const handleReject = async (id) => {
    const reason = window.prompt('سبب الرفض (اختياري):');
    if (reason === null) return; // User cancelled
    
    try {
      await transactionService.update(id, { 
        status: 'rejected', 
        rejectedBy: currentUser.name,
        rejectionReason: reason || 'غير محدد',
        rejectedAt: new Date().toISOString()
      });
      setPendingTransactions(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      console.error('Failed to reject transaction:', err);
      alert('فشل في رفض المعاملة. يرجى المحاولة لاحقاً.');
    }
  };

  // بطاقة معاملة للموافقة
  const TransactionApprovalCard = ({ transaction }) => {
    const safeTransaction = {
      ...transaction,
      _id: transaction._id || 'unknown-' + Math.random().toString(36).substr(2, 9),
      description: transaction.description || 'معاملة بدون وصف',
      type: transaction.type || 'expense',
      amount: parseFloat(transaction.amount) || 0,
      currency: transaction.currency || 'SAR',
      category: transaction.category || 'غير محدد',
      subcategory: transaction.subcategory || '',
      paymentMethod: transaction.paymentMethod || 'غير محدد',
      status: transaction.status || 'pending',
      createdBy: transaction.createdBy || 'غير معروف',
      date: transaction.date ? formatDate(transaction.date) : 'غير محدد',
      notes: transaction.notes || '',
      attachments: transaction.attachments || [],
      transactionNumber: transaction.transactionNumber || 'غير محدد',
      reference: transaction.reference || '',
      clientId: transaction.clientId || '',
      employeeId: transaction.employeeId || ''
    };

    const t = safeTransaction;
    const isIncome = t.type === 'income';
    const cfg = isIncome
      ? { bg: 'from-green-50 to-emerald-50 dark:from-green-900/15 dark:to-emerald-900/10', border: 'border-green-100 dark:border-green-900/30', color: 'green', sign: '+', Icon: ArrowDownCircle }
      : { bg: 'from-red-50 to-rose-50 dark:from-red-900/15 dark:to-rose-900/10', border: 'border-red-100 dark:border-red-900/30', color: 'red', sign: '-', Icon: ArrowUpCircle };

    return (
      <div className={`rounded-xl overflow-hidden bg-gradient-to-br ${cfg.bg} border ${cfg.border} hover:shadow-md transition-all`}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-lg bg-${cfg.color}-100 dark:bg-${cfg.color}-900/30 flex items-center justify-center flex-shrink-0`}>
                <cfg.Icon className={`w-4 h-4 text-${cfg.color}-600 dark:text-${cfg.color}-400`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{t.description}</h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">{t.transactionNumber} · {t.date}</p>
              </div>
            </div>
            <div className="text-left flex-shrink-0">
              <p className={`text-base font-bold text-${cfg.color}-600 dark:text-${cfg.color}-400 font-mono`} dir="ltr">{cfg.sign}{formatCurrency(t.amount)} <span className="text-[10px]">EGP</span></p>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 mt-0.5">
                <Clock className="w-2.5 h-2.5" /> قيد المراجعة
              </span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold bg-${cfg.color}-50 text-${cfg.color}-700 dark:bg-${cfg.color}-900/20 dark:text-${cfg.color}-400`}>{isIncome ? 'إيرادات' : 'مصروفات'}</span>
            {t.category && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{t.category}</span>}
            {t.paymentMethod && t.paymentMethod !== 'غير محدد' && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">{t.paymentMethod}</span>}
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">{t.createdBy}</span>
          </div>

          {/* Notes */}
          {t.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-white/50 dark:bg-gray-900/30 rounded-lg px-3 py-2 line-clamp-2">{t.notes}</p>}

          {/* Action buttons */}
          {canApprove && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
              <button onClick={() => handleApprove(t._id)} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
                <CheckCircle className="w-3.5 h-3.5" /> موافقة
              </button>
              <button onClick={() => handleReject(t._id)} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold transition-colors">
                <XCircle className="w-3.5 h-3.5" /> رفض
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // إحصائيات المعاملات
  const getStats = () => {
    return {
      totalPending: pendingTransactions.length,
      totalAmount: pendingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
      expenses: pendingTransactions.filter(t => t.type === 'expense').length,
      income: pendingTransactions.filter(t => t.type === 'income').length
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{error}</h3>
        <Button 
          onClick={fetchPendingTransactions} 
          className="mt-3 bg-red-600 hover:bg-red-700"
        >
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
            <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              موافقات المعاملات المالية
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              راجع ووافق على المعاملات المالية المطلوبة
            </p>
          </div>
        </div>
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">المعاملات المعلقة</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {stats.totalPending}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">إجمالي المبلغ</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(stats.totalAmount)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">مصروفات معلقة</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {stats.expenses}
                </p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">إيرادات معلقة</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.income}
                </p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* قائمة المعاملات قيد المراجعة */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          المعاملات المطلوبة للمراجعة ({pendingTransactions.length})
        </h2>

        {pendingTransactions.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {pendingTransactions.map(transaction => (
            <TransactionApprovalCard
              key={transaction._id || 'trans-' + Math.random().toString(36).substr(2, 9)}
              transaction={transaction}
            />
          ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-green-500" />
                <h3 className="text-lg font-medium mb-2">ممتاز! لا توجد معاملات معلقة</h3>
                <p>تم الانتهاء من مراجعة جميع المعاملات المالية</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ApprovalsPage