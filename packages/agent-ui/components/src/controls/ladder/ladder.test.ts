import { describe, it, expect, afterEach } from 'vitest'
import { UILadderElement } from './ladder.ts'

// ladder.test.ts — jsdom behaviour probes (LLD-C6, token-surfaces.lld.md §3.3; SPEC-R9…R12). jsdom is blind
// to painted geometry (SPEC-N2) — the literal-length/RTL/forced-colors legs are ladder.browser.test.ts's job.
// This file covers: prop typing/defaults, ARIA via internals (role=list, label), DOM shape (row count,
// aria-hidden track, printed label/value, the --_mag routing), the SPEC-R11 unified no-silent-state rule
// (a non-length tier is KEPT, not dropped), and zero residue across connect/disconnect.

class ProbeLadder extends UILadderElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-ladder-probe', ProbeLadder)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UILadderElement — upgrade + typed props', () => {
  it('upgrades to the class; tiers defaults to [], label defaults to ""', () => {
    const el = document.createElement('ui-ladder') as UILadderElement
    expect(el).toBeInstanceOf(UILadderElement)
    expect(el.tiers).toEqual([])
    expect(el.label).toBe('')
  })

  it('self-defines as ui-ladder, guarded against double-define', () => {
    expect(customElements.get('ui-ladder')).toBe(UILadderElement)
    expect(() => {
      if (!customElements.get('ui-ladder')) customElements.define('ui-ladder', UILadderElement)
    }).not.toThrow()
  })

  it('a JSON `tiers` attribute parses to the typed array on connect', () => {
    const el = document.createElement('ui-ladder') as UILadderElement
    el.setAttribute('tiers', '[{"label":"sm","value":"24px"},{"label":"lg","value":"36px"}]')
    mount(el)
    expect(el.tiers).toEqual([
      { label: 'sm', value: '24px' },
      { label: 'lg', value: '36px' },
    ])
  })

  it('malformed `tiers` attribute JSON never throws — falls back to [] (SPEC-R11)', () => {
    const el = document.createElement('ui-ladder') as UILadderElement
    expect(() => el.setAttribute('tiers', '{not json')).not.toThrow()
    mount(el)
    expect(el.tiers).toEqual([])
  })
})

describe('UILadderElement — list semantics via internals (SPEC-R12)', () => {
  it('role=list is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeLadder()) as ProbeLadder
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('an empty `label` leaves the list unlabeled (legal — SPEC-R12 AC2)', () => {
    const el = mount(new ProbeLadder()) as ProbeLadder
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.role).toBe('list')
  })

  it('a non-empty `label` names the list via internals.ariaLabel', () => {
    const el = new ProbeLadder()
    el.label = 'Control heights'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('Control heights')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
})

describe('UILadderElement — row rendering (SPEC-R10/R12)', () => {
  it('one role=listitem per valid tier, in order', () => {
    const el = new UILadderElement()
    el.tiers = [
      { label: 'sm', value: '24px' },
      { label: 'lg', value: '36px' },
    ]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('[data-part="label"]')?.textContent).toBe('sm')
    expect(items[1].querySelector('[data-part="label"]')?.textContent).toBe('lg')
  })

  it("the listitem's combined text content is exactly `{label}{value}` (SPEC-R12 AC1, the ui-bar-chart/ui-ramp precedent)", () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'md', value: '28px' }]
    mount(el)
    const item = el.querySelector('[role="listitem"]') as HTMLElement
    expect(item.textContent).toBe('md28px')
  })

  it('the track is aria-hidden and text-free (SPEC-R12 AC1) — the bar carries no text', () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'a', value: '10px' }]
    mount(el)
    const track = el.querySelector('[data-part="track"]') as HTMLElement
    expect(track.getAttribute('aria-hidden')).toBe('true')
    expect(track.textContent).toBe('')
  })

  it('a resolvable length tier routes through cssValue into --_mag (a literal length passes verbatim)', () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'a', value: '24px' }]
    mount(el)
    const bar = el.querySelector('[data-part="bar"]') as HTMLElement
    expect(bar.style.getPropertyValue('--_mag')).toBe('24px')
    expect(bar.style.width).toBe('') // this file never writes a width — ladder.css owns the paint
  })

  it('a --var length tier routes --_mag through var() (SPEC-R2/R10, the LLD-C1 cssValue transform)', () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'a', value: '--ui-height-md' }]
    mount(el)
    const bar = el.querySelector('[data-part="bar"]') as HTMLElement
    expect(bar.style.getPropertyValue('--_mag')).toBe('var(--ui-height-md)')
  })

  it('changing `tiers` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'a', value: '10px' }]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.tiers = [
      { label: 'x', value: '1px' },
      { label: 'y', value: '2px' },
      { label: 'z', value: '3px' },
    ]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(3)
  })
})

describe('UILadderElement — the unified no-silent-state rule (SPEC-R11)', () => {
  it('a non-length tier value ("red") is KEPT — a zero-length bar, the printed value survives (NOT dropped)', () => {
    const el = new UILadderElement()
    el.tiers = [
      { label: 'a', value: '24px' },
      { label: 'bad', value: 'red' },
      { label: 'c', value: '36px' },
    ]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items, 'the malformed row must survive — length-validity is a ROUTER, not a drop gate').toHaveLength(3)
    const badBar = items[1].querySelector('[data-part="bar"]') as HTMLElement
    expect(badBar.style.getPropertyValue('--_mag')).toBe('0px')
    expect(items[1].querySelector('[data-part="value"]')?.textContent).toBe('red')
  })

  it('a 0-length tier ("0px") renders one row, a zero-length bar, the printed 0 carries the reading', () => {
    const el = new UILadderElement()
    el.tiers = [{ label: 'zero', value: '0px' }]
    mount(el)
    const bar = el.querySelector('[data-part="bar"]') as HTMLElement
    expect(bar.style.getPropertyValue('--_mag')).toBe('0px')
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe('0px')
  })

  it('every entry dropped (missing label/value shape) leaves zero rows, host stays role=list', () => {
    const el = mount(new ProbeLadder()) as ProbeLadder
    // @ts-expect-error — deliberately malformed entries at the property boundary
    el.tiers = [{ label: 'no-value' }, { value: 'no-label' }, null]
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.probeInternals.role).toBe('list')
  })

  it('duplicate labels render as separate rows (positional, not keyed)', () => {
    const el = new UILadderElement()
    el.tiers = [
      { label: 'dup', value: '10px' },
      { label: 'dup', value: '20px' },
    ]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2)
  })
})

describe('UILadderElement — degenerate tiers (SPEC-R11)', () => {
  it('empty tiers → zero rows; host remains role=list (the honest empty state)', () => {
    const el = mount(new ProbeLadder()) as ProbeLadder
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.probeInternals.role).toBe('list')
  })

  it('a non-array property write (e.g. null) never throws and renders zero rows', () => {
    const el = new UILadderElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.tiers = null)).not.toThrow()
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
  })
})

describe('UILadderElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeLadder()) as ProbeLadder
    el.tiers = [{ label: 'a', value: '10px' }]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.remove()
    el.tiers = [{ label: 'a', value: '10px' }, { label: 'b', value: '20px' }]
    el.label = 'Later'
    await el.updateComplete

    document.body.append(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(el.probeInternals.role).toBe('list')
    expect(el.probeInternals.ariaLabel).toBe('Later')
    el.remove()
  })
})
