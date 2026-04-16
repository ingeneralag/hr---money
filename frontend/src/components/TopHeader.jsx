import React, { useState, useEffect } from 'react'
import { Bell, Search, Settings, LogOut, User, ChevronDown, Sun, Moon } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from '../contexts/ThemeContext'

const TopHeader = ({ user, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const { isDarkMode, toggleTheme } = useTheme()

  // تحديث الوقت كل دقيقة
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // تحميل بيانات المستخدم
  useEffect(() => {
    if (user) {
      setCurrentUser(user)
    }

    // إشعارات تجريبية
    setNotifications([
      {
        id: 1,
        title: 'راتب جديد',
        message: 'تم إضافة راتب أحمد محمد بنجاح',
        time: '5 دقائق',
        type: 'success',
        read: false
      },
      {
        id: 2,
        title: 'موظف جديد',
        message: 'انضم موظف جديد للفريق',
        time: '10 دقائق',
        type: 'info',
        read: false
      },
      {
        id: 3,
        title: 'تذكير',
        message: 'موعد مراجعة الرواتب اليوم',
        time: '30 دقيقة',
        type: 'warning',
        read: true
      }
    ])
  }, [user])

  const handleLogout = () => {
    if (onLogout) {
      localStorage.removeItem('user')
      onLogout()
    }
  }

  const handleLogin = () => {
    window.location.href = '/login'
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="top-header bg-gradient-to-r from-white via-blue-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg backdrop-blur-sm relative z-[100]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          
          {/* اليسار - Logo والاسم */}
          <div className="flex items-center space-x-2 sm:space-x-4 rtl:space-x-reverse">
            <div className="flex items-center space-x-2 sm:space-x-3 rtl:space-x-reverse">
              <div className="logo w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-lg">HR</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  نظام إدارة الموارد البشرية
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
                  Human Resources Management System
                </p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  نظام HR
                </h1>
              </div>
            </div>
          </div>

          {/* الوسط - البحث والوقت */}
          <div className="hidden lg:flex items-center space-x-4 xl:space-x-6 rtl:space-x-reverse">
            {/* البحث */}
            <div className="relative group">
              <Search className="absolute right-3 rtl:left-3 rtl:right-auto top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 w-4 h-4 transition-colors" />
              <input
                type="text"
                placeholder="البحث في النظام..."
                className="search-input pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white w-48 xl:w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300"
              />
            </div>

            {/* الوقت والتاريخ */}
            <div className="text-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 px-3 py-2 rounded-xl shadow-sm">
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-300 hidden xl:block">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>

          {/* اليمين - الإشعارات والمستخدم */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 rtl:space-x-reverse">
            
            {/* تبديل الوضع المظلم */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title={isDarkMode ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع المظلم'}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-gradient-to-br hover:from-yellow-50 hover:to-orange-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 hover:text-yellow-600" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 hover:text-blue-600" />
              )}
            </Button>

            {/* الإشعارات */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                className="notification-bell p-1.5 sm:p-2 relative rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" />
                {unreadCount > 0 && (
                  <span className="notification-badge absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-lg animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Button>

              {/* قائمة الإشعارات */}
              {showNotifications && (
                <div className="dropdown-menu absolute left-0 rtl:right-0 rtl:left-auto mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">الإشعارات</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                          !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {notification.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 text-center">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                      عرض جميع الإشعارات
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* المستخدم */}
            {currentUser ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-1 sm:space-x-2 rtl:space-x-reverse p-1.5 sm:p-2 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-300"
                >
                  <div className="user-avatar w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-400 via-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                    <span className="text-white text-xs sm:text-sm font-bold">
                      {currentUser.username?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden lg:block text-right rtl:text-left">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {currentUser.username}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {currentUser.role === 'admin' ? 'مدير النظام' : 'موظف'}
                    </div>
                  </div>
                  <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                </Button>

                {/* قائمة المستخدم */}
                {showUserMenu && (
                  <div className="absolute left-0 rtl:right-0 rtl:left-auto mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start rtl:justify-end text-right rtl:text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => window.location.href = '/me/overview'}
                      >
                        <User className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
                        الملف الشخصي
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start rtl:justify-end text-right rtl:text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => window.location.href = '/settings'}
                      >
                        <Settings className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
                        الإعدادات
                      </Button>
                      <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                      <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full justify-start rtl:justify-end text-right rtl:text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="w-4 h-4 ml-2 rtl:mr-2 rtl:ml-0" />
                        تسجيل الخروج
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={handleLogin} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                تسجيل الدخول
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TopHeader 