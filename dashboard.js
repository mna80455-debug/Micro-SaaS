// dashboard.js
import { db } from './firebase-config.js';
import { 
  collection, query, where, getDocs, addDoc, 
  updateDoc, doc, getDoc, orderBy, increment, limit,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { showToast } from './components/toast.js';
import { initI18n } from './i18n.js';
import { openWhatsAppNotify, scheduleAppointmentReminder, sendEmailNotification } from './notifications.js';

const auth = getAuth();

// Debug helper
window.dbg = function(msg, data) {
  console.log('[BookFlow]', msg, data);
};

// Basic HTML escaping for user-provided content injected into the DOM
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.dbg('Starting...');

// Select common buttons/elements
let btnSaveAppointment, btnSaveClient, btnSaveService, btnCopyLink, btnSaveNotifications;

// Register global functions immediately so proxy bridge can use them
// The bridge in app.html sets up window.registerFn before modules load
function reg(name, fn) {
  if (window.registerFn) {
    window.registerFn(name, fn);
  } else {
    window['_' + name] = fn;
    window[name] = fn; // direct fallback
  }
}

// Expose basic modal functions immediately (may be overridden)
window.openModal = function(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
};
window.closeModal = function(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
};

// Global fallback functions (available immediately even before modules load)

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

function domInit() {
  // Initialize elements
  btnSaveAppointment = document.getElementById('btnSaveAppointment');
  btnSaveClient = document.getElementById('btnSaveClient');
  btnSaveService = document.getElementById('btnSaveService');
  btnCopyLink = document.getElementById('btnCopyLink');
  btnSaveNotifications = document.getElementById('btnSaveNotifications');

  window.dbg('DOM loaded');
  initI18n();
  setupRouting();
  
  import('./notifications.js').then(({ requestNotificationPermission }) => {
    requestNotificationPermission();
  }).catch(e => console.warn('Notification error:', e));
}

// ES modules are deferred — DOMContentLoaded may have already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domInit);
} else {
  domInit();
}

// Removed: legacy direct theme toggle binding (handled by i18n/theme-manager)

// Theme toggle - settings button only
// Theme toggle is managed by i18n.js (translations) to avoid duplicate listeners

// Language toggle is handled by i18n.js

// Setup Routing Logic with Event Delegation
function setupRouting() {
  console.log('[BookFlow] Routing ready');
  
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item[data-page]');
    if (!navItem) return;
    const page = navItem.getAttribute('data-page');
    e.preventDefault();
    
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    navItem.classList.add('active');
    
    const targetView = document.getElementById(page + 'View');
    if (targetView) {
      targetView.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Load data for specific pages
    if (page === 'clients') loadClients();
    if (page === 'services') loadServices();
    if (page === 'stats') loadStats();
    if (page === 'settings') loadWorkHours();
    if (page === 'calendar' && window.renderCalendar) window.renderCalendar();
  });
  
  // Expose navigation for use from inline JS too
  window.navigateTo = function(page) {
    const nav = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (nav) nav.click();
  };
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
    
    // Calculate unique clients from appointments + clients collection
    let clientCount = 0;
    const clientPhones = new Set(snap.docs.map(d => d.data().clientPhone).filter(p => p));
    
    // Also get from clients collection
    try {
      const clientsQ = query(collection(db, 'clients'), where('userId', '==', userId));
      const clientsSnap = await getDocs(clientsQ);
      clientCount = clientsSnap.size;
      clientsSnap.forEach(d => {
        const phone = d.data().phone;
        if(phone) clientPhones.add(phone);
      });
      console.log('Clients from DB:', clientCount, 'phones:', Array.from(clientPhones));
    } catch(e) {
      console.error('Error loading clients for stats:', e);
    }
    
    const totalClients = Math.max(clientCount, clientPhones.size);
    animateValue('statClients', 0, totalClients, 800);

  } catch (err) {
    console.error("Stats error", err);
    document.getElementById('statToday').textContent = '0';
    document.getElementById('statPending').textContent = '0';
    document.getElementById('statClients').textContent = '0';
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
        <div class="timeline-time">${escapeHTML(apt.time)}</div>
        <div class="timeline-dot" style="background:${escapeHTML(statusColors[apt.status] || 'var(--teal)')}; box-shadow: 0 0 8px ${escapeHTML(statusColors[apt.status] || 'var(--teal)')}55"></div>
        <div class="timeline-content">
          <div class="timeline-client">${escapeHTML(apt.clientName)}</div>
          <div class="timeline-service">${escapeHTML(apt.service)}</div>
        </div>
        <div class="timeline-right" style="display: flex; gap: 8px; flex-direction: row; align-items: center;">
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="status-chip" style="color:${escapeHTML(statusColors[apt.status] || '#000')}; background:${escapeHTML(statusColors[apt.status] || '#000')}22">
              ${escapeHTML(statusLabels[apt.status] || '')}
            </span>
            <span class="timeline-price">${escapeHTML(apt.price || 0)} ج.م</span>
          </div>
          ${apt.status !== 'completed' && apt.status !== 'cancelled' ? `
            <div style="display: flex; flex-direction: column; gap: 4px; margin-right: 12px;">
              ${apt.clientPhone ? `<button title="واتساب" onclick="event.stopPropagation(); window.openWhatsApp('${escapeHTML(apt.clientPhone)}', '${escapeHTML(apt.clientName)}')" style="background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.25); border-radius: 4px; padding: 4px; color: #25D366;"><i class="ph-fill ph-whatsapp-logo"></i></button>` : ''}
              ${apt.clientPhone ? `<button title="إرسال تأكيد" onclick="event.stopPropagation(); window.notifyClientViaWA('${escapeHTML(apt.id)}')" style="background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.25); border-radius: 4px; padding: 4px; color: var(--primary);"><i class="ph-bold ph-paper-plane-tilt"></i></button>` : ''}
              ${apt.status === 'awaiting_payment' ? `<button title="تأكيد الدفع" onclick="event.stopPropagation(); window.updateAptStatus('${escapeHTML(apt.id)}', 'confirmed')" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 4px; padding: 4px; color: #10B981;"><i class="ph-bold ph-money"></i></button>` : ''}
              <button title="اكتمل" onclick="event.stopPropagation(); window.updateAptStatus('${escapeHTML(apt.id)}', 'completed')" style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; padding: 4px; color: var(--completed);"><i class="ph-bold ph-check"></i></button>
              <button title="إلغاء" onclick="event.stopPropagation(); window.updateAptStatus('${escapeHTML(apt.id)}', 'cancelled')" style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; padding: 4px; color: var(--cancelled);"><i class="ph-bold ph-x"></i></button>
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
    const monthAgo = now.getTime() - 30*24*60*60*1000;
    const recentApts = allApts.filter(a => a.date >= weekAgo);
    const monthlyApts = allApts.filter(a => a.date >= monthAgo);
    
    // Calculate insights
    const completed = recentApts.filter(a => a.status === 'completed').length;
    const cancelled = recentApts.filter(a => a.status === 'cancelled').length;
    const pending = recentApts.filter(a => a.status === 'pending').length;
    const noShow = recentApts.filter(a => a.status === 'no-show').length;
    
    const completedApts = recentApts.filter(a => a.status === 'completed');
    const revenue = completedApts.reduce((sum, a) => sum + (a.price || 0), 0);
    const clients = new Set(recentApts.map(a => a.clientPhone)).size;
    
    // Monthly comparison
    const lastMonthApts = allApts.filter(a => {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).getTime();
      return a.date >= monthStart && a.date <= monthEnd;
    });
    const lastMonthRevenue = lastMonthApts.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0);
    const growth = lastMonthRevenue > 0 ? Math.round((revenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
    
    // Peak times analysis
    const timeSlots = {};
    monthlyApts.filter(a => a.status === 'completed').forEach(a => {
      const hour = a.time?.split(':')[0];
      if (hour) timeSlots[hour] = (timeSlots[hour] || 0) + 1;
    });
    const peakHour = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0];
    
    // At-risk client analysis
    const clientHistory = {};
    allApts.forEach(a => {
      if (!a.clientPhone) return;
      if (!clientHistory[a.clientPhone]) {
        clientHistory[a.clientPhone] = { name: a.clientName, noShow: 0, total: 0, lastVisit: 0 };
      }
      clientHistory[a.clientPhone].total++;
      if (a.status === 'cancelled' || a.status === 'no-show') {
        clientHistory[a.clientPhone].noShow++;
      }
      if (a.date > clientHistory[a.clientPhone].lastVisit) {
        clientHistory[a.clientPhone].lastVisit = a.date;
      }
    });
    
    const atRisk = Object.entries(clientHistory)
      .filter(([_, c]) => c.total >= 3 && (c.noShow / c.total) > 0.3)
      .slice(0, 2);
    
    const churnedClients = Object.entries(clientHistory)
      .filter(([_, c]) => c.total >= 2 && (now.getTime() - c.lastVisit) > 45*24*60*60*1000)
      .slice(0, 2);
    
    const html = `
      <div class="recommendation-card">
        <h4>🧠 توصيات FlowAI</h4>
        <div class="rec-items">
          ${cancelled + noShow > completed * 0.25 ? '<div class="rec-item warning">⚠️ نسبة الإلغاء/عدم الحضور عالية - فكر في تفعيل التذكيرات</div>' : ''}
          ${pending > 3 ? '<div class="rec-item">⏰ عندك ' + pending + ' مواعيد.pending - تأكد منها</div>' : ''}
          ${growth !== 0 ? '<div class="rec-item">' + (growth > 0 ? '📈' : '📉') + ' إيرادات الأسبوع: ' + (growth > 0 ? '+' : '') + growth + '% من الشهر الماضي</div>' : ''}
          ${revenue > 0 ? '<div class="rec-item">💰 إيرادات الأسبوع: ' + revenue + ' ج.م</div>' : ''}
          ${clients > 0 ? '<div class="rec-item">👥 عملاء هذا الأسبوع: ' + clients + '</div>' : ''}
          ${peakHour ? '<div class="rec-item">🌙 أفضل وقت لك: ' + peakHour[0] + ':00 - ' + (parseInt(peakHour[0])+1) + ':00</div>' : ''}
          ${atRisk.length > 0 ? '<div class="rec-item warning">👎 عملاء نسبة عدم الحضور عالية: ' + atRisk.map(([_, c]) => c.name).join(', ') + '</div>' : ''}
          ${churnedClients.length > 0 ? '<div class="rec-item">🔔 عملاء لم يحجزوا منذ 45+ يوم: ' + churnedClients.map(([_, c]) => c.name).join(', ') + '</div>' : ''}
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
    
    window.allClients = clients;
    updateClientFilters(clients);
    
    const getBadge = (visits) => {
      if (visits >= 20) return '<span class="badge-vip">💎 VIP</span>';
      if (visits >= 10) return '<span class="badge-gold">🥇 ذهبي</span>';
      if (visits >= 5) return '<span class="badge-silver">🥈 فضي</span>';
      return '';
    };
    
    const getCategoryBadge = (cat) => {
      const badges = { 'vip': '⭐ VIP', 'regular': '👤 منتظم', 'new': '🆕 جديد', 'inactive': '⚠️ غير نشط' };
      return cat ? badges[cat] || '' : '';
    };
    
    container.innerHTML = clients.map((client, index) => `
      <div class="client-card fade-up stagger-${(index % 10) + 1}" onclick="window.openEditClientModal('${client.id}')">
        <div class="client-avatar">${escapeHTML(client.name.charAt(0).toUpperCase())}</div>
        <div class="client-info">
          <span class="client-name">${escapeHTML(client.name)}</span>
          <span class="client-phone">${escapeHTML(client.phone || '—')}</span>
          ${getBadge(client.totalVisits || 0)}
          ${getCategoryBadge(client.category)}
          ${(client.tags || []).length ? `<div class="client-tags">${client.tags.slice(0,3).map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="client-stats">
          <span class="client-visits">${escapeHTML(String(client.totalVisits || 1))} زيارة</span>
        </div>
        <div class="client-actions" style="display: flex; gap: 8px; align-items: center;">
          ${client.phone ? `<button class="btn-whatsapp-quick" onclick="event.stopPropagation(); window.openWhatsApp('${escapeHTML(client.phone)}', '${escapeHTML(client.name)}')"><i class="ph-fill ph-whatsapp-logo"></i> واتساب</button>` : ''}
          <button class="btn-quick-book" onclick="event.stopPropagation(); window.openNewAppointmentModal()">+ حجز</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    console.error(e);
  }
}

function updateClientFilters(clients) {
  const tagSelect = document.getElementById('clientsTagFilter');
  if (!tagSelect) return;
  const allTags = new Set();
  clients.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));
  tagSelect.innerHTML = '<option value="">كل الوسوم</option>' + 
    Array.from(allTags).sort().map(t => `<option value="${t}">${t}</option>`).join('');
}

// searchClients is defined later with full Firestore query support

window.filterClients = function() {
  if(!window.allClients) return;
  const catFilter = document.getElementById('clientsCategoryFilter').value;
  const tagFilter = document.getElementById('clientsTagFilter').value;
  const searchQuery = document.getElementById('clientsSearchInput').value;
  
  let filtered = window.allClients;
  
  if(catFilter) filtered = filtered.filter(c => c.category === catFilter);
  if(tagFilter) filtered = filtered.filter(c => (c.tags || []).includes(tagFilter));
  if(searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  }
  
  renderClients(filtered);
};

function renderClients(clients) {
  const container = document.getElementById('clientsList');
  const getBadge = (visits) => {
    if (visits >= 20) return '<span class="badge-vip">💎 VIP</span>';
    if (visits >= 10) return '<span class="badge-gold">🥇 ذهبي</span>';
    if (visits >= 5) return '<span class="badge-silver">🥈 فضي</span>';
    return '';
  };
  const getCategoryBadge = (cat) => {
    const badges = { 'vip': '⭐ VIP', 'regular': '👤 منتظم', 'new': '🆕 جديد', 'inactive': '⚠️ غير نشط' };
    return cat ? badges[cat] || '' : '';
  };
  
  if(!clients.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3 class="empty-title">مفيش نتائج</h3></div>`;
    return;
  }
  
  container.innerHTML = clients.map((client, index) => `
    <div class="client-card fade-up stagger-${(index % 10) + 1}" onclick="window.openEditClientModal('${client.id}')">
      <div class="client-avatar">${client.name.charAt(0).toUpperCase()}</div>
      <div class="client-info">
        <span class="client-name">${client.name}</span>
        <span class="client-phone">${client.phone || '—'}</span>
        ${getBadge(client.totalVisits || 0)}
        ${getCategoryBadge(client.category)}
        ${(client.tags || []).length ? `<div class="client-tags">${client.tags.slice(0,3).map(t => `<span class="tag-chip">${t}</span>`).join('')}</div>` : ''}
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
}

window.saveNewClientForm = async function() {
  const name = document.getElementById('newClientNameInput');
  const phone = document.getElementById('newClientPhoneInput');
  const email = document.getElementById('newClientEmailInput');
  const category = document.getElementById('newClientCategory');
  const tags = document.getElementById('newClientTags');
  const notes = document.getElementById('newClientNotes');
  
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
      email: email.value.trim() || '',
      category: category.value || 'new',
      tags: tags.value.trim() ? tags.value.trim().split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: notes.value.trim() || '',
      totalVisits: 0,
      createdAt: new Date().getTime()
    });
    showToast('تم اضافة العميل بنجاح', 'success');
    name.value = '';
    phone.value = '';
    email.value = '';
    category.value = '';
    tags.value = '';
    notes.value = '';
    window.closeModal('newClientModal');
    loadClients();
  } catch(e) {
    showToast('خطأ اثناء الإضافة', 'error');
  } finally {
    if(btn) btn.classList.remove('btn-loading');
  }
}

// Saving Appointment
window.saveAppointment = async () => {
  if(!window.currentUser) return;
  
  const btn = document.getElementById('btnSaveAppointment');
  if(!btn) return;
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
    const clientName = clientInput.value.trim();
    
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

    // Check if client exists and update or create new
    if(phone) {
      const existingClients = await getDocs(query(
        collection(db, 'clients'),
        where('userId', '==', window.currentUser.uid),
        where('phone', '==', phone)
      ));
      
      if(!existingClients.empty) {
        const existingId = existingClients.docs[0].id;
        const existingData = existingClients.docs[0].data();
        await updateDoc(doc(db, 'clients', existingId), {
          totalVisits: (existingData.totalVisits || 0) + 1,
          lastVisit: new Date().getTime()
        });
      } else {
        await addDoc(collection(db, 'clients'), {
          userId: window.currentUser.uid,
          name: clientName,
          phone,
          category: 'new',
          totalVisits: 1,
          createdAt: new Date().getTime()
        });
      }
    } else {
      // No phone - just add as new
      await addDoc(collection(db, 'clients'), {
        userId: window.currentUser.uid,
        name: clientName,
        phone: '',
        category: 'new',
        totalVisits: 1,
        createdAt: new Date().getTime()
      });
    }

    showToast('تم حفظ الموعد ✅', 'success');
    
    // Schedule reminders based on user settings
    if(window.currentUserSettings?.notifications) {
      const { scheduleMultiReminder } = await import('./notifications.js');
      scheduleMultiReminder(aptData, window.currentUserSettings.notifications);
    } else {
      // Default: browser notification 1 hour before
      scheduleAppointmentReminder(aptData, 60);
    }
    
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
    btn.disabled = false;
    btn.classList.remove('btn-loading');
  }
};

// Global Search Logic
document.getElementById('globalSearch')?.addEventListener('input', async (e) => {
  const queryText = e.target.value.trim().toLowerCase();
  if (queryText.length < 2) return;
  
  try {
    const aptSnap = await getDocs(query(collection(db, 'appointments'), limit(20)));
    const results = aptSnap.docs
      .map(d => ({id: d.id, ...d.data()}))
      .filter(a => a.clientName?.toLowerCase().includes(queryText));
    
    console.log('Search Results:', results);
    // You can implement a UI dropdown here to show these results
  } catch(err) {
    console.error('Search error:', err);
  }
});

// Save Notification Settings
document.getElementById('btnSaveNotifications')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSaveNotifications');
  btn.classList.add('btn-loading');
  
  try {
    const waReminder = document.getElementById('settingWAReminder')?.value || '0';
    const browserNotify = document.getElementById('settingBrowserNotify')?.value || '0';
    const smsNumber = document.getElementById('settingSMS')?.value || '';
    
    // Update Firestore
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.notifications': {
        waReminder: parseInt(waReminder),
        browserNotify: parseInt(browserNotify),
        smsNumber
      }
    });
    
    // Update current settings
    if(!window.currentUserSettings) window.currentUserSettings = {};
    if(!window.currentUserSettings.notifications) window.currentUserSettings.notifications = {};
    window.currentUserSettings.notifications = {
      waReminder: parseInt(waReminder),
      browserNotify: parseInt(browserNotify),
      smsNumber
    };
    
    // Request browser notification permission if enabled
    if(parseInt(browserNotify) > 0) {
      const { requestNotificationPermission } = await import('./notifications.js');
      await requestNotificationPermission();
    }
    
    showToast('تم حفظ إعدادات الإشعارات', 'success');
  } catch(err) {
    console.error('Notifications save error:', err);
    showToast('خطأ في الحفظ', 'error');
  } finally {
    btn.classList.remove('btn-loading');
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
                <div class="service-name" style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">${escapeHTML(s.name)}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHTML(s.duration || 30)} دقيقة</div>
              </div>
              <div style="font-weight: 700; font-size: 1.25rem; color: var(--teal);">${escapeHTML(s.price || 0)} <span style="font-size: 0.8rem;">ج.م</span></div>
            </div>
            ${s.description ? `<p style="margin-top: 12px; font-size: 0.85rem; color: var(--text-secondary);">${escapeHTML(s.description)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Also populate service dropdown in new appointment modal
    const aptServiceSelect = document.getElementById('aptService');
    if(aptServiceSelect) {
      aptServiceSelect.innerHTML = '<option value="">اختر خدمة...</option>' +
        services.map(s => `<option value="${escapeHTML(s.name)}" data-price="${escapeHTML(s.price)}" data-duration="${escapeHTML(s.duration)}">${escapeHTML(s.name)} (${escapeHTML(s.price)} ج.م)</option>`).join('');
    }

  } catch(e) {
    console.error(e);
  }
}

window.saveNewService = async function() {
  const name = document.getElementById('newServiceName');
  const duration = document.getElementById('newServiceDuration');
  const price = document.getElementById('newServicePrice');
  const description = document.getElementById('newServiceDesc') || { value: '' };

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

window.saveNewClient = async function() {
  const name = document.getElementById('newClientName').value.trim();
  const phone = document.getElementById('newClientPhone').value.trim();
  const email = document.getElementById('newClientEmail').value.trim();

  if(!name) {
    showToast('يرجى إدخال اسم العميل', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'clients'), {
      userId: window.currentUser.uid,
      name,
      phone,
      email,
      category: 'new',
      totalVisits: 0,
      createdAt: new Date().getTime()
    });
    showToast('تم إضافة العميل بنجاح', 'success');
    window.closeModal('newClientModal');
    // Reset form
    document.getElementById('newClientName').value = '';
    document.getElementById('newClientPhone').value = '';
    document.getElementById('newClientEmail').value = '';
    loadClients();
  } catch(e) {
    showToast('خطأ في الإضافة', 'error');
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
    document.getElementById('editClientCategory').value = c.category || '';
    document.getElementById('editClientTags').value = (c.tags || []).join(', ');
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
  const category = document.getElementById('editClientCategory').value;
  const tags = document.getElementById('editClientTags').value.trim();
  const notes = document.getElementById('editClientNotes').value.trim();

  if(!name) {
    showToast('يرجى إدخال اسم العميل', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'clients', id), { 
      name, phone, email, 
      category: category || 'new',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes 
    });
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

// ==================== USER SETTINGS ====================
async function loadCurrentUserSettings(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      window.currentUserSettings = userDoc.data()?.settings || {};
      console.log('✅ User settings loaded:', window.currentUserSettings);
      
      // Update settings UI
      const settings = window.currentUserSettings;
      
      // Profile
      if (document.getElementById('settingBusinessName')) {
        document.getElementById('settingBusinessName').value = settings?.businessName || '';
        document.getElementById('settingBookingLink').value = settings?.bookingLink || '';
      }
      
      // Social
      if (settings?.social) {
        if (document.getElementById('settingWhatsApp')) document.getElementById('settingWhatsApp').value = settings.social.whatsapp || '';
        if (document.getElementById('settingInstagram')) document.getElementById('settingInstagram').value = settings.social.instagram || '';
        if (document.getElementById('settingFacebook')) document.getElementById('settingFacebook').value = settings.social.facebook || '';
      }
      
      // Work Hours
      if (settings?.workHours) {
        if (document.getElementById('settingStartTime')) document.getElementById('settingStartTime').value = settings.workHours.start || '09:00';
        if (document.getElementById('settingEndTime')) document.getElementById('settingEndTime').value = settings.workHours.end || '18:00';
        if (document.getElementById('settingSlotDuration')) document.getElementById('settingSlotDuration').value = settings.workHours.slotDuration || 30;
      }
      
      // Payment
      if (settings?.payments) {
        if (document.getElementById('settingStripeKey')) document.getElementById('settingStripeKey').value = settings.payments.stripeKey || '';
        if (document.getElementById('enableStripe')) document.getElementById('enableStripe').checked = settings.payments.enableStripe || false;
        if (document.getElementById('settingVodafone')) document.getElementById('settingVodafone').value = settings.payments.vodafoneCash || '';
        if (document.getElementById('enableVodafone')) document.getElementById('enableVodafone').checked = settings.payments.enableVodafone || false;
        if (document.getElementById('settingPaymob')) document.getElementById('settingPaymob').value = settings.payments.paymobKey || '';
        if (document.getElementById('enablePaymob')) document.getElementById('enablePaymob').checked = settings.payments.enablePaymob || false;
      }
      
      // Notifications
      if (settings?.notifications) {
        if (document.getElementById('settingWAReminder')) document.getElementById('settingWAReminder').value = settings.notifications.waReminder || 0;
        if (document.getElementById('settingBrowserNotify')) document.getElementById('settingBrowserNotify').value = settings.notifications.browserNotify || 0;
        if (document.getElementById('settingSMS')) document.getElementById('settingSMS').value = settings.notifications.smsNumber || '';
      }
    }
  } catch(e) {
    console.error('Settings load error:', e);
  }
}

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
      animateValue('statCompleted', 0, completedApts.length, 600);
      animateValue('statTotalRevenue', 0, completedApts.reduce((sum, a) => sum + (a.price || 0), 0), 800);

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
          let legendHtml = '';
          legendHtml += '<div class="stat-row"><span class="dot green"></span> مكتمل: ' + statusCounts.completed + '</div>';
          legendHtml += '<div class="stat-row"><span class="dot amber"></span> معين: ' + statusCounts.pending + '</div>';
          legendHtml += '<div class="stat-row"><span class="dot danger"></span> ملغى: ' + statusCounts.cancelled + '</div>';
          legendEl.innerHTML = legendHtml;
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
            html += '<div class="client-avatar">' + escapeHTML(c.name.charAt(0).toUpperCase()) + '</div>';
            html += '<div class="client-info">';
            html += '<span class="client-name">' + escapeHTML(c.name) + '</span>';
            html += '<span class="client-phone">' + escapeHTML(String(c.count)) + ' حجز، ' + escapeHTML(String(c.spent)) + ' ج.م</span>';
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
      const startEl = document.getElementById('settingStartTime');
      const endEl = document.getElementById('settingEndTime');
      if(startEl) startEl.value = wh.start || '09:00';
      if(endEl) endEl.value = wh.end || '18:00';
    }

    // Payments
    const pay = data?.settings?.payments;
    if(pay) {
      const vodEl = document.getElementById('settingVodafone');
      const stripeEl = document.getElementById('settingStripeKey');
      const enableStripeEl = document.getElementById('enableStripe');
      if(vodEl) vodEl.value = pay.vodafoneCash || '';
      if(stripeEl) stripeEl.value = pay.stripeKey || '';
      if(enableStripeEl) enableStripeEl.checked = pay.enableStripe ?? false;
    }
  } catch(e) { console.error(e); }
}

// Modal Management
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = 'auto';
  }
};

document.getElementById('btnSavePayments')?.addEventListener('click', async () => {
  const stripeKey = document.getElementById('settingStripeKey')?.value || '';
  const enableStripe = document.getElementById('enableStripe')?.checked || false;
  const vodafone = document.getElementById('settingVodafoneCash')?.value || '';
  const enableVodafone = document.getElementById('enableVodafoneCash')?.checked || false;
  const paymobKey = document.getElementById('settingPaymob')?.value || '';
  const enablePaymob = document.getElementById('enablePaymob')?.checked || false;

  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.payments': {
        stripeKey,
        enableStripe,
        vodafoneCash: vodafone,
        enableVodafoneCash: enableVodafone,
        paymobKey,
        enablePaymob
      }
    });
    
    // Update current settings
    if(!window.currentUserSettings) window.currentUserSettings = {};
    if(!window.currentUserSettings.payments) window.currentUserSettings.payments = {};
    window.currentUserSettings.payments = {
      stripeKey,
      enableStripe,
      vodafoneCash: vodafone,
      enableVodafoneCash: enableVodafone,
      paymobKey,
      enablePaymob
    };
    
    showToast('تم حفظ إعدادات الدفع بنجاح ✅', 'success');
  } catch(e) {
    console.error('Payment save error:', e);
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
      const greetingEl = document.getElementById('greetingText');
      if (greetingEl) {
        const firstName = userData.profile.name.split(' ')[0];
        greetingEl.innerHTML = `<span class="greeting-msg">صباح الخير، ${firstName}</span> <span class="greeting-emoji">👋</span>`;
      }
      document.getElementById('settingName').value = userData.profile.name || '';
      document.getElementById('settingBusiness').value = userData.profile.businessName || '';
      if(userData.settings?.bookingLink) {
        document.getElementById('bookingUsername').value = userData.settings.bookingLink;
      }
      // Load social settings
      if(userData.settings?.social) {
        const s = userData.settings.social;
        const waEl = document.getElementById('settingWhatsApp');
        const igEl = document.getElementById('settingInstagram');
        if(waEl && s.whatsapp) waEl.value = s.whatsapp;
        if(igEl && s.instagram) igEl.value = s.instagram;
      }
      // Load notification settings
      if(userData.settings?.notifications) {
        const n = userData.settings.notifications;
        const waRemEl = document.getElementById('settingWAReminder');
        const brNotEl = document.getElementById('settingBrowserNotify');
        if(waRemEl && n.waReminder) waRemEl.value = n.waReminder;
        if(brNotEl && n.browserNotify) brNotEl.value = n.browserNotify;
        window.currentUserSettings = window.currentUserSettings || {};
        window.currentUserSettings.notifications = n;
      }
      // Load payment settings
      if(userData.settings?.payment) {
        const p = userData.settings.payment;
        const vodEl = document.getElementById('settingVodafone');
        const stripeEl = document.getElementById('settingStripeKey');
        const enableStripeEl = document.getElementById('enableStripe');
        if(vodEl && p.vodafoneCash) vodEl.value = p.vodafoneCash;
        if(stripeEl && p.stripeKey) stripeEl.value = p.stripeKey;
        if(enableStripeEl && p.enableStripe !== undefined) enableStripeEl.checked = p.enableStripe;
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
        const gcalStatus = document.getElementById('gcalStatusText');
        const btnGcal = document.getElementById('btnConnectGcal');
        if(gcalStatus) gcalStatus.textContent = '✅ متصل بتقويم جوجل';
        if(btnGcal) btnGcal.textContent = 'إعادة الربط';
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
    const gcalStatus = document.getElementById('gcalStatusText');
    const btnGcal = document.getElementById('btnConnectGcal');
    if(gcalStatus) gcalStatus.textContent = '✅ متصل بتقويم جوجل';
    if(btnGcal) btnGcal.textContent = 'إعادة الربط';
    showToast('تم ربط تقويم جوجل بنجاح', 'success');
  } catch(e) {
    showToast('خطأ في الربط', 'error');
  }
};

// ==================== GLOBAL ONCLICK HANDLERS ====================

// These are called from HTML onclick attributes in app.html settings section
window.saveProfileSettings = async function() {
  if(!window.currentUser) return;
  const name = document.getElementById('settingName')?.value?.trim() || '';
  const business = document.getElementById('settingBusiness')?.value?.trim() || '';
  
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'profile.name': name,
      'profile.businessName': business
    });
    document.getElementById('sidebarName').textContent = name || 'مستخدم';
    document.getElementById('sidebarAvatar').textContent = (name || 'م')[0].toUpperCase();
    showToast('تم حفظ الملف الشخصي بنجاح ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
};

window.saveSocialSettings = async function() {
  if(!window.currentUser) return;
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.social': {
        whatsapp: document.getElementById('settingWhatsApp')?.value?.trim() || '',
        instagram: document.getElementById('settingInstagram')?.value?.trim() || ''
      }
    });
    showToast('تم تحديث الروابط ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
};

window.saveWorkHours = async function() {
  if(!window.currentUser) return;
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.workHours': {
        start: document.getElementById('settingStartTime')?.value || '09:00',
        end: document.getElementById('settingEndTime')?.value || '18:00'
      }
    });
    showToast('تم حفظ مواعيد العمل ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
};

window.savePaymentSettings = async function() {
  if(!window.currentUser) return;
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.payments': {
        stripeKey: document.getElementById('settingStripeKey')?.value || '',
        enableStripe: document.getElementById('enableStripe')?.checked || false,
        vodafoneCash: document.getElementById('settingVodafone')?.value || '',
        enableVodafoneCash: document.getElementById('enableVodafoneCash')?.checked || false,
        paymobKey: document.getElementById('settingPaymob')?.value || '',
        enablePaymob: document.getElementById('enablePaymob')?.checked || false
      }
    });
    showToast('تم حفظ بوابات الدفع ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
};

window.saveNotificationSettings = async function() {
  if(!window.currentUser) return;
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.notifications': {
        waReminder: parseInt(document.getElementById('settingWAReminder')?.value) || 0,
        browserNotify: parseInt(document.getElementById('settingBrowserNotify')?.value) || 0,
        smsNumber: document.getElementById('settingSMS')?.value || ''
      }
    });
    showToast('تم حفظ إعدادات التنبيهات ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
};

window.openNewClientModal = function() {
  window.openModal('newClientModal');
};

window.openNewServiceModal = function() {
  window.openModal('newServiceModal');
};

// ==================== SOCIAL MEDIA & WHATSAPP ====================

// Save Profile
document.getElementById('btnSaveProfile')?.addEventListener('click', async () => {
  if(!window.currentUser) return;
  const name = document.getElementById('settingName').value.trim();
  const business = document.getElementById('settingBusiness').value.trim();
  
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'profile.name': name,
      'profile.businessName': business
    });
    showToast('تم حفظ الملف الشخصي بنجاح ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
});

// Save Booking Link
document.getElementById('btnSaveLink')?.addEventListener('click', async () => {
  if(!window.currentUser) return;
  const link = document.getElementById('bookingUsername').value.trim();
  
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.bookingLink': link
    });
    showToast('تم حفظ رابط الحجز بنجاح ✅', 'success');
  } catch(e) {
    showToast('خطأ في الحفظ', 'error');
  }
});

// Save Social Settings
document.getElementById('btnSaveSocial')?.addEventListener('click', async () => {
  if(!window.currentUser) return;
  const btn = document.getElementById('btnSaveSocial');
  btn.classList.add('btn-loading');

  try {
    const socialData = {
      whatsapp: document.getElementById('settingWhatsApp')?.value?.trim() || '',
      instagram: document.getElementById('settingInstagram')?.value?.trim() || ''
    };
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.social': socialData
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
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc')));
    const data = aptSnap.docs.map(d => d.data());
    
    let csv = 'الاسم,التاريخ,الوقت,الحالة,السعر,ملاحظات\n';
    data.forEach(a => {
      csv += `"${a.clientName||''}","${new Date(a.date).toLocaleDateString('ar')}","${a.time||''}","${a.status||''}","${a.price||0}","${a.notes||''}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BookFlow_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('تم تصدير البيانات بنجاح ✅', 'success');
  } catch(e) {
    showToast('خطأ في التصدير', 'error');
  }
};

window.exportToPDF = async function() {
  try {
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(50)));
    const appointments = aptSnap.docs.map(d => d.data());
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>تقرير BookFlow</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Cairo', sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
          h1 { color: #6366f1; margin: 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #eee; padding: 12px; text-align: right; }
          th { background: #f8fafc; color: #6366f1; font-weight: 700; }
          tr:nth-child(even) { background: #fcfcfc; }
          .footer { margin-top: 40px; font-size: 0.8rem; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير المواعيد — BookFlow</h1>
          <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar')}</div>
        </div>
        <table>
          <thead>
            <tr><th>العميل</th><th>التاريخ</th><th>الوقت</th><th>الخدمة</th><th>السعر</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            ${appointments.map(a => `
              <tr>
                <td>${a.clientName || '-'}</td>
                <td>${new Date(a.date).toLocaleDateString('ar')}</td>
                <td>${a.time || '-'}</td>
                <td>${a.service || '-'}</td>
                <td>${a.price || 0} ج.م</td>
                <td>${a.status || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">تم إنشاء هذا التقرير تلقائياً بواسطة BookFlow</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
    showToast('جاري تحضير ملف PDF...', 'success');
  } catch(e) {
    showToast('خطأ في إنشاء التقرير', 'error');
  }
};

window.exportToGoogleSheets = async function() {
  try {
    const aptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(100)));
    const appointments = aptSnap.docs.map(d => d.data());
    
    // Format as Tab Separated Values (TSV) for easy copy-paste into Sheets
    let tsv = 'الاسم\tالهاتف\tالخدمة\tالتاريخ\tالوقت\tالحالة\tالسعر\tملاحظات\n';
    appointments.forEach(a => {
      tsv += `${a.clientName||''}\t${a.clientPhone||''}\t${a.service||''}\t${new Date(a.date).toLocaleDateString('ar')}\t${a.time||''}\t${a.status||''}\t${a.price||0}\t${a.notes||''}\n`;
    });
    
    await navigator.clipboard.writeText(tsv);
    showToast('تم نسخ البيانات! افتح Google Sheets واضغط Ctrl+V لللصق', 'success');
    window.open('https://sheets.new', '_blank');
  } catch(e) {
    showToast('خطأ في التصدير', 'error');
  }
};

window.openImportClientsModal = function() {
  window.openModal('importClientsModal');
};

window.importClientsFromExcel = async function() {
  const fileInput = document.getElementById('importClientsFile');
  const file = fileInput?.files[0];
  if(!file) {
    showToast('يرجى اختيار ملف Excel', 'error');
    return;
  }

  try {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    
    if(lines.length < 2) {
      showToast('الملف فارغ أو غير صالح', 'error');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const nameIdx = headers.findIndex(h => h.includes('اسم') || h.toLowerCase().includes('name'));
    const phoneIdx = headers.findIndex(h => h.includes('هاتف') || h.toLowerCase().includes('phone'));
    const emailIdx = headers.findIndex(h => h.includes('بريد') || h.toLowerCase().includes('email'));
    const categoryIdx = headers.findIndex(h => h.includes('فئة') || h.toLowerCase().includes('category'));
    const tagsIdx = headers.findIndex(h => h.includes('وسوم') || h.toLowerCase().includes('tag'));
    const notesIdx = headers.findIndex(h => h.includes('ملاحظات') || h.toLowerCase().includes('notes'));

    if(nameIdx === -1 || phoneIdx === -1) {
      showToast('الملف يجب أن يحتوي على اسم العميل ورقم الهاتف', 'error');
      return;
    }

    let imported = 0;
    for(let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if(values.length < 2) continue;

      const name = values[nameIdx];
      const phone = values[phoneIdx];
      if(!name || !phone) continue;

      // Check if client exists
      const existingClients = await getDocs(query(
        collection(db, 'clients'),
        where('userId', '==', window.currentUser.uid),
        where('phone', '==', phone)
      ));

      if(existingClients.empty) {
        await addDoc(collection(db, 'clients'), {
          userId: window.currentUser.uid,
          name,
          phone,
          email: emailIdx > -1 ? values[emailIdx] : '',
          category: categoryIdx > -1 ? values[categoryIdx].toLowerCase() : 'new',
          tags: tagsIdx > -1 && values[tagsIdx] ? values[tagsIdx].split(';').map(t => t.trim()).filter(Boolean) : [],
          notes: notesIdx > -1 ? values[notesIdx] : '',
          totalVisits: 0,
          createdAt: Date.now()
        });
        imported++;
      }
    }

    showToast(`تم استيراد ${imported} عميل بنجاح! ✅`, 'success');
    window.closeModal('importClientsModal');
    loadClients();
  } catch(e) {
    console.error('Import error:', e);
    showToast('خطأ في استيراد الملف', 'error');
  }
};

// ==================== SAVE SMS SETTINGS ====================

window.saveSmsSettings = async function() {
  const twilioSid = document.getElementById('settingTwilioSid')?.value || '';
  const twilioToken = document.getElementById('settingTwilioToken')?.value || '';
  const smsPhone = document.getElementById('settingSmsPhone')?.value || '';
  
  try {
    await updateDoc(doc(db, 'users', window.currentUser.uid), {
      'settings.notifications.twilioSid': twilioSid,
      'settings.notifications.twilioToken': twilioToken,
      'settings.notifications.smsNumber': smsPhone
    });
    
    // Update current settings
    if(!window.currentUserSettings) window.currentUserSettings = {};
    if(!window.currentUserSettings.notifications) window.currentUserSettings.notifications = {};
    window.currentUserSettings.notifications.smsNumber = smsPhone;
    
    showToast('تم حفظ إعدادات SMS بنجاح! ✅', 'success');
  } catch(e) {
    console.error('SMS Settings error:', e);
    showToast('خطأ في الحفظ', 'error');
  }

// ==================== REGISTER ALL GLOBAL FUNCTIONS VIA BRIDGE ====================
(function registerAllFunctions() {
  const fns = {
    initDashboard,
    openNewAppointmentModal: window.openNewAppointmentModal,
    saveAppointment: window.saveAppointment,
    modalGoToStep: window.modalGoToStep,
    openAptDetails: window.openAptDetails,
    updateAppointment: window.updateAppointment,
    deleteAppointment: window.deleteAppointment,
    saveNewClient: window.saveNewClient,
    openEditClientModal: window.openEditClientModal,
    updateClient: window.updateClient,
    deleteClient: window.deleteClient,
    searchClients: window.searchClients,
    saveNewService: window.saveNewService,
    openEditServiceModal: window.openEditServiceModal,
    updateService: window.updateService,
    deleteService: window.deleteService,
    saveProfileSettings: window.saveProfileSettings,
    saveSocialSettings: window.saveSocialSettings,
    saveWorkHours: window.saveWorkHours,
    savePaymentSettings: window.savePaymentSettings,
    saveNotificationSettings: window.saveNotificationSettings,
    saveSmsSettings: window.saveSmsSettings,
    exportToExcel: window.exportToExcel,
    exportToPDF: window.exportToPDF,
    exportToGoogleSheets: window.exportToGoogleSheets,
    openImportClientsModal: window.openImportClientsModal,
    importClientsFromExcel: window.importClientsFromExcel,
    notifyClientViaWA: window.notifyClientViaWA,
    testWhatsApp: window.testWhatsApp,
    openWhatsApp: window.openWhatsApp,
    handleConnectGcal: window.handleConnectGcal,
  };
  for (const [name, fn] of Object.entries(fns)) {
    if (typeof fn === 'function') reg(name, fn);
  }
  window.loadServicesGlobal = loadServices;
  window.loadStatsGlobal = loadStats;
  window.loadWorkHoursGlobal = loadWorkHours;
  window.initDashboard = initDashboard;
  console.log('[BookFlow] All functions registered via bridge \u2705');
})();

