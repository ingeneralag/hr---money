require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Employee = require('./models/Employee');

// استخدام قاعدة بيانات Atlas مع إعدادات محدثة
const MONGO_URI = process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb+srv://Anter:anter1234@anter.1cdaq.mongodb.net/?retryWrites=true&w=majority&appName=Anter";

async function initializeDatabase() {
  try {
    console.log('🚀 بدء تهيئة قاعدة البيانات...');

    // تحديد خيارات الاتصال
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // انتظار 10 ثوان
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    // محاولة الاتصال بـ MongoDB
    console.log('📡 محاولة الاتصال بـ MongoDB...');
    await mongoose.connect(MONGO_URI, options);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');

    // التحقق من وجود مستخدم admin
    console.log('👤 التحقق من وجود مستخدم admin...');
    const existingAdmin = await User.findOne({ username: 'admin' });

    if (!existingAdmin) {
      console.log('👤 إنشاء مستخدم admin...');
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        status: 'active',
        firstName: 'المدير',
        lastName: 'العام',
        phone: '01234567890',
        personalInfo: {
          address: 'القاهرة، مصر',
          birthDate: new Date('1980-01-01'),
          gender: 'male',
          maritalStatus: 'married'
        }
      });

      await adminUser.save();
      console.log('✅ تم إنشاء مستخدم admin بنجاح');
    } else {
      console.log('✅ مستخدم admin موجود بالفعل');
    }

    // التحقق من وجود موظفين
    console.log('👥 التحقق من وجود موظفين...');
    const existingEmployees = await Employee.countDocuments();

    if (existingEmployees === 0) {
      console.log('👥 إنشاء بيانات موظفين تجريبية...');

      const sampleEmployees = [
        {
          employeeNumber: 'EMP001',
          name: 'أحمد محمد',
          email: 'ahmed@company.com',
          phone: '01012345678',
          position: 'مطور برمجيات',
          department: 'تقنية المعلومات',
          status: 'نشط',
          approvalStatus: 'approved',
          startDate: new Date('2024-01-15'),
          baseSalary: 15000,
          allowances: {
            transportation: 1000,
            housing: 2000,
            meal: 500
          },
          birthDate: new Date('1990-01-15'),
          gender: 'ذكر',
          maritalStatus: 'أعزب',
          address: 'القاهرة، مصر',
          monthlyPayments: [
            {
              month: '2024-12',
              salaryCalculation: {
                baseSalary: 15000,
                allowancesTotal: 3500,
                allowancesBreakdown: {
                  transportation: 1000,
                  housing: 2000,
                  meal: 500
                },
                bonusesTotal: 0,
                deductionsTotal: 0,
                grossSalary: 18500,
                netSalary: 18500
              },
              totalPaid: 18500,
              remainingAmount: 0,
              status: 'completed'
            }
          ]
        },
        {
          employeeNumber: 'EMP002',
          name: 'فاطمة علي',
          email: 'fatima@company.com',
          phone: '01087654321',
          position: 'محاسبة',
          department: 'المالية',
          status: 'نشط',
          approvalStatus: 'approved',
          startDate: new Date('2024-02-01'),
          baseSalary: 12000,
          allowances: {
            transportation: 800,
            housing: 1500,
            meal: 400
          },
          birthDate: new Date('1992-03-20'),
          gender: 'أنثى',
          maritalStatus: 'متزوجة',
          address: 'الجيزة، مصر',
          monthlyPayments: [
            {
              month: '2024-12',
              salaryCalculation: {
                baseSalary: 12000,
                allowancesTotal: 2700,
                allowancesBreakdown: {
                  transportation: 800,
                  housing: 1500,
                  meal: 400
                },
                bonusesTotal: 0,
                deductionsTotal: 0,
                grossSalary: 14700,
                netSalary: 14700
              },
              totalPaid: 14700,
              remainingAmount: 0,
              status: 'completed'
            }
          ]
        },
        {
          employeeNumber: 'EMP003',
          name: 'محمود حسن',
          email: 'mahmoud@company.com',
          phone: '01156789012',
          position: 'مدير مشروع',
          department: 'إدارة المشاريع',
          status: 'نشط',
          approvalStatus: 'approved',
          startDate: new Date('2023-12-01'),
          baseSalary: 20000,
          allowances: {
            transportation: 1200,
            housing: 2500,
            meal: 600
          },
          birthDate: new Date('1985-07-10'),
          gender: 'ذكر',
          maritalStatus: 'متزوج',
          address: 'الإسكندرية، مصر',
          monthlyPayments: [
            {
              month: '2024-12',
              salaryCalculation: {
                baseSalary: 20000,
                allowancesTotal: 4300,
                allowancesBreakdown: {
                  transportation: 1200,
                  housing: 2500,
                  meal: 600
                },
                bonusesTotal: 0,
                deductionsTotal: 0,
                grossSalary: 24300,
                netSalary: 24300
              },
              totalPaid: 24300,
              remainingAmount: 0,
              status: 'completed'
            }
          ]
        }
      ];

      for (const empData of sampleEmployees) {
        const employee = new Employee(empData);
        await employee.save();
      }

      console.log('✅ تم إنشاء الموظفين التجريبيين بنجاح');
    } else {
      console.log(`✅ يوجد ${existingEmployees} موظف في قاعدة البيانات بالفعل`);
    }

    // عرض إحصائيات
    const userCount = await User.countDocuments();
    const employeeCount = await Employee.countDocuments();

    console.log('\n📊 إحصائيات قاعدة البيانات:');
    console.log(`👤 عدد المستخدمين: ${userCount}`);
    console.log(`👥 عدد الموظفين: ${employeeCount}`);

    console.log('\n✅ تم التحقق من قاعدة البيانات بنجاح!');
    console.log('\n🔑 بيانات تسجيل الدخول:');
    console.log('Username: admin');
    console.log('Password: admin123');

    return true;

  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
    return false;
  }
}

// تشغيل التهيئة إذا تم استدعاء الملف مباشرة
if (require.main === module) {
  initializeDatabase()
    .then((success) => {
      if (success) {
        console.log('\n🎉 تمت التهيئة بنجاح!');
        process.exit(0);
      } else {
        console.log('\n💥 فشلت التهيئة!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 خطأ غير متوقع:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase }; 