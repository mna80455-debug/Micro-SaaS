import { CONFIG } from './config.js';

export const NOTIFICATION_TEMPLATES = CONFIG.EMAILJS.TEMPLATES;

/**
 * Sends an email using EmailJS
 * @param {string} templateId - The EmailJS template ID
 * @param {Object} templateParams - The data to fill the template
 * @returns {Promise}
 */
export async function sendEmailNotification(templateId, templateParams) {
  try {
    // Check if EmailJS is initialized
    if (!window.emailjs) {
      console.warn("EmailJS not loaded");
      return;
    }

    // Auto-init with config key if not already done
    if (CONFIG.EMAILJS.PUBLIC_KEY && CONFIG.EMAILJS.PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
      emailjs.init({ publicKey: CONFIG.EMAILJS.PUBLIC_KEY });
    }

    // Attempt to send
    const response = await emailjs.send(
      CONFIG.EMAILJS.SERVICE_ID,
      templateId,
      templateParams
    );

    console.log('✅ Email Sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}

/**
 * Prepares a WhatsApp message for the provider to send to the client
 * @param {Object} appointment - The appointment data
 */
export function openWhatsAppNotify(appointment) {
  const phone = appointment.clientPhone.replace(/[^0-9]/g, '');
  const fullPhone = phone.startsWith('0') ? '2' + phone : phone;
  
  const message = encodeURIComponent(
    `مرحباً ${appointment.clientName}! 😊\n` +
    `بأكد مع حضرتك موعد الحجز في BookFlow:\n` +
    `📍 الخدمة: ${appointment.service}\n` +
    `📅 التاريخ: ${appointment.dateStr || ''}\n` +
    `⏰ الوقت: ${appointment.time}\n` +
    `شكراً لاختيارك لنا! ✨`
  );
  
  window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
}
