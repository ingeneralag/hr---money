const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
  id: String,
  name: String,
  nameEn: String
}, { _id: false });

const CategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameEn: { type: String },
  type: { type: String, enum: ['income', 'expense', 'both', 'debt'], required: true },
  description: { type: String },
  color: { type: String },
  icon: { type: String },
  parentId: { type: String, default: null },
  subcategories: [SubcategorySchema],
  budgetLimit: { type: Number },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number },
  defaultTaxRate: { type: Number },
  accountingCode: { type: String },
  tags: [String],
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

CategorySchema.index({ id: 1 });
CategorySchema.index({ name: 1 });
CategorySchema.index({ type: 1 });
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ sortOrder: 1 });
CategorySchema.index({ accountingCode: 1 });
CategorySchema.index({ createdAt: -1 });
CategorySchema.index({ name: 'text', nameEn: 'text', description: 'text' }); // فهرس للبحث النصي

module.exports = mongoose.model('Category', CategorySchema); 