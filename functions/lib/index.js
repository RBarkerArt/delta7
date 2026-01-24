"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverSignal = exports.assignFrequency = exports.deleteUserData = exports.generateResizedImage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
// Initialize Firebase Admin
admin.initializeApp();
// 7.1 Asset Pipeline: Image Resizing
// Note: 'sharp' dependency is required for this to work in production.
// Verified it is in package.json.
const sharp_1 = __importDefault(require("sharp"));
exports.generateResizedImage = functions.storage.object().onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;
    // Exit if this is triggered on a file that is not an image.
    if (!contentType || !contentType.startsWith("image/")) {
        return functions.logger.log("This is not an image.");
    }
    // Get the file name.
    if (!filePath)
        return;
    const fileName = path.basename(filePath);
    // Exit if the image is already a thumb.
    if (fileName.startsWith("thumb_")) {
        return functions.logger.log("Already a Thumbnail.");
    }
    const bucket = admin.storage().bucket(fileBucket);
    const workingDir = path.join(os.tmpdir(), "thumbs");
    const tmpFilePath = path.join(workingDir, fileName);
    // Create the temp directory
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir);
    }
    // Download file from bucket.
    await bucket.file(filePath).download({
        destination: tmpFilePath,
    });
    functions.logger.log("Image downloaded locally to", tmpFilePath);
    // Resize image using sharp
    const thumbFileName = `thumb_${fileName}`;
    const thumbFilePath = path.join(workingDir, thumbFileName);
    await (0, sharp_1.default)(tmpFilePath)
        .resize(500, 500, { fit: 'inside' })
        .toFile(thumbFilePath);
    // Upload the thumbnail to the bucket
    await bucket.upload(thumbFilePath, {
        destination: path.join(path.dirname(filePath), thumbFileName),
        metadata: {
            contentType: contentType
        }
    });
    // Cleanup remove the tmp/thumbs from the filesystem
    return fs.unlinkSync(thumbFilePath);
});
// 13.1 Right to Erasure: Recursive Delete
exports.deleteUserData = functions.https.onCall(async (data, context) => {
    // Protocol 14.2: Rate Discipline/Validation
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required to delete account.');
    }
    const uid = context.auth.uid;
    console.log(`Initiating erasure for user: ${uid}`);
    try {
        // 1. Delete Firestore Data
        // Check both potential collections
        const userRef = admin.firestore().collection('users').doc(uid);
        const observerRef = admin.firestore().collection('observers').doc(uid);
        const mappingRef = admin.firestore().collection('firebase_uid_mapping').doc(uid);
        const batch = admin.firestore().batch();
        batch.delete(userRef);
        batch.delete(observerRef);
        batch.delete(mappingRef);
        await batch.commit();
        console.log(`Firestore data deleted for ${uid}`);
        // 2. Delete Auth Account
        await admin.auth().deleteUser(uid);
        console.log(`Auth account deleted for ${uid}`);
        return { success: true, message: "Account and data permanently erased." };
    }
    catch (error) {
        console.error("Erasure failed:", error);
        throw new functions.https.HttpsError('internal', 'Failed to erase user data.');
    }
});
// -------------------------------------------------------------
// PROJECT SIGNAL: Access Code System (v2)
// -------------------------------------------------------------
const https_1 = require("firebase-functions/v2/https");
// Helper: Generate Base32-like code (avoid confusing chars like I/L/1/0)
const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 3; i++)
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += '-';
    for (let i = 0; i < 3; i++)
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code; // Format: XXX-XXX
};
// 1. Assign Frequency (v2)
exports.assignFrequency = (0, https_1.onCall)({
    cors: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Auth required');
    const uid = request.auth.uid;
    const db = admin.firestore();
    // Determine collection based on existing doc. Project Anchor logic puts anon users in observers.
    // We'll write to 'access_codes' collection for reverse lookup.
    try {
        // Idempotency: Check if code already exists for this UID
        const existingQuery = await db.collection('access_codes').where('uid', '==', uid).get();
        if (!existingQuery.empty) {
            return { code: existingQuery.docs[0].id };
        }
        let code = generateCode();
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 5) {
            const check = await db.collection('access_codes').doc(code).get();
            if (!check.exists)
                unique = true;
            else
                code = generateCode();
            attempts++;
        }
        if (!unique)
            throw new https_1.HttpsError('resource-exhausted', 'Failed to generate unique frequency');
        await db.collection('access_codes').doc(code).set({
            uid: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Also stamp the user record for easy frontend read
        // Note: We don't know if they are in 'users' or 'observers' without checking, 
        // but typically anon users are in 'observers'.
        await db.collection('observers').doc(uid).set({ accessCode: code }, { merge: true });
        return { code };
    }
    catch (err) {
        console.error('Assign Frequency Failed:', err);
        throw new https_1.HttpsError('internal', 'Frequency assignment failed');
    }
});
// 2. Recover Signal (v2)
exports.recoverSignal = (0, https_1.onCall)({
    cors: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    const code = request.data.code;
    if (!code || typeof code !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Signal frequency required');
    }
    // Format input (uppercase, handle potential missing dash if user lazy?)
    // Sticking to strict format for now: XXX-XXX
    const formattedCode = code.toUpperCase().trim();
    try {
        const doc = await admin.firestore().collection('access_codes').doc(formattedCode).get();
        if (!doc.exists) {
            throw new https_1.HttpsError('not-found', 'Signal frequency invalid or expired.');
        }
        const { uid } = doc.data();
        // Mint Custom Token
        const token = await admin.auth().createCustomToken(uid);
        console.log(`Signal recovered for UID: ${uid} via code ${formattedCode}`);
        return { token };
    }
    catch (err) {
        console.error('Signal Recovery Failed:', err);
        throw new https_1.HttpsError('internal', 'Signal recovery failed');
    }
});
//# sourceMappingURL=index.js.map