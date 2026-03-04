const IMAGE_W = 200
const IMAGE_H = 100

type EditorState = {
  image: HTMLImageElement | null
  panX: number
  panY: number
  zoom: number
  brightness: number
  contrast: number
  invert: boolean
}

const state: EditorState = {
  image: null,
  panX: 0,
  panY: 0,
  zoom: 100,
  brightness: 0,
  contrast: 0,
  invert: false,
}

let editCanvas: HTMLCanvasElement
let editCtx: CanvasRenderingContext2D
let previewCanvas: HTMLCanvasElement
let previewCtx: CanvasRenderingContext2D

// Touch/mouse drag state
let isDragging = false
let lastPointerX = 0
let lastPointerY = 0

export function initEditor(): void {
  editCanvas = document.getElementById('edit-canvas') as HTMLCanvasElement
  editCtx = editCanvas.getContext('2d')!
  previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement
  previewCtx = previewCanvas.getContext('2d')!

  const fileInput = document.getElementById('file-input') as HTMLInputElement
  fileInput.addEventListener('change', handleFileSelect)

  // Zoom slider
  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  zoomSlider.addEventListener('input', () => {
    state.zoom = Number(zoomSlider.value)
    document.getElementById('zoom-value')!.textContent = `${state.zoom}%`
    render()
  })

  // Brightness slider
  const brightnessSlider = document.getElementById('brightness-slider') as HTMLInputElement
  brightnessSlider.addEventListener('input', () => {
    state.brightness = Number(brightnessSlider.value)
    document.getElementById('brightness-value')!.textContent = String(state.brightness)
    render()
  })

  // Contrast slider
  const contrastSlider = document.getElementById('contrast-slider') as HTMLInputElement
  contrastSlider.addEventListener('input', () => {
    state.contrast = Number(contrastSlider.value)
    document.getElementById('contrast-value')!.textContent = String(state.contrast)
    render()
  })

  // Invert toggle
  const invertToggle = document.getElementById('invert-toggle') as HTMLInputElement
  invertToggle.addEventListener('change', () => {
    state.invert = invertToggle.checked
    render()
  })

  // Pan via touch/mouse on edit canvas
  editCanvas.addEventListener('pointerdown', onPointerDown)
  editCanvas.addEventListener('pointermove', onPointerMove)
  editCanvas.addEventListener('pointerup', onPointerUp)
  editCanvas.addEventListener('pointercancel', onPointerUp)
}

function handleFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const img = new Image()
  img.onload = () => {
    state.image = img
    resetTransform()
    document.getElementById('editor-area')!.style.display = ''
    render()
  }
  img.src = URL.createObjectURL(file)
}

function resetTransform(): void {
  if (!state.image) return
  // Fit image so the shorter dimension fills the crop area
  const scaleX = IMAGE_W / state.image.width
  const scaleY = IMAGE_H / state.image.height
  const fitScale = Math.max(scaleX, scaleY)
  state.zoom = Math.round(fitScale * 100)
  state.panX = 0
  state.panY = 0

  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  zoomSlider.value = String(state.zoom)
  document.getElementById('zoom-value')!.textContent = `${state.zoom}%`
}

// --- Pointer events for panning ---

function onPointerDown(e: PointerEvent): void {
  isDragging = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  editCanvas.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging) return
  const dx = e.clientX - lastPointerX
  const dy = e.clientY - lastPointerY
  lastPointerX = e.clientX
  lastPointerY = e.clientY

  // Convert screen pixels to source image pixels
  const scale = state.zoom / 100
  state.panX -= dx / scale
  state.panY -= dy / scale
  render()
}

function onPointerUp(_e: PointerEvent): void {
  isDragging = false
}

// --- Rendering ---

function render(): void {
  if (!state.image) return
  renderEditCanvas()
  renderPreview()
}

function renderEditCanvas(): void {
  const img = state.image!
  const scale = state.zoom / 100

  // Edit canvas shows the crop area at 2x for visibility
  const displayScale = 2
  editCanvas.width = IMAGE_W * displayScale
  editCanvas.height = IMAGE_H * displayScale

  editCtx.imageSmoothingEnabled = true
  editCtx.imageSmoothingQuality = 'high'

  // Source coordinates: center of crop in image space
  const srcCenterX = img.width / 2 + state.panX
  const srcCenterY = img.height / 2 + state.panY
  const srcW = IMAGE_W / scale
  const srcH = IMAGE_H / scale
  const srcX = srcCenterX - srcW / 2
  const srcY = srcCenterY - srcH / 2

  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height)
  editCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, editCanvas.width, editCanvas.height)

  // Apply brightness/contrast/invert to the edit canvas for visual feedback
  applyAdjustments(editCtx, editCanvas.width, editCanvas.height)
}

function renderPreview(): void {
  const img = state.image!
  const scale = state.zoom / 100

  previewCanvas.width = IMAGE_W
  previewCanvas.height = IMAGE_H

  previewCtx.imageSmoothingEnabled = true
  previewCtx.imageSmoothingQuality = 'high'

  const srcCenterX = img.width / 2 + state.panX
  const srcCenterY = img.height / 2 + state.panY
  const srcW = IMAGE_W / scale
  const srcH = IMAGE_H / scale
  const srcX = srcCenterX - srcW / 2
  const srcY = srcCenterY - srcH / 2

  previewCtx.clearRect(0, 0, IMAGE_W, IMAGE_H)
  previewCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, IMAGE_W, IMAGE_H)

  // Apply brightness/contrast/invert
  applyAdjustments(previewCtx, IMAGE_W, IMAGE_H)

  // Quantize to 16 shades of grey
  quantizeTo16Shades(previewCtx, IMAGE_W, IMAGE_H)
}

function applyAdjustments(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const brightness = state.brightness * 2.55 // -255 to 255
  const contrastFactor = (259 * (state.contrast + 255)) / (255 * (259 - state.contrast))

  for (let i = 0; i < data.length; i += 4) {
    // Convert to greyscale (luminance)
    let grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

    // Apply brightness
    grey += brightness

    // Apply contrast
    grey = contrastFactor * (grey - 128) + 128

    // Apply invert
    if (state.invert) grey = 255 - grey

    // Clamp
    grey = Math.max(0, Math.min(255, grey))

    data[i] = grey
    data[i + 1] = grey
    data[i + 2] = grey
    // data[i+3] alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0)
}

function quantizeTo16Shades(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Quantize to 4-bit (16 levels): 0,17,34,...,255
    const level = Math.round(data[i] / 255 * 15)
    const value = Math.round(level * 255 / 15)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Generate 8-bit greyscale PNG as byte array for G2 ImageContainer.
 * Uses an offscreen canvas to produce PNG, then fetches the blob.
 */
export async function getGreyscalePngBytes(): Promise<number[] | null> {
  if (!state.image) return null

  // Render to an offscreen canvas at exact IMAGE_W x IMAGE_H
  const offscreen = document.createElement('canvas')
  offscreen.width = IMAGE_W
  offscreen.height = IMAGE_H
  const ctx = offscreen.getContext('2d')!

  const img = state.image
  const scale = state.zoom / 100
  const srcCenterX = img.width / 2 + state.panX
  const srcCenterY = img.height / 2 + state.panY
  const srcW = IMAGE_W / scale
  const srcH = IMAGE_H / scale
  const srcX = srcCenterX - srcW / 2
  const srcY = srcCenterY - srcH / 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, IMAGE_W, IMAGE_H)

  // Apply adjustments and quantize
  applyAdjustments(ctx, IMAGE_W, IMAGE_H)
  quantizeTo16Shades(ctx, IMAGE_W, IMAGE_H)

  // Convert to PNG blob
  const blob = await new Promise<Blob | null>((resolve) => {
    offscreen.toBlob((b) => resolve(b), 'image/png')
  })
  if (!blob) return null

  const buf = await blob.arrayBuffer()
  return Array.from(new Uint8Array(buf))
}
