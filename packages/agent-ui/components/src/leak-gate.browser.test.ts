// leak-gate.browser.test.ts: the standing no-leak gate (T-0543, promoted from the T-0535 sweep probe).
// Every registered fleet control is connected, removed and reconnected three times in a real engine (chromium
// and webkit via the `packages` project) with its lazy paths armed (an overlay opened, a hotkey set, a timer
// started). After removal nothing the control installed may survive: no window or document listener, no live
// observer, no interval, no pending timeout or rAF, no open popover; and a reconnect must not stack host
// listeners. The counting layer is `../leak-instrument.ts`; the verdict rules are its `leakFlags`.
//
// The negative control is permanent: a scratch element that leaks one of each class is run through the same
// cycle and must be flagged class by class, so a gate that went blind (a wrapper that stopped counting) turns
// red here instead of passing every control. The app hosts run the same cycle in
// `packages/agent-ui/app/src/leak-gate.browser.test.ts`.

import { describe, it, expect, vi } from 'vitest'
import { installLeakInstrument, runLeakCycle, leakFlags, type LeakCycleOptions } from './leak-instrument.ts'
import { CONTROLS } from './controls/registry.gen.ts'

// GH #347 (REAL-TIMING HEADROOM): each cycle awaits frames and short real waits.
vi.setConfig({ testTimeout: 30_000 })

const inst = installLeakInstrument()

// Page errors, minus the spec's own benign ResizeObserver loop signal (`vitest.browser.config.ts` filters the
// same message fatal-side).
const errors: string[] = []
const RO_LOOP = 'ResizeObserver loop completed with undelivered notifications'
window.addEventListener('error', (e) => {
  if (!String(e.message).includes(RO_LOOP)) errors.push(String(e.message))
})
window.addEventListener('unhandledrejection', (e) => {
  errors.push(String((e as PromiseRejectionEvent).reason))
})

// Per-tag setup that arms a lazy path before removal (the suspects from the T-0535 static read).
const open: LeakCycleOptions['arm'] = (el) => {
  el['open'] = true
}
const ARM: Record<string, LeakCycleOptions['arm']> = {
  'ui-command-modal': (el) => {
    el['hotkey'] = 'mod+k'
  },
  'ui-tooltip': (el) => {
    el.firstElementChild?.dispatchEvent(new MouseEvent('mouseenter'))
  },
  'ui-popover': open,
  'ui-menu': open,
  'ui-select': open,
  'ui-combo-box': open,
  'ui-modal': open,
  'ui-drawer': open,
  'ui-form-popover': open,
  'ui-status-stream': (el) => {
    const s = el as unknown as { appendEntry(e: Record<string, unknown>): unknown }
    s.appendEntry({ key: 'a', label: 'running', status: 'active', startedAt: Date.now() - 5000 })
  },
}
const CHILDREN: Record<string, string> = {
  'ui-tooltip': '<button>anchor</button><span>tip</span>',
  'ui-popover': '<button>anchor</button><div>panel</div>',
  'ui-menu': '<button>anchor</button><ui-menu-item>One</ui-menu-item>',
  'ui-select': '<ui-option value="a">A</ui-option><ui-option value="b">B</ui-option>',
  'ui-combo-box': '<ui-option value="a">A</ui-option><ui-option value="b">B</ui-option>',
  'ui-command-modal': '<ui-option value="a">A</ui-option>',
  'ui-tabs': '<ui-tab>A</ui-tab><ui-tab>B</ui-tab><ui-tab-panel>a</ui-tab-panel><ui-tab-panel>b</ui-tab-panel>',
  'ui-toolbar': '<button>a</button><button>b</button>',
  'ui-list': '<div>a</div><div>b</div>',
}

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const wait = (ms: number): Promise<void> => new Promise((r) => inst.realSetTimeout(r, ms))

describe('fleet leak gate: remove and reconnect leave nothing behind', () => {
  const tags = Object.keys(CONTROLS)

  it('registers the whole fleet (anti-vacuous)', () => {
    expect(tags.length).toBeGreaterThan(80)
  })

  it.each(tags)('%s', async (tag) => {
    await CONTROLS[tag].load()
    const row = await runLeakCycle(inst, tag, { children: CHILDREN[tag], arm: ARM[tag], errors })
    expect(leakFlags(row)).toEqual([])
  })

  it('ui-text-field: each type keeps host listeners flat over reconnects and type flips, and frees globals', async () => {
    await CONTROLS['ui-text-field'].load()
    const bad: string[] = []
    for (const type of ['number', 'date', 'currency', 'password', 'search', 'color']) {
      const el = document.createElement('ui-text-field')
      el.setAttribute('type', type)
      errors.length = 0
      // Warm-up round so one-time installs land in the baseline, then count against it.
      document.body.append(el)
      await frame()
      await frame()
      el.remove()
      await frame()
      await wait(30)
      const base = inst.snap(el)
      inst.resetTimers()
      inst.setTracking(true)
      const perConnect: number[] = []
      for (let i = 0; i < 3; i++) {
        document.body.append(el)
        await frame()
        await frame()
        el.querySelector<HTMLElement>('[data-part="calendar-button"], [data-part="swatch-button"], [data-part="trailing-adornment"] button')?.click()
        await frame()
        await wait(50)
        perConnect.push(inst.snap(el).hostListeners)
        el.remove()
        await frame()
        await wait(20)
        const after = inst.snap(el)
        if (after.globalListeners > base.globalListeners) bad.push(`${type}: global listeners ${base.globalListeners}->${after.globalListeners} after remove`)
        if (after.observers > base.observers) bad.push(`${type}: observers ${base.observers}->${after.observers} after remove`)
        if (after.popoverOpen > 0) bad.push(`${type}: popover open after remove`)
      }
      if (new Set(perConnect).size !== 1) bad.push(`${type}: host listeners per connect ${perConnect.join(',')}`)
      // Flipping the type while connected must return to the same count, not accumulate.
      document.body.append(el)
      await frame()
      const flips: number[] = []
      for (const t of ['text', type, 'text', type]) {
        el.setAttribute('type', t)
        await frame()
        await frame()
        flips.push(inst.snap(el).hostListeners)
      }
      el.remove()
      await frame()
      inst.setTracking(false)
      if (flips[1] !== flips[3] || flips[0] !== flips[2]) bad.push(`${type}: host listeners drift across type flips ${flips.join(',')}`)
      if (errors.length) bad.push(`${type}: errors ${errors.join(' | ')}`)
    }
    expect(bad).toEqual([])
  })

  it('ui-status-stream: the ticking interval is cleared on removal and a reconnect re-arms at most the one running entry interval', async () => {
    await CONTROLS['ui-status-stream'].load()
    const el = document.createElement('ui-status-stream') as HTMLElement & { appendEntry(e: Record<string, unknown>): unknown }
    inst.resetTimers()
    inst.setTracking(true)
    document.body.append(el)
    await frame()
    el.appendEntry({ key: 'r', label: 'running', status: 'active', startedAt: Date.now() - 5000 })
    await frame()
    const whileConnected = inst.snap(el).intervals
    el.remove()
    await frame()
    const afterRemove = inst.snap(el).intervals
    document.body.append(el)
    await frame()
    await wait(1200)
    const afterReconnect = inst.snap(el).intervals
    el.remove()
    await frame()
    inst.setTracking(false)
    expect(whileConnected).toBeGreaterThan(0) // the arm took, so the removal check below is not vacuous
    expect(afterRemove).toBe(0)
    expect(afterReconnect).toBeLessThanOrEqual(whileConnected)
  })
})

describe('leak gate negative control: the checker flags each leak class', () => {
  // A scratch element that leaks one thing per mode, defined here so no fleet control is touched.
  class LeakProbe extends HTMLElement {
    static mode = ''
    connectedCallback(): void {
      const mode = LeakProbe.mode
      if (mode === 'listener') window.addEventListener('resize', () => {})
      else if (mode === 'document-listener') document.addEventListener('keydown', () => {})
      else if (mode === 'observer') new ResizeObserver(() => {}).observe(this)
      else if (mode === 'interval') setInterval(() => {}, 100_000)
      else if (mode === 'timeout') setTimeout(() => {}, 60_000)
      else if (mode === 'stack') this.addEventListener('click', () => {})
    }
  }
  if (!customElements.get('ui-leak-probe')) customElements.define('ui-leak-probe', LeakProbe)

  const MODES: Array<[mode: string, expected: RegExp]> = [
    ['listener', /global listeners \+1 after remove: window:resize/],
    ['document-listener', /global listeners \+1 after remove: document:keydown/],
    ['observer', /observers \+1 after remove \(.*RO.*\)/],
    ['interval', /intervals \+1 after remove/],
    ['timeout', /timeouts pending after remove: \d+/],
    ['stack', /host listeners stack on reconnect/],
  ]

  it('a clean element is not flagged', async () => {
    LeakProbe.mode = ''
    const row = await runLeakCycle(inst, 'ui-leak-probe', { errors })
    expect(leakFlags(row)).toEqual([])
  })

  it.each(MODES)('flags a leaked %s', async (mode, expected) => {
    LeakProbe.mode = mode
    const row = await runLeakCycle(inst, 'ui-leak-probe', { errors })
    LeakProbe.mode = ''
    const flags = leakFlags(row)
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.join('\n')).toMatch(expected)
  })
})
