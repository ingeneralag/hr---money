import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useNotifications } from '../components/NotificationSystem'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import {
  RefreshCw, Shield, User, Building, CreditCard, Calendar,
  Settings as SettingsIcon, Bell, BellOff, Lock, Unlock, Clock,
  Key, Globe, Palette, Plus, Trash2, Mail, MailX, Smartphone,
  DollarSign, Languages, ChevronLeft
} from 'lucide-react'
import { settingsService } from '../services/api'
import HolidayConfiguration from '../components/HolidayConfiguration'
import CompanySettingsPage from './CompanySettingsPage'
import RolesPage from './RolesPage'

const SettingsPage = () => {
  const { showSuccess, showError } = useNotifications()
  const [loading, setLoading] = useState(true)
  const [settingsTab, setSettingsTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState('')

  const [companySettings, setCompanySettings] = useState({
    companyName: '', companyEmail: '', currency: 'EGP', language: 'ar', theme: 'light',
    address: { street: '', city: '', governorate: '', country: 'مصر', postalCode: '' },
    contactInfo: { phone: '', website: '', taxNumber: '' }
  })

  const [userSettings, setUserSettings] = useState({
    preferences: {
      language: 'ar', theme: 'light',
      notifications: { email: true, push: true, payroll: true, budget: true, reports: false }
    },
    security: { twoFactorAuth: false, autoLogout: 30, passwordExpiry: 90, sessionTimeout: 30 }
  })

  const [paymentSettings, setPaymentSettings] = useState({
    methods: [], defaultMethod: '', taxRate: 14, currency: 'EGP'
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const response = await settingsService.get()
        if (response.success) {
          const data = response.data
          if (data.company) setCompanySettings(data.company)
          if (data.user) setUserSettings(data.user)
          if (data.payment) setPaymentSettings(data.payment)
        }
      } catch (error) { showError('حدث خطأ في جلب الإعدادات') }
      finally { setLoading(false) }
    }
    fetchSettings()
  }, [])

  const handleCompanyUpdate = async (data) => {
    try { setSaving(true); const r = await settingsService.updateCompany(data); if (r.success) { setCompanySettings(data); showSuccess('تم تحديث إعدادات الشركة بنجاح') } }
    catch { showError('حدث خطأ في تحديث إعدادات الشركة') } finally { setSaving(false) }
  }

  const handleUserUpdate = async (data) => {
    try { setSaving(true); const r = await settingsService.updateUser(data); if (r.success) { setUserSettings(data); showSuccess('تم تحديث إعدادات المستخدم بنجاح') } }
    catch { showError('حدث خطأ في تحديث إعدادات المستخدم') } finally { setSaving(false) }
  }

  const handlePaymentUpdate = async (data) => {
    try { setSaving(true); const r = await settingsService.updatePayment(data); if (r.success) { setPaymentSettings(data); showSuccess('تم تحديث إعدادات الدفع بنجاح') } }
    catch { showError('حدث خطأ في تحديث إعدادات الدفع') } finally { setSaving(false) }
  }

  const handleAddPaymentMethod = async (method) => {
    try {
      setSaving(true)
      const updatedMethods = [...paymentSettings.methods, method]
      const r = await settingsService.updatePayment({ ...paymentSettings, methods: updatedMethods })
      if (r.success) { setPaymentSettings(prev => ({ ...prev, methods: updatedMethods })); showSuccess('تم إضافة وسيلة الدفع بنجاح') }
    } catch { showError('حدث خطأ في إضافة وسيلة الدفع') } finally { setSaving(false) }
  }

  const handleRemovePaymentMethod = async (method) => {
    try {
      setSaving(true)
      const updatedMethods = paymentSettings.methods.filter(m => m !== method)
      const r = await settingsService.updatePayment({ ...paymentSettings, methods: updatedMethods })
      if (r.success) { setPaymentSettings(prev => ({ ...prev, methods: updatedMethods })); showSuccess('تم حذف وسيلة الدفع بنجاح') }
    } catch { showError('حدث خطأ في حذف وسيلة الدفع') } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-blue-50 dark:from-gray-800/90 dark:via-gray-800/70 dark:to-gray-800/90 rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-300 dark:to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <SettingsIcon className="w-5 h-5 text-white" />
              </div>
              الإعدادات
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm mr-[52px]">إدارة إعدادات النظام والشركة والمستخدم</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}
            className="gap-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            إعادة تحميل
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        {[
          { id: 'general', label: 'الإعدادات العامة', icon: SettingsIcon },
          { id: 'company', label: 'إعدادات الشركة', icon: Building },
          { id: 'roles', label: 'الأدوار والصلاحيات', icon: Shield },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              settingsTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {settingsTab === 'company' && <CompanySettingsPage />}
      {settingsTab === 'roles' && <RolesPage />}

      {settingsTab === 'general' && (
        <div className="grid gap-5 md:grid-cols-2">

          {/* Company Settings */}
          <SettingsCard icon={Building} title="إعدادات الشركة" subtitle="إعدادات الشركة الأساسية" color="blue">
            <div className="space-y-4">
              <SettingsField label="اسم الشركة" icon={Building}>
                <Input value={companySettings.companyName}
                  onChange={(e) => handleCompanyUpdate({ ...companySettings, companyName: e.target.value })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>

              <SettingsField label="البريد الإلكتروني للشركة" icon={Mail}>
                <Input type="email" value={companySettings.companyEmail}
                  onChange={(e) => handleCompanyUpdate({ ...companySettings, companyEmail: e.target.value })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>

              <SettingsField label="العملة الافتراضية" icon={DollarSign}>
                <select value={companySettings.currency}
                  onChange={(e) => handleCompanyUpdate({ ...companySettings, currency: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                </select>
              </SettingsField>

              <SettingsField label="اللغة" icon={Languages}>
                <select value={companySettings.language}
                  onChange={(e) => handleCompanyUpdate({ ...companySettings, language: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all">
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </SettingsField>
            </div>
          </SettingsCard>

          {/* User Settings */}
          <SettingsCard icon={User} title="إعدادات المستخدم" subtitle="تخصيص إعدادات المستخدم والإشعارات" color="purple">
            <div className="space-y-1">
              <ToggleRow
                icon={Mail} label="إشعارات البريد الإلكتروني" sub="تلقي إشعارات عبر البريد"
                value={userSettings.preferences.notifications.email}
                onChange={() => handleUserUpdate({
                  ...userSettings, preferences: { ...userSettings.preferences,
                    notifications: { ...userSettings.preferences.notifications, email: !userSettings.preferences.notifications.email }
                  }
                })}
              />
              <ToggleRow
                icon={Smartphone} label="إشعارات النظام" sub="تلقي إشعارات من النظام"
                value={userSettings.preferences.notifications.push}
                onChange={() => handleUserUpdate({
                  ...userSettings, preferences: { ...userSettings.preferences,
                    notifications: { ...userSettings.preferences.notifications, push: !userSettings.preferences.notifications.push }
                  }
                })}
              />
              <ToggleRow
                icon={Lock} label="المصادقة الثنائية" sub="تفعيل المصادقة الثنائية للأمان"
                value={userSettings.security.twoFactorAuth}
                onChange={() => handleUserUpdate({
                  ...userSettings, security: { ...userSettings.security, twoFactorAuth: !userSettings.security.twoFactorAuth }
                })}
              />
            </div>
          </SettingsCard>

          {/* Payment Settings */}
          <SettingsCard icon={CreditCard} title="إعدادات الدفع" subtitle="إدارة وسائل الدفع وإعدادات الضرائب" color="green">
            <div className="space-y-4">
              <SettingsField label="نسبة الضريبة (%)" icon={DollarSign}>
                <Input type="number" value={paymentSettings.taxRate}
                  onChange={(e) => handlePaymentUpdate({ ...paymentSettings, taxRate: parseFloat(e.target.value) })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">وسائل الدفع المتاحة</Label>
                <div className="space-y-2">
                  {paymentSettings.methods.map((method, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600/50 group">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{method}</span>
                      </div>
                      <button onClick={() => handleRemovePaymentMethod(method)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {paymentSettings.methods.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-3">لا توجد وسائل دفع مضافة</p>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder="وسيلة دفع جديدة" value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newPaymentMethod.trim()) { handleAddPaymentMethod(newPaymentMethod.trim()); setNewPaymentMethod('') } }}
                      className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
                    <Button onClick={() => { if (newPaymentMethod.trim()) { handleAddPaymentMethod(newPaymentMethod.trim()); setNewPaymentMethod('') } }}
                      className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-1 px-4">
                      <Plus className="w-4 h-4" /> إضافة
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Security Settings */}
          <SettingsCard icon={Shield} title="إعدادات الأمان" subtitle="إدارة إعدادات الأمان والنظام" color="red">
            <div className="space-y-4">
              <SettingsField label="مدة تسجيل الخروج التلقائي (دقائق)" icon={Clock}>
                <Input type="number" value={userSettings.security.autoLogout}
                  onChange={(e) => handleUserUpdate({ ...userSettings, security: { ...userSettings.security, autoLogout: parseInt(e.target.value) } })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>

              <SettingsField label="مدة صلاحية كلمة المرور (يوم)" icon={Key}>
                <Input type="number" value={userSettings.security.passwordExpiry}
                  onChange={(e) => handleUserUpdate({ ...userSettings, security: { ...userSettings.security, passwordExpiry: parseInt(e.target.value) } })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>

              <SettingsField label="مدة انتهاء الجلسة (دقائق)" icon={Clock}>
                <Input type="number" value={userSettings.security.sessionTimeout}
                  onChange={(e) => handleUserUpdate({ ...userSettings, security: { ...userSettings.security, sessionTimeout: parseInt(e.target.value) } })}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600" />
              </SettingsField>
            </div>
          </SettingsCard>

          {/* Holiday Settings */}
          <SettingsCard icon={Calendar} title="إعدادات الإجازات الرسمية" subtitle="إدارة الإجازات الرسمية والعطلات الأسبوعية" color="orange" fullWidth>
            <HolidayConfiguration />
          </SettingsCard>
        </div>
      )}
    </div>
  )
}

// ====== SUB COMPONENTS ======

const SettingsCard = ({ icon: Icon, title, subtitle, color, children, fullWidth }) => {
  const cardBg = {
    blue: 'bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-900/10 dark:to-blue-800/5',
    purple: 'bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-900/10 dark:to-purple-800/5',
    green: 'bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-900/10 dark:to-green-800/5',
    red: 'bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-900/10 dark:to-red-800/5',
    orange: 'bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-900/10 dark:to-orange-800/5',
  }
  const iconBg = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  }

  return (
    <Card className={`rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBg[color]} ${fullWidth ? 'md:col-span-2' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-gray-900 dark:text-white">{title}</span>
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5">{subtitle}</p>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const SettingsField = ({ label, icon: Icon, children }) => (
  <div>
    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
      {label}
    </Label>
    {children}
  </div>
)

const ToggleRow = ({ icon: Icon, label, sub, value, onChange }) => (
  <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${value ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'} transition-colors`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
      </div>
    </div>
    <button onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  </div>
)

export default SettingsPage
