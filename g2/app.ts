import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { setBridge, bridge } from './state'
import { initDisplay, sendImageToGlass } from './renderer'
import { onEvenHubEvent, setEventHandlers } from './events'
import { selectPrev, selectNext } from '../src/image-editor'

let sending = false

const win = window as unknown as Record<string, ((() => void) | undefined)>

function updateUI(): void { win.__visionoteRenderSavedList?.() }
function lockUI(): void { win.__visionoteLockUI?.() }
function unlockUI(): void { win.__visionoteUnlockUI?.() }

async function sendSavedImage(img: { id: number; quadrants: number[][] }, direction: string): Promise<void> {
  if (sending) {
    appendEventLog(`Visionote: skip ${direction} (busy)`)
    return
  }
  sending = true
  lockUI()
  try {
    appendEventLog(`Visionote: ${direction} → image ${img.id}`)
    await sendImageToGlass(img.quadrants)
    appendEventLog(`Visionote: ${direction} → sent OK`)
  } catch (err) {
    appendEventLog(`Visionote: ${direction} → FAILED: ${err}`)
  } finally {
    sending = false
    unlockUI()
  }
  updateUI()
}

async function handleScrollUp(): Promise<void> {
  const img = await selectPrev()
  if (img) {
    await sendSavedImage(img, 'scroll up')
  }
}

async function handleScrollDown(): Promise<void> {
  const img = await selectNext()
  if (img) {
    await sendSavedImage(img, 'scroll down')
  }
}

export async function initApp(b: EvenAppBridge): Promise<void> {
  setBridge(b)

  setEventHandlers({
    onScrollUp: handleScrollDown,
    onScrollDown: handleScrollUp,
    onClick: () => {},
    onDoubleClick: () => {
      if (bridge) {
        void bridge.shutDownPageContainer(1)
        appendEventLog('Visionote: exit requested')
      }
    },
  })

  b.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()
  appendEventLog('Visionote: app initialized')
}

export { sendImageToGlass }
