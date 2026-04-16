const express = require('express');
const router = express.Router();
const sendError = require('../utils/sendError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { supabase } = require('../config/database');

// GET attendance records for an employee
router.get('/employee/:employeeId', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    let query = supabase
      .from('attendance')
      .select('*, employees(name, employee_number, department, position)')
      .eq('employee_id', req.params.employeeId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', new Date(startDate).toISOString());
    if (endDate) query = query.lte('date', new Date(endDate).toISOString());
    if (status) query = query.eq('status', status);

    const { data: attendance, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: attendance
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب سجلات الحضور', 'INTERNAL_ERROR', err.message);
  }
});

// GET today's attendance status for an employee
router.get('/employee/:employeeId/today', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', req.params.employeeId)
      .gte('date', today.toISOString())
      .lt('date', tomorrow.toISOString())
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      data: attendance || { status: 'absent' }
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب حالة الحضور اليوم', 'INTERNAL_ERROR', err.message);
  }
});

// POST check-in
router.post('/check-in', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Check if already checked in today
    const { data: existingAttendance, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', req.user.id)
      .gte('date', today.toISOString())
      .lt('date', tomorrow.toISOString())
      .maybeSingle();

    if (findError) throw findError;

    if (existingAttendance && existingAttendance.check_in_time) {
      return sendError(res, 400, 'تم تسجيل الحضور مسبقاً اليوم', 'DUPLICATE_ENTRY');
    }

    // Get employee's work schedule
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (empError || !employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    const workStartTime = new Date(today);
    const [hours, minutes] = (employee.work_schedule_start_time || '09:00').split(':');
    workStartTime.setHours(parseInt(hours), parseInt(minutes), 0);

    // Determine if late
    const status = new Date() > workStartTime ? 'late' : 'present';

    const now = new Date();
    const location = req.body.location || {};

    if (existingAttendance) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('attendance')
        .update({
          check_in_time: now.toISOString(),
          check_in_latitude: location.latitude || null,
          check_in_longitude: location.longitude || null,
          check_in_device: req.body.device || null,
          check_in_ip: req.ip,
          status: status,
          updated_at: now.toISOString()
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json({
        success: true,
        message: 'تم تسجيل الحضور بنجاح',
        data: updated
      });
    } else {
      // Create new record
      const { data: attendance, error: insertError } = await supabase
        .from('attendance')
        .insert({
          employee_id: req.user.id,
          date: today.toISOString().split('T')[0],
          check_in_time: now.toISOString(),
          check_in_latitude: location.latitude || null,
          check_in_longitude: location.longitude || null,
          check_in_device: req.body.device || null,
          check_in_ip: req.ip,
          status: status
        })
        .select()
        .single();

      if (insertError) throw insertError;

      res.json({
        success: true,
        message: 'تم تسجيل الحضور بنجاح',
        data: attendance
      });
    }
  } catch (err) {
    sendError(res, 500, 'خطأ في تسجيل الحضور', 'INTERNAL_ERROR', err.message);
  }
});

// POST check-out
router.post('/check-out', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: attendance, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', req.user.id)
      .gte('date', today.toISOString())
      .lt('date', tomorrow.toISOString())
      .maybeSingle();

    if (findError) throw findError;

    if (!attendance) {
      return sendError(res, 400, 'لم يتم تسجيل الحضور اليوم', 'NOT_FOUND');
    }

    if (attendance.check_out_time) {
      return sendError(res, 400, 'تم تسجيل الانصراف مسبقاً اليوم', 'DUPLICATE_ENTRY');
    }

    // Get employee's work schedule
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (empError || !employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    const workEndTime = new Date(today);
    const [hours, minutes] = (employee.work_schedule_end_time || '17:00').split(':');
    workEndTime.setHours(parseInt(hours), parseInt(minutes), 0);

    const now = new Date();
    const location = req.body.location || {};

    // Calculate working hours
    const checkInTime = new Date(attendance.check_in_time);
    const workingHoursDiff = (now - checkInTime) / (1000 * 60 * 60);
    const workingHours = Math.round(workingHoursDiff * 10) / 10;

    // حساب الساعات المطلوبة
    let requiredHours = 0;
    const startTime = employee.work_schedule_start_time || '09:00';
    const endTime = employee.work_schedule_end_time || '17:00';
    if (startTime && endTime) {
      const [startH, startM] = startTime.split(':');
      const [endH, endM] = endTime.split(':');
      const start = new Date(today);
      start.setHours(parseInt(startH), parseInt(startM), 0);
      const end = new Date(today);
      end.setHours(parseInt(endH), parseInt(endM), 0);
      requiredHours = (end - start) / (1000 * 60 * 60);
    }

    // منطق الخصم أو الإضافة
    let deductionHours = 0;
    let overtimeHours = 0;
    if (workingHours < requiredHours) {
      deductionHours = Math.round((requiredHours - workingHours) * 10) / 10;
    } else if (workingHours > requiredHours) {
      overtimeHours = Math.round((workingHours - requiredHours) * 10) / 10;
    }

    // حساب overtime القديم (للتوافق)
    let overtime = 0;
    if (now > workEndTime) {
      const overtimeDiff = now - workEndTime;
      overtime = Math.round(overtimeDiff / (1000 * 60 * 60) * 10) / 10;
    }

    const { data: updated, error: updateError } = await supabase
      .from('attendance')
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: location.latitude || null,
        check_out_longitude: location.longitude || null,
        check_out_device: req.body.device || null,
        check_out_ip: req.ip,
        working_hours: workingHours,
        overtime: overtime,
        deduction_hours: deductionHours,
        overtime_hours: overtimeHours,
        updated_at: now.toISOString()
      })
      .eq('id', attendance.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'تم تسجيل الانصراف بنجاح',
      data: updated
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في تسجيل الانصراف', 'INTERNAL_ERROR', err.message);
  }
});

// GET attendance statistics
router.get('/stats', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let query = supabase.from('attendance').select('*');

    if (startDate) query = query.gte('date', new Date(startDate).toISOString());
    if (endDate) query = query.lte('date', new Date(endDate).toISOString());

    if (department) {
      // Get employees in department first
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('department', department);

      if (empError) throw empError;

      const employeeIds = employees.map(emp => emp.id);
      query = query.in('employee_id', employeeIds);
    }

    const { data: records, error } = await query;
    if (error) throw error;

    // Manual aggregation (replacing MongoDB aggregate)
    const statsMap = {};
    records.forEach(record => {
      const status = record.status || 'unknown';
      if (!statsMap[status]) {
        statsMap[status] = { _id: status, count: 0, totalHours: 0, totalOvertime: 0 };
      }
      statsMap[status].count += 1;
      statsMap[status].totalHours += record.working_hours || 0;
      statsMap[status].totalOvertime += record.overtime || 0;
    });

    const stats = Object.values(statsMap);

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب إحصائيات الحضور', 'INTERNAL_ERROR', err.message);
  }
});

module.exports = router;
