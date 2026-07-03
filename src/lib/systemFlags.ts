// Remote-config flags mirrored out of the system/settings snapshot listener so
// non-component call sites (e.g. App.tsx transition logic) can read them without
// re-plumbing a second Firestore subscription. AtmosphereManager's existing
// listener writes here; everyone else reads synchronously.

const systemFlags: { mobileSpaRooms: boolean } = { mobileSpaRooms: false };

/** Read a remote system flag mirrored from the system/settings snapshot. */
export const getSystemFlag = (flag: keyof typeof systemFlags): boolean => systemFlags[flag];

/** Write a mirrored flag value; called from the system/settings snapshot listener. */
export const setSystemFlag = (flag: keyof typeof systemFlags, value: boolean): void => {
    systemFlags[flag] = value;
};
