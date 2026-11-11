// Entry switch. Picks the legacy tree or the OS shell by path BEFORE importing
// anything heavy, so the OS bundle never pulls in Firebase or the legacy CSS.
const LEGACY_PREFIXES = ['/legacy', '/admin', '/rooms', '/privacy', '/terms']

function isLegacyPath(pathname: string): boolean {
  return LEGACY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

if (isLegacyPath(window.location.pathname)) {
  void import('./legacyEntry')
} else {
  void import('./os/entry')
}
