import { describe, it, expect, vi, afterEach } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { rovingFocus } from './roving-focus.ts'
import type { RovingOrientation } from './roving-focus.ts'

// Probe host — wraps rovingFocus over its [role=option] descendants. `orientation`, `loop`, and
// `typeAhead` are plain properties (not reactive signals) so tests set them BEFORE connect.
// Named probes: rov-init · rov-arrow-vertical · rov-arrow-horizontal · rov-home-end · rov-loop-wrap
//   · rov-no-loop · rov-skip-disabled · rov-all-disabled · rov-on-move · rov-prevent-default
//   · rov-type-ahead-match · rov-type-ahead-accumulate · rov-type-ahead-disabled
//   · rov-cleanup · rov-auto-cleanup

class RovingHost extends UIElement {
  releaseFn: (() => void) | null = null
  moveLog: number[] = []
  orientation: RovingOrientation = 'vertical'
  loop = true
  typeAhead = true

  protected connected(): void {
    this.moveLog = []
    this.releaseFn = rovingFocus(this, {
      items: () => [...this.querySelectorAll<HTMLElement>('[role=option]')],
      orientation: this.orientation,
      loop: this.loop,
      typeAhead: this.typeAhead,
      onMove: (i) => this.moveLog.push(i),
    })
  }
}
customElements.define('ui-rov-host', RovingHost)

// Build a connected host with `n` option divs. Properties set before connect so options are
// already in DOM by the time rovingFocus runs.
function makeHost(
  n: number,
  opts: {
    labels?: string[]
    disabledIndices?: number[]
    ariaDisabledIndices?: number[]
    orientation?: RovingOrientation
    loop?: boolean
    typeAhead?: boolean
  } = {},
): [RovingHost, HTMLElement[]] {
  const host = new RovingHost()
  if (opts.orientation !== undefined) host.orientation = opts.orientation
  if (opts.loop !== undefined) host.loop = opts.loop
  if (opts.typeAhead !== undefined) host.typeAhead = opts.typeAhead

  const items: HTMLElement[] = []
  for (let i = 0; i < n; i++) {
    const item = document.createElement('div')
    item.setAttribute('role', 'option')
    item.textContent = opts.labels ? opts.labels[i] : `Item ${i}`
    if (opts.disabledIndices?.includes(i)) item.setAttribute('disabled', '')
    if (opts.ariaDisabledIndices?.includes(i)) item.setAttribute('aria-disabled', 'true')
    items.push(item)
    host.append(item)
  }
  document.body.append(host) // triggers connectedCallback → rovingFocus runs
  return [host, items]
}

const kd = (target: Element, key: string, extra?: Partial<KeyboardEventInit>): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
  target.dispatchEvent(e)
  return e
}

afterEach(() => {
  document.body.innerHTML = '' // disconnects + removes all probe hosts
})

describe('rovingFocus — roving tabindex + keyboard nav (listbox-roving LLD-C1)', () => {
  it('rov-init: first non-disabled item gets tabindex=0; the rest get -1', () => {
    const [, items] = makeHost(3)
    expect(items[0].tabIndex).toBe(0)
    expect(items[1].tabIndex).toBe(-1)
    expect(items[2].tabIndex).toBe(-1)
  })

  it('rov-arrow-vertical: ArrowDown/ArrowUp move the roving index and transfer focus', () => {
    const [host, items] = makeHost(3)
    kd(host, 'ArrowDown')
    expect(items[0].tabIndex).toBe(-1)
    expect(items[1].tabIndex).toBe(0)
    expect(document.activeElement).toBe(items[1])
    kd(host, 'ArrowDown')
    expect(items[2].tabIndex).toBe(0)
    expect(items[1].tabIndex).toBe(-1)
    kd(host, 'ArrowUp')
    expect(items[1].tabIndex).toBe(0)
    expect(document.activeElement).toBe(items[1])
  })

  it('rov-home-end: Home → first non-disabled; End → last non-disabled', () => {
    const [host, items] = makeHost(4)
    kd(host, 'ArrowDown')
    kd(host, 'ArrowDown') // now at index 2
    expect(items[2].tabIndex).toBe(0)

    kd(host, 'Home')
    expect(items[0].tabIndex).toBe(0)
    expect(document.activeElement).toBe(items[0])

    kd(host, 'End')
    expect(items[3].tabIndex).toBe(0)
    expect(document.activeElement).toBe(items[3])
  })

  it('rov-loop-wrap: ArrowDown from last wraps to first; ArrowUp from first wraps to last', () => {
    const [host, items] = makeHost(3) // loop=true by default
    kd(host, 'End') // jump to last
    expect(items[2].tabIndex).toBe(0)

    kd(host, 'ArrowDown') // last → wraps to first
    expect(items[0].tabIndex).toBe(0)

    kd(host, 'ArrowUp') // first → wraps to last
    expect(items[2].tabIndex).toBe(0)
  })

  it('rov-no-loop: ArrowDown stops at last; ArrowUp stops at first when loop=false', () => {
    const [host, items] = makeHost(3, { loop: false })
    kd(host, 'End')
    expect(items[2].tabIndex).toBe(0)

    kd(host, 'ArrowDown') // at last — stays
    expect(items[2].tabIndex).toBe(0)

    kd(host, 'Home')
    kd(host, 'ArrowUp') // at first — stays
    expect(items[0].tabIndex).toBe(0)
  })

  it('rov-skip-disabled: ArrowDown skips `disabled` and `aria-disabled` items', () => {
    // layout: [0]=enabled, [1]=disabled, [2]=aria-disabled, [3]=enabled
    const [host, items] = makeHost(4, { disabledIndices: [1], ariaDisabledIndices: [2] })
    expect(items[0].tabIndex).toBe(0) // first non-disabled is 0

    kd(host, 'ArrowDown') // skip 1 (disabled) and 2 (aria-disabled) → land on 3
    expect(items[3].tabIndex).toBe(0)
    expect(items[1].tabIndex).toBe(-1)
    expect(items[2].tabIndex).toBe(-1)

    kd(host, 'ArrowUp') // skip 2, 1 → land on 0
    expect(items[0].tabIndex).toBe(0)
  })

  it('rov-all-disabled: when every item is disabled no item gets tabindex=0', () => {
    const [, items] = makeHost(3, { disabledIndices: [0, 1, 2] })
    expect(items[0].tabIndex).toBe(-1)
    expect(items[1].tabIndex).toBe(-1)
    expect(items[2].tabIndex).toBe(-1)
  })

  it('rov-on-move: onMove(index) is called with the new index on every navigation', () => {
    const [host] = makeHost(3)
    kd(host, 'ArrowDown')
    expect(host.moveLog).toEqual([1])
    kd(host, 'ArrowDown')
    expect(host.moveLog).toEqual([1, 2])
    kd(host, 'Home')
    expect(host.moveLog).toEqual([1, 2, 0])
  })

  it('rov-arrow-horizontal: Left/Right drive horizontal orientation; Up/Down are no-ops', () => {
    const [host, items] = makeHost(3, { orientation: 'horizontal' })
    kd(host, 'ArrowRight')
    expect(items[1].tabIndex).toBe(0)
    kd(host, 'ArrowLeft')
    expect(items[0].tabIndex).toBe(0)

    // Vertical arrows are not nav keys for horizontal — they fall through
    kd(host, 'ArrowDown')
    expect(items[0].tabIndex).toBe(0) // unchanged
    kd(host, 'ArrowUp')
    expect(items[0].tabIndex).toBe(0) // unchanged
  })

  it('rov-prevent-default: navigation keys call preventDefault; other keys do not', () => {
    const [host] = makeHost(2)
    const navEvent = kd(host, 'ArrowDown')
    expect(navEvent.defaultPrevented).toBe(true)
    const homeEvent = kd(host, 'Home')
    expect(homeEvent.defaultPrevented).toBe(true)
    const tabEvent = kd(host, 'Tab')
    expect(tabEvent.defaultPrevented).toBe(false)
  })

  it('rov-type-ahead-match: printable char focuses the next item whose text starts with it', () => {
    // layout: Apple(0), Banana(1), Cherry(2). Initial roving = 0 (Apple).
    const [host, items] = makeHost(3, { labels: ['Apple', 'Banana', 'Cherry'] })
    kd(host, 'b') // buffer='b', from 0 → step1=1(Banana, 'banana' starts 'b') → focus 1
    expect(items[1].tabIndex).toBe(0)
  })

  it('rov-type-ahead-accumulate: buffer accumulates within 200ms, resets after 200ms', () => {
    vi.useFakeTimers()
    try {
      // Apple(0), Avocado(1), Ace(2). Initial roving = 0 (Apple).
      const [host, items] = makeHost(3, { labels: ['Apple', 'Avocado', 'Ace'] })
      kd(host, 'a') // buffer='a', from 0 → step1=1(Avocado, starts 'a') → focus 1
      expect(items[1].tabIndex).toBe(0)
      kd(host, 'c') // buffer='ac' (within 200ms), from 1 → step1=2(Ace, starts 'ac') → focus 2
      expect(items[2].tabIndex).toBe(0)

      vi.advanceTimersByTime(200) // timer fires from last key → buffer resets to ''

      kd(host, 'a') // buffer='a', from 2 → step1=0(Apple, starts 'a') → focus 0
      expect(items[0].tabIndex).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rov-type-ahead-disabled: type-ahead skips disabled items', () => {
    // Apple(0), Avocado(1, disabled), Apricot(2). Initial roving = 0 (Apple).
    const [host, items] = makeHost(3, { labels: ['Apple', 'Avocado', 'Apricot'], disabledIndices: [1] })
    kd(host, 'a') // from 0 → step1=1(Avocado, disabled — skip), step2=2(Apricot, starts 'a') → focus 2
    expect(items[2].tabIndex).toBe(0)
    expect(items[1].tabIndex).toBe(-1) // disabled item stays -1
  })

  it('rov-cleanup: after release(), the keydown handler is a no-op', () => {
    const [host, items] = makeHost(3)
    expect(items[0].tabIndex).toBe(0)
    host.releaseFn?.() // early teardown
    host.releaseFn?.() // idempotent — no throw
    kd(host, 'ArrowDown')
    expect(items[0].tabIndex).toBe(0) // unchanged — guard returned early
  })

  it('rov-auto-cleanup: after disconnect the keydown listener is removed (AbortSignal)', () => {
    const [host, items] = makeHost(3)
    expect(items[0].tabIndex).toBe(0)
    host.remove() // disconnect → AbortController aborts → listener dead
    kd(host, 'ArrowDown') // dispatched on disconnected host; listener is gone
    expect(items[0].tabIndex).toBe(0) // unchanged
  })
})
