import { describe, it, expect, afterEach } from 'vitest'
import { UIBreadcrumbElement } from './breadcrumb.ts'

// breadcrumb.test.ts — jsdom behaviour probes for `ui-breadcrumb` S1 core anatomy (GH #1515, the frozen
// design intake `.claude/docs/spec/breadcrumb.intake.md` §4/§7). jsdom is blind to painted geometry —
// breadcrumb.browser.test.ts covers cross-engine truth (whole-shape, forced-colors survival). This file
// covers: prop typing/defaults, the crumb/separator/furniture partition, separator injection (slotted +
// default), SNAPSHOT (never-live) clone semantics, clone hygiene (id stripping), multiple-template
// first-wins, current-page auto-stamping + defer-if-already-marked + re-stamp-on-change, and ARIA via
// internals only (never a host attribute).

/** Let the MutationObserver callback (a microtask) run — the disclosure.test.ts idiom. */
const settle = (): Promise<void> => new Promise<void>((r) => queueMicrotask(r))

class ProbeBreadcrumb extends UIBreadcrumbElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-breadcrumb-probe', ProbeBreadcrumb)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UIBreadcrumbElement — upgrade + typed props', () => {
  it('upgrades to the class; label defaults empty, inline defaults false', () => {
    const el = document.createElement('ui-breadcrumb') as UIBreadcrumbElement
    expect(el).toBeInstanceOf(UIBreadcrumbElement)
    expect(el.label).toBe('')
    expect(el.inline).toBe(false)
  })

  it('self-defines as ui-breadcrumb, guarded against double-define', () => {
    expect(customElements.get('ui-breadcrumb')).toBe(UIBreadcrumbElement)
    expect(() => {
      if (!customElements.get('ui-breadcrumb')) customElements.define('ui-breadcrumb', UIBreadcrumbElement)
    }).not.toThrow()
  })
})

describe('UIBreadcrumbElement — ARIA via internals only (never a host attribute)', () => {
  it('role=navigation lives on internals; the host carries no role/aria-label attribute', () => {
    const el = mount(new ProbeBreadcrumb()) as ProbeBreadcrumb
    expect(el.probeInternals.role).toBe('navigation')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it("an empty label falls back to the literal 'Breadcrumb' (never null — the deliberate pagination deviation)", async () => {
    const el = mount(new ProbeBreadcrumb()) as ProbeBreadcrumb
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Breadcrumb')
  })

  it('a non-empty label overrides the default; clearing it restores the fallback (never null)', async () => {
    const el = mount(new ProbeBreadcrumb()) as ProbeBreadcrumb
    el.label = 'Search results'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Search results')
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Breadcrumb')
  })
})

describe('UIBreadcrumbElement — the crumb partition (tag-agnostic author children)', () => {
  it('every non-separator, non-furniture element child is a crumb, in DOM order', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">Home</a><a href="/docs">Docs</a><span>Leaf</span>'
    await settle()
    const crumbs = [...el.children].filter((c) => !c.hasAttribute('data-part') && c.getAttribute('slot') !== 'separator')
    expect(crumbs).toHaveLength(3)
    expect(crumbs.map((c) => c.textContent)).toEqual(['Home', 'Docs', 'Leaf'])
  })

  it('a [slot="separator"] child is excluded from the crumb count and hidden', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">Home</a><span>Leaf</span><span slot="separator">→</span>'
    await settle()
    const template = el.querySelector('[slot="separator"]') as HTMLElement
    expect(template.hasAttribute('hidden')).toBe(true)
    expect(template.getAttribute('aria-hidden')).toBe('true')
    const crumbs = [...el.children].filter((c) => !c.hasAttribute('data-part') && c.getAttribute('slot') !== 'separator')
    expect(crumbs).toHaveLength(2)
  })
})

describe('UIBreadcrumbElement — separator injection', () => {
  it('N crumbs get exactly N-1 separators, each between adjacent crumbs', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><a href="/b">B</a><a href="/c">C</a><span>D</span>'
    await settle()
    const separators = el.querySelectorAll('[data-part="separator"]')
    expect(separators).toHaveLength(3)
    for (const s of separators) expect(s.getAttribute('aria-hidden')).toBe('true')
  })

  it('a single crumb gets zero separators', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<span>Only</span>'
    await settle()
    expect(el.querySelectorAll('[data-part="separator"]')).toHaveLength(0)
  })

  it('unslotted (no template) renders a control-created "/" glyph span', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span>'
    await settle()
    const sep = el.querySelector('[data-part="separator"]') as HTMLElement
    expect(sep.tagName.toLowerCase()).toBe('span')
    expect(sep.textContent).toBe('/')
  })

  it('a slotted template is cloned per gap, never reused as the same node', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><a href="/b">B</a><span>C</span><span slot="separator">→</span>'
    await settle()
    const seps = [...el.querySelectorAll('[data-part="separator"]')]
    expect(seps).toHaveLength(2)
    expect(seps[0]).not.toBe(seps[1])
    for (const s of seps) {
      expect(s.textContent).toBe('→')
      expect(s.hasAttribute('hidden')).toBe(false) // the clone is rendered — only the template itself is hidden
      expect(s.getAttribute('slot')).toBeNull() // the clone is not itself mistaken for a template on the next rebuild
    }
  })

  it('multiple [slot="separator"] children — the FIRST wins; the rest are hidden and inert', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span><span slot="separator">1st</span><span slot="separator">2nd</span>'
    await settle()
    const seps = [...el.querySelectorAll('[data-part="separator"]')]
    expect(seps).toHaveLength(1)
    expect(seps[0].textContent).toBe('1st')
    const templates = [...el.querySelectorAll('[slot="separator"]')]
    expect(templates).toHaveLength(2)
    for (const t of templates) expect(t.hasAttribute('hidden')).toBe(true)
  })

  it('clone hygiene — id stripped from the clone root AND any id-bearing descendant', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML =
      '<a href="/">A</a><a href="/b">B</a><span>C</span>' + '<span slot="separator" id="tmpl"><i id="glyph">→</i></span>'
    await settle()
    const seps = [...el.querySelectorAll('[data-part="separator"]')]
    expect(seps).toHaveLength(2)
    for (const s of seps) {
      expect(s.hasAttribute('id')).toBe(false)
      expect(s.querySelector('[id]')).toBeNull()
    }
  })
})

describe('UIBreadcrumbElement — SNAPSHOT clone semantics (pinned, never live)', () => {
  it('mutating the template subtree AFTER mount does not retroactively touch already-rendered clones', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span><span slot="separator">OLD</span>'
    await settle()
    const before = el.querySelector('[data-part="separator"]') as HTMLElement
    expect(before.textContent).toBe('OLD')

    const template = el.querySelector('[slot="separator"]') as HTMLElement
    template.textContent = 'NEW' // a subtree mutation on an already-slotted template — not a host childList change
    await settle()
    const stillThere = el.querySelector('[data-part="separator"]') as HTMLElement
    expect(stillThere.textContent).toBe('OLD') // unchanged — SNAPSHOT, never live

    // a LATER host childList change (adding a crumb) re-clones from the template's THEN-current shape.
    const extra = document.createElement('span')
    extra.textContent = 'C'
    el.appendChild(extra)
    await settle()
    const seps = [...el.querySelectorAll('[data-part="separator"]')]
    expect(seps).toHaveLength(2)
    expect(seps.every((s) => s.textContent === 'NEW')).toBe(true) // re-cloned fresh, reflecting the edited template
  })
})

describe('UIBreadcrumbElement — current-page auto-stamping (defer-if-already-marked)', () => {
  it('the LAST crumb is auto-stamped aria-current="page"', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><a href="/b">B</a><span>C</span>'
    await settle()
    const current = el.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe('C')
  })

  it('defers when the last crumb ALREADY carries [aria-current] — never double-marks', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span aria-current="location">B (already marked)</span>'
    await settle()
    expect(el.querySelectorAll('[aria-current]')).toHaveLength(1)
    expect(el.querySelector('[aria-current]')?.getAttribute('aria-current')).toBe('location')
  })

  it('defers when a DESCENDANT of the last crumb already carries [aria-current] (a router-exact-active shape)', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span><a href="/b" aria-current="page">B</a></span>'
    await settle()
    const marked = el.querySelectorAll('[aria-current]')
    expect(marked).toHaveLength(1) // the inner <a>, not the outer <span> — never double-marked
    expect(marked[0].tagName.toLowerCase()).toBe('a')
  })

  it('a rebuild that changes which crumb is last un-stamps the PREVIOUS auto-mark', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span>'
    await settle()
    // NOT `el.querySelector('span')` — the default separator is ALSO a `<span>` and sits between the
    // two crumbs in DOM order, so a bare tag selector would find the separator, not crumb B.
    const first = el.querySelector('span:not([data-part])') as HTMLElement
    expect(first.getAttribute('aria-current')).toBe('page')

    const newLast = document.createElement('span')
    newLast.textContent = 'C'
    el.appendChild(newLast)
    await settle()
    expect(first.hasAttribute('aria-current')).toBe(false)
    expect(newLast.getAttribute('aria-current')).toBe('page')
  })

  it('component-checker fix: an UNCHANGED-last rebuild followed by a LAST-CHANGING rebuild never double-marks', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span>'
    await settle()
    const b = el.querySelector('span:not([data-part])') as HTMLElement
    expect(b.getAttribute('aria-current')).toBe('page')

    // UNCHANGED-last rebuild (prepend an ancestor before B) — B stays last; the control's OWN prior stamp
    // must not be misread as "already marked by the author, defer" (which would abandon #autoStamped
    // tracking and leave nothing to un-stamp on the NEXT rebuild below).
    const root = document.createElement('a')
    root.href = '/root'
    root.textContent = 'root'
    el.prepend(root)
    await settle()
    expect(b.getAttribute('aria-current')).toBe('page') // still correctly marked, tracking intact

    // LAST-CHANGING rebuild (append C) — if tracking was abandoned above, B's mark would survive
    // un-removed while C also gets marked: two crumbs current at once.
    const c = document.createElement('span')
    c.textContent = 'C'
    el.appendChild(c)
    await settle()
    const marked = el.querySelectorAll('[aria-current]')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toBe(c)
    expect(b.hasAttribute('aria-current')).toBe(false)
  })
})

describe('UIBreadcrumbElement — zero residue across connect/disconnect', () => {
  it('the observer stops on disconnect; reconnect re-partitions correctly', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><span>B</span>'
    await settle()
    expect(el.querySelectorAll('[data-part="separator"]')).toHaveLength(1)

    el.remove()
    const stray = document.createElement('span')
    stray.textContent = 'ghost'
    expect(() => el.appendChild(stray)).not.toThrow() // mutated while disconnected — no observer live, must not throw

    document.body.append(el)
    await settle()
    expect(el.querySelectorAll('[data-part="separator"]')).toHaveLength(2) // A / B / ghost → 2 gaps
    el.remove()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// GH #1515 S2 — collapse="menu" (the composed-ui-menu overflow fold)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/** Drain both the MutationObserver-driven rebuild (a plain microtask) AND the collapse-prop effect
 *  (scheduler microtask, `el.updateComplete`) — a live prop write and a childList mutation are each
 *  driven by a DIFFERENT microtask source, so a single `settle()` is not always enough. */
const flushAll = async (el: UIBreadcrumbElement): Promise<void> => {
  await settle()
  await el.updateComplete
  await settle()
}

describe('UIBreadcrumbElement — collapse/collapseKeepTrailing typed props + defaults', () => {
  it('collapse defaults "none", reflects; collapseKeepTrailing defaults 2, reflects to collapse-keep-trailing', () => {
    const el = document.createElement('ui-breadcrumb') as UIBreadcrumbElement
    expect(el.collapse).toBe('none')
    expect(el.collapseKeepTrailing).toBe(2)
    expect(el.hasAttribute('collapse')).toBe(false)
    expect(el.hasAttribute('collapse-keep-trailing')).toBe(false)

    el.collapse = 'menu'
    expect(el.getAttribute('collapse')).toBe('menu')
    el.collapseKeepTrailing = 3
    expect(el.getAttribute('collapse-keep-trailing')).toBe('3')

    el.setAttribute('collapse-keep-trailing', '5')
    expect(el.collapseKeepTrailing).toBe(5)
  })

  it('an out-of-set collapse attribute snaps to "none" (values[0] fallback)', () => {
    const el = document.createElement('ui-breadcrumb') as UIBreadcrumbElement
    el.setAttribute('collapse', 'bogus')
    expect(el.collapse).toBe('none')
  })
})

describe('UIBreadcrumbElement — collapse="none" (default) stays byte-identical to S1', () => {
  it('NEGATIVE — no [data-part="overflow"] part ever exists, for any crumb count, default collapse', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.innerHTML = '<a href="/">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a><span>E</span>'
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).toBeNull()
    expect(el.querySelectorAll('[data-collapsed]')).toHaveLength(0)
  })

  it('NEGATIVE — collapse="none" set explicitly is identical to absent', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'none')
    el.innerHTML = '<a href="/">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a><span>E</span>'
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).toBeNull()
    expect(el.querySelectorAll('[data-collapsed]')).toHaveLength(0)
    expect(el.querySelectorAll('[data-part="separator"]')).toHaveLength(4)
  })
})

describe('UIBreadcrumbElement — collapse="menu" fold computation across crumb counts', () => {
  const buildCrumbs = (el: UIBreadcrumbElement, n: number): HTMLElement[] => {
    const made: HTMLElement[] = []
    for (let i = 0; i < n - 1; i++) {
      const a = document.createElement('a')
      a.href = `/${i}`
      a.textContent = `Crumb ${i}`
      el.append(a)
      made.push(a)
    }
    const leaf = document.createElement('span')
    leaf.textContent = 'Current'
    el.append(leaf)
    made.push(leaf)
    return made
  }

  it('n <= keepTrailing+1 (default 2): nothing folds — no overflow part, no data-collapsed', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    buildCrumbs(el, 3) // first(pinned) + 2 trailing(pinned) = everything pinned already
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).toBeNull()
    expect(el.querySelectorAll('[data-collapsed]')).toHaveLength(0)
  })

  it('n = keepTrailing+2 (default 2 ⇒ n=4): exactly ONE crumb folds behind the overflow menu', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    const crumbs = buildCrumbs(el, 4)
    await flushAll(el)

    const menu = el.querySelector('[data-part="overflow"]')
    expect(menu, 'the overflow menu must exist once a fold is non-empty').not.toBeNull()
    expect(menu?.tagName.toLowerCase()).toBe('ui-menu')

    const collapsedCrumbs = [...el.querySelectorAll(':scope > [data-collapsed]')].filter((c) => c.getAttribute('data-part') !== 'separator')
    expect(collapsedCrumbs).toHaveLength(1)
    expect(collapsedCrumbs[0]).toBe(crumbs[1]) // crumb index 1 (the sole middle crumb) folds

    // first crumb + the last two (keepTrailing=2) stay visible (no data-collapsed)
    expect(crumbs[0].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[2].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[3].hasAttribute('data-collapsed')).toBe(false)

    // the menu sits right before the folded crumb — "the first gap"
    expect(menu?.nextElementSibling).toBe(crumbs[1])
  })

  it('n = 6, keepTrailing=2 (default): 3 crumbs fold (indices 1,2,3); the menu carries 3 proxy rows', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    const crumbs = buildCrumbs(el, 6)
    await flushAll(el)

    const folded = [crumbs[1], crumbs[2], crumbs[3]]
    for (const c of folded) expect(c.hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[0].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[4].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[5].hasAttribute('data-collapsed')).toBe(false)

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    const proxies = [...menu.querySelectorAll('[role="menuitem"]')]
    expect(proxies).toHaveLength(3)
    expect(proxies.map((p) => p.textContent)).toEqual(['Crumb 1', 'Crumb 2', 'Crumb 3'])
  })

  it('separators between two folded crumbs are ALSO data-collapsed; the ONE separator before the FIRST folded crumb (and the one before the first pinned-trailing crumb) stay visible', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    buildCrumbs(el, 6) // folds indices 1,2,3 (3 middle crumbs, 2 "between" separators)
    await flushAll(el)

    const kids = [...el.children]
    const separators = kids.filter((k) => k.getAttribute('data-part') === 'separator')
    expect(separators).toHaveLength(5) // 6 crumbs ⇒ 5 gaps, unchanged by folding
    const collapsedSeparators = separators.filter((s) => s.hasAttribute('data-collapsed'))
    const visibleSeparators = separators.filter((s) => !s.hasAttribute('data-collapsed'))
    expect(collapsedSeparators).toHaveLength(2) // between (1,2) and (2,3)
    expect(visibleSeparators).toHaveLength(3) // before crumb0→[menu gap], before crumb4, before crumb5(current)
  })

  it('collapseKeepTrailing clamps: 0 and negative floor at 1; non-finite/null snap to the default (2)', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    const crumbs = buildCrumbs(el, 5) // indices 0..4, current=4

    el.setAttribute('collapse-keep-trailing', '0')
    await flushAll(el)
    // keepTrailing clamps to 1 ⇒ pin first(0) + last 1(4); fold 1,2,3
    expect(crumbs[1].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[2].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[3].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[0].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[4].hasAttribute('data-collapsed')).toBe(false)

    el.setAttribute('collapse-keep-trailing', '-3')
    await flushAll(el)
    expect(crumbs[3].hasAttribute('data-collapsed')).toBe(true) // same as keepTrailing=1

    el.setAttribute('collapse-keep-trailing', 'not-a-number')
    await flushAll(el)
    // non-finite (parses to NaN) ⇒ default 2 ⇒ pin first(0) + last 2(3,4); fold 1,2
    expect(crumbs[1].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[2].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[3].hasAttribute('data-collapsed')).toBe(false)
    expect(crumbs[4].hasAttribute('data-collapsed')).toBe(false)

    el.removeAttribute('collapse-keep-trailing') // null ⇒ default 2, same as above
    await flushAll(el)
    expect(crumbs[1].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[2].hasAttribute('data-collapsed')).toBe(true)
    expect(crumbs[3].hasAttribute('data-collapsed')).toBe(false)
  })

  it('a live collapse flip (menu→none→menu) re-folds reactively, without any childList mutation', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    buildCrumbs(el, 5)
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).toBeNull() // collapse defaults 'none'

    el.collapse = 'menu'
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).not.toBeNull()

    el.collapse = 'none'
    await flushAll(el)
    expect(el.querySelector('[data-part="overflow"]')).toBeNull()
    expect(el.querySelectorAll('[data-collapsed]')).toHaveLength(0)
  })

  it('the overflow trigger is a labelled, iconed <button>, first child of the composed ui-menu', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    buildCrumbs(el, 5)
    await flushAll(el)

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    const trigger = menu.firstElementChild as HTMLButtonElement
    expect(trigger.tagName.toLowerCase()).toBe('button')
    expect(trigger.getAttribute('aria-label')).toBe('Show hidden breadcrumbs')
    expect(trigger.querySelector('svg'), 'setIcon must have injected an <svg> (dots-three)').not.toBeNull()
  })
})

describe('UIBreadcrumbElement — commit relay + event containment (the tabs.ts C8 precedent)', () => {
  it('a proxy select relays a real .click() to the REAL folded crumb (a plain <a>)', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    const crumbs: HTMLElement[] = []
    for (let i = 0; i < 4; i++) {
      const a = document.createElement('a')
      a.href = `/${i}`
      a.textContent = `Crumb ${i}`
      el.append(a)
      crumbs.push(a)
    }
    const leaf = document.createElement('span')
    leaf.textContent = 'Current'
    el.append(leaf)
    crumbs.push(leaf)
    await flushAll(el)

    let clicked = false
    ;(crumbs[1] as HTMLAnchorElement).addEventListener('click', (e) => {
      e.preventDefault() // jsdom has no real navigation — prevent the "not implemented" navigation error
      clicked = true
    })

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    menu.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail: { value: '0', index: 0 } }))
    expect(clicked, 'selecting the ONE proxy row must .click() the real hidden crumb (index 0 ⇒ crumbs[1])').toBe(true)
  })

  it('a proxy select relays through a custom-element crumb\'s OWN inner <a> (ADR-0115-blind, ui-router-link shape) once upgraded', async () => {
    class FakeRouterLink extends HTMLElement {
      connectedCallback(): void {
        const a = document.createElement('a')
        a.href = '/fake'
        a.textContent = this.textContent ?? ''
        this.replaceChildren(a)
      }
    }
    if (!customElements.get('fake-router-link')) customElements.define('fake-router-link', FakeRouterLink)

    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    const home = document.createElement('a')
    home.href = '/'
    home.textContent = 'Home'
    el.append(home)
    const link = document.createElement('fake-router-link') as FakeRouterLink
    link.textContent = 'Middle'
    el.append(link)
    for (let i = 0; i < 2; i++) {
      const a = document.createElement('a')
      a.href = `/t${i}`
      a.textContent = `Trail ${i}`
      el.append(a)
    }
    await flushAll(el)
    // by the time this test asserts, the whole tree has long since upgraded (custom elements upgrade
    // synchronously on connect in a real engine/jsdom alike) — the fold computation itself runs post-connect
    // (never pre-upgrade), and the relay's own anchor lookup is lazy (only at commit time) either way.
    const innerAnchor = link.querySelector('a') as HTMLAnchorElement
    expect(innerAnchor, 'the fake router-link must have stamped its own inner <a> by connect time').not.toBeNull()

    let clicked = false
    innerAnchor.addEventListener('click', (e) => {
      e.preventDefault()
      clicked = true
    })

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    menu.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail: { value: '0', index: 0 } }))
    expect(clicked, 'the relay must reach the custom-element crumb\'s OWN inner <a>, never the wrapper itself').toBe(true)
  })

  it('select/toggle/close from the overflow menu are CONTAINED — ui-breadcrumb emits none of its own', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    for (let i = 0; i < 4; i++) {
      const a = document.createElement('a')
      a.href = `/${i}`
      a.textContent = `Crumb ${i}`
      el.append(a)
    }
    const leaf = document.createElement('span')
    leaf.textContent = 'Current'
    el.append(leaf)
    await flushAll(el)
    el.addEventListener('click', (e) => e.preventDefault()) // the relay's OWN .click() genuinely fires — suppress jsdom's real-navigation attempt, irrelevant to this test's concern

    const seenSelect: Event[] = []
    let toggles = 0
    let closes = 0
    el.addEventListener('select', (e) => seenSelect.push(e))
    el.addEventListener('toggle', () => toggles++)
    el.addEventListener('close', () => closes++)

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    menu.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail: { value: '0', index: 0 } }))
    menu.dispatchEvent(new CustomEvent('toggle', { bubbles: true, composed: true }))
    menu.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))

    expect(seenSelect, 'ui-breadcrumb emits NONE of its own — the raw menu select must never surface').toHaveLength(0)
    expect(toggles).toBe(0)
    expect(closes).toBe(0)
  })

  it('a bogus/unresolvable proxy index relays to nothing (no throw, no crash)', async () => {
    const el = mount(new UIBreadcrumbElement()) as UIBreadcrumbElement
    el.setAttribute('collapse', 'menu')
    for (let i = 0; i < 4; i++) {
      const a = document.createElement('a')
      a.href = `/${i}`
      a.textContent = `Crumb ${i}`
      el.append(a)
    }
    const leaf = document.createElement('span')
    leaf.textContent = 'Current'
    el.append(leaf)
    await flushAll(el)

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    expect(() =>
      menu.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail: { value: 'x', index: 99 } })),
    ).not.toThrow()
  })
})
