import React, { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useParams,
} from "react-router-dom";
import Layout from "./components/Layout";
import { NotificationProvider } from "./components/NotificationSystem";
import { ThemeProvider } from "./contexts/ThemeContext";
import ApprovalsPage from "./pages/ApprovalsPage";
import CategoriesPage from "./pages/CategoriesPage";
import ClientDetailsPage from "./pages/ClientDetailsPage";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import EmployeeDetailsPage from "./pages/EmployeeDetailsPage";
import EmployeesListPage from "./pages/EmployeesListPage";
import EmployeesPage from "./pages/EmployeesPage";
import LoginPage from "./pages/LoginPage";
import MePage from "./pages/MePage";
import PayrollPage from "./pages/PayrollPage";
import SignUpPage from "./pages/SignUpPage";
import TransactionsPage from "./pages/TransactionsPage";

import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import SettingsPage from "./pages/SettingsPage";
import SystemLogsPage from "./pages/SystemLogsPage";
import WhatsAppConnectionPage from "./pages/WhatsAppConnectionPage";
import WhatsAppDashboard from "./pages/WhatsAppDashboard";

// مكون لإعادة توجيه صفحة الموظف للتبويب الافتراضي
const EmployeeRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/employees/${id}/overview`} replace />;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (token && savedUser) {
          try {
            // التحقق من صحة بيانات المستخدم المحفوظة
            const userData = JSON.parse(savedUser);
            if (!userData.id || !userData.username || !userData.role) {
              throw new Error("بيانات المستخدم غير مكتملة");
            }

            // استعادة بيانات المستخدم بدون التحقق من الخادم لتجنب مشاكل الاتصال
            setUser(userData);
            console.log("تم استعادة بيانات المستخدم من التخزين المحلي");

            // التحقق من صحة التوكن مع الخادم في الخلفية (اختياري)
            try {
              const response = await fetch(
                process.env.REACT_APP_API_URL + "/auth/verify",
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                  timeout: 3000,
                }
              );

              if (!response.ok) {
                console.log("تحذير: التوكن قد يكون منتهي الصلاحية");
                // لا نحذف البيانات هنا، نتركها للمستخدم ليقرر
              }
            } catch (networkError) {
              console.log(
                "لا يمكن التحقق من التوكن حالياً - ربما الخادم غير متاح"
              );
              // نحتفظ بالبيانات المحلية
            }
          } catch (error) {
            console.error("خطأ في تحليل بيانات المستخدم:", error);
            // في حالة فشل تحليل البيانات، احذفها
            localStorage.removeItem("user");
            localStorage.removeItem("token");
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // لا نحذف البيانات إلا في حالة أخطاء حرجة
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      // await authService.logout() // تم تعطيلها مؤقتاً لتجنب التحذيرات
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              جاري التحميل...
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
              v7_fetcherPersist: true,
              v7_normalizeFormMethod: true,
              v7_partialHydration: true,
              v7_skipActionErrorRevalidation: true,
            }}
          >
            <Routes>
              {/* صفحة تسجيل الدخول */}
              <Route
                path="/login"
                element={
                  user ? (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me"}
                      replace
                    />
                  ) : (
                    <LoginPage onLogin={handleLogin} />
                  )
                }
              />

              {/* صفحة إنشاء حساب جديد */}
              <Route
                path="/signup"
                element={
                  user ? (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me"}
                      replace
                    />
                  ) : (
                    <SignUpPage
                      onSignUp={(userData) => {
                        // يمكن إضافة منطق إضافي هنا
                        console.log("تم إنشاء حساب جديد:", userData);
                      }}
                    />
                  )
                }
              />

              {/* الصفحة الرئيسية */}
              <Route
                path="/"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <DashboardPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* المعاملات المالية */}
              <Route
                path="/transactions"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <TransactionsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* موافقات المعاملات المالية */}
              <Route
                path="/approvals"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <ApprovalsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* الموظفين */}
              <Route
                path="/employees"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeesPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* تفاصيل الموظف - إعادة توجيه للتبويب الافتراضي */}
              <Route
                path="/employees/:id"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <EmployeeRedirect />
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* تبويبات تفاصيل الموظف */}
              <Route
                path="/employees/:id/overview"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              <Route
                path="/employees/:id/desktop-tracking"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              <Route
                path="/employees/:id/attendance"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              <Route
                path="/employees/:id/performance"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              <Route
                path="/employees/:id/documents"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              <Route
                path="/employees/:id/requests"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* العملاء */}
              <Route
                path="/clients"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <ClientsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* تفاصيل العميل */}
              <Route
                path="/clients/:clientId"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <ClientDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* الرواتب */}
              <Route
                path="/payroll"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <PayrollPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* التصنيفات */}
              <Route
                path="/categories"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <CategoriesPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* لوحة تحكم الواتساب */}
              <Route
                path="/whatsapp"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <WhatsAppDashboard />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة ربط WhatsApp */}
              <Route
                path="/whatsapp/connect"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <WhatsAppConnectionPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة الإعدادات */}
              <Route
                path="/settings"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <SettingsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة سجلات النظام */}
              <Route
                path="/logs"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <SystemLogsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة الملف الشخصي */}
              <Route
                path="/me"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Navigate to="/me/overview" replace />
                  )
                }
              />

              {/* صفحات الملف الشخصي المنفصلة */}
              <Route
                path="/me/overview"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="overview" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/desktop-tracking"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="desktop-tracking" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/salary"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="salary" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/attendance"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="attendance" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/performance"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="performance" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/documents"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="documents" />
                    </Layout>
                  )
                }
              />

              <Route
                path="/me/requests"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <MePage user={user} activeSection="requests" />
                    </Layout>
                  )
                }
              />

              {/* صفحة دليل الموظفين */}
              <Route
                path="/employees-list"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeesListPage />
                    </Layout>
                  )
                }
              />

              {/* إعادة توجيه الموظف للتبويب الافتراضي */}
              <Route
                path="/employees/:id"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <EmployeeRedirect />
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة تفاصيل الموظف مع التبويبات */}
              <Route
                path="/employees/:employeeId/:section"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : user.role === "admin" ? (
                    <Layout user={user} onLogout={handleLogout}>
                      <EmployeeDetailsPage />
                    </Layout>
                  ) : (
                    <Navigate
                      to={user.role === "admin" ? "/" : "/me/overview"}
                      replace
                    />
                  )
                }
              />

              {/* صفحة 404 */}
              <Route
                path="*"
                element={
                  !user ? (
                    <Navigate to="/login" replace />
                  ) : (
                    <Layout user={user} onLogout={handleLogout}>
                      <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                          404 - الصفحة غير موجودة
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300">
                          عذراً، الصفحة التي تبحث عنها غير موجودة.
                        </p>
                      </div>
                    </Layout>
                  )
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
