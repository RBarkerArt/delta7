import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './firebase';

let hasInitializedAppCheck = false;

export const initAppCheck = () => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
    const isExplicitlyEnabled = import.meta.env.VITE_ENABLE_APP_CHECK === 'true';

    if (hasInitializedAppCheck || !isExplicitlyEnabled || !siteKey) {
        if (import.meta.env.DEV && !isExplicitlyEnabled) {
            console.info('[Delta-7] App Check disabled. Set VITE_ENABLE_APP_CHECK=true after Firebase App Check is configured.');
        }
        return null;
    }

    if (import.meta.env.DEV) {
        // Enable debug token for local development
        // @ts-expect-error - Firebase debug token global
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    try {
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
        });

        hasInitializedAppCheck = true;
        return appCheck;
    } catch (error) {
        if (import.meta.env.DEV) console.warn('[Delta-7] App Check failed to initialize:', error);
        return null;
    }
};
