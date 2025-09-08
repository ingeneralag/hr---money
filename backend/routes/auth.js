const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Employee = require('../models/Employee');
const sendError = require('../utils/sendError');
const { validateEmail } = require('../utils/validators');
const { logUserLogin } = require('../middleware/logging');

const JWT_SECRET = process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production';

// POST /api/auth/login
router.post('/login', logUserLogin, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return sendError(res, 400, 'اسم المستخدم/البريد الإلكتروني وكلمة المرور مطلوبان', 'VALIDATION_ERROR');
    }

    // Search for user by either username or email
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });

    if (!user) {
      return sendError(res, 401, 'اسم المستخدم/البريد الإلكتروني أو كلمة المرور غير صحيحة', 'UNAUTHORIZED');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'اسم المستخدم/البريد الإلكتروني أو كلمة المرور غير صحيحة', 'UNAUTHORIZED');
    }

    // Check approval status for employees
    if (user.role === 'employee') {
      let employee = await Employee.findOne({ userId: user._id });
      
      if (!employee) {
        employee = await Employee.findOne({ email: user.email });
      }
      
      if (!employee) {
        console.log(`⚠️ لم يتم العثور على موظف للمستخدم: ${user.username} (${user._id})`);
        return sendError(res, 403, 'لم يتم العثور على بيانات الموظف', 'FORBIDDEN');
      }

      if (!employee.userId) {
        employee.userId = user._id;
        await employee.save();
        console.log(`🔗 تم ربط الموظف ${employee.name} بالمستخدم ${user.username}`);
      }

      console.log(`🔍 فحص حالة الموافقة للموظف: ${employee.name} - الحالة: ${employee.approvalStatus}`);

      if (employee.approvalStatus === 'pending') {
        return sendError(res, 403, 'حسابك قيد المراجعة من قبل الإدارة', 'PENDING');
      }

      if (employee.approvalStatus === 'rejected') {
        return sendError(res, 403, 'تم الرفض طلب التسجيل الخاص بك', 'REJECTED');
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username, 
        role: user.role,
        email: user.email 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          position: user.position,
          preferences: user.preferences,
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, 'حدث خطأ أثناء تسجيل الدخول', 'SERVER_ERROR');
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// GET /api/auth/verify - التحقق من صحة التوكن
router.get('/verify', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return sendError(res, 401, 'التوكن غير موجود', 'UNAUTHORIZED');
    }
    
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 401, 'المستخدم غير موجود', 'UNAUTHORIZED');
    }
    
    res.json({
      success: true,
      message: 'التوكن صالح',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          department: user.department,
          position: user.position,
          preferences: user.preferences,
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.warn('⚠️ WARNING: JWT signature verification failed - client may have outdated token');
      return sendError(res, 401, 'التوكن غير صالح', 'UNAUTHORIZED');
    } else if (error.name === 'TokenExpiredError') {
      console.warn('⚠️ WARNING: Token expired');
      return sendError(res, 401, 'التوكن منتهي الصلاحية', 'TOKEN_EXPIRED');
    } else {
      console.error('Token verification error:', error);
      return sendError(res, 500, 'حدث خطأ أثناء التحقق من التوكن', 'SERVER_ERROR');
    }
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    console.log('📍 Trying to receive new registration request:', 'POST');
    const { username, email, password, role, firstName, lastName, phone, department, department_id, position, birthDate } = req.body;

    // Validate required fields
    if (!username || !password || !email || !firstName || !phone || !department) {
      return sendError(res, 400, 'جميع الحقول مطلوبة', 'VALIDATION_ERROR');
    }

    // Validate email format
    if (!validateEmail(email)) {
      return sendError(res, 400, 'البريد الإلكتروني غير صالح', 'VALIDATION_ERROR');
    }

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { username: username }, 
        { email: email }
      ]
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return sendError(res, 409, 'اسم المستخدم مستخدم بالفعل', 'CONFLICT');
      } else if (existingUser.email === email) {
        return sendError(res, 409, 'البريد الإلكتروني مستخدم بالفعل', 'CONFLICT');
      }
    }

    // Create new user with automatic role assignment based on position
    let userRole = role;
    if (!userRole) {
      if (position === 'مدير' || position === 'مدير عام' || position === 'مساعد مدير') {
        userRole = 'administrator';
      } else {
        userRole = 'employee';
      }
    }

    // Create user with appropriate status based on role
    const user = new User({
      username,
      email,
      password,
      role: userRole,
      firstName,
      lastName,
      phone,
      department,
      department_id,
      position,
      status: userRole === 'administrator' ? 'active' : 'pending',
      createdBy: 'system'
    });

    console.log('Saving user:', user);
    // await user.save();
    console.log('✅ User saved successfully:', user._id);

    // Create new employee record
    const newEmployeeRecord = new Employee({
      userId: user._id,
      name: `${firstName} ${lastName || ''}`,
      email: user.email,
      department: user.department,
      department_id: department_id,
      phone: user.phone,
      position: user.position,
      nationalId: `${Date.now()}${Math.random().toString(36).substring(2, 5)}`,
      birthDate: birthDate || null,
      startDate: new Date(),
      status: 'تحت التدريب',
      approvalStatus: 'pending',
      approvalDetails: {
        status: 'pending',
        requestedAt: new Date(),
        requestedBy: user._id
      },
      baseSalary: 0,
      allowances: {
        transportation: 0,
        housing: 0,
        meal: 0
      },
      deductions: {
        socialInsurance: 0,
        tax: 0
      },
      attendance: {
        presentDays: 0,
        absentDays: 0,
        totalWorkingDays: 0,
        leaveBalance: 21
      },
      performance: {
        rating: 0,
        lastReview: new Date()
      },
      createdBy: 'system'
    });

    console.log('Saving employee:', newEmployeeRecord);
    await newEmployeeRecord.save();
    console.log('✅ Employee saved successfully:', newEmployeeRecord._id);

    // Update user with employee ID
    user.employeeId = newEmployeeRecord._id;
    await user.save();
    console.log('🔗 Linked user to employee');

    res.json({
      success: true,
      message: userRole === 'administrator' ? 'تم تسجيل المستخدم بنجاح' : 'تم تقديم طلب التسجيل بنجاح، في انتظار موافقة الإدارة',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: newEmployeeRecord._id,
        status: user.status,
        approvalStatus: newEmployeeRecord.approvalStatus
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      if (field === 'username') {
        return sendError(res, 409, 'اسم المستخدم مستخدم من قبل', 'CONFLICT');
      } else if (field === 'email') {
        return sendError(res, 409, 'البريد الإلكتروني مستخدم من قبل', 'CONFLICT');
      } else if (field === 'phone') {
        return sendError(res, 409, 'رقم الهاتف مستخدم من قبل', 'CONFLICT');
      } else if (field === 'nationalId') {
        return sendError(res, 409, 'الرقم القومي مستخدم من قبل', 'CONFLICT');
      }
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return sendError(res, 400, errors.join(', '), 'VALIDATION_ERROR');
    }
    
    sendError(res, 500, 'حدث خطأ أثناء تسجيل المستخدم', 'SERVER_ERROR');
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return sendError(res, 400, 'البريد الإلكتروني مطلوب', 'VALIDATION_ERROR');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني', 'NOT_FOUND');
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // TODO: Send email with reset link
    // Use SendGrid or Nodemailer here

    res.json({
      success: true,
      message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    sendError(res, 500, 'حدث خطأ أثناء معالجة الطلب', 'SERVER_ERROR');
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendError(res, 400, 'الرمز وكلمة المرور الجديدة مطلوبة', 'VALIDATION_ERROR');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendError(res, 400, 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية', 'INVALID_TOKEN');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 500, 'حدث خطأ أثناء إعادة تعيين كلمة المرور', 'SERVER_ERROR');
  }
});

// Temporary endpoint to reset yarabbb password
router.post('/temp-reset-yarabbb', async (req, res) => {
  try {
    const user = await User.findOne({ 
      $or: [
        { username: 'yarabbb' },
        { name: 'yarabbb' },
        { firstName: 'yarabbb' }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash('yarabbb123', salt);
    await user.save();

    res.json({ 
      success: true, 
      message: 'تم إعادة تعيين كلمة المرور بنجاح',
      username: user.username || user.name,
      newPassword: 'yarabbb123',
      userId: user._id
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Temporary endpoint to list all users
router.get('/temp-list-users', async (req, res) => {
  try {
    const users = await User.find({}, 'username name firstName lastName email _id').limit(10);
    res.json({ 
      success: true, 
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// GET /api/auth/generate-demo-token - Generate demo token (for testing only)
router.get('/generate-demo-token', async (req, res) => {
  try {
    // For testing only - should be removed in production
    const demoUser = {
      id: '507f1f77bcf86cd799439011',
      username: 'admin',
      role: 'admin',
      email: 'admin@company.com'
    };

    const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'توكن تجريبي تم إنشاؤه بنجاح',
      data: {
        token,
        user: demoUser
      },
      warning: 'هذا للاختبار فقط - يجب حذف هذا الـ endpoint في البيئة الحقيقية'
    });
  } catch (error) {
    console.error('Demo token generation error:', error);
    sendError(res, 500, 'حدث خطأ أثناء إنشاء التوكن التجريبي', 'SERVER_ERROR');
  }
});

// GET /api/auth/debug - Debug endpoint for diagnostics
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called');
    
    // Check database connection
    const isConnected = req.isMongoConnected;
    console.log('📊 Database connected:', isConnected);
    
    let userCount = 'N/A';
    let adminUser = null;
    
    if (isConnected) {
      try {
        userCount = await User.countDocuments();
        adminUser = await User.findOne({ username: 'admin' }).select('-password');
        console.log('👥 Total users:', userCount);
        console.log('👤 Admin user found:', !!adminUser);
      } catch (dbError) {
        console.error('❌ Database query error:', dbError.message);
      }
    }
    
    // Test JWT
    const testToken = jwt.sign(
      { test: 'debug', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    let tokenVerified = false;
    try {
      jwt.verify(testToken, JWT_SECRET);
      tokenVerified = true;
    } catch (jwtError) {
      console.error('❌ JWT test failed:', jwtError.message);
    }
    
    const debugInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      server: {
        running: true,
        version: '2.8.0',
        nodeVersion: process.version
      },
      database: {
        connected: isConnected,
        userCount: userCount,
        adminExists: !!adminUser
      },
      jwt: {
        secretSet: !!JWT_SECRET,
        testPassed: tokenVerified,
        testToken: testToken.substring(0, 20) + '...'
      },
      environment: {
        port: process.env.PORT || 5001,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };
    
    if (adminUser) {
      debugInfo.admin = {
        id: adminUser._id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
        approvalStatus: adminUser.approvalStatus
      };
    }
    
    console.log('📋 Debug info generated:', JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التشخيص',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/test-login - Simplified test login
router.post('/test-login', async (req, res) => {
  try {
    console.log('🧪 Test login endpoint called');
    const { username, password } = req.body;
    
    if (!req.isMongoConnected) {
      return sendError(res, 503, 'قاعدة البيانات غير متصلة', 'DATABASE_DISCONNECTED');
    }
    
    if (!username || !password) {
      return sendError(res, 400, 'اسم المستخدم وكلمة المرور مطلوبان', 'VALIDATION_ERROR');
    }
    
    console.log(`🔍 Looking for user: ${username}`);
    const user = await User.findOne({ username });
    if (!user) {
      console.log('❌ User not found');
      return sendError(res, 401, 'المستخدم غير موجود', 'USER_NOT_FOUND');
    }
    
    console.log('✅ User found:', user.username);
    console.log('🔑 Checking password...');
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return sendError(res, 401, 'كلمة المرور غير صحيحة', 'INVALID_PASSWORD');
    }
    
    console.log('✅ Password correct');
    console.log('🎫 Generating token...');
    
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Token generated successfully');
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح (اختبار)',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      debug: {
        timestamp: new Date().toISOString(),
        tokenLength: token.length,
        jwtSecret: JWT_SECRET.substring(0, 10) + '...'
      }
    });
    
  } catch (error) {
    console.error('❌ Test login error:', error);
    sendError(res, 500, 'خطأ في اختبار تسجيل الدخول', 'TEST_LOGIN_ERROR');
  }
});

module.exports = router;
