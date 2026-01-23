import type { ObserverSession } from '../types/schema';

const SESSION_KEY = 'delta7_observer_session';

export const getObserverSession = (): ObserverSession | null => {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('[Delta-7] Storage: Failed to parse observer session', e);
        return null;
    }
};

export const setObserverSession = (session: ObserverSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearObserverSession = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const initializeVisitorIdentity = (): ObserverSession => {
    const existing = getObserverSession();
    if (existing) return existing;

    const session: ObserverSession = {
        visitorId: crypto.randomUUID(),
        visitorToken: Math.random().toString(36).slice(2) + Date.now().toString(36),
        isAnchored: false
    };

    setObserverSession(session);
    console.log('[Delta-7] Storage: Initialized new visitor identity', session.visitorId);
    return session;
};

export const updateObserverSession = (updates: Partial<ObserverSession>) => {
    const existing = getObserverSession();
    if (!existing) return;

    const updated = { ...existing, ...updates };
    setObserverSession(updated);
};
