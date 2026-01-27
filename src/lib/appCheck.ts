import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase';

export const initAppCheck = () => {
    if (import.meta.env.DEV) {
        // Enable debug token for local development
        // @ts-expect-error - Firebase debug token global
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6LcYX1QsAAAAAMBsK5hQxBGTSv1-YGzr-lsZFk0b'),
        isTokenAutoRefreshEnabled: true
    });

    return appCheck;
};
