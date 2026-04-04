import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'

const SCROLL_COOLDOWN_MS = 200

// ---------------------------------------------------------------------------
// Forward declarations (set by app.ts to avoid circular imports)
// ---------------------------------------------------------------------------

let onScrollUpFn: () => void = () => {}
let onScrollDownFn: () => void = () => {}
let onClickFn: () => void = () => {}
let onDoubleClickFn: () => void = () => {}

export function setEventHandlers(handlers: {
  onScrollUp: () => void
  onScrollDown: () => void
  onClick: () => void
  onDoubleClick: () => void
}): void {
  onScrollUpFn = handlers.onScrollUp
  onScrollDownFn = handlers.onScrollDown
  onClickFn = handlers.onClick
  onDoubleClickFn = handlers.onDoubleClick
}

// ---------------------------------------------------------------------------
// Scroll cooldown
// ---------------------------------------------------------------------------

let lastScrollTime = 0

function scrollThrottled(): boolean {
  const now = Date.now()
  if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return true
  lastScrollTime = now
  return false
}

// ---------------------------------------------------------------------------
// Event type resolution (same pattern as make20)
// ---------------------------------------------------------------------------

export function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT
      default: return undefined
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase()
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT
    if (v.includes('SCROLL_TOP') || v.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  if (event.listEvent || event.textEvent || event.sysEvent) return OsEventTypeList.CLICK_EVENT

  return undefined
}

// ---------------------------------------------------------------------------
// Main event dispatcher
// ---------------------------------------------------------------------------

export function onEvenHubEvent(event: EvenHubEvent): void {
  appendEventLog(`RAW: ${JSON.stringify(event)}`)

  const eventType = resolveEventType(event)
  appendEventLog(`RESOLVED: type=${String(eventType)}`)

  switch (eventType) {
    case OsEventTypeList.SCROLL_TOP_EVENT:
      if (!scrollThrottled()) {
        onScrollUpFn()
      }
      break

    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      if (!scrollThrottled()) {
        onScrollDownFn()
      }
      break

    case OsEventTypeList.CLICK_EVENT:
      onClickFn()
      break

    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      onDoubleClickFn()
      break

    default:
      appendEventLog(`UNHANDLED: eventType=${String(eventType)}`)
      break
  }
}
