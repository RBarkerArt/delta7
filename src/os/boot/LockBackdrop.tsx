import Wallpaper from '../wallpapers/Wallpaper'

/**
 * The wallpaper, softly out of focus, BEHIND the home while locked / unlocking. The home eases in over it, so the
 * picture seems to come into focus; nothing ever dips to a bare background.
 */
export default function LockBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -inset-10" style={{ filter: 'blur(14px) saturate(1.05)' }}>
        <Wallpaper still />
      </div>
    </div>
  )
}
