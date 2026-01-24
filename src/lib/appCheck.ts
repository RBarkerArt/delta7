
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './firebase';

// If 'app' is not exported from AuthContext, we need to find where firebase is initialized.
// checking for firebase.ts or similar.

export const initAppCheck = () => {
    if (import.meta.env.DEV) {
        // In local development, we might want to use a debug token
        // self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        console.log('App Check initialized in DEV mode');
    }

    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LcYX1QsAAAAAMBsK5hQxBGTSv1-YGzr-lsZFk0b'),
        isTokenAutoRefreshEnabled: true
    });

    return appCheck;
};
