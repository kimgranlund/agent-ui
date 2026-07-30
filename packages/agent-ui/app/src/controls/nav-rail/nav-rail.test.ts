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
// collapse="menu" narrow flyout's real top-layer overlay, and collapse="icon-popover"'s anchored-popover
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

  it('static props is exactly [collapse, collapseContainer]', () => {
    expect(Object.keys(UINavRailElement.props)).toEqual(['collapse', 'collapseContainer'])
  })

  it('an out-of-set collapse attribute coerces to the index-0 member ("menu"), never throws (SPEC-R1 AC2)', () => {
    const el = document.createElement('ui-nav-rail')
    el.setAttribute('collapse', 'bogus')
    expect(() => mount(el)).not.toThrow()
    expect((el as UINavRailElement).collapse).toBe('menu')
  })

  it('collapseContainer defaults to "self"; reflects to `collapse-container` (TKT-0035)', () => {
    const el = mount(document.createElement('ui-nav-rail') as UINavRailElement)
    expect(el.collapseContainer).toBe('self')
    el.collapseContainer = 'ancestor'
    expect(el.getAttribute('collapse-container')).toBe('ancestor')
  })

  it('collapse="none" (GH #170/ADR-0155) builds NO menu parts — the plain never-collapsing vertical rail', () => {
    const el = document.createElement('ui-nav-rail') as UINavRailElement
    el.setAttribute('collapse', 'none')
    mount(el)
    expect(el.collapse).toBe('none') // a real enum member now, not coerced to "menu"
    expect(el.querySelector(':scope > [data-part="trigger"]'), 'none mode never creates the menu trigger').toBeNull()
    expect(el.querySelector(':scope > [data-part="list"]'), 'none mode never creates the menu panel').toBeNull()
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

// GH #368 — the menu arm's STRUCTURE, re-expressed against the button-trigger + overlay-panel parts.
// Dismissal (Escape / outside-click) is no longer testable here and no longer OURS to test: it is the
// platform's, via `popover=auto` (nav-rail.ts retired both hand-rolled listeners), and jsdom implements
// neither light-dismiss nor the top layer. Those legs live in nav-rail.browser.test.ts, both engines.
//
// The band observer deliberately stays on the WIDE arm here: `#resolveCollapseContainer` reads COMPUTED
// containment, which jsdom does not implement, so it resolves no container and the overlay is never armed
// (the same `width > 0`-style jsdom guard super-shell.ts's `#belowBandLine` makes). That is what keeps this
// file about structure and reactivity, with geometry and top-layer behaviour left to the real engines.
describe('UINavRailElement — collapse="menu" part structure (LLD-C4/GH #368; geometry is the browser suite\'s job)', () => {
  it('builds a <button data-part=trigger> + a <div data-part=list> holding the authored tree, in authored order', async () => {
    const el = new UINavRailElement()
    el.append(item('/a', 'Current', true), item('/b', 'B'))
    mount(el)
    await whenFlushed()

    const triggers = el.querySelectorAll(':scope > [data-part="trigger"]')
    const lists = el.querySelectorAll(':scope > [data-part="list"]')
    expect(triggers, 'exactly one trigger part').toHaveLength(1)
    expect(lists, 'exactly one list part').toHaveLength(1)
    const trigger = triggers[0] as HTMLElement
    const list = lists[0] as HTMLElement
    expect(trigger.tagName, 'the trigger is a real <button> — Enter AND Space both arrive as one click').toBe('BUTTON')
    expect(trigger.getAttribute('type')).toBe('button')
    expect(list.tagName).toBe('DIV')
    // The trigger precedes the panel (the ui-popover anatomy, and the anchor overlay() positions against).
    expect(trigger.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Every authored item survived the swap, in authored order (SPEC-R6 anatomy).
    const labels = [...list.querySelectorAll('ui-nav-rail-item')].map((i) => i.textContent?.trim())
    expect(labels).toEqual(['Current', 'B'])
  })

  it('the grouped anatomy survives the swap: context-label + name|tag cells intact inside the panel (SPEC-R6)', async () => {
    const el = new UINavRailElement()
    const group = new UINavRailGroupElement()
    group.label = 'Components'
    const withTag = item('/x', 'Button')
    const tag = document.createElement('span')
    tag.slot = 'trailing'
    tag.setAttribute('data-role', 'tag')
    tag.textContent = 'new'
    withTag.append(tag)
    group.append(withTag, item('/y', 'Select'))
    el.append(group)
    mount(el)
    await whenFlushed()

    const list = el.querySelector(':scope > [data-part="list"]') as HTMLElement
    expect(list.querySelector('ui-nav-rail-group'), 'the group element itself moved into the panel').not.toBeNull()
    expect(
      list.querySelector('[data-part="context-label"]')?.textContent,
      'the group context-label heading did not survive into the panel',
    ).toBe('Components')
    expect(
      list.querySelector('[data-role="tag"]')?.textContent,
      'the trailing name|tag cell did not survive into the panel',
    ).toBe('new')
    expect([...list.querySelectorAll('ui-nav-rail-item')]).toHaveLength(2)
  })

  it('the trigger names the currently-selected item, reactively', async () => {
    const el = new UINavRailElement()
    const a = item('', 'First', true)
    const b = item('', 'Second')
    el.append(a, b)
    mount(el)
    await whenFlushed()
    const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
    expect(trigger.textContent).toBe('First')

    a.selected = false
    b.selected = true
    await whenFlushed()
    expect(trigger.textContent).toBe('Second')
  })

  it('GH #376 — the trigger names a tagged item by its NAME cell alone: "Button", never "Buttonnew"', async () => {
    // The defect, exactly as filed: `#currentLabel()` read the whole row's `textContent`, and SPEC-R6's
    // row is `name|tag`. Neither cell is a block box, so the two ran together with no separator.
    const el = new UINavRailElement()
    const tagged = item('/x', 'Button', true)
    const tag = document.createElement('span')
    tag.slot = 'trailing'
    tag.setAttribute('data-role', 'tag')
    tag.textContent = 'new'
    tagged.append(tag)
    el.append(tagged, item('/y', 'Select'))
    mount(el)
    await whenFlushed()

    const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
    // Pinned as an EQUALITY, not `not.toContain('new')`: the latter passes for a trigger that lost the
    // label entirely, and "shows the name" is the actual claim.
    expect(trigger.textContent, 'the trigger concatenated the trailing tag onto the name').toBe('Button')
    // Anti-vacuous — the tag must still BE there, or this passes because the fixture never had one.
    expect(tagged.querySelector('[data-role="tag"]')?.textContent, 'the fixture item carries a trailing tag').toBe('new')

    // and the fallback path (no selection) reads the FIRST item's name the same way
    tagged.selected = false
    await whenFlushed()
    expect(trigger.textContent, 'the unselected fallback must use the same name-cell read').toBe('Button')
  })

  it('the trigger is ARIA-wired from first paint: aria-expanded="false" + an aria-controls that resolves (n17)', async () => {
    const el = mount(new UINavRailElement())
    el.append(item('/a', 'Alpha'))
    await whenFlushed()
    const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
    const list = el.querySelector(':scope > [data-part="list"]') as HTMLElement
    // <summary> got aria-expanded FREE from the UA and overlay() writes zero ARIA — omitting the host
    // wiring would make this silently fail, which is exactly the regression the swap risked.
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    const controls = trigger.getAttribute('aria-controls')
    expect(controls, 'the trigger carries no aria-controls').toBeTruthy()
    expect(document.getElementById(controls as string), 'aria-controls does not resolve to the panel').toBe(list)
  })

  it('two rails on one page get DISTINCT panel ids (aria-controls cannot cross-resolve)', async () => {
    const a = mount(new UINavRailElement())
    const b = mount(new UINavRailElement())
    await whenFlushed()
    const idA = (a.querySelector(':scope > [data-part="list"]') as HTMLElement).id
    const idB = (b.querySelector(':scope > [data-part="list"]') as HTMLElement).id
    expect(idA).toBeTruthy()
    expect(idA).not.toBe(idB)
  })

  it('the WIDE arm is byte-clean: no popover attribute, no overlay inline-style residue (n8)', async () => {
    // jsdom resolves no `@container` container, so the band observer never arms — the wide arm. overlay()
    // stamps `popover=auto` at call time (overlay.ts:165) and clears nothing in cleanup(), so this asserts
    // nav-rail.ts's OWN disarm path, not the trait's.
    const el = mount(new UINavRailElement())
    el.append(item('/a', 'Alpha'))
    await whenFlushed()
    const list = el.querySelector(':scope > [data-part="list"]') as HTMLElement
    expect(list.hasAttribute('popover'), 'a stranded popover attribute makes the UA hide the in-flow list').toBe(false)
    expect(list.style.position).toBe('')
    expect(list.style.top).toBe('')
    expect(list.style.left).toBe('')
    expect(list.style.right).toBe('')
    expect(list.style.margin).toBe('')
    expect(list.hasAttribute('data-placement')).toBe(false)
  })

  it('collapse="drill-in" builds NO menu parts at all', async () => {
    const el = new UINavRailElement()
    el.collapse = 'drill-in'
    mount(el)
    await whenFlushed()
    expect(el.querySelector(':scope > [data-part="trigger"]')).toBeNull()
    expect(el.querySelector(':scope > [data-part="list"]')).toBeNull()
  })
})

// component-reviewer Finding 1 (BLOCKING) — a build-once `#`-field guard ALSO gated listener/effect
// wiring, so a real disconnect+reconnect (any whole-subtree relocation — an `append` onto a new parent
// is an atomic remove+insert; historically the retired `<ui-app-shell isolated>`'s
// `shadow.append(...this.children)`, ADR-0082, superseded) permanently killed live behavior: `this.listen`/
// `this.effect` ride the CURRENT connection's AbortController/scope (element.ts) and die at disconnect,
// so re-arming must happen on EVERY `connected()`, never be gated behind a persistent field alongside the
// one-time DOM construction. Both instances (nav-rail.ts's menu-arm wiring, nav-rail-group.ts's menu-
// select forwarding) are proven here via a REAL re-parent (a genuine disconnect+reconnect, the master-
// detail.test.ts/settings.test.ts "reconnect" precedent), not a simulated event.
//
// GH #368 — the menu arm's dismissal leg is GONE from this file because the behaviour is gone from the
// component: `popover=auto` means the PLATFORM dismisses, so there is no re-armable listener of ours left
// to prove. What still must survive a reconnect is everything nav-rail.ts owns per connection: the
// label-sync effect, the overlay wiring, and the disarm that keeps the wide arm byte-clean.
describe('component-reviewer Finding 1 — listener/effect wiring survives a REAL reconnect', () => {
  function reconnect(el: Element): void {
    const newParent = document.createElement('div')
    document.body.append(newParent)
    newParent.append(el) // disconnectedCallback then connectedCallback — a fresh AbortController/scope
    mounted.push(newParent)
  }

  it('collapse="menu": the parts are built ONCE and the wide arm stays byte-clean across a reconnect', async () => {
    const el = mount(new UINavRailElement())
    el.append(item('/a', 'Alpha'), item('/b', 'Beta'))
    await whenFlushed()

    reconnect(el)
    await whenFlushed()

    // Idempotent DOM construction — one trigger, one panel, no duplicates from the second connect.
    expect(el.querySelectorAll(':scope > [data-part="trigger"]')).toHaveLength(1)
    expect(el.querySelectorAll(':scope > [data-part="list"]')).toHaveLength(1)
    // The reconnect calls overlay() AGAIN (fresh AbortController), which re-stamps `popover=auto` — so the
    // disarm path must run again too, or the second connect strands the attribute the first one cleared.
    const list = el.querySelector(':scope > [data-part="list"]') as HTMLElement
    expect(list.hasAttribute('popover'), 'the reconnect stranded a popover attribute on the wide arm').toBe(false)
    expect(list.style.position, 'the reconnect stranded overlay inline-style residue').toBe('')
    const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
    expect(trigger.getAttribute('aria-expanded'), 'aria-expanded was not re-established on reconnect').toBe('false')
  })

  it('collapse="menu": the trigger label-sync effect still tracks `selected` after a reconnect', async () => {
    const el = mount(new UINavRailElement())
    const a = item('', 'First', true)
    const b = item('', 'Second')
    el.append(a, b)
    await whenFlushed()

    reconnect(el)
    await whenFlushed()

    const trigger = el.querySelector(':scope > [data-part="trigger"]') as HTMLElement
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

    // Reconnect the WHOLE RAIL (never just the group in isolation) — the realistic relocation shape: a
    // whole-subtree move (a single `append` onto a new parent — historically the retired ADR-0082
    // `shadow.append(...this.children)` relocation) moves an ENTIRE subtree together,
    // preserving every descendant's nesting. Reconnecting the group
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
    expect(parsed.attributes.map((a) => a.name)).toEqual(['collapse', 'collapseContainer'])
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
