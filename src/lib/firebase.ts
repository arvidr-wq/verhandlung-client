// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "verhandlung-2.firebaseapp.com",
  projectId: "verhandlung-2",
  storageBucket: "verhandlung-2.firebasestorage.app",
  messagingSenderId: "226065560845",
  appId: "1:226065560845:web:48c2a51962dd3d9508edc",
  measurementId: "G-5FSCI9M9ML",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);