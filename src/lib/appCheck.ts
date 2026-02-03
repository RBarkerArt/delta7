import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase';

export const initAppCheck = () => {
    if (import.meta.env.DEV) {
        // Enable debug token for local development
        // @ts-expect-error - Firebase debug token global
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
    });

    return appCheck;
};
