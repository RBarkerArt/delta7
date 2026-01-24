# ADR-001: Core Architecture & Stack Selection

**Status**: Accepted
**Date**: 2026-01-23
**Context**: Delta-7 requires a secure, real-time, and highly responsive interface for managing coherence data.

## Decision
We have selected the **Firebase** ecosystem coupled with **React (Vite)** and **TailwindCSS**.

### 1. Backend: Firebase (Serverless)
*   **Why**: Provides out-of-the-box real-time databases (Firestore), Authentication, and Edge-computed Logic (Cloud Functions).
*   **Governance**: All access is controlled via `firestore.rules` using strictly typed "Zero Trust" validation functions (Protocol 1.1).

### 2. Frontend: React + Vite
*   **Why**: Component-based architecture allows for complex "Terminal" UI states (`LabInterface` vs `AdminDashboard`). Vite ensures fast HMR and optimized builds.
*   **State**: Global state managed via `CoherenceContext` and `AuthContext`.

### 3. Styling: TailwindCSS
*   **Why**: Utility-first CSS allows for rapid UI iteration.
*   **Constraint**: We adhere to **Protocol 6.1 (Token-Only)**. No arbitrary values (e.g., `w-[32px]`) are allowed. Only standard Tailwind tokens or defined theme extensions.

### 4. Security: The Fortress
*   **App Check**: Enforced on all client requests to prevent bot abuse.
*   **CSP**: Strict Content-Security-Policy to mitigate XSS.
*   **Data Isolation**: `users` and `observers` collections are separated to allow distinct permission models.

## Consequences
*   **Positive**: Rapid development, unified security model, low operational overhead.
*   **Negative**: Vendor lock-in to Google Cloud/Firebase.
