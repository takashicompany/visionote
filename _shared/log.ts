export function appendEventLog(text: string): void {
  const el = document.getElementById('event-log')
  const time = new Date().toLocaleTimeString()
  const line = `[${time}] ${text}`

  if (el) {
    el.textContent = `${line}\n` + (el.textContent ?? '')
    const lines = el.textContent.split('\n')
    if (lines.length > 200) {
      el.textContent = lines.slice(0, 200).join('\n')
    }
  }

  // Forward to dev server
  fetch('/api/log', { method: 'POST', body: line }).catch(() => {})
}
