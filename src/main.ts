import type { AppModule } from '../_shared/app-types'
import type { SavedItem } from './image-editor'
import {
  initEditor,
  getGreyscalePngBytes,
  loadSavedItems,
  saveCurrentImage,
  saveText,
  updateText,
  deleteSavedItem,
  getSavedItems,
  getActiveIndex,
  getActiveSavedItem,
  selectSavedItem,
  generateTestImage,
  generateTestText,
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

let editingTextId: number | null = null

function renderSavedList(): void {
  const list = document.getElementById('saved-list')!
  const countEl = document.getElementById('saved-count')!
  const items = getSavedItems()
  const active = getActiveIndex()

  countEl.textContent = `Saved (${items.length}):`
  list.innerHTML = ''

  items.forEach((item: SavedItem, idx: number) => {
    const thumb = document.createElement('div')
    thumb.className = 'saved-thumb' + (idx === active ? ' active' : '')

    if (item.type === 'image') {
      const imgEl = document.createElement('img')
      imgEl.src = item.previewDataUrl
      imgEl.addEventListener('click', async () => {
        if (busy) return
        lockUI()
        selectSavedItem(idx)
        try {
          const { showSavedItemOnGlass } = await import('../g2/app')
          await showSavedItemOnGlass(idx)
        } catch (err) {
          console.error('[Visionote] send saved image failed', err)
        }
        unlockUI()
        renderSavedList()
      })
      thumb.appendChild(imgEl)
    } else {
      const textEl = document.createElement('div')
      textEl.className = 'saved-text-preview'
      textEl.textContent = item.content.slice(0, 50) + (item.content.length > 50 ? '...' : '')
      textEl.addEventListener('click', async () => {
        if (busy) return
        // Open text editor with this content
        editingTextId = item.id
        const textInput = document.getElementById('text-input') as HTMLTextAreaElement
        textInput.value = item.content
        // Switch to text tab
        document.getElementById('image-section')!.style.display = 'none'
        document.getElementById('text-section')!.style.display = ''
        document.getElementById('tab-image')!.classList.remove('active')
        document.getElementById('tab-text')!.classList.add('active')
        // Also show on G2
        selectSavedItem(idx)
        try {
          const { showSavedItemOnGlass } = await import('../g2/app')
          await showSavedItemOnGlass(idx)
        } catch { /* not connected */ }
        renderSavedList()
      })
      thumb.appendChild(textEl)
    }

    const delBtn = document.createElement('button')
    delBtn.className = 'delete-btn'
    delBtn.textContent = 'x'
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (busy) return
      deleteSavedItem(item.id)
      renderSavedList()
    })
    thumb.appendChild(delBtn)

    list.appendChild(thumb)
  })
}

// Exposed for g2/app.ts to call after G2-side operations
;(window as unknown as Record<string, unknown>).__visionoteLockUI = lockUI
;(window as unknown as Record<string, unknown>).__visionoteUnlockUI = unlockUI
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

  // Tab switching
  const tabImage = document.getElementById('tab-image')!
  const tabText = document.getElementById('tab-text')!
  const imageSection = document.getElementById('image-section')!
  const textSection = document.getElementById('text-section')!

  tabImage.addEventListener('click', () => {
    imageSection.style.display = ''
    textSection.style.display = 'none'
    tabImage.classList.add('active')
    tabText.classList.remove('active')
    editingTextId = null
  })

  tabText.addEventListener('click', () => {
    imageSection.style.display = 'none'
    textSection.style.display = ''
    tabText.classList.add('active')
    tabImage.classList.remove('active')
    editingTextId = null
    ;(document.getElementById('text-input') as HTMLTextAreaElement).value = ''
  })

  // Load saved items from storage
  await loadSavedItems()
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
    const active = getActiveSavedItem()
    if (!active || active.type !== 'image') return
    try {
      const { sendAndShowImage } = await import('../g2/app')
      await sendAndShowImage(active.quadrants)
    } catch (err) {
      console.error('[Visionote] resend failed', err)
    }
  })

  // Generate random test image (development)
  const testImagesBtn = document.getElementById('testImagesBtn') as HTMLButtonElement | null
  testImagesBtn?.addEventListener('click', async () => {
    await generateTestImage()
    renderSavedList()
  })

  // Generate random test text (development)
  const testTextBtn = document.getElementById('testTextBtn') as HTMLButtonElement | null
  testTextBtn?.addEventListener('click', () => {
    const content = generateTestText()
    // Switch to text tab and fill the form
    imageSection.style.display = 'none'
    textSection.style.display = ''
    tabText.classList.add('active')
    tabImage.classList.remove('active')
    editingTextId = null
    ;(document.getElementById('text-input') as HTMLTextAreaElement).value = content
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
      const { sendAndShowImage } = await import('../g2/app')
      await sendAndShowImage(split.quadrants)
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
      try {
        const { refreshThumbnails } = await import('../g2/app')
        await refreshThumbnails()
      } catch { /* not connected */ }
      saveBtn.textContent = 'Saved!'
    } else {
      saveBtn.textContent = 'No image'
    }
    setTimeout(() => {
      unlockUI()
      saveBtn.textContent = 'Save Image'
    }, 1500)
  })

  // Send Text button
  const sendTextBtn = document.getElementById('sendTextBtn') as HTMLButtonElement | null
  sendTextBtn?.addEventListener('click', async () => {
    if (busy) return
    const textInput = document.getElementById('text-input') as HTMLTextAreaElement
    const content = textInput.value.trim()
    if (!content) return

    lockUI()
    sendTextBtn.textContent = 'Sending...'
    try {
      const { sendTextToGlass } = await import('../g2/app')
      await sendTextToGlass(content)
      sendTextBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] send text failed', err)
      sendTextBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => {
        unlockUI()
        sendTextBtn.textContent = 'Send Text'
      }, 2000)
    }
  })

  // Save Text button
  const saveTextBtn = document.getElementById('saveTextBtn') as HTMLButtonElement | null
  saveTextBtn?.addEventListener('click', async () => {
    if (busy) return
    const textInput = document.getElementById('text-input') as HTMLTextAreaElement
    const content = textInput.value.trim()
    if (!content) return

    lockUI()
    saveTextBtn.textContent = 'Saving...'

    if (editingTextId) {
      await updateText(editingTextId, content)
      editingTextId = null
    } else {
      await saveText(content)
    }

    renderSavedList()
    try {
      const { refreshThumbnails } = await import('../g2/app')
      await refreshThumbnails()
    } catch { /* not connected */ }
    saveTextBtn.textContent = 'Saved!'
    setTimeout(() => {
      unlockUI()
      saveTextBtn.textContent = 'Save Text'
    }, 1500)
  })

  // Auto-connect when running inside Even Hub WebView
  try {
    const actions = await app.createActions(() => {})
    await actions.connect()

    // Bridge is now available — reload saved items from SDK storage
    await loadSavedItems()
    renderSavedList()

    // Show thumbnail view on G2
    const { showInitialView } = await import('../g2/app')
    await showInitialView()
  } catch {
    // Not in Even Hub environment, ignore
  }
}

void boot().catch((error) => {
  console.error('[Visionote] boot failed', error)
})
