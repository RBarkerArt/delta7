import { app } from './firebase';
import type { Analytics } from 'firebase/analytics';

type AnalyticsParams = Record<string, unknown>;

let analyticsPromise: Promise<Analytics | null> | null = null;

export const initAnalytics = (): Promise<Analytics | null> => {
  if (analyticsPromise) return analyticsPromise;

  if (typeof window === 'undefined' || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.warn('[Delta-7] Analytics disabled: missing VITE_FIREBASE_MEASUREMENT_ID.');
    }

    analyticsPromise = Promise.resolve(null);
    return analyticsPromise;
  }

  analyticsPromise = import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (!(await isSupported())) {
        if (import.meta.env.DEV) {
          console.warn('[Delta-7] Analytics disabled: unsupported browser context.');
        }

        return null;
      }

      return getAnalytics(app);
    })
    .catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[Delta-7] Analytics initialization failed:', error);
      }

      return null;
    });

  return analyticsPromise;
};

export const trackAnalyticsEvent = async (
  eventName: string,
  eventParams?: AnalyticsParams
): Promise<void> => {
  const analytics = await initAnalytics();
  if (!analytics) return;

  const { logEvent } = await import('firebase/analytics');
  logEvent(analytics, eventName, eventParams);
};
