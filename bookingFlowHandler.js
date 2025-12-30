/**
 * bookingFlowHandler.js — FINAL STABLE VERSION
 *
 * Handles:
 * - Booking flow (slot → name → phone → service)
 * - Cancel booking flow
 * - Interactive buttons (slots + services)
 *
 * RULE:
 * - This file sends replies ONLY for booking-related flows
 */

const {
  sendTextMessage,
  sendAppointmentOptions,
  insertBookingToSupabase,
  askForCancellationPhone,
  processCancellation,
} = require("./helpers");

const { isBookingRequest, isCancelRequest } = require("./messageHandlers");

const {
  handleNameStep,
  handlePhoneStep,
  handleServiceStep,
} = require("./bookingSteps");

// ---------------------------------------------
// 🧠 GLOBAL SESSION STORAGE (Vercel TEMP SAFE)
// ---------------------------------------------
global.sessions = global.sessions || {};

function getSession(userId) {
  if (!global.sessions[userId]) {
    global.sessions[userId] = {
      waitingForCancelPhone: false,
    };
  }
  return global.sessions[userId];
}

/**
 * ==================================
 * 🔘 HANDLE INTERACTIVE MESSAGES
 * ==================================
 */
async function handleInteractiveMessage(message, from, tempBookings) {
  const interactive = message.interactive;
  if (!interactive) return;

  const id = interactive.list_reply?.id || interactive.button_reply?.id || null;

  if (!id) return;

  console.log("🔘 Interactive received:", { from, id });

  // -------------------------------
  // 🕒 APPOINTMENT SLOT
  // -------------------------------
  if (id.startsWith("slot_")) {
    const slot = id.replace("slot_", ""); // 3 / 6 / 9
    tempBookings[from] = {
      appointment: `${slot} PM`,
    };

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // -------------------------------
  // 💊 SERVICE SELECTION
  // -------------------------------
  if (id.startsWith("service_")) {
    if (!tempBookings[from] || !tempBookings[from].phone) {
      await sendTextMessage(
        from,
        "⚠️ يجب إكمال خطوات الحجز قبل اختيار الخدمة."
      );
      return;
    }

    const serviceName = id.replace("service_", "");
    tempBookings[from].service = serviceName;

    const booking = tempBookings[from];
    console.log("✅ Final booking:", booking);

    // Save booking
    await insertBookingToSupabase(booking);

    // Confirmation
    await sendTextMessage(
      from,
      `✅ تم تأكيد حجزك:\n\n👤 الاسم: ${booking.name}\n📱 الجوال: ${booking.phone}\n💊 الخدمة: ${booking.service}\n📅 الموعد: ${booking.appointment}`
    );

    delete tempBookings[from];
    return;
  }
}

/**
 * ==================================
 * 💬 HANDLE TEXT MESSAGES
 * ==================================
 */
async function handleTextMessage(text, from, tempBookings) {
  const session = getSession(from);
  const cleanText = text.trim();

  // -------------------------------
  // ❌ CANCEL BOOKING
  // -------------------------------
  if (isCancelRequest(cleanText)) {
    session.waitingForCancelPhone = true;
    delete tempBookings[from];

    await askForCancellationPhone(from);
    return;
  }

  if (session.waitingForCancelPhone) {
    const phone = cleanText.replace(/\D/g, "");

    if (phone.length < 8) {
      await sendTextMessage(from, "⚠️ رقم غير صحيح، حاول مرة أخرى:");
      return;
    }

    session.waitingForCancelPhone = false;
    await processCancellation(from, phone);
    return;
  }

  // -------------------------------
  // ⏱ QUICK SLOT INPUT (3 / 6 / 9)
  // -------------------------------
  if (!tempBookings[from] && ["3", "6", "9"].includes(cleanText)) {
    tempBookings[from] = { appointment: `${cleanText} PM` };
    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // -------------------------------
  // 👤 NAME STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].name) {
    await handleNameStep(cleanText, from, tempBookings);
    return;
  }

  // -------------------------------
  // 📱 PHONE STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].phone) {
    await handlePhoneStep(cleanText, from, tempBookings);
    return;
  }

  // -------------------------------
  // 💊 SERVICE STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].service) {
    await handleServiceStep(cleanText, from, tempBookings);
    return;
  }

  // -------------------------------
  // 🗓 START BOOKING
  // -------------------------------
  if (!tempBookings[from] && isBookingRequest(cleanText)) {
    await sendAppointmentOptions(from);
    return;
  }

  // -------------------------------
  // 🤖 FALLBACK (BOOKING CONTEXT ONLY)
  // -------------------------------
  await sendTextMessage(
    from,
    "👋 مرحبًا!\n\nاختر:\n1️⃣ حجز موعد\n2️⃣ العروض\n3️⃣ الموقع"
  );
}

module.exports = {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
};
