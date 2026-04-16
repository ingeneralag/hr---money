const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// Helper: calculate net salary from employee data
const calculateNetSalary = (employee) => {
  const baseSalary = employee.base_salary || 0;
  const allowances = {
    transportation: employee.allowance_transportation || 0,
    housing: employee.allowance_housing || 0,
    meal: employee.allowance_meal || 0,
    performance: employee.allowance_performance || 0,
    other: employee.allowance_other || 0
  };
  const deductions = {
    insurance: employee.deduction_insurance || 0,
    taxes: employee.deduction_taxes || 0,
    loans: employee.deduction_loans || 0,
    absence: employee.deduction_absence || 0,
    other: employee.deduction_other || 0
  };

  const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (val || 0), 0);
  const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

  const grossSalary = baseSalary + totalAllowances;
  const netSalary = grossSalary - totalDeductions;

  return {
    baseSalary,
    totalAllowances,
    totalDeductions,
    monthlyBonuses: 0,
    monthlyDeductionsAmount: 0,
    grossSalary,
    netSalary
  };
};

// Helper: get payment deadline (last day of month)
const getPaymentDeadline = (month) => {
  const [year, monthNum] = month.split('-');
  return new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);
};

// Helper: get total paid amount from partial payments
const getTotalPaidAmount = (payments) => {
  if (!payments || !Array.isArray(payments)) return 0;
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
};

// Helper: build payroll data object for insert from employee
const buildPayrollData = (employee, month, userId) => {
  const salaryCalc = calculateNetSalary(employee);
  const [year] = month.split('-');

  return {
    employee_id: employee.id,
    month: parseInt(month.split('-')[1]),
    year: parseInt(year),
    due_date: getPaymentDeadline(month).toISOString(),
    base_salary: salaryCalc.baseSalary,
    allowance_transportation: employee.allowance_transportation || 0,
    allowance_housing: employee.allowance_housing || 0,
    allowance_meal: employee.allowance_meal || 0,
    allowance_performance: employee.allowance_performance || 0,
    allowance_other: employee.allowance_other || 0,
    deduction_insurance: employee.deduction_insurance || 0,
    deduction_taxes: employee.deduction_taxes || 0,
    deduction_loans: employee.deduction_loans || 0,
    deduction_absence: employee.deduction_absence || 0,
    deduction_other: employee.deduction_other || 0,
    gross_salary: salaryCalc.grossSalary,
    net_salary: salaryCalc.netSalary,
    status: 'pending',
    created_by: userId,
    updated_by: userId
  };
};

// Helper: fetch partial payments for a payroll
const fetchPayments = async (payrollId) => {
  const { data, error } = await supabase
    .from('payroll_payments')
    .select('*')
    .eq('payroll_id', payrollId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Helper: fetch bonuses for a payroll
const fetchBonuses = async (payrollId) => {
  const { data, error } = await supabase
    .from('payroll_bonuses')
    .select('*')
    .eq('payroll_id', payrollId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Helper: fetch deductions for a payroll
const fetchDeductions = async (payrollId) => {
  const { data, error } = await supabase
    .from('payroll_deductions')
    .select('*')
    .eq('payroll_id', payrollId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Helper: fetch history for a payroll
const fetchHistory = async (payrollId) => {
  const { data, error } = await supabase
    .from('payroll_history')
    .select('*')
    .eq('payroll_id', payrollId)
    .order('performed_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

// Helper: add history entry
const addHistory = async (payrollId, action, details, performedBy) => {
  const { error } = await supabase
    .from('payroll_history')
    .insert({
      payroll_id: payrollId,
      action,
      details,
      performed_by: performedBy,
      performed_at: new Date().toISOString()
    });
  if (error) throw error;
};

// Helper: recalculate payroll status based on payments
const recalcStatus = (netSalary, totalPaid) => {
  if (totalPaid >= netSalary) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'pending';
};

// Helper: parse month string "YYYY-MM" into { month, year }
const parseMonth = (monthStr) => {
  const [year, month] = monthStr.split('-');
  return { month: parseInt(month), year: parseInt(year) };
};

// GET - fetch payroll sheet for specified month
router.get('/', requireAuth, async (req, res) => {
  try {
    const { month, year, department, status, search } = req.query;

    const currentDate = new Date();
    const defaultMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const defaultYear = year || currentDate.getFullYear();
    const { month: monthNum, year: yearNum } = parseMonth(defaultMonth);

    // Fetch employees with filters
    let employeeQuery = supabase.from('employees').select('*');
    if (department && department !== 'all') {
      employeeQuery = employeeQuery.eq('department', department);
    }
    if (search) {
      employeeQuery = employeeQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data: employees, error: empError } = await employeeQuery;
    if (empError) throw empError;

    // Fetch payrolls for the month
    let payrollQuery = supabase
      .from('payroll')
      .select('*')
      .eq('month', monthNum)
      .eq('year', yearNum);
    if (status && status !== 'all') {
      payrollQuery = payrollQuery.eq('status', status);
    }
    const { data: payrolls, error: payError } = await payrollQuery;
    if (payError) throw payError;

    // Fetch all partial payments for these payrolls
    const payrollIds = (payrolls || []).map(p => p.id);
    let allPayments = [];
    if (payrollIds.length > 0) {
      const { data: payments, error: pmtError } = await supabase
        .from('payroll_payments')
        .select('*')
        .in('payroll_id', payrollIds);
      if (pmtError) throw pmtError;
      allPayments = payments || [];
    }

    // Merge employee data with payroll data
    const payrollData = (employees || []).map(employee => {
      const existingPayroll = (payrolls || []).find(p => p.employee_id === employee.id);

      if (existingPayroll) {
        const payments = allPayments.filter(p => p.payroll_id === existingPayroll.id);
        const totalPaid = getTotalPaidAmount(payments);
        const remaining = existingPayroll.net_salary - totalPaid;
        return {
          ...employee,
          payroll: existingPayroll,
          paymentStatus: existingPayroll.status,
          netSalary: existingPayroll.net_salary,
          totalPaid,
          remainingAmount: remaining > 0 ? remaining : 0,
          isFullyPaid: totalPaid >= existingPayroll.net_salary,
          partialPayments: payments,
          earlyPayment: {
            isEarly: existingPayroll.is_early_payment || false,
            originalDueDate: existingPayroll.original_due_date,
            actualPayDate: existingPayroll.actual_pay_date,
            reason: existingPayroll.early_payment_reason
          }
        };
      } else {
        const salaryCalc = calculateNetSalary(employee);
        return {
          ...employee,
          payroll: null,
          paymentStatus: 'pending',
          netSalary: salaryCalc.netSalary,
          totalPaid: 0,
          remainingAmount: salaryCalc.netSalary,
          isFullyPaid: false,
          partialPayments: [],
          earlyPayment: { isEarly: false }
        };
      }
    });

    res.json({
      success: true,
      data: payrollData,
      summary: {
        totalEmployees: (employees || []).length,
        totalPayrolls: (payrolls || []).length,
        totalSalaries: payrollData.reduce((sum, emp) => sum + emp.netSalary, 0),
        totalPaid: payrollData.reduce((sum, emp) => sum + emp.totalPaid, 0),
        totalRemaining: payrollData.reduce((sum, emp) => sum + emp.remainingAmount, 0),
        statusCounts: {
          paid: payrollData.filter(emp => emp.paymentStatus === 'paid').length,
          partially_paid: payrollData.filter(emp => emp.paymentStatus === 'partially_paid').length,
          pending: payrollData.filter(emp => emp.paymentStatus === 'pending').length
        }
      },
      currentMonth: defaultMonth,
      currentYear: defaultYear
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    sendError(res, 500, 'خطأ في جلب كشف الرواتب', 'INTERNAL_ERROR', error.message);
  }
});

// POST - generate payroll records for the month
router.post('/generate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { month, employeeIds } = req.body;

    if (!month) {
      return sendError(res, 400, 'الشهر مطلوب', 'VALIDATION_ERROR');
    }

    const { month: monthNum, year: yearNum } = parseMonth(month);
    const dueDate = getPaymentDeadline(month);

    // Determine which employees to generate for
    let employeeQuery = supabase.from('employees').select('*');
    if (employeeIds && employeeIds.length > 0) {
      employeeQuery = employeeQuery.in('id', employeeIds);
    } else {
      employeeQuery = employeeQuery.eq('status', 'نشط');
    }
    const { data: employees, error: empError } = await employeeQuery;
    if (empError) throw empError;

    const created = [];
    const updated = [];
    const errors = [];

    for (const employee of (employees || [])) {
      try {
        // Check if payroll already exists for the month
        const { data: existing, error: findErr } = await supabase
          .from('payroll')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('month', monthNum)
          .eq('year', yearNum)
          .maybeSingle();
        if (findErr) throw findErr;

        const salaryCalc = calculateNetSalary(employee);
        const payrollRow = {
          employee_id: employee.id,
          month: monthNum,
          year: yearNum,
          due_date: dueDate.toISOString(),
          base_salary: salaryCalc.baseSalary,
          allowance_transportation: employee.allowance_transportation || 0,
          allowance_housing: employee.allowance_housing || 0,
          allowance_meal: employee.allowance_meal || 0,
          allowance_performance: employee.allowance_performance || 0,
          allowance_other: employee.allowance_other || 0,
          deduction_insurance: employee.deduction_insurance || 0,
          deduction_taxes: employee.deduction_taxes || 0,
          deduction_loans: employee.deduction_loans || 0,
          deduction_absence: employee.deduction_absence || 0,
          deduction_other: employee.deduction_other || 0,
          gross_salary: salaryCalc.grossSalary,
          net_salary: salaryCalc.netSalary,
          created_by: req.user.id,
          updated_by: req.user.id
        };

        if (existing) {
          const { data: updatedPayroll, error: updErr } = await supabase
            .from('payroll')
            .update(payrollRow)
            .eq('id', existing.id)
            .select()
            .single();
          if (updErr) throw updErr;
          updated.push({ employee: employee.name, payrollId: updatedPayroll.id });
        } else {
          const { data: newPayroll, error: insErr } = await supabase
            .from('payroll')
            .insert(payrollRow)
            .select()
            .single();
          if (insErr) throw insErr;
          created.push({ employee: employee.name, payrollId: newPayroll.id });
        }
      } catch (error) {
        errors.push({ employee: employee.name, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `تم إنشاء ${created.length} كشف راتب جديد وتحديث ${updated.length} كشف موجود`,
      data: { created, updated, errors }
    });
  } catch (error) {
    console.error('Error generating payroll:', error);
    sendError(res, 500, 'خطأ في إنشاء كشف الرواتب', 'INTERNAL_ERROR', error.message);
  }
});

// POST - pay employee salary (full or early)
router.post('/:employeeId/pay', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, paymentMethod = 'bank_transfer', referenceNumber, notes, isEarlyPayment = false, earlyPaymentReason } = req.body;

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    // Find or create payroll
    let { data: payroll, error: findErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!payroll) {
      // Create new payroll record
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
      if (empErr || !employee) {
        return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
      }

      const payrollRow = buildPayrollData(employee, payrollMonth, req.user.id);
      const { data: newPayroll, error: insErr } = await supabase
        .from('payroll')
        .insert(payrollRow)
        .select()
        .single();
      if (insErr) throw insErr;
      payroll = newPayroll;
    }

    // Check if already paid
    if (payroll.status === 'paid') {
      return sendError(res, 400, 'تم دفع هذا الراتب بالفعل', 'ALREADY_PAID');
    }

    // Get existing payments to calculate remaining
    const existingPayments = await fetchPayments(payroll.id);
    const totalPaidSoFar = getTotalPaidAmount(existingPayments);
    const remainingAmount = payroll.net_salary - totalPaidSoFar;

    // Add full payment as a partial payment record
    const { error: pmtErr } = await supabase
      .from('payroll_payments')
      .insert({
        payroll_id: payroll.id,
        amount: remainingAmount,
        paid_at: new Date().toISOString(),
        reason: isEarlyPayment ? earlyPaymentReason : 'دفع راتب كامل',
        method: paymentMethod,
        reference_number: referenceNumber,
        paid_by: req.user.id
      });
    if (pmtErr) throw pmtErr;

    // Update payroll record
    const updateData = {
      status: 'paid',
      payment_method: paymentMethod,
      bank_account: referenceNumber,
      reference_number: referenceNumber,
      paid_at: new Date().toISOString(),
      paid_by: req.user.id,
      updated_by: req.user.id
    };

    if (isEarlyPayment) {
      updateData.is_early_payment = true;
      updateData.original_due_date = payroll.due_date;
      updateData.actual_pay_date = new Date().toISOString();
      updateData.early_payment_reason = earlyPaymentReason;
      updateData.early_approved_by = req.user.id;
      updateData.early_approved_at = new Date().toISOString();
    }

    const { error: updErr } = await supabase
      .from('payroll')
      .update(updateData)
      .eq('id', payroll.id);
    if (updErr) throw updErr;

    // Add history
    await addHistory(
      payroll.id,
      isEarlyPayment ? 'early_payment' : 'full_payment',
      `تم دفع راتب ${payrollMonth} بمبلغ ${remainingAmount} ريال`,
      req.user.id
    );

    res.json({
      success: true,
      message: `تم دفع راتب ${isEarlyPayment ? 'مبكر' : 'كامل'} للموظف بنجاح`,
      data: {
        payrollId: payroll.id,
        amount: remainingAmount,
        status: 'paid',
        paidAt: new Date().toISOString(),
        isEarlyPayment: isEarlyPayment
      }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    sendError(res, 500, 'خطأ في معالجة الدفع', 'INTERNAL_ERROR', error.message);
  }
});

// POST - partial payment for employee salary
router.post('/:employeeId/partial-pay', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, amount, reason, paymentMethod = 'bank_transfer', referenceNumber } = req.body;

    if (!amount || amount <= 0) {
      return sendError(res, 400, 'مبلغ الدفع يجب أن يكون أكبر من صفر', 'VALIDATION_ERROR');
    }

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    // Find or create payroll
    let { data: payroll, error: findErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!payroll) {
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
      if (empErr || !employee) {
        return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
      }

      const payrollRow = buildPayrollData(employee, payrollMonth, req.user.id);
      const { data: newPayroll, error: insErr } = await supabase
        .from('payroll')
        .insert(payrollRow)
        .select()
        .single();
      if (insErr) throw insErr;
      payroll = newPayroll;
    }

    // Calculate remaining
    const existingPayments = await fetchPayments(payroll.id);
    const totalPaidSoFar = getTotalPaidAmount(existingPayments);
    const remainingAmount = payroll.net_salary - totalPaidSoFar;

    if (amount > remainingAmount) {
      return sendError(res, 400, `المبلغ يتجاوز المبلغ المتبقي (${remainingAmount} ريال)`, 'VALIDATION_ERROR');
    }

    // Insert partial payment
    const { error: pmtErr } = await supabase
      .from('payroll_payments')
      .insert({
        payroll_id: payroll.id,
        amount: parseFloat(amount),
        paid_at: new Date().toISOString(),
        reason: reason || 'دفعة جزئية',
        method: paymentMethod,
        reference_number: referenceNumber,
        paid_by: req.user.id
      });
    if (pmtErr) throw pmtErr;

    // Recalculate status
    const newTotalPaid = totalPaidSoFar + parseFloat(amount);
    const newStatus = recalcStatus(payroll.net_salary, newTotalPaid);
    const newRemaining = payroll.net_salary - newTotalPaid;

    const { error: updErr } = await supabase
      .from('payroll')
      .update({ status: newStatus, updated_by: req.user.id })
      .eq('id', payroll.id);
    if (updErr) throw updErr;

    // Add history
    await addHistory(
      payroll.id,
      'partial_payment',
      `دفعة جزئية بمبلغ ${amount} ريال - السبب: ${reason || 'غير محدد'}`,
      req.user.id
    );

    res.json({
      success: true,
      message: 'تم إضافة الدفعة الجزئية بنجاح',
      data: {
        payrollId: payroll.id,
        paidAmount: amount,
        totalPaid: newTotalPaid,
        remainingAmount: newRemaining > 0 ? newRemaining : 0,
        status: newStatus,
        isFullyPaid: newTotalPaid >= payroll.net_salary
      }
    });
  } catch (error) {
    console.error('Error processing partial payment:', error);
    sendError(res, 500, 'خطأ في معالجة الدفعة الجزئية', 'INTERNAL_ERROR', error.message);
  }
});

// GET - fetch payroll details for a specific employee
router.get('/:employeeId', requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query;

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    const { data: payroll, error: payErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (payErr) throw payErr;

    if (!payroll) {
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
      if (empErr || !employee) {
        return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
      }

      const salaryCalc = calculateNetSalary(employee);

      return res.json({
        success: true,
        data: {
          employee,
          payroll: null,
          salaryCalculation: salaryCalc,
          paymentStatus: 'pending',
          totalPaid: 0,
          remainingAmount: salaryCalc.netSalary,
          isFullyPaid: false,
          partialPayments: [],
          earlyPayment: { isEarly: false }
        }
      });
    }

    // Fetch related data
    const [payments, bonuses, deductionsList, history, employeeData] = await Promise.all([
      fetchPayments(payroll.id),
      fetchBonuses(payroll.id),
      fetchDeductions(payroll.id),
      fetchHistory(payroll.id),
      supabase.from('employees').select('*').eq('id', employeeId).single()
    ]);

    const employee = employeeData.data;
    const totalPaid = getTotalPaidAmount(payments);
    const totalAllowances = (payroll.allowance_transportation || 0) +
      (payroll.allowance_housing || 0) +
      (payroll.allowance_meal || 0) +
      (payroll.allowance_performance || 0) +
      (payroll.allowance_other || 0);
    const totalDeductions = (payroll.deduction_insurance || 0) +
      (payroll.deduction_taxes || 0) +
      (payroll.deduction_loans || 0) +
      (payroll.deduction_absence || 0) +
      (payroll.deduction_other || 0);

    res.json({
      success: true,
      data: {
        employee,
        payroll: { ...payroll, bonuses, deductions: deductionsList, history },
        salaryCalculation: {
          baseSalary: payroll.base_salary,
          totalAllowances,
          totalDeductions,
          grossSalary: payroll.gross_salary,
          netSalary: payroll.net_salary
        },
        paymentStatus: payroll.status,
        totalPaid,
        remainingAmount: payroll.net_salary - totalPaid > 0 ? payroll.net_salary - totalPaid : 0,
        isFullyPaid: totalPaid >= payroll.net_salary,
        partialPayments: payments,
        earlyPayment: {
          isEarly: payroll.is_early_payment || false,
          originalDueDate: payroll.original_due_date,
          actualPayDate: payroll.actual_pay_date,
          reason: payroll.early_payment_reason,
          approvedBy: payroll.early_approved_by,
          approvedAt: payroll.early_approved_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee payroll:', error);
    sendError(res, 500, 'خطأ في جلب كشف راتب الموظف', 'INTERNAL_ERROR', error.message);
  }
});

// DELETE - remove a specific partial payment
router.delete('/:employeeId/partial-payments/:paymentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId, paymentId } = req.params;
    const { month } = req.query;

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    // Find payroll
    const { data: payroll, error: payErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (payErr) throw payErr;

    if (!payroll) {
      return sendError(res, 404, 'كشف الراتب غير موجود', 'NOT_FOUND');
    }

    // Find the payment to remove
    const { data: payment, error: pmtFindErr } = await supabase
      .from('payroll_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('payroll_id', payroll.id)
      .single();
    if (pmtFindErr || !payment) {
      return sendError(res, 404, 'الدفعة الجزئية غير موجودة', 'NOT_FOUND');
    }

    // Delete the payment
    const { error: delErr } = await supabase
      .from('payroll_payments')
      .delete()
      .eq('id', paymentId);
    if (delErr) throw delErr;

    // Recalculate status
    const remainingPayments = await fetchPayments(payroll.id);
    const totalPaid = getTotalPaidAmount(remainingPayments);
    const newStatus = recalcStatus(payroll.net_salary, totalPaid);

    const { error: updErr } = await supabase
      .from('payroll')
      .update({ status: newStatus, updated_by: req.user.id })
      .eq('id', payroll.id);
    if (updErr) throw updErr;

    // Add history
    await addHistory(
      payroll.id,
      'remove_partial_payment',
      `تم حذف دفعة جزئية بمبلغ ${payment.amount} ريال`,
      req.user.id
    );

    res.json({
      success: true,
      message: 'تم حذف الدفعة الجزئية بنجاح',
      data: {
        payrollId: payroll.id,
        removedAmount: payment.amount,
        totalPaid,
        remainingAmount: payroll.net_salary - totalPaid > 0 ? payroll.net_salary - totalPaid : 0,
        status: newStatus
      }
    });
  } catch (error) {
    console.error('Error removing partial payment:', error);
    sendError(res, 500, 'خطأ في حذف الدفعة الجزئية', 'INTERNAL_ERROR', error.message);
  }
});

// PUT - update monthly bonuses and deductions
router.put('/:employeeId/adjustments', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, type, adjustment } = req.body;

    if (!type || !adjustment || !['bonus', 'deduction'].includes(type)) {
      return sendError(res, 400, 'نوع التعديل يجب أن يكون bonus أو deduction', 'VALIDATION_ERROR');
    }

    if (!adjustment.type || !adjustment.amount || adjustment.amount <= 0) {
      return sendError(res, 400, 'بيانات التعديل غير مكتملة', 'VALIDATION_ERROR');
    }

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    // Verify employee exists
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    if (empErr || !employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    // Find or create payroll
    let { data: payroll, error: findErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!payroll) {
      const payrollRow = buildPayrollData(employee, payrollMonth, req.user.id);
      const { data: newPayroll, error: insErr } = await supabase
        .from('payroll')
        .insert(payrollRow)
        .select()
        .single();
      if (insErr) throw insErr;
      payroll = newPayroll;
    } else {
      if (payroll.status === 'paid') {
        return sendError(res, 400, 'لا يمكن تعديل راتب مدفوع بالكامل', 'CANNOT_MODIFY_PAID_SALARY');
      }
    }

    // Insert the bonus or deduction into the appropriate table
    const tableName = type === 'bonus' ? 'payroll_bonuses' : 'payroll_deductions';
    const { data: insertedAdj, error: adjErr } = await supabase
      .from(tableName)
      .insert({
        payroll_id: payroll.id,
        type: adjustment.type,
        amount: adjustment.amount,
        description: adjustment.description || ''
      })
      .select()
      .single();
    if (adjErr) throw adjErr;

    // Recalculate gross and net salary
    const [bonuses, deductions] = await Promise.all([
      fetchBonuses(payroll.id),
      fetchDeductions(payroll.id)
    ]);
    const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalExtraDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);

    const baseGross = payroll.base_salary +
      (payroll.allowance_transportation || 0) +
      (payroll.allowance_housing || 0) +
      (payroll.allowance_meal || 0) +
      (payroll.allowance_performance || 0) +
      (payroll.allowance_other || 0);
    const baseDeductions = (payroll.deduction_insurance || 0) +
      (payroll.deduction_taxes || 0) +
      (payroll.deduction_loans || 0) +
      (payroll.deduction_absence || 0) +
      (payroll.deduction_other || 0);

    const newGross = baseGross + totalBonuses;
    const newNet = newGross - baseDeductions - totalExtraDeductions;

    const { error: updErr } = await supabase
      .from('payroll')
      .update({
        gross_salary: newGross,
        net_salary: newNet,
        updated_by: req.user.id
      })
      .eq('id', payroll.id);
    if (updErr) throw updErr;

    // Add history
    await addHistory(
      payroll.id,
      `add_${type}`,
      `تم إضافة ${type === 'bonus' ? 'مكافأة' : 'خصم'}: ${adjustment.type} بمبلغ ${adjustment.amount} ريال`,
      req.user.id
    );

    res.json({
      success: true,
      message: `تم إضافة ${type === 'bonus' ? 'المكافأة' : 'الخصم'} بنجاح`,
      data: {
        payrollId: payroll.id,
        adjustment: insertedAdj,
        newNetSalary: newNet,
        status: payroll.status
      }
    });
  } catch (error) {
    console.error('Error updating adjustments:', error);
    sendError(res, 500, 'خطأ في تحديث التعديلات', 'INTERNAL_ERROR', error.message);
  }
});

// DELETE - remove a bonus or deduction
router.delete('/:employeeId/adjustments/:adjustmentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { employeeId, adjustmentId } = req.params;
    const { month, type } = req.query;

    if (!type || !['bonus', 'deduction'].includes(type)) {
      return sendError(res, 400, 'نوع التعديل يجب أن يكون bonus أو deduction', 'VALIDATION_ERROR');
    }

    const currentDate = new Date();
    const payrollMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const { month: monthNum, year: yearNum } = parseMonth(payrollMonth);

    // Find employee
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    if (empErr || !employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    // Find payroll
    const { data: payroll, error: payErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .maybeSingle();
    if (payErr) throw payErr;

    if (!payroll) {
      return sendError(res, 404, 'كشف الراتب غير موجود', 'NOT_FOUND');
    }

    if (payroll.status === 'paid') {
      return sendError(res, 400, 'لا يمكن تعديل راتب مدفوع بالكامل', 'CANNOT_MODIFY_PAID_SALARY');
    }

    // Find and delete the adjustment
    const tableName = type === 'bonus' ? 'payroll_bonuses' : 'payroll_deductions';
    const { data: removedAdj, error: findAdjErr } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', adjustmentId)
      .eq('payroll_id', payroll.id)
      .single();
    if (findAdjErr || !removedAdj) {
      return sendError(res, 404, 'التعديل غير موجود', 'NOT_FOUND');
    }

    const { error: delErr } = await supabase
      .from(tableName)
      .delete()
      .eq('id', adjustmentId);
    if (delErr) throw delErr;

    // Recalculate gross and net salary
    const [bonuses, deductions] = await Promise.all([
      fetchBonuses(payroll.id),
      fetchDeductions(payroll.id)
    ]);
    const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalExtraDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);

    const baseGross = payroll.base_salary +
      (payroll.allowance_transportation || 0) +
      (payroll.allowance_housing || 0) +
      (payroll.allowance_meal || 0) +
      (payroll.allowance_performance || 0) +
      (payroll.allowance_other || 0);
    const baseDeductions = (payroll.deduction_insurance || 0) +
      (payroll.deduction_taxes || 0) +
      (payroll.deduction_loans || 0) +
      (payroll.deduction_absence || 0) +
      (payroll.deduction_other || 0);

    const newGross = baseGross + totalBonuses;
    const newNet = newGross - baseDeductions - totalExtraDeductions;

    const { error: updErr } = await supabase
      .from('payroll')
      .update({
        gross_salary: newGross,
        net_salary: newNet,
        updated_by: req.user.id
      })
      .eq('id', payroll.id);
    if (updErr) throw updErr;

    // Add history
    await addHistory(
      payroll.id,
      `remove_${type}`,
      `تم حذف ${type === 'bonus' ? 'مكافأة' : 'خصم'}: ${removedAdj.type} بمبلغ ${removedAdj.amount} ريال`,
      req.user.id
    );

    res.json({
      success: true,
      message: `تم حذف ${type === 'bonus' ? 'المكافأة' : 'الخصم'} بنجاح`,
      data: {
        payrollId: payroll.id,
        removedAdjustment: removedAdj,
        newNetSalary: newNet,
        status: payroll.status
      }
    });
  } catch (error) {
    console.error('Error removing adjustment:', error);
    sendError(res, 500, 'خطأ في حذف التعديل', 'INTERNAL_ERROR', error.message);
  }
});

// GET - payroll statistics summary
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const targetYear = year || currentDate.getFullYear();
    const { month: monthNum, year: yearNum } = parseMonth(targetMonth);

    // Employee count
    const { count: totalEmployees, error: empErr } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'نشط');
    if (empErr) throw empErr;

    // Fetch all payrolls for the month
    const { data: payrolls, error: payErr } = await supabase
      .from('payroll')
      .select('*')
      .eq('month', monthNum)
      .eq('year', yearNum);
    if (payErr) throw payErr;

    // Fetch all payments for these payrolls
    const payrollIds = (payrolls || []).map(p => p.id);
    let allPayments = [];
    if (payrollIds.length > 0) {
      const { data: payments, error: pmtErr } = await supabase
        .from('payroll_payments')
        .select('*')
        .in('payroll_id', payrollIds);
      if (pmtErr) throw pmtErr;
      allPayments = payments || [];
    }

    // Aggregate stats manually
    const statusGroups = {};
    let totalSalaries = 0;
    let totalPaidAmount = 0;

    for (const p of (payrolls || [])) {
      if (!statusGroups[p.status]) {
        statusGroups[p.status] = { count: 0, totalAmount: 0, totalPaid: 0 };
      }
      statusGroups[p.status].count += 1;
      statusGroups[p.status].totalAmount += p.net_salary || 0;
      totalSalaries += p.net_salary || 0;

      const pPayments = allPayments.filter(pm => pm.payroll_id === p.id);
      const paidForThis = getTotalPaidAmount(pPayments);
      statusGroups[p.status].totalPaid += paidForThis;
      totalPaidAmount += paidForThis;
    }

    const totalRemaining = totalSalaries - totalPaidAmount;
    const payrollCount = (payrolls || []).length;

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        employees: {
          total: totalEmployees || 0,
          withPayroll: payrollCount,
          withoutPayroll: (totalEmployees || 0) - payrollCount
        },
        financials: {
          totalSalaries,
          totalPaid: totalPaidAmount,
          totalRemaining,
          percentagePaid: totalSalaries > 0 ? Math.round((totalPaidAmount / totalSalaries) * 100) : 0
        },
        statusBreakdown: {
          paid: statusGroups.paid?.count || 0,
          partially_paid: statusGroups.partially_paid?.count || 0,
          pending: statusGroups.pending?.count || 0,
          processing: statusGroups.processing?.count || 0,
          cancelled: statusGroups.cancelled?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payroll stats:', error);
    sendError(res, 500, 'خطأ في جلب إحصائيات الرواتب', 'INTERNAL_ERROR', error.message);
  }
});

module.exports = router;
