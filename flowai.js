// flowai.js — FlowAI Smart Assistant

// ===== TOGGLE PANEL =====
window.toggleFlowAI = function () {
  const panel = document.getElementById('flowAiPanel');
  const fab = document.getElementById('flowAiFab');
  panel.classList.toggle('open');
  fab.classList.toggle('hidden');
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
      const errDetail = data.reply || data.error || `خطأ ${res.status}`;
      addMessage(`عذراً: ${errDetail}`, false);
    }
  } catch (err) {
    console.error('FlowAI Fetch Error:', err);
    removeTypingIndicator();
    addMessage('في مشكلة في النت أو السيرفر، مش قادر اتصل دلوقتي.', false);
  }
};

window.sendFlowAI = function () {
  const input = document.getElementById('flowAiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  window.askFlowAI(text);
};
