/**
 * helpers.js — FINAL (Supabase ONLY, Vercel Safe)
 */

const axios = require("axios");
const { askAI, validateNameWithAI } = require("./aiHelper");

// =============================================
// 🗄 SUPABASE — BOOKING OPERATIONS
// =============================================
const {
  findLastBookingByPhone,
  updateBookingStatus,
  insertBookingToSupabase,
} = require("./databaseHelper");

// =============================================
// 🌍 ENVIRONMENT VARIABLES
// =============================================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =============================================
// 💬 SEND WHATSAPP TEXT MESSAGE
// =============================================
async function sendTextMessage(to, text) {
  try {
    console.log("📤 Sending WhatsApp text:", to, text);

    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err.message);
  }
}

// =============================================
// 📅 APPOINTMENT BUTTON OPTIONS
// =============================================
async function sendAppointmentOptions(to) {
  try {
    console.log("📅 Sending appointment buttons to:", to);

    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: "📅 اختر الموعد المناسب لك:",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: { id: "slot_3pm", title: "🕒 3 مساءً" },
              },
              {
                type: "reply",
                reply: { id: "slot_6pm", title: "🕕 6 مساءً" },
              },
              {
                type: "reply",
                reply: { id: "slot_9pm", title: "🕘 9 مساءً" },
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
  } catch (err) {
    console.error(
      "❌ Appointment button error:",
      err.response?.data || err.message
    );
  }
}

// =============================================
// 💊 SERVICE LIST (INTERACTIVE LIST)
// =============================================
async function sendServiceList(to) {
  try {
    console.log("💊 Sending service list to:", to);

    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: {
            type: "text",
            text: "💊 خدمات العيادة",
          },
          body: {
            text: "اختر نوع الخدمة المطلوبة:",
          },
          action: {
            button: "عرض الخدمات",
            sections: [
              {
                title: "الخدمات الأساسية",
                rows: [
                  { id: "service_فحص", title: "فحص عام" },
                  { id: "service_تنظيف", title: "تنظيف الأسنان" },
                  { id: "service_تبييض", title: "تبييض الأسنان" },
                  { id: "service_حشو", title: "حشو الأسنان" },
                ],
              },
              {
                title: "الخدمات المتقدمة",
                rows: [
                  { id: "service_جذور", title: "علاج الجذور" },
                  { id: "service_تركيبات", title: "تركيب التركيبات" },
                  { id: "service_تقويم", title: "تقويم الأسنان" },
                  { id: "service_خلع", title: "خلع الأسنان" },
                ],
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
  } catch (err) {
    console.error("❌ Service list error:", err.response?.data || err.message);
  }
}

// =============================================
// ❌ CANCEL BOOKING FLOW
// =============================================
async function askForCancellationPhone(to) {
  await sendTextMessage(
    to,
    "📌 من فضلك أرسل رقم الجوال المستخدم في الحجز لإلغاء الموعد."
  );
}

async function processCancellation(to, phone) {
  try {
    console.log("🛑 Cancel request for phone:", phone);

    const booking = await findLastBookingByPhone(phone);

    if (!booking) {
      await sendTextMessage(to, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
      return;
    }

    await updateBookingStatus(booking.id, "Canceled");

    await sendTextMessage(
      to,
      `🟣 تم إلغاء الحجز بنجاح:\n\n👤 الاسم: ${booking.name}\n💊 الخدمة: ${booking.service}\n📅 الموعد: ${booking.appointment}`
    );
  } catch (err) {
    console.error("❌ Cancel booking error:", err.message);
    await sendTextMessage(
      to,
      "⚠️ حدث خطأ أثناء إلغاء الحجز. حاول مرة أخرى لاحقًا."
    );
  }
}

// =============================================
// 📤 EXPORTS
// =============================================
module.exports = {
  // AI
  askAI,
  validateNameWithAI,

  // WhatsApp
  sendTextMessage,
  sendAppointmentOptions,
  sendServiceList,

  // Supabase
  insertBookingToSupabase,

  // Cancellation
  askForCancellationPhone,
  processCancellation,
};
