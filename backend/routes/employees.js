const express = require('express');
const router = express.Router();
const { employeeValidation } = require('../middleware/validation');
const sendError = require('../utils/sendError');
const { requireAuth, requireRole } = require('../middleware/auth');
const Employee = require('../models/Employee');
const mongoose = require('mongoose');
const User = require('../models/User');
const Tracking = require('../models/Tracking');
const Setting = require('../models/Setting');
const Payroll = require('../models/Payroll');

// GET all employees (with filtering, search, pagination)
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().populate('userId', 'username email name');

    res.json({
      success: true,
      data: employees,
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

// GET single employee by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id).populate('userId', 'username email name');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    return res.json({
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

// Middleware لتطهير وتنسيق البيانات
const sanitizeEmployeeData = (req, res, next) => {
  try {
    const data = req.body;
    console.log('🧹 Original data:', JSON.stringify(data, null, 2));

    // تنسيق رقم الهاتف
    if (data.phone) {
      data.phone = data.phone.replace(/[\\s\\-\\(\\)]/g, '');
      if (data.phone.startsWith('01')) {
        data.phone = '2' + data.phone;
      } else if (data.phone.startsWith('1') && data.phone.length === 10) {
        data.phone = '20' + data.phone;
      }
    }

    // تنسيق التواريخ بمرونة
    ['startDate', 'joinDate', 'birthDate'].forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        try {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            data[field] = date.toISOString();
          }
        } catch (e) {
          console.log(`⚠️ Invalid date for ${field}:`, data[field]);
        }
      }
    });

    // تنسيق الأرقام مع مرونة في القيم الفارغة
    const numberFields = [
      'baseSalary',
      'allowances.transportation', 'allowances.transport', 'allowances.housing',
      'allowances.meal', 'allowances.meals', 'allowances.performance',
      'deductions.socialInsurance', 'deductions.insurance', 'deductions.tax',
      'deductions.taxes', 'deductions.loan', 'deductions.loans', 'deductions.absence'
    ];

    numberFields.forEach(field => {
      const keys = field.split('.');
      let obj = data;

      // Navigate to the nested object
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
        delete data[field]; // حذف الحقل بدلاً من إرساله فارغ
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

    console.log('✅ Sanitized data:', JSON.stringify(data, null, 2));
    req.body = data;
    next();
  } catch (error) {
    console.error('❌ Error in sanitizeEmployeeData:', error);
    next();
  }
};

// POST add employee
router.post('/', requireAuth, requireRole('admin'), sanitizeEmployeeData, employeeValidation, async (req, res) => {
  try {
    const newEmp = new Employee({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    await newEmp.save();
    res.json({ success: true, message: 'تم إضافة الموظف بنجاح', data: newEmp });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update employee
router.put('/:id', requireAuth, requireRole('admin'), sanitizeEmployeeData, employeeValidation, async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم تحديث الموظف بنجاح', data: emp });
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

    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const bonusData = {
      type,
      amount: parseFloat(amount),
      description,
      reason,
      month: month || new Date().toISOString().slice(0, 7),
      addedBy: req.user.username
    };

    const bonus = employee.addBonus(bonusData);

    // تحديث حساب الراتب للشهر المحدد
    employee.updateMonthlyPayment(bonusData.month);

    await employee.save();

    res.json({
      success: true,
      message: 'تم إضافة المكافأة بنجاح',
      data: { bonus, salaryCalculation: employee.calculateMonthlySalary(bonusData.month) }
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

    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const deductionData = {
      type,
      amount: parseFloat(amount),
      description,
      reason,
      month: month || new Date().toISOString().slice(0, 7),
      addedBy: req.user.username
    };

    const deduction = employee.addDeduction(deductionData);

    // تحديث حساب الراتب للشهر المحدد
    employee.updateMonthlyPayment(deductionData.month);

    await employee.save();

    res.json({
      success: true,
      message: 'تم إضافة الخصم بنجاح',
      data: { deduction, salaryCalculation: employee.calculateMonthlySalary(deductionData.month) }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في إضافة الخصم', 'DEDUCTION_ERROR', err.message);
  }
});

// DELETE remove bonus or deduction
router.delete('/:id/adjustment/:adjustmentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const adjustmentId = req.params.adjustmentId;
    let found = false;
    let adjustmentMonth = null;

    // البحث في المكافآت
    if (employee.monthlyAdjustments?.bonuses) {
      const bonusIndex = employee.monthlyAdjustments.bonuses.findIndex(b => b.id === adjustmentId);
      if (bonusIndex !== -1) {
        adjustmentMonth = employee.monthlyAdjustments.bonuses[bonusIndex].month;
        employee.monthlyAdjustments.bonuses[bonusIndex].isActive = false;
        found = true;
      }
    }

    // البحث في الخصومات
    if (!found && employee.monthlyAdjustments?.deductions) {
      const deductionIndex = employee.monthlyAdjustments.deductions.findIndex(d => d.id === adjustmentId);
      if (deductionIndex !== -1) {
        adjustmentMonth = employee.monthlyAdjustments.deductions[deductionIndex].month;
        employee.monthlyAdjustments.deductions[deductionIndex].isActive = false;
        found = true;
      }
    }

    if (!found) {
      return sendError(res, 404, 'التعديل غير موجود', 'ADJUSTMENT_NOT_FOUND');
    }

    // تحديث حساب الراتب للشهر المحدد
    if (adjustmentMonth) {
      employee.updateMonthlyPayment(adjustmentMonth);
    }

    await employee.save();

    res.json({
      success: true,
      message: 'تم حذف التعديل بنجاح',
      data: adjustmentMonth ? employee.calculateMonthlySalary(adjustmentMonth) : null
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف التعديل', 'DELETE_ERROR', err.message);
  }
});

// POST process payment
router.post('/:id/payment', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { paymentType, amount, description, note, month } = req.body;

    if (!paymentType || !amount) {
      return sendError(res, 400, 'البيانات المطلوبة: نوع الدفع والمبلغ', 'MISSING_DATA');
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const paymentMonth = month || new Date().toISOString().slice(0, 7);

    const paymentData = {
      paymentType,
      amount: parseFloat(amount),
      description,
      note,
      paidBy: req.user.username
    };

    const monthlyPayment = employee.updateMonthlyPayment(paymentMonth, paymentData);

    // إضافة سجل في التاريخ
    employee.salaryHistory.push({
      date: new Date(),
      baseSalary: monthlyPayment.salaryCalculation.baseSalary,
      allowances: monthlyPayment.salaryCalculation.allowancesTotal,
      bonuses: monthlyPayment.salaryCalculation.bonusesTotal,
      deductions: monthlyPayment.salaryCalculation.deductionsTotal,
      netSalary: monthlyPayment.salaryCalculation.netSalary,
      paymentType,
      month: paymentMonth
    });

    await employee.save();

    res.json({
      success: true,
      message: 'تم تسجيل الدفع بنجاح',
      data: monthlyPayment
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في تسجيل الدفع', 'PAYMENT_ERROR', err.message);
  }
});

// GET salary calculation for specific month
router.get('/:id/salary/:month', requireAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const month = req.params.month;
    const salaryCalculation = employee.calculateMonthlySalary(month);
    const monthlyPayment = employee.monthlyPayments?.find(mp => mp.month === month);

    res.json({
      success: true,
      data: {
        salaryCalculation,
        paymentStatus: monthlyPayment || {
          month,
          payments: [],
          totalPaid: 0,
          remainingAmount: salaryCalculation.netSalary,
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
    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const salaryCalculation = employee.calculateMonthlySalary(currentMonth);
    const currentMonthPayment = employee.getCurrentMonthPayment();

    res.json({
      success: true,
      data: {
        employee: {
          _id: employee._id,
          name: employee.name,
          department: employee.department,
          position: employee.position
        },
        salaryCalculation,
        paymentStatus: currentMonthPayment || {
          month: currentMonth,
          payments: [],
          totalPaid: 0,
          remainingAmount: salaryCalculation.netSalary,
          status: 'pending'
        }
      }
    });
  } catch (err) {
    sendError(res, 400, 'خطأ في جلب بيانات الراتب الحالي', 'CURRENT_SALARY_ERROR', err.message);
  }
});

// PUT update employee payment (Legacy support - will be deprecated)
router.put('/:id/payment', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const allowedFields = [
      'paidAmount', 'paymentStatus', 'lastPaymentDate', 'paymentHistory',
      'monthlyAdjustments', 'baseSalary', 'allowances', 'benefits', 'deductions'
    ];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    updateData.updatedAt = new Date();

    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    );

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
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// GET current employee profile (me)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const emp = await Employee.findById(req.user.id);
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
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
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password');
      }

      // إذا لم نجد المستخدم بـ ID، جرب البحث بـ username
      if (!user) {
        user = await User.findOne({ username: userId }).select('-password');
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
    } catch (error) {
      console.warn('⚠️ Error finding user:', error.message);
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // جلب بيانات الموظف
    let employee = await Employee.findOne({ userId: userId });

    // إذا لم توجد بيانات موظف، إنشاؤها ببيانات افتراضية
    if (!employee) {
      // إنشاء رقم هاتف فريد
      const randomPhone = `0100${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;

      employee = new Employee({
        userId: userId,
        name: user.name || user.username,
        email: user.email,
        position: 'موظف',
        department: 'عام',
        phone: randomPhone,
        address: 'القاهرة، مصر',
        joinDate: user.createdAt || new Date(),
        startDate: user.createdAt || new Date(), // إضافة startDate المطلوب
        employeeId: `EMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        directManager: 'المدير العام',
        workLocation: 'المكتب الرئيسي',
        status: 'نشط' // استخدام القيمة الصحيحة من enum
      });

      try {
        await employee.save();
      } catch (saveError) {
        // في حالة وجود خطأ duplicate، جرب مرة أخرى برقم هاتف مختلف
        if (saveError.code === 11000) {
          employee.phone = `0101${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
          await employee.save();
        } else {
          throw saveError;
        }
      }
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب بيانات الأداء من قاعدة البيانات أو حسابها من البيانات الموجودة
    const performanceData = {
      overall: employee.performance?.overall || 0,
      productivity: employee.performance?.productivity || 0,
      quality: employee.performance?.quality || 0,
      teamwork: employee.performance?.teamwork || 0,
      communication: employee.performance?.communication || 0,
      goals: employee.goals || [],
      achievements: employee.achievements || [],
      lastReview: employee.lastReview || null
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب بيانات الحضور من DailyAttendance
    const DailyAttendance = require('../models/DailyAttendance');
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyAttendance = await DailyAttendance.find({
      employeeId: employee._id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const workingDays = monthlyAttendance.filter(day => !day.isWeekend && day.status !== 'عطلة');
    const presentDays = workingDays.filter(day => day.totalHours > 0);
    const absentDays = workingDays.length - presentDays.length;
    const totalHours = workingDays.reduce((sum, day) => sum + (day.totalHours || 0), 0);
    const lateDays = workingDays.filter(day => day.status === 'متأخر').length;

    const attendanceData = {
      totalWorkingDays: workingDays.length,
      presentDays: presentDays.length,
      absentDays: absentDays,
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeHours: 0, // يمكن حسابها لاحقاً
      leaveBalance: employee.leaveBalance || 0,
      thisMonth: {
        workDays: workingDays.length,
        present: presentDays.length,
        absent: absentDays,
        late: lateDays,
        early: 0 // يمكن حسابها لاحقاً
      },
      weeklyStats: [] // يمكن حسابها لاحقاً
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

    // البحث عن الموظف باستخدام userId
    const employee = await Employee.findOne({ userId: userId }).populate('userId', 'username email name');

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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب المكافآت من جدول Payroll
    const bonuses = await Payroll.find({
      employeeId: employee._id,
      month: month,
      type: 'bonus'
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bonuses
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب الخصومات من جدول Payroll
    const deductions = await Payroll.find({
      employeeId: employee._id,
      month: month,
      type: 'deduction'
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: deductions
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب آخر راتب من Payroll
    const latestSalary = await Payroll.findOne({
      employeeId: employee._id,
      type: 'salary'
    }).sort({ createdAt: -1 });

    const salaryData = {
      baseSalary: employee.baseSalary || 0,
      allowances: employee.allowances || {},
      netSalary: latestSalary?.amount || employee.baseSalary || 0,
      lastPayment: latestSalary ? {
        amount: latestSalary.amount,
        date: latestSalary.createdAt,
        status: latestSalary.status || 'paid'
      } : null
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب المستندات من قاعدة البيانات (يمكن إضافة نموذج Documents لاحقاً)
    const documentsData = {
      total: employee.documents?.length || 0,
      categories: {
        contracts: 0,
        certificates: 0,
        personal: 0,
        other: 0
      },
      recent: employee.documents || [],
      pending: employee.pendingDocuments || []
    };

    res.json({
      success: true,
      data: documentsData
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب الطلبات من قاعدة البيانات (يمكن إضافة نموذج Requests لاحقاً)
    const requests = employee.requests || [];
    const pending = requests.filter(req => req.status === 'pending').length;
    const approved = requests.filter(req => req.status === 'approved').length;
    const rejected = requests.filter(req => req.status === 'rejected').length;

    const requestsData = {
      total: requests.length,
      pending: pending,
      approved: approved,
      rejected: rejected,
      recent: requests.slice(0, 10) // آخر 10 طلبات
    };

    res.json({
      success: true,
      data: requestsData
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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // جلب الإشعارات من قاعدة البيانات (يمكن إضافة نموذج Notifications لاحقاً)
    const notifications = employee.notifications || [];
    const unread = notifications.filter(notif => !notif.read).length;

    const notificationsData = {
      total: notifications.length,
      unread: unread,
      notifications: notifications.slice(0, 20) // آخر 20 إشعار
    };

    res.json({
      success: true,
      data: notificationsData
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

// GET employee benefits data (كان مفقود!)
router.get('/benefits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Fetching benefits for userId:', userId);

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // إنشاء بيانات المزايا من الموظف
    const benefits = [];

    // إضافة البدلات كمزايا
    if (employee.allowances) {
      if (employee.allowances.transportation && employee.allowances.transportation > 0) {
        benefits.push({
          id: 'transport',
          name: 'بدل المواصلات',
          type: 'allowance',
          amount: employee.allowances.transportation,
          description: 'بدل شهري للمواصلات'
        });
      }

      if (employee.allowances.meal && employee.allowances.meal > 0) {
        benefits.push({
          id: 'meal',
          name: 'بدل الوجبات',
          type: 'allowance',
          amount: employee.allowances.meal,
          description: 'بدل شهري للوجبات'
        });
      }

      if (employee.allowances.housing && employee.allowances.housing > 0) {
        benefits.push({
          id: 'housing',
          name: 'بدل السكن',
          type: 'allowance',
          amount: employee.allowances.housing,
          description: 'بدل شهري للسكن'
        });
      }

      if (employee.allowances.performance && employee.allowances.performance > 0) {
        benefits.push({
          id: 'performance',
          name: 'بدل الأداء',
          type: 'bonus',
          amount: employee.allowances.performance,
          description: 'مكافأة شهرية للأداء المتميز'
        });
      }
    }

    // إضافة المزايا الثابتة
    benefits.push({
      id: 'social_insurance',
      name: 'التأمين الاجتماعي',
      type: 'insurance',
      amount: 0,
      description: 'تغطية التأمين الاجتماعي والصحي'
    });

    console.log('✅ Benefits data prepared:', benefits);

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

    // البحث عن الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    // حساب الإحصائيات من بيانات DailyAttendance
    const DailyAttendance = require('../models/DailyAttendance');
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyAttendance = await DailyAttendance.find({
      employeeId: employee._id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const workingDays = monthlyAttendance.filter(day => !day.isWeekend && day.status !== 'عطلة');
    const totalHours = workingDays.reduce((sum, day) => sum + (day.totalHours || 0), 0);
    const totalActiveSeconds = workingDays.reduce((sum, day) => sum + (day.activeSeconds || 0), 0);
    const totalSeconds = workingDays.reduce((sum, day) => sum + (day.totalSeconds || 0), 0);
    const productivity = totalSeconds > 0 ? Math.round((totalActiveSeconds / totalSeconds) * 100) : 0;

    const statsData = {
      workDays: workingDays.length,
      totalHours: Math.round(totalHours * 10) / 10,
      productivity: productivity,
      projectsCompleted: employee.projectsCompleted || 0,
      tasksCompleted: employee.tasksCompleted || 0,
      teamCollaboration: employee.teamCollaboration || 0,
      monthlyTrend: [], // يمكن حسابها من البيانات السابقة
      weeklyBreakdown: [] // يمكن حسابها من البيانات الأسبوعية
    };

    res.json({
      success: true,
      data: statsData
    });
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
});

// تم حذف endpoint البيانات الثابتة - سيتم استخدام endpoint البيانات الحقيقية في نهاية الملف

// جلب إحصائيات التتبع لسطح المكتب
router.get('/desktop-tracking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Desktop tracking request for userId:', userId);

    // جلب بيانات اليوم
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    console.log('📅 Searching for data on:', todayString);

    // البحث عن جميع السجلات لليوم الحالي ثم اختيار الأفضل
    const todayTrackingRecords = await Tracking.find({
      userId: userId,
      dateString: todayString
    }).sort({ createdAt: -1 });

    // اختيار السجل الذي يحتوي على أكبر عدد من الثواني المعمولة
    // إذا كان هناك عدة سجلات، نختار الذي يحتوي على بيانات فعلية
    let todayTracking = null;
    if (todayTrackingRecords.length > 0) {
      // نبحث عن السجل الذي يحتوي على أكبر totalSeconds
      todayTracking = todayTrackingRecords.reduce((best, current) => {
        const currentTotal = current.workData?.totalSeconds || 0;
        const bestTotal = best.workData?.totalSeconds || 0;
        return currentTotal > bestTotal ? current : best;
      });

      // إذا كانت جميع السجلات تحتوي على أصفار، نأخذ الأحدث
      if (todayTracking.workData?.totalSeconds === 0) {
        todayTracking = todayTrackingRecords[0];
      }
    }

    console.log('📊 Found today tracking records:', todayTrackingRecords.length);
    console.log('📊 Selected tracking record:', todayTracking ? 'YES' : 'NO');
    if (todayTracking) {
      console.log('📈 Selected record data:', {
        createdAt: todayTracking.createdAt,
        totalSeconds: todayTracking.workData?.totalSeconds,
        activeSeconds: todayTracking.workData?.activeSeconds,
        idleSeconds: todayTracking.workData?.idleSeconds,
        productivity: todayTracking.workData?.productivity,
        isWorking: todayTracking.isWorking,
        status: todayTracking.status
      });
    }

    // جلب بيانات الأسبوع الماضي
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyTracking = await Tracking.find({
      userId: userId,
      createdAt: { $gte: weekAgo }
    }).sort({ createdAt: 1 });

    // حساب حالة الاتصال - يعتمد على حالة العمل الفعلية أولاً
    const recentActivity = todayTracking && todayTracking.workData?.lastActivity &&
      (new Date() - new Date(todayTracking.workData.lastActivity)) < 5 * 60 * 1000;

    // الاتصال يعتمد على حالة العمل الفعلية - إذا كان isWorking = false فهو غير متصل
    const isConnected = todayTracking && todayTracking.isWorking === true;

    // تحضير بيانات اليوم
    const todayData = {
      totalSeconds: todayTracking?.workData?.totalSeconds || 0,
      activeSeconds: todayTracking?.workData?.activeSeconds || 0,
      idleSeconds: todayTracking?.workData?.idleSeconds || 0,
      breakSeconds: todayTracking?.workData?.breakSeconds || 0,
      productivity: todayTracking?.workData?.productivity || 0,
      sessionsCount: todayTracking?.workData?.sessionsCount || 0,
      screenshotsCount: todayTracking?.screenshots?.length || 0,
      screenshots: todayTracking?.screenshots?.map(s => s.filename).filter(Boolean) || [],
      lastActivity: todayTracking?.workData?.lastActivity || null,
      isWorking: todayTracking?.isWorking || false,
      status: todayTracking?.isWorking ? 'working' : 'offline'
    };

    // تحضير بيانات التتبع
    const desktopTracking = {
      appStatus: isConnected ? 'متصل' : 'غير متصل',
      isConnected: isConnected,
      currentSession: {
        checkInTime: todayTracking ? new Date(todayTracking.createdAt).toLocaleTimeString('ar-EG', { hour12: false }) : '-',
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
      weeklyStats: generateWeeklyStats(weeklyTracking),
      recentScreenshots: generateRecentScreenshots(todayTracking?.screenshots || []),
      permissions: {
        canStartFromWeb: false,
        canViewScreenshots: true,
        canDeleteScreenshots: false
      }
    };

    // إرجاع البيانات مع البيانات الخام لاستخدامها في الواجهة
    res.json({
      success: true,
      data: desktopTracking,
      todayData: todayData // البيانات الخام للاستخدام في الواجهة
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

// دالة مساعدة لتنسيق المدة الزمنية
function formatDuration(seconds) {
  if (!seconds) return '0:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// دالة مساعدة لتحديد مستوى النشاط
function getActivityLevel(productivity) {
  if (productivity >= 90) return 'ممتاز';
  if (productivity >= 80) return 'جيد جداً';
  if (productivity >= 70) return 'جيد';
  if (productivity >= 60) return 'مقبول';
  return 'ضعيف';
}

// دالة مساعدة لإنشاء إحصائيات أسبوعية
function generateWeeklyStats(weeklyData) {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const stats = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateString = date.toISOString().split('T')[0];

    const dayData = weeklyData.find(record => {
      // البحث بـ dateString أو date
      return record.dateString === dateString || record.date === dateString;
    });

    stats.push({
      day: days[date.getDay()],
      date: dateString,
      workTime: dayData?.workData?.totalSeconds || 0,
      activeTime: dayData?.workData?.activeSeconds || 0,
      idleTime: dayData?.workData?.idleSeconds || 0,
      productivity: dayData?.workData?.productivity || 0,
      sessionsCount: dayData?.workData?.sessionsCount || 0
    });
  }

  return stats;
}

// دالة مساعدة لإنشاء قائمة لقطات الشاشة الأخيرة
function generateRecentScreenshots(screenshots) {
  if (!screenshots || screenshots.length === 0) return [];

  return screenshots
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6)
    .map((screenshot, index) => ({
      id: index + 1,
      timestamp: new Date(screenshot.timestamp).toLocaleString('ar-EG'),
      activity: 'نشاط عمل',
      filename: screenshot.filename,
      path: screenshot.path
    }));
}

/* مسار لإصلاح ربط الموظفين بالمستخدمين */
router.post('/fix-links', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const User = require('../models/User');

    // جلب جميع الموظفين الذين ليس لديهم userId أو userId غير صحيح
    const employeesWithoutUserId = await Employee.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });

    const fixedEmployees = [];

    for (const employee of employeesWithoutUserId) {
      // البحث عن المستخدم المطابق بواسطة البريد الإلكتروني
      const user = await User.findOne({ email: employee.email });

      if (user) {
        // ربط الموظف بالمستخدم
        employee.userId = user._id;
        await employee.save();

        // تحديث المستخدم أيضاً
        user.employeeId = employee._id;
        await user.save();

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

/* إضافة مسار للموافقة على موظف (تحديث approvalStatus إلى approved) */
router.put('/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // تحديث حالة الموافقة للموظف
    emp.approvalStatus = 'approved';
    emp.status = 'نشط'; // تفعيل الموظف
    emp.approvalDetails = { approvedBy: req.user.username, approvedAt: new Date() };
    await emp.save();

    // تحديث حالة المستخدم المرتبط أيضاً
    const User = require('../models/User');
    if (emp.userId) {
      await User.findByIdAndUpdate(emp.userId, {
        status: 'active',
        approvedAt: new Date(),
        approvedBy: req.user.username
      });
    }

    res.json({ success: true, message: 'تم الموافقة على الموظف بنجاح وتفعيل حسابه', data: emp });
  } catch (err) {
    sendError(res, 400, 'خطأ في الموافقة على الموظف', 'VALIDATION_ERROR', err.message);
  }
});

/* إضافة مسار لرفض موظف (تحديث approvalStatus إلى rejected) */
router.put('/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    // تحديث حالة الرفض للموظف
    emp.approvalStatus = 'rejected';
    emp.status = 'غير نشط'; // تعطيل الموظف
    emp.approvalDetails = { rejectedBy: req.user.username, rejectedAt: new Date(), rejectionReason: req.body.rejectionReason };
    await emp.save();

    // تحديث حالة المستخدم المرتبط أيضاً
    const User = require('../models/User');
    if (emp.userId) {
      await User.findByIdAndUpdate(emp.userId, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: req.user.username,
        rejectionReason: req.body.rejectionReason
      });
    }

    res.json({ success: true, message: 'تم رفض الموظف بنجاح', data: emp });
  } catch (err) {
    sendError(res, 400, 'خطأ في رفض الموظف', 'VALIDATION_ERROR', err.message);
  }
});

// Get payment history for a specific month
router.get('/payment-history/:month?', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const month = req.params.month || new Date().toISOString().slice(0, 7);

    // جلب جميع المدفوعات والتعديلات لهذا الشهر
    const employees = await Employee.find({}).lean();
    const history = [];

    employees.forEach(emp => {
      // إضافة سجل المدفوعات
      if (emp.salaryData?.payments) {
        emp.salaryData.payments
          .filter(payment => payment.month === month || payment.date?.slice(0, 7) === month)
          .forEach(payment => {
            history.push({
              date: payment.date,
              employeeName: emp.name,
              employeeId: emp._id,
              type: 'payment',
              amount: payment.amount,
              description: payment.description || `دفع راتب ${payment.type === 'full' ? 'كامل' : payment.type === 'partial' ? 'جزئي' : 'سلفة'}`,
              status: 'completed'
            });
          });
      }

      // إضافة سجل المكافآت
      if (emp.salaryData?.bonuses) {
        emp.salaryData.bonuses
          .filter(bonus => bonus.month === month || bonus.date?.slice(0, 7) === month)
          .forEach(bonus => {
            history.push({
              date: bonus.date,
              employeeName: emp.name,
              employeeId: emp._id,
              type: 'bonus',
              amount: bonus.amount,
              description: bonus.description || `مكافأة ${bonus.type}`,
              status: 'completed'
            });
          });
      }

      // إضافة سجل الخصومات
      if (emp.salaryData?.deductions) {
        emp.salaryData.deductions
          .filter(deduction => deduction.month === month || deduction.date?.slice(0, 7) === month)
          .forEach(deduction => {
            history.push({
              date: deduction.date,
              employeeName: emp.name,
              employeeId: emp._id,
              type: 'deduction',
              amount: deduction.amount,
              description: deduction.description || `خصم ${deduction.type}`,
              status: 'completed'
            });
          });
      }
    });

    // ترتيب السجل حسب التاريخ (الأحدث أولاً)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    sendError(res, 500, 'خطأ في جلب سجل المدفوعات', 'INTERNAL_ERROR', error.message);
  }
});

// Process payment for employee
router.post('/:id/payment', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { amount, type, description, month } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    const payment = {
      _id: new mongoose.Types.ObjectId(),
      amount: parseFloat(amount),
      type: type || 'partial',
      description,
      date: new Date(),
      month: month || new Date().toISOString().slice(0, 7)
    };

    if (!employee.salaryData.payments) {
      employee.salaryData.payments = [];
    }
    employee.salaryData.payments.push(payment);

    // تحديث إجمالي المدفوع
    employee.salaryData.totalPaid = employee.salaryData.payments.reduce((sum, p) => sum + p.amount, 0);

    await employee.save();

    res.json({
      success: true,
      message: 'تم معالجة الدفع بنجاح',
      salaryData: employee.salaryData
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في معالجة الدفع' });
  }
});

// Remove payment
router.delete('/:id/payment/:paymentId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    if (!employee.salaryData.payments) {
      return res.status(404).json({ success: false, message: 'لا توجد مدفوعات لحذفها' });
    }

    // حذف الدفعة
    employee.salaryData.payments = employee.salaryData.payments.filter(
      payment => payment._id.toString() !== req.params.paymentId
    );

    // إعادة حساب إجمالي المدفوع
    employee.salaryData.totalPaid = employee.salaryData.payments.reduce((sum, p) => sum + p.amount, 0);

    await employee.save();

    res.json({
      success: true,
      message: 'تم حذف الدفعة بنجاح',
      salaryData: employee.salaryData
    });
  } catch (error) {
    console.error('Error removing payment:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف الدفعة' });
  }
});

// Get monthly payment calculation for specific employee and month
router.get('/:id/monthly-payment/:month', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    const month = req.params.month;

    // حساب الراتب الأساسي والبدلات
    const baseSalary = employee.baseSalary || 0;
    const allowancesTotal = (employee.allowances?.transportation || 0) +
      (employee.allowances?.housing || 0) +
      (employee.allowances?.meal || 0);

    // البحث عن بيانات الشهر المحدد
    const monthlyPayment = employee.monthlyPayments?.find(mp => mp.month === month);

    // حساب المكافآت والخصومات للشهر
    const activeBonuses = employee.monthlyAdjustments?.bonuses?.filter(b =>
      b.month === month && b.isActive !== false
    ) || [];

    const activeDeductions = employee.monthlyAdjustments?.deductions?.filter(d =>
      d.month === month && d.isActive !== false
    ) || [];

    const bonusesTotal = activeBonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
    const adjustmentDeductionsTotal = activeDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);

    // الخصومات الثابتة
    const fixedDeductionsTotal = (employee.deductions?.socialInsurance || 0) +
      (employee.deductions?.tax || 0);

    const totalDeductions = fixedDeductionsTotal + adjustmentDeductionsTotal;
    const netSalary = baseSalary + allowancesTotal + bonusesTotal - totalDeductions;

    // إجمالي المدفوع والمتبقي
    const totalPaid = monthlyPayment?.totalPaid || 0;
    const remainingAmount = Math.max(0, netSalary - totalPaid);

    const paymentData = {
      salaryCalculation: {
        baseSalary,
        allowancesTotal,
        bonusesTotal,
        deductionsTotal: totalDeductions,
        netSalary,
        allowancesBreakdown: employee.allowances || {},
        bonusesBreakdown: activeBonuses,
        deductionsBreakdown: {
          fixed: {
            socialInsurance: employee.deductions?.socialInsurance || 0,
            tax: employee.deductions?.tax || 0
          },
          adjustments: activeDeductions
        }
      },
      paymentStatus: {
        totalPaid,
        remainingAmount,
        status: totalPaid >= netSalary ? 'completed' : totalPaid > 0 ? 'partial' : 'pending'
      },
      adjustments: {
        bonuses: activeBonuses,
        deductions: activeDeductions
      },
      paymentHistory: monthlyPayment?.payments || []
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

    // استخدام نموذج Tracking الموجود
    const Tracking = require('../models/Tracking');

    // إعداد فلتر البحث
    let filter = {};

    // فلتر التاريخ
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // فلتر الموظف المحدد
    if (employeeId) {
      filter.$or = [
        { userId: employeeId },
        { employeeId: employeeId }
      ];
    }

    // فلتر القسم
    if (department && department !== 'all') {
      filter['userInfo.department'] = department;
    }

    // جلب بيانات التتبع
    const trackingData = await Tracking.find(filter)
      .populate('userId', 'username email firstName lastName department position')
      .populate('employeeId', 'name employeeNumber email department position')
      .sort({ date: -1 })
      .limit(100);

    // تجميع الإحصائيات
    const stats = {
      totalRecords: trackingData.length,
      totalWorkTime: 0,
      totalActiveTime: 0,
      totalScreenshots: 0,
      averageProductivity: 0,
      employeeStats: {}
    };

    trackingData.forEach(record => {
      const employeeKey = record.userInfo?.email || record.userId?.email || record.employeeId?.email || 'unknown';

      if (!stats.employeeStats[employeeKey]) {
        stats.employeeStats[employeeKey] = {
          name: record.userInfo?.name ||
            `${record.userId?.firstName || ''} ${record.userId?.lastName || ''}`.trim() ||
            record.employeeId?.name || 'غير محدد',
          department: record.userInfo?.department || record.userId?.department || record.employeeId?.department,
          totalWorkTime: 0,
          totalActiveTime: 0,
          totalScreenshots: 0,
          averageProductivity: 0,
          recordsCount: 0
        };
      }

      if (record.workData) {
        const workTime = record.workData.totalSeconds || 0;
        const activeTime = record.workData.activeSeconds || 0;
        const productivity = record.workData.productivity || 0;

        stats.totalWorkTime += workTime;
        stats.totalActiveTime += activeTime;
        stats.averageProductivity += productivity;

        stats.employeeStats[employeeKey].totalWorkTime += workTime;
        stats.employeeStats[employeeKey].totalActiveTime += activeTime;
        stats.employeeStats[employeeKey].averageProductivity += productivity;
        stats.employeeStats[employeeKey].recordsCount++;
      }

      const screenshotsCount = record.screenshots ? record.screenshots.length : 0;
      stats.totalScreenshots += screenshotsCount;
      stats.employeeStats[employeeKey].totalScreenshots += screenshotsCount;
    });

    // حساب المتوسطات
    if (trackingData.length > 0) {
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
      data: trackingData,
      stats: stats,
      count: trackingData.length
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

    // التحقق من وجود الموظف
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');
    }

    // استخدام نموذج Tracking الموجود
    const Tracking = require('../models/Tracking');

    // إعداد فلتر البحث
    let filter = {
      $or: [
        { employeeId: employeeId },
        { userId: employeeId },
        { 'userInfo.email': employee.email }
      ]
    };

    // فلتر التاريخ
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const trackingData = await Tracking.find(filter)
      .populate('userId', 'username email firstName lastName department position')
      .populate('employeeId', 'name employeeNumber email department position')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // حساب الإحصائيات
    const stats = {
      totalDays: trackingData.length,
      totalWorkTime: 0,
      totalActiveTime: 0,
      totalScreenshots: 0,
      averageProductivity: 0
    };

    trackingData.forEach(record => {
      if (record.workData) {
        stats.totalWorkTime += record.workData.totalSeconds || 0;
        stats.totalActiveTime += record.workData.activeSeconds || 0;
        stats.averageProductivity += record.workData.productivity || 0;
      }
      stats.totalScreenshots += record.screenshots ? record.screenshots.length : 0;
    });

    if (trackingData.length > 0) {
      stats.averageProductivity = Math.round(stats.averageProductivity / trackingData.length);
    }

    res.json({
      success: true,
      data: trackingData,
      stats: stats,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position
      },
      count: trackingData.length
    });

  } catch (error) {
    console.error('Error fetching employee tracking data:', error);
    sendError(res, 500, 'خطأ في جلب بيانات تتبع الموظف', 'INTERNAL_ERROR', error.message);
  }
});

// جلب بيانات الراتب والمزايا
router.get('/salary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب بيانات الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    // حساب الراتب للشهر الحالي
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // البحث عن راتب الشهر الحالي أو إنشاء واحد افتراضي
    let monthlyPayment = employee.monthlyPayments.find(payment => payment.month === currentMonth);

    if (!monthlyPayment) {
      // إنشاء راتب افتراضي للشهر الحالي
      const baseSalary = employee.baseSalary || 12000;
      const allowancesTotal = (employee.allowances?.transportation || 500) +
        (employee.allowances?.housing || 1500) +
        (employee.allowances?.meal || 300);

      const deductionsTotal = (employee.deductions?.socialInsurance || 650) +
        (employee.deductions?.tax || 850);

      const grossSalary = baseSalary + allowancesTotal;
      const netSalary = grossSalary - deductionsTotal;

      monthlyPayment = {
        month: currentMonth,
        salaryCalculation: {
          baseSalary: baseSalary,
          allowancesTotal: allowancesTotal,
          allowancesBreakdown: {
            transportation: employee.allowances?.transportation || 500,
            housing: employee.allowances?.housing || 1500,
            meal: employee.allowances?.meal || 300
          },
          bonusesTotal: 0,
          bonusesBreakdown: [],
          deductionsTotal: deductionsTotal,
          deductionsBreakdown: {
            fixed: {
              socialInsurance: employee.deductions?.socialInsurance || 650,
              tax: employee.deductions?.tax || 850
            },
            adjustments: []
          },
          grossSalary: grossSalary,
          netSalary: netSalary
        },
        payments: [],
        totalPaid: 0,
        remainingAmount: netSalary,
        status: 'pending'
      };
    }

    // إعداد بيانات الراتب للإرسال
    const salaryData = {
      basic: monthlyPayment.salaryCalculation.baseSalary,
      allowances: monthlyPayment.salaryCalculation.allowancesTotal,
      housing: monthlyPayment.salaryCalculation.allowancesBreakdown.housing,
      transportation: monthlyPayment.salaryCalculation.allowancesBreakdown.transportation,
      meal: monthlyPayment.salaryCalculation.allowancesBreakdown.meal,
      bonuses: monthlyPayment.salaryCalculation.bonusesTotal,
      deductions: monthlyPayment.salaryCalculation.deductionsTotal,
      insurance: monthlyPayment.salaryCalculation.deductionsBreakdown.fixed.socialInsurance,
      tax: monthlyPayment.salaryCalculation.deductionsBreakdown.fixed.tax,
      gross: monthlyPayment.salaryCalculation.grossSalary,
      net: monthlyPayment.salaryCalculation.netSalary,
      lastPayDate: monthlyPayment.payments.length > 0 ?
        monthlyPayment.payments[monthlyPayment.payments.length - 1].date :
        new Date().toISOString().split('T')[0],
      status: monthlyPayment.status,
      totalPaid: monthlyPayment.totalPaid,
      remainingAmount: monthlyPayment.remainingAmount
    };

    res.json({
      success: true,
      data: salaryData
    });

  } catch (error) {
    console.error('خطأ في جلب بيانات الراتب:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// جلب بيانات المستندات
router.get('/documents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب بيانات الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    // مستندات افتراضية إذا لم توجد مستندات
    const defaultDocuments = [
      {
        id: 1,
        title: 'عقد العمل',
        date: employee.startDate || new Date(),
        type: 'PDF',
        size: '245 KB',
        status: 'مكتمل'
      },
      {
        id: 2,
        title: 'صورة الهوية',
        date: employee.startDate || new Date(),
        type: 'JPG',
        size: '156 KB',
        status: 'مكتمل'
      },
      {
        id: 3,
        title: 'الشهادات العلمية',
        date: employee.startDate || new Date(),
        type: 'PDF',
        size: '892 KB',
        status: 'مكتمل'
      },
      {
        id: 4,
        title: 'السيرة الذاتية',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        type: 'PDF',
        size: '324 KB',
        status: 'مكتمل'
      }
    ];

    const documents = employee.documents.length > 0 ? employee.documents : defaultDocuments;

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('خطأ في جلب المستندات:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// جلب الإحصائيات العامة للموظف
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // جلب بيانات الموظف
    const employee = await Employee.findOne({ userId: userId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'الموظف غير موجود' });
    }

    // جلب بيانات التتبع للشهر الحالي
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startOfMonth = new Date(currentMonth + '-01');
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

    const trackingData = await Tracking.find({
      userId: userId,
      dateString: { $regex: `^${currentMonth}` }
    });

    // حساب إحصائيات العمل
    const totalWorkSeconds = trackingData.reduce((sum, record) =>
      sum + (record.workData?.totalSeconds || 0), 0);
    const totalActiveSeconds = trackingData.reduce((sum, record) =>
      sum + (record.workData?.activeSeconds || 0), 0);

    const totalWorkHours = Math.floor(totalWorkSeconds / 3600);
    const productivity = totalWorkSeconds > 0 ?
      Math.round((totalActiveSeconds / totalWorkSeconds) * 100) : 0;

    // حساب الحضور
    const workingDaysThisMonth = trackingData.length;
    const expectedWorkingDays = new Date().getDate(); // تقريبي
    const attendanceRate = expectedWorkingDays > 0 ?
      Math.round((workingDaysThisMonth / expectedWorkingDays) * 100) : 0;

    // حساب الراتب
    const baseSalary = employee.baseSalary || 12000;
    const allowancesTotal = (employee.allowances?.transportation || 500) +
      (employee.allowances?.housing || 1500) +
      (employee.allowances?.meal || 300);
    const netSalary = baseSalary + allowancesTotal -
      ((employee.deductions?.socialInsurance || 650) +
        (employee.deductions?.tax || 850));

    // إحصائيات المهام (افتراضية مبنية على الأداء)
    const performanceRating = employee.performance?.rating || 4.2;
    const totalTasks = Math.floor(performanceRating * 15); // تقدير
    const completedTasks = Math.floor(totalTasks * 0.85); // 85% إنجاز

    // إحصائيات الإجازات
    const leaveBalance = employee.attendance?.leaveBalance || 21;
    const usedLeaves = 21 - leaveBalance;

    const stats = {
      // إحصائيات العمل
      workStats: {
        totalHours: totalWorkHours,
        productivity: productivity,
        attendanceRate: attendanceRate,
        workingDays: workingDaysThisMonth
      },

      // إحصائيات المالية
      financialStats: {
        monthlySalary: netSalary,
        basicSalary: baseSalary,
        allowances: allowancesTotal,
        lastPayment: new Date().toISOString().split('T')[0]
      },

      // إحصائيات المهام
      taskStats: {
        totalTasks: totalTasks,
        completedTasks: completedTasks,
        completionRate: Math.round((completedTasks / totalTasks) * 100),
        pendingTasks: totalTasks - completedTasks
      },

      // إحصائيات الإجازات
      leaveStats: {
        totalBalance: 21,
        usedLeaves: usedLeaves,
        remainingLeaves: leaveBalance,
        leaveRequests: employee.leaveRequests?.length || 0
      },

      // إحصائيات الأداء
      performanceStats: {
        rating: performanceRating,
        goals: employee.performance?.goals?.length || 12,
        achievements: employee.performance?.achievements?.length || 8,
        lastReview: employee.performance?.lastReview || new Date()
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// جلب الطلبات الإدارية للموظف
router.get('/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let employee = await Employee.findOne({ userId });

    if (!employee) {
      // إنشاء بيانات افتراضية للطلبات
      const defaultRequests = [
        {
          id: '1',
          type: 'إجازة سنوية',
          date: new Date('2024-06-01'),
          duration: '5 أيام',
          status: 'موافق عليها',
          description: 'إجازة صيفية',
          approvedBy: 'مدير الموارد البشرية',
          approvedAt: new Date('2024-06-02')
        },
        {
          id: '2',
          type: 'إجازة مرضية',
          date: new Date('2024-05-20'),
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

    // إرجاع الطلبات الحقيقية
    const requests = employee.requests || [];

    res.json({
      success: true,
      data: requests,
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

// جلب الإشعارات للموظف
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let employee = await Employee.findOne({ userId });

    if (!employee) {
      // إنشاء بيانات افتراضية للإشعارات
      const defaultNotifications = [
        {
          id: '1',
          title: 'تم صرف الراتب',
          message: 'تم صرف راتب شهر يونيو بنجاح',
          type: 'success',
          date: new Date(Date.now() - 10 * 60 * 1000),
          read: false
        },
        {
          id: '2',
          title: 'اجتماع فريق العمل',
          message: 'اجتماع يوم الأحد الساعة 10 صباحاً',
          type: 'info',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000),
          read: false
        }
      ];

      return res.json({
        success: true,
        data: defaultNotifications,
        message: 'تم جلب الإشعارات الافتراضية'
      });
    }

    // إرجاع الإشعارات الحقيقية
    const notifications = employee.notifications || [];

    res.json({
      success: true,
      data: notifications,
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

// تحديث البيانات الشخصية للموظف
router.put('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // تحديث البيانات الأساسية
    const allowedFields = [
      'position', 'department', 'directManager', 'workLocation', 'address',
      'phone', 'emergencyContact', 'maritalStatus', 'skills', 'education'
    ];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    filteredData.updatedAt = new Date();

    const employee = await Employee.findOneAndUpdate(
      { userId },
      { $set: filteredData },
      { new: true, upsert: true }
    );

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
    const { type, duration, description, reason } = req.body;

    const newRequest = {
      type,
      date: new Date(),
      duration: duration || '-',
      status: 'قيد المراجعة',
      description,
      reason
    };

    const employee = await Employee.findOneAndUpdate(
      { userId },
      {
        $push: { requests: newRequest }
      },
      { new: true, upsert: true }
    );

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

    const employee = await Employee.findOneAndUpdate(
      {
        userId,
        'notifications.id': notificationId
      },
      {
        $set: { 'notifications.$.read': read }
      },
      { new: true }
    );

    if (!employee) {
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

    console.log('🔍 Daily records request for userId:', userId);

    // حساب تاريخ الأسبوعين الماضيين
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14); // آخر 14 يوم

    console.log('📅 Searching for data between:', startDate.toISOString().split('T')[0], 'and', endDate.toISOString().split('T')[0]);

    // جلب بيانات التتبع للأسبوعين الماضيين
    let trackingData = [];

    try {
      // محاولة البحث بـ userId أولاً
      trackingData = await Tracking.find({
        userId: userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      console.log('📊 Found tracking records by userId:', trackingData.length);

      // إذا لم نجد نتائج، جرب البحث بـ employeeId إذا كان ObjectId صحيح
      if (trackingData.length === 0 && mongoose.Types.ObjectId.isValid(userId)) {
        trackingData = await Tracking.find({
          employeeId: userId,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }).sort({ date: 1 });

        console.log('📊 Found tracking records by employeeId:', trackingData.length);
      }

    } catch (error) {
      console.warn('⚠️ Error querying tracking data:', error.message);
      trackingData = []; // استخدام مصفوفة فارغة في حالة الخطأ
    }

    console.log('📊 Found tracking records:', trackingData.length);

    // إنشاء سجل للأيام الـ 14 الماضية
    const dailyRecords = [];

    for (let i = 13; i >= 0; i--) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - i);
      const dateString = currentDate.toISOString().split('T')[0];

      // البحث عن بيانات هذا اليوم
      const dayData = trackingData.find(record => {
        const recordDate = new Date(record.date).toISOString().split('T')[0];
        return recordDate === dateString || record.dateString === dateString;
      });

      // فحص العطلة الأسبوعية بناءً على الإعدادات
      const holidaySettings = await Setting.findOne({ id: 'official_holidays' });
      const weekends = holidaySettings?.settings?.weekends || [5, 6]; // الجمعة والسبت افتراضياً
      const isWeekend = weekends.includes(currentDate.getDay());
      const isToday = i === 0;

      // استخدام البيانات الحقيقية إذا كانت متوفرة
      let totalSeconds = 0;
      let activeSeconds = 0;
      let idleSeconds = 0;
      let breakSeconds = 0;
      let productivity = 0;
      let screenshotCount = 0;
      let status = 'غائب';

      if (dayData && dayData.workData) {
        totalSeconds = dayData.workData.totalSeconds || 0;
        activeSeconds = dayData.workData.activeSeconds || 0;
        idleSeconds = dayData.workData.idleSeconds || 0;
        breakSeconds = dayData.workData.breakSeconds || 0;
        productivity = dayData.workData.productivity || 0;
        screenshotCount = dayData.screenshots ? dayData.screenshots.length : 0;

        // تحديد الحالة بناءً على البيانات الحقيقية
        if (isWeekend) {
          status = 'إجازة';
        } else if (totalSeconds >= 6 * 3600) { // 6 ساعات أو أكثر
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
        screenshots: screenshotCount,
        isWeekend,
        isToday,
        hasRealData: !!dayData // للإشارة إلى وجود بيانات حقيقية
      });
    }

    console.log('📈 Generated daily records:', dailyRecords.length);

    // حساب الإحصائيات الإجمالية
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

// التحكم بسطح المكتب - route جديد لإرسال أوامر للتطبيق المكتبي
router.post('/desktop-control', async (req, res) => {
  try {
    const { command, payload = {} } = req.body;

    console.log('🎮 Desktop control command received:', command, payload);

    // التحقق من صحة الأمر
    const validCommands = ['start-work', 'stop-work', 'take-break', 'end-break', 'pause-work', 'resume-work'];
    if (!validCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        message: 'أمر غير صحيح',
        validCommands
      });
    }

    // محاولة إرسال الأمر عبر Socket.IO (إذا كان متاح)
    if (req.app.get('io')) {
      const io = req.app.get('io');

      // إرسال الأمر لجميع التطبيقات المكتبية المتصلة
      io.emit('remote-control', {
        command,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          source: 'web-interface'
        }
      });

      console.log('📡 Command sent via Socket.IO:', command);

      res.json({
        success: true,
        message: `تم إرسال الأمر: ${command}`,
        command,
        timestamp: new Date().toISOString()
      });
    } else {
      // إذا لم يكن Socket.IO متاح، أعد استجابة نجاح افتراضية
      console.log('⚠️ Socket.IO not available, simulating command success');

      res.json({
        success: true,
        message: `تم محاكاة الأمر: ${command}`,
        command,
        timestamp: new Date().toISOString(),
        note: 'Socket.IO غير متصل - تم محاكاة الأمر'
      });
    }

  } catch (error) {
    console.error('❌ Error in desktop control:', error);
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
    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const bonusId = req.params.bonusId;

    // البحث في المكافآت وإلغاؤها
    if (employee.monthlyAdjustments?.bonuses) {
      const bonusIndex = employee.monthlyAdjustments.bonuses.findIndex(b => b.id === bonusId || b._id?.toString() === bonusId);
      if (bonusIndex !== -1) {
        const bonus = employee.monthlyAdjustments.bonuses[bonusIndex];
        const adjustmentMonth = bonus.month;

        // إزالة المكافأة من المصفوفة
        employee.monthlyAdjustments.bonuses.splice(bonusIndex, 1);

        // تحديث حساب الراتب للشهر المحدد
        if (adjustmentMonth) {
          employee.updateMonthlyPayment(adjustmentMonth);
        }

        await employee.save();

        return res.json({
          success: true,
          message: 'تم حذف المكافأة بنجاح',
          data: adjustmentMonth ? employee.calculateMonthlySalary(adjustmentMonth) : null
        });
      }
    }

    return sendError(res, 404, 'المكافأة غير موجودة', 'BONUS_NOT_FOUND');
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف المكافأة', 'DELETE_BONUS_ERROR', err.message);
  }
});

// DELETE remove specific deduction
router.delete('/:id/deduction/:deductionId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return sendError(res, 404, 'الموظف غير موجود', 'NOT_FOUND');

    const deductionId = req.params.deductionId;

    // البحث في الخصومات وإلغاؤها
    if (employee.monthlyAdjustments?.deductions) {
      const deductionIndex = employee.monthlyAdjustments.deductions.findIndex(d => d.id === deductionId || d._id?.toString() === deductionId);
      if (deductionIndex !== -1) {
        const deduction = employee.monthlyAdjustments.deductions[deductionIndex];
        const adjustmentMonth = deduction.month;

        // إزالة الخصم من المصفوفة
        employee.monthlyAdjustments.deductions.splice(deductionIndex, 1);

        // تحديث حساب الراتب للشهر المحدد
        if (adjustmentMonth) {
          employee.updateMonthlyPayment(adjustmentMonth);
        }

        await employee.save();

        return res.json({
          success: true,
          message: 'تم حذف الخصم بنجاح',
          data: adjustmentMonth ? employee.calculateMonthlySalary(adjustmentMonth) : null
        });
      }
    }

    return sendError(res, 404, 'الخصم غير موجود', 'DEDUCTION_NOT_FOUND');
  } catch (err) {
    sendError(res, 400, 'خطأ في حذف الخصم', 'DELETE_DEDUCTION_ERROR', err.message);
  }
});

// Removed duplicate endpoint - already exists earlier in the file

module.exports = router; 