const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
  try {
    console.log('🔗 الاتصال بقاعدة البيانات المحلية...');
    await mongoose.connect('mongodb://127.0.0.1:27017/hr_system');
    console.log('✅ تم الاتصال بنجاح!');
    
    // حذف المستخدم الموجود إن وُجد
    await User.deleteOne({ username: 'admin' });
    
    // إنشاء مستخدم admin جديد
    const adminUser = new User({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      firstName: 'Admin',
      lastName: 'User',
      department: 'إدارة',
      position: 'مدير عام'
    });
    
    await adminUser.save();
    console.log('✅ تم إنشاء مستخدم Admin بنجاح');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    await mongoose.connection.close();
    console.log('🔌 تم قطع الاتصال');
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

createAdmin();
