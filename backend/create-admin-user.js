const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// الاتصال بقاعدة البيانات
const MONGODB_URI = 'mongodb+srv://admin:admin123@cluster0.2auzx6g.mongodb.net/hr-system-2024?retryWrites=true&w=majority&appName=Cluster0';

// نموذج المستخدم المبسط
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee', 'viewer'], default: 'admin' },
  status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
  firstName: String,
  lastName: String,
  department: String,
  position: String,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// دالة للتحقق من كلمة المرور
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

async function createAdminUser() {
  try {
    console.log('🔗 الاتصال بقاعدة البيانات...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // البحث عن مستخدم admin موجود
    let adminUser = await User.findOne({ username: 'admin' });
    
    if (adminUser) {
      console.log('👤 تم العثور على مستخدم admin موجود');
      console.log('🔄 إعادة تعيين كلمة المرور...');
      
      // إعادة تعيين كلمة المرور
      adminUser.password = 'admin123'; // سيتم تشفيرها تلقائياً
      adminUser.status = 'active';
      adminUser.role = 'admin';
      adminUser.lastLogin = new Date();
      await adminUser.save();
      
      console.log('✅ تم إعادة تعيين كلمة مرور المدير بنجاح');
    } else {
      console.log('👤 إنشاء مستخدم admin جديد...');
      
      // إنشاء مستخدم admin جديد
      adminUser = new User({
        username: 'admin',
        email: 'admin@company.com',
        password: 'admin123', // سيتم تشفيرها تلقائياً
        role: 'admin',
        status: 'active',
        firstName: 'مدير',
        lastName: 'النظام',
        department: 'إدارة',
        position: 'مدير عام'
      });
      
      await adminUser.save();
      console.log('✅ تم إنشاء مستخدم admin جديد بنجاح');
    }

    // اختبار تسجيل الدخول
    console.log('🧪 اختبار تسجيل الدخول...');
    const testUser = await User.findOne({ username: 'admin' });
    const isPasswordValid = await testUser.comparePassword('admin123');
    
    if (isPasswordValid) {
      console.log('✅ اختبار كلمة المرور نجح!');
      console.log('');
      console.log('📋 بيانات تسجيل الدخول:');
      console.log('   اسم المستخدم: admin');
      console.log('   كلمة المرور: admin123');
      console.log('   الدور:', testUser.role);
      console.log('   الحالة:', testUser.status);
    } else {
      console.log('❌ اختبار كلمة المرور فشل!');
    }

    console.log('');
    console.log('🎯 جرب الآن تسجيل الدخول في المتصفح!');
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 تم قطع الاتصال بقاعدة البيانات');
  }
}

// تشغيل الدالة
createAdminUser(); 