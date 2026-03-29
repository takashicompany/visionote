import type { AppModule } from '../_shared/app-types'
import type { SavedImage } from './image-editor'
import {
  initEditor,
  getGreyscalePngBytes,
  loadSavedImages,
  saveCurrentImage,
  deleteSavedImage,
  getSavedImages,
  getActiveIndex,
  getActiveSavedImage,
  selectSavedImage,
} from './image-editor'

let busy = false

function lockUI(): void {
  busy = true
  document.getElementById('sendBtn')?.setAttribute('disabled', '')
  document.getElementById('saveBtn')?.setAttribute('disabled', '')
  document.getElementById('saved-list')?.classList.add('locked')
}

function unlockUI(): void {
  busy = false
  document.getElementById('sendBtn')?.removeAttribute('disabled')
  document.getElementById('saveBtn')?.removeAttribute('disabled')
  document.getElementById('saved-list')?.classList.remove('locked')
}

function renderSavedList(): void {
  const list = document.getElementById('saved-list')!
  const countEl = document.getElementById('saved-count')!
  const images = getSavedImages()
  const active = getActiveIndex()

  countEl.textContent = `Saved Images (${images.length}):`
  list.innerHTML = ''

  images.forEach((img: SavedImage, idx: number) => {
    const thumb = document.createElement('div')
    thumb.className = 'saved-thumb' + (idx === active ? ' active' : '')

    const imgEl = document.createElement('img')
    imgEl.src = img.previewDataUrl
    imgEl.addEventListener('click', async () => {
      if (busy) return
      lockUI()
      selectSavedImage(idx)
      try {
        const { sendImageToGlass } = await import('../g2/app')
        await sendImageToGlass(img.topPngBytes, img.bottomPngBytes)
      } catch (err) {
        console.error('[Visionote] send saved image failed', err)
      }
      unlockUI()
      renderSavedList()
    })
    thumb.appendChild(imgEl)

    const delBtn = document.createElement('button')
    delBtn.className = 'delete-btn'
    delBtn.textContent = 'x'
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (busy) return
      deleteSavedImage(img.id)
      renderSavedList()
    })
    thumb.appendChild(delBtn)

    list.appendChild(thumb)
  })
}

// Exposed for g2/app.ts to call after scroll-based image switch
;(window as unknown as Record<string, unknown>).__visionoteLockUI = lockUI
;(window as unknown as Record<string, unknown>).__visionoteUnlockUI = unlockUI

// Exposed for g2/app.ts to call after scroll-based image switch
;(window as unknown as Record<string, () => void>).__visionoteRenderSavedList = renderSavedList

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  document.title = `${app.name} – Even G2`

  // Show version (injected at build time)
  const verEl = document.getElementById('app-version')
  if (verEl) verEl.textContent = `v${__APP_VERSION__}`

  // Initialize the image editor UI
  initEditor()

  // Load saved images from storage
  await loadSavedImages()
  renderSavedList()

  // Connect button (development)
  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null
  connectBtn?.addEventListener('click', async () => {
    const actions = await app.createActions(() => {})
    await actions.connect()
    connectBtn.textContent = 'Connected'
    connectBtn.disabled = true
  })

  // Resend to glasses (development)
  const resendBtn = document.getElementById('resendBtn') as HTMLButtonElement | null
  resendBtn?.addEventListener('click', async () => {
    const activeImg = getActiveSavedImage()
    if (!activeImg) return
    try {
      const { sendImageToGlass } = await import('../g2/app')
      await sendImageToGlass(activeImg.topPngBytes, activeImg.bottomPngBytes)
    } catch (err) {
      console.error('[Visionote] resend failed', err)
    }
  })

  // Send to glasses button
  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null
  sendBtn?.addEventListener('click', async () => {
    if (busy) return
    const split = await getGreyscalePngBytes()
    if (!split) {
      alert('No image to send')
      return
    }

    lockUI()
    sendBtn.textContent = 'Sending...'

    try {
      const { sendImageToGlass } = await import('../g2/app')
      await sendImageToGlass(split.top, split.bottom)
      sendBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] send failed', err)
      sendBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => {
        unlockUI()
        sendBtn.textContent = 'Send Image'
      }, 2000)
    }
  })

  // Save button
  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null
  saveBtn?.addEventListener('click', async () => {
    if (busy) return
    lockUI()
    saveBtn.textContent = 'Saving...'
    const saved = await saveCurrentImage()
    if (saved) {
      renderSavedList()
      saveBtn.textContent = 'Saved!'
    } else {
      saveBtn.textContent = 'No image'
    }
    setTimeout(() => {
      unlockUI()
      saveBtn.textContent = 'Save Image'
    }, 1500)
  })

  // Auto-connect when running inside Even Hub WebView
  try {
    const actions = await app.createActions(() => {})
    await actions.connect()

    // Bridge is now available — reload saved images from SDK storage
    await loadSavedImages()
    renderSavedList()

    // Restore last active image to G2
    const activeImg = getActiveSavedImage()
    if (activeImg) {
      const { sendImageToGlass } = await import('../g2/app')
      await sendImageToGlass(activeImg.topPngBytes, activeImg.bottomPngBytes)
    }
  } catch {
    // Not in Even Hub environment, ignore
  }
}

void boot().catch((error) => {
  console.error('[Visionote] boot failed', error)
})
