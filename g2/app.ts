import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { setBridge } from './state'
import { initDisplay, sendImageToGlass } from './renderer'
import { onEvenHubEvent, setEventHandlers } from './events'
import { selectPrev, selectNext } from '../src/image-editor'

let sending = false

function updateUI(): void {
  const render = (window as unknown as Record<string, (() => void) | undefined>).__visionoteRenderSavedList
  render?.()
}

async function sendSavedImage(img: { id: number; topPngBytes: number[]; bottomPngBytes: number[] }, direction: string): Promise<void> {
  if (sending) {
    appendEventLog(`Visionote: skip ${direction} (busy)`)
    return
  }
  sending = true
  try {
    appendEventLog(`Visionote: ${direction} → image ${img.id}`)
    await sendImageToGlass(img.topPngBytes, img.bottomPngBytes)
    appendEventLog(`Visionote: ${direction} → sent OK`)
  } catch (err) {
    appendEventLog(`Visionote: ${direction} → FAILED: ${err}`)
  } finally {
    sending = false
  }
  updateUI()
}

function handleScrollUp(): void {
  const img = selectPrev()
  if (img) {
    void sendSavedImage(img, 'scroll up')
  }
}

function handleScrollDown(): void {
  const img = selectNext()
  if (img) {
    void sendSavedImage(img, 'scroll down')
  }
}

export async function initApp(b: EvenAppBridge): Promise<void> {
  setBridge(b)

  setEventHandlers({
    onScrollUp: handleScrollUp,
    onScrollDown: handleScrollDown,
    onClick: () => {},
  })

  b.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()
  appendEventLog('Visionote: app initialized')
}

export { sendImageToGlass }
