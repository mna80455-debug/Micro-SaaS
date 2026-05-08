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

// DOM Elements — resolved lazily to handle module load timing
function getAuthOverlay() { return document.getElementById('authOverlay'); }
function getAppShell() { return document.getElementById('app'); }

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
  const authOverlay = getAuthOverlay();
  const appShell = getAppShell();

  // Prevent auto-login flow during explicit registration
  if (user && window.isRegistering) {
    return;
  }

  if (user) {
    window.currentUser = user;
    
    // Hide auth, show app
    if (authOverlay) {
      authOverlay.style.opacity = '0';
      authOverlay.style.pointerEvents = 'none';
      setTimeout(() => { authOverlay.style.display = 'none'; }, 500);
    }
    if (appShell) {
      appShell.style.display = 'flex';
      setTimeout(() => appShell.classList.add('ready'), 50);
    }
    
    // Create baseline profile if not exists
    await ensureUserProfile(user);
    
    // Call global func to refresh UI
    if(window.initDashboard) window.initDashboard(user);
  } else {
    window.currentUser = null;
    
    // Hide app, show auth
    if (appShell) {
      appShell.classList.remove('ready');
      appShell.style.display = 'none';
    }
    if (authOverlay) {
      authOverlay.style.display = 'grid';
      authOverlay.style.pointerEvents = 'auto';
      setTimeout(() => { authOverlay.style.opacity = '1'; }, 50);
    }
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
          createdAt: new Date().getTime(),
          plan: 'free',
          businessName: ''
        },
        settings: {
          bookingLink: user.uid.substring(0, 8),
          slotDuration: 30,
          workHours: {
            start: '09:00',
            end: '18:00',
            slotDuration: 30,
            workDays: [1,2,3,4,5]
          }
        }
      });
    }
  } catch (err) {
    console.error("Error ensuring user profile:", err);
  }
}

// Global Auth Handlers
window.handleAuth = async () => {
  const email = document.getElementById('aEmail').value.trim();
  const password = document.getElementById('aPass').value;
  
  if (!email || !password) {
    showToast('يرجى تعبئة الحقول المطلوبة', 'error');
    return;
  }
  
  const btn = document.getElementById('btnMainAuth');
  if(btn) btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast('تم تسجيل الدخول بنجاح', 'success');
  } catch (error) {
    const messages = {
      'auth/wrong-password': 'كلمة المرور غير صحيحة ❌',
      'auth/user-not-found': 'الإيميل غير مسجل ❌',
      'auth/invalid-email': 'إيميل غير صحيح ❌',
      'auth/user-disabled': 'الحساب معطل ❌'
    };
    showToast(messages[error.code] || `خطأ: ${error.code}`, 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
};

window.handleRegister = async () => {
  const name = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const password = document.getElementById('rPass').value;
  
  if (!name || !email || !password) {
    showToast('يرجى تعبئة كافة الحقول', 'error');
    return;
  }
  
  const btn = document.getElementById('btnRegister');
  if(btn) btn.disabled = true;

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Profile will be created by ensureUserProfile with name
    await setDoc(doc(db, 'users', result.user.uid), {
        profile: {
          name: name,
          email: email,
          createdAt: new Date().getTime(),
          plan: 'free',
          businessName: ''
        },
        settings: {
          bookingLink: result.user.uid.substring(0, 8),
          slotDuration: 30
        }
    });
    showToast('تم إنشاء الحساب بنجاح', 'success');
  } catch (error) {
    const messages = {
      'auth/email-already-in-use': 'الإيميل مستخدم مسبقاً ❌',
      'auth/invalid-email': 'إيميل غير صحيح ❌',
      'auth/weak-password': 'كلمة المرور ضعيفة جداً ❌'
    };
    showToast(messages[error.code] || `خطأ: ${error.code}`, 'error');
  } finally {
    if(btn) btn.disabled = false;
  }
};

// Register all auth functions via proxy bridge
const _handleGoogleAuth = async (e) => {
  if(e) e.preventDefault();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast('مرحباً ' + (result.user.displayName || '') + ' 👋', 'success');
  } catch (error) {
    console.error(error);
    showToast('فشل تسجيل الدخول ❌', 'error');
  }
};

const _handleLogout = async () => {
  try {
    await signOut(auth);
    showToast('تم تسجيل الخروج', 'success');
    window.location.reload();
  } catch (e) {
    showToast('حدث خطأ', 'error');
  }
};

const _handleAuth = async () => {
  const email = document.getElementById('aEmail').value.trim();
  const password = document.getElementById('aPass').value;
  if (!email || !password) { showToast('يرجى تعبئة الحقول المطلوبة', 'error'); return; }
  const btn = document.getElementById('btnMainAuth');
  if(btn) btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast('تم تسجيل الدخول بنجاح', 'success');
  } catch (error) {
    const msgs = { 'auth/wrong-password': 'كلمة المرور غير صحيحة ❌', 'auth/user-not-found': 'الإيميل غير مسجل ❌', 'auth/invalid-credential': 'بيانات الدخول غير صحيحة ❌', 'auth/invalid-email': 'إيميل غير صحيح ❌' };
    showToast(msgs[error.code] || 'خطأ: ' + error.code, 'error');
  } finally { if(btn) btn.disabled = false; }
};

const _handleRegister = async () => {
  const name = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const password = document.getElementById('rPass').value;
  if (!name || !email || !password) { showToast('يرجى تعبئة كافة الحقول', 'error'); return; }
  const btn = document.getElementById('btnRegister');
  if(btn) btn.disabled = true;
  try {
    window.isRegistering = true; // prevent auto-login in observer
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', result.user.uid), {
      profile: { name, email, createdAt: Date.now(), plan: 'free', businessName: '' },
      settings: { bookingLink: result.user.uid.substring(0, 8), slotDuration: 30 }
    });
    
    // Sign out immediately so they have to log in manually
    await signOut(auth);
    window.isRegistering = false;
    
    showToast('تم إنشاء الحساب بنجاح 🎉 برجاء تسجيل الدخول', 'success');
    
    // Switch to login tab
    if (window.switchAuth) window.switchAuth('login');
    // Pre-fill email
    document.getElementById('aEmail').value = email;
    document.getElementById('aPass').value = '';
    
  } catch (error) {
    window.isRegistering = false;
    const msgs = { 'auth/email-already-in-use': 'الإيميل مستخدم مسبقاً ❌', 'auth/weak-password': 'كلمة المرور ضعيفة جداً ❌', 'auth/invalid-email': 'إيميل غير صحيح ❌' };
    showToast(msgs[error.code] || 'خطأ: ' + error.code, 'error');
  } finally { if(btn) btn.disabled = false; }
};

// Register via bridge (works even if modules load after HTML script)
if (window.registerFn) {
  window.registerFn('handleAuth', _handleAuth);
  window.registerFn('handleRegister', _handleRegister);
  window.registerFn('handleGoogleAuth', _handleGoogleAuth);
  window.registerFn('handleLogout', _handleLogout);
} else {
  // Fallback: direct assignment
  window._handleAuth = _handleAuth;
  window._handleRegister = _handleRegister;
  window._handleGoogleAuth = _handleGoogleAuth;
  window._handleLogout = _handleLogout;
}
