import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { setBridge, bridge } from './state'
import { initDisplay, sendImageToGlass, updateCursor, updateImageArrows, switchToImageLayout, switchToThumbnailLayout } from './renderer'
import { onEvenHubEvent, setEventHandlers } from './events'
import {
  getSavedImages, selectSavedImage,
  getActiveIndex,
  generateThumbnailPng, generateBlackPng,
} from '../src/image-editor'
import { CONTAINER_W, CONTAINER_H } from './layout'

type AppMode = 'thumbnails' | 'image'
let mode: AppMode = 'thumbnails'
let cursorIndex = 0
let pageStart = 0
let lastPageStart = -1
let sending = false

const win = window as unknown as Record<string, ((() => void) | undefined)>
function updateUI(): void { win.__visionoteRenderSavedList?.() }

// ---------------------------------------------------------------------------
// Thumbnail helpers
// ---------------------------------------------------------------------------

async function generateSlotImage(imgIndex: number): Promise<number[]> {
  const images = getSavedImages()
  if (imgIndex < images.length) {
    return generateThumbnailPng(
      images[imgIndex].previewDataUrl,
      CONTAINER_W, CONTAINER_H,
      false,
      0, 0,
    )
  }
  return generateBlackPng(CONTAINER_W, CONTAINER_H)
}

// ---------------------------------------------------------------------------
// Thumbnail mode
// ---------------------------------------------------------------------------

async function showThumbnails(): Promise<void> {
  if (sending) return
  sending = true

  const images = getSavedImages()

  if (images.length === 0) {
    const black = await generateBlackPng(CONTAINER_W, CONTAINER_H)
    await sendImageToGlass([black, black, black, black])
    sending = false
    return
  }

  // Keep cursor in bounds
  if (cursorIndex >= images.length) cursorIndex = images.length - 1
  if (cursorIndex < 0) cursorIndex = 0

  // Adjust page to keep cursor visible
  if (cursorIndex < pageStart) pageStart = cursorIndex
  if (cursorIndex > pageStart + 3) pageStart = cursorIndex - 3
  pageStart = Math.max(0, pageStart)

  const pageChanged = pageStart !== lastPageStart

  if (pageChanged) {
    // Rebuild layout for thumbnail positions
    await switchToThumbnailLayout()

    const quadrants: number[][] = []
    for (let i = 0; i < 4; i++) {
      quadrants.push(await generateSlotImage(pageStart + i))
    }

    try {
      await sendImageToGlass(quadrants)
      lastPageStart = pageStart
      appendEventLog(`Visionote: thumbnails sent (page=${pageStart}, cursor=${cursorIndex})`)
    } catch (err) {
      appendEventLog(`Visionote: thumbnail failed: ${err}`)
    }
  }

  // Update cursor (lightweight textContainerUpgrade, no rebuild)
  const activeSlot = cursorIndex - pageStart
  const currentPage = Math.floor(pageStart / 4) + 1
  const maxPages = Math.ceil(images.length / 4)
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

  const img = await selectSavedImage(cursorIndex)
  if (!img) {
    sending = false
    return
  }

  try {
    await switchToImageLayout()
    await sendImageToGlass(img.quadrants)
    await updateImageArrows()
    appendEventLog(`Visionote: image ${cursorIndex} displayed`)
  } catch (err) {
    appendEventLog(`Visionote: image failed: ${err}`)
  }

  sending = false
  updateUI()
}

// ---------------------------------------------------------------------------
// Event handlers (scroll direction is inverted in setEventHandlers below)
// ---------------------------------------------------------------------------

function handleScrollUp(): void {
  const images = getSavedImages()
  if (images.length === 0) return

  if (mode === 'thumbnails') {
    cursorIndex = (cursorIndex - 1 + images.length) % images.length
    void showThumbnails()
  } else {
    cursorIndex = (cursorIndex - 1 + images.length) % images.length
    void showFullImage()
  }
}

function handleScrollDown(): void {
  const images = getSavedImages()
  if (images.length === 0) return

  if (mode === 'thumbnails') {
    cursorIndex = (cursorIndex + 1) % images.length
    void showThumbnails()
  } else {
    cursorIndex = (cursorIndex + 1) % images.length
    void showFullImage()
  }
}

function handleClick(): void {
  if (mode === 'thumbnails') {
    mode = 'image'
    lastPageStart = -1
    appendEventLog(`Visionote: click → image mode (index=${cursorIndex})`)
    void showFullImage()
  }
}

function handleDoubleClick(): void {
  if (mode === 'image') {
    mode = 'thumbnails'
    lastPageStart = -1
    appendEventLog('Visionote: double-click → thumbnail mode')
    void showThumbnails()
  } else {
    // exit disabled for now
    appendEventLog('Visionote: double-click in thumbnail mode (no-op)')
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
  await updateImageArrows()
}

/** Show a specific saved image on G2 and enter image mode */
export async function showSavedImageOnGlass(index: number): Promise<void> {
  mode = 'image'
  cursorIndex = index
  lastPageStart = -1
  const img = await selectSavedImage(index)
  if (!img) return
  await switchToImageLayout()
  await sendImageToGlass(img.quadrants)
  await updateImageArrows()
}

/** Refresh thumbnail view (call after adding/removing images) */
export async function refreshThumbnails(): Promise<void> {
  if (mode !== 'thumbnails') return
  lastPageStart = -1
  await showThumbnails()
}

/** Show initial view on G2 (thumbnails if images exist) */
export async function showInitialView(): Promise<void> {
  const images = getSavedImages()
  if (images.length > 0) {
    mode = 'thumbnails'
    cursorIndex = Math.max(0, getActiveIndex())
    lastPageStart = -1
    await showThumbnails()
  }
}

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
  appendEventLog('Visionote: app initialized')
}
