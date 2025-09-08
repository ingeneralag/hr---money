const SystemLog = require('../models/SystemLog');

// دالة مساعدة لتسجيل العمليات
const logAction = async (req, action, details, metadata = {}) => {
  try {
    console.log('📝 محاولة تسجيل العملية:', { action, details, metadata });
    
    const logData = {
      action,
      details,
      userId: req.user?.id || req.user?._id || 'anonymous',
      username: req.user?.username || req.user?.name || 'anonymous',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: {
        ...metadata,
        url: req.originalUrl,
        method: req.method
      }
    };

    // إضافة transactionId إذا كان متوفراً
    if (req.params?.id) {
      logData.transactionId = req.params.id;
    }

    console.log('📝 بيانات اللوج:', logData);
    const savedLog = await SystemLog.create(logData);
    console.log('✅ تم حفظ اللوج بنجاح:', savedLog._id);
  } catch (error) {
    console.error('❌ خطأ في تسجيل العملية:', error);
  }
};

// Middleware لتسجيل إنشاء المعاملات
const logTransactionCreation = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success && responseData.data) {
          const transaction = responseData.data;
          const typeText = transaction.type === 'income' ? 'إيراد' : 
                          transaction.type === 'expense' ? 'مصروف' : 
                          transaction.type === 'debt' ? 'مديونية' : 'معاملة';
          
          logAction(req, 'transaction_created', 
            `تم إنشاء ${typeText} جديد: ${transaction.description} - ${transaction.amount} جنيه`,
            {
              transactionId: transaction._id,
              transactionType: transaction.type,
              amount: transaction.amount,
              category: transaction.category,
              description: transaction.description
            }
          );
        }
      } catch (e) {
        // تجاهل الأخطاء في التسجيل
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware لتسجيل تحديث المعاملات
const logTransactionUpdate = async (req, res, next) => {
  // جلب تفاصيل المعاملة قبل التحديث
  const Transaction = require('../models/Transaction');
  let oldTransactionDetails = null;
  
  try {
    oldTransactionDetails = await Transaction.findById(req.params.id);
  } catch (e) {
    // تجاهل الأخطاء في جلب التفاصيل
  }
  
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success && responseData.data) {
          const newTransaction = responseData.data;
          const description = `تم تحديث معاملة: ${newTransaction.description} - ${newTransaction.amount} جنيه`;
          
          logAction(req, 'transaction_updated', description, {
            transactionId: newTransaction._id,
            transactionType: newTransaction.type,
            amount: newTransaction.amount,
            description: newTransaction.description,
            oldAmount: oldTransactionDetails?.amount,
            oldDescription: oldTransactionDetails?.description,
            changes: {
              amount: oldTransactionDetails?.amount !== newTransaction.amount,
              description: oldTransactionDetails?.description !== newTransaction.description,
              type: oldTransactionDetails?.type !== newTransaction.type
            }
          });
        }
      } catch (e) {
        // تجاهل الأخطاء في التسجيل
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware لتسجيل حذف المعاملات
const logTransactionDeletion = async (req, res, next) => {
  // جلب تفاصيل المعاملة قبل الحذف
  const Transaction = require('../models/Transaction');
  let transactionDetails = null;
  
  try {
    transactionDetails = await Transaction.findById(req.params.id);
  } catch (e) {
    console.log('خطأ في جلب تفاصيل المعاملة:', e.message);
  }
  
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success) {
          const description = transactionDetails ? 
            `تم حذف معاملة: ${transactionDetails.description} - ${transactionDetails.amount} جنيه` :
            `تم حذف معاملة: ${req.params.id}`;
            
          console.log('📝 تسجيل حذف معاملة:', description);
          
          logAction(req, 'transaction_deleted', description, {
            transactionId: req.params.id,
            transactionType: transactionDetails?.type,
            amount: transactionDetails?.amount,
            description: transactionDetails?.description
          });
        }
      } catch (e) {
        console.log('خطأ في تسجيل حذف المعاملة:', e.message);
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware لتسجيل سداد المديونيات
const logDebtPayment = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success && responseData.data) {
          const { amount, fees, totalAmount } = req.body;
          const isFullPayment = responseData.data.debtStatus === 'paid';
          
          const action = isFullPayment ? 'debt_full_payment' : 'debt_partial_payment';
          const details = isFullPayment 
            ? `تم سداد مديونية بالكامل: ${amount} جنيه${fees > 0 ? ` + رسوم ${fees} جنيه` : ''}`
            : `تم سداد جزئي للمديونية: ${amount} جنيه${fees > 0 ? ` + رسوم ${fees} جنيه` : ''}`;
          
          logAction(req, action, details, {
            transactionId: req.params.id,
            paymentAmount: amount,
            fees: fees || 0,
            totalAmount: totalAmount,
            isFullPayment
          });
        }
      } catch (e) {
        // تجاهل الأخطاء في التسجيل
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware لتسجيل تحديث الخزنة
const logTreasuryUpdate = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success && responseData.data) {
          logAction(req, 'treasury_updated', 
            `تم تحديث الخزنة - الرصيد الحالي: ${responseData.data.currentBalance} جنيه`,
            {
              currentBalance: responseData.data.currentBalance,
              totalIncome: responseData.data.totalIncome,
              totalExpenses: responseData.data.totalExpenses,
              totalFeesCollected: responseData.data.totalFeesCollected
            }
          );
        }
      } catch (e) {
        // تجاهل الأخطاء في التسجيل
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware لتسجيل تسجيل الدخول
const logUserLogin = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.success && responseData.token) {
          logAction(req, 'user_login', 
            `تم تسجيل دخول المستخدم: ${req.body.identifier}`,
            {
              identifier: req.body.identifier,
              loginTime: new Date()
            }
          );
        }
      } catch (e) {
        // تجاهل الأخطاء في التسجيل
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  logAction,
  logTransactionCreation,
  logTransactionUpdate,
  logTransactionDeletion,
  logDebtPayment,
  logTreasuryUpdate,
  logUserLogin
};
