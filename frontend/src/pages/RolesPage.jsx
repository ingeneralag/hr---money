import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import {
  Shield, ShieldCheck, ShieldAlert, Users, Plus, X, CheckCircle, AlertCircle,
  Loader2, Trash2, Save, ChevronDown, ChevronUp, Eye, FileDown, Pencil,
  UserPlus, Lock, Settings, Search,
} from 'lucide-react'

// ====== HELPERS ======

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl text-white shadow-2xl ${colors[type] || colors.info} flex items-center gap-2 animate-slide-down backdrop-blur-sm`}>
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="mr-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  )
}

// ====== CONSTANTS ======

const MODULES = [
  { key: 'dashboard', label: 'لوحة التحكم' }, { key: 'transactions', label: 'المعاملات' },
  { key: 'employees', label: 'الموظفين' }, { key: 'clients', label: 'العملاء' },
  { key: 'projects', label: 'المشاريع' }, { key: 'invoices', label: 'الفواتير' },
  { key: 'payroll', label: 'الرواتب' }, { key: 'categories', label: 'التصنيفات' },
  { key: 'treasury', label: 'الخزينة' }, { key: 'tax', label: 'الضرائب' },
  { key: 'losses', label: 'الخسائر' }, { key: 'assets', label: 'الأصول' },
  { key: 'settings', label: 'الإعدادات' }, { key: 'users', label: 'المستخدمين' },
  { key: 'logs', label: 'السجلات' },
]

const PERMISSION_KEYS = [
  { key: 'view', label: 'عرض', icon: Eye },
  { key: 'create', label: 'إنشاء', icon: Plus },
  { key: 'edit', label: 'تعديل', icon: Pencil },
  { key: 'delete', label: 'حذف', icon: Trash2 },
  { key: 'export', label: 'تصدير', icon: FileDown },
  { key: 'approve', label: 'اعتماد', icon: CheckCircle },
]

const ROLE_COLORS = {
  admin: { bg: 'from-red-50/50 to-red-100/30 dark:from-red-900/15 dark:to-red-800/5', iconBg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', accent: '#ef4444', icon: ShieldAlert },
  accountant: { bg: 'from-blue-50/50 to-blue-100/30 dark:from-blue-900/15 dark:to-blue-800/5', iconBg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', accent: '#3b82f6', icon: ShieldCheck },
  manager: { bg: 'from-purple-50/50 to-purple-100/30 dark:from-purple-900/15 dark:to-purple-800/5', iconBg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', accent: '#8b5cf6', icon: Shield },
  employee: { bg: 'from-green-50/50 to-green-100/30 dark:from-green-900/15 dark:to-green-800/5', iconBg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', accent: '#10b981', icon: Users },
  viewer: { bg: 'from-gray-50/50 to-gray-100/30 dark:from-gray-900/15 dark:to-gray-800/5', iconBg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', accent: '#6b7280', icon: Eye },
}

const getDefaultColor = () => ({ bg: 'from-indigo-50/50 to-indigo-100/30 dark:from-indigo-900/15 dark:to-indigo-800/5', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', accent: '#6366f1', icon: Shield })

const buildEmptyPermissions = () => {
  const perms = {}
  MODULES.forEach(m => { perms[m.key] = {}; PERMISSION_KEYS.forEach(p => { perms[m.key][p.key] = false }) })
  return perms
}

// ====== MAIN COMPONENT ======

const RolesPage = () => {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [expandedRole, setExpandedRole] = useState(null)
  const [saving, setSaving] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')
  const [editedPermissions, setEditedPermissions] = useState({})
  const [newRole, setNewRole] = useState({ name: '', nameAr: '', description: '' })
  const [creating, setCreating] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try { const res = await api.get('/roles'); setRoles(res.data.data || res.data || []) }
    catch (err) { console.error(err); setToast({ message: 'فشل في تحميل الأدوار', type: 'error' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const toggleExpand = (roleId) => {
    if (expandedRole === roleId) { setExpandedRole(null) }
    else {
      setExpandedRole(roleId)
      const role = roles.find(r => r._id === roleId)
      if (role && !editedPermissions[roleId])
        setEditedPermissions(prev => ({ ...prev, [roleId]: JSON.parse(JSON.stringify(role.permissions || buildEmptyPermissions())) }))
    }
  }

  const togglePermission = (roleId, moduleKey, permKey) => {
    setEditedPermissions(prev => {
      const current = prev[roleId] || buildEmptyPermissions()
      const updated = { ...current }
      updated[moduleKey] = { ...updated[moduleKey], [permKey]: !updated[moduleKey]?.[permKey] }
      return { ...prev, [roleId]: updated }
    })
  }

  const toggleModuleAll = (roleId, moduleKey) => {
    setEditedPermissions(prev => {
      const current = prev[roleId] || buildEmptyPermissions()
      const modulePerms = current[moduleKey] || {}
      const allChecked = PERMISSION_KEYS.every(p => modulePerms[p.key])
      const updated = { ...current }
      updated[moduleKey] = {}
      PERMISSION_KEYS.forEach(p => { updated[moduleKey][p.key] = !allChecked })
      return { ...prev, [roleId]: updated }
    })
  }

  const toggleColumnAll = (roleId, permKey) => {
    setEditedPermissions(prev => {
      const current = prev[roleId] || buildEmptyPermissions()
      const allChecked = MODULES.every(m => current[m.key]?.[permKey])
      const updated = { ...current }
      MODULES.forEach(m => { updated[m.key] = { ...updated[m.key], [permKey]: !allChecked } })
      return { ...prev, [roleId]: updated }
    })
  }

  const handleSave = async (role) => {
    const perms = editedPermissions[role._id]
    if (!perms) return
    setSaving(role._id)
    try {
      await api.put(`/roles/${role._id}`, { permissions: perms, nameAr: role.nameAr, description: role.description })
      setToast({ message: 'تم حفظ الصلاحيات بنجاح', type: 'success' }); fetchRoles()
    } catch (err) { console.error(err); setToast({ message: err.response?.data?.message || 'فشل في حفظ الصلاحيات', type: 'error' }) }
    finally { setSaving(null) }
  }

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.nameAr) { setToast({ message: 'يرجى ملء اسم الدور بالعربية والإنجليزية', type: 'error' }); return }
    setCreating(true)
    try {
      await api.post('/roles', { name: newRole.name, nameAr: newRole.nameAr, description: newRole.description, permissions: buildEmptyPermissions() })
      setToast({ message: 'تم إنشاء الدور بنجاح', type: 'success' }); setShowAddModal(false); setNewRole({ name: '', nameAr: '', description: '' }); fetchRoles()
    } catch (err) { console.error(err); setToast({ message: err.response?.data?.message || 'فشل في إنشاء الدور', type: 'error' }) }
    finally { setCreating(false) }
  }

  const handleDeleteRole = async (role) => {
    if (role.isSystem) return
    if (!window.confirm(`هل أنت متأكد من حذف دور "${role.nameAr || role.name}"؟`)) return
    try { await api.delete(`/roles/${role._id}`); setToast({ message: 'تم حذف الدور بنجاح', type: 'success' }); if (expandedRole === role._id) setExpandedRole(null); fetchRoles() }
    catch (err) { console.error(err); setToast({ message: err.response?.data?.message || 'فشل في حذف الدور', type: 'error' }) }
  }

  const countPermissions = (permissions) => {
    if (!permissions) return { total: 0, granted: 0 }
    let total = 0, granted = 0
    Object.values(permissions).forEach(module => { Object.values(module).forEach(val => { total++; if (val) granted++ }) })
    return { total, granted }
  }

  const filteredRoles = roles.filter(r => {
    const term = search.toLowerCase()
    return !term || (r.name || '').toLowerCase().includes(term) || (r.nameAr || '').includes(term) || (r.description || '').toLowerCase().includes(term)
  })

  if (loading && roles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل الأدوار...</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-5 max-w-[1600px] mx-auto">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ========== HEADER ========== */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-gray-800/90 dark:via-gray-800/70 dark:to-gray-800/90 rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/50 dark:border-gray-600/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Shield className="w-5 h-5 text-white" />
              </div>
              إدارة الأدوار والصلاحيات
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm mr-[52px]">تحكم في صلاحيات الوصول لكل دور في النظام</p>
          </div>
          <Button onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl shadow-md shadow-indigo-500/20 gap-2">
            <Plus className="w-4 h-4" />
            إضافة دور جديد
          </Button>
        </div>
      </div>

      {/* ========== STATS ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="إجمالي الأدوار" value={roles.length} sub="أدوار مسجلة" color="blue" />
        <StatCard icon={Lock} label="أدوار النظام" value={roles.filter(r => r.isSystem).length} sub="لا يمكن حذفها" color="purple" />
        <StatCard icon={UserPlus} label="أدوار مخصصة" value={roles.filter(r => !r.isSystem).length} sub="تم إنشاؤها يدوياً" color="green" />
        <StatCard icon={Settings} label="الوحدات" value={MODULES.length} sub="وحدة نظام" color="orange" />
      </div>

      {/* ========== SEARCH ========== */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input placeholder="البحث في الأدوار..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pr-12 h-12 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-base shadow-sm" />
        {search && <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>}
      </div>

      {/* ========== ROLES LIST ========== */}
      <div className="space-y-4">
        {filteredRoles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">لا توجد أدوار</p>
            <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة دور جديد" للبدء</p>
          </div>
        ) : (
          filteredRoles.map(role => {
            const colorConfig = ROLE_COLORS[role.name] || getDefaultColor()
            const RoleIcon = colorConfig.icon
            const isExpanded = expandedRole === role._id
            const permStats = countPermissions(role.permissions)
            const currentPerms = editedPermissions[role._id] || role.permissions || buildEmptyPermissions()
            const progressPct = permStats.total > 0 ? Math.round(permStats.granted / permStats.total * 100) : 0

            return (
              <Card key={role._id} className={`overflow-hidden rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br ${colorConfig.bg}`}>
                {/* Role Header */}
                <div className="flex items-center justify-between p-5 cursor-pointer group" onClick={() => toggleExpand(role._id)}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${colorConfig.iconBg} shadow-sm`}>
                      <RoleIcon className={`w-6 h-6 ${colorConfig.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{role.nameAr || role.name}</h3>
                        {role.isSystem && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] px-2 py-0.5 rounded-lg">نظامي</Badge>
                        )}
                        <Badge className={`${colorConfig.iconBg} ${colorConfig.text} text-[11px] px-2 py-0.5 rounded-lg`}>{role.name}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{role.description || 'لا يوجد وصف'}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: colorConfig.accent }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: colorConfig.accent }}>{permStats.granted}/{permStats.total}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">صلاحية مفعلة</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!role.isSystem && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteRole(role) }}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Permission Matrix */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700/60">
                    <div className="p-5 overflow-x-auto bg-white/50 dark:bg-gray-900/30">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr>
                            <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-48 rounded-r-xl bg-gray-100/80 dark:bg-gray-800/60">الوحدة</th>
                            {PERMISSION_KEYS.map(p => {
                              const PermIcon = p.icon
                              return (
                                <th key={p.key} className="px-3 py-3 text-center bg-gray-100/80 dark:bg-gray-800/60">
                                  <button onClick={() => toggleColumnAll(role._id, p.key)}
                                    className="flex flex-col items-center gap-1 mx-auto hover:opacity-70 transition-opacity" title={`تفعيل/إلغاء الكل - ${p.label}`}>
                                    <PermIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{p.label}</span>
                                  </button>
                                </th>
                              )
                            })}
                            <th className="px-3 py-3 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 rounded-l-xl bg-gray-100/80 dark:bg-gray-800/60">الكل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map((mod, idx) => {
                            const modulePerms = currentPerms[mod.key] || {}
                            const allChecked = PERMISSION_KEYS.every(p => modulePerms[p.key])
                            const someChecked = PERMISSION_KEYS.some(p => modulePerms[p.key])

                            return (
                              <tr key={mod.key} className={`${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'} hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors`}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${someChecked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    {mod.label}
                                  </div>
                                </td>
                                {PERMISSION_KEYS.map(p => (
                                  <td key={p.key} className="px-3 py-3 text-center">
                                    <label className="inline-flex items-center justify-center cursor-pointer">
                                      <input type="checkbox" checked={!!modulePerms[p.key]}
                                        onChange={() => togglePermission(role._id, mod.key, p.key)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 cursor-pointer accent-blue-500" />
                                    </label>
                                  </td>
                                ))}
                                <td className="px-3 py-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer">
                                    <input type="checkbox" checked={allChecked}
                                      onChange={() => toggleModuleAll(role._id, mod.key)}
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 cursor-pointer accent-purple-500" />
                                  </label>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Save */}
                    <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/30">
                      <Button variant="outline" className="rounded-xl"
                        onClick={() => { setEditedPermissions(prev => ({ ...prev, [role._id]: JSON.parse(JSON.stringify(role.permissions || buildEmptyPermissions())) })) }}>
                        إعادة تعيين
                      </Button>
                      <Button onClick={() => handleSave(role)} disabled={saving === role._id}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl gap-2">
                        {saving === role._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        حفظ التغييرات
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* ========== ADD ROLE MODAL ========== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200/50 dark:border-gray-700/50" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                إضافة دور جديد
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم الدور (إنجليزي) *</Label>
                <Input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} placeholder="e.g. supervisor" className="mt-1.5 rounded-xl" dir="ltr" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">اسم الدور (عربي) *</Label>
                <Input value={newRole.nameAr} onChange={(e) => setNewRole({ ...newRole, nameAr: e.target.value })} placeholder="مثال: مشرف" className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">الوصف</Label>
                <Textarea value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} placeholder="وصف مختصر للدور وصلاحياته..." className="mt-1.5 rounded-xl" rows={3} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowAddModal(false)} className="rounded-xl">إلغاء</Button>
              <Button onClick={handleCreateRole} disabled={creating}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إنشاء الدور
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ====== STAT CARD ======
const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colors = {
    blue: { bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', value: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', value: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10', icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400', value: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400', value: 'text-orange-600 dark:text-orange-400' },
  }
  const c = colors[color]
  return (
    <Card className={`bg-gradient-to-br ${c.bg} border border-gray-200/60 dark:border-gray-700/60 overflow-hidden rounded-xl`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${c.value}`}>{value}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
          </div>
          <div className={`p-3 rounded-xl ${c.icon}`}><Icon className="w-6 h-6" /></div>
        </div>
      </CardContent>
    </Card>
  )
}

export default RolesPage
