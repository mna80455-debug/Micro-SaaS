// flowai.js — FlowAI Smart Assistant

// ===== TOGGLE PANEL =====
window.toggleFlowAI = function () {
  const panel = document.getElementById('flowAiPanel');
  const fab = document.getElementById('flowAiFab');
  panel.classList.toggle('open');
  fab.classList.toggle('hidden');
};

// ===== AI RECOMMENDATIONS =====
window.getAIRecommendations = async function() {
  if (!window.currentUser) return;
  
  const recommendations = [];
  
  try {
    const db = await import('./firebase-config.js').then(m => m.db);
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24*60*60*1000;
    const weekEnd = todayEnd + 7*24*60*60*1000;
    
    const weekQ = query(collection(db, 'appointments'), where('userId', '==', window.currentUser.uid));
    const weekSnap = await getDocs(weekQ);
    const weekApts = weekSnap.docs.map(d => d.data());
    
    const todayApts = weekApts.filter(a => a.date >= todayStart && a.date < todayEnd);
    const pendingApts = weekApts.filter(a => a.status === 'pending');
    
    // 1. Check for high no-show risk clients
    const clientHistory = {};
    weekApts.forEach(a => {
      if (!clientHistory[a.clientPhone]) {
        clientHistory[a.clientPhone] = { name: a.clientName, noShow: 0, total: 0 };
      }
      clientHistory[a.clientPhone].total++;
      if (a.status === 'cancelled' || a.status === 'no-show') {
        clientHistory[a.clientPhone].noShow++;
      }
    });
    
    const atRisk = Object.values(clientHistory)
      .filter(c => c.total >= 3 && (c.noShow / c.total) > 0.3)
      .slice(0, 3);
    
    if (atRisk.length > 0) {
      recommendations.push({
        type: 'warning',
        title: '⚠️ عملاء نسبة عدم الحضور عالية',
        items: atRisk.map(c => `${c.name} - ${Math.round(c.noShow/c.total*100)}% no-show`)
      });
    }
    
    // 2. Suggest optimal times
    const timeSlots = {};
    weekApts.forEach(a => {
      if (a.status === 'confirmed') {
        const hour = a.time?.split(':')[0];
        if (hour) timeSlots[hour] = (timeSlots[hour] || 0) + 1;
      }
    });
    
    const peakHour = Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (peakHour) {
      const hourNum = parseInt(peakHour[0]);
      recommendations.push({
        type: 'tip',
        title: '📈 أفضل وقت للمواعيد',
        items: [`الساعة ${hourNum}:00 - ${hourNum+1}:00 فيها أعلى طلب`]
      });
    }
    
    // 3. Remind about unconfirmed appointments
    if (pendingApts.length > 3) {
      recommendations.push({
        type: 'action',
        title: '⏰ مواعيد تنتظر تأكيد',
        items: [`لديك ${pendingApts.length} موعد لم يتم تأكيده - راجعهم`]
      });
    }
    
    // 4. Suggest marketing
    const activeClients = new Set(weekApts.map(a => a.clientPhone)).size;
    if (activeClients < 10) {
      recommendations.push({
        type: 'tip',
        title: '📢 نصيحة تسويقية',
        items: ['شارك رابط الحجز مع عملائك لتزيد عدد الحجوزات']
      });
    }
    
  } catch(e) {
    console.error('Recommendations error:', e);
  }
  
  return recommendations;
};

// ===== SMART RESPONSES =====
const smartResponses = {
  'ملخص اليوم': [
    '📅 ملخص اليوم:',
    '• عندك {todayCount} مواعيد النهارده',
    '• {pendingCount} منتظر التأكيد',
    '• أقرب موعد الساعة {nextTime}',
    '',
    '💡 نصيحة: لو عندك وقت فاضي بعد الظهر، ممكن تفتح slots جديدة!'
  ],
  'نصائح ذكية': [
    '🧠 نصائح ذكية لتحسين عملك:',
    '',
    '1️⃣ **فعّل التذكيرات التلقائية** — بتقلل نسبة عدم الحضور بنسبة 80%',
    '',
    '2️⃣ **شارك رابط الحجز** على حساباتك — بيسهل على العملاء الحجز بأنفسهم',
    '',
    '3️⃣ **تابع إحصائياتك أسبوعياً** — هتعرف أيام الذروة وتوزع مواعيدك أحسن',
    '',
    '4️⃣ **أضف ملاحظات لكل عميل** — التخصيص بيخلي العميل يحس إنه مميز'
  ],
  'تحليل الأداء': [
    '📊 تحليل أداء عملك:',
    '',
    '📈 **معدل الحجوزات:** أنت في تحسن مستمر!',
    '⭐ **أفضل يوم:** عادةً أيام الثلاثاء والأربعاء الأكثر حجزاً',
    '⏰ **أفضل وقت:** بين 10 صباحاً و 2 ظهراً',
    '',
    '💰 متوسط الإيراد اليومي في تزايد. استمر!',
    '',
    '🎯 توصية: جرب تفتح مواعيد مسائية — في طلب عالي عليها.'
  ]
};

// Additional conversational responses
const conversationalDB = [
  {
    keywords: ['مرحبا', 'أهلا', 'هاي', 'هلو', 'السلام'],
    response: '👋 أهلاً وسهلاً! أنا FlowAI مساعدك الذكي. ازاي أقدر أساعدك النهارده؟'
  },
  {
    keywords: ['حجز', 'موعد', 'حجوزات'],
    response: '📅 عشان تعمل حجز جديد، اضغط على زر "حجز جديد" في القائمة الجانبية أو من الصفحة الرئيسية.\n\nيمكنك أيضاً مشاركة رابط الحجز مع عملائك ليحجزوا بأنفسهم!'
  },
  {
    keywords: ['عميل', 'عملاء', 'إضافة عميل'],
    response: '👥 لإضافة عميل جديد:\n1. اذهب لصفحة "العملاء"\n2. اضغط "+ إضافة عميل"\n3. أدخل اسمه ورقم موبايله\n\nأو يُضاف تلقائياً عند عمل حجز جديد!'
  },
  {
    keywords: ['إحصائيات', 'تقارير', 'أرقام'],
    response: '📊 الإحصائيات متاحة في صفحة "الإحصائيات" من القائمة الجانبية.\n\nبتلاقي فيها:\n• إجمالي الحجوزات والإيرادات\n• أداء الشهر الحالي\n• أفضل العملاء'
  },
  {
    keywords: ['شكرا', 'شكراً', 'ثانكس', 'تمام'],
    response: '😊 العفو! أنا موجود دايماً لو محتاج أي مساعدة. بالتوفيق!'
  },
  {
    keywords: ['خدمة', 'خدمات', 'سعر'],
    response: '⚙️ لإدارة خدماتك:\n1. اذهب لصفحة "الخدمات"\n2. أضف خدمة جديدة بالاسم والمدة والسعر\n\nالخدمات بتظهر تلقائياً في نموذج الحجز الجديد!'
  }
];

function getSmartResponse(query) {
  // Check smart responses first
  if (smartResponses[query]) {
    const lines = smartResponses[query];
    // Replace dynamic values
    const todayCount = document.getElementById('statToday')?.textContent || '0';
    const pendingCount = document.getElementById('statPending')?.textContent || '0';

    return lines.map(l =>
      l.replace('{todayCount}', todayCount)
        .replace('{pendingCount}', pendingCount)
        .replace('{nextTime}', '10:00 AM')
    ).join('\n');
  }

  // Check conversational DB
  const lq = query.toLowerCase();
  for (const item of conversationalDB) {
    for (const kw of item.keywords) {
      if (lq.includes(kw)) {
        return item.response;
      }
    }
  }

  // Default response
  return '🤔 سؤال ممتاز! حالياً أقدر أساعدك في:\n\n• ملخص اليوم\n• نصائح ذكية\n• تحليل الأداء\n• أسئلة عن الحجوزات والعملاء\n\nجرب تسألني عن أي حاجة من دول!';
}

// ===== SEND & RENDER MESSAGES =====
function addMessage(text, isUser = false) {
  const container = document.getElementById('flowAiMessages');
  const msg = document.createElement('div');
  msg.className = `flowai-msg ${isUser ? 'user' : 'bot'}`;

  const bubble = document.createElement('div');
  bubble.className = 'flowai-bubble';

  // Format text with line breaks and bold
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  bubble.innerHTML = formatted;
  msg.appendChild(bubble);
  container.appendChild(msg);

  // Scroll to bottom
  const body = document.getElementById('flowAiBody');
  body.scrollTop = body.scrollHeight;
}

function addTypingIndicator() {
  const container = document.getElementById('flowAiMessages');
  const typing = document.createElement('div');
  typing.className = 'flowai-msg bot';
  typing.id = 'flowaiTyping';
  typing.innerHTML = `
    <div class="flowai-bubble flowai-typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  container.appendChild(typing);

  const body = document.getElementById('flowAiBody');
  body.scrollTop = body.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('flowaiTyping')?.remove();
}

window.askFlowAI = async function (query) {
  // Hide suggestions
  const suggestions = document.querySelector('.flowai-suggestions');
  if (suggestions) suggestions.style.display = 'none';

  const welcome = document.querySelector('.flowai-welcome');
  if (welcome) welcome.style.display = 'none';

  addMessage(query, true);
  addTypingIndicator();

  // Try API first, fallback to offline
  try {
    // Gather context from dashboard
    const context = {
      name: window.currentUser?.displayName || 'مقدم خدمة',
      businessName: document.getElementById('settingBusiness')?.value || 'غير محدد',
      type: document.getElementById('settingType')?.value || '',
      todayAppointments: document.getElementById('statToday')?.textContent || '0',
      pendingAppointments: document.getElementById('statPending')?.textContent || '0',
      totalClients: document.getElementById('statClients')?.textContent || '0'
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, context })
    });

    const data = await res.json();
    removeTypingIndicator();

    if (res.ok && data.reply) {
      addMessage(data.reply, false);
    } else {
      console.error("API Error Response:", data);
      addMessage(getOfflineResponse(query, context), false);
    }
  } catch (err) {
    console.error('FlowAI Fetch Error:', err);
    removeTypingIndicator();
    const context = {
      name: window.currentUser?.displayName || 'مقدم خدمة',
      todayAppointments: document.getElementById('statToday')?.textContent || '0',
      pendingAppointments: document.getElementById('statPending')?.textContent || '0'
    };
    addMessage(getOfflineResponse(query, context), false);
  }
};

function getOfflineResponse(query, context) {
  const q = query.toLowerCase();
  const responses = [];
  
  // Date/time queries
  if (q.includes('موعد') || q.includes('حجز') || q.includes('اليوم')) {
    responses.push('📅 ملخص يومك:');
    responses.push(`• مواعيد اليوم: ${context.todayAppointments || 0}`);
    responses.push(`• بانتظار التأكيد: ${context.pendingAppointments || 0}`);
    return responses.join('\n');
  }
  
  // Client analysis
  if (q.includes('عميل') || q.includes('عملاء')) {
    return `👥 فيه ${context.totalClients || 0} عميل في قاعدة البيانات.\n\nلو حابب تتابع عملاءكInactive، ممكن تفلترهم من صفحة العملاء.`;
  }
  
  // Revenue/money
  if (q.includes('دخل') || q.includes(' revenue') || q.includes('ايراد')) {
    return '💰 للإيراد تفاصيل، اذهب صفحة الإحصائيات من القائمة الجانبية - فيها تفاصيل كاملة.';
  }
  
  // Tips
  if (q.includes('نصيحة') || q.includes('tip') || q.includes('ازاي')) {
    return [
      '🧠 نصائح ذكية:',
      '',
      '1️⃣ فعّل التذكيرات التلقائية - بتقلل نسبة عدم الحضور',
      '2️⃣ شارك رابط الحجز - سهل على العملاء',
      '3️⃣ تابع إحصائياتك أسبوعياً',
      '4️⃣ أضف ملاحظات لكل عميل - التخصيص يبني ولاء'
    ].join('\n');
  }
  
  // Help
  if (q.includes('help') || q.includes('مساعدة') || q.includes('ازاي')) {
    return [
      '🤖 تقدر تسألني عن:',
      '',
      '• ملخصoday - إحصائيات اليوم',
      '• نصيحة - نصائح ذكية',
      '• عميل - حالة العملاء',
      '• إيراد - الإيرادات',
      '',
      'أو اذهب للوحة التحكم!'
    ].join('\n');
  }
  
  // Default
  return [
    '🤔 سؤال ممتاز!',
    '',
    '🧠 موجود assistingك:',
    `• "${context.name || 'حسابك'}" - معلومة سريعة`,
    '• نصيحة - نصائح ذكية',
    '• ملخصday - إحصائيات Today',
    '',
    'جرب تسألني بطريقة مختلفة!'
  ].join('\n');
}

window.sendFlowAI = function () {
  const input = document.getElementById('flowAiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  window.askFlowAI(text);
};
