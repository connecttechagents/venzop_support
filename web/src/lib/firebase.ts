import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAGxC6exUuybxy9RDdY8SgoTo7tWzYxtRY",
  authDomain: "venzop-support.firebaseapp.com",
  projectId: "venzop-support",
  storageBucket: "venzop-support.firebasestorage.app",
  messagingSenderId: "832832578378",
  appId: "1:832832578378:web:033630ea042d23b6e1d7b3",
  measurementId: "G-642PBCK8BX"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
