import { useEffect } from 'react'

/** Animate navigation, not form edits; keep the live editor and audio mounted. */
export function usePageMotion(page: string) {
  useEffect(() => {
    const content = document.getElementById('main-content')
    if (!content || typeof content.animate !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const animation = content.animate([
      { opacity: 0.75, transform: 'translateY(5px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' })
    // Cancellation is expected on quick navigation, unmount and preference changes.
    void animation.finished.catch(() => {})
    const stop = () => { if (preference.matches) animation.cancel() }
    preference.addEventListener('change', stop)
    return () => { animation.cancel(); preference.removeEventListener('change', stop) }
  }, [page])
}
