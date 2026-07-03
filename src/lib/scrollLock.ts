// Re-entrant iOS-safe body scroll lock. `overflow: hidden` alone does not stop
// body scrolling on iOS Safari; pinning the body with position: fixed does.
// A counter lets overlapping overlays (modal + terminal) share the lock: the
// first lock captures scroll position, the last unlock restores it.

let lockCount = 0;
let savedScrollY = 0;

export function lockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    lockCount += 1;
    if (lockCount > 1) return;

    savedScrollY = window.scrollY;
    const style = document.body.style;
    style.position = 'fixed';
    style.top = `-${savedScrollY}px`;
    style.left = '0';
    style.right = '0';
    style.width = '100%';
}

export function unlockBodyScroll(): void {
    if (typeof document === 'undefined' || lockCount === 0) return;
    lockCount -= 1;
    if (lockCount > 0) return;

    const style = document.body.style;
    style.position = '';
    style.top = '';
    style.left = '';
    style.right = '';
    style.width = '';
    window.scrollTo(0, savedScrollY);
}
