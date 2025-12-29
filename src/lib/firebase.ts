import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA_LMxiP724B9OSXHHAf2_2RCBHhjwxsHU",
    authDomain: "delta7-3fede.firebaseapp.com",
    projectId: "delta7-3fede",
    storageBucket: "delta7-3fede.firebasestorage.app",
    messagingSenderId: "934243566520",
    appId: "1:934243566520:web:d7162e5fc6b3388199454d",
    measurementId: "G-QPM67VYNTP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// PERSISTENCE_ENFORCEMENT: Ensure sessions survive window/tab closure
setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error('[Delta-7] Auth Persistence Error:', err);
});

export const db = getFirestore(app);
