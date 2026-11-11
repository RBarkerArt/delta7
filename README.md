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

## OS shell (branch os-ui-v1)

A new front end: a calm, original personal "OS" in the browser. It is the root of the site (`/`). The old app moved to
`/legacy`; `/admin`, `/rooms/*`, `/privacy` and `/terms` are unchanged.

**How the split works.** `src/main.tsx` looks at the path *before* importing anything heavy. Paths starting with
`/legacy`, `/admin`, `/rooms`, `/privacy` or `/terms` lazily load `src/legacyEntry.tsx` (legacy CSS, `App.tsx`, App Check,
analytics). Everything else loads `src/os/entry.tsx`. `App.tsx`'s `<BrowserRouter>` gets `basename="/legacy"` only when the
path starts with `/legacy`, so the old routes keep working there and at their old URLs.

**Run it.**

```bash
npm install --legacy-peer-deps
npm run dev            # OS shell at http://localhost:5173/ — no .env needed
```

The OS needs no `.env`. The legacy app (`/legacy`, `/admin`, …) still needs `.env.local` with the `VITE_FIREBASE_*` values.

**URL switches** (combine freely):

| switch | effect |
| --- | --- |
| `?skipboot=1` | straight to the home: no boot animation, no lock screen |
| `?lock=1` | force the password path on the lock screen even if the session was "only asleep" |
| `?dev=1` | open the dev panel (also in production); in `npm run dev` the backtick key toggles it |
| `?time=HH:MM` | clock override (24h) |
| `?wallpaper=haze\|dusk\|ember\|fog` | wallpaper for this visit only (not saved) |
| `?mobile=1` | force the phone layout on a desktop browser |

**Where things live** (`src/os/`):

- `OSApp.tsx`, `entry.tsx` — root component and its mount point
- `boot/` — boot animation, lock screen, "only asleep" session flag
- `shell/` — top bar, four-dot menu, search, home pager, app icons, page dots, notification banner
- `windows/` — desktop window manager (drag, resize, maximize, minimize) and full-screen phone sheets with close gestures
- `apps/` — app registry and the placeholder apps
- `delta7/` — the Delta7 dashboard and its coherence-driven decay
- `tuner/` — the tuner (dial, waveform, lock at 1.42, optional Web Audio)
- `store/` — tiny `useSyncExternalStore` stores (settings, windows, layout, coherence, tuner, clock, …)
- `wallpapers/` — CSS/SVG-generated wallpapers
- `lib/` — shared helpers (motion presets, seeded RNG, safe `localStorage` with `d7os:` keys)
- `mock/` — mocked engine values and placeholder content
- `dev/` — the dev panel

**What's mocked.** Everything story- or account-related is a placeholder. Search the tree for these tags:
`TODO(engine)` (day clock, coherence, absence decay, "only asleep" window — see `src/os/mock/`), `TODO(auth)` (the lock
screen's password and the menu's sign in / sign out; nothing is checked or sent anywhere), `TODO(copy)` (all text and file
names inside apps) and `TODO(story)` (hooks such as search and bleeds for later).

**Rule:** `src/os/` never imports Firebase-touching modules (`src/lib/`, `src/context/`, `src/components/`, `src/hooks/`,
`src/pages/`). The OS bundle stays free of Firebase and runs with no configuration.
