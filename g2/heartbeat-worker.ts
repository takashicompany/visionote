let intervalId: ReturnType<typeof setInterval> | null = null

self.onmessage = (e: MessageEvent) => {
  if (e.data === 'start') {
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(() => {
      self.postMessage('tick')
    }, 30_000)
  } else if (e.data === 'stop') {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}
