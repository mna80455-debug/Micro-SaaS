export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ reply: 'عذراً، يبدو أن مفتاح الـ AI غير معرف في إعدادات السيرفر (Environment Variables).' });
  }

  try {
    const { message, context } = req.body;

    const systemPrompt = `أنت FlowAI، مساعد ذكي لـ ${context.name || 'مستخدم'} في نظام BookFlow.
بياناته: عمله ${context.businessName || 'خاص'}، النوع ${context.type || 'عام'}.
إحصائيات اليوم: مواعيد (${context.todayAppointments}), انتظار (${context.pendingAppointments}), عملاء (${context.totalClients}).
ردودك قصيرة، ذكية، مصرية، وبالأيموجي.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + "\n\nسؤال المستخدم: " + message }] }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ reply: `خطأ من جوجل: ${data.error.message}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "مش قادر أفهم ده حالياً، جرب تسألني عن مواعيدك.";
    res.status(200).json({ reply });

  } catch (error) {
    res.status(500).json({ reply: 'حدث خطأ غير متوقع في السيرفر.' });
  }
}
