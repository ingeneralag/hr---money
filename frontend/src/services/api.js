import axios from "axios";

// استخدام الـ URL المباشر للـ backend
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001/api";

// إنشاء instance للـ API
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// إضافة interceptor للتوكن
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // إضافة التوكن حتى لو لم يكن متاحاً للسماح بالطلبات العامة
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// إضافة interceptor للتعامل مع الأخطاء
api.interceptors.response.use(
  (response) => {
    // تحقق من وجود البيانات في الاستجابة
    if (!response.data) {
      console.warn("الاستجابة لا تحتوي على بيانات");
    }
    return response;
  },
  (error) => {
    console.error("خطأ في استجابة API:", error);

    if (error.response) {
      // تم استلام استجابة من الخادم مع رمز حالة خطأ
      console.error("بيانات الخطأ:", error.response.data);
      console.error("رمز الحالة:", error.response.status);

      if (error.response.status === 401) {
        console.warn("تحذير: التوكن غير صالح أو منتهي الصلاحية");

        // إذا كانت الصفحة الحالية ليست صفحة تسجيل الدخول، أعد التوجيه
        if (
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/"
        ) {
          console.log(
            "🔄 إعادة توجيه لصفحة تسجيل الدخول بسبب انتهاء صلاحية التوكن"
          );
          // حذف البيانات المحفوظة
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          // إعادة التوجيه لصفحة تسجيل الدخول
          window.location.href = "/login?expired=true";
        }
      }
    } else if (error.request) {
      // تم إرسال الطلب ولكن لم يتم استلام استجابة
      console.error("لم يتم استلام استجابة:", error.request);
    } else {
      // حدث خطأ أثناء إعداد الطلب
      console.error("خطأ في إعداد الطلب:", error.message);
    }

    return Promise.reject(error);
  }
);

// خدمات المصادقة
export const authService = {
  login: async (username, password) => {
    try {
      console.log("🔐 authService.login called with:", { username });

      // استخدام fetch مباشرة للتأكد من عدم وجود مشاكل مع axios
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ Login failed:", errorData);
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      console.log("✅ Login successful:", data);

      if (data.success && data.data && data.data.token) {
        localStorage.setItem("token", data.data.token);
        localStorage.setItem(
          "user",
          JSON.stringify(data.data.user || { username, role: "admin" })
        );
      }

      return data;
    } catch (error) {
      console.error("🚨 authService error:", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("token");
  },

  register: async (userData) => {
    try {
      console.log("📝 authService.register called with:", userData);

      // استخدام fetch مباشرة للتأكد من عدم وجود مشاكل مع axios
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ Registration failed:", errorData);
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      console.log("✅ Registration successful:", data);

      return data;
    } catch (error) {
      console.error("🚨 authService register error:", error);
      throw error;
    }
  },
};

// خدمات الموظفين
export const employeeService = {
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] && filters[key] !== "all") {
          params.append(key, filters[key]);
        }
      });

      const response = await api.get(`/employees?${params}`);
      return response.data;
    } catch (error) {
      console.warn(
        "⚠️ خطأ في جلب بيانات الموظفين، استخدام البيانات النموذجية:",
        error.message
      );

      // بيانات احتياطية في حالة فشل الاتصال
      return {
        success: true,
        data: [
          {
            _id: "507f1f77bcf86cd799439011",
            name: "أحمد محمد علي",
            position: "مطور برمجيات",
            department: "تقنية المعلومات",
            phone: "+201234567890",
            email: "ahmed.mohamed@company.com",
            hireDate: "2022-01-15",
            baseSalary: 8000,
            status: "active",
            allowances: {
              transportation: 500,
              housing: 1000,
              food: 300,
            },
            workingHours: 8.5,
          },
          {
            _id: "507f1f77bcf86cd799439012",
            name: "فاطمة حسن محمود",
            position: "محاسبة",
            department: "المالية",
            phone: "+201987654321",
            email: "fatma.hassan@company.com",
            hireDate: "2021-03-10",
            baseSalary: 7000,
            status: "active",
            allowances: {
              transportation: 400,
              housing: 800,
              food: 250,
            },
            workingHours: 8,
          },
          {
            _id: "507f1f77bcf86cd799439013",
            name: "كريم البحراوي",
            position: "مصمم جرافيك",
            department: "التسويق",
            phone: "+201016772118",
            email: "kareem.bahrawi@company.com",
            hireDate: "2023-09-15",
            baseSalary: 6500,
            status: "active",
            allowances: {
              transportation: 400,
              housing: 700,
              food: 250,
            },
            workingHours: 7.5,
          },
        ],
        message: "بيانات تجريبية - قاعدة البيانات غير متاحة",
        pagination: {
          total: 3,
          page: 1,
          limit: 10000,
          pages: 1,
        },
      };
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/employees/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  create: async (employeeData) => {
    try {
      const response = await api.post("/employees", employeeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  update: async (id, employeeData) => {
    try {
      const response = await api.put(`/employees/${id}`, employeeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/employees/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Salary Calculation Services
  getCurrentSalary: async (id) => {
    try {
      const response = await api.get(`/employees/${id}/current-salary`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getSalaryForMonth: async (id, month) => {
    try {
      const response = await api.get(`/employees/${id}/salary/${month}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updateSalaryCalculation: async (id, month) => {
    try {
      const response = await api.put(`/employees/${id}/salary/${month}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Bonus and Deduction Services
  addBonus: async (id, bonusData) => {
    try {
      const response = await api.post(`/employees/${id}/bonus`, bonusData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  addDeduction: async (id, deductionData) => {
    try {
      const response = await api.post(
        `/employees/${id}/deduction`,
        deductionData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getSalaryData: async (id, month) => {
    try {
      const response = await api.get(`/employees/${id}/salary/${month}`);
      // تحقق من وجود البيانات وإرجاعها مع تنسيق صحيح
      if (
        response.data &&
        response.data.data &&
        response.data.data.salaryCalculation
      ) {
        const salary = response.data.data.salaryCalculation;
        return {
          success: true,
          data: {
            bonuses: salary.bonusesBreakdown || [],
            deductions: salary.deductionsBreakdown?.adjustments || [],
            baseSalary: salary.baseSalary || 0,
            totalBonuses: salary.bonusesTotal || 0,
            totalDeductions: salary.deductionsTotal || 0,
            netSalary: salary.netSalary || 0,
            salaryCalculation: salary,
          },
        };
      }
      return response.data;
    } catch (error) {
      console.error("خطأ في جلب بيانات الراتب:", error);
      throw error.response?.data || error;
    }
  },

  deleteBonus: async (id, bonusId) => {
    try {
      const response = await api.delete(`/employees/${id}/bonus/${bonusId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  deleteDeduction: async (id, deductionId) => {
    try {
      const response = await api.delete(
        `/employees/${id}/deduction/${deductionId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  removeAdjustment: async (id, adjustmentId) => {
    try {
      const response = await api.delete(
        `/employees/${id}/adjustment/${adjustmentId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Payment Services
  processPayment: async (id, paymentData) => {
    try {
      const response = await api.post(`/employees/${id}/payment`, paymentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Remove payment
  removePayment: async (id, paymentId) => {
    try {
      const response = await api.delete(
        `/employees/${id}/payment/${paymentId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get payment history for specific month
  getPaymentHistory: async (month) => {
    try {
      const response = await api.get(
        `/employees/payment-history/${month || ""}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Calculate monthly payment details
  calculateMonthlyPayment: async (id, month) => {
    try {
      const response = await api.get(
        `/employees/${id}/monthly-payment/${month}`
      );
      return response.data;
    } catch (error) {
      // Return default structure if API fails
      throw error.response?.data || error;
    }
  },

  // Legacy support (deprecated)
  updatePayment: async (id, paymentData) => {
    try {
      const response = await api.put(`/employees/${id}/payment`, paymentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Employee management
  approve: async (id) => {
    try {
      const response = await api.put(`/employees/${id}/approve`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  reject: async (id, rejectionReason) => {
    try {
      const response = await api.put(`/employees/${id}/reject`, {
        rejectionReason,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

// خدمات المعاملات
export const transactionService = {
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] && filters[key] !== "all") {
          params.append(key, filters[key]);
        }
      });

      const response = await api.get(`/transactions?${params}`);
      return response.data;
    } catch (error) {
      console.warn(
        "⚠️ خطأ في جلب بيانات المعاملات، استخدام البيانات النموذجية:",
        error.message
      );

      // بيانات احتياطية في حالة فشل الاتصال
      const sampleTransactions = [
        {
          _id: "507f1f77bcf86cd799439021",
          description: "إيرادات مشروع ABC",
          amount: 25000,
          type: "income",
          category: "مشاريع",
          date: "2024-06-10",
          reference: "PRJ-2024-001",
          status: "completed",
          notes: "دفعة أولى من مشروع تطوير الموقع",
          createdBy: "أحمد محمد",
          approvedBy: "مدير المشاريع",
        },
        {
          _id: "507f1f77bcf86cd799439022",
          description: "راتب شهر يونيو - أحمد محمد",
          amount: 8500,
          type: "expense",
          category: "رواتب",
          date: "2024-06-01",
          reference: "SAL-2024-001",
          status: "completed",
          notes: "راتب شهر يونيو مع العلاوات",
          createdBy: "نظام الرواتب",
          approvedBy: "مدير الموارد البشرية",
        },
        {
          _id: "507f1f77bcf86cd799439023",
          description: "فاتورة إنترنت ومكالمات",
          amount: 2500,
          type: "expense",
          category: "مرافق",
          date: "2024-06-05",
          reference: "UTL-2024-001",
          status: "completed",
          notes: "فواتير الاتصالات لشهر مايو",
          createdBy: "الإدارة",
          approvedBy: "المدير المالي",
        },
        {
          _id: "507f1f77bcf86cd799439024",
          description: "عمولة مبيعات - فاطمة",
          amount: 3500,
          type: "expense",
          category: "عمولات",
          date: "2024-06-08",
          reference: "COM-2024-001",
          status: "pending",
          notes: "عمولة على المبيعات الشهرية",
          createdBy: "قسم المبيعات",
          approvedBy: "-",
        },
      ];

      const totalIncome = sampleTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = sampleTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        success: true,
        data: sampleTransactions,
        message: "بيانات تجريبية - قاعدة البيانات غير متاحة",
        summary: {
          totalIncome,
          totalExpense,
          netAmount: totalIncome - totalExpense,
        },
        pagination: {
          total: sampleTransactions.length,
          page: 1,
          limit: 10000,
          pages: 1,
        },
      };
    }
  },

  create: async (transactionData) => {
    try {
      const response = await api.post("/transactions", transactionData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getById: async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  update: async (id, transactionData) => {
    try {
      console.log("🔄 Updating transaction:", { id, data: transactionData });
      const response = await api.put(`/transactions/${id}`, transactionData);
      console.log("✅ Transaction update response:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Transaction update error:", error);
      throw error.response?.data || error;
    }
  },

  delete: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
};

// خدمات الرواتب
export const payrollService = {
  // جلب كشف الرواتب
  getAll: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/payroll?${queryString}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching payroll:", error);
      throw error;
    }
  },

  // جلب كشف راتب موظف معين
  getByEmployeeId: async (employeeId, month) => {
    try {
      const response = await api.get(`/payroll/${employeeId}`, {
        params: month ? { month } : {},
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // إنشاء كشف راتب
  generate: async (data) => {
    try {
      const response = await api.post("/payroll/generate", data);
      return response.data;
    } catch (error) {
      console.error("Error generating payroll:", error);
      throw error;
    }
  },

  // دفع راتب موظف
  payEmployee: async (employeeId, data) => {
    try {
      const response = await api.post(`/payroll/${employeeId}/pay`, data);
      return response.data;
    } catch (error) {
      console.error("Error paying employee:", error);
      throw error;
    }
  },

  // دفع جزئي
  partialPay: async (employeeId, data) => {
    try {
      const response = await api.post(
        `/payroll/${employeeId}/partial-pay`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error processing partial payment:", error);
      throw error;
    }
  },

  // حذف دفعة جزئية
  removePartialPayment: async (employeeId, paymentId, month) => {
    try {
      const queryString = month ? `?month=${month}` : "";
      const response = await api.delete(
        `/payroll/${employeeId}/partial-payments/${paymentId}${queryString}`
      );
      return response.data;
    } catch (error) {
      console.error("Error removing partial payment:", error);
      throw error;
    }
  },

  // إضافة مكافأة أو خصم
  addAdjustment: async (employeeId, data) => {
    try {
      const response = await api.put(
        `/payroll/${employeeId}/adjustments`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error adding adjustment:", error);
      throw error;
    }
  },

  // حذف مكافأة أو خصم
  removeAdjustment: async (employeeId, adjustmentId, type, month) => {
    try {
      const queryString = new URLSearchParams({
        type,
        ...(month && { month }),
      }).toString();
      const response = await api.delete(
        `/payroll/${employeeId}/adjustments/${adjustmentId}?${queryString}`
      );
      return response.data;
    } catch (error) {
      console.error("Error removing adjustment:", error);
      throw error;
    }
  },

  // جلب تفاصيل راتب موظف
  getEmployeePayroll: async (employeeId, month) => {
    try {
      const queryString = month ? `?month=${month}` : "";
      const response = await api.get(`/payroll/${employeeId}${queryString}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching employee payroll:", error);
      throw error;
    }
  },

  // جلب إحصائيات الرواتب
  getStats: async (month) => {
    try {
      const queryString = month ? `?month=${month}` : "";
      const response = await api.get(`/payroll/stats/summary${queryString}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching payroll stats:", error);
      throw error;
    }
  },
};

// خدمات العملاء
export const clientService = {
  getAll: async (params) => {
    const response = await api.get("/clients", { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  create: async (clientData) => {
    const response = await api.post("/clients", clientData);
    return response.data;
  },
  update: async (id, clientData) => {
    const response = await api.put(`/clients/${id}`, clientData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
  getDetails: async (id) => {
    const response = await api.get(`/clients/${id}/details`);
    return response.data;
  },
  getFiles: async (id) => {
    const response = await api.get(`/clients/${id}/files`);
    return response.data;
  },
  uploadFile: async (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/clients/${id}/files`, formData);
    return response.data;
  },
  deleteFile: async (id, fileId) => {
    const response = await api.delete(`/clients/${id}/files/${fileId}`);
    return response.data;
  },
  getMessages: async (id) => {
    const response = await api.get(`/clients/${id}/messages`);
    return response.data;
  },
  sendMessage: async (id, message) => {
    const response = await api.post(`/clients/${id}/messages`, { message });
    return response.data;
  },
};

// خدمات السجلات
export const logService = {
  getAll: async (filters = {}) => {
    const response = await api.get("/logs", { params: filters });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get("/logs/stats");
    return response.data;
  },
  clear: async () => {
    const response = await api.delete("/logs/clear");
    return response.data;
  },
  export: async (format = "json") => {
    const response = await api.get(`/logs/export?format=${format}`, {
      responseType: "blob",
    });
    return response.data;
  },
};

// خدمات الإعدادات
export const settingsService = {
  get: async () => {
    const response = await api.get("/settings");
    return response.data;
  },
  update: async (data) => {
    const response = await api.put("/settings", data);
    return response.data;
  },
  updateNotifications: async (settings) => {
    const response = await api.put("/settings/notifications", settings);
    return response.data;
  },
  updateSecurity: async (settings) => {
    const response = await api.put("/settings/security", settings);
    return response.data;
  },
  updateCompany: async (data) => {
    const response = await api.put("/settings/company", data);
    return response.data;
  },
  updatePersonal: async (data) => {
    const response = await api.put("/settings/personal", data);
    return response.data;
  },
};

// خدمات الفئات
export const categoryService = {
  getAll: async () => {
    const response = await api.get("/categories");
    return response.data;
  },
  create: async (categoryData) => {
    const response = await api.post("/categories", categoryData);
    return response.data;
  },
  update: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};

// خدمات المستخدم الشخصي
export const userService = {
  getProfile: async () => {
    const response = await api.get("/users/me");
    return response.data;
  },
  updateProfile: async (userData) => {
    const response = await api.put("/users/me", userData);
    return response.data;
  },
  updatePassword: async (currentPassword, newPassword) => {
    const response = await api.put("/users/me/password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
  updateAvatar: async (avatarFile) => {
    const formData = new FormData();
    formData.append("avatar", avatarFile);
    const response = await api.put("/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  getDocuments: async () => {
    const response = await api.get("/users/me/documents");
    return response.data;
  },
  uploadDocument: async (documentFile, type) => {
    const formData = new FormData();
    formData.append("document", documentFile);
    formData.append("type", type);
    const response = await api.post("/users/me/documents", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  deleteDocument: async (documentId) => {
    const response = await api.delete(`/users/me/documents/${documentId}`);
    return response.data;
  },
  getRequests: async () => {
    const response = await api.get("/users/me/requests");
    return response.data;
  },
  createRequest: async (requestData) => {
    const response = await api.post("/users/me/requests", requestData);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get("/users/me/notifications");
    return response.data;
  },
  markNotificationAsRead: async (notificationId) => {
    const response = await api.put(
      `/users/me/notifications/${notificationId}/read`
    );
    return response.data;
  },
};

// خدمة الفواتير
export const invoiceService = {
  getAll: async (filters = {}) => {
    const response = await api.get("/invoices", { params: filters });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/invoices", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/invoices/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get("/invoices/stats");
    return response.data;
  },
};

// Dashboard Service
export const dashboardService = {
  getStats: async () => {
    try {
      const response = await api.get("/dashboard/stats");
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getRecentActivity: async () => {
    try {
      const response = await api.get("/dashboard/recent-activity");
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

// Helper functions for salary calculations
export const salaryHelpers = {
  // Calculate total salary with all components
  calculateNetSalary: (salaryData) => {
    const baseSalary = salaryData.baseSalary || 0;
    const allowancesTotal = salaryData.allowancesTotal || 0;
    const bonusesTotal = salaryData.bonusesTotal || 0;
    const deductionsTotal = salaryData.deductionsTotal || 0;

    return baseSalary + allowancesTotal + bonusesTotal - deductionsTotal;
  },

  // Format currency for display
  formatCurrency: (amount) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  },

  // Calculate remaining amount after payments
  calculateRemainingAmount: (netSalary, totalPaid) => {
    return Math.max(0, (netSalary || 0) - (totalPaid || 0));
  },

  // Get payment status
  getPaymentStatus: (totalPaid, netSalary) => {
    if (!netSalary || netSalary <= 0) return "pending";
    if (totalPaid >= netSalary) return "completed";
    if (totalPaid > 0) return "partial";
    return "pending";
  },

  // Format month for display
  formatMonth: (monthString) => {
    try {
      const [year, month] = monthString.split("-");
      const date = new Date(year, month - 1);
      return date.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
      });
    } catch {
      return monthString;
    }
  },

  // Get current month string
  getCurrentMonth: () => {
    return new Date().toISOString().slice(0, 7);
  },
};

export default api;
