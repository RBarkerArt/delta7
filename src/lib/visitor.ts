export interface ObserverSession {
    visitorId: string;
    visitorToken: string;
}

const STORAGE_KEY = 'delta7_observer_session';
let memorySession: ObserverSession | null = null;

const uuidv4 = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            '$1-$2-$3-$4-$5'
        );
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 15)}`;
};

const readStoredSession = () => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        if (import.meta.env.DEV) console.warn('Observer session storage unavailable', e);
        return null;
    }
};

const writeStoredSession = (session: ObserverSession) => {
    memorySession = session;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        if (import.meta.env.DEV) console.warn('Observer session storage unavailable', e);
    }
};

export const getObserverSession = (): ObserverSession => {
    const stored = readStoredSession();
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed.visitorId === 'string') {
                const session = {
                    visitorId: parsed.visitorId,
                    visitorToken: typeof parsed.visitorToken === 'string' ? parsed.visitorToken : uuidv4()
                };
                memorySession = session;
                return session;
            }
        } catch (e) {
            if (import.meta.env.DEV) console.error('Failed to parse observer session', e);
        }
    }

    if (memorySession) return memorySession;

    const session: ObserverSession = {
        visitorId: uuidv4(),
        visitorToken: uuidv4()
    };
    writeStoredSession(session);
    return session;
};

export const setObserverSession = (visitorId: string) => {
    const session = getObserverSession();
    writeStoredSession({ ...session, visitorId });
};
