import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC0JVpMDkhpibFmcQoKbI-ZIxB8QkTNM08",
  authDomain: "carranza-lab.firebaseapp.com",
  projectId: "carranza-lab",
  storageBucket: "carranza-lab.firebasestorage.app",
  messagingSenderId: "25004838261",
  appId: "1:25004838261:web:fe8c045ed95f41c7e2973c",
  measurementId: "G-L780XRFWZG"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);