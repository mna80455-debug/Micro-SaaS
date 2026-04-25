export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    return res.status(500).json({ reply: 'عذراً، مفتاح الـ API غير مهيأ في الإعدادات.' });
  }

  try {
    const { message, context = {} } = req.body;
    
    if (!message) return res.status(400).json({ reply: 'لم يتم استلام أي رسالة.' });

    const systemPrompt = `
أنت FlowAI، مساعد ذكي متكامل لنظام BookFlow لإدارة المواعيد.
مهمتك هي مساعدة ${context.name || 'المستخدم'} في إدارة عمله.

سياق العمل الحالي:
- اسم النشاط: ${context.businessName || 'غير محدد'}
- نوع النشاط: ${context.type || 'عام'}
- مواعيد اليوم: ${context.todayAppointments || 0}
- بانتظار التأكيد: ${context.pendingAppointments || 0}
- إجمالي العملاء: ${context.totalClients || 0}

تعليمات الرد:
1. رد بلهجة مصرية احترافية، ودودة، وذكية.
2. اجعل الإجابات قصيرة ومباشرة (إلا إذا طلب المستخدم تفاصيل).
3. استخدم الرموز التعبيرية (Emojis) بشكل مناسب.
4. إذا سأل المستخدم عن بيانات غير موجودة في السياق، وجهه للذهاب للصفحة المناسبة في لوحة التحكم.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(500).json({ reply: `حدث خطأ في الاتصال بـ FlowAI: ${data.error.message}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع معالجة طلبك الآن. حاول مرة أخرى.";
    res.status(200).json({ reply });
    
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ reply: 'حدث خطأ غير متوقع في السيرفر.' });
  }
}
