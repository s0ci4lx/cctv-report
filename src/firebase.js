import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 👈 1. Import Firestore

// 1. สร้างออบเจ็กต์ Config โดยอ่านค่าจาก .env
// Vite จะใช้ import.meta.env.VITE_... ในการดึงค่า
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 3. Export service ที่เราต้องการใช้
const auth = getAuth(app);
const db = getFirestore(app); // 👈 2. สร้างตัวแปร db

// 4. ส่งออก auth และ db ไปให้ไฟล์อื่นใช้
export { auth, db };