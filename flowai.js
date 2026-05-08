// flowai.js — FlowAI Smart Assistant - Enhanced

// ===== TOGGLE PANEL =====
const _toggleFlowAI = function () {
  const panel = document.getElementById('flowAiPanel');
  const fab = document.getElementById('flowAiFab');
  if(panel) {
    const isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
  }
  if(fab) fab.classList.toggle('hidden');
};

// ===== SEND MESSAGE =====
const _sendToFlowAI = async function () {
  const input = document.getElementById('flowAiInput');
  const text = input?.value.trim();
  if (!text) return;
  
  const messagesContainer = document.getElementById('flowAiMessages');
  
  // Add user message
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble bubble-user';
  userBubble.textContent = text;
  messagesContainer.appendChild(userBubble);
  
  input.value = '';
  
  // Add typing indicator
  const typing = document.createElement('div');
  typing.className = 'ai-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typing);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Gather context
    const context = {
      name: window.currentUser?.displayName || 'مقدم خدمة',
      businessName: document.getElementById('settingBusinessName')?.value || 'غير محدد',
      todayAppointments: document.getElementById('statToday')?.textContent || '0',
      pendingAppointments: document.getElementById('statPending')?.textContent || '0',
      totalClients: document.getElementById('statClients')?.textContent || '0'
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context })
    });

    const data = await res.json();
    typing.remove();

    const botBubble = document.createElement('div');
    botBubble.className = 'chat-bubble bubble-bot';
    botBubble.textContent = data.reply || getOfflineResponse(text, context);
    messagesContainer.appendChild(botBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } catch (err) {
    console.error('FlowAI Error:', err);
    typing.remove();
    const botBubble = document.createElement('div');
    botBubble.className = 'chat-bubble bubble-bot';
    botBubble.textContent = getOfflineResponse(text, {
      todayAppointments: document.getElementById('statToday')?.textContent || '0',
      pendingAppointments: document.getElementById('statPending')?.textContent || '0'
    });
    messagesContainer.appendChild(botBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
};

// ===== OFFLINE SMART RESPONSES =====
function getOfflineResponse(query, context) {
  const q = query.toLowerCase();

  // Greetings
  if (q.match(/مرحبا|أهلا|هاي|السلام/)) {
    return `👋 أهلاً وسهلاً! أنا FlowAI مساعدك الذكي.
    
📊 عندك ${context.todayAppointments || 0} مواعيد النهارده
⏰ وفي انتظار ${context.pendingAppointments || 0} موعد للتأكيد

كيف يمكنني مساعدتك النهارده؟`;
  }

  // Appointments
  if (q.includes('حجز') || q.includes('موعد') || q.includes('اليوم')) {
    return `📅 ملخص يومك:
    
• مواعيد اليوم: ${context.todayAppointments || 0}
• بانتظار التأكيد: ${context.pendingAppointments || 0}
• إجمالي العملاء: ${context.totalClients || 0}

💡 نصيحة: لو عندك مواعيد كتير، فعل التذكير التلقائي!`;
  }

  // Clients
  if (q.includes('عميل') || q.includes('عملاء')) {
    return `👥 عندك ${context.totalClients || 0} عميل في قاعدة البيانات.

💡 نصائح ذكية:
• أضف وسوم للعملاء (VIP، منتظم...)
• فعل إشعارات الواتساب لتقليل الغياب
• راجع العملاء اللي فاتوا عن الحجز لأكثر من شهر`;
  }

  // Revenue
  if (q.includes('دخل') || q.includes('ايراد') || q.includes('فلوس')) {
    return `💰 لعرض الإيرادات المفصلة:
    
1. اذهب لصفحة "التقارير" من القائمة الجانبية
2. هتلاقي رسم بياني للإيرادات الشهرية
3. وتقرير كامل عن أداء عملك

📈 الإيرادات بتزيد لما تستخدم التحليلات الذكية!`;
  }

  // Tips
  if (q.includes('نصيحة') || q.includes('تحسين') || q.includes('ازاي')) {
    return `🧠 نصائح ذكية لتطوير عملك:

1️⃣ فعل التذكيرات التلقائية - بتقلل نسبة الغياب بنسبة 80%
2️⃣ شارك رابط الحجز مع عملائك - بيسهل عليهم الحجز بأنفسهم
3️⃣ تابع إحصائياتك أسبوعياً - عرف الأوقات والمواسم الأكثر طلباً
4️⃣ أضف ملاحظات لكل عميل - التخصيص بيخلي العميل يرجع أكتر

جرب تنفيذهم النهارده! 🚀`;
  }

  // Features
  if (q.includes('ميزات') || q.includes('الخدمات')) {
    return `⚙️ ميزات BookFlow المتاحة:

✅ إدارة المواعيد بذكاء
✅ تذكير واتساب تلقائي
✅ تحليلات وإحصائيات متقدمة
✅ نظام عملاء متكامل
✅ تقارير دورية
✅ واجهة سهلة للجوال

📱 عشان تضيف خدمة جديدة، راوح لصفحة "الخدمات"!`;
  }

  // Settings
  if (q.includes('اعدادات') || q.includes('بروفايل')) {
    return `⚙️ لتحديث إعداداتك:

1. اذهب لصفحة "الإعدادات" من القائمة
2. هتلاقي 4 أقسام:
   • الملف التعريفي (اسم النشاط ورابط التواصل)
   • روابط التواصل الاجتماعي
   • مواعيد العمل
   • إعدادات التنبيهات

💡 متأكد إن رقم الواتساب مضاف عشان يوصلك تنبيهات!`;
  }

  // Help
  if (q.includes('مساعدة') || q.includes('ازاي') || q.includes('استخدم')) {
    return `🤔 مساعدة سريعة:

📅 **المواعيد:** اضغط على "حجز جديد" أو راوح لصفحة التقويم
👥 **العملاء:** من صفحة "العملاء" تقدر تضيف وتعدل بياناتهم
⚙️ **الخدمات:** في صفحة "الخدمات" أضف الخدمات اللي بتقدمها
📈 **التقارير:** تابع أداء عملك من صفحة "التقارير"
⚙️ **الإعدادات:** حدث بياناتك وروابط التواصل

أي سؤال تاني، أنا هنا! 😊`;
  }

  // Thank you
  if (q.match(/شكراً|تسلم|يعطيك العافية|متشكر/)) {
    return `😊 العفو! أنا هنا دايماً لمساعدتك.

تمنياتي لعملك بالنجاح والتوفيق! 🚀
إذا احتجت أي مساعدة تانية، أنا موجود.`;
  }

  // Default
  return `🤔 سؤال ممتاز! أقدر أساعدك في:

📅 **المواعيد:** "كم موعدي النهارده؟"
👥 **العملاء:** "عندي كام عميل؟"
💰 **الإيرادات:** "إيه إيراداتي؟"
⚙️ **الخدمات:** "أضف خدمة جديدة"
🧠 **نصائح:** "أزاي أحسن عملي؟"

جرب تسألني عن أي حاجة من دول! 😊`;
}

// ===== LOAD AI RECOMMENDATIONS ON DASHBOARD =====
window.loadAIRecommendations = async function() {
  const container = document.getElementById('aiRecommendations');
  if (!container || !window.currentUser) return;

  try {
    const db = await import('./firebase-config.js').then(m => m.db);
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");

    const now = new Date();
    const weekAgo = now.getTime() - 7*24*60*60*1000;

    const q = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
    const snap = await getDocs(q);
    const allApts = snap.docs.map(d => d.data());

    if (allApts.length < 5) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const recentApts = allApts.filter(a => a.date >= weekAgo);
    const completedApts = recentApts.filter(a => a.status === 'completed');
    const completed = completedApts.length;
    const pending = recentApts.filter(a => a.status === 'pending' || a.status === 'awaiting_payment').length;
    const cancelled = recentApts.filter(a => a.status === 'cancelled' || a.status === 'no-show').length;

    const revenue = completedApts.reduce((sum, a) => sum + (a.price || 0), 0);
    const clients = new Set(recentApts.map(a => a.clientPhone)).size;

    let html = `
      <div style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-top: 32px;">
        <h3 style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: var(--primary);">
          <i class="ph-fill ph-sparkle"></i> توصيات FlowAI
        </h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    // Revenue
    if (revenue > 0) {
      html += `<div style="padding: 12px 16px; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border-right: 3px solid var(--success);">
        💰 إيرادات الأسبوع: ${revenue} ج.م من ${completed} موعد مكتمل
      </div>`;
    }

    // Pending
    if (pending > 3) {
      html += `<div style="padding: 12px 16px; background: rgba(245, 158, 11, 0.1); border-radius: 12px; border-right: 3px solid var(--warning);">
        ⏰ عندك ${pending} موعد بانتظار التأكيد - راجعهم
      </div>`;
    }

    // Cancellation rate
    if (cancelled > completed * 0.25) {
      html += `<div style="padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border-right: 3px solid var(--error);">
        ⚠️ نسبة الإلغاء عالية (${Math.round(cancelled/(completed+cancelled)*100)}%) - فعل التذكيرات
      </div>`;
    }

    // Clients
    if (clients > 0) {
      html += `<div style="padding: 12px 16px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; border-right: 3px solid var(--primary);">
        👥 تعاملت مع ${clients} عميل مختلف الأسبوع ده
      </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

  } catch(e) {
    console.error('AI Rec error:', e);
  }
};

// Auto-open recommendations on dashboard load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initFlowAI);
} else {
  _initFlowAI();
}
function _initFlowAI() {
  if (window.currentUser) setTimeout(() => window.loadAIRecommendations?.(), 2000);
}

// Register via bridge
if (window.registerFn) {
  window.registerFn('toggleFlowAI', _toggleFlowAI);
  window.registerFn('sendToFlowAI', _sendToFlowAI);
} else {
  window._toggleFlowAI = _toggleFlowAI;
  window._sendToFlowAI = _sendToFlowAI;
}
// Direct window assignment as fallback
window.toggleFlowAI = _toggleFlowAI;
window.sendToFlowAI = _sendToFlowAI;
