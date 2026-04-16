const express = require('express');
const router = express.Router();
const { employeeValidation } = require('../middleware/validation');
const sendError = require('../utils/sendError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { supabase } = require('../config/database');

// Helper: map snake_case employee to camelCase for frontend
function mapEmployee(e) {
  if (!e) return e;
  return {
    ...e,
    _id: e.id,
    userId: e.user_id,
    employeeNumber: e.employee_number,
    baseSalary: e.base_salary || 0,
    directManager: e.direct_manager,
    workLocation: e.work_location,
    joinDate: e.join_date,
    approvalStatus: e.approval_status,
    approvalNotes: e.approval_notes,
    approvedBy: e.approved_by,
    approvedAt: e.approved_at,
    totalWorkingDays: e.total_working_days,
    presentDays: e.present_days,
    absentDays: e.absent_days,
    totalHours: e.total_hours,
    overtimeHours: e.overtime_hours,
    leaveBalance: e.leave_balance,
    performanceRating: e.performance_rating,
    lastReview: e.last_review,
    attendancePaused: e.attendance_paused || false,
    attendancePausedAt: e.attendance_paused_at,
    attendancePausedBy: e.attendance_paused_by,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    allowances: {
      transportation: e.allowance_transportation || 0,
      housing: e.allowance_housing || 0,
      meal: e.allowance_meal || 0,
    },
    deductions: {
      socialInsurance: e.deduction_social_insurance || 0,
      tax: e.deduction_tax || 0,
    },
    emergencyContact: {
      name: e.emergency_name,
      phone: e.emergency_phone,
      relation: e.emergency_relation,
      address: e.emergency_address,
    },
    workSchedule: {
      startTime: e.schedule_start_time,
      endTime: e.schedule_end_time,
      workDays: e.schedule_work_days,
      breakTime: e.schedule_break_time,
    },
    benefits: {
      medicalInsurance: e.medical_insurance,
      lifeInsurance: e.life_insurance,
      transportationAllowance: e.transportation_allowance,
      mealAllowance: e.meal_allowance,
    },
    salary: e.base_salary || 0,
    currentSalary: e.base_salary || 0,
    netSalary: (e.base_salary || 0) + (e.allowance_transportation || 0) + (e.allowance_housing || 0) + (e.allowance_meal || 0) - (e.deduction_social_insurance || 0) - (e.deduction_tax || 0),
  };
}

// GET all employees (with filtering, search, pagination)
router.get('/', async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*, users!employees_user_id_fkey(username, email, first_name, last_name)');

    if (error) throw error;

    res.json({
      success: true,
      data: (employees || []).map(mapEmployee),
      pagination: {
        total: employees.length,
        page: 1,
        limit: employees.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الموظفين:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الموظفين',
      error: error.message
    });
  }
});

// UUID regex for route matching
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET single employee by ID (UUID only - prevents collision with named routes)
router.get('/:id', async (req, res, next) => {
  // Skip if not a UUID - let other routes handle it
  if (!UUID_REGEX.test(req.params.id)) return next();
  try {
    const { id } = req.params;

    const { data: employee, error } = await supabase
      .from('employees')
      .select('*, users!employees_user_id_fkey(username, email, first_name, last_name)')
      .eq('id', id)
      .single();

    if (error || !employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    return res.json({
      success: true,
      data: mapEmployee(employee)
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الموظف:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الموظف',
      error: error.message
    });
  }
});

// Middleware لتطهير وتنسيق البيانات
const sanitizeEmployeeData = (req, res, next) => {
  try {
    const data = req.body;
    console.log('Original data:', JSON.stringify(data, null, 2));

    // تنسيق رقم الهاتف
    if (data.phone) {
      data.phone = data.phone.replace(/[\s\-\(\)]/g, '');
      if (data.phone.startsWith('01')) {
        data.phone = '2' + data.phone;
      } else if (data.phone.startsWith('1') && data.phone.length === 10) {
        data.phone = '20' + data.phone;
      }
    }

    // تنسيق التواريخ بمرونة
    ['startDate', 'joinDate', 'join_date', 'birthDate'].forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        try {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            data[field] = date.toISOString();
          }
        } catch (e) {
          console.log(`Invalid date for ${field}:`, data[field]);
        }
      }
    });

    // تنسيق الأرقام مع مرونة في القيم الفارغة
    const numberFields = [
      'base_salary', 'baseSalary',
      'allowance_transportation', 'allowance_housing', 'allowance_meal',
      'deduction_social_insurance', 'deduction_tax',
      'allowances.transportation', 'allowances.transport', 'allowances.housing',
      'allowances.meal', 'allowances.meals', 'allowances.performance',
      'deductions.socialInsurance', 'deductions.insurance', 'deductions.tax',
      'deductions.taxes', 'deductions.loan', 'deductions.loans', 'deductions.absence'
    ];

    numberFields.forEach(field => {
      const keys = field.split('.');
      let obj = data;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }

      const lastKey = keys[keys.length - 1];
      if (obj[lastKey] !== undefined) {
        const value = obj[lastKey];
        if (value === '' || value === null || value === 'null' || value === 'undefined') {
          obj[lastKey] = 0;
        } else {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            obj[lastKey] = num;
          } else {
            obj[lastKey] = 0;
          }
        }
      }
    });

    // تنسيق الحالة
    if (data.status) {
      const statusMap = {
        'active': 'نشط',
        'disabled': 'غير نشط',
        'leave': 'إجازة',
        'terminated': 'غير نشط'
      };
      data.status = statusMap[data.status] || data.status;
    }

    // تطهير الحقول النصية من القيم الفارغة
    ['experience', 'education', 'skills', 'notes', 'fullName', 'name'].forEach(field => {
      if (data[field] === '' || data[field] === null || data[field] === undefined) {
        delete data[field];
      }
    });

    // تأكد من وجود البدلات والخصومات
    if (!data.allowances) data.allowances = {};
    if (!data.deductions) data.deductions = {};

    // توحيد أسماء الحقول
    if (data.allowances.transport && !data.allowances.transportation) {
      data.allowances.transportation = data.allowances.transport;
    }
    if (data.allowances.meals && !data.allowances.meal) {
      data.allowances.meal = data.allowances.meals;
    }
    if (data.deductions.insurance && !data.deductions.socialInsurance) {
      data.deductions.socialInsurance = data.deductions.insurance;
    }
    if (data.deductions.taxes && !data.deductions.tax) {
      data.deductions.tax = data.deductions.taxes;
    }
    if (data.deductions.loans && !data.deductions.loan) {
      data.deductions.loan = data.deductions.loans;
    }

    console.log('Sanitized data:', JSON.stringify(data, null, 2));
    req.body = data;
    next();
  } catch (error) {
    console.error('Error in sanitizeEmployeeData:', error);
    next();
  }
};

// Helper: map incoming body to flat Supabase employee columns
function mapEmployeeBody(data) {
  const mapped = {};
  // Direct field mappings
  const directFields = [
    'name', 'email', 'phone', 'department', 'position',
    'direct_manager', 'work_location', 'address', 'status',
    'employee_number', 'base_salary', 'user_id',
    'allowance_transportation', 'allowance_housing', 'allowance_meal',
    'deduction_social_insurance', 'deduction_tax',
    'total_working_days', 'present_days', 'absent_days',
    'total_hours', 'overtime_hours', 'leave_balance',
    'performance_rating', 'last_review',
    'schedule_start_time', 'schedule_end_time', 'schedule_work_days', 'schedule_break_time',
    'medical_insurance', 'life_insurance', 'transportation_allowance', 'meal_allowance',
    'emergency_name', 'emergency_phone', 'emergency_relation', 'emergency_address',
    'approval_status', 'approval_notes', 'approved_by', 'approved_at',
    'join_date'
  ];

  directFields.forEach(f => {
    if (data[f] !== undefined) mapped[f] = data[f];
  });

  // camelCase -> snake_case mappings from old Mongoose schema
  if (data.baseSalary !== undefined) mapped.base_salary = data.baseSalary;
  if (data.employeeId !== undefined || data.employeeNumber !== undefined) {
    mapped.employee_number = data.employeeId || data.employeeNumber;
  }
  if (data.userId !== undefined) mapped.user_id = data.userId;
  if (data.directManager !== undefined) mapped.direct_manager = data.directManager;
  if (data.workLocation !== undefined) mapped.work_location = data.workLocation;
  if (data.joinDate !== undefined) mapped.join_date = data.joinDate;
  if (data.startDate !== undefined) mapped.join_date = data.startDate;
  if (data.approvalStatus !== undefined) mapped.approval_status = data.approvalStatus;

  // Nested allowances -> flat columns
  if (data.allowances) {
    if (data.allowances.transportation !== undefined) mapped.allowance_transportation = data.allowances.transportation;
    if (data.allowances.housing !== undefined) mapped.allowance_housing = data.allowances.housing;
    if (data.allowances.meal !== undefined) mapped.allowance_meal = data.allowances.meal;
  }

  // Nested deductions -> flat columns
  if (data.deductions) {
    if (data.deductions.socialInsurance !== undefined) mapped.deduction_social_insurance = data.deductions.socialInsurance;
    if (data.deductions.tax !== undefined) mapped.deduction_tax = data.deductions.tax;
  }

  // Emergency contact
  if (data.emergencyContact) {
    if (data.emergencyContact.name !== undefined) mapped.emergency_name = data.emergencyContact.name;
    if (data.emergencyContact.phone !== undefined) mapped.emergency_phone = data.emergencyContact.phone;
    if (data.emergencyContact.relation !== undefined) mapped.emergency_relation = data.emergencyContact.relation;
    if (data.emergencyContact.address !== undefined) mapped.emergency_address = data.emergencyContact.address;
  }

  return mapped;
}

// Helper: calculate salary for a given employee and month
async function calculateMonthlySalary(employeeId, month) {
  // Get employee base data
  const { data: employee } = await supabase
    .from('employees')
    .select('base_salary, allowance_transportation, allowance_housing, allowance_meal, deduction_social_insurance, deduction_tax')
    .eq('id', employeeId)
    .single();

  if (!employee) return null;

  const baseSalary = employee.base_salary || 0;
  const allowancesTotal = (employee.allowance_transportation || 0) +
    (employee.allowance_housing || 0) +
    (employee.allowance_meal || 0);

  // Get active bonuses for the month
  const { data: bonuses } = await supabase
    .from('employee_bonuses')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('month', month)
    .eq('is_active', true);

  // Get active deductions for the month
  const { data: deductions } = await supabase
    .from('employee_deductions')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('month', month)
    .eq('is_active', true);

  const bonusesTotal = (bonuses || []).reduce((sum, b) => sum + (b.amount || 0), 0);
  const adjustmentDeductionsTotal = (deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0);

  const fixedDeductionsTotal = (employee.deduction_social_insurance || 0) + (employee.deduction_tax || 0);
  const totalDeductions = fixedDeductionsTotal + adjustmentDeductionsTotal;
  const grossSalary = baseSalary + allowancesTotal + bonusesTotal;
  const netSalary = grossSalary - totalDeductions;

  return {
    baseSalary,
    allowancesTotal,
    allowancesBreakdown: {
      transportation: employee.allowance_transportation || 0,
      housing: employee.allowance_housing || 0,
      meal: employee.allowance_meal || 0
    },
    bonusesTotal,
    bonusesBreakdown: bonuses || [],
    deductionsTotal: totalDeductions,
    deductionsBreakdown: {
      fixed: {
        socialInsurance: employee.deduction_social_insurance || 0,
        tax: employee.deduction_tax || 0
      },
      adjustments: deductions || []
    },
    grossSalary,
    netSalary
  };
}

// Helper: ensure monthly payment record exists and recalculate
async function ensureMonthlyPayment(employeeId, month) {
  const salaryCalc = await calculateMonthlySalary(employeeId, month);
  if (!salaryCalc) return null;

  // Check if monthly payment exists
  const { data: existing } = await supabase
    .from('employee_monthly_payments')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('month', month)
    .single();

  const paymentData = {
    employee_id: employeeId,
    month,
    base_salary: salaryCalc.baseSalary,
    allowance_transportation: salaryCalc.allowancesBreakdown.transportation,
    allowance_housing: salaryCalc.allowancesBreakdown.housing,
    allowance_meal: salaryCalc.allowancesBreakdown.meal,
    total_bonuses: salaryCalc.bonusesTotal,
    total_deductions: salaryCalc.deductionsTotal,
    gross_salary: salaryCalc.grossSalary,
    net_salary: salaryCalc.netSalary,
    last_updated: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existing) {
    // Preserve existing payment totals
    paymentData.total_paid = existing.total_paid || 0;
    paymentData.remaining_amount = Math.max(0, salaryCalc.netSalary - (existing.total_paid || 0));
    paymentData.status = paymentData.total_paid >= salaryCalc.netSalary ? 'completed' :
      paymentData.total_paid > 0 ? 'partial' : 'pending';

    const { data: updated, error } = await supabase
      .from('employee_monthly_payments')
      .update(paymentData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return { monthlyPayment: updated, salaryCalculation: salaryCalc };
  } else {
    paymentData.total_paid = 0;
    paymentData.remaining_amount = salaryCalc.netSalary;
    paymentData.status = 'pending';

    const { data: created, error } = await supabase
      .from('employee_monthly_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    return { monthlyPayment: created, salaryCalculation: salaryCalc };
  }
}

// POST add employee
router.post('/', requireAuth, requireRole('admin'), sanitizeEmployeeData, employeeValidation, async (req, res) => {
  try {
    const employeeData = mapEmployeeBody(req.body);
    employeeData.created_at = new Date().toISOString();
    employeeData.updated_at = new Date().toISOString();

    const { data: newEmp, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'تم إضافة الموظف بنجاح', data: mapEmployee(newEmp) });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update employee
router.put('/:id', requireAuth, requireRole('admin'), sanitizeEmployeeData, employeeValidation, async (req, res) => {
  try {
    const employeeData = mapEmployeeBody(req.body);
    employeeData.updated_at = new Date().toISOString();

    const { data: emp, error } = await supabase
      .from('employees')
      .update(employeeData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم تحديث الموظف بنجاح', data: mapEmployee(emp) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// POST add bonus to employee
router.post('/:id/bonus', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { type, amount, description, reason, month } = req.body;

    if (!type || !amount || !description) {
      return sendError(res, 400, 'البيانات المطلوبة: نوع المكافأة، المبلغ، والوصف', 'MISSING_DATA');
    }

    // Check employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (empError || !employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const bonusMonth = month || new Date().toISOString().slice(0, 7);

    const { data: bonus, error: bonusError } = await supabase
      .from('employee_bonuses')
      .insert({
        employee_id: req.params.id,
        type,
        amount: parseFloat(amount),
        description: description || '',
        date: new Date().toISOString(),
        added_by: req.user.username,
        month: bonusMonth,
        is_active: true
      })
      .select()
      .single();

    if (bonusError) throw bonusError;

    // Recalculate monthly payment
    const result = await ensureMonthlyPayment(req.params.id, bonusMonth);

    res.json({
      success: true,
      message: 'تم إضافة المكافأة بنجاح',
      data: { bonus, salaryCalculation: result?.salaryCalculation }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة المكافأة', 'BONUS_ERROR', err.message);
  }
});

// POST add deduction to employee
router.post('/:id/deduction', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { type, amount, description, reason, month } = req.body;

    if (!type || !amount || !description) {
      return sendError(res, 400, 'البيانات المطلوبة: نوع الخصم، المبلغ، والوصف', 'MISSING_DATA');
    }

    // Check employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (empError || !employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const deductionMonth = month || new Date().toISOString().slice(0, 7);

    const { data: deduction, error: dedError } = await supabase
      .from('employee_deductions')
      .insert({
        employee_id: req.params.id,
        type,
        amount: parseFloat(amount),
        description: description || '',
        date: new Date().toISOString(),
        added_by: req.user.username,
        month: deductionMonth,
        is_active: true
      })
      .select()
      .single();

    if (dedError) throw dedError;

    // Recalculate monthly payment
    const result = await ensureMonthlyPayment(req.params.id, deductionMonth);

    res.json({
      success: true,
      message: 'تم إضافة الخصم بنجاح',
      data: { deduction, salaryCalculation: result?.salaryCalculation }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة الخصم', 'DEDUCTION_ERROR', err.message);
  }
});

// DELETE remove bonus or deduction (adjustment)
router.delete('/:id/adjustment/:adjustmentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const adjustmentId = req.params.adjustmentId;
    let found = false;
    let adjustmentMonth = null;

    // Try deactivating in bonuses
    const { data: bonus } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('id', adjustmentId)
      .eq('employee_id', req.params.id)
      .single();

    if (bonus) {
      adjustmentMonth = bonus.month;
      await supabase
        .from('employee_bonuses')
        .update({ is_active: false })
        .eq('id', adjustmentId);
      found = true;
    }

    // Try deactivating in deductions
    if (!found) {
      const { data: deduction } = await supabase
        .from('employee_deductions')
        .select('*')
        .eq('id', adjustmentId)
        .eq('employee_id', req.params.id)
        .single();

      if (deduction) {
        adjustmentMonth = deduction.month;
        await supabase
          .from('employee_deductions')
          .update({ is_active: false })
          .eq('id', adjustmentId);
        found = true;
      }
    }

    if (!found) {
      return sendError(res, 404, 'التعديل غير موجود', 'ADJUSTMENT_NOT_FOUND');
    }

    // Recalculate monthly payment
    let salaryCalc = null;
    if (adjustmentMonth) {
      const result = await ensureMonthlyPayment(req.params.id, adjustmentMonth);
      salaryCalc = result?.salaryCalculation;
    }

    res.json({
      success: true,
      message: 'تم حذف التعديل بنجاح',
      data: salaryCalc
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف التعديل', 'DELETE_ERROR', err.message);
  }
});

// POST process payment
router.post('/:id/payment', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { paymentType, amount, description, note, month, type } = req.body;

    if (!amount) {
      return sendError(res, 400, 'البيانات المطلوبة: المبلغ', 'MISSING_DATA');
    }

    // Check employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('id', req.params.id)
      .single();

    if (empError || !employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const paymentMonth = month || new Date().toISOString().slice(0, 7);
    const pType = paymentType || type || 'partial';
    const parsedAmount = parseFloat(amount);

    // Ensure monthly payment record exists
    const result = await ensureMonthlyPayment(req.params.id, paymentMonth);
    if (!result) return sendError(res, 400, 'خطأ في حساب الراتب', 'CALCULATION_ERROR');

    const monthlyPaymentId = result.monthlyPayment.id;

    // Add payment record
    const { data: paymentRecord, error: payError } = await supabase
      .from('employee_payment_records')
      .insert({
        monthly_payment_id: monthlyPaymentId,
        payment_type: pType,
        amount: parsedAmount,
        date: new Date().toISOString(),
        paid_by: req.user.username,
        remaining_amount: Math.max(0, (result.monthlyPayment.remaining_amount || 0) - parsedAmount),
        notes: description || note || ''
      })
      .select()
      .single();

    if (payError) throw payError;

    // Update monthly payment totals
    const newTotalPaid = (result.monthlyPayment.total_paid || 0) + parsedAmount;
    const netSalary = result.salaryCalculation.netSalary;
    const newRemaining = Math.max(0, netSalary - newTotalPaid);
    const newStatus = newTotalPaid >= netSalary ? 'completed' : newTotalPaid > 0 ? 'partial' : 'pending';

    const { data: updatedPayment, error: upError } = await supabase
      .from('employee_monthly_payments')
      .update({
        total_paid: newTotalPaid,
        remaining_amount: newRemaining,
        status: newStatus,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', monthlyPaymentId)
      .select()
      .single();

    if (upError) throw upError;

    // Add salary history record
    await supabase
      .from('employee_salary_history')
      .insert({
        employee_id: req.params.id,
        base_salary: result.salaryCalculation.baseSalary,
        effective_date: new Date().toISOString(),
        reason: `${pType} payment - ${paymentMonth}`,
        changed_by: req.user.username
      });

    res.json({
      success: true,
      message: 'تم تسجيل الدفع بنجاح',
      data: updatedPayment,
      salaryData: updatedPayment
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في تسجيل الدفع', 'PAYMENT_ERROR', err.message);
  }
});

// GET salary calculation for specific month
router.get('/:id/salary/:month', requireAuth, async (req, res) => {
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const month = req.params.month;
    const salaryCalculation = await calculateMonthlySalary(req.params.id, month);

    const { data: monthlyPayment } = await supabase
      .from('employee_monthly_payments')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('month', month)
      .single();

    res.json({
      success: true,
      data: {
        salaryCalculation,
        paymentStatus: monthlyPayment || {
          month,
          payments: [],
          total_paid: 0,
          remaining_amount: salaryCalculation.netSalary,
          status: 'pending'
        }
      }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في حساب الراتب', 'CALCULATION_ERROR', err.message);
  }
});

// GET current month salary data
router.get('/:id/current-salary', requireAuth, async (req, res) => {
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('id, name, department, position')
      .eq('id', req.params.id)
      .single();

    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const salaryCalculation = await calculateMonthlySalary(req.params.id, currentMonth);

    const { data: monthlyPayment } = await supabase
      .from('employee_monthly_payments')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('month', currentMonth)
      .single();

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          department: employee.department,
          position: employee.position
        },
        salaryCalculation,
        paymentStatus: monthlyPayment || {
          month: currentMonth,
          payments: [],
          total_paid: 0,
          remaining_amount: salaryCalculation.netSalary,
          status: 'pending'
        }
      }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في جلب بيانات الراتب الحالي', 'CURRENT_SALARY_ERROR', err.message);
  }
});

// PUT update employee payment (Legacy support)
router.put('/:id/payment', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const allowedFields = [
      'base_salary', 'allowance_transportation', 'allowance_housing', 'allowance_meal',
      'deduction_social_insurance', 'deduction_tax'
    ];

    const updateData = {};
    // Map old field names
    if (req.body.baseSalary !== undefined) updateData.base_salary = req.body.baseSalary;
    if (req.body.base_salary !== undefined) updateData.base_salary = req.body.base_salary;
    if (req.body.allowances?.transportation !== undefined) updateData.allowance_transportation = req.body.allowances.transportation;
    if (req.body.allowances?.housing !== undefined) updateData.allowance_housing = req.body.allowances.housing;
    if (req.body.allowances?.meal !== undefined) updateData.allowance_meal = req.body.allowances.meal;
    if (req.body.deductions?.socialInsurance !== undefined) updateData.deduction_social_insurance = req.body.deductions.socialInsurance;
    if (req.body.deductions?.tax !== undefined) updateData.deduction_tax = req.body.deductions.tax;

    // Also accept direct column names
    allowedFields.forEach(key => {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    updateData.updated_at = new Date().toISOString();

    const { data: emp, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم تحديث بيانات الراتب بنجاح', data: emp });
  } catch (err) {
    console.error('Error updating employee payment:', err);
    sendError(res, 400, 'خطأ في تحديث بيانات الراتب', 'VALIDATION_ERROR', err.message);
  }
});

// DELETE employee
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// GET current employee profile (me)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: emp, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    res.json({ success: true, data: emp });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب بيانات الموظف', 'INTERNAL_ERROR', err.message);
  }
});

// جلب بيانات الموظف الشخصية
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب بيانات المستخدم
    let user = null;
    try {
      // Try by ID first
      const { data: userById } = await supabase
        .from('users')
        .select('*, !password')
        .eq('id', userId)
        .single();

      user = userById;

      // If not found by ID, try by username
      if (!user) {
        const { data: userByUsername } = await supabase
          .from('users')
          .select('*, !password')
          .eq('username', userId)
          .single();
        user = userByUsername;
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
    } catch (error) {
      console.warn('Error finding user:', error.message);
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // جلب بيانات الموظف
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .single();

    // إذا لم توجد بيانات موظف، إنشاؤها ببيانات افتراضية
    if (!employee) {
      const randomPhone = `0100${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      const empNumber = `EMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

      const newEmployeeData = {
        user_id: userId,
        name: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username,
        email: user.email,
        position: 'موظف',
        department: 'عام',
        phone: randomPhone,
        address: 'القاهرة، مصر',
        join_date: user.created_at || new Date().toISOString(),
        employee_number: empNumber,
        direct_manager: 'المدير العام',
        work_location: 'المكتب الرئيسي',
        status: 'نشط'
      };

      let { data: newEmployee, error: insertError } = await supabase
        .from('employees')
        .insert(newEmployeeData)
        .select()
        .single();

      if (insertError) {
        // Retry with different phone on duplicate
        newEmployeeData.phone = `0101${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
        const { data: retryEmp, error: retryError } = await supabase
          .from('employees')
          .insert(newEmployeeData)
          .select()
          .single();
        if (retryError) throw retryError;
        newEmployee = retryEmp;
      }

      return res.json({
        success: true,
        data: {
          user: user,
          employee: newEmployee
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: user,
        employee: employee
      }
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات الموظف:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// جلب إحصائيات الأداء
router.get('/performance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('performance_rating, last_review, leave_balance')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    const performanceData = {
      overall: employee.performance_rating || 0,
      productivity: 0,
      quality: 0,
      teamwork: 0,
      communication: 0,
      goals: [],
      achievements: [],
      lastReview: employee.last_review || null
    };

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الأداء:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الأداء',
      error: error.message
    });
  }
});

// جلب إحصائيات الحضور والانصراف
router.get('/attendance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('id, leave_balance')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب بيانات الحضور من daily_attendance
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: monthlyAttendance } = await supabase
      .from('daily_attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    const records = monthlyAttendance || [];
    const workingDays = records.filter(day => day.total_hours !== undefined);
    const presentDays = workingDays.filter(day => (day.total_hours || 0) > 0);
    const absentDays = workingDays.length - presentDays.length;
    const totalHours = workingDays.reduce((sum, day) => sum + (day.total_hours || 0), 0);

    const attendanceData = {
      totalWorkingDays: workingDays.length,
      presentDays: presentDays.length,
      absentDays: absentDays,
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeHours: 0,
      leaveBalance: employee.leave_balance || 0,
      thisMonth: {
        workDays: workingDays.length,
        present: presentDays.length,
        absent: absentDays,
        late: 0,
        early: 0
      },
      weeklyStats: []
    };

    res.json({
      success: true,
      data: attendanceData
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الحضور:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الحضور',
      error: error.message
    });
  }
});

// GET employee by userId (needed for salary page)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('*, users!employees_user_id_fkey(username, email, first_name, last_name)')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الموظف:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الموظف',
      error: error.message
    });
  }
});

// GET employee bonuses for specific month
router.get('/:userId/bonuses/:month', requireAuth, async (req, res) => {
  try {
    const { userId, month } = req.params;

    // Find employee by user_id
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    const { data: bonuses, error } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', month)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: bonuses || []
    });
  } catch (error) {
    console.error('خطأ في جلب المكافآت:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المكافآت',
      error: error.message
    });
  }
});

// GET employee deductions for specific month
router.get('/:userId/deductions/:month', requireAuth, async (req, res) => {
  try {
    const { userId, month } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    const { data: deductions, error } = await supabase
      .from('employee_deductions')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', month)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: deductions || []
    });
  } catch (error) {
    console.error('خطأ في جلب الخصومات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الخصومات',
      error: error.message
    });
  }
});

// GET employee salary data
router.get('/salary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get or create monthly payment
    let { data: monthlyPayment } = await supabase
      .from('employee_monthly_payments')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', currentMonth)
      .single();

    if (!monthlyPayment) {
      // Build default salary data
      const baseSalary = employee.base_salary || 12000;
      const allowancesTotal = (employee.allowance_transportation || 500) +
        (employee.allowance_housing || 1500) +
        (employee.allowance_meal || 300);
      const deductionsTotal = (employee.deduction_social_insurance || 650) +
        (employee.deduction_tax || 850);
      const grossSalary = baseSalary + allowancesTotal;
      const netSalary = grossSalary - deductionsTotal;

      const salaryData = {
        basic: baseSalary,
        allowances: allowancesTotal,
        housing: employee.allowance_housing || 1500,
        transportation: employee.allowance_transportation || 500,
        meal: employee.allowance_meal || 300,
        bonuses: 0,
        deductions: deductionsTotal,
        insurance: employee.deduction_social_insurance || 650,
        tax: employee.deduction_tax || 850,
        gross: grossSalary,
        net: netSalary,
        lastPayDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        totalPaid: 0,
        remainingAmount: netSalary
      };

      return res.json({ success: true, data: salaryData });
    }

    // Get payment records for this month
    const { data: paymentRecords } = await supabase
      .from('employee_payment_records')
      .select('*')
      .eq('monthly_payment_id', monthlyPayment.id)
      .order('date', { ascending: false });

    const lastPayment = paymentRecords && paymentRecords.length > 0 ? paymentRecords[0] : null;

    const salaryData = {
      basic: monthlyPayment.base_salary,
      allowances: (monthlyPayment.allowance_transportation || 0) +
        (monthlyPayment.allowance_housing || 0) +
        (monthlyPayment.allowance_meal || 0),
      housing: monthlyPayment.allowance_housing || 0,
      transportation: monthlyPayment.allowance_transportation || 0,
      meal: monthlyPayment.allowance_meal || 0,
      bonuses: monthlyPayment.total_bonuses || 0,
      deductions: monthlyPayment.total_deductions || 0,
      insurance: employee.deduction_social_insurance || 0,
      tax: employee.deduction_tax || 0,
      gross: monthlyPayment.gross_salary || 0,
      net: monthlyPayment.net_salary || 0,
      lastPayDate: lastPayment ? lastPayment.date : new Date().toISOString().split('T')[0],
      status: monthlyPayment.status,
      totalPaid: monthlyPayment.total_paid || 0,
      remainingAmount: monthlyPayment.remaining_amount || 0
    };

    res.json({
      success: true,
      data: salaryData
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الراتب:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الراتب',
      error: error.message
    });
  }
});

// GET employee documents data
router.get('/documents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('id, join_date')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // Default documents
    const defaultDocuments = [
      {
        id: 1,
        title: 'عقد العمل',
        date: employee.join_date || new Date().toISOString(),
        type: 'PDF',
        size: '245 KB',
        status: 'مكتمل'
      },
      {
        id: 2,
        title: 'صورة الهوية',
        date: employee.join_date || new Date().toISOString(),
        type: 'JPG',
        size: '156 KB',
        status: 'مكتمل'
      },
      {
        id: 3,
        title: 'الشهادات العلمية',
        date: employee.join_date || new Date().toISOString(),
        type: 'PDF',
        size: '892 KB',
        status: 'مكتمل'
      },
      {
        id: 4,
        title: 'السيرة الذاتية',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'PDF',
        size: '324 KB',
        status: 'مكتمل'
      }
    ];

    res.json({
      success: true,
      data: defaultDocuments
    });
  } catch (error) {
    console.error('خطأ في جلب المستندات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المستندات',
      error: error.message
    });
  }
});

// GET employee requests data
router.get('/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      // Return default requests
      const defaultRequests = [
        {
          id: '1',
          type: 'إجازة سنوية',
          date: new Date('2024-06-01').toISOString(),
          duration: '5 أيام',
          status: 'موافق عليها',
          description: 'إجازة صيفية',
          approved_by: 'مدير الموارد البشرية',
          approved_at: new Date('2024-06-02').toISOString()
        },
        {
          id: '2',
          type: 'إجازة مرضية',
          date: new Date('2024-05-20').toISOString(),
          duration: '2 أيام',
          status: 'قيد المراجعة',
          description: 'إجازة مرضية طارئة',
          reason: 'حالة صحية'
        }
      ];

      return res.json({
        success: true,
        data: defaultRequests,
        message: 'تم جلب الطلبات الافتراضية'
      });
    }

    const { data: requests } = await supabase
      .from('employee_requests')
      .select('*')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false });

    const allRequests = requests || [];
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      data: allRequests,
      message: 'تم جلب الطلبات بنجاح'
    });
  } catch (error) {
    console.error('خطأ في جلب الطلبات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلبات',
      error: error.message
    });
  }
});

// GET employee notifications data
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      // Return default notifications
      const defaultNotifications = [
        {
          id: '1',
          title: 'تم صرف الراتب',
          message: 'تم صرف راتب شهر يونيو بنجاح',
          type: 'success',
          date: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          is_read: false
        },
        {
          id: '2',
          title: 'اجتماع فريق العمل',
          message: 'اجتماع يوم الأحد الساعة 10 صباحاً',
          type: 'info',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          is_read: false
        }
      ];

      return res.json({
        success: true,
        data: defaultNotifications,
        message: 'تم جلب الإشعارات الافتراضية'
      });
    }

    const { data: notifications } = await supabase
      .from('employee_notifications')
      .select('*')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const allNotifications = notifications || [];
    const unread = allNotifications.filter(n => !n.is_read).length;

    res.json({
      success: true,
      data: allNotifications,
      message: 'تم جلب الإشعارات بنجاح'
    });
  } catch (error) {
    console.error('خطأ في جلب الإشعارات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإشعارات',
      error: error.message
    });
  }
});

// GET employee benefits data
router.get('/benefits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Fetching benefits for userId:', userId);

    const { data: employee } = await supabase
      .from('employees')
      .select('allowance_transportation, allowance_housing, allowance_meal')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    const benefits = [];

    if (employee.allowance_transportation && employee.allowance_transportation > 0) {
      benefits.push({
        id: 'transport',
        name: 'بدل المواصلات',
        type: 'allowance',
        amount: employee.allowance_transportation,
        description: 'بدل شهري للمواصلات'
      });
    }

    if (employee.allowance_meal && employee.allowance_meal > 0) {
      benefits.push({
        id: 'meal',
        name: 'بدل الوجبات',
        type: 'allowance',
        amount: employee.allowance_meal,
        description: 'بدل شهري للوجبات'
      });
    }

    if (employee.allowance_housing && employee.allowance_housing > 0) {
      benefits.push({
        id: 'housing',
        name: 'بدل السكن',
        type: 'allowance',
        amount: employee.allowance_housing,
        description: 'بدل شهري للسكن'
      });
    }

    // Fixed benefits
    benefits.push({
      id: 'social_insurance',
      name: 'التأمين الاجتماعي',
      type: 'insurance',
      amount: 0,
      description: 'تغطية التأمين الاجتماعي والصحي'
    });

    res.json({
      success: true,
      data: benefits
    });
  } catch (error) {
    console.error('خطأ في جلب المزايا:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المزايا',
      error: error.message
    });
  }
});

// GET employee stats data
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // Get tracking data for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startOfMonth = `${currentMonth}-01`;

    const { data: trackingData } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date_string', startOfMonth)
      .like('date_string', `${currentMonth}%`);

    const records = trackingData || [];

    const totalWorkSeconds = records.reduce((sum, r) => sum + (r.total_seconds || 0), 0);
    const totalActiveSeconds = records.reduce((sum, r) => sum + (r.active_seconds || 0), 0);
    const totalWorkHours = Math.floor(totalWorkSeconds / 3600);
    const productivity = totalWorkSeconds > 0 ?
      Math.round((totalActiveSeconds / totalWorkSeconds) * 100) : 0;

    const workingDaysThisMonth = records.length;
    const expectedWorkingDays = new Date().getDate();
    const attendanceRate = expectedWorkingDays > 0 ?
      Math.round((workingDaysThisMonth / expectedWorkingDays) * 100) : 0;

    // Salary calc
    const baseSalary = employee.base_salary || 12000;
    const allowancesTotal = (employee.allowance_transportation || 500) +
      (employee.allowance_housing || 1500) +
      (employee.allowance_meal || 300);
    const netSalary = baseSalary + allowancesTotal -
      ((employee.deduction_social_insurance || 650) +
        (employee.deduction_tax || 850));

    const performanceRating = employee.performance_rating || 4.2;
    const totalTasks = Math.floor(performanceRating * 15);
    const completedTasks = Math.floor(totalTasks * 0.85);

    const leaveBalance = employee.leave_balance || 21;
    const usedLeaves = 21 - leaveBalance;

    const stats = {
      workStats: {
        totalHours: totalWorkHours,
        productivity: productivity,
        attendanceRate: attendanceRate,
        workingDays: workingDaysThisMonth
      },
      financialStats: {
        monthlySalary: netSalary,
        basicSalary: baseSalary,
        allowances: allowancesTotal,
        lastPayment: new Date().toISOString().split('T')[0]
      },
      taskStats: {
        totalTasks: totalTasks,
        completedTasks: completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        pendingTasks: totalTasks - completedTasks
      },
      leaveStats: {
        totalBalance: 21,
        usedLeaves: usedLeaves,
        remainingLeaves: leaveBalance,
        leaveRequests: 0
      },
      performanceStats: {
        rating: performanceRating,
        goals: 12,
        achievements: 8,
        lastReview: employee.last_review || new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// جلب إحصائيات التتبع لسطح المكتب
router.get('/desktop-tracking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Desktop tracking request for userId:', userId);

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Get today's tracking records
    const { data: todayTrackingRecords } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('date_string', todayString)
      .order('created_at', { ascending: false });

    // Select the record with the most total_seconds
    let todayTracking = null;
    if (todayTrackingRecords && todayTrackingRecords.length > 0) {
      todayTracking = todayTrackingRecords.reduce((best, current) => {
        const currentTotal = current.total_seconds || 0;
        const bestTotal = best.total_seconds || 0;
        return currentTotal > bestTotal ? current : best;
      });

      if ((todayTracking.total_seconds || 0) === 0) {
        todayTracking = todayTrackingRecords[0];
      }
    }

    // Get weekly tracking
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoString = weekAgo.toISOString().split('T')[0];

    const { data: weeklyTracking } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date_string', weekAgoString)
      .order('created_at', { ascending: true });

    // Connection status
    const isConnected = todayTracking && todayTracking.is_working === true;

    // Prepare today data
    const todayData = {
      totalSeconds: todayTracking?.total_seconds || 0,
      activeSeconds: todayTracking?.active_seconds || 0,
      idleSeconds: todayTracking?.idle_seconds || 0,
      breakSeconds: todayTracking?.break_seconds || 0,
      productivity: todayTracking?.productivity || 0,
      sessionsCount: todayTracking?.sessions_count || 0,
      screenshotsCount: 0,
      screenshots: [],
      lastActivity: todayTracking?.last_activity || null,
      isWorking: todayTracking?.is_working || false,
      status: todayTracking?.is_working ? 'working' : 'offline'
    };

    const desktopTracking = {
      appStatus: isConnected ? 'متصل' : 'غير متصل',
      isConnected: isConnected,
      currentSession: {
        checkInTime: todayTracking ? new Date(todayTracking.created_at).toLocaleTimeString('ar-EG', { hour12: false }) : '-',
        workingTime: formatDuration(todayData.totalSeconds),
        idleTime: formatDuration(todayData.idleSeconds),
        activeTime: formatDuration(todayData.activeSeconds),
        lastActivity: todayData.lastActivity,
        isActive: todayData.isWorking,
        status: todayData.status
      },
      todayStats: {
        totalWorkTime: formatDuration(todayData.totalSeconds),
        totalIdleTime: formatDuration(todayData.idleSeconds),
        totalActiveTime: formatDuration(todayData.activeSeconds),
        productivityScore: todayData.productivity,
        screenshotCount: todayData.screenshotsCount,
        sessionsCount: todayData.sessionsCount,
        activityLevel: getActivityLevel(todayData.productivity)
      },
      weeklyStats: generateWeeklyStats(weeklyTracking || []),
      recentScreenshots: [],
      permissions: {
        canStartFromWeb: false,
        canViewScreenshots: true,
        canDeleteScreenshots: false
      }
    };

    res.json({
      success: true,
      data: desktopTracking,
      todayData: todayData
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات التتبع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      todayData: {
        totalSeconds: 0,
        activeSeconds: 0,
        idleSeconds: 0,
        breakSeconds: 0,
        productivity: 0,
        sessionsCount: 0,
        screenshotsCount: 0,
        screenshots: [],
        lastActivity: null,
        isWorking: false,
        status: 'offline'
      }
    });
  }
});

// Helper: format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper: activity level
function getActivityLevel(productivity) {
  if (productivity >= 90) return 'ممتاز';
  if (productivity >= 80) return 'جيد جداً';
  if (productivity >= 70) return 'جيد';
  if (productivity >= 60) return 'مقبول';
  return 'ضعيف';
}

// Helper: weekly stats
function generateWeeklyStats(weeklyData) {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const stats = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateString = date.toISOString().split('T')[0];

    const dayData = weeklyData.find(record => {
      return record.date_string === dateString;
    });

    stats.push({
      day: days[date.getDay()],
      date: dateString,
      workTime: dayData?.total_seconds || 0,
      activeTime: dayData?.active_seconds || 0,
      idleTime: dayData?.idle_seconds || 0,
      productivity: dayData?.productivity || 0,
      sessionsCount: dayData?.sessions_count || 0
    });
  }

  return stats;
}

// Fix employee-user links
router.post('/fix-links', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Get employees without user_id
    const { data: employeesWithoutUserId } = await supabase
      .from('employees')
      .select('*')
      .is('user_id', null);

    const fixedEmployees = [];

    for (const employee of (employeesWithoutUserId || [])) {
      // Find matching user by email
      const { data: user } = await supabase
        .from('users')
        .select('id, username')
        .eq('email', employee.email)
        .single();

      if (user) {
        // Link employee to user
        await supabase
          .from('employees')
          .update({ user_id: user.id })
          .eq('id', employee.id);

        // Update user too
        await supabase
          .from('users')
          .update({ employee_id: employee.id })
          .eq('id', user.id);

        fixedEmployees.push({
          employeeName: employee.name,
          employeeEmail: employee.email,
          userName: user.username
        });
      }
    }

    res.json({
      success: true,
      message: `تم إصلاح ربط ${fixedEmployees.length} موظف`,
      data: fixedEmployees
    });
  } catch (err) {
    sendError(res, 500, "خطأ في إصلاح ربط الموظفين", "INTERNAL_ERROR", err.message);
  }
});

// Toggle attendance tracking for employee
router.put('/:id/toggle-attendance', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get current state
    const { data: employee, error: findErr } = await supabase
      .from('employees')
      .select('id, name, attendance_paused')
      .eq('id', id)
      .single();

    if (findErr || !employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const newState = !employee.attendance_paused;

    const { data: updated, error: updateErr } = await supabase
      .from('employees')
      .update({
        attendance_paused: newState,
        attendance_paused_at: newState ? new Date().toISOString() : null,
        attendance_paused_by: newState ? req.user.id : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({
      success: true,
      message: newState
        ? `تم إيقاف تتبع الحضور للموظف ${employee.name}`
        : `تم تشغيل تتبع الحضور للموظف ${employee.name}`,
      data: mapEmployee(updated),
    });
  } catch (err) {
    sendError(res, 500, 'خطأ في تغيير حالة تتبع الحضور', 'INTERNAL_ERROR', err.message);
  }
});

// Approve employee
router.put('/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: emp, error } = await supabase
      .from('employees')
      .update({
        approval_status: 'approved',
        status: 'نشط',
        approved_by: req.user.username,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // Update linked user status
    if (emp.user_id) {
      await supabase
        .from('users')
        .update({
          status: 'active',
          last_login: new Date().toISOString()
        })
        .eq('id', emp.user_id);
    }

    res.json({ success: true, message: 'تم الموافقة على الموظف بنجاح وتفعيل حسابه', data: mapEmployee(emp) });
  } catch (err) {
    sendError(res, 400, 'خطأ في الموافقة على الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// Reject employee
router.put('/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: emp, error } = await supabase
      .from('employees')
      .update({
        approval_status: 'rejected',
        status: 'غير نشط',
        approval_notes: req.body.rejectionReason || '',
        approved_by: req.user.username,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // Update linked user status
    if (emp.user_id) {
      await supabase
        .from('users')
        .update({ status: 'rejected' })
        .eq('id', emp.user_id);
    }

    res.json({ success: true, message: 'تم رفض الموظف بنجاح', data: mapEmployee(emp) });
  } catch (err) {
    sendError(res, 400, 'خطأ في رفض الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// Get payment history for a specific month
router.get('/payment-history/:month?', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const month = req.params.month || new Date().toISOString().slice(0, 7);

    // Get all monthly payments for this month with employee info
    const { data: monthlyPayments } = await supabase
      .from('employee_monthly_payments')
      .select('*, employees(name)')
      .eq('month', month);

    const history = [];

    for (const mp of (monthlyPayments || [])) {
      // Get payment records
      const { data: payments } = await supabase
        .from('employee_payment_records')
        .select('*')
        .eq('monthly_payment_id', mp.id);

      (payments || []).forEach(payment => {
        history.push({
          date: payment.date,
          employeeName: mp.employees?.name || '',
          employeeId: mp.employee_id,
          type: 'payment',
          amount: payment.amount,
          description: payment.notes || `دفع راتب ${payment.payment_type === 'full' ? 'كامل' : payment.payment_type === 'partial' ? 'جزئي' : 'سلفة'}`,
          status: 'completed'
        });
      });
    }

    // Get bonuses for this month
    const { data: bonuses } = await supabase
      .from('employee_bonuses')
      .select('*, employees(name)')
      .eq('month', month);

    (bonuses || []).forEach(bonus => {
      history.push({
        date: bonus.date,
        employeeName: bonus.employees?.name || '',
        employeeId: bonus.employee_id,
        type: 'bonus',
        amount: bonus.amount,
        description: `مكافأة ${bonus.type}`,
        status: 'completed'
      });
    });

    // Get deductions for this month
    const { data: deductions } = await supabase
      .from('employee_deductions')
      .select('*, employees(name)')
      .eq('month', month);

    (deductions || []).forEach(deduction => {
      history.push({
        date: deduction.date,
        employeeName: deduction.employees?.name || '',
        employeeId: deduction.employee_id,
        type: 'deduction',
        amount: deduction.amount,
        description: `خصم ${deduction.type}`,
        status: 'completed'
      });
    });

    // Sort by date descending
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    sendError(res, 500, 'خطأ في جلب سجل المدفوعات', 'INTERNAL_ERROR', error.message);
  }
});

// Remove payment
router.delete('/:id/payment/:paymentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Check employee exists
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    // Get the payment record to know the amount
    const { data: paymentRecord } = await supabase
      .from('employee_payment_records')
      .select('*, employee_monthly_payments(id, total_paid, net_salary)')
      .eq('id', req.params.paymentId)
      .single();

    if (!paymentRecord) {
      return res.status(404).json({ success: false, message: 'لا توجد مدفوعات لحذفها' });
    }

    // Delete the payment record
    await supabase
      .from('employee_payment_records')
      .delete()
      .eq('id', req.params.paymentId);

    // Recalculate the monthly payment total
    const monthlyPaymentId = paymentRecord.monthly_payment_id;
    const { data: remainingPayments } = await supabase
      .from('employee_payment_records')
      .select('amount')
      .eq('monthly_payment_id', monthlyPaymentId);

    const newTotalPaid = (remainingPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const netSalary = paymentRecord.employee_monthly_payments?.net_salary || 0;
    const newRemaining = Math.max(0, netSalary - newTotalPaid);
    const newStatus = newTotalPaid >= netSalary ? 'completed' : newTotalPaid > 0 ? 'partial' : 'pending';

    const { data: updatedMP } = await supabase
      .from('employee_monthly_payments')
      .update({
        total_paid: newTotalPaid,
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', monthlyPaymentId)
      .select()
      .single();

    res.json({
      success: true,
      message: 'تم حذف الدفعة بنجاح',
      salaryData: updatedMP
    });
  } catch (error) {
    console.error('Error removing payment:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف الدفعة' });
  }
});

// Get monthly payment calculation for specific employee and month
router.get('/:id/monthly-payment/:month', async (req, res) => {
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    const month = req.params.month;

    // Calculate salary
    const baseSalary = employee.base_salary || 0;
    const allowancesTotal = (employee.allowance_transportation || 0) +
      (employee.allowance_housing || 0) +
      (employee.allowance_meal || 0);

    // Get monthly payment record
    const { data: monthlyPayment } = await supabase
      .from('employee_monthly_payments')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('month', month)
      .single();

    // Get bonuses and deductions for the month
    const { data: activeBonuses } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('month', month)
      .eq('is_active', true);

    const { data: activeDeductions } = await supabase
      .from('employee_deductions')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('month', month)
      .eq('is_active', true);

    const bonusesTotal = (activeBonuses || []).reduce((sum, b) => sum + b.amount, 0);
    const adjustmentDeductionsTotal = (activeDeductions || []).reduce((sum, d) => sum + d.amount, 0);

    const fixedDeductionsTotal = (employee.deduction_social_insurance || 0) +
      (employee.deduction_tax || 0);
    const totalDeductions = fixedDeductionsTotal + adjustmentDeductionsTotal;
    const netSalary = baseSalary + allowancesTotal + bonusesTotal - totalDeductions;

    const totalPaid = monthlyPayment?.total_paid || 0;
    const remainingAmount = Math.max(0, netSalary - totalPaid);

    // Get payment records
    let paymentHistory = [];
    if (monthlyPayment) {
      const { data: records } = await supabase
        .from('employee_payment_records')
        .select('*')
        .eq('monthly_payment_id', monthlyPayment.id)
        .order('date', { ascending: false });
      paymentHistory = records || [];
    }

    const paymentData = {
      salaryCalculation: {
        baseSalary,
        allowancesTotal,
        bonusesTotal,
        deductionsTotal: totalDeductions,
        netSalary,
        allowancesBreakdown: {
          transportation: employee.allowance_transportation || 0,
          housing: employee.allowance_housing || 0,
          meal: employee.allowance_meal || 0
        },
        bonusesBreakdown: activeBonuses || [],
        deductionsBreakdown: {
          fixed: {
            socialInsurance: employee.deduction_social_insurance || 0,
            tax: employee.deduction_tax || 0
          },
          adjustments: activeDeductions || []
        }
      },
      paymentStatus: {
        totalPaid,
        remainingAmount,
        status: totalPaid >= netSalary ? 'completed' : totalPaid > 0 ? 'partial' : 'pending'
      },
      adjustments: {
        bonuses: activeBonuses || [],
        deductions: activeDeductions || []
      },
      paymentHistory
    };

    res.json({ success: true, data: paymentData });
  } catch (error) {
    console.error('Error calculating monthly payment:', error);
    sendError(res, 500, 'خطأ في حساب بيانات الراتب الشهري', 'INTERNAL_ERROR', error.message);
  }
});

// جلب بيانات التتبع للموظفين
router.get('/tracking-data', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department } = req.query;

    let query = supabase
      .from('tracking')
      .select('*, users!tracking_user_id_fkey(username, email, first_name, last_name, department, position), employees!tracking_employee_id_fkey(name, employee_number, email, department, position)')
      .order('date', { ascending: false })
      .limit(100);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    if (employeeId) {
      query = query.or(`user_id.eq.${employeeId},employee_id.eq.${employeeId}`);
    }

    const { data: trackingData, error } = await query;

    if (error) throw error;

    // Aggregate stats
    const stats = {
      totalRecords: (trackingData || []).length,
      totalWorkTime: 0,
      totalActiveTime: 0,
      totalScreenshots: 0,
      averageProductivity: 0,
      employeeStats: {}
    };

    (trackingData || []).forEach(record => {
      const employeeKey = record.users?.email || record.employees?.email || 'unknown';

      if (!stats.employeeStats[employeeKey]) {
        stats.employeeStats[employeeKey] = {
          name: record.users ? `${record.users.first_name || ''} ${record.users.last_name || ''}`.trim() : (record.employees?.name || 'غير محدد'),
          department: record.users?.department || record.employees?.department,
          totalWorkTime: 0,
          totalActiveTime: 0,
          totalScreenshots: 0,
          averageProductivity: 0,
          recordsCount: 0
        };
      }

      const workTime = record.total_seconds || 0;
      const activeTime = record.active_seconds || 0;
      const productivity = record.productivity || 0;

      stats.totalWorkTime += workTime;
      stats.totalActiveTime += activeTime;
      stats.averageProductivity += productivity;

      stats.employeeStats[employeeKey].totalWorkTime += workTime;
      stats.employeeStats[employeeKey].totalActiveTime += activeTime;
      stats.employeeStats[employeeKey].averageProductivity += productivity;
      stats.employeeStats[employeeKey].recordsCount++;
    });

    if ((trackingData || []).length > 0) {
      stats.averageProductivity = Math.round(stats.averageProductivity / trackingData.length);
    }

    Object.keys(stats.employeeStats).forEach(key => {
      const empStats = stats.employeeStats[key];
      if (empStats.recordsCount > 0) {
        empStats.averageProductivity = Math.round(empStats.averageProductivity / empStats.recordsCount);
      }
    });

    res.json({
      success: true,
      data: trackingData || [],
      stats: stats,
      count: (trackingData || []).length
    });

  } catch (error) {
    console.error('Error fetching tracking data:', error);
    sendError(res, 500, 'خطأ في جلب بيانات التتبع', 'INTERNAL_ERROR', error.message);
  }
});

// جلب بيانات التتبع لموظف محدد
router.get('/:id/tracking', requireAuth, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { startDate, endDate, limit = 30 } = req.query;

    // Check employee exists
    const { data: employee } = await supabase
      .from('employees')
      .select('id, name, email, department, position')
      .eq('id', employeeId)
      .single();

    if (!employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    let query = supabase
      .from('tracking')
      .select('*')
      .or(`employee_id.eq.${employeeId},user_id.eq.${employeeId}`)
      .order('date', { ascending: false })
      .limit(parseInt(limit));

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: trackingData, error } = await query;
    if (error) throw error;

    // Calculate stats
    const records = trackingData || [];
    const stats = {
      totalDays: records.length,
      totalWorkTime: 0,
      totalActiveTime: 0,
      totalScreenshots: 0,
      averageProductivity: 0
    };

    records.forEach(record => {
      stats.totalWorkTime += record.total_seconds || 0;
      stats.totalActiveTime += record.active_seconds || 0;
      stats.averageProductivity += record.productivity || 0;
    });

    if (records.length > 0) {
      stats.averageProductivity = Math.round(stats.averageProductivity / records.length);
    }

    res.json({
      success: true,
      data: records,
      stats: stats,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position
      },
      count: records.length
    });

  } catch (error) {
    console.error('Error fetching employee tracking data:', error);
    sendError(res, 500, 'خطأ في جلب بيانات تتبع الموظف', 'INTERNAL_ERROR', error.message);
  }
});

// تحديث البيانات الشخصية للموظف
router.put('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const allowedFields = {
      'position': 'position',
      'department': 'department',
      'directManager': 'direct_manager',
      'direct_manager': 'direct_manager',
      'workLocation': 'work_location',
      'work_location': 'work_location',
      'address': 'address',
      'phone': 'phone'
    };

    const filteredData = {};
    Object.keys(updateData).forEach(field => {
      if (allowedFields[field]) {
        filteredData[allowedFields[field]] = updateData[field];
      }
    });

    // Emergency contact
    if (updateData.emergencyContact) {
      if (updateData.emergencyContact.name) filteredData.emergency_name = updateData.emergencyContact.name;
      if (updateData.emergencyContact.phone) filteredData.emergency_phone = updateData.emergencyContact.phone;
      if (updateData.emergencyContact.relation) filteredData.emergency_relation = updateData.emergencyContact.relation;
      if (updateData.emergencyContact.address) filteredData.emergency_address = updateData.emergencyContact.address;
    }

    filteredData.updated_at = new Date().toISOString();

    // Try to update, upsert if not found
    let { data: employee, error } = await supabase
      .from('employees')
      .update(filteredData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !employee) {
      // Insert new record
      filteredData.user_id = userId;
      const { data: newEmp, error: insertError } = await supabase
        .from('employees')
        .insert(filteredData)
        .select()
        .single();
      if (insertError) throw insertError;
      employee = newEmp;
    }

    res.json({
      success: true,
      message: 'تم تحديث البيانات بنجاح',
      data: employee
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث البيانات',
      error: error.message
    });
  }
});

// إضافة طلب جديد
router.post('/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, duration, description, reason, title } = req.body;

    // Find employee
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    const { data: newRequest, error } = await supabase
      .from('employee_requests')
      .insert({
        employee_id: employee.id,
        type: type,
        title: title || type,
        description: description || '',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'تم إرسال الطلب بنجاح',
      data: newRequest
    });

  } catch (error) {
    console.error('Error adding request:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الطلب',
      error: error.message
    });
  }
});

// تحديث حالة قراءة الإشعار
router.put('/notifications/:userId/:notificationId', async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const { read } = req.body;

    const { data: updated, error } = await supabase
      .from('employee_notifications')
      .update({ is_read: read })
      .eq('id', notificationId)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الإشعار'
    });

  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الإشعار',
      error: error.message
    });
  }
});

// جلب بيانات السجلات اليومية للأسبوعين الماضيين
router.get('/daily-records/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Daily records request for userId:', userId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get tracking data for last 14 days
    const { data: trackingData } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date_string', startDateStr)
      .lte('date_string', endDateStr)
      .order('date', { ascending: true });

    const records = trackingData || [];

    // Build daily records
    const dailyRecords = [];
    const weekends = [5, 6]; // Friday and Saturday defaults

    for (let i = 13; i >= 0; i--) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - i);
      const dateString = currentDate.toISOString().split('T')[0];

      const dayData = records.find(record => record.date_string === dateString);

      const isWeekend = weekends.includes(currentDate.getDay());
      const isToday = i === 0;

      let totalSeconds = 0;
      let activeSeconds = 0;
      let idleSeconds = 0;
      let breakSeconds = 0;
      let productivity = 0;
      let status = 'غائب';

      if (dayData) {
        totalSeconds = dayData.total_seconds || 0;
        activeSeconds = dayData.active_seconds || 0;
        idleSeconds = dayData.idle_seconds || 0;
        breakSeconds = dayData.break_seconds || 0;
        productivity = dayData.productivity || 0;

        if (isWeekend) {
          status = 'إجازة';
        } else if (totalSeconds >= 6 * 3600) {
          status = 'حاضر';
        } else if (totalSeconds > 0) {
          status = 'متأخر';
        } else {
          status = 'غائب';
        }
      } else if (isWeekend) {
        status = 'إجازة';
      }

      dailyRecords.push({
        date: currentDate.toLocaleDateString('ar-EG', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        hijriDate: currentDate.toLocaleDateString('ar-EG-u-ca-islamic', {
          day: '2-digit',
          month: 'short'
        }),
        dayName: currentDate.toLocaleDateString('ar-EG', { weekday: 'short' }),
        totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
        activeHours: Math.round(activeSeconds / 3600 * 10) / 10,
        idleHours: Math.round(idleSeconds / 3600 * 10) / 10,
        breakHours: Math.round(breakSeconds / 3600 * 10) / 10,
        breakCount: breakSeconds > 0 ? Math.floor((breakSeconds / 3600) * 2) + 1 : 0,
        productivity,
        status,
        screenshots: 0,
        isWeekend,
        isToday,
        hasRealData: !!dayData
      });
    }

    // Summary stats
    const workingDays = dailyRecords.filter(day => !day.isWeekend);
    const totalWorkTime = workingDays.reduce((sum, day) => sum + (day.totalHours * 3600), 0);
    const totalActiveTime = workingDays.reduce((sum, day) => sum + (day.activeHours * 3600), 0);
    const totalBreakTime = workingDays.reduce((sum, day) => sum + (day.breakHours * 3600), 0);
    const averageProductivity = workingDays.length > 0 ?
      Math.round(workingDays.reduce((sum, day) => sum + day.productivity, 0) / workingDays.length) : 0;

    const summary = {
      totalWorkTime,
      totalActiveTime,
      totalBreakTime,
      averageProductivity,
      workingDaysCount: workingDays.length,
      daysWithData: dailyRecords.filter(day => day.hasRealData).length
    };

    res.json({
      success: true,
      data: {
        records: dailyRecords,
        summary
      },
      message: `تم جلب سجلات ${dailyRecords.length} يوم بنجاح`
    });

  } catch (error) {
    console.error('Error fetching daily records:', error);
    res.status(500).json({
      success: false,
      error: 'فشل في جلب السجلات اليومية',
      details: error.message
    });
  }
});

// Desktop control - send commands to desktop app
router.post('/desktop-control', async (req, res) => {
  try {
    const { command, payload = {} } = req.body;

    console.log('Desktop control command received:', command, payload);

    const validCommands = ['start-work', 'stop-work', 'take-break', 'end-break', 'pause-work', 'resume-work'];
    if (!validCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        message: 'أمر غير صحيح',
        validCommands
      });
    }

    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('remote-control', {
        command,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          source: 'web-interface'
        }
      });

      res.json({
        success: true,
        message: `تم إرسال الأمر: ${command}`,
        command,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        message: `تم محاكاة الأمر: ${command}`,
        command,
        timestamp: new Date().toISOString(),
        note: 'Socket.IO غير متصل - تم محاكاة الأمر'
      });
    }

  } catch (error) {
    console.error('Error in desktop control:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحكم بسطح المكتب',
      error: error.message
    });
  }
});

// DELETE remove specific bonus
router.delete('/:id/bonus/:bonusId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Check employee exists
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // Get the bonus to find its month
    const { data: bonus } = await supabase
      .from('employee_bonuses')
      .select('*')
      .eq('id', req.params.bonusId)
      .eq('employee_id', req.params.id)
      .single();

    if (!bonus) {
      return sendError(res, 404, 'المكافأة غير موجودة', 'BONUS_NOT_FOUND');
    }

    const adjustmentMonth = bonus.month;

    // Delete the bonus
    await supabase
      .from('employee_bonuses')
      .delete()
      .eq('id', req.params.bonusId);

    // Recalculate monthly payment
    let salaryCalc = null;
    if (adjustmentMonth) {
      const result = await ensureMonthlyPayment(req.params.id, adjustmentMonth);
      salaryCalc = result?.salaryCalculation;
    }

    res.json({
      success: true,
      message: 'تم حذف المكافأة بنجاح',
      data: salaryCalc
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف المكافأة', 'DELETE_BONUS_ERROR', err.message);
  }
});

// DELETE remove specific deduction
router.delete('/:id/deduction/:deductionId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Check employee exists
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .single();

    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // Get the deduction to find its month
    const { data: deduction } = await supabase
      .from('employee_deductions')
      .select('*')
      .eq('id', req.params.deductionId)
      .eq('employee_id', req.params.id)
      .single();

    if (!deduction) {
      return sendError(res, 404, 'الخصم غير موجود', 'DEDUCTION_NOT_FOUND');
    }

    const adjustmentMonth = deduction.month;

    // Delete the deduction
    await supabase
      .from('employee_deductions')
      .delete()
      .eq('id', req.params.deductionId);

    // Recalculate monthly payment
    let salaryCalc = null;
    if (adjustmentMonth) {
      const result = await ensureMonthlyPayment(req.params.id, adjustmentMonth);
      salaryCalc = result?.salaryCalculation;
    }

    res.json({
      success: true,
      message: 'تم حذف الخصم بنجاح',
      data: salaryCalc
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الخصم', 'DELETE_DEDUCTION_ERROR', err.message);
  }
});

module.exports = router;
