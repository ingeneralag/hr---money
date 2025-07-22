require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
// إعادة تفعيل الاتصال بقاعدة البيانات
const connectDB = require("./config/database");
const mongoose = require("mongoose");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);

// إعداد Socket.IO للتحكم في التطبيق المكتبي
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://hr-api.in-general.net/api",
      "https://hr-dash.in-general.net/",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// متغيرات لتتبع الاتصالات
const connectedDesktopApps = new Map(); // userId -> socket
const connectedWebClients = new Map(); // userId -> socket

// تفعيل قاعدة البيانات
console.log("✅ Database enabled - Server running with MongoDB Atlas");
console.log("Attempting to connect to MongoDB...");

// متغير لحالة اتصال MongoDB
let isMongoConnected = false;

// دالة الاتصال بقاعدة البيانات
const connectToMongoDB = async () => {
  try {
    console.log("🔗 Connecting to MongoDB Atlas...");
    await connectDB();
    isMongoConnected = true;
    console.log("✅ MongoDB Connected Successfully");

    // إنشاء مستخدم admin افتراضي
    await createDefaultAdmin();
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("📋 Error details:", error);
    isMongoConnected = false;

    // Continue running server even if database connection fails
    console.log("⚠️ Server will continue running without database connection");
  }
};

// إنشاء مستخدم admin افتراضي
const createDefaultAdmin = async () => {
  try {
    const User = require("./models/User");
    const bcrypt = require("bcryptjs");

    console.log("👤 Checking for admin user...");
    const adminExists = await User.findOne({ username: "admin" });
    if (!adminExists) {
      console.log("👤 Creating admin user...");
      const hashedPassword = await bcrypt.hash("admin123", 12);
      const admin = new User({
        username: "admin",
        email: "admin@company.com",
        password: hashedPassword,
        role: "admin",
        name: "مدير النظام",
        firstName: "مدير",
        lastName: "النظام",
        department: "إدارة",
        position: "مدير عام",
        approvalStatus: "approved",
      });
      await admin.save();
      console.log("✅ Default admin user created successfully");
    } else {
      console.log("✅ Admin user already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
  }
};

// CORS configuration - Updated for better compatibility
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    const allowedOrigins = [
      "http://localhost:3000",
      "https://hr-api.in-general.net/api",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5001",
      "https://hr-dash.in-general.net/",
      undefined, // Allow requests with no origin
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
};

// Middleware
app.use(cors(corsOptions));

// إضافة headers إضافية للـ CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || "http://localhost:3000";
  res.header("Access-Control-Allow-Origin", origin);
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// تشغيل الاتصال بقاعدة البيانات
connectToMongoDB();

// Middleware للتحقق من اتصال قاعدة البيانات
app.use((req, res, next) => {
  req.isMongoConnected = isMongoConnected;
  next();
});

// إتاحة Socket.IO للـ routes
app.set("io", io);

// Static files serving for uploads (including screenshots)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
console.log("📁 Static file serving enabled for uploads directory");

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📊 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes - تفعيل جميع الـ routes
console.log("🛣️ Loading routes...");
app.use("/api/auth", require("./routes/auth"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/whatsapp", require("./routes/whatsapp"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/tracking", require("./routes/tracking"));
app.use("/api/daily-attendance", require("./routes/daily-attendance"));
console.log("✅ All routes loaded");

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "HR System API is running with MongoDB Atlas",
    database: isMongoConnected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
    version: "2.8.0",
  });
});

// Basic endpoint
app.get("/", (req, res) => {
  res.json({
    message: "HR System API is running with MongoDB Atlas",
    version: "2.8.0",
    status: "active",
    database: isMongoConnected ? "connected" : "disconnected",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(500).json({
    success: false,
    message: "خطأ في الخادم",
    error: process.env.NODE_ENV === "development" ? err.message : "خطأ داخلي",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "الصفحة غير موجودة",
  });
});

const PORT = process.env.PORT || 5001;

// إعداد Socket.IO للتحكم في التطبيق المكتبي
io.on("connection", (socket) => {
  console.log("🔌 New socket connection:", socket.id);

  // تسجيل التطبيق المكتبي
  socket.on("register-desktop-app", (data) => {
    const { userId, userInfo } = data;
    connectedDesktopApps.set(userId, socket);
    socket.userId = userId;
    socket.userType = "desktop";
    console.log(
      `📱 Desktop app registered for user: ${userInfo?.name || userId}`
    );

    // إشعار العملاء المتصلين بالويب
    const webClient = connectedWebClients.get(userId);
    if (webClient) {
      webClient.emit("desktop-app-status", { connected: true, userId });
    }
  });

  // تسجيل عميل الويب
  socket.on("register-web-client", (data) => {
    const { userId } = data;
    connectedWebClients.set(userId, socket);
    socket.userId = userId;
    socket.userType = "web";
    console.log(`🌐 Web client registered for user: ${userId}`);

    // إرسال حالة التطبيق المكتبي
    const desktopConnected = connectedDesktopApps.has(userId);
    socket.emit("desktop-app-status", { connected: desktopConnected, userId });
  });

  // أوامر التحكم من الويب للتطبيق المكتبي
  socket.on("control-desktop-app", (data) => {
    const { userId, command, payload } = data;
    const desktopApp = connectedDesktopApps.get(userId);

    if (desktopApp) {
      console.log(
        `📡 Sending command '${command}' to desktop app for user: ${userId}`
      );
      desktopApp.emit("remote-command", { command, payload });

      // تأكيد الإرسال للويب
      const webClient = connectedWebClients.get(userId);
      if (webClient) {
        webClient.emit("command-sent", { command, success: true });
      }
    } else {
      console.log(`❌ Desktop app not found for user: ${userId}`);
      // إرسال خطأ للويب
      const webClient = connectedWebClients.get(userId);
      if (webClient) {
        webClient.emit("command-sent", {
          command,
          success: false,
          error: "Desktop app not connected",
        });
      }
    }
  });

  // استقبال حالة من التطبيق المكتبي
  socket.on("desktop-status", (data) => {
    const { userId } = data;
    // إرسال الحالة لعميل الويب
    const webClient = connectedWebClients.get(userId);
    if (webClient) {
      webClient.emit("desktop-status-update", data);
    }
  });

  // معالجة قطع الاتصال
  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);

    if (socket.userId) {
      if (socket.userType === "desktop") {
        connectedDesktopApps.delete(socket.userId);
        console.log(`📱 Desktop app disconnected for user: ${socket.userId}`);

        // إشعار عميل الويب
        const webClient = connectedWebClients.get(socket.userId);
        if (webClient) {
          webClient.emit("desktop-app-status", {
            connected: false,
            userId: socket.userId,
          });
        }
      } else if (socket.userType === "web") {
        connectedWebClients.delete(socket.userId);
        console.log(`🌐 Web client disconnected for user: ${socket.userId}`);
      }
    }
  });
});

// بدء الخادم
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

// معالجة إشارات الإغلاق
process.on("SIGTERM", async () => {
  console.log("📴 SIGTERM received, shutting down gracefully");
  if (isMongoConnected) {
    console.log("🔒 إغلاق اتصال MongoDB Atlas...");
    await mongoose.connection.close();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("📴 SIGINT received, shutting down gracefully");
  if (isMongoConnected) {
    console.log("🔒 إغلاق اتصال MongoDB Atlas...");
    await mongoose.connection.close();
  }
  process.exit(0);
});

module.exports = app;

