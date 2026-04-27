// notifications.js — Enhanced Payment & SMS Notifications

import { CONFIG } from './config.js';

export const NOTIFICATION_TEMPLATES = CONFIG.EMAILJS?.TEMPLATES || {
  clientNew: 'template_client_new',
  providerNew: 'template_provider_new',
  reminder: 'template_reminder',
  confirmation: 'template_confirmation'
};

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
  
  return new Notification(title, {
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
      showBrowserNotification('تذكير بموعدك', {
        body: `موعد ${appointment.clientName} في ${appointment.service} خلال ${minutesBefore >= 60 ? Math.floor(minutesBefore/60) + ' ساعة' : minutesBefore + ' دقيقة'}`,
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
 */
export async function sendEmailNotification(templateId, templateParams) {
  try {
    if (!window.emailjs) {
      console.warn("EmailJS not loaded");
      return;
    }
    
    // Auto-init with config key if not already done
    if (CONFIG.EMAILJS.PUBLIC_KEY && CONFIG.EMAILJS.PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
      emailjs.init({ publicKey: CONFIG.EMAILJS.PUBLIC_KEY });
    }
    
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
 */
export function openWhatsAppNotify(appointment, type = 'confirm') {
  const phone = (appointment.clientPhone || '').replace(/[^0-9]/g, '');
  const fullPhone = phone.startsWith('0') ? '2' + phone : phone;
  
  const messages = {
    confirm: `مرحباً ${appointment.clientName}! 😊
بتم تأكيد حجزك في BookFlow:
📍 الخدمة: ${appointment.service || ''}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time || ''}
شكراً لاختيارك! ✨`,
    
    reminder: `تذكير بموعدك! ⏰
مرحباً ${appointment.clientName}!
📍 الخدمة: ${appointment.service || ''}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time || ''}
لو محتاج أي مساعدة، رد علينا! 🔔`,
    
    cancel: `مرحباً ${appointment.clientName}! 😔
تم إلغاء موعدك:
📍 الخدمة: ${appointment.service || ''}
📅 التاريخ: ${appointment.dateStr || ''}
⏰ الوقت: ${appointment.time || ''}
لو محتاج أي مساعدة، رد علينا! 🔔`,
    
    custom: `مرحباً ${appointment.clientName}! 👋`
  };
  
  const message = encodeURIComponent(messages[type] || messages.custom);
  window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
}

// ==================== PAYMENT GATEWAYS ====================

/**
 * Initialize Stripe payment
 */
export function initStripe(publishableKey) {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve(window.Stripe(publishableKey));
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve(window.Stripe(publishableKey));
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Process payment with Stripe
 */
export async function processStripePayment(amount, description, metadata = {}) {
  try {
    const stripe = await initStripe(CONFIG.STRIPE.PUBLISHABLE_KEY);
    if (!stripe) throw new Error('Stripe not initialized');
    
    // Create payment intent on backend (mock for now)
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Stripe expects cents
        currency: 'egp',
        description,
        metadata
      })
    });
    
    const { clientSecret } = await response.json();
    
    // Confirm payment with Stripe
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Payment successful:', paymentIntent);
    return paymentIntent;
  } catch (e) {
    console.error('❌ Payment error:', e);
    throw e;
  }
}

/**
 * Process payment with Vodafone Cash (mock)
 */
export async function processVodafoneCashPayment(phoneNumber, amount, reference = '') {
  try {
    // Mock implementation - in real scenario, call your backend
    const response = await fetch('/api/vodafone-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneNumber,
        amount,
        reference,
        merchantCode: CONFIG.PAYMENT?.VODAFONE_CASH_CODE || 'YOUR_MERCHANT_CODE'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Payment failed');
    }
    
    console.log('✅ Vodafone Cash payment initiated:', data);
    return data;
  } catch (e) {
    console.error('❌ Vodafone Cash error:', e);
    throw e;
  }
}

/**
 * Process payment with Paymob (mock)
 */
export async function processPaymobPayment(amount, description, billingData = {}) {
  try {
    // Mock implementation - in real scenario, call your backend
    const response = await fetch('/api/paymob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Paymob expects cents
        currency: 'EGP',
        description,
        billingData,
        apiKey: CONFIG.PAYMENT?.PAYMOB_API_KEY || 'YOUR_PAYMOB_API_KEY'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Payment failed');
    }
    
    // Redirect to Paymob payment page if needed
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
      return;
    }
    
    console.log('✅ Paymob payment initiated:', data);
    return data;
  } catch (e) {
    console.error('❌ Paymob error:', e);
    throw e;
  }
}

// ==================== SMS NOTIFICATIONS ====================

/**
 * Send SMS via Twilio (mock)
 */
export async function sendSMSNotification(phoneNumber, message) {
  try {
    // Mock implementation - in real scenario, call your backend
    const response = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phoneNumber,
        message,
        accountSid: CONFIG.SMS?.TWILIO_ACCOUNT_SID || 'YOUR_TWILIO_SID',
        authToken: CONFIG.SMS?.TWILIO_AUTH_TOKEN || 'YOUR_TWILIO_TOKEN'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'SMS failed');
    }
    
    console.log('✅ SMS sent successfully:', data);
    return data;
  } catch (e) {
    console.error('❌ SMS error:', e);
    throw e;
  }
}

/**
 * Send appointment confirmation SMS
 */
export async function sendAppointmentSMS(appointment) {
  const phone = (appointment.clientPhone || '').replace(/[^0-9]/g, '');
  
  const message = `مرحباً ${appointment.clientName}! تم تأكيد حجزك.
📍 ${appointment.service || ''}
📅 ${appointment.date || ''}
⏰ ${appointment.time || ''}
شكراً!`;
  
  return sendSMSNotification(phone, message);
}

/**
 * Send appointment reminder SMS
 */
export async function sendReminderSMS(appointment) {
  const phone = (appointment.clientPhone || '').replace(/[^0-9]/g, '');
  
  const message = `تذكير: موعدك ${appointment.service || ''} اليوم الساعة ${appointment.time || ''}.
شكراً!`;
  
  return sendSMSNotification(phone, message);
}

// ==================== PAYMENT UI HELPERS ====================

/**
 * Show payment modal
 */
export function showPaymentModal(appointment, onSuccess, onError) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px;">
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
        <i class="ph-bold ph-x"></i>
      </button>
      <h2 style="margin-bottom: 24px;">إتمام الدفع</h2>
      <div style="background: var(--bg-surface); padding: 24px; border-radius: var(--radius-md); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
          <span style="color: var(--text-secondary);">الخدمة:</span>
          <strong>${appointment.service || ''}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
          <span style="color: var(--text-secondary);">المبلغ:</span>
          <strong style="font-size: 1.3rem; color: var(--accent);">${appointment.price || 0} ج.م</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">العميل:</span>
          <span>${appointment.clientName || ''}</span>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button class="btn-primary" onclick="window.processPayment('stripe', this)" style="width: 100%;">
          <i class="ph-bold ph-credit-card"></i> دفع بالكارت (Stripe)
        </button>
        <button class="btn-secondary" onclick="window.processPayment('vodafone', this)" style="width: 100%;">
          <i class="ph-bold ph-phone"></i> فودافون كاش
        </button>
        <button class="btn-secondary" onclick="window.processPayment('paymob', this)" style="width: 100%;">
          <i class="ph-bold ph-money"></i> Paymob
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  });
  
  // Make payment processor available globally
  window.processPayment = async (method, btn) => {
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> جاري المعالجة...';
    
    try {
      if (method === 'stripe') {
        await processStripePayment(appointment.price, appointment.service, {
          appointmentId: appointment.id,
          clientName: appointment.clientName
        });
      } else if (method === 'vodafone') {
        await processVodafoneCashPayment(appointment.clientPhone, appointment.price, appointment.id);
      } else if (method === 'paymob') {
        await processPaymobPayment(appointment.price, appointment.service, {
          first_name: appointment.clientName?.split(' '[0] || '',
          last_name: appointment.clientName?.split(' ').slice(1).join(' ') || '',
          phone_number: appointment.clientPhone
        });
      }
      
      showToast('تم الدفع بنجاح! ✅', 'success');
      modal.remove();
      document.body.style.overflow = '';
      
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Payment error:', e);
      showToast('فشل الدفع: ' + e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `
        <i class="ph-bold ph-${method === 'stripe' ? 'credit-card' : method === 'vodafone' ? 'phone' : 'money'}"></i>
        ${method === 'stripe' ? 'دفع بالكارت (Stripe)' : method === 'vodafone' ? 'فودافون كاش' : 'Paymob'}
      `;
      
      if (onError) onError(e);
    }
  };
}

console.log('✅ Notifications module loaded with Payment & SMS support');
