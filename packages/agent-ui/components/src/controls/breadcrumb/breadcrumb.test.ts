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
