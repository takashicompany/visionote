import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { setBridge, bridge } from './state'
import {
  initDisplay, sendImageToGlass, updateCursor, updateImageArrows,
  switchToImageLayout, switchToThumbnailLayout, switchToTextLayout,
  switchToMixedThumbnailLayout, displayText, updateSingleImage,
} from './renderer'
import { onEvenHubEvent, setEventHandlers } from './events'
import {
  getSavedItems, selectSavedItem,
  getActiveIndex,
  generateThumbnailPng, generateBlackPng,
} from '../src/image-editor'
import type { SavedItem } from '../src/image-editor'
import { CONTAINER_W, CONTAINER_H } from './layout'
import { initKeepAlive } from './keep-alive'

type AppMode = 'thumbnails' | 'image' | 'text'
let mode: AppMode = 'thumbnails'
let cursorIndex = 0
let pageStart = 0
let lastPageStart = -1
let sending = false
let textScrollLine = 0

const win = window as unknown as Record<string, ((() => void) | undefined)>
function updateUI(): void { win.__visionoteRenderSavedList?.() }

// ---------------------------------------------------------------------------
// Thumbnail helpers
// ---------------------------------------------------------------------------

async function generateSlotImage(item: SavedItem | undefined): Promise<number[]> {
  if (item && item.type === 'image') {
    return generateThumbnailPng(
      item.previewDataUrl,
      CONTAINER_W, CONTAINER_H,
      false,
      0, 0,
    )
  }
  return generateBlackPng(CONTAINER_W, CONTAINER_H)
}

// ---------------------------------------------------------------------------
// Thumbnail mode (mixed image/text)
// ---------------------------------------------------------------------------

async function showThumbnails(): Promise<void> {
  if (sending) return
  sending = true

  const items = getSavedItems()

  if (items.length === 0) {
    const black = await generateBlackPng(CONTAINER_W, CONTAINER_H)
    await sendImageToGlass([black, black, black, black])
    sending = false
    return
  }

  // Keep cursor in bounds
  if (cursorIndex >= items.length) cursorIndex = items.length - 1
  if (cursorIndex < 0) cursorIndex = 0

  // Fixed 4-item pages
  pageStart = Math.floor(cursorIndex / 4) * 4

  const pageChanged = pageStart !== lastPageStart

  if (pageChanged) {
    // Determine which slots are text vs image
    const textSlots = new Map<number, string>()
    const imageSlots: number[] = []

    for (let i = 0; i < 4; i++) {
      const item = items[pageStart + i]
      if (item && item.type === 'text') {
        textSlots.set(i, item.content)
      } else {
        imageSlots.push(i)
      }
    }

    if (textSlots.size > 0) {
      await switchToMixedThumbnailLayout(textSlots)
    } else {
      await switchToThumbnailLayout()
    }

    // Send image data only for image slots
    try {
      for (const slot of imageSlots) {
        const imgData = await generateSlotImage(items[pageStart + slot])
        await updateSingleImage(slot, imgData)
      }
      lastPageStart = pageStart
      appendEventLog(`Visionote: thumbnails sent (page=${pageStart}, cursor=${cursorIndex})`)
    } catch (err) {
      appendEventLog(`Visionote: thumbnail failed: ${err}`)
    }
  }

  // Update cursor (lightweight textContainerUpgrade, no rebuild)
  const activeSlot = cursorIndex - pageStart
  const currentPage = Math.floor(pageStart / 4) + 1
  const maxPages = Math.ceil(items.length / 4)
  await updateCursor(activeSlot, currentPage, maxPages)
  appendEventLog(`Visionote: cursor → slot ${activeSlot}`)

  sending = false
  updateUI()
}

// ---------------------------------------------------------------------------
// Image mode
// ---------------------------------------------------------------------------

async function showFullImage(): Promise<void> {
  if (sending) return
  sending = true

  const item = await selectSavedItem(cursorIndex)
  if (!item || item.type !== 'image') {
    sending = false
    return
  }

  try {
    await switchToImageLayout()
    await sendImageToGlass(item.quadrants)
    if (getSavedItems().length > 1) await updateImageArrows()
    appendEventLog(`Visionote: image ${cursorIndex} displayed`)
  } catch (err) {
    appendEventLog(`Visionote: image failed: ${err}`)
  }

  sending = false
  updateUI()
}

// ---------------------------------------------------------------------------
// Text mode
// ---------------------------------------------------------------------------

async function showFullText(): Promise<void> {
  if (sending) return
  sending = true

  const item = await selectSavedItem(cursorIndex)
  if (!item || item.type !== 'text') {
    sending = false
    return
  }

  try {
    await switchToTextLayout()
    const lines = item.content.split('\n')
    const visibleText = lines.slice(textScrollLine).join('\n')
    await displayText(visibleText)
    appendEventLog(`Visionote: text ${cursorIndex} displayed (scroll=${textScrollLine})`)
  } catch (err) {
    appendEventLog(`Visionote: text failed: ${err}`)
  }

  sending = false
  updateUI()
}

async function scrollText(direction: number): Promise<void> {
  const items = getSavedItems()
  const item = items[cursorIndex]
  if (!item || item.type !== 'text') return

  const lines = item.content.split('\n')
  textScrollLine = Math.max(0, Math.min(lines.length - 1, textScrollLine + direction))
  const visibleText = lines.slice(textScrollLine).join('\n')
  await displayText(visibleText)
  appendEventLog(`Visionote: text scroll → line ${textScrollLine}`)
}

// ---------------------------------------------------------------------------
// Open item (image or text)
// ---------------------------------------------------------------------------

async function openItem(): Promise<void> {
  const items = getSavedItems()
  const item = items[cursorIndex]
  if (!item) return

  if (item.type === 'image') {
    mode = 'image'
    lastPageStart = -1
    appendEventLog(`Visionote: click → image mode (index=${cursorIndex})`)
    void showFullImage()
  } else {
    mode = 'text'
    textScrollLine = 0
    lastPageStart = -1
    appendEventLog(`Visionote: click → text mode (index=${cursorIndex})`)
    void showFullText()
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function navigateItem(direction: number): void {
  const items = getSavedItems()
  if (items.length === 0) return
  cursorIndex = (cursorIndex + direction + items.length) % items.length
  lastPageStart = -1
  textScrollLine = 0
  const item = items[cursorIndex]
  if (item.type === 'text') {
    mode = 'text'
    void showFullText()
  } else {
    mode = 'image'
    void showFullImage()
  }
}

function handleScrollUp(): void {
  if (mode === 'thumbnails') {
    const items = getSavedItems()
    if (items.length === 0) return
    cursorIndex = (cursorIndex - 1 + items.length) % items.length
    void showThumbnails()
  } else if (mode === 'text') {
    void scrollText(-1)
  } else {
    navigateItem(-1)
  }
}

function handleScrollDown(): void {
  if (mode === 'thumbnails') {
    const items = getSavedItems()
    if (items.length === 0) return
    cursorIndex = (cursorIndex + 1) % items.length
    void showThumbnails()
  } else if (mode === 'text') {
    void scrollText(1)
  } else {
    navigateItem(1)
  }
}

function handleClick(): void {
  if (mode === 'thumbnails') {
    void openItem()
  }
}

function handleDoubleClick(): void {
  if (mode === 'image' || mode === 'text') {
    mode = 'thumbnails'
    lastPageStart = -1
    appendEventLog('Visionote: double-click → thumbnail mode')
    void showThumbnails()
  } else {
    if (bridge) {
      void bridge.shutDownPageContainer(1)
      appendEventLog('Visionote: exit requested')
    }
  }
}

// ---------------------------------------------------------------------------
// Public API (called from src/main.ts)
// ---------------------------------------------------------------------------

/** Send image from editor and enter image mode */
export async function sendAndShowImage(quadrants: number[][]): Promise<void> {
  mode = 'image'
  lastPageStart = -1
  await switchToImageLayout()
  await sendImageToGlass(quadrants)
  if (getSavedItems().length > 1) await updateImageArrows()
}

/** Send text and enter text mode */
export async function sendTextToGlass(content: string): Promise<void> {
  mode = 'text'
  textScrollLine = 0
  lastPageStart = -1
  await switchToTextLayout()
  await displayText(content)
}

/** Show a specific saved item on G2 */
export async function showSavedItemOnGlass(index: number): Promise<void> {
  cursorIndex = index
  lastPageStart = -1
  const item = await selectSavedItem(index)
  if (!item) return

  if (item.type === 'image') {
    mode = 'image'
    await switchToImageLayout()
    await sendImageToGlass(item.quadrants)
    if (getSavedItems().length > 1) await updateImageArrows()
  } else {
    mode = 'text'
    textScrollLine = 0
    await switchToTextLayout()
    await displayText(item.content)
  }
}

/** Refresh thumbnail view (call after adding/removing items) */
export async function refreshThumbnails(): Promise<void> {
  if (mode !== 'thumbnails') return
  lastPageStart = -1
  await showThumbnails()
}

/** Show initial view on G2 (thumbnails if items exist) */
export async function showInitialView(): Promise<void> {
  const items = getSavedItems()
  if (items.length > 0) {
    mode = 'thumbnails'
    cursorIndex = Math.max(0, getActiveIndex())
    lastPageStart = -1
    await showThumbnails()
  }
}

// ---------------------------------------------------------------------------
// Keep-alive callbacks
// ---------------------------------------------------------------------------

async function onRestore(): Promise<void> {
  if (!bridge) return
  try {
    await initDisplay()
    lastPageStart = -1
    if (mode === 'thumbnails') {
      await showThumbnails()
    } else if (mode === 'image') {
      await showFullImage()
    } else {
      await showFullText()
    }
    appendEventLog('Visionote: display restored after foreground return')
  } catch (err) {
    appendEventLog(`Visionote: restore failed: ${err}`)
  }
}

function onHeartbeatTick(): void {
  if (!bridge) return
  appendEventLog('Visionote: heartbeat tick')
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function initApp(b: EvenAppBridge): Promise<void> {
  setBridge(b)

  setEventHandlers({
    onScrollUp: handleScrollUp,
    onScrollDown: handleScrollDown,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
  })

  b.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()
  initKeepAlive(onRestore, onHeartbeatTick)
  appendEventLog('Visionote: app initialized')
}
