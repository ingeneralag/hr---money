const Transaction = require("./models/Transaction");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function addRealData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const count = await Transaction.countDocuments();
    console.log("📊 Current transactions:", count);

    if (count === 0) {
      console.log("📝 Adding real transactions...");
      const realTransactions = [
        {
          description: "راتب شهر يونيو - أحمد محمد",
          amount: 8500,
          type: "expense",
          category: "رواتب",
          date: new Date("2024-06-01"),
          reference: "SAL-2024-001",
          status: "completed",
        },
        {
          description: "إيرادات مشروع ABC",
          amount: 25000,
          type: "income",
          category: "مشاريع",
          date: new Date("2024-06-10"),
          reference: "PRJ-2024-001",
          status: "completed",
        },
        {
          description: "عمولة مبيعات - فاطمة",
          amount: 3500,
          type: "expense",
          category: "عمولات",
          date: new Date("2024-06-08"),
          reference: "COM-2024-001",
          status: "pending",
        },
        {
          description: "فاتورة إنترنت ومكالمات",
          amount: 2500,
          type: "expense",
          category: "مرافق",
          date: new Date("2024-06-05"),
          reference: "UTL-2024-001",
          status: "completed",
        },
      ];

      await Transaction.insertMany(realTransactions);
      console.log("🎉 Added " + realTransactions.length + " transactions!");
    } else {
      console.log("📋 Existing transactions found, skipping...");
    }

    const newCount = await Transaction.countDocuments();
    console.log("📊 Final count:", newCount);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

addRealData();
