import type { AppModule } from '../_shared/app-types'
import { initEditor, getGreyscalePngBytes } from './image-editor'

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  document.title = `${app.name} – Even G2`

  // Initialize the image editor UI
  initEditor()

  // Connect button (development)
  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null
  connectBtn?.addEventListener('click', async () => {
    const actions = await app.createActions(() => {})
    await actions.connect()
    connectBtn.textContent = 'Connected'
    connectBtn.disabled = true
  })

  // Send to glasses button
  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null
  sendBtn?.addEventListener('click', async () => {
    const bytes = await getGreyscalePngBytes()
    if (!bytes) {
      alert('No image to send')
      return
    }

    sendBtn.disabled = true
    sendBtn.textContent = 'Sending...'

    try {
      const { sendImageToGlass } = await import('../g2/app')
      await sendImageToGlass(bytes)
      sendBtn.textContent = 'Sent!'
    } catch (err) {
      console.error('[Visionote] send failed', err)
      sendBtn.textContent = 'Send Failed'
    } finally {
      setTimeout(() => {
        sendBtn.disabled = false
        sendBtn.textContent = 'Send to Glasses'
      }, 2000)
    }
  })

  // Auto-connect when running inside Even Hub WebView
  try {
    const actions = await app.createActions(() => {})
    await actions.connect()
  } catch {
    // Not in Even Hub environment, ignore
  }
}

void boot().catch((error) => {
  console.error('[Visionote] boot failed', error)
})
