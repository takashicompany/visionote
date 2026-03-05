import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, IMAGE_W, IMAGE_HALF_H, IMAGE_X, IMAGE_TOP_Y, IMAGE_BOTTOM_Y } from './layout'
import { bridge } from './state'

let startupRendered = false

export async function initDisplay(): Promise<void> {
  if (!bridge) return

  const config = {
    containerTotalNum: 3,
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
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img-top',
        xPosition: IMAGE_X,
        yPosition: IMAGE_TOP_Y,
        width: IMAGE_W,
        height: IMAGE_HALF_H,
      }),
      new ImageContainerProperty({
        containerID: 3,
        containerName: 'img-btm',
        xPosition: IMAGE_X,
        yPosition: IMAGE_BOTTOM_Y,
        width: IMAGE_W,
        height: IMAGE_HALF_H,
      }),
    ],
  }

  await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
  startupRendered = true
  appendEventLog('Visionote: display initialized (200x200, 2 containers)')
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

export async function sendImageToGlass(topBytes: number[], bottomBytes: number[]): Promise<void> {
  if (!bridge) {
    appendEventLog('Visionote: bridge not connected')
    return
  }

  if (!startupRendered) {
    await initDisplay()
  }

  await showLoadingText()

  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: 2,
      containerName: 'img-top',
      imageData: topBytes,
    }),
  )
  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: 3,
      containerName: 'img-btm',
      imageData: bottomBytes,
    }),
  )

  await clearLoadingText()
  appendEventLog('Visionote: image sent to glasses (200x200)')
}
