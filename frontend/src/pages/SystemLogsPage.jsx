import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Activity,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  Eye,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { logService } from '../services/api';

const SystemLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLogs: 0,
    successCount: 0,
    failedCount: 0,
    highSeverityCount: 0,
    criticalSeverityCount: 0
  });
  const [actionStats, setActionStats] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10, // Changed default to 10
    total: 0,
    pages: 0
  });

  // فلاتر البحث
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    severity: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  // دالة جلب اللوجات
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await logService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      if (response.success) {
        setLogs(response.data);
        setStats(response.stats);
        setActionStats(response.actionStats);
        setPagination(response.pagination);
      } else {
        throw new Error('فشل في جلب اللوجات');
      }
    } catch (error) {
      toast.error('حدث خطأ في جلب اللوجات');
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // دالة جلب الإحصائيات
  const fetchStats = useCallback(async () => {
    try {
      const response = await logService.getStats();
      if (response.success) {
        // يمكن استخدام هذه البيانات لعرض رسوم بيانية
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('حدث خطأ في جلب الإحصائيات');
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  // دالة تحديث الفلاتر
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // إعادة تعيين الصفحة
  };

  // دالة مسح الفلاتر
  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      severity: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // دالة تغيير الصفحة
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // دالة تغيير عدد العناصر في الصفحة
  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };


  // دالة تنسيق التاريخ
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // دالة تنسيق العملة
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // دالة الحصول على لون الحالة
  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // دالة الحصول على لون مستوى الأهمية
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // دالة الحصول على أيقونة العملية
  const getActionIcon = (action) => {
    switch (action) {
      case 'transaction_created': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'transaction_updated': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'transaction_deleted': return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'debt_payment': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'debt_full_payment': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'debt_partial_payment': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'treasury_updated': return <Activity className="w-4 h-4 text-blue-600" />;
      case 'user_login': return <User className="w-4 h-4 text-blue-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  // دالة ترجمة نوع العملية
  const translateAction = (action) => {
    const translations = {
      'transaction_created': 'إنشاء معاملة',
      'transaction_updated': 'تحديث معاملة',
      'transaction_deleted': 'حذف معاملة',
      'debt_payment': 'سداد مديونية',
      'debt_full_payment': 'سداد كامل',
      'debt_partial_payment': 'سداد جزئي',
      'treasury_updated': 'تحديث الخزنة',
      'user_login': 'تسجيل دخول',
      'user_logout': 'تسجيل خروج',
      'category_created': 'إنشاء فئة',
      'category_updated': 'تحديث فئة',
      'category_deleted': 'حذف فئة',
      'system_cleanup': 'تنظيف النظام'
    };
    return translations[action] || action;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            لوجات النظام
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            تتبع جميع العمليات والأنشطة في النظام
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">إجمالي اللوجات</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalLogs.toLocaleString()}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">عمليات ناجحة</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.successCount.toLocaleString()}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">عمليات فاشلة</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.failedCount.toLocaleString()}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">أهمية عالية</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.highSeverityCount.toLocaleString()}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">حرجة</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.criticalSeverityCount.toLocaleString()}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* فلاتر البحث */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            فلاتر البحث
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="search">البحث</Label>
              <Input
                id="search"
                placeholder="ابحث في التفاصيل..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="action">نوع العملية</Label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع العمليات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع العمليات</SelectItem>
                  <SelectItem value="transaction_created">إنشاء معاملة</SelectItem>
                  <SelectItem value="transaction_updated">تحديث معاملة</SelectItem>
                  <SelectItem value="transaction_deleted">حذف معاملة</SelectItem>
                  <SelectItem value="debt_payment">سداد مديونية</SelectItem>
                  <SelectItem value="debt_full_payment">سداد كامل</SelectItem>
                  <SelectItem value="debt_partial_payment">سداد جزئي</SelectItem>
                  <SelectItem value="treasury_updated">تحديث الخزنة</SelectItem>
                  <SelectItem value="user_login">تسجيل دخول</SelectItem>
                  <SelectItem value="user_logout">تسجيل خروج</SelectItem>
                  <SelectItem value="category_created">إنشاء فئة</SelectItem>
                  <SelectItem value="category_updated">تحديث فئة</SelectItem>
                  <SelectItem value="category_deleted">حذف فئة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">مستوى الأهمية</Label>
              <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع المستويات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع المستويات</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">الحالة</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع الحالات</SelectItem>
                  <SelectItem value="success">ناجح</SelectItem>
                  <SelectItem value="failed">فاشل</SelectItem>
                  <SelectItem value="pending">في الانتظار</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateFrom">من تاريخ</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="dateTo">إلى تاريخ</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={clearFilters} variant="outline" size="sm">
              مسح الفلاتر
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول اللوجات */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل العمليات</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="limit">عناصر في الصفحة:</Label>
              <Select value={pagination.limit.toString()} onValueChange={handleLimitChange}>
                <SelectTrigger className="w-20 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-gray-900">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="mr-2">جاري التحميل...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ والوقت</TableHead>
                      <TableHead>نوع العملية</TableHead>
                      <TableHead>التفاصيل</TableHead>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الأهمية</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {formatDate(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            {translateAction(log.action)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={log.details}>
                            {log.details}
                          </div>
                          {log.metadata?.migrated && (
                            <div className="text-xs text-gray-500 mt-1">
                              (من المعاملات الموجودة)
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            {log.username}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(log.status)}>
                            {log.status === 'success' ? 'ناجح' :
                              log.status === 'failed' ? 'فاشل' : 'في الانتظار'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(log.severity)}>
                            {log.severity === 'critical' ? 'حرج' :
                              log.severity === 'high' ? 'عالي' :
                                log.severity === 'medium' ? 'متوسط' : 'منخفض'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* التصفح */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    عرض {((pagination.page - 1) * pagination.limit) + 1} إلى {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total} لوج
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      السابق
                    </Button>
                    <span className="px-3 py-1 text-sm">
                      صفحة {pagination.page} من {pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogsPage;