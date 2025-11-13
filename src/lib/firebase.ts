// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBvAD-MICTfMtanfFcjYAGmYtTf1xIBQw",
  authDomain: "verhandlung-2.firebaseapp.com",
  projectId: "verhandlung-2",
  storageBucket: "verhandlung-2.firebasestorage.app",
  messagingSenderId: "226056568545",
  appId: "1:226056568545:web:48c2a51962dd3d39508edc",
  measurementId: "G-5F5CM1P9ML", // optional, kann auch weg
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);