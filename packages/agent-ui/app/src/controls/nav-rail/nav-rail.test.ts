import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UINavRailElement } from './nav-rail.ts'
import { UINavRailGroupElement } from './nav-rail-group.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'
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

// nav-rail.test.ts — jsdom probes for ui-nav-rail + ui-nav-rail-group + ui-nav-rail-item (ADR-0130; SPEC
// nav-rail-family.spec.md SPEC-R1..R8; LLD nav-rail-family.lld.md LLD-C8). jsdom cannot resolve CSS Grid/
// @container layout or the Popover API's real top-layer behaviour — the ACTUAL whole-shape geometry, the
// collapse="menu" narrow disclosure's real overlay, and collapse="icon-popover"'s real anchored-popover
// interaction are nav-rail.browser.test.ts's job (Chromium + WebKit). This file proves: prop→DOM mapping,
// `collapse` enum coercion + index-0 fallback, role derivation (all-href/all-bare/mixed/empty, incl.
// later-added children via the MutationObserver), selection-commit emitting select/change exactly once per
// genuine bare-item activation (never on a link click, never on a programmatic `selected` write), the
// activator swap on `href` toggling, the group's items-wrapper vs. icon-popover composition branch, the
// one-open-at-a-time coordination, and all three descriptors' structural + contract↔props + contract↔source
// trip-wires.

// ── Popover API stub (jsdom lacks it — mirrors menu.test.ts/popover.test.ts's own setup) ──────────────────
const popoverOpen = new WeakMap<HTMLElement, boolean>()
function fireToggle(el: HTMLElement, newState: 'open' | 'closed'): void {
  const ev = new Event('toggle')
  Object.defineProperty(ev, 'newState', { value: newState })
  el.dispatchEvent(ev)
}
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof proto.showPopover === 'function') return
  proto.showPopover = function (this: HTMLElement): void {
    if (popoverOpen.get(this)) return
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }
  proto.hidePopover = function (this: HTMLElement): void {
    if (!popoverOpen.get(this)) return
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

function stubRects(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}
function item(href: string, text: string, selected = false): UINavRailItemElement {
  const el = new UINavRailItemElement()
  el.href = href
  el.selected = selected
  el.textContent = text
  return el
}

describe('UINavRailElement — upgrade + defaults', () => {
  it('upgrades to the class; collapse defaults to "menu"', () => {
    const el = mount(document.createElement('ui-nav-rail') as UINavRailElement)
    expect(el).toBeInstanceOf(UINavRailElement)
    expect(el.collapse).toBe('menu')
  })

  it('static props is exactly [collapse]', () => {
    expect(Object.keys(UINavRailElement.props)).toEqual(['collapse'])
  })

  it('an out-of-set collapse attribute coerces to the index-0 member ("menu"), never throws (SPEC-R1 AC2)', () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'bogus')
    expect(() => mount(el)).not.toThrow()
    expect((el as UINavRailElement).collapse).toBe('menu')
  })

  it('no children ⇒ an empty rail, never throws (SPEC-R2 AC1)', () => {
    expect(() => mount(new UINavRailElement())).not.toThrow()
  })
})

describe('UINavRailElement — role derivation (SPEC-R3, ADR-0130 cl.4)', () => {
  it('all items link-shaped (href set) ⇒ role=navigation', async () => {
    const el = new UINavRailElement()
    el.append(item('/a', 'A'), item('/b', 'B'))
    mount(el)
    await whenFlushed()
    // role rides internals, never a host attribute (the FACE law) — jsdom has no ElementInternals ARIA
    // reflection to read it back from outside; the REAL AX-tree read (role=navigation) is the browser
    // suite's job. Here we prove only the FACE invariant: no host role/aria-* attribute ever appears.
    expect(el.hasAttribute('role')).toBe(false)
  })

  it('all items bare (href empty) ⇒ role=tablist (read via internals — no host role attribute)', async () => {
    const el = new UINavRailElement()
    el.append(item('', 'One'), item('', 'Two'))
    mount(el)
    await whenFlushed()
    expect(el.hasAttribute('role')).toBe(false) // FACE law — never a host attribute
  })

  it('an empty rail (no items) defaults to navigation, never throws (SPEC §7 non-goal)', async () => {
    const el = mount(new UINavRailElement())
    await whenFlushed()
    expect(el.hasAttribute('role')).toBe(false)
  })

  it('a LATER-added item re-derives the role (SPEC-R2 AC2, the MutationObserver)', async () => {
    const el = new UINavRailElement()
    mount(el)
    await whenFlushed()
    el.append(item('', 'New'))
    await new Promise((r) => queueMicrotask(r as () => void))
    // No throw + the item is present — the observer ran without error.
    expect(el.querySelectorAll('ui-nav-rail-item')).toHaveLength(1)
  })
})

describe('UINavRailElement — selection commit (SPEC-R2/R3)', () => {
  it('activating a BARE item sets selected, clears siblings, and emits select+change ONCE with its value', async () => {
    const el = new UINavRailElement()
    const a = item('', 'Alpha')
    const b = item('', 'Beta')
    a.id = 'alpha'
    el.append(a, b)
    mount(el)
    await whenFlushed()

    const selectSpy = vi.fn()
    const changeSpy = vi.fn()
    el.addEventListener('select', selectSpy)
    el.addEventListener('change', changeSpy)

    const activator = a.querySelector('[data-part="activator"]') as HTMLButtonElement
    activator.click()
    await whenFlushed()

    expect(a.selected).toBe(true)
    expect(b.selected).toBe(false)
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(changeSpy).toHaveBeenCalledTimes(1)
    expect((selectSpy.mock.calls[0][0] as CustomEvent).detail).toBe('alpha')
  })

  it('clicking a LINK-shaped item is never intercepted — no select/change, native navigation left alone', async () => {
    const el = new UINavRailElement()
    const a = item('/somewhere', 'Somewhere')
    el.append(a)
    mount(el)
    await whenFlushed()

    const spy = vi.fn()
    el.addEventListener('select', spy)
    const activator = a.querySelector('[data-part="activator"]') as HTMLAnchorElement
    activator.click()
    await whenFlushed()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('UINavRailItemElement — shape + ARIA (SPEC-R3)', () => {
  it('href empty ⇒ a real <button> activator, role=tab, aria-selected tracking `selected`', async () => {
    const el = mount(item('', 'Overview', true))
    await whenFlushed()
    const activator = el.querySelector('[data-part="activator"]') as HTMLButtonElement
    expect(activator.tagName).toBe('BUTTON')
    expect(activator.type).toBe('button')
    expect(activator.getAttribute('role')).toBe('tab')
    expect(activator.getAttribute('aria-selected')).toBe('true')

    el.selected = false
    await whenFlushed()
    expect(activator.getAttribute('aria-selected')).toBe('false')
  })

  it('href non-empty ⇒ a real <a href> activator, aria-current tracking `selected` (never aria-selected)', async () => {
    const el = mount(item('/x', 'X', true))
    await whenFlushed()
    const activator = el.querySelector('[data-part="activator"]') as HTMLAnchorElement
    expect(activator.tagName).toBe('A')
    expect(activator.getAttribute('href')).toBe('/x')
    expect(activator.getAttribute('aria-current')).toBe('page')
    expect(activator.hasAttribute('aria-selected')).toBe(false)

    el.selected = false
    await whenFlushed()
    expect(activator.hasAttribute('aria-current')).toBe(false)
  })

  it('toggling href post-connect SWAPS the activator shape (not a one-shot, LLD-C3)', async () => {
    const el = mount(item('', 'Toggle'))
    await whenFlushed()
    expect((el.querySelector('[data-part="activator"]') as HTMLElement).tagName).toBe('BUTTON')

    el.href = '/now-a-link'
    await whenFlushed()
    const activators = el.querySelectorAll('[data-part="activator"]')
    expect(activators).toHaveLength(1) // never left coexisting
    expect((activators[0] as HTMLElement).tagName).toBe('A')
    expect(el.textContent).toContain('Toggle') // content survived the swap

    el.href = ''
    await whenFlushed()
    expect((el.querySelector('[data-part="activator"]') as HTMLElement).tagName).toBe('BUTTON')
  })

  it('a leading icon + trailing tag slot both land inside the activator, wrapping the label separately', async () => {
    const el = new UINavRailItemElement()
    el.href = '/y'
    const icon = document.createElement('span')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    const tag = document.createElement('span')
    tag.setAttribute('slot', 'trailing')
    tag.setAttribute('data-role', 'tag')
    tag.textContent = 'new'
    el.append(icon, document.createTextNode('Label'), tag)
    mount(el)
    await whenFlushed()

    const activator = el.querySelector('[data-part="activator"]') as HTMLElement
    expect(activator.querySelector('[slot="leading"]')).not.toBeNull()
    expect(activator.querySelector('[slot="trailing"][data-role="tag"]')?.textContent).toBe('new')
    expect(activator.querySelector('[data-part="label"]')?.textContent).toBe('Label')
  })

  it('static props is exactly [href, selected]', () => {
    expect(Object.keys(UINavRailItemElement.props)).toEqual(['href', 'selected'])
  })
})

describe('UINavRailGroupElement — context label + composition (SPEC-R2/R6/R8)', () => {
  it('a non-empty label renders a context-label heading, reactively', async () => {
    const el = mount(new UINavRailGroupElement())
    el.label = 'Components'
    await whenFlushed()
    expect(el.querySelector('[data-part="context-label"]')?.textContent).toBe('Components')

    el.label = ''
    await whenFlushed()
    expect(el.querySelector('[data-part="context-label"]')).toBeNull()
  })

  it('menu/drill-in mode (default, no ancestor rail) wraps items in a plain [data-part=items]', async () => {
    const group = new UINavRailGroupElement()
    group.append(item('/a', 'A'), item('/b', 'B'))
    mount(group)
    await whenFlushed()
    const wrapper = group.querySelector('[data-part="items"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.querySelectorAll('ui-nav-rail-item')).toHaveLength(2)
    expect(group.querySelector('ui-menu')).toBeNull()
  })

  it('never throws with 0 items', () => {
    expect(() => mount(new UINavRailGroupElement())).not.toThrow()
  })

  it('collapse="icon-popover" with 2+ items composes ONE internal ui-menu, relocating each item as fresh content', async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    group.label = 'Views'
    const a = item('', 'One')
    const b = item('/two', 'Two')
    group.append(a, b)
    rail.append(group)
    mount(rail)
    stubRects(rail)
    await whenFlushed()

    const menu = group.querySelector('ui-menu')
    expect(menu).not.toBeNull()
    expect(group.querySelector('[data-part="items"]')).toBeNull() // NOT the plain-wrapper branch
    expect(group.querySelector('ui-nav-rail-item')).toBeNull() // originals removed — content re-expressed
    const menuItems = menu!.querySelectorAll('[role="menuitem"]')
    expect(menuItems).toHaveLength(2)
    expect((menuItems[1] as HTMLAnchorElement).tagName).toBe('A')
    expect((menuItems[1] as HTMLAnchorElement).getAttribute('href')).toBe('/two')
  })

  it('a DEGENERATE 1-item icon-popover group renders a plain wrapper, never a popover (SPEC §7 non-goal avoided)', async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    group.append(item('/solo', 'Solo'))
    rail.append(group)
    mount(rail)
    await whenFlushed()
    expect(group.querySelector('ui-menu')).toBeNull()
    expect(group.querySelector('[data-part="items"]')).not.toBeNull()
  })

  it("a bare synthetic menu item's commit forwards select+change on the RAIL (icon-popover coordination)", async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    const a = item('', 'Alpha')
    a.id = 'alpha'
    group.append(a, item('', 'Beta'))
    rail.append(group)
    mount(rail)
    stubRects(rail)
    await whenFlushed()

    const spy = vi.fn()
    rail.addEventListener('select', spy)
    const menu = group.querySelector('ui-menu') as HTMLElement
    const firstMenuItem = menu.querySelector('[role="menuitem"]') as HTMLButtonElement
    firstMenuItem.click()
    await whenFlushed()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // component-reviewer Finding 2 — a bare cloneNode of the group's leading icon left the ORIGINAL as a
  // second, unstyled, visible orphan; the fix MOVES it instead. Anti-regression: exactly ONE icon exists
  // anywhere in the group after composition (inside the trigger), never a leftover direct child.
  it('a leading icon on the group is MOVED (not cloned) into the trigger — no visible orphan (Finding 2)', async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    group.label = 'Views'
    const icon = document.createElement('span')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('data-testid', 'group-icon')
    group.append(icon, item('', 'One'), item('', 'Two'))
    rail.append(group)
    mount(rail)
    stubRects(rail)
    await whenFlushed()

    const allIcons = group.querySelectorAll('[data-testid="group-icon"]')
    expect(allIcons, 'the icon rendered more than once (an orphan survived)').toHaveLength(1)
    const menu = group.querySelector('ui-menu') as HTMLElement
    const trigger = menu.querySelector('[data-part="trigger"]') as HTMLElement
    expect(trigger.contains(allIcons[0]), 'the surviving icon is not inside the trigger').toBe(true)
    // No direct child of the group itself is the icon (the orphan shape Finding 2 caught).
    expect([...group.children].includes(icon as unknown as Element)).toBe(false)
  })

  // component-reviewer Finding 3 — the header comment + nav-rail-group.md both promise `selected` and any
  // leading/trailing adornment are "re-expressed"; the code silently dropped both. Assert both now survive.
  it("carries a source item's `selected` state + leading/trailing adornments into the synthetic child (Finding 3)", async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    const a = item('', 'Alpha', true) // selected
    const leading = document.createElement('span')
    leading.setAttribute('slot', 'leading')
    leading.setAttribute('data-role', 'icon')
    leading.textContent = 'ICN'
    const trailing = document.createElement('span')
    trailing.setAttribute('slot', 'trailing')
    trailing.setAttribute('data-role', 'tag')
    trailing.textContent = 'beta'
    a.append(leading, trailing)
    const b = item('', 'Beta')
    group.append(a, b)
    rail.append(group)
    mount(rail)
    stubRects(rail)
    await whenFlushed()

    const menu = group.querySelector('ui-menu') as HTMLElement
    const menuItems = menu.querySelectorAll('[role="menuitem"]')
    const first = menuItems[0] as HTMLElement
    expect(first.hasAttribute('data-selected'), 'the selected state was dropped').toBe(true)
    expect(menuItems[1].hasAttribute('data-selected'), 'the non-selected sibling wrongly carries data-selected').toBe(false)
    expect(first.querySelector('[data-role="icon"]'), 'the leading icon was dropped').not.toBeNull()
    expect(first.querySelector('[data-role="tag"]')?.textContent, 'the trailing tag was dropped').toBe('beta')
    expect(first.textContent, 'the label text was lost alongside the adornments').toContain('Alpha')
  })

  it('static props is exactly [label]', () => {
    expect(Object.keys(UINavRailGroupElement.props)).toEqual(['label'])
  })
})

describe('UINavRailElement — collapse="menu" narrow disclosure structure (LLD-C4; geometry itself is the browser suite\'s job)', () => {
  it('builds a <details data-part=disclosure> wrapping a <summary data-part=trigger> + <div data-part=list>', async () => {
    const el = new UINavRailElement()
    el.append(item('/a', 'Current', true), item('/b', 'B'))
    mount(el)
    await whenFlushed()
    const disclosure = el.querySelector('[data-part="disclosure"]')
    expect(disclosure?.tagName).toBe('DETAILS')
    expect(disclosure?.querySelector('[data-part="trigger"]')?.tagName).toBe('SUMMARY')
    expect(disclosure?.querySelector('[data-part="list"]')).not.toBeNull()
    expect(disclosure?.querySelector('[data-part="list"]')?.textContent).toContain('Current')
  })

  it('the trigger names the currently-selected item, reactively', async () => {
    const el = new UINavRailElement()
    const a = item('', 'First', true)
    const b = item('', 'Second')
    el.append(a, b)
    mount(el)
    await whenFlushed()
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    expect(trigger.textContent).toBe('First')

    a.selected = false
    b.selected = true
    await whenFlushed()
    expect(trigger.textContent).toBe('Second')
  })

  it('Escape closes the open disclosure and returns focus to the trigger (SPEC-R5 AC2)', async () => {
    const el = mount(new UINavRailElement())
    await whenFlushed()
    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    disclosure.open = true
    disclosure.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(disclosure.open).toBe(false)
  })

  it('an outside click closes the open disclosure; a click INSIDE it does not', async () => {
    const el = mount(new UINavRailElement())
    await whenFlushed()
    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    disclosure.open = true
    document.body.click()
    expect(disclosure.open).toBe(false)

    disclosure.open = true
    disclosure.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(disclosure.open).toBe(true)
  })

  it('collapse="drill-in" builds NO disclosure at all', async () => {
    const el = new UINavRailElement()
    el.collapse = 'drill-in'
    mount(el)
    await whenFlushed()
    expect(el.querySelector('[data-part="disclosure"]')).toBeNull()
  })
})

// component-reviewer Finding 1 (BLOCKING) — a build-once `#`-field guard ALSO gated listener/effect
// wiring, so a real disconnect+reconnect (e.g. an ancestor `ui-app-shell` opting into `isolated`,
// ADR-0082's `shadow.append(...this.children)`) permanently killed live behavior: `this.listen`/
// `this.effect` ride the CURRENT connection's AbortController/scope (element.ts) and die at disconnect,
// so re-arming must happen on EVERY `connected()`, never be gated behind a persistent field alongside the
// one-time DOM construction. Both instances (nav-rail.ts's disclosure dismissal, nav-rail-group.ts's menu-
// select forwarding) are proven here via a REAL re-parent (a genuine disconnect+reconnect, the master-
// detail.test.ts/settings.test.ts "reconnect" precedent), not a simulated event.
describe('component-reviewer Finding 1 — listener/effect wiring survives a REAL reconnect', () => {
  function reconnect(el: Element): void {
    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // disconnectedCallback then connectedCallback — a fresh AbortController/scope
    mounted.push(newParent)
  }

  it('collapse="menu": Escape + outside-click dismissal still fire after a reconnect', async () => {
    const el = mount(new UINavRailElement())
    el.append(item('/a', 'Alpha'), item('/b', 'Beta'))
    await whenFlushed()

    reconnect(el)
    await whenFlushed()

    const disclosure = el.querySelector('[data-part="disclosure"]') as HTMLDetailsElement
    // Only ONE disclosure survives the reconnect (idempotent DOM construction, not a duplicate).
    expect(el.querySelectorAll('[data-part="disclosure"]')).toHaveLength(1)

    disclosure.open = true
    disclosure.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(disclosure.open, 'Escape was dead after reconnect — the listener was not re-armed').toBe(false)

    disclosure.open = true
    document.body.click()
    expect(disclosure.open, 'outside-click was dead after reconnect — the listener was not re-armed').toBe(false)
  })

  it('collapse="menu": the trigger label-sync effect still tracks `selected` after a reconnect', async () => {
    const el = mount(new UINavRailElement())
    const a = item('', 'First', true)
    const b = item('', 'Second')
    el.append(a, b)
    await whenFlushed()

    reconnect(el)
    await whenFlushed()

    const trigger = el.querySelector('[data-part="trigger"]') as HTMLElement
    expect(trigger.textContent).toBe('First')
    a.selected = false
    b.selected = true
    await whenFlushed()
    expect(trigger.textContent, 'the label-sync effect was dead after reconnect').toBe('Second')
  })

  it('collapse="icon-popover": a synthetic menu item commit still forwards select+change after a reconnect', async () => {
    const rail = new UINavRailElement()
    rail.collapse = 'icon-popover'
    const group = new UINavRailGroupElement()
    const a = item('', 'Alpha')
    a.id = 'alpha'
    group.append(a, item('', 'Beta'))
    rail.append(group)
    mount(rail)
    stubRects(rail)
    await whenFlushed()

    // Reconnect the WHOLE RAIL (never just the group in isolation) — the realistic ADR-0082 shape: an
    // ancestor `ui-app-shell` relocating `isolated` moves an ENTIRE subtree together
    // (`shadow.append(...this.children)`), preserving every descendant's nesting. Reconnecting the group
    // alone would sever `group.closest('ui-nav-rail')` outright (a test-setup artifact, not the real
    // hazard Finding 1 describes) — moving `rail` keeps the group correctly nested inside it throughout.
    reconnect(rail)
    await whenFlushed()

    // Composition did not duplicate the menu.
    expect(group.querySelectorAll('ui-menu')).toHaveLength(1)

    const spy = vi.fn()
    rail.addEventListener('select', spy)
    const menu = group.querySelector('ui-menu') as HTMLElement
    const firstMenuItem = menu.querySelector('[role="menuitem"]') as HTMLButtonElement
    firstMenuItem.click()
    await whenFlushed()
    expect(spy, 'select-forwarding was dead after the group reconnected').toHaveBeenCalledTimes(1)
  })
})

// ── descriptors — ADR-0004 (structural + contract↔props + contract↔source, per element) ──────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/nav-rail`
const railTs = readFileSync(`${DIR}/nav-rail.ts`, 'utf8') as string
const groupTs = readFileSync(`${DIR}/nav-rail-group.ts`, 'utf8') as string
const itemTs = readFileSync(`${DIR}/nav-rail-item.ts`, 'utf8') as string
const railCss = readFileSync(`${DIR}/nav-rail.css`, 'utf8') as string

const REQUIRED_FIELDS = [
  'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
  'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
]

describe('nav-rail.md descriptor (ui-nav-rail)', () => {
  const md = readFileSync(`${DIR}/nav-rail.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-nav-rail')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    for (const field of REQUIRED_FIELDS) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-nav-rail\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UINavRailElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(['collapse'])
    expect(compareDescriptorToProps(parsed.attributes, UINavRailElement.props)).toEqual([])
  })

  it('a drifted enum-values order FAILS (negative control — the values[0] fallback contract)', () => {
    const bad: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'collapse' ? { ...a, values: ['icon-popover', 'menu', 'drill-in'] } : a,
    )
    expect(compareDescriptorToProps(bad, UINavRailElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_VALUES', path: 'attributes.collapse.values' }),
    )
  })

  // nav-rail.css is the ONE shared family stylesheet (LLD-C6) — its `[slot=…]` rules belong to
  // `ui-nav-rail-item`'s own anatomy, not the rail's. Feeding the whole shared file here would
  // false-positive "undocumented slot" against a descriptor that renders none of its own (the item's own
  // check, below, exercises the full file where the slots genuinely are this element's). No custom state
  // is used anywhere in the family, so an empty CSS string loses nothing on that half of the check.
  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: railTs, css: '' })).toEqual([])
  })
})

describe('nav-rail-group.md descriptor (ui-nav-rail-group)', () => {
  const md = readFileSync(`${DIR}/nav-rail-group.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-nav-rail-group')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    for (const field of REQUIRED_FIELDS) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-nav-rail-group\s*$/m.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UINavRailGroupElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(['label'])
    expect(compareDescriptorToProps(parsed.attributes, UINavRailGroupElement.props)).toEqual([])
  })

  // Same shared-stylesheet scoping note as nav-rail.md's own check, above: the group's OWN `leading` slot
  // is read via `querySelector` (nav-rail-group.ts), never CSS-styled by tag name — the `[slot=…]` CSS
  // rules in the shared file belong to `ui-nav-rail-item`'s anatomy.
  it('customStates/slots agree with the source', () => {
    expect(compareDescriptorToSource(parsed, { ts: groupTs, css: '' })).toEqual([])
  })
})

describe('nav-rail-item.md descriptor (ui-nav-rail-item)', () => {
  const md = readFileSync(`${DIR}/nav-rail-item.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-nav-rail-item')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    for (const field of REQUIRED_FIELDS) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-nav-rail-item\s*$/m.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UINavRailItemElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(['href', 'selected'])
    expect(compareDescriptorToProps(parsed.attributes, UINavRailItemElement.props)).toEqual([])
  })

  it('a drifted reflect FAILS (negative control)', () => {
    const bad: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, reflect: false }))
    expect(compareDescriptorToProps(bad, UINavRailItemElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT' }),
    )
  })

  it('customStates/slots agree with the source (the [slot=leading]/[slot=trailing] CSS selectors are declared)', () => {
    expect(compareDescriptorToSource(parsed, { ts: itemTs, css: railCss })).toEqual([])
  })
})
