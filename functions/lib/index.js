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
exports.discoverRoom = exports.claimDailyPresence = exports.tuneRelay = exports.pruneStaleUsers = exports.migrateProloguesToDays = exports.generateNarrativeContent = exports.claimBreakRoomFridge = exports.claimBreakRoomCoffee = exports.recoverSignal = exports.assignFrequency = exports.deleteUserData = exports.generateResizedImage = exports.sendAnchorWelcome = exports.onNewVisitor = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const nodemailer = __importStar(require("nodemailer"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const sharp_1 = __importDefault(require("sharp"));
// Initialize Firebase Admin
admin.initializeApp();
// -------------------------------------------------------------
// EMAIL PROTOCOL: Nodemailer Configuration
// -------------------------------------------------------------
const EMAIL_PASSWORD = (0, params_1.defineSecret)("EMAIL_PASSWORD");
const createTransporter = (password) => {
    return nodemailer.createTransport({
        host: "mail.spacemail.com",
        port: 465,
        secure: true, // SSL
        auth: {
            user: "purpose@delta7project.com",
            pass: password,
        },
    });
};
// -------------------------------------------------------------
// RATE LIMITS
// -------------------------------------------------------------
const RATE_LIMITS_COLLECTION = "function_rate_limits";
const enforceRateLimit = async (key, limit, windowMs) => {
    const db = admin.firestore();
    const ref = db.collection(RATE_LIMITS_COLLECTION).doc(key);
    const now = Date.now();
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            tx.set(ref, {
                count: 1,
                windowStartMs: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
        }
        const data = snap.data() || {};
        const windowStartMs = typeof data.windowStartMs === "number" ? data.windowStartMs : 0;
        const count = typeof data.count === "number" ? data.count : 0;
        if (now - windowStartMs > windowMs) {
            tx.set(ref, {
                count: 1,
                windowStartMs: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return;
        }
        if (count >= limit) {
            throw new https_1.HttpsError("resource-exhausted", "Rate limit exceeded. Please retry later.");
        }
        tx.update(ref, {
            count: count + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
};
// -------------------------------------------------------------
// ADMIN CHECK
// -------------------------------------------------------------
const assertAdmin = async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    const isAdminClaim = ((_a = request.auth.token) === null || _a === void 0 ? void 0 : _a.role) === "admin";
    if (isAdminClaim)
        return;
    const userDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists || ((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.role) !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin access required.");
    }
};
// 1. Admin Notification: New Visitor Observed
exports.onNewVisitor = functions.runWith({
    secrets: ["EMAIL_PASSWORD"]
}).auth.user().onCreate(async (user) => {
    // Avoid cost spikes from anonymous spam
    if (!user.email && (!user.providerData || user.providerData.length === 0)) {
        functions.logger.log("Skipping admin notification for anonymous user:", user.uid);
        return;
    }
    const password = EMAIL_PASSWORD.value();
    const transporter = createTransporter(password);
    const mailOptions = {
        from: '"Delta-7 Terminal" <purpose@delta7project.com>',
        to: "purpose@delta7project.com",
        subject: "PROTOCOL_SIGNAL: New Visitor Observed",
        text: `A new visitor has been observed.\nUID: ${user.uid}\nTimestamp: ${new Date().toISOString()}`,
    };
    try {
        await transporter.sendMail(mailOptions);
        functions.logger.log("Admin notification sent for UID:", user.uid);
    }
    catch (error) {
        functions.logger.error("Failed to send admin notification:", error);
    }
});
// 2. User Notification: Anchor Welcome (Styled)
exports.sendAnchorWelcome = (0, https_1.onCall)({
    secrets: [EMAIL_PASSWORD],
    enforceAppCheck: true
}, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`anchorWelcome:${request.auth.uid}`, 2, 24 * 60 * 60 * 1000);
    const email = request.auth.token.email;
    if (!email) {
        functions.logger.warn("No email found for user during anchoring welcome:", request.auth.uid);
        return { success: false, reason: "no_email" };
    }
    const password = EMAIL_PASSWORD.value();
    const transporter = createTransporter(password);
    // Prevent repeat sends
    const metaRef = admin.firestore().collection("user_meta").doc(request.auth.uid);
    const metaSnap = await metaRef.get();
    if (metaSnap.exists && ((_a = metaSnap.data()) === null || _a === void 0 ? void 0 : _a.welcomeSentAt)) {
        return { success: true, alreadySent: true };
    }
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
            body { 
                background-color: #050505; 
                margin: 0; 
                padding: 40px; 
                display: flex; 
                justify-content: center;
            }
            .container { 
                max-width: 600px; 
                width: 100%;
                background-color: #0a0a0a; 
                border: 1px solid #10b98133; 
                padding: 40px; 
                color: #10b981; 
                font-family: 'Courier Prime', 'Courier New', Courier, monospace; 
                line-height: 1.6;
                box-shadow: 0 0 20px rgba(16, 185, 129, 0.05);
            }
            .header {
                font-weight: bold;
                margin-bottom: 20px;
                border-bottom: 1px solid #10b98122;
                padding-bottom: 10px;
                font-size: 14px;
                letter-spacing: 2px;
            }
            .body { 
                font-size: 16px; 
                white-space: pre-line;
                margin-bottom: 30px;
            }
            .signature {
                margin-top: 40px;
                opacity: 0.8;
                font-style: italic;
            }
            .footer {
                margin-top: 20px;
                font-size: 10px;
                color: #10b98144;
                text-align: right;
                letter-spacing: 1px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">TRANS_STATUS: ANCHORED // OBS_LOG_000</div>
            <div class="body">
                Observer record anchored.

                The same signal can now be recovered from another surface. No additional access has opened. The archive remains unchanged.

                The room will remember this identifier. That is the only adjustment.
            </div>
            <div class="signature">
                Dr. Kael
                <br>End Transmission
            </div>
            <div class="footer">SIGNAL_LOCK_ID: ${request.auth.uid.slice(0, 8)}...</div>
        </div>
    </body>
    </html>
    `;
    const mailOptions = {
        from: '"Delta-7 System" <purpose@delta7project.com>',
        to: email,
        subject: "TRANS_SIGNAL: Identity Anchored",
        text: `Observer record anchored.\n\nThe same signal can now be recovered from another surface. No additional access has opened. The archive remains unchanged.\n\nThe room will remember this identifier. That is the only adjustment.\n\nDr. Kael\nEnd Transmission`,
        html: htmlContent
    };
    try {
        await transporter.sendMail(mailOptions);
        functions.logger.log("Welcome email sent to:", email);
        await metaRef.set({
            welcomeSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Failed to send welcome email:", error);
        throw new https_1.HttpsError("internal", "Failed to send encrypted signal.");
    }
});
// 7.1 Asset Pipeline: Image Resizing
// Note: 'sharp' dependency is required for this to work in production.
// Verified it is in package.json.
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
    const thumbFileName = `thumb_${fileName.split('.')[0]}.webp`;
    const thumbFilePath = path.join(workingDir, thumbFileName);
    await (0, sharp_1.default)(tmpFilePath)
        .resize(500, 500, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(thumbFilePath);
    // Upload the thumbnail to the bucket
    await bucket.upload(thumbFilePath, {
        destination: path.join(path.dirname(filePath), thumbFileName),
        metadata: {
            contentType: 'image/webp'
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
    if (!context.app) {
        throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
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
// 7.3 AI Narrative Engine
// -------------------------------------------------------------
// PROJECT SIGNAL: Access Code System (v2)
// -------------------------------------------------------------
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
// FIXED: Accept visitorId from frontend to write to correct document
exports.assignFrequency = (0, https_1.onCall)({
    cors: true,
    enforceAppCheck: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Auth required');
    const uid = request.auth.uid;
    const { visitorId } = request.data || {};
    const db = admin.firestore();
    // Validate visitorId - required for anonymous users to track correctly
    if (!visitorId || typeof visitorId !== 'string') {
        console.warn('[assignFrequency] Missing visitorId, falling back to uid');
    }
    // Use visitorId as the primary identifier for observers collection
    const observerDocId = visitorId || uid;
    try {
        // Idempotency: Check if code already exists for this visitorId
        const existingQuery = await db.collection('access_codes')
            .where('visitorId', '==', observerDocId).get();
        if (!existingQuery.empty) {
            console.log(`[assignFrequency] Returning existing code for visitorId: ${observerDocId}`);
            return { code: existingQuery.docs[0].id };
        }
        // Also check by UID for backwards compatibility
        const legacyQuery = await db.collection('access_codes').where('uid', '==', uid).get();
        if (!legacyQuery.empty) {
            console.log(`[assignFrequency] Returning existing code for uid: ${uid}`);
            return { code: legacyQuery.docs[0].id };
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
        // Store both uid and visitorId for comprehensive reverse lookup
        await db.collection('access_codes').doc(code).set({
            uid: uid,
            visitorId: observerDocId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // FIXED: Write to observers/{visitorId} - this is where frontend reads from
        await db.collection('observers').doc(observerDocId).set({ accessCode: code }, { merge: true });
        console.log(`[assignFrequency] Assigned code ${code} to visitorId: ${observerDocId}, uid: ${uid}`);
        return { code };
    }
    catch (err) {
        console.error('Assign Frequency Failed:', err);
        throw new https_1.HttpsError('internal', 'Frequency assignment failed');
    }
});
// 2. Recover Signal (v2)
// FIXED: Return visitorId along with token for proper session restoration
exports.recoverSignal = (0, https_1.onCall)({
    cors: true,
    enforceAppCheck: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    var _a;
    const ip = ((_a = request.rawRequest) === null || _a === void 0 ? void 0 : _a.ip) || "unknown";
    await enforceRateLimit(`recoverSignal:${ip}`, 5, 10 * 60 * 1000);
    const code = request.data.code;
    if (!code || typeof code !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Signal frequency required');
    }
    // Format input (uppercase, handle potential missing dash if user lazy?)
    // Sticking to strict format for now: XXX-XXX
    const formattedCode = code.toUpperCase().trim();
    const codeRegex = /^[A-HJKMNPQRSTUVWXYZ23456789]{3}-[A-HJKMNPQRSTUVWXYZ23456789]{3}$/;
    if (!codeRegex.test(formattedCode)) {
        throw new https_1.HttpsError('invalid-argument', 'Signal frequency format invalid.');
    }
    try {
        const doc = await admin.firestore().collection('access_codes').doc(formattedCode).get();
        if (!doc.exists) {
            throw new https_1.HttpsError('not-found', 'Signal frequency invalid or expired.');
        }
        const data = doc.data();
        const { uid, visitorId } = data;
        // Mint Custom Token
        const token = await admin.auth().createCustomToken(uid);
        console.log(`Signal recovered for UID: ${uid}, visitorId: ${visitorId} via code ${formattedCode}`);
        // Return visitorId so frontend can properly restore the session
        return { token, visitorId };
    }
    catch (err) {
        console.error('Signal Recovery Failed:', err);
        throw new https_1.HttpsError('internal', 'Signal recovery failed');
    }
});
const round2 = (num) => parseFloat(Math.max(0, num).toFixed(2));
const DEFAULT_FRIDGE_ITEMS = [
    { slot: 1, name: "Soda", milligramValue: 1.42, snarkyMessage: "The soda is mostly static and regret.", correctMessage: "A cold soda rolls forward like it was waiting for you." },
    { slot: 2, name: "Sandwich", milligramValue: 2.84, snarkyMessage: "The sandwich has filed a formal complaint.", correctMessage: "Somehow, this sandwich still looks structurally sound." },
    { slot: 3, name: "Milk", milligramValue: 1.42, snarkyMessage: "The milk declines to participate.", correctMessage: "The milk carton hums at a reassuring frequency." },
    { slot: 4, name: "Deli Meat", milligramValue: 2.84, snarkyMessage: "A brave choice. Not a wise one.", correctMessage: "The deli meat packet is sealed, labeled, and only mildly suspicious." },
    { slot: 5, name: "Sliced Cheese", milligramValue: 1.42, snarkyMessage: "The cheese square bends away from your expectations.", correctMessage: "A perfect square of cheese. Geometry has smiled on you." },
    { slot: 6, name: "Apple", milligramValue: 1.42, snarkyMessage: "The apple is decorative. Emotionally, if not legally.", correctMessage: "The apple is crisp enough to feel like a small victory." },
    { slot: 7, name: "Orange", milligramValue: 1.42, snarkyMessage: "The orange refuses to explain itself.", correctMessage: "The orange smells like daylight found a loophole." },
    { slot: 8, name: "Ketchup", milligramValue: 1.42, snarkyMessage: "Ketchup alone is not lunch. The room is concerned.", correctMessage: "The ketchup packet lands with impossible confidence." },
    { slot: 9, name: "Mayonnaise", milligramValue: 1.42, snarkyMessage: "The mayonnaise makes eye contact first. This is not ideal.", correctMessage: "The mayonnaise is cold, sealed, and quietly triumphant." },
    { slot: 10, name: "Broccoli", milligramValue: 2.84, snarkyMessage: "The broccoli knows what you did and remains unimpressed.", correctMessage: "The broccoli is shockingly fresh. Suspicious, but fresh." },
];
const DEFAULT_BREAK_ROOM_CONFIG = {
    unitLabel: "mg",
    coffeeValue: 1.42,
    fridgeOutOfOrderMessage: "Refrigerator is out of order. Maintenance will have it working tomorrow.",
    fridgeCorrectMessage: "Correct shelf. Correct signal.",
    fridgeWrongMessage: "That was a choice. The refrigerator has logged it.",
    fridgeItems: DEFAULT_FRIDGE_ITEMS,
};
const getStringValue = (value, fallback) => {
    if (typeof value !== "string")
        return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};
const getNumberValue = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const normalizeBreakRoomFunctionConfig = (data) => {
    const rawItems = Array.isArray(data === null || data === void 0 ? void 0 : data.fridgeItems) ? data.fridgeItems : [];
    const fridgeItems = DEFAULT_FRIDGE_ITEMS.map((fallback, index) => {
        const rawItem = rawItems.find((entry) => (typeof entry === "object" &&
            entry !== null &&
            getNumberValue(entry.slot, 0) === fallback.slot)) || rawItems[index];
        const item = typeof rawItem === "object" && rawItem !== null ? rawItem : {};
        return {
            slot: fallback.slot,
            name: getStringValue(item.name, fallback.name),
            milligramValue: round2(getNumberValue(item.milligramValue, fallback.milligramValue)),
            snarkyMessage: getStringValue(item.snarkyMessage, fallback.snarkyMessage),
            correctMessage: getStringValue(item.correctMessage, fallback.correctMessage),
        };
    });
    return {
        unitLabel: getStringValue(data === null || data === void 0 ? void 0 : data.unitLabel, DEFAULT_BREAK_ROOM_CONFIG.unitLabel),
        coffeeValue: round2(getNumberValue(data === null || data === void 0 ? void 0 : data.coffeeValue, DEFAULT_BREAK_ROOM_CONFIG.coffeeValue)),
        fridgeOutOfOrderMessage: getStringValue(data === null || data === void 0 ? void 0 : data.fridgeOutOfOrderMessage, DEFAULT_BREAK_ROOM_CONFIG.fridgeOutOfOrderMessage),
        fridgeCorrectMessage: getStringValue(data === null || data === void 0 ? void 0 : data.fridgeCorrectMessage, DEFAULT_BREAK_ROOM_CONFIG.fridgeCorrectMessage),
        fridgeWrongMessage: getStringValue(data === null || data === void 0 ? void 0 : data.fridgeWrongMessage, DEFAULT_BREAK_ROOM_CONFIG.fridgeWrongMessage),
        fridgeItems,
    };
};
const getValidatedVisitorId = (value) => {
    if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 128) {
        throw new https_1.HttpsError("invalid-argument", "Valid visitorId required.");
    }
    return value.trim();
};
const assertObserverAccess = async (uid, visitorId) => {
    var _a, _b;
    const db = admin.firestore();
    const observerRef = db.collection("observers").doc(visitorId);
    const mappingSnap = await db.collection("firebase_uid_mapping").doc(uid).get();
    if (mappingSnap.exists && ((_a = mappingSnap.data()) === null || _a === void 0 ? void 0 : _a.visitorId) === visitorId) {
        return observerRef;
    }
    const observerSnap = await observerRef.get();
    if (observerSnap.exists && ((_b = observerSnap.data()) === null || _b === void 0 ? void 0 : _b.anchoredFirebaseUid) === uid) {
        return observerRef;
    }
    throw new https_1.HttpsError("permission-denied", "Observer record mismatch.");
};
const getSignalDay = (observer) => {
    const day = getNumberValue(observer.dayProgress, 1);
    return Math.max(1, Math.round(day));
};
const hashString = (value) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};
const getWinningFridgeSlot = (visitorId, signalDay) => (hashString(`${visitorId}:${signalDay}:break-room-fridge`) % 10 + 1);
exports.claimBreakRoomCoffee = (0, https_1.onCall)({}, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`breakRoomCoffee:${request.auth.uid}`, 30, 60 * 60 * 1000);
    const visitorId = getValidatedVisitorId((_a = request.data) === null || _a === void 0 ? void 0 : _a.visitorId);
    const db = admin.firestore();
    const observerRef = await assertObserverAccess(request.auth.uid, visitorId);
    const configSnap = await db.collection("break_room_config").doc("main").get();
    const config = normalizeBreakRoomFunctionConfig(configSnap.exists ? configSnap.data() : undefined);
    let response = null;
    await db.runTransaction(async (tx) => {
        const observerSnap = await tx.get(observerRef);
        if (!observerSnap.exists) {
            throw new https_1.HttpsError("not-found", "Observer record unavailable.");
        }
        const observer = observerSnap.data() || {};
        const signalDay = getSignalDay(observer);
        const currentTotal = round2(getNumberValue(observer.milligrams, 0));
        const lastCoffeeSignalDay = Math.round(getNumberValue(observer.lastCoffeeSignalDay, 0));
        if (lastCoffeeSignalDay === signalDay) {
            response = {
                success: false,
                alreadyClaimed: true,
                message: "The pot is warm, empty, and pretending not to notice you.",
                milligrams: currentTotal,
                awarded: 0,
                unitLabel: config.unitLabel,
            };
            return;
        }
        const nextTotal = round2(currentTotal + config.coffeeValue);
        tx.update(observerRef, {
            milligrams: nextTotal,
            lastCoffeeSignalDay: signalDay,
            lastCoffeeClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        response = {
            success: true,
            alreadyClaimed: false,
            message: `Coffee poured. ${config.coffeeValue} ${config.unitLabel} recorded.`,
            milligrams: nextTotal,
            awarded: config.coffeeValue,
            unitLabel: config.unitLabel,
        };
    });
    if (!response)
        throw new https_1.HttpsError("internal", "Coffee claim did not resolve.");
    return response;
});
exports.claimBreakRoomFridge = (0, https_1.onCall)({}, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`breakRoomFridge:${request.auth.uid}`, 30, 60 * 60 * 1000);
    const visitorId = getValidatedVisitorId((_a = request.data) === null || _a === void 0 ? void 0 : _a.visitorId);
    const selectedSlot = getNumberValue((_b = request.data) === null || _b === void 0 ? void 0 : _b.selectedSlot, 0);
    if (!Number.isInteger(selectedSlot) || selectedSlot < 1 || selectedSlot > 10) {
        throw new https_1.HttpsError("invalid-argument", "selectedSlot must be 1-10.");
    }
    const db = admin.firestore();
    const observerRef = await assertObserverAccess(request.auth.uid, visitorId);
    const configSnap = await db.collection("break_room_config").doc("main").get();
    const config = normalizeBreakRoomFunctionConfig(configSnap.exists ? configSnap.data() : undefined);
    let response = null;
    await db.runTransaction(async (tx) => {
        const observerSnap = await tx.get(observerRef);
        if (!observerSnap.exists) {
            throw new https_1.HttpsError("not-found", "Observer record unavailable.");
        }
        const observer = observerSnap.data() || {};
        const signalDay = getSignalDay(observer);
        const currentTotal = round2(getNumberValue(observer.milligrams, 0));
        const lastFridgeSignalDay = Math.round(getNumberValue(observer.lastFridgeSignalDay, 0));
        if (lastFridgeSignalDay === signalDay) {
            response = {
                success: false,
                alreadyClaimed: true,
                message: config.fridgeOutOfOrderMessage,
                milligrams: currentTotal,
                awarded: 0,
                unitLabel: config.unitLabel,
            };
            return;
        }
        const winningSlot = getWinningFridgeSlot(visitorId, signalDay);
        const selectedItem = config.fridgeItems[selectedSlot - 1];
        const winningItem = config.fridgeItems[winningSlot - 1];
        const success = selectedSlot === winningSlot;
        const awarded = success ? selectedItem.milligramValue : 0;
        const nextTotal = round2(currentTotal + awarded);
        const message = success
            ? selectedItem.correctMessage || config.fridgeCorrectMessage
            : selectedItem.snarkyMessage || config.fridgeWrongMessage;
        tx.update(observerRef, {
            milligrams: nextTotal,
            lastFridgeSignalDay: signalDay,
            lastFridgeClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastFridgeOutcome: {
                signalDay,
                selectedSlot,
                selectedItemName: selectedItem.name,
                winningSlot,
                winningItemName: winningItem.name,
                success,
                milligramsAwarded: awarded,
                message,
            },
        });
        response = {
            success,
            alreadyClaimed: false,
            message,
            milligrams: nextTotal,
            awarded,
            unitLabel: config.unitLabel,
            selectedSlot,
            winningSlot,
            selectedItemName: selectedItem.name,
            winningItemName: winningItem.name,
        };
    });
    if (!response)
        throw new https_1.HttpsError("internal", "Refrigerator claim did not resolve.");
    return response;
});
// Interface for the expected AI response structure
exports.generateNarrativeContent = (0, https_1.onCall)({
    secrets: ["GEMINI_API_KEY"],
    enforceAppCheck: true
}, async (request) => {
    var _a;
    // 1. Authentication Check
    await assertAdmin(request);
    await enforceRateLimit(`generateNarrative:${request.auth.uid}`, 20, 60 * 60 * 1000);
    const { prompt, context, dayNumber } = request.data;
    const apiKey = process.env.GEMINI_API_KEY;
    const db = admin.firestore();
    if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > 4000) {
        throw new https_1.HttpsError("invalid-argument", "Prompt must be 1-4000 characters.");
    }
    if (context && (typeof context !== "string" || context.length > 8000)) {
        throw new https_1.HttpsError("invalid-argument", "Context must be <= 8000 characters.");
    }
    if (dayNumber && (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 365)) {
        throw new https_1.HttpsError("invalid-argument", "dayNumber must be 1-365.");
    }
    // 2. Auto-fetch story context for continuity
    let storyBibleContext = "";
    let previousDaysContext = "";
    let currentPlotBeat = "";
    try {
        // Fetch story bible
        const storyBibleDoc = await db.collection('system').doc('story_bible').get();
        if (storyBibleDoc.exists) {
            const bible = storyBibleDoc.data();
            storyBibleContext = `
STORY OVERVIEW: ${(bible === null || bible === void 0 ? void 0 : bible.overview) || 'Not defined'}
THEMES: ${((bible === null || bible === void 0 ? void 0 : bible.themes) || []).join(', ')}
CHARACTERS: ${((bible === null || bible === void 0 ? void 0 : bible.characters) || []).map((c) => `${c.name} (${c.role}): ${c.arc}`).join('; ')}
AI INSTRUCTIONS: ${(bible === null || bible === void 0 ? void 0 : bible.aiInstructions) || ''}
            `.trim();
            // Find current plot beat
            const plotBeats = (bible === null || bible === void 0 ? void 0 : bible.plotBeats) || [];
            const currentBeat = plotBeats.find((beat) => dayNumber >= beat.dayStart && dayNumber <= beat.dayEnd);
            if (currentBeat) {
                currentPlotBeat = `CURRENT PLOT BEAT (Days ${currentBeat.dayStart}-${currentBeat.dayEnd}): ${currentBeat.title}\n${currentBeat.description}`;
            }
        }
        // Fetch previous 5 days for context
        if (dayNumber > 1) {
            const startDay = Math.max(1, dayNumber - 5);
            const prevDaysSnapshot = await db.collection('season1_days')
                .where('day', '>=', startDay)
                .where('day', '<', dayNumber)
                .orderBy('day', 'desc')
                .limit(5)
                .get();
            const prevDays = prevDaysSnapshot.docs.map(doc => doc.data());
            if (prevDays.length > 0) {
                previousDaysContext = `
PREVIOUS DAYS CONTEXT (most recent first):
${prevDays.map(d => { var _a; return `Day ${d.day}: ${d.narrativeSummary}${((_a = d.variables) === null || _a === void 0 ? void 0 : _a.kaelMood) ? ` [Kael: ${d.variables.kaelMood}]` : ''}`; }).join('\n')}
                `.trim();
            }
        }
    }
    catch (contextError) {
        console.warn("Failed to fetch auto-context:", contextError);
        // Continue without auto-context
    }
    // 3. Fetch AI Rules from settings
    let aiRules = "";
    try {
        const settingsDoc = await db.collection('system').doc('settings').get();
        if (settingsDoc.exists) {
            aiRules = ((_a = settingsDoc.data()) === null || _a === void 0 ? void 0 : _a.aiRules) || "";
        }
    }
    catch (err) {
        console.warn("Failed to fetch AI rules:", err);
    }
    console.log(`Generating content for Day ${dayNumber || 'unknown'}`);
    // 4. Connector Logic (Real Implementation)
    const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require("@google/generative-ai")));
    const genAI = new GoogleGenerativeAI(apiKey || "");
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json"
        }
    });
    const systemInstruction = `
    Role: You are the Narrative Engine for 'Delta 7', an immersive sci-fi puzzle interface spanning 365 days.
    Task: Generate a JSON object containing a narrative summary, prologue sentences, 5 system logs (one for each coherence state), and reality fragments.
    Constraint: You MUST output valid JSON only. No markdown formatting.
    
    CONTINUITY IS CRITICAL: This is a long-form narrative. Reference previous events, maintain character consistency, and build on established story threads.
    
    ${storyBibleContext}
    
    ${currentPlotBeat}
    
    ${previousDaysContext}
    
    Data Schema:
    {
      "narrativeSummary": "Internal summary of the plot beat (string, 2-3 sentences)",
      "prologueSentences": ["First sentence shown to user on entry", "Second sentence", "Optional third"],
      "vm_logs": {
        "FEED_STABLE": { "id": "unique_id", "title": "Log Title", "body": "Log Content" },
        "SYNC_RECOVERING": { "id": "unique_id", "title": "Log Title", "body": "Log Content" },
        "COHERENCE_FRAYING": { "id": "unique_id", "title": "Log Title", "body": "Log Content" },
        "SIGNAL_FRAGMENTED": { "id": "unique_id", "title": "Log Title", "body": "Log Content" },
        "CRITICAL_INTERFERENCE": { "id": "unique_id", "title": "Log Title", "body": "Log Content" }
      },
      "fragments": [
        { "id": "frag_id", "body": "Cryptic text...", "severity": "COHERENCE_STATE" }
      ],
      "variables": {
        "kaelMood": "descriptive mood state of Kael",
        "kaelCoherence": 0-100
      }
    }
    
    IMPORTANT: 
    - Provide ALL 5 coherence state logs in 'vm_logs'
    - Prologue sentences should be evocative, setting the tone for the day
    - Include 2-4 reality fragments
    - Variables track story state for future generation
    `;
    const userPrompt = `
    GENERATING: Day ${dayNumber || 'NEW'}
    USER CONTEXT: ${context || 'No additional context provided'}
    INSTRUCTIONS: ${prompt}
    SYSTEM RULES: ${aiRules}
    `;
    try {
        const result = await model.generateContent([systemInstruction, userPrompt]);
        const responseText = result.response.text();
        // Parse JSON safely
        const generatedData = JSON.parse(responseText);
        // Validate structure
        if (!generatedData.narrativeSummary || !generatedData.vm_logs) {
            throw new Error("Invalid structure returned from AI");
        }
        // Ensure prologueSentences exists
        if (!generatedData.prologueSentences) {
            generatedData.prologueSentences = [];
        }
        return generatedData;
    }
    catch (error) {
        console.error("Gemini API Error:", error);
        throw new https_1.HttpsError("internal", "Failed to generate content via AI engine.");
    }
});
// -------------------------------------------------------------
// ONE-TIME MIGRATION: Copy prologues to day logs
// -------------------------------------------------------------
exports.migrateProloguesToDays = (0, https_1.onCall)({
    enforceAppCheck: true
}, async (request) => {
    await assertAdmin(request);
    const db = admin.firestore();
    const prologuesSnapshot = await db.collection("season1_prologues").get();
    const results = [];
    for (const prologueDoc of prologuesSnapshot.docs) {
        const prologueData = prologueDoc.data();
        const dayNumber = prologueData.day;
        const sentences = prologueData.sentences || [];
        const dayDocId = `day_${dayNumber}`;
        const dayRef = db.collection("season1_days").doc(dayDocId);
        const dayDoc = await dayRef.get();
        if (dayDoc.exists) {
            // Update existing day doc with prologueSentences
            await dayRef.update({
                prologueSentences: sentences
            });
            results.push({ day: dayNumber, status: "updated" });
        }
        else {
            // Create new day doc with just prologueSentences
            await dayRef.set({
                day: dayNumber,
                prologueSentences: sentences,
                narrativeSummary: "",
                vm_logs: {},
                fragments: [],
                defaultState: "STABLE",
                variables: {}
            });
            results.push({ day: dayNumber, status: "created" });
        }
    }
    return {
        success: true,
        migrated: results.length,
        details: results
    };
});
// 14. Database Hygiene: Prune Stale Users
// Deletes anonymous users who haven't visited in >90 days
exports.pruneStaleUsers = (0, https_1.onCall)({
    enforceAppCheck: true
}, async (request) => {
    await assertAdmin(request);
    const { dryRun = true } = request.data;
    const db = admin.firestore();
    const auth = admin.auth();
    // 2. Define Cutoff (90 Days ago)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);
    console.log(`[Prune] Starting prune process. Cutoff: ${ninetyDaysAgo.toISOString()}. DryRun: ${dryRun}`);
    try {
        // 3. Query Stale Users
        // Note: avoiding composite index requirement by filtering isAnchored in memory
        // Limit to 500 to avoid timeouts
        const snapshot = await db.collection('observers')
            .where('lastSeenAt', '<', cutoffTimestamp)
            .limit(500)
            .get();
        if (snapshot.empty) {
            return { count: 0, message: "No stale users found." };
        }
        let targetCount = 0;
        let deletedCount = 0;
        const errors = [];
        // 4. Process Results
        const batch = db.batch();
        const deletionPromises = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // CRITICAL SAFETY CHECK: Never delete anchored users
            // Also checking 'email' field as a backup safety
            if (data.isAnchored === true || data.email) {
                continue;
            }
            targetCount++;
            if (!dryRun) {
                // Scedule Firestore Delete
                batch.delete(doc.ref);
                // Schedule Auth Delete
                deletionPromises.push(auth.deleteUser(doc.id).catch(err => {
                    // Ignore 'user-not-found', log others
                    if (err.code !== 'auth/user-not-found') {
                        console.warn(`[Prune] Failed to delete auth for ${doc.id}:`, err);
                        errors.push(doc.id);
                    }
                }));
                deletedCount++;
            }
        }
        // 5. Commit Changes
        if (!dryRun && targetCount > 0) {
            await batch.commit();
            await Promise.all(deletionPromises);
            console.log(`[Prune] Successfully deleted ${deletedCount} stale users.`);
        }
        return {
            success: true,
            dryRun,
            foundStale: snapshot.size,
            eligibleForDeletion: targetCount,
            deleted: deletedCount,
            cutoffDate: ninetyDaysAgo.toISOString(),
            errors: errors.length > 0 ? errors : undefined
        };
    }
    catch (err) {
        console.error("Prune failed:", err);
        throw new https_1.HttpsError("internal", "Prune process failed.");
    }
});
exports.tuneRelay = (0, https_1.onCall)({}, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`tuneRelay:${request.auth.uid}`, 60, 60 * 1000);
    const visitorId = getValidatedVisitorId((_a = request.data) === null || _a === void 0 ? void 0 : _a.visitorId);
    const tuningType = (_b = request.data) === null || _b === void 0 ? void 0 : _b.tuningType; // 'inspect' | 'tune' | 'overtune'
    if (tuningType !== 'inspect' && tuningType !== 'tune' && tuningType !== 'overtune') {
        throw new https_1.HttpsError("invalid-argument", "tuningType must be inspect, tune, or overtune.");
    }
    const db = admin.firestore();
    const observerRef = await assertObserverAccess(request.auth.uid, visitorId);
    const signalsCol = db.collection("system").doc("cartography").collection("tuning_signals");
    // Self-healing check: Seed default signals if collection is empty
    const checkEmpty = await signalsCol.limit(1).get();
    if (checkEmpty.empty) {
        const defaultSignals = [
            {
                id: "sig_001",
                type: "verified",
                category: "label",
                title: "Archive Wing",
                text: "Status: detected. Door count inconsistent. Paper movement recorded behind sealed wall."
            },
            {
                id: "sig_002",
                type: "verified",
                category: "object",
                title: "Wall Map",
                text: "The map does not update when watched. It waits until the room is empty."
            },
            {
                id: "sig_003",
                type: "verified",
                category: "marginalia",
                title: "Drawing Hallways",
                text: "I keep drawing the same hallway wrong. Not incorrectly. Wrong in the same way every time."
            },
            {
                id: "sig_004",
                type: "verified",
                category: "label",
                title: "Hydroponic Corridor",
                text: "Status: humidity detected behind sealed concrete."
            },
            {
                id: "sig_005",
                type: "verified",
                category: "marginalia",
                title: "Observer Weight",
                text: "The observer does not repair the room. That was my first mistake. The observer gives the room a reason to hold its shape."
            },
            {
                id: "sig_006",
                type: "verified",
                category: "object",
                title: "Coffee Mug",
                text: "Ceramic mass unchanged. Contents refreshed without visible source. Taste profile: regret, burnt sugar, old wiring."
            },
            {
                id: "sig_007",
                type: "verified",
                category: "label",
                title: "Sleep Quarters",
                text: "Status: one cot registered as occupied."
            },
            {
                id: "unv_001",
                type: "unverified",
                category: "route",
                title: "Denied Route",
                text: "There is a route between the Break Room and the Observation Cell that neither room admits exists."
            },
            {
                id: "unv_002",
                type: "unverified",
                category: "marginalia",
                title: "Temporal Marginalia",
                text: "Kael wrote this note tomorrow. He was sorry before he knew why."
            },
            {
                id: "unv_003",
                type: "unverified",
                category: "deadzone",
                title: "Name Request",
                text: "The empty channel asked for your name. The system did not answer."
            },
            {
                id: "unv_004",
                type: "unverified",
                category: "deadzone",
                title: "Breathing Echo",
                text: "DEAD ZONE RETURN 03. No image recovered. Audio suggests breathing or ventilation. System cannot distinguish."
            },
            {
                id: "unv_005",
                type: "unverified",
                category: "route",
                title: "Unexpected Steps",
                text: "ROUTE TRACE RECOVERED. Observation Cell → Break Room → Signal Cartography. Additional step detected: Corridor 7-B. Observer denies movement. System believes observer."
            },
            {
                id: "unv_006",
                type: "unverified",
                category: "deadzone",
                title: "Empty Places",
                text: "Dead Zone is not empty. Empty places do not wait."
            },
            {
                id: "unv_007",
                type: "unverified",
                category: "object",
                title: "Facility Map Object",
                text: "Board predates the room. Ink is newer than the board."
            }
        ];
        const batch = db.batch();
        for (const sig of defaultSignals) {
            batch.set(signalsCol.doc(sig.id), Object.assign(Object.assign({}, sig), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        await batch.commit();
    }
    const inspectOutcomes = [
        "The relay coil is cold. It hums at 1.42Hz, vibrating the casing slightly.",
        "A faint carrier wave is active. No coherent data is modulating the signal.",
        "Tuning dial is locked to the local cartography frequency. Sector is quiet.",
        "Relay temp is nominal. Power grid load is 12%."
    ];
    let response = null;
    await db.runTransaction(async (tx) => {
        const observerSnap = await tx.get(observerRef);
        if (!observerSnap.exists) {
            throw new https_1.HttpsError("not-found", "Observer record unavailable.");
        }
        const observer = observerSnap.data() || {};
        const signalDay = getSignalDay(observer);
        const currentTotal = round2(getNumberValue(observer.milligrams, 0));
        const cost = tuningType === 'tune' ? 4.26 : tuningType === 'overtune' ? 9.94 : 0;
        if (cost > 0 && currentTotal < cost) {
            throw new https_1.HttpsError("failed-precondition", "Insufficient residue mass balance.");
        }
        const lastTuningSignalDay = Math.round(getNumberValue(observer.lastTuningSignalDay, 0));
        if (cost > 0 && lastTuningSignalDay === signalDay) {
            throw new https_1.HttpsError("failed-precondition", "Daily tuning capacity reached for this signal day.");
        }
        let selectedMessage = "";
        let chosenSignal = null;
        let elapsed = "";
        if (tuningType === 'inspect') {
            const outcomesList = inspectOutcomes;
            const seedStr = `${visitorId}:${signalDay}:inspect`;
            let hash = 0;
            for (let i = 0; i < seedStr.length; i++) {
                hash = (hash << 5) - hash + seedStr.charCodeAt(i);
                hash |= 0;
            }
            const index = Math.abs(hash) % outcomesList.length;
            selectedMessage = outcomesList[index];
        }
        else {
            // Retrieve signals from DB
            const typeQuery = tuningType === 'tune' ? 'verified' : 'unverified';
            const allMatchingSnap = await tx.get(signalsCol.where('type', '==', typeQuery));
            const allMatching = allMatchingSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
            if (allMatching.length === 0) {
                throw new https_1.HttpsError("internal", "No signals available in the database.");
            }
            const recoveredIds = observer.recoveredItems || [];
            const available = allMatching.filter(sig => {
                const itemKey = tuningType === 'tune' ? `signal:${sig.id}` : `unverified:${sig.id}`;
                return !recoveredIds.includes(itemKey);
            });
            if (available.length > 0) {
                const seedStr = `${visitorId}:${signalDay}:${tuningType}:${recoveredIds.length}`;
                let hash = 0;
                for (let i = 0; i < seedStr.length; i++) {
                    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
                    hash |= 0;
                }
                const index = Math.abs(hash) % available.length;
                chosenSignal = available[index];
            }
            else {
                // All signals recovered, fallback to random repeat
                const index = Math.floor(Math.random() * allMatching.length);
                chosenSignal = allMatching[index];
            }
            selectedMessage = chosenSignal.text;
            elapsed = (0.5 + Math.random() * 1.5).toFixed(1) + "s";
        }
        const nextTotal = round2(currentTotal - cost);
        const updates = {
            milligrams: nextTotal
        };
        if (cost > 0 && chosenSignal) {
            updates.lastTuningSignalDay = signalDay;
            updates.lastTuningClaimedAt = admin.firestore.FieldValue.serverTimestamp();
            updates.lastTuningOutcome = {
                tuningType,
                cost,
                message: selectedMessage,
                signalId: chosenSignal.id,
                signalTitle: chosenSignal.title,
                signalCategory: chosenSignal.category,
                elapsed,
                timestamp: new Date()
            };
            // Add chosen signal to user's recoveredItems
            const recoveryId = tuningType === 'tune' ? `signal:${chosenSignal.id}` : `unverified:${chosenSignal.id}`;
            const recoveredIds = observer.recoveredItems || [];
            if (!recoveredIds.includes(recoveryId)) {
                updates.recoveredItems = [...recoveredIds, recoveryId];
            }
            // Write atomics into observer_tuning_logs
            const logRef = db.collection("observer_tuning_logs").doc();
            tx.set(logRef, {
                observerId: visitorId,
                tuningType,
                cost,
                signalId: chosenSignal.id,
                title: chosenSignal.title,
                text: chosenSignal.text,
                elapsed,
                dayProgress: signalDay,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        tx.update(observerRef, updates);
        response = Object.assign({ success: true, message: selectedMessage, milligrams: nextTotal, tuningType }, (chosenSignal ? {
            signalId: chosenSignal.id,
            signalTitle: chosenSignal.title,
            signalCategory: chosenSignal.category,
            elapsed
        } : {}));
    });
    if (!response)
        throw new https_1.HttpsError("internal", "Relay tuning did not resolve.");
    return response;
});
exports.claimDailyPresence = (0, https_1.onCall)({}, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`claimDailyPresence:${request.auth.uid}`, 60, 60 * 1000);
    const visitorId = getValidatedVisitorId((_a = request.data) === null || _a === void 0 ? void 0 : _a.visitorId);
    const db = admin.firestore();
    const observerRef = await assertObserverAccess(request.auth.uid, visitorId);
    let response = null;
    await db.runTransaction(async (tx) => {
        const observerSnap = await tx.get(observerRef);
        if (!observerSnap.exists) {
            throw new https_1.HttpsError("not-found", "Observer record unavailable.");
        }
        const observer = observerSnap.data() || {};
        const signalDay = getSignalDay(observer);
        const lastDailyReturnDay = Math.round(getNumberValue(observer.lastDailyReturnDay, 0));
        const currentTotal = round2(getNumberValue(observer.milligrams, 0));
        if (signalDay <= lastDailyReturnDay) {
            response = {
                success: false,
                message: "Daily presence already processed for today.",
                milligrams: currentTotal,
                awarded: 0
            };
            return;
        }
        const dayDelta = signalDay - lastDailyReturnDay;
        const awarded = round2(2.84 * dayDelta);
        const nextTotal = round2(currentTotal + awarded);
        tx.update(observerRef, {
            milligrams: nextTotal,
            lastDailyReturnDay: signalDay,
            lastDailyReturnClaimedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        response = {
            success: true,
            message: `Daily return processed. +${awarded} mg Residue Mass recorded.`,
            milligrams: nextTotal,
            awarded
        };
    });
    if (!response)
        throw new https_1.HttpsError("internal", "Daily return did not resolve.");
    return response;
});
exports.discoverRoom = (0, https_1.onCall)({}, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    await enforceRateLimit(`discoverRoom:${request.auth.uid}`, 60, 60 * 1000);
    const visitorId = getValidatedVisitorId((_a = request.data) === null || _a === void 0 ? void 0 : _a.visitorId);
    const room = (_b = request.data) === null || _b === void 0 ? void 0 : _b.room;
    if (room !== 'lab' && room !== 'break-room' && room !== 'signal-cartography') {
        throw new https_1.HttpsError("invalid-argument", "Invalid room identifier.");
    }
    const db = admin.firestore();
    const observerRef = await assertObserverAccess(request.auth.uid, visitorId);
    let response = null;
    await db.runTransaction(async (tx) => {
        const observerSnap = await tx.get(observerRef);
        if (!observerSnap.exists) {
            throw new https_1.HttpsError("not-found", "Observer record unavailable.");
        }
        const observer = observerSnap.data() || {};
        const recoveredIds = observer.recoveredItems || [];
        const currentTotal = round2(getNumberValue(observer.milligrams, 0));
        const discoveryId = `room:discovered:${room}`;
        if (recoveredIds.includes(discoveryId)) {
            response = {
                success: false,
                message: "Room already discovered.",
                milligrams: currentTotal,
                awarded: 0
            };
            return;
        }
        const awarded = 4.26;
        const nextTotal = round2(currentTotal + awarded);
        const nextRecoveredItems = [...recoveredIds, discoveryId];
        tx.update(observerRef, {
            milligrams: nextTotal,
            recoveredItems: nextRecoveredItems
        });
        response = {
            success: true,
            message: `New sector entry confirmed. +${awarded} mg Residue Mass surge.`,
            milligrams: nextTotal,
            awarded
        };
    });
    if (!response)
        throw new https_1.HttpsError("internal", "Room discovery did not resolve.");
    return response;
});
//# sourceMappingURL=index.js.map