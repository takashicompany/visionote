import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { setBridge } from './state'
import { initDisplay, sendImageToGlass } from './renderer'
import { onEvenHubEvent } from './events'

export async function initApp(b: EvenAppBridge): Promise<void> {
  setBridge(b)

  b.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()
  appendEventLog('Visionote: app initialized')
}

export { sendImageToGlass }
