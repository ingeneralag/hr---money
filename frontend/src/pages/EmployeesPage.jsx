import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useNotifications } from '../components/NotificationSystem'
import WhatsAppService from '../services/WhatsAppService'
import { 
  Users, 
  DollarSign, 
  Gift, 
  TrendingUp, 
  Plus, 
  Edit, 
  X, 
  Eye,
  MessageCircle,
  Send,
  FileText,
  Calendar,
  Bell,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react'
import { employeeService } from '../services/api'

const EmployeesPage = () => {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [pendingEmployees, setPendingEmployees] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPendingSection, setShowPendingSection] = useState(true)
  
  // حالات نظام الرسائل
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [selectedEmployeeForMessage, setSelectedEmployeeForMessage] = useState(null)
  const [messageType, setMessageType] = useState('notification') // notification, salary, leave, custom
  const [customMessage, setCustomMessage] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // حالات الرسائل
  const [messageStatus, setMessageStatus] = useState(null) // null, 'sending', 'success', 'failed'
  const [messageError, setMessageError] = useState('')
  const [messageSuccess, setMessageSuccess] = useState('')
  const [showMessageTypeModal, setShowMessageTypeModal] = useState(false) // popup اختيار نوع الرسالة

  const { showSuccess, showError, showWarning } = useNotifications()

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  // جلب بيانات الموظفين الفعليين من الباك إند فقط مع توحيد الحقول
  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoading(true);
      try {
        console.log('🔄 جاري جلب بيانات الموظفين...');
        const response = await employeeService.getAll({ approvalStatus: 'all' });
        console.log('📊 استجابة من الخادم:', response);
        
        const approvedEmployees = (response.data || response).filter(emp => emp.approvalStatus === 'approved').map(emp => {
          console.log('👤 معالجة موظف معتمد:', emp.name, emp);
          return {
            ...emp,
            // توحيد الراتب الأساسي
            baseSalary: emp.salary || emp.baseSalary || emp.currentSalary || 0,
            // توحيد البدلات
            allowances: emp.benefits ? {
              transport: emp.benefits.transportationAllowance || emp.allowances?.transportation || 0,
              food: emp.benefits.mealAllowance || emp.allowances?.meal || 0,
              housing: emp.benefits.housingAllowance || emp.allowances?.housing || 0,
              performance: emp.benefits.performanceAllowance || 0
            } : { 
              transport: emp.allowances?.transportation || 0, 
              food: emp.allowances?.meal || 0, 
              housing: emp.allowances?.housing || 0, 
              performance: 0 
            },
            // توحيد الخصومات (إذا كانت موجودة)
            deductions: {
              insurance: emp.deductions?.socialInsurance || emp.deductions?.insurance || 0,
              taxes: emp.deductions?.tax || emp.deductions?.taxes || 0,
              loans: emp.deductions?.loans || 0,
              absence: emp.deductions?.absence || 0
            },
            // توحيد المكافآت/الخصومات الشهرية (إذا كانت موجودة)
            monthlyAdjustments: emp.monthlyAdjustments || { bonuses: [], deductions: [] }
          }
        })
        
        const pendingEmployees = (response.data || response).filter(emp => emp.approvalStatus === 'pending').map(emp => {
          console.log('⏳ معالجة موظف معلق:', emp.name, emp);
          return {
            ...emp,
            baseSalary: emp.salary || emp.baseSalary || emp.currentSalary || 0,
            allowances: emp.benefits ? {
              transport: emp.benefits.transportationAllowance || emp.allowances?.transportation || 0,
              food: emp.benefits.mealAllowance || emp.allowances?.meal || 0,
              housing: emp.benefits.housingAllowance || emp.allowances?.housing || 0,
              performance: emp.benefits.performanceAllowance || 0
            } : { 
              transport: emp.allowances?.transportation || 0, 
              food: emp.allowances?.meal || 0, 
              housing: emp.allowances?.housing || 0, 
              performance: 0 
            },
            deductions: {
              insurance: emp.deductions?.socialInsurance || emp.deductions?.insurance || 0,
              taxes: emp.deductions?.tax || emp.deductions?.taxes || 0,
              loans: emp.deductions?.loans || 0,
              absence: emp.deductions?.absence || 0
            },
            monthlyAdjustments: emp.monthlyAdjustments || { bonuses: [], deductions: [] }
          }
        })
        
        console.log('✅ الموظفين المعتمدين:', approvedEmployees);
        console.log('⏳ الموظفين المعلقين:', pendingEmployees);
        setEmployees(approvedEmployees);
        setPendingEmployees(pendingEmployees);
      } catch (error) {
        console.error('حدث خطأ أثناء جلب بيانات الموظفين');
        showError('حدث خطأ أثناء جلب بيانات الموظفين');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployees();
  }, [showError]);

  // حساب الراتب الحالي للموظف
  const calculateCurrentSalary = (employee) => {
    if (!employee) return 0
    
    const baseSalary = employee.baseSalary || 0
    const allowancesTotal = Object.values(employee.allowances || {}).reduce((sum, allowance) => sum + allowance, 0)
    const deductionsTotal = Object.values(employee.deductions || {}).reduce((sum, deduction) => sum + deduction, 0)
    const bonusesTotal = (employee.monthlyAdjustments?.bonuses || []).reduce((sum, bonus) => sum + bonus.amount, 0)
    const adjustmentDeductionsTotal = (employee.monthlyAdjustments?.deductions || []).reduce((sum, deduction) => sum + deduction.amount, 0)
    
    return baseSalary + allowancesTotal - deductionsTotal + bonusesTotal - adjustmentDeductionsTotal
  }

  // تصفية الموظفين حسب البحث
  const filteredEmployees = (employees || []).filter(employee =>
    employee && (
      employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  // تنسيق العملة بالأرقام الإنجليزية - الجنيه المصري
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0
    }).format(amount).replace('EGP', 'ج.م')
  }

  // إضافة موظف جديد
  const addEmployee = async (employeeData) => {
    try {
      console.log('🆕 إضافة موظف جديد:', employeeData);
      
      // إنشاء payload متوافق مع الباك اند
      const payload = {
        ...employeeData,
        // تأكد من وجود جميع الحقول المطلوبة
        benefits: {
          transportationAllowance: 0,
          mealAllowance: 0,
          housingAllowance: 0,
          medicalInsurance: true,
          lifeInsurance: true
        },
        allowances: {
          transportation: 0,
          meal: 0,
          housing: 0
        }
      };
      
      console.log('📤 إرسال البيانات للباك اند:', payload);
      const response = await employeeService.create(payload);
      console.log('✅ استجابة الباك اند:', response);
      
      // الموافقة التلقائية على الموظف الجديد
      if (response.data && response.data._id) {
        try {
          await employeeService.approve(response.data._id);
          console.log('✅ تم اعتماد الموظف تلقائياً');
        } catch (approvalError) {
          console.warn('⚠️ فشل في الاعتماد التلقائي:', approvalError);
        }
      }
      
              // إعادة جلب البيانات لضمان التحديث
        const fetchResponse = await employeeService.getAll({ approvalStatus: 'all' });
        const approvedEmployees = (fetchResponse.data || fetchResponse).filter(emp => emp.approvalStatus === 'approved').map(emp => {
          return {
            ...emp,
            baseSalary: emp.salary || emp.baseSalary || emp.currentSalary || 0,
            allowances: emp.benefits ? {
              transport: emp.benefits.transportationAllowance || emp.allowances?.transportation || 0,
              food: emp.benefits.mealAllowance || emp.allowances?.meal || 0,
              housing: emp.benefits.housingAllowance || emp.allowances?.housing || 0,
              performance: emp.benefits.performanceAllowance || 0
            } : { 
              transport: emp.allowances?.transportation || 0, 
              food: emp.allowances?.meal || 0, 
              housing: emp.allowances?.housing || 0, 
              performance: 0 
            },
            deductions: {
              insurance: emp.deductions?.socialInsurance || emp.deductions?.insurance || 0,
              taxes: emp.deductions?.tax || emp.deductions?.taxes || 0,
              loans: emp.deductions?.loans || 0,
              absence: emp.deductions?.absence || 0
            },
            monthlyAdjustments: emp.monthlyAdjustments || { bonuses: [], deductions: [] }
          }
        });
        
        const newPendingEmployees = (fetchResponse.data || fetchResponse).filter(emp => emp.approvalStatus === 'pending').map(emp => {
          return {
            ...emp,
            baseSalary: emp.salary || emp.baseSalary || emp.currentSalary || 0,
            allowances: emp.benefits ? {
              transport: emp.benefits.transportationAllowance || emp.allowances?.transportation || 0,
              food: emp.benefits.mealAllowance || emp.allowances?.meal || 0,
              housing: emp.benefits.housingAllowance || emp.allowances?.housing || 0,
              performance: emp.benefits.performanceAllowance || 0
            } : { 
              transport: emp.allowances?.transportation || 0, 
              food: emp.allowances?.meal || 0, 
              housing: emp.allowances?.housing || 0, 
              performance: 0 
            },
            deductions: {
              insurance: emp.deductions?.socialInsurance || emp.deductions?.insurance || 0,
              taxes: emp.deductions?.tax || emp.deductions?.taxes || 0,
              loans: emp.deductions?.loans || 0,
              absence: emp.deductions?.absence || 0
            },
            monthlyAdjustments: emp.monthlyAdjustments || { bonuses: [], deductions: [] }
          }
        });
        
        setEmployees(approvedEmployees);
        setPendingEmployees(newPendingEmployees);
      
      setShowAddModal(false);
      showSuccess('تم إضافة الموظف بنجاح وتم اعتماده');
    } catch (error) {
      console.error('❌ خطأ في إضافة الموظف:', error);
      showError(error.response?.data?.message || 'حدث خطأ أثناء إضافة الموظف');
    }
  };

  // حذف موظف
  const deleteEmployee = async (employeeId) => {
    try {
      await employeeService.delete(employeeId);
      setEmployees(employees.filter(emp => emp.id !== employeeId));
      showSuccess('تم حذف الموظف بنجاح');
    } catch (error) {
      showError('حدث خطأ أثناء حذف الموظف');
    }
  };

  // الموافقة على موظف معلق
  const approveEmployee = async (employeeId) => {
    try {
      console.log('✅ موافقة على موظف:', employeeId);
      await employeeService.approve(employeeId);
      
      // نقل الموظف من pending إلى approved
      const employeeToApprove = pendingEmployees.find(emp => emp._id === employeeId);
      if (employeeToApprove) {
        setEmployees([...employees, { ...employeeToApprove, approvalStatus: 'approved' }]);
        setPendingEmployees(pendingEmployees.filter(emp => emp._id !== employeeId));
      }
      
      showSuccess('تم الموافقة على الموظف بنجاح');
    } catch (error) {
      console.error('❌ خطأ في الموافقة:', error);
      showError('حدث خطأ أثناء الموافقة على الموظف');
    }
  };

  // رفض موظف معلق
  const rejectEmployee = async (employeeId, reason = 'لم يتم تقديم سبب') => {
    try {
      console.log('❌ رفض موظف:', employeeId, 'السبب:', reason);
      await employeeService.reject(employeeId, reason);
      
      // إزالة الموظف من قائمة المعلقين
      setPendingEmployees(pendingEmployees.filter(emp => emp._id !== employeeId));
      
      showSuccess('تم رفض الموظف');
    } catch (error) {
      console.error('❌ خطأ في الرفض:', error);
      showError('حدث خطأ أثناء رفض الموظف');
    }
  };

  const loadEmployeeForEdit = (employee) => {
    // setSelectedEmployee(employee)
    // setShowEditModal(true)
  }

  // دوال نظام الرسائل
  const openMessageModal = (employee, type = 'notification') => {
    setSelectedEmployeeForMessage(employee)
    setMessageType(type)
    setShowMessageModal(true)
    setMessageStatus(null)
    setMessageError('')
    setMessageSuccess('')
    generateMessageTemplate(employee, type)
  }

  // فتح popup اختيار نوع الرسالة
  const openMessageTypeModal = (employee) => {
    setSelectedEmployeeForMessage(employee)
    setShowMessageTypeModal(true)
  }

  const generateMessageTemplate = (employee, type) => {
    const currentDate = new Date().toLocaleDateString('en-US')
    const currentSalary = calculateCurrentSalary(employee)
    
    switch (type) {
      case 'salary':
        setMessageTemplate(`
📊 *كشف راتب شهر ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}*

السيد/ة: *${employee.name}*
المنصب: ${employee.position}
القسم: ${employee.department}

💰 *تفاصيل الراتب:*
• الراتب الأساسي: ${formatCurrency(employee.baseSalary)}
• البدلات: ${formatCurrency(Object.values(employee.allowances || {}).reduce((sum, allowance) => sum + allowance, 0))}
• الخصومات: ${formatCurrency(Object.values(employee.deductions || {}).reduce((sum, deduction) => sum + deduction, 0))}

💸 *إجمالي الراتب: ${formatCurrency(currentSalary)}*

📅 تاريخ الإستحقاق: ${currentDate}

شكراً لك على جهودك المبذولة 🙏
        `.trim())
        break
        
      case 'leave':
        setMessageTemplate(`
🏖️ *تحديث رصيد الإجازات*

عزيزي/عزيزتي: *${employee.name}*

📊 *تفاصيل رصيد الإجازات:*
• الرصيد المتاح: ${employee.attendance?.leaveBalance || 0} يوم
• الأيام المستخدمة: ${30 - (employee.attendance?.leaveBalance || 0)} يوم
• إجمالي الأيام السنوية: 30 يوم

📅 تاريخ التحديث: ${currentDate}

للاستفسار عن تقديم طلب إجازة، يرجى التواصل مع قسم الموارد البشرية.

نتمنى لك إجازة سعيدة! 🌟
        `.trim())
        break
        
      case 'notification':
        setMessageTemplate(`
🔔 *إشعار هام*

عزيزي/عزيزتي: *${employee.name}*
المنصب: ${employee.position}
القسم: ${employee.department}

يرجى العلم أنه...

[اكتب الإشعار هنا]

📅 التاريخ: ${currentDate}

شكراً لك على اهتمامك.
        `.trim())
        break
        
      case 'custom':
        setMessageTemplate(`
السلام عليكم ورحمة الله وبركاته

عزيزي/عزيزتي: *${employee.name}*

[اكتب رسالتك هنا]

مع تحيات إدارة الموارد البشرية 
📅 ${currentDate}
        `.trim())
        break
        
      default:
        setMessageTemplate('')
    }
  }

  const sendMessage = async () => {
    if (!selectedEmployeeForMessage || (!messageTemplate.trim() && !customMessage.trim())) {
      setMessageStatus('failed')
      setMessageError('يرجى التأكد من اختيار الموظف وكتابة الرسالة')
      return
    }

    setMessageStatus('sending')
    setMessageError('')
    setMessageSuccess('')
    setIsLoading(true)
    
    try {
      const phone = selectedEmployeeForMessage.phone
      const message = customMessage.trim() || messageTemplate
      
      const result = await WhatsAppService.sendMessage(phone, message)
      
      if (result.success) {
        setMessageStatus('success')
        setMessageSuccess(`تم إرسال الرسالة بنجاح إلى ${selectedEmployeeForMessage.name}`)
        showSuccess(`تم إرسال الرسالة بنجاح إلى ${selectedEmployeeForMessage.name}`)
        
        // إغلاق النافذة بعد 2 ثانية
        setTimeout(() => {
          setShowMessageModal(false)
          setCustomMessage('')
          setMessageTemplate('')
          setSelectedEmployeeForMessage(null)
          setMessageStatus(null)
          setMessageSuccess('')
        }, 2000)
      } else {
        setMessageStatus('failed')
        setMessageError(result.error || 'حدث خطأ غير معروف أثناء إرسال الرسالة')
        showError(`فشل في إرسال الرسالة: ${result.error || 'حدث خطأ غير معروف'}`)
      }
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error)
      setMessageStatus('failed')
      setMessageError(error.message || 'حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.')
      showError('حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendBulkMessage = async (employeeList, messageText) => {
    if (!employeeList.length || !messageText.trim()) {
      showError('يرجى التأكد من اختيار الموظفين وكتابة الرسالة')
      return
    }

    setIsLoading(true)
    try {
      const results = await Promise.all(
        employeeList.map(employee => 
          WhatsAppService.sendMessage(employee.phone, messageText)
        )
      )
      
      const successCount = results.filter(result => result.success).length
      const failCount = results.length - successCount
      
      if (successCount > 0) {
        showSuccess(`تم إرسال ${successCount} رسالة بنجاح`)
      }
      if (failCount > 0) {
        showWarning(`فشل في إرسال ${failCount} رسالة`)
      }
    } catch (error) {
      console.error('خطأ في إرسال الرسائل المجمعة:', error)
      showError('حدث خطأ أثناء إرسال الرسائل')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
    <div className="space-y-4 p-4 md:p-6">
      {/* العنوان والبحث */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة الموظفين</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة معلومات الموظفين ورواتبهم</p>
        </div>
        
        <div className="flex gap-3 items-center">
          <Input
            placeholder="البحث عن موظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                // إرسال رسالة جماعية لجميع الموظفين
                const allMessage = `
🔔 *رسالة جماعية لجميع الموظفين*

السلام عليكم ورحمة الله وبركاته

نود إعلامكم بأنه...

[اكتب الرسالة هنا]

شكراً لكم على اهتمامكم وتعاونكم.

مع تحيات إدارة الموارد البشرية
📅 ${new Date().toLocaleDateString('en-US')}
                `.trim()
                
                const confirmSend = window.confirm(`هل تريد إرسال رسالة جماعية لجميع الموظفين (${employees.length} موظف)؟`)
                if (confirmSend) {
                  const customBulkMessage = prompt('اكتب الرسالة الجماعية:', allMessage)
                  if (customBulkMessage) {
                    sendBulkMessage(employees, customBulkMessage)
                  }
                }
              }}
              className="bg-green-600 hover:bg-green-700"
              title="إرسال رسالة جماعية لجميع الموظفين"
            >
              <MessageCircle className="w-4 h-4 ml-2" />
              رسالة جماعية
            </Button>
          </div>
        </div>
      </div>

      {/* قسم الموظفين المعلقين */}
      {pendingEmployees.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-orange-700 dark:text-orange-300">
                    موظفين في انتظار الموافقة ({pendingEmployees.length})
                  </CardTitle>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    يحتاجون موافقة الإدارة للانضمام للنظام
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPendingSection(!showPendingSection)}
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300"
              >
                {showPendingSection ? 'إخفاء' : 'إظهار'}
              </Button>
            </div>
          </CardHeader>
          
          {showPendingSection && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-orange-200 dark:border-orange-700">
                      <th className="text-right p-4 font-semibold text-orange-700 dark:text-orange-300">الموظف</th>
                      <th className="text-right p-4 font-semibold text-orange-700 dark:text-orange-300">المنصب والقسم</th>
                      <th className="text-right p-4 font-semibold text-orange-700 dark:text-orange-300">معلومات الاتصال</th>
                      <th className="text-right p-4 font-semibold text-orange-700 dark:text-orange-300">تاريخ التقديم</th>
                      <th className="text-center p-4 font-semibold text-orange-700 dark:text-orange-300">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEmployees.map((employee, index) => (
                      <tr 
                        key={employee._id} 
                        className={`border-b border-orange-100 dark:border-orange-800 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors duration-200 ${
                          index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-orange-25 dark:bg-gray-800/50'
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {employee.name?.charAt(0)?.toUpperCase() || 'M'}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white text-base">{employee.name}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                معرف: EMP-{employee._id?.slice(-4)?.toUpperCase() || '0000'}
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{employee.position || 'غير محدد'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{employee.department || 'غير محدد'}</p>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-blue-600 dark:text-blue-400">{employee.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{employee.phone}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                            </span>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                              onClick={() => approveEmployee(employee._id)}
                              title="الموافقة على الموظف"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              موافقة
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                              onClick={() => {
                                const reason = prompt('سبب الرفض (اختياري):');
                                if (reason !== null) {
                                  rejectEmployee(employee._id, reason || 'لم يتم تقديم سبب');
                                }
                              }}
                              title="رفض الموظف"
                            >
                              <X className="w-4 h-4 mr-1" />
                              رفض
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">إجمالي الموظفين</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{employees.length}</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">موظف معتمد {pendingEmployees.length > 0 && `+ ${pendingEmployees.length} معلق`}</p>
              </div>
              <Users className="w-7 h-7 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">متوسط الراتب</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{employees.length > 0 ? formatCurrency(employees.reduce((sum, emp) => sum + calculateCurrentSalary(emp), 0) / employees.length) : '0'}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">شامل البدلات</p>
              </div>
              <DollarSign className="w-7 h-7 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">مكافآت الشهر</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">{employees.reduce((sum, emp) => sum + (emp.monthlyAdjustments?.bonuses?.reduce((b, bonus) => b + bonus.amount, 0) || 0), 0)} EGP</p>
              </div>
              <Gift className="w-7 h-7 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">إجمالي الرواتب</p>
                <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">{formatCurrency(employees.reduce((sum, emp) => sum + calculateCurrentSalary(emp), 0))}</p>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">صافي الرواتب</p>
              </div>
              <TrendingUp className="w-7 h-7 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول الموظفين */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold text-gray-900 dark:text-white">قائمة الموظفين ({filteredEmployees.length})</CardTitle>
          
          {/* أزرار الإرسال الجماعي */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const confirmSend = window.confirm(`هل تريد إرسال كشوف الرواتب لجميع الموظفين (${employees.length} موظف)؟`)
                if (confirmSend) {
                  setIsLoading(true)
                  try {
                    const results = await Promise.all(
                      employees.map(async (employee, index) => {
                        const currentDate = new Date().toLocaleDateString('en-US')
                        const currentSalary = calculateCurrentSalary(employee)
                        
                        const salaryMessage = `
📊 *كشف راتب شهر ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}*

السيد/ة: *${employee.name}*
المنصب: ${employee.position}
القسم: ${employee.department}

💰 *تفاصيل الراتب:*
• الراتب الأساسي: ${formatCurrency(employee.baseSalary)}
• البدلات: ${formatCurrency(Object.values(employee.allowances || {}).reduce((sum, allowance) => sum + allowance, 0))}
• الخصومات: ${formatCurrency(Object.values(employee.deductions || {}).reduce((sum, deduction) => sum + deduction, 0))}

💸 *إجمالي الراتب: ${formatCurrency(currentSalary)}*

📅 تاريخ الإستحقاق: ${currentDate}

شكراً لك على جهودك المبذولة 🙏
                        `.trim()
                        
                        // تأخير بسيط بين الرسائل لتجنب الإرسال السريع
                        await new Promise(resolve => setTimeout(resolve, index * 2000))
                        return WhatsAppService.sendMessage(employee.phone, salaryMessage)
                      })
                    )
                    
                    const successCount = results.filter(result => result.success).length
                    showSuccess(`تم إرسال ${successCount} كشف راتب بنجاح من أصل ${employees.length}`)
                  } catch (error) {
                    showError('حدث خطأ أثناء إرسال كشوف الرواتب')
                  } finally {
                    setIsLoading(false)
                  }
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
              title="إرسال كشوف الرواتب لجميع الموظفين"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
              ) : (
                <FileText className="w-4 h-4 mr-1" />
              )}
              {isLoading ? 'جاري الإرسال...' : 'كشوف رواتب جماعية'}
            </Button>
            
            <Button
              size="sm"
              onClick={async () => {
                const confirmSend = window.confirm(`هل تريد إرسال تحديث رصيد الإجازات لجميع الموظفين (${employees.length} موظف)؟`)
                if (confirmSend) {
                  setIsLoading(true)
                  try {
                    const results = await Promise.all(
                      employees.map(async (employee, index) => {
                        const currentDate = new Date().toLocaleDateString('en-US')
                        
                        const leaveMessage = `
🏖️ *تحديث رصيد الإجازات*

عزيزي/عزيزتي: *${employee.name}*

📊 *تفاصيل رصيد الإجازات:*
• الرصيد المتاح: ${employee.attendance?.leaveBalance || 0} يوم
• الأيام المستخدمة: ${30 - (employee.attendance?.leaveBalance || 0)} يوم
• إجمالي الأيام السنوية: 30 يوم

📅 تاريخ التحديث: ${currentDate}

للاستفسار عن تقديم طلب إجازة، يرجى التواصل مع قسم الموارد البشرية.

نتمنى لك إجازة سعيدة! 🌟
                        `.trim()
                        
                        // تأخير بسيط بين الرسائل
                        await new Promise(resolve => setTimeout(resolve, index * 2000))
                        return WhatsAppService.sendMessage(employee.phone, leaveMessage)
                      })
                    )
                    
                    const successCount = results.filter(result => result.success).length
                    showSuccess(`تم إرسال ${successCount} تحديث إجازات بنجاح من أصل ${employees.length}`)
                  } catch (error) {
                    showError('حدث خطأ أثناء إرسال تحديثات الإجازات')
                  } finally {
                    setIsLoading(false)
                  }
                }
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs"
              disabled={isLoading}
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              تحديث إجازات
            </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> إضافة موظف
                </Button>
              )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  {['الموظف','القسم','الراتب','الصافي',''].map((h,i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${i < 4 ? 'text-right' : 'text-center'} whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredEmployees.map((employee, index) => {
                  const allowancesTotal = Object.values(employee.allowances || {}).reduce((sum, a) => sum + a, 0)
                  const deductionsTotal = Object.values(employee.deductions || {}).reduce((sum, d) => sum + d, 0)
                  const netSalary = calculateCurrentSalary(employee)

                  return (
                    <tr key={employee.id || employee._id}
                      className={`group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                      onClick={() => navigate(`/employees/${employee.id || employee._id}`)}
                    >
                      {/* الموظف */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{employee.name?.charAt(0)}</div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{employee.name}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{employee.phone}</p>
                          </div>
                        </div>
                      </td>
                      {/* القسم */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{employee.position}</p>
                        <p className="text-[11px] text-gray-400">{employee.department}</p>
                      </td>
                      {/* الراتب */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-12">أساسي</span>
                            <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(employee.baseSalary)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-green-500 w-12">بدلات</span>
                            <span className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">+{formatCurrency(allowancesTotal)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-red-400 w-12">خصومات</span>
                            <span className="font-mono text-sm font-semibold text-red-500 dark:text-red-400">-{formatCurrency(deductionsTotal)}</span>
                          </div>
                        </div>
                      </td>
                      {/* الصافي */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-base text-green-600 dark:text-green-400 font-mono">{formatCurrency(netSalary)}</span>
                      </td>
                      {/* إجراءات */}
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => navigate(`/employees/${employee.id || employee._id}`)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" title="عرض"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => loadEmployeeForEdit(employee)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="تعديل"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => deleteEmployee(employee.id || employee._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="حذف"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {filteredEmployees.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Users className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد موظفين'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {searchTerm ? 
                `لم يتم العثور على موظفين يطابقون "${searchTerm}". جرب تعديل مصطلح البحث.` :
                'ابدأ بإضافة أول موظف في النظام لتتمكن من إدارة الموظفين وتتبع الرواتب.'
              }
            </p>
            {!searchTerm && isAdmin && (
              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                إضافة أول موظف
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* نافذة إرسال الرسائل */}
      {showMessageModal && selectedEmployeeForMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                إرسال رسالة WhatsApp إلى {selectedEmployeeForMessage.name}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowMessageModal(false)
                  setSelectedEmployeeForMessage(null)
                  setMessageTemplate('')
                  setCustomMessage('')
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* اختيار نوع الرسالة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نوع الرسالة
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant={messageType === 'salary' ? 'default' : 'outline'}
                    onClick={() => {
                      setMessageType('salary')
                      generateMessageTemplate(selectedEmployeeForMessage, 'salary')
                    }}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-xs">كشف راتب</span>
                  </Button>
                  
                  <Button
                    variant={messageType === 'leave' ? 'default' : 'outline'}
                    onClick={() => {
                      setMessageType('leave')
                      generateMessageTemplate(selectedEmployeeForMessage, 'leave')
                    }}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">رصيد الإجازات</span>
                  </Button>
                  
                  <Button
                    variant={messageType === 'notification' ? 'default' : 'outline'}
                    onClick={() => {
                      setMessageType('notification')
                      generateMessageTemplate(selectedEmployeeForMessage, 'notification')
                    }}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="text-xs">إشعار</span>
                  </Button>
                  
                  <Button
                    variant={messageType === 'custom' ? 'default' : 'outline'}
                    onClick={() => {
                      setMessageType('custom')
                      generateMessageTemplate(selectedEmployeeForMessage, 'custom')
                    }}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Send className="w-4 h-4" />
                    <span className="text-xs">رسالة مخصصة</span>
                  </Button>
                </div>
              </div>

              {/* معاينة القالب */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  معاينة القالب
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {messageTemplate}
                  </pre>
                </div>
              </div>

              {/* تخصيص الرسالة */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تعديل الرسالة (اختياري)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="اتركه فارغاً لاستخدام القالب الافتراضي أو اكتب رسالة مخصصة..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* معلومات الموظف */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  معلومات الموظف
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">الاسم:</span>
                    <span className="font-medium text-gray-900 dark:text-white mr-2">
                      {selectedEmployeeForMessage.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                    <span className="font-medium text-gray-900 dark:text-white mr-2">
                      {selectedEmployeeForMessage.phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">المنصب:</span>
                    <span className="font-medium text-gray-900 dark:text-white mr-2">
                      {selectedEmployeeForMessage.position}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">القسم:</span>
                    <span className="font-medium text-gray-900 dark:text-white mr-2">
                      {selectedEmployeeForMessage.department}
                    </span>
                  </div>
                </div>
              </div>

              {/* حالة الرسالة */}
              {messageStatus && (
                <div className={`p-4 rounded-lg border ${
                  messageStatus === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                  messageStatus === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                  'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {messageStatus === 'sending' && (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-blue-800 dark:text-blue-200 font-medium">جاري إرسال الرسالة...</span>
                      </>
                    )}
                    {messageStatus === 'success' && (
                      <>
                        <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-green-800 dark:text-green-200 font-medium">✅ {messageSuccess}</span>
                      </>
                    )}
                    {messageStatus === 'failed' && (
                      <>
                        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-red-800 dark:text-red-200 font-medium">❌ فشل في إرسال الرسالة</span>
                          <span className="text-red-600 dark:text-red-400 text-sm mt-1">السبب: {messageError}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMessageModal(false)
                    setSelectedEmployeeForMessage(null)
                    setMessageTemplate('')
                    setCustomMessage('')
                    setMessageStatus(null)
                    setMessageError('')
                    setMessageSuccess('')
                  }}
                  disabled={isLoading}
                >
                  إلغاء
                </Button>
                
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || (!messageTemplate.trim() && !customMessage.trim()) || messageStatus === 'success'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      جاري الإرسال...
                    </>
                  ) : messageStatus === 'success' ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      تم الإرسال بنجاح
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      إرسال الرسالة
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة اختيار نوع الرسالة */}
      {showMessageTypeModal && selectedEmployeeForMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                إرسال رسالة WhatsApp
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                إلى: <span className="font-semibold text-gray-900 dark:text-white">{selectedEmployeeForMessage.name}</span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedEmployeeForMessage.position} - {selectedEmployeeForMessage.department}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-6">
                اختر نوع الرسالة
              </h4>
              
              <div className="grid grid-cols-1 gap-4">
                {/* كشف راتب */}
                <button
                  onClick={() => {
                    openMessageModal(selectedEmployeeForMessage, 'salary')
                    setShowMessageTypeModal(false)
                  }}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right flex-1">
                    <h5 className="font-semibold text-gray-900 dark:text-white">كشف راتب</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">إرسال تفاصيل الراتب الشهري</p>
                  </div>
                  <div className="text-blue-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* رصيد الإجازات */}
                <button
                  onClick={() => {
                    openMessageModal(selectedEmployeeForMessage, 'leave')
                    setShowMessageTypeModal(false)
                  }}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl hover:from-yellow-100 hover:to-orange-100 dark:hover:from-yellow-900/30 dark:hover:to-orange-900/30 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right flex-1">
                    <h5 className="font-semibold text-gray-900 dark:text-white">رصيد الإجازات</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">إرسال تحديث الإجازات المتاحة</p>
                  </div>
                  <div className="text-yellow-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* إشعار */}
                <button
                  onClick={() => {
                    openMessageModal(selectedEmployeeForMessage, 'notification')
                    setShowMessageTypeModal(false)
                  }}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right flex-1">
                    <h5 className="font-semibold text-gray-900 dark:text-white">إشعار هام</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">إرسال إشعار عام أو تنبيه</p>
                  </div>
                  <div className="text-purple-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* رسالة مخصصة */}
                <button
                  onClick={() => {
                    openMessageModal(selectedEmployeeForMessage, 'custom')
                    setShowMessageTypeModal(false)
                  }}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl hover:from-green-100 hover:to-teal-100 dark:hover:from-green-900/30 dark:hover:to-teal-900/30 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right flex-1">
                    <h5 className="font-semibold text-gray-900 dark:text-white">رسالة مخصصة</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">كتابة رسالة حرة ومخصصة</p>
                  </div>
                  <div className="text-green-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* زر إلغاء */}
              <div className="pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMessageTypeModal(false)
                    setSelectedEmployeeForMessage(null)
                  }}
                  className="w-full"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4 text-center">إضافة موظف جديد</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target;
                  const employeeData = {
                    name: form.name.value,
                    email: form.email.value,
                    phone: form.phone.value.startsWith('20') ? form.phone.value : `20${form.phone.value}`,
                    department: form.department.value,
                    position: form.position.value,
                    baseSalary: Number(form.baseSalary.value) || 0,
                    nationalId: form.nationalId.value,
                    status: 'نشط',
                    startDate: new Date().toISOString().split('T')[0],
                  };
                  await addEmployee(employeeData);
                }}
                className="space-y-4"
              >
                <input name="name" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="الاسم" required />
                <input name="email" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="البريد الإلكتروني" required type="email" />
                <input name="phone" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="رقم الهاتف (01xxxxxxxxx)" required />
                <input name="nationalId" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="الرقم القومي (14 رقم)" required pattern="[0-9]{14}" />
                <input name="department" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="القسم" required />
                <input name="position" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="المنصب" required />
                <input name="baseSalary" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="الراتب الأساسي" type="number" min="0" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                    إضافة
                  </Button>
    </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default EmployeesPage 