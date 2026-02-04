import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import sharp from "sharp";

// Initialize Firebase Admin
admin.initializeApp();

// -------------------------------------------------------------
// EMAIL PROTOCOL: Nodemailer Configuration
// -------------------------------------------------------------
const EMAIL_PASSWORD = defineSecret("EMAIL_PASSWORD");

const createTransporter = (password: string) => {
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

// 1. Admin Notification: New Visitor Observed
export const onNewVisitor = functions.runWith({
    secrets: ["EMAIL_PASSWORD"]
}).auth.user().onCreate(async (user) => {
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
    } catch (error) {
        functions.logger.error("Failed to send admin notification:", error);
    }
});

// 2. User Notification: Anchor Welcome (Styled)
export const sendAnchorWelcome = onCall({
    secrets: [EMAIL_PASSWORD],
    enforceAppCheck: true
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

    const email = request.auth.token.email;
    if (!email) {
        functions.logger.warn("No email found for user during anchoring welcome:", request.auth.uid);
        return { success: false, reason: "no_email" };
    }

    const password = EMAIL_PASSWORD.value();
    const transporter = createTransporter(password);

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
            <div class="header">TRANS_STATUS: ENCRYPTED // OBS_LOG_000</div>
            <div class="body">
                ObsLog: 
                Observer recorded. The coherence began to stabilize. Your presence makes an impact. Purpose is the variable i cannot track. It can only be measured from the presence of you.
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
        text: `ObsLog: Observer recorded. The coherence began to stabilize. Your presence makes an impact. Purpose is the variable i cannot track. It can only be measured from the presence of you.\n\nDr. Kael\nEnd Transmission`,
        html: htmlContent
    };

    try {
        await transporter.sendMail(mailOptions);
        functions.logger.log("Welcome email sent to:", email);
        return { success: true };
    } catch (error) {
        functions.logger.error("Failed to send welcome email:", error);
        throw new HttpsError("internal", "Failed to send encrypted signal.");
    }
});

// 7.1 Asset Pipeline: Image Resizing
// Note: 'sharp' dependency is required for this to work in production.
// Verified it is in package.json.

export const generateResizedImage = functions.storage.object().onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    // Exit if this is triggered on a file that is not an image.
    if (!contentType || !contentType.startsWith("image/")) {
        return functions.logger.log("This is not an image.");
    }

    // Get the file name.
    if (!filePath) return;
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

    await sharp(tmpFilePath)
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
export const deleteUserData = functions.https.onCall(async (data, context) => {
    // Protocol 14.2: Rate Discipline/Validation
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Authentication required to delete account.'
        );
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

    } catch (error) {
        console.error("Erasure failed:", error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to erase user data.'
        );
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
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += '-';
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code; // Format: XXX-XXX
};

// 1. Assign Frequency (v2)
// FIXED: Accept visitorId from frontend to write to correct document
export const assignFrequency = onCall({
    cors: true,
    enforceAppCheck: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');

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
            if (!check.exists) unique = true;
            else code = generateCode();
            attempts++;
        }

        if (!unique) throw new HttpsError('resource-exhausted', 'Failed to generate unique frequency');

        // Store both uid and visitorId for comprehensive reverse lookup
        await db.collection('access_codes').doc(code).set({
            uid: uid,
            visitorId: observerDocId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // FIXED: Write to observers/{visitorId} - this is where frontend reads from
        await db.collection('observers').doc(observerDocId).set(
            { accessCode: code },
            { merge: true }
        );

        console.log(`[assignFrequency] Assigned code ${code} to visitorId: ${observerDocId}, uid: ${uid}`);
        return { code };

    } catch (err) {
        console.error('Assign Frequency Failed:', err);
        throw new HttpsError('internal', 'Frequency assignment failed');
    }
});

// 2. Recover Signal (v2)
// FIXED: Return visitorId along with token for proper session restoration
export const recoverSignal = onCall({
    cors: true,
    enforceAppCheck: true,
    serviceAccount: 'delta7-3fede@appspot.gserviceaccount.com'
}, async (request) => {
    const code = request.data.code;
    if (!code || typeof code !== 'string') {
        throw new HttpsError('invalid-argument', 'Signal frequency required');
    }

    // Format input (uppercase, handle potential missing dash if user lazy?)
    // Sticking to strict format for now: XXX-XXX
    const formattedCode = code.toUpperCase().trim();

    try {
        const doc = await admin.firestore().collection('access_codes').doc(formattedCode).get();

        if (!doc.exists) {
            throw new HttpsError('not-found', 'Signal frequency invalid or expired.');
        }

        const data = doc.data() as { uid: string; visitorId?: string };
        const { uid, visitorId } = data;

        // Mint Custom Token
        const token = await admin.auth().createCustomToken(uid);

        console.log(`Signal recovered for UID: ${uid}, visitorId: ${visitorId} via code ${formattedCode}`);

        // Return visitorId so frontend can properly restore the session
        return { token, visitorId };

    } catch (err) {
        console.error('Signal Recovery Failed:', err);
        throw new HttpsError('internal', 'Signal recovery failed');
    }
});

// Interface for the expected AI response structure


export const generateNarrativeContent = onCall({
    secrets: ["GEMINI_API_KEY"],
    enforceAppCheck: true
}, async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { prompt, context, dayNumber } = request.data;
    const apiKey = process.env.GEMINI_API_KEY;
    const db = admin.firestore();

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
STORY OVERVIEW: ${bible?.overview || 'Not defined'}
THEMES: ${(bible?.themes || []).join(', ')}
CHARACTERS: ${(bible?.characters || []).map((c: any) => `${c.name} (${c.role}): ${c.arc}`).join('; ')}
AI INSTRUCTIONS: ${bible?.aiInstructions || ''}
            `.trim();

            // Find current plot beat
            const plotBeats = bible?.plotBeats || [];
            const currentBeat = plotBeats.find((beat: any) =>
                dayNumber >= beat.dayStart && dayNumber <= beat.dayEnd
            );
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
${prevDays.map(d => `Day ${d.day}: ${d.narrativeSummary}${d.variables?.kaelMood ? ` [Kael: ${d.variables.kaelMood}]` : ''}`).join('\n')}
                `.trim();
            }
        }
    } catch (contextError) {
        console.warn("Failed to fetch auto-context:", contextError);
        // Continue without auto-context
    }

    // 3. Fetch AI Rules from settings
    let aiRules = "";
    try {
        const settingsDoc = await db.collection('system').doc('settings').get();
        if (settingsDoc.exists) {
            aiRules = settingsDoc.data()?.aiRules || "";
        }
    } catch (err) {
        console.warn("Failed to fetch AI rules:", err);
    }

    console.log(`Generating content for Day ${dayNumber || 'unknown'}`);

    // 4. Connector Logic (Real Implementation)
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
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
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new HttpsError("internal", "Failed to generate content via AI engine.");
    }
});

// -------------------------------------------------------------
// ONE-TIME MIGRATION: Copy prologues to day logs
// -------------------------------------------------------------
export const migrateProloguesToDays = onCall({
    enforceAppCheck: true
}, async (request) => {
    // Verify admin
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in.");
    }
    const userDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
        throw new HttpsError("permission-denied", "Admin access required.");
    }

    const db = admin.firestore();
    const prologuesSnapshot = await db.collection("season1_prologues").get();

    const results: { day: number; status: string }[] = [];

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
        } else {
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
export const pruneStaleUsers = onCall({
    enforceAppCheck: true
}, async (request) => {
    // 1. Verify Admin Access
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    // Check role in users collection
    const userDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
        throw new HttpsError("permission-denied", "Admin access required.");
    }

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
        const errors: string[] = [];

        // 4. Process Results
        const batch = db.batch();
        const deletionPromises: Promise<any>[] = [];

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
                deletionPromises.push(
                    auth.deleteUser(doc.id).catch(err => {
                        // Ignore 'user-not-found', log others
                        if (err.code !== 'auth/user-not-found') {
                            console.warn(`[Prune] Failed to delete auth for ${doc.id}:`, err);
                            errors.push(doc.id);
                        }
                    })
                );
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

    } catch (err) {
        console.error("Prune failed:", err);
        throw new HttpsError("internal", "Prune process failed.");
    }
});
