import { db } from '../src/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import season1Data from '../src/season1_days.json';

const seedDatabase = async () => {
    console.log('Starting seed process...');

    try {
        const daysCollection = collection(db, 'season1_days');

        for (const day of season1Data) {
            const dayId = `day_${day.day}`;
            await setDoc(doc(daysCollection, dayId), day);
            console.log(`Uploaded Day ${day.day}`);
        }

        console.log('Seeding complete.');
    } catch (error) {
        console.error('Seeding failed:', error);
    }
};

seedDatabase();
