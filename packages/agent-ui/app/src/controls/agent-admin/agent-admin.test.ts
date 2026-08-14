import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
import { defaultAgentConfigSchema, SUPPORTED_MODELS, DEFAULT_MODEL_ID, SURFACE_MARKDOWN_KEY, SURFACE_A2UI_KEY, SURFACE_PLANNER_KEY, A2UI_CATALOG_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID, sanitizeCatalog } from './agent-admin-schema.ts'
import { ENTRY_KINDS, initialEntryValues, composeSystemPrompt, DEFAULT_SYSTEM_PROMPT_FALLBACK } from './entries.ts'
import { entriesStoreKey, readEntries, type Entry, type EntryLibraryPack, type NewEntryInput } from '../entry-list/entry-data.ts'
import { mountEntryList, showAddError, type EntryListHandlers } from '../entry-list/entry-list.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
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

// jsdom probes for ui-agent-admin (TKT-0039, ADR-0131/ADR-0132). jsdom cannot resolve CSS container-
// query/flex layout — the actual visual geometry is agent-admin.browser.test.ts's job (the
// master-detail.test.ts / master-detail.browser.test.ts split, mirrored). This file proves: the
// connect-time composition (GH #52/ADR-0154, re-hosted by ADR-0179, flattened onto a direct
// `ui-super-shell` composition by GH #700: ONE ui-super-shell hosting the pane
// nav in `header` and the Chat/Author/Settings places in `content` — the Settings place composing the
// Agent config + four capability entry-lists, the prompt-section entry-list), the generic entry-list
// primitive's own behavior (toggle/edit/delete/add,
// fail-closed validation, built-in non-deletability), the composed-prompt + enabled-capabilities
// live-apply wiring, persistence across a real reload, reconnect idempotence, and the descriptor's
// structural + contract↔props + contract↔source trip-wires.

// jsdom reality (the conversation.test.ts precedent, code-reviewer BLOCKER finding — this file composes
// ui-switch/ui-textarea via entry-list.ts, and jsdom's ElementInternals carries no real setFormValue/
// setValidity): stubbed for this file's duration so every real composed FACE form control can connect
// without an uncaught teardown exception failing the whole run despite every assertion passing.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear() // the default store's persistKey ('ui-agent-admin') must not leak state across tests
})

function mount(el: UIAgentAdminElement): UIAgentAdminElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

function entryEl(el: Element, kind: string, entryId: string): HTMLElement {
  const section = el.querySelector(`[data-part="entry-section"][data-kind="${kind}"]`) as HTMLElement
  return section.querySelector(`[data-part="entry"][data-entry-id="${entryId}"]`) as HTMLElement
}

function toggleOf(row: HTMLElement): HTMLElement & { checked: boolean } {
  return row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
}

function contentFieldOf(row: HTMLElement): HTMLTextAreaElement {
  return row.querySelector('[data-part="entry-content"]') as HTMLTextAreaElement
}

// GH #52/ADR-0154, re-hosted by ADR-0179, composed DIRECTLY since GH #700 flattened out the
// intermediate `ui-chat-shell` preset — the responsive shell is ui-super-shell's OWN
// grammar (SPEC-R6/R7): header=pane nav, content=the pane holder (Chat/Author⇄Settings). The old
// options-pane end + `narrow-end="tabs"` six-entry vocabulary retired with cl.1 (admin-three-pane-ia
// .lld.md §7), which itself replaced TKT-0085's ResizeObserver-driven reparenting — there is no width
// threshold in this element anymore, and content is authored once, never moved. jsdom cannot resolve
// the real container query (super-shell.browser.test.ts's own precedent), but the place/pane-nav
// SWITCHING is pure JS/DOM behavior, independent of which band is actually painted — this file proves
// that DOM behavior; agent-admin.browser.test.ts proves the real cross-engine geometry/survival.
// ── ADR-0170 cl.8 (LLD-C2) — the entry-list's per-kind PRESENTATION vocabulary ─────────────────────────
// `mountEntryList` is driven DIRECTLY here (not through the composed element) so both halves are proven
// on the primitive itself: the suppression a registry-keyed kind needs, and — the load-bearing half — the
// default-true backward compat every pre-existing call site depends on.

describe('mountEntryList — customAdd/contentField (ADR-0170 cl.8)', () => {
  const sink: EntryListHandlers = { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true }
  const ROW: Entry = { id: 'a', kind: 'catalog', label: 'A', description: 'about A', content: 'body', order: 0, enabled: true, builtin: false }
  const PACK: EntryLibraryPack = { id: 'p', label: 'Pack', description: 'a pack', entries: [{ label: 'From pack', description: '', content: '' }] }

  it('ABSENT options ⇒ byte-identical render: add-toggle, add-form and the per-entry content editor all mount', () => {
    const section = mountEntryList('skill', 'Add skill', sink)
    section.render([ROW])
    expect(section.host.querySelector('[data-part="entry-add-toggle"]')).not.toBeNull()
    expect(section.host.querySelector('[data-part="entry-add-form"]')).not.toBeNull()
    expect(section.host.querySelector('[data-part="entry-content"]')).not.toBeNull()
  })

  it('explicit `true` is the same as absent (the option is a suppression switch, not a feature flag)', () => {
    const section = mountEntryList('skill', 'Add skill', sink, { customAdd: true, contentField: true })
    section.render([ROW])
    expect(section.host.querySelector('[data-part="entry-add-toggle"]')).not.toBeNull()
    expect(section.host.querySelector('[data-part="entry-add-form"]')).not.toBeNull()
    expect(section.host.querySelector('[data-part="entry-content"]')).not.toBeNull()
  })

  it('customAdd:false suppresses BOTH authoring affordances — and leaves the library menu untouched', () => {
    const section = mountEntryList('catalog', 'Add catalog', sink, { customAdd: false, libraries: [PACK] })
    section.render([ROW])
    expect(section.host.querySelector('[data-part="entry-add-toggle"]'), 'no add-toggle button').toBeNull()
    expect(section.host.querySelector('[data-part="entry-add-form"]'), 'no authoring form').toBeNull()
    expect(section.host.querySelector('[data-part="entry-library-menu"]'), 'the library menu is the ONLY add path').not.toBeNull()
  })

  it('contentField:false renders label + description + switch, and nothing else', () => {
    const section = mountEntryList('catalog', 'Add catalog', sink, { contentField: false })
    section.render([ROW])
    const row = section.host.querySelector('[data-part="entry"]') as HTMLElement
    expect(row.querySelector('[data-part="entry-content"]'), 'no per-entry content editor').toBeNull()
    expect(row.querySelector('[data-part="entry-toggle"]')).not.toBeNull()
    expect(row.querySelector('[data-part="entry-label"]')!.textContent).toBe('A')
    expect(row.querySelector('[data-part="entry-description"]')!.textContent).toBe('about A')
  })

  it('updateLibraries still swaps the menu in place when the add-form anchor is suppressed (and keeps it LAST)', () => {
    const section = mountEntryList('catalog', 'Add catalog', sink, { customAdd: false, contentField: false, libraries: [PACK] })
    section.render([ROW])
    const other: EntryLibraryPack = { ...PACK, id: 'q', label: 'Other' }
    expect(() => section.updateLibraries([other])).not.toThrow()
    const menus = section.host.querySelectorAll('[data-part="entry-library-menu"]')
    expect(menus, 'one menu, swapped — never two').toHaveLength(1)
    expect(section.host.lastElementChild).toBe(menus[0])
    expect(menus[0]!.textContent).toContain('Other')
    // …and removing every pack removes the affordance entirely, same as any other kind.
    section.updateLibraries([])
    expect(section.host.querySelector('[data-part="entry-library-menu"]')).toBeNull()
  })

  it('showAddError on a customAdd:false section is a silent no-op, never a null-deref throw', () => {
    const section = mountEntryList('catalog', 'Add catalog', sink, { customAdd: false })
    section.render([ROW])
    expect(() => showAddError(section, 'A name is required.')).not.toThrow()
  })
})

// ── GH #850 / capability-availability-tagging.spec.md SPEC-R2 — the per-entry availability affordance ─────
// Driven on the PRIMITIVE (like the cl.8 block above) so both halves are proven where they live: the
// opt-in's own render/write behaviour, and — load-bearing — the byte-identical default every existing
// caller depends on. The composed-element half (which kinds opt in, persistence, re-mount) is further down.

describe('mountEntryList — availabilityToggle (SPEC-R2)', () => {
  const ROW: Entry = { id: 'menu-pdf', kind: 'resource', label: 'Menu PDF', description: 'The menu.', content: 'body', order: 0, enabled: true, builtin: false }
  const sink: EntryListHandlers = { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true }
  const availabilityOf = (section: { host: HTMLElement }): (HTMLElement & { pressed: boolean }) | null =>
    section.host.querySelector('[data-part="entry-availability"]') as (HTMLElement & { pressed: boolean }) | null

  it('AC1 — ABSENT option ⇒ byte-identical row: no mode control, and no `data-availability` marker attribute', () => {
    const section = mountEntryList('resource', 'Add resource', sink)
    section.render([ROW, { ...ROW, id: 'other', availability: 'invocable' }])
    expect(availabilityOf(section), 'no control mounts').toBeNull()
    for (const row of section.host.querySelectorAll('[data-part="entry"]')) {
      // Even a row whose STORED entry is invocable renders unmarked here: availability is inert for a kind
      // that never opted in (SPEC-R1's four-kinds-only clause), and the row's attribute set is unchanged.
      expect(row.hasAttribute('data-availability')).toBe(false)
    }
  })

  it('renders the pill + the at-a-glance row marker, pressed state reflecting the stored mode', () => {
    const section = mountEntryList('resource', 'Add resource', sink, { availabilityToggle: true })
    section.render([ROW])
    const row = (): HTMLElement => section.host.querySelector('[data-part="entry"]') as HTMLElement
    expect(availabilityOf(section)!.pressed, 'a field-less entry reads in-context').toBe(false)
    expect(row().getAttribute('data-availability')).toBe('context')

    section.render([{ ...ROW, availability: 'invocable' }])
    expect(availabilityOf(section)!.pressed).toBe(true)
    expect(row().getAttribute('data-availability'), 'the marker the row carries at a glance').toBe('invocable')
    expect(availabilityOf(section)!.getAttribute('aria-label')).toBe('Menu PDF user-invocable')
  })

  it("a BUILTIN entry's mode is as editable as its enabled toggle (ADR-0132 Fork 4 protects deletion, not configuration)", () => {
    const section = mountEntryList('resource', 'Add resource', sink, { availabilityToggle: true })
    section.render([{ ...ROW, builtin: true }])
    expect(section.host.querySelector('[data-part="entry-delete"]'), 'still no delete affordance').toBeNull()
    expect(availabilityOf(section), 'but the mode control is there').not.toBeNull()
  })

  it('a commit calls onAvailabilityChange with the mode the row is flipping TO — both directions', () => {
    const writes: Array<[string, string]> = []
    const handlers: EntryListHandlers = { ...sink, onAvailabilityChange: (id, availability) => writes.push([id, availability]) }
    const section = mountEntryList('resource', 'Add resource', handlers, { availabilityToggle: true })

    section.render([ROW]) // in-context ⇒ a press asks for invocable
    availabilityOf(section)!.dispatchEvent(new CustomEvent('toggle', { cancelable: true }))
    section.render([{ ...ROW, availability: 'invocable' }]) // invocable ⇒ a press asks for context
    availabilityOf(section)!.dispatchEvent(new CustomEvent('toggle', { cancelable: true }))
    expect(writes).toEqual([
      ['menu-pdf', 'invocable'],
      ['menu-pdf', 'context'],
    ])
  })

  it("NO writer wired ⇒ the flip is REFUSED (toggle.md's cancelable contract), never a pill painting a mode no store holds", () => {
    const section = mountEntryList('resource', 'Add resource', sink, { availabilityToggle: true })
    section.render([ROW])
    const event = new CustomEvent('toggle', { cancelable: true })
    availabilityOf(section)!.dispatchEvent(event)
    expect(event.defaultPrevented, 'refused before ui-toggle commits `pressed`').toBe(true)
  })
})

// ── GH #848 — the rename OPTION on the primitive itself (both polarities, the ADR-0170 cl.8 discipline) ──
describe('mountEntryList — the rename option (GH #848)', () => {
  const ROW: Entry = { id: 'a', kind: 'skill', label: 'A', description: 'about A', content: 'body', order: 0, enabled: true, builtin: false }
  const BUILTIN: Entry = { ...ROW, id: 'b', label: 'B', order: 1, builtin: true }

  it('ABSENT ⇒ byte-identical rows: no rename trigger anywhere', () => {
    const section = mountEntryList('skill', 'Add skill', { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true, onRename: () => {} })
    section.render([ROW])
    expect(section.host.querySelector('[data-part="entry-rename"]'), 'the handler alone renders nothing').toBeNull()
  })

  it('the option WITHOUT the handler renders nothing either (both gates, so neither half can ship half-wired)', () => {
    const section = mountEntryList('skill', 'Add skill', { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true }, { rename: true })
    section.render([ROW])
    expect(section.host.querySelector('[data-part="entry-rename"]')).toBeNull()
  })

  it('option + handler ⇒ every row gets a trigger, BUILTIN rows included (Fork 4 protects deletion, not configuration)', () => {
    const renames: Array<[string, string]> = []
    const section = mountEntryList(
      'skill',
      'Add skill',
      { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true, onRename: (id, label) => renames.push([id, label]) },
      { rename: true },
    )
    section.render([ROW, BUILTIN])
    const rows = [...section.host.querySelectorAll<HTMLElement>('[data-part="entry"]')]
    expect(rows.map((r) => r.querySelector('[data-part="entry-rename"]') !== null)).toEqual([true, true])
    // The builtin row still has no DELETE affordance — the two are independent (regression fence).
    expect(rows[1]!.querySelector('[data-part="entry-delete"]')).toBeNull()

    // Commit through the builtin row: the handler gets the RAW typed text and the entry's own id.
    ;(rows[1]!.querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = rows[1]!.querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    expect(field.value, 'pre-filled with the name being changed').toBe('B')
    field.value = '  Renamed B  '
    field.dispatchEvent(new Event('change'))
    expect(renames, 'raw text — the trim is renameEntry\'s one home').toEqual([['b', '  Renamed B  ']])
    expect(rows[1]!.querySelector('[data-part="entry-rename-field"]'), 'the field closed on commit').toBeNull()
    expect(rows[1]!.querySelector('[data-part="entry-label"]')!.textContent, 'and the label shows the trimmed name').toBe('Renamed B')
  })

  it('an EMPTY commit calls nothing and puts the stored name back (the visible refusal)', () => {
    const renames: string[] = []
    const section = mountEntryList(
      'skill',
      'Add skill',
      { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true, onRename: (id) => renames.push(id) },
      { rename: true },
    )
    section.render([ROW])
    const row = section.host.querySelector('[data-part="entry"]') as HTMLElement
    ;(row.querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row.querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    field.value = '   '
    field.dispatchEvent(new Event('change'))
    expect(renames, 'no write attempt at all').toEqual([])
    expect(row.querySelector('[data-part="entry-label"]')!.textContent).toBe('A')
  })

  it('an external render() while a rename is open drops it cleanly — never a throw, never a stale field', () => {
    const section = mountEntryList(
      'skill',
      'Add skill',
      { onToggle: () => {}, onContentChange: () => {}, onDelete: () => {}, onAdd: () => true, onRename: () => {} },
      { rename: true },
    )
    section.render([ROW])
    const row = section.host.querySelector('[data-part="entry"]') as HTMLElement
    ;(row.querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    expect(row.querySelector('[data-part="entry-rename-field"]')).not.toBeNull()
    // A sibling toggle / an external store write rebuilds the list under the open field.
    expect(() => section.render([ROW, BUILTIN])).not.toThrow()
    expect(section.host.querySelectorAll('[data-part="entry-rename-field"]'), 'the rebuilt rows are all closed').toHaveLength(0)
    expect([...section.host.querySelectorAll('[data-part="entry-label"]')].map((n) => n.textContent)).toEqual(['A', 'B'])
  })
})

// ── GH #848 — WHICH kinds the composed element flags (the four capability kinds, nothing else) ───────────
describe('UIAgentAdminElement — the rename affordance is scoped to the four capability kinds (GH #848)', () => {
  it('Skills/Workflows/Resources/Tools rows carry a rename trigger; prompt-section and catalog rows do NOT', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    // One entry per capability kind, plus the seeded prompt sections and the ensured Default catalog row.
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource]) {
      el.store!.set(entriesStoreKey(kind), [
        { id: 'one', kind, label: 'One', description: '', content: '', order: 0, enabled: true, builtin: false },
      ] satisfies Entry[])
    }
    await whenFlushed()

    const hasRename = (kind: string): boolean =>
      (el.querySelector(`[data-part="entry-section"][data-kind="${kind}"] [data-part="entry"] [data-part="entry-rename"]`) ?? null) !== null

    expect(hasRename(ENTRY_KINDS.skill)).toBe(true)
    expect(hasRename(ENTRY_KINDS.workflow)).toBe(true)
    expect(hasRename(ENTRY_KINDS.resource)).toBe(true)
    expect(hasRename(ENTRY_KINDS.tool)).toBe(true)
    // A prompt-section label IS the composed prompt's `## {label}` heading; a pattern-source/catalog row's
    // label mirrors the pack/registry entry its id keys — none of them free display text.
    expect(hasRename(ENTRY_KINDS.promptSection), 'Instructions rows are unchanged').toBe(false)
    expect(hasRename(ENTRY_KINDS.patternSource), 'Pattern sources rows are unchanged').toBe(false)
    expect(hasRename(ENTRY_KINDS.catalog), 'Catalog rows are unchanged').toBe(false)
  })

  it('a rename persists across a reload — a SECOND element instance on the same default store reads the new name', async () => {
    const first = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    first.store!.set(entriesStoreKey(ENTRY_KINDS.skill), [
      { id: 'web-search', kind: ENTRY_KINDS.skill, label: 'Web search', description: '', content: 'Search the web.', order: 0, enabled: true, builtin: false },
    ] satisfies Entry[])
    await whenFlushed()

    const row = entryEl(first, ENTRY_KINDS.skill, 'web-search')
    ;(row.querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row.querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    field.value = 'Research'
    field.dispatchEvent(new Event('change'))
    await whenFlushed()

    const second = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed()
    const reloaded = readEntries(second.store, ENTRY_KINDS.skill)
    expect(reloaded, 'one entry, same id').toEqual([{ id: 'web-search', kind: ENTRY_KINDS.skill, label: 'Research', description: '', content: 'Search the web.', order: 0, enabled: true, builtin: false }])
    expect(entryEl(second, ENTRY_KINDS.skill, 'web-search').querySelector('[data-part="entry-label"]')!.textContent).toBe('Research')
  })

  // GH #848 × GH #850 — the composed element hands BOTH opt-ins to the same four sections. Proven on the
  // rendered DOM (not from the options object) that each capability row carries both controls, and that the
  // three non-capability sections carry neither — one assertion pass over both features, so a future kind
  // added to one list and not the other shows up here as a mismatch rather than as a silent asymmetry.
  it('every capability row carries BOTH the rename trigger and the mode pill; the other three sections carry neither', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource]) {
      el.store!.set(entriesStoreKey(kind), [
        { id: 'one', kind, label: 'One', description: '', content: '', order: 0, enabled: true, builtin: false },
      ] satisfies Entry[])
    }
    await whenFlushed()

    const affordances = (kind: string): { rename: boolean; mode: boolean } => {
      const row = el.querySelector(`[data-part="entry-section"][data-kind="${kind}"] [data-part="entry"]`) as HTMLElement | null
      return {
        rename: row?.querySelector('[data-part="entry-rename"]') != null,
        mode: row?.querySelector('[data-part="entry-availability"]') != null,
      }
    }
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]) {
      expect(affordances(kind), `${kind} rows carry both`).toEqual({ rename: true, mode: true })
    }
    for (const kind of [ENTRY_KINDS.promptSection, ENTRY_KINDS.patternSource, ENTRY_KINDS.catalog]) {
      expect(affordances(kind), `${kind} rows carry neither`).toEqual({ rename: false, mode: false })
    }
  })
})

describe('UIAgentAdminElement — shell composition (ADR-0179): the three places + the settings sub-nav', () => {
  it('composes ONE ui-super-shell directly: header=the S7-c unified header bar, content=three sibling regions (chat/settings/copilot) — GH #686\'s Amendment, GH #700\'s flatten', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const shell = el.querySelector(':scope > ui-super-shell') as HTMLElement
    expect(shell).not.toBeNull()
    // ADR-0179 cl.1 / LLD §7 — the end side retired with the options-pane the settings region left.
    expect(shell.hasAttribute('resizable-end'), 'the retired end-side attrs are gone').toBe(false)
    expect(shell.hasAttribute('narrow-end'), 'the six-entry narrow-tabs vocabulary is gone').toBe(false)
    expect(el.querySelector('[data-slot-name="options-pane"]'), 'nothing occupies the options-pane slot any more').toBeNull()

    // LLD §16.4 S7-c row — the pane nav retires; the replacement is the unified header bar (a different
    // shape — agent select + pane pills/segments + page actions — never a restoration of the old nav).
    const header = el.querySelector('[data-slot="header"]') as HTMLElement
    expect(header, 'S7-c composes the unified header bar').not.toBeNull()
    expect(header.getAttribute('data-part')).toBe('admin-header')
    expect(el.querySelector('[data-part="pane-nav-bar"]'), 'the retired pane-nav bar').toBeNull()
    expect(el.querySelector('[data-part="pane-nav"]'), 'the retired pane nav').toBeNull()
    // LLD §16.1's anatomy — three zones, in DOM order.
    expect(header.querySelector('[data-part="agent-select"]')).not.toBeNull()
    expect(header.querySelector('[data-part="pane-pills"]')).not.toBeNull()
    expect(header.querySelector('[data-part="pane-segments"]')).not.toBeNull()
    expect(header.querySelector('[data-part="header-actions"]')).not.toBeNull()

    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.getAttribute('data-slot')).toBe('content')
    // LLD §16.5 — the TOP-LEVEL MD pairing vehicle retires: no ui-master-detail/-pane as a DIRECT child of
    // the pane holder, no back-affordance-suppression target left to suppress. Scoped to the holder's own
    // children, deliberately: `ui-settings` composes its OWN unrelated rail|panel `ui-master-detail`
    // nested inside the Settings region (settings.ts), which this slice never touches.
    expect([...holder.children].some((c) => c.tagName.toLowerCase().startsWith('ui-master-detail')), 'the pairing vehicle is gone from the holder').toBe(false)
    expect(el.querySelector('[data-part="pane-pair"]')).toBeNull()
    expect(el.querySelector('[data-part="author-pane"]')).toBeNull()

    // LLD §16.1's anatomy — three sibling regions, direct children of the holder, in PANE_ORDER.
    const regions = [...holder.children] as HTMLElement[]
    expect(regions.map((r) => r.getAttribute('data-part')), 'DOM order is PANE_ORDER: chat · settings · copilot').toEqual([
      'chat-pane', 'settings-pane', 'copilot-pane',
    ])
    expect(regions[0]!.tagName.toLowerCase()).toBe('ui-conversation')
    expect(regions[2]!.tagName.toLowerCase()).toBe('ui-conversation')

    const settingsPane = regions[1]!
    const segmentLabels = [...settingsPane.querySelectorAll(':scope > [data-segment]')].map((s) => s.getAttribute('data-segment'))
    expect(segmentLabels).toEqual(['Agent', 'Capabilities', 'Surface', 'Context: System', 'Context: Dialog'])
  })

  it('LLD §16.2 — the shown-set/primary visibility truth-table: data-show/data-primary agree with the seam at every combination, min-one is refused, and the primary auto-repoints off its own set', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    const seam = (shown: readonly ('chat' | 'settings' | 'copilot')[], primary: 'chat' | 'settings' | 'copilot'): void =>
      (el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(shown, primary)
    const state = (): { show: string | null; primary: string | null } => ({
      show: holder.getAttribute('data-show'),
      primary: holder.getAttribute('data-primary'),
    })

    // Entry default (OQ-D's rec, LLD §16.2/§16.4): all three shown, Chat primary.
    expect(state()).toEqual({ show: 'chat settings copilot', primary: 'chat' })

    // The full set×primary truth-table — every subset that includes the chosen primary.
    const cases: Array<{ shown: readonly ('chat' | 'settings' | 'copilot')[]; primary: 'chat' | 'settings' | 'copilot'; show: string }> = [
      { shown: ['chat'], primary: 'chat', show: 'chat' },
      { shown: ['settings'], primary: 'settings', show: 'settings' },
      { shown: ['copilot'], primary: 'copilot', show: 'copilot' },
      { shown: ['chat', 'settings'], primary: 'chat', show: 'chat settings' },
      { shown: ['settings', 'copilot'], primary: 'copilot', show: 'settings copilot' },
      { shown: ['chat', 'copilot'], primary: 'copilot', show: 'chat copilot' },
      { shown: ['chat', 'settings', 'copilot'], primary: 'settings', show: 'chat settings copilot' },
    ]
    for (const c of cases) {
      seam(c.shown, c.primary)
      // `data-show` is always composed in PANE_ORDER (reading order), independent of the caller's argument
      // order — the truth-table's own reading-order invariant.
      expect(state(), JSON.stringify(c)).toEqual({ show: c.show, primary: c.primary })
    }

    // Min-one refusal (LLD §16.2's "a zero-pane surface is broken by construction"): an empty shown set is
    // a no-op — the previous state stands, byte-identical.
    seam(['settings'], 'settings')
    seam([], 'chat')
    expect(state(), 'refused — the last state before the empty call stands').toEqual({ show: 'settings', primary: 'settings' })

    // Primary auto-repoint: a `primary` argument outside `shown` repoints to the first remaining member in
    // PANE_ORDER (the "removing the primary repoints it to the first remaining member in reading order"
    // rule, general-cased beyond the pill-removal scenario it was written for).
    seam(['settings', 'copilot'], 'chat')
    expect(state(), 'primary not in shown ⇒ repoints to the first PANE_ORDER member that IS').toEqual({ show: 'settings copilot', primary: 'settings' })
  })

  it('GH #574: the old single config column splits into three ranked segments — Agent, Capabilities, Surface; each Context segment still carries ONLY its own accordion — no cross-segment leakage', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const agent = el.querySelector('[data-segment="Agent"]') as HTMLElement
    const capabilities = el.querySelector('[data-segment="Capabilities"]') as HTMLElement
    const surface = el.querySelector('[data-segment="Surface"]') as HTMLElement
    const contextSystem = el.querySelector('[data-segment="Context: System"]') as HTMLElement
    const contextDialog = el.querySelector('[data-segment="Context: Dialog"]') as HTMLElement

    expect(agent.matches('[data-role="agent-content"]')).toBe(true)
    expect(agent.querySelector('[data-part="settings-item"][data-item="agent"]')).not.toBeNull()
    // Agent tab (who it is) carries no entry-section — Agent/Model/Bankroll only.
    expect(agent.querySelector('[data-part="entry-section"]')).toBeNull()

    expect(capabilities.matches('[data-role="capabilities-content"]')).toBe(true)
    expect(capabilities.querySelector('[data-part="settings-item"] [data-part="entry-section"]')).not.toBeNull()

    expect(surface.matches('[data-role="surface-content"]')).toBe(true)
    expect(surface.querySelector('[data-part="settings-item"][data-item="surface"]')).not.toBeNull()
    expect(surface.querySelector('[data-part="settings-item"] [data-part="entry-section"]')).not.toBeNull()

    expect(contextSystem.matches('[data-role="context-system-content"]')).toBe(true)
    expect(contextSystem.querySelector('[data-role="context-dialog-content"]')).toBeNull()
    expect(contextSystem.querySelector('[data-part="context-turns"]')).toBeNull()
    expect(contextDialog.matches('[data-role="context-dialog-content"]')).toBe(true)
    expect(contextDialog.querySelector('[data-role="context-system-content"]')).toBeNull()
    expect(contextDialog.querySelector('[data-part="context-system"]')).toBeNull()
  })

  it('clicking the settings sub-nav switches which section is visible — visibility-only, never a reparent (OQ2, SPEC-R7c`s own behavior)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settingsPane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const agent = settingsPane.querySelector('[data-segment="Agent"]') as HTMLElement
    const contextSystem = settingsPane.querySelector('[data-segment="Context: System"]') as HTMLElement
    expect([agent.hidden, contextSystem.hidden], 'the first section opens active').toEqual([false, true])
    const tabs = [...settingsPane.querySelectorAll('[data-part="settings-nav"] ui-tab')]
    expect(tabs.map((t) => t.textContent), 'scaffolded mechanically from the kept data-segment labels, in today\'s order').toEqual([
      'Agent', 'Capabilities', 'Surface', 'Context: System', 'Context: Dialog',
    ])
    ;(tabs.find((t) => t.textContent === 'Context: System') as HTMLElement).click()
    expect([agent.hidden, contextSystem.hidden]).toEqual([true, false])
    expect(agent.isConnected, 'switching sections never reparents').toBe(true)
  })

  // ── LLD-P6 (GH #656, S2-a) — the grouping pass: the five sections group behind the sub-nav, the
  // grouping ruled final at GH #574's ranked five, and identity separated from display copy. ──────────
  it('LLD-P6: EXACTLY one section is visible for every one of the five selections — the full truth table, not a sampled pair', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const sections = [...pane.querySelectorAll<HTMLElement>(':scope > [data-segment]')]
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    expect(sections).toHaveLength(5)
    expect(tabs).toHaveLength(5)

    /** The visible section's own label — the truth table's single cell (a6: one, and exactly one). */
    const visible = (): string[] => sections.filter((s) => !s.hidden).map((s) => s.getAttribute('data-segment')!)

    expect(visible(), 'entry: the first section alone').toEqual(['Agent'])
    for (const label of ['Agent', 'Capabilities', 'Surface', 'Context: System', 'Context: Dialog']) {
      tabs.find((t) => t.textContent === label)!.click()
      expect(visible(), `${label} selected ⇒ ${label} alone`).toEqual([label])
    }
    // …and back to the first, so the table is closed rather than one-way.
    tabs[0].click()
    expect(visible()).toEqual(['Agent'])
  })

  it('LLD-P6: every tab is keyed by its section`s stable `data-role`, labelled by its `data-segment` — identity is never the display copy', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const sections = [...pane.querySelectorAll<HTMLElement>(':scope > [data-segment]')]
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]

    expect(tabs.map((t) => t.getAttribute('key')), 'keys are the roles').toEqual([
      'agent-content', 'capabilities-content', 'surface-content', 'context-system-content', 'context-dialog-content',
    ])
    expect(tabs.map((t) => t.textContent), 'labels are the human copy, in GH #574`s ranked order').toEqual([
      'Agent', 'Capabilities', 'Surface', 'Context: System', 'Context: Dialog',
    ])
    expect(tabs.map((t) => t.getAttribute('key')), 'key ↔ section pairing is positional and total').toEqual(
      sections.map((s) => s.getAttribute('data-role')),
    )
    // The point of the separation, exercised: re-label a section and selection still resolves — the
    // failure mode S1-b's label-as-key shape would have had (a blank pane on a copy edit).
    sections[3].setAttribute('data-segment', 'System context')
    tabs.find((t) => t.getAttribute('key') === 'context-system-content')!.click()
    expect(sections.filter((s) => !s.hidden).map((s) => s.getAttribute('data-role'))).toEqual(['context-system-content'])
  })

  it('LLD-P6: section state survives a sub-nav flip away and back — a committed entry, an uncommitted dirty field, and a fold`s open state all outlive the flip (nothing unmounts)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const pane = el.querySelector('[data-part="settings-pane"]') as HTMLElement
    const tabs = [...pane.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    const goToSection = (label: string): void => void tabs.find((t) => t.textContent === label)!.click()

    goToSection('Capabilities')
    // (a) a COMMITTED entry — the add-form's full submit path (the section re-renders its list).
    const skills = (): HTMLElement => el.querySelector('[data-kind="skill"]') as HTMLElement
    ;(skills().querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = 'Web search'
    ;(skills().querySelector('[data-part="entry-add-description"]') as UITextFieldElement).value = 'Searches the web'
    ;(skills().querySelector('[data-part="entry-add-content"]') as HTMLTextAreaElement).value = 'search(query)'
    ;(skills().querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    expect(readEntries(el.store, ENTRY_KINDS.skill).map((e) => e.id)).toEqual(['web-search'])

    // (b) an UNCOMMITTED dirty field — typed into the reopened add-form, never submitted. This is the
    // state a re-mount would silently eat, and the one a `hidden` flip must not.
    ;(skills().querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const dirtyField = skills().querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    dirtyField.value = 'Half-typed skill'
    // (c) a fold's open state — Instructions collapsed by hand (folds default open).
    const instructions = el.querySelector('[data-part="settings-item"][data-item="prompt-section"]') as HTMLElement & { open: boolean }
    instructions.open = false

    goToSection('Context: Dialog')
    goToSection('Agent')
    goToSection('Capabilities')

    expect(readEntries(el.store, ENTRY_KINDS.skill).map((e) => e.id), 'the committed entry survives').toEqual(['web-search'])
    expect([...skills().querySelectorAll('[data-part="entry-label"]')].map((n) => n.textContent)).toContain('Web search')
    expect(skills().querySelector('[data-part="entry-add-label"]'), 'the SAME field node — never re-created').toBe(dirtyField)
    expect(dirtyField.value, 'the uncommitted keystrokes survive the flip').toBe('Half-typed skill')
    expect((skills().querySelector('[data-part="entry-add-form"]') as HTMLElement).hidden, 'the form stays open too').toBe(false)
    expect(el.querySelector('[data-part="settings-item"][data-item="prompt-section"]'), 'the same fold node').toBe(instructions)
    expect(instructions.open, 'the hand-collapsed fold stays collapsed').toBe(false)
  })

  it('the settings sub-nav`s select never escapes the admin host either', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const seen: string[] = []
    el.addEventListener('select', () => seen.push('select'))
    const tabs = [...el.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    tabs.find((t) => t.textContent === 'Surface')!.click()
    expect(seen).toEqual([])
  })

  it('content nodes are the SAME identity across repeated visibility-set flips — three sibling regions ARRANGED, never rebuilt or duplicated or reparented (cl.3, LLD §16.2/§16.5) — isSameNode-verified', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const seam = (shown: readonly ('chat' | 'settings' | 'copilot')[], primary: 'chat' | 'settings' | 'copilot'): void =>
      (el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(shown, primary)

    const chatPane = el.querySelector('[data-part="chat-pane"]') as Node
    const settingsPaneEl = el.querySelector('[data-part="settings-pane"]') as Node
    const copilotPane = el.querySelector('[data-part="copilot-pane"]') as Node
    const agentItem = el.querySelector('[data-part="settings-item"][data-item="agent"]') as Node
    const agentSection = el.querySelector('[data-segment="Agent"]') as Node
    // The FIRST entry-section in document order (GH #574: the Capabilities tab now precedes the Surface
    // tab, so Instructions' entry-section — not the catalog picker nested in Surface Options — is first;
    // this probe only cares about node identity surviving a flip, not which kind is first).
    const firstEntrySection = el.querySelector('[data-part="entry-section"]') as Node

    const sections = [...el.querySelectorAll('[data-part="settings-nav"] ui-tab')] as HTMLElement[]
    // Flip through every arrangement a visibility-set change can produce — solo copilot, solo settings, the
    // whole triple, back to the entry default — plus a settings sub-nav flip along the way (a SEPARATE
    // visibility axis, one level down, that must survive the outer flips too).
    seam(['copilot'], 'copilot')
    sections.find((t) => t.textContent === 'Context: System')!.click()
    seam(['settings'], 'settings')
    sections.find((t) => t.textContent === 'Agent')!.click()
    seam(['chat', 'settings', 'copilot'], 'chat')

    // isSameNode, not `toBe` alone — the explicit DOM-identity assertion the LLD's own done-when names.
    expect(el.querySelector('[data-part="chat-pane"]')!.isSameNode(chatPane), 'the chat region is the SAME node').toBe(true)
    expect(el.querySelector('[data-part="settings-pane"]')!.isSameNode(settingsPaneEl), 'the settings region is the SAME node').toBe(true)
    expect(el.querySelector('[data-part="copilot-pane"]')!.isSameNode(copilotPane), 'the copilot region is the SAME node').toBe(true)
    expect(el.querySelector('[data-part="settings-item"][data-item="agent"]')!.isSameNode(agentItem)).toBe(true)
    expect(el.querySelectorAll('[data-segment="Agent"]'), 'exactly ONE settings region exists — never duplicated').toHaveLength(1)
    expect(el.querySelector('[data-segment="Agent"]')!.isSameNode(agentSection), 'the SAME node before and after every arrangement flip').toBe(true)
    expect(el.querySelector('[data-part="entry-section"]')!.isSameNode(firstEntrySection)).toBe(true)
    // …and no region ever left the pane holder to relocate somewhere else (never a runtime reparent).
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.contains(chatPane) && holder.contains(settingsPaneEl) && holder.contains(copilotPane)).toBe(true)
  })

  it('capability sections (Instructions/Skills/Workflows/Resources/Tools) live in the Capabilities segment', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const capabilities = el.querySelector('[data-segment="Capabilities"]') as HTMLElement
    for (const label of ['Instructions', 'Skills', 'Workflows', 'Resources', 'Tools']) {
      expect([...capabilities.querySelectorAll('[data-part="settings-item"]')].some((h) => h.getAttribute('summary') === label), `missing ${label} section`).toBe(true)
    }
  })

  // ── GH #225 — the config-column sections are heading-row folds (the GH #222 Context pattern applied
  // to the config column). jsdom pins the STRUCTURE; agent-admin.browser.test.ts proves the real
  // fold/register/toggle-vs-fold geometry cross-engine. ──────────────────────────────────────────────
  it('GH #574: the old flat TEN-fold Settings tab is ranked into three tabs — Agent (Agent/Model/Bankroll), Capabilities (Instructions/Skills/Workflows/Resources/Tools), Surface (Surface Options/Pattern sources) — a CENSUS proves the union is exactly the old flat set: nothing lost, nothing duplicated', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const agent = el.querySelector('[data-segment="Agent"]') as HTMLElement
    const capabilities = el.querySelector('[data-segment="Capabilities"]') as HTMLElement
    const surface = el.querySelector('[data-segment="Surface"]') as HTMLElement
    const topItemsOf = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(':scope > [data-part="settings-item"]')]

    const agentItems = topItemsOf(agent)
    const capabilitiesItems = topItemsOf(capabilities)
    const surfaceItems = topItemsOf(surface)

    expect(agentItems.map((i) => i.getAttribute('data-item'))).toEqual(['agent', 'model', 'bankroll'])
    expect(agentItems.map((i) => i.getAttribute('summary'))).toEqual(['Agent', 'Model', 'Bankroll'])
    expect(capabilitiesItems.map((i) => i.getAttribute('data-item'))).toEqual([
      ENTRY_KINDS.promptSection, ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool,
    ])
    expect(capabilitiesItems.map((i) => i.getAttribute('summary'))).toEqual(['Instructions', 'Skills', 'Workflows', 'Resources', 'Tools'])
    expect(surfaceItems.map((i) => i.getAttribute('data-item'))).toEqual(['surface', ENTRY_KINDS.patternSource])
    expect(surfaceItems.map((i) => i.getAttribute('summary'))).toEqual(['Surface Options', 'Pattern sources'])

    // The census: the union of the three tabs' top-level folds is EXACTLY the old flat ten-item set —
    // the acceptance's "no fold lost or duplicated", proven mechanically rather than eyeballed.
    const OLD_FLAT_SET = [
      'agent', 'model', 'surface', 'bankroll', ENTRY_KINDS.promptSection,
      ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource,
    ]
    const allItems = [...agentItems, ...capabilitiesItems, ...surfaceItems]
    const union = allItems.map((i) => i.getAttribute('data-item'))
    expect([...union].sort()).toEqual([...OLD_FLAT_SET].sort())
    expect(new Set(union).size, 'no fold duplicated across tabs').toBe(union.length)
    expect(union.length, 'no fold silently dropped').toBe(OLD_FLAT_SET.length)

    for (const item of allItems) expect(item.hasAttribute('open'), `${item.getAttribute('data-item')} defaults open`).toBe(true)
    // The section content is the fold's BODY (the disclosure adopted it — SPEC-R16 children=body).
    expect(agent.querySelector('[data-item="agent"] [data-part="body"] ui-settings')).not.toBeNull()
    expect(agent.querySelector('[data-item="model"] [data-part="body"] [data-part="model-grid"]')).not.toBeNull()
    expect(surface.querySelector('[data-item="surface"] [data-part="body"] [data-part="surface-options"]')).not.toBeNull()
    expect(capabilities.querySelector(`[data-item="${ENTRY_KINDS.skill}"] [data-part="body"] [data-part="entry-section"][data-kind="${ENTRY_KINDS.skill}"]`)).not.toBeNull()
    // GH #488 — the catalog picker is no longer a top-level settings-item fold at all: its entry-section
    // lives directly adjacent to the Surface Options A2UI row instead (one visual cluster), inside the
    // Surface tab (GH #574).
    expect(el.querySelector(`[data-part="settings-item"][data-item="${ENTRY_KINDS.catalog}"]`)).toBeNull()
    const a2uiRow = surface.querySelector('[data-item="surface"] [data-part="surface-row"][data-surface="a2ui"]') as HTMLElement
    expect(a2uiRow).not.toBeNull()
    const catalogSection = surface.querySelector(`[data-item="surface"] [data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`)
    expect(catalogSection, 'the catalog picker mounts INSIDE the Surface Options fold').not.toBeNull()
    // GH #541 — nested, not adjacent: the picker lives in the A2UI GROUP's own detail zone, so the
    // catalog roster and its "+ From library" row read as children of the toggle that gates them.
    const a2uiGroup = surface.querySelector('[data-part="surface-group"][data-surface="a2ui"]') as HTMLElement
    expect(a2uiGroup.firstElementChild, 'the modality row leads its group').toBe(a2uiRow)
    const detail = a2uiGroup.querySelector('[data-part="surface-detail"]') as HTMLElement
    expect(detail.contains(catalogSection!), 'the picker sits inside the A2UI detail zone').toBe(true)
  })

  it('GH #225: the master switches sit ON their fold heading rows — the Agent switch in the agent summary, one kind switch per capability summary', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(el.querySelector('[data-part="settings-item"][data-item="agent"] [data-part="summary"] [data-part="agent-enabled"]')).not.toBeNull()
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]) {
      expect(
        el.querySelector(`[data-part="settings-item"][data-item="${kind}"] [data-part="summary"] [data-part="kind-enabled"]`),
        `missing ${kind} master switch on its heading row`,
      ).not.toBeNull()
    }
    // The Instructions/Model/Surface folds carry NO switch — their summaries hold only chevron + text.
    expect(el.querySelector(`[data-part="settings-item"][data-item="${ENTRY_KINDS.promptSection}"] [data-part="summary"] ui-switch`)).toBeNull()
    // ADR-0170 cl.5 — and neither does the catalog picker: the ONE capability kind with no master switch
    // (the A2UI surface toggle is its gate), so nothing here can persist a `catalogsEnabled` key nothing
    // reads. GH #488 — it has no fold heading row of its own to carry one on anyway (it mounts inside
    // Surface Options now, not as its own top-level settings-item — the test above pins that placement).
    expect(el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"] [data-part="kind-enabled"]`)).toBeNull()
  })
})

// ── S7-c (LLD §16.1/§16.3/§16.4) — the unified header bar: the six seams, the refused-toggle wiring, the
// pills⇄segment mirror, and every icon-only affordance's accessible name. jsdom cannot resolve the real
// @container band query (agent-admin.browser.test.ts proves the pills⇄segments/wide⇄narrow-actions CSS
// swap cross-engine); this file proves the DOM/state behavior independent of which band is painted. ────
describe('UIAgentAdminElement — the unified header bar (S7-c, ADR-0179 GH #686 Amendment)', () => {
  function header(el: UIAgentAdminElement): HTMLElement {
    return el.querySelector('[data-part="admin-header"]') as HTMLElement
  }
  function pillOf(el: UIAgentAdminElement, pane: 'chat' | 'settings' | 'copilot'): HTMLElement & { pressed: boolean } {
    return header(el).querySelector(`[data-part="pane-pills"] ui-toggle[data-pane="${pane}"]`) as HTMLElement & { pressed: boolean }
  }
  function segmentsOf(el: UIAgentAdminElement): HTMLElement & { value: string | null } {
    return header(el).querySelector('[data-part="pane-segments"]') as HTMLElement & { value: string | null }
  }

  it('anatomy: three zones in DOM order, no data-landmark override (the slot default banner stands)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const h = header(el)
    expect(h.hasAttribute('data-landmark'), 'no landmark override — the anatomy\'s own "no landmark override" note').toBe(false)
    const zoneParts = [...h.children].map((c) => c.getAttribute('data-part'))
    expect(zoneParts).toEqual(['agent-select', 'pane-pills', 'pane-segments', 'header-actions'])
    // Every pane pill carries an identity icon, a visible label, and a state icon (toggle.md's three slots).
    for (const [pane, label] of [['chat', 'Chat'], ['settings', 'Settings'], ['copilot', 'Co-pilot']] as const) {
      const pill = pillOf(el, pane)
      expect(pill.textContent).toContain(label)
      expect(pill.querySelector('[slot="icon"]'), `${pane} pill identity icon`).not.toBeNull()
      expect(pill.querySelector('[slot="state-icon"]'), `${pane} pill state icon`).not.toBeNull()
    }
  })

  it('every icon-only affordance carries an asserted accessible name (aria-label) — the narrow segments, "+", "•••"', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const h = header(el)
    const segments = [...h.querySelectorAll('[data-part="pane-segments"] ui-segment')] as HTMLElement[]
    expect(segments.map((s) => s.getAttribute('aria-label'))).toEqual(['Chat', 'Settings', 'Co-pilot'])
    const newAgentNarrow = h.querySelector('[data-part="new-agent-narrow"]') as HTMLElement
    expect(newAgentNarrow.hasAttribute('icon-only'), 'icon-only opt-in (button.md)').toBe(true)
    expect(newAgentNarrow.getAttribute('aria-label')).toBe('New Agent')
    const overflowTrigger = h.querySelector('[data-part="overflow-menu"] [data-part="trigger"]') as HTMLElement
    expect(overflowTrigger.hasAttribute('icon-only')).toBe(true)
    expect(overflowTrigger.getAttribute('aria-label')).toBe('More actions')
    // Wide pills/labeled buttons carry their own visible text — no aria-label owed (toggle.md's label slot).
    expect(pillOf(el, 'chat').hasAttribute('aria-label'), 'a labeled pill needs no aria-label').toBe(false)
  })

  it('setAgentRoster / onAgentSelect: rebuilds the roster wholesale, is re-callable WITHOUT destroying the select\'s own internal parts, and the pick actually reaches the registered callback — the select\'s own select/change never escapes the host', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const picks: string[] = []
    el.onAgentSelect((id) => picks.push(id))
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }, { id: 'b', label: 'Agent B' }], 'a')
    const select = header(el).querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
    expect([...select.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['Agent A', 'Agent B'])
    expect(select.value).toBe('a')

    // A real user commit — clicking a DIFFERENT option than the one already selected, so a delivery
    // failure (the trigger destroyed, or the click landing on nothing) cannot be mistaken for "already
    // that value, no-op" — must actually reach the registered callback (the "trace the whole path" law:
    // a listener existing is not proof a value ever arrives at it).
    const optionB = [...select.querySelectorAll('[role="option"]')].find((o) => o.textContent === 'Agent B') as HTMLElement
    optionB.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(picks, 'the click actually reached onAgentSelect\'s registered callback').toEqual(['b'])
    expect(select.value, 'the commit also updates the control\'s own value').toBe('b')

    // Re-callable — a later push replaces the ROSTER OPTIONS wholesale (a page re-pushing after a mint/
    // import) — this is the regression proof for the destroy-the-select bug (post-review fix): the
    // control's own trigger/listbox survive a re-push, they are not a casualty of a full children wipe.
    el.setAgentRoster([{ id: 'c', label: 'Agent C' }])
    expect(select.querySelector('[data-part="trigger"]'), 'the trigger survives a re-push — it is not part of the wiped roster').not.toBeNull()
    expect(select.querySelector('[data-part="listbox"]'), 'the listbox survives a re-push too').not.toBeNull()
    expect([...select.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['Agent C'])
    expect(select.value, 'no activeId this time ⇒ nothing selected').toBe('')

    const seen: string[] = []
    el.addEventListener('select', () => seen.push('select'))
    el.addEventListener('change', () => seen.push('change'))
    select.value = 'c' // a programmatic write below never fires select — only the registered callback path does
    expect(seen).toEqual([])
    ;(select.querySelectorAll('[role="option"]')[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // The re-pushed roster's own click ALSO actually reaches the callback — the trigger surviving is not
    // enough on its own; the whole path (click → adopted option → commit → onAgentSelect) must still work
    // after a re-push, not merely before one.
    expect(picks, 'the post-re-push click also reaches the callback').toEqual(['b', 'c'])
    // The real user commit path fires the registered callback, never a host-level select/change.
    expect(seen, 'the select\'s own events stay contained — this element re-emits nothing').toEqual([])
  })

  it('setAgentRoster is safe called BEFORE first connect (the GH #666 order rule, applied to a data-in seam)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.setAgentRoster([{ id: 'x', label: 'Agent X' }], 'x')
    mount(el)
    const select = header(el).querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
    expect([...select.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['Agent X'])
    expect(select.value).toBe('x')
  })

  // ── the four action seams: register-before/after-connect + the per-affordance hidden degrade ─────────
  for (const [seamName, part, register] of [
    ['onNewAgentRequest', 'new-agent-wide', (el: UIAgentAdminElement, cb: () => void) => el.onNewAgentRequest(cb)],
    ['onImportRequest', 'import-action', (el: UIAgentAdminElement, cb: () => void) => el.onImportRequest(cb)],
    ['onExportRequest', 'export-action', (el: UIAgentAdminElement, cb: () => void) => el.onExportRequest(cb)],
  ] as const) {
    it(`${seamName}: HIDDEN unregistered, revealed by a register AFTER connect, and the click reaches the callback`, () => {
      const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
      const btn = header(el).querySelector(`[data-part="${part}"]`) as HTMLElement
      expect(btn.hidden, 'unregistered ⇒ hidden, never merely disabled').toBe(true)
      let calls = 0
      register(el, () => { calls += 1 })
      expect(btn.hidden, 'registering AFTER connect reveals it (the GH #666 order rule)').toBe(false)
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(calls).toBe(1)
    })

    it(`${seamName}: registered BEFORE first connect is honest at build time too`, () => {
      const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
      register(el, () => {})
      mount(el)
      const btn = header(el).querySelector(`[data-part="${part}"]`) as HTMLElement
      expect(btn.hidden, 'registering BEFORE connect reflects at #compose\'s own build-time call').toBe(false)
    })
  }

  it('onNewAgentRequest: the narrow "+" twin shares the SAME registration as the wide button — one seam, two renderings', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const narrow = header(el).querySelector('[data-part="new-agent-narrow"]') as HTMLElement
    expect(narrow.hidden).toBe(true)
    let calls = 0
    el.onNewAgentRequest(() => { calls += 1 })
    expect(narrow.hidden).toBe(false)
    narrow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(calls).toBe(1)
  })

  it('the narrow "•••" overflow: each item degrades on its OWN seam\'s registration, and the trigger itself hides only when BOTH are gone', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const h = header(el)
    const trigger = h.querySelector('[data-part="overflow-menu"] [data-part="trigger"]') as HTMLElement
    const importItem = h.querySelector('[data-value="import-agent"]') as HTMLElement
    const exportItem = h.querySelector('[data-value="export-agent"]') as HTMLElement
    expect([trigger.hidden, importItem.hidden, exportItem.hidden], 'nothing registered ⇒ everything hidden').toEqual([true, true, true])

    let imports = 0
    el.onImportRequest(() => { imports += 1 })
    expect(trigger.hidden, 'ONE affordance registered ⇒ the trigger reveals (something real to open onto)').toBe(false)
    expect([importItem.hidden, exportItem.hidden]).toEqual([false, true])
    expect(importItem.getAttribute('aria-disabled')).toBe('false')
    expect(exportItem.getAttribute('aria-disabled')).toBe('true')

    let exports = 0
    el.onExportRequest(() => { exports += 1 })
    expect(exportItem.hidden).toBe(false)

    importItem.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    exportItem.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect([imports, exports]).toEqual([1, 1])
  })

  // S7-d (LLD §16.4) — onResetRequest's own consumer: the Settings model-grid fold's "Reset Agent" row,
  // OUTSIDE the header entirely, reflected through the SAME #applyActionAvailability funnel as the other
  // five action seams (HIDE, not disable, per LLD §16.3's stated divergence). GH #709 — the WHOLE ROW
  // hides, never just the button (a buttonless labeled card is the wrong degrade): the button itself is
  // never hidden/disabled on its own.
  it('onResetRequest: the ROW is HIDDEN unregistered (button never touched directly), revealed by a register AFTER connect, and the click reaches the callback', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const row = el.querySelector('[data-part="reset-agent-row"]') as HTMLElement
    const btn = el.querySelector('[data-part="reset-agent-button"]') as HTMLElement
    expect(row.hidden, 'unregistered ⇒ the ROW hides, never merely disabled').toBe(true)
    expect(btn.hidden, 'the button itself is never toggled directly — only its row').toBe(false)
    let calls = 0
    el.onResetRequest(() => { calls += 1 })
    expect(row.hidden, 'registering AFTER connect reveals the row (the GH #666 order rule)').toBe(false)
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(calls).toBe(1)
  })

  it('onResetRequest: registered BEFORE first connect is honest at build time too', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.onResetRequest(() => {})
    mount(el)
    const row = el.querySelector('[data-part="reset-agent-row"]') as HTMLElement
    expect(row.hidden, "registering BEFORE connect reflects at #compose's own build-time call").toBe(false)
  })

  it('onResetRequest: unregistered leaves the row hidden even though its label ("Agent configuration") would otherwise have no action to pair with (GH #709 — the buttonless-card defect this test guards against)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const row = el.querySelector('[data-part="reset-agent-row"]') as HTMLElement
    const label = el.querySelector('[data-part="reset-agent-label"]') as HTMLElement
    expect(row.hidden).toBe(true)
    expect(label, 'the label still exists in the DOM (never removed) — [hidden] on the row is what hides it, not a separate removal').not.toBeNull()
  })

  it('onResetRequest: the button lives at the model-grid fold\'s content end, a sibling of model-grid, never inside it (a #renderModelGrid re-render must not wipe it)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.onResetRequest(() => {})
    const modelFold = el.querySelector('[data-part="settings-item"][data-item="model"]') as HTMLElement
    const grid = modelFold.querySelector('[data-part="model-grid"]') as HTMLElement
    const btn = modelFold.querySelector('[data-part="reset-agent-button"]') as HTMLElement
    expect(grid.contains(btn), 'the button is a SIBLING of model-grid, not a child wiped by its replaceChildren re-render').toBe(false)
    expect(modelFold.contains(btn), 'still inside the SAME fold, at its content end').toBe(true)
    // Force a model-grid re-render (a store write the grid subscribes to) — the button must survive.
    el.store?.set('model', el.store.get('model'))
    expect(el.querySelector('[data-part="reset-agent-button"]'), 'survives a model-grid re-render').not.toBeNull()
  })

  // ── the refused-toggle wiring (LLD §16.2, S7-a's own cancelable-before-commit mechanism, used for real) ─
  it('a wide pill click REFUSES to turn off the LAST shown pane — a true no-op, pressed stays true, the shown set is untouched', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const seam = (shown: readonly ('chat' | 'settings' | 'copilot')[], primary: 'chat' | 'settings' | 'copilot'): void =>
      (el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(shown, primary)
    seam(['settings'], 'settings') // down to the last member
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    const pill = pillOf(el, 'settings')
    expect(pill.pressed, 'the last member\'s pill reads pressed').toBe(true)
    pill.click() // a real press — pressActivation → click → the pill's own toggle emission
    expect(pill.pressed, 'refused — the pill stays pressed, no flip-then-revert flicker').toBe(true)
    expect(holder.getAttribute('data-show'), 'the shown set is byte-identical to before the refused press').toBe('settings')
  })

  it('a wide pill click turning OFF the primary repoints primary to the first remaining member in reading order (PANE_ORDER)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    // Entry default: all three shown, chat primary. Turn OFF chat — settings is next in PANE_ORDER.
    pillOf(el, 'chat').click()
    expect(holder.getAttribute('data-show')).toBe('settings copilot')
    expect(holder.getAttribute('data-primary'), 'primary repoints off its own removal, to the first remaining PANE_ORDER member').toBe('settings')
  })

  it('a wide pill click turning a pane ON adds it to the shown set without moving primary', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    pillOf(el, 'chat').click() // chat off ⇒ settings copilot, primary settings
    pillOf(el, 'chat').click() // chat back on
    expect(holder.getAttribute('data-show')).toBe('chat settings copilot')
    expect(holder.getAttribute('data-primary'), 'turning a pane back ON never moves primary').toBe('settings')
  })

  // ── pills⇄segment mirroring (LLD §16.4 done-when: "flip in one rendering, cross-check the other") ──────
  it('a wide pill flip mirrors onto the narrow segment\'s own selection (primary) — cross-checked in the OTHER rendering', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(segmentsOf(el).value, 'entry default primary').toBe('chat')
    pillOf(el, 'chat').click() // chat off ⇒ primary repoints to settings
    expect(segmentsOf(el).value, 'the segment mirrors the repointed primary').toBe('settings')
  })

  it('a narrow segment select mirrors onto the wide pills\' own pressed/state-icon state — cross-checked in the OTHER rendering', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const segments = segmentsOf(el)
    const copilotSegment = segments.querySelector('ui-segment[value="copilot"]') as HTMLElement
    copilotSegment.click()
    expect(segments.value, 'the segment control commits the click').toBe('copilot')
    // LLD §16.2's narrow-segment write semantics: set primary AND ensure membership — copilot joins the
    // shown set (it was already a member at the entry default, but the mirror must hold regardless).
    expect(pillOf(el, 'copilot').pressed, 'the copilot pill mirrors membership').toBe(true)
    const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.getAttribute('data-primary')).toBe('copilot')
  })

  it('the state-icon glyph mirrors membership (eye shown / eye-slash hidden) on every pill, at every flip', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const stateIconOf = (pane: 'chat' | 'settings' | 'copilot'): HTMLElement & { glyph: string } =>
      pillOf(el, pane).querySelector('[slot="state-icon"]') as HTMLElement & { glyph: string }
    expect(['chat', 'settings', 'copilot'].map((p) => stateIconOf(p as never).glyph)).toEqual(['eye', 'eye', 'eye'])
    pillOf(el, 'chat').click() // chat off
    expect(stateIconOf('chat').glyph, 'hidden ⇒ eye-slash').toBe('eye-slash')
    expect(stateIconOf('settings').glyph, 'still shown ⇒ eye').toBe('eye')
  })
})

// ── GH #845 (LLD-C10) — roster management: the picker's trailing group, the sentinel no-leak, and the
// two-axis Delete gate. jsdom cannot paint the panel, but every mechanic under test here is DOM/state
// truth: adoption ORDER (ui-select's own MutationObserver relocation — microtask-deferred, hence the
// double `await Promise.resolve()` the select's own suite established), which nodes exist at all
// (structural omission is the ruled degrade, never `[hidden]`), and who receives what. The real-engine
// leg (open the picker, click Edit Agents, the trigger label reverts) lives in agent-admin.browser.test.ts.
describe("UIAgentAdminElement — the picker's roster-actions group + the two-axis Delete gate (GH #845)", () => {
  /** ui-select adopts newly-appended [role=option]/[role=group] children into its listbox panel on a
   *  MutationObserver callback (microtask-deferred) — select.test.ts's own dynamic-options idiom. */
  const adopted = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
  }
  function selectOf(el: UIAgentAdminElement): HTMLElement & { value: string } {
    return el.querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
  }
  function panelOf(el: UIAgentAdminElement): HTMLElement {
    return selectOf(el).querySelector('[data-part="listbox"]') as HTMLElement
  }

  it("THE TAIL-ADOPTION REGRESSION: after a SECOND setAgentRoster the panel's LAST block is STILL the Manage group, New Agent then Edit Agents", async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.onNewAgentRequest(() => {})
    el.onEditAgentsRequest(() => {})
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }], 'a')
    await adopted()
    const panel = panelOf(el)
    expect(panel.lastElementChild?.getAttribute('data-part'), 'the group lands last on the FIRST push').toBe('roster-actions')

    // The whole point of the rebuild ruling: a re-push re-adopts its options at the panel's TAIL, so a
    // one-time static group would end up ABOVE them. The group must be rebuilt and re-appended too.
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }, { id: 'b', label: 'Agent B' }], 'b')
    await adopted()
    expect(panel.lastElementChild?.getAttribute('data-part'), 'STILL last after a re-push').toBe('roster-actions')
    expect(panel.querySelectorAll('[data-part="roster-actions"]'), 'exactly one group — the previous one was wiped, never orphaned').toHaveLength(1)
    const group = panel.lastElementChild as HTMLElement
    expect([...group.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['New Agent', 'Edit Agents'])
    // The roster options come FIRST, in entry order, and none of them is a sentinel.
    const values = [...panel.querySelectorAll('[role="option"]')].map((o) => o.getAttribute('value'))
    expect(values).toEqual(['a', 'b', 'agent-admin:new-agent', 'agent-admin:edit-agents'])
  })

  it('the group is a real optgroup: role=group, a control-created "Manage" header, aria-labelledby — the divider IS the group label', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.onEditAgentsRequest(() => {})
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }], 'a')
    await adopted()
    const group = panelOf(el).querySelector('[data-part="roster-actions"]') as HTMLElement
    expect(group.getAttribute('role')).toBe('group')
    const header = group.querySelector('[data-part="group-label"]') as HTMLElement
    expect(header.textContent, 'ui-select mints the header from the `label` attribute it then consumes').toBe('Manage')
    expect(group.getAttribute('aria-labelledby')).toBe(header.id)
    expect(group.hasAttribute('label'), 'consumed by the control — never left as a stray attribute').toBe(false)
  })

  it('STRUCTURAL OMISSION, not [hidden]: neither seam registered ⇒ NO group in the DOM at all; each item appears only with its own seam; a late registration composes without a re-push', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }], 'a')
    await adopted()
    expect(selectOf(el).querySelector('[data-part="roster-actions"]'), 'no seam ⇒ absent, never a hidden node the roving order would stop on').toBeNull()

    el.onEditAgentsRequest(() => {}) // registered AFTER connect, with NO re-push
    await adopted()
    let items = [...selectOf(el).querySelectorAll('[data-part="roster-action"]')]
    expect(items.map((i) => i.textContent), "only the registered seam's item is composed").toEqual(['Edit Agents'])

    el.onNewAgentRequest(() => {})
    await adopted()
    items = [...selectOf(el).querySelectorAll('[data-part="roster-action"]')]
    expect(items.map((i) => i.textContent), 'the second registration joins it, in the ruled order').toEqual(['New Agent', 'Edit Agents'])
  })

  it('"always present": a registered consumer that NEVER pushed a roster still gets the group (the loosened early-return guard)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.onNewAgentRequest(() => {})
    el.onEditAgentsRequest(() => {})
    await adopted()
    const group = selectOf(el).querySelector('[data-part="roster-actions"]') as HTMLElement
    expect(group, 'no setAgentRoster call has ever happened — the group still composes').not.toBeNull()
    expect([...group.querySelectorAll('[role="option"]')]).toHaveLength(2)
  })

  it('SENTINEL NO-LEAK: committing "New Agent"/"Edit Agents" invokes ONLY its own seam, restores value to the active id, and reaches #agentSelectCallback ZERO times', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const picks: string[] = []
    let news = 0
    let edits = 0
    el.onAgentSelect((id) => picks.push(id))
    el.onNewAgentRequest(() => { news += 1 })
    el.onEditAgentsRequest(() => { edits += 1 })
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }, { id: 'b', label: 'Agent B' }], 'b')
    await adopted()
    const select = selectOf(el)
    const item = (value: string): HTMLElement =>
      select.querySelector(`[data-part="roster-action"][value="${value}"]`) as HTMLElement

    item('agent-admin:new-agent').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(news, 'the pick reached onNewAgentRequest — the EXISTING mint seam, not a second one').toBe(1)
    expect(picks, "a sentinel NEVER reaches the page's roster-pick callback").toEqual([])
    expect(select.value, 'the displayed choice reverts to the real active agent').toBe('b')

    item('agent-admin:edit-agents').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(edits).toBe(1)
    expect(news, 'the two sentinels never cross-fire').toBe(1)
    expect(picks).toEqual([])
    expect(select.value).toBe('b')

    // The queued rebuild clears the commit trait's own residue — no sentinel is left marked selected.
    await adopted()
    const marked = [...select.querySelectorAll('[aria-selected="true"]')].map((o) => o.getAttribute('value'))
    expect(marked, 'only a REAL entry can read selected after the queued re-run').not.toContain('agent-admin:edit-agents')

    // A real entry id still forwards, unchanged — the interpretation is narrow, not a swallow-everything.
    ;(select.querySelector('[role="option"][value="a"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(picks).toEqual(['a'])
  })

  it('ORDER IS LOAD-BEARING: a seam callback that re-pushes the roster wins last (restore FIRST, invoke SECOND)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.setAgentRoster([{ id: 'a', label: 'Agent A' }], 'a')
    // The shipped page's exact shape: New Agent mints a persona and re-pushes with the mint active.
    el.onNewAgentRequest(() => {
      el.setAgentRoster([{ id: 'a', label: 'Agent A' }, { id: 'minted', label: 'New agent' }], 'minted')
    })
    await adopted()
    const select = selectOf(el)
    ;(select.querySelector('[value="agent-admin:new-agent"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(select.value, "the callback's own re-push wins — never clobbered by the restore").toBe('minted')
    await adopted()
    expect(select.value, 'and the queued rebuild re-applies the SAME active id, not the pre-click one').toBe('minted')
  })

  it('the two-axis Delete gate, all four states — {seam registered?} × {active entry deletable?} — in BOTH homes', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const item = (): HTMLElement => el.querySelector('[data-value="delete-agent"]') as HTMLElement
    const row = (): HTMLElement => el.querySelector('[data-part="delete-agent-row"]') as HTMLElement
    const shown = (): [boolean, boolean] => [!item().hidden, !row().hidden]

    // (1) unregistered × deletable
    el.setAgentRoster([{ id: 'custom', label: 'Custom', deletable: true }], 'custom')
    expect(shown(), 'no handler ⇒ nothing to offer').toEqual([false, false])

    // (2) registered × deletable
    el.onDeleteAgentRequest(() => {})
    expect(shown(), 'both axes true ⇒ BOTH homes paint').toEqual([true, true])
    expect(item().getAttribute('aria-disabled')).toBe('false')

    // (3) registered × NOT deletable (a shipped preset — the field ABSENT, fail-closed)
    el.setAgentRoster([{ id: 'preset', label: 'Preset' }, { id: 'custom', label: 'Custom', deletable: true }], 'preset')
    expect(shown(), 'a preset shows NEITHER — the axis, not a special case').toEqual([false, false])
    expect(item().getAttribute('aria-disabled')).toBe('true')

    // (4) an explicit `deletable: false` reads exactly like the absent field
    el.setAgentRoster([{ id: 'preset', label: 'Preset', deletable: false }], 'preset')
    expect(shown()).toEqual([false, false])

    // A bare setAgentRoster ALONE flips visibility — no other call, no re-registration.
    el.setAgentRoster([{ id: 'preset', label: 'Preset' }, { id: 'custom', label: 'Custom', deletable: true }], 'custom')
    expect(shown(), 'switching the ACTIVE entry to a deletable one reveals both').toEqual([true, true])
  })

  it('the ••• trigger hides only when Import AND Export AND Delete are all hidden — Delete alone is enough to open onto', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const trigger = el.querySelector('[data-part="overflow-menu"] [data-part="trigger"]') as HTMLElement
    expect(trigger.hidden, 'nothing registered ⇒ hidden').toBe(true)
    el.onDeleteAgentRequest(() => {})
    expect(trigger.hidden, 'registered but the active entry is protected ⇒ still nothing to open onto').toBe(true)
    el.setAgentRoster([{ id: 'custom', label: 'Custom', deletable: true }], 'custom')
    expect(trigger.hidden, 'Delete alone makes the menu a real affordance').toBe(false)
  })

  it('BOTH delete homes hand the callback the CURRENT active id, read at INVOKE time (a re-push changes what the next click sends)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const deleted: string[] = []
    el.onDeleteAgentRequest((id) => deleted.push(id))
    el.setAgentRoster([{ id: 'one', label: 'One', deletable: true }], 'one')
    ;(el.querySelector('[data-value="delete-agent"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(deleted, 'the overflow item carries the id').toEqual(['one'])

    el.setAgentRoster([{ id: 'two', label: 'Two', deletable: true }], 'two')
    ;(el.querySelector('[data-part="delete-agent-button"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(deleted, 'the config row carries the NEW active id — read at invoke, never captured at build').toEqual(['one', 'two'])
  })

  it('delete-agent-row is a SIBLING of model-grid inside the model fold — a grid re-render must not wipe it (GH #709/#845)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.onDeleteAgentRequest(() => {})
    el.setAgentRoster([{ id: 'custom', label: 'Custom', deletable: true }], 'custom')
    const modelFold = el.querySelector('[data-part="settings-item"][data-item="model"]') as HTMLElement
    const grid = modelFold.querySelector('[data-part="model-grid"]') as HTMLElement
    const row = modelFold.querySelector('[data-part="delete-agent-row"]') as HTMLElement
    expect(grid.contains(row), "never inside the wholesale-replaceChildren'd grid").toBe(false)
    expect(modelFold.contains(row), "still at the SAME fold's content end").toBe(true)
    expect(row.previousElementSibling?.getAttribute('data-part'), 'it lands after Reset, the ruled order').toBe('reset-agent-row')
    el.store?.set('model', el.store.get('model'))
    expect(el.querySelector('[data-part="delete-agent-button"]'), 'survives a model-grid re-render').not.toBeNull()
    // The row's own label is never removed — [hidden] on the ROW is what hides it (GH #709's law).
    expect(el.querySelector('[data-part="delete-agent-label"]')?.textContent).toBe('This agent')
  })

  it('onEditAgentsRequest/onDeleteAgentRequest: last registration wins, and both are safe BEFORE first connect', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    let firstEdit = 0
    let secondEdit = 0
    el.onEditAgentsRequest(() => { firstEdit += 1 })
    el.onEditAgentsRequest(() => { secondEdit += 1 })
    el.onDeleteAgentRequest(() => {})
    el.setAgentRoster([{ id: 'custom', label: 'Custom', deletable: true }], 'custom')
    mount(el)
    await adopted()
    expect((el.querySelector('[data-part="delete-agent-row"]') as HTMLElement).hidden, 'pre-connect registration is honest at build time').toBe(false)
    ;(el.querySelector('[value="agent-admin:edit-agents"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect([firstEdit, secondEdit], 'last registration wins — a bare field reassignment').toEqual([0, 1])
  })

  it('no CustomEvent joins the closed seven-event set — a sentinel pick and a delete both stay contained', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const seen: string[] = []
    for (const name of ['select', 'change', 'action', 'open', 'close', 'toggle', 'input']) {
      el.addEventListener(name, () => seen.push(name))
    }
    el.onEditAgentsRequest(() => {})
    el.onDeleteAgentRequest(() => {})
    el.setAgentRoster([{ id: 'custom', label: 'Custom', deletable: true }], 'custom')
    await adopted()
    ;(el.querySelector('[value="agent-admin:edit-agents"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ;(el.querySelector('[data-part="delete-agent-button"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await adopted()
    expect(seen, "the composed children's events stay contained — this element re-emits nothing").toEqual([])
  })
})

// ── GH #845 (LLD-C8/C9) — the danger repoint's own text-level gates: role-purity in the CSS, and the
// descriptor mirroring the parts/seams/reserved values it documents (the descriptor-mirrors-source law).
// Reads its own file text (not the module-level consts further down this file — those initialize AFTER
// this describe body runs at collection time).
describe('GH #845 — danger styling is role-pure, and the descriptor names what shipped', () => {
  const HERE = `${process.cwd()}/packages/agent-ui/app/src/controls/agent-admin`
  const cssText = readFileSync(`${HERE}/agent-admin.css`, 'utf8') as string
  const mdText = readFileSync(`${HERE}/agent-admin.md`, 'utf8') as string
  const tsText = readFileSync(`${HERE}/agent-admin.ts`, 'utf8') as string
  /** One declaration block's body, by selector — comments stripped so a rationale never reads as a rule. */
  function blockFor(selector: string): string {
    const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
    const at = stripped.indexOf(`${selector} {`)
    expect(at, `${selector} exists in agent-admin.css`).toBeGreaterThan(-1)
    return stripped.slice(at, stripped.indexOf('}', at))
  }

  it('every added danger declaration resolves to a role — zero raw colour values (oklch/hex/rgb/hsl)', () => {
    const RAW_COLOUR = /(oklch|rgba?|hsla?|color-mix)\(|#[0-9a-f]{3,8}\b/i
    const dangerDecls = cssText
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) =>
        line.includes('--ui-agent-admin-danger') ||
        line.includes('--ui-button-bg') ||
        line.includes('--ui-button-ink') ||
        line.includes('--ui-menu-item-bg-hover'))
    expect(dangerDecls.length, 'anti-vacuous: the danger chain really is in this sheet').toBeGreaterThan(6)
    for (const line of dangerDecls) expect(RAW_COLOUR.test(line), line.trim()).toBe(false)
    // The token block mints from --md-sys-color-danger-* roles, nothing else.
    for (const role of ['danger-container-low', 'danger-container', 'danger-container-high', 'danger-high', 'danger-on-surface-variant']) {
      expect(cssText, `the danger chain reads --md-sys-color-${role}`).toContain(`var(--md-sys-color-${role})`)
    }
  })

  it("the button repoint consumes the element's OWN danger chain (never a --md-sys-* read at the consuming selector), and ui-button's variant enum is untouched", () => {
    const block = blockFor("[data-part='delete-agent-button']")
    for (const prop of ['--ui-button-bg:', '--ui-button-bg-hover:', '--ui-button-bg-active:', '--ui-button-ink:']) {
      expect(block, `${prop} repointed`).toContain(prop)
    }
    expect(block).not.toContain('--md-sys-color')
    // The fork NOT taken: no fourth variant anywhere in this element's source or sheet.
    expect(cssText).not.toContain("variant='danger'")
    expect(tsText).not.toContain("setAttribute('variant', 'danger')")
  })

  it('the descriptor mirrors the new parts, both seam signatures, `deletable`, and the RESERVED sentinel values', () => {
    for (const part of ['roster-actions', 'roster-action', 'delete-agent-row', 'delete-agent-label', 'delete-agent-button']) {
      expect(mdText, `parts[] declares ${part}`).toContain(`  - name: ${part}\n`)
    }
    expect(mdText).toContain('onEditAgentsRequest(callback: () => void): void')
    expect(mdText).toContain('onDeleteAgentRequest(callback: (id: string) => void): void')
    expect(mdText).toContain('`AgentRosterEntry.deletable?: boolean`')
    // The reserved values are documented where their own contract lives (the seams fence), verbatim.
    expect(mdText).toContain("'agent-admin:new-agent'")
    expect(mdText).toContain("'agent-admin:edit-agents'")
    expect(mdText.toLowerCase()).toContain('reserved')
    // And the descriptor's values are the ones the SOURCE actually ships (the mirror, not a claim).
    expect(tsText).toContain("const AGENT_SELECT_NEW = 'agent-admin:new-agent'")
    expect(tsText).toContain("const AGENT_SELECT_EDIT = 'agent-admin:edit-agents'")
  })
})

describe('UIAgentAdminElement — upgrade + defaults', () => {
  it('upgrades to the class; schema/store both start undefined pre-connect (the ui-settings precedent)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    expect(el).toBeInstanceOf(UIAgentAdminElement)
    expect(el.schema).toBeUndefined()
    expect(el.store).toBeUndefined()
  })

  it('static props is exactly [schema, store, agentTurn, agentSurfaceTurn, libraries, authoringStore]', () => {
    // `authoringStore` joined with ADR-0178 cl.5 (GH #633) — the guided-authoring flow's second
    // composition source; unset, it is inert (see the dual-context describe below).
    expect(Object.keys(UIAgentAdminElement.props)).toEqual(['schema', 'store', 'agentTurn', 'agentSurfaceTurn', 'libraries', 'authoringStore'])
  })

  it('agentTurn starts undefined pre-connect and stays undefined after connect (the stub arm is the default)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    expect(el.agentTurn).toBeUndefined()
    mount(el)
    expect(el.agentTurn).toBeUndefined()
  })

  it('connecting lazily assigns the real default schema + a real, persisted store seeded for BOTH the flat Agent config and every entry-list kind', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(el.schema).toBe(defaultAgentConfigSchema)
    expect(el.store).toBeDefined()
    expect(el.store?.get('nonexistent-key')).toBeUndefined() // a real SettingsStore.get, not a stub
  })
})

describe('UIAgentAdminElement — real models + real seeded content (TKT-0043)', () => {
  it('the roster is real named models, not the old default/fast/careful tiers — and the schema carries NO model select (the GRID owns it, 2026-07-19 rev.2)', () => {
    const ids = SUPPORTED_MODELS.map((m) => m.id)
    expect(ids).toContain(DEFAULT_MODEL_ID)
    expect(ids).not.toContain('default')
    expect(ids).not.toContain('fast')
    expect(defaultAgentConfigSchema.sections[0].fields.some((f) => f.key === 'model')).toBe(false)
  })

  it('selecting a model and submitting cites its display LABEL, not its raw id, in the next stub reply', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const target = SUPPORTED_MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'ping' // the composer's own value prop (TKT-0058 — the nested field/form are gone)
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    const bubbles = [...el.querySelectorAll('[data-role="agent"]')]
    const body = (bubbles[bubbles.length - 1]?.querySelector('[data-part="body"]') as HTMLElement)?.textContent ?? ''
    expect(body).toContain(target.label)
    expect(body).not.toContain(target.id)
  })

  it('all three built-in prompt sections seed REAL, non-empty content (not just Foundation)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    for (const id of ['foundation', 'personality', 'critical-items']) {
      const row = entryEl(el, ENTRY_KINDS.promptSection, id)
      expect(contentFieldOf(row).value.trim().length).toBeGreaterThan(0)
    }
  })

  it('a fresh element with every section left at its seed default composes all three labeled blocks, not just Foundation', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const sections = readEntries(el.store, ENTRY_KINDS.promptSection)
    const composed = composeSystemPrompt(sections)
    expect(composed).toContain('## Foundation')
    expect(composed).toContain('## Personality')
    expect(composed).toContain('## Critical Items')
    expect(composed).not.toBe(DEFAULT_SYSTEM_PROMPT_FALLBACK)
  })
})

describe('UIAgentAdminElement — composition (GH #52/ADR-0154: chat + {Settings, Context: System, Context: Dialog} segments; ADR-0132 five entry-list instantiations; GH #161)', () => {
  it('builds one ui-super-shell holding the three places (ADR-0179, re-ruled by GH #686\'s Amendment, composed directly since GH #700)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const shell = el.querySelector(':scope > ui-super-shell')
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"] [data-part="chat-pane"]')).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"] [data-part="settings-pane"]')).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"] [data-part="copilot-pane"]')).not.toBeNull()
  })

  it('LLD-C4: agent-admin.css sets the two R6c floor tokens to today\'s ui-split min values, verbatim (16rem/20rem)', () => {
    // Coherence guard (the TKT-0045 lineage, re-pointed at the new mechanism): the old `min` ATTRIBUTES
    // on `ui-split-pane` are gone with the shell; the SAME two floors now live as CSS custom properties
    // on ui-super-shell's own R6c bounds tokens (agent-admin.css). This reads the live declaration
    // rather than a second hardcoded copy, so a drift here fails loudly instead of silently regressing
    // to the TKT-0045 clipping bug under a different mechanism.
    //
    // SCOPE NOTE (min-size-floors census, GH #185 follow-up): a jsdom text-regex over the CSS file proves
    // only that these two literal strings still APPEAR in agent-admin.css — it does NOT prove the values
    // ever reach the composed `ui-super-shell`'s own live paint (they didn't, for a real cascade reason —
    // `:where(ui-super-shell)` unconditionally re-declares its own default for the same two names, and a
    // directly-matching declaration on an element always wins over one merely inherited from an ancestor).
    // The real, getComputedStyle-based proof lives in agent-admin.browser.test.ts's own
    // "min-size-floors census" describe block — this test stays only as a coarse "don't silently delete
    // or misspell these two lines" guard.
    const css = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/agent-admin/agent-admin.css`, 'utf8') as string
    expect(/--ui-super-shell-canvas-min-size:\s*16rem/.test(css), 'the canvas floor (today\'s canvasPane min) must stay 16rem').toBe(true)
    expect(/--ui-super-shell-pane-min-size:\s*20rem/.test(css), 'the options-pane floor (today\'s tabsPane min) must stay 20rem').toBe(true)
  })

  it('the canvas box composes a real ui-conversation', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const canvasBox = el.querySelector('[data-part="canvas"]')
    expect(canvasBox?.querySelector('ui-conversation')).toBeInstanceOf(UIConversationElement)
  })

  it('the admin chat opts INTO the receipt pattern (GH #238/#239/ADR-0159 — Kim\'s 2026-07-23 ruling; this is the screenshotted surface): conversation.receipt is set, so each turn\'s narration collapses to one line / a receipt', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    expect(conversation.receipt, 'the receipt opt-in rides the admin composition').toBe(true)
  })

  it('GH #285 — the opt-in reaches the REAL per-turn narration element, not just the flag: a submitted turn\'s [data-part="narration"] carries both `oneline` and `receipt`', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'hello'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    const narration = el.querySelector('[data-part="narration"]')
    expect(narration?.getAttribute('oneline'), 'the live one-morphing-line mode').toBe('')
    expect(narration?.getAttribute('receipt'), 'the terminal one-line receipt').toBe('')
  })

  it('…and INTO the per-step source reveal (GH #240/ADR-0159 wave B — part 3 of the same ruling): conversation.sources is set, so each activity step reveals the wire line(s) behind it', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    expect(conversation.sources, 'the developer surface\'s standing opt-in — every other consumer stays default-off').toBe(true)
  })

  it('GH #574: the Agent tab composes the Agent config (real ui-settings, wired to schema/store); the Capabilities and Surface tabs together compose all SEVEN entry-sections (prompts merged in, vision rev.5; genui-surface B2 added Pattern sources; GH #488 moved Catalogs INTO Surface Options; GH #574 ranked Catalogs+Pattern sources into the Surface tab, everything else into Capabilities)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const agentContent = el.querySelector('[data-role="agent-content"]') as HTMLElement
    const settingsEl = agentContent.querySelector('ui-settings') as UISettingsElement
    expect(settingsEl).toBeInstanceOf(UISettingsElement)
    expect(settingsEl.schema).toBe(el.schema)
    expect(settingsEl.store).toBe(el.store)

    const capabilitiesContent = el.querySelector('[data-role="capabilities-content"]') as HTMLElement
    const capabilitiesSections = [...capabilitiesContent.querySelectorAll('[data-part="entry-section"]')]
    expect(capabilitiesSections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.promptSection,
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
    ])

    const surfaceContent = el.querySelector('[data-role="surface-content"]') as HTMLElement
    const surfaceSections = [...surfaceContent.querySelectorAll('[data-part="entry-section"]')]
    expect(surfaceSections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.catalog, // nested inside the Surface Options A2UI detail zone — still leads the Surface tab
      ENTRY_KINDS.patternSource,
    ])
  })

  it('GH #161/#222: the Context: System content is the FLAT agent-system view — render slot as a direct child, no outer wrapper card, no Dialog content at all', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const systemContent = el.querySelector('[data-role="context-system-content"]') as HTMLElement
    // GH #222 — the outer "Agent System" wrapper card is GONE; the render slot sits DIRECTLY in the
    // segment container (the segment strip already labels the context).
    expect(systemContent.querySelector('[data-part="context-section"]')).toBeNull()
    const host = systemContent.querySelector('[data-part="context-system"]') as HTMLElement
    expect(host.parentElement).toBe(systemContent)
    // The Agent section (open, with the compiled JSON) + one section per capability kind.
    const items = [...systemContent.querySelectorAll('[data-part="context-system"] [data-part="context-item"]')]
    expect(items.map((i) => i.getAttribute('data-item'))).toEqual([
      'agent', ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool, ENTRY_KINDS.patternSource, ENTRY_KINDS.catalog,
    ])
    const agentJson = JSON.parse(items[0]!.querySelector('[data-part="context-json"]')!.textContent ?? '{}') as Record<string, unknown>
    expect(agentJson['model']).toBe(DEFAULT_MODEL_ID)
    expect(agentJson['active']).toBe(true)
    expect(typeof agentJson['systemPrompt']).toBe('string')
    // Cross-tab isolation: no Dialog parts leaked into the System tab's content unit.
    expect(systemContent.querySelector('[data-part="context-turns"]')).toBeNull()
  })

  it('GH #161/#222: the Context: Dialog content is the FLAT turn log — render slot as a direct child, no outer wrapper card, no System content at all', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const dialogContent = el.querySelector('[data-role="context-dialog-content"]') as HTMLElement
    // GH #222 — the outer "Dialog Turns" wrapper card is GONE; the render slot sits DIRECTLY in the
    // segment container.
    expect(dialogContent.querySelector('[data-part="context-section"]')).toBeNull()
    const host = dialogContent.querySelector('[data-part="context-turns"]') as HTMLElement
    expect(host.parentElement).toBe(dialogContent)
    // Dialog turns: empty until the first turn runs.
    expect(dialogContent.querySelectorAll('[data-part="context-turn"]')).toHaveLength(0)
    // Cross-tab isolation: no System parts leaked into the Dialog tab's content unit.
    expect(dialogContent.querySelector('[data-part="context-system"]')).toBeNull()
    expect(dialogContent.querySelector('[data-part="context-item"]')).toBeNull()
  })
})

describe('UIAgentAdminElement — seeded prompt sections (ADR-0132 cl.2/Fork 4)', () => {
  it('seeds three built-in sections — Foundation, Personality, Critical Items — enabled by default', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const rows = [...el.querySelectorAll('[data-kind="prompt-section"] [data-part="entry"]')]
    expect(rows.map((r) => r.getAttribute('data-entry-id'))).toEqual(['foundation', 'personality', 'critical-items'])
    for (const row of rows) {
      expect(row.hasAttribute('data-builtin')).toBe(true)
      expect(toggleOf(row as HTMLElement).checked).toBe(true)
    }
  })

  it('a built-in section has NO delete affordance', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const row = entryEl(el, ENTRY_KINDS.promptSection, 'foundation')
    expect(row.querySelector('[data-part="entry-delete"]')).toBeNull()
  })

  it('toggling a section off persists enabled=false and is reflected on re-render', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const row = entryEl(el, ENTRY_KINDS.promptSection, 'personality')
    const toggle = toggleOf(row)
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    const stored = readEntries(el.store, ENTRY_KINDS.promptSection)
    expect(stored.find((e) => e.id === 'personality')?.enabled).toBe(false)
    const reRendered = toggleOf(entryEl(el, ENTRY_KINDS.promptSection, 'personality'))
    expect(reRendered.checked).toBe(false)
  })

  it('editing a section\'s content commits to the store on change (blur), not on every keystroke', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const field = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    field.value = 'You are Scout, a research assistant.'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(readEntries(el.store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')?.content).toBe(
      'You are a helpful assistant.', // unchanged — 'input' alone must not commit
    )
    field.dispatchEvent(new Event('change', { bubbles: true }))
    expect(readEntries(el.store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')?.content).toBe(
      'You are Scout, a research assistant.',
    )
  })

  it('an UNCOMMITTED edit in one section survives a SIBLING section\'s toggle re-rendering the whole list (component-reviewer MAJOR fix — the mid-edit clobber)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const foundationField = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    foundationField.focus()
    foundationField.value = 'Half-typed, never committed'
    foundationField.dispatchEvent(new Event('input', { bubbles: true })) // input only — never 'change'

    // A SIBLING entry's toggle triggers a full list re-render via the store's subscribe notification —
    // this must NOT wipe Foundation's still-focused, still-uncommitted textarea.
    const personalityToggle = toggleOf(entryEl(el, ENTRY_KINDS.promptSection, 'personality'))
    personalityToggle.checked = false
    personalityToggle.dispatchEvent(new Event('change', { bubbles: true }))

    const foundationAfter = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    expect(foundationAfter.value).toBe('Half-typed, never committed')
    // Focus itself surviving the rebuild is also asserted, in agent-admin.browser.test.ts — jsdom's own
    // focus tracking across a replaceChildren()-based DOM swap is not reliable enough to assert here
    // (a documented jsdom limitation, not a product behavior question); the VALUE preservation above is
    // this fix's actual claim and IS reliably assertable in jsdom.
  })
})

// GH #419 — the non-blocking modality lint, end to end on a real element (prompt-lint.test.ts owns the
// vocabulary's own probes). The whole point is the WIRING: does the warning appear on the offending
// section's own card when the modality goes dark, and does it clear the moment the toggle comes back?
describe('UIAgentAdminElement — the prompt-section modality lint (GH #419)', () => {
  function noticeOf(el: UIAgentAdminElement, id: string): HTMLElement | null {
    return entryEl(el, ENTRY_KINDS.promptSection, id).querySelector('[data-part="entry-notice"]')
  }

  async function withDialectSection(): Promise<UIAgentAdminElement> {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed()
    // Author the conflict the way an admin (or an imported persona) would: dialect in a section's content.
    const field = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    field.value = 'Always play on ONE A2UI surface: build the table once, then updateDataModel per move.'
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    return el
  }

  it('no warning while the named modality is ON (A2UI ships on) — the text and the toggle agree', async () => {
    const el = await withDialectSection()
    expect(noticeOf(el, 'foundation')).toBeNull()
  })

  it('the warning APPEARS on that section’s card when A2UI is toggled off, and CLEARS when it is toggled back on', async () => {
    const el = await withDialectSection()
    const a2uiToggle = el.querySelector('[data-surface="a2ui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }

    a2uiToggle.checked = false
    a2uiToggle.dispatchEvent(new Event('change'))
    const notice = noticeOf(el, 'foundation')
    expect(notice, 'the offending section must carry the notice').not.toBeNull()
    expect(notice!.textContent).toContain('A2UI')
    expect(notice!.getAttribute('role')).toBe('status') // polite, never an alert — it blocks nothing
    // …and only that section: its clean siblings stay unmarked.
    expect(noticeOf(el, 'personality')).toBeNull()
    expect(noticeOf(el, 'critical-items')).toBeNull()

    a2uiToggle.checked = true
    a2uiToggle.dispatchEvent(new Event('change'))
    expect(noticeOf(el, 'foundation'), 're-enabling the modality clears the warning').toBeNull()
  })

  it('the warning also clears when the TEXT is fixed, with the modality still off', async () => {
    const el = await withDialectSection()
    const a2uiToggle = el.querySelector('[data-surface="a2ui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    a2uiToggle.checked = false
    a2uiToggle.dispatchEvent(new Event('change'))
    expect(noticeOf(el, 'foundation')).not.toBeNull()

    const field = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    field.value = 'Always play on ONE persistent game surface, updated in place on every move.'
    field.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    expect(noticeOf(el, 'foundation'), 'modality-neutral prose is clean even with the modality off').toBeNull()
  })

  it('is NON-BLOCKING: the composed prompt a turn sends is byte-identical with the warning showing', async () => {
    const el = await withDialectSection()
    const requests: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      requests.push(req)
      return 'ok'
    }
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    async function turn(): Promise<void> {
      const before = requests.length
      composer.value = 'deal'
      ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
      for (let i = 0; i < 100 && requests.length === before; i += 1) await Promise.resolve()
      await whenFlushed() // let the finished turn re-enable the composer before the next send
    }

    await turn()
    const a2uiToggle = el.querySelector('[data-surface="a2ui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    a2uiToggle.checked = false
    a2uiToggle.dispatchEvent(new Event('change'))
    expect(noticeOf(el, 'foundation')).not.toBeNull()
    await turn()

    expect(requests).toHaveLength(2)
    expect(requests[1]!.system, 'the lint changes no composed byte').toBe(requests[0]!.system)
    expect(requests[1]!.system, 'and the flagged text itself still reaches the model verbatim').toContain('ONE A2UI surface')
  })
})

describe('UIAgentAdminElement — custom entry authoring (ADR-0132 cl.4, fail-closed)', () => {
  it('the add-form starts hidden and reveals on the add-toggle click', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="skill"]') as HTMLElement
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.hidden).toBe(true)
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    expect(form.hidden).toBe(false)
  })

  it('submitting a valid custom skill adds it, enabled, to the list — and the form resets/hides', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="skill"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = 'Web search'
    ;(section.querySelector('[data-part="entry-add-description"]') as UITextFieldElement).value = 'Searches the web'
    ;(section.querySelector('[data-part="entry-add-content"]') as HTMLTextAreaElement).value = 'search(query)'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    const stored = readEntries(el.store, ENTRY_KINDS.skill)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: 'web-search', label: 'Web search', enabled: true, builtin: false })
    const reRenderedSection = el.querySelector('[data-kind="skill"]') as HTMLElement
    expect((reRenderedSection.querySelector('[data-part="entry-add-form"]') as HTMLElement).hidden).toBe(true)
  })

  it('TKT-0073: the required Name field, left empty and blurred, shows its validation message via the wrapping ui-field\'s OWN error part — never the internal .ui-text-field-message fallback the pre-fix bare control rendered inside its own bordered box', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="tool"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as HTMLElement
    // A real blur (Tab away / click elsewhere) is what flips `trackUserInvalid`'s `interacted` gate —
    // jsdom's `.click()` on a sibling button does not itself relocate focus/fire blur the way a real
    // browser does, so the interaction is dispatched directly on the editor part `trackUserInvalid`'s
    // host-level capture listener watches (matches the real user gesture this bug's repro relies on).
    ;(labelField.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(new Event('blur'))
    await whenFlushed() // the error render rides a reactive effect (field.ts #renderValidity), not a synchronous write

    const fieldWrap = labelField.closest('ui-field') as HTMLElement
    expect(fieldWrap).not.toBeNull() // pins the registration: if `controls/field` is ever unimported, `ui-field` never upgrades and this assertion is what would catch it
    const error = fieldWrap.querySelector('[data-part="error"]') as HTMLElement
    expect(error.hidden).toBe(false)
    expect(error.textContent).toMatch(/fill out this field/i)

    // ADR-0051 cl.4's yield: under a ui-field association, the control's OWN internal fallback message
    // stays empty + hidden — the mechanism that keeps the message OUT of the text-field's bordered box.
    const internalMessage = labelField.querySelector('.ui-text-field-message') as HTMLElement
    expect(internalMessage.hidden).toBe(true)
    expect(internalMessage.textContent).toBe('')
  })

  it('an empty name is rejected — fail-closed, nothing added, an error note shown', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="tool"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    expect(readEntries(el.store, ENTRY_KINDS.tool)).toHaveLength(0)
    const error = section.querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(error.hidden).toBe(false)
    expect(error.textContent).toMatch(/name/i)
  })

  it('a REJECTED submit keeps the form open AND the typed description/content — never silently discarded (component-reviewer MAJOR fix)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="tool"]') as HTMLElement
    const descriptionField = section.querySelector('[data-part="entry-add-description"]') as UITextFieldElement
    const contentField = section.querySelector('[data-part="entry-add-content"]') as HTMLTextAreaElement
    descriptionField.value = 'A description worth keeping'
    contentField.value = 'Content worth keeping'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.hidden).toBe(false) // stays open — a rejection is not a reset
    expect(descriptionField.value).toBe('A description worth keeping')
    expect(contentField.value).toBe('Content worth keeping')
  })

  it('a duplicate label gets a suffixed id, not a rejection', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="workflow"]') as HTMLElement
    const addOnce = (label: string): void => {
      ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = label
      ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    }
    addOnce('Deploy')
    addOnce('Deploy')
    const stored = readEntries(el.store, ENTRY_KINDS.workflow)
    expect(stored.map((e) => e.id)).toEqual(['deploy', 'deploy-2'])
  })

  it('a custom entry CAN be deleted (unlike a built-in)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="resource"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = 'Docs site'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    const row = entryEl(el, ENTRY_KINDS.resource, 'docs-site')
    expect(row.querySelector('[data-part="entry-delete"]')).not.toBeNull()
    ;(row.querySelector('[data-part="entry-delete"]') as HTMLElement).click()
    expect(readEntries(el.store, ENTRY_KINDS.resource)).toHaveLength(0)
  })
})

describe('UIAgentAdminElement — the default store persists across a reload (ADR-0131 cl.3 extended to entries, ADR-0132)', () => {
  it('a SECOND real element instance reads back a committed section edit AND a custom capability entry', () => {
    const first = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const field = contentFieldOf(entryEl(first, ENTRY_KINDS.promptSection, 'foundation'))
    field.value = 'Survives a reload.'
    field.dispatchEvent(new Event('change', { bubbles: true }))

    const skillSection = first.querySelector('[data-kind="skill"]') as HTMLElement
    ;(skillSection.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = 'Persisted skill'
    ;(skillSection.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()

    first.remove()
    mounted.length = 0

    const second = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(contentFieldOf(entryEl(second, ENTRY_KINDS.promptSection, 'foundation')).value).toBe('Survives a reload.')
    expect(readEntries(second.store, ENTRY_KINDS.skill).map((e) => e.label)).toEqual(['Persisted skill'])
  })

  // GH #409 — the reload leg the entries test above never covered: NO seed carries the Surface Options or
  // the master switches (the schema declares the KEYS, not seed values), and the store's rehydration used
  // to walk the seed's own keys only — so every one of these flips persisted on write and came back ON.
  it('a SECOND real element instance reads back a flipped Surface Option AND both flavours of master switch', async () => {
    const first = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed()

    const a2uiToggle = first.querySelector('[data-surface="a2ui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    a2uiToggle.checked = false
    a2uiToggle.dispatchEvent(new Event('change'))
    const agentSwitch = first.querySelector('[data-part="agent-enabled"]') as HTMLElement & { checked: boolean }
    agentSwitch.checked = false
    agentSwitch.dispatchEvent(new Event('change'))
    const skillSwitch = first.querySelector('[data-part="settings-item"][data-item="skill"] [data-part="kind-enabled"]') as HTMLElement & {
      checked: boolean
    }
    skillSwitch.checked = false
    skillSwitch.dispatchEvent(new Event('change'))

    first.remove()
    mounted.length = 0

    const second = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed()
    // The STORE answers the persisted value (the mechanism) …
    expect(second.store!.get(SURFACE_A2UI_KEY)).toBe(false)
    expect(second.store!.get('agentEnabled')).toBe(false)
    expect(second.store!.get('skillsEnabled')).toBe(false)
    // … and the rendered switches agree (the whole shape a person actually sees on reload).
    expect((second.querySelector('[data-surface="a2ui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }).checked).toBe(false)
    expect((second.querySelector('[data-part="agent-enabled"]') as HTMLElement & { checked: boolean }).checked).toBe(false)
    expect(
      (second.querySelector('[data-part="settings-item"][data-item="skill"] [data-part="kind-enabled"]') as HTMLElement & { checked: boolean })
        .checked,
    ).toBe(false)
    // The nested catalog picker rides the same flag (ADR-0170 cl.5): an off modality's children stay
    // dimmed after a reload.
    expect(
      (second.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement).hasAttribute('data-kind-disabled'),
    ).toBe(true)
  })
})

// ── GH #850 / capability-availability-tagging.spec.md SPEC-R2/R3 — the availability mode, composed ────────
// Through the REAL element: which kinds offer the mode control, that a flip persists and survives a reload,
// and that a user-invocable entry contributes ZERO ambient bytes on every arm — the live prompt (both live
// arms read the same projection), `integrations`, the stub/logger config snapshot, and the Context System
// view. The read-time default itself is entry-data.test.ts's; the projection unit is entries.test.ts's.

describe('UIAgentAdminElement — the per-entry availability mode (GH #850/SPEC-R2/R3)', () => {
  function addEntry(el: UIAgentAdminElement, kind: string, label: string): void {
    const section = el.querySelector(`[data-kind="${kind}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = label
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
  }
  const modePill = (row: HTMLElement): (HTMLElement & { pressed: boolean }) | null =>
    row.querySelector('[data-part="entry-availability"]') as (HTMLElement & { pressed: boolean }) | null
  /** The one user gesture: a real `toggle` from the row's mode pill (ui-toggle emits it BEFORE committing
   *  `pressed`, so this is exactly what a click/Space lands on the wired listener). */
  function flipMode(el: UIAgentAdminElement, kind: string, id: string): void {
    modePill(entryEl(el, kind, id))!.dispatchEvent(new CustomEvent('toggle', { cancelable: true, bubbles: true }))
  }
  function submit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  }
  async function waitFor(predicate: () => boolean, label: string): Promise<void> {
    for (let i = 0; i < 100; i += 1) {
      if (predicate()) return
      await Promise.resolve()
    }
    throw new Error(`waitFor timed out: ${label}`)
  }

  it('SPEC-R1/R2: only the FOUR capability kinds offer the mode control — prompt sections, pattern sources and catalogs never do', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    for (const kind of [ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool]) {
      addEntry(el, kind, 'Item')
      expect(modePill(entryEl(el, kind, 'item')), `${kind} offers the mode control`).not.toBeNull()
    }
    addEntry(el, ENTRY_KINDS.patternSource, 'Source')
    expect(modePill(entryEl(el, ENTRY_KINDS.patternSource, 'source')), 'pattern-source has its own single-pick semantics').toBeNull()
    expect(modePill(entryEl(el, ENTRY_KINDS.promptSection, 'foundation')), 'a prompt section composes by ORDER, not availability').toBeNull()
    const catalogRow = el.querySelector(
      `[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"] [data-part="entry"]`,
    ) as HTMLElement
    expect(modePill(catalogRow), "the catalog's selection threads on the wire, never as availability").toBeNull()
    expect(catalogRow.hasAttribute('data-availability'), 'and no row marker either').toBe(false)
  })

  it('SPEC-R2 AC2: a flip persists, marks the row, and a SECOND element instance renders the same state', () => {
    const first = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(first, ENTRY_KINDS.resource, 'Menu PDF')
    expect(entryEl(first, ENTRY_KINDS.resource, 'menu-pdf').getAttribute('data-availability')).toBe('context')

    flipMode(first, ENTRY_KINDS.resource, 'menu-pdf')
    expect(readEntries(first.store, ENTRY_KINDS.resource)[0]!.availability, 'the store holds the mode').toBe('invocable')
    const flipped = entryEl(first, ENTRY_KINDS.resource, 'menu-pdf')
    expect(flipped.getAttribute('data-availability'), 'the row carries the at-a-glance marker').toBe('invocable')
    expect(modePill(flipped)!.pressed).toBe(true)

    // …and back again: nothing is one-way, and the returning value is the explicit 'context' literal.
    flipMode(first, ENTRY_KINDS.resource, 'menu-pdf')
    expect(readEntries(first.store, ENTRY_KINDS.resource)[0]!.availability).toBe('context')
    expect(entryEl(first, ENTRY_KINDS.resource, 'menu-pdf').getAttribute('data-availability')).toBe('context')

    flipMode(first, ENTRY_KINDS.resource, 'menu-pdf') // leave it invocable for the reload leg
    first.remove()
    mounted.length = 0

    const second = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement) // the default persisted store
    const reloaded = entryEl(second, ENTRY_KINDS.resource, 'menu-pdf')
    expect(reloaded.getAttribute('data-availability'), 'survives a reload').toBe('invocable')
    expect(modePill(reloaded)!.pressed).toBe(true)
  })

  it('SPEC-R3 AC1/AC2: the PROSE arm carries neither the invocable entry\'s prose nor its tool id', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false) // no structured surface ⇒ the prose arm answers
    addEntry(el, ENTRY_KINDS.skill, 'House style')
    addEntry(el, ENTRY_KINDS.skill, 'Menu PDF')
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    flipMode(el, ENTRY_KINDS.skill, 'menu-pdf')
    flipMode(el, ENTRY_KINDS.tool, 'currency')

    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      calls.push(req)
      return 'ok'
    }
    submit(el, 'ping')
    await waitFor(() => calls.length === 1, 'prose runner called')
    expect(calls[0]!.system).toContain('### House style')
    expect(calls[0]!.system, 'the invocable skill is nowhere in the prompt').not.toContain('Menu PDF')
    expect(calls[0]!.integrations, 'and the invocable tool forwards no id').toEqual(['weather'])
  })

  it('SPEC-R3 AC2: the SURFACE arm reads the SAME projection — the two arms cannot drift', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: initialEntryValues() })
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    flipMode(el, ENTRY_KINDS.tool, 'currency')

    const seen: Array<{ integrations?: string[]; personaSystem: string }> = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as unknown as { integrations?: string[]; personaSystem: string })
      yield { kind: 'note' as const, note: 'ok' }
    }
    submit(el, 'play')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    expect(seen, 'the surface runner ran').toHaveLength(1)
    expect(seen[0]!.integrations).toEqual(['weather'])
    expect(seen[0]!.personaSystem).not.toContain('currency')
  })

  it('SPEC-R3(c)/(d): the stub-arm snapshot and the Context System view both drop the invocable entry', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.skill, 'House style')
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    flipMode(el, ENTRY_KINDS.resource, 'menu-pdf')

    // (c) the deterministic stub reply cites the config snapshot's per-kind LABEL lists.
    submit(el, 'hello')
    const bubbles = [...el.querySelectorAll('[data-role="agent"]')]
    const body = (bubbles[bubbles.length - 1]?.querySelector('[data-part="body"]') as HTMLElement)?.textContent ?? ''
    expect(body).toContain('Skills: House style.')
    expect(body, 'the invocable resource is not part of what the agent brings to every turn').toContain('Resources: none.')

    // (d) the Context tab's System snapshot renders composeLiveSystemPrompt's output — it inherits (a).
    const agentJson = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { systemPrompt: string }
    expect(agentJson.systemPrompt).toContain('### House style')
    expect(agentJson.systemPrompt).not.toContain('Menu PDF')
  })

  it('SPEC-R3 AC3 (gated equivalence): a store whose entries all LACK the field projects byte-identically', async () => {
    // The explicit equivalence assertion, at element grain: the same two entries, one store field-less and
    // one carrying an explicit `availability: 'context'` on every entry, compose the same prompt bytes and
    // the same `integrations` — so the widened filter moved nothing for any pre-#850 store.
    const entries = (availability?: 'context'): Entry[] => [
      { id: 'weather', kind: ENTRY_KINDS.tool, label: 'weather', description: '', content: 'w', order: 0, enabled: true, builtin: false, ...(availability === undefined ? {} : { availability }) },
      { id: 'currency', kind: ENTRY_KINDS.tool, label: 'currency', description: '', content: 'c', order: 1, enabled: true, builtin: false, ...(availability === undefined ? {} : { availability }) },
    ]
    const captured: Array<{ system: string; integrations?: readonly string[] }> = []
    for (const availability of [undefined, 'context' as const]) {
      const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
      el.store = createMemoryStore({ initial: { ...initialEntryValues(), [entriesStoreKey(ENTRY_KINDS.tool)]: entries(availability), [SURFACE_A2UI_KEY]: false } })
      document.body.append(el)
      mounted.push(el)
      await whenFlushed()
      el.agentTurn = async (req) => {
        captured.push({ system: req.system, integrations: req.integrations })
        return 'ok'
      }
      submit(el, 'ping')
      await waitFor(() => captured.length > 0 && captured.length === (availability === undefined ? 1 : 2), 'runner called')
      el.remove()
    }
    expect(captured[0]!.system, 'anti-vacuous: the projection really carries the entries').toContain('## Tools available to you')
    expect(captured[0]!.integrations).toEqual(['weather', 'currency'])
    expect(captured[1]!.system, 'absent ≡ explicit context, byte for byte').toBe(captured[0]!.system)
    expect(captured[1]!.integrations).toEqual(captured[0]!.integrations)
  })
})

// ── GH #849 / capability-availability-tagging.spec.md SPEC-R8 + SPEC-R4 (slice S3) — the reach path ───────
// The composed half: the rosters this element hands its composers, and what a committed reference does at
// send on BOTH live arms (the framed user turn, the `integrations` union, the recorded history, and the
// fail-closed drop). The projections themselves are entries.test.ts's pure units; the typeahead's own
// grammar/keyboard is conversation-composer.test.ts's. Everything below drives the REAL composer.

describe('UIAgentAdminElement — the composer reach path (GH #849/SPEC-R8/R4)', () => {
  function addEntry(el: UIAgentAdminElement, kind: string, label: string): void {
    const section = el.querySelector(`[data-kind="${kind}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = label
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
  }
  /** Give an entry a real body, the way the row's content editor commits one. */
  function setEntry(el: UIAgentAdminElement, kind: string, id: string, patch: Partial<Entry>): void {
    el.store!.set(
      entriesStoreKey(kind),
      readEntries(el.store, kind).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    )
  }
  type Composer = HTMLElement & {
    value: string
    mentionables?: readonly { id: string; label: string; kind: string }[]
    invocables?: readonly { id: string; label: string; kind: string }[]
  }
  const composersOf = (el: UIAgentAdminElement): Composer[] => [...el.querySelectorAll<Composer>('ui-conversation-composer')]
  const chatComposer = (el: UIAgentAdminElement): Composer => composersOf(el)[0]!
  const editorOf = (composer: Composer): HTMLElement => composer.querySelector('[data-part="editor"]') as HTMLElement
  /** Type like a user: write the editor surface, then fire its own `input` (the composer's one entry point). */
  function typeInto(composer: Composer, text: string): void {
    const editor = editorOf(composer)
    editor.textContent = text
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const menuLabels = (composer: Composer): string[] =>
    [...composer.querySelectorAll('[data-part="reference-option-label"]')].map((n) => n.textContent ?? '')
  /** Commit the menu's first option — a real click on the option (the panel's own delegated listener). */
  function commitFirstOption(composer: Composer): void {
    const option = composer.querySelector('[data-part="reference-option"]') as HTMLElement
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  function send(composer: Composer): void {
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  }
  /** Type a trigger token, commit the first match, then type the message and send it. */
  function referenceAndSend(composer: Composer, token: string, text: string): void {
    typeInto(composer, token)
    commitFirstOption(composer)
    typeInto(composer, text)
    send(composer)
  }
  async function waitFor(predicate: () => boolean, label: string): Promise<void> {
    for (let i = 0; i < 100; i += 1) {
      if (predicate()) return
      await Promise.resolve()
    }
    throw new Error(`waitFor timed out: ${label}`)
  }

  it('SPEC-R8: the rosters carry enabled entries of BOTH modes, and nothing disabled or master-off', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    addEntry(el, ENTRY_KINDS.resource, 'Retired')
    addEntry(el, ENTRY_KINDS.skill, 'House style')
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    setEntry(el, ENTRY_KINDS.resource, 'menu-pdf', { availability: 'invocable' })
    setEntry(el, ENTRY_KINDS.resource, 'retired', { enabled: false })
    await whenFlushed() // ui-conversation hands its composer the rosters in its own batched effect

    const composer = chatComposer(el)
    expect(composer.mentionables?.map((o) => o.id), 'both modes in, the disabled row out').toEqual(['menu-pdf'])
    expect(composer.invocables?.map((o) => o.id)).toEqual(['house-style', 'weather'])

    el.store!.set('toolsEnabled', false) // the tool kind's MASTER switch
    await whenFlushed()
    expect(composer.invocables?.map((o) => o.id), 'a master-off kind leaves the menu wholesale').toEqual(['house-style'])
  })

  it('SPEC-R8 AC2: a rename in the store shows on the next roster build; the id never moves', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    setEntry(el, ENTRY_KINDS.resource, 'menu-pdf', { label: 'Dinner menu' })
    await whenFlushed()
    // GH #891/SPEC-R9 — the projection also hands the composer this kind's own glyph (`icon`), which is why
    // the expected shape carries one: the composer renders it, never derives it (entries.ts's KIND_GLYPHS).
    expect(chatComposer(el).mentionables).toEqual([
      { id: 'menu-pdf', label: 'Dinner menu', kind: ENTRY_KINDS.resource, icon: 'file-text' },
    ])
  })

  it('SPEC-R8: the Co-pilot composer reads the BUILDER store — unarmed, it offers nothing at all', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    await whenFlushed()
    const copilot = composersOf(el)[1]!
    expect(copilot.mentionables, 'the draft persona’s entries never leak into the interview composer').toEqual([])
    expect(copilot.invocables).toEqual([])
  })

  it('SPEC-R4 AC1: a mentioned resource frames into the user turn, and HISTORY records the framed text', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false) // no structured surface ⇒ the prose arm answers
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    setEntry(el, ENTRY_KINDS.resource, 'menu-pdf', { availability: 'invocable', content: 'Starters — soup 6' })
    await whenFlushed()

    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      calls.push(req)
      return 'ok'
    }
    const composer = chatComposer(el)
    typeInto(composer, '@Menu')
    expect(menuLabels(composer), 'the roster really drives the menu').toEqual(['Menu PDF'])
    commitFirstOption(composer)
    expect(composer.value, 'the token text leaves the editor on commit').toBe('')
    typeInto(composer, 'Total the dinner order')
    send(composer)

    await waitFor(() => calls.length === 1, 'prose runner called')
    expect(calls[0]!.text).toBe(
      '## Referenced for this message\n### Menu PDF (resource)\n\nStarters — soup 6\n\nTotal the dinner order',
    )
    expect(calls[0]!.system, 'and it is STILL not ambient — invocable means invocable').not.toContain('Starters — soup 6')

    // The next turn replays history: what the model saw is what rides forward (no re-mention needed).
    typeInto(composer, 'and the wine?')
    send(composer)
    await waitFor(() => calls.length === 2, 'second turn')
    expect(calls[1]!.history?.[0]).toEqual({ role: 'user', content: calls[0]!.text })
    expect(calls[1]!.text, 'a turn with no reference is the bare typed text').toBe('and the wine?')
  })

  it('SPEC-R4 AC2: an invoked tool unions into THAT turn’s integrations; the next turn is ambient again', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false)
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    setEntry(el, ENTRY_KINDS.tool, 'currency', { availability: 'invocable' })
    await whenFlushed()

    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      calls.push(req)
      return 'ok'
    }
    const composer = chatComposer(el)
    referenceAndSend(composer, '/currency', 'convert this')
    await waitFor(() => calls.length === 1, 'prose runner called')
    expect(calls[0]!.integrations, 'the ambient id and the invoked one, exactly once each').toEqual(['weather', 'currency'])
    expect(calls[0]!.text, 'a tool rides the wire, never the prose').toBe('convert this')

    typeInto(composer, 'and again')
    send(composer)
    await waitFor(() => calls.length === 2, 'second turn')
    expect(calls[1]!.integrations, 'nothing persists past the turn that invoked it').toEqual(['weather'])
  })

  it('SPEC-R4 AC2/AC3 on the SURFACE arm: same framed text, same union, same fail-closed drop', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: initialEntryValues() })
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    setEntry(el, ENTRY_KINDS.resource, 'menu-pdf', { availability: 'invocable', content: 'soup 6' })
    setEntry(el, ENTRY_KINDS.tool, 'currency', { availability: 'invocable' })
    await whenFlushed()

    const seen: Array<{ integrations?: string[]; turn: { kind: string; text?: string } }> = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as unknown as { integrations?: string[]; turn: { kind: string; text?: string } })
      yield { kind: 'note' as const, note: 'ok' }
    }
    const composer = chatComposer(el)
    typeInto(composer, '@Menu')
    commitFirstOption(composer)
    typeInto(composer, ' ') // a token boundary, so the next trigger reads as a token start
    typeInto(composer, ' /currency')
    commitFirstOption(composer)
    typeInto(composer, 'total it')
    send(composer)
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()

    expect(seen, 'the surface runner ran').toHaveLength(1)
    expect(seen[0]!.turn.text).toBe('## Referenced for this message\n### Menu PDF (resource)\n\nsoup 6\n\ntotal it')
    expect(seen[0]!.integrations).toEqual(['currency'])
  })

  it('SPEC-R4 AC3: a reference whose entry is deleted between menu and send drops — the turn still sends', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false)
    addEntry(el, ENTRY_KINDS.resource, 'Menu PDF')
    setEntry(el, ENTRY_KINDS.resource, 'menu-pdf', { availability: 'invocable', content: 'soup 6' })
    await whenFlushed()

    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      calls.push(req)
      return 'ok'
    }
    const composer = chatComposer(el)
    typeInto(composer, '@Menu')
    commitFirstOption(composer)
    typeInto(composer, 'Total the dinner order')
    el.store!.set(entriesStoreKey(ENTRY_KINDS.resource), []) // deleted while the chip sits in the row
    send(composer)

    await waitFor(() => calls.length === 1, 'prose runner called')
    expect(calls[0]!.text, 'the stale reference contributes nothing at all').toBe('Total the dinner order')
    expect(calls[0]!.text).not.toContain('soup 6')
  })
})

describe('UIAgentAdminElement — composeSystemPrompt (ADR-0132 cl.2)', () => {
  it('concatenates ENABLED sections in order, labeled, skipping disabled/empty ones', () => {
    const sections: Entry[] = [
      { id: 'a', kind: 'prompt-section', label: 'A', description: '', content: 'first', order: 0, enabled: true, builtin: true },
      { id: 'b', kind: 'prompt-section', label: 'B', description: '', content: 'second', order: 1, enabled: false, builtin: true },
      { id: 'c', kind: 'prompt-section', label: 'C', description: '', content: '', order: 2, enabled: true, builtin: true },
      { id: 'd', kind: 'prompt-section', label: 'D', description: '', content: 'third', order: 3, enabled: true, builtin: false },
    ]
    expect(composeSystemPrompt(sections)).toBe('## A\nfirst\n\n## D\nthird')
  })

  it('falls back to DEFAULT_SYSTEM_PROMPT_FALLBACK when every section is disabled or empty (fail-closed)', () => {
    expect(composeSystemPrompt([])).toBe(DEFAULT_SYSTEM_PROMPT_FALLBACK)
    expect(
      composeSystemPrompt([{ id: 'a', kind: 'prompt-section', label: 'A', description: '', content: '', order: 0, enabled: true, builtin: true }]),
    ).toBe(DEFAULT_SYSTEM_PROMPT_FALLBACK)
  })
})

describe('UIAgentAdminElement — live-apply turn loop (ADR-0132 cl.6: composed prompt + enabled-capabilities snapshot)', () => {
  function submit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text // the composer's own value prop (TKT-0058 — the nested field/form are gone)
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  }

  function lastAgentBody(el: UIAgentAdminElement): string {
    const bubbles = [...el.querySelectorAll('[data-role="agent"]')]
    const last = bubbles[bubbles.length - 1]
    return (last?.querySelector('[data-part="body"]') as HTMLElement)?.textContent ?? ''
  }

  function addEntry(el: UIAgentAdminElement, kind: string, label: string): void {
    const section = el.querySelector(`[data-kind="${kind}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = label
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
  }

  it('the reply cites the composed prompt AND the enabled capability labels, clearly labeled as a stub', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.skill, 'Web search')
    addEntry(el, ENTRY_KINDS.tool, 'Calculator')
    submit(el, 'hello')
    const body = lastAgentBody(el)
    expect(body).toMatch(/^\[stub preview/)
    expect(body).toContain('Skills: Web search.')
    expect(body).toContain('Tools: Calculator.')
    expect(body).toContain('Workflows: none.')
    expect(body).toContain('Resources: none.')
    expect(body).toContain('hello')
  })

  it('disabling a prompt section changes the NEXT reply\'s composed-prompt citation, without a manual reload', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const foundation = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    foundation.value = 'Speak like a pirate.'
    foundation.dispatchEvent(new Event('change', { bubbles: true }))
    submit(el, 'one')
    expect(lastAgentBody(el)).toContain('Speak like a pirate')

    const toggle = toggleOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    submit(el, 'two')
    expect(lastAgentBody(el)).not.toContain('Speak like a pirate')
  })

  it('toggling a capability off removes it from the NEXT reply\'s enabled-list, without a manual reload', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.skill, 'Web search')
    submit(el, 'one')
    expect(lastAgentBody(el)).toContain('Skills: Web search.')

    const toggle = toggleOf(entryEl(el, ENTRY_KINDS.skill, 'web-search'))
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    submit(el, 'two')
    expect(lastAgentBody(el)).toContain('Skills: none.')
  })
})

describe('UIAgentAdminElement — the DEV-only live-turn fork (TKT-0052/ADR-0136)', () => {
  function submit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text // the composer's own value prop (TKT-0058 — the nested field/form are gone)
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  }
  function lastAgentBody(el: UIAgentAdminElement): string {
    const bubbles = [...el.querySelectorAll('[data-role="agent"]')]
    return ((bubbles[bubbles.length - 1]?.querySelector('[data-part="body"]')) as HTMLElement)?.textContent ?? ''
  }
  function systemBubbleText(el: UIAgentAdminElement): string {
    const bubbles = [...el.querySelectorAll('[data-role="system"]')]
    return ((bubbles[bubbles.length - 1]?.querySelector('[data-part="body"]')) as HTMLElement)?.textContent ?? ''
  }
  function addEntry(el: UIAgentAdminElement, kind: string, label: string): void {
    const section = el.querySelector(`[data-kind="${kind}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = label
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
  }
  async function waitFor(predicate: () => boolean, label: string): Promise<void> {
    for (let i = 0; i < 100; i += 1) {
      if (predicate()) return
      await Promise.resolve() // drain the runner's own microtask chain (setNote/finalize run synchronously after await)
    }
    throw new Error(`waitFor timed out: ${label}`)
  }

  interface Recorder {
    fn: import('./agent-admin-schema.ts').AdminAgentTurn
    calls: import('./agent-admin-schema.ts').AdminTurnRequest[]
  }
  function recordingRunner(reply: string): Recorder {
    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    const fn: import('./agent-admin-schema.ts').AdminAgentTurn = async (req) => {
      calls.push(req)
      return reply
    }
    return { fn, calls }
  }

  it('an injected resolving runner renders its reply as the agent note (setNote/finalize), NOT the stub string', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const runner = recordingRunner('The live model says hi.')
    el.agentTurn = runner.fn
    submit(el, 'hello')
    await waitFor(() => lastAgentBody(el) === 'The live model says hi.', 'live reply rendered')
    expect(lastAgentBody(el)).not.toMatch(/^\[stub preview/)
    expect(runner.calls).toHaveLength(1)
    expect(runner.calls[0]!.text).toBe('hello')
  })

  it("the request's `system` is the composed prompt PLUS the enabled-capability projection; `model` is the current selection", async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const target = SUPPORTED_MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    addEntry(el, ENTRY_KINDS.skill, 'Web search')
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn
    submit(el, 'ping')
    await waitFor(() => runner.calls.length === 1, 'runner called')
    const req = runner.calls[0]!
    expect(req.model).toBe(target.id)
    expect(req.system).toContain('## Foundation') // the composed prompt is the base
    expect(req.system).toContain('## Skills available to you') // the capability projection is appended
    expect(req.system).toContain('### Web search')
  })

  it('defaults `effort` to "medium" when the composer Effort picker was never touched', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn
    submit(el, 'ping')
    await waitFor(() => runner.calls.length === 1, 'runner called')
    expect(runner.calls[0]!.effort).toBe('medium')
  })

  it('the composer\'s Models picker is wired to SUPPORTED_MODELS + the persisted `model` store key (one source of truth with the settings pane)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed() // the models/model props ride ui-conversation's own reactive-prop effect, not synchronous
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    // rev.4: the picker offers the INCLUDED roster only — Haiku + Sonnet ship on, the rest ship off
    const included = SUPPORTED_MODELS.filter((m) => m.includedByDefault)
    expect(conversation.models).toEqual(included)
    expect(conversation.model).toBe(DEFAULT_MODEL_ID)

    // An EXTERNAL store write (another tab, the settings pane's own field) feeds back into `conversation.model`.
    const target = included.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    await whenFlushed()
    expect(conversation.model).toBe(target.id)

    // Committing a Models picker choice writes the SAME store key — never a second, parallel selection.
    const other = included.find((m) => m.id !== target.id)!
    const menu = el.querySelector('[data-part="models-menu"]') as HTMLElement
    ;(menu.querySelector(`[data-value="${other.id}"]`) as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    expect(el.store!.get('model')).toBe(other.id)
  })

  it("the request's `effort` reflects the composer's Effort picker selection", async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    await whenFlushed()
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    expect(conversation.efforts?.map((o) => o.id)).toEqual(['low', 'medium', 'high', 'xhigh'])
    // Drive the SAME path a real picker commit does: fire the registered onEffortChange callback.
    const menu = el.querySelector('[data-part="effort-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="high"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn
    submit(el, 'ping')
    await waitFor(() => runner.calls.length === 1, 'runner called')
    expect(runner.calls[0]!.effort).toBe('high')
  })

  it('the kind MASTER switches gate the projection (vision rev.5: default ON; an explicit false gates the kind out)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.tool, 'Calculator')
    addEntry(el, ENTRY_KINDS.skill, 'Web search')
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn

    submit(el, 'one') // rev.5: masters default ON — an enabled entry projects out of the box
    await waitFor(() => runner.calls.length === 1, 'first call')
    expect(runner.calls[0]!.system).toContain('## Tools available to you')
    expect(runner.calls[0]!.system).toContain('## Skills available to you')

    el.store!.set('toolsEnabled', false) // the tool kind's master key (kindEnabledKey('tool') — the old key carries over)
    el.store!.set('skillsEnabled', false)
    submit(el, 'two')
    await waitFor(() => runner.calls.length === 2, 'second call')
    expect(runner.calls[1]!.system).not.toContain('## Tools available to you')
    expect(runner.calls[1]!.system).not.toContain('## Skills available to you')
  })

  // ADR-0168 cl.5 / SPEC-R19 AC2 (GH #402) — the reported repro, inverted: tools enabled, NO structured
  // surface on, a PROSE turn dispatches. The toggle was a silent no-op on this arm — enablement reached
  // only the surface arm's request. Both runners are armed here so the assertion also proves WHICH arm ran.
  it('a prose turn carries the enabled tool ids (GH #402: the toggle was a silent no-op on this arm)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false) // no structured surface — the prose arm answers (GenUI defaults OFF)
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    const surfaceCalls: unknown[] = []
    el.agentSurfaceTurn = async function* () {
      surfaceCalls.push(1)
    }
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn

    submit(el, 'weather in Oslo?')
    await waitFor(() => runner.calls.length === 1, 'prose runner called')
    expect(surfaceCalls, 'the surface arm must NOT run with both structured modalities off').toHaveLength(0)
    expect(runner.calls[0]!.integrations).toEqual(['weather', 'currency'])

    // The kind's MASTER switch gates it exactly as it gates the prompt projection — off ⇒ no ids at all
    // (not merely an unmentioned tool section), so the host route can never dispatch a disabled tool.
    el.store!.set('toolsEnabled', false)
    submit(el, 'and now?')
    await waitFor(() => runner.calls.length === 2, 'second prose turn')
    expect(runner.calls[1]!.integrations).toEqual([])
  })

  it('a per-entry toggle OFF drops that id from the request (the fresh-read law, same as the prompt projection)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false)
    addEntry(el, ENTRY_KINDS.tool, 'weather')
    addEntry(el, ENTRY_KINDS.tool, 'currency')
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn

    const toggle = toggleOf(entryEl(el, ENTRY_KINDS.tool, 'weather')) // the slug id of the 'weather' label
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    submit(el, 'ping')
    await waitFor(() => runner.calls.length === 1, 'runner called')
    expect(runner.calls[0]!.integrations).toEqual(['currency'])
  })

  it('Dialog Turns (vision rev.5): every turn logs request/response JSON, newest first, failures included', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const runner = recordingRunner('first reply')
    el.agentTurn = runner.fn
    submit(el, 'hello')
    await waitFor(() => runner.calls.length === 1, 'first turn')
    await waitFor(() => el.querySelectorAll('[data-part="context-turn"]').length === 1, 'first turn logged')
    const one = el.querySelector('[data-part="context-turn"]') as HTMLElement
    expect(one.querySelector('[data-part="summary-text"]')?.textContent).toBe('01')
    const payload = JSON.parse(one.querySelector('[data-part="context-json"]')!.textContent ?? '{}') as { arm: string; request: { text: string }; response: { reply: string } }
    expect(payload.arm).toBe('live')
    expect(payload.request.text).toBe('hello')
    expect(payload.response.reply).toBe('first reply')

    // A FAILED turn logs too (a payload inspector exists exactly for this) — newest first.
    el.agentTurn = () => Promise.reject(new Error('proxy down'))
    submit(el, 'again')
    await waitFor(() => el.querySelectorAll('[data-part="context-turn"]').length === 2, 'failed turn logged')
    const labels = [...el.querySelectorAll('[data-part="context-turn"] [data-part="summary-text"]')].map((s) => s.textContent)
    expect(labels).toEqual(['02', '01'])
    const failed = JSON.parse(el.querySelector('[data-part="context-turn"] [data-part="context-json"]')!.textContent ?? '{}') as { response: { error: string } }
    expect(failed.response.error).toBe('proxy down')
  })

  it('the Context Agent System view re-derives on a store write (name + master toggles reach the JSON)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const agentItemJson = (): Record<string, unknown> =>
      JSON.parse(el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}') as Record<string, unknown>
    expect(agentItemJson()['name']).toBe('Untitled agent')
    el.store!.set('name', 'The Concierge')
    expect(agentItemJson()['name']).toBe('The Concierge')
    // a kind master OFF: the kind's context item reflects it AND its section host dims
    el.store!.set('skillsEnabled', false)
    const skillsJson = JSON.parse(el.querySelector(`[data-part="context-item"][data-item="${ENTRY_KINDS.skill}"] [data-part="context-json"]`)!.textContent ?? '{}') as { enabled: boolean }
    expect(skillsJson.enabled).toBe(false)
    expect(el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.skill}"]`)?.hasAttribute('data-kind-disabled')).toBe(true)
  })

  it('the Agent master switch OFF makes the agent unavailable: composer disabled, a programmatic submit runs NO turn (vision rev.5)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn
    el.store!.set('agentEnabled', false)
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    await whenFlushed()
    expect(conversation.disabled).toBe(true)
    submit(el, 'hello') // the belt: even a programmatic submit is refused
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(runner.calls).toHaveLength(0)

    el.store!.set('agentEnabled', true) // flipping back re-enables — the switch is the way back
    await whenFlushed()
    expect(conversation.disabled).toBe(false)
    submit(el, 'hello again')
    await waitFor(() => runner.calls.length === 1, 'turn after re-enable')
  })

  it('fresh-read: a store edit between two turns changes the SECOND request; history accumulates and the FIRST request object is never rewritten', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const foundation = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    foundation.value = 'Speak like a pirate.'
    foundation.dispatchEvent(new Event('change', { bubbles: true }))
    const runner = recordingRunner('aye')
    el.agentTurn = runner.fn

    submit(el, 'one')
    await waitFor(() => runner.calls.length === 1, 'first call')
    const firstReq = runner.calls[0]!
    expect(firstReq.system).toContain('Speak like a pirate.')
    expect(firstReq.history).toEqual([]) // turn 1 carries no prior history

    // switch the model + edit the prompt between turns
    const target = SUPPORTED_MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    foundation.value = 'Speak like a robot.'
    foundation.dispatchEvent(new Event('change', { bubbles: true }))

    submit(el, 'two')
    await waitFor(() => runner.calls.length === 2, 'second call')
    const secondReq = runner.calls[1]!
    expect(secondReq.model).toBe(target.id)
    expect(secondReq.system).toContain('Speak like a robot.')
    expect(secondReq.system).not.toContain('Speak like a pirate.')
    // the second request replays the first COMPLETED turn as prior history (user + assistant)
    expect(secondReq.history).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'aye' },
    ])
    // the first request object is untouched — no retroactive rewrite of a prior turn's system/model/history
    expect(firstReq.system).toContain('Speak like a pirate.')
    expect(firstReq.system).not.toContain('Speak like a robot.')
    expect(firstReq.history).toEqual([])
  })

  it('a THROWING runner degrades via fail(): a ⚠ system bubble surfaces the message and the composer re-enables — never a crash', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.agentTurn = async () => {
      throw new Error('network is down')
    }
    submit(el, 'boom')
    await waitFor(() => systemBubbleText(el).includes('network is down'), 'error system bubble')
    expect(systemBubbleText(el)).toContain('⚠')
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement
    expect(composer.hasAttribute('busy'), 'the composer must re-enable after a failed live turn').toBe(false)
    // a subsequent turn still proceeds (the page recovered on the throw path)
    el.agentTurn = async () => 'recovered'
    submit(el, 'again')
    await waitFor(() => lastAgentBody(el) === 'recovered', 'recovery turn rendered')
  })

  it('agentTurn UNSET keeps the stub reply byte-identical to today (the static-build default path)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    submit(el, 'hi')
    expect(lastAgentBody(el)).toMatch(/^\[stub preview — no live model call\]/)
    expect(lastAgentBody(el)).toContain('You said: hi')
  })

  // GH #848 — the whole point of a DISPLAY-ONLY rename, measured on the two projections that matter: the
  // prompt (where names are TAUGHT — the renamed label must be what the model reads) and the enablement
  // wire (where ids are RESOLVED — the rename must be invisible). One turn proves both directions.
  it('a renamed tool teaches its NEW name in the prompt while the wire keeps its ORIGINAL id (GH #848)', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    el.store!.set(SURFACE_A2UI_KEY, false) // the prose arm answers, so ONE request carries both facts
    // A pack-shaped entry: the id is a foreign key into an external registry, the label human text
    // (`NewEntryInput.id`, ADR-0168 cl.2) — exactly the row a rename must not break.
    el.store!.set(entriesStoreKey(ENTRY_KINDS.tool), [
      { id: 'weather', kind: ENTRY_KINDS.tool, label: 'Weather (Open-Meteo)', description: 'Current conditions.', content: 'Keyless.', order: 0, enabled: true, builtin: false },
    ] satisfies Entry[])
    await whenFlushed()

    const row = entryEl(el, ENTRY_KINDS.tool, 'weather')
    ;(row.querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row.querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    field.value = 'Local forecast'
    field.dispatchEvent(new Event('change'))
    await whenFlushed()

    const stored = readEntries(el.store, ENTRY_KINDS.tool)
    expect(stored[0]!.label, 'the store carries the new display name').toBe('Local forecast')
    expect(stored[0]!.id, 'the registry id is untouched').toBe('weather')

    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn
    submit(el, 'weather in Oslo?')
    await waitFor(() => runner.calls.length === 1, 'runner called')
    expect(runner.calls[0]!.system, 'the prompt teaches the RENAMED name').toContain('### Local forecast')
    expect(runner.calls[0]!.system, 'and never the old one').not.toContain('Weather (Open-Meteo)')
    expect(runner.calls[0]!.integrations, 'the wire still resolves by the original id').toEqual(['weather'])
  })
})

describe('UIAgentAdminElement — a bring-your-own store with NO subscribe() still re-renders (component-reviewer MODERATE fix)', () => {
  it('adding a custom entry to a store lacking subscribe() still appears in the rendered list', () => {
    // SettingsStore.subscribe is OPTIONAL (store.ts) — a spec-conformant store may omit it entirely.
    const values = new Map<string, unknown>(Object.entries(initialEntryValues()))
    const noSubscribeStore: SettingsStore = {
      get: (key) => values.get(key),
      set: (key, value) => values.set(key, value),
      // no `subscribe` key at all
    }
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = noSubscribeStore
    mount(el)
    const section = el.querySelector('[data-kind="skill"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as UITextFieldElement).value = 'No-subscribe skill'
    ;(section.querySelector('[data-part="entry-add-submit"]') as HTMLElement).click()
    const row = el.querySelector('[data-kind="skill"] [data-entry-id="no-subscribe-skill"]')
    expect(row, 'the fallback direct-render must have fired since no subscribe() could').not.toBeNull()
  })
})

describe('UIAgentAdminElement — composition survives a RECONNECT (the master-detail.ts/settings.ts precedent)', () => {
  it('re-parenting a connected instance leaves EXACTLY ONE ui-super-shell — no duplicate composition', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el) // detach + reattach — connectedCallback fires again
    expect(el.querySelectorAll(':scope > ui-super-shell').length).toBe(1)
    expect(el.querySelectorAll('[data-part="canvas"]').length).toBe(1)
    expect(el.querySelectorAll('[data-kind="skill"]').length).toBe(1)
    wrapper.remove()
  })

  it('a section edit still commits to the store AFTER a reconnect (the listener is re-armed, not just the DOM preserved)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el)
    const field = contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation'))
    field.value = 'Still committing after reconnect.'
    field.dispatchEvent(new Event('change', { bubbles: true }))
    expect(readEntries(el.store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')?.content).toBe(
      'Still committing after reconnect.',
    )
    wrapper.remove()
  })

  it('an external store.set (another tab) still reflects into the rendered list after a reconnect', () => {
    const store = createMemoryStore({ initial: initialEntryValues() })
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = store
    mount(el)
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el)
    const externallyUpdated = readEntries(store, ENTRY_KINDS.promptSection).map((e) =>
      e.id === 'foundation' ? { ...e, content: 'Externally set.' } : e,
    )
    store.set(entriesStoreKey(ENTRY_KINDS.promptSection), externallyUpdated)
    expect(contentFieldOf(entryEl(el, ENTRY_KINDS.promptSection, 'foundation')).value).toBe('Externally set.')
    wrapper.remove()
  })
})

// GH #145 — switching personas (a real `admin.store = <other>` reassignment, the site's
// agent-admin-app.ts `applyPreset()` mechanism) must start a genuinely FRESH conversation: the visible
// chat log clears, the Dialog Turns/Context: Dialog tab resets, and a new message starts its own thread rather
// than appending onto the old persona's. Pre-fix, `applyPreset()`'s own source comment claimed the
// reactive store effect "re-syncs the conversation", but the effect only ever re-rendered the settings
// pane + entry sections — the chat log (`ui-conversation`'s own `#log`), the live-request `#history`
// ring, and the Dialog Turns `#turnLog` were never cleared, so the OLD persona's thread stayed on screen
// and a new persona's first message appended onto it. A bare RECONNECT with the SAME store (the
// `master-detail.ts` precedent above, e.g. a TKT-0085 layout crossing) must NOT reset — only a genuine
// store-identity change is a "switch".
describe('UIAgentAdminElement — a persona switch resets the conversation (GH #145)', () => {
  function submit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('[data-part="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
  }
  function bubbleTexts(el: UIAgentAdminElement): string[] {
    return [...el.querySelectorAll('[data-role="user"], [data-role="agent"]')].map((b) => b.textContent ?? '')
  }
  function turnLabels(el: UIAgentAdminElement): string[] {
    return [...el.querySelectorAll('[data-part="context-turn"] [data-part="summary-text"]')].map((s) => s.textContent ?? '')
  }

  it('a real store reassignment clears the chat log AND the Dialog Turns log; a fresh message starts its own thread', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    submit(el, 'hello from persona A')
    expect(bubbleTexts(el).some((t) => t.includes('hello from persona A'))).toBe(true)
    expect(turnLabels(el)).toEqual(['01']) // one Dialog Turn logged

    // A genuinely different store instance — exactly what `presetStore(otherPreset)` returns for a
    // never-visited persona (agent-admin-presets.ts). The rewire rides the reactive store effect
    // (agent-admin.ts's connected()), not a synchronous write — same `whenFlushed()` precedent the
    // store-swap probe (agent-admin-app.test.ts) already follows.
    el.store = createMemoryStore({ initial: initialEntryValues() })
    await whenFlushed()

    expect(bubbleTexts(el), 'the old thread must not survive the switch').toEqual([])
    expect(turnLabels(el), 'the Dialog Turns log must reset too').toEqual([])

    submit(el, 'hello from persona B')
    // The fresh thread carries ONLY the new persona's exchange — no trace of persona A's message.
    expect(bubbleTexts(el).some((t) => t.includes('hello from persona A'))).toBe(false)
    expect(bubbleTexts(el).some((t) => t.includes('hello from persona B'))).toBe(true)
    // The turn counter also restarts from 1 (not 2) — a fresh persona is not turn 2 of the old one.
    expect(turnLabels(el)).toEqual(['01'])
  })

  it('the live request never replays a prior persona\'s history after a store reassignment', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const calls: import('./agent-admin-schema.ts').AdminTurnRequest[] = []
    el.agentTurn = async (req) => {
      calls.push(req)
      return 'ack'
    }
    submit(el, 'first persona turn one')
    // Wait for the turn to fully COMPLETE (not just the runner call) — `#recordTurn` (which feeds
    // `#history`) runs after the awaited reply, so polling only `calls.length` races it: a store
    // reassignment right after the runner call, but before `#recordTurn` lands, could see the reset
    // land BEFORE the stale append rather than after. The Dialog Turns log is written in the same
    // continuation immediately AFTER `#recordTurn`, so waiting for it orders correctly.
    for (let i = 0; i < 100 && turnLabels(el).length < 1; i += 1) await Promise.resolve()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.history).toEqual([]) // nothing prior yet

    el.store = createMemoryStore({ initial: initialEntryValues() })
    await whenFlushed()
    submit(el, 'second persona turn one')
    for (let i = 0; i < 100 && calls.length < 2; i += 1) await Promise.resolve()
    expect(calls).toHaveLength(2)
    // Pre-fix this replayed [{user: 'first persona turn one'}, {assistant: 'ack'}] — the OLD persona's
    // exchange — instead of an empty history for the new persona's own first turn.
    expect(calls[1]!.history).toEqual([])
  })

  it('a bare RECONNECT with the SAME store does NOT reset — no do-over on a layout crossing (TKT-0085)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    submit(el, 'still here after reconnect')
    expect(turnLabels(el)).toEqual(['01'])

    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el) // detach + reattach with the SAME `el.store` reference — connectedCallback fires again

    expect(bubbleTexts(el).some((t) => t.includes('still here after reconnect'))).toBe(true)
    expect(turnLabels(el)).toEqual(['01'])
    wrapper.remove()
  })
})

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/agent-admin`
const agentAdminTs = readFileSync(`${DIR}/agent-admin.ts`, 'utf8') as string
const agentAdminCss = readFileSync(`${DIR}/agent-admin.css`, 'utf8') as string

describe('agent-admin.md descriptor (ui-agent-admin)', () => {
  const md = readFileSync(`${DIR}/agent-admin.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['schema', 'store', 'agentTurn', 'agentSurfaceTurn', 'libraries', 'authoringStore']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-agent-admin')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-agent-admin\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UIAgentAdminElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIAgentAdminElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, reflect: true }))
    expect(compareDescriptorToProps(flipReflect, UIAgentAdminElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts: agentAdminTs, css: agentAdminCss })).toEqual([])
  })
})

// ── the SURFACE arm (TKT-0076/ADR-0138) ──────────────────────────────────────────────────────────────────

describe('UIAgentAdminElement — the agentSurfaceTurn arm', () => {
  it('a submit streams the runner: wire lines reach ingestLine (a surface host mounts), the note renders, and the request carries the composed persona + sanitized model', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { model: 'claude-sonnet-5' } })
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'Dealt.' }
      yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()

    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'play'
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // the async iterator drains on a microtask+task boundary
    await whenFlushed()

    // The request rode the component's OWN seam: composed persona + the store's sanitized model.
    const req = seen[0] as { turn: { kind: string }; personaSystem: string; model: string }
    expect(req.turn).toEqual({ kind: 'intent', text: 'play' })
    expect(req.model).toBe('claude-sonnet-5')
    expect(req.personaSystem.length).toBeGreaterThan(0)

    // The wire line mounted a REAL inline surface host; the note rendered at finalize. The body query is
    // DIRECT-CHILD anchored (GH #240): the narration's per-step source reveal composes a ui-disclosure
    // whose own anatomy carries a [data-part="body"] — a bare descendant query would match that first.
    expect(el.querySelector('ui-surface-host')).not.toBeNull()
    const agentBody = el.querySelector('[data-part="bubble"][data-role="agent"] > [data-part="body"]')
    expect(agentBody?.textContent).toBe('Dealt.')
  })

  it("the request's `effort` reflects the composer's Effort picker selection (the same dial the plain-chat AdminTurnRequest arm already threads)", async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { model: 'claude-sonnet-5' } })
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()

    // Drive the SAME path a real picker commit does: fire the registered onEffortChange callback.
    const menu = el.querySelector('[data-part="effort-menu"]') as HTMLElement
    ;(menu.querySelector('[data-value="high"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))

    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'play'
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()

    const req = seen[0] as { effort?: string }
    expect(req.effort).toBe('high')
  })

  it('a thrown runner surfaces via the fail path (a system bubble), never an empty success', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'partial' }
      throw new Error('proxy exploded')
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()

    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'play'
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()

    const system = el.querySelector('[data-part="bubble"][data-role="system"]')
    expect(system?.textContent).toContain('proxy exploded')
  })
})

describe('UIAgentAdminElement — genui-surface.spec.md SPEC-R8/R10/R11 (B2): the GenUI modality goes live', () => {
  async function submit(el: UIAgentAdminElement, text: string): Promise<void> {
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
  }

  it('a `genui` event mounts a REAL ui-sandbox-frame via AgentTurnHandle.mountGenui — never ingestLine', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'here is a chart' }
      yield { kind: 'genui' as const, surfaceId: 'q3-revenue', html: '<p>chart</p>' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'show me a chart')

    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement & { html: string; surfaceId: string }
    expect(frame).not.toBeNull()
    expect(frame.surfaceId).toBe('q3-revenue')
    expect(frame.html).toBe('<p>chart</p>')
    expect(el.querySelector('ui-surface-host')).toBeNull() // never routed through the A2UI mount path
  })

  it('the request carries genui:{enabled:true, sourceBody} when the modality is on AND a pattern source is picked', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.store!.set('entries:pattern-source', [
      { id: 'p1', kind: 'pattern-source', label: 'P1', description: '', content: 'exemplar body here', order: 0, enabled: true, builtin: false },
    ])
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'draw a chart')

    const req = seen[0] as { genui?: { enabled: boolean; sourceBody?: string; dogfood?: boolean } }
    // genui-surface.spec.md v0.5 §11 (GH #316/ADR-0162) — `dogfood` rides the SAME request, always-false
    // here (the dogfood sub-toggle was never touched by this test).
    expect(req.genui).toEqual({ enabled: true, sourceBody: 'exemplar body here', dogfood: false })
  })

  it('the request degrades to genui:{enabled:false, sourceBody:undefined} when the modality is off (the default)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    // A pattern-source entry exists but the modality itself is OFF (the default) — must not leak through.
    el.store!.set('entries:pattern-source', [
      { id: 'p1', kind: 'pattern-source', label: 'P1', description: '', content: 'exemplar body here', order: 0, enabled: true, builtin: false },
    ])
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'draw a chart')

    const req = seen[0] as { genui?: { enabled: boolean; sourceBody?: string; dogfood?: boolean } }
    expect(req.genui).toEqual({ enabled: false, sourceBody: undefined, dogfood: false })
  })

  it('D3 — with MULTIPLE pattern-source entries enabled, only the FIRST-by-order body rides sourceBody (never both)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.store!.set('entries:pattern-source', [
      { id: 'later', kind: 'pattern-source', label: 'Later', description: '', content: 'later body', order: 1, enabled: true, builtin: false },
      { id: 'earlier', kind: 'pattern-source', label: 'Earlier', description: '', content: 'earlier body', order: 0, enabled: true, builtin: false },
    ])
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'draw a chart')

    const req = seen[0] as { genui?: { sourceBody?: string } }
    expect(req.genui?.sourceBody).toBe('earlier body')
  })

  it('the "Pattern sources" entries never leak into the generic capability prompt block (no double-injection)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.store!.set('entries:pattern-source', [
      { id: 'p1', kind: 'pattern-source', label: 'P1', description: '', content: 'UNIQUE_PATTERN_SOURCE_BODY_MARKER', order: 0, enabled: true, builtin: false },
    ])
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'draw a chart')

    const req = seen[0] as { personaSystem: string; genui?: { sourceBody?: string } }
    expect(req.genui?.sourceBody).toBe('UNIQUE_PATTERN_SOURCE_BODY_MARKER') // rides the DEDICATED genui field
    expect(req.personaSystem).not.toContain('UNIQUE_PATTERN_SOURCE_BODY_MARKER') // never ALSO the generic capability block
    expect(req.personaSystem).not.toContain('Pattern sources available to you')
  })

  it('SURFACE_A2UI_KEY off + GenUI on: the structured arm still runs (widened OR gate, zero regression when GenUI stays off)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceA2ui', false)
    el.store!.set('surfaceGenui', true)
    let ran = false
    el.agentSurfaceTurn = async function* () {
      ran = true
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'draw a chart')
    expect(ran).toBe(true)
  })

  it('BOTH structured modalities off: the surface arm never runs — the prose stub answers instead (zero regression)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceA2ui', false)
    let ran = false
    el.agentSurfaceTurn = async function* () {
      ran = true
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'hello')
    expect(ran).toBe(false)
    expect(el.querySelector('[data-part="bubble"][data-role="agent"] > [data-part="body"]')).not.toBeNull() // the stub still answered
  })

  it('a genui action click bubbles as {genuiAction} and drives the NEXT surface turn, resuming the SAME bubble (TKT-0079)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    const seenTurns: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seenTurns.push(req.turn)
      if (req.turn.kind === 'intent') yield { kind: 'genui' as const, surfaceId: 'widget', html: '<p>rate me</p>' }
      else yield { kind: 'note' as const, note: 'thanks for the rating' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'show a widget')

    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement
    frame.dispatchEvent(new CustomEvent('action', { detail: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // GH #63 — the client turn is DEFERRED to a fresh macrotask
    await whenFlushed()

    expect(seenTurns).toHaveLength(2)
    expect(seenTurns[1]).toEqual({ kind: 'client', message: { genuiAction: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } } })
    // resumed the SAME bubble — never a second card for the follow-up reply.
    expect(el.querySelectorAll('[data-part="bubble"][data-role="agent"]')).toHaveLength(1)
  })

  // genui-surface.spec.md SPEC-R10/R11 — independent-review MODERATE fix, the symmetric direction: GenUI
  // OFF must keep a REAL genui action click inert even while A2UI is ON — a lingering frame from an
  // EARLIER turn (rendered while GenUI was still on) must not spawn a hidden turn once the modality is
  // switched off, exactly the contradiction SURFACE_GENUI_KEY's own doc comment already promised.
  it('GenUI OFF (A2UI ON): a REAL genui action click stays INERT — no hidden turn (independent-review MODERATE fix)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true) // ON while the frame mounts
    const seenTurns: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seenTurns.push(req.turn)
      if (req.turn.kind === 'intent') yield { kind: 'genui' as const, surfaceId: 'widget', html: '<p>rate me</p>' }
      else yield { kind: 'note' as const, note: 'should never run' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await submit(el, 'show a widget')
    expect(seenTurns).toHaveLength(1) // the intent turn that mounted the frame

    // Flip GenUI OFF (A2UI stays at its default ON) — the ALREADY-MOUNTED frame is now a lingering host.
    el.store!.set('surfaceGenui', false)
    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement
    frame.dispatchEvent(new CustomEvent('action', { detail: { surfaceId: 'widget', name: 'rate', payload: { stars: 5 } } }))
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // GH #63 — the client turn is DEFERRED to a fresh macrotask
    await whenFlushed()

    expect(seenTurns, 'GenUI is off — the click must never spawn a hidden client turn').toHaveLength(1)
  })
})

// ── GH #418 — the A2UI Surface Option is honored end to end: the runner request carries the LIVE toggle,
// and the client never renders/acts on A2UI content while the toggle is off — render+interactive, or a
// VISIBLE refusal, never a silently-dead surface. ─────────────────────────────────────────────────────

/** The manual REAL-composer submit `describe('...agentSurfaceTurn arm')` above uses inline, factored so
 *  this file's LATER `composerSubmit`/`submit` helpers (each scoped to their OWN describe closure) don't
 *  need duplicating — a plain module-level function, usable from any describe below. */
async function gh418Submit(el: UIAgentAdminElement, text: string): Promise<void> {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0)) // the async iterator drains on a microtask+task boundary
  await whenFlushed()
}

describe('UIAgentAdminElement — GH #418: the A2UI Surface Option reaches the runner request', () => {
  it('the request carries a2uiEnabled:true reflecting the LIVE store toggle (the default)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    const seen: Array<{ a2uiEnabled?: boolean }> = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as { a2uiEnabled?: boolean })
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await gh418Submit(el, 'draw')
    expect(seen[0]!.a2uiEnabled).toBe(true)
  })

  it('the request carries a2uiEnabled:false when the A2UI toggle is off (GenUI-only)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [SURFACE_A2UI_KEY]: false } })
    el.store!.set('surfaceGenui', true)
    const seen: Array<{ a2uiEnabled?: boolean }> = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as { a2uiEnabled?: boolean })
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await gh418Submit(el, 'draw')
    expect(seen[0]!.a2uiEnabled).toBe(false)
  })
})

describe('UIAgentAdminElement — GH #418: the client-plane never-silent law (A2UI off, GenUI on)', () => {
  it('A2UI OFF + GenUI ON: a model that emits an A2UI wire line anyway is never rendered — a visible notice appears instead of a silently-dead surface', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [SURFACE_A2UI_KEY]: false } })
    el.store!.set('surfaceGenui', true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'note' as const, note: 'Here you go.' }
      yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'blackjack', catalogId: 'agent-ui' } }) }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await gh418Submit(el, 'card game')

    expect(el.querySelector('ui-surface-host'), 'the A2UI line must never mount a live surface while A2UI is off').toBeNull()
    const agentBody = el.querySelector('[data-part="bubble"][data-role="agent"] > [data-part="body"]')
    expect(agentBody?.textContent).toContain('Here you go.')
    expect(agentBody?.textContent).toContain('A2UI is off in Surface Options')
  })

  it('A2UI OFF + GenUI ON: a REAL A2UI action click on a lingering (already-rendered) surface gets a VISIBLE refusal, never a silent no-op (the reported defect)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true) // A2UI stays default ON while the surface mounts
    let turnCount = 0
    el.agentSurfaceTurn = async function* (req) {
      turnCount++
      if (req.turn.kind === 'intent') {
        yield { kind: 'note' as const, note: 'Table set.' }
        yield { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'table-1', catalogId: 'agent-ui' } }) }
        yield {
          kind: 'line' as const,
          line: JSON.stringify({
            version: 'v1.0',
            updateComponents: {
              surfaceId: 'table-1',
              components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Hit', action: { action: 'submit' } }],
            },
          }),
        }
      } else {
        yield { kind: 'note' as const, note: 'should never run' }
      }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await gh418Submit(el, 'blackjack')
    expect(turnCount).toBe(1)
    const button = el.querySelector('ui-surface-host ui-button') as HTMLElement | null
    expect(button, 'a real rendered A2UI action control must exist to click').not.toBeNull()

    // Flip A2UI OFF mid-conversation — the ALREADY-MOUNTED surface is now a lingering host, exactly the
    // "renders, looks alive" defect state the reported bug described.
    el.store!.set(SURFACE_A2UI_KEY, false)
    await whenFlushed()
    button!.click()
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0)) // GH #63 — the client turn is DEFERRED to a fresh macrotask
    await whenFlushed()

    expect(turnCount, 'A2UI is off — the click must never spawn a hidden network turn').toBe(1)
    const system = el.querySelector('[data-part="bubble"][data-role="system"]')
    expect(system?.textContent, 'the click must surface a VISIBLE refusal, never a silent no-op').toContain('A2UI is off in Surface Options')
  })
})

// ── GH #802 (ADR-0097 §1, Kim's 2026-08-13 ruling) — an ASK-declared surface advances the dialog ROUND;
// every NON-ask surface keeps TKT-0079's stay-in-the-card resume. The two tests below are the SAME script
// with ONE difference — whether the runner declares its surfaces as asks — so the ask arm is provably the
// only thing that moves the routing. ────────────────────────────────────────────────────────────────────

describe('UIAgentAdminElement — GH #802: an answered ask opens the next dialog round', () => {
  /** One surface + one clickable commit Button, the minimal REAL A2UI payload a click can come out of
   *  (the GH #418 block's own two-line shape). The ask-ness never lives in this payload — it rides the
   *  meta-line's `ask` declaration, which is exactly what the peel/discriminator pair is about. */
  function surfaceLines(surfaceId: string, label: string): { kind: 'line'; line: string }[] {
    return [
      { kind: 'line' as const, line: JSON.stringify({ version: 'v1.0', createSurface: { surfaceId, catalogId: 'agent-ui' } }) },
      {
        kind: 'line' as const,
        line: JSON.stringify({
          version: 'v1.0',
          updateComponents: {
            surfaceId,
            components: [{ id: 'root', component: 'Button', variant: 'solid', label, action: { action: 'submit' } }],
          },
        }),
      },
    ]
  }

  /** Mount an admin whose intent turn builds round 1 and whose client turn builds round 2 — `declareAsks`
   *  picks whether each round is DECLARED as a feed ask (the peeled `{kind:'ask'}` event the live runner
   *  emits, admin-live-runner.ts). */
  async function mountRounds(declareAsks: boolean): Promise<{ el: UIAgentAdminElement; turns: unknown[] }> {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    const turns: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      turns.push(req.turn)
      const round = req.turn.kind === 'intent' ? 1 : 2
      const surfaceId = `ask-${round}`
      if (declareAsks) yield { kind: 'ask' as const, ask: { surfaceId } }
      yield { kind: 'note' as const, note: round === 1 ? 'Which size?' : 'Got it — and which colour?' }
      for (const line of surfaceLines(surfaceId, `Commit ${round}`)) yield line
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    await gh418Submit(el, 'coach me')
    return { el, turns }
  }

  /** Click the rendered commit Button of round 1 and settle the DEFERRED client turn (GH #63). */
  async function commitRoundOne(el: UIAgentAdminElement): Promise<void> {
    const button = [...el.querySelectorAll<HTMLElement>('ui-surface-host ui-button')].find((b) => b.textContent?.trim() === 'Commit 1')
    expect(button, 'round 1 rendered a real, clickable commit Button').not.toBeUndefined()
    button!.click()
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
  }

  const agentBubbles = (el: UIAgentAdminElement): HTMLElement[] => [
    ...el.querySelectorAll<HTMLElement>('[data-part="bubble"][data-role="agent"]'),
  ]

  /** A bubble's OWN note text — its direct `[data-part="body"]` child (GH #240: a bare descendant query
   *  would match the narration reveal's own disclosure anatomy first). */
  const noteOf = (bubble: HTMLElement): string | undefined =>
    [...bubble.children].find((c) => (c as HTMLElement).dataset?.part === 'body')?.textContent ?? undefined

  it('answering a DECLARED ask opens a NEW round — a fresh bubble with the next card, the answered one left behind as history', async () => {
    const { el, turns } = await mountRounds(true)
    const firstBubble = agentBubbles(el)[0]!
    const firstHost = firstBubble.querySelector('ui-surface-host') as HTMLElement

    await commitRoundOne(el)

    expect(turns).toHaveLength(2)
    expect((turns[1] as { kind: string }).kind, 'the commit click really ran a new surface turn').toBe('client')

    const bubbles = agentBubbles(el)
    expect(bubbles, 'the ask answer advances the dialog: a SECOND agent bubble').toHaveLength(2)
    // The new round's own card mounted in the NEW bubble…
    const secondHost = bubbles[1]!.querySelector('ui-surface-host') as HTMLElement
    expect(secondHost, 'round 2 mounted its own surface host in the new bubble').not.toBeNull()
    expect(secondHost.querySelector('ui-button')?.textContent?.trim()).toBe('Commit 2')
    // …and the ANSWERED card is untouched history: same host, same bubble, its own question prose intact.
    expect(firstHost.isConnected, 'the answered ask survives').toBe(true)
    expect(firstHost.closest('[data-part="bubble"]'), 'the answered ask stays in ITS bubble').toBe(firstBubble)
    expect(firstBubble.querySelectorAll('ui-surface-host'), 'nothing new mounted into the answered bubble').toHaveLength(1)
    expect(firstHost.querySelector('ui-button')?.textContent?.trim(), 'the answered ask was never rebuilt').toBe('Commit 1')
    expect(noteOf(firstBubble), "the answered ask keeps its OWN question — the next round's prose never overwrote it").toBe(
      'Which size?',
    )
  })

  it('REGRESSION (TKT-0079): with no ask declared, the SAME script still resumes the owning bubble in place', async () => {
    const { el, turns } = await mountRounds(false)
    const firstBubble = agentBubbles(el)[0]!

    await commitRoundOne(el)

    expect(turns).toHaveLength(2)
    expect(agentBubbles(el), 'a non-ask action reply opens NO new bubble (TKT-0079)').toHaveLength(1)
    // TKT-0079's own clause: even a FRESH surfaceId in a resumed turn mounts into the SAME bubble's mounts.
    expect(firstBubble.querySelectorAll('ui-surface-host'), "round 2's card mounted into the resumed bubble").toHaveLength(2)
    expect(noteOf(firstBubble), 'the resumed bubble takes the new note').toBe('Got it — and which colour?')
  })
})

// ── GH #47/#48 — the add-from-library seam ──────────────────────────────────────────────────────────────

describe('UIAgentAdminElement — entry libraries (GH #47/#48)', () => {
  const PACKS = {
    skill: [
      {
        id: 'test-pack',
        label: 'Test pack',
        description: 'fixture',
        entries: [
          { label: 'grid-idiom', description: 'grids', content: 'Use a Grid.' },
          { label: 'form-idiom', description: 'forms', content: 'Use a Form.' },
        ],
      },
    ],
  }

  it('a kind WITH packs renders the library menu; a kind without stays byte-identical', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore()
    el.libraries = PACKS
    mount(el)
    const skillSection = el.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    const workflowSection = el.querySelector('[data-part="entry-section"][data-kind="workflow"]') as HTMLElement
    expect(skillSection.querySelector('[data-part="entry-library-menu"]')).not.toBeNull()
    expect(skillSection.querySelectorAll('[data-value^="test-pack:"]')).toHaveLength(2)
    expect(workflowSection.querySelector('[data-part="entry-library-menu"]'), 'no packs ⇒ no affordance').toBeNull()
  })

  it('a library commit routes through the validated add path — the entry lands in the store, deletable and enabled', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    const store = createMemoryStore()
    el.store = store
    el.libraries = PACKS
    mount(el)
    await el.updateComplete
    const row = el.querySelector('[data-value="test-pack:0"]') as HTMLElement
    row.click() // the menu's delegated commit → select → handlers.onAdd (popover open not required for the handler path)
    await el.updateComplete
    const entries = (store.get('entries:skill') ?? []) as Array<{ id: string; label: string; enabled: boolean; builtin: boolean; content: string }>
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: 'grid-idiom', label: 'grid-idiom', enabled: true, builtin: false, content: 'Use a Grid.' })
    // a SECOND commit of the same library entry slug-dedups instead of colliding (the validateNewEntry law)
    row.click()
    await el.updateComplete
    const after = (store.get('entries:skill') ?? []) as Array<{ id: string }>
    expect(after).toHaveLength(2)
    expect(after[1]!.id).toBe('grid-idiom-2')
  })
})

describe('UIAgentAdminElement — libraries is reactive post-connect (GH #143 — per-preset library scoping)', () => {
  const PACK_A = { skill: [{ id: 'pack-a', label: 'Pack A', description: 'fixture', entries: [{ label: 'a-idiom', description: 'a', content: 'Use A.' }] }] }
  const PACK_B = { skill: [{ id: 'pack-b', label: 'Pack B', description: 'fixture', entries: [{ label: 'b-idiom', description: 'b', content: 'Use B.' }] }] }

  it('a new object reference rebuilds the menu — old pack rows gone, new pack rows present; entries/store untouched', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore()
    el.libraries = PACK_A
    mount(el)
    await el.updateComplete
    const section = el.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    expect(section.querySelectorAll('[data-value^="pack-a:"]')).toHaveLength(1)
    expect(section.querySelectorAll('[data-value^="pack-b:"]')).toHaveLength(0)

    el.libraries = PACK_B // a FRESH object — the identity-change law this reactivity relies on
    await el.updateComplete

    expect(section.querySelectorAll('[data-value^="pack-a:"]'), 'the stale pack is gone').toHaveLength(0)
    expect(section.querySelectorAll('[data-value^="pack-b:"]'), 'the new pack rendered').toHaveLength(1)
    // the section shell + any already-added entries are untouched — only the library MENU rebuilt.
    expect(el.querySelector('[data-part="entry-section"][data-kind="skill"]')).toBe(section)
  })

  it('reassigning to empty removes the affordance entirely; reassigning back re-adds it', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore()
    el.libraries = PACK_A
    mount(el)
    await el.updateComplete
    const section = el.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    expect(section.querySelector('[data-part="entry-library-menu"]')).not.toBeNull()

    el.libraries = { skill: [] }
    await el.updateComplete
    expect(section.querySelector('[data-part="entry-library-menu"]'), 'empty ⇒ affordance removed').toBeNull()

    el.libraries = PACK_A
    await el.updateComplete
    expect(section.querySelector('[data-part="entry-library-menu"]'), 're-populated ⇒ affordance returns').not.toBeNull()
  })
})

describe('UIAgentAdminElement — a REJECTED library entry surfaces the same error note as the hand path (PR #58 review)', () => {
  it('an empty-label pack entry shows showAddError feedback instead of failing silently', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore()
    el.libraries = {
      skill: [{ id: 'bad-pack', label: 'Bad pack', description: 'fixture', entries: [{ label: '   ', description: '', content: 'x' }] }],
    }
    mount(el)
    await el.updateComplete
    const section = el.querySelector('[data-part="entry-section"][data-kind="skill"]') as HTMLElement
    const row = section.querySelector('[data-value="bad-pack:0"]') as HTMLElement
    row.click()
    await el.updateComplete
    const note = section.querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(note.hidden, 'the rejection must be VISIBLE (the fail-closed note un-hides)').toBe(false)
    expect(note.textContent).toContain('name is required')
    const entries = (el.store!.get('entries:skill') ?? []) as unknown[]
    expect(entries, 'nothing was added').toHaveLength(0)
  })
})

// ── the model lists (Kim, 2026-07-19; the admin-added-models capability is REMOVED, GH #137/Kim's
//    option A, 2026-07-20 — no more free-text "Additional models" field, no more customModels roster
//    merge) ──────────────────────────────────────────────────────────────────────────────────────────

describe('SUPPORTED_MODELS lists + the Haiku default (2026-07-19)', () => {
  it('the default model is Haiku; Sonnet remains an offered option', async () => {
    const { DEFAULT_MODEL_ID, SUPPORTED_MODELS } = await import('./agent-admin-schema.ts')
    expect(DEFAULT_MODEL_ID).toBe('claude-haiku-4-5-20251001')
    expect(SUPPORTED_MODELS.some((m) => m.id === 'claude-sonnet-5')).toBe(true)
    // every model carries a list assignment (the grouped-select contract)
    // every model carries a provider (the grid's grouping key, 2026-07-19 rev.2)
    for (const m of SUPPORTED_MODELS) expect(m.provider.length, m.id).toBeGreaterThan(0)
  })

  it('the schema carries NO model select and NO customModels field (GH #137); model roster helpers hold', async () => {
    const { agentConfigSchema, modelRoster, isModelIncluded, sanitizeModel, DEFAULT_MODEL_ID, SUPPORTED_MODELS } = await import('./agent-admin-schema.ts')
    const schema = agentConfigSchema()
    expect(schema.sections[0]!.fields.some((f) => f.key === 'model'), 'no model select field').toBe(false)
    expect(schema.sections[0]!.fields.some((f) => f.key === 'customModels'), 'the Additional models field is removed').toBe(false)
    const roster = modelRoster()
    expect(roster).toEqual(SUPPORTED_MODELS)
    const sonnet = roster.find((m) => m.id === 'claude-sonnet-5')!
    const gpt = roster.find((m) => m.id === 'gpt-4.1')!
    expect(isModelIncluded(undefined, sonnet), 'absent record ⇒ the model\'s own includedByDefault (Sonnet ships on)').toBe(true)
    expect(isModelIncluded(undefined, gpt), 'the OpenAI option ships OFF (rev.4)').toBe(false)
    expect(isModelIncluded({ 'claude-sonnet-5': false }, sonnet), 'an explicit record wins').toBe(false)
    expect(isModelIncluded({ 'gpt-4.1': true }, gpt)).toBe(true)
    expect(sanitizeModel('claude-sonnet-5', roster)).toBe('claude-sonnet-5')
    expect(sanitizeModel('nope', roster)).toBe(DEFAULT_MODEL_ID)
  })
})

describe('ui-agent-admin — the Model GRID (2026-07-19 rev.2)', () => {
  function mountAdmin(): { el: UIAgentAdminElement; store: ReturnType<typeof createMemoryStore> } {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    const store = createMemoryStore()
    el.store = store
    mount(el)
    return { el, store }
  }

  it('renders provider-grouped rows: label | include switch | default RADIO (rev.3); the default row locks its switch', async () => {
    const { el } = mountAdmin()
    await el.updateComplete
    const grid = el.querySelector('[data-part="model-grid"]') as HTMLElement
    expect(grid).not.toBeNull()
    expect([...grid.querySelectorAll('[data-part="model-provider"]')].map((p) => p.textContent)).toEqual(['Anthropic', 'OpenAI', 'Google'])
    const rows = grid.querySelectorAll('[data-part="model-row"]')
    expect(rows).toHaveLength(6) // rev.4: the Haiku/Sonnet tier pair per provider — opus/fable are GONE
    // ship state: only Haiku+Sonnet included; the OpenAI/Gemini options ship switched OFF
    const stateOf = (title: string): boolean => {
      const row = [...grid.querySelectorAll<HTMLElement>('[data-part="model-row"]')].find(
        (r) => r.querySelector('[data-part="model-row-label"]')?.getAttribute('title') === title,
      )!
      return (row.querySelector('[data-part="model-include"]') as HTMLElement & { checked: boolean }).checked
    }
    expect(stateOf('claude-sonnet-5')).toBe(true)
    expect(stateOf('gpt-4.1')).toBe(false)
    expect(stateOf('gemini-2.5-flash')).toBe(false)
    const defaultRow = grid.querySelector('[data-part="model-row"][data-default]') as HTMLElement
    expect(defaultRow.querySelector('[data-part="model-row-label"]')?.getAttribute('title')).toBe('claude-haiku-4-5-20251001')
    const lockSwitch = defaultRow.querySelector('[data-part="model-include"]') as HTMLElement & { checked: boolean; disabled: boolean }
    expect(lockSwitch.checked, 'the default is always offered').toBe(true)
    expect(lockSwitch.disabled, 'the default row cannot be excluded').toBe(true)
    const defaultBox = defaultRow.querySelector('[data-part="model-default"]') as HTMLElement & { checked: boolean }
    expect(defaultBox.checked).toBe(true)
    expect(defaultBox.tagName.toLowerCase(), 'the default column is a RADIO system (rev.3)').toBe('ui-radio')
  })

  it('the include switch writes modelsIncluded; the default radio moves `model` and re-includes', async () => {
    const { el, store } = mountAdmin()
    await el.updateComplete
    const grid = el.querySelector('[data-part="model-grid"]') as HTMLElement
    const sonnetRow = [...grid.querySelectorAll<HTMLElement>('[data-part="model-row"]')].find(
      (r) => r.querySelector('[data-part="model-row-label"]')?.getAttribute('title') === 'claude-sonnet-5',
    )!
    // exclude Sonnet
    const sw = sonnetRow.querySelector('[data-part="model-include"]') as HTMLElement & { checked: boolean }
    sw.checked = false
    sw.dispatchEvent(new Event('change'))
    expect((store.get('modelsIncluded') as Record<string, boolean>)['claude-sonnet-5']).toBe(false)
    await el.updateComplete
    // move the default to Sonnet — re-includes it AND moves `model`; the old default row unchecks
    const freshSonnetRow = [...el.querySelectorAll<HTMLElement>('[data-part="model-row"]')].find(
      (r) => r.querySelector('[data-part="model-row-label"]')?.getAttribute('title') === 'claude-sonnet-5',
    )!
    const box = freshSonnetRow.querySelector('[data-part="model-default"]') as HTMLElement & { checked: boolean }
    box.checked = true
    box.dispatchEvent(new Event('change'))
    expect(store.get('model')).toBe('claude-sonnet-5')
    expect((store.get('modelsIncluded') as Record<string, boolean>)['claude-sonnet-5'], 'defaulting re-includes').toBe(true)
    await el.updateComplete
    const haikuRow = [...el.querySelectorAll<HTMLElement>('[data-part="model-row"]')].find(
      (r) => r.querySelector('[data-part="model-row-label"]')?.getAttribute('title') === 'claude-haiku-4-5-20251001',
    )!
    expect((haikuRow.querySelector('[data-part="model-default"]') as HTMLElement & { checked: boolean }).checked, 'radio semantics: the old default unchecked').toBe(false)
  })
})

// ── Surface Options (vision rev.6 — the frame's node 34:1312) ──────────────────────────────────────────

describe('UIAgentAdminElement — Surface Options (vision rev.6)', () => {
  function composerSubmit(el: UIAgentAdminElement, text: string): void {
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = text
    const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }
  function lastAgentBody(el: UIAgentAdminElement): HTMLElement {
    const bodies = el.querySelectorAll('[data-part="bubble"][data-role="agent"] [data-part="body"]')
    return bodies[bodies.length - 1] as HTMLElement
  }
  /** GH #468 — `<ui-markdown>` is now behind a LAZY `import()` (agent-admin.ts's `loadMarkdownRenderer`);
   *  a dynamic import's resolution isn't a reactive-effect write, so `whenFlushed()` alone doesn't wait for
   *  it (the dogfood-lazy.test.ts precedent's own `waitFor`, condition-polled rather than a fixed tick
   *  count — a dynamic import takes an unspecified number of module-runner ticks the first time). */
  async function waitFor(predicate: () => boolean, label: string): Promise<void> {
    for (let i = 0; i < 200; i += 1) {
      if (predicate()) return
      await new Promise((r) => setTimeout(r, 5))
      await whenFlushed()
    }
    throw new Error(`waitFor timed out: ${label}`)
  }

  it('composes the card: markdown/a2ui/genui rows in order, a2ui + genui each wrapped in their own GROUP (GH #541); genui-surface B2 — GenUI is LIVE (its own inverse-default OFF switch, never PRD-disabled)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const surfaceOptions = el.querySelector('[data-part="surface-options"]') as HTMLElement
    const rows = [...surfaceOptions.querySelectorAll('[data-part="surface-row"]')]
    // GH #541 — modality rows and nothing else: Bankroll moved out to its own Settings fold (see
    // agent-admin-bankroll.test.ts for its presence/absence/reset coverage). ADR-0174 cl.1/OF3 — the
    // Planner row joins beside GenUI (agent-admin-planner.test.ts covers its schema-level gate).
    // ADR-0178 cl.3 — the Authoring row is APPENDED after Planner (the LLD's placement), so every
    // existing row keeps its index.
    expect(rows.map((r) => r.getAttribute('data-surface'))).toEqual(['markdown', 'a2ui', 'genui', 'planner', 'authoring'])
    // Only the modalities WITH children are grouped — Markdown has none, so it stays a bare row.
    expect([...surfaceOptions.querySelectorAll('[data-part="surface-group"]')].map((g) => g.getAttribute('data-surface'))).toEqual(['a2ui', 'genui'])
    const genui = rows[2] as HTMLElement
    expect(genui.hasAttribute('data-disabled')).toBe(false)
    const genuiToggle = genui.querySelector('[data-part="surface-toggle"]') as HTMLElement & { disabled: boolean; checked: boolean }
    expect(genuiToggle.disabled).toBe(false)
    expect(genuiToggle.checked, 'GenUI defaults OFF (the inverse of the two live-since-launch modalities)').toBe(false)
    // GH #541 — the modality row carries exactly ONE toggle scope: the dogfood sub-option is a nested
    // detail row now, never a second switch in the GenUI row itself.
    expect(genui.querySelectorAll('ui-switch'), 'one toggle scope per row').toHaveLength(1)
    const dogfoodRow = el.querySelector('[data-part="surface-detail-row"][data-detail="genui-dogfood"]') as HTMLElement
    expect(dogfoodRow.closest('[data-part="surface-detail"]')!.parentElement!.getAttribute('data-surface')).toBe('genui')
    expect(dogfoodRow.querySelector('[data-part="surface-genui-dogfood-toggle"]')).not.toBeNull()
    // ADR-0170 cl.6 — the bare catalog-picker `<ui-select>` is GONE from Surface Options (one writer into
    // the key) — scoped to `surfaceOptions` itself: S7-c's OWN `<ui-select data-part="agent-select">` in
    // the header is an unrelated control (the roster picker, a different key entirely), not a revival of
    // the retired catalog mirror this clause is about.
    expect(surfaceOptions.querySelector('ui-select'), 'no catalog-picker ui-select inside Surface Options').toBeNull()
    // both live-since-launch modalities ship ON
    expect((rows[0]!.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }).checked).toBe(true)
    expect((rows[1]!.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }).checked).toBe(true)
  })

  // genui-surface.spec.md v0.5 §11 (SPEC-R10 amended clause, GH #316/ADR-0162) — "Use agent-ui
  // components", the dogfood sub-toggle beside the genui row's source picker.
  it('the dogfood sub-toggle is present, unchecked, and DISABLED while the modality itself is off', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const dogfoodToggle = el.querySelector('[data-part="surface-genui-dogfood-toggle"]') as HTMLElement & {
      checked: boolean
      disabled: boolean
    }
    expect(dogfoodToggle).not.toBeNull()
    expect(dogfoodToggle.checked).toBe(false)
    expect(dogfoodToggle.disabled, 'a sub-toggle of an off modality is inert (mirrors the a2ui.row catalog picker)').toBe(true)
  })

  it('the dogfood sub-toggle ENABLES the moment the genui modality itself turns on', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const genuiToggle = el.querySelector('[data-surface="genui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    const dogfoodToggle = el.querySelector('[data-part="surface-genui-dogfood-toggle"]') as HTMLElement & { disabled: boolean }
    genuiToggle.checked = true
    genuiToggle.dispatchEvent(new Event('change'))
    expect(dogfoodToggle.disabled).toBe(false)
  })

  it('toggling the dogfood sub-toggle persists + live-applies (the SAME store-write pattern the modality row proves)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true) // the modality must be on for the sub-toggle to be meaningful
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const dogfoodToggle = el.querySelector('[data-part="surface-genui-dogfood-toggle"]') as HTMLElement & { checked: boolean }
    dogfoodToggle.checked = true
    dogfoodToggle.dispatchEvent(new Event('change'))
    expect(el.store!.get('surfaceGenuiDogfood')).toBe(true)
  })

  it('a stale stored dogfood:true never composes while the modality itself is off — request degrades dogfood to false', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenuiDogfood', true) // stale from a prior session
    el.store!.set('surfaceGenui', false) // the modality itself is off (the default)
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'draw a chart')
    await whenFlushed()
    const req = seen[0] as { genui?: { enabled: boolean; dogfood?: boolean } }
    expect(req.genui?.dogfood).toBe(false)
  })

  // GH #354 — this is the INTEGRATION leg of the lazy asset pair: it drives the REAL 450 KB committed
  // fixture through the dynamic `import()` (dogfood-lazy.test.ts mocks the module to count loads and to hold
  // one in flight; nothing there proves the real pair still arrives). The turn therefore settles across an
  // unspecified number of ticks — a real module load, not a fixed microtask chain — so the wait is a
  // CONDITION, never a tick count.
  it('dogfood:true composes the request with dogfood:true and mounts the frame with the REAL asset pair (through the lazy import)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.store!.set('surfaceGenuiDogfood', true)
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'genui' as const, surfaceId: 'dogfood-1', html: '<ui-button>Save</ui-button>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'make a form')
    for (let i = 0; i < 200 && el.querySelector('ui-sandbox-frame') === null; i += 1) {
      await new Promise((r) => setTimeout(r, 5))
      await whenFlushed()
    }
    const req = seen[0] as { genui?: { enabled: boolean; dogfood?: boolean } }
    expect(req.genui?.dogfood).toBe(true)
    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement & { assets: { css?: string; js?: string } }
    expect(frame, 'the lazy dogfood chunk resolved and the frame mounted').not.toBeNull()
    expect(frame.assets.css, 'the dogfood CSS asset was passed through to the mounted frame').toBeTruthy()
    expect(frame.assets.js, 'the dogfood JS asset was passed through to the mounted frame').toBeTruthy()
    // The REAL fixture, not a stub — the committed pair is hundreds of KB of flattened CSS/JS.
    expect(frame.assets.css!.length).toBeGreaterThan(10_000)
    expect(frame.assets.js!.length).toBeGreaterThan(10_000)
  })

  it('dogfood:false (the default) mounts the frame with NO assets — byte-identical to the pre-dogfood mount', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set('surfaceGenui', true)
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'genui' as const, surfaceId: 'plain-1', html: '<p>plain</p>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    composerSubmit(el, 'draw a chart')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement & { assets: { css?: string; js?: string } }
    expect(frame).not.toBeNull()
    expect(frame.assets.css).toBeUndefined()
    expect(frame.assets.js).toBeUndefined()
  })

  it('genui-surface B2 — toggling the GenUI row persists + live-applies (the SAME store-write pattern markdown/a2ui already prove)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const genuiToggle = el.querySelector('[data-surface="genui"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    genuiToggle.checked = true
    genuiToggle.dispatchEvent(new Event('change'))
    expect(el.store!.get('surfaceGenui')).toBe(true)
    const agentJson = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { surface: { genui: boolean } }
    expect(agentJson.surface.genui).toBe(true)
  })

  // ADR-0174 cl.1 / OF3 (ruled) — the Planner row: a bare, ungrouped modality row beside GenUI, the SAME
  // inverse-default fail-closed law GenUI's own row uses (agent-admin-schema.ts's `isPlannerSurfaceEnabled`
  // is unit-covered in its own file, agent-admin-planner.test.ts — this suite covers the ROW).
  it('the Planner row renders beside GenUI, a bare row with no group/detail zone, defaulting OFF (fail-closed)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const surfaceOptions = el.querySelector('[data-part="surface-options"]') as HTMLElement
    const plannerRow = surfaceOptions.querySelector('[data-part="surface-row"][data-surface="planner"]') as HTMLElement
    expect(plannerRow).not.toBeNull()
    // No `surface-group`/`surface-detail` wraps it — the gate has no sub-options yet (Kim's placement call).
    expect(plannerRow.closest('[data-part="surface-group"]')).toBeNull()
    const plannerToggle = plannerRow.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    expect(plannerToggle.checked, 'the SAME inverse default GenUI uses — OFF until an admin opts in').toBe(false)
  })

  it('toggling the Planner row persists + live-applies (the SAME store-write pattern markdown/a2ui/genui already prove)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const plannerToggle = el.querySelector('[data-surface="planner"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    plannerToggle.checked = true
    plannerToggle.dispatchEvent(new Event('change'))
    expect(el.store!.get(SURFACE_PLANNER_KEY)).toBe(true)
    const agentJson = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { surface: { planner: boolean } }
    expect(agentJson.surface.planner).toBe(true)
  })

  it('a stored surfacePlanner:true reflects onto the row switch at connect (external-write live-apply, the master-switch discipline)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store!.set(SURFACE_PLANNER_KEY, true)
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const plannerToggle = el.querySelector('[data-surface="planner"] [data-part="surface-toggle"]') as HTMLElement & { checked: boolean }
    expect(plannerToggle.checked).toBe(true)
  })

  it('Markdown ON by default: an agent note renders through <ui-markdown> once the lazy renderer resolves; an explicit OFF falls back to a plain text node (live-apply, next bubble)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    // GH #468 — markdown ON by default fires `preloadMarkdownRenderer()` right at connect
    // (`#applyMasterStates`); wait for the REAL dynamic import to resolve — the way a real page's own
    // model-turn latency already would, long before a reply lands — before the first submit. The
    // OFF-never-loads / falls-back-while-loading / failure-retry legs live in their own dedicated
    // markdown-lazy*.test.ts files (the dogfood-lazy*.test.ts precedent); this test keeps proving the
    // STEADY-STATE shape end to end through the REAL module, not a mock.
    await waitFor(() => customElements.get('ui-markdown') !== undefined, 'the lazy markdown renderer resolved')
    composerSubmit(el, 'hello')
    await whenFlushed()
    const rendered = lastAgentBody(el).querySelector('ui-markdown') as (HTMLElement & { markdown: string }) | null
    expect(rendered, 'the stub note should render through ui-markdown').not.toBeNull()
    expect(rendered!.markdown.length).toBeGreaterThan(0)

    el.store!.set(SURFACE_MARKDOWN_KEY, false)
    composerSubmit(el, 'again')
    await whenFlushed()
    expect(lastAgentBody(el).querySelector('ui-markdown'), 'OFF ⇒ plain text, no ui-markdown').toBeNull()
    expect(lastAgentBody(el).textContent!.length).toBeGreaterThan(0)
  })

  it('surfaceA2ui OFF bypasses an ARMED surface runner (the prose stub answers, client messages no-op); ON routes back and the request carries the sanitized catalogId', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [SURFACE_A2UI_KEY]: false } })
    const seen: Array<{ catalogId?: string }> = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req as { catalogId?: string })
      yield { kind: 'note' as const, note: 'surfaced' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()

    composerSubmit(el, 'draw')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen, 'the armed runner must be bypassed while the modality is off').toHaveLength(0)
    expect(lastAgentBody(el).textContent, 'the prose stub answered instead').toContain('stub')

    // the nested catalog picker dims with the modality (configuring a dead surface is noise, ADR-0170 cl.5)
    const picker = (): HTMLElement => el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
    expect(picker().hasAttribute('data-kind-disabled')).toBe(true)

    el.store!.set(SURFACE_A2UI_KEY, true)
    await whenFlushed()
    expect(picker().hasAttribute('data-kind-disabled')).toBe(false)
    composerSubmit(el, 'draw again')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    expect(seen).toHaveLength(1)
    expect(seen[0]!.catalogId).toBe(DEFAULT_A2UI_CATALOG_ID)
  })

  it('the Context Agent System JSON carries the surface block (markdown/a2ui/catalog/genui/planner) — genui-surface B2, live; ADR-0174 cl.1/OF3 planner', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const agentJson = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { surface: { markdown: boolean; a2ui: boolean; catalog: string; genui: boolean; genuiSource?: string; planner: boolean } }
    // No pattern-source entry picked yet ⇒ genuiSource is absent (JSON.stringify drops an undefined key).
    expect(agentJson.surface).toEqual({ markdown: true, a2ui: true, catalog: DEFAULT_A2UI_CATALOG_ID, genui: false, planner: false, authoring: false })
    el.store!.set(SURFACE_MARKDOWN_KEY, false)
    const after = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { surface: { markdown: boolean } }
    expect(after.surface.markdown).toBe(false)
  })

  it('sanitizeCatalog: a known id passes, anything else coerces to the default (fail-closed)', () => {
    expect(sanitizeCatalog(DEFAULT_A2UI_CATALOG_ID)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog('not-a-catalog')).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog(42)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog(undefined)).toBe(DEFAULT_A2UI_CATALOG_ID)
  })
})

// ── the Catalogs section (ADR-0170) ────────────────────────────────────────────────────────────────────
// The section is the ONE writer of `A2UI_CATALOG_KEY`, and every switch DERIVES from that key — so these
// legs are all about one property: what the section SHOWS and what the runner would THREAD can never
// disagree. The pure projection is gated in entries.test.ts; this file drives the real composed element.

describe('UIAgentAdminElement — the Catalogs section (ADR-0170)', () => {
  const SECOND = A2UI_CATALOG_OPTIONS.find((o) => o.id !== DEFAULT_A2UI_CATALOG_ID)!

  /** A stored ROSTER row (membership only — its `enabled` is dead weight, overridden at read time). */
  function rosterRow(id: string, order: number, label = id): Entry {
    return { id, kind: ENTRY_KINDS.catalog, label, description: '', content: '', order, enabled: false, builtin: false }
  }

  function mountWithRoster(roster: Entry[], extra: Record<string, unknown> = {}): UIAgentAdminElement {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [entriesStoreKey(ENTRY_KINDS.catalog)]: roster, ...extra } })
    return mount(el)
  }

  function catalogSection(el: UIAgentAdminElement): HTMLElement {
    return el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
  }

  /** The rendered row ids, in DOM order (the list sorts by order then id). */
  function rowIds(el: UIAgentAdminElement): string[] {
    return [...catalogSection(el).querySelectorAll('[data-part="entry"]')].map((r) => r.getAttribute('data-entry-id') ?? '')
  }

  /** The ids whose switch is currently ON — the whole invariant reduces to this being length 1. */
  function checkedIds(el: UIAgentAdminElement): string[] {
    return [...catalogSection(el).querySelectorAll('[data-part="entry"]')]
      .filter((r) => (r.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }).checked)
      .map((r) => r.getAttribute('data-entry-id') ?? '')
  }

  function flip(el: UIAgentAdminElement, id: string, checked: boolean): void {
    const row = catalogSection(el).querySelector(`[data-part="entry"][data-entry-id="${id}"]`) as HTMLElement
    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    toggle.checked = checked
    toggle.dispatchEvent(new Event('change'))
  }

  function remove(el: UIAgentAdminElement, id: string): void {
    const row = catalogSection(el).querySelector(`[data-part="entry"][data-entry-id="${id}"]`) as HTMLElement
    ;(row.querySelector('[data-part="entry-delete"]') as HTMLElement).click()
  }

  it('a FRESH store renders exactly one row — the ensured Default builtin, ON, with no delete affordance (cl.4)', async () => {
    const el = mountWithRoster([])
    await whenFlushed()
    expect(rowIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])
    const row = catalogSection(el).querySelector('[data-part="entry"]') as HTMLElement
    expect(row.hasAttribute('data-builtin')).toBe(true)
    expect(row.querySelector('[data-part="entry-delete"]'), 'a builtin row is never deletable').toBeNull()
    // …and the ensure wrote NOTHING: the roster is still the empty array it was seeded with.
    expect(el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog))).toEqual([])
  })

  it('rows are label + switch only — no authoring form, no add-toggle, no per-entry editor (cl.8)', async () => {
    const el = mountWithRoster([])
    await whenFlushed()
    const section = catalogSection(el)
    expect(section.querySelector('[data-part="entry-add-toggle"]')).toBeNull()
    expect(section.querySelector('[data-part="entry-add-form"]')).toBeNull()
    expect(section.querySelector('[data-part="entry-content"]')).toBeNull()
    expect(section.querySelector('[data-part="entry-toggle"]')).not.toBeNull()
    expect(section.querySelector('[data-part="entry-label"]')!.textContent).toBe(
      A2UI_CATALOG_OPTIONS.find((o) => o.id === DEFAULT_A2UI_CATALOG_ID)!.label,
    )
  })

  it('toggling a REGISTERED inactive row ON writes the key and MOVES the one ON switch (radio semantics, cl.3)', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)])
    await whenFlushed()
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])

    flip(el, SECOND.id, true)
    expect(el.store!.get(A2UI_CATALOG_KEY)).toBe(SECOND.id)
    expect(checkedIds(el), 'exactly one ON — the sibling switched itself off by DERIVATION, not by a write').toEqual([SECOND.id])
    // the roster's own stored flags were never touched (the second-writer defect, closed)
    const stored = el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Entry[]
    expect(stored.map((e) => e.enabled)).toEqual([false])
  })

  it('toggling an UNREGISTERED row ON writes NOTHING and the switch SNAPS BACK (the visible no-op, cl.3)', async () => {
    const bogus = `${SECOND.id}-2` // exactly what a duplicate library add mints (validateNewEntry dedup)
    const el = mountWithRoster([rosterRow(bogus, 0, 'A duplicate')])
    await whenFlushed()
    const writes: string[] = []
    el.store!.subscribe?.((key) => void writes.push(key))

    flip(el, bogus, true)
    expect(writes, 'never a silent write of the default — no write at all').toEqual([])
    expect(el.store!.get(A2UI_CATALOG_KEY), 'the selection is unchanged').toBeUndefined()
    expect(checkedIds(el), 'the re-render snapped the refused switch back to the Default row').toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  it('toggling the ACTIVE row OFF writes the DEFAULT id — the selection moves to Default, never a "none" state (cl.3)', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)], { [A2UI_CATALOG_KEY]: SECOND.id })
    await whenFlushed()
    expect(checkedIds(el)).toEqual([SECOND.id])

    flip(el, SECOND.id, false)
    expect(el.store!.get(A2UI_CATALOG_KEY)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(checkedIds(el), 'a persona always has a catalog').toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  // The same-value arm of the rule above, split out because it is the one that cannot lean on a store
  // notification: toggling the ACTIVE row off when the active row IS the Default writes the default id
  // OVER ITSELF. `SettingsStore` promises no notification on a same-value `set`, so a section that relied
  // on one would leave the switch the user just flipped visually OFF while the selection never moved —
  // exactly the "no catalog selected" state cl.3 says must not exist.
  it('toggling the DEFAULT row off while it is ALREADY active snaps it back — never a "none" state', async () => {
    // The key is EXPLICITLY the default here (not merely absent) — that is what makes the fail-closed
    // write a same-value one. With the key absent, `set` moves undefined→'agent-ui', a real change.
    const el = mountWithRoster([], { [A2UI_CATALOG_KEY]: DEFAULT_A2UI_CATALOG_ID })
    await whenFlushed()
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])

    flip(el, DEFAULT_A2UI_CATALOG_ID, false)
    expect(el.store!.get(A2UI_CATALOG_KEY), 'the fail-closed write still lands').toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(checkedIds(el), 'the switch snapped back — a persona always has a catalog').toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  it('the same snap-back holds on a store that does NOT notify on a same-value set (the promise, not the implementation)', async () => {
    // `SettingsStore` does not promise a notification for a `set` that changes nothing — `createMemoryStore`
    // happens to send one. This store takes the other permitted option, so the section may not lean on it.
    const values = new Map<string, unknown>([
      [entriesStoreKey(ENTRY_KINDS.catalog), []],
      [A2UI_CATALOG_KEY, DEFAULT_A2UI_CATALOG_ID], // explicitly stored ⇒ the write below really is same-value
    ])
    const listeners = new Set<(key: string, value: unknown) => void>()
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = {
      get: (key) => values.get(key),
      set: (key, value) => {
        const changed = values.get(key) !== value
        values.set(key, value)
        if (changed) for (const listener of listeners) listener(key, value)
      },
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
    mount(el)
    await whenFlushed()
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])

    flip(el, DEFAULT_A2UI_CATALOG_ID, false)
    expect(values.get(A2UI_CATALOG_KEY)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(checkedIds(el), 'the direct re-render carried it, not a notification that never came').toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  it('deleting the ACTIVE row drops it from the roster AND moves the selection to Default (cl.4)', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)], { [A2UI_CATALOG_KEY]: SECOND.id })
    await whenFlushed()

    remove(el, SECOND.id)
    expect(el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog))).toEqual([])
    expect(el.store!.get(A2UI_CATALOG_KEY)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(rowIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])
  })

  it('deleting an INACTIVE row is the ordinary delete — the selection is untouched', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label), rosterRow(`${SECOND.id}-2`, 1, 'A duplicate')], {
      [A2UI_CATALOG_KEY]: SECOND.id,
    })
    await whenFlushed()

    remove(el, `${SECOND.id}-2`)
    expect((el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Entry[]).map((e) => e.id)).toEqual([SECOND.id])
    expect(el.store!.get(A2UI_CATALOG_KEY), 'an inactive delete writes only the roster').toBe(SECOND.id)
    expect(checkedIds(el)).toEqual([SECOND.id])
  })

  it('the section dims with the A2UI MODALITY, never a per-kind master (cl.5)', async () => {
    const el = mountWithRoster([])
    await whenFlushed()
    const section = catalogSection(el)
    expect(section.hasAttribute('data-kind-disabled')).toBe(false)

    el.store!.set(SURFACE_A2UI_KEY, false)
    expect(section.hasAttribute('data-kind-disabled'), 'a catalog for a surface that cannot run is noise').toBe(true)
    // …and the phantom master key is neither read nor written: setting it changes nothing.
    el.store!.set('catalogsEnabled', true)
    expect(section.hasAttribute('data-kind-disabled')).toBe(true)
    el.store!.set(SURFACE_A2UI_KEY, true)
    expect(section.hasAttribute('data-kind-disabled')).toBe(false)
  })

  it('the kind is EXCLUDED from the composed system prompt — catalogId is WIRE, never prose (cl.5)', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)])
    // an ordinary capability entry, to prove the projection itself is alive (anti-vacuous)
    el.store!.set(entriesStoreKey(ENTRY_KINDS.skill), [
      { id: 'a-skill', kind: ENTRY_KINDS.skill, label: 'A skill', description: '', content: 'body', order: 0, enabled: true, builtin: false },
    ])
    await whenFlushed()
    const prompt = (
      JSON.parse(el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}') as {
        systemPrompt: string
      }
    ).systemPrompt
    expect(prompt, 'the generic capability projection is alive').toContain('## Skills available to you')
    expect(prompt).not.toContain('Catalogs available to you')
    expect(prompt, "the selected catalog's own label never reaches the prompt").not.toContain(SECOND.label)
  })

  it('the Context: System catalog item shows the PROJECTION and derives `enabled` from the A2UI toggle (cl.5)', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)], { [A2UI_CATALOG_KEY]: SECOND.id })
    await whenFlushed()
    const read = (): { enabled: boolean; entries: Array<{ label: string; enabled: boolean }> } =>
      JSON.parse(
        el.querySelector(`[data-part="context-item"][data-item="${ENTRY_KINDS.catalog}"] [data-part="context-json"]`)!.textContent ?? '{}',
      ) as { enabled: boolean; entries: Array<{ label: string; enabled: boolean }> }

    const before = read()
    expect(before.enabled).toBe(true)
    expect(before.entries.map((e) => e.enabled), 'the ensured Default row is in the view, and exactly one entry is on').toEqual([false, true])

    el.store!.set(SURFACE_A2UI_KEY, false)
    expect(read().enabled, 'the section reports the modality gate, not a phantom master').toBe(false)
  })

  // ── cl.6 — the retired select, and (GH #541) the retired mirror that replaced it ───────────────────

  it('GH #541: the a2ui row carries NO catalog mirror — the active catalog label is projected once, by the picker card the row now nests', async () => {
    const el = mountWithRoster([rosterRow(SECOND.id, 0, SECOND.label)])
    await whenFlushed()
    const a2uiRow = el.querySelector('[data-part="surface-row"][data-surface="a2ui"]') as HTMLElement
    expect(el.querySelector('[data-part="surface-catalog"]'), 'the trailing mirror is gone').toBeNull()
    // GH #844 — the row also carries a help affordance now, whose CARD text is a DOM descendant of the
    // row but is never painted on the row's line (`ui-tooltip` moves it into a top-layer popover panel).
    // The no-mirror law is about the row's OWN chrome, so read exactly that: every child except the help.
    const rowChrome = [...a2uiRow.children]
      .filter((child) => child.getAttribute('data-part') !== 'admin-help')
      .map((child) => child.textContent ?? '')
      .join('')
    expect(rowChrome, 'the row names the modality and nothing else').toBe('A2UI')

    // The label lives EXACTLY once on the surface — on the active catalog's own row inside the picker.
    const activeLabel = A2UI_CATALOG_OPTIONS.find((o) => o.id === DEFAULT_A2UI_CATALOG_ID)!.label
    const showing = [...el.querySelectorAll('[data-part="entry-label"]')].filter((n) => n.textContent === activeLabel)
    expect(showing, 'one projection, not two adjacent ones').toHaveLength(1)

    // …and it still tracks a selection made in the section (the picker is the one writer, ADR-0170 cl.6).
    flip(el, SECOND.id, true)
    expect(el.store!.get(A2UI_CATALOG_KEY)).toBe(SECOND.id)
  })

  it('a store with NO subscribe still snaps back and still re-renders (the #updateEntries fallback discipline)', async () => {
    const values = new Map<string, unknown>([[entriesStoreKey(ENTRY_KINDS.catalog), [rosterRow(SECOND.id, 0, SECOND.label)]]])
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = { get: (key) => values.get(key), set: (key, value) => void values.set(key, value) }
    mount(el)
    await whenFlushed()

    flip(el, SECOND.id, true)
    expect(values.get(A2UI_CATALOG_KEY)).toBe(SECOND.id)
    expect(checkedIds(el), 'no subscription to notify — the handler re-rendered directly').toEqual([SECOND.id])

    flip(el, SECOND.id, false)
    expect(values.get(A2UI_CATALOG_KEY)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(checkedIds(el)).toEqual([DEFAULT_A2UI_CATALOG_ID])
  })
})

// ── GH #564 — reject-on-collision + the picker's disabled-row UX (both halves of the same fix) ───────────
// Root cause (the Findings comment): the catalog kind's entry id is a FOREIGN KEY into
// `A2UI_CATALOG_OPTIONS`, but `validateNewEntry`'s collision branch auto-uniquified it (`agent-ui-2`) —
// re-adding an already-registered catalog minted a second, identically-labeled roster row. The fix pairs a
// data-level reject (`validateNewEntry`'s `rejectOnCollision`) with a picker-level disable (`buildLibraryMenu`)
// so the duplicate is unreachable from the UI, not just refused on commit.

describe('UIAgentAdminElement — the Catalogs picker (GH #564): reject-on-collision + disabled-row UX', () => {
  const SECOND = A2UI_CATALOG_OPTIONS.find((o) => o.id !== DEFAULT_A2UI_CATALOG_ID)!
  const SECOND_INDEX = A2UI_CATALOG_OPTIONS.findIndex((o) => o.id === SECOND.id)
  const CATALOG_PACK = {
    [ENTRY_KINDS.catalog]: [
      {
        id: 'registered-catalogs',
        label: 'Registered catalogs',
        description: 'fixture',
        entries: A2UI_CATALOG_OPTIONS.map((o) => ({ id: o.id, label: o.label, description: o.description ?? '', content: '' })),
      },
    ],
  }

  function mountWithCatalogLibrary(roster: Entry[] = []): UIAgentAdminElement {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [entriesStoreKey(ENTRY_KINDS.catalog)]: roster } })
    el.libraries = CATALOG_PACK
    return mount(el)
  }

  function catalogSection(el: UIAgentAdminElement): HTMLElement {
    return el.querySelector(`[data-part="entry-section"][data-kind="${ENTRY_KINDS.catalog}"]`) as HTMLElement
  }

  function secondLibraryRow(el: UIAgentAdminElement): HTMLElement {
    return catalogSection(el).querySelector(`[data-value="registered-catalogs:${SECOND_INDEX}"]`) as HTMLElement
  }

  it('a NOT-yet-added catalog\'s picker row is enabled; clicking it commits a real roster row', async () => {
    const el = mountWithCatalogLibrary([])
    await whenFlushed()
    const row = secondLibraryRow(el)
    expect(row.getAttribute('aria-disabled'), 'nothing collides yet').toBeNull()

    row.click()
    await whenFlushed()
    const roster = el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Entry[]
    expect(roster.map((e) => e.id)).toEqual([SECOND.id])
  })

  it('an ALREADY-added catalog\'s picker row is disabled (never hidden) and unreachable — a click commits nothing (GH #564)', async () => {
    const el = mountWithCatalogLibrary([
      { id: SECOND.id, kind: ENTRY_KINDS.catalog, label: SECOND.label, description: '', content: '', order: 0, enabled: false, builtin: false },
    ])
    await whenFlushed()
    const row = secondLibraryRow(el)
    expect(row.getAttribute('aria-disabled'), 'GH #564 — disabled, the visible-not-hidden UX').toBe('true')
    expect(row.textContent, 'the label states WHY, mirroring the "coming soon" idiom').toContain('already added')

    row.click() // ui-menu's own disabled-item skip (menu.ts) — the SAME guard the picker fix relies on
    await whenFlushed()
    const roster = el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Entry[]
    expect(roster, 'a catalog re-add is rejected: no duplicate row ever lands').toHaveLength(1)
    expect(roster.map((e) => e.id)).toEqual([SECOND.id])
  })

  it('deleting the added catalog RE-ENABLES its picker row (the refresh-on-render seam), and it can be re-added', async () => {
    const el = mountWithCatalogLibrary([
      { id: SECOND.id, kind: ENTRY_KINDS.catalog, label: SECOND.label, description: '', content: '', order: 0, enabled: false, builtin: false },
    ])
    await whenFlushed()
    expect(secondLibraryRow(el).getAttribute('aria-disabled')).toBe('true')

    const row = entryEl(el, ENTRY_KINDS.catalog, SECOND.id)
    ;(row.querySelector('[data-part="entry-delete"]') as HTMLElement).click()
    await whenFlushed()
    expect(el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog))).toEqual([])
    expect(secondLibraryRow(el).getAttribute('aria-disabled'), 'the delete refreshed the picker — no longer stale').toBeNull()

    secondLibraryRow(el).click()
    await whenFlushed()
    const roster = el.store!.get(entriesStoreKey(ENTRY_KINDS.catalog)) as Entry[]
    expect(roster.map((e) => e.id), 're-adding after a delete commits normally').toEqual([SECOND.id])
  })

  it('a NON-catalog kind (skill) never disables a picker row on collision — the suffix-dedup UX is untouched', async () => {
    const PACK = {
      [ENTRY_KINDS.skill]: [{ id: 'test-pack', label: 'Test pack', description: 'fixture', entries: [{ label: 'grid-idiom', description: '', content: '' }] }],
    }
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore()
    el.libraries = PACK
    mount(el)
    await whenFlushed()
    const row = el.querySelector('[data-value="test-pack:0"]') as HTMLElement
    row.click()
    await whenFlushed()
    expect(readEntries(el.store, ENTRY_KINDS.skill)).toHaveLength(1)
    expect(row.getAttribute('aria-disabled'), 'a hand-authored kind never opts into rejectOnCollision').toBeNull()

    row.click() // a second commit still slug-dedups instead of colliding — unchanged by GH #564
    await whenFlushed()
    const entries = readEntries(el.store, ENTRY_KINDS.skill)
    expect(entries).toHaveLength(2)
    expect(entries[1]!.id).toBe('grid-idiom-2')
  })
})

// ── GH #783 / LLD-C5 (SPEC-R6 AC1/AC2) — the PER-PACK rejectOnCollision flag ─────────────────────────────
// The GH #564 fix above pins the foreign-key reject to the catalog KIND (`isCatalog`). S3 widens it to a
// per-PACK flag so a live-derived pack keying an external registry can carry the reject + picker-disable
// while sitting under an ORDINARY (hand-authored) kind whose own `rejectOnCollision` stays false — the
// exact shape the GH #783 S4 live-services pack rides, WITHOUT this package ever learning that service
// vocabulary (SPEC-R6/N1 — every id below is a plain foreign key, and the SPEC-R6 app-package grep fence
// stays clean by construction: no service-registry token appears in this file). The collision LAW keeps
// its one home in `validateNewEntry`; these prove only the threading (pack flag → picker-disable → onAdd
// context → the same validator).
describe('per-pack rejectOnCollision (S3, LLD-C5, SPEC-R6) — the flag opts in at PACK grain, plain ids', () => {
  const SKILL = ENTRY_KINDS.skill
  // A flagged pack under the SKILL kind — the S4 shape: an external-registry pack under a kind whose own
  // flag is false. Entries carry an EXPLICIT foreign-key id (never slugged).
  const FLAGGED_PACK: EntryLibraryPack = {
    id: 'external-registry',
    label: 'External registry',
    description: 'fixture — a foreign-key pack under a hand-authored kind',
    rejectOnCollision: true,
    entries: [{ id: 'svc-alpha', label: 'Alpha service', description: '', content: '' }],
  }
  // An UNflagged pack under the SAME kind — proves the additive-options law: absent flag ⇒ byte-identical
  // suffix-dedup, no picker-disable ever.
  const PLAIN_PACK: EntryLibraryPack = {
    id: 'plain',
    label: 'Plain',
    description: 'fixture — an ordinary suffix-dedup pack',
    entries: [{ label: 'grid-idiom', description: '', content: '' }],
  }
  const seedRow = (id: string, label: string): Entry => ({ id, kind: SKILL, label, description: '', content: '', order: 0, enabled: true, builtin: false })

  function mountSkill(packs: EntryLibraryPack[], roster: Entry[] = []): UIAgentAdminElement {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({ initial: { [entriesStoreKey(SKILL)]: roster } })
    el.libraries = { [SKILL]: packs }
    return mount(el)
  }
  const skillSection = (el: UIAgentAdminElement): HTMLElement => el.querySelector(`[data-part="entry-section"][data-kind="${SKILL}"]`) as HTMLElement
  const pickerRow = (el: UIAgentAdminElement, value: string): HTMLElement => skillSection(el).querySelector(`[data-value="${value}"]`) as HTMLElement
  const menuEl = (el: UIAgentAdminElement): HTMLElement => skillSection(el).querySelector('[data-part="entry-library-menu"]') as HTMLElement

  it('SPEC-R6 AC1 — a flagged pack\'s already-added row is picker-disabled (never hidden); an unflagged pack\'s never is', async () => {
    const flagged = mountSkill([FLAGGED_PACK], [seedRow('svc-alpha', 'Alpha service')])
    await whenFlushed()
    const disabled = pickerRow(flagged, 'external-registry:0')
    expect(disabled.getAttribute('aria-disabled'), 'the PACK flag disables the colliding row (kind flag is false)').toBe('true')
    expect(disabled.textContent, 'and states WHY, the visible-not-hidden UX').toContain('already added')

    const plain = mountSkill([PLAIN_PACK], [seedRow('grid-idiom', 'grid-idiom')])
    await whenFlushed()
    expect(pickerRow(plain, 'plain:0').getAttribute('aria-disabled'), 'an unflagged pack never disables a row — byte-identical to before').toBeNull()
  })

  it('SPEC-R6 AC1 — adding from a flagged pack commits, then its row DISABLES on the same signal (render-refresh); a re-click is inert', async () => {
    const el = mountSkill([FLAGGED_PACK], [])
    await whenFlushed()
    expect(pickerRow(el, 'external-registry:0').getAttribute('aria-disabled'), 'nothing collides yet').toBeNull()

    pickerRow(el, 'external-registry:0').click()
    await whenFlushed()
    expect(readEntries(el.store, SKILL).map((e) => e.id), 'the foreign-key id rides through untouched').toEqual(['svc-alpha'])
    // The render-refresh gate widened for a pack flag under a non-flag kind: the just-added row disables.
    expect(pickerRow(el, 'external-registry:0').getAttribute('aria-disabled'), 'same signal — the added row is now picker-disabled').toBe('true')

    pickerRow(el, 'external-registry:0').click() // disabled → ui-menu skips it
    await whenFlushed()
    expect(readEntries(el.store, SKILL), 'no duplicate lands — the store is unchanged').toHaveLength(1)
  })

  it('SPEC-R6 AC2 — the reject safety net: a colliding add reaching onAdd is REJECTED (not suffix-deduped), visibly', async () => {
    // Dispatch the raw `select` the picker-disable normally makes unreachable, so onAdd fires with the
    // pack context on an already-present id — proving `#makeSection` merges `context.rejectOnCollision`
    // into the ONE validateNewEntry call (else it would suffix-dedup to `svc-alpha-2`).
    const el = mountSkill([FLAGGED_PACK], [seedRow('svc-alpha', 'Alpha service')])
    await whenFlushed()
    menuEl(el).dispatchEvent(new CustomEvent('select', { detail: { value: 'external-registry:0', index: 0 } }))
    await whenFlushed()
    const entries = readEntries(el.store, SKILL)
    expect(entries, 'rejected, NOT deduped — no svc-alpha-2 row minted').toHaveLength(1)
    expect(entries.map((e) => e.id)).toEqual(['svc-alpha'])
    const note = skillSection(el).querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(note.hidden, 'the fail-closed note is visible').toBe(false)
    expect(note.textContent, 'the SPEC-R5 AC2 literal').toBe('Already in the list.')
  })

  it('the additive-options law at PACK grain: an unflagged pack still suffix-dedups (byte-identical to before)', async () => {
    const el = mountSkill([PLAIN_PACK], [])
    await whenFlushed()
    pickerRow(el, 'plain:0').click()
    await whenFlushed()
    expect(pickerRow(el, 'plain:0').getAttribute('aria-disabled'), 'an unflagged pack never disables its row').toBeNull()
    pickerRow(el, 'plain:0').click()
    await whenFlushed()
    const entries = readEntries(el.store, SKILL)
    expect(entries.map((e) => e.id), 'a second add suffix-dedups, unchanged by S3').toEqual(['grid-idiom', 'grid-idiom-2'])
  })

  it('entry-list.ts threading (unit) — the select handler forwards the pack flag as onAdd\'s optional context; an unflagged pack forwards undefined', () => {
    const calls: Array<{ input: NewEntryInput; context: { rejectOnCollision?: boolean } | undefined }> = []
    const capturing: EntryListHandlers = {
      onToggle: () => {},
      onContentChange: () => {},
      onDelete: () => {},
      onAdd: (input, context) => {
        calls.push({ input, context })
        return true
      },
    }
    const section = mountEntryList(SKILL, 'Add skill', capturing, { libraries: [FLAGGED_PACK, PLAIN_PACK] })
    section.render([])
    const menu = section.host.querySelector('[data-part="entry-library-menu"]') as HTMLElement
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'external-registry:0', index: 0 } }))
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'plain:0', index: 0 } }))

    expect(calls).toHaveLength(2)
    expect(calls[0]!.context, 'a flagged pack forwards { rejectOnCollision: true }').toEqual({ rejectOnCollision: true })
    expect(calls[1]!.context, 'an unflagged pack forwards undefined — the pre-#783 call, byte-identical').toBeUndefined()
  })
})
