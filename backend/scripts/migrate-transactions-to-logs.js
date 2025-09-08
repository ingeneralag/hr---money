const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const SystemLog = require('../models/SystemLog');

// اتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr_system');
    console.log('✅ تم الاتصال بقاعدة البيانات');
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
    process.exit(1);
  }
};

// دالة تسجيل المعاملات الموجودة
const migrateTransactionsToLogs = async () => {
  try {
    console.log('🔄 بدء تسجيل المعاملات الموجودة في اللوجات...');
    
    // جلب جميع المعاملات
    const transactions = await Transaction.find({}).sort({ createdAt: 1 });
    console.log(`📊 تم العثور على ${transactions.length} معاملة`);
    
    let loggedCount = 0;
    let skippedCount = 0;
    
    for (const transaction of transactions) {
      // التحقق من وجود اللوج مسبقاً
      const existingLog = await SystemLog.findOne({
        action: 'transaction_created',
        'metadata.transactionId': transaction._id.toString()
      });
      
      if (existingLog) {
        skippedCount++;
        continue;
      }
      
      // تحديد نوع المعاملة
      const typeText = transaction.type === 'income' ? 'إيراد' : 
                      transaction.type === 'expense' ? 'مصروف' : 
                      transaction.type === 'debt' ? 'مديونية' : 'معاملة';
      
      // إنشاء اللوج
      const logData = {
        action: 'transaction_created',
        details: `تم إنشاء ${typeText} جديد: ${transaction.description} - ${transaction.amount} جنيه`,
        transactionId: transaction._id,
        userId: transaction.createdBy || 'admin',
        username: transaction.createdBy || 'admin',
        severity: 'medium',
        status: 'success',
        metadata: {
          transactionId: transaction._id.toString(),
          transactionType: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          migrated: true // علامة أن هذا اللوج تم إنشاؤه من المعاملات الموجودة
        },
        createdAt: transaction.createdAt || new Date(),
        updatedAt: transaction.updatedAt || new Date()
      };
      
      await SystemLog.create(logData);
      loggedCount++;
      
      // تسجيل السداد إذا كانت مديونية وتم سدادها
      if (transaction.type === 'debt' && transaction.paymentHistory && transaction.paymentHistory.length > 0) {
        for (const payment of transaction.paymentHistory) {
          const isFullPayment = transaction.debtStatus === 'paid';
          const action = isFullPayment ? 'debt_full_payment' : 'debt_partial_payment';
          const details = isFullPayment 
            ? `تم سداد مديونية بالكامل: ${payment.amount} جنيه${payment.fees > 0 ? ` + رسوم ${payment.fees} جنيه` : ''}`
            : `تم سداد جزئي للمديونية: ${payment.amount} جنيه${payment.fees > 0 ? ` + رسوم ${payment.fees} جنيه` : ''}`;
          
          const paymentLogData = {
            action: action,
            details: details,
            transactionId: transaction._id,
            userId: transaction.createdBy || 'admin',
            username: transaction.createdBy || 'admin',
            severity: 'medium',
            status: 'success',
            metadata: {
              transactionId: transaction._id.toString(),
              paymentAmount: payment.amount,
              fees: payment.fees || 0,
              totalAmount: payment.totalAmount,
              isFullPayment: isFullPayment,
              migrated: true
            },
            createdAt: payment.date || transaction.updatedAt || new Date(),
            updatedAt: new Date()
          };
          
          await SystemLog.create(paymentLogData);
          loggedCount++;
        }
      }
    }
    
    console.log(`✅ تم تسجيل ${loggedCount} لوج جديد`);
    console.log(`⏭️ تم تخطي ${skippedCount} لوج موجود مسبقاً`);
    console.log('🎉 تم الانتهاء من تسجيل المعاملات في اللوجات');
    
  } catch (error) {
    console.error('❌ خطأ في تسجيل المعاملات:', error);
  }
};

// تشغيل السكريبت
const runMigration = async () => {
  await connectDB();
  await migrateTransactionsToLogs();
  await mongoose.connection.close();
  console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
  process.exit(0);
};

// تشغيل إذا كان الملف يتم تنفيذه مباشرة
if (require.main === module) {
  runMigration();
}

module.exports = { migrateTransactionsToLogs };
