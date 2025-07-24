const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    clientNumber: String,
    name: { type: String, required: true },
    company: String,
    email: { type: String, required: true },
    phone: { type: String, required: true },
    alternativePhone: String,
    website: String,
    industry: String,
    address: {
      street: String,
      city: String,
      governorate: String,
      country: String,
      postalCode: String,
    },
    contactPerson: {
      name: String,
      position: String,
      email: String,
      phone: String,
    },
    financialInfo: {
      creditLimit: Number,
      paymentTerms: String,
      taxNumber: String,
      currency: String,
    },
    businessInfo: {
      foundedYear: Number,
      employeeCount: Number,
      annualRevenue: Number,
      businessType: String,
    },
    totalProjects: Number,
    activeProjects: Number,
    completedProjects: Number,
    totalPayments: Number,
    outstandingPayments: Number,
    lastPaymentDate: Date,
    status: String,
    priority: String,
    source: String,
    contractStartDate: Date,
    contractEndDate: Date,
    documents: [String],
    notes: String,
    tags: [String],
    socialMedia: {
      facebook: String,
      linkedin: String,
      twitter: String,
    },
    createdBy: String,
    createdAt: Date,
    updatedBy: String,
    updatedAt: Date,
  },
  {
    timestamps: true,
  }
);

clientSchema.index({ clientNumber: 1 });
clientSchema.index({ name: 1 });
clientSchema.index({ company: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ priority: 1 });
clientSchema.index({ industry: 1 });
clientSchema.index({ "address.city": 1 });
clientSchema.index({ "address.country": 1 });
clientSchema.index({ createdAt: -1 });
clientSchema.index({ name: "text", company: "text", email: "text" }); // Text index for search

module.exports = mongoose.model("Client", clientSchema);
