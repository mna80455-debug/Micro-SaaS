// dashboard.js
import { db } from './firebase-config.js';
import { 
  collection, query, where, getDocs, addDoc, 
  updateDoc, doc, getDoc, orderBy, increment,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { showToast } from './components/toast.js';
import { initI18n } from './i18n.js';
import { openWhatsAppNotify, scheduleAppointmentReminder, sendEmailNotification } from './notifications.js';

const auth = getAuth();

// Global fallback functions (available immediately even before modules load)
window.openNewAppointmentModal = function() {
  console.log('[BookFlow] openNewAppointmentModal called');
  const modal = document.getElementById('newAppointmentModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
};

// Debug helper
window.dbg = function(msg, data) {
  console.log('[BookFlow]', msg, data);
};

window.dbg('Starting...');

function initAuth() {
  onAuthStateChanged(auth, (user) => {
    window.dbg('Auth state:', user ? 'logged in' : 'not logged in');
    if (user) {
      window.currentUser = user;
      initDashboard(user);
    }
  });
}

// gcal loaded lazily to avoid breaking the module if gapi/google aren't ready
let _gcal = null;
async function getGcal() {
  if (!_gcal) {
    try { _gcal = await import('./gcal.js'); } catch(e) { console.warn('GCal module failed to load', e); _gcal = {}; }
  }
  return _gcal;
}
const initGcal = async () => { const m = await getGcal(); return m.initGcal?.(); };
const connectGcal = async () => { const m = await getGcal(); return m.connectGcal?.(); };
const addEventToGcal = async (d) => { const m = await getGcal(); return m.addEventToGcal?.(d); };

document.addEventListener('DOMContentLoaded', () => {
  window.dbg('DOM loaded');
  initAuth();
  initI18n();
  setupThemeToggle();
  setupLangToggle();
  setupRouting();
  
  import('./notifications.js').then(({ requestNotificationPermission }) => {
    requestNotificationPermission();
  }).catch(e => console.warn('Notification error:', e));
});

// Theme toggle - settings button only
function setupThemeToggle() {
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const currentTheme = localStorage.getItem('bookflow_theme');
  const isDark = currentTheme === 'dark';
  
  function toggleTheme() {
    const isDarkNow = document.documentElement.classList.toggle('dark-theme');
    localStorage.setItem('bookflow_theme', isDarkNow ? 'dark' : 'light');
    
    if (btnToggleTheme) {
      btnToggleTheme.innerHTML = isDarkNow ? '<i class="ph-bold ph-sun"></i> الوضع الفاتح' : '<i class="ph-bold ph-moon"></i> الوضع الداكن';
    }
  }
  
  btnToggleTheme?.addEventListener('click', toggleTheme);
  
  if (isDark) {
    document.documentElement.classList.add('dark-theme');
    if (btnToggleTheme) btnToggleTheme.innerHTML = '<i class="ph-bold ph-sun"></i> الوضع الفاتح';
  }
}

// Language toggle - translate entire site
function setupLangToggle() {
  const langBtn = document.getElementById('btnToggleLang');
  
  function toggleLang() {
    const currentLang = localStorage.getItem('bookflow_lang') || 'ar';
    const newLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('bookflow_lang', newLang);
    window.location.reload();
  }
  
  langBtn?.addEventListener('click', toggleLang);
}

// Initialize routing and theming
document.addEventListener('DOMContentLoaded', () => {
  console.log('[BookFlow] Dashboard loading...');
  setupThemeToggle();
  setupLangToggle();
  initI18n();
  setupRouting();
  
  // Request notification permission
  import('./notifications.js').then(({ requestNotificationPermission }) => {
    requestNotificationPermission();
  }).catch(e => console.warn('Notification error:', e));
});

// Setup Routing Logic with Event Delegation
function setupRouting() {
  console.log("BookFlow: Setting up routing...");
  
  // Use event delegation on the document or sidebar
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item[data-page]');
    if (!navItem) return;

    e.preventDefault();
    const pageId = navItem.getAttribute('data-page') + 'View';
    console.log("BookFlow: Navigating to", pageId);
    
    // Update active classes
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    navItem.classList.add('active');
    const targetView = document.getElementById(pageId);
    if (targetView) {
      targetView.classList.add('active');
      
      // Load specific data
      if(pageId === 'calendarView') window.renderCalendar();
      if(pageId === 'clientsView') loadClients();
      if(pageId === 'servicesView') loadServices();
      if(pageId === 'statsView') loadStats();
      if(pageId === 'settingsView') loadWorkHours();
    } else {
      console.warn("BookFlow: View not found:", pageId);
    }
  });
}

// Dashboard initialization is handled at the end of the file.

// Dashboard initialization
window.openNewAppointmentModal = function() {
  console.log('[BookFlow] openNewAppointmentModal called');
  const modal = document.getElementById('newAppointmentModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Reset to step 1 every time
    window.modalGoToStep(1);
    
    // Set default date to today
    const dateInput = document.getElementById('aptDate');
    if(dateInput) dateInput.valueAsDate = new Date();
  }
};

// Switch between modal steps (step 1: client info, step 2: appointment details)
window.modalGoToStep = function(step) {
  const step1 = document.getElementById('modalStep1');
  const step2 = document.getElementById('modalStep2');
  const ind1 = document.getElementById('step1Ind');
  const ind2 = document.getElementById('step2Ind');

  if (step === 1) {
    if(step1) step1.style.display = '';
    if(step2) step2.style.display = 'none';
    if(ind1) ind1.classList.add('active');
    if(ind2) ind2.classList.remove('active');
  } else {
    // Validate step 1 before going to step 2
    const clientName = document.getElementById('aptClientName');
    const phone = document.getElementById('aptClientPhone');
    if(!clientName?.value.trim()) {
      clientName.style.borderColor = 'var(--cancelled)';
      if(window.showToast) window.showToast('يرجى إدخال اسم العميل', 'error');
      return;
    }
    clientName.style.borderColor = '';
    if(step1) step1.style.display = 'none';
    if(step2) step2.style.display = '';
    if(ind1) ind1.classList.remove('active');
    if(ind2) ind2.classList.add('active');
  }
};

// Animation helper
function animateValue(id, start, end, duration) {
  const obj = typeof id === 'string' ? document.getElementById(id) : id;
  if (!obj) return;
  if(end === start) { obj.textContent = end; return; }
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end;
    }
  };
  window.requestAnimationFrame(step);
}

async function loadDashboardStats(userId) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const q = query(collection(db, 'appointments'), where('userId', '==', userId));
    const snap = await getDocs(q);
    
    let todayCount = 0;
    let pendingCount = 0;
    let monthlyRev = 0;
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    snap.forEach(doc => {
      const data = doc.data();
      if(data.date >= today.getTime() && data.date < tomorrow.getTime()) todayCount++;
      if(data.status === 'pending' || data.status === 'awaiting_payment') pendingCount++;
      if(data.date >= firstDay.getTime() && data.status === 'completed') {
        monthlyRev += (data.price || 0);
      }
    });

    animateValue('statToday', 0, todayCount, 800);
    document.getElementById('todayCountBadge').textContent = todayCount;
    if(todayCount > 0) document.getElementById('todayCountBadge').classList.add('show');
    else document.getElementById('todayCountBadge').classList.remove('show');
    
    animateValue('statPending', 0, pendingCount, 800);
    animateValue('statRevenue', 0, monthlyRev, 800);

  } catch (err) {
    console.error("Stats error", err);
    document.getElementById('statToday').textContent = '0';
    document.getElementById('statPending').textContent = '0';
  }
}

async function loadTodayTimeline(userId) {
  const tl = document.getElementById('todayTimeline');
  if(!tl) return;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const q = query(collection(db, 'appointments'), where('userId', '==', userId));
    const snap = await getDocs(q);
    
    let apts = [];
    snap.forEach(d => {
      const data = d.data();
      if(data.date >= today.getTime() && data.date < tomorrow.getTime()) {
        apts.push({id: d.id, ...data});
      }
    });

    if(apts.length === 0) {
      tl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3 class="empty-title">مفيش مواعيد النهاردة</h3>
          <p class="empty-sub">استمتع بوقتك أو ابدأ بإضافة موعد جديد</p>
        </div>
      `;
      return;
    }

    apts.sort((a,b) => a.time.localeCompare(b.time));

    const statusLabels = {
      'confirmed': 'مؤكد',
      'pending': 'منتظر',
      'awaiting_payment': 'انتظار الدفع',
      'completed': 'اكتمل',
      'cancelled': 'ملغي'
    };

    const statusColors = {
      'confirmed': '#0066FF',
      'pending': '#F59E0B',
      'awaiting_payment': '#E60000',
      'completed': '#10B981',
      'cancelled': '#EF4444'
    };

    tl.innerHTML = apts.map((apt, index) => `
      <div class="timeline-item fade-in-right stagger-${(index % 10) + 1}" onclick="window.openAptDetails('${apt.id}')" style="cursor: pointer;">
        <div class="timeline-time">${apt.time}</div>
        <div class="timeline-dot" style="background:${statusColors[apt.status] || 'var(--teal)'}; box-shadow: 0 0 8px ${statusColors[apt.status]}55"></div>
        <div class="timeline-content">
          <div class="timeline-client">${apt.clientName}</div>
          <div class="timeline-service">${apt.service}</div>
        </div>
        <div class="timeline-right" style="display: flex; gap: 8px; flex-direction: row; align-items: center;">
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="status-chip" style="color:${statusColors[apt.status]}; background:${statusColors[apt.status]}22">
              ${statusLabels[apt.status]}
            </span>
            <span class="timeline-price">${apt.price || 0} ج.م</span>
          </div>
          ${apt.status !== 'completed' && apt.status !== 'cancelled' ? `
            <div style="display: flex; flex-direction: column; gap: 4px; margin-right: 12px;">
              ${apt.clientPhone ? `<button title="واتساب" onclick="event.stopPropagation(); window.openWhatsApp('${apt.clientPhone}', '${apt.clientName}')" style="background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.25); border-radius: 4px; padding: 4px; color: #25D366;"><i class="ph-fill ph-whatsapp-logo"></i></button>` : ''}
              ${apt.clientPhone ? `<button title="إرسال تأكيد" onclick="event.stopPropagation(); window.notifyClientViaWA('${apt.id}')" style="background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.25); border-radius: 4px; padding: 4px; color: var(--primary);"><i class="ph-bold ph-paper-plane-tilt"></i></button>` : ''}
              ${apt.status === 'awaiting_payment' ? `<button title="تأكيد الدفع" onclick="event.stopPropagation(); window.updateAptStatus('${apt.id}', 'confirmed')" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 4px; padding: 4px; color: #10B981;"><i class="ph-bold ph-money"></i></button>` : ''}
              <button title="اكتمل" onclick="event.stopPropagation(); window.updateAptStatus('${apt.id}', 'completed')" style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; padding: 4px; color: var(--completed);"><i class="ph-bold ph-check"></i></button>
              <button title="إلغاء" onclick="event.stopPropagation(); window.updateAptStatus('${apt.id}', 'cancelled')" style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; padding: 4px; color: var(--cancelled);"><i class="ph-bold ph-x"></i></button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

  } catch(e) {
    tl.innerHTML = 'خطأ في جلب المواعيد';
  }
}

async function loadAIRecommendations() {
  const container = document.getElementById('aiRecommendations');
  if (!container || !window.currentUser) return;
  
  try {
    const db = await import('./firebase-config.js').then(m => m.db);
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    const q = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);
    const allApts = snap.docs.map(d => d.data());
    
    if (allApts.length < 5) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    
    const now = new Date();
    const weekAgo = now.getTime() - 7*24*60*60*1000;
    const recentApts = allApts.filter(a => a.date >= weekAgo);
    
    // Calculate insights
    const completed = recentApts.filter(a => a.status === 'completed').length;
    const cancelled = recentApts.filter(a => a.status === 'cancelled').length;
    const pending = recentApts.filter(a => a.status === 'pending').length;
    
    const revenue = completed.reduce((sum, a) => sum + (a.price || 0), 0);
    const clients = new Set(recentApts.map(a => a.clientPhone)).size;
    
    const html = `
      <div class="recommendation-card">
        <h4>🧠 توصيات FlowAI</h4>
        <div class="rec-items">
          ${cancelled > completed * 0.3 ? '<div class="rec-item warning">⚠️ نسبة الإلغاء عالية - فكر في تفعيل التذكيرات</div>' : ''}
          ${pending > 5 ? '<div class="rec-item">⏰ عندك ' + pending + ' مواعيد.pending - تأكد منها</div>' : ''}
          ${revenue > 0 ? '<div class="rec-item">💰 إيرادات الأسبوع: ' + revenue + ' ج.م</div>' : ''}
          ${clients > 0 ? '<div class="rec-item">👥 عملاء جدد: ' + clients + '</div>' : ''}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  } catch(e) {
    console.error('AI Rec error:', e);
  }
}

window.updateAptStatus = async function(id, status) {
  try {
    await updateDoc(doc(db, 'appointments', id), { status });
    showToast('تم تحديث الحالة بنجاح', 'success');
    loadTodayTimeline(window.currentUser.uid);
    if(window.renderCalendar) window.renderCalendar();
  } catch(err) {
    showToast('خطأ أثناء التحديث', 'error');
  }
}

async function loadClients() {
  const container = document.getElementById('clientsList');
  try {
    const q = query(collection(db, 'clients'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3 class="empty-title">مفيش عملاء لحد دلوقتي</h3>
          <p class="empty-sub">ابدأ بإضافة أول عميل أو اطلب منهم الحجز من الرابط الخاص بك</p>
        </div>
      `;
      return;
    }

    const clients = snap.docs.map(d => ({id: d.id, ...d.data()}));
    
    // Add loyalty badges
    const getBadge = (visits) => {
      if (visits >= 20) return '<span class="badge-vip">💎 VIP</span>';
      if (visits >= 10) return '<span class="badge-gold">🥇 ذهبي</span>';
      if (visits >= 5) return '<span class="badge-silver">🥈 فضي</span>';
      return '';
    };
    
    container.innerHTML = clients.map((client, index) => `
      <div class="client-card fade-up stagger-${(index % 10) + 1}" onclick="window.openEditClientModal('${client.id}')">
        <div class="client-avatar">${client.name.charAt(0).toUpperCase()}</div>
        <div class="client-info">
          <span class="client-name">${client.name}</span>
          <span class="client-phone">${client.phone || '—'}</span>
          ${getBadge(client.totalVisits || 0)}
        </div>
        <div class="client-stats">
          <span class="client-visits">${client.totalVisits || 1} زيارة</span>
        </div>
        <div class="client-actions" style="display: flex; gap: 8px; align-items: center;">
          ${client.phone ? `<button class="btn-whatsapp-quick" onclick="event.stopPropagation(); window.openWhatsApp('${client.phone}', '${client.name}')"><i class="ph-fill ph-whatsapp-logo"></i> واتساب</button>` : ''}
          <button class="btn-quick-book" onclick="event.stopPropagation(); window.openNewAppointmentModal()">+ حجز</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

window.saveNewClientForm = async function() {
  const name = document.getElementById('newClientNameInput');
  const phone = document.getElementById('newClientPhoneInput');
  
  name.style.borderColor = 'var(--border)';
  if(!name.value.trim()) {
    name.style.borderColor = 'var(--cancelled)';
    showToast('يرجى ادخال اسم العميل', 'error');
    return;
  }

  const btn = document.querySelector('[onclick="window.saveNewClientForm()"]');
  if(btn) btn.classList.add('btn-loading');

  try {
    await addDoc(collection(db, 'clients'), {
      userId: window.currentUser.uid,
      name: name.value.trim(),
      phone: phone.value.trim() || '',
      totalVisits: 0,
      createdAt: new Date().getTime()
    });
    showToast('تم اضافة العميل بنجاح', 'success');
    name.value = '';
    phone.value = '';
    window.closeModal('newClientModal');
    loadClients();
  } catch(e) {
    showToast('خطأ اثناء الإضافة', 'error');
  } finally {
    if(btn) btn.classList.remove('btn-loading');
  }
}

// Saving Appointment
btnSaveAppointment?.addEventListener('click', async () => {
  if(!window.currentUser) return;
  
  const clientName = document.getElementById('aptClientName').value.trim();
  const phone = document.getElementById('aptClientPhone').value.trim();
  const service = document.getElementById('aptService').value.trim();
  const dateVal = document.getElementById('aptDate').value;
  const timeVal = document.getElementById('aptTime').value;
  const price = document.getElementById('aptPrice').value;
  const status = document.getElementById('aptStatus').value;

  const clientInput = document.getElementById('aptClientName');
  const dateInput = document.getElementById('aptDate');
  const timeInput = document.getElementById('aptTime');

  let hasError = false;
  [clientInput, dateInput, timeInput].forEach(inp => {
    inp.style.borderColor = 'var(--border)';
    if(!inp.value.trim()) {
      inp.style.borderColor = 'var(--cancelled)';
      hasError = true;
    }
  });

  if(hasError) {
    showToast('يرجى تحديد الحقول المطلوبة باللون الأحمر', 'error');
    return;
  }

  try {
    btnSaveAppointment.disabled = true;
    btnSaveAppointment.classList.add('btn-loading');
    const dateObj = new Date(dateVal);
    
    const aptData = {
      userId: window.currentUser.uid,
      clientName,
      clientPhone: phone,
      service: service || 'خدمة عامة',
      date: dateObj.getTime(), // ms timestamp for easy querying
      time: timeVal,
      price: parseFloat(price) || 0,
      status,
      createdAt: new Date().getTime()
    };

    // Save to appointments
    await addDoc(collection(db, 'appointments'), aptData);

    // Sync with Google Calendar (Optional/Background)
    if(localStorage.getItem('gcal_token')) {
      addEventToGcal(aptData).catch(e => console.warn("GCal sync error", e));
    }

    // Send confirmation email to client
    if(phone && phone.includes('@')) {
      sendEmailNotification('template_client_new', {
        client_name: clientName,
        service_name: service || 'خدمة عامة',
        appointment_date: dateVal,
        appointment_time: timeVal,
        business_name: window.currentUser?.displayName || 'مكتبك'
      }).catch(e => console.warn("Email send error", e));
    }

    // Send notification to provider
    sendEmailNotification('template_provider_new', {
      client_name: clientName,
      client_phone: phone,
      service_name: service || 'خدمة عامة',
      appointment_date: dateVal,
      appointment_time: timeVal
    }).catch(e => console.warn("Provider email error", e));

    // Save/Update Client quick path (simplified for demo)
    await addDoc(collection(db, 'clients'), {
       userId: window.currentUser.uid,
       name: clientName,
       phone,
       totalVisits: 1,
       createdAt: new Date().getTime()
    });

    showToast('تم حفظ الموعد ✅', 'success');
    
    // Schedule browser reminder (1 hour before)
    scheduleAppointmentReminder(aptData, 60);
    
    window.closeModal('newAppointmentModal');
    
    // Reset form
    document.getElementById('aptClientName').value = '';
    document.getElementById('aptService').value = '';
    
    // Reload pages
    loadDashboardStats(window.currentUser.uid);
    loadTodayTimeline(window.currentUser.uid);
    if(window.renderCalendar) window.renderCalendar();
    
  } catch (err) {
    console.error(err);
    showToast('خطأ في الحفظ', 'error');
  } finally {
    btnSaveAppointment.disabled = false;
    btnSaveAppointment.classList.remove('btn-loading');
  }
});

// Settings Save
btnSaveSettings?.addEventListener('click', async () => {
  const name = document.getElementById('settingName').value;
  const business = document.getElementById('settingBusiness').value;
  const link = document.getElementById('bookingUsername').value.trim();

  btnSaveSettings.classList.add('btn-loading');

  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'profile.name': name,
      'profile.businessName': business,
      'settings.bookingLink': link
    });
    showToast('تم حفظ الإعدادات', 'success');
    document.getElementById('sidebarName').textContent = name;
  } catch (err) {
    showToast('خطأ في الحفظ', 'error');
  } finally {
    btnSaveSettings.classList.remove('btn-loading');
  }
});

// Settings Copy Link
btnCopyLink?.addEventListener('click', () => {
  const link = document.getElementById('bookingUsername').value.trim();
  if(!link) return;
  const fullUrl = `${window.location.origin}/booking.html?p=${link}`;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('تم نسخ الرابط 📋', 'success');
  });
});

// ==================== SERVICES CRUD ====================
async function loadServices() {
  const container = document.getElementById('servicesList');
  if(!container) return;

  try {
    const q = query(collection(db, 'services'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚙️</div>
          <h3 class="empty-title">لم يتم إضافة خدمات</h3>
          <p class="empty-sub">أضف خدماتك ليتمكن العملاء من الاختيار منها عند الحجز</p>
          <button class="btn-primary" onclick="window.openModal('newServiceModal')">أضف خدمة</button>
        </div>
      `;
      return;
    }

    const services = snap.docs.map(d => ({id: d.id, ...d.data()}));

    container.innerHTML = `
      <div class="services-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
        ${services.map(s => `
          <div class="service-card" onclick="window.openEditServiceModal('${s.id}')" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div class="service-name" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">${s.name}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${s.duration || 30} دقيقة</div>
              </div>
              <div style="font-weight: 700; font-size: 1.25rem; color: var(--teal);">${s.price || 0} <span style="font-size: 0.8rem;">ج.م</span></div>
            </div>
            ${s.description ? `<p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-secondary);">${s.description}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Also populate service dropdown in new appointment modal
    const aptServiceSelect = document.getElementById('aptService');
    if(aptServiceSelect) {
      aptServiceSelect.innerHTML = '<option value="">اختر خدمة...</option>' +
        services.map(s => `<option value="${s.name}" data-price="${s.price}" data-duration="${s.duration}">${s.name} (${s.price} ج.م)</option>`).join('');
    }

  } catch(e) {
    console.error(e);
  }
}

window.saveNewService = async function() {
  const name = document.getElementById('newServiceName');
  const duration = document.getElementById('newServiceDuration');
  const price = document.getElementById('newServicePrice');
  const description = document.getElementById('newServiceDesc');

  if(!name.value.trim()) {
    name.style.borderColor = 'var(--cancelled)';
    showToast('يرجى إدخال اسم الخدمة', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'services'), {
      userId: window.currentUser.uid,
      name: name.value.trim(),
      duration: parseInt(duration.value) || 30,
      price: parseFloat(price.value) || 0,
      description: description.value.trim() || '',
      createdAt: new Date().getTime()
    });
    showToast('تم إضافة الخدمة بنجاح', 'success');
    window.closeModal('newServiceModal');
    name.value = '';
    duration.value = '30';
    price.value = '0';
    description.value = '';
    loadServices();
  } catch(e) {
    showToast('خطأ في الإضافة', 'error');
  }
};

window.openEditServiceModal = async function(serviceId) {
  try {
    const docSnap = await getDoc(doc(db, 'services', serviceId));
    if(!docSnap.exists()) return;

    const s = docSnap.data();
    document.getElementById('editServiceId').value = serviceId;
    document.getElementById('editServiceName').value = s.name;
    document.getElementById('editServiceDuration').value = s.duration || 30;
    document.getElementById('editServicePrice').value = s.price || 0;
    document.getElementById('editServiceDesc').value = s.description || '';
    window.openModal('editServiceModal');
  } catch(e) {
    showToast('خطأ في التحميل', 'error');
  }
};

window.updateService = async function() {
  const id = document.getElementById('editServiceId').value;
  const name = document.getElementById('editServiceName').value;
  const duration = document.getElementById('editServiceDuration').value;
  const price = document.getElementById('editServicePrice').value;
  const description = document.getElementById('editServiceDesc').value;

  if(!name.trim()) {
    showToast('يرجى إدخال اسم الخدمة', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'services', id), {
      name, duration: parseInt(duration), price: parseFloat(price), description
    });
    showToast('تم تحديث الخدمة', 'success');
    window.closeModal('editServiceModal');
    loadServices();
  } catch(e) {
    showToast('خطأ في التحديث', 'error');
  }
};

window.deleteService = async function() {
  if(!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
  const id = document.getElementById('editServiceId').value;

  try {
    await deleteDoc(doc(db, 'services', id));
    showToast('تم حذف الخدمة', 'success');
    window.closeModal('editServiceModal');
    loadServices();
  } catch(e) {
    showToast('خطأ في الحذف', 'error');
  }
};

// ==================== APPOINTMENT DETAILS ====================
window.openAptDetails = async function(aptId) {
  try {
    const docSnap = await getDoc(doc(db, 'appointments', aptId));
    if(!docSnap.exists()) return;

    const apt = docSnap.data();
    const aptDate = new Date(apt.date);

    document.getElementById('editAptId').value = aptId;
    document.getElementById('editAptClientName').value = apt.clientName;
    document.getElementById('editAptClientPhone').value = apt.clientPhone || '';
    document.getElementById('editAptService').value = apt.service;
    document.getElementById('editAptDate').value = aptDate.toISOString().split('T')[0];
    document.getElementById('editAptTime').value = apt.time;
    document.getElementById('editAptPrice').value = apt.price || 0;
    document.getElementById('editAptStatus').value = apt.status;
    document.getElementById('editAptNotes').value = apt.notes || '';

    window.openModal('aptDetailsModal');
  } catch(e) {
    showToast('خطأ في التحميل', 'error');
  }
};

window.updateAppointment = async function() {
  const id = document.getElementById('editAptId').value;
  const clientName = document.getElementById('editAptClientName').value.trim();
  const clientPhone = document.getElementById('editAptClientPhone').value.trim();
  const service = document.getElementById('editAptService').value.trim();
  const dateVal = document.getElementById('editAptDate').value;
  const time = document.getElementById('editAptTime').value;
  const price = parseFloat(document.getElementById('editAptPrice').value) || 0;
  const status = document.getElementById('editAptStatus').value;
  const notes = document.getElementById('editAptNotes').value.trim();

  if(!clientName || !dateVal || !time) {
    showToast('يرجى تعبئة الحقول المطلوبة', 'error');
    return;
  }

  try {
    const dateObj = new Date(dateVal);
    await updateDoc(doc(db, 'appointments', id), {
      clientName, clientPhone, service,
      date: dateObj.getTime(), time, price, status, notes
    });
    showToast('تم تحديث الموعد', 'success');
    window.closeModal('aptDetailsModal');
    loadTodayTimeline(window.currentUser.uid);
    if(window.renderCalendar) window.renderCalendar();
  } catch(e) {
    showToast('خطأ في التحديث', 'error');
  }
};

window.deleteAppointment = async function() {
  if(!confirm('هل أنت متأكد من حذف هذا الموعد؟')) return;
  const id = document.getElementById('editAptId').value;

  try {
    await deleteDoc(doc(db, 'appointments', id));
    showToast('تم حذف الموعد', 'success');
    window.closeModal('aptDetailsModal');
    loadTodayTimeline(window.currentUser.uid);
    if(window.renderCalendar) window.renderCalendar();
  } catch(e) {
    showToast('خطأ في الحذف', 'error');
  }
};

// ==================== CLIENT SEARCH ====================
window.searchClients = async function(searchQuery) {
  const container = document.getElementById('clientsList');
  if(!container || !window.currentUser) return;

  try {
    const q = query(collection(db, 'clients'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);

    let clients = snap.docs.map(d => ({id: d.id, ...d.data()}));

    if(searchQuery && searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      clients = clients.filter(c => 
        c.name.toLowerCase().includes(qLower) || 
        (c.phone && c.phone.includes(qLower))
      );
    }

    if (clients.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3 class="empty-title">${query ? 'لا توجد نتائج' : 'مفيش عملاء لحد دلوقتي'}</h3>
          <p class="empty-sub">${query ? 'جرب بحث مختلف' : 'ابدأ بإضافة أول عميل أو اطلب منهم الحجز من الرابط الخاص بك'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = clients.map(client => `
      <div class="client-card" onclick="window.openEditClientModal('${client.id}')">
        <div class="client-avatar">${client.name.charAt(0).toUpperCase()}</div>
        <div class="client-info">
          <span class="client-name">${client.name}</span>
          <span class="client-phone">${client.phone || '—'}</span>
        </div>
        <div class="client-stats">
          <span class="client-visits">${client.totalVisits || 1} زيارة</span>
        </div>
        <div class="client-actions">
          <button class="btn-quick-book" onclick="event.stopPropagation(); window.openNewAppointmentModal()">+ حجز</button>
        </div>
      </div>
    `).join('');

  } catch(e) {
    console.error(e);
  }
};

window.openEditClientModal = async function(clientId) {
  try {
    const docSnap = await getDoc(doc(db, 'clients', clientId));
    if(!docSnap.exists()) return;

    const c = docSnap.data();
    document.getElementById('editClientId').value = clientId;
    document.getElementById('editClientName').value = c.name;
    document.getElementById('editClientPhone').value = c.phone || '';
    document.getElementById('editClientEmail').value = c.email || '';
    document.getElementById('editClientNotes').value = c.notes || '';
    window.openModal('editClientModal');
  } catch(e) {
    showToast('خطأ في التحميل', 'error');
  }
};

window.updateClient = async function() {
  const id = document.getElementById('editClientId').value;
  const name = document.getElementById('editClientName').value.trim();
  const phone = document.getElementById('editClientPhone').value.trim();
  const email = document.getElementById('editClientEmail').value.trim();
  const notes = document.getElementById('editClientNotes').value.trim();

  if(!name) {
    showToast('يرجى إدخال اسم العميل', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'clients', id), { name, phone, email, notes });
    showToast('تم تحديث بيانات العميل', 'success');
    window.closeModal('editClientModal');
    loadClients();
  } catch(e) {
    showToast('خطأ في التحديث', 'error');
  }
};

window.deleteClient = async function() {
  if(!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
  const id = document.getElementById('editClientId').value;

  try {
    await deleteDoc(doc(db, 'clients', id));
    showToast('تم حذف العميل', 'success');
    window.closeModal('editClientModal');
    loadClients();
  } catch(e) {
    showToast('خطأ في الحذف', 'error');
  }
};

// ==================== STATS ====================
async function loadStats() {
  if(!window.currentUser) return;

  // Load Chart.js if not loaded
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => renderCharts();
    document.head.appendChild(script);
  } else {
    renderCharts();
  }

  async function renderCharts() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    try {
      const allAptsQ = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
      const allAptsSnap = await getDocs(allAptsQ);
      const allApts = allAptsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const completedApts = allApts.filter(a => a.status === 'completed');

      animateValue('statTotalApts', 0, allApts.length, 600);
      animateValue('statCompletedApts', 0, completedApts.length, 600);
      animateValue('statTotalRevenue', 0, completedApts.reduce((sum, a) => sum + (a.price || 0), 0), 800);
      animateValue('statTotalClients', 0, allApts.length ? new Set(allApts.map(a => a.clientPhone)).size : 0, 600);

      // Monthly Revenue Chart (last 6 months)
      const months = [];
      const monthRevenue = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d.getTime();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
        const monthName = d.toLocaleDateString('ar', { month: 'short' });
        months.push(monthName);
        
        const mRev = allApts.filter(a => a.date >= start && a.date <= end && a.status === 'completed')
                        .reduce((sum, a) => sum + (a.price || 0), 0);
        monthRevenue.push(mRev);
      }

      const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
      if (revenueCtx) {
        new Chart(revenueCtx, {
          type: 'bar',
          data: {
            labels: months,
            datasets: [{
              label: 'الإيرادات (ج.م)',
              data: monthRevenue,
              backgroundColor: '#10B981',
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // Status Chart (Doughnut)
      const statusCounts = {
        completed: allApts.filter(a => a.status === 'completed').length,
        pending: allApts.filter(a => a.status === 'pending').length,
        cancelled: allApts.filter(a => a.status === 'cancelled').length
      };

      const statusCtx = document.getElementById('statusChart')?.getContext('2d');
      if (statusCtx) {
        new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: ['مكتمل', 'مؤكد', 'ملغى'],
            datasets: [{
              data: [statusCounts.completed, statusCounts.pending, statusCounts.cancelled],
              backgroundColor: ['#10B981', '#F59E0B', '#EF4444']
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } }
          }
        });

        const legendEl = document.getElementById('statusLegend');
        if (legendEl) {
          legendEl.innerHTML = `
            <div class="stat-row"><span class="dot green"></span> مكتمل: ${statusCounts.completed}</div>
            <div class="stat-row"><span class="dot amber"></span> مؤكد: ${statusCounts.pending}</div>
            <div class="stat-row"><span class="dot danger"></span> ملغى: ${statusCounts.cancelled}</div>
          `;
        }
      }

      // Top clients
      const clientBookings = {};
      allApts.forEach(apt => {
        const key = apt.clientName;
        if(!clientBookings[key]) clientBookings[key] = { name: apt.clientName, count: 0, spent: 0 };
        clientBookings[key].count++;
        clientBookings[key].spent += apt.price || 0;
      });

      const topClients = Object.values(clientBookings).sort((a, b) => b.count - a.count).slice(0, 5);
      const topContainer = document.getElementById('topClientsList');

      if(topContainer) {
        if(topClients.length === 0) {
          topContainer.innerHTML = '<p style="color: var(--text-secondary);">لا توجد بيانات بعد</p>';
        } else {
          let html = '';
          topClients.forEach((c, i) => {
            html += '<div class="client-card" style="cursor: default;">';
            html += '<div style="font-weight: 700; width: 24px;">' + (i + 1) + '</div>';
            html += '<div class="client-avatar">' + c.name.charAt(0).toUpperCase() + '</div>';
            html += '<div class="client-info">';
            html += '<span class="client-name">' + c.name + '</span>';
            html += '<span class="client-phone">' + c.count + ' حجز، ' + c.spent + ' ج.م</span>';
            html += '</div></div>';
          });
          topContainer.innerHTML = html;
        }
      }

    } catch(e) {
      console.error('Stats error:', e);
    }
  }
}

  } catch(e) {
    console.error(e);
  }
}

// ==================== WORK HOURS ====================
document.getElementById('btnSaveWorkHours')?.addEventListener('click', async () => {
  const startTime = document.getElementById('settingStartTime').value;
  const endTime = document.getElementById('settingEndTime').value;
  const slotDuration = document.getElementById('settingSlotDuration').value;
  const workDays = Array.from(document.querySelectorAll('#workDaysContainer input:checked')).map(cb => parseInt(cb.value));

  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.workHours': {
        start: startTime,
        end: endTime,
        slotDuration: parseInt(slotDuration),
        workDays: workDays.length ? workDays : [1,2,3,4,5]
      }
    });
    showToast('تم حفظ مواعيد العمل', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
});

// Load work hours & payment settings on init
async function loadWorkHours() {
  if(!window.currentUser) return;
  try {
    const userDoc = await getDoc(doc(db, 'users', window.currentUser.uid));
    const data = userDoc.data();
    
    // Work Hours
    const wh = data?.settings?.workHours;
    if(wh) {
      document.getElementById('settingStartTime').value = wh.start || '09:00';
      document.getElementById('settingEndTime').value = wh.end || '18:00';
      document.getElementById('settingSlotDuration').value = wh.slotDuration || 30;
      document.querySelectorAll('#workDaysContainer input').forEach(cb => {
        cb.checked = wh.workDays?.includes(parseInt(cb.value));
      });
    }

    // Payments
    const pay = data?.settings?.payments;
    if(pay) {
      document.getElementById('settingVodafoneCash').value = pay.vodafoneCash || '';
      document.getElementById('enableVodafoneCash').checked = pay.enableVodafoneCash ?? true;
      document.getElementById('settingStripeKey').value = pay.stripeKey || '';
      document.getElementById('enableStripe').checked = pay.enableStripe ?? false;
    }
  } catch(e) { console.error(e); }
}

document.getElementById('btnSavePayments')?.addEventListener('click', async () => {
  const vcash = document.getElementById('settingVodafoneCash').value;
  const enableVcash = document.getElementById('enableVodafoneCash').checked;
  const stripeKey = document.getElementById('settingStripeKey').value;
  const enableStripe = document.getElementById('enableStripe').checked;

  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.payments': {
        vodafoneCash: vcash,
        enableVodafoneCash: enableVcash,
        stripeKey: stripeKey,
        enableStripe: enableStripe
      }
    });
    showToast('تم حفظ إعدادات الدفع بنجاح', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
});

// Update initDashboard to load all
window.initDashboard = async function(user) {
  // 1. Setup UI interactivity IMMEDIATELY
  setupRouting();
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    if(userData) {
      document.getElementById('sidebarName').textContent = userData.profile.name || 'مستخدم';
      document.getElementById('sidebarPlan').textContent = userData.profile.plan || 'Free';
      document.getElementById('sidebarAvatar').textContent = (userData.profile.name || 'م')[0].toUpperCase();
      document.getElementById('greetingText').textContent = `صباح الخير، ${userData.profile.name.split(' ')[0]} 👋`;
      document.getElementById('settingName').value = userData.profile.name || '';
      document.getElementById('settingBusiness').value = userData.profile.businessName || '';
      if(userData.settings?.bookingLink) {
        document.getElementById('bookingUsername').value = userData.settings.bookingLink;
      }
      // Load social settings
      if(userData.settings?.social) {
        const s = userData.settings.social;
        if(s.whatsapp) document.getElementById('settingWhatsApp').value = s.whatsapp;
        if(s.instagram) document.getElementById('settingInstagram').value = s.instagram;
        if(s.facebook) document.getElementById('settingFacebook').value = s.facebook;
        if(s.tiktok) document.getElementById('settingTikTok').value = s.tiktok;
        if(s.website) document.getElementById('settingWebsite').value = s.website;
        if(s.waMessage) document.getElementById('settingWaMessage').value = s.waMessage;
      }
    }

    const todayOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('greetingDate').textContent = new Date().toLocaleDateString('ar-EG', todayOpts);

    await loadDashboardStats(user.uid);
    await loadTodayTimeline(user.uid);
    await loadServices();
    await loadWorkHours();
    loadStats();
    
    // Initialize GCal
    try {
      await initGcal();
      if(localStorage.getItem('gcal_token')) {
        document.getElementById('gcalStatusText').textContent = '✅ متصل بتقويم جوجل';
        document.getElementById('btnConnectGcal').textContent = 'إعادة الربط';
      }
    } catch(e) { console.warn("GCal init failed", e); }

  } catch (error) {
    console.error("Dashboard init error", error);
  }
};

// Global exposure
window.initDashboard = initDashboard;

window.handleConnectGcal = async function() {
  try {
    await connectGcal();
    document.getElementById('gcalStatusText').textContent = '✅ متصل بتقويم جوجل';
    document.getElementById('btnConnectGcal').textContent = 'إعادة الربط';
    showToast('تم ربط تقويم جوجل بنجاح', 'success');
  } catch(e) {
    showToast('خطأ في الربط', 'error');
  }
};

// ==================== SOCIAL MEDIA & WHATSAPP ====================

// Save Social Settings
document.getElementById('btnSaveSocial')?.addEventListener('click', async () => {
  if(!window.currentUser) return;
  const btn = document.getElementById('btnSaveSocial');
  btn.classList.add('btn-loading');

  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.social': {
        whatsapp: document.getElementById('settingWhatsApp').value.trim(),
        instagram: document.getElementById('settingInstagram').value.trim(),
        facebook: document.getElementById('settingFacebook').value.trim(),
        tiktok: document.getElementById('settingTikTok').value.trim(),
        website: document.getElementById('settingWebsite').value.trim(),
        waMessage: document.getElementById('settingWaMessage').value.trim()
      }
    });
    showToast('تم حفظ بيانات التواصل ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

// Test WhatsApp Link
window.testWhatsApp = function() {
  const phone = document.getElementById('settingWhatsApp').value.trim();
  if(!phone) {
    showToast('يرجى إدخال رقم واتساب أولاً', 'error');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const fullPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
  const msg = encodeURIComponent(document.getElementById('settingWaMessage').value || '');
  window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
};

// WhatsApp Quick Contact (from client card or timeline)
window.openWhatsApp = function(phone, clientName) {
  if(!phone) {
    showToast('لا يوجد رقم هاتف لهذا العميل', 'error');
    return;
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const fullPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
  const msg = encodeURIComponent(`مرحباً ${clientName}! 😊`);
  window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
};

window.notifyClientViaWA = async function(aptId) {
  try {
    const docSnap = await getDoc(doc(db, 'appointments', aptId));
    if(!docSnap.exists()) return;
    const apt = docSnap.data();
    
    // Convert timestamp to readable date for the message
    const date = new Date(apt.date);
    apt.dateStr = date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    openWhatsAppNotify(apt);
  } catch(e) {
    console.error(e);
    showToast('خطأ في إرسال الإشعار', 'error');
  }
};

// ==================== EXPORT FUNCTIONS ====================
window.exportToExcel = async function() {
  try {
    const wb = { sheets: {} };
    const appointmentsSheet = [];
    const clientsSheet = [];
    const servicesSheet = [];
    
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc')));
    aptSnap.forEach(d => appointmentsSheet.push(d.data()));
    
    const cliSnap = await getDocs(query(collection(db, 'clients')));
    cliSnap.forEach(d => clientsSheet.push(d.data()));
    
    const srvSnap = await getDocs(query(collection(db, 'services')));
    srvSnap.forEach(d => servicesSheet.push(d.data()));
    
    // Build CSV content
    let csv = 'الاسم,التاريخ,الوقت,الحالة,السعر,ملاحظات\n';
    appointmentsSheet.forEach(a => {
      csv += `"${a.clientName||''}","${a.date||''}","${a.time||''}","${a.status||''}","${a.price||0}","${a.notes||''}"\n`;
    });
    
    // Add clients sheet
    csv += '\n---Clients---\nالاسم,الهاتف,ملاحظات\n';
    clientsSheet.forEach(c => {
      csv += `"${c.name||''}","${c.phone||''}","${c.notes||''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookflow_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('تم تصدير البيانات', 'success');
  } catch(e) {
    showToast('خطأ في التصدير', 'error');
  }
};

window.exportToPDF = async function() {
  try {
    const appointments = [];
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(50)));
    aptSnap.forEach(d => appointments.push(d.data()));
    
    const content = `
      <html>
      <head>
        <style>
          body { font-family: Cairo, sans-serif; padding: 40px; }
          h1 { color: #0066FF; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background: #0066FF; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>تقرير BookFlow</h1>
        <p>تاريخ التصدير: ${new Date().toLocaleDateString('ar')}</p>
        <table>
          <tr><th>العميل</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th>السعر</th></tr>
          ${appointments.map(a => `
            <tr>
              <td>${a.clientName || '-'}</td>
              <td>${a.date || '-'}</td>
              <td>${a.time || '-'}</td>
              <td>${a.status || '-'}</td>
              <td>${a.price || 0}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
    
    showToast('تم إنشاء التقرير', 'success');
  } catch(e) {
    showToast('خطأ في إنشاء التقرير', 'error');
  }
};

window.exportToGoogleSheets = async function() {
  try {
    const appointments = [];
    const clients = [];
    
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(100)));
    aptSnap.forEach(d => appointments.push(d.data()));
    
    const cliSnap = await getDocs(query(collection(db, 'clients')));
    cliSnap.forEach(d => clients.push(d.data()));
    
    // Create CSV content
    let csv = 'Name,Phone,Service,Date,Time,Status,Price,Notes\n';
    appointments.forEach(a => {
      csv += `"${a.clientName||''}","${a.clientPhone||''}","${a.service||''}","${a.date||''}","${a.time||''}","${a.status||''}","${a.price||0}","${a.notes||''}"\n`;
    });
    
    // Encode for Google Sheets import
    const encoded = encodeURIComponent(csv);
    const url = `https://docs.google.com/spreadsheets/u/0/create?usp=sheets&body=${encoded}`;
    window.open(url, '_blank');
    
    showToast('جاري فتح Google Sheets...', 'success');
  } catch(e) {
    showToast('خطأ في التصدير', 'error');
  }
};
