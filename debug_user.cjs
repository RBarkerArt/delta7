
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to point to a valid key or use applicationDefault if available

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // or try checking without explicit creds if environment is set
        projectId: "delta7-3fede"
    });
}

const uid = "PS0ymsMKGyZYkkqFSwzd8BcAfUl2";

async function checkUser() {
    try {
        const userRecord = await admin.auth().getUser(uid);
        console.log("User Record for:", uid);
        console.log("  - Anonymous:", userRecord.providerData.length === 0); // Note: Admin SDK treats differently
        console.log("  - ProviderData:", JSON.stringify(userRecord.providerData, null, 2));

        // Check custom claims
        console.log("  - Custom Claims:", userRecord.customClaims);

        process.exit(0);
    } catch (error) {
        console.log("Error fetching user data:", error);
        process.exit(1);
    }
}

checkUser();
