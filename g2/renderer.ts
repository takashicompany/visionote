import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, CONTAINER_W, CONTAINER_H, CONTAINERS, CURSOR } from './layout'
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
        xPosition: CONTAINERS[0].x - CURSOR.w,
        yPosition: CONTAINERS[0].y + Math.floor((CONTAINER_H - CURSOR.h) / 2),
        width: CURSOR.w,
        height: CURSOR.h,
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

/** Move cursor to the given slot by rebuilding the page with new cursor position */
export async function updateCursor(activeSlot: number): Promise<void> {
  if (!bridge || !startupRendered) return
  const target = CONTAINERS[activeSlot]
  if (!target) return

  // Position cursor to the left of the target image
  const cursorX = target.x - CURSOR.w
  const cursorY = target.y + Math.floor((CONTAINER_H - CURSOR.h) / 2)

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
          content: '▶',
          xPosition: cursorX,
          yPosition: cursorY,
          width: CURSOR.w,
          height: CURSOR.h,
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

/** Clear cursor by rebuilding without cursor content */
export async function clearCursor(): Promise<void> {
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
          width: CURSOR.w,
          height: CURSOR.h,
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
