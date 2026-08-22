'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js (see public/sw.js) — production only. `next dev`'s HMR
 * relies on unintercepted fetches/websockets; a service worker running
 * alongside it causes exactly the stale-bundle and reload issues it's
 * built to prevent for real users, so it's skipped there entirely.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort — a failed registration just means no offline shell /
      // asset caching, not a broken app. Nothing here blocks normal use.
    })
  }, [])

  return null
}
