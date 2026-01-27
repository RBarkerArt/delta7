const uuidv4 = () => crypto.randomUUID();

export interface ObserverSession {
    visitorId: string;
    visitorToken: string;
}

const STORAGE_KEY = 'delta7_observer_session';

export const getObserverSession = (): ObserverSession => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed.visitorId === 'string') {
                return parsed;
            }
        } catch (e) {
            if (import.meta.env.DEV) console.error('Failed to parse observer session', e);
        }
    }

    const session: ObserverSession = {
        visitorId: uuidv4(),
        visitorToken: uuidv4()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
};

export const setObserverSession = (visitorId: string) => {
    const session = getObserverSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, visitorId }));
};
