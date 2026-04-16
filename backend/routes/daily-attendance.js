const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const moment = require('moment');

// Add endpoint that matches frontend expectations: /employee/:userId/month/:month
router.get('/employee/:userId/month/:month', requireAuth, async (req, res) => {
  try {
    const { userId, month } = req.params;

    // Parse month (format: YYYY-MM)
    const [year, monthNum] = month.split('-');

    // Find employee by userId
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (empError) throw empError;
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // Redirect to existing monthly endpoint
    const monthlyData = await getMonthlyAttendanceData(employee.id, year, monthNum);

    res.json({
      success: true,
      message: 'تم جلب سجلات التأخيرات بنجاح',
      data: monthlyData.records || [],
      stats: monthlyData.stats,
      employeeName: employee.name,
      baseSalary: employee.base_salary
    });

  } catch (error) {
    console.error('خطأ في جلب سجلات التأخيرات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// الحصول على سجل التأخيرات الشهري لموظف معين
router.get('/monthly/:employeeId/:year/:month', requireAuth, async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;

    // التحقق من وجود الموظف
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    // تحديد نطاق الشهر
    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

    // البحث عن سجلات الحضور للشهر المحدد
    let { data: attendanceRecords, error: attError } = await supabase
      .from('daily_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (attError) throw attError;
    attendanceRecords = attendanceRecords || [];

    // تحديد ما إذا كان الشهر المطلوب هو الشهر الحالي
    const today = new Date();
    const currentDate = moment(`${year}-${month}-01`);
    const isCurrentMonth = currentDate.format('YYYY-MM') === moment(today).format('YYYY-MM');

    // إذا لم توجد سجلات، إنشاء سجلات افتراضية
    if (attendanceRecords.length === 0) {
      if (isCurrentMonth) {
        attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, year, month, employee.base_salary, employee.user_id);
      } else {
        attendanceRecords = await createMonthlyRecords(employeeId, year, month, employee.base_salary, employee.user_id);
      }
    } else {
      // فحص إذا كانت السجلات ناقصة
      const expectedDays = isCurrentMonth ? today.getDate() : moment(`${year}-${month}`).daysInMonth();
      if (attendanceRecords.length < expectedDays) {
        // حذف السجلات الناقصة وإعادة إنشائها
        await supabase
          .from('daily_attendance')
          .delete()
          .eq('employee_id', employeeId)
          .gte('date', startDate)
          .lte('date', endDate);

        if (isCurrentMonth) {
          attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, year, month, employee.base_salary, employee.user_id);
        } else {
          attendanceRecords = await createMonthlyRecords(employeeId, year, month, employee.base_salary, employee.user_id);
        }
      } else if (isCurrentMonth && attendanceRecords.length === expectedDays) {
        // إذا كان اليوم جديد، أضف سجل اليوم الجديد
        const lastRecordDate = moment(attendanceRecords[attendanceRecords.length - 1].date);
        const todayMoment = moment(today);

        if (todayMoment.isAfter(lastRecordDate, 'day')) {
          const startDay = lastRecordDate.clone().add(1, 'day');

          while (startDay.isSameOrBefore(todayMoment, 'day')) {
            const dateString = startDay.format('YYYY-MM-DD');
            const date = startDay.toDate();
            const dayOfWeek = date.getDay();
            // فحص العطلة الأسبوعية بناءً على الإعدادات
            const holidaySettings = await getHolidaySettings();
            const weekends = holidaySettings?.weekends || [5, 6];
            const isWeekend = weekends.includes(dayOfWeek);

            let status = 'في الوقت';

            // جلب بيانات الحضور الحقيقية من تطبيق الديسك توب فقط
            const desktopData = await getDesktopTrackingData(employee.user_id, dateString);

            // حساب التأخير والخصم
            const latenessData = calculateLatenessLogic(desktopData, employee.base_salary, isWeekend, employee.attendance_paused);

            const { data: record, error: insertError } = await supabase
              .from('daily_attendance')
              .insert({
                employee_id: employeeId,
                date: dateString,
                required_time: '09:00',
                total_hours: desktopData.totalHours,
                active_hours: desktopData.activeHours,
                total_hours_exact: desktopData.totalHoursExact || 0,
                total_minutes_exact: desktopData.totalMinutesExact || 0,
                active_hours_exact: desktopData.activeHoursExact || 0,
                active_minutes_exact: desktopData.activeMinutesExact || 0,
                total_formatted: desktopData.totalFormatted || '0 ساعة 0 دقيقة',
                active_formatted: desktopData.activeFormatted || '0 ساعة 0 دقيقة',
                total_seconds: desktopData.totalSeconds || 0,
                active_seconds: desktopData.activeSeconds || 0,
                idle_seconds: desktopData.idleSeconds || 0,
                break_seconds: desktopData.breakSeconds || 0,
                idle_hours: desktopData.idleHours || 0,
                break_hours: desktopData.breakHours || 0,
                idle_hours_exact: desktopData.idleHoursExact || 0,
                idle_minutes_exact: desktopData.idleMinutesExact || 0,
                break_hours_exact: desktopData.breakHoursExact || 0,
                break_minutes_exact: desktopData.breakMinutesExact || 0,
                idle_formatted: desktopData.idleFormatted || '0 ساعة 0 دقيقة',
                break_formatted: desktopData.breakFormatted || '0 ساعة 0 دقيقة',
                productivity: desktopData.productivity || 0,
                delay_hours: latenessData.delayHours,
                deduction_amount: latenessData.deductionAmount,
                status: isWeekend ? 'عطلة' : latenessData.status,
                is_weekend: isWeekend
              })
              .select()
              .single();

            if (insertError) throw insertError;

            attendanceRecords.push(record);

            console.log(`✅ إضافة سجل يوم جديد ${dateString}: حضور كلي=${desktopData.totalFormatted}، نشط=${desktopData.activeFormatted}، حالة=${record.status}`);

            startDay.add(1, 'day');
          }
        }
      }
    }

    // فلترة نهائية للتأكد من عدم عرض أيام مستقبلية
    if (isCurrentMonth) {
      const todayDateString = today.toISOString().split('T')[0];
      attendanceRecords = attendanceRecords.filter(record => {
        const recordDateString = typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().split('T')[0];
        return recordDateString <= todayDateString;
      });
      console.log(`🔽 Final filter: keeping ${attendanceRecords.length} records until today`);
    }

    // حساب الإحصائيات
    const stats = calculateMonthlyStats(attendanceRecords);

    res.json({
      success: true,
      message: 'تم جلب سجلات التأخيرات بنجاح',
      data: {
        records: attendanceRecords,
        stats: stats,
        employeeName: employee.name,
        baseSalary: employee.base_salary
      }
    });

  } catch (error) {
    console.error('خطأ في جلب سجلات التأخيرات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث سجل حضور يوم واحد
router.put('/update/:recordId', requireAuth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { requiredTime, status, deductionAmount } = req.body;

    // Get the record with employee data
    const { data: record, error: findError } = await supabase
      .from('daily_attendance')
      .select('*, employees(*)')
      .eq('id', recordId)
      .single();

    if (findError || !record) {
      return res.status(404).json({ message: 'السجل غير موجود' });
    }

    // تحديث البيانات
    const updateData = { updated_at: new Date().toISOString() };
    if (requiredTime !== undefined) updateData.required_time = requiredTime;
    if (status !== undefined) updateData.status = status;
    if (deductionAmount !== undefined) {
      updateData.deduction_amount = deductionAmount;
    } else {
      // إعادة حساب التأخير إذا لم يتم تحديد قيمة الخصم يدوياً
      const desktopData = {
        totalHours: record.total_hours || 0,
        totalSeconds: record.total_seconds || 0,
        activeSeconds: record.active_seconds || 0
      };
      const latenessData = calculateLatenessLogic(desktopData, record.employees?.base_salary || 0, record.is_weekend, record.employees?.attendance_paused);
      updateData.delay_hours = latenessData.delayHours;
      updateData.deduction_amount = latenessData.deductionAmount;
    }

    const { data: updated, error: updateError } = await supabase
      .from('daily_attendance')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'تم تحديث السجل بنجاح',
      data: updated
    });

  } catch (error) {
    console.error('خطأ في تحديث سجل الحضور:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إعادة إنشاء سجلات الشهر حتى اليوم الحالي
router.post('/reset-current/:employeeId/:year/:month', requireAuth, async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

    // حذف السجلات الموجودة
    await supabase
      .from('daily_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    // إنشاء سجلات جديدة حتى اليوم الحالي
    const records = await createMonthlyRecordsUntilToday(employeeId, year, month, employee.base_salary, employee.user_id);
    const stats = calculateMonthlyStats(records);

    res.json({
      success: true,
      message: 'تم إعادة إنشاء السجلات بنجاح',
      data: {
        records: records,
        stats: stats
      }
    });

  } catch (error) {
    console.error('خطأ في إعادة إنشاء السجلات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إعادة تعيين النظام من تاريخ اليوم
router.post('/reset-from-today/:employeeId', requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const startDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');

    // حذف جميع السجلات الموجودة للشهر الحالي
    await supabase
      .from('daily_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    // إنشاء سجلات جديدة من بداية الشهر حتى اليوم فقط
    const attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, currentYear, currentMonth, employee.base_salary, employee.user_id);

    const stats = calculateMonthlyStats(attendanceRecords);

    res.json({
      success: true,
      message: 'تم إعادة تعيين النظام من تاريخ اليوم بنجاح',
      data: {
        records: attendanceRecords,
        stats: stats
      }
    });

  } catch (error) {
    console.error('خطأ في إعادة تعيين النظام:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إعادة توليد بيانات الشهر بالكامل
router.post('/regenerate/:employeeId/:year/:month', requireAuth, async (req, res) => {
  try {
    const { employeeId, year, month } = req.params;

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

    // حذف جميع السجلات الموجودة للشهر
    await supabase
      .from('daily_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    // إنشاء سجلات جديدة
    const attendanceRecords = await createMonthlyRecords(employeeId, year, month, employee.base_salary, employee.user_id);

    const stats = calculateMonthlyStats(attendanceRecords);

    res.json({
      success: true,
      message: 'تم إعادة توليد بيانات الشهر بنجاح',
      data: {
        records: attendanceRecords,
        stats: stats
      }
    });

  } catch (error) {
    console.error('خطأ في إعادة توليد البيانات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث عدة سجلات دفعة واحدة
router.put('/bulk-update', requireAuth, async (req, res) => {
  try {
    const { records } = req.body;

    const updatePromises = records.map(async (recordData) => {
      const { data: record, error: findError } = await supabase
        .from('daily_attendance')
        .select('*, employees(*)')
        .eq('id', recordData.id)
        .single();

      if (findError || !record) return null;

      const updateData = { updated_at: new Date().toISOString() };
      if (recordData.requiredTime !== undefined) updateData.required_time = recordData.requiredTime;
      if (recordData.status !== undefined) updateData.status = recordData.status;
      if (recordData.deductionAmount !== undefined) {
        updateData.deduction_amount = recordData.deductionAmount;
      } else {
        const desktopData = {
          totalHours: record.total_hours || 0,
          totalSeconds: record.total_seconds || 0,
          activeSeconds: record.active_seconds || 0
        };
        const latenessData = calculateLatenessLogic(desktopData, record.employees?.base_salary || 0, record.is_weekend, record.employees?.attendance_paused);
        updateData.delay_hours = latenessData.delayHours;
        updateData.deduction_amount = latenessData.deductionAmount;
      }

      const { data: updated, error: updateError } = await supabase
        .from('daily_attendance')
        .update(updateData)
        .eq('id', recordData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    });

    const updatedRecords = await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'تم تحديث السجلات بنجاح',
      data: updatedRecords.filter(r => r !== null)
    });

  } catch (error) {
    console.error('خطأ في تحديث السجلات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث جميع سجلات الشهر الحالي من بيانات التطبيق
router.post('/sync-month/:employeeId', requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ message: 'الموظف غير موجود' });
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const todayString = today.toISOString().split('T')[0];

    // فحص أمني: التأكد من عدم تعديل أشهر مستقبلية
    const requestedMonthString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const currentMonthString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    if (requestedMonthString > currentMonthString) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تحديث بيانات شهر مستقبلي'
      });
    }

    console.log(`🔄 تحديث مباشر لجميع سجلات شهر ${currentMonth}/${currentYear} للموظف ${employee.name} - الشهر الحالي فقط`);

    const startDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');

    const safeEndDate = endDate > todayString ? todayString : endDate;

    console.log(`🔍 Safe date range: ${startDate} to ${safeEndDate}`);
    console.log(`📅 Today: ${todayString}, Safe end date: ${safeEndDate}`);

    // حذف السجلات الحالية للشهر الحالي حتى اليوم فقط
    const { error: deleteError } = await supabase
      .from('daily_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', safeEndDate);

    if (deleteError) throw deleteError;

    // إنشاء سجلات محدثة من بيانات التطبيق
    const attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, currentYear, currentMonth, employee.base_salary, employee.user_id);

    const stats = calculateMonthlyStats(attendanceRecords);

    console.log(`✅ تم تحديث ${attendanceRecords.length} سجل من بيانات التطبيق`);

    res.json({
      success: true,
      message: 'تم تحديث جميع سجلات الشهر من بيانات التطبيق',
      data: {
        records: attendanceRecords,
        stats: stats,
        employeeName: employee.name
      }
    });

  } catch (error) {
    console.error('خطأ في تحديث سجلات الشهر:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// Helper to get holiday settings from Supabase
async function getHolidaySettings() {
  const { data: holidaySettings, error } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'official_holidays')
    .maybeSingle();

  if (error || !holidaySettings) return { weekends: [5, 6], holidays: [], customDays: [] };
  return holidaySettings.settings || { weekends: [5, 6], holidays: [], customDays: [] };
}

// دالة مساعدة لجلب بيانات الحضور من تطبيق الديسك توب
async function getDesktopTrackingData(userId, dateString) {
  console.log(`🔍 getDesktopTrackingData called with userId: ${userId}, dateString: ${dateString}`);

  const emptyData = {
    totalHours: 0, activeHours: 0, idleHours: 0, breakHours: 0,
    totalMinutes: 0, activeMinutes: 0, idleMinutes: 0, breakMinutes: 0,
    totalHoursExact: 0, totalMinutesExact: 0, activeHoursExact: 0, activeMinutesExact: 0,
    idleHoursExact: 0, idleMinutesExact: 0, breakHoursExact: 0, breakMinutesExact: 0,
    totalFormatted: '0 ساعة 0 دقيقة', activeFormatted: '0 ساعة 0 دقيقة',
    idleFormatted: '0 ساعة 0 دقيقة', breakFormatted: '0 ساعة 0 دقيقة',
    totalSeconds: 0, activeSeconds: 0, idleSeconds: 0, breakSeconds: 0,
    productivity: 0
  };

  if (!userId) {
    console.log('❌ No userId provided, returning empty data');
    return emptyData;
  }

  // Additional safety check: ensure we're not looking for future dates
  const currentDate = new Date().toISOString().split('T')[0];
  if (dateString > currentDate) {
    console.log(`⚠️ Requested date ${dateString} is in the future (current: ${currentDate}), returning empty data`);
    return emptyData;
  }

  try {
    console.log(`🔍 Searching for tracking data with userId: ${userId}, dateString: ${dateString}`);

    // Try finding by user_id first, then by employee_id
    let { data: tracking, error } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('date_string', dateString)
      .maybeSingle();

    if (error) throw error;

    if (!tracking) {
      const { data: tracking2, error: error2 } = await supabase
        .from('tracking')
        .select('*')
        .eq('employee_id', userId)
        .eq('date_string', dateString)
        .maybeSingle();

      if (error2) throw error2;
      tracking = tracking2;
    }

    console.log(`📊 Tracking query result:`, tracking ? 'Found' : 'Not found');

    if (tracking) {
      // فحص أمني نهائي: التأكد من أن البيانات المسترجعة هي للتاريخ المطلوب بالضبط
      if (tracking.date_string !== dateString) {
        console.log(`⚠️ WARNING: Requested data for ${dateString} but got data for ${tracking.date_string}. Returning empty data.`);
        return emptyData;
      }

      // تحويل البيانات من ثوانٍ إلى ساعات ودقائق
      const totalSeconds = tracking.total_seconds || 0;
      const activeSeconds = tracking.active_seconds || 0;
      const idleSeconds = tracking.idle_seconds || 0;
      const breakSeconds = tracking.break_seconds || 0;

      const totalHours = Math.floor(totalSeconds / 3600);
      const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
      const totalHoursDecimal = totalSeconds / 3600;

      const activeHours = Math.floor(activeSeconds / 3600);
      const activeMinutes = Math.floor((activeSeconds % 3600) / 60);
      const activeHoursDecimal = activeSeconds / 3600;

      const idleHoursVal = Math.floor(idleSeconds / 3600);
      const idleMinutesVal = Math.floor((idleSeconds % 3600) / 60);
      const idleHoursDecimal = idleSeconds / 3600;

      const breakHoursVal = Math.floor(breakSeconds / 3600);
      const breakMinutesVal = Math.floor((breakSeconds % 3600) / 60);
      const breakHoursDecimal = breakSeconds / 3600;

      const formatHoursMinutes = (hrs, mins) => {
        if (hrs === 0 && mins === 0) return '0 ساعة 0 دقيقة';
        let result = '';
        if (hrs > 0) result += `${hrs} ساعة`;
        if (mins > 0) {
          if (hrs > 0) result += ' ';
          result += `${mins} دقيقة`;
        }
        return result || '0 ساعة 0 دقيقة';
      };

      const totalFormatted = formatHoursMinutes(totalHours, totalMinutes);
      const activeFormatted = formatHoursMinutes(activeHours, activeMinutes);
      const idleFormatted = formatHoursMinutes(idleHoursVal, idleMinutesVal);
      const breakFormatted = formatHoursMinutes(breakHoursVal, breakMinutesVal);

      const productivity = totalSeconds > 0 ? Math.round((activeSeconds / totalSeconds) * 100) : 0;

      console.log(`📊 بيانات التطبيق لتاريخ ${dateString}:`, {
        totalSeconds, activeSeconds, idleSeconds, breakSeconds, productivity,
        totalTime: totalFormatted, activeTime: activeFormatted
      });

      return {
        totalHours: Math.round(totalHoursDecimal * 100) / 100,
        activeHours: Math.round(activeHoursDecimal * 100) / 100,
        idleHours: Math.round(idleHoursDecimal * 100) / 100,
        breakHours: Math.round(breakHoursDecimal * 100) / 100,
        totalMinutes: totalHours * 60 + totalMinutes,
        activeMinutes: activeHours * 60 + activeMinutes,
        idleMinutes: idleHoursVal * 60 + idleMinutesVal,
        breakMinutes: breakHoursVal * 60 + breakMinutesVal,
        totalHoursExact: totalHours,
        totalMinutesExact: totalMinutes,
        activeHoursExact: activeHours,
        activeMinutesExact: activeMinutes,
        idleHoursExact: idleHoursVal,
        idleMinutesExact: idleMinutesVal,
        breakHoursExact: breakHoursVal,
        breakMinutesExact: breakMinutesVal,
        totalFormatted, activeFormatted, idleFormatted, breakFormatted,
        totalSeconds, activeSeconds, idleSeconds, breakSeconds,
        productivity
      };
    }
  } catch (error) {
    console.error('خطأ في جلب بيانات التتبع:', error);
  }

  console.log(`⚠️ لا توجد بيانات في التطبيق لتاريخ ${dateString}`);
  return emptyData;
}

// Logic to calculate lateness (replaces Mongoose method calculateLateness)
function calculateLatenessLogic(desktopData, baseSalary, isWeekend, attendancePaused = false) {
  if (isWeekend) {
    return { delayHours: 0, deductionAmount: 0, status: 'عطلة' };
  }

  // لو الحضور متوقف، مفيش خصومات
  if (attendancePaused) {
    const totalHours = desktopData.totalHours || (desktopData.totalSeconds || 0) / 3600;
    return { delayHours: 0, deductionAmount: 0, status: totalHours > 0 ? 'في الوقت' : 'معلق' };
  }

  const totalHours = desktopData.totalHours || (desktopData.totalSeconds || 0) / 3600;
  const requiredHours = 9; // Default required time

  if (totalHours <= 0) {
    return { delayHours: requiredHours, deductionAmount: 0, status: 'غائب' };
  }

  if (totalHours >= requiredHours) {
    return { delayHours: 0, deductionAmount: 0, status: 'في الوقت' };
  }

  const delayHours = Math.round((requiredHours - totalHours) * 100) / 100;
  const hourlyRate = baseSalary ? baseSalary / 30 / requiredHours : 0;
  const deductionAmount = Math.round(delayHours * hourlyRate * 100) / 100;

  return { delayHours, deductionAmount, status: 'متأخر' };
}

async function createMonthlyRecords(employeeId, year, month, baseSalary, userId, attendancePaused = false) {
  const records = [];
  const daysInMonth = moment(`${year}-${month}`).daysInMonth();

  console.log(`📅 إنشاء سجلات شهرية لـ ${daysInMonth} يوم في ${year}-${month}`);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = moment(`${year}-${month}-${day.toString().padStart(2, '0')}`).toDate();
    const dayOfWeek = date.getDay();
    const holidaySettings = await getHolidaySettings();
    const weekends = holidaySettings?.weekends || [5, 6];
    const isWeekend = weekends.includes(dayOfWeek);
    const dateString = date.toISOString().split('T')[0];

    const desktopData = await getDesktopTrackingData(userId, dateString);
    const latenessData = calculateLatenessLogic(desktopData, baseSalary, isWeekend, attendancePaused);

    const { data: record, error } = await supabase
      .from('daily_attendance')
      .insert({
        employee_id: employeeId,
        date: dateString,
        required_time: '09:00',
        total_hours: desktopData.totalHours,
        active_hours: desktopData.activeHours,
        total_hours_exact: desktopData.totalHoursExact || 0,
        total_minutes_exact: desktopData.totalMinutesExact || 0,
        active_hours_exact: desktopData.activeHoursExact || 0,
        active_minutes_exact: desktopData.activeMinutesExact || 0,
        total_formatted: desktopData.totalFormatted || '0 ساعة 0 دقيقة',
        active_formatted: desktopData.activeFormatted || '0 ساعة 0 دقيقة',
        total_seconds: desktopData.totalSeconds || 0,
        active_seconds: desktopData.activeSeconds || 0,
        idle_seconds: desktopData.idleSeconds || 0,
        break_seconds: desktopData.breakSeconds || 0,
        idle_hours: desktopData.idleHours || 0,
        break_hours: desktopData.breakHours || 0,
        idle_hours_exact: desktopData.idleHoursExact || 0,
        idle_minutes_exact: desktopData.idleMinutesExact || 0,
        break_hours_exact: desktopData.breakHoursExact || 0,
        break_minutes_exact: desktopData.breakMinutesExact || 0,
        idle_formatted: desktopData.idleFormatted || '0 ساعة 0 دقيقة',
        break_formatted: desktopData.breakFormatted || '0 ساعة 0 دقيقة',
        productivity: desktopData.productivity || 0,
        delay_hours: latenessData.delayHours,
        deduction_amount: latenessData.deductionAmount,
        status: isWeekend ? 'عطلة' : latenessData.status,
        is_weekend: isWeekend
      })
      .select()
      .single();

    if (error) throw error;
    records.push(record);

    console.log(`✅ سجل ${dateString}: حضور كلي=${desktopData.totalFormatted}، نشط=${desktopData.activeFormatted}، حالة=${record.status}`);
  }

  console.log(`🎯 تم إنشاء ${records.length} سجل بنجاح`);
  return records;
}

// دالة لحساب الإحصائيات الشهرية
function calculateMonthlyStats(records) {
  const workDays = records.filter(r => !r.is_weekend && !(r.status || '').includes('عطلة') && !(r.status || '').includes('إجازة'));
  const onTimeDays = records.filter(r => r.status === 'في الوقت').length;
  const lateDays = records.filter(r => r.status === 'متأخر').length;
  const absentDays = records.filter(r => r.status === 'غائب').length;
  const leaveDays = records.filter(r => r.status === 'إجازة' || r.status === 'مهمة خارجية').length;
  const weekendDays = records.filter(r => r.is_weekend || (r.status || '').includes('عطلة') || (r.status || '').includes('إجازة')).length;

  const totalDelayHours = records.reduce((sum, r) => sum + (r.delay_hours || r.delayHours || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + (r.deduction_amount || r.deductionAmount || 0), 0);

  const attendanceRate = workDays.length > 0 ? Math.round(((onTimeDays + lateDays) / workDays.length) * 100) : 0;

  return {
    totalDays: records.length,
    workDays: workDays.length,
    onTimeDays,
    lateDays,
    absentDays,
    leaveDays,
    weekendDays,
    totalDelayHours: Math.round(totalDelayHours * 100) / 100,
    totalDeductions,
    attendanceRate
  };
}

async function createMonthlyRecordsUntilToday(employeeId, year, month, baseSalary, userId) {
  const records = [];
  const today = new Date();
  const currentDate = moment(`${year}-${month}-01`);
  const isCurrentMonth = currentDate.format('YYYY-MM') === moment(today).format('YYYY-MM');

  const daysToGenerate = isCurrentMonth ? today.getDate() : currentDate.daysInMonth();

  console.log(`📅 إنشاء سجلات شهرية حتى اليوم لـ ${daysToGenerate} يوم في ${year}-${month}`);

  for (let day = 1; day <= daysToGenerate; day++) {
    const date = moment(`${year}-${month}-${day.toString().padStart(2, '0')}`).toDate();
    const dayOfWeek = date.getDay();
    const holidaySettings = await getHolidaySettings();
    const weekends = holidaySettings?.weekends || [5, 6];
    const isWeekend = weekends.includes(dayOfWeek);
    const dateString = date.toISOString().split('T')[0];

    const desktopData = await getDesktopTrackingData(userId, dateString);
    const latenessData = calculateLatenessLogic(desktopData, baseSalary, isWeekend, attendancePaused);

    const { data: record, error } = await supabase
      .from('daily_attendance')
      .insert({
        employee_id: employeeId,
        date: dateString,
        required_time: '09:00',
        total_hours: desktopData.totalHours,
        active_hours: desktopData.activeHours,
        total_hours_exact: desktopData.totalHoursExact || 0,
        total_minutes_exact: desktopData.totalMinutesExact || 0,
        active_hours_exact: desktopData.activeHoursExact || 0,
        active_minutes_exact: desktopData.activeMinutesExact || 0,
        total_formatted: desktopData.totalFormatted || '0 ساعة 0 دقيقة',
        active_formatted: desktopData.activeFormatted || '0 ساعة 0 دقيقة',
        total_seconds: desktopData.totalSeconds || 0,
        active_seconds: desktopData.activeSeconds || 0,
        idle_seconds: desktopData.idleSeconds || 0,
        break_seconds: desktopData.breakSeconds || 0,
        idle_hours: desktopData.idleHours || 0,
        break_hours: desktopData.breakHours || 0,
        idle_hours_exact: desktopData.idleHoursExact || 0,
        idle_minutes_exact: desktopData.idleMinutesExact || 0,
        break_hours_exact: desktopData.breakHoursExact || 0,
        break_minutes_exact: desktopData.breakMinutesExact || 0,
        idle_formatted: desktopData.idleFormatted || '0 ساعة 0 دقيقة',
        break_formatted: desktopData.breakFormatted || '0 ساعة 0 دقيقة',
        productivity: desktopData.productivity || 0,
        delay_hours: latenessData.delayHours,
        deduction_amount: latenessData.deductionAmount,
        status: isWeekend ? 'عطلة' : latenessData.status,
        is_weekend: isWeekend
      })
      .select()
      .single();

    if (error) throw error;
    records.push(record);

    console.log(`✅ سجل ${dateString}: حضور كلي=${desktopData.totalFormatted}، نشط=${desktopData.activeFormatted}، حالة=${record.status}`);
  }

  console.log(`🎯 تم إنشاء ${records.length} سجل حتى اليوم بنجاح`);
  return records;
}

// إضافة route جديد لتحديث سجلات اليوم التلقائي لجميع الموظفين
router.post('/auto-update-daily', requireAuth, async (req, res) => {
  try {
    console.log('🔄 بدء التحديث التلقائي للسجلات اليومية...');

    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('approval_status', 'approved');

    if (empError) throw empError;

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const results = [];
    const errors = [];

    for (const employee of (employees || [])) {
      try {
        // البحث عن سجل اليوم
        const { data: dailyRecord, error: findError } = await supabase
          .from('daily_attendance')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('date', todayString)
          .maybeSingle();

        if (findError) throw findError;

        // جلب بيانات الحضور الحقيقية من التطبيق
        const desktopData = await getDesktopTrackingData(employee.user_id, todayString);

        const dayOfWeek = today.getDay();
        const holidaySettings = await getHolidaySettings();
        const weekends = holidaySettings?.weekends || [5, 6];
        const isWeekend = weekends.includes(dayOfWeek);

        // فحص الإجازات المعتمدة لهذا اليوم
        const isHoliday = await checkIfHoliday(todayString);

        if (dailyRecord) {
          // تحديث السجل الموجود
          const updateData = {
            total_hours: desktopData.totalHours,
            active_hours: desktopData.activeHours,
            total_hours_exact: desktopData.totalHoursExact || 0,
            total_minutes_exact: desktopData.totalMinutesExact || 0,
            active_hours_exact: desktopData.activeHoursExact || 0,
            active_minutes_exact: desktopData.activeMinutesExact || 0,
            total_formatted: desktopData.totalFormatted || '0 ساعة 0 دقيقة',
            active_formatted: desktopData.activeFormatted || '0 ساعة 0 دقيقة',
            total_seconds: desktopData.totalSeconds || 0,
            active_seconds: desktopData.activeSeconds || 0,
            updated_at: new Date().toISOString()
          };

          if (isWeekend) {
            updateData.status = 'عطلة';
            updateData.is_weekend = true;
          } else if (isHoliday) {
            updateData.status = 'إجازة';
            updateData.is_weekend = false;
          } else {
            updateData.is_weekend = false;
            const latenessData = calculateLatenessLogic(desktopData, employee.base_salary, false, employee.attendance_paused);
            updateData.delay_hours = latenessData.delayHours;
            updateData.deduction_amount = latenessData.deductionAmount;
            updateData.status = latenessData.status;
          }

          await supabase
            .from('daily_attendance')
            .update(updateData)
            .eq('id', dailyRecord.id);

          results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            action: 'updated',
            totalHours: desktopData.totalHours,
            activeHours: desktopData.activeHours,
            status: updateData.status
          });
        } else {
          // إنشاء سجل جديد
          let status = 'في الوقت';
          if (isWeekend) status = 'عطلة';
          else if (isHoliday) status = 'إجازة';

          const latenessData = (!isWeekend && !isHoliday)
            ? calculateLatenessLogic(desktopData, employee.base_salary, false, employee.attendance_paused)
            : { delayHours: 0, deductionAmount: 0, status };

          const { error: insertError } = await supabase
            .from('daily_attendance')
            .insert({
              employee_id: employee.id,
              date: todayString,
              required_time: '09:00',
              total_hours: desktopData.totalHours,
              active_hours: desktopData.activeHours,
              total_hours_exact: desktopData.totalHoursExact || 0,
              total_minutes_exact: desktopData.totalMinutesExact || 0,
              active_hours_exact: desktopData.activeHoursExact || 0,
              active_minutes_exact: desktopData.activeMinutesExact || 0,
              total_formatted: desktopData.totalFormatted || '0 ساعة 0 دقيقة',
              active_formatted: desktopData.activeFormatted || '0 ساعة 0 دقيقة',
              total_seconds: desktopData.totalSeconds || 0,
              active_seconds: desktopData.activeSeconds || 0,
              delay_hours: latenessData.delayHours,
              deduction_amount: latenessData.deductionAmount,
              status: latenessData.status,
              is_weekend: isWeekend
            });

          if (insertError) throw insertError;

          results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            action: 'created',
            totalHours: desktopData.totalHours,
            activeHours: desktopData.activeHours,
            status: latenessData.status
          });
        }

      } catch (error) {
        console.error(`خطأ في تحديث سجل ${employee.name}:`, error);
        errors.push({
          employeeId: employee.id,
          employeeName: employee.name,
          error: error.message
        });
      }
    }

    console.log(`✅ تم تحديث سجلات ${results.length} موظف، أخطاء: ${errors.length}`);

    res.json({
      success: true,
      message: `تم تحديث سجلات اليوم لـ ${results.length} موظف`,
      data: {
        updated: results.length,
        errors: errors.length,
        results: results,
        errorDetails: errors
      }
    });

  } catch (error) {
    console.error('خطأ في التحديث التلقائي:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إضافة route لإدارة الإجازات الرسمية
router.get('/holidays', requireAuth, async (req, res) => {
  try {
    const { data: holidays, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'official_holidays')
      .maybeSingle();

    if (error) throw error;

    if (!holidays) {
      // إنشاء إعدادات افتراضية للإجازات
      const defaultSettings = {
        holidays: [
          { name: 'رأس السنة الميلادية', date: '2024-01-01', type: 'fixed' },
          { name: 'عيد الثورة', date: '2024-01-25', type: 'fixed' },
          { name: 'شم النسيم', date: '2024-05-06', type: 'variable' },
          { name: 'عيد العمال', date: '2024-05-01', type: 'fixed' },
          { name: 'عيد الفطر', date: '2024-04-10', type: 'islamic', duration: 3 },
          { name: 'عيد الأضحى', date: '2024-06-16', type: 'islamic', duration: 4 },
          { name: 'رأس السنة الهجرية', date: '2024-07-07', type: 'islamic' },
          { name: 'المولد النبوي', date: '2024-09-15', type: 'islamic' },
          { name: 'عيد 23 يوليو', date: '2024-07-23', type: 'fixed' },
          { name: 'عيد 6 أكتوبر', date: '2024-10-06', type: 'fixed' }
        ],
        weekends: [5, 6],
        customDays: []
      };

      await supabase
        .from('settings')
        .insert({
          id: 'official_holidays',
          category: 'attendance',
          settings: defaultSettings
        });

      return res.json({ success: true, data: defaultSettings });
    }

    res.json({ success: true, data: holidays.settings });
  } catch (error) {
    console.error('خطأ في جلب الإجازات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إضافة route لتحديث الإجازات الرسمية
router.post('/holidays', requireAuth, async (req, res) => {
  try {
    const { holidays, weekends, customDays } = req.body;

    const holidaySettings = {
      holidays: holidays || [],
      weekends: weekends || [5, 6],
      customDays: customDays || []
    };

    await supabase
      .from('settings')
      .upsert({
        id: 'official_holidays',
        category: 'attendance',
        settings: holidaySettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    res.json({
      success: true,
      message: 'تم تحديث إعدادات الإجازات بنجاح',
      data: holidaySettings
    });
  } catch (error) {
    console.error('خطأ في تحديث الإجازات:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إضافة endpoint جديد لجلب السجلات اليومية للمستخدم
router.get('/user-records/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;

    console.log('🔍 Daily attendance records request for userId:', userId);

    // البحث عن الموظف باستخدام userId
    let { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (empError) throw empError;

    console.log('👤 Found employee:', employee ? employee.name : 'Not found');

    if (!employee) {
      // محاولة البحث بالمعرف مباشرة
      const { data: emp2, error: emp2Error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!emp2Error && emp2) {
        employee = emp2;
      }
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود في النظام'
      });
    }

    // حساب نطاق التاريخ المطلوب
    let endDate, startDate;

    if (month) {
      const [year, monthNum] = month.split('-');
      startDate = `${year}-${monthNum.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      endDate = `${year}-${monthNum.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      console.log('📅 Filtering by month:', month, 'from', startDate, 'to', endDate);
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 13);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
      console.log('📅 Using default 14-day range');
    }

    console.log('📅 Searching for data between:', startDate, 'and', endDate);

    // جلب السجلات الموجودة
    const { data: existingRecords, error: recError } = await supabase
      .from('daily_attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (recError) throw recError;

    console.log('📊 Found existing daily attendance records:', (existingRecords || []).length);

    // إنشاء سجل للفترة المطلوبة
    const dailyRecords = [];
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const timeDiff = endDateObj.getTime() - startDateObj.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    for (let i = 0; i < daysDiff; i++) {
      const currentDate = new Date(startDateObj);
      currentDate.setDate(startDateObj.getDate() + i);

      const dateString = currentDate.toISOString().split('T')[0];
      const holidaySettings = await getHolidaySettings();
      const weekends = holidaySettings?.weekends || [5, 6];
      const isWeekend = weekends.includes(currentDate.getDay());
      const isToday = dateString === new Date().toISOString().split('T')[0];

      // البحث عن سجل هذا اليوم
      const existingRecord = (existingRecords || []).find(record => {
        const recordDate = typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().split('T')[0];
        return recordDate === dateString;
      });

      // فحص العطل الرسمية لهذا التاريخ
      const holidayCheck = await checkIfHoliday(dateString);
      const isHoliday = holidayCheck && holidayCheck.isHoliday;

      let dailyRecord = {
        date: dateString,
        day: currentDate.toLocaleDateString('ar', { weekday: 'long' }),
        hijriDate: currentDate.toLocaleDateString('ar-EG-u-ca-islamic', {
          day: '2-digit',
          month: 'short'
        }),
        isWeekend: isWeekend,
        isHoliday: isHoliday,
        isToday: isToday,
        hasRealData: false,
        totalHours: 0,
        activeHours: 0,
        totalSeconds: 0,
        activeSeconds: 0,
        totalFormatted: '0د',
        activeFormatted: '0د',
        delayHours: 0,
        deductionAmount: 0,
        status: isWeekend ? 'عطلة' : (isHoliday ? 'إجازة' : 'غائب'),
        productivity: 0
      };

      if (existingRecord) {
        dailyRecord = {
          ...dailyRecord,
          id: existingRecord.id,
          hasRealData: ((existingRecord.total_seconds || 0) > 0 || (existingRecord.total_hours || 0) > 0),
          totalHours: existingRecord.total_hours || 0,
          activeHours: existingRecord.active_hours || 0,
          totalSeconds: existingRecord.total_seconds || 0,
          activeSeconds: existingRecord.active_seconds || 0,
          totalFormatted: existingRecord.total_formatted || '0د',
          activeFormatted: existingRecord.active_formatted || '0د',
          delayHours: existingRecord.delay_hours || 0,
          deductionAmount: existingRecord.deduction_amount || 0,
          status: isWeekend ? 'عطلة' : (isHoliday ? 'إجازة' : ((existingRecord.total_hours || 0) > 0 ? (existingRecord.status || 'في الوقت') : 'غائب')),
          productivity: existingRecord.active_seconds && existingRecord.total_seconds ?
            Math.round((existingRecord.active_seconds / existingRecord.total_seconds) * 100) : 0
        };
      } else if (isToday || (currentDate <= new Date() && !isWeekend)) {
        try {
          console.log(`✨ Creating missing record for ${dateString}...`);

          let recordStatus = 'في الوقت';
          if (isWeekend) recordStatus = 'عطلة';
          else if (isHoliday) recordStatus = 'إجازة';

          const desktopData = await getDesktopTrackingData(employee.user_id, dateString);
          if (!desktopData.totalSeconds && !isHoliday && !isWeekend) {
            recordStatus = 'غائب';
          }

          const latenessData = (!isWeekend && !isHoliday)
            ? calculateLatenessLogic(desktopData, employee.base_salary, false, employee.attendance_paused)
            : { delayHours: 0, deductionAmount: 0, status: recordStatus };

          const { data: newRecord, error: insertError } = await supabase
            .from('daily_attendance')
            .insert({
              employee_id: employee.id,
              date: dateString,
              required_time: '09:00',
              total_hours: desktopData.totalHours || 0,
              active_hours: desktopData.activeHours || 0,
              idle_hours: desktopData.idleHours || 0,
              break_hours: desktopData.breakHours || 0,
              total_hours_exact: desktopData.totalHoursExact || 0,
              total_minutes_exact: desktopData.totalMinutesExact || 0,
              active_hours_exact: desktopData.activeHoursExact || 0,
              active_minutes_exact: desktopData.activeMinutesExact || 0,
              idle_hours_exact: desktopData.idleHoursExact || 0,
              idle_minutes_exact: desktopData.idleMinutesExact || 0,
              break_hours_exact: desktopData.breakHoursExact || 0,
              break_minutes_exact: desktopData.breakMinutesExact || 0,
              total_formatted: desktopData.totalFormatted || '0د',
              active_formatted: desktopData.activeFormatted || '0د',
              idle_formatted: desktopData.idleFormatted || '0د',
              break_formatted: desktopData.breakFormatted || '0د',
              total_seconds: desktopData.totalSeconds || 0,
              active_seconds: desktopData.activeSeconds || 0,
              idle_seconds: desktopData.idleSeconds || 0,
              break_seconds: desktopData.breakSeconds || 0,
              productivity: desktopData.productivity || 0,
              delay_hours: latenessData.delayHours,
              deduction_amount: latenessData.deductionAmount,
              status: (!isWeekend && !isHoliday) ? latenessData.status : recordStatus,
              is_weekend: isWeekend
            })
            .select()
            .single();

          if (!insertError && newRecord) {
            console.log(`✅ Created record for ${dateString} - Status: ${newRecord.status}`);

            dailyRecord = {
              ...dailyRecord,
              id: newRecord.id,
              hasRealData: ((newRecord.total_seconds || 0) > 0 || (newRecord.total_hours || 0) > 0),
              totalHours: newRecord.total_hours,
              activeHours: newRecord.active_hours,
              totalSeconds: newRecord.total_seconds || 0,
              activeSeconds: newRecord.active_seconds || 0,
              totalFormatted: newRecord.total_formatted,
              activeFormatted: newRecord.active_formatted,
              delayHours: newRecord.delay_hours,
              deductionAmount: newRecord.deduction_amount,
              status: newRecord.status,
              productivity: newRecord.active_seconds && newRecord.total_seconds ?
                Math.round((newRecord.active_seconds / newRecord.total_seconds) * 100) : 0
            };
          }
        } catch (error) {
          console.error(`❌ Error creating record for ${dateString}:`, error.message);
        }
      }

      dailyRecords.push(dailyRecord);
    }

    console.log('📋 Generated daily records:', dailyRecords.length);

    // حساب الإحصائيات
    const workingDays = dailyRecords.filter(day =>
      !day.isWeekend &&
      !day.isHoliday &&
      !(day.status || '').includes('عطلة') &&
      !(day.status || '').includes('إجازة') &&
      day.status !== 'مهمة خارجية'
    );
    const presentDays = workingDays.filter(day => day.totalHours > 0);
    const totalWorkTime = workingDays.reduce((sum, day) => sum + (day.totalHours || 0), 0);
    const totalActiveTime = workingDays.reduce((sum, day) => sum + (day.activeHours || 0), 0);
    const averageProductivity = presentDays.length > 0 ?
      presentDays.reduce((sum, day) => sum + (day.productivity || 0), 0) / presentDays.length : 0;

    const summary = {
      totalWorkingDays: workingDays.length,
      presentDays: presentDays.length,
      absentDays: workingDays.length - presentDays.length,
      totalWorkTime: Math.round(totalWorkTime * 10) / 10,
      totalActiveTime: Math.round(totalActiveTime * 10) / 10,
      averageProductivity: Math.round(averageProductivity)
    };

    res.json({
      success: true,
      data: {
        records: dailyRecords,
        count: dailyRecords.length
      },
      summary: summary
    });

  } catch (error) {
    console.error('Error fetching user daily attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب السجلات اليومية',
      error: error.message,
      debug: {
        userId: req.params.userId
      }
    });
  }
});

async function checkIfHoliday(dateString) {
  try {
    const holidaySettings = await getHolidaySettings();
    if (!holidaySettings || !holidaySettings.holidays) return false;

    const targetDate = new Date(dateString);
    const todayString = targetDate.toISOString().split('T')[0];

    // فحص الإجازات الثابتة والمتغيرة
    for (const holiday of holidaySettings.holidays) {
      const holidayDate = new Date(holiday.date);
      const holidayString = holidayDate.toISOString().split('T')[0];

      if (holiday.duration && holiday.duration > 1) {
        for (let i = 0; i < holiday.duration; i++) {
          const extendedDate = new Date(holidayDate);
          extendedDate.setDate(extendedDate.getDate() + i);
          if (extendedDate.toISOString().split('T')[0] === todayString) {
            return { isHoliday: true, name: holiday.name, type: holiday.type };
          }
        }
      } else {
        if (holidayString === todayString) {
          return { isHoliday: true, name: holiday.name, type: holiday.type };
        }
      }
    }

    // فحص الأيام المخصصة
    for (const customDay of holidaySettings.customDays || []) {
      if (customDay.date === todayString) {
        return { isHoliday: true, name: customDay.name, type: 'custom' };
      }
    }

    return false;
  } catch (error) {
    console.error('خطأ في فحص الإجازات:', error);
    return false;
  }
}

// Helper function to get monthly attendance data
async function getMonthlyAttendanceData(employeeId, year, month) {
  try {
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      throw new Error('الموظف غير موجود');
    }

    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

    let { data: attendanceRecords, error: attError } = await supabase
      .from('daily_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (attError) throw attError;
    attendanceRecords = attendanceRecords || [];

    const today = new Date();
    const currentDate = moment(`${year}-${month}-01`);
    const isCurrentMonth = currentDate.format('YYYY-MM') === moment(today).format('YYYY-MM');

    if (attendanceRecords.length === 0) {
      if (isCurrentMonth) {
        attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, year, month, employee.base_salary, employee.user_id);
      } else {
        attendanceRecords = await createMonthlyRecords(employeeId, year, month, employee.base_salary, employee.user_id);
      }
    } else {
      const expectedDays = isCurrentMonth ? today.getDate() : moment(`${year}-${month}`).daysInMonth();
      if (attendanceRecords.length < expectedDays) {
        await supabase
          .from('daily_attendance')
          .delete()
          .eq('employee_id', employeeId)
          .gte('date', startDate)
          .lte('date', endDate);

        if (isCurrentMonth) {
          attendanceRecords = await createMonthlyRecordsUntilToday(employeeId, year, month, employee.base_salary, employee.user_id);
        } else {
          attendanceRecords = await createMonthlyRecords(employeeId, year, month, employee.base_salary, employee.user_id);
        }
      }
    }

    if (isCurrentMonth) {
      const todayDateString = today.toISOString().split('T')[0];
      attendanceRecords = attendanceRecords.filter(record => {
        const recordDateString = typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().split('T')[0];
        return recordDateString <= todayDateString;
      });
    }

    const stats = calculateMonthlyStats(attendanceRecords);

    return {
      records: attendanceRecords,
      stats: stats
    };

  } catch (error) {
    console.error('Error getting monthly attendance data:', error);
    throw error;
  }
}

// تحديث حالة الحضور
router.post('/update-status', requireAuth, async (req, res) => {
  try {
    const allowedStatuses = ["present", "absent", "late", "excused"];
    const { employeeId, date, status, note } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        error: "Validation failed",
        details: "Missing required fields: employeeId, date, and status are required"
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Validation failed",
        details: `Invalid status value: ${status}. Allowed values are: ${allowedStatuses.join(', ')}`
      });
    }

    // البحث عن سجل الحضور
    const { data: attendance, error: findError } = await supabase
      .from('daily_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();

    if (findError) throw findError;

    if (!attendance) {
      return res.status(404).json({
        error: "Not found",
        details: "Attendance record not found"
      });
    }

    // تحديث الحالة والملاحظة
    const updateData = { status, updated_at: new Date().toISOString() };
    if (note) updateData.notes = note;

    const { data: updated, error: updateError } = await supabase
      .from('daily_attendance')
      .update(updateData)
      .eq('id', attendance.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "تم تحديث حالة الحضور بنجاح",
      data: updated
    });

  } catch (error) {
    console.error('خطأ في تحديث حالة الحضور:', error);
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

module.exports = router;
