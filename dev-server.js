import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.join('=').trim();
      }
    });
    console.log('✅ Loaded environment variables from .env');
  }
}

loadEnv();

const PORT = process.env.PORT || 8000;

// Simple static file server mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Handle API routes
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ reply: 'مفتاح API غير موجود' }));
          return;
        }

        const { message, context = {} } = payload;
        
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
2. اجعل الإجابات قصيرة ومباشرة.
3. استخدم الرموز تعبيرية (Emojis) بشكل مناسب.
`;

        const requestBody = JSON.stringify({
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
        });

        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ reply: 'خطأ: ' + json.error.message }));
                return;
              }
              const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أستطع معالجة طلبك.';
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ reply }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ reply: 'خطأ في معالجة الرد' }));
            }
          });
        });

        apiReq.on('error', (e) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ reply: 'خطأ في الاتصال: ' + e.message }));
        });

        apiReq.write(requestBody);
        apiReq.end();
      } catch (err) {
        console.error('API Error:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
    return;
  }

  // Handle static files
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/app') pathname = '/app.html';
  
  let filePath = path.join(__dirname, pathname);
  
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    }
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop`);
});
