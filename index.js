// index.js — FINAL STABLE VERSION (Supabase ONLY, Vercel Safe)

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { registerWebhookRoutes } = require("./webhookHandler");

const app = express();
app.use(bodyParser.json());

// ---------------------------------------------
// 🌍 ENVIRONMENT VARIABLES
// ---------------------------------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "whatsapp_test_clone_123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ---------------------------------------------
// 🧠 GLOBAL MEMORY (TEMP — Vercel Compatible)
// ---------------------------------------------
global.tempBookings = global.tempBookings || {};
global.sessions = global.sessions || {};

// ---------------------------------------------
// 🚀 STARTUP LOGS
// ---------------------------------------------
console.log("🚀 Server starting...");
console.log("✅ VERIFY_TOKEN loaded:", !!VERIFY_TOKEN);
console.log("✅ WHATSAPP_TOKEN loaded:", !!WHATSAPP_TOKEN);
console.log("✅ PHONE_NUMBER_ID loaded:", PHONE_NUMBER_ID || "❌ Not found");

// ---------------------------------------------
// 🏠 BASIC ROUTES
// ---------------------------------------------
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Webhook for Clinic is running!");
});

app.get("/dashboard", async (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ---------------------------------------------
// 📊 BOOKINGS API (SUPABASE)
// ---------------------------------------------
app.get("/api/bookings", async (req, res) => {
  try {
    const { getAllBookingsFromSupabase } = require("./databaseHelper");
    const data = await getAllBookingsFromSupabase();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ---------------------------------------------
// 📤 SEND WHATSAPP MESSAGE (OPTIONAL IMAGE)
// ---------------------------------------------
app.post("/sendWhatsApp", async (req, res) => {
  try {
    const { name, phone, service, appointment, image } = req.body;
    console.log("📩 Incoming /sendWhatsApp:", req.body);

    if (!name || !phone) {
      return res.status(400).json({ error: "Missing name or phone number" });
    }

    const messageText =
      `👋 مرحبًا ${name}!\n` +
      `تم حجز موعدك لخدمة ${service} في Smile Clinic 🦷\n` +
      `📅 ${appointment}`;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    };

    // ---------------------------------
    // 🖼️ IMAGE MESSAGE
    // ---------------------------------
    if (image && image.startsWith("http")) {
      const imagePayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "image",
        image: {
          link: image,
          caption: messageText,
        },
      };

      const imageResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(imagePayload),
      });

      const imageData = await imageResponse.json();

      if (!imageResponse.ok || imageData.error) {
        console.error("❌ Image send failed:", imageData);
      } else {
        console.log("✅ Image message sent");
      }
    }

    // ---------------------------------
    // 💬 TEXT FOLLOW-UP
    // ---------------------------------
    const textPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body: messageText + "\n\n📞 للحجز أو الاستفسار، تواصل معنا الآن!",
      },
    };

    const textResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(textPayload),
    });

    const textData = await textResponse.json();

    if (!textResponse.ok) {
      console.error("❌ WhatsApp API Error:", textData);
      return res.status(500).json({ error: textData });
    }

    console.log("✅ WhatsApp message sent to:", phone);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("🚨 /sendWhatsApp error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------
// 🔗 REGISTER WEBHOOK ROUTES
// ---------------------------------------------
try {
  registerWebhookRoutes(app, VERIFY_TOKEN);
  console.log("✅ Webhook routes registered");
} catch (err) {
  console.error("⚠️ Webhook registration error:", err);
}

// ---------------------------------------------
// ▶️ RUN SERVER
// ---------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
