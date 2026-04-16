import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { formatCurrency, formatDate } from '../utils/formatters'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, Eye, Download, Calendar, UserCheck, Clock, MapPin, Wifi, Phone, Mail } from 'lucide-react'
import { employeeService } from '../services/api'
import api from '../services/api'

const DashboardPage = () => {
  // القيم الافتراضية للإحصائيات
  const DEFAULT_STATS = {
    totalRevenue: 0,
    totalExpenses: 0,
    totalEmployees: 0,
    pendingPayrolls: 0,
    revenueChange: 0,
    expensesChange: 0
  };

  const DEFAULT_QUICK_STATS = {
    avgSalary: 0,
    monthlyGrowth: 0,
    totalBonuses: 0,
    attendanceRate: 0
  };

  // بيانات الداشبورد
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [monthlyData, setMonthlyData] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [quickStats, setQuickStats] = useState(DEFAULT_QUICK_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ألوان فئات المصروفات
  const EXPENSE_CATEGORIES_COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
    '#8884D8', '#82CA9D', '#FFC658', '#A4DE6C'
  ];

  // جلب بيانات الموظفين النشطين
  const fetchActiveEmployees = async () => {
    try {
      const response = await employeeService.getAll();
      // فلترة الموظفين النشطين فقط مع إضافة قيم افتراضية
      const actives = (response.data || response || []).filter(emp => emp.status === 'active').map(emp => ({
        id: emp.id || 'unknown',
        name: emp.name || 'غير معروف',
        position: emp.position || 'غير محدد',
        department: emp.department || 'غير محدد',
        status: emp.status || 'غير محدد',
        location: emp.location || 'المكتب الرئيسي',
        checkInTime: emp.checkInTime || '--:--',
        lastActivity: emp.lastActivity || 'غير معروف',
        workingHours: emp.workingHours || '0',
        avatarInitials: emp.name ? 
          `${emp.name.split(' ')[0]?.charAt(0) || ''}${emp.name.split(' ')[1]?.charAt(0) || ''}` 
          : '??'
      }));
      setActiveEmployees(actives);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setActiveEmployees([]);
    }
  };

  // جلب جميع بيانات الداشبورد
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [statsResponse, employeesResponse, transactionsResponse, analyticsResponse] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: { data: {} }})),
        api.get('/dashboard/active-employees').catch(() => ({ data: { data: [] }})),
        api.get('/transactions/recent').catch(() => ({ data: { data: [] }})),
        api.get('/dashboard/analytics').catch(() => ({ data: { data: {} }}))
      ]);

      // معالجة بيانات الإحصائيات
      const statsData = statsResponse.data?.data || {};
      setStats({
        totalRevenue: parseFloat(statsData.financial?.totalRevenue) || 0,
        totalExpenses: parseFloat(statsData.financial?.totalExpenses) || 0,
        totalEmployees: parseInt(statsData.employees?.total) || 0,
        pendingPayrolls: parseInt(statsData.employees?.pending) || 0,
        revenueChange: parseFloat(statsData.financial?.revenueChange) || 0,
        expensesChange: parseFloat(statsData.financial?.expensesChange) || 0
      });

      // معالجة بيانات الموظفين
      setActiveEmployees(employeesResponse.data?.data || []);

      // معالجة بيانات المعاملات
      setRecentTransactions(transactionsResponse.data?.data?.map(t => ({
        ...t,
        amount: parseFloat(t.amount) || 0,
        date: t.date ? formatDate(t.date) : 'غير محدد'
      })) || []);

      // معالجة بيانات التحليلات
      const analyticsData = analyticsResponse.data?.data || {};
      setMonthlyData(analyticsData.monthlyData || generateDefaultMonthlyData());
      setExpenseCategories(analyticsData.expenseCategories || generateDefaultExpenseCategories());
      
      // معالجة الإحصائيات السريعة
      setQuickStats({
        avgSalary: parseFloat(analyticsData.quickStats?.avgSalary) || 0,
        monthlyGrowth: parseFloat(analyticsData.quickStats?.monthlyGrowth) || 0,
        totalBonuses: parseFloat(analyticsData.quickStats?.totalBonuses) || 0,
        attendanceRate: parseFloat(analyticsData.quickStats?.attendanceRate) || 0
      });

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('فشل في جلب بيانات لوحة التحكم. يرجى المحاولة لاحقاً.');
      // تعيين القيم الافتراضية في حالة الخطأ
      setStats(DEFAULT_STATS);
      setActiveEmployees([]);
      setRecentTransactions([]);
      setMonthlyData(generateDefaultMonthlyData());
      setExpenseCategories(generateDefaultExpenseCategories());
      setQuickStats(DEFAULT_QUICK_STATS);
    } finally {
      setLoading(false);
    }
  };

  // توليد بيانات شهرية افتراضية
  const generateDefaultMonthlyData = () => {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
    return months.map(month => ({
      name: month,
      income: 0,
      expenses: 0,
      salaries: 0
    }));
  };

  // توليد فئات مصروفات افتراضية
  const generateDefaultExpenseCategories = () => {
    const categories = [
      'رواتب', 'مرافق', 'تسويق', 'تطوير', 'صيانة', 'أخرى'
    ];
    return categories.map((category, index) => ({
      name: category,
      value: 0,
      color: EXPENSE_CATEGORIES_COLORS[index % EXPENSE_CATEGORIES_COLORS.length]
    }));
  };

  useEffect(() => {
    fetchDashboardData();
    fetchActiveEmployees();
  }, []);

  // بطاقة الإحصائيات
  const StatCard = ({ title, value, change, icon: Icon, positive, color = 'blue' }) => {
    const colorMap = {
      green: { bg: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', val: 'text-green-700 dark:text-green-300', label: 'text-green-600 dark:text-green-400' },
      red: { bg: 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10', icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400', val: 'text-red-700 dark:text-red-300', label: 'text-red-600 dark:text-red-400' },
      blue: { bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', val: 'text-blue-700 dark:text-blue-300', label: 'text-blue-600 dark:text-blue-400' },
      orange: { bg: 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400', val: 'text-orange-700 dark:text-orange-300', label: 'text-orange-600 dark:text-orange-400' },
    }
    const c = colorMap[color]
    return (
      <Card className={`bg-gradient-to-br ${c.bg} border border-gray-200/60 dark:border-gray-700/60 overflow-hidden rounded-xl`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${c.label}`}>{title}</CardTitle>
          <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${c.val}`}>
            {typeof value === 'number' && (title.includes('إيرادات') || title.includes('مصروفات')) ? formatCurrency(value) : value}
          </div>
          {change !== undefined && (
            <p className={`text-xs flex items-center gap-1 mt-1.5 ${positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change)}% من الشهر الماضي
            </p>
          )}
        </CardContent>
      </Card>
    )
  };

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
          onClick={fetchDashboardData} 
          className="mt-3 bg-red-600 hover:bg-red-700"
        >
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* رأس الصفحة */}
      <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">لوحة التحكم</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">نظرة شاملة على الوضع المالي</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 text-sm sm:text-base rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">تقرير شهري</span>
              <span className="sm:hidden">تقرير</span>
            </Button>
            <Button className="gap-2 text-sm sm:text-base rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تصدير البيانات</span>
              <span className="sm:hidden">تصدير</span>
            </Button>
          </div>
        </div>
      </div>

      {/* الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard title="إجمالي الإيرادات" value={stats.totalRevenue} change={stats.revenueChange} icon={DollarSign} positive={stats.revenueChange > 0} color="green" />
        <StatCard title="إجمالي المصروفات" value={stats.totalExpenses} change={stats.expensesChange} icon={TrendingDown} positive={stats.expensesChange < 0} color="red" />
        <StatCard title="عدد الموظفين" value={stats.totalEmployees} icon={Users} color="blue" />
        <StatCard title="رواتب معلقة" value={stats.pendingPayrolls} icon={AlertTriangle} color="orange" />
      </div>

      {/* الموظفين النشطين */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-500 dark:text-green-400" />
                الموظفين النشطين
              </CardTitle>
              <CardDescription>الموظفين المسجلين حضور اليوم</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {activeEmployees.filter(emp => emp.status === 'حاضر').length} حاضر
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {activeEmployees.filter(emp => emp.status === 'في اجتماع').length} في اجتماع
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  {activeEmployees.filter(emp => emp.location === 'العمل عن بُعد').length} عن بُعد
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeEmployees.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeEmployees.map((employee) => (
                  <div
                    key={`employee-${employee.id}`}
                    className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* حالة الموظف */}
                    <div className="absolute top-3 right-3">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        employee.status === 'حاضر' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : employee.status === 'في اجتماع'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          employee.status === 'حاضر' ? 'bg-green-500' 
                          : employee.status === 'في اجتماع' ? 'bg-blue-500' 
                          : 'bg-orange-500'
                        }`}></div>
                        {employee.status}
                      </div>
                    </div>

                    {/* معلومات الموظف الأساسية */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {employee.avatarInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {employee.name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {employee.position}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {employee.department}
                        </p>
                      </div>
                    </div>

                    {/* تفاصيل الحضور */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">وقت الوصول:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{employee.checkInTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">الموقع:</span>
                        <span className="font-medium text-gray-900 dark:text-white truncate">{employee.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Wifi className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">آخر نشاط:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{employee.lastActivity}</span>
                      </div>
                    </div>

                    {/* إحصائيات العمل */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 mb-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400">ساعات العمل اليوم</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {parseFloat(employee.workingHours) || 0} ساعة
                        </span>
                      </div>
                    </div>

                    {/* أزرار التواصل */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-7 border-gray-300 dark:border-gray-600"
                      >
                        <Phone className="w-3 h-3" />
                        اتصال
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-7 border-gray-300 dark:border-gray-600"
                      >
                        <Mail className="w-3 h-3" />
                        إيميل
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* إحصائيات سريعة للحضور */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {activeEmployees.filter(emp => emp.status === 'حاضر').length}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300 font-medium">حاضر اليوم</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {activeEmployees.length > 0 ? 
                      (activeEmployees.reduce((total, emp) => total + (parseFloat(emp.workingHours) || 0), 0) / activeEmployees.length).toFixed(1) : 
                      '0.0'}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">متوسط الساعات</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {activeEmployees.filter(emp => emp.location === 'العمل عن بُعد').length}
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">عمل عن بُعد</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.totalEmployees > 0 ? 
                      Math.round((activeEmployees.length / stats.totalEmployees) * 100) : 
                      0}%
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">معدل الحضور</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              لا يوجد موظفين نشطين حالياً
            </div>
          )}
        </CardContent>
      </Card>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* الرسم البياني الشهري */}
        <Card className="rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">الإيرادات والمصروفات الشهرية</CardTitle>
            <CardDescription>مقارنة الأداء المالي خلال الأشهر الماضية</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => `شهر ${label}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="الإيرادات" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="المصروفات" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salaries" fill="#3b82f6" name="الرواتب" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* الرسم الدائري للمصروفات */}
        <Card className="rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">توزيع المصروفات</CardTitle>
            <CardDescription>تصنيف المصروفات حسب النوع</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}
                  dataKey="value" strokeWidth={2} stroke="rgba(0,0,0,0.1)">
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`expense-cell-${index}`} fill={entry.color || EXPENSE_CATEGORIES_COLORS[index % EXPENSE_CATEGORIES_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {expenseCategories.filter(c => c.value > 0).map((cat, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color || EXPENSE_CATEGORIES_COLORS[i % EXPENSE_CATEGORIES_COLORS.length] }} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{cat.name}</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* التنبيهات والإشعارات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            التنبيهات والإشعارات
          </CardTitle>
          <CardDescription>تنبيهات مهمة تتطلب انتباهك</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={`alert-${alert.id}`}
                  className={`p-4 rounded-lg border-r-4 ${
                    alert.type === 'warning' 
                      ? 'bg-yellow-50 border-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-500' 
                      : alert.type === 'success'
                      ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500'
                      : 'bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className={`font-medium ${
                      alert.type === 'warning' 
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : alert.type === 'success'
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-blue-800 dark:text-blue-200'
                    }`}>
                      {alert.message}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      alert.priority === 'عالي' 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                        : alert.priority === 'متوسط'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              لا توجد تنبيهات حالياً
            </div>
          )}
        </CardContent>
      </Card>

      {/* أحدث المعاملات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="rounded-xl border border-gray-200/60 dark:border-gray-700/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">أحدث المعاملات</CardTitle>
            <CardDescription>آخر العمليات المالية المسجلة</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <>
                <div className="space-y-4">
                  {recentTransactions.slice(0, 5).map((transaction) => (
                    <div key={`recent-transaction-${transaction.id}`} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description || 'معاملة غير معروفة'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {transaction.transactionNumber && <span>رقم المعاملة: {transaction.transactionNumber} • </span>}
                          {transaction.date && <span>{transaction.date} • </span>}
                          {transaction.category && <span>{transaction.category}</span>}
                        </p>
                      </div>
                      <div className={`font-bold ${
                        transaction.type === 'income' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4 gap-2">
                  <Eye className="w-4 h-4" />
                  عرض كافة المعاملات
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                لا توجد معاملات حديثة
              </div>
            )}
          </CardContent>
        </Card>

        {/* إحصائيات سريعة */}
        <Card className="rounded-xl border border-gray-200/60 dark:border-gray-700/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">إحصائيات سريعة</CardTitle>
            <CardDescription>ملخص الأداء المالي الحالي</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <span className="font-medium text-blue-900 dark:text-blue-100">متوسط الراتب الشهري</span>
                <span className="font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(quickStats.avgSalary)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <span className="font-medium text-green-900 dark:text-green-100">معدل النمو الشهري</span>
                <span className="font-bold text-green-900 dark:text-green-100">
                  {quickStats.monthlyGrowth}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <span className="font-medium text-purple-900 dark:text-purple-100">إجمالي المكافآت</span>
                <span className="font-bold text-purple-900 dark:text-purple-100">
                  {formatCurrency(quickStats.totalBonuses)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <span className="font-medium text-orange-900 dark:text-orange-100">نسبة الحضور</span>
                <span className="font-bold text-orange-900 dark:text-orange-100">
                  {quickStats.attendanceRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage