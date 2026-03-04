import type { EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'

export function onEvenHubEvent(event: EvenHubEvent): void {
  appendEventLog(`Event: ${JSON.stringify(event)}`)
}
