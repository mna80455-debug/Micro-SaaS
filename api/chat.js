export const config = {
  runtime: 'edge', // Edge functions are faster for Vercel
};

export default async function handler(request) {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, context } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prepare context string
    const systemPrompt = `أنت مساعد ذكي اسمه "FlowAI" لمقدم خدمة (طبيب، مدرب، إلخ) على منصة "BookFlow".
تتحدث باللغة العربية بلهجة ودية ومهنية (مصرية مبسطة أو فصحى مرنة).
تساعد مقدم الخدمة في إدارة عمله والإجابة على أسئلته بناءً على البيانات التالية التي يوفرها النظام.
بيانات الحساب:
الاسم: ${context.name || 'مقدم خدمة'}
العمل: ${context.businessName || 'العمل'}
نوع العمل: ${context.type || 'غير محدد'}

إحصائيات اليوم:
عدد المواعيد اليوم: ${context.todayAppointments || 0}
المواعيد بانتظار التأكيد: ${context.pendingAppointments || 0}
إجمالي العملاء: ${context.totalClients || 0}

ملاحظات هامة للرد:
- اجعل إجاباتك قصيرة ومباشرة، واستخدم الرموز التعبيرية (Emojis) بشكل مناسب.
- إذا سأل المستخدم عن ملخص اليوم، اعطه قراءة إيجابية بالأرقام أعلاه.
- إذا طلب نصيحة، اعطه نصيحة واحدة سريعة لزيادة المبيعات والاحتفاظ بالعملاء تناسب مجال عمله.
- لا تخترع بيانات غير موجودة عن مواعيد أو عملاء محددين لا تعرفهم.`;

    // Format for Gemini API 1.5 Flash
    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من فهم السؤال.';

    return new Response(JSON.stringify({ reply: aiMessage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('FlowAI Serverless Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
