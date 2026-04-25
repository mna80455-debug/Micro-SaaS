// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtI5G0yVpeluP_HjlE_ff3D5FSy0FrmcA",
  authDomain: "micro-saas-9457c.firebaseapp.com",
  projectId: "micro-saas-9457c",
  storageBucket: "micro-saas-9457c.firebasestorage.app",
  messagingSenderId: "680663136963",
  appId: "1:680663136963:web:3cabf82355b62c8307c076",
  measurementId: "G-E7H3S4KGS7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/* 
======================================================
 Firestore Security Rules Proposal
======================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Admin checking or user access
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /appointments/{appointmentId} {
      // Users can read/write their own appointments. 
      // Public can create pending appointments if bookedByClient == true, but cannot modify existing ones.
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if (request.auth != null && request.resource.data.userId == request.auth.uid) 
                    || request.resource.data.bookedByClient == true;
    }

    match /services/{serviceId} {
      // Providers can write, public can read
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    match /clients/{clientId} {
      // Only the provider can manage their clients list
      allow read, write: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
  }
}
*/
