import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { readFileSync } from 'fs';
import { join } from 'path';

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
const db = getFirestore(app);

async function sync() {
    try {
        const data = JSON.parse(readFileSync(join(process.cwd(), 'src/season1_prologues.json'), 'utf8'));

        console.log('Syncing prologues to Firestore...');
        for (const item of data) {
            const id = `day_${item.day}`;
            await setDoc(doc(db, 'season1_prologues', id), item);
            console.log(`Synced ${id}`);
        }
        console.log('Success: All prologues synced.');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing:', error);
        process.exit(1);
    }
}

sync();
