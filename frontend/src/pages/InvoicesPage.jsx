import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Search,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Printer,
  X,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Hash,
  Loader2,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Calendar,
  ChevronDown,
  Download,
  Receipt,
  Banknote,
} from 'lucide-react'

// ====== HELPERS ======

const fmt = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0) + ' EGP'

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}

const today = () => new Date().toISOString().split('T')[0]

// ====== TOAST ======

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  }

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-lg text-white shadow-xl ${colors[type] || colors.info} flex items-center gap-2 animate-slide-down`}>
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="mr-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  )
}

// ====== STATUS CONFIG ======

const STATUS_CONFIG = {
  draft: { label: 'مسودة', classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  sent: { label: 'مرسلة', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  paid: { label: 'مدفوعة', classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  partially_paid: { label: 'مدفوعة جزئياً', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  overdue: { label: 'متأخرة', classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.classes}`}>{c.label}</span>
}

// ====== EMPTY ITEM ======

const emptyItem = () => ({ description: '', quantity: 1, unitPrice: 0, discount: 0 })

// ====== DEFAULT FORM ======

const defaultForm = () => ({
  clientId: '',
  projectId: '',
  date: today(),
  dueDate: '',
  items: [emptyItem()],
  discountType: 'fixed',
  discountValue: 0,
  vatRate: 14,
  whtRate: 0,
  currency: 'EGP',
  notes: '',
  terms: '',
  paymentMethod: 'تحويل بنكي',
})

// ====== PRINT VIEW ======

const PrintView = ({ invoice }) => {
  if (!invoice) return null

  const itemsSubtotal = (invoice.items || []).reduce((sum, item) => {
    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0)
    return sum + lineTotal
  }, 0)

  if (!invoice) return null;
  return (
    <div id="print-area" style={{ display: 'none' }} dir="rtl">
      <style>{`
        @media print {
          body > *:not(#print-area) { display: none !important; }
          #print-area { display: block !important; position: absolute; top: 0; right: 0; left: 0; width: 100%; background: white; color: black; padding: 40px; z-index: 99999; }
          #print-area * { color: black !important; background: white !important; }
          #print-area table { border-collapse: collapse; }
          #print-area th, #print-area td { border: 1px solid #ccc; padding: 8px; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">فاتورة</h1>
            <p className="text-lg text-gray-600 mt-1">INVOICE</p>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold">الشركة</h2>
            <p className="text-sm text-gray-600">Company Name</p>
          </div>
        </div>

        {/* Invoice Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-1">فاتورة إلى:</h3>
            <p className="font-bold text-lg">{invoice.clientName || '-'}</p>
            {invoice.projectName && <p className="text-sm text-gray-600">المشروع: {invoice.projectName}</p>}
          </div>
          <div className="text-left space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">رقم الفاتورة:</span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">التاريخ:</span>
              <span>{fmtDate(invoice.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">تاريخ الاستحقاق:</span>
              <span>{fmtDate(invoice.dueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">الحالة:</span>
              <span className="font-semibold">{STATUS_CONFIG[invoice.status]?.label || invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-6 border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="p-3 text-right text-sm">#</th>
              <th className="p-3 text-right text-sm">الوصف</th>
              <th className="p-3 text-center text-sm">الكمية</th>
              <th className="p-3 text-center text-sm">سعر الوحدة</th>
              <th className="p-3 text-center text-sm">الخصم</th>
              <th className="p-3 text-left text-sm">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, i) => {
              const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0)
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="p-3 text-sm border-b">{i + 1}</td>
                  <td className="p-3 text-sm border-b">{item.description}</td>
                  <td className="p-3 text-sm border-b text-center">{item.quantity}</td>
                  <td className="p-3 text-sm border-b text-center">{fmt(item.unitPrice)}</td>
                  <td className="p-3 text-sm border-b text-center">{fmt(item.discount)}</td>
                  <td className="p-3 text-sm border-b text-left font-semibold">{fmt(lineTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي:</span>
              <span>{fmt(invoice.subtotal || itemsSubtotal)}</span>
            </div>
            {(Number(invoice.discountAmount) > 0) && (
              <div className="flex justify-between text-sm text-red-600">
                <span>الخصم:</span>
                <span>-{fmt(invoice.discountAmount)}</span>
              </div>
            )}
            {(Number(invoice.vatAmount) > 0) && (
              <div className="flex justify-between text-sm">
                <span>ضريبة القيمة المضافة ({invoice.vatRate || 14}%):</span>
                <span>{fmt(invoice.vatAmount)}</span>
              </div>
            )}
            {(Number(invoice.whtAmount) > 0) && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>ضريبة الخصم من المنبع:</span>
                <span>-{fmt(invoice.whtAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t-2 border-gray-800">
              <span>الإجمالي:</span>
              <span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-4 border-t">
            <h4 className="font-semibold text-sm text-gray-500 mb-1">ملاحظات:</h4>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}
        {invoice.terms && (
          <div className="mt-4">
            <h4 className="font-semibold text-sm text-gray-500 mb-1">الشروط والأحكام:</h4>
            <p className="text-sm">{invoice.terms}</p>
          </div>
        )}

        <div className="mt-12 pt-4 border-t text-center text-xs text-gray-400">
          شكرا لتعاملكم معنا
        </div>
      </div>
    </div>
  )
}

// ====== MAIN COMPONENT ======

const InvoicesPage = () => {
  // --- State ---
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ totalCount: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Modals
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(defaultForm())
  const [formLoading, setFormLoading] = useState(false)

  // Detail
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('تحويل بنكي')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)

  // Print ref
  const [printInvoice, setPrintInvoice] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
  }, [])

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (searchTerm) params.search = searchTerm

      const [invRes, statsRes, clientsRes, projectsRes] = await Promise.all([
        api.get('/invoices', { params }),
        api.get('/invoices/stats/summary').catch(() => ({ data: {} })),
        api.get('/clients').catch(() => ({ data: { data: [] } })),
        api.get('/projects').catch(() => ({ data: { data: [] } })),
      ])

      const invList = invRes.data?.data || invRes.data || []
      setInvoices(Array.isArray(invList) ? invList : [])

      const s = statsRes.data?.data || statsRes.data || {}
      setStats({
        totalCount: s.totalCount || s.count || invList.length || 0,
        totalAmount: s.totalAmount || s.total || 0,
        paidAmount: s.paidAmount || s.paid || 0,
        remainingAmount: s.remainingAmount || s.remaining || 0,
      })

      const cl = clientsRes.data?.data || clientsRes.data || []
      setClients(Array.isArray(cl) ? cl : [])

      const pr = projectsRes.data?.data || projectsRes.data || []
      setProjects(Array.isArray(pr) ? pr : [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
      showToast('حدث خطأ في تحميل البيانات', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchTerm, showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Calculations ---

  const calcItemSubtotal = (item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    const disc = Number(item.discount) || 0
    return qty * price - disc
  }

  const calcTotals = (form) => {
    const subtotal = (form.items || []).reduce((s, item) => s + calcItemSubtotal(item), 0)
    let discountAmount = 0
    if (form.discountType === 'percentage') {
      discountAmount = subtotal * (Number(form.discountValue) || 0) / 100
    } else {
      discountAmount = Number(form.discountValue) || 0
    }
    const afterDiscount = subtotal - discountAmount
    const vatAmount = afterDiscount * (Number(form.vatRate) || 0) / 100
    const whtAmount = afterDiscount * (Number(form.whtRate) || 0) / 100
    const total = afterDiscount + vatAmount - whtAmount
    return { subtotal, discountAmount, afterDiscount, vatAmount, whtAmount, total }
  }

  const totals = calcTotals(formData)

  // --- Item Management ---

  const addItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))
  }

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }))
  }

  const updateItem = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  // --- CRUD Actions ---

  const openCreateModal = () => {
    setEditingId(null)
    setFormData(defaultForm())
    setShowFormModal(true)
  }

  const openEditModal = async (invoice) => {
    setEditingId(invoice._id)
    setFormLoading(true)
    setShowFormModal(true)
    try {
      const res = await api.get(`/invoices/${invoice._id}`)
      const inv = res.data?.data || res.data || {}
      setFormData({
        clientId: inv.clientId || inv.client?._id || inv.client || '',
        projectId: inv.projectId || inv.project?._id || inv.project || '',
        date: inv.date ? inv.date.split('T')[0] : today(),
        dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : '',
        items: (inv.items && inv.items.length > 0) ? inv.items.map((it) => ({
          description: it.description || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          discount: it.discount || 0,
        })) : [emptyItem()],
        discountType: inv.discountType || 'fixed',
        discountValue: inv.discountValue || 0,
        vatRate: inv.vatRate ?? 14,
        whtRate: inv.whtRate || 0,
        currency: inv.currency || 'EGP',
        notes: inv.notes || '',
        terms: inv.terms || '',
        paymentMethod: inv.paymentMethod || 'تحويل بنكي',
      })
    } catch (err) {
      showToast('حدث خطأ في تحميل بيانات الفاتورة', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.clientId) {
      showToast('يرجى اختيار العميل', 'warning')
      return
    }
    if (!formData.items.some((it) => it.description.trim())) {
      showToast('يرجى إضافة عنصر واحد على الأقل', 'warning')
      return
    }
    setFormLoading(true)
    try {
      if (editingId) {
        await api.put(`/invoices/${editingId}`, formData)
        showToast('تم تحديث الفاتورة بنجاح', 'success')
      } else {
        await api.post('/invoices', formData)
        showToast('تم إنشاء الفاتورة بنجاح', 'success')
      }
      setShowFormModal(false)
      setEditingId(null)
      await fetchData()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    try {
      await api.delete(`/invoices/${id}`)
      showToast('تم حذف الفاتورة بنجاح', 'success')
      await fetchData()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في حذف الفاتورة', 'error')
    }
  }

  // --- Detail View ---

  const openDetail = async (invoice) => {
    setDetailLoading(true)
    setShowDetailModal(true)
    setPaymentAmount('')
    setPaymentRef('')
    setPaymentNotes('')
    setPaymentMethod('تحويل بنكي')
    try {
      const res = await api.get(`/invoices/${invoice._id}`)
      setDetailInvoice(res.data?.data || res.data || invoice)
    } catch (err) {
      setDetailInvoice(invoice)
      showToast('حدث خطأ في تحميل تفاصيل الفاتورة', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  // --- Payment ---

  const handleRecordPayment = async () => {
    if (!detailInvoice) return
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'warning')
      return
    }
    setPaymentLoading(true)
    try {
      await api.post(`/invoices/${detailInvoice._id}/payments`, {
        amount,
        method: paymentMethod,
        reference: paymentRef,
        notes: paymentNotes,
      })
      showToast('تم تسجيل الدفعة بنجاح', 'success')
      // Reload detail
      const res = await api.get(`/invoices/${detailInvoice._id}`)
      setDetailInvoice(res.data?.data || res.data || detailInvoice)
      setPaymentAmount('')
      setPaymentRef('')
      setPaymentNotes('')
      await fetchData()
    } catch (err) {
      showToast(err.response?.data?.message || 'حدث خطأ في تسجيل الدفعة', 'error')
    } finally {
      setPaymentLoading(false)
    }
  }

  // --- Print ---
  const handlePrintClick = async (invoice) => {
    let inv = invoice
    try {
      const res = await api.get(`/invoices/${invoice._id || invoice.id}`)
      inv = res.data?.data || res.data || invoice
    } catch {}
    executePrint(inv)
  }

  const executePrint = async (inv) => {
    // Fetch company settings
    let company = { nameAr: 'الشركة', nameEn: 'Company', primaryColor: '#6B21A8', secondaryColor: '#F59E0B', logoUrl: '', stampUrl: '', signatureUrl: '', email: '', phone: '', address: '', invoiceFooter: 'شكراً لتعاملكم معنا', vodafoneCash: '' }
    try {
      const cRes = await api.get('/company-settings')
      if (cRes.data?.data) company = { ...company, ...cRes.data.data }
    } catch {}

    // Convert image URL to base64 using Image + Canvas
    const toBase64 = (url) => {
      if (!url) return Promise.resolve('');
      const fullUrl = url.startsWith('http') ? url : (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001') + url;
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch { resolve(fullUrl); }
        };
        img.onerror = () => resolve(fullUrl);
        img.src = fullUrl;
      });
    };

    const [companyLogoB64, clientLogoB64, stampB64, signB64] = await Promise.all([
      toBase64(company.logoUrl),
      toBase64(inv.clientLogoUrl),
      toBase64(company.stampUrl),
      toBase64(company.signatureUrl),
    ]);

    const w = window.open('', '_blank', 'width=800,height=1100')
    const items = inv.items || []
    const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB') : '-'
    const statusAr = { paid: 'مدفوعة', sent: 'مرسلة', partially_paid: 'مدفوعة جزئياً', draft: 'مسودة', overdue: 'متأخرة' }
    const itemsRows = items.map((it, i) => `<tr><td style="text-align:center">${i+1}</td><td>${it.description||''}</td><td style="text-align:center">${it.quantity||1}</td><td style="text-align:center">${fmt(it.unitPrice||it.unit_price||0)}</td><td style="text-align:center">${fmt(it.discount||0)}</td><td style="text-align:center;font-weight:600">${fmt(it.subtotal||0)}</td></tr>`).join('')

    const primaryColor = company.primaryColor || '#6B21A8'
    const secondaryColor = company.secondaryColor || '#F59E0B'

    // Build payment methods section
    const payMethods = []
    if (company.bankName || company.bankAccount) {
      payMethods.push({ title: 'تحويل بنكي', lines: [
        company.bankName ? `البنك: ${company.bankName}` : '',
        company.bankAccount ? `رقم الحساب: ${company.bankAccount}` : '',
        company.bankIban ? `IBAN: ${company.bankIban}` : '',
        company.bankSwift ? `SWIFT: ${company.bankSwift}` : '',
      ].filter(Boolean) })
    }
    if (company.instapayName || company.instapayIpa || company.instapayPhone) {
      const ipaRaw = company.instapayIpa?.replace(/^@/, '') || ''
      const ipaFull = ipaRaw ? `${ipaRaw}@instapay` : ''
      payMethods.push({ title: 'انستا باي (InstaPay)', lines: [
        company.instapayName ? `الاسم: ${company.instapayName}` : '',
        ipaFull ? `IPA: ${ipaFull}` : '',
        company.instapayPhone ? `${company.instapayPhone}` : '',
      ].filter(Boolean) })
    }
    if (company.vodafoneCash) payMethods.push({ title: 'فودافون كاش', lines: [company.vodafoneCash] })
    if (company.walletOrange) payMethods.push({ title: 'أورانج كاش', lines: [company.walletOrange] })
    if (company.walletEtisalat) payMethods.push({ title: 'اتصالات كاش', lines: [company.walletEtisalat] })
    if (company.walletWe) payMethods.push({ title: 'وي باي', lines: [company.walletWe] })
    if (company.walletFawry) payMethods.push({ title: 'فوري', lines: [company.walletFawry] })

    const methodColors = { 'انستا باي (InstaPay)': '#7C3AED', 'فودافون كاش': '#E60000', 'أورانج كاش': '#FF6600', 'اتصالات كاش': '#0891B2', 'وي باي': '#7B2D8E', 'فوري': '#CA8A04', 'تحويل بنكي': '#1D4ED8' }

    const paymentSection = payMethods.length > 0 ? `
      <div style="margin-top:20px;page-break-inside:avoid">
        <div style="font-weight:700;font-size:12px;color:#555;margin-bottom:8px;padding-bottom:5px;border-bottom:2px solid ${primaryColor}">معلومات الدفع</div>
        <table style="width:100%;border-collapse:collapse;margin:0">
          ${payMethods.map(m => `<tr>
            <td style="border:none;padding:5px 0;width:140px;vertical-align:top"><span style="display:inline-block;padding:3px 10px;border-radius:4px;background:${methodColors[m.title]||primaryColor};color:white;font-weight:700;font-size:10px;white-space:nowrap">${m.title}</span></td>
            <td style="border:none;padding:5px 0;font-size:11px;color:#333;font-family:'Cairo',sans-serif;direction:ltr;text-align:left">${m.lines.map(l => `<div style="padding:1px 0">${l}</div>`).join('')}</td>
          </tr>`).join('')}
        </table>
      </div>` : ''

    const paymentInfo = paymentSection
    const logoImg = companyLogoB64 ? `<img src="${companyLogoB64}" alt="logo" style="max-height:60px;max-width:120px;object-fit:contain" />` : `<div style="width:60px;height:60px;background:rgba(255,255,255,0.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:white">${(company.nameAr||'ش').charAt(0)}</div>`
    const stampImg = stampB64 ? `<div style="position:relative;margin-top:-30px;text-align:center;pointer-events:none;z-index:0"><img src="${stampB64}" alt="stamp" style="width:140px;height:140px;object-fit:contain;opacity:0.35" /></div>` : ''
    const signImg = signB64 ? `<div style="text-align:center;margin-top:5px"><img src="${signB64}" alt="signature" style="max-height:40px;opacity:0.6" /></div>` : ''

    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${inv.invoiceNumber||''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 10mm; }
        body { font-family: 'Cairo', Arial, sans-serif; padding: 15px 20px; color: #111; direction: rtl; font-size: 12px; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${primaryColor}; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 24px; color: ${primaryColor}; font-weight: 800; }
        .header .en { color: #888; font-size: 13px; font-weight: 400; }
        .company-block { text-align: left; }
        .company-block img { max-height: 40px; margin-bottom: 4px; }
        .company-block h2 { font-size: 16px; font-weight: 700; color: #222; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
        .info-label { color: #888; font-size: 10px; font-weight: 600; }
        .info-value { font-weight: 700; font-size: 12px; color: #222; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: ${primaryColor}; color: white; padding: 6px 10px; text-align: right; font-size: 11px; font-weight: 700; }
        td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
        tr:nth-child(even) { background: #fafafa; }
        .totals { width: 50%; margin-right: auto; }
        .totals tr td { border: none; padding: 4px 10px; font-size: 12px; }
        .totals .total-row { font-size: 15px; font-weight: 800; border-top: 2px solid ${primaryColor}; color: ${primaryColor}; }
        .notes { margin-top: 12px; padding: 0; background: transparent; border: none; }
        .notes strong { display: block; font-size: 10px; color: #888; font-weight: 600; margin-bottom: 3px; }
        .notes p { font-size: 11px; color: #333; padding: 6px 10px; background: #fafafa; border-radius: 4px; border-right: 2px solid ${primaryColor}; }
        .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; color: #aaa; font-size: 10px; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        @media print { @page { margin: 0; size: A4; } body { padding: 15px 20px; margin: 0; } }
      </style></head><body>
        <div class="header">
          <div><h1>فاتورة</h1><span class="en">INVOICE</span></div>
          <div class="company-block">
            ${companyLogoB64 ? `<img src="${companyLogoB64}" />` : ''}
            <h2>${company.nameAr||'الشركة'}</h2>
            <span class="en">${company.nameEn||''}</span>
          </div>
        </div>
        <div class="info">
          <div>
            <div class="info-label">فاتورة إلى:</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
              ${clientLogoB64 ? `<img src="${clientLogoB64}" style="max-height:35px;max-width:60px;object-fit:contain;border-radius:4px" />` : ''}
              <div>
                <div class="info-value" style="font-size:16px">${inv.clientName||'-'}</div>
                ${inv.projectName?`<div style="color:#888;font-size:11px;margin-top:1px">المشروع: ${inv.projectName}</div>`:''}
              </div>
            </div>
          </div>
          <div style="text-align:left">
            <div style="margin-bottom:4px"><span class="info-label">رقم الفاتورة: </span><span class="info-value">${inv.invoiceNumber||''}</span></div>
            <div style="margin-bottom:4px"><span class="info-label">التاريخ: </span><span style="font-weight:600">${fmtD(inv.date)}</span></div>
            <div style="margin-bottom:4px"><span class="info-label">الاستحقاق: </span><span style="font-weight:600">${fmtD(inv.dueDate)}</span></div>
            <div><span class="info-label">الحالة: </span><span style="font-weight:700;color:${inv.status==='paid'?'#16a34a':inv.status==='overdue'?'#dc2626':primaryColor}">${statusAr[inv.status]||'مسودة'}</span></div>
          </div>
        </div>
        <table><thead><tr><th>#</th><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الخصم</th><th>الإجمالي</th></tr></thead><tbody>${itemsRows||'<tr><td colspan="6" style="text-align:center">لا توجد عناصر</td></tr>'}</tbody></table>
        <table class="totals">
          <tr><td>المجموع الفرعي:</td><td style="text-align:left;font-weight:600">${fmt(inv.subtotal||0)}</td></tr>
          ${(inv.discountAmount||0)>0?`<tr><td>الخصم:</td><td style="text-align:left;color:#dc2626;font-weight:600">- ${fmt(inv.discountAmount)}</td></tr>`:''}
          <tr><td>ضريبة القيمة المضافة (${inv.vatRate||14}%):</td><td style="text-align:left;font-weight:600">${fmt(inv.vatAmount||0)}</td></tr>
          ${(inv.whtAmount||0)>0?`<tr><td>ضريبة الخصم:</td><td style="text-align:left;color:#dc2626;font-weight:600">- ${fmt(inv.whtAmount)}</td></tr>`:''}
          <tr class="total-row"><td>الإجمالي:</td><td style="text-align:left">${fmt(inv.total||0)}</td></tr>
        </table>
        ${inv.notes?`<div class="notes"><strong>ملاحظات:</strong><p>${inv.notes}</p></div>`:''}
        ${paymentInfo}
        ${stampImg}${signImg}
        <div class="footer"><p>${company.invoiceFooter || 'شكراً لتعاملكم معنا'}</p></div>
      </body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 500)
  }

  // --- Export CSV ---

  const handleExportCSV = () => {
    const header = ['رقم الفاتورة', 'العميل', 'التاريخ', 'الاستحقاق', 'المبلغ', 'المدفوع', 'المتبقي', 'الحالة']
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.clientName,
      inv.date ? inv.date.split('T')[0] : '',
      inv.dueDate ? inv.dueDate.split('T')[0] : '',
      inv.total,
      inv.paidAmount || 0,
      inv.remainingAmount || 0,
      STATUS_CONFIG[inv.status]?.label || inv.status,
    ])
    const csvContent = '\uFEFF' + [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices_${today()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('تم تصدير البيانات بنجاح', 'success')
  }

  // ====== RENDER ======

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">جاري تحميل بيانات الفواتير...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 no-print" dir="rtl">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}


      {/* ====== HEADER ====== */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white shadow-lg">
              <FileText className="w-7 h-7" />
            </div>
            إدارة الفواتير
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 mr-14">إنشاء وإدارة وتتبع الفواتير والمدفوعات</p>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pr-10 pl-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[140px]"
          >
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="sent">مرسلة</option>
            <option value="paid">مدفوعة</option>
            <option value="partially_paid">مدفوعة جزئياً</option>
            <option value="overdue">متأخرة</option>
          </select>

          {/* Export */}
          <Button variant="outline" onClick={handleExportCSV} size="sm">
            <Download className="w-4 h-4 ml-1" />
            تصدير
          </Button>

          {/* Add Invoice */}
          <Button
            onClick={openCreateModal}
            className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
          >
            <Plus className="w-4 h-4 ml-2" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* ====== STATISTICS CARDS ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-blue-700 dark:text-blue-400">إجمالي الفواتير</p><p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.totalCount}</p><p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">فاتورة</p></div><Hash className="w-7 h-7 text-blue-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-green-700 dark:text-green-400">إجمالي المبلغ</p><p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{fmt(stats.totalAmount)}</p><p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">مجموع الفواتير</p></div><DollarSign className="w-7 h-7 text-green-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">المحصل</p><p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{fmt(stats.paidAmount)}</p><p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.totalAmount > 0 ? `${Math.round((stats.paidAmount / stats.totalAmount) * 100)}%` : '0%'} من الإجمالي</p></div><TrendingUp className="w-7 h-7 text-emerald-500" /></div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-red-700 dark:text-red-400">المتبقي</p><p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">{fmt(stats.remainingAmount)}</p><p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{stats.totalAmount > 0 ? `${Math.round((stats.remainingAmount / stats.totalAmount) * 100)}%` : '0%'} متبقي</p></div><TrendingDown className="w-7 h-7 text-red-500" /></div></CardContent>
        </Card>
      </div>

      {/* ====== INVOICES TABLE ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5" />
            قائمة الفواتير
            <Badge variant="outline" className="mr-2">{invoices.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">رقم الفاتورة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">العميل</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">التاريخ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">الاستحقاق</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">المبلغ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">المدفوع</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">المتبقي</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">الحالة</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>لا توجد فواتير</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => (
                    <tr
                      key={inv._id}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{inv.clientName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{fmt(inv.total)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{fmt(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{fmt(inv.remainingAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetail(inv)}
                            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                            title="عرض"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(inv)}
                            className="p-1.5 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 transition-colors"
                            title="تعديل"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintClick(inv)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                            title="طباعة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv._id)}
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ====== CREATE / EDIT MODAL ====== */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl my-4 border border-gray-200 dark:border-gray-700" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                {editingId ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}
              </h2>
              <button onClick={() => { setShowFormModal(false); setEditingId(null) }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {formLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Header Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>العميل *</Label>
                    <select
                      value={formData.clientId}
                      onChange={(e) => setFormData((p) => ({ ...p, clientId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">اختر العميل</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>المشروع</Label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData((p) => ({ ...p, projectId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">اختر المشروع</option>
                      {projects.map((p) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>تاريخ الاستحقاق</Label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>العملة</Label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="EGP">EGP - جنيه مصري</option>
                      <option value="USD">USD - دولار أمريكي</option>
                      <option value="EUR">EUR - يورو</option>
                      <option value="SAR">SAR - ريال سعودي</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>طريقة الدفع</Label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="كاش">كاش</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="انستا باي">انستا باي</option>
                      <option value="فودافون كاش">فودافون كاش</option>
                      <option value="أورانج كاش">أورانج كاش</option>
                      <option value="اتصالات كاش">اتصالات كاش</option>
                      <option value="وي باي">وي باي</option>
                      <option value="فوري">فوري</option>
                      <option value="شيك">شيك</option>
                      <option value="بطاقة ائتمان">بطاقة ائتمان</option>
                    </select>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">بنود الفاتورة</h3>
                    <Button onClick={addItem} size="sm" variant="outline" className="gap-1">
                      <Plus className="w-4 h-4" />
                      إضافة بند
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-8">#</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الوصف</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-24">الكمية</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-32">سعر الوحدة</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">الخصم</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-32">الإجمالي</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                placeholder="وصف البند"
                                className="w-full h-9 px-2 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                className="w-full h-9 px-2 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                                className="w-full h-9 px-2 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={item.discount}
                                onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                                className="w-full h-9 px-2 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            </td>
                            <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">
                              {fmt(calcItemSubtotal(item))}
                            </td>
                            <td className="px-3 py-2">
                              {formData.items.length > 1 && (
                                <button
                                  onClick={() => removeItem(idx)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end">
                  <div className="w-full max-w-md bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{fmt(totals.subtotal)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">الخصم:</span>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData((p) => ({ ...p, discountType: e.target.value }))}
                        className="h-8 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                      >
                        <option value="fixed">مبلغ ثابت</option>
                        <option value="percentage">نسبة %</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={formData.discountValue}
                        onChange={(e) => setFormData((p) => ({ ...p, discountValue: e.target.value }))}
                        className="w-24 h-8 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                      />
                      <span className="text-sm font-semibold text-red-600 mr-auto">-{fmt(totals.discountAmount)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">بعد الخصم:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{fmt(totals.afterDiscount)}</span>
                    </div>

                    {/* VAT */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">ضريبة القيمة المضافة:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.vatRate}
                        onChange={(e) => setFormData((p) => ({ ...p, vatRate: e.target.value }))}
                        className="w-16 h-8 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white mr-auto">{fmt(totals.vatAmount)}</span>
                    </div>

                    {/* WHT */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">ضريبة الخصم من المنبع:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.whtRate}
                        onChange={(e) => setFormData((p) => ({ ...p, whtRate: e.target.value }))}
                        className="w-16 h-8 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <span className="text-sm font-semibold text-orange-600 mr-auto">-{fmt(totals.whtAmount)}</span>
                    </div>

                    <div className="flex justify-between pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">الإجمالي:</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmt(totals.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Terms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="ملاحظات إضافية..."
                      rows={3}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الشروط والأحكام</Label>
                    <Textarea
                      value={formData.terms}
                      onChange={(e) => setFormData((p) => ({ ...p, terms: e.target.value }))}
                      placeholder="شروط الدفع والأحكام..."
                      rows={3}
                      className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => { setShowFormModal(false); setEditingId(null) }}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={formLoading}
                    className="bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white min-w-[120px]"
                  >
                    {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'تحديث الفاتورة' : 'إنشاء الفاتورة'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== DETAIL MODAL ====== */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl my-4" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-500" />
                تفاصيل الفاتورة
              </h2>
              <div className="flex items-center gap-2">
                {detailInvoice && (
                  <Button variant="outline" size="sm" onClick={() => handlePrintClick(detailInvoice)}>
                    <Printer className="w-4 h-4 ml-1" />
                    طباعة
                  </Button>
                )}
                <button onClick={() => { setShowDetailModal(false); setDetailInvoice(null) }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : detailInvoice ? (
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Invoice Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">رقم الفاتورة</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{detailInvoice.invoiceNumber}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الحالة</p>
                    <StatusBadge status={detailInvoice.status} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">الإجمالي</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(detailInvoice.total)}</p>
                  </div>
                </div>

                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">العميل</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{detailInvoice.clientName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">المشروع</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{detailInvoice.projectName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">التاريخ</p>
                    <p className="text-gray-700 dark:text-gray-300">{fmtDate(detailInvoice.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ الاستحقاق</p>
                    <p className="text-gray-700 dark:text-gray-300">{fmtDate(detailInvoice.dueDate)}</p>
                  </div>
                </div>

                {/* Items Table */}
                {detailInvoice.items && detailInvoice.items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">البنود</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/50">
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">#</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الوصف</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الكمية</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">سعر الوحدة</th>
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الخصم</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailInvoice.items.map((item, i) => {
                            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0)
                            return (
                              <tr key={i} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                                <td className="px-3 py-2 text-sm text-gray-500">{i + 1}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{item.description}</td>
                                <td className="px-3 py-2 text-sm text-center">{item.quantity}</td>
                                <td className="px-3 py-2 text-sm text-center">{fmt(item.unitPrice)}</td>
                                <td className="px-3 py-2 text-sm text-center">{fmt(item.discount)}</td>
                                <td className="px-3 py-2 text-sm text-left font-semibold">{fmt(lineTotal)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals Breakdown */}
                <div className="flex justify-end">
                  <div className="w-full max-w-sm bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي:</span>
                      <span>{fmt(detailInvoice.subtotal)}</span>
                    </div>
                    {Number(detailInvoice.discountAmount) > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>الخصم:</span>
                        <span>-{fmt(detailInvoice.discountAmount)}</span>
                      </div>
                    )}
                    {Number(detailInvoice.vatAmount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">ضريبة القيمة المضافة ({detailInvoice.vatRate || 14}%):</span>
                        <span>{fmt(detailInvoice.vatAmount)}</span>
                      </div>
                    )}
                    {Number(detailInvoice.whtAmount) > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>ضريبة الخصم من المنبع:</span>
                        <span>-{fmt(detailInvoice.whtAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300 dark:border-gray-600">
                      <span>الإجمالي:</span>
                      <span className="text-blue-600 dark:text-blue-400">{fmt(detailInvoice.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-green-600">المدفوع:</span>
                      <span className="text-green-600 font-semibold">{fmt(detailInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">المتبقي:</span>
                      <span className="text-red-600 font-semibold">{fmt(detailInvoice.remainingAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                {detailInvoice.payments && detailInvoice.payments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      سجل المدفوعات
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/50">
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">التاريخ</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">المبلغ</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">الطريقة</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">المرجع</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailInvoice.payments.map((pay, i) => (
                            <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="px-3 py-2 text-sm">{fmtDate(pay.date || pay.createdAt)}</td>
                              <td className="px-3 py-2 text-sm font-semibold text-green-600">{fmt(pay.amount)}</td>
                              <td className="px-3 py-2 text-sm">{pay.method || '-'}</td>
                              <td className="px-3 py-2 text-sm">{pay.reference || '-'}</td>
                              <td className="px-3 py-2 text-sm text-gray-500">{pay.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Record Payment Form */}
                {detailInvoice.status !== 'paid' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      تسجيل دفعة جديدة
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">المبلغ *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={`المتبقي: ${fmt(detailInvoice.remainingAmount)}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">طريقة الدفع</Label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="كاش">كاش</option>
                          <option value="تحويل بنكي">تحويل بنكي</option>
                          <option value="انستا باي">انستا باي</option>
                          <option value="فودافون كاش">فودافون كاش</option>
                          <option value="أورانج كاش">أورانج كاش</option>
                          <option value="اتصالات كاش">اتصالات كاش</option>
                          <option value="وي باي">وي باي</option>
                          <option value="فوري">فوري</option>
                          <option value="شيك">شيك</option>
                          <option value="بطاقة ائتمان">بطاقة ائتمان</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">رقم المرجع</Label>
                        <Input
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="رقم التحويل أو الشيك"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ملاحظات</Label>
                        <Input
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="ملاحظات..."
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        onClick={handleRecordPayment}
                        disabled={paymentLoading}
                        className="bg-gradient-to-l from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                      >
                        {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
                        تسجيل الدفعة
                      </Button>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {detailInvoice.notes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">ملاحظات:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">{detailInvoice.notes}</p>
                  </div>
                )}
                {detailInvoice.terms && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">الشروط والأحكام:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">{detailInvoice.terms}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoicesPage
