// surface-help.test.ts — GH #844: the Surface tab's question-mark help affordance.
//
// Three tiers, in the order the issue's Acceptance names them:
//   1. the COPY (agent-admin-schema.ts's SURFACE_HELP) — every helped surface has real, non-empty
//      structured content, and the catalog card's facts are PROJECTED from A2UI_CATALOG_OPTIONS rather
//      than restated (the one-copy-source law, checked mechanically rather than by eye);
//   2. the FACTORY (surface-help.ts) — the ui-tooltip/anchor/card shape it builds;
//   3. the WIRING, driven through a real mounted `ui-agent-admin`: an icon on every group header and
//      every element row of the Surface tab, each carrying non-empty card content, each row's own native
//      `title` hint reading from the SAME record, and the KEYBOARD path — focus opens, Escape dismisses,
//      `role=tooltip` + `aria-describedby` intact.
//
// The CSS half of the reveal (hidden at rest, opacity 0 → 1 on row hover AND on the icon's own focus)
// cannot be true here: jsdom resolves no `@scope`, no `:hover`, and no computed opacity. That is proven
// in `agent-admin.browser.test.ts` against both real engines, where the tooltip panel also actually
// enters the top layer. What THIS file proves about focus is the half jsdom can hold honestly: focusing
// the icon drives `ui-tooltip` to open immediately, with no hover involved at all.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { buildSurfaceHelp, buildSurfaceHelpForSummary } from './surface-help.ts'
import { SURFACE_HELP, SURFACE_HELP_KEYS, A2UI_CATALOG_OPTIONS, type SurfaceHelpKey } from './agent-admin-schema.ts'
import { ENTRY_KINDS } from './entries.ts'

// ── jsdom platform stubs ────────────────────────────────────────────────────────────────────────────
//
// (a) ElementInternals — the agent-admin.test.ts/agent-admin-local-patterns.test.ts stub verbatim: jsdom's
//     real attachInternals implements neither setFormValue nor setValidity, and a real `ui-agent-admin`
//     mounts real FACE controls that call both on connect.
// (b) The Popover API — ABSENT in jsdom 29 (measured, not assumed: `'showPopover' in HTMLElement.prototype`
//     is false). `ui-tooltip`'s own unit suite ships exactly this shim for exactly this reason; it is
//     copied rather than shared because that file's copy is a test-local detail of another package, and
//     importing across a package's test boundary to reach it would be worse than eight lines here. Real
//     engines are left alone (the `typeof === 'function'` early return), so this file stays correct if it
//     is ever run somewhere that has the platform.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
const popoverOpen = new WeakMap<HTMLElement, boolean>()
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }

  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof proto.showPopover === 'function') return // a real engine — leave the platform alone
  const fireToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    const event = new Event('toggle')
    Object.defineProperty(event, 'newState', { value: newState })
    el.dispatchEvent(event)
  }
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
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

async function mountAdmin(): Promise<UIAgentAdminElement> {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  return el
}

/** The help affordance for `key` inside a mounted admin — addressed by its own `data-help` marker, never
 *  by DOM position (the rows it rides move; the marker does not). */
function helpFor(el: HTMLElement, key: SurfaceHelpKey): HTMLElement {
  return el.querySelector(`[data-part="surface-help"][data-help="${key}"]`) as HTMLElement
}

/** The icon is addressed as the tooltip's OWN `anchor` part, scoped through the help host — `ui-tooltip`
 *  stamps `data-part="anchor"` on its first element child at connect, clobbering any bespoke name (the
 *  `ui-menu` trigger precedent, entry-list.ts). Before connect it is simply the first element child. */
function iconOf(help: HTMLElement): HTMLElement {
  return help.querySelector('[data-part="anchor"]') as HTMLElement
}

function panelOf(help: HTMLElement): HTMLElement {
  return help.querySelector('[data-part="panel"]') as HTMLElement
}

// ── 1. THE COPY — one source, real content ──────────────────────────────────────────────────────────

describe('SURFACE_HELP — the Surface tab’s one copy source (GH #844)', () => {
  it('covers every helped surface: the two group headers plus every element row the tab paints', () => {
    expect([...SURFACE_HELP_KEYS]).toEqual([
      'surface-options',
      'markdown',
      'a2ui',
      'a2ui-catalog',
      'genui',
      'genui-dogfood',
      'planner',
      'authoring',
      'pattern-source',
    ])
    // The union and the table agree in BOTH directions — a key added to one and not the other is the
    // exact drift this pair exists to make impossible.
    expect(Object.keys(SURFACE_HELP).sort()).toEqual([...SURFACE_HELP_KEYS].sort())
  })

  it.each([...SURFACE_HELP_KEYS])('%s carries a real title, a real one-line summary, and real structured body prose', (key) => {
    const entry = SURFACE_HELP[key]
    expect(entry.title.trim().length, 'a non-empty title').toBeGreaterThan(0)
    expect(entry.summary.trim().length, 'a non-empty summary').toBeGreaterThan(0)
    // "Structured rich text, not a bare one-line string" (the issue's own wording): at least one
    // paragraph BEYOND the summary, and every paragraph a real sentence rather than a stub.
    expect(entry.body.length, 'at least one expanded paragraph').toBeGreaterThanOrEqual(1)
    for (const paragraph of entry.body) expect(paragraph.trim().length).toBeGreaterThan(40)
    for (const fact of entry.facts ?? []) {
      expect(fact.term.trim().length).toBeGreaterThan(0)
      expect(fact.detail.trim().length).toBeGreaterThan(0)
    }
  })

  it('the copy is PLAIN structured prose — no markdown syntax (it renders as textContent, never parsed)', () => {
    for (const key of SURFACE_HELP_KEYS) {
      const entry = SURFACE_HELP[key]
      for (const text of [entry.summary, ...entry.body]) {
        expect(text, `${key}: markdown emphasis would paint its own asterisks`).not.toMatch(/\*\*|__|`/)
      }
    }
  })

  it('the catalog card’s facts are PROJECTED from A2UI_CATALOG_OPTIONS, never a hand-copied second table', () => {
    const facts = SURFACE_HELP['a2ui-catalog'].facts ?? []
    expect(facts.map((f) => f.term)).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.label))
    expect(facts.map((f) => f.detail)).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.description ?? ''))
  })
})

// ── 2. THE FACTORY — the shape it builds ────────────────────────────────────────────────────────────

describe('buildSurfaceHelp — the ui-tooltip + anchor + card shape', () => {
  it('builds a ui-tooltip whose FIRST child is the focusable question-mark anchor (tooltip.md’s contract)', () => {
    const help = buildSurfaceHelp('markdown')
    expect(help.tagName.toLowerCase()).toBe('ui-tooltip')
    expect(help.getAttribute('data-help')).toBe('markdown')
    const icon = help.firstElementChild as HTMLElement
    expect(icon.tagName.toLowerCase(), 'a real focusable, not a decorative span').toBe('button')
    expect((icon as HTMLButtonElement).type, 'never a submit — this rides inside no form, but say so anyway').toBe('button')
    // Deliberately carries NO bespoke data-part: ui-tooltip stamps `anchor` on it at connect and would
    // clobber one (the ui-menu trigger precedent). A part set here would be a silently dead selector.
    expect(icon.hasAttribute('data-part'), 'the anchor part is ui-tooltip’s to name, not ours').toBe(false)
    expect(icon.querySelector('ui-icon')?.getAttribute('glyph')).toBe('question')
    // The name says WHICH thing is explained; the card itself is the description (aria-describedby).
    expect(icon.getAttribute('aria-label')).toBe('About Markdown')
  })

  it('projects the whole record into the card — title, summary, one paragraph per body member, the facts list', () => {
    const help = buildSurfaceHelp('genui-dogfood')
    const entry = SURFACE_HELP['genui-dogfood']
    const card = help.querySelector('[data-part="surface-help-card"]') as HTMLElement
    expect(card.querySelector('[data-part="surface-help-title"]')?.textContent).toBe(entry.title)
    expect(card.querySelector('[data-part="surface-help-summary"]')?.textContent).toBe(entry.summary)
    expect([...card.querySelectorAll('[data-part="surface-help-body"]')].map((p) => p.textContent)).toEqual([...entry.body])
    const facts = [...(card.querySelector('[data-part="surface-help-facts"]')?.children ?? [])]
    expect(facts.map((li) => li.textContent)).toEqual((entry.facts ?? []).map((f) => `${f.term}: ${f.detail}`))
  })

  it('an entry with no facts renders no facts list (nothing empty, nothing decorative)', () => {
    // Guard the shape rather than assert which entries currently have facts — copy is allowed to change.
    for (const key of SURFACE_HELP_KEYS) {
      const card = buildSurfaceHelp(key).querySelector('[data-part="surface-help-card"]') as HTMLElement
      const list = card.querySelector('[data-part="surface-help-facts"]')
      if ((SURFACE_HELP[key].facts ?? []).length === 0) expect(list, `${key}`).toBeNull()
      else expect(list?.children.length, `${key}`).toBe(SURFACE_HELP[key].facts!.length)
    }
  })

  it('the summary-slot variant is the same node, marked for ui-disclosure’s heading row (ADR-0158)', () => {
    expect(buildSurfaceHelpForSummary('surface-options').getAttribute('slot')).toBe('summary')
    expect(buildSurfaceHelp('surface-options').hasAttribute('slot'), 'the row variant carries none').toBe(false)
  })
})

// ── 3. THE WIRING — through a real mounted ui-agent-admin ───────────────────────────────────────────

describe('ui-agent-admin Surface tab — an icon per group header and per element row (GH #844)', () => {
  it('BOTH group headers carry one, adopted onto the fold’s own heading row', async () => {
    const el = await mountAdmin()
    for (const [item, key] of [
      ['surface', 'surface-options'],
      [ENTRY_KINDS.patternSource, 'pattern-source'],
    ] as const) {
      const onSummary = el.querySelector(
        `[data-part="settings-item"][data-item="${item}"] > [data-part="details"] > [data-part="summary"] [data-part="surface-help"][data-help="${key}"]`,
      )
      expect(onSummary, `${item}: the help icon must ride the heading row, not the fold body`).not.toBeNull()
    }
  })

  it('EVERY element row carries one, in the row itself', async () => {
    const el = await mountAdmin()
    // The five modality rows — addressed through their own row, so a help icon that drifted into the
    // wrong row (or out of the card entirely) fails rather than passing on a document-wide match.
    for (const surface of ['markdown', 'a2ui', 'genui', 'planner', 'authoring'] as const) {
      const row = el.querySelector(`[data-part="surface-row"][data-surface="${surface}"]`) as HTMLElement
      expect(row.querySelector(`[data-part="surface-help"][data-help="${surface}"]`), `${surface} row`).not.toBeNull()
    }
    // The two NESTED detail rows — GenUI's sub-option, and the (otherwise headless) catalog card's header.
    for (const detail of ['genui-dogfood', 'a2ui-catalog'] as const) {
      const row = el.querySelector(`[data-part="surface-detail-row"][data-detail="${detail}"]`) as HTMLElement
      expect(row, `${detail} row`).not.toBeNull()
      expect(row.querySelector(`[data-part="surface-help"][data-help="${detail}"]`), `${detail} help`).not.toBeNull()
    }
  })

  it('the catalog card’s header sits ABOVE the roster inside the A2UI detail zone (it had no heading of its own)', async () => {
    const el = await mountAdmin()
    const detail = el.querySelector('[data-part="surface-group"][data-surface="a2ui"] [data-part="surface-detail"]') as HTMLElement
    const header = detail.querySelector('[data-part="surface-detail-row"][data-detail="a2ui-catalog"]')
    const section = detail.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`)
    expect(header).not.toBeNull()
    expect(section).not.toBeNull()
    expect(header!.compareDocumentPosition(section!) & Node.DOCUMENT_POSITION_FOLLOWING, 'header first, roster after').toBeTruthy()
  })

  it('every mounted icon opens a card with NON-EMPTY content matching its own entry', async () => {
    const el = await mountAdmin()
    for (const key of SURFACE_HELP_KEYS) {
      const help = helpFor(el, key)
      expect(help, `${key}: no help affordance mounted`).not.toBeNull()
      const panel = panelOf(help)
      expect(panel, `${key}: ui-tooltip built no panel`).not.toBeNull()
      const text = panel.textContent ?? ''
      expect(text.trim().length, `${key}: an empty card is a broken promise`).toBeGreaterThan(0)
      expect(text, `${key}: the card carries its own entry, not another’s`).toContain(SURFACE_HELP[key].summary)
      for (const paragraph of SURFACE_HELP[key].body) expect(text).toContain(paragraph)
    }
  })

  it('each row’s native `title` hint reads from the SAME record as its card — one copy source, two renderings', async () => {
    const el = await mountAdmin()
    for (const surface of ['markdown', 'a2ui', 'genui', 'planner', 'authoring'] as const) {
      const label = el.querySelector(`[data-part="surface-row"][data-surface="${surface}"] [data-part="surface-label"]`) as HTMLElement
      expect(label.title, `${surface}`).toBe(SURFACE_HELP[surface].summary)
    }
    for (const detail of ['genui-dogfood', 'a2ui-catalog'] as const) {
      const label = el.querySelector(
        `[data-part="surface-detail-row"][data-detail="${detail}"] [data-part="surface-detail-label"]`,
      ) as HTMLElement
      expect(label.title, `${detail}`).toBe(SURFACE_HELP[detail].summary)
    }
  })

  it('the affordance is Surface-tab-scoped — the Capabilities tab’s own kinds carry none (the ruled boundary)', async () => {
    const el = await mountAdmin()
    const capabilities = el.querySelector('[data-role="capabilities-content"]') as HTMLElement
    expect(capabilities.querySelectorAll('[data-part="surface-help"]'), 'admin-wide is a named follow-up, not this slice').toHaveLength(0)
    const surface = el.querySelector('[data-role="surface-content"]') as HTMLElement
    expect(surface.querySelectorAll('[data-part="surface-help"]').length).toBe(SURFACE_HELP_KEYS.length)
  })
})

describe('ui-agent-admin Surface-tab help — the keyboard path, end to end', () => {
  it('role=tooltip + aria-describedby are ui-tooltip’s own wiring, never bypassed', async () => {
    const el = await mountAdmin()
    for (const key of SURFACE_HELP_KEYS) {
      const help = helpFor(el, key)
      const icon = iconOf(help)
      const panel = panelOf(help)
      expect(panel.getAttribute('role'), `${key}`).toBe('tooltip')
      expect(panel.id.length, `${key}: the panel needs a stable id to be described BY`).toBeGreaterThan(0)
      expect(icon.getAttribute('aria-describedby'), `${key}`).toBe(panel.id)
    }
  })

  it('FOCUS alone opens the card — immediately, with no hover and no delay (the a11y floor)', async () => {
    const el = await mountAdmin()
    const help = helpFor(el, 'genui')
    const icon = iconOf(help)
    expect((help as HTMLElement & { open: boolean }).open, 'closed at rest').toBe(false)

    icon.focus()
    icon.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await whenFlushed()
    expect((help as HTMLElement & { open: boolean }).open, 'focusin shows it — no timer awaited').toBe(true)
  })

  it('Escape dismisses it (ui-tooltip’s own document-level listener, inherited unchanged)', async () => {
    const el = await mountAdmin()
    const help = helpFor(el, 'planner') as HTMLElement & { open: boolean }
    const icon = iconOf(help)

    icon.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await whenFlushed()
    expect(help.open).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await whenFlushed()
    expect(help.open, 'Escape is a real dismiss, not a no-op').toBe(false)
  })

  it('focus leaving the icon dismisses it too — the pointer path’s mouseleave twin', async () => {
    const el = await mountAdmin()
    const help = helpFor(el, 'authoring') as HTMLElement & { open: boolean }
    const icon = iconOf(help)

    icon.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await whenFlushed()
    expect(help.open).toBe(true)

    icon.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await whenFlushed()
    expect(help.open).toBe(false)
  })

  it('clicking a group header’s icon explains — it never folds the section it rides', async () => {
    const el = await mountAdmin()
    const fold = el.querySelector('[data-part="settings-item"][data-item="surface"]') as HTMLElement & { open: boolean }
    expect(fold.open, 'config folds ship open').toBe(true)
    const icon = iconOf(helpFor(el, 'surface-options'))

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    icon.dispatchEvent(event)
    await whenFlushed()
    expect(event.defaultPrevented, 'the click is cancelled before the summary’s own toggle can run').toBe(true)
    expect(fold.open, 'the fold is untouched').toBe(true)
  })
})
