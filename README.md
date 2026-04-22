# BookFlow 💫

نظام احترافي لإدارة المواعيد والحجوزات — بدون تعقيد.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-teal)

---

## 🎯 إيش بيعمل؟

BookFlow بيخليك:
- ✅ تنشئ رابط حجز خاص بك وتديه عملائك
- ✅ العميل يحجز من نفسه بدون محادثة WhatsApp
- ✅ تتابع كل مواعيدك في مكان واحد
- ✅ تعرف حالة كل حجز (مؤكد، منتظر، اكتمل، ملغي)
- ✅ ترسل للعملاء تذكيرات تلقائية
- ✅ تشوف إحصائيات الإيرادات والعملاء

---

## 🚀 المزايا

| الميزة | الوصف |
|--------|-------|
| **رابط الحجز** | شارك عملائك رابط يحجزون منه 24/7 |
| **لوحة التحكم** | كل مواعيدك وإيراداتك في مكان واحد |
| **التقويم** | عرض أسبوعي لكل الحجوزات |
| **إدارة العملاء** | بيانات كل عميل وتاريخ زياراته |
| **الخدمات** | عرف خدماتك وأسعارها ومددها |
| **الإحصائيات** | إيرادات شهرية وتقرير أفضل العملاء |
| **multi-device** | اشتغل من الموبايل أو الكمبيوتر |

---

## 📱 شاشات النظام

```
🏠 Landing Page
   └── شرح النظام والأسعار
   
🔐 تسجيل الدخول
   └── Google أو إيميل وكلمة مرور
   
📊 Dashboard
   ├── إحصائيات سريعة
   ├── مواعيد اليوم
   └── آخر العملاء
   
📅 Calendar
   └── عرض أسبوعي
   
👥 Clients
   └── قائمة العملاء + بحث
   
⚙️ Services
   └── الخدمات + الأسعار
   
📈 Stats
   └── تقارير الإيرادات
   
⚙️ Settings
   └── إعدادات الحساب
```

---

## 💻 التقنيات

- **Frontend:** Vanilla JavaScript + HTML + CSS
- **Backend:** Firebase (Auth + Firestore)
- **Icons:** Phosphor Icons
- **Fonts:** Plus Jakarta Sans + Inter

---

## 📦 الخدمات

| الخطة | السعر | المميزات |
|--------|--------|-----------|
| **مجاني** | 0 ج.م/شهر | حتى 20 حجزشهرياً |
| **Pro** | 99 ج.م/شهر | حجوزات غير محدودة + WhatsApp |
| **Business** | 299 ج.م/شهر | موظفين متعددين + API |

---

## 🔧 التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/mna80455-debug/Micro-SaaS.git

# افتح المجلد
cd Micro-SaaS/bookflow

# شغل على أي سيرفر
# مثال: Live Server أو python
python -m http.server 8000
```

أو ارفع على Firebase Hosting:

```bash
npm install -g firebase-tools
firebase init hosting
firebase deploy
```

---

## 🔐 متغيرات البيئة

أنشئ مشروع على [Firebase Console](https://console.firebase.google.com) وضع الإعدادات في `firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ...
};
```

---

## 📄 الرخصة

MIT License - feel free to use it.

---

## 📨 التواصل

- 📧 الإيميل: hello@bookflow.app
- 🌐 الموقع: bookflow.app

---

**Made with ❤️ in Egypt**