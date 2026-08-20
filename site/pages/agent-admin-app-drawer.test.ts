// agent-admin-app-drawer.test.ts — GH #845 (LLD-C15/C17): the PAGE's own roster-management composition,
// driven on the REAL page module (a side-effect import, the agent-admin-app.browser.test.ts precedent — its
// own file, its own document, so the full-viewport mount collides with nothing).
//
// What this file is for, precisely: the persistence primitives are unit-proven next door
// (agent-admin-presets.test.ts / agent-admin-persona-file.test.ts) and the component's picker items + two-axis
// Delete gate are proven in packages/…/agent-admin.test.ts. NEITHER of those proves the WIRING — that clicking
// the picker's real "Edit Agents" item reaches this page's drawer, that a row's real Delete button sweeps real
// localStorage keys, that the active agent falls back. That is the "picker-wiring" trap this repo has hit
// repeatedly (a callback registered is not evidence a real click reaches it), so every probe below clicks a
// REAL rendered affordance and asserts REAL state.
//
// jsdom needs three sanctioned stubs, each copied from its owning suite: the ElementInternals stub
// (agent-admin.test.ts — composed FACE controls call setFormValue/setValidity), the native `<dialog>` modal
// surface (drawer.test.ts — jsdom has no showModal/close/open at all), and the Popover API
// (toast-region.test.ts — the page's own `notify()` toast region calls showPopover, absent in jsdom). The
// REAL top-layer/scrim/focus-trap behaviour is the cross-engine leg in agent-admin-app.browser.test.ts.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { installDialogPolyfill } from '@agent-ui/shared/testing/dialog-polyfill'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (the
// agent-admin-app.test.ts precedent — the CSS token-law sweep at the bottom of this file reads real bytes)
import { readFileSync } from 'node:fs'
import { whenFlushed } from '@agent-ui/components'
import {
  AGENT_PRESETS,
  loadImportedPersonas,
  loadRosterOrder,
  personaRoster,
  presetSeed,
  rosterSource,
  type Persona,
} from './agent-admin-presets.ts'
// ADR-0227 wave 1 (GH #1542) — the raw record keys + active-id read/write live in the roster source now
// (same underlying storage keys; the retired active-preset key constant stays inside the source module).
import { IMPORTED_PERSONAS_KEY, ROSTER_ORDER_KEY } from '@agent-ui/app/agent-admin-roster-source'

const PREFIX = 'agent-admin-app'
const CUSTOM_A = 'probe-alpha'
const CUSTOM_B = 'probe-beta'

/** A library persona with a COMPLETE store shape (a preset's own seed), so the mounted admin renders it for
 *  real rather than choking on absent entry lists — an import/mint/duplicate always carries a full state. */
function customPersona(id: string, label: string): Persona {
  return { id, label, tagline: `${label} tagline`, seed: { ...presetSeed(AGENT_PRESETS[0]!), name: label }, imported: true }
}

function clearPageState(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  }
}

// ── the jsdom stubs (installed BEFORE the page module boots — it mounts at import time) ───────────────────
let realAttachInternals: typeof HTMLElement.prototype.attachInternals

beforeAll(async () => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }

  installDialogPolyfill() // the shared jsdom <dialog> stub (@agent-ui/shared/testing/dialog-polyfill, GH #1006)

  // The Popover API (toast-region.test.ts's stub) — the page's `notify()` region calls showPopover on show.
  const popover = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  if (typeof popover.showPopover !== 'function') {
    const shown = new WeakSet<HTMLElement>()
    popover.showPopover = function (this: HTMLElement): void {
      shown.add(this)
    }
    popover.hidePopover = function (this: HTMLElement): void {
      shown.delete(this)
    }
  }

  // The roster the page boots on: two custom agents after the shipped presets, the FIRST of them active —
  // so the active-deleted fallback has something real to fall back FROM.
  clearPageState()
  localStorage.setItem(IMPORTED_PERSONAS_KEY, JSON.stringify([customPersona(CUSTOM_A, 'Probe Alpha'), customPersona(CUSTOM_B, 'Probe Beta')]))
  rosterSource.writeActiveIdSync(CUSTOM_A)

  await import('./agent-admin-app.ts')
  await whenFlushed()
})

afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
  clearPageState()
})

// ── page handles ─────────────────────────────────────────────────────────────────────────────────────────
const admin = (): HTMLElement & { store?: { get(key: string): unknown } } =>
  document.querySelector('ui-agent-admin') as HTMLElement & { store?: { get(key: string): unknown } }
/** THIS page's roster drawer, addressed by its own class — never `document.querySelector('ui-drawer')`.
 *  Since GH #917 the mounted `ui-agent-admin` carries its OWN per-section entry-CRUD drawers, so a bare tag
 *  query can resolve to a component-owned surface this file knows nothing about. */
const drawer = (): HTMLElement & { open: boolean } => document.querySelector('ui-drawer.roster-drawer') as HTMLElement & { open: boolean }
const agentSelect = (): HTMLElement & { value: string } => admin().querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
const pickerIds = (): string[] =>
  [...agentSelect().querySelectorAll('[role="option"]')].map((o) => o.getAttribute('value') ?? '').filter((v) => !v.startsWith('agent-admin:'))
const rows = (): HTMLElement[] => [...document.querySelectorAll('.roster-row')] as HTMLElement[]
const rowFor = (id: string): HTMLElement => document.querySelector(`.roster-row[data-agent="${id}"]`) as HTMLElement
// GH #921 ruling 4 — Re-organize is an explicit MODE: the ^/v keyboard fallback (and the drag handle) only
// render while it is active. `reorderToggle` is a `ui-toggle` (role=button, aria-pressed via internals) —
// clicking it fires the SAME press path a real user gesture would.
const reorderToggle = (): HTMLElement => document.querySelector('.roster-drawer-reorder-toggle') as HTMLElement
const click = (el: Element | null): void => {
  expect(el, 'the affordance under test exists').not.toBeNull()
  el!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** ui-select adopts newly-appended [role=option]/[role=group] children on a MutationObserver callback
 *  (microtask-deferred) — select.test.ts's own dynamic-options idiom, re-applied. */
const adopted = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

/** Open the drawer THE WAY A USER DOES — through the component's own picker item, not by calling the page's
 *  function. That click travelling from a real `[role=option]` to a real page-side drawer IS the wiring proof. */
async function openViaPicker(): Promise<void> {
  await adopted()
  click(agentSelect().querySelector('[data-part="roster-action"][value="agent-admin:edit-agents"]'))
  await whenFlushed()
  await adopted()
}

async function closeDrawer(): Promise<void> {
  click(document.querySelector('.roster-drawer-done'))
  await whenFlushed()
}

describe('agent-admin-app — the Edit Agents drawer opens from the picker (GH #845, AC1/AC3)', () => {
  it('mounts ONE roster ui-drawer, closed, with its whole page-owned shell inside the control-owned <dialog> part', () => {
    // ONE drawer of THIS page's own (GH #917 gave the mounted component its own per-section entry drawers —
    // component-owned surfaces, proven in packages/…/agent-admin.test.ts, deliberately not counted here).
    expect(document.querySelectorAll('ui-drawer.roster-drawer'), 'exactly one roster drawer on the page').toHaveLength(1)
    expect(drawer().open, 'closed at boot — it is an on-demand surface').toBe(false)
    const dialog = drawer().querySelector('[data-part="dialog"]') as HTMLElement
    expect(dialog, 'the control created its dialog part').not.toBeNull()
    expect(dialog.getAttribute('aria-label'), 'the author name was FORWARDED onto the dialog (ADR-0017 cl.5)').toBe('Manage agents')
    expect(drawer().getAttribute('aria-label'), 'and stripped off the host').toBeNull()
    expect(drawer().getAttribute('edge')).toBe('end')
    // The child-move law: everything the page built must be INSIDE the dialog, or it renders outside the
    // top-layer surface and is invisible while the drawer is open.
    for (const selector of ['.roster-drawer-title', '.roster-drawer-status', '.roster-list', '.roster-drawer-footer']) {
      expect(dialog.querySelector(selector), `${selector} lives inside the dialog part`).not.toBeNull()
    }
  })

  it('clicking the picker’s real "Edit Agents" item opens it with ONE ROW PER ROSTER ENTRY, in picker order', async () => {
    expect(drawer().open).toBe(false)
    await openViaPicker()

    expect(drawer().open, 'the component seam genuinely reached this page’s handler').toBe(true)
    const listed = rows().map((row) => row.dataset.agent)
    expect(listed, 'one row per entry, in the SAME order the picker shows').toEqual(pickerIds())
    expect(listed).toHaveLength(AGENT_PRESETS.length + 2)
    expect(listed.slice(-2)).toEqual([CUSTOM_A, CUSTOM_B])
    expect(rowFor(CUSTOM_A).hasAttribute('data-active'), 'the active agent’s row is marked').toBe(true)
    await closeDrawer()
    expect(drawer().open, 'and Done closes it').toBe(false)
  })
})

describe('agent-admin-app — preset protection is STRUCTURAL in the drawer (GH #845, AC3/AC5/AC6)', () => {
  it('a shipped preset row carries NO delete and NO rename affordance at all — and says why; a custom row carries both', async () => {
    await openViaPicker()
    const preset = rowFor(AGENT_PRESETS[0]!.id)
    expect(preset.querySelector('.roster-row-delete'), 'structurally absent, not disabled').toBeNull()
    expect(preset.querySelector('.roster-row-rename'), 'renaming a shipped preset is meaningless — no affordance').toBeNull()
    expect(preset.querySelector('.roster-row-tag')?.textContent, 'the protection is STATED, not silent').toBe('Shipped')
    expect(preset.querySelector('.roster-row-duplicate'), 'duplicate IS offered — the escape hatch that makes the protection free').not.toBeNull()

    const custom = rowFor(CUSTOM_B)
    expect(custom.querySelector('.roster-row-delete')).not.toBeNull()
    expect(custom.querySelector('.roster-row-rename')).not.toBeNull()
    expect(custom.querySelector('.roster-row-tag'), 'no "Shipped" tag on a custom agent').toBeNull()
    await closeDrawer()
  })

  it('GH #921 ruling 4 — the ^/v keyboard-fallback move buttons exist ONLY while Re-organize mode is active, named for their agent', async () => {
    await openViaPicker()
    const preset = rowFor(AGENT_PRESETS[0]!.id)
    expect(preset.querySelector('[aria-label^="Move"]'), 'outside reorder mode, no move affordance at all — the retired always-on buttons').toBeNull()

    click(reorderToggle())
    await whenFlushed()
    // `pressed` reflects (toggle.md) — `aria-pressed` itself is set via ElementInternals, never a host
    // attribute (FACE), so the reflected `[pressed]` attribute is the jsdom-visible proxy for the ON state.
    expect(reorderToggle().hasAttribute('pressed'), 'the mode toggle itself reflects ON').toBe(true)

    const labels = [...rowFor(AGENT_PRESETS[0]!.id).querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'))
    expect(labels, 'every row — preset included — gets the keyboard fallback while the mode is active').toContain(`Move ${AGENT_PRESETS[0]!.label} up`)
    expect(labels).toContain(`Move ${AGENT_PRESETS[0]!.label} down`)

    click(reorderToggle())
    await whenFlushed()
    expect(reorderToggle().hasAttribute('pressed')).toBe(false)
    expect(rowFor(AGENT_PRESETS[0]!.id).querySelector('[aria-label^="Move"]'), 'leaving the mode retires the buttons again').toBeNull()
    await closeDrawer()
  })

  it('the two-axis Delete gate on the REAL page: both component homes paint for the active CUSTOM agent, and neither for a preset', async () => {
    expect(agentSelect().value, 'a custom agent is active').toBe(CUSTOM_A)
    const item = (): HTMLElement => admin().querySelector('[data-value="delete-agent"]') as HTMLElement
    const row = (): HTMLElement => admin().querySelector('[data-part="delete-agent-row"]') as HTMLElement
    expect([item().hidden, row().hidden], 'custom + registered seam ⇒ both Delete homes paint').toEqual([false, false])

    // Switch to a shipped preset through the REAL picker — `deletable` is roster data, so the gate must
    // follow the active entry, not just the seam registration.
    click(agentSelect().querySelector(`[role="option"][value="${AGENT_PRESETS[1]!.id}"]`))
    await whenFlushed()
    expect(agentSelect().value).toBe(AGENT_PRESETS[1]!.id)
    expect([item().hidden, row().hidden], 'a preset shows NEITHER Delete affordance').toEqual([true, true])

    click(agentSelect().querySelector(`[role="option"][value="${CUSTOM_A}"]`))
    await whenFlushed()
    expect([item().hidden, row().hidden], 'and back again — the gate is live, not a boot-time snapshot').toEqual([false, false])
  })
})

describe('agent-admin-app — reorder · rename · duplicate through the real row buttons (GH #845, AC6)', () => {
  it('Move up on a custom row persists an explicit order AND drives the picker’s own order', async () => {
    await openViaPicker()
    // GH #921 ruling 4 — the ^/v buttons exist ONLY in Re-organize mode; enter it through the real toggle.
    click(reorderToggle())
    await whenFlushed()
    const before = pickerIds()
    expect(before.slice(-2)).toEqual([CUSTOM_A, CUSTOM_B])

    click(rowFor(CUSTOM_B).querySelector('[aria-label="Move Probe Beta up"]'))
    await whenFlushed()
    await adopted()

    expect(loadRosterOrder().slice(-2), 'the swap is PERSISTED as an explicit id order').toEqual([CUSTOM_B, CUSTOM_A])
    expect(pickerIds().slice(-2), 'and the picker follows it (setAgentRoster re-push)').toEqual([CUSTOM_B, CUSTOM_A])
    expect(rows().map((r) => r.dataset.agent), 'as does the drawer list itself').toEqual(pickerIds())

    // Put it back — the same button on the other row, so the reverse path is proven too.
    click(rowFor(CUSTOM_B).querySelector('[aria-label="Move Probe Beta down"]'))
    await whenFlushed()
    await adopted()
    expect(pickerIds().slice(-2)).toEqual([CUSTOM_A, CUSTOM_B])
    expect(rowFor(AGENT_PRESETS[0]!.id).querySelector('[aria-label^="Move"]')?.hasAttribute('disabled'), 'the first row cannot move up').toBe(true)
    await closeDrawer()
  })

  it('Rename swaps the label for a real field, and Save rewrites the record, the row, and the picker — id untouched', async () => {
    await openViaPicker()
    click(rowFor(CUSTOM_B).querySelector('.roster-row-rename'))
    await whenFlushed()

    const field = rowFor(CUSTOM_B).querySelector('.roster-row-field') as HTMLElement & { value: string }
    expect(field, 'the label swapped for an inline field').not.toBeNull()
    expect(field.value, 'seeded with the current label').toBe('Probe Beta')
    expect(field.getAttribute('label'), 'the field is NAMED for AT (text-field’s labelling seam)').toBe('Rename Probe Beta')

    field.value = '  Probe Beta Renamed  '
    click(rowFor(CUSTOM_B).querySelector('.roster-row-save'))
    await whenFlushed()
    await adopted()

    const record = loadImportedPersonas().find((p) => p.id === CUSTOM_B)
    expect(record?.label, 'trimmed and persisted').toBe('Probe Beta Renamed')
    expect(record?.id, 'DISPLAY-ONLY — the id every store key hangs off is stable (GH #848’s law)').toBe(CUSTOM_B)
    expect(rowFor(CUSTOM_B).querySelector('.roster-row-label')?.textContent).toBe('Probe Beta Renamed')
    const option = agentSelect().querySelector(`[role="option"][value="${CUSTOM_B}"]`)
    expect(option?.textContent, 'and the picker row is repainted').toBe('Probe Beta Renamed')
    expect(document.querySelector('.roster-drawer-status')?.textContent, 'the in-drawer status states it (a toast alone paints under the modal scrim)').toContain('Renamed')
  })

  it('a colliding or blank rename is REFUSED visibly, the field stays open, and nothing is written', async () => {
    const field = () => rowFor(CUSTOM_B).querySelector('.roster-row-field') as (HTMLElement & { value: string }) | null
    click(rowFor(CUSTOM_B).querySelector('.roster-row-rename'))
    await whenFlushed()

    field()!.value = 'Probe Alpha' // the OTHER agent's label
    click(rowFor(CUSTOM_B).querySelector('.roster-row-save'))
    await whenFlushed()
    expect(document.querySelector('.roster-drawer-status')?.textContent).toContain('already called')
    expect(field(), 'the field stays open on a refusal — never a silent no-op').not.toBeNull()

    field()!.value = '   '
    click(rowFor(CUSTOM_B).querySelector('.roster-row-save'))
    await whenFlushed()
    expect(document.querySelector('.roster-drawer-status')?.textContent).toContain('needs a name')
    expect(loadImportedPersonas().find((p) => p.id === CUSTOM_B)?.label, 'the record is untouched by either refusal').toBe('Probe Beta Renamed')

    // Escape reverts the edit and puts the plain label back (without closing the drawer).
    field()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await whenFlushed()
    expect(rowFor(CUSTOM_B).querySelector('.roster-row-field'), 'the field is gone').toBeNull()
    expect(rowFor(CUSTOM_B).querySelector('.roster-row-label')?.textContent).toBe('Probe Beta Renamed')
    expect(drawer().open, 'and Escape did NOT dismiss the whole drawer out from under the rename').toBe(true)
    await closeDrawer()
  })

  it('Duplicate on a SHIPPED preset row mints an editable custom copy at the end — the source untouched', async () => {
    await openViaPicker()
    const source = AGENT_PRESETS[0]!
    const before = rows().length

    click(rowFor(source.id).querySelector('.roster-row-duplicate'))
    await whenFlushed()
    await adopted()

    expect(rows(), 'one new row').toHaveLength(before + 1)
    const copy = personaRoster().find((p) => p.label === `${source.label} (copy)`)
    expect(copy, 'minted through the ONE collision loop').toBeDefined()
    expect(copy?.imported, 'a copy is a LIBRARY record — deletable and renamable, unlike its source').toBe(true)
    expect(pickerIds().at(-1), 'and it lands at the roster’s end, in the picker too').toBe(copy?.id)

    const copyRow = rowFor(copy!.id)
    expect(copyRow.querySelector('.roster-row-delete'), 'the COPY can be deleted').not.toBeNull()
    expect(copyRow.querySelector('.roster-row-rename'), 'and renamed').not.toBeNull()
    expect(rowFor(source.id).querySelector('.roster-row-delete'), 'while the SOURCE preset stays protected').toBeNull()
    expect(personaRoster().find((p) => p.id === source.id)?.imported, 'the source is still a shipped preset').toBeUndefined()

    // Clean up the copy through the real affordance — which also proves delete on a NON-active agent.
    const activeBefore = agentSelect().value
    click(copyRow.querySelector('.roster-row-delete'))
    await whenFlushed()
    await adopted()
    expect(personaRoster().some((p) => p.id === copy!.id), 'gone').toBe(false)
    expect(agentSelect().value, 'deleting a NON-active agent never switches the active one').toBe(activeBefore)
    await closeDrawer()
  })
})

describe('agent-admin-app — deleting the ACTIVE custom agent sweeps its state and falls back (GH #845, AC4)', () => {
  it('the row’s Delete removes the record, EVERY persisted key under its prefix, and hands the page to personaRoster()[0]', async () => {
    // Dirty the active persona for real, so the sweep has genuine keys to remove (not just the seed marker).
    const store = admin().store as { get(key: string): unknown; set(key: string, value: unknown): void } | undefined
    expect(store, 'the active persona has a live store').toBeDefined()
    store!.set('name', 'DIRTY-BEFORE-DELETE')
    expect(Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIX}.${CUSTOM_A}.`)).length, 'real keys exist to sweep').toBeGreaterThan(0)
    expect(rosterSource.activeIdSync()).toBe(CUSTOM_A)

    await openViaPicker()
    click(rowFor(CUSTOM_A).querySelector('.roster-row-delete'))
    await whenFlushed()
    await adopted()

    expect(loadImportedPersonas().some((p) => p.id === CUSTOM_A), 'the library record is gone').toBe(false)
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIX}.${CUSTOM_A}.`)),
      'ZERO orphaned PERSIST_PREFIX keys (enumerated, not spot-checked)',
    ).toEqual([])
    expect(loadRosterOrder().includes(CUSTOM_A), 'and no order slot survives it').toBe(false)

    const fallback = personaRoster()[0]!
    expect(fallback.id, 'the fallback is the fresh roster’s first entry — a shipped preset, never a deleted id').toBe(AGENT_PRESETS[0]!.id)
    expect(agentSelect().value, 'the picker moved to it').toBe(fallback.id)
    expect(rosterSource.activeIdSync(), 'and the persisted active id was rewritten').toBe(fallback.id)
    expect(admin().store?.get('name'), 'the admin is showing the fallback persona’s own store, not the dead one').toBe(AGENT_PRESETS[0]!.config.name)

    expect(rowFor(CUSTOM_A), 'the drawer row is gone too').toBeNull()
    expect(rows().map((r) => r.dataset.agent)).toEqual(pickerIds())
    expect(
      (admin().querySelector('[data-value="delete-agent"]') as HTMLElement).hidden,
      'and the header’s Delete item hides itself — the fallback is a protected preset',
    ).toBe(true)
    await closeDrawer()
  })
})

// The colour law, mechanized for THIS page sheet (tokens.md §Consumption invariants): the fleet's
// styling-gates.test.ts sweeps `packages/` only, so a site page sheet has no standing trip-wire — and the
// drawer's Delete repoint is exactly the kind of rule where a raw hex/oklch would be easiest to reach for.
describe('agent-admin-app.css — the drawer rules consume ROLES, never raw colour values (GH #845, LLD-C16)', () => {
  const sheet = (): string => readFileSync('site/pages/agent-admin-app.css', 'utf8') as string

  it('every colour in the added rules resolves through a --md-sys-color-* role', () => {
    const css = sheet().replace(/\/\*[\s\S]*?\*\//g, '') // comments quote token names as documentation
    expect(css, 'anti-vacuous: the drawer rules are really in this sheet').toContain('.roster-row-delete')
    expect(css, 'no raw hex').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css, 'no raw oklch/rgb/hsl literal').not.toMatch(/\b(oklch|rgba?|hsla?)\(/)
  })

  it('GH #921 — the Delete menu item is danger-styled directly (a ui-menu item is a plain node, not a ui-button — no custom-property repoint to make)', () => {
    const block = sheet().slice(sheet().indexOf('.roster-row-delete'), sheet().indexOf('.roster-row-delete') + 300)
    expect(block, 'the ink reads the danger family').toContain('color: var(--md-sys-color-danger-')
    expect(block, 'hover state').toMatch(/:hover\s*\{\s*background:\s*var\(--md-sys-color-danger-/)
    expect(block, 'active state').toMatch(/:active\s*\{\s*background:\s*var\(--md-sys-color-danger-/)
  })
})

describe('agent-admin-app — the seam registrations the picker items ride (GH #845, AC1/AC2)', () => {
  it('both Manage items are composed, and New Agent reuses the EXISTING mint seam (no second creation flow)', async () => {
    await adopted()
    const items = [...agentSelect().querySelectorAll('[data-part="roster-action"]')]
    expect(items.map((i) => i.textContent), 'divider group + the two items, in the ruled order').toEqual(['New Agent', 'Edit Agents'])
    expect(ROSTER_ORDER_KEY, 'the order record is namespaced under the page prefix').toBe(`${PREFIX}.rosterOrder`)

    const before = pickerIds().length
    click(agentSelect().querySelector('[data-part="roster-action"][value="agent-admin:new-agent"]'))
    await whenFlushed()
    await adopted()

    // The proof that it is the EXISTING Generate flow, not a second one: a minted row PLUS an armed Builder
    // interview (the one behaviour that distinguishes Generate from a bare blank mint).
    expect(pickerIds(), 'one new agent').toHaveLength(before + 1)
    const minted = personaRoster().at(-1)!
    expect(minted.label, 'the shared mint law: "New agent", numbered only on a real collision').toMatch(/^New agent( \d+)?$/)
    expect(agentSelect().value, 'and it becomes active').toBe(minted.id)
    const holder = admin().querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.getAttribute('data-primary'), 'the Builder interview opens on Co-pilot — the Generate flow, verbatim').toBe('copilot')
  })
})

describe('agent-admin-app — the drawer-open scroll survives jsdom, where scrollIntoView is absent (GH #1219)', () => {
  it('opening the drawer schedules the active-row scroll; a frame later nothing threw (the status-stream guard idiom)', async () => {
    await openViaPicker()
    const active = rowFor(agentSelect().value)
    expect(active, 'the active agent has a row').not.toBeNull()
    expect(active.hasAttribute('data-active'), 'marked active').toBe(true)
    // The guard path itself: jsdom rows carry no scrollIntoView — the page's rAF callback must return, not
    // throw (an uncaught rAF exception here fails the run as an Unhandled Error even with tests green).
    expect(typeof (active as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView, 'the jsdom premise this test rests on').toBe('undefined')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await closeDrawer()
  })
})
