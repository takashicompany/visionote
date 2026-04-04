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

/** Move cursor to the given slot using textContainerUpgrade (no rebuild needed) */
export async function updateCursor(activeSlot: number): Promise<void> {
  if (!bridge || !startupRendered) return
  const pos = CURSOR_POS[activeSlot]
  if (!pos) return

  const content = '\n'.repeat(pos.row - 1) + '\u3000'.repeat(pos.col - 1) + '▶'

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
const CENTER_Y = Math.floor((DISPLAY_HEIGHT - FULL_H) / 2)  // 44
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
