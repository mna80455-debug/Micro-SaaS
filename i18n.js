// i18n.js

const translations = {
  ar: {
    dashboard: "الرئيسية",
    calendar: "التقويم",
    new_apt: "حجز جديد",
    clients: "العملاء",
    services: "الخدمات",
    stats: "الإحصائيات",
    settings: "الإعدادات",
    today_apt: "مواعيد اليوم",
    pending_apt: "منتظر التأكيد",
    monthly_rev: "إيرادات الشهر (ج.م)",
    total_clients: "إجمالي العملاء",
    greeting: "صباح الخير 👋",
    dark_mode: "الوضع المظلم",
    light_mode: "الوضع الفاتح",
    lang: "English",
    save_settings: "حفظ الإعدادات",
    copy_link: "نسخ الرابط",
    personal_settings: "الإعدادات الشخصية",
    booking_link: "رابط الحجز",
    fullname: "اسمك الكامل",
    businessname: "اسم العيادة / العمل",
    field: "مجال العمل"
  },
  en: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    new_apt: "New Appt",
    clients: "Clients",
    services: "Services",
    stats: "Statistics",
    settings: "Settings",
    today_apt: "Today's Appts",
    pending_apt: "Pending",
    monthly_rev: "Revenue (EGP)",
    total_clients: "Total Clients",
    greeting: "Good Morning 👋",
    dark_mode: "Dark Mode",
    light_mode: "Light Mode",
    lang: "عربي",
    save_settings: "Save Settings",
    copy_link: "Copy Link",
    personal_settings: "Personal Settings",
    booking_link: "Booking Link",
    fullname: "Full Name",
    businessname: "Business Name",
    field: "Field of Work"
  }
};

let currentLang = localStorage.getItem('bookflow_lang') || 'ar';
let isDarkMode = localStorage.getItem('bookflow_theme') === 'dark';

function applyTheme() {
  // Derive theme from localStorage to avoid mismatch when in-memory state is out of sync
  const shouldDark = localStorage.getItem('bookflow_theme') === 'dark';
  document.documentElement.classList.toggle('dark-theme', shouldDark);
  isDarkMode = shouldDark;
  // Update toggle button text if exists
  const themeBtn = document.getElementById('btnToggleTheme');
  if (themeBtn) {
    themeBtn.innerHTML = shouldDark ? `<i class="ph-bold ph-sun"></i> ${t('light_mode')}` : `<i class="ph-bold ph-moon"></i> ${t('dark_mode')}`;
  }
}

function t(key) {
  return translations[currentLang][key] || key;
}

export function translateUI() {
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  
  // Translate nodes with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      // Don't overwrite inner HTML if there are icons, just replace text node or use targeted spans
      // Better: if it has an icon child, only modify the text node
      const span = el.querySelector('.i18n-text');
      if(span) {
        span.textContent = t(key);
      } else {
        // Fallback or simple elements
        if(!el.children.length) el.textContent = t(key);
      }
    }
  });

  const langBtn = document.getElementById('btnToggleLang');
  if (langBtn) {
    langBtn.innerHTML = `<i class="ph-bold ph-translate"></i> ${t('lang')}`;
  }
}

export function initI18n() {
  applyTheme();
  translateUI();

  // Use event delegation to support dynamic content across views
  document.addEventListener('click', (e) => {
    const themeBtn = e.target.closest('#btnToggleTheme');
    if (themeBtn) {
      isDarkMode = !isDarkMode;
      localStorage.setItem('bookflow_theme', isDarkMode ? 'dark' : 'light');
      applyTheme();
      return;
    }

    const langBtn = e.target.closest('#btnToggleLang');
    if (langBtn) {
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      localStorage.setItem('bookflow_lang', currentLang);
      translateUI();
    }
  });

  // Initialize theme manager (late binding)
  import('./theme-manager.js').then(({ initTheme }) => { if (typeof initTheme === 'function') initTheme(); }).catch(() => {});
}

// Expose minimal API
window.appLang = () => currentLang;
window.t = t;
