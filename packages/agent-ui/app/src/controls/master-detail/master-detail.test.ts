import { describe, it, expect, vi, afterEach } from 'vitest'
import { UIMasterDetailElement } from './master-detail.ts'
import { UIMasterDetailPaneElement } from './master-detail-pane.ts'
import { whenFlushed } from '@agent-ui/components'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// n2a — jsdom probes for ui-master-detail + ui-master-detail-pane (LLD-C10, SPEC-R7). jsdom cannot resolve
// CSS Grid/@container layout — the ACTUAL wide-side-by-side / narrow-drill-in geometry is
// master-detail.browser.test.ts's job (the app-shell.test.ts/app-shell.browser.test.ts split, mirrored).
// This file proves: the connect-time relocation into a real ui-split/ui-split-pane pair, the
// selected → view/event derivation (incl. the no-event-on-first-run rule), the back affordance's
// view-only (never `selected`-touching) behaviour, degenerate composition (a missing pane never throws),
// and both descriptors' structural + contract↔props + contract↔source trip-wires.

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function pane(which: 'list' | 'detail', text: string): UIMasterDetailPaneElement {
  const p = new UIMasterDetailPaneElement()
  p.pane = which
  p.textContent = text
  return p
}

function mount(el: UIMasterDetailElement): UIMasterDetailElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('UIMasterDetailElement — upgrade + defaults', () => {
  it('upgrades to the class; selected defaults to the empty string', () => {
    const el = mount(document.createElement('ui-master-detail') as UIMasterDetailElement)
    expect(el).toBeInstanceOf(UIMasterDetailElement)
    expect(el.selected).toBe('')
    expect(el.getAttribute('data-view')).toBe('list') // no selection ⇒ list (LLD §3.1)
  })

  it('static props is exactly [selected]', () => {
    expect(Object.keys(UIMasterDetailElement.props)).toEqual(['selected'])
  })
})

describe('UIMasterDetailElement — composition (SPEC-R7, "0 bespoke split code")', () => {
  it('relocates the list/detail panes into a real ui-split + two ui-split-pane wrappers', () => {
    const el = new UIMasterDetailElement()
    el.append(pane('list', 'LIST'), pane('detail', 'DETAIL'))
    mount(el)

    expect(el.children).toHaveLength(1) // the panes moved out — one composed child remains
    const split = el.querySelector('ui-split')
    expect(split).not.toBeNull()
    const wraps = split!.querySelectorAll('ui-split-pane')
    expect(wraps).toHaveLength(2)
    expect(wraps[0].getAttribute('data-role')).toBe('list')
    expect(wraps[1].getAttribute('data-role')).toBe('detail')
    expect(wraps[0].querySelector('ui-master-detail-pane')?.textContent).toBe('LIST')
    // the detail wrap ALSO carries the back button ahead of the relocated content (LLD-C10)
    expect(wraps[1].querySelector('[data-part="back"]')).not.toBeNull()
    expect(wraps[1].querySelector('ui-master-detail-pane')?.textContent).toBe('DETAIL')
  })

  it('order in markup does not matter — panes are matched by `pane`, not DOM position', () => {
    const el = new UIMasterDetailElement()
    el.append(pane('detail', 'D'), pane('list', 'L')) // detail authored FIRST
    mount(el)
    const wraps = el.querySelectorAll('ui-split-pane')
    expect(wraps[0].getAttribute('data-role')).toBe('list')
    expect(wraps[0].textContent).toContain('L')
    expect(wraps[1].getAttribute('data-role')).toBe('detail')
    expect(wraps[1].textContent).toContain('D')
  })

  it('a missing pane (either or both) composes an EMPTY wrapper, never throws (degenerate case)', () => {
    const onlyList = new UIMasterDetailElement()
    onlyList.append(pane('list', 'L'))
    expect(() => mount(onlyList)).not.toThrow()
    const wraps1 = onlyList.querySelectorAll('ui-split-pane')
    expect(wraps1).toHaveLength(2)
    expect(wraps1[1].querySelector('ui-master-detail-pane')).toBeNull() // detail wrap has no pane, just the back button

    const neither = new UIMasterDetailElement()
    expect(() => mount(neither)).not.toThrow()
    expect(neither.querySelectorAll('ui-split-pane')).toHaveLength(2)
  })

  it('an unrelated child (not a ui-master-detail-pane) is left where it is — only pane children relocate', () => {
    const el = new UIMasterDetailElement()
    const stray = document.createElement('div')
    stray.textContent = 'stray'
    el.append(pane('list', 'L'), stray)
    mount(el)
    // the stray div was never a UIMasterDetailPaneElement, so #panes() never touched it — it stays a
    // direct child of `this`, alongside the composed ui-split.
    expect(el.contains(stray)).toBe(true)
    expect(stray.parentElement).toBe(el)
  })
})

describe('UIMasterDetailElement — selection → view + select/change (SPEC-R7 AC2)', () => {
  it('an initial `selected` (deep-link) drives data-view=detail at connect WITHOUT firing an event', () => {
    const el = document.createElement('ui-master-detail') as UIMasterDetailElement
    el.selected = 'item-2' // pre-upgrade property write (property-wins, ADR-0005)
    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.addEventListener('change', spy)
    mount(el)
    expect(el.getAttribute('data-view')).toBe('detail')
    expect(spy).not.toHaveBeenCalled() // initial state is not "an item chosen"
  })

  it('reassigning `selected` after connect fires ONE select + ONE change, each carrying the new key', async () => {
    const el = mount(new UIMasterDetailElement())
    const selectSpy = vi.fn()
    const changeSpy = vi.fn()
    el.addEventListener('select', selectSpy)
    el.addEventListener('change', changeSpy)

    el.selected = 'item-9'
    await el.updateComplete
    expect(el.getAttribute('data-view')).toBe('detail')
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(changeSpy).toHaveBeenCalledTimes(1)
    expect((selectSpy.mock.calls[0][0] as CustomEvent).detail).toBe('item-9')
    expect((changeSpy.mock.calls[0][0] as CustomEvent).detail).toBe('item-9')
  })

  it('clearing `selected` back to \'\' drives data-view back to list and fires again', async () => {
    const el = mount(new UIMasterDetailElement())
    el.selected = 'item-1'
    await el.updateComplete
    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.selected = ''
    await el.updateComplete
    expect(el.getAttribute('data-view')).toBe('list')
    expect(spy).toHaveBeenCalledTimes(1)
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toBe('')
  })
})

describe('UIMasterDetailElement — the "back" affordance is VIEW-ONLY (SPEC-R7 AC1)', () => {
  it('clicking back flips data-view to list WITHOUT touching `selected` or firing select/change', async () => {
    const el = mount(new UIMasterDetailElement())
    el.selected = 'item-3'
    await el.updateComplete
    expect(el.getAttribute('data-view')).toBe('detail')

    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.addEventListener('change', spy)
    const back = el.querySelector('[data-part="back"]') as HTMLButtonElement
    back.click()
    await el.updateComplete // the #view signal write's effect re-run is microtask-batched

    expect(el.getAttribute('data-view')).toBe('list')
    expect(el.selected).toBe('item-3') // untouched — going back never clears the selection
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('UIMasterDetailElement — residue-free disconnect', () => {
  it('disconnect disposes the selected→view/event effect', async () => {
    const el = mount(new UIMasterDetailElement())
    const spy = vi.fn()
    el.addEventListener('select', spy)
    el.remove()
    el.selected = 'after-disconnect' // a LEAKED effect's re-run is now queued; a disposed one has nothing left
    await whenFlushed()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('UIMasterDetailElement — composition survives a RECONNECT (component-reviewer MAJOR fix)', () => {
  // A relocation-induced reconnect (e.g. an ancestor ui-app-shell opting into `isolated`, ADR-0082's
  // `shadow.append(...this.children)`) fires disconnectedCallback then connectedCallback on this element
  // WITHOUT any of ITS OWN children changing — `connected()` re-running must NOT recompose (the reviewer's
  // reproduction: re-parenting a connected instance previously appended a SECOND, empty ui-split beside the
  // real one, since #panes() found nothing left to move on the second pass).
  it('re-parenting a connected instance leaves EXACTLY ONE ui-split and ONE back button — no duplicate composition', () => {
    const el = new UIMasterDetailElement()
    el.append(pane('list', 'L'), pane('detail', 'D'))
    mount(el)
    expect(el.querySelectorAll('ui-split')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="back"]')).toHaveLength(1)

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // a real re-parent: disconnectedCallback then connectedCallback, no children changed

    expect(el.querySelectorAll('ui-split'), 'a second, empty ui-split was appended on reconnect').toHaveLength(1)
    expect(el.querySelectorAll('[data-part="back"]')).toHaveLength(1)
    // anti-vacuous: the ORIGINAL content survived the round-trip (not replaced by a fresh, empty composition).
    expect(el.querySelector('[data-role="list"]')?.textContent).toContain('L')
    expect(el.querySelector('[data-role="detail"]')?.textContent).toContain('D')

    newParent.remove()
  })

  it('the back button still works after a reconnect (the listener is re-armed, not just the DOM structure preserved)', async () => {
    const el = new UIMasterDetailElement()
    el.append(pane('list', 'L'), pane('detail', 'D'))
    mount(el)
    el.selected = 'item-1'
    await el.updateComplete
    expect(el.getAttribute('data-view')).toBe('detail')

    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // reconnect — a fresh AbortController; the OLD back-button listener (if any) died with it

    const back = el.querySelector('[data-part="back"]') as HTMLButtonElement
    back.click()
    await el.updateComplete // the #view signal write's effect re-run is microtask-batched
    expect(el.getAttribute('data-view'), 'the back button is inert after a reconnect — its listener was not re-armed').toBe('list')
    expect(el.selected).toBe('item-1') // untouched

    newParent.remove()
  })
})

// ── descriptors — ADR-0004 (structural + contract↔props + contract↔source, per element) ────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/master-detail`
const masterDetailTs = readFileSync(`${DIR}/master-detail.ts`, 'utf8') as string
const masterDetailCss = readFileSync(`${DIR}/master-detail.css`, 'utf8') as string
const paneTs = readFileSync(`${DIR}/master-detail-pane.ts`, 'utf8') as string
const paneCss = readFileSync(`${DIR}/master-detail-pane.css`, 'utf8') as string

describe('master-detail.md descriptor (ui-master-detail)', () => {
  const md = readFileSync(`${DIR}/master-detail.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['selected']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-master-detail')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-master-detail\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIMasterDetailElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIMasterDetailElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(flipReflect, UIMasterDetailElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.selected.reflect' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: masterDetailTs, css: masterDetailCss })).toEqual([])
  })
})

describe('master-detail-pane.md descriptor (ui-master-detail-pane)', () => {
  const md = readFileSync(`${DIR}/master-detail-pane.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['pane']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-master-detail-pane')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-master-detail-pane\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIContainerElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIMasterDetailPaneElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIMasterDetailPaneElement.props)).toEqual([])
  })

  it('the enum fallback member (values[0]) FAILS if it disagrees with the live "list"-leads order (negative control)', () => {
    const badValues: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'pane' ? { ...a, values: ['detail', 'list'] } : a,
    )
    expect(compareDescriptorToProps(badValues, UIMasterDetailPaneElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.pane.values' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: paneTs, css: paneCss })).toEqual([])
  })
})
