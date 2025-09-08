const { body, validationResult } = require('express-validator');

const employeeValidation = [
  // المعلومات الأساسية
  body('fullName')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return value.length >= 2 && value.length <= 100;
    })
    .withMessage('الاسم الكامل يجب أن يكون بين 2 و100 حرف'),
  body('name')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      return value.length >= 2 && value.length <= 100;
    })
    .withMessage('الاسم يجب أن يكون بين 2 و100 حرف'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('البريد الإلكتروني غير صحيح'),
  body('phone')
    .optional()
    .matches(/^(20\d{10}|01\d{9}|\d{8,15})$/)
    .withMessage('رقم الهاتف يجب أن يكون بصيغة مصرية صحيحة'),
  body('position')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('المنصب يجب أن يكون بين 2 و100 حرف'),
  body('department')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('القسم يجب أن يكون بين 2 و100 حرف'),
  body('location')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('الموقع يجب أن يكون بين 1 و200 حرف'),
  // حقل التعليم - بدون تحقق للمرونة الكاملة
  body('education')
    .optional(),
  body('experience')
    .optional(),
  body('skills')
    .optional(),
  body('notes')
    .optional(),
  body('status')
    .optional()
    .isIn(['نشط', 'إجازة', 'تحت التدريب', 'غير نشط', 'active', 'disabled', 'leave', 'terminated'])
    .withMessage('حالة الموظف غير صحيحة'),

  // معلومات التوظيف
  body('startDate')
    .optional()
    .custom((value) => {
      if (!value) return true;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .withMessage('تاريخ بداية العمل غير صحيح'),
  body('joinDate')
    .optional()
    .custom((value) => {
      if (!value) return true;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .withMessage('تاريخ الانضمام غير صحيح'),
  body('baseSalary')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    })
    .withMessage('الراتب الأساسي يجب أن يكون رقم صحيح'),

  // البدلات والخصومات - مرونة كاملة
  body('allowances.transportation')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('allowances.transport')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('allowances.housing')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('allowances.meal')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('allowances.meals')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('allowances.performance')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),

  body('deductions.socialInsurance')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.insurance')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.tax')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.taxes')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.loan')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.loans')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),
  body('deductions.absence')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }),

  // معلومات شخصية - كلها اختيارية
  body('birthDate')
    .optional()
    .custom((value) => {
      if (!value) return true;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }),
  body('gender')
    .optional()
    .isIn(['ذكر', 'أنثى', 'male', 'female'])
    .withMessage('الجنس غير صحيح'),
  body('maritalStatus')
    .optional()
    .isIn(['أعزب', 'متزوج', 'مطلق', 'أرمل', 'single', 'married', 'divorced', 'widowed'])
    .withMessage('الحالة الاجتماعية غير صحيحة'),

  // معلومات الاتصال الطارئ - اختيارية
  body('emergencyContact.name')
    .optional()
    .isLength({ min: 0, max: 100 }),
  body('emergencyContact.phone')
    .optional()
    .custom((value) => {
      if (!value) return true;
      return /^(20\d{10}|01\d{9}|\d{8,15})$/.test(value);
    }),
  body('emergencyContact.relation')
    .optional()
    .isLength({ min: 0, max: 50 }),

  // معلومات العمل - اختيارية
  body('workSchedule.startTime')
    .optional(),
  body('workSchedule.endTime')
    .optional(),
  body('workSchedule.workDays')
    .optional(),
  body('workSchedule.breakTime')
    .optional(),

  // التحقق من الأخطاء مع المزيد من المرونة
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errorCode: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
];

const transactionValidation = [
  body('amount')
    .custom((value) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('المبلغ يجب أن يكون رقم أكبر من صفر');
      }
      return true;
    }),
  body('type')
    .isIn(['income', 'expense', 'debt']).withMessage('نوع المعاملة يجب أن يكون income أو expense أو debt'),
  body('description')
    .isLength({ min: 1, max: 500 }).withMessage('الوصف يجب أن يكون بين 1 و500 حرف'),
  body('category')
    .notEmpty().withMessage('الفئة مطلوبة'),
  body('date')
    .custom((value) => {
      if (!value) return true; // اختياري
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('تاريخ المعاملة غير صحيح');
      }
      return true;
    }),
  body('paymentMethod')
    .optional()
    .isLength({ min: 1, max: 100 }).withMessage('طريقة الدفع يجب ألا تزيد عن 100 حرف'),
  body('clientId')
    .optional()
    .custom((value) => {
      if (!value || value === '' || value === 'null') return true;
      // التحقق من أن القيمة هي ObjectId صحيح
      return /^[0-9a-fA-F]{24}$/.test(value);
    }).withMessage('معرف العميل غير صحيح'),
  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('الملاحظات يجب ألا تزيد عن 1000 حرف'),
  body('createdBy')
    .optional(),
  body('updatedBy')
    .optional(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Transaction Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errorCode: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    console.log('✅ Transaction validation passed');
    next();
  }
];

const clientValidation = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('اسم العميل يجب أن يكون بين 2 و100 حرف'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('البريد الإلكتروني غير صحيح'),
  body('phone')
    .matches(/^(20\d{10}|01\d{9}|\d{10,15})$/)
    .withMessage('رقم الهاتف غير صحيح'),
  body('company')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('اسم الشركة يجب أن يكون بين 1 و200 حرف'),
  body('address')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('العنوان يجب أن يكون بين 1 و500 حرف'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errorCode: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
];

const categoryValidation = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('اسم الفئة يجب أن يكون بين 2 و100 حرف'),
  body('type')
    .isIn(['income', 'expense', 'both', 'debt'])
    .withMessage('نوع الفئة يجب أن يكون income أو expense أو both أو debt'),
  body('description')
    .optional().isLength({ max: 500 })
    .withMessage('الوصف يجب ألا يزيد عن 500 حرف'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errorCode: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
];

const settingsValidation = [
  body('category')
    .isLength({ min: 2 })
    .withMessage('فئة الإعدادات مطلوبة'),
  body('settings')
    .isObject()
    .withMessage('الإعدادات يجب أن تكون كائن'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات',
        errorCode: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
];

module.exports = { employeeValidation, transactionValidation, clientValidation, categoryValidation, settingsValidation }; 