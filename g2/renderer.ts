import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, CONTAINER_W, CONTAINER_H, CONTAINERS } from './layout'
import { bridge } from './state'

let startupRendered = false

export async function initDisplay(): Promise<void> {
  if (!bridge) return

  const config = {
    containerTotalNum: 5,
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
