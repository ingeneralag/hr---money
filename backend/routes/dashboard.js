const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// GET dashboard statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const [
      totalEmpResult,
      activeEmpResult,
      totalTransResult,
      totalClientsResult,
      pendingEmpResult,
      todayAttResult,
      incomeResult,
      expenseResult
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }).in('status', ['فعال', 'active']),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).gte('date', todayStart).lte('date', todayEnd),
      supabase.from('transactions').select('amount').eq('type', 'income'),
      supabase.from('transactions').select('amount').eq('type', 'expense')
    ]);

    const totalEmployees = totalEmpResult.count || 0;
    const activeEmployees = activeEmpResult.count || 0;
    const totalTransactions = totalTransResult.count || 0;
    const totalClients = totalClientsResult.count || 0;
    const pendingEmployees = pendingEmpResult.count || 0;
    const todayAttendance = todayAttResult.count || 0;

    const totalRevenue = (incomeResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = (expenseResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate month-over-month change
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).toISOString();
    const [lastIncomeRes, lastExpenseRes] = await Promise.all([
      supabase.from('transactions').select('amount').eq('type', 'income').gte('date', lastMonthStart).lte('date', lastMonthEnd),
      supabase.from('transactions').select('amount').eq('type', 'expense').gte('date', lastMonthStart).lte('date', lastMonthEnd),
    ]);
    const lastRevenue = (lastIncomeRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const lastExpenses = (lastExpenseRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const revenueChange = lastRevenue > 0 ? Math.round(((totalRevenue - lastRevenue) / lastRevenue) * 100) : (totalRevenue > 0 ? 100 : 0);
    const expensesChange = lastExpenses > 0 ? Math.round(((totalExpenses - lastExpenses) / lastExpenses) * 100) : (totalExpenses > 0 ? 100 : 0);

    const stats = {
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        pending: pendingEmployees,
        inactive: totalEmployees - activeEmployees
      },
      financial: {
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
        revenueChange,
        expensesChange
      },
      operations: {
        totalTransactions,
        totalClients,
        todayAttendance
      },
      attendance: {
        present: todayAttendance,
        absent: activeEmployees - todayAttendance,
        attendanceRate: activeEmployees > 0 ? Math.round(todayAttendance / activeEmployees * 100) : 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    sendError(res, 500, 'خطأ في جلب إحصائيات النظام', 'INTERNAL_ERROR', err.message);
  }
});

// GET recent activities
router.get('/activities', requireAuth, async (req, res) => {
  try {
    const activities = [];

    // Recent employee registrations
    const { data: recentEmployees, error: empErr } = await supabase
      .from('employees')
      .select('name, created_at, approval_status')
      .order('created_at', { ascending: false })
      .limit(5);
    if (empErr) throw empErr;

    (recentEmployees || []).forEach(emp => {
      activities.push({
        type: 'employee_registration',
        description: `تم تسجيل موظف جديد: ${emp.name}`,
        timestamp: emp.created_at,
        status: emp.approval_status
      });
    });

    // Recent transactions
    const { data: recentTransactions, error: transErr } = await supabase
      .from('transactions')
      .select('description, amount, type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (transErr) throw transErr;

    (recentTransactions || []).forEach(trans => {
      activities.push({
        type: 'transaction',
        description: `معاملة جديدة: ${trans.description}`,
        amount: trans.amount,
        transactionType: trans.type,
        timestamp: trans.created_at
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 10)
    });
  } catch (err) {
    console.error('Dashboard activities error:', err);
    sendError(res, 500, 'خطأ في جلب الأنشطة الأخيرة', 'INTERNAL_ERROR', err.message);
  }
});

// GET analytics data for charts
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const monthlyData = [];

    for (let i = 0; i < 6; i++) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const monthNum = startDate.getMonth() + 1;
      const yearNum = startDate.getFullYear();

      const [incomeRes, expenseRes, salariesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'income')
          .gte('date', startISO)
          .lte('date', endISO),
        supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'expense')
          .neq('category', 'رواتب')
          .gte('date', startISO)
          .lte('date', endISO),
        supabase
          .from('payroll')
          .select('net_salary')
          .eq('month', `${yearNum}-${String(monthNum).padStart(2, '0')}`)
      ]);

      const income = (incomeRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
      const expenses = (expenseRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
      const salaries = (salariesRes.data || []).reduce((sum, p) => sum + (p.net_salary || 0), 0);

      monthlyData.push({
        name: monthNames[startDate.getMonth()],
        income,
        expenses,
        salaries
      });
    }

    // Expense categories
    const { data: allExpenses, error: expErr } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('type', 'expense');
    if (expErr) throw expErr;

    // Group by category manually
    const categoryMap = {};
    (allExpenses || []).forEach(t => {
      const cat = t.category || 'أخرى';
      categoryMap[cat] = (categoryMap[cat] || 0) + (t.amount || 0);
    });

    const sortedCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const formattedExpenseCategories = sortedCategories.map(([name, value], index) => ({
      name,
      value,
      color: colors[index] || '#6b7280'
    }));

    // Quick stats
    const { data: allPayrolls, error: payErr } = await supabase
      .from('payroll')
      .select('net_salary');
    if (payErr) throw payErr;

    const avgSalary = (allPayrolls || []).length > 0
      ? Math.round((allPayrolls || []).reduce((sum, p) => sum + (p.net_salary || 0), 0) / allPayrolls.length)
      : 0;

    // Bonuses total
    const { data: allBonuses, error: bonErr } = await supabase
      .from('payroll_bonuses')
      .select('amount');
    if (bonErr) throw bonErr;
    const totalBonuses = (allBonuses || []).reduce((sum, b) => sum + (b.amount || 0), 0);

    // Attendance this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: attendanceCount, error: attErr } = await supabase
      .from('daily_attendance')
      .select('*', { count: 'exact', head: true })
      .gte('date', monthStart)
      .lte('date', now.toISOString())
      .eq('status', 'present');
    if (attErr) throw attErr;

    const { count: totalActiveEmployees, error: actErr } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .in('status', ['فعال', 'active']);
    if (actErr) throw actErr;

    const workingDays = Math.floor((now - new Date(now.getFullYear(), now.getMonth(), 1)) / (1000 * 60 * 60 * 24)) + 1;

    const quickStats = {
      avgSalary,
      monthlyGrowth: 0,
      totalBonuses,
      attendanceRate: (totalActiveEmployees || 0) > 0
        ? Math.round(((attendanceCount || 0) / ((totalActiveEmployees || 0) * workingDays)) * 100)
        : 0
    };

    res.json({
      success: true,
      data: {
        monthlyData,
        expenseCategories: formattedExpenseCategories,
        quickStats
      }
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    sendError(res, 500, 'خطأ في جلب بيانات التحليل', 'INTERNAL_ERROR', err.message);
  }
});

// GET active employees (currently present)
router.get('/active-employees', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Get active employees
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, name, position, department')
      .in('status', ['فعال', 'active']);
    if (empErr) throw empErr;

    // Get today's attendance records
    const { data: attendanceRecords, error: attErr } = await supabase
      .from('daily_attendance')
      .select('employee_id, total_hours, check_in_time')
      .gte('date', todayStart);
    if (attErr) throw attErr;

    // Build attendance map
    const attendanceMap = {};
    (attendanceRecords || []).forEach(a => {
      attendanceMap[a.employee_id] = a;
    });

    // Filter to only present employees and format
    const activeEmployees = (employees || [])
      .filter(emp => attendanceMap[emp.id])
      .map(emp => {
        const att = attendanceMap[emp.id];
        return {
          id: emp.id,
          name: emp.name,
          position: emp.position,
          department: emp.department,
          status: 'حاضر',
          location: 'المكتب',
          workingHours: att.total_hours || 0,
          checkInTime: att.check_in_time || ''
        };
      });

    res.json({
      success: true,
      data: activeEmployees
    });
  } catch (err) {
    console.error('Active employees error:', err);
    sendError(res, 500, 'خطأ في جلب بيانات الموظفين النشطين', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
