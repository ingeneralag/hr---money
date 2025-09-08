const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  // نوع العملية
  action: {
    type: String,
    required: true,
    enum: [
      'transaction_created',    // إنشاء معاملة
      'transaction_updated',    // تحديث معاملة
      'transaction_deleted',    // حذف معاملة
      'debt_payment',          // سداد مديونية
      'debt_partial_payment',  // سداد جزئي
      'debt_full_payment',     // سداد كامل
      'treasury_updated',      // تحديث الخزنة
      'user_login',            // تسجيل دخول
      'user_logout',           // تسجيل خروج
      'category_created',      // إنشاء فئة
      'category_updated',      // تحديث فئة
      'category_deleted'       // حذف فئة
    ]
  },
  
  // تفاصيل العملية
  details: {
    type: String,
    required: true
  },
  
  // بيانات المعاملة (إذا كانت متعلقة بمعاملة)
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: false
  },
  
  // بيانات المستخدم
  userId: {
    type: String,
    required: true
  },
  
  username: {
    type: String,
    required: true
  },
  
  // البيانات القديمة (قبل التعديل)
  oldData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // البيانات الجديدة (بعد التعديل)
  newData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // معلومات إضافية
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // IP Address
  ipAddress: {
    type: String,
    default: null
  },
  
  // User Agent
  userAgent: {
    type: String,
    default: null
  },
  
  // مستوى الأهمية
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // حالة العملية
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  
  // رسالة الخطأ (إذا فشلت العملية)
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// فهارس للبحث السريع
systemLogSchema.index({ action: 1, createdAt: -1 });
systemLogSchema.index({ userId: 1, createdAt: -1 });
systemLogSchema.index({ transactionId: 1 });
systemLogSchema.index({ severity: 1 });
systemLogSchema.index({ createdAt: -1 });

// Middleware لحفظ البيانات
systemLogSchema.pre('save', function(next) {
  if (this.isNew) {
    // تحديد مستوى الأهمية بناءً على نوع العملية
    if (['transaction_deleted', 'debt_full_payment'].includes(this.action)) {
      this.severity = 'high';
    } else if (['transaction_created', 'debt_payment'].includes(this.action)) {
      this.severity = 'medium';
    } else {
      this.severity = 'low';
    }
  }
  next();
});

module.exports = mongoose.model('SystemLog', systemLogSchema);
