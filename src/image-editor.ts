const IMAGE_W = 200
const IMAGE_H = 100

type EditorState = {
  image: HTMLImageElement | null
  panX: number
  panY: number
  zoom: number     // actual pixel scale (100 = 1:1 original)
  fitZoom: number  // the scale at which image fills crop area
  brightness: number
  contrast: number
  invert: boolean
}

const state: EditorState = {
  image: null,
  panX: 0,
  panY: 0,
  zoom: 100,
  fitZoom: 100,
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

  // Zoom slider: 0% = fit to crop, 100% = original size
  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  zoomSlider.addEventListener('input', () => {
    const pct = Number(zoomSlider.value)
    // Linearly interpolate: 0% → fitZoom, 100% → 100 (original)
    state.zoom = state.fitZoom + (100 - state.fitZoom) * pct / 100
    document.getElementById('zoom-value')!.textContent = `${pct}%`
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
  state.fitZoom = Math.max(scaleX, scaleY) * 100
  state.zoom = state.fitZoom  // start at fit (slider 0%)
  state.panX = 0
  state.panY = 0

  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  zoomSlider.min = '0'
  zoomSlider.max = '100'
  zoomSlider.value = '0'
  document.getElementById('zoom-value')!.textContent = '0%'
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

  // Quantize to 16 shades, green tint to simulate G2 display
  quantizeTo16Shades(previewCtx, IMAGE_W, IMAGE_H, true)
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

function quantizeTo16Shades(ctx: CanvasRenderingContext2D, w: number, h: number, greenTint: boolean): void {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Quantize to 4-bit (16 levels): 0,17,34,...,255
    const level = Math.round(data[i] / 255 * 15)
    const value = Math.round(level * 255 / 15)

    if (greenTint) {
      // G2 display: black background + green light
      data[i] = 0
      data[i + 1] = value
      data[i + 2] = 0
    } else {
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Get the processed greyscale pixel data (IMAGE_W x IMAGE_H, one byte per pixel).
 */
function getGreyscalePixels(): Uint8Array | null {
  if (!state.image) return null

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

  applyAdjustments(ctx, IMAGE_W, IMAGE_H)
  quantizeTo16Shades(ctx, IMAGE_W, IMAGE_H, false)

  const imageData = ctx.getImageData(0, 0, IMAGE_W, IMAGE_H)
  const grey = new Uint8Array(IMAGE_W * IMAGE_H)
  for (let i = 0; i < grey.length; i++) {
    grey[i] = imageData.data[i * 4] // R channel (all channels are equal)
  }
  return grey
}

// ---------------------------------------------------------------------------
// 8-bit greyscale PNG encoder
// ---------------------------------------------------------------------------

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeU32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff
  arr[offset + 1] = (value >>> 16) & 0xff
  arr[offset + 2] = (value >>> 8) & 0xff
  arr[offset + 3] = value & 0xff
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  writeU32BE(chunk, 0, data.length)
  // Type
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
  // Data
  chunk.set(data, 8)
  // CRC over type + data
  const crcData = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) crcData[i] = type.charCodeAt(i)
  crcData.set(data, 4)
  writeU32BE(chunk, 8 + data.length, crc32(crcData))
  return chunk
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate')
  const writer = cs.writable.getWriter()
  writer.write(data as unknown as BufferSource)
  writer.close()

  const reader = cs.readable.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  let totalLen = 0
  for (const c of chunks) totalLen += c.length
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) {
    result.set(c, offset)
    offset += c.length
  }
  return result
}

async function encodeGreyscalePng(width: number, height: number, pixels: Uint8Array): Promise<Uint8Array> {
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1) = 13
  const ihdrData = new Uint8Array(13)
  writeU32BE(ihdrData, 0, width)
  writeU32BE(ihdrData, 4, height)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 0  // color type 0 = greyscale
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter method
  ihdrData[12] = 0 // interlace
  const ihdr = makePngChunk('IHDR', ihdrData)

  // IDAT: each row has a filter byte (0 = None) followed by pixel data
  const rawData = new Uint8Array(height * (1 + width))
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width)] = 0 // filter byte: None
    rawData.set(pixels.subarray(y * width, (y + 1) * width), y * (1 + width) + 1)
  }
  const compressed = await zlibCompress(rawData)
  const idat = makePngChunk('IDAT', compressed)

  // IEND
  const iend = makePngChunk('IEND', new Uint8Array(0))

  // Concat all
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length)
  let off = 0
  png.set(signature, off); off += signature.length
  png.set(ihdr, off); off += ihdr.length
  png.set(idat, off); off += idat.length
  png.set(iend, off)
  return png
}

/**
 * Generate 8-bit greyscale PNG as byte array for G2 ImageContainer.
 */
export async function getGreyscalePngBytes(): Promise<number[] | null> {
  const pixels = getGreyscalePixels()
  if (!pixels) return null

  const png = await encodeGreyscalePng(IMAGE_W, IMAGE_H, pixels)
  return Array.from(png)
}
