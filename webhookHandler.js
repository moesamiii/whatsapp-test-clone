/**
 * webhookHandler.js — FINAL STABLE VERSION
 *
 * Rules enforced:
 * - ONE incoming message → ONE handler → ONE response
 * - No duplicate sendTextMessage calls
 * - Router only, logic delegated cleanly
 */

const { handleAudioMessage } = require("./webhookProcessor");

// Media services
const {
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendOffersValidity,
} = require("./mediaService");

// Content filter
const { containsBanWords, sendBanWordsResponse } = require("./contentFilter");

// Helpers
const {
  sendTextMessage,
  askForCancellationPhone,
  processCancellation,
} = require("./helpers");

// Detection helpers
const {
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isCancelRequest,
  isEnglish,
  isGreeting,
  getGreeting,
} = require("./messageHandlers");

// Booking flow
const {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
} = require("./bookingFlowHandler");

// --------------------------------------------------
// REGISTER WHATSAPP WEBHOOK ROUTES
// --------------------------------------------------
function registerWebhookRoutes(app, VERIFY_TOKEN) {
  // ---------------------------------
  // GET — VERIFY WEBHOOK (META)
  // ---------------------------------
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

  // ---------------------------------
  // POST — RECEIVE WHATSAPP EVENTS
  // ---------------------------------
  app.post("/webhook", async (req, res) => {
    try {
      const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      // Always ACK Meta
      if (!message) return res.sendStatus(200);

      const from = message.from;
      const text = message.text?.body?.trim() || null;

      global.tempBookings = global.tempBookings || {};
      const tempBookings = global.tempBookings;

      const session = getSession(from);

      console.log("📩 Incoming:", message.type, from);

      // -----------------------------------------------------
      // 🎙️ AUDIO
      // -----------------------------------------------------
      if (message.type === "audio") {
        await handleAudioMessage(message, from);
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 🎛️ INTERACTIVE (buttons / lists)
      // -----------------------------------------------------
      if (message.type === "interactive") {
        await handleInteractiveMessage(message, from, tempBookings);
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 📨 IGNORE NON-TEXT
      // -----------------------------------------------------
      if (!text) return res.sendStatus(200);

      // -----------------------------------------------------
      // 👋 GREETING
      // -----------------------------------------------------
      if (isGreeting(text)) {
        await sendTextMessage(from, getGreeting(isEnglish(text)));
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 🚫 BAN WORDS
      // -----------------------------------------------------
      if (containsBanWords(text)) {
        await sendBanWordsResponse(from, isEnglish(text) ? "en" : "ar");
        delete tempBookings[from];
        session.waitingForCancelPhone = false;
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 🌍 LOCATION
      // -----------------------------------------------------
      if (isLocationRequest(text)) {
        await sendLocationMessages(from, isEnglish(text) ? "en" : "ar");
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 🎁 OFFERS
      // -----------------------------------------------------
      if (isOffersRequest(text)) {
        session.waitingForOffersConfirmation = true;
        await sendOffersValidity(from, isEnglish(text) ? "en" : "ar");
        return res.sendStatus(200);
      }

      if (session.waitingForOffersConfirmation) {
        session.waitingForOffersConfirmation = false;
        if (isOffersConfirmation(text)) {
          await sendOffersImages(from, isEnglish(text) ? "en" : "ar");
          return res.sendStatus(200);
        }
      }

      // -----------------------------------------------------
      // 👨‍⚕️ DOCTORS
      // -----------------------------------------------------
      if (isDoctorsRequest(text)) {
        await sendDoctorsImages(from, isEnglish(text) ? "en" : "ar");
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // ❌ CANCEL BOOKING
      // -----------------------------------------------------
      if (isCancelRequest(text)) {
        session.waitingForCancelPhone = true;
        delete tempBookings[from];
        await askForCancellationPhone(from);
        return res.sendStatus(200);
      }

      if (session.waitingForCancelPhone) {
        const phone = text.replace(/\D/g, "");
        if (phone.length < 8) {
          await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح");
          return res.sendStatus(200);
        }

        session.waitingForCancelPhone = false;
        await processCancellation(from, phone);
        return res.sendStatus(200);
      }

      // -----------------------------------------------------
      // 🗓️ BOOKING FLOW (DELEGATED)
      // -----------------------------------------------------
      await handleTextMessage(text, from, tempBookings);
      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Webhook Fatal Error:", err);
      return res.sendStatus(200); // NEVER FAIL META
    }
  });
}

module.exports = { registerWebhookRoutes };
