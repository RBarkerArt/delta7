// STUB — the notification builder replaces this file. In-OS only; never the browser Notification API.
import { dismissNotification, useNotification } from '../store/signal'
import { openApp } from '../store/windows'

export default function NotificationBanner() {
  const n = useNotification()
  if (!n) return null
  return (
    <button
      type="button"
      data-testid="notification-banner"
      onClick={() => {
        openApp('delta7', { view: 'tuner' })
        dismissNotification()
      }}
      className="os-panel absolute right-4 top-16 z-[900] rounded-[12px] px-4 py-2.5 font-os-sans text-[13px] text-os-ink outline-none focus-visible:ring-2 focus-visible:ring-os-ink/30"
    >
      {n.text}
    </button>
  )
}
