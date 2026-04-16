const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/database');
const sendError = require('../utils/sendError');
const { validateEmail } = require('../utils/validators');
const { logUserLogin } = require('../middleware/logging');

const JWT_SECRET = process.env.JWT_SECRET || 'hr-system-2024-default-secret-change-in-production';

// POST /api/auth/login
router.post('/login', logUserLogin, async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const { password } = req.body;

    if (!identifier || !password) {
      return sendError(res, 400, 'اسم المستخدم/البريد الإلكتروني وكلمة المرور مطلوبان', 'VALIDATION_ERROR');
    }

    // Search for user by either username or email
    let user = null;

    // Try username first
    const { data: byUsername, error: err1 } = await supabase
      .from('users')
      .select('*')
      .eq('username', identifier)
      .single();

    if (byUsername) {
      user = byUsername;
    } else {
      // Try email
      const { data: byEmail, error: err2 } = await supabase
        .from('users')
        .select('*')
        .eq('email', identifier)
        .single();

      if (byEmail) {
        user = byEmail;
      }
    }

    if (!user) {
      return sendError(res, 401, 'اسم المستخدم/البريد الإلكتروني أو كلمة المرور غير صحيحة', 'UNAUTHORIZED');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 401, 'اسم المستخدم/البريد الإلكتروني أو كلمة المرور غير صحيحة', 'UNAUTHORIZED');
    }

    // Check approval status for employees
    if (user.role === 'employee') {
      let employee = null;

      // Try finding employee by user_id
      const { data: empByUserId } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (empByUserId) {
        employee = empByUserId;
      } else {
        // Try finding by email
        const { data: empByEmail } = await supabase
          .from('employees')
          .select('*')
          .eq('email', user.email)
          .single();

        if (empByEmail) {
          employee = empByEmail;
        }
      }

      if (!employee) {
        console.log(`Warning: لم يتم العثور على موظف للمستخدم: ${user.username} (${user.id})`);
        return sendError(res, 403, 'لم يتم العثور على بيانات الموظف', 'FORBIDDEN');
      }

      // Link employee to user if not linked
      if (!employee.user_id) {
        const { error: linkError } = await supabase
          .from('employees')
          .update({ user_id: user.id })
          .eq('id', employee.id);

        if (!linkError) {
          console.log(`Linked employee ${employee.name} to user ${user.username}`);
        }
      }

      console.log(`Checking approval status for employee: ${employee.name} - Status: ${employee.approval_status}`);

      if (employee.approval_status === 'pending') {
        return sendError(res, 403, 'حسابك قيد المراجعة من قبل الإدارة', 'PENDING');
      }

      if (employee.approval_status === 'rejected') {
        return sendError(res, 403, 'تم الرفض طلب التسجيل الخاص بك', 'REJECTED');
      }
    }

    // Update last login
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update last_login:', updateError.message);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
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
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          department: user.department,
          position: user.position,
          preferences: {
            language: user.pref_language,
            theme: user.pref_theme,
            notifications: user.pref_notifications
          },
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
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return sendError(res, 401, 'المستخدم غير موجود', 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      message: 'التوكن صالح',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          department: user.department,
          position: user.position,
          preferences: {
            language: user.pref_language,
            theme: user.pref_theme,
            notifications: user.pref_notifications
          },
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.warn('WARNING: JWT signature verification failed - client may have outdated token');
      return sendError(res, 401, 'التوكن غير صالح', 'UNAUTHORIZED');
    } else if (error.name === 'TokenExpiredError') {
      console.warn('WARNING: Token expired');
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
    console.log('Trying to receive new registration request:', 'POST');
    const { username, email, password, role, firstName, lastName, phone, department, department_id, position, birthDate } = req.body;

    // Validate required fields
    if (!username || !password || !email || !firstName || !phone || !department) {
      return sendError(res, 400, 'جميع الحقول مطلوبة', 'VALIDATION_ERROR');
    }

    // Validate email format
    if (!validateEmail(email)) {
      return sendError(res, 400, 'البريد الإلكتروني غير صالح', 'VALIDATION_ERROR');
    }

    // Check for existing user by username
    const { data: existingByUsername } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('username', username)
      .single();

    if (existingByUsername) {
      return sendError(res, 409, 'اسم المستخدم مستخدم بالفعل', 'CONFLICT');
    }

    // Check for existing user by email
    const { data: existingByEmail } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('email', email)
      .single();

    if (existingByEmail) {
      return sendError(res, 409, 'البريد الإلكتروني مستخدم بالفعل', 'CONFLICT');
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        role: userRole,
        first_name: firstName,
        last_name: lastName || null,
        phone,
        department,
        position,
        status: userRole === 'administrator' ? 'active' : 'pending',
      })
      .select()
      .single();

    if (userError) {
      console.error('User insert error:', userError);
      // Handle unique constraint violations
      if (userError.code === '23505') {
        if (userError.message.includes('username')) {
          return sendError(res, 409, 'اسم المستخدم مستخدم من قبل', 'CONFLICT');
        } else if (userError.message.includes('email')) {
          return sendError(res, 409, 'البريد الإلكتروني مستخدم من قبل', 'CONFLICT');
        } else if (userError.message.includes('phone')) {
          return sendError(res, 409, 'رقم الهاتف مستخدم من قبل', 'CONFLICT');
        }
        return sendError(res, 409, 'بيانات مكررة', 'CONFLICT');
      }
      return sendError(res, 500, 'حدث خطأ أثناء تسجيل المستخدم', 'SERVER_ERROR');
    }

    console.log('User saved successfully:', user.id);

    // Create new employee record
    const { data: newEmployee, error: empError } = await supabase
      .from('employees')
      .insert({
        user_id: user.id,
        name: `${firstName} ${lastName || ''}`.trim(),
        email: user.email,
        department: user.department,
        department_id: department_id || null,
        phone: user.phone,
        position: user.position,
        birth_date: birthDate || null,
        start_date: new Date().toISOString(),
        status: 'تحت التدريب',
        approval_status: 'pending',
        approval_details: {
          status: 'pending',
          requestedAt: new Date().toISOString(),
          requestedBy: user.id
        },
        base_salary: 0,
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
          lastReview: new Date().toISOString()
        },
      })
      .select()
      .single();

    if (empError) {
      console.error('Employee insert error:', empError);
      // Clean up the user if employee creation fails
      await supabase.from('users').delete().eq('id', user.id);
      return sendError(res, 500, 'حدث خطأ أثناء تسجيل المستخدم', 'SERVER_ERROR');
    }

    console.log('Employee saved successfully:', newEmployee.id);

    // Update user with employee ID
    const { error: linkError } = await supabase
      .from('users')
      .update({ employee_id: newEmployee.id })
      .eq('id', user.id);

    if (linkError) {
      console.error('Failed to link user to employee:', linkError.message);
    } else {
      console.log('Linked user to employee');
    }

    res.json({
      success: true,
      message: userRole === 'administrator' ? 'تم تسجيل المستخدم بنجاح' : 'تم تقديم طلب التسجيل بنجاح، في انتظار موافقة الإدارة',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: newEmployee.id,
        status: user.status,
        approvalStatus: newEmployee.approval_status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return sendError(res, 404, 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني', 'NOT_FOUND');
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: resetToken,
        reset_password_expires: new Date(Date.now() + 3600000).toISOString() // 1 hour
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save reset token:', updateError.message);
      return sendError(res, 500, 'حدث خطأ أثناء معالجة الطلب', 'SERVER_ERROR');
    }

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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .eq('reset_password_token', token)
      .gt('reset_password_expires', new Date().toISOString())
      .single();

    if (error || !user) {
      return sendError(res, 400, 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية', 'INVALID_TOKEN');
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update password:', updateError.message);
      return sendError(res, 500, 'حدث خطأ أثناء إعادة تعيين كلمة المرور', 'SERVER_ERROR');
    }

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
    // Try finding by username first, then first_name
    let user = null;

    const { data: byUsername } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'yarabbb')
      .single();

    if (byUsername) {
      user = byUsername;
    } else {
      const { data: byFirstName } = await supabase
        .from('users')
        .select('*')
        .eq('first_name', 'yarabbb')
        .single();

      if (byFirstName) {
        user = byFirstName;
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('yarabbb123', salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }

    res.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح',
      username: user.username || user.first_name,
      newPassword: 'yarabbb123',
      userId: user.id
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Temporary endpoint to list all users
router.get('/temp-list-users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, email')
      .limit(10);

    if (error) {
      console.error('Error listing users:', error);
      return res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
    }

    res.json({
      success: true,
      users: users || [],
      count: (users || []).length
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
      id: '00000000-0000-0000-0000-000000000001',
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
    console.log('Debug endpoint called');

    // Check database connection by running a simple query
    let isConnected = false;
    let userCount = 'N/A';
    let adminUser = null;

    try {
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        isConnected = true;
        userCount = count;
        console.log('Total users:', userCount);
      }

      const { data: admin, error: adminError } = await supabase
        .from('users')
        .select('id, username, email, role')
        .eq('username', 'admin')
        .single();

      if (!adminError && admin) {
        adminUser = admin;
        console.log('Admin user found:', !!adminUser);
      }
    } catch (dbError) {
      console.error('Database query error:', dbError.message);
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
      console.error('JWT test failed:', jwtError.message);
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
        type: 'supabase-postgresql',
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
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
      };
    }

    console.log('Debug info generated:', JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);

  } catch (error) {
    console.error('Debug endpoint error:', error);
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
    console.log('Test login endpoint called');
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 400, 'اسم المستخدم وكلمة المرور مطلوبان', 'VALIDATION_ERROR');
    }

    console.log(`Looking for user: ${username}`);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      console.log('User not found');
      return sendError(res, 401, 'المستخدم غير موجود', 'USER_NOT_FOUND');
    }

    console.log('User found:', user.username);
    console.log('Checking password...');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch');
      return sendError(res, 401, 'كلمة المرور غير صحيحة', 'INVALID_PASSWORD');
    }

    console.log('Password correct');
    console.log('Generating token...');

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Token generated successfully');

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح (اختبار)',
      token: token,
      user: {
        id: user.id,
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
    console.error('Test login error:', error);
    sendError(res, 500, 'خطأ في اختبار تسجيل الدخول', 'TEST_LOGIN_ERROR');
  }
});

module.exports = router;
