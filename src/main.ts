import type { AppModule } from '../_shared/app-types'
import type { SavedItem } from './image-editor'
import {
  initEditor,
  getGreyscalePngBytes,
  loadSavedItems,
  saveCurrentImage,
  saveText,
  updateItem,
  reorderItems,
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
  document.getElementById('saved-list')?.classList.add('locked')
}

function unlockUI(): void {
  busy = false
  document.getElementById('saved-list')?.classList.remove('locked')
}

// ---------------------------------------------------------------------------
// Screen navigation
// ---------------------------------------------------------------------------

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((el) => {
    el.classList.remove('active')
  })
  document.getElementById(id)!.classList.add('active')
}

// ---------------------------------------------------------------------------
// Drag-to-reorder state
// ---------------------------------------------------------------------------

let dragSrcIdx: number | null = null
let dragGhost: HTMLElement | null = null
let dragCurrentIdx: number | null = null

function cleanupDrag(): void {
  dragGhost?.remove()
  dragGhost = null
  document.querySelectorAll('.saved-row').forEach((r) => {
    r.classList.remove('drag-over', 'dragging')
    ;(r as HTMLElement).style.opacity = ''
  })
  dragSrcIdx = null
  dragCurrentIdx = null
}

// ---------------------------------------------------------------------------
// Saved list rendering
// ---------------------------------------------------------------------------

function renderSavedList(): void {
  const list = document.getElementById('saved-list')!
  const countEl = document.getElementById('saved-count')!
  const items = getSavedItems()
  const active = getActiveIndex()

  countEl.textContent = `Saved (${items.length}):`
  list.innerHTML = ''

  items.forEach((item: SavedItem, idx: number) => {
    const row = document.createElement('div')
    row.className = 'saved-row' + (idx === active ? ' active' : '')
    row.dataset.idx = String(idx)

    // Drag handle
    const handle = document.createElement('span')
    handle.className = 'drag-handle'
    handle.textContent = '⠿'
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      dragSrcIdx = idx
      handle.setPointerCapture(e.pointerId)
      row.classList.add('dragging')

      // Create ghost
      dragGhost = document.createElement('div')
      dragGhost.className = 'drag-ghost'
      dragGhost.textContent = item.name
      document.body.appendChild(dragGhost)
    }, { passive: false })

    handle.addEventListener('pointermove', (e) => {
      if (dragSrcIdx === null || !dragGhost) return
      dragGhost.style.left = `${e.clientX - 20}px`
      dragGhost.style.top = `${e.clientY - 20}px`

      // Find row under cursor
      dragGhost.style.display = 'none'
      const el = document.elementFromPoint(e.clientX, e.clientY)
      dragGhost.style.display = ''
      const targetRow = el?.closest<HTMLElement>('.saved-row')
      document.querySelectorAll('.saved-row').forEach((r) => r.classList.remove('drag-over'))
      if (targetRow?.dataset.idx !== undefined) {
        const ti = Number(targetRow.dataset.idx)
        if (ti !== dragSrcIdx) {
          targetRow.classList.add('drag-over')
          dragCurrentIdx = ti
        } else {
          dragCurrentIdx = null
        }
      }
    })

    handle.addEventListener('pointerup', async () => {
      const from = dragSrcIdx
      const to = dragCurrentIdx
      cleanupDrag()
      if (from !== null && to !== null && from !== to) {
        await reorderItems(from, to)
        renderSavedList()
        try {
          const { refreshThumbnails } = await import('../g2/app')
          await refreshThumbnails()
        } catch { /* not connected */ }
      }
    })
    row.appendChild(handle)

    // Thumbnail
    const thumbEl = document.createElement('div')
    thumbEl.className = 'saved-row-thumb'
    if (item.type === 'image') {
      const img = document.createElement('img')
      img.src = item.previewDataUrl
      thumbEl.appendChild(img)
    } else {
      const textPrev = document.createElement('div')
      textPrev.className = 'saved-row-thumb-text'
      textPrev.textContent = item.content.slice(0, 60)
      thumbEl.appendChild(textPrev)
    }
    row.appendChild(thumbEl)

    // Name (inline editable)
    const nameEl = document.createElement('span')
    nameEl.className = 'saved-row-name'
    nameEl.textContent = item.name
    nameEl.addEventListener('click', () => {
      const input = document.createElement('input')
      input.type = 'text'
      input.value = item.name
      input.className = 'saved-row-name-input'
      nameEl.replaceWith(input)
      input.focus()
      input.select()

      const commit = async () => {
        const newName = input.value.trim()
        if (newName && newName !== item.name) {
          await updateItem(item.id, { name: newName })
          try {
            const { refreshThumbnails } = await import('../g2/app')
            await refreshThumbnails()
          } catch { /* not connected */ }
        }
        renderSavedList()
      }

      input.addEventListener('blur', commit)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur() }
        if (e.key === 'Escape') renderSavedList()
      })
    })
    row.appendChild(nameEl)

    // Action buttons
    const actionsEl = document.createElement('div')
    actionsEl.className = 'saved-row-actions'

    const showBtn = document.createElement('button')
    showBtn.className = 'row-btn row-btn-send'
    showBtn.textContent = 'Show'
    showBtn.addEventListener('click', async () => {
      if (busy) return
      lockUI()
      await selectSavedItem(idx)
      try {
        const { showSavedItemOnGlass } = await import('../g2/app')
        await showSavedItemOnGlass(idx)
      } catch { /* not connected */ }
      unlockUI()
      renderSavedList()
    })
    actionsEl.appendChild(showBtn)

    const editBtn = document.createElement('button')
    editBtn.className = 'row-btn row-btn-edit'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openDetailScreen(idx))
    actionsEl.appendChild(editBtn)

    row.appendChild(actionsEl)
    list.appendChild(row)
  })
}

// ---------------------------------------------------------------------------
// Detail/edit screen
// ---------------------------------------------------------------------------

let detailItemId: number | null = null

function openDetailScreen(idx: number): void {
  const item = getSavedItems()[idx]
  if (!item) return

  detailItemId = item.id

  document.getElementById('detail-title')!.textContent = item.type === 'image' ? 'Edit Image' : 'Edit Text'
  document.getElementById('detail-name-input')!.setAttribute('value', item.name)
  ;(document.getElementById('detail-name-input') as HTMLInputElement).value = item.name

  const imgSection = document.getElementById('detail-image-section')!
  const textSection = document.getElementById('detail-text-section')!

  if (item.type === 'image') {
    imgSection.style.display = ''
    textSection.style.display = 'none'
    ;(document.getElementById('detail-image-preview') as HTMLImageElement).src = item.previewDataUrl
  } else {
    imgSection.style.display = 'none'
    textSection.style.display = ''
    ;(document.getElementById('detail-text-input') as HTMLTextAreaElement).value = item.content
  }

  showScreen('screen-item-detail')
}

// ---------------------------------------------------------------------------
// Exposed for g2/app.ts
// ---------------------------------------------------------------------------

;(window as unknown as Record<string, unknown>).__visionoteLockUI = lockUI
;(window as unknown as Record<string, unknown>).__visionoteUnlockUI = unlockUI
;(window as unknown as Record<string, () => void>).__visionoteRenderSavedList = renderSavedList

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  document.title = `${app.name} – Even G2`

  const verEl = document.getElementById('app-version')
  if (verEl) verEl.textContent = `v${__APP_VERSION__}`

  initEditor()

  // --- Root screen ---
  document.getElementById('btn-create-image')!.addEventListener('click', () => {
    document.getElementById('editor-area')!.style.display = 'none'
    ;(document.getElementById('file-input') as HTMLInputElement).value = ''
    ;(document.getElementById('image-name-input') as HTMLInputElement).value = `image_${Date.now()}`
    showScreen('screen-image-create')
  })

  document.getElementById('btn-create-text')!.addEventListener('click', () => {
    ;(document.getElementById('text-input') as HTMLTextAreaElement).value = ''
    ;(document.getElementById('text-name-input') as HTMLInputElement).value = `text_${Date.now()}`
    showScreen('screen-text-create')
  })

  // --- Image creation screen ---
  document.getElementById('back-from-image-create')!.addEventListener('click', () => showScreen('screen-root'))

  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement
  sendBtn.addEventListener('click', async () => {
    if (busy) return
    const split = await getGreyscalePngBytes()
    if (!split) { alert('No image to send'); return }

    lockUI()
    sendBtn.disabled = true
    sendBtn.textContent = 'Sending...'
    try {
      const { sendAndShowImage } = await import('../g2/app')
      await sendAndShowImage(split.quadrants)
      sendBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] send failed', err)
      sendBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => { unlockUI(); sendBtn.disabled = false; sendBtn.textContent = 'Send Image' }, 2000)
    }
  })

  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
  saveBtn.addEventListener('click', async () => {
    if (busy) return
    lockUI()
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'
    const name = (document.getElementById('image-name-input') as HTMLInputElement).value.trim() || undefined
    const saved = await saveCurrentImage(name)
    if (saved) {
      renderSavedList()
      try {
        const { refreshThumbnails } = await import('../g2/app')
        await refreshThumbnails()
      } catch { /* not connected */ }
      saveBtn.textContent = 'Saved!'
      setTimeout(() => { unlockUI(); saveBtn.disabled = false; saveBtn.textContent = 'Save Image'; showScreen('screen-root') }, 1000)
    } else {
      saveBtn.textContent = 'No image'
      setTimeout(() => { unlockUI(); saveBtn.disabled = false; saveBtn.textContent = 'Save Image' }, 1500)
    }
  })

  // --- Text creation screen ---
  document.getElementById('back-from-text-create')!.addEventListener('click', () => showScreen('screen-root'))

  const sendTextBtn = document.getElementById('sendTextBtn') as HTMLButtonElement
  sendTextBtn.addEventListener('click', async () => {
    if (busy) return
    const content = (document.getElementById('text-input') as HTMLTextAreaElement).value.trim()
    if (!content) return

    lockUI()
    sendTextBtn.disabled = true
    sendTextBtn.textContent = 'Sending...'
    try {
      const { sendTextToGlass } = await import('../g2/app')
      await sendTextToGlass(content)
      sendTextBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] send text failed', err)
      sendTextBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => { unlockUI(); sendTextBtn.disabled = false; sendTextBtn.textContent = 'Send Text' }, 2000)
    }
  })

  const saveTextBtn = document.getElementById('saveTextBtn') as HTMLButtonElement
  saveTextBtn.addEventListener('click', async () => {
    if (busy) return
    const content = (document.getElementById('text-input') as HTMLTextAreaElement).value.trim()
    if (!content) return

    lockUI()
    saveTextBtn.disabled = true
    saveTextBtn.textContent = 'Saving...'
    const name = (document.getElementById('text-name-input') as HTMLInputElement).value.trim() || undefined
    await saveText(content, name)
    renderSavedList()
    try {
      const { refreshThumbnails } = await import('../g2/app')
      await refreshThumbnails()
    } catch { /* not connected */ }
    saveTextBtn.textContent = 'Saved!'
    setTimeout(() => { unlockUI(); saveTextBtn.disabled = false; saveTextBtn.textContent = 'Save Text'; showScreen('screen-root') }, 1000)
  })

  // --- Item detail/edit screen ---
  document.getElementById('back-from-detail')!.addEventListener('click', () => showScreen('screen-root'))

  const detailSendBtn = document.getElementById('detail-send-btn') as HTMLButtonElement
  detailSendBtn.addEventListener('click', async () => {
    if (busy || !detailItemId) return
    const items = getSavedItems()
    const idx = items.findIndex((i) => i.id === detailItemId)
    if (idx === -1) return
    lockUI()
    detailSendBtn.disabled = true
    detailSendBtn.textContent = 'Sending...'
    try {
      await selectSavedItem(idx)
      const { showSavedItemOnGlass } = await import('../g2/app')
      await showSavedItemOnGlass(idx)
      detailSendBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] detail send failed', err)
      detailSendBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => { unlockUI(); detailSendBtn.disabled = false; detailSendBtn.textContent = 'Show on G2' }, 2000)
    }
    renderSavedList()
  })

  const detailSaveBtn = document.getElementById('detail-save-btn') as HTMLButtonElement
  detailSaveBtn.addEventListener('click', async () => {
    if (busy || !detailItemId) return
    lockUI()
    detailSaveBtn.disabled = true
    detailSaveBtn.textContent = 'Saving...'
    const name = (document.getElementById('detail-name-input') as HTMLInputElement).value.trim() || undefined
    const item = getSavedItems().find((i) => i.id === detailItemId)
    if (!item) { unlockUI(); detailSaveBtn.disabled = false; detailSaveBtn.textContent = 'Save'; return }

    const updates: { name?: string; content?: string } = {}
    if (name) updates.name = name
    if (item.type === 'text') {
      const content = (document.getElementById('detail-text-input') as HTMLTextAreaElement).value.trim()
      if (content) updates.content = content
    }
    await updateItem(detailItemId, updates)
    renderSavedList()
    try {
      const { refreshThumbnails } = await import('../g2/app')
      await refreshThumbnails()
    } catch { /* not connected */ }
    detailSaveBtn.textContent = 'Saved!'
    setTimeout(() => { unlockUI(); detailSaveBtn.disabled = false; detailSaveBtn.textContent = 'Save'; showScreen('screen-root') }, 1000)
  })

  const deleteBtn = document.getElementById('detail-delete-btn') as HTMLButtonElement
  let deleteConfirmPending = false
  let deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null

  const resetDeleteBtn = () => {
    deleteConfirmPending = false
    deleteBtn.textContent = 'Delete'
    deleteBtn.style.background = ''
    deleteBtn.style.color = ''
    if (deleteConfirmTimer) { clearTimeout(deleteConfirmTimer); deleteConfirmTimer = null }
  }

  deleteBtn.addEventListener('click', async () => {
    if (busy || !detailItemId) return
    if (!deleteConfirmPending) {
      deleteConfirmPending = true
      deleteBtn.textContent = 'Tap again to delete'
      deleteBtn.style.background = '#e74c3c'
      deleteBtn.style.color = 'white'
      deleteConfirmTimer = setTimeout(resetDeleteBtn, 3000)
      return
    }
    resetDeleteBtn()
    lockUI()
    await deleteSavedItem(detailItemId)
    detailItemId = null
    renderSavedList()
    try {
      const { refreshThumbnails } = await import('../g2/app')
      await refreshThumbnails()
    } catch { /* not connected */ }
    unlockUI()
    showScreen('screen-root')
  })

  // 別画面に移動したらキャンセル
  document.getElementById('back-from-detail')!.addEventListener('click', resetDeleteBtn, { capture: true })

  // --- Dev section ---
  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null
  connectBtn?.addEventListener('click', async () => {
    const actions = await app.createActions(() => {})
    await actions.connect()
    connectBtn.textContent = 'Connected'
    connectBtn.disabled = true
  })

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

  // Root: Generate Test Images → save directly to list
  const testImagesBtn = document.getElementById('testImagesBtn') as HTMLButtonElement | null
  testImagesBtn?.addEventListener('click', async () => {
    await generateTestImage()
    const split = await getGreyscalePngBytes()
    if (split) {
      await saveCurrentImage()
      renderSavedList()
      try {
        const { refreshThumbnails } = await import('../g2/app')
        await refreshThumbnails()
      } catch { /* not connected */ }
    }
  })

  // Root: Generate Test Text → save directly to list
  const testTextBtn = document.getElementById('testTextBtn') as HTMLButtonElement | null
  testTextBtn?.addEventListener('click', async () => {
    const content = generateTestText()
    await saveText(content)
    renderSavedList()
    try {
      const { refreshThumbnails } = await import('../g2/app')
      await refreshThumbnails()
    } catch { /* not connected */ }
  })

  // Image creation screen: Generate Test Images → load into editor
  const testImagesBtnCreate = document.getElementById('testImagesBtn-create') as HTMLButtonElement | null
  testImagesBtnCreate?.addEventListener('click', async () => {
    await generateTestImage()
  })

  // Text creation screen: Generate Test Text → fill textarea
  const testTextBtnCreate = document.getElementById('testTextBtn-create') as HTMLButtonElement | null
  testTextBtnCreate?.addEventListener('click', () => {
    const content = generateTestText()
    ;(document.getElementById('text-input') as HTMLTextAreaElement).value = content
    ;(document.getElementById('text-name-input') as HTMLInputElement).value = `text_${Date.now()}`
  })

  // --- Load saved items ---
  await loadSavedItems()
  renderSavedList()

  // --- Auto-connect in Even Hub ---
  try {
    const actions = await app.createActions(() => {})
    await actions.connect()

    await loadSavedItems()
    renderSavedList()

    const { showInitialView } = await import('../g2/app')
    await showInitialView()
  } catch {
    // Not in Even Hub environment, ignore
  }
}

void boot().catch((error) => {
  console.error('[Visionote] boot failed', error)
})
