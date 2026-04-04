import { appendEventLog } from '../_shared/log'

// ---------------------------------------------------------------------------
// Wake Lock API
// ---------------------------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null

async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => { wakeLock = null })
    appendEventLog('keep-alive: wake lock acquired')
  } catch {
    // Fails if not in foreground — expected
  }
}

// ---------------------------------------------------------------------------
// Web Worker heartbeat
// ---------------------------------------------------------------------------

let worker: Worker | null = null

function startHeartbeat(onTick: () => void): void {
  try {
    worker = new Worker(new URL('./heartbeat-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = () => { onTick() }
    worker.postMessage('start')
    appendEventLog('keep-alive: heartbeat worker started')
  } catch {
    appendEventLog('keep-alive: worker not supported')
  }
}

// ---------------------------------------------------------------------------
// visibilitychange
// ---------------------------------------------------------------------------

function setupVisibilityHandler(onRestore: () => void, onTick: () => void): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      appendEventLog('keep-alive: foreground restored')
      void requestWakeLock()
      onRestore()
    }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initKeepAlive(onRestore: () => void, onTick: () => void): void {
  void requestWakeLock()
  startHeartbeat(onTick)
  setupVisibilityHandler(onRestore, onTick)
  appendEventLog('keep-alive: initialized')
}
