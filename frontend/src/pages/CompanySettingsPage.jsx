import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import { useNotifications } from '../components/NotificationSystem'
import {
  Building2,
  Save,
  Loader2,
  Receipt,
  Palette,
  Share2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Image,
  Facebook,
  Linkedin,
  Twitter,
  Instagram,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import api from '../services/api'

const TABS = [
  { id: 'company', label: 'معلومات الشركة', icon: Building2 },
  { id: 'finance', label: 'المالية والضرائب', icon: Receipt },
  { id: 'branding', label: 'الهوية البصرية', icon: Palette },
  { id: 'social', label: 'التواصل الاجتماعي', icon: Share2 },
]

const CURRENCIES = [
  { value: 'EGP', label: 'جنيه مصري (EGP)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
  { value: 'EUR', label: 'يورو (EUR)' },
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'AED', label: 'درهم إماراتي (AED)' },
]

const FISCAL_YEARS = [
  { value: '01-01', label: 'يناير (01-01)' },
  { value: '07-01', label: 'يوليو (07-01)' },
]

const initialFormData = {
  nameAr: '',
  nameEn: '',
  logoUrl: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  website: '',
  taxNumber: '',
  crNumber: '',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  invoiceFooter: '',
  stampUrl: '',
  signatureUrl: '',
  bankName: '',
  bankAccount: '',
  bankIban: '',
  bankSwift: '',
  socialFacebook: '',
  socialLinkedin: '',
  socialTwitter: '',
  socialInstagram: '',
  socialSnapchat: '',
  vodafoneCash: '',
  instapayName: '',
  instapayIpa: '',
  instapayPhone: '',
  walletOrange: '',
  walletEtisalat: '',
  walletWe: '',
  walletFawry: '',
  defaultCurrency: 'EGP',
  vatRate: 14,
  vatRegistered: false,
  fiscalYearStart: '01-01',
}

const SkeletonBlock = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  </div>
)

const CompanySettingsPage = () => {
  const { showSuccess, showError } = useNotifications()
  const [activeTab, setActiveTab] = useState('company')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/company-settings')
      if (response.data?.success && response.data.data) {
        setFormData((prev) => ({ ...prev, ...response.data.data }))
      }
    } catch (error) {
      showError('حدث خطأ أثناء تحميل إعدادات الشركة')
      console.error('Error fetching company settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await api.put('/company-settings', formData)
      if (response.data?.success) {
        showSuccess('تم حفظ إعدادات الشركة بنجاح')
      } else {
        showError(response.data?.message || 'حدث خطأ أثناء حفظ الإعدادات')
      }
    } catch (error) {
      showError(error.response?.data?.message || 'حدث خطأ أثناء حفظ الإعدادات')
      console.error('Error saving company settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // --- Field helper ---
  const renderField = (label, field, options = {}) => {
    const { type = 'text', placeholder = '', icon: Icon, dir } = options
    return (
      <div className="space-y-2">
        <Label className="text-gray-700 dark:text-gray-300">{label}</Label>
        <div className="relative">
          {Icon && (
            <Icon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          )}
          <Input
            type={type}
            value={formData[field] || ''}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={placeholder}
            dir={dir}
            className={`bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${Icon ? 'pr-10' : ''}`}
          />
        </div>
      </div>
    )
  }

  // --- Tab content renderers ---

  const renderCompanyInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderField('اسم الشركة (عربي)', 'nameAr', { placeholder: 'مثال: شركة التقنية المتقدمة', icon: Building2 })}
        {renderField('اسم الشركة (إنجليزي)', 'nameEn', { placeholder: 'e.g. Advanced Tech Co.', dir: 'ltr' })}
      </div>

      {renderField('العنوان', 'address', { placeholder: 'العنوان الكامل للشركة', icon: MapPin })}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderField('رقم الهاتف', 'phone', { type: 'tel', placeholder: '+20 xxx xxx xxxx', icon: Phone, dir: 'ltr' })}
        {renderField('رقم هاتف إضافي', 'phone2', { type: 'tel', placeholder: '+20 xxx xxx xxxx', icon: Phone, dir: 'ltr' })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderField('البريد الإلكتروني', 'email', { type: 'email', placeholder: 'info@company.com', icon: Mail, dir: 'ltr' })}
        {renderField('الموقع الإلكتروني', 'website', { type: 'url', placeholder: 'https://www.company.com', icon: Globe, dir: 'ltr' })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderField('الرقم الضريبي', 'taxNumber', { placeholder: 'الرقم الضريبي للشركة', dir: 'ltr' })}
        {renderField('رقم السجل التجاري', 'crNumber', { placeholder: 'رقم السجل التجاري', dir: 'ltr' })}
      </div>
    </div>
  )

  const renderFinance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Currency Select */}
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">العملة الافتراضية</Label>
          <select
            value={formData.defaultCurrency}
            onChange={(e) => updateField('defaultCurrency', e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* VAT Rate */}
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">نسبة ضريبة القيمة المضافة (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={formData.vatRate}
            onChange={(e) => updateField('vatRate', parseFloat(e.target.value) || 0)}
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VAT Toggle */}
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">مسجل في ضريبة القيمة المضافة</Label>
          <button
            type="button"
            onClick={() => updateField('vatRegistered', !formData.vatRegistered)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              formData.vatRegistered ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                formData.vatRegistered ? 'translate-x-1.5' : 'translate-x-6'
              }`}
            />
          </button>
          <div className="mt-1">
            {formData.vatRegistered ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-700">
                <CheckCircle className="h-3 w-3 ml-1" />
                مسجل
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600">
                <AlertCircle className="h-3 w-3 ml-1" />
                غير مسجل
              </Badge>
            )}
          </div>
        </div>

        {/* Fiscal Year */}
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">بداية السنة المالية</Label>
          <select
            value={formData.fiscalYearStart}
            onChange={(e) => updateField('fiscalYearStart', e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {FISCAL_YEARS.map((fy) => (
              <option key={fy.value} value={fy.value}>{fy.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-blue-500" />
          المعلومات البنكية
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField('اسم البنك', 'bankName', { placeholder: 'مثال: البنك الأهلي المصري', icon: Landmark })}
          {renderField('رقم الحساب البنكي', 'bankAccount', { placeholder: 'رقم الحساب', dir: 'ltr' })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {renderField('رقم IBAN', 'bankIban', { placeholder: 'EG00 0000 0000 0000 0000 0000 0', dir: 'ltr' })}
          {renderField('رمز SWIFT', 'bankSwift', { placeholder: 'XXXXEGCX', dir: 'ltr' })}
        </div>
      </div>

      {/* E-Wallets & InstaPay */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-500" />
          المحافظ الإلكترونية وطرق الدفع
        </h3>

        {/* InstaPay */}
        <div className="bg-gradient-to-l from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-800 rounded-xl p-4 mb-4 border border-purple-200 dark:border-purple-800">
          <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-3 text-sm">انستا باي (InstaPay)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField('الاسم على انستا باي', 'instapayName', { placeholder: 'الاسم المسجل في انستا باي' })}
            {renderField('عنوان IPA', 'instapayIpa', { placeholder: 'username@instapay', dir: 'ltr' })}
            {renderField('رقم انستا باي', 'instapayPhone', { placeholder: '01xxxxxxxxx', dir: 'ltr' })}
          </div>
        </div>

        {/* Mobile Wallets */}
        <div className="bg-gradient-to-l from-red-50 to-white dark:from-red-900/10 dark:to-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 text-sm">المحافظ الإلكترونية</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField('فودافون كاش', 'vodafoneCash', { placeholder: '01xxxxxxxxx', dir: 'ltr' })}
            {renderField('أورانج كاش', 'walletOrange', { placeholder: '01xxxxxxxxx', dir: 'ltr' })}
            {renderField('اتصالات كاش', 'walletEtisalat', { placeholder: '01xxxxxxxxx', dir: 'ltr' })}
            {renderField('وي باي (WE Pay)', 'walletWe', { placeholder: '01xxxxxxxxx', dir: 'ltr' })}
          </div>
          <div className="mt-4">
            {renderField('رقم فوري (Fawry)', 'walletFawry', { placeholder: 'رقم مرجع فوري', dir: 'ltr' })}
          </div>
        </div>
      </div>
    </div>
  )

  const handleFileUpload = async (field) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('field', field);
      try {
        const res = await api.post('/company-settings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (res.data?.success) {
          const backendUrl = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001');
          const fullUrl = backendUrl + res.data.data.url;
          const fieldMap = { logo: 'logoUrl', stamp: 'stampUrl', signature: 'signatureUrl' };
          updateField(fieldMap[field], fullUrl);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    };
    input.click();
  };

  const renderFileUpload = (label, field, fieldKey, icon) => {
    const currentUrl = formData[fieldKey];
    const backendUrl = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001');
    const imgSrc = currentUrl?.startsWith('http') ? currentUrl : currentUrl ? backendUrl + currentUrl : null;
    return (
      <div className="space-y-2">
        <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">{icon}{label}</Label>
        <div className="flex gap-2">
          <Input type="url" value={currentUrl || ''} onChange={(e) => updateField(fieldKey, e.target.value)} placeholder="رابط الصورة أو ارفع من جهازك" dir="ltr" className="flex-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm" />
          <Button type="button" variant="outline" size="sm" onClick={() => handleFileUpload(field)} className="whitespace-nowrap">
            <Image className="w-4 h-4 ml-1" /> رفع ملف
          </Button>
        </div>
        {imgSrc && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 inline-block">
            <img src={imgSrc} alt={label} className="max-h-20 max-w-[200px] object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          </div>
        )}
      </div>
    );
  };

  const renderBranding = () => (
    <div className="space-y-6">
      {/* Logo */}
      {renderFileUpload('الشعار (Logo)', 'logo', 'logoUrl', <Image className="h-4 w-4 text-blue-500" />)}

      {/* Colors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">اللون الأساسي</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={formData.primaryColor || '#2563eb'} onChange={(e) => updateField('primaryColor', e.target.value)} className="h-10 w-14 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer bg-transparent p-0.5" />
            <Input value={formData.primaryColor || '#2563eb'} onChange={(e) => updateField('primaryColor', e.target.value)} dir="ltr" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">اللون الثانوي</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={formData.secondaryColor || '#7c3aed'} onChange={(e) => updateField('secondaryColor', e.target.value)} className="h-10 w-14 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer bg-transparent p-0.5" />
            <Input value={formData.secondaryColor || '#7c3aed'} onChange={(e) => updateField('secondaryColor', e.target.value)} dir="ltr" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-mono text-sm" />
          </div>
        </div>
      </div>

      {/* Stamp & Signature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderFileUpload('الختم / الطابع', 'stamp', 'stampUrl', <Image className="h-4 w-4 text-amber-500" />)}
        {renderFileUpload('التوقيع الرقمي', 'signature', 'signatureUrl', <FileText className="h-4 w-4 text-green-500" />)}
      </div>

      {/* Live Preview */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">معاينة رأس الفاتورة</h4>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {/* Header bar with gradient */}
          <div
            className="p-4 flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${formData.primaryColor || '#2563eb'}, ${formData.secondaryColor || '#7c3aed'})`,
            }}
          >
            <div className="flex items-center gap-3">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Logo"
                  className="h-10 w-10 object-contain bg-white rounded-lg p-1"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <p className="text-white font-bold text-sm">{formData.nameAr || 'اسم الشركة'}</p>
                <p className="text-white/80 text-xs" dir="ltr">{formData.nameEn || 'Company Name'}</p>
              </div>
            </div>
            <div className="text-left text-white/90 text-xs space-y-0.5" dir="ltr">
              {formData.phone && <p>{formData.phone}</p>}
              {formData.email && <p>{formData.email}</p>}
              {formData.taxNumber && <p>Tax: {formData.taxNumber}</p>}
            </div>
          </div>
          {/* Body mock */}
          <div className="p-4 bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">فاتورة رقم #0001</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">2026/01/01</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSocial = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Facebook className="h-4 w-4 text-blue-600" />
            Facebook
          </Label>
          <Input
            type="url"
            value={formData.socialFacebook || ''}
            onChange={(e) => updateField('socialFacebook', e.target.value)}
            placeholder="https://facebook.com/company"
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Linkedin className="h-4 w-4 text-blue-700" />
            LinkedIn
          </Label>
          <Input
            type="url"
            value={formData.socialLinkedin || ''}
            onChange={(e) => updateField('socialLinkedin', e.target.value)}
            placeholder="https://linkedin.com/company/..."
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Twitter className="h-4 w-4 text-sky-500" />
            Twitter / X
          </Label>
          <Input
            type="url"
            value={formData.socialTwitter || ''}
            onChange={(e) => updateField('socialTwitter', e.target.value)}
            placeholder="https://x.com/company"
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Instagram className="h-4 w-4 text-pink-500" />
            Instagram
          </Label>
          <Input
            type="url"
            value={formData.socialInstagram || ''}
            onChange={(e) => updateField('socialInstagram', e.target.value)}
            placeholder="https://instagram.com/company"
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Globe className="h-4 w-4 text-yellow-500" />
            Snapchat
          </Label>
          <Input
            type="text"
            value={formData.socialSnapchat || ''}
            onChange={(e) => updateField('socialSnapchat', e.target.value)}
            placeholder="اسم حساب سناب شات"
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Vodafone Cash */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Phone className="h-4 w-4 text-red-500" />
            رقم فودافون كاش
          </Label>
          <Input
            type="text"
            value={formData.vodafoneCash || ''}
            onChange={(e) => updateField('vodafoneCash', e.target.value)}
            placeholder="01xxxxxxxxx"
            dir="ltr"
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            نص تذييل الفاتورة
          </Label>
          <Textarea
            value={formData.invoiceFooter || ''}
            onChange={(e) => updateField('invoiceFooter', e.target.value)}
            placeholder="نص يظهر في أسفل الفواتير مثل: شكرا لتعاملكم معنا..."
            rows={4}
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
    </div>
  )

  const tabContentMap = {
    company: renderCompanyInfo,
    finance: renderFinance,
    branding: renderBranding,
    social: renderSocial,
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Page Header */}
      <div className="rounded-xl bg-gradient-to-l from-blue-600 to-purple-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إعدادات الشركة</h1>
            <p className="text-white/80 mt-1 text-sm">
              إدارة بيانات الشركة والمعلومات المالية والهوية البصرية
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {React.createElement(TABS.find((t) => t.id === activeTab).icon, { className: 'h-5 w-5 text-blue-500' })}
            {TABS.find((t) => t.id === activeTab).label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonBlock /> : tabContentMap[activeTab]()}
        </CardContent>
      </Card>

      {/* Save Button */}
      {!loading && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-w-[160px] bg-gradient-to-l from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 ml-2" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default CompanySettingsPage
