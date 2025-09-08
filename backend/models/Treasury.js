const mongoose = require('mongoose');

const treasurySchema = new mongoose.Schema({
  currentBalance: { 
    type: Number, 
    default: 0,
    required: true 
  },
  initialBalance: { 
    type: Number, 
    default: 0 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  lastTransactionId: { 
    type: String 
  },
  // سجل التغييرات في الخزنة
  balanceHistory: [{
    amount: Number,
    type: { type: String, enum: ['income', 'expense', 'debt_payment', 'debt_creation', 'manual_adjustment'] },
    transactionId: String,
    description: String,
    previousBalance: Number,
    newBalance: Number,
    date: { type: Date, default: Date.now },
    updatedBy: String
  }],
  // إحصائيات
  totalIncome: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  totalDebts: { type: Number, default: 0 },
  totalPaidDebts: { type: Number, default: 0 },
  totalRemainingDebts: { type: Number, default: 0 },
  totalFeesCollected: { type: Number, default: 0 }, // الرسوم المحصلة (مكسب صافي)
  // إعدادات
  isActive: { type: Boolean, default: true },
  currency: { type: String, default: 'EGP' },
  notes: String,
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true
});

// فهارس
treasurySchema.index({ currentBalance: 1 });
treasurySchema.index({ lastUpdated: -1 });
treasurySchema.index({ isActive: 1 });

// Middleware لتحديث التواريخ
treasurySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// دالة لحساب الرصيد الحالي
treasurySchema.methods.calculateCurrentBalance = function() {
  return this.initialBalance + this.totalIncome - this.totalExpenses - this.totalRemainingDebts;
};

// دالة لإضافة سجل في تاريخ الرصيد
treasurySchema.methods.addBalanceHistory = function(data) {
  this.balanceHistory.push({
    amount: data.amount,
    type: data.type,
    transactionId: data.transactionId,
    description: data.description,
    previousBalance: this.currentBalance,
    newBalance: this.currentBalance + data.amount,
    date: new Date(),
    updatedBy: data.updatedBy
  });
  
  this.currentBalance += data.amount;
  this.lastUpdated = new Date();
};

module.exports = mongoose.model('Treasury', treasurySchema);
