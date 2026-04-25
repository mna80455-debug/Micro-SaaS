// auth.js
import { auth, googleProvider, db } from './firebase-config.js';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showToast } from './components/toast.js';

let isLoginMode = true;

// DOM Elements
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authTitle = document.querySelector('.auth-title');
const btnLogOut = document.getElementById('btnLogOut');

// Make sure currentUser is available globally
window.currentUser = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.currentUser = user;
    authScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // Create baseline profile if not exists
    await ensureUserProfile(user);
    
    // Call global func to refresh UI
    if(window.initDashboard) window.initDashboard(user);
  } else {
    window.currentUser = null;
    appContainer.classList.add('hidden');
    authScreen.classList.remove('hidden');
  }
});

async function ensureUserProfile(user) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        profile: {
          name: user.displayName || "مستخدم جديد",
          email: user.email,
          createdAt: new Date(),
          plan: 'free'
        },
        settings: {
          bookingLink: user.uid.substring(0, 8),
          slotDuration: 30
        }
      });
    }
  } catch (err) {
    console.error("Error ensuring user profile:", err);
  }
}

// Google Login
btnGoogleLogin?.addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast('مرحباً ' + (result.user.displayName || '') + ' 👋', 'success');
  } catch (error) {
    console.error(error);
    showToast('فشل تسجيل الدخول ❌', 'error');
  }
});

// Email/Password Submit
authSubmitBtn?.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  
  if (!email || !password) {
    showToast('يرجى تعبئة الحقول المطلوبة', 'error');
    return;
  }
  
  authSubmitBtn.disabled = true;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('تم تسجيل الدخول بنجاح', 'success');
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast('تم إنشاء الحساب بنجاح', 'success');
    }
  } catch (error) {
    const messages = {
      'auth/wrong-password': 'كلمة المرور غير صحيحة ❌',
      'auth/user-not-found': 'الإيميل غير مسجل ❌',
      'auth/invalid-email': 'إيميل غير صحيح ❌',
      'auth/email-already-in-use': 'الإيميل مستخدم مسبقاً ❌',
      'auth/weak-password': 'كلمة المرور ضعيفة جداً ❌'
    };
    const errorMessage = messages[error.code] || `خطأ: ${error.code}`;
    showToast(errorMessage, 'error');
  } finally {
    authSubmitBtn.disabled = false;
  }
});

// Toggle Login / Signup Mode
toggleAuthBtn?.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = "أهلاً بيك";
    authSubmitBtn.textContent = "تسجيل الدخول";
    toggleAuthBtn.textContent = "سجل دلوقتي";
  } else {
    authTitle.textContent = "حساب جديد";
    authSubmitBtn.textContent = "إنشاء حساب";
    toggleAuthBtn.textContent = "تسجيل الدخول";
  }
});

// Logout
btnLogOut?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast('تم تسجيل الخروج', 'success');
  } catch (e) {
    showToast('حدث خطأ', 'error');
  }
});

// Forgot Password
document.getElementById('btnForgotPassword')?.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  if(!email) {
    showToast('يرجى إدخال الإيميل أولاً', 'error');
    authEmail.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط استعادة كلمة المرور 📧', 'success');
  } catch(e) {
    const messages = {
      'auth/invalid-email': 'إيميل غير صحيح',
      'auth/user-not-found': 'الإيميل غير مسجل'
    };
    showToast(messages[e.code] || 'حدث خطأ', 'error');
  }
});

// Email Verification Check & Send
window.checkAndSendVerification = async function() {
  const user = window.currentUser;
  if(!user) return;

  try {
    if(user.emailVerified) {
      showToast('الإيميل مُفعّل مسبقاً ✓', 'success');
      return;
    }
    await sendEmailVerification(user);
    showToast('تم إرسال رابط التفعيل 📧', 'success');
  } catch(e) {
    showToast('حدث خطأ', 'error');
  }
};
