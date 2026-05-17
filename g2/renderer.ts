import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, CONTAINER_W, CONTAINER_H, FULL_W, FULL_H, CONTAINERS, CURSOR } from './layout'
import { bridge } from './state'

let startupRendered = false

export async function initDisplay(): Promise<void> {
  if (!bridge) return

  const config = {
    containerTotalNum: 6,  // 2 text + 4 image
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'evt',
        content: ' ',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: CURSOR.id,
        containerName: CURSOR.name,
        content: ' ',
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    imageObject: CONTAINERS.map(
      (c) =>
        new ImageContainerProperty({
          containerID: c.id,
          containerName: c.name,
          xPosition: c.x,
          yPosition: c.y,
          width: CONTAINER_W,
          height: CONTAINER_H,
        }),
    ),
  }

  await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
  startupRendered = true
  appendEventLog(`Visionote: display initialized (${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}, ${CONTAINERS.length} containers)`)
}

async function showLoadingText(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'evt',
      contentOffset: 0,
      contentLength: 2000,
      content: '\n\n\n\n     Loading...',
    }),
  )
}

async function clearLoadingText(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'evt',
      contentOffset: 0,
      contentLength: 2000,
      content: ' ',
    }),
  )
}

// Cursor position map: row and column for each slot (1-indexed)
const CURSOR_POS = [
  { row: 3, col: 4 },   // TL (slot 0)
  { row: 3, col: 17 },  // TR (slot 1)
  { row: 9, col: 4 },   // BL (slot 2)
  { row: 9, col: 17 },  // BR (slot 3)
]

/** Show only page number (no cursor arrow) */
export async function updatePageNumber(currentPage: number, maxPages: number): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      contentOffset: 0,
      contentLength: 2000,
      content: `${currentPage}/${maxPages}\nLoading...`,
    }),
  )
}

/** Move cursor to the given slot using textContainerUpgrade (no rebuild needed) */
export async function updateCursor(activeSlot: number, currentPage: number, maxPages: number): Promise<void> {
  if (!bridge || !startupRendered) return
  const pos = CURSOR_POS[activeSlot]
  if (!pos) return

  const pageInfo = `${currentPage}/${maxPages}`
  const content = pageInfo + '\n'.repeat(pos.row - 1) + '\u3000'.repeat(pos.col - 1) + '▶'

  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      contentOffset: 0,
      contentLength: 2000,
      content,
    }),
  )
}

/** Show ↑↓ navigation arrows in image mode */
export async function updateImageArrows(): Promise<void> {
  if (!bridge || !startupRendered) return
  const content = '\u3000'.repeat(14) + '↑' + '\n'.repeat(9) + '\u3000'.repeat(14) + '↓'
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      contentOffset: 0,
      contentLength: 2000,
      content,
    }),
  )
}

// Centered image layout (no gaps, for full image mode)
const CENTER_X = Math.floor((DISPLAY_WIDTH - FULL_W) / 2)   // 88
const CENTER_Y = 35
const CENTERED_CONTAINERS = [
  { x: CENTER_X,               y: CENTER_Y },
  { x: CENTER_X + CONTAINER_W, y: CENTER_Y },
  { x: CENTER_X,               y: CENTER_Y + CONTAINER_H },
  { x: CENTER_X + CONTAINER_W, y: CENTER_Y + CONTAINER_H },
]

/** Switch to image mode layout: containers centered, cursor hidden */
export async function switchToImageLayout(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 6,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'evt',
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
        }),
        new TextContainerProperty({
          containerID: CURSOR.id,
          containerName: CURSOR.name,
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: DISPLAY_HEIGHT,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      ],
      imageObject: CONTAINERS.map(
        (c, i) =>
          new ImageContainerProperty({
            containerID: c.id,
            containerName: c.name,
            xPosition: CENTERED_CONTAINERS[i].x,
            yPosition: CENTERED_CONTAINERS[i].y,
            width: CONTAINER_W,
            height: CONTAINER_H,
          }),
      ),
    }),
  )
}

/** Switch to thumbnail mode layout: containers spread out for cursor */
export async function switchToThumbnailLayout(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 6,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'evt',
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
        }),
        new TextContainerProperty({
          containerID: CURSOR.id,
          containerName: CURSOR.name,
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: DISPLAY_HEIGHT,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      ],
      imageObject: CONTAINERS.map(
        (c) =>
          new ImageContainerProperty({
            containerID: c.id,
            containerName: c.name,
            xPosition: c.x,
            yPosition: c.y,
            width: CONTAINER_W,
            height: CONTAINER_H,
          }),
      ),
    }),
  )
}

/** Switch to text mode layout: full-screen text container, no image containers */
export async function switchToTextLayout(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'evt',
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
        }),
        new TextContainerProperty({
          containerID: CURSOR.id,
          containerName: CURSOR.name,
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: DISPLAY_HEIGHT,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      ],
      imageObject: [],
    }),
  )
}

const MENU_W = 300
const MENU_H = 180
const MENU_X = Math.floor((DISPLAY_WIDTH - MENU_W) / 2)
const MENU_Y = Math.floor((DISPLAY_HEIGHT - MENU_H) / 2)

/** Switch to menu layout: centered bordered container + event capture layer */
export async function switchToMenuLayout(): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'evt',
          content: ' ',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 0,
        }),
        new TextContainerProperty({
          containerID: CURSOR.id,
          containerName: CURSOR.name,
          content: ' ',
          xPosition: MENU_X,
          yPosition: MENU_Y,
          width: MENU_W,
          height: MENU_H,
          isEventCapture: 0,
          paddingLength: 8,
          borderWidth: 2,
          borderColor: 0xFFFFFFFF,
          borderRadius: 4,
        }),
      ],
      imageObject: [],
    }),
  )
}

/** Display text content on the event capture container (native scroll) */
export async function displayText(content: string): Promise<void> {
  if (!bridge || !startupRendered) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'evt',
      contentOffset: 0,
      contentLength: 2000,
      content,
    }),
  )
}

/** Switch to thumbnail layout with mixed image/text slots.
 *  textSlots: indices (0-3) that should be text containers instead of image containers.
 *  textPreviews: content for each text slot.
 */
export async function switchToMixedThumbnailLayout(
  textSlots: Map<number, string>,
): Promise<void> {
  if (!bridge || !startupRendered) return

  const textObjects = [
    new TextContainerProperty({
      containerID: 1,
      containerName: 'evt',
      content: ' ',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      isEventCapture: 1,
      paddingLength: 0,
    }),
    new TextContainerProperty({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      content: ' ',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: DISPLAY_HEIGHT,
      isEventCapture: 0,
      paddingLength: 0,
    }),
  ]

  const imageObjects: ImageContainerProperty[] = []

  for (let i = 0; i < CONTAINERS.length; i++) {
    const c = CONTAINERS[i]
    if (textSlots.has(i)) {
      textObjects.push(
        new TextContainerProperty({
          containerID: 10 + i,
          containerName: `txt-${i}`,
          content: textSlots.get(i)!,
          xPosition: c.x,
          yPosition: c.y,
          width: CONTAINER_W,
          height: CONTAINER_H,
          isEventCapture: 0,
          paddingLength: 0,
        }),
      )
    } else {
      imageObjects.push(
        new ImageContainerProperty({
          containerID: c.id,
          containerName: c.name,
          xPosition: c.x,
          yPosition: c.y,
          width: CONTAINER_W,
          height: CONTAINER_H,
        }),
      )
    }
  }

  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: textObjects.length + imageObjects.length,
      textObject: textObjects,
      imageObject: imageObjects,
    }),
  )
}

/** Update cursor container with menu.
 *  Header: MENU
 *  Row 0: Back
 *  Row 1: Thumbnails/List toggle (shows active with 【】)
 *  Row 2: Exit
 */
export async function displayMenu(cursorIdx: number, activeMode: 'thumbnails' | 'list'): Promise<void> {
  if (!bridge || !startupRendered) return
  const toggleRow = activeMode === 'thumbnails'
    ? '【Thumbnails】　List'
    : '　Thumbnails　【List】'
  const rows = [
    'MENU',
    '',
    (cursorIdx === 0 ? '▶ ' : '　') + 'Back',
    (cursorIdx === 1 ? '▶ ' : '　') + toggleRow,
    (cursorIdx === 2 ? '▶ ' : '　') + 'Exit',
  ]
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      contentOffset: 0,
      contentLength: 2000,
      content: rows.join('\n'),
    }),
  )
}

const LIST_VISIBLE = 10

/** Update cursor container with filename list */
export async function displayList(items: Array<{ name: string }>, cursorIdx: number): Promise<void> {
  if (!bridge || !startupRendered) return
  const total = items.length
  if (total === 0) return

  let start = cursorIdx - Math.floor(LIST_VISIBLE / 2)
  start = Math.max(0, start)
  start = Math.min(start, Math.max(0, total - LIST_VISIBLE))

  const lines: string[] = []
  for (let i = start; i < Math.min(start + LIST_VISIBLE, total); i++) {
    lines.push((i === cursorIdx ? '▶ ' : '　') + items[i].name)
  }
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CURSOR.id,
      containerName: CURSOR.name,
      contentOffset: 0,
      contentLength: 2000,
      content: lines.join('\n'),
    }),
  )
}

export async function updateSingleImage(containerIndex: number, imageData: number[]): Promise<void> {
  if (!bridge || !startupRendered) return
  const c = CONTAINERS[containerIndex]
  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: c.id,
      containerName: c.name,
      imageData,
    }),
  )
}

export async function sendImageToGlass(quadrants: number[][]): Promise<void> {
  if (!bridge) {
    appendEventLog('Visionote: bridge not connected')
    return
  }

  if (!startupRendered) {
    await initDisplay()
  }

  await showLoadingText()

  for (let i = 0; i < CONTAINERS.length; i++) {
    const c = CONTAINERS[i]
    await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: c.id,
        containerName: c.name,
        imageData: quadrants[i],
      }),
    )
  }

  await clearLoadingText()
  appendEventLog(`Visionote: image sent to glasses (${DISPLAY_WIDTH}x${DISPLAY_HEIGHT})`)
}
