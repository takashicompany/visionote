import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
