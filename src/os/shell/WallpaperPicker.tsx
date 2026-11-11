import WallpaperArt from '../wallpapers/WallpaperArt'
import { WALLPAPER_NAMES, setWallpaper, useSettings } from '../store/settings'

/** Four small swatches rendering the real wallpapers; the selected one is ringed. */
export default function WallpaperPicker() {
  const current = useSettings((s) => s.wallpaper)
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="wallpaper">
      {WALLPAPER_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={current === name}
          aria-label={name}
          title={name}
          data-testid={`wallpaper-${name}`}
          onClick={() => setWallpaper(name)}
          className={`relative h-9 w-12 overflow-hidden rounded-[7px] outline-none ring-offset-2 ring-offset-os-cream focus-visible:ring-2 focus-visible:ring-os-ink/40 ${
            current === name ? 'ring-[1.5px] ring-os-ink/55' : 'ring-1 ring-os-ink/10'
          }`}
        >
          <WallpaperArt name={name} grain={false} />
        </button>
      ))}
    </div>
  )
}
