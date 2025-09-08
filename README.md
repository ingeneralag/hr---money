# 🏢 نظام إدارة الموارد البشرية المصري

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/)

## 📋 نظرة عامة

نظام شامل لإدارة الموارد البشرية مصمم خصيصاً للشركات المصرية، يتضمن:

### 🌟 المميزات الرئيسية

- **💼 إدارة الموظفين**: تسجيل وإدارة بيانات الموظفين كاملة
- **💰 إدارة الرواتب**: حساب الرواتب والمكافآت والخصومات
- **⏰ نظام الحضور**: تتبع الحضور والانصراف
- **🖥️ مراقبة سطح المكتب**: تتبع نشاط الموظفين (Electron App)
- **📱 تطبيق ويب**: واجهة حديثة متجاوبة
- **📊 التقارير**: تقارير مفصلة ولوحة معلومات
- **📧 إدارة الإشعارات**: نظام إشعارات متقدم
- **🔐 نظام الصلاحيات**: أدوار متعددة للمستخدمين

## 🏗️ التقنيات المستخدمة

### Backend
- **Node.js** + **Express.js**
- **MongoDB** with **Mongoose**
- **Socket.io** للاتصال المباشر
- **JWT** للمصادقة
- **Multer** لرفع الملفات

### Frontend
- **React.js** 18+
- **Tailwind CSS** للتصميم
- **Lucide React** للأيقونات
- **Axios** للاتصال بالـ API

### Desktop App
- **Electron** لتطبيق سطح المكتب
- **Socket.io Client** للاتصال المباشر
- **Node.js APIs** لمراقبة النظام

## 🚀 التثبيت والتشغيل

### المتطلبات الأساسية
- Node.js 18+
- MongoDB Atlas account
- Git

### 1. استنساخ المشروع
```bash
git clone https://github.com/B7rawy/HR-System2.git
cd HR-System2
```

### 2. تثبيت المكتبات

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

#### Desktop App
```bash
# في المجلد الجذر
npm install
```

### 3. إعداد قاعدة البيانات
1. أنشئ حساب MongoDB Atlas
2. احصل على connection string
3. أنشئ ملف `.env` في مجلد `backend`:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5001
```

### 4. تشغيل المشروع

#### تشغيل البرامج منفصلة:
```bash
# Backend (في terminal منفصل)
cd backend
npm start

# Frontend (في terminal منفصل)
cd frontend
npm start

# Desktop App (في terminal منفصل)
npm start
```

#### تشغيل سريع (جميع البرامج):
```bash
./start-system.sh
```

## 📱 الاستخدام

### الوصول للنظام
- **تطبيق الويب**: http://localhost:3000
- **API**: http://localhost:5001/api
- **تطبيق سطح المكتب**: يفتح تلقائياً

### الحسابات الافتراضية
- **المدير**: `admin` / `admin123`
- **موظف**: `employee` / `employee123`

## 🗂️ هيكل المشروع

```
HR-System2/
├── backend/                 # خادم Node.js
│   ├── models/             # نماذج قاعدة البيانات
│   ├── routes/             # مسارات API
│   ├── middleware/         # وسطاء المصادقة
│   └── server.js           # نقطة البداية
├── frontend/               # تطبيق React
│   ├── src/
│   │   ├── components/     # مكونات واجهة المستخدم
│   │   ├── pages/          # صفحات التطبيق
│   │   ├── services/       # خدمات API
│   │   └── utils/          # أدوات مساعدة
│   └── public/
├── main.js                 # تطبيق Electron
├── renderer.js             # واجهة Electron
└── package.json            # إعدادات المشروع
```

## 🔧 المميزات المتقدمة

### نظام الصفحات المُبوبة
- صفحة تفاصيل الموظف مقسمة إلى 7 تبويبات:
  - **نظرة عامة**: معلومات أساسية وإحصائيات
  - **مراقبة سطح المكتب**: تتبع النشاط والوقت
  - **الراتب والمزايا**: تفاصيل الراتب والبدلات
  - **الحضور والانصراف**: إحصائيات الحضور
  - **الأداء والتقييم**: تقييمات الأداء
  - **المستندات**: إدارة ملفات الموظف
  - **الطلبات والإجازات**: طلبات الإجازات

### نظام المراقبة
- تتبع حركة الماوس
- مراقبة النشاط العام
- التقاط صور الشاشة (اختياري)
- تسجيل أوقات العمل

### إدارة البيانات
- نسخ احتياطي تلقائي
- تصدير التقارير
- إدارة المعاملات المالية
- نظام الإشعارات

## 🛠️ النشر (Deployment)

### Heroku
```bash
# رفع الكود إلى Heroku
git add .
git commit -m "Deploy to production"
git push heroku main
```

### VPS/Server
```bash
# استخدام PM2 لإدارة العمليات
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ فرع للميزة الجديدة (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى الفرع (`git push origin feature/AmazingFeature`)
5. افتح Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

## 👨‍💻 المطور

**Kareem El-Bahrawy (B7rawy)**
- GitHub: [@B7rawy](https://github.com/B7rawy)
- Email: kareemelb7rawy@gmail.com

## 🆘 الدعم

إذا كان لديك أي مشاكل أو استفسارات:
1. راجع [الوثائق](./docs/)
2. ابحث في [Issues](https://github.com/B7rawy/HR-System2/issues)
3. أنشئ issue جديد
4. تواصل مع المطور

---

**ملاحظة**: هذا المشروع تم تطويره للاستخدام في البيئة المصرية ويدعم اللغة العربية بالكامل. # test
