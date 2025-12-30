import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDiLbc_PiVR1EVoLRJlZvNZYSMxb2rEE54",
  authDomain: "onboarding-consultoria.firebaseapp.com",
  projectId: "onboarding-consultoria",
  storageBucket: "onboarding-consultoria.firebasestorage.app",
  messagingSenderId: "658269586608",
  appId: "1:658269586608:web:991d2c39d6f1664aaae775"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };