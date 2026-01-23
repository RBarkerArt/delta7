import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const migrateObservers = async () => {
    console.log('[Delta-7] Starting Client-Side Data Migration (Users -> Observers)...');

    try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);

        console.log(`[Delta-7] Found ${usersSnapshot.size} total docs in users.`);

        let batch = writeBatch(db);
        let count = 0;

        for (const userDoc of usersSnapshot.docs) {
            const uid = userDoc.id;
            const data = userDoc.data();

            if (data.role === 'admin') {
                console.log(`[Delta-7] Skipping Admin: ${uid}`);
                continue;
            }

            console.log(`[Delta-7] Migrating Subject: ${uid}`);

            // 1. Create Observer document (using UID as VisitorID for legacy continuity)
            const observerRef = doc(db, 'observers', uid);
            const observerData = {
                ...data,
                visitorId: uid,
                anchoredFirebaseUid: data.isAnchored === true ? uid : null,
                migratedAt: serverTimestamp()
            };
            batch.set(observerRef, observerData);

            // 2. Create Mapping document
            const mappingRef = doc(db, 'firebase_uid_mapping', uid);
            batch.set(mappingRef, {
                visitorId: uid,
                lastUpdated: serverTimestamp(),
                migrated: true
            });

            count++;

            if (count % 400 === 0) {
                await batch.commit();
                console.log(`[Delta-7] Committed batch of ${count} documents.`);
                batch = writeBatch(db);
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`[Delta-7] Committed final batch. Total migrated: ${count}`);
        } else {
            console.log('[Delta-7] No documents required migration.');
        }

        console.log(`[Delta-7] Migration sequence complete.`);
    } catch (error) {
        console.error('[Delta-7] Migration sequence failed:', error);
    }
};

migrateObservers().then(() => {
    console.log('[Delta-7] Process terminated.');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
