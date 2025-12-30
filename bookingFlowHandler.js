/**
 * bookingFlowHandler.js — FINAL SAFE VERSION
 *
 * Handles:
 * - Booking flow (slot → name → phone → service)
 * - Cancel booking flow
 * - Interactive buttons (slots + services)
 */

const {
  askAI,
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
// 🧠 SESSION STORAGE (in-memory, Vercel safe)
// ---------------------------------------------
const sessions = {};

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      waitingForCancelPhone: false,
    };
  }
  return sessions[userId];
}

/**
 * ==================================
 * 🔘 HANDLE INTERACTIVE MESSAGES
 * ==================================
 */
async function handleInteractiveMessage(message, from, tempBookings) {
  const type = message.interactive?.type;

  const id =
    type === "list_reply"
      ? message.interactive?.list_reply?.id
      : message.interactive?.button_reply?.id;

  console.log("🔘 Interactive received:", { from, id, type });

  // -------------------------------
  // 🕒 APPOINTMENT SLOT
  // -------------------------------
  if (id?.startsWith("slot_")) {
    const slot = id.replace("slot_", "");
    const appointment = `${slot} PM`;

    tempBookings[from] = { appointment };

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // -------------------------------
  // 💊 SERVICE SELECTION
  // -------------------------------
  if (id?.startsWith("service_")) {
    const serviceName = id.replace("service_", "");

    if (!tempBookings[from] || !tempBookings[from].phone) {
      await sendTextMessage(
        from,
        "⚠️ يجب إكمال خطوات الحجز قبل اختيار الخدمة."
      );
      return;
    }

    tempBookings[from].service = serviceName;
    const booking = tempBookings[from];

    console.log("✅ Final booking:", booking);

    // Save to Supabase
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

  // -------------------------------
  // ❌ CANCEL BOOKING
  // -------------------------------
  if (isCancelRequest(text)) {
    session.waitingForCancelPhone = true;
    delete tempBookings[from];

    await askForCancellationPhone(from);
    return;
  }

  if (session.waitingForCancelPhone) {
    const phone = text.replace(/\D/g, "");

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
  if (!tempBookings[from] && ["3", "6", "9"].includes(text)) {
    tempBookings[from] = { appointment: `${text} PM` };
    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // -------------------------------
  // 👤 NAME STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].name) {
    await handleNameStep(text, from, tempBookings);
    return;
  }

  // -------------------------------
  // 📱 PHONE STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].phone) {
    await handlePhoneStep(text, from, tempBookings);
    return;
  }

  // -------------------------------
  // 💊 SERVICE STEP
  // -------------------------------
  if (tempBookings[from] && !tempBookings[from].service) {
    await handleServiceStep(text, from, tempBookings);
    return;
  }

  // -------------------------------
  // 🗓 START BOOKING
  // -------------------------------
  if (!tempBookings[from] && isBookingRequest(text)) {
    await sendAppointmentOptions(from);
    return;
  }

  // -------------------------------
  // 🤖 SAFE FALLBACK (NO AI SPAM)
  // -------------------------------
  await sendTextMessage(
    from,
    "👋 مرحبًا!\n\nاختر ما تريد:\n1️⃣ حجز موعد\n2️⃣ العروض\n3️⃣ الموقع"
  );
}

module.exports = {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
};
