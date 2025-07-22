#!/usr/bin/env node

// Debug tool for monitoring QR Code generation
const axios = require("axios");

const API_BASE = process.env.REACT_APP_API_URL + "/whatsapp";

async function checkQRStatus() {
  try {
    console.log("\n🔍 Checking QR Code status...");
    console.log("Time:", new Date().toLocaleTimeString("ar-SA"));

    // Check general status
    const statusResponse = await axios.get(`${API_BASE}/status`);
    console.log("📊 Status:", statusResponse.data.status);
    console.log(
      "🔗 Connection:",
      statusResponse.data.status === "connected"
        ? "✅ Connected"
        : "❌ Disconnected"
    );

    // Check QR Code
    try {
      const qrResponse = await axios.get(`${API_BASE}/qr-code`);
      if (qrResponse.data.success && qrResponse.data.qrCode) {
        console.log("✅ QR Code available!");
        console.log("📐 QR Code length:", qrResponse.data.qrCode.length);
        console.log(
          "🎯 QR starts with:",
          qrResponse.data.qrCode.substring(0, 50) + "..."
        );

        // Save QR to file for inspection
        const fs = require("fs");
        const qrData = qrResponse.data.qrCode.replace(
          /^data:image\/png;base64,/,
          ""
        );
        fs.writeFileSync("debug_qr.png", qrData, "base64");
        console.log("💾 QR Code saved to debug_qr.png");
      } else {
        console.log("❌ QR Code not available:", qrResponse.data.message);
      }
    } catch (qrError) {
      console.log(
        "❌ QR Code endpoint error:",
        qrError.response?.data?.message || qrError.message
      );
    }

    console.log("─".repeat(50));
  } catch (error) {
    console.error(
      "🚨 Error checking status:",
      error.response?.data || error.message
    );
  }
}

async function startMonitoring() {
  console.log("🚀 Starting QR Code monitoring...");
  console.log("📡 Monitoring API:", API_BASE);

  // Initial check
  await checkQRStatus();

  // Check every 3 seconds
  const interval = setInterval(checkQRStatus, 3000);

  // Stop after 2 minutes
  setTimeout(() => {
    clearInterval(interval);
    console.log("\n⏰ Monitoring stopped after 2 minutes");
    process.exit(0);
  }, 120000);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n👋 Monitoring stopped by user");
    process.exit(0);
  });
}

// Start monitoring if QR flag is provided
if (process.argv.includes("--qr")) {
  startMonitoring();
} else if (process.argv.includes("--init")) {
  // Initialize WhatsApp and start monitoring
  (async () => {
    try {
      console.log("🔄 Initializing WhatsApp...");
      const response = await axios.post(`${API_BASE}/initialize`);
      console.log("✅ Initialization response:", response.data);

      // Wait a bit then start monitoring
      setTimeout(startMonitoring, 2000);
    } catch (error) {
      console.error(
        "❌ Initialization failed:",
        error.response?.data || error.message
      );
    }
  })();
} else {
  console.log("📚 QR Code Debug Tool");
  console.log("");
  console.log("Usage:");
  console.log("  node debug-qr.js --qr     Monitor QR code status");
  console.log("  node debug-qr.js --init   Initialize WhatsApp and monitor");
  console.log("");
  console.log("Examples:");
  console.log("  node debug-qr.js --init   # Start fresh and monitor");
  console.log("  node debug-qr.js --qr     # Just monitor existing session");
}
