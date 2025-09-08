const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionNumber: String,
  type: { type: String, enum: ['income', 'expense', 'debt'], required: true },
  amount: { type: Number, required: true },
  currency: String,
  description: String,
  category: String,
  subcategory: String,
  date: Date,
  dueDate: Date,
  status: String,
  paymentMethod: String,
  paymentStatus: String,
  // حقول خاصة بالمديونيات
  debtStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number },
  totalFeesCollected: { type: Number, default: 0 }, // إجمالي الرسوم المحصلة (مكسب صافي)
  paymentHistory: [{
    amount: Number,
    fees: { type: Number, default: 0 },
    totalAmount: Number,
    paymentDate: Date,
    paymentMethod: String,
    notes: String,
    paidBy: String
  }],
  reference: String,
  invoice: {
    number: String,
    issueDate: Date,
    dueDate: Date
  },
  clientId: String,
  employeeId: String,
  projectId: String,
  departmentId: String,
  tags: [String],
  attachments: [String],
  approvalHistory: [
    {
      action: String,
      by: String,
      date: Date,
      comment: String
    }
  ],
  tax: {
    rate: Number,
    amount: Number,
    included: Boolean
  },
  recurring: {
    isRecurring: Boolean,
    frequency: String,
    nextDate: Date,
    endDate: Date
  },
  notes: String,
  createdBy: String,
  createdAt: Date,
  updatedBy: String,
  updatedAt: Date,
  approvedBy: String,
  approvedAt: Date
}, {
  timestamps: true
});

transactionSchema.index({ transactionNumber: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ dueDate: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ paymentStatus: 1 });
transactionSchema.index({ clientId: 1 });
transactionSchema.index({ employeeId: 1 });
transactionSchema.index({ projectId: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ amount: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'invoice.number': 1 });

// Middleware لحساب المبلغ المتبقي للمديونيات
transactionSchema.pre('save', function(next) {
  if (this.type === 'debt') {
    // حساب المبلغ المدفوع للمديونية فقط (بدون الرسوم)
    const paidAmountForDebt = this.paymentHistory.reduce((total, payment) => {
      return total + payment.amount; // فقط المبلغ الأساسي، بدون الرسوم
    }, 0);
    
    // حساب إجمالي الرسوم المحصلة (مكسب صافي منفصل)
    const totalFeesCollected = this.paymentHistory.reduce((total, payment) => {
      return total + (payment.fees || 0);
    }, 0);
    
    this.paidAmount = paidAmountForDebt; // المبلغ المدفوع للمديونية فقط
    this.totalFeesCollected = totalFeesCollected; // إجمالي الرسوم المحصلة
    this.remainingAmount = Math.max(0, this.amount - this.paidAmount);
    
    // تحديث حالة المديونية بناءً على المبلغ المدفوع للمديونية فقط
    if (this.paidAmount >= this.amount) {
      this.debtStatus = 'paid';
    } else if (this.paidAmount > 0) {
      this.debtStatus = 'partial';
    } else {
      this.debtStatus = 'pending';
    }
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema); 