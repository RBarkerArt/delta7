/**
 * Calls `onChange` whenever `el` comes on or goes off screen: the tab is hidden, or the element is scrolled or moved
 * out of the viewport. Starts out assuming it is shown. Returns the cleanup.
 */
export function watchOnScreen(el: Element, onChange: (shown: boolean) => void): () => void {
  let intersecting = true
  const emit = () => onChange(intersecting && document.visibilityState === 'visible')
  const io = new IntersectionObserver((entries) => {
    intersecting = entries.some((e) => e.isIntersecting)
    emit()
  })
  io.observe(el)
  document.addEventListener('visibilitychange', emit)
  return () => {
    io.disconnect()
    document.removeEventListener('visibilitychange', emit)
  }
}
