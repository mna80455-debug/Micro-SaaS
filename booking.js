// booking.js
import { db } from './firebase-config.js';
import { 
  collection, query, where, getDocs, addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showToast } from './components/toast.js';
import { sendEmailNotification, NOTIFICATION_TEMPLATES } from './notifications.js';
import { initGcal, addEventToGcal } from './gcal.js';

let providerId = null;
let selectedService = null;
let selectedDate = null;
let selectedTime = null;

// Get provider username from URL ?p=username
const urlParams = new URLSearchParams(window.location.search);
const providerUsername = urlParams.get('p') || urlParams.get('provider') || 'menna';

async function loadProvider() {
  try {
    const q = query(
      collection(db, 'users'), 
      where('settings.bookingLink', '==', providerUsername)
    );
    
    const snap = await getDocs(q);
    
    if(snap.empty) {
      document.getElementById('providerName').textContent = "عفواً، الرابط غير مكتمل";
      document.getElementById('providerType').textContent = "يرجى التأكد من كتابة اسم المستخدم الصحيح في الرابط";
      document.getElementById('providerAvatar').innerHTML = "ℹ️";
      document.getElementById('bookStep1').innerHTML = `
        <div class="empty-state">
          <p>يبدو أن هذا الرابط لا يخص أي مقدم خدمة مسجل حالياً.</p>
          <p class="mt-8 text-secondary">إذا كنت صاحب الحساب، يرجى ضبط "رابط الحجز" من الإعدادات في لوحة التحكم.</p>
          <a href="/app.html" class="btn-primary mt-16" style="text-decoration:none">العودة للوحة التحكم</a>
        </div>
      `;
      return;
    }
    
    const data = snap.docs[0].data();
    providerId = snap.docs[0].id;
    
    document.getElementById('providerName').textContent = data.profile.businessName || data.profile.name;
    document.getElementById('providerType').textContent = "مقدم خدمة"; 
    document.getElementById('providerAvatar').textContent = 
      (data.profile.businessName || data.profile.name).charAt(0).toUpperCase();

    // Load social links
    if(data.settings?.social) {
      const s = data.settings.social;
      const bar = document.getElementById('providerSocialBar');
      let hasLinks = false;

      if(s.whatsapp) {
        const clean = s.whatsapp.replace(/[^0-9]/g, '');
        const full = clean.startsWith('0') ? '2' + clean : clean;
        const waMsg = encodeURIComponent(s.waMessage || 'مرحباً! حابب أحجز موعد لو سمحت 📅');
        const el = document.getElementById('bookWaLink');
        el.href = `https://wa.me/${full}?text=${waMsg}`;
        el.style.display = 'inline-flex';
        hasLinks = true;
      }
      if(s.instagram) {
        const handle = s.instagram.replace('@', '');
        const el = document.getElementById('bookIgLink');
        el.href = `https://instagram.com/${handle}`;
        el.style.display = 'inline-flex';
        hasLinks = true;
      }
      if(s.facebook) {
        const el = document.getElementById('bookFbLink');
        el.href = s.facebook.startsWith('http') ? s.facebook : `https://facebook.com/${s.facebook}`;
        el.style.display = 'inline-flex';
        hasLinks = true;
      }
      if(s.tiktok) {
        const handle = s.tiktok.replace('@', '');
        const el = document.getElementById('bookTkLink');
        el.href = `https://tiktok.com/@${handle}`;
        el.style.display = 'inline-flex';
        hasLinks = true;
      }
      if(s.website) {
        const el = document.getElementById('bookWebLink');
        el.href = s.website.startsWith('http') ? s.website : `https://${s.website}`;
        el.style.display = 'inline-flex';
        hasLinks = true;
      }

      if(hasLinks) bar.style.display = 'flex';
    }

    loadBookingServices();

  } catch(err) {
    console.error(err);
    document.getElementById('providerName').textContent = "حدث خطأ في التحميل";
    document.getElementById('providerAvatar').innerHTML = "❌";
  }
}

// Load services from Firestore
async function loadBookingServices() {
  try {
    const servicesQ = query(collection(db, 'services'), where('userId', '==', providerId));
    const servicesSnap = await getDocs(servicesQ);
    
    const list = document.getElementById('bookServicesList');
    
    if(servicesSnap.empty) {
      list.innerHTML = `
        <div style="text-align: center; padding: 24px;">
          <p style="color: var(--text-secondary);">لا توجد خدمات متاحة حالياً</p>
        </div>
      `;
      return;
    }
    
    const services = servicesSnap.docs.map(d => ({id: d.id, ...d.data()}));
    
    list.innerHTML = services.map(s => `
      <div class="book-service-card" data-id="${s.id}" onclick="window.selectService('${s.id}', '${s.name}', ${s.duration || 30}, ${s.price || 0})">
        <div class="book-service-info">
          <span class="book-service-name">${s.name}</span>
          <span class="book-service-duration">⏱️ ${s.duration || 30} دقيقة</span>
        </div>
        <div class="book-service-price">${s.price || 0} ج.م</div>
      </div>
    `).join('');
    
  } catch(e) {
    console.error(e);
  }
}

window.selectService = function(id, name, duration, price) {
  selectedService = { id, name, duration, price };
  
  document.querySelectorAll('.book-service-card').forEach(c => {
    c.classList.remove('selected');
    if(c.getAttribute('data-id') === id) c.classList.add('selected');
  });

  document.getElementById('btnNextStep1').disabled = false;
};

// Wizard Navigation
window.goBookStep = async function(step) {
  document.querySelectorAll('.book-step').forEach(el => el.style.display = 'none');
  document.getElementById(`bookStep${step}`).style.display = 'block';

  if(step === 2 && !document.getElementById('bookTimeSlots').innerHTML.trim()) {
    // Gen time slots
    const slots = ['09:00', '10:00', '11:30', '14:00', '16:00', '18:30'];
    document.getElementById('bookTimeSlots').innerHTML = slots.map(t => `
      <div class="book-service-card" style="text-align:center; padding:12px; font-family:var(--font-mono)" onclick="window.selectTime('${t}', this)">
        ${t}  
      </div>
    `).join('');
    
    // Set default date to today
    document.getElementById('bookDateInput').valueAsDate = new Date();
  }

  if(step === 3 && selectedService.price > 0) {
    const paySec = document.getElementById('paymentSection');
    const vcashOpt = document.getElementById('vodafoneCashOption');
    const vcashDisplay = document.getElementById('vcashNumberDisplay');
    
    paySec.classList.remove('hidden');
    document.getElementById('paymentPrice').textContent = `${selectedService.price} ج.م`;

    // Fetch provider payment settings
    try {
      const userDoc = await getDoc(doc(db, 'users', providerId));
      const pay = userDoc.data()?.settings?.payments;
      
      if(pay?.enableVodafoneCash && pay.vodafoneCash) {
        vcashOpt.classList.remove('hidden');
        vcashDisplay.textContent = pay.vodafoneCash;
      } else {
        vcashOpt.classList.add('hidden');
      }
    } catch(e) { console.error(e); }
  } else if (step === 3) {
    document.getElementById('paymentSection').classList.add('hidden');
  }
};

window.copyVcash = function() {
  const num = document.getElementById('vcashNumberDisplay').textContent;
  navigator.clipboard.writeText(num);
  showToast('تم نسخ الرقم بنجاح', 'success');
};

window.selectTime = function(time, el) {
  selectedTime = time;
  selectedDate = document.getElementById('bookDateInput').value;
  
  document.querySelectorAll('#bookTimeSlots .book-service-card').forEach(c => {
     c.classList.remove('selected');
  });
  el.classList.add('selected');
  
  document.getElementById('btnNextStep2').disabled = false;
};

document.getElementById('btnNextStep1')?.addEventListener('click', () => window.goBookStep(2));
document.getElementById('btnNextStep2')?.addEventListener('click', () => window.goBookStep(3));

// Confirm Booking
document.getElementById('btnConfirmBooking')?.addEventListener('click', async () => {
  if(!providerId) return;

  const name = document.getElementById('bookClientName').value.trim();
  const phone = document.getElementById('bookClientPhone').value.trim();
  const email = document.getElementById('bookClientEmail').value.trim();
  const notes = document.getElementById('bookClientNotes').value.trim();

  if(!name || !phone) {
    showToast('اكتب اسمك ورقم موبايلك من فضلك', 'error');
    return;
  }

  const btn = document.getElementById('btnConfirmBooking');
  btn.disabled = true;
  btn.textContent = 'جاري تأكيد التخزين... ⏳';

  try {
    const aptDate = new Date(selectedDate);
    // Save to appointments
    const aptStatus = selectedService.price > 0 ? 'awaiting_payment' : 'pending';
    
    await addDoc(collection(db, 'appointments'), {
      userId: providerId,
      clientName: name,
      clientPhone: phone,
      clientEmail: email,
      service: selectedService.name,
      duration: selectedService.duration,
      date: aptDate.getTime(),
      time: selectedTime,
      price: selectedService.price || 0,
      status: aptStatus,
      notes: notes,
      bookedByClient: true,
      createdAt: new Date().getTime()
    });

    // Update Success Message if awaiting payment
    if(aptStatus === 'awaiting_payment') {
      document.querySelector('#bookSuccess p').textContent = 'حجزك في انتظار تأكيد التحويل المالي عبر فودافون كاش.';
    }

    // Send Email Notifications (Background)
    try {
      const templateParams = {
        to_name: name,
        to_email: email,
        service_name: selectedService.name,
        booking_date: selectedDate,
        booking_time: selectedTime,
        business_name: document.getElementById('providerName').textContent,
        notes: notes
      };
      
      // Notify Client if email provided
      if(email) {
        sendEmailNotification(NOTIFICATION_TEMPLATES.CLIENT_CONFIRMATION, templateParams);
      }
      // Notify Provider (you would ideally fetch provider's email here)
      sendEmailNotification(NOTIFICATION_TEMPLATES.PROVIDER_NOTIFICATION, templateParams);
    } catch(e) {
      console.warn("Notification error:", e);
    }

    document.querySelectorAll('.book-step').forEach(el => el.style.display = 'none');
    document.getElementById('bookSuccess').style.display = 'block';

    // Summary 
    document.getElementById('bookingSummary').innerHTML = `
      <div class="summary-row"><span class="summary-label">الخدمة:</span><span class="summary-value">${selectedService.name}</span></div>
      <div class="summary-row"><span class="summary-label">التاريخ والوقت:</span><span class="summary-value" dir="ltr">${selectedDate} | ${selectedTime}</span></div>
      <div class="summary-row"><span class="summary-label">باسم:</span><span class="summary-value">${name}</span></div>
    `;

    // Add "Add to My Calendar" button
    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'btn-primary mt-16 w-full';
    calendarBtn.innerHTML = '<i class="ph-bold ph-calendar-plus"></i> إضافة لتقويمي (Google)';
    calendarBtn.onclick = () => {
      const start = new Date(aptDate);
      const [h, m] = selectedTime.split(':');
      start.setHours(parseInt(h), parseInt(m));
      const end = new Date(start.getTime() + (selectedService.duration || 30) * 60000);
      
      const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedService.name)}&dates=${start.toISOString().replace(/-|:|\.\d\d\d/g, '')}/${end.toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent('تم الحجز عبر BookFlow')}&location=${encodeURIComponent(document.getElementById('providerName').textContent)}`;
      window.open(gCalUrl, '_blank');
    };
    document.getElementById('bookingSummary').appendChild(calendarBtn);

  } catch(err) {
    console.error(err);
    showToast('حدث خطأ أثناء الاتصال بالنظام، جرب تاني', 'error');
    btn.disabled = false;
    btn.textContent = 'تأكيد الحجز ✅';
  }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadProvider();
});
