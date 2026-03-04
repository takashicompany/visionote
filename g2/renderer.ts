import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, IMAGE_W, IMAGE_H, IMAGE_X, IMAGE_Y } from './layout'
import { bridge } from './state'

let startupRendered = false

export async function initDisplay(): Promise<void> {
  if (!bridge) return

  const config = {
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
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img',
        xPosition: IMAGE_X,
        yPosition: IMAGE_Y,
        width: IMAGE_W,
        height: IMAGE_H,
      }),
    ],
  }

  await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
  startupRendered = true
  appendEventLog('Visionote: display initialized')
}

export async function sendImageToGlass(imageBytes: number[]): Promise<void> {
  if (!bridge) {
    appendEventLog('Visionote: bridge not connected')
    return
  }

  if (!startupRendered) {
    await initDisplay()
  }

  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: 2,
      containerName: 'img',
      imageData: imageBytes,
    }),
  )
  appendEventLog('Visionote: image sent to glasses')
}
