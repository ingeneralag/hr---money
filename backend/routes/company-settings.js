const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const sendError = require('../utils/sendError');
const { supabase } = require('../config/database');

// Multer config for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads', 'branding');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = file.fieldname + '-' + Date.now() + ext;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
}});

// Helper: map to camelCase
function mapCompany(c) {
  if (!c) return c;
  return {
    _id: c.id,
    id: c.id,
    nameAr: c.name_ar,
    nameEn: c.name_en,
    logoUrl: c.logo_url,
    address: c.address,
    phone: c.phone,
    phone2: c.phone2,
    email: c.email,
    website: c.website,
    taxNumber: c.tax_number,
    crNumber: c.cr_number,
    primaryColor: c.primary_color,
    secondaryColor: c.secondary_color,
    invoiceFooter: c.invoice_footer,
    stampUrl: c.stamp_url,
    signatureUrl: c.signature_url,
    bankName: c.bank_name,
    bankAccount: c.bank_account,
    bankIban: c.bank_iban,
    bankSwift: c.bank_swift,
    socialFacebook: c.social_facebook,
    socialLinkedin: c.social_linkedin,
    socialTwitter: c.social_twitter,
    socialInstagram: c.social_instagram,
    socialSnapchat: c.social_snapchat,
    vodafoneCash: c.vodafone_cash,
    instapayName: c.instapay_name,
    instapayIpa: c.instapay_ipa,
    instapayPhone: c.instapay_phone,
    walletOrange: c.wallet_orange,
    walletEtisalat: c.wallet_etisalat,
    walletWe: c.wallet_we,
    walletFawry: c.wallet_fawry,
    defaultCurrency: c.default_currency,
    vatRate: c.vat_rate,
    vatRegistered: c.vat_registered,
    fiscalYearStart: c.fiscal_year_start,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// Helper: map from camelCase to snake_case
function mapBody(body) {
  const data = {};
  if (body.nameAr !== undefined) data.name_ar = body.nameAr;
  if (body.nameEn !== undefined) data.name_en = body.nameEn;
  if (body.logoUrl !== undefined) data.logo_url = body.logoUrl;
  if (body.address !== undefined) data.address = body.address;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.phone2 !== undefined) data.phone2 = body.phone2;
  if (body.email !== undefined) data.email = body.email;
  if (body.website !== undefined) data.website = body.website;
  if (body.taxNumber !== undefined) data.tax_number = body.taxNumber;
  if (body.crNumber !== undefined) data.cr_number = body.crNumber;
  if (body.primaryColor !== undefined) data.primary_color = body.primaryColor;
  if (body.secondaryColor !== undefined) data.secondary_color = body.secondaryColor;
  if (body.invoiceFooter !== undefined) data.invoice_footer = body.invoiceFooter;
  if (body.stampUrl !== undefined) data.stamp_url = body.stampUrl;
  if (body.signatureUrl !== undefined) data.signature_url = body.signatureUrl;
  if (body.bankName !== undefined) data.bank_name = body.bankName;
  if (body.bankAccount !== undefined) data.bank_account = body.bankAccount;
  if (body.bankIban !== undefined) data.bank_iban = body.bankIban;
  if (body.bankSwift !== undefined) data.bank_swift = body.bankSwift;
  if (body.socialFacebook !== undefined) data.social_facebook = body.socialFacebook;
  if (body.socialLinkedin !== undefined) data.social_linkedin = body.socialLinkedin;
  if (body.socialTwitter !== undefined) data.social_twitter = body.socialTwitter;
  if (body.socialInstagram !== undefined) data.social_instagram = body.socialInstagram;
  if (body.socialSnapchat !== undefined) data.social_snapchat = body.socialSnapchat;
  if (body.vodafoneCash !== undefined) data.vodafone_cash = body.vodafoneCash;
  if (body.instapayName !== undefined) data.instapay_name = body.instapayName;
  if (body.instapayIpa !== undefined) data.instapay_ipa = body.instapayIpa;
  if (body.instapayPhone !== undefined) data.instapay_phone = body.instapayPhone;
  if (body.walletOrange !== undefined) data.wallet_orange = body.walletOrange;
  if (body.walletEtisalat !== undefined) data.wallet_etisalat = body.walletEtisalat;
  if (body.walletWe !== undefined) data.wallet_we = body.walletWe;
  if (body.walletFawry !== undefined) data.wallet_fawry = body.walletFawry;
  if (body.defaultCurrency !== undefined) data.default_currency = body.defaultCurrency;
  if (body.vatRate !== undefined) data.vat_rate = parseFloat(body.vatRate) || 0;
  if (body.vatRegistered !== undefined) data.vat_registered = body.vatRegistered;
  if (body.fiscalYearStart !== undefined) data.fiscal_year_start = body.fiscalYearStart;
  return data;
}

// GET company settings
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;

    res.json({ success: true, data: mapCompany(settings) });
  } catch (err) {
    sendError(res, 500, 'خطأ في جلب إعدادات الشركة', 'INTERNAL_ERROR', err.message);
  }
});

// PUT update company settings
router.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Get existing record ID
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      return sendError(res, 404, 'إعدادات الشركة غير موجودة', 'NOT_FOUND');
    }

    const updateData = mapBody(req.body);

    const { data: updated, error } = await supabase
      .from('company_settings')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'تم تحديث إعدادات الشركة بنجاح', data: mapCompany(updated) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث إعدادات الشركة', 'VALIDATION_ERROR', err.message);
  }
});

// PUT update logo (accepts URL)
router.put('/logo', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { logoUrl } = req.body;

    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single();

    const { data: updated, error } = await supabase
      .from('company_settings')
      .update({ logo_url: logoUrl })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'تم تحديث الشعار بنجاح', data: mapCompany(updated) });
  } catch (err) {
    sendError(res, 400, 'خطأ في تحديث الشعار', 'VALIDATION_ERROR', err.message);
  }
});

// POST upload branding file (logo, stamp, signature)
router.post('/upload', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, 'الملف مطلوب', 'VALIDATION_ERROR');

    const field = req.body.field; // 'logo', 'stamp', 'signature'
    const fileUrl = `/uploads/branding/${req.file.filename}`;

    // Update company settings with the file URL
    const { data: existing } = await supabase.from('company_settings').select('id').limit(1).single();
    if (!existing) return sendError(res, 404, 'إعدادات الشركة غير موجودة', 'NOT_FOUND');

    // Only update company settings for company branding files (not client logos)
    if (field === 'logo' || field === 'stamp' || field === 'signature') {
      const updateData = {};
      if (field === 'logo') updateData.logo_url = fileUrl;
      else if (field === 'stamp') updateData.stamp_url = fileUrl;
      else if (field === 'signature') updateData.signature_url = fileUrl;
      await supabase.from('company_settings').update(updateData).eq('id', existing.id);
    }
    // client_logo and other types just upload the file without updating company settings

    res.json({ success: true, message: 'تم رفع الملف بنجاح', data: { url: fileUrl, field } });
  } catch (err) {
    sendError(res, 400, 'خطأ في رفع الملف', 'VALIDATION_ERROR', err.message);
  }
});

module.exports = router;
