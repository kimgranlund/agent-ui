// admin-help.test.ts — GH #844 (the Surface tab) / GH #866 (admin-wide): the question-mark help
// affordance.
//
// Four tiers, in the order the issues' Acceptance names them:
//   1. the COPY (agent-admin-schema.ts's ADMIN_HELP) — every helped surface has real, non-empty
//      structured content, the catalog card's facts are PROJECTED from A2UI_CATALOG_OPTIONS and the Agent
//      card's from the SCHEMA's own descriptions rather than restated (the one-copy-source law, checked
//      mechanically rather than by eye);
//   2. the FACTORY (admin-help.ts) — the ui-tooltip/anchor/card shape it builds;
//   3. the WIRING, driven through a real mounted `ui-agent-admin`: an icon on every group header and
//      element row of the Surface tab AND on every section header of the Agent, Capabilities and Context
//      tabs, each carrying non-empty card content, each row's own native `title` hint reading from the
//      SAME record, and the KEYBOARD path — focus opens, Escape dismisses, `role=tooltip` +
//      `aria-describedby` intact;
//   4. the PLACEMENT law (Kim, 2026-08-14, two rulings) and the OPT-IN seam's default-off half — a bare
//      `mountEntryList` section mounts zero icons, so every other consumer of the shared primitive is
//      untouched.
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
import { buildAdminHelp, buildAdminHelpForSummary } from './admin-help.ts'
import {
  ADMIN_HELP,
  ADMIN_HELP_KEYS,
  A2UI_CATALOG_OPTIONS,
  TURN_LOG_CAP,
  defaultAgentConfigSchema,
  helpKeyForKind,
  type AdminHelpKey,
} from './agent-admin-schema.ts'
import { ENTRY_KINDS } from './entries.ts'
import { mountEntryList } from '../entry-list/entry-list.ts'

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
function helpFor(el: HTMLElement, key: AdminHelpKey): HTMLElement {
  return el.querySelector(`[data-part="admin-help"][data-help="${key}"]`) as HTMLElement
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

describe('ADMIN_HELP — the admin’s one copy source (GH #844, widened by GH #866)', () => {
  it('covers every helped surface: the Surface tab’s headers + rows, and every other tab’s section headers', () => {
    expect([...ADMIN_HELP_KEYS]).toEqual([
      // the Surface tab (GH #844)
      'surface-options',
      'markdown',
      'a2ui',
      'a2ui-catalog',
      'genui',
      'genui-dogfood',
      'planner',
      'authoring',
      'bubbles',
      'pattern-source',
      // the Agent tab (GH #866)
      'agent',
      'model',
      'bankroll',
      // the Capabilities tab (GH #866)
      'prompt-section',
      'skill',
      'workflow',
      'resource',
      'tool',
      // the Context tabs (GH #866)
      'context-agent',
      'context-turn',
    ])
    // The union and the table agree in BOTH directions — a key added to one and not the other is the
    // exact drift this pair exists to make impossible.
    expect(Object.keys(ADMIN_HELP).sort()).toEqual([...ADMIN_HELP_KEYS].sort())
  })

  it.each([...ADMIN_HELP_KEYS])('%s carries a real title, a real one-line summary, and real structured body prose', (key) => {
    const entry = ADMIN_HELP[key]
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
    for (const key of ADMIN_HELP_KEYS) {
      const entry = ADMIN_HELP[key]
      for (const text of [entry.summary, ...entry.body]) {
        expect(text, `${key}: markdown emphasis would paint its own asterisks`).not.toMatch(/\*\*|__|`/)
      }
    }
  })

  it('the catalog card’s facts are PROJECTED from A2UI_CATALOG_OPTIONS, never a hand-copied second table', () => {
    const facts = ADMIN_HELP['a2ui-catalog'].facts ?? []
    expect(facts.map((f) => f.term)).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.label))
    expect(facts.map((f) => f.detail)).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.description ?? ''))
  })

  it('GH #866: the Agent card is RECONCILED with the schema — its gist and facts ARE the schema’s own descriptions', () => {
    const section = defaultAgentConfigSchema.sections[0]!
    expect(ADMIN_HELP.agent.summary, 'the section description, verbatim — not a paraphrase beside it').toBe(section.description)
    const described = section.fields.filter((f) => (f.description ?? '').trim().length > 0)
    expect(described.length, 'anti-vacuous: the schema really does carry field descriptions to project').toBeGreaterThan(0)
    expect(ADMIN_HELP.agent.facts?.map((f) => f.term)).toEqual(described.map((f) => f.label))
    expect(ADMIN_HELP.agent.facts?.map((f) => f.detail)).toEqual(described.map((f) => f.description))
  })

  it('GH #866: the dialog-turn card cites the REAL retention bound, not a hand-copied number', () => {
    const detail = (ADMIN_HELP['context-turn'].facts ?? []).map((f) => f.detail).join(' ')
    expect(detail).toContain(String(TURN_LOG_CAP))
  })

  it('GH #866: helpKeyForKind is the opt-in seam — every entry-list kind maps, an unknown kind opts out', () => {
    expect(helpKeyForKind(ENTRY_KINDS.promptSection)).toBe('prompt-section')
    expect(helpKeyForKind(ENTRY_KINDS.skill)).toBe('skill')
    expect(helpKeyForKind(ENTRY_KINDS.workflow)).toBe('workflow')
    expect(helpKeyForKind(ENTRY_KINDS.resource)).toBe('resource')
    expect(helpKeyForKind(ENTRY_KINDS.tool)).toBe('tool')
    expect(helpKeyForKind(ENTRY_KINDS.patternSource)).toBe('pattern-source')
    // ONE concept, ONE record: the catalog section reuses the Surface tab's own card.
    expect(helpKeyForKind(ENTRY_KINDS.catalog)).toBe('a2ui-catalog')
    expect(helpKeyForKind('not-a-kind'), 'default-off: an unrecognised kind mounts no icon at all').toBeUndefined()
  })
})

// ── 2. THE FACTORY — the shape it builds ────────────────────────────────────────────────────────────

describe('buildAdminHelp — the ui-tooltip + anchor + card shape', () => {
  it('builds a ui-tooltip whose FIRST child is the focusable question-mark anchor (tooltip.md’s contract)', () => {
    const help = buildAdminHelp('markdown')
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
    const help = buildAdminHelp('genui-dogfood')
    const entry = ADMIN_HELP['genui-dogfood']
    const card = help.querySelector('[data-part="admin-help-card"]') as HTMLElement
    expect(card.querySelector('[data-part="admin-help-title"]')?.textContent).toBe(entry.title)
    expect(card.querySelector('[data-part="admin-help-summary"]')?.textContent).toBe(entry.summary)
    expect([...card.querySelectorAll('[data-part="admin-help-body"]')].map((p) => p.textContent)).toEqual([...entry.body])
    const facts = [...(card.querySelector('[data-part="admin-help-facts"]')?.children ?? [])]
    expect(facts.map((li) => li.textContent)).toEqual((entry.facts ?? []).map((f) => `${f.term}: ${f.detail}`))
  })

  it('an entry with no facts renders no facts list (nothing empty, nothing decorative)', () => {
    // Guard the shape rather than assert which entries currently have facts — copy is allowed to change.
    for (const key of ADMIN_HELP_KEYS) {
      const card = buildAdminHelp(key).querySelector('[data-part="admin-help-card"]') as HTMLElement
      const list = card.querySelector('[data-part="admin-help-facts"]')
      if ((ADMIN_HELP[key].facts ?? []).length === 0) expect(list, `${key}`).toBeNull()
      else expect(list?.children.length, `${key}`).toBe(ADMIN_HELP[key].facts!.length)
    }
  })

  it('the summary-slot variant is the same node, marked for ui-disclosure’s heading row (ADR-0158)', () => {
    expect(buildAdminHelpForSummary('surface-options').getAttribute('slot')).toBe('summary')
    expect(buildAdminHelp('surface-options').hasAttribute('slot'), 'the row variant carries none').toBe(false)
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
        `[data-part="settings-item"][data-item="${item}"] > [data-part="details"] > [data-part="summary"] [data-part="admin-help"][data-help="${key}"]`,
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
      expect(row.querySelector(`[data-part="admin-help"][data-help="${surface}"]`), `${surface} row`).not.toBeNull()
    }
    // The two NESTED detail rows — GenUI's sub-option, and the (otherwise headless) catalog card's header.
    for (const detail of ['genui-dogfood', 'a2ui-catalog'] as const) {
      const row = el.querySelector(`[data-part="surface-detail-row"][data-detail="${detail}"]`) as HTMLElement
      expect(row, `${detail} row`).not.toBeNull()
      expect(row.querySelector(`[data-part="admin-help"][data-help="${detail}"]`), `${detail} help`).not.toBeNull()
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
    // `context-turn` needs a logged turn before its fold exists — proven in its own GH #866 test below.
    for (const key of ADMIN_HELP_KEYS.filter((k) => k !== 'context-turn')) {
      const help = helpFor(el, key)
      expect(help, `${key}: no help affordance mounted`).not.toBeNull()
      const panel = panelOf(help)
      expect(panel, `${key}: ui-tooltip built no panel`).not.toBeNull()
      const text = panel.textContent ?? ''
      expect(text.trim().length, `${key}: an empty card is a broken promise`).toBeGreaterThan(0)
      expect(text, `${key}: the card carries its own entry, not another’s`).toContain(ADMIN_HELP[key].summary)
      for (const paragraph of ADMIN_HELP[key].body) expect(text).toContain(paragraph)
    }
  })

  it('each row’s native `title` hint reads from the SAME record as its card — one copy source, two renderings', async () => {
    const el = await mountAdmin()
    for (const surface of ['markdown', 'a2ui', 'genui', 'planner', 'authoring'] as const) {
      const label = el.querySelector(`[data-part="surface-row"][data-surface="${surface}"] [data-part="surface-label"]`) as HTMLElement
      expect(label.title, `${surface}`).toBe(ADMIN_HELP[surface].summary)
    }
    for (const detail of ['genui-dogfood', 'a2ui-catalog'] as const) {
      const label = el.querySelector(
        `[data-part="surface-detail-row"][data-detail="${detail}"] [data-part="surface-detail-label"]`,
      ) as HTMLElement
      expect(label.title, `${detail}`).toBe(ADMIN_HELP[detail].summary)
    }
  })

  it('the Surface tab still carries exactly its own ten (GH #844’s enumeration, widened by GH #1221’s bubbles row)', async () => {
    const el = await mountAdmin()
    const surface = el.querySelector('[data-role="surface-content"]') as HTMLElement
    expect([...surface.querySelectorAll('[data-part="admin-help"]')].map((n) => n.getAttribute('data-help')).sort()).toEqual(
      ['a2ui', 'a2ui-catalog', 'authoring', 'bubbles', 'genui', 'genui-dogfood', 'markdown', 'pattern-source', 'planner', 'surface-options'].sort(),
    )
  })
})

// ── 3b. THE WIRING, GH #866 — the three tabs the widening reaches ───────────────────────────────────

describe('ui-agent-admin — a help icon on every section header of the Agent, Capabilities and Context tabs (GH #866)', () => {
  /** A section fold's help icon, addressed through its OWN fold — a document-wide match would pass even
   *  if the icon had drifted into a different section entirely. */
  function helpOnHeadingRow(el: HTMLElement, part: string, item: string): HTMLElement | null {
    return el.querySelector(`[data-part="${part}"][data-item="${item}"] > [data-part="details"] > [data-part="summary"] [data-part="admin-help"]`)
  }

  it.each([
    ['agent', 'agent'],
    ['model', 'model'],
    ['bankroll', 'bankroll'],
  ])('the Agent tab’s %s section header carries its own icon', async (item, key) => {
    const el = await mountAdmin()
    const help = helpOnHeadingRow(el, 'settings-item', item)
    expect(help, `${item}: the icon must ride the heading row, not the fold body`).not.toBeNull()
    expect(help!.getAttribute('data-help')).toBe(key)
  })

  it.each([
    [ENTRY_KINDS.promptSection, 'prompt-section'],
    [ENTRY_KINDS.skill, 'skill'],
    [ENTRY_KINDS.workflow, 'workflow'],
    [ENTRY_KINDS.resource, 'resource'],
    [ENTRY_KINDS.tool, 'tool'],
  ])('the Capabilities tab’s %s section header carries its own icon', async (item, key) => {
    const el = await mountAdmin()
    const help = helpOnHeadingRow(el, 'settings-item', item)
    expect(help, `${item}: the icon must ride the heading row, not the fold body`).not.toBeNull()
    expect(help!.getAttribute('data-help')).toBe(key)
  })

  it('the Capabilities tab carries an icon per section and nothing stray', async () => {
    const el = await mountAdmin()
    const capabilities = el.querySelector('[data-role="capabilities-content"]') as HTMLElement
    expect([...capabilities.querySelectorAll('[data-part="admin-help"]')].map((n) => n.getAttribute('data-help')).sort()).toEqual(
      ['prompt-section', 'resource', 'skill', 'tool', 'workflow'].sort(),
    )
  })

  it('the Context: System view’s items each carry one — the compiled Agent record, then one per kind', async () => {
    const el = await mountAdmin()
    expect(helpOnHeadingRow(el, 'context-item', 'agent')?.getAttribute('data-help')).toBe('context-agent')
    for (const [kind, key] of [
      [ENTRY_KINDS.skill, 'skill'],
      [ENTRY_KINDS.workflow, 'workflow'],
      [ENTRY_KINDS.resource, 'resource'],
      [ENTRY_KINDS.tool, 'tool'],
      [ENTRY_KINDS.patternSource, 'pattern-source'],
      [ENTRY_KINDS.catalog, 'a2ui-catalog'],
    ] as const) {
      // The SAME record the editing fold uses — one concept, one explanation (GH #866's copy law).
      expect(helpOnHeadingRow(el, 'context-item', kind)?.getAttribute('data-help'), kind).toBe(key)
    }
  })

  it('the Context: Dialog view’s turn folds each carry one — the record-shape card, not per-turn copy', async () => {
    const el = await mountAdmin()
    const dialog = el.querySelector('[data-role="context-dialog-content"]') as HTMLElement
    expect(dialog.querySelectorAll('[data-part="context-turn"]'), 'anti-vacuous guard: no turns yet').toHaveLength(0)

    // Drive a real turn through the stub arm (agent-admin.test.ts's own `submit` helper, verbatim) so the
    // log actually renders a fold to assert against — never a hand-built fake node.
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'hello'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    for (let i = 0; i < 100 && dialog.querySelectorAll('[data-part="context-turn"]').length === 0; i += 1) await Promise.resolve()
    await whenFlushed()

    const turns = [...dialog.querySelectorAll('[data-part="context-turn"]')] as HTMLElement[]
    expect(turns.length, 'a turn was logged').toBeGreaterThan(0)
    for (const turn of turns) {
      const help = turn.querySelector(':scope > [data-part="details"] > [data-part="summary"] [data-part="admin-help"]')
      expect(help, 'every turn fold explains the record shape').not.toBeNull()
      expect(help!.getAttribute('data-help')).toBe('context-turn')
    }
  })

  it('every mounted icon across ALL tabs opens a non-empty card carrying its own entry', async () => {
    const el = await mountAdmin()
    for (const help of [...el.querySelectorAll('[data-part="admin-help"]')] as HTMLElement[]) {
      const key = help.getAttribute('data-help') as AdminHelpKey
      const text = panelOf(help).textContent ?? ''
      expect(text.trim().length, `${key}: an empty card is a broken promise`).toBeGreaterThan(0)
      expect(text, `${key}: the card carries its own entry, not another’s`).toContain(ADMIN_HELP[key].summary)
    }
  })

  it('every ADMIN_HELP key is actually MOUNTED somewhere — no orphan copy nobody can reach', async () => {
    const el = await mountAdmin()
    const mountedKeys = new Set([...el.querySelectorAll('[data-part="admin-help"]')].map((n) => n.getAttribute('data-help')))
    // `context-turn` alone needs a logged turn to exist, which this mount has none of — it is proven by
    // its own test above rather than by weakening this one.
    for (const key of ADMIN_HELP_KEYS) {
      if (key === 'context-turn') continue
      expect(mountedKeys.has(key), `${key}: copy exists but nothing shows it`).toBe(true)
    }
  })
})

// ── 4. THE PLACEMENT LAW (Kim, 2026-08-14 — two rulings) ────────────────────────────────────────────

describe('ui-agent-admin help placement — trailing edge, and `[?] [switch]` where a switch shares it', () => {
  /** The `data-part` sequence of a row's own element children — the arrangement, read mechanically. */
  function partsOf(row: Element): string[] {
    return [...row.children].map((child) => child.getAttribute('data-part') ?? child.tagName.toLowerCase())
  }

  it('an ELEMENT row is [switch | label | spacer | ?] — the icon at the trailing edge, never hugging the label', async () => {
    const el = await mountAdmin()
    for (const surface of ['markdown', 'a2ui', 'genui', 'planner', 'authoring'] as const) {
      const row = el.querySelector(`[data-part="surface-row"][data-surface="${surface}"]`) as HTMLElement
      expect(partsOf(row), `${surface}`).toEqual(['surface-toggle', 'surface-label', 'surface-spacer', 'admin-help'])
    }
    // The two nested detail rows follow the same grammar (the catalog header has no toggle of its own).
    const dogfood = el.querySelector('[data-part="surface-detail-row"][data-detail="genui-dogfood"]') as HTMLElement
    expect(partsOf(dogfood)).toEqual(['surface-genui-dogfood-toggle', 'surface-detail-label', 'surface-spacer', 'admin-help'])
    const catalog = el.querySelector('[data-part="surface-detail-row"][data-detail="a2ui-catalog"]') as HTMLElement
    expect(partsOf(catalog)).toEqual(['surface-detail-label', 'surface-spacer', 'admin-help'])
  })

  it('a HEADER whose trailing edge also carries a master switch is [ … | ? | switch ] — the switch outermost', async () => {
    const el = await mountAdmin()
    for (const item of ['agent', ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource]) {
      const summary = el.querySelector(`[data-part="settings-item"][data-item="${item}"] > [data-part="details"] > [data-part="summary"]`) as HTMLElement
      const parts = partsOf(summary)
      const help = parts.indexOf('admin-help')
      const master = parts.findIndex((part) => part === 'agent-enabled' || part === 'kind-enabled')
      expect(help, `${item}: a help icon on the heading row`).toBeGreaterThan(-1)
      expect(master, `${item}: a master switch on the heading row`).toBeGreaterThan(-1)
      expect(help, `${item}: the ? sits BEFORE the switch (Kim, 2026-08-14 ruling 1)`).toBeLessThan(master)
      expect(master, `${item}: the switch keeps the outermost position`).toBe(parts.length - 1)
    }
  })

  it('a switch-less HEADER ends with the icon — nothing trails it', async () => {
    const el = await mountAdmin()
    for (const [part, item] of [
      ['settings-item', 'surface'],
      ['settings-item', 'model'],
      ['settings-item', 'bankroll'],
      ['settings-item', ENTRY_KINDS.promptSection],
      ['context-item', 'agent'],
    ] as const) {
      const summary = el.querySelector(`[data-part="${part}"][data-item="${item}"] > [data-part="details"] > [data-part="summary"]`) as HTMLElement
      expect(partsOf(summary).at(-1), `${item}`).toBe('admin-help')
    }
  })
})

// ── 5. THE OPT-IN SEAM'S DEFAULT-OFF HALF ───────────────────────────────────────────────────────────

describe('the entry-list section opt-in is default-OFF (GH #866 — the shared primitive stays untouched)', () => {
  const sink = { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true }

  it('a bare mountEntryList section mounts ZERO help icons — every other consumer renders byte-identically', () => {
    // Even for a kind agent-admin DOES opt in for: the primitive is headless (GH #225), so the icon can
    // only ever be minted by the consumer that owns the fold, never by this call.
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.tool, ENTRY_KINDS.promptSection, 'some-other-consumer']) {
      const section = mountEntryList(kind, 'Add item', sink)
      expect(section.host.querySelectorAll('[data-part="admin-help"]'), kind).toHaveLength(0)
    }
  })

  it('inside the mounted admin, an opted-in kind’s icon is on the FOLD, never inside the entry-list host', async () => {
    const el = await mountAdmin()
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.tool, ENTRY_KINDS.promptSection] as const) {
      const entrySection = el.querySelector(`[data-part="entry-section"][data-kind="${kind}"]`) as HTMLElement
      expect(entrySection, `${kind}: mounted`).not.toBeNull()
      expect(entrySection.querySelectorAll('[data-part="admin-help"]'), `${kind}: the list body owns no icon`).toHaveLength(0)
    }
  })
})

describe('ui-agent-admin Surface-tab help — the keyboard path, end to end', () => {
  it('role=tooltip + aria-describedby are ui-tooltip’s own wiring, never bypassed', async () => {
    const el = await mountAdmin()
    for (const key of ADMIN_HELP_KEYS.filter((k) => k !== 'context-turn')) {
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
