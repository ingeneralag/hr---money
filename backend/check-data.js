const mongoose = require("mongoose");
const Tracking = require("./models/Tracking");
const Employee = require("./models/Employee");

// استخدام MongoDB Atlas بدلاً من المحلي
const MONGODB_URI = process.env.MONGODB_URI;

console.log("🔗 الاتصال بـ MongoDB Atlas...");
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
});

const checkData = async () => {
  try {
    console.log("🔍 فحص البيانات في قاعدة البيانات...");
    console.log("=".repeat(50));

    // فحص الموظفين
    const employeeCount = await Employee.countDocuments();
    console.log(`📊 عدد الموظفين: ${employeeCount}`);

    if (employeeCount > 0) {
      const employees = await Employee.find().limit(3);
      console.log("📋 عينة من الموظفين:");
      employees.forEach((emp, index) => {
        console.log(
          `   ${index + 1}. ${emp.name || emp.username || "غير محدد"} (ID: ${
            emp._id
          })`
        );
      });
    }

    // فحص سجلات التتبع
    const trackingCount = await Tracking.countDocuments();
    console.log(`📊 عدد سجلات التتبع: ${trackingCount}`);

    if (trackingCount > 0) {
      const recentTracking = await Tracking.find()
        .sort({ createdAt: -1 })
        .limit(3);
      console.log("📋 آخر سجلات التتبع:");
      recentTracking.forEach((track, index) => {
        console.log(
          `   ${index + 1}. المستخدم: ${track.userId}, التاريخ: ${
            track.dateString || track.date
          }, النوع: ${track.type}`
        );
      });
    }

    // فحص باقي النماذج
    const User = require("./models/User");
    const Transaction = require("./models/Transaction");

    const userCount = await User.countDocuments();
    const transactionCount = await Transaction.countDocuments();

    console.log(`📊 عدد المستخدمين: ${userCount}`);
    console.log(`📊 عدد المعاملات: ${transactionCount}`);

    console.log("=".repeat(50));
    console.log("✅ تم فحص البيانات بنجاح!");
  } catch (error) {
    console.error("❌ خطأ في فحص البيانات:", error.message);
  } finally {
    mongoose.connection.close();
  }
};

checkData();
