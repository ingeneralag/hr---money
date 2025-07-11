require('dotenv').config();
const mongoose = require('mongoose');
const Tracking = require('./models/Tracking');
const User = require('./models/User');

const createTodayData = async () => {
  try {
    console.log('🚀 إنشاء بيانات اليوم الحالي...');

    // اتصال بقاعدة البيانات
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hr_system';
    await mongoose.connect(mongoUri);
    console.log('✅ متصل بقاعدة البيانات');

    // العثور على المستخدم admin
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      console.log('❌ لم يتم العثور على المستخدم admin');
      return;
    }

    const userId = adminUser._id;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    console.log('👤 المستخدم:', adminUser.name || adminUser.username);
    console.log('📅 اليوم:', todayString);

    // حذف بيانات اليوم الحالي إن وجدت
    await Tracking.deleteOne({
      userId: userId,
      dateString: todayString
    });

    // حساب وقت العمل الحالي (من الساعة 9 صباحاً حتى الآن)
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    let workHours;
    if (currentHour < 9) {
      workHours = 1; // وقت قليل للاختبار
    } else {
      workHours = (currentHour - 9) + (currentMinute / 60);
    }

    const totalSeconds = Math.floor(workHours * 3600);
    const productivityRate = 0.85; // 85% إنتاجية
    const activeSeconds = Math.floor(totalSeconds * productivityRate);
    const idleSeconds = totalSeconds - activeSeconds;
    const breakSeconds = Math.floor(Math.random() * 1800 + 900); // 15-45 دقيقة استراحة

    // إنشاء بعض لقطات الشاشة لليوم الحالي
    const screenshots = [];
    const screenshotCount = Math.min(Math.floor(workHours / 2), 5); // لقطة كل ساعتين تقريباً
    for (let i = 0; i < screenshotCount; i++) {
      const screenshotTime = new Date(today);
      screenshotTime.setHours(9 + i * 2, Math.floor(Math.random() * 60));
      screenshots.push({
        timestamp: screenshotTime,
        filename: `screenshot_today_${i + 1}.jpg`,
        path: `/uploads/screenshots/screenshot_today_${i + 1}.jpg`
      });
    }

    // إنشاء سجل اليوم
    const todayTracking = new Tracking({
      userId: userId,
      employeeId: userId,
      date: today,
      dateString: todayString,
      workData: {
        totalSeconds: totalSeconds,
        activeSeconds: activeSeconds,
        idleSeconds: idleSeconds,
        breakSeconds: breakSeconds,
        sessionsCount: 1,
        productivity: Math.round(productivityRate * 100),
        lastActivity: new Date()
      },
      screenshots: screenshots,
      status: 'working',
      isWorking: true,
      lastUpdate: new Date(),
      metadata: {
        deviceType: 'desktop',
        appVersion: '2.8.0',
        systemInfo: {
          platform: 'win32',
          arch: 'x64',
          version: '10.0.26100'
        }
      }
    });

    await todayTracking.save();

    console.log('✅ تم إنشاء بيانات اليوم الحالي بنجاح');
    console.log(`⏰ وقت العمل: ${Math.floor(totalSeconds/3600)} ساعة ${Math.floor((totalSeconds%3600)/60)} دقيقة`);
    console.log(`🟢 وقت النشاط: ${Math.floor(activeSeconds/3600)} ساعة ${Math.floor((activeSeconds%3600)/60)} دقيقة`);
    console.log(`📈 الإنتاجية: ${Math.round(productivityRate * 100)}%`);
    console.log(`📸 لقطات الشاشة: ${screenshots.length}`);
    console.log(`🟢 الحالة: يعمل حالياً`);

  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔒 تم إغلاق اتصال قاعدة البيانات');
    }
  }
};

// تشغيل السكريبت
createTodayData(); 