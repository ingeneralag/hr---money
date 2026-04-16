const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const moment = require('moment-timezone');

// Rate limiting بسيط
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 60, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.user ? req.user.id : req.ip;
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userLimit = rateLimitMap.get(key);

    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً',
        error: 'RATE_LIMIT_EXCEEDED'
      });
    }

    userLimit.count++;
    next();
  };
};

// إنشاء مجلد screenshots إذا لم يكن موجود
const uploadsDir = path.join(__dirname, '../uploads/screenshots');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// إعداد multer لرفع الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const employeeId = req.body.employeeId || 'unknown';
    cb(null, `screenshot-${timestamp}-${employeeId}.png`);
  }
});

// تحسين multer مع validation أفضل
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error('نوع الملف غير مدعوم. يُسمح فقط بـ PNG و JPEG');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  const allowedExtensions = ['.png', '.jpg', '.jpeg'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error('امتداد الملف غير مدعوم');
    error.code = 'INVALID_FILE_EXTENSION';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB حد أقصى
    files: 1
  }
});

// تحسين قواعد التحقق من صحة البيانات
const validateWorkData = [
  body('workData').exists().withMessage('workData مطلوب'),

  body('workData.totalSeconds')
    .isNumeric({ min: 0 })
    .withMessage('totalSeconds يجب أن يكون رقم أكبر من أو يساوي 0')
    .toInt(),

  body('workData.activeSeconds')
    .isNumeric({ min: 0 })
    .withMessage('activeSeconds يجب أن يكون رقم أكبر من أو يساوي 0')
    .toInt()
    .custom((value, { req }) => {
      if (value > req.body.workData.totalSeconds) {
        throw new Error('وقت النشاط لا يمكن أن يكون أكبر من الوقت الإجمالي');
      }
      return true;
    }),

  body('workData.idleSeconds')
    .isNumeric({ min: 0 })
    .withMessage('idleSeconds يجب أن يكون رقم أكبر من أو يساوي 0')
    .toInt()
    .custom((value, { req }) => {
      if (value > req.body.workData.totalSeconds) {
        throw new Error('وقت الخمول لا يمكن أن يكون أكبر من الوقت الإجمالي');
      }
      return true;
    }),

  body('workData.breakSeconds')
    .optional()
    .isNumeric({ min: 0 })
    .withMessage('breakSeconds يجب أن يكون رقم أكبر من أو يساوي 0')
    .toInt()
    .custom((value, { req }) => {
      const { totalSeconds, activeSeconds, idleSeconds } = req.body.workData;
      const totalTrackedTime = (activeSeconds || 0) + (idleSeconds || 0) + (value || 0);
      if (totalTrackedTime > totalSeconds) {
        throw new Error('مجموع الأوقات (نشاط + خمول + استراحة) لا يمكن أن يتجاوز الوقت الإجمالي');
      }
      return true;
    }),

  body('workData.productivity')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('productivity يجب أن يكون رقم بين 0 و 100')
    .toFloat()
    .custom((value, { req }) => {
      const { totalSeconds, activeSeconds } = req.body.workData;
      if (totalSeconds > 0) {
        const calculatedProductivity = Math.round((activeSeconds / totalSeconds) * 100);
        if (Math.abs(value - calculatedProductivity) > 1) {
          throw new Error('قيمة الإنتاجية غير متوافقة مع نسبة وقت النشاط إلى الوقت الإجمالي');
        }
      }
      return true;
    }),

  body('workData.lastActivity')
    .optional()
    .isISO8601()
    .withMessage('lastActivity يجب أن يكون تاريخ صحيح بصيغة ISO8601')
    .toDate()
    .custom((value) => {
      if (value > new Date()) {
        throw new Error('تاريخ آخر نشاط لا يمكن أن يكون في المستقبل');
      }
      return true;
    })
];

// Validation middleware لتسجيل الدخول
const validateLogin = [
  body('username')
    .notEmpty()
    .withMessage('اسم المستخدم مطلوب')
    .isLength({ min: 3 })
    .withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('password')
    .notEmpty()
    .withMessage('كلمة المرور مطلوبة')
    .isLength({ min: 6 })
    .withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
];

// Validation middleware للصور
const validateScreenshot = [
  body('employeeId')
    .notEmpty()
    .withMessage('employeeId مطلوب')
];

// دالة للتحقق من نتائج الـ validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('❌ أخطاء validation:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'خطأ في البيانات المرسلة',
      errors: errors.array()
    });
  }
  next();
};

// دالة logging للعمليات المهمة
const logActivity = (action, userId, details = {}) => {
  console.log('Activity Log:', {
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown'
  });
};

// Middleware للتحقق من التوكن
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'مطلوب توكن المصادقة'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'توكن غير صالح'
      });
    }
    req.user = user;
    next();
  });
}

// تسجيل دخول للتطبيق المكتبي
router.post('/desktop-login', rateLimit(5, 300000), validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال اسم المستخدم وكلمة المرور'
      });
    }

    // أولاً: البحث في جدول المستخدمين (User)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .maybeSingle();

    if (userError) throw userError;

    if (user) {
      // التحقق من كلمة المرور
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'بيانات دخول غير صحيحة'
        });
      }

      // التحقق من حالة الموافقة للموظفين
      if (user.role === 'employee') {
        // البحث عن الموظف المرتبط
        let { data: employee, error: empError } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (empError) throw empError;

        // إذا لم يجد بواسطة userId، ابحث بواسطة البريد الإلكتروني
        if (!employee) {
          const { data: emp2, error: emp2Error } = await supabase
            .from('employees')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          if (!emp2Error) employee = emp2;
        }

        if (!employee) {
          console.log(`⚠️ لم يتم العثور على موظف للمستخدم: ${user.username} (${user.id})`);
          return res.status(403).json({
            success: false,
            message: 'لم يتم العثور على بيانات الموظف'
          });
        }

        // إذا تم العثور على الموظف بدون userId، قم بتحديثه
        if (!employee.user_id) {
          await supabase
            .from('employees')
            .update({ user_id: user.id })
            .eq('id', employee.id);
          console.log(`🔗 تم ربط الموظف ${employee.name} بالمستخدم ${user.username}`);
        }

        console.log(`🔍 فحص حالة الموافقة للموظف: ${employee.name} - الحالة: ${employee.approval_status}`);

        if (employee.approval_status === 'pending') {
          return res.status(403).json({
            success: false,
            message: 'حسابك قيد المراجعة من قبل الإدارة'
          });
        }

        if (employee.approval_status === 'rejected') {
          return res.status(403).json({
            success: false,
            message: 'تم رفض طلب التسجيل الخاص بك'
          });
        }
      }

      // تحديث آخر تسجيل دخول
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // إنشاء JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          type: 'desktop-app'
        },
        process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production',
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          department: user.department,
          position: user.position
        }
      });
    }

    // ثانياً: إذا لم يجد في جدول المستخدمين، ابحث في جدول الموظفين
    const { data: employee, error: empSearchError } = await supabase
      .from('employees')
      .select('*')
      .or(`email.eq.${username},employee_number.eq.${username},name.eq.${username}`)
      .maybeSingle();

    if (empSearchError) throw empSearchError;

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'بيانات دخول غير صحيحة'
      });
    }

    // التحقق من كلمة المرور (للموظفين القدامى نستخدم كلمة مرور افتراضية)
    const defaultPassword = '123456';
    if (password !== defaultPassword) {
      return res.status(401).json({
        success: false,
        message: 'بيانات دخول غير صحيحة'
      });
    }

    // إنشاء JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        employeeNumber: employee.employee_number,
        email: employee.email,
        name: employee.name,
        type: 'desktop-app'
      },
      process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      employee: {
        id: employee.id,
        employeeNumber: employee.employee_number,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        avatar: employee.avatar
      }
    });

  } catch (error) {
    console.error('Desktop login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// تحديث بيانات التتبع (no longer uses mongoose sessions)
router.post('/update', validateWorkData, handleValidationErrors, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const workData = req.body.workData;

    // البحث عن السجل وتحديثه
    const { data: tracking, error: findError } = await supabase
      .from('tracking')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (findError) throw findError;

    if (!tracking) {
      // إنشاء سجل جديد إذا لم يكن موجوداً
      const { data: newTracking, error: insertError } = await supabase
        .from('tracking')
        .insert({
          employee_id: employeeId,
          total_seconds: workData.totalSeconds || 0,
          active_seconds: workData.activeSeconds || 0,
          idle_seconds: workData.idleSeconds || 0,
          break_seconds: workData.breakSeconds || 0,
          sessions_count: workData.sessionsCount || 0,
          productivity: workData.productivity || 0,
          last_activity: workData.lastActivity || new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          date_string: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.json({
        success: true,
        message: 'تم تحديث بيانات التتبع بنجاح',
        data: newTracking
      });
    } else {
      // تحديث السجل الموجود
      const { data: updated, error: updateError } = await supabase
        .from('tracking')
        .update({
          total_seconds: workData.totalSeconds || 0,
          active_seconds: workData.activeSeconds || 0,
          idle_seconds: workData.idleSeconds || 0,
          break_seconds: workData.breakSeconds || 0,
          sessions_count: workData.sessionsCount || 0,
          productivity: workData.productivity || 0,
          last_activity: workData.lastActivity || new Date().toISOString(),
          last_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tracking.id)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json({
        success: true,
        message: 'تم تحديث بيانات التتبع بنجاح',
        data: updated
      });
    }

  } catch (error) {
    console.error('خطأ في تحديث بيانات التتبع:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث بيانات التتبع',
      error: error.message
    });
  }
});

// رفع صورة الشاشة مع validation شامل
router.post('/screenshot', authenticateToken, rateLimit(20, 60000), (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'حجم الملف كبير جداً. الحد الأقصى 5MB',
          error: 'FILE_TOO_LARGE'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_FILE_EXTENSION') {
        return res.status(400).json({
          success: false,
          message: err.message,
          error: err.code
        });
      }
      return res.status(400).json({
        success: false,
        message: 'خطأ في رفع الملف',
        error: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي صورة'
      });
    }

    const userId = req.user.id;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const screenshotInfo = {
      filename: req.file.filename,
      timestamp: new Date().toISOString(),
      path: req.file.path
    };

    // Determine user type and search criteria
    let userType = 'user';
    let searchField = 'user_id';

    if (!(req.user.username || req.user.role)) {
      userType = 'employee';
      searchField = 'employee_id';
    }

    // Find today's tracking record
    const { data: tracking, error: findError } = await supabase
      .from('tracking')
      .select('*')
      .eq(searchField, userId)
      .eq('date_string', todayString)
      .maybeSingle();

    if (findError) throw findError;

    let trackingId;

    if (!tracking) {
      // Create new tracking record
      const insertData = {
        date: todayString,
        date_string: todayString,
        last_update: new Date().toISOString()
      };
      insertData[searchField] = userId;

      const { data: newTracking, error: insertError } = await supabase
        .from('tracking')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;
      trackingId = newTracking.id;
    } else {
      trackingId = tracking.id;
      // Update last_update
      await supabase
        .from('tracking')
        .update({ last_update: new Date().toISOString() })
        .eq('id', trackingId);
    }

    // Insert screenshot into tracking_screenshots table
    const { error: ssError } = await supabase
      .from('tracking_screenshots')
      .insert({
        tracking_id: trackingId,
        filename: screenshotInfo.filename,
        timestamp: screenshotInfo.timestamp,
        path: screenshotInfo.path
      });

    if (ssError) throw ssError;

    // تسجيل العملية
    logActivity('SCREENSHOT_UPLOAD', userId, {
      userType: userType,
      filename: screenshotInfo.filename,
      fileSize: req.file.size,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'تم رفع الصورة بنجاح',
      filename: screenshotInfo.filename,
      timestamp: screenshotInfo.timestamp
    });

  } catch (error) {
    console.error('Screenshot upload error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في رفع الصورة',
      error: error.message
    });
  }
});

// جلب بيانات المستخدم الحالي
router.get('/my-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, limit = 30 } = req.query;

    // تحديد نوع المستخدم وإعداد معايير البحث
    let searchField = 'user_id';
    if (!(req.user.username || req.user.role)) {
      searchField = 'employee_id';
    }

    let query = supabase
      .from('tracking')
      .select('*')
      .eq(searchField, userId)
      .order('date', { ascending: false })
      .limit(parseInt(limit));

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: trackingData, error } = await query;
    if (error) throw error;

    // Fetch screenshots for each tracking record
    const trackingIds = (trackingData || []).map(t => t.id);
    let screenshotsMap = {};
    if (trackingIds.length > 0) {
      const { data: screenshots } = await supabase
        .from('tracking_screenshots')
        .select('*')
        .in('tracking_id', trackingIds);

      (screenshots || []).forEach(ss => {
        if (!screenshotsMap[ss.tracking_id]) screenshotsMap[ss.tracking_id] = [];
        screenshotsMap[ss.tracking_id].push(ss);
      });
    }

    // حساب الإحصائيات
    const stats = {
      totalDays: (trackingData || []).length,
      totalWorkTime: 0,
      totalActiveTime: 0,
      totalScreenshots: 0,
      averageProductivity: 0
    };

    (trackingData || []).forEach(record => {
      stats.totalWorkTime += record.total_seconds || 0;
      stats.totalActiveTime += record.active_seconds || 0;
      stats.averageProductivity += record.productivity || 0;
      stats.totalScreenshots += (screenshotsMap[record.id] || []).length;
    });

    if ((trackingData || []).length > 0) {
      stats.averageProductivity = Math.round(stats.averageProductivity / trackingData.length);
    }

    res.json({
      success: true,
      data: trackingData,
      stats: stats,
      count: (trackingData || []).length
    });

  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب البيانات',
      error: error.message
    });
  }
});

// استرجاع بيانات اليوم
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // البحث عن سجل اليوم
    const { data: tracking, error } = await supabase
      .from('tracking')
      .select('*')
      .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
      .eq('date_string', todayString)
      .maybeSingle();

    if (error) throw error;

    if (!tracking) {
      return res.json({
        success: true,
        message: 'لا توجد بيانات لليوم الحالي',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'تم استرجاع بيانات اليوم بنجاح',
      data: tracking
    });

  } catch (error) {
    console.error('Error fetching today data:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرجاع البيانات',
      error: error.message
    });
  }
});

// جلب بيانات موظف محدد (للإدارة)
router.get('/employee/:id', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { startDate, endDate } = req.query;

    // التحقق من الصلاحيات
    if (req.user.id !== employeeId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مسموح بالوصول لهذه البيانات'
      });
    }

    let query = supabase
      .from('tracking')
      .select('*')
      .or(`employee_id.eq.${employeeId},user_id.eq.${employeeId}`)
      .order('date', { ascending: false })
      .limit(30);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: trackingData, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: trackingData,
      count: (trackingData || []).length
    });

  } catch (error) {
    console.error('Get employee data error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب البيانات',
      error: error.message
    });
  }
});

// جلب صورة شاشة محددة
router.get('/screenshot/:filename', authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'الملف غير موجود'
      });
    }

    res.sendFile(filePath);

  } catch (error) {
    console.error('Get screenshot error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الصورة',
      error: error.message
    });
  }
});

// تحديث حالة الاتصال
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status, lastActivity } = req.body;

    res.json({
      success: true,
      message: 'تم تحديث حالة الاتصال',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الاتصال',
      error: error.message
    });
  }
});

// حفظ بيانات تتبع الوقت المتقدمة
router.post('/data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { workData, screenshots, isWorking, date, timestamp } = req.body;

    console.log('💾 حفظ بيانات التتبع المتقدمة:', {
      userId,
      workData,
      screenshotCount: screenshots ? screenshots.length : 0,
      isWorking,
      date,
      timestamp
    });

    const todayDate = new Date(date);
    const todayString = todayDate.toISOString().split('T')[0];

    // Find today's tracking record
    const { data: tracking, error: findError } = await supabase
      .from('tracking')
      .select('*')
      .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
      .eq('date_string', todayString)
      .maybeSingle();

    if (findError) throw findError;

    let trackingRecord;

    if (!tracking) {
      // إنشاء سجل جديد
      const { data: newTracking, error: insertError } = await supabase
        .from('tracking')
        .insert({
          user_id: userId,
          employee_id: userId,
          date: todayString,
          date_string: todayString,
          total_seconds: workData.totalSeconds || 0,
          active_seconds: workData.activeSeconds || 0,
          idle_seconds: workData.idleSeconds || 0,
          break_seconds: workData.breakSeconds || 0,
          sessions_count: workData.sessionsCount || 0,
          productivity: workData.productivity || 0,
          last_activity: workData.lastActivity || timestamp,
          status: isWorking ? 'working' : 'idle',
          is_working: isWorking,
          last_update: timestamp
        })
        .select()
        .single();

      if (insertError) throw insertError;
      trackingRecord = newTracking;
    } else {
      // تحديث السجل الموجود
      const { data: updated, error: updateError } = await supabase
        .from('tracking')
        .update({
          total_seconds: workData.totalSeconds || 0,
          active_seconds: workData.activeSeconds || 0,
          idle_seconds: workData.idleSeconds || 0,
          break_seconds: workData.breakSeconds || 0,
          sessions_count: workData.sessionsCount || 0,
          productivity: workData.productivity || 0,
          last_activity: workData.lastActivity || timestamp,
          status: isWorking ? 'working' : 'idle',
          is_working: isWorking,
          last_update: timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', tracking.id)
        .select()
        .single();

      if (updateError) throw updateError;
      trackingRecord = updated;
    }

    // Handle screenshots - insert into tracking_screenshots table
    if (screenshots && screenshots.length > 0) {
      // Get existing screenshots to avoid duplicates
      const { data: existingScreenshots } = await supabase
        .from('tracking_screenshots')
        .select('timestamp')
        .eq('tracking_id', trackingRecord.id);

      const existingTimestamps = (existingScreenshots || []).map(s => s.timestamp);

      const newScreenshots = screenshots
        .filter(ss => !existingTimestamps.includes(ss.timestamp))
        .map(ss => ({
          tracking_id: trackingRecord.id,
          filename: ss.filename,
          timestamp: ss.timestamp,
          width: ss.width || null,
          height: ss.height || null,
          path: ss.path || null
        }));

      if (newScreenshots.length > 0) {
        await supabase.from('tracking_screenshots').insert(newScreenshots);
      }
    }

    // Get screenshot count
    const { count: screenshotCount } = await supabase
      .from('tracking_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('tracking_id', trackingRecord.id);

    res.json({
      success: true,
      message: 'تم حفظ البيانات المتقدمة بنجاح',
      data: {
        workData: {
          totalSeconds: trackingRecord.total_seconds,
          activeSeconds: trackingRecord.active_seconds,
          idleSeconds: trackingRecord.idle_seconds,
          breakSeconds: trackingRecord.break_seconds,
          sessionsCount: trackingRecord.sessions_count,
          productivity: trackingRecord.productivity,
          lastActivity: trackingRecord.last_activity
        },
        screenshotCount: screenshotCount || 0,
        isWorking: trackingRecord.status === 'working',
        lastUpdate: trackingRecord.last_update
      }
    });

  } catch (error) {
    console.error('❌ خطأ في حفظ البيانات المتقدمة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حفظ البيانات',
      error: error.message
    });
  }
});

// دالة إعادة المحاولة للعمليات
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`❌ المحاولة ${attempt} فشلت:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};

// حفظ بيانات تتبع الوقت - يدعم البيانات البسيطة والمتقدمة
router.post('/save', async (req, res) => {
  try {
    // استخراج userId من التوكن إذا كان موجوداً
    let userId;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production');
        userId = decoded.id;
      } catch (error) {
        console.log('⚠️ خطأ في فك تشفير التوكن، استخدام مستخدم افتراضي');
        userId = null;
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'مطلوب توكن المصادقة'
      });
    }

    // التحقق من نوع البيانات المرسلة
    let workData, screenshots, isWorking, date, timestamp;

    if (req.body.workData) {
      ({ workData, screenshots, isWorking, date, timestamp } = req.body);
      console.log('💾 حفظ بيانات التتبع المتقدمة:', {
        userId, workData,
        screenshotCount: screenshots ? screenshots.length : 0,
        isWorking, date, timestamp
      });
    } else {
      const { totalSeconds } = req.body;
      ({ isWorking, date, timestamp } = req.body);

      workData = {
        totalSeconds: totalSeconds || 0,
        activeSeconds: Math.floor((totalSeconds || 0) * 0.9),
        idleSeconds: Math.floor((totalSeconds || 0) * 0.1),
        productivity: 90,
        lastActivity: timestamp
      };
      screenshots = [];

      console.log('💾 حفظ بيانات التتبع البسيطة:', {
        userId, totalSeconds, isWorking, date, timestamp
      });
    }

    const dateString = req.body.dateString || new Date(date).toISOString().split('T')[0];

    // Find existing tracking record
    let tracking = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('tracking')
        .select('*')
        .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
        .eq('date_string', dateString)
        .maybeSingle();

      if (error) throw error;
      return data;
    });

    let trackingRecord;

    if (!tracking) {
      // إنشاء سجل جديد
      const { data: newTracking, error: insertError } = await retryOperation(async () => {
        return await supabase
          .from('tracking')
          .insert({
            user_id: userId,
            employee_id: userId,
            date: dateString,
            date_string: dateString,
            total_seconds: workData.totalSeconds || 0,
            active_seconds: workData.activeSeconds || 0,
            idle_seconds: workData.idleSeconds || 0,
            break_seconds: workData.breakSeconds || 0,
            sessions_count: workData.sessionsCount || 0,
            productivity: workData.productivity || 0,
            last_activity: workData.lastActivity || timestamp,
            status: isWorking ? 'working' : 'idle',
            is_working: isWorking,
            last_update: timestamp
          })
          .select()
          .single();
      });

      if (insertError) throw insertError;
      trackingRecord = newTracking;
    } else {
      // تحديث السجل الموجود
      const { data: updated, error: updateError } = await retryOperation(async () => {
        return await supabase
          .from('tracking')
          .update({
            total_seconds: workData.totalSeconds || 0,
            active_seconds: workData.activeSeconds || 0,
            idle_seconds: workData.idleSeconds || 0,
            break_seconds: workData.breakSeconds || 0,
            sessions_count: workData.sessionsCount || 0,
            productivity: workData.productivity || 0,
            last_activity: workData.lastActivity || timestamp,
            status: isWorking ? 'working' : 'idle',
            is_working: isWorking,
            last_update: timestamp,
            updated_at: new Date().toISOString()
          })
          .eq('id', tracking.id)
          .select()
          .single();
      });

      if (updateError) throw updateError;
      trackingRecord = updated;
    }

    // Handle screenshots
    if (screenshots && screenshots.length > 0 && trackingRecord) {
      const { data: existingScreenshots } = await supabase
        .from('tracking_screenshots')
        .select('timestamp')
        .eq('tracking_id', trackingRecord.id);

      const existingTimestamps = (existingScreenshots || []).map(s => s.timestamp);

      const newScreenshots = screenshots
        .filter(ss => !existingTimestamps.includes(ss.timestamp))
        .map(ss => ({
          tracking_id: trackingRecord.id,
          filename: ss.filename,
          timestamp: ss.timestamp,
          width: ss.width || null,
          height: ss.height || null,
          path: ss.path || null
        }));

      if (newScreenshots.length > 0) {
        await supabase.from('tracking_screenshots').insert(newScreenshots);
      }
    }

    // Get screenshot count
    const { count: screenshotCount } = await supabase
      .from('tracking_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('tracking_id', trackingRecord.id);

    res.json({
      success: true,
      message: 'تم حفظ البيانات بنجاح',
      data: {
        workData: {
          totalSeconds: trackingRecord.total_seconds,
          activeSeconds: trackingRecord.active_seconds,
          idleSeconds: trackingRecord.idle_seconds,
          breakSeconds: trackingRecord.break_seconds,
          sessionsCount: trackingRecord.sessions_count,
          productivity: trackingRecord.productivity,
          lastActivity: trackingRecord.last_activity
        },
        screenshotCount: screenshotCount || 0,
        isWorking: trackingRecord.status === 'working',
        lastUpdate: trackingRecord.last_update
      }
    });

  } catch (error) {
    console.error('❌ خطأ في حفظ البيانات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حفظ البيانات',
      error: error.message
    });
  }
});

// الحصول على بيانات يوم محدد
router.get('/date/:dateString', async (req, res) => {
  try {
    // استخراج userId من التوكن
    let userId;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production');
        userId = decoded.id;
      } catch (error) {
        userId = null;
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'مطلوب توكن المصادقة'
      });
    }

    const { dateString } = req.params;

    // التحقق من صحة التاريخ
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return res.status(400).json({
        success: false,
        message: 'تنسيق التاريخ غير صحيح. يجب أن يكون YYYY-MM-DD'
      });
    }

    const tracking = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('tracking')
        .select('*')
        .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
        .eq('date_string', dateString)
        .maybeSingle();

      if (error) throw error;
      return data;
    });

    if (!tracking) {
      return res.json({
        success: true,
        message: 'لا توجد بيانات لهذا التاريخ',
        data: {
          workData: {
            totalSeconds: 0,
            activeSeconds: 0,
            idleSeconds: 0,
            breakSeconds: 0,
            sessionsCount: 0,
            productivity: 0
          },
          screenshotCount: 0,
          isWorking: false,
          date: dateString
        }
      });
    }

    // Get screenshot count
    const { count: screenshotCount } = await supabase
      .from('tracking_screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('tracking_id', tracking.id);

    res.json({
      success: true,
      message: 'تم جلب البيانات بنجاح',
      data: {
        workData: {
          totalSeconds: tracking.total_seconds || 0,
          activeSeconds: tracking.active_seconds || 0,
          idleSeconds: tracking.idle_seconds || 0,
          breakSeconds: tracking.break_seconds || 0,
          sessionsCount: tracking.sessions_count || 0,
          productivity: tracking.productivity || 0
        },
        screenshotCount: screenshotCount || 0,
        isWorking: tracking.status === 'working',
        date: tracking.date_string,
        lastUpdate: tracking.last_update
      }
    });

  } catch (error) {
    console.error('❌ خطأ في جلب بيانات التاريخ:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب البيانات',
      error: error.message
    });
  }
});

// Helper to get holiday settings
async function getHolidaySettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'official_holidays')
    .maybeSingle();

  if (error || !data) return { weekends: [5, 6], holidays: [], customDays: [] };
  return data.settings || { weekends: [5, 6], holidays: [], customDays: [] };
}

// جلب بيانات السجلات اليومية للأسبوعين الماضيين
router.get('/daily-records/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Daily records request for userId:', userId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14);

    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    console.log('📅 Searching for data between:', startDateString, 'and', endDateString);

    // جلب بيانات التتبع للأسبوعين الماضيين
    const { data: trackingData, error } = await supabase
      .from('tracking')
      .select('*')
      .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
      .gte('date', startDateString)
      .lte('date', endDateString)
      .order('date', { ascending: true });

    if (error) throw error;

    console.log('📊 Found tracking records:', (trackingData || []).length);

    // Get screenshot counts
    const trackingIds = (trackingData || []).map(t => t.id);
    let screenshotsMap = {};
    if (trackingIds.length > 0) {
      const { data: screenshots } = await supabase
        .from('tracking_screenshots')
        .select('tracking_id')
        .in('tracking_id', trackingIds);

      (screenshots || []).forEach(ss => {
        screenshotsMap[ss.tracking_id] = (screenshotsMap[ss.tracking_id] || 0) + 1;
      });
    }

    // إنشاء سجل للأيام الـ 14 الماضية
    const dailyRecords = [];

    for (let i = 0; i < 14; i++) {
      const currentDate = new Date(endDate);
      currentDate.setDate(endDate.getDate() - (13 - i));

      const dateString = currentDate.toISOString().split('T')[0];
      const holidaySettings = await getHolidaySettings();
      const weekends = holidaySettings?.weekends || [5, 6];
      const isWeekend = weekends.includes(currentDate.getDay());

      // البحث عن بيانات هذا اليوم
      const dayData = (trackingData || []).find(record => {
        const recordDate = typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().split('T')[0];
        return recordDate === dateString;
      });

      let dailyRecord = {
        date: dateString,
        day: currentDate.toLocaleDateString('ar', { weekday: 'long' }),
        hijriDate: currentDate.toLocaleDateString('ar-EG-u-ca-islamic', {
          day: '2-digit',
          month: 'short'
        }),
        isWeekend: isWeekend,
        isToday: dateString === endDate.toISOString().split('T')[0],
        hasRealData: false,
        totalHours: 0,
        activeHours: 0,
        idleHours: 0,
        breakHours: 0,
        breakCount: 0,
        productivity: 0,
        status: isWeekend ? 'عطلة' : 'غائب',
        screenshots: 0
      };

      if (dayData) {
        const totalSeconds = dayData.total_seconds || 0;
        const activeSeconds = dayData.active_seconds || 0;
        const idleSeconds = dayData.idle_seconds || 0;
        const breakSeconds = dayData.break_seconds || 0;

        dailyRecord = {
          ...dailyRecord,
          hasRealData: true,
          totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
          activeHours: Math.round((activeSeconds / 3600) * 10) / 10,
          idleHours: Math.round((idleSeconds / 3600) * 10) / 10,
          breakHours: Math.round((breakSeconds / 3600) * 10) / 10,
          productivity: dayData.productivity || 0,
          screenshots: screenshotsMap[dayData.id] || 0,
          status: totalSeconds >= 6 * 3600 ? 'حاضر' :
                   totalSeconds > 0 ? 'متأخر' : 'غائب'
        };
      }

      dailyRecords.push(dailyRecord);
    }

    console.log('📋 Generated daily records:', dailyRecords.length);

    res.json({
      success: true,
      data: {
        records: dailyRecords,
        count: dailyRecords.length
      }
    });

  } catch (error) {
    console.error('Error fetching daily records:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب السجلات اليومية',
      error: error.message
    });
  }
});

// جلب بيانات السجلات الشهرية للمستخدم
router.get('/user/:userId/records', async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    console.log('🔍 Monthly records request for userId:', userId, 'year:', year, 'month:', month);

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'year و month مطلوبان'
      });
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    console.log('📅 Searching for data between:', startDate, 'and', endDate);

    // جلب بيانات التتبع للشهر المحدد
    const { data: trackingData, error } = await supabase
      .from('tracking')
      .select('*')
      .or(`user_id.eq.${userId},employee_id.eq.${userId}`)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    console.log('📊 Found tracking records:', (trackingData || []).length);

    // إنشاء سجل لجميع أيام الشهر
    const monthlyRecords = [];
    const daysInMonth = lastDay;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(parseInt(year), parseInt(month) - 1, day);
      const dateString = currentDate.toISOString().split('T')[0];
      const holidaySettings = await getHolidaySettings();
      const weekends = holidaySettings?.weekends || [5, 6];
      const isWeekend = weekends.includes(currentDate.getDay());

      // البحث عن بيانات هذا اليوم
      const dayData = (trackingData || []).find(record => {
        const recordDate = typeof record.date === 'string' ? record.date : new Date(record.date).toISOString().split('T')[0];
        return recordDate === dateString;
      });

      let dailyRecord = {
        id: dayData?.id || `${dateString}_${userId}`,
        date: dateString,
        userId: userId,
        totalSeconds: 0,
        activeSeconds: 0,
        idleSeconds: 0,
        productivity: 0,
        isWeekend: isWeekend
      };

      if (dayData) {
        dailyRecord = {
          ...dailyRecord,
          totalSeconds: dayData.total_seconds || 0,
          activeSeconds: dayData.active_seconds || 0,
          idleSeconds: dayData.idle_seconds || 0,
          productivity: dayData.productivity || 0
        };
      }

      monthlyRecords.push(dailyRecord);
    }

    console.log('📋 Generated monthly records:', monthlyRecords.length);

    // حساب الإحصائيات
    const workingDays = monthlyRecords.filter(day => !day.isWeekend);
    const presentDays = workingDays.filter(day => day.totalSeconds > 0);
    const totalWorkTime = monthlyRecords.reduce((sum, day) => sum + (day.totalSeconds || 0), 0);
    const totalActiveTime = monthlyRecords.reduce((sum, day) => sum + (day.activeSeconds || 0), 0);
    const averageProductivity = presentDays.length > 0 ?
      presentDays.reduce((sum, day) => sum + (day.productivity || 0), 0) / presentDays.length : 0;

    const stats = {
      totalWorkingDays: workingDays.length,
      presentDays: presentDays.length,
      absentDays: workingDays.length - presentDays.length,
      totalWorkTime: totalWorkTime,
      totalActiveTime: totalActiveTime,
      averageProductivity: Math.round(averageProductivity)
    };

    res.json({
      success: true,
      data: {
        records: monthlyRecords,
        stats: stats,
        count: monthlyRecords.length
      }
    });

  } catch (error) {
    console.error('Error fetching monthly records:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب السجلات الشهرية',
      error: error.message
    });
  }
});

// تحديث دالة حساب الإحصائيات لاستخدام UTC
async function calculateDailyStats(userId, date) {
  try {
    const startDate = moment.utc(date).startOf('day').format('YYYY-MM-DD');
    const endDate = moment.utc(date).endOf('day').format('YYYY-MM-DD');

    const { data: tracking, error } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .maybeSingle();

    if (error) throw error;

    if (!tracking) {
      return {
        totalSeconds: 0,
        activeSeconds: 0,
        productivity: 0,
        lastUpdate: null
      };
    }

    return {
      totalSeconds: tracking.total_seconds || 0,
      activeSeconds: tracking.active_seconds || 0,
      productivity: tracking.productivity || 0,
      lastUpdate: moment.utc(tracking.last_update).format()
    };
  } catch (error) {
    console.error('Error calculating daily stats:', error);
    throw error;
  }
}

// تحديث راوت الإحصائيات
router.get('/stats/:userId/:date?', async (req, res) => {
  try {
    const { userId, date } = req.params;
    const targetDate = date ? moment.utc(date) : moment.utc();

    const stats = await calculateDailyStats(userId, targetDate);

    res.json({
      success: true,
      data: {
        ...stats,
        date: targetDate.format('YYYY-MM-DD'),
        timezone: 'UTC'
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات',
      error: error.message
    });
  }
});

// دالة مساعدة لإنشاء هيكل بيانات فارغ
const createEmptyTrackingData = () => {
  return {
    totalSeconds: 0,
    activeSeconds: 0,
    idleSeconds: 0,
    breakSeconds: 0,
    productivity: 0,
    lastActivity: null,
    isWorking: false,
    status: 'offline',
    screenshots: []
  };
};

// الحصول على بيانات التتبع الحالية
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    const todayString = moment().startOf('day').format('YYYY-MM-DD');

    const { data: tracking, error } = await supabase
      .from('tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('date_string', todayString)
      .maybeSingle();

    if (error) throw error;

    // Get screenshots if tracking exists
    let screenshots = [];
    if (tracking) {
      const { data: ss } = await supabase
        .from('tracking_screenshots')
        .select('*')
        .eq('tracking_id', tracking.id);
      screenshots = ss || [];
    }

    const responseData = {
      success: true,
      data: tracking ? {
        totalSeconds: tracking.total_seconds || 0,
        activeSeconds: tracking.active_seconds || 0,
        idleSeconds: tracking.idle_seconds || 0,
        breakSeconds: tracking.break_seconds || 0,
        productivity: tracking.productivity || 0,
        lastActivity: tracking.last_activity || null,
        isWorking: tracking.is_working || false,
        status: tracking.status || 'offline',
        screenshots: screenshots
      } : createEmptyTrackingData()
    };

    res.json(responseData);
  } catch (error) {
    console.error('خطأ في جلب بيانات التتبع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات التتبع',
      error: error.message,
      data: createEmptyTrackingData()
    });
  }
});

module.exports = router;
