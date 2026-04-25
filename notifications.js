import { CONFIG } from './config.js';

export const NOTIFICATION_TEMPLATES = CONFIG.EMAILJS.TEMPLATES;

// ==================== BROWSER NOTIFICATIONS ====================
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  new Notification(title, {
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    ...options
  });
}

export function scheduleAppointmentReminder(appointment, minutesBefore = 60) {
  const aptTime = new Date(`${appointment.date}T${appointment.time}`).getTime();
  const reminderTime = aptTime - (minutesBefore * 60 * 1000);
  const now = Date.now();
  
  if (reminderTime > now) {
    setTimeout(() => {
      showBrowserNotification('تذكير بموعد قادم', {
        body: `موعد ${appointment.clientName} في ${appointment.service} خلال ${minutesBefore >= 60 ? 'ساعة' : minutesBefore + ' دقيقة'}`,
        tag: appointment.id
      });
    }, reminderTime - now);
  }
}

export function scheduleMultiReminder(appointment, settings) {
  const { waReminder, browserNotify } = settings;
  
  // Schedule WhatsApp reminder
  if (waReminder > 0) {
    scheduleWhatsAppReminder(appointment, waReminder);
  }
  
  // Schedule browser notification
  if (browserNotify > 0) {
    scheduleAppointmentReminder(appointment, browserNotify);
  }
}

function scheduleWhatsAppReminder(appointment, minutesBefore) {
  const aptTime = new Date(`${appointment.date}T${appointment.time}`).getTime();
  const reminderTime = aptTime - (minutesBefore * 60 * 1000);
  const now = Date.now();
  
  if (reminderTime > now) {
    setTimeout(() => {
      openWhatsAppNotify(appointment, 'reminder');
    }, reminderTime - now);
  }
}

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
 * @param {string} type - Message type: 'confirm', 'reminder', 'cancel', 'custom'
 */
export function openWhatsAppNotify(appointment, type = 'confirm') {
  const phone = appointment.clientPhone.replace(/[^0-9]/g, '');
  const fullPhone = phone.startsWith('0') ? '2' + phone : phone;
  
  const messages = {
    confirm: `مرحباً ${appointment.clientName}! 😊
بأكد مع حض��تك موعد الحجز في BookFlow:
📍 الخدمة: ${appointment.service}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time}
شكراً لاختيارك لنا! ✨`,
    
    reminder: `تذكير بموعدك! ⏰
مرحباً ${appointment.clientName}!
📍 الخدمة: ${appointment.service}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time}
لو محتاج تعدل الموعد، راجعني 🔄`,
    
    cancel: `مرحباً ${appointment.clientName}! 😔
تم إلغاء موعدك:
📍 الخدمة: ${appointment.service}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time}
لو محتاج تحجز من جديد، راجعني 🔄`,
    
    custom: `مرحباً ${appointment.clientName}! 👋`
  };
  
  const message = encodeURIComponent(messages[type] || messages.custom);
  
  window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
}
