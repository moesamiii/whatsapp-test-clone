// index.js — FINAL WORKING VERSION (Vercel + WhatsApp Cloud API)

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fetch = require("node-fetch");
const { registerWebhookRoutes } = require("./webhookHandler");

const app = express();
app.use(bodyParser.json());

// --------------------------------------------------
// ENVIRONMENT VARIABLES (FROM VERCEL)
// --------------------------------------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --------------------------------------------------
// STARTUP LOGS
// --------------------------------------------------
console.log("🚀 Server starting...");
console.log("✅ VERIFY_TOKEN:", !!VERIFY_TOKEN);
console.log("✅ WHATSAPP_TOKEN:", !!WHATSAPP_TOKEN);
console.log("✅ PHONE_NUMBER_ID:", PHONE_NUMBER_ID || "❌ MISSING");

// --------------------------------------------------
// BASIC ROUTES
// --------------------------------------------------
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Webhook for Clinic is running on Vercel!");
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// --------------------------------------------------
// SEND WHATSAPP MESSAGE (TEXT ONLY — SAFE)
// --------------------------------------------------
async function sendWhatsAppText(to, text) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// --------------------------------------------------
// WEBHOOK VERIFICATION (META REQUIREMENT)
// --------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    return res.status(200).send(challenge);
  }

  console.warn("❌ Webhook verification failed");
  return res.sendStatus(403);
});

// --------------------------------------------------
// WEBHOOK RECEIVER (AUTO REPLY TEST)
// --------------------------------------------------
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body || "";

    console.log("📩 Incoming message:", from, text);

    // ✅ SIMPLE AUTO REPLY (CONFIRM BOT IS WORKING)
    await sendWhatsAppText(from, "✅ Bot is working!\nمرحبًا بك 👋");

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.sendStatus(500);
  }
});

// --------------------------------------------------
// REGISTER ADVANCED ROUTES (YOUR EXISTING LOGIC)
// --------------------------------------------------
try {
  registerWebhookRoutes(app, VERIFY_TOKEN);
  console.log("✅ Advanced webhook routes loaded");
} catch (err) {
  console.error("⚠️ Webhook handler error:", err);
}

// --------------------------------------------------
// START SERVER (LOCAL ONLY — VERCEL IGNORES THIS)
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
