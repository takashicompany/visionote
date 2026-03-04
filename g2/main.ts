import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp } from './app'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Even bridge not detected within ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

export function createVisionoteActions(setStatus: SetStatus): AppActions {
  let connected = false

  return {
    async connect() {
      setStatus('Visionote: connecting to Even bridge...')
      appendEventLog('Visionote: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('Visionote: connected')
        appendEventLog('Visionote: connected to bridge')
      } catch (err) {
        console.error('[Visionote] connect failed', err)
        setStatus('Visionote: bridge not found.')
        appendEventLog('Visionote: connection failed')
      }
    },

    async action() {
      if (!connected) {
        setStatus('Visionote: not connected')
        return
      }
    },
  }
}
