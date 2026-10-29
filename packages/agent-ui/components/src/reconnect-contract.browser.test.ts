// reconnect-contract.browser.test.ts: the connect, disconnect, reconnect contract (T-0541, Kim 2026-10-28).
// An overlay-family control removed while open ends CLOSED: `open` reads false once it is detached, it emits
// `close` (and the `toggle` two-way signal) exactly as a dismissal would, and a reconnect does not re-show it.
// A ui-status-stream with a running entry resumes its elapsed-time ticking after a reconnect. Real engines only
// (chromium and webkit via the `packages` project): the Popover API and `showModal()` top layer do not exist
// in jsdom.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { CONTROLS } from './controls/registry.gen.ts'

// GH #347 (REAL-TIMING HEADROOM): each case awaits frames and, for the stream, a real 1.2 s window.
vi.setConfig({ testTimeout: 30_000 })

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const settle = async (): Promise<void> => {
  await frame()
  await frame()
}

// The same minimal children the leak gate mounts each overlay with (`leak-gate.browser.test.ts`).
const CHILDREN: Record<string, string> = {
  'ui-tooltip': '<button>anchor</button><span>tip</span>',
  'ui-popover': '<button>anchor</button><div>panel</div>',
  'ui-menu': '<button>anchor</button><ui-menu-item>One</ui-menu-item>',
  'ui-select': '<ui-option value="a">A</ui-option><ui-option value="b">B</ui-option>',
  'ui-combo-box': '<ui-option value="a">A</ui-option><ui-option value="b">B</ui-option>',
  'ui-form-popover': '<button>anchor</button><div>form body</div>',
  'ui-modal': '<p>modal body</p>',
  'ui-drawer': '<p>drawer body</p>',
}
const OVERLAYS = Object.keys(CHILDREN)

type OpenHost = HTMLElement & { open: boolean }

/** Whether anything the host owns is showing: a popover panel in the top layer, or an open dialog part. */
function showing(el: HTMLElement): boolean {
  if (el.querySelector(':popover-open')) return true
  return [...el.querySelectorAll('dialog')].some((d) => d.open)
}

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove()
})

describe('overlay family: disconnected while open ends closed and announces close', () => {
  it.each(OVERLAYS)('%s', async (tag) => {
    await CONTROLS[tag].load()
    const el = document.createElement(tag) as OpenHost
    el.innerHTML = CHILDREN[tag]
    document.body.append(el)
    mounted.push(el)
    await settle()

    el.open = true
    await settle()
    // The arm took, so the closed checks below are not vacuous.
    expect(showing(el)).toBe(true)

    const events: string[] = []
    el.addEventListener('close', () => events.push(`close:${el.open}`))
    el.addEventListener('toggle', () => events.push(`toggle:${el.open}`))

    el.remove()
    await settle()
    expect(el.open).toBe(false)
    expect(el.hasAttribute('open')).toBe(false)
    // One dismissal announcement, fired after the prop settled false.
    expect(events).toEqual(['close:false', 'toggle:false'])

    document.body.append(el)
    await settle()
    expect(el.open).toBe(false)
    expect(showing(el)).toBe(false)
    // The reconnect itself announces nothing (nothing transitioned).
    expect(events).toEqual(['close:false', 'toggle:false'])

    // Still a working overlay after the round trip.
    el.open = true
    await settle()
    expect(showing(el)).toBe(true)
    el.open = false
    await settle()
  })
})

describe('ui-status-stream: a reconnected stream resumes ticking', () => {
  it('the elapsed text of a running entry advances after remove and reconnect', async () => {
    await CONTROLS['ui-status-stream'].load()
    const el = document.createElement('ui-status-stream') as HTMLElement & { appendEntry(e: Record<string, unknown>): unknown }
    document.body.append(el)
    mounted.push(el)
    await settle()
    el.appendEntry({ key: 'r', label: 'running', status: 'active', startedAt: new Date(Date.now() - 5000).toISOString() })
    await settle()

    el.remove()
    await settle()
    document.body.append(el)
    await settle()
    const before = el.textContent
    await new Promise((r) => setTimeout(r, 1200))
    // A frozen stream (no interval re-armed on reconnect) shows the same elapsed time 1.2 s later.
    expect(el.textContent).not.toBe(before)
  })
})
