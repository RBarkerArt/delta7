// Entry switch. Picks the OS shell or the live game by path BEFORE importing anything heavy, so the OS bundle never
// pulls in Firebase or the legacy CSS. The OS lives at /os (and /os/…); every other path is the live game, unchanged.
// Keep the path test in step with the background script in index.html.
function isOSPath(pathname: string): boolean {
  return pathname === '/os' || pathname.startsWith('/os/')
}

if (isOSPath(window.location.pathname)) {
  void import('./os/entry')
} else {
  void import('./legacyEntry')
}
