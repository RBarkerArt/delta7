# Delta 7: Coherence Protocol

> **Status:** EXPERIMENTAL / ACTIVE DEV
> **Protocol:** Volume 3 Implemented

A secure, React-based terminal interface for the Delta-7 coherence project. Built with Firebase (Auth, Firestore, Storage, Functions) and enforced by strict "Bible" protocols.

## ⚡ Quick Start (< 15 Minutes)

### Prerequisites
*   Node.js 18+
*   Java/JDK (for Firebase Emulators)
*   Firebase CLI (`npm install -g firebase-tools`)

### 1. Installation
```bash
git clone https://github.com/RBarkerArt/delta7.git
cd delta7
npm install
cd functions && npm install && cd ..
```

### 2. Environment Setup
Create a `.env.local` file in the root directory. You need to obtain these keys from the Firebase Console -> Project Settings -> General.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=delta7-3fede.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=delta7-3fede
VITE_FIREBASE_STORAGE_BUCKET=delta7-3fede.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_id
VITE_RECAPTCHA_SITE_KEY=6LcYX1QsAAAAAMBsK5hQxBGTSv1-YGzr-lsZFk0b
```

### 3. Run Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

### 4. Run Emulators (Optional but Recommended)
To test Cloud Functions and Firestore triggers locally:
```bash
npm run emulators
```

## 🏗 Architecture (Volume 3)

See [docs/ADR-001-Architecture.md](docs/ADR-001-Architecture.md) for detailed decisions.

*   **Frontend**: React 18, Vite, TailwindCSS (Token-Only).
*   **Backend**: Firebase (Serverless).
*   **Security**:
    *   **Zero Trust**: All inputs validated via Firestore Rules.
    *   **CSP**: Strict Content Security Policy in `firebase.json`.
    *   **App Check**: ReCAPTCHA v3 verified.
*   **Performance**:
    *   **Code Splitting**: Admin routes are lazy-loaded.
    *   **Image Pipeline**: Automatic resizing via Cloud Functions.

## 🚀 Deployment

deployments are handled via the Firebase CLI.

```bash
# Build the application
npm run build

# Deploy Hosting, Rules, and Functions
firebase deploy
```

## 📜 Protocols (The Bible)

This project strictly follows the protocols defined in `.agent/rules/bible.md` and `.agent/rules/bible2.md`.
*   **Volume 1**: Engineering & Security (The Fortress)
*   **Volume 2**: Frontend & Experience (The Product)
*   **Volume 3**: Operations & Governance (The Agency)
