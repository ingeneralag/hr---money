import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNotifications } from '../components/NotificationSystem';
import {
  Activity,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Settings,
  Database,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { logService } from '../services/api';

const SystemLogsPage = () => {
  const { showSuccess, showError } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    resource: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10000
  });
  const [pagination, setPagination] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await logService.getAll(filters);
      if (response.success) {
        setLogs(response.data.logs);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      showError('حدث خطأ في جلب السجلات');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await logService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      showError('حدث خطأ في جلب الإحصائيات');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      resource: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 10000
    });
  };

  const exportLogs = async (format = 'json') => {
    try {
      const blob = await logService.export(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSuccess('تم تصدير السجلات بنجاح');
    } catch (error) {
      showError('حدث خطأ في تصدير السجلات');
    }
  };

  const clearLogs = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع السجلات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
      try {
        await logService.clear();
        fetchLogs();
        fetchStats();
        showSuccess('تم حذف جميع السجلات بنجاح');
      } catch (error) {
        showError('حدث خطأ في حذف السجلات');
      }
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'إضافة': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'تعديل': return <Settings className="w-4 h-4 text-blue-500" />;
      case 'حذف': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'عرض': return <Eye className="w-4 h-4 text-gray-500" />;
      case 'تسجيل دخول': return <User className="w-4 h-4 text-green-600" />;
      case 'تسجيل خروج': return <User className="w-4 h-4 text-gray-600" />;
      default: return <Zap className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'نجح': return 'text-green-600 bg-green-50';
      case 'فشل': return 'text-red-600 bg-red-50';
      case 'تحذير': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getFinancialDetails = (log) => {
    if (log.resource !== 'المعاملات المالية' || !log.details || !log.details.data) {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    const data = log.details.data;
    const amount = data.amount;
    const type = data.type;
    const description = data.description;
    const category = data.category;

    if (!amount) return <span className="text-gray-400 text-xs">-</span>;

    return (
      <div className="space-y-1">
        <div className={`font-bold text-sm ${type === 'دخل' ? 'text-green-600' : 'text-red-600'}`}>
          {type === 'دخل' ? '+' : '-'} {amount.toLocaleString('en-US')} ج.م
        </div>
        <div className="text-xs text-gray-600">
          {type} - {category}
        </div>
        {description && (
          <div className="text-xs text-gray-500 truncate max-w-32" title={description}>
            {description}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            سجل أنشطة النظام
          </h1>
          <p className="text-gray-600 mt-1">مراقبة وتتبع جميع العمليات والأنشطة</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => exportLogs('json')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            تصدير JSON
          </Button>
          <Button
            onClick={() => exportLogs('csv')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">إجمالي السجلات</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total || 0}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">المعاملات المالية</p>
                <p className="text-2xl font-bold text-green-600">{stats.byResource?.['المعاملات المالية'] || 0}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">اليوم</p>
                <p className="text-2xl font-bold text-orange-600">{stats.today || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">هذا الشهر</p>
                <p className="text-2xl font-bold text-purple-600">{stats.thisMonth || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              فلاتر البحث
            </CardTitle>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              size="sm"
            >
              {showFilters ? 'إخفاء' : 'إظهار'} الفلاتر
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">البحث</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="البحث في السجلات..."
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العملية</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">جميع العمليات</option>
                  <option value="إضافة">إضافة</option>
                  <option value="تعديل">تعديل</option>
                  <option value="حذف">حذف</option>
                  <option value="عرض">عرض</option>
                  <option value="تسجيل دخول">تسجيل دخول</option>
                  <option value="تسجيل خروج">تسجيل خروج</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المورد</label>
                <select
                  value={filters.resource}
                  onChange={(e) => handleFilterChange('resource', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">جميع الموارد</option>
                  <option value="المعاملات المالية">المعاملات المالية</option>
                  <option value="الموظفين">الموظفين</option>
                  <option value="الرواتب">الرواتب</option>
                  <option value="واتساب">واتساب</option>
                  <option value="سجل النظام">سجل النظام</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">من تاريخ</label>
                <input
                  type="datetime-local"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">إلى تاريخ</label>
                <input
                  type="datetime-local"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={fetchLogs} className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                بحث
              </Button>
              <Button onClick={clearFilters} variant="outline">
                مسح الفلاتر
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>السجلات ({pagination.total || 0})</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                صفحة {pagination.current || 1} من {pagination.pages || 1}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد سجلات متاحة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ والوقت
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المستخدم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العملية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المورد
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التفاصيل المالية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {log.user || 'غير معروف'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          {log.action}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.resource}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getFinancialDetails(log)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <Button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetails(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          تفاصيل
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-700">
                عرض {((pagination.current - 1) * filters.limit) + 1} إلى{' '}
                {Math.min(pagination.current * filters.limit, pagination.total)} من{' '}
                {pagination.total} سجل
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                  disabled={!pagination.hasPrev}
                  variant="outline"
                  size="sm"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </Button>
                <Button
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                  disabled={!pagination.hasNext}
                  variant="outline"
                  size="sm"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">تفاصيل السجل</h3>
                <Button
                  onClick={() => setShowDetails(false)}
                  variant="outline"
                  size="sm"
                >
                  إغلاق
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-medium text-gray-700">التاريخ والوقت:</label>
                    <p className="text-gray-900">{formatDate(selectedLog.timestamp)}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">المستخدم:</label>
                    <p className="text-gray-900">{selectedLog.user || 'غير معروف'}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">العملية:</label>
                    <p className="text-gray-900 flex items-center gap-2">
                      {getActionIcon(selectedLog.action)}
                      {selectedLog.action}
                    </p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">المورد:</label>
                    <p className="text-gray-900">{selectedLog.resource}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">الحالة:</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedLog.status)}`}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">الـ IP:</label>
                    <p className="text-gray-900">{selectedLog.ip || 'غير متاح'}</p>
                  </div>
                </div>

                {/* Financial Details Section */}
                {selectedLog.resource === 'المعاملات المالية' && selectedLog.details && selectedLog.details.data && (
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      التفاصيل المالية
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-medium text-blue-700">المبلغ:</label>
                        <p className={`text-lg font-bold ${selectedLog.details.data.type === 'دخل' ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedLog.details.data.type === 'دخل' ? '+' : '-'} {selectedLog.details.data.amount?.toLocaleString('en-US')} ج.م
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-blue-700">نوع المعاملة:</label>
                        <p className={`font-semibold ${selectedLog.details.data.type === 'دخل' ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedLog.details.data.type}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-blue-700">الفئة:</label>
                        <p className="text-blue-900">{selectedLog.details.data.category}</p>
                      </div>
                      <div>
                        <label className="font-medium text-blue-700">تاريخ المعاملة:</label>
                        <p className="text-blue-900">{selectedLog.details.data.date}</p>
                      </div>
                      {selectedLog.details.data.description && (
                        <div className="col-span-2">
                          <label className="font-medium text-blue-700">الوصف:</label>
                          <p className="text-blue-900 bg-white p-2 rounded border">{selectedLog.details.data.description}</p>
                        </div>
                      )}
                      <div>
                        <label className="font-medium text-blue-700">معرف المعاملة:</label>
                        <p className="text-blue-900 font-mono">{selectedLog.details.data.id || 'غير متاح'}</p>
                      </div>
                      <div>
                        <label className="font-medium text-blue-700">حالة المعاملة:</label>
                        <p className="text-blue-900">{selectedLog.details.data.status || 'مكتمل'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedLog.endpoint && (
                  <div>
                    <label className="font-medium text-gray-700">المسار:</label>
                    <p className="text-gray-900 font-mono text-sm bg-gray-100 p-2 rounded">
                      {selectedLog.method} {selectedLog.endpoint}
                    </p>
                  </div>
                )}

                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <label className="font-medium text-gray-700">التفاصيل:</label>
                    <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <label className="font-medium text-gray-700">متصفح المستخدم:</label>
                    <p className="text-gray-900 text-sm">{selectedLog.userAgent}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemLogsPage; 