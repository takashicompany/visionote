import { bridge } from '../g2/state'
import { CONTAINER_W, CONTAINER_H, FULL_W, FULL_H } from '../g2/layout'

const QUAD_W = CONTAINER_W  // 200
const QUAD_H = CONTAINER_H  // 100
const STORAGE_KEY = 'visionote-saved-images'
const ACTIVE_INDEX_KEY = 'visionote-active-index'

async function storageGet(key: string): Promise<string | null> {
  if (bridge) {
    const val = await bridge.getLocalStorage(key)
    return val ?? null
  }
  return localStorage.getItem(key)
}

async function storageSet(key: string, value: string): Promise<void> {
  if (bridge) {
    await bridge.setLocalStorage(key, value)
  } else {
    localStorage.setItem(key, value)
  }
}

export type SplitPngBytes = {
  quadrants: number[][] // [tl, tr, bl, br]
}

export type SavedImage = {
  id: number
  quadrants: number[][] // [tl, tr, bl, br]
  previewDataUrl: string
  createdAt: number
}

let savedImages: SavedImage[] = []
let activeIndex = -1

type EditorState = {
  image: HTMLImageElement | null
  panX: number
  panY: number
  zoom: number
  fitZoom: number
  rotation: number  // radians
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
  rotation: 0,
  brightness: 0,
  contrast: 0,
  invert: false,
}

let previewCanvas: HTMLCanvasElement
let previewCtx: CanvasRenderingContext2D

// Multi-touch state
const pointers = new Map<number, { x: number; y: number }>()
let pinchStartDist = 0
let pinchStartAngle = 0
let pinchStartZoom = 0
let pinchStartRotation = 0

export function initEditor(): void {
  previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement
  previewCtx = previewCanvas.getContext('2d')!

  const fileInput = document.getElementById('file-input') as HTMLInputElement
  fileInput.addEventListener('change', handleFileSelect)

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

  // Gesture events: pan (1 finger), pinch zoom + rotate (2 fingers)
  previewCanvas.addEventListener('pointerdown', onPointerDown)
  previewCanvas.addEventListener('pointermove', onPointerMove)
  previewCanvas.addEventListener('pointerup', onPointerUp)
  previewCanvas.addEventListener('pointercancel', onPointerUp)
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
  const scaleX = FULL_W / state.image.width
  const scaleY = FULL_H / state.image.height
  state.fitZoom = Math.max(scaleX, scaleY) * 100
  state.zoom = state.fitZoom
  state.panX = 0
  state.panY = 0
  state.rotation = 0
}


// --- Pointer events: 1-finger pan, 2-finger pinch zoom + rotate ---

let lastPanX = 0
let lastPanY = 0

function getPinchInfo(): { dist: number; angle: number } {
  const pts = Array.from(pointers.values())
  const dx = pts[1].x - pts[0].x
  const dy = pts[1].y - pts[0].y
  return {
    dist: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx),
  }
}

function onPointerDown(e: PointerEvent): void {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  previewCanvas.setPointerCapture(e.pointerId)

  if (pointers.size === 1) {
    lastPanX = e.clientX
    lastPanY = e.clientY
  } else if (pointers.size === 2) {
    const p = getPinchInfo()
    pinchStartDist = p.dist
    pinchStartAngle = p.angle
    pinchStartZoom = state.zoom
    pinchStartRotation = state.rotation
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size === 1) {
    const dx = e.clientX - lastPanX
    const dy = e.clientY - lastPanY
    lastPanX = e.clientX
    lastPanY = e.clientY

    const scale = state.zoom / 100
    const cos = Math.cos(state.rotation)
    const sin = Math.sin(state.rotation)
    state.panX -= (dx * cos + dy * sin) / scale
    state.panY -= (-dx * sin + dy * cos) / scale
    render()
  } else if (pointers.size === 2) {
    const p = getPinchInfo()
    state.zoom = Math.max(state.fitZoom, pinchStartZoom * (p.dist / pinchStartDist))
    state.rotation = pinchStartRotation + (p.angle - pinchStartAngle)
    render()
  }
}

function onPointerUp(e: PointerEvent): void {
  pointers.delete(e.pointerId)
  if (pointers.size === 1) {
    const remaining = pointers.values().next().value!
    lastPanX = remaining.x
    lastPanY = remaining.y
  }
}

// --- Rendering ---

function render(): void {
  if (!state.image) return
  renderPreview()
}

function renderPreview(): void {
  const img = state.image!
  const scale = state.zoom / 100

  previewCanvas.width = FULL_W
  previewCanvas.height = FULL_H

  previewCtx.imageSmoothingEnabled = true
  previewCtx.imageSmoothingQuality = 'high'

  previewCtx.clearRect(0, 0, FULL_W, FULL_H)
  previewCtx.save()
  previewCtx.translate(FULL_W / 2, FULL_H / 2)
  previewCtx.rotate(state.rotation)
  previewCtx.scale(scale, scale)
  previewCtx.drawImage(img, -img.width / 2 - state.panX, -img.height / 2 - state.panY)
  previewCtx.restore()

  applyAdjustments(previewCtx, FULL_W, FULL_H)
  quantizeTo16Shades(previewCtx, FULL_W, FULL_H, true)
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
 * Get the processed greyscale pixel data (FULL_W x FULL_H, one byte per pixel).
 */
function getGreyscalePixels(): Uint8Array | null {
  if (!state.image) return null

  const offscreen = document.createElement('canvas')
  offscreen.width = FULL_W
  offscreen.height = FULL_H
  const ctx = offscreen.getContext('2d')!

  const img = state.image
  const scale = state.zoom / 100

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.save()
  ctx.translate(FULL_W / 2, FULL_H / 2)
  ctx.rotate(state.rotation)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -img.width / 2 - state.panX, -img.height / 2 - state.panY)
  ctx.restore()

  applyAdjustments(ctx, FULL_W, FULL_H)
  quantizeTo16Shades(ctx, FULL_W, FULL_H, false)

  const imageData = ctx.getImageData(0, 0, FULL_W, FULL_H)
  const grey = new Uint8Array(FULL_W * FULL_H)
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
 * Extract a rectangular region from a full-size greyscale pixel buffer.
 */
function extractQuadrant(pixels: Uint8Array, srcW: number, x: number, y: number, w: number, h: number): Uint8Array {
  const quad = new Uint8Array(w * h)
  for (let row = 0; row < h; row++) {
    const srcOffset = (y + row) * srcW + x
    quad.set(pixels.subarray(srcOffset, srcOffset + w), row * w)
  }
  return quad
}

/**
 * Generate 4 quadrant 8-bit greyscale PNGs (each 288x144) for G2.
 * Order: [tl, tr, bl, br]
 */
export async function getGreyscalePngBytes(): Promise<SplitPngBytes | null> {
  const pixels = getGreyscalePixels()
  if (!pixels) return null

  const quadPixels = [
    extractQuadrant(pixels, FULL_W, 0,      0,      QUAD_W, QUAD_H), // tl
    extractQuadrant(pixels, FULL_W, QUAD_W,  0,      QUAD_W, QUAD_H), // tr
    extractQuadrant(pixels, FULL_W, 0,      QUAD_H,  QUAD_W, QUAD_H), // bl
    extractQuadrant(pixels, FULL_W, QUAD_W,  QUAD_H,  QUAD_W, QUAD_H), // br
  ]

  const pngs = await Promise.all(
    quadPixels.map((qp) => encodeGreyscalePng(QUAD_W, QUAD_H, qp)),
  )
  return { quadrants: pngs.map((png) => Array.from(png)) }
}

// ---------------------------------------------------------------------------
// Saved images (localStorage)
// ---------------------------------------------------------------------------

function getPreviewDataUrl(): string | null {
  if (!previewCanvas) return null
  return previewCanvas.toDataURL('image/png')
}

function numberArrayToBase64(bytes: number[]): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToNumberArray(b64: string): number[] {
  const binary = atob(b64)
  const arr = new Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}

export async function loadSavedImages(): Promise<SavedImage[]> {
  try {
    const raw = await storageGet(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      savedImages = parsed
        .filter((item) => Array.isArray(item.quadrantsPng))
        .map((item) => ({
          id: item.id as number,
          quadrants: (item.quadrantsPng as string[]).map(base64ToNumberArray),
          previewDataUrl: item.previewDataUrl as string,
          createdAt: item.createdAt as number,
        }))
    } else {
      savedImages = []
    }
  } catch {
    savedImages = []
  }
  try {
    const idx = await storageGet(ACTIVE_INDEX_KEY)
    activeIndex = idx != null ? Number(idx) : -1
    if (activeIndex >= savedImages.length) activeIndex = savedImages.length - 1
  } catch {
    activeIndex = -1
  }
  return savedImages
}

async function persistSavedImages(): Promise<void> {
  const stored = savedImages.map((img) => ({
    id: img.id,
    quadrantsPng: img.quadrants.map(numberArrayToBase64),
    previewDataUrl: img.previewDataUrl,
    createdAt: img.createdAt,
  }))
  await storageSet(STORAGE_KEY, JSON.stringify(stored))
}

async function persistActiveIndex(): Promise<void> {
  await storageSet(ACTIVE_INDEX_KEY, String(activeIndex))
}

export async function saveCurrentImage(): Promise<SavedImage | null> {
  const split = await getGreyscalePngBytes()
  if (!split) return null
  const preview = getPreviewDataUrl()
  if (!preview) return null

  const id = Date.now()
  const entry: SavedImage = {
    id,
    quadrants: split.quadrants,
    previewDataUrl: preview,
    createdAt: id,
  }
  savedImages.push(entry)
  activeIndex = savedImages.length - 1
  await persistSavedImages()
  await persistActiveIndex()
  return entry
}

export async function deleteSavedImage(id: number): Promise<void> {
  const idx = savedImages.findIndex((img) => img.id === id)
  if (idx === -1) return
  savedImages.splice(idx, 1)
  if (activeIndex >= savedImages.length) {
    activeIndex = savedImages.length - 1
  }
  await persistSavedImages()
  await persistActiveIndex()
}

export function getSavedImages(): SavedImage[] {
  return savedImages
}

export function getActiveIndex(): number {
  return activeIndex
}

export async function selectSavedImage(index: number): Promise<SavedImage | null> {
  if (index < 0 || index >= savedImages.length) return null
  activeIndex = index
  await persistActiveIndex()
  return savedImages[index]
}

export async function selectNext(): Promise<SavedImage | null> {
  if (savedImages.length <= 1) return null
  activeIndex = (activeIndex + 1) % savedImages.length
  await persistActiveIndex()
  return savedImages[activeIndex]
}

export async function selectPrev(): Promise<SavedImage | null> {
  if (savedImages.length <= 1) return null
  activeIndex = (activeIndex - 1 + savedImages.length) % savedImages.length
  await persistActiveIndex()
  return savedImages[activeIndex]
}

export function getActiveSavedImage(): SavedImage | null {
  if (activeIndex < 0 || activeIndex >= savedImages.length) return null
  return savedImages[activeIndex]
}

// ---------------------------------------------------------------------------
// Thumbnail generation for G2 display
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function generateThumbnailPng(
  previewDataUrl: string,
  containerW: number,
  containerH: number,
  selected: boolean,
  padX: number = 0,
  padY: number = 0,
): Promise<number[]> {
  const img = await loadImage(previewDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = containerW
  canvas.height = containerH
  const ctx = canvas.getContext('2d')!
  // Canvas defaults to transparent → black in greyscale

  const contentW = containerW - padX * 2
  const contentH = containerH - padY * 2

  // Fit image maintaining aspect ratio
  const imgAspect = img.width / img.height
  const areaAspect = contentW / contentH
  let drawW: number, drawH: number
  if (imgAspect > areaAspect) {
    drawW = contentW
    drawH = contentW / imgAspect
  } else {
    drawH = contentH
    drawW = contentH * imgAspect
  }
  const drawX = padX + (contentW - drawW) / 2
  const drawY = padY + (contentH - drawH) / 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, drawX, drawY, drawW, drawH)

  const imageData = ctx.getImageData(0, 0, containerW, containerH)
  const pixels = new Uint8Array(containerW * containerH)

  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = imageData.data[i * 4 + 1]
  }

  if (selected) {
    // Draw ▶ triangle in the left padding area
    const triW = 10
    const triH = 16
    const triX = Math.floor((padX - triW) / 2)
    const triY = Math.floor((containerH - triH) / 2)

    for (let row = 0; row < triH; row++) {
      const half = triH / 2
      const fillW = Math.round((half - Math.abs(row - half + 0.5)) / half * triW)
      for (let col = 0; col < fillW; col++) {
        const px = triX + col
        const py = triY + row
        if (px >= 0 && px < containerW && py >= 0 && py < containerH) {
          pixels[py * containerW + px] = 255
        }
      }
    }
  }

  const png = await encodeGreyscalePng(containerW, containerH, pixels)
  return Array.from(png)
}

/** Generate a random test image and load it into the editor (same as Select Image) */
export async function generateTestImage(): Promise<void> {
  const tmp = document.createElement('canvas')
  tmp.width = FULL_W
  tmp.height = FULL_H
  const ctx = tmp.getContext('2d')!

  const hueBase = Math.random() * 360
  const randHsl = (hShift: number, s: number, l: number) =>
    `hsl(${(hueBase + hShift) % 360}, ${s}%, ${l}%)`

  // Multi-stop gradient background
  const angle = Math.random() * Math.PI * 2
  const g = ctx.createLinearGradient(
    FULL_W / 2 - Math.cos(angle) * FULL_W, FULL_H / 2 - Math.sin(angle) * FULL_H,
    FULL_W / 2 + Math.cos(angle) * FULL_W, FULL_H / 2 + Math.sin(angle) * FULL_H,
  )
  g.addColorStop(0, randHsl(0, 70, 25))
  g.addColorStop(0.5, randHsl(40, 80, 40))
  g.addColorStop(1, randHsl(80, 60, 20))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, FULL_W, FULL_H)

  // Layered radial glows
  for (let i = 0; i < 3; i++) {
    const cx = Math.random() * FULL_W
    const cy = Math.random() * FULL_H
    const r = 60 + Math.random() * 120
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    rg.addColorStop(0, randHsl(120 + i * 90, 80, 60))
    rg.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.4 + Math.random() * 0.4
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, FULL_W, FULL_H)
  }

  // Bokeh-like circles
  for (let i = 0; i < 8 + Math.floor(Math.random() * 8); i++) {
    const x = Math.random() * FULL_W
    const y = Math.random() * FULL_H
    const r = 5 + Math.random() * 40
    ctx.globalAlpha = 0.1 + Math.random() * 0.3
    ctx.fillStyle = randHsl(Math.random() * 360, 60, 70)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Timestamp in center
  const now = new Date()
  const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 3
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(ts, FULL_W / 2, FULL_H / 2)
  ctx.fillText(ts, FULL_W / 2, FULL_H / 2)

  // Load into editor (same flow as file select)
  const dataUrl = tmp.toDataURL()
  const img = new Image()
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.src = dataUrl
  })

  state.image = img
  resetTransform()
  render()
  document.getElementById('editor-area')!.style.display = ''
}

export async function generateBlackPng(w: number, h: number): Promise<number[]> {
  const pixels = new Uint8Array(w * h)
  const png = await encodeGreyscalePng(w, h, pixels)
  return Array.from(png)
}
