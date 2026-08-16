// entry-list.browser.test.ts — ADR-0164's own §Acceptance proof: "one NEW standalone mount smoke test in
// entry-list/ (stub handlers + createMemoryStore) proves a styled, working entry section with zero
// agent-admin involvement." The real un-extracted remainder this ADR closed was CSS, not TypeScript
// (`entry-list.ts` was already generic) — so the load-bearing assertion here is COMPUTED STYLE, not just
// DOM shape: a real border/radius/surface/gap sourced from THIS module's own `entry-list.css`, with
// `ui-agent-admin`/`agent-admin.css` never imported anywhere in this file. jsdom cannot resolve `@scope`/
// flex layout (the agent-admin.browser.test.ts precedent) — only a real browser can prove styling
// actually landed, as opposed to merely existing as an unconsumed sheet.

import { describe, it, expect, afterEach } from 'vitest'

import '@agent-ui/components/foundation-styles.css' // the --md-sys-color-*/--md-sys-space-*/-shape-corner-base roots entry-list.css's own token block reads
import '@agent-ui/components/component-styles.css' // ui-button/ui-icon/ui-switch/ui-text-field/ui-field's shipped CSS (composed by entry-list.ts)
import '@agent-ui/code/editor.css' // ADR-0139 — ui-code-editor's own sheet (the per-entry content editor)
import '@agent-ui/icons/phosphor' // the add-toggle's leading `plus` glyph
import './entry-list.css' // the ONE sheet under test
// entry-list.ts's own imports of these are TYPE-only (agent-admin.ts's header comment: "registers these
// tags before this element ... ever calls document.createElement on one" — the CALLER's job, same as
// every other mountEntryList consumer). A standalone mount owns that registration itself, here.
import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'
import '@agent-ui/components/controls/text-field'
import '@agent-ui/components/controls/field'
import '@agent-ui/components/controls/switch'
import '@agent-ui/components/controls/toggle' // GH #850 — the per-entry availability mode pill
import '@agent-ui/code/editor'
import { mountEntryList, showAddError, type EntryListSection } from './entry-list.ts'
import { validateNewEntry, renameEntry, readEntries, entriesStoreKey, ENTRY_AVAILABILITY, type Entry } from './entry-data.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsStore } from '../settings/store.ts'
import type { UICodeEditorElement } from '@agent-ui/code/editor'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'

const KIND = 'smoke-kind'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** The cl.5 live-apply idiom (commit on change → store.set → subscribe re-render → fresh read at consume
 *  time), the exact shape `agent-admin.ts`'s own `#makeSection`/`#updateEntries` wire — proven here with a
 *  bare `createMemoryStore`, no agent-admin involved. */
function mount(store: SettingsStore, options?: { rename?: boolean; withRenameHandler?: boolean; availabilityToggle?: boolean }): EntryListSection {
  let section!: EntryListSection
  const withRenameHandler = options?.withRenameHandler !== false
  section = mountEntryList(KIND, 'Add item', {
    // GH #848 — the rename handler is present by default here (a section's OWN store write, the same
    // read → map → set shape every other handler uses); `withRenameHandler: false` drops it to prove the
    // affordance's SECOND gate (no handler ⇒ no affordance, even with the option on).
    ...(withRenameHandler
      ? {
          onRename: (id: string, label: string) => store.set(entriesStoreKey(KIND), renameEntry(readEntries(store, KIND), id, label)),
        }
      : {}),
    // GH #850's writer, wired the same way — so ONE mount can carry both row affordances at once (the
    // both-on case below is the reconciliation's real proof: two opt-ins on one row, neither breaking the
    // other's control or the row's shape).
    onAvailabilityChange: (id, availability) =>
      store.set(
        entriesStoreKey(KIND),
        readEntries(store, KIND).map((e) => (e.id === id ? { ...e, availability } : e)),
      ),
    onToggle: (id, enabled) =>
      store.set(
        entriesStoreKey(KIND),
        readEntries(store, KIND).map((e) => (e.id === id ? { ...e, enabled } : e)),
      ),
    onContentChange: (id, content) =>
      store.set(
        entriesStoreKey(KIND),
        readEntries(store, KIND).map((e) => (e.id === id ? { ...e, content } : e)),
      ),
    onDelete: (id) =>
      store.set(
        entriesStoreKey(KIND),
        readEntries(store, KIND).filter((e) => e.id !== id),
      ),
    onAdd: (input) => {
      const result = validateNewEntry(readEntries(store, KIND), KIND, input)
      if (!result.ok) {
        showAddError(section, result.error)
        return false
      }
      store.set(entriesStoreKey(KIND), [...readEntries(store, KIND), result.entry])
      return true
    },
  }, options === undefined ? undefined : { rename: options.rename === true, availabilityToggle: options.availabilityToggle === true })
  store.subscribe?.(() => section.render(readEntries(store, KIND)))
  document.body.append(section.host)
  mounted.push(section.host)
  section.render(readEntries(store, KIND))
  return section
}

const SEED: Entry = {
  id: 'seed-one',
  kind: KIND,
  label: 'Seeded item',
  description: 'A stub entry, seeded straight into the store.',
  content: 'Some content.',
  order: 0,
  enabled: true,
  builtin: false,
}

describe('mountEntryList — standalone, ZERO ui-agent-admin/agent-admin.css involvement (ADR-0164 §Acceptance)', () => {
  it('this file never references ui-agent-admin or agent-admin.css (structural: no such import above)', () => {
    // Anti-vacuous companion to the styling assertions below: nothing in the DOM tree this test builds
    // is, or descends from, a ui-agent-admin host.
    expect(document.querySelector('ui-agent-admin')).toBeNull()
  })

  it('renders a STYLED entry card — real border/radius/surface from entry-list.css alone', async () => {
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [SEED] } })
    const section = mount(store)
    const editor = section.host.querySelector('ui-code-editor') as UICodeEditorElement | null
    await editor?.updateComplete

    const entry = section.host.querySelector('[data-part="entry"]') as HTMLElement
    expect(entry, 'the seeded entry rendered a card').not.toBeNull()
    const style = getComputedStyle(entry)
    expect(style.borderTopWidth, 'a real border, not the UA default').not.toBe('0px')
    expect(style.borderTopStyle).toBe('solid')
    expect(style.backgroundColor, 'a real, non-transparent surface').not.toBe('rgba(0, 0, 0, 0)')
    expect(Number.parseFloat(style.borderTopLeftRadius), 'a real, non-zero corner radius').toBeGreaterThan(0)
  })

  it('renders the STYLED section/list shape — a real, non-zero vertical gap from entry-list.css', () => {
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [SEED] } })
    const section = mount(store)
    const sectionStyle = getComputedStyle(section.host)
    expect(sectionStyle.display).toBe('flex')
    expect(sectionStyle.flexDirection).toBe('column')
    expect(sectionStyle.rowGap, 'a real gap, not the UA `normal` default').not.toBe('normal')
    expect(Number.parseFloat(sectionStyle.rowGap)).toBeGreaterThan(0)
  })

  it('is WORKING, not just painted: add → toggle → delete round-trip through a bare createMemoryStore', async () => {
    const store = createMemoryStore()
    const section = mount(store)

    const addToggle = section.host.querySelector('[data-part="entry-add-toggle"]') as HTMLElement
    addToggle.click()
    const labelField = section.host.querySelector('[data-part="entry-add-label"]') as UITextFieldElement
    labelField.value = 'Hand-authored item'
    const submitBtn = section.host.querySelector('[data-part="entry-add-submit"]') as HTMLElement
    submitBtn.click()

    const rows = () => [...section.host.querySelectorAll<HTMLElement>('[data-part="entry"]')]
    expect(rows().some((r) => r.textContent?.includes('Hand-authored item')), 'the add committed and rendered').toBe(true)
    expect(readEntries(store, KIND)).toHaveLength(1)

    const added = readEntries(store, KIND)[0]!
    const toggle = section.host.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    toggle.checked = false
    toggle.dispatchEvent(new Event('change'))
    expect(readEntries(store, KIND)[0]!.enabled, 'the toggle committed to the store').toBe(false)

    const deleteBtn = section.host.querySelector('[data-part="entry-delete"]') as HTMLElement
    deleteBtn.click()
    expect(readEntries(store, KIND), 'the delete committed and the row is gone').toEqual([])
    expect(rows().find((r) => r.getAttribute('data-entry-id') === added.id)).toBeUndefined()
  })

  // TKT-0049/ADR-0139 (originally proven through ui-agent-admin's Instructions section — GH #949 drawered
  // it, along with every other agent-admin kind but `catalog`, which builds no content editor at all — so
  // this fleet no longer has a LIVE composed consumer of the rows=4 INLINE content field; the formula itself
  // is still real at the primitive that owns it, `entry-list.ts`'s `withContentField && !withDrawer` branch,
  // rendered off `ui-code-editor`'s own `--ui-code-editor-min-block-size` formula: rows × line-box +
  // 2×padding-block, line-box = font-size × 1.5, padding-block = font-size × 0.5 — identical to the
  // ui-textarea it replaced, ADR-0139 cl.6). Deriving the expected px from the field's OWN real computed
  // font-size (never a hardcoded px) proves the `rows` mechanism, not a re-asserted legacy pixel value.
  it('a non-drawered kind\'s entry-content (rows=4) renders a real computed min-height matching the rows formula', async () => {
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [SEED] } })
    const section = mount(store)
    const field = section.host.querySelector('[data-part="entry-content"]') as UICodeEditorElement
    await field.updateComplete
    expect(field.rows).toBe(4)
    const fontSize = Number.parseFloat(getComputedStyle(field).fontSize)
    const expected = 4 * (fontSize * 1.5) + 2 * (fontSize * 0.5)
    const computed = Number.parseFloat(getComputedStyle(field).minHeight)
    expect(computed).toBeCloseTo(expected, 1)
  })

  // component-reviewer CRITICAL fix (originally proven through ui-agent-admin's Instructions/Pattern-source
  // sections — GH #917/#949 drawered every remaining agent-admin kind except `catalog` — which suppresses
  // authoring entirely — so this fleet no longer has a LIVE composed consumer of the inline dashed add-form;
  // the mechanism itself is still real (`entry-list.ts`'s `withCustomAdd && !withDrawer` branch) and still
  // needs this CSS-cascade regression pinned at the primitive that actually owns it). Before the fix,
  // `display: flex` beat the UA `[hidden]` rule.
  it('a hidden add-form (a non-drawered kind, the mount() helper\'s default) computes display:none; toggling reveals it as a real, visible box', () => {
    const store = createMemoryStore()
    const section = mount(store)
    const form = section.host.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(getComputedStyle(form).display).toBe('none')
    expect(form.getBoundingClientRect().height).toBe(0)

    const addToggle = section.host.querySelector('[data-part="entry-add-toggle"]') as HTMLElement
    addToggle.click()
    expect(getComputedStyle(form).display).not.toBe('none')
    expect(form.getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

// ── GH #850 / capability-availability-tagging.spec.md SPEC-R2 — the at-a-glance row marker, for real ──────
// The marker's whole job is to be SEEN without opening anything, and "seen" is a real-engine fact: jsdom
// resolves neither the `@scope` rule that paints it nor the computed border it paints with. So the proof is
// computed style on the rendered card — a context row and an invocable row, measured and compared, plus the
// mode pill's own rendered box (an aria-pressed control the user can actually hit) rather than DOM presence.

describe('mountEntryList — the user-invocable row marker is genuinely VISIBLE (SPEC-R2)', () => {
  /** The same store-backed mount as above, with the mode opt-in and its writer wired. */
  function mountWithModes(store: SettingsStore): EntryListSection {
    const section = mountEntryList(
      KIND,
      'Add item',
      {
        onToggle: () => {},
        onContentChange: () => {},
        onDelete: () => {},
        onAdd: () => true,
        onAvailabilityChange: (id, availability) =>
          store.set(
            entriesStoreKey(KIND),
            readEntries(store, KIND).map((e) => (e.id === id ? { ...e, availability } : e)),
          ),
      },
      { availabilityToggle: true },
    )
    store.subscribe?.(() => section.render(readEntries(store, KIND)))
    document.body.append(section.host)
    mounted.push(section.host)
    section.render(readEntries(store, KIND))
    return section
  }

  it('an invocable card paints a DIFFERENT, thicker start edge than an in-context one (measured, not asserted from the DOM)', async () => {
    const store = createMemoryStore({
      initial: {
        [entriesStoreKey(KIND)]: [
          { ...SEED, id: 'ambient', label: 'Ambient item', order: 0 },
          { ...SEED, id: 'invocable', label: 'Invocable item', order: 1, availability: 'invocable' },
        ] satisfies Entry[],
      },
    })
    const section = mountWithModes(store)
    for (const editor of section.host.querySelectorAll('ui-code-editor')) await (editor as UICodeEditorElement).updateComplete

    const cardOf = (id: string): HTMLElement => section.host.querySelector(`[data-part="entry"][data-entry-id="${id}"]`) as HTMLElement
    const ambient = getComputedStyle(cardOf('ambient'))
    const invocable = getComputedStyle(cardOf('invocable'))
    // Anti-vacuous floor: both cards really painted a border at all (the shared card chrome).
    expect(Number.parseFloat(ambient.borderInlineStartWidth)).toBeGreaterThan(0)
    // The marker itself: a thicker start edge in a different colour — visible while scanning a list.
    expect(Number.parseFloat(invocable.borderInlineStartWidth)).toBeGreaterThan(Number.parseFloat(ambient.borderInlineStartWidth))
    expect(invocable.borderInlineStartColor).not.toBe(ambient.borderInlineStartColor)
    // …and the card still has real height/width — a marked row is a full card, not a collapsed sliver.
    const box = cardOf('invocable').getBoundingClientRect()
    expect(box.height).toBeGreaterThan(20)
    expect(box.width).toBeGreaterThan(100)
  })

  it('the mode pill is a real, hittable control — and a real press commits the mode to the store', () => {
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [SEED] } })
    const section = mountWithModes(store)
    const pill = (): HTMLElement & { pressed: boolean } =>
      section.host.querySelector('[data-part="entry-availability"]') as HTMLElement & { pressed: boolean }
    const box = pill().getBoundingClientRect()
    expect(box.height, 'a real control box, not a zero-size node').toBeGreaterThan(16)
    expect(box.width).toBeGreaterThan(40)
    // `pressed` reflects to an attribute (toggle.md) — the AX state itself rides internals.ariaPressed,
    // which is unreadable from outside by construction (the fleet ARIA-via-internals law).
    expect(pill().hasAttribute('pressed'), 'off to start — a field-less entry is in-context').toBe(false)
    expect(pill().textContent, 'the row states the mode in words, not colour alone').toContain('Invocable')

    pill().click() // the real user gesture — ui-toggle's own click path emits `toggle`, then commits
    expect(readEntries(store, KIND)[0]!.availability, 'the press wrote the mode').toBe('invocable')
    const marked = section.host.querySelector('[data-part="entry"]') as HTMLElement
    expect(marked.getAttribute('data-availability')).toBe('invocable')
    expect(pill().pressed, 'the re-rendered row paints the new state').toBe(true)
    expect(pill().hasAttribute('pressed')).toBe(true)
  })
})

// ── GH #848 — the per-row RENAME affordance, in a real engine ─────────────────────────────────────────────
// jsdom can prove the store writes (entry-data.test.ts / agent-admin.test.ts do). Only a real engine can
// prove the affordance is a LEGIBLE, non-collapsed row: that the inline field genuinely takes the label's
// place at a real painted width instead of overflowing the card's trailing actions out of the row, that
// focus actually lands in it, and that a real Enter/Escape keystroke on the editor part commits/cancels.

/** The row's header parts, left-to-right, with real painted boxes — the WHOLE-shape read (a per-part
 *  "it exists" probe passes just as happily on a row whose field has pushed Remove off the card edge). */
function headerGeometry(row: HTMLElement): { part: string; left: number; right: number; top: number; centerY: number }[] {
  // The row's ruled left-to-right order (entry-list.ts's own order note): state controls, then the action
  // pair, destructive last — with `entry-availability` (GH #850's mode pill) between the spacer and Rename.
  const parts = ['entry-toggle', 'entry-label', 'entry-rename-field', 'entry-spacer', 'entry-availability', 'entry-rename', 'entry-delete']
  return parts.flatMap((part) => {
    const node = row.querySelector(`[data-part="${part}"]`) as HTMLElement | null
    if (node === null) return []
    const box = node.getBoundingClientRect()
    // `centerY`, not `top`: `entry-header`'s `align-items: center` vertically centers parts of DIFFERENT
    // heights (the empty entry-spacer vs. the 28px Invocable pill) around a shared line CENTER, not a
    // shared top — center-Y is what actually identifies "the same flex line" once `flex-wrap` (GH #865)
    // means a row can paint on more than one.
    return [{ part, left: box.left, right: box.right, top: box.top, centerY: (box.top + box.bottom) / 2 }]
  })
}

describe('mountEntryList — the rename affordance (GH #848)', () => {
  const seeded = (): SettingsStore => createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [SEED] } })
  const row = (section: EntryListSection): HTMLElement => section.host.querySelector('[data-part="entry"]') as HTMLElement

  it('BYTE-IDENTICAL DEFAULT: a section mounted without the option renders NO rename affordance', () => {
    const section = mount(seeded())
    expect(row(section).querySelector('[data-part="entry-rename"]'), 'no trigger').toBeNull()
    expect(row(section).querySelector('[data-part="entry-rename-field"]'), 'no field').toBeNull()
    expect((row(section).querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Seeded item')
  })

  it('the SECOND gate: `rename: true` with no `onRename` handler renders no affordance either (nothing to commit through)', () => {
    const section = mount(seeded(), { rename: true, withRenameHandler: false })
    expect(row(section).querySelector('[data-part="entry-rename"]')).toBeNull()
  })

  it('the flagged row PAINTS the whole shape: [switch | field | spacer | Rename | Remove], every part inside the card', async () => {
    const section = mount(seeded(), { rename: true })
    const trigger = row(section).querySelector('[data-part="entry-rename"]') as HTMLElement
    expect(trigger.tagName.toLowerCase(), 'a real ui-button, not a bespoke <button>').toBe('ui-button')
    const triggerBox = trigger.getBoundingClientRect()
    expect(triggerBox.width, 'a real painted trigger, not a collapsed stub').toBeGreaterThan(0)
    expect(triggerBox.height).toBeGreaterThan(0)

    trigger.click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    expect(field, 'the trigger swapped the label for a field').not.toBeNull()
    await field.updateComplete

    expect(field.value, 'pre-filled with the name being changed').toBe('Seeded item')
    expect(row(section).querySelector('[data-part="entry-label"]'), 'the label span yielded its place').toBeNull()
    expect(field.getBoundingClientRect().width, 'a real typing target, not a zero-width sliver').toBeGreaterThan(0)
    expect(field.contains(document.activeElement), 'focus landed inside the field').toBe(true)

    // The whole rendered shape: left-to-right order intact, and NOTHING pushed out of the card by the
    // field's own 20ch floor (the reason entry-list.css repoints --ui-text-field-min-inline-size to 0).
    const geometry = headerGeometry(row(section))
    expect(geometry.map((g) => g.part)).toEqual(['entry-toggle', 'entry-rename-field', 'entry-spacer', 'entry-rename', 'entry-delete'])
    for (const [index, part] of geometry.entries()) {
      if (index === 0) continue
      expect(part.left, `${part.part} sits right of ${geometry[index - 1]!.part}`).toBeGreaterThanOrEqual(geometry[index - 1]!.left)
    }
    const rowRight = row(section).getBoundingClientRect().right
    for (const part of geometry) expect(part.right, `${part.part} stays inside the card`).toBeLessThanOrEqual(Math.ceil(rowRight))
  })

  it('a REAL Enter keystroke on the editor part commits the new name to the store — the id UNCHANGED', async () => {
    const store = seeded()
    const section = mount(store, { rename: true })
    ;(row(section).querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    await field.updateComplete
    field.value = 'Renamed item'
    // The real keyboard path (the agent-admin.browser.test.ts idiom): dispatch on the internal editor part,
    // so ui-text-field's OWN Enter-commit handler is what emits the `change` entry-list.ts listens for.
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    const stored = readEntries(store, KIND)
    expect(stored).toHaveLength(1)
    expect(stored[0]!.label, 'the display name changed').toBe('Renamed item')
    expect(stored[0]!.id, 'the id is untouched — everything resolving by id keeps working').toBe(SEED.id)
    expect(stored[0]!.content, 'and nothing else moved').toBe(SEED.content)

    // The re-rendered row shows it, back as a plain label span (the field swapped out).
    expect((row(section).querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Renamed item')
    expect(row(section).querySelector('[data-part="entry-rename-field"]')).toBeNull()
    expect(row(section).getAttribute('data-entry-id')).toBe(SEED.id)
  })

  it('Escape CANCELS — the stored name is untouched and the label span comes back', async () => {
    const store = seeded()
    const section = mount(store, { rename: true })
    ;(row(section).querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    await field.updateComplete
    field.value = 'Never committed'
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(readEntries(store, KIND)[0]!.label, 'nothing was written').toBe('Seeded item')
    expect(row(section).querySelector('[data-part="entry-rename-field"]'), 'the field closed').toBeNull()
    expect((row(section).querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Seeded item')
  })

  it('an EMPTY rename is a visible refusal: nothing written, the stored name back on screen', async () => {
    const store = seeded()
    const section = mount(store, { rename: true })
    ;(row(section).querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    await field.updateComplete
    field.value = '   '
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    expect(readEntries(store, KIND)[0]!.label).toBe('Seeded item')
    expect(row(section).querySelector('[data-part="entry-rename-field"]')).toBeNull()
    expect((row(section).querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Seeded item')
  })

  // ── GH #848 × GH #850 — BOTH row affordances at once, the reconciliation's own proof ────────────────────
  // The two opt-ins landed from two lanes onto the SAME row. Per-feature tests each pass with the other
  // absent, so they cannot catch the pair breaking each other: the pill pushing Rename off the card, the
  // rename field displacing the pill, one control's commit re-render eating the other's state. Measured on
  // one real row with both flags on.

  it('both opt-ins on ONE row: the ruled order paints left-to-right, every part inside the card, at real size', () => {
    const section = mount(seeded(), { rename: true, availabilityToggle: true })
    const parts = headerGeometry(row(section))
    expect(parts.map((p) => p.part), 'the ruled order: state, then the action pair, destructive last').toEqual([
      'entry-toggle',
      'entry-label',
      'entry-spacer',
      'entry-availability',
      'entry-rename',
      'entry-delete',
    ])
    // GH #865 — `entry-header`'s own `flex-wrap` fallback means DOM order is READING order (top-to-bottom,
    // left-to-right WITHIN a line), not always strict single-line left-to-right: at this file's own default
    // 414px mobile-sized test viewport (vitest.browser.config.ts), this exact both-opt-ins row sits at the
    // genuine edge of one line's worth of room — the correct, deliberate outcome is Remove wrapping to its
    // own line rather than the pre-fix behaviour of silently compressing it a few px below its real content
    // width (a latent, invisible near-clip this ticket's `flex-shrink: 0` rule now forecloses on purpose).
    // A part on a LATER line never sits above an earlier one (centerY is non-decreasing in DOM order);
    // WITHIN the same line (centerY within 4px — `align-items: center` puts parts of different heights, e.g.
    // the empty spacer vs. the 28px pill, at different TOPS but the same CENTER), left-to-right still holds.
    for (const [index, part] of parts.entries()) {
      if (index === 0) continue
      const prev = parts[index - 1]!
      const sameLine = Math.abs(part.centerY - prev.centerY) <= 4
      if (sameLine) {
        expect(part.left, `${part.part} sits right of ${prev.part} (same line)`).toBeGreaterThanOrEqual(prev.left)
      } else {
        expect(part.centerY, `${part.part} sits on a LOWER line than ${prev.part} (wrapped), never higher`).toBeGreaterThan(prev.centerY)
      }
    }
    const cardBox = row(section).getBoundingClientRect()
    for (const part of parts) {
      expect(part.left, `${part.part} stays inside the card (left)`).toBeGreaterThanOrEqual(Math.floor(cardBox.left))
      expect(part.right, `${part.part} stays inside the card (right)`).toBeLessThanOrEqual(Math.ceil(cardBox.right))
    }
    // Both controls are really hittable, not one squeezed to nothing by the other.
    for (const part of ['entry-availability', 'entry-rename']) {
      const box = (row(section).querySelector(`[data-part="${part}"]`) as HTMLElement).getBoundingClientRect()
      expect(box.height, `${part} has a real control box`).toBeGreaterThan(16)
      expect(box.width).toBeGreaterThan(40)
    }
  })

  it('both opt-ins on ONE row: an OPEN rename field coexists with the mode pill — nothing pushed out of the card', async () => {
    const section = mount(seeded(), { rename: true, availabilityToggle: true })
    ;(row(section).querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    await field.updateComplete

    const parts = headerGeometry(row(section))
    expect(parts.map((p) => p.part), 'the field took the LABEL\'s place; the pill and both buttons stay put').toEqual([
      'entry-toggle',
      'entry-rename-field',
      'entry-spacer',
      'entry-availability',
      'entry-rename',
      'entry-delete',
    ])
    const rowRight = row(section).getBoundingClientRect().right
    for (const part of parts) expect(part.right, `${part.part} stays inside the card while renaming`).toBeLessThanOrEqual(Math.ceil(rowRight))
    expect(field.getBoundingClientRect().width, 'and the field is still a real typing target').toBeGreaterThan(0)
  })

  it('both opt-ins on ONE row: rename an INVOCABLE entry — the new name lands, the mode and its marker survive', async () => {
    const store = createMemoryStore({
      initial: { [entriesStoreKey(KIND)]: [{ ...SEED, availability: ENTRY_AVAILABILITY.invocable }] satisfies Entry[] },
    })
    const section = mount(store, { rename: true, availabilityToggle: true })
    expect(row(section).getAttribute('data-availability'), 'marked before the rename').toBe('invocable')

    ;(row(section).querySelector('[data-part="entry-rename"]') as HTMLElement).click()
    const field = row(section).querySelector('[data-part="entry-rename-field"]') as UITextFieldElement
    await field.updateComplete
    field.value = 'Renamed while invocable'
    ;(field.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    const stored = readEntries(store, KIND)[0]!
    expect(stored.label).toBe('Renamed while invocable')
    expect(stored.availability, 'the rename carried the mode through (renameEntry spreads it)').toBe(ENTRY_AVAILABILITY.invocable)
    // …and the re-rendered row still SHOWS the mode: the marker attribute and the pressed pill both.
    const after = row(section)
    expect(after.getAttribute('data-availability'), 'still marked after the rename').toBe('invocable')
    expect((after.querySelector('[data-part="entry-availability"]') as HTMLElement & { pressed: boolean }).pressed).toBe(true)
    expect((after.querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Renamed while invocable')
  })

  it('both opt-ins on ONE row: pressing the mode pill keeps a RENAMED label (the other direction)', () => {
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [{ ...SEED, label: 'Custom name' }] satisfies Entry[] } })
    const section = mount(store, { rename: true, availabilityToggle: true })
    ;(row(section).querySelector('[data-part="entry-availability"]') as HTMLElement).click()

    const stored = readEntries(store, KIND)[0]!
    expect(stored.availability).toBe(ENTRY_AVAILABILITY.invocable)
    expect(stored.label, 'the mode write left the display name alone').toBe('Custom name')
    expect((row(section).querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Custom name')
  })
})

// ── GH #865 — the row's affordances fit the CARD at the settings pane's real narrow width ─────────────────
// The pane floor is measured, not guessed: `super-shell.css`'s `--ui-super-shell-pane-min-size` (20rem,
// agent-admin.css's repoint) is a real drag-clamp (`super-shell.ts`'s `paneMin`, `super-shell.md` — "the pane
// never shrinks below" it) — 320px. `ui-settings`' own `[data-part='panel']` padding
// (`--ui-settings-panel-pad` = `--md-sys-space-lg` = 16px/side) and the composed `ui-disclosure`'s body
// padding (`--ui-disclosure-body-pad-inline` = `--md-sys-space-md` = 12px/side) are the two ancestors between
// that pane and this section (`agent-admin.ts`'s `settingsItem` → `foldItem`, a `ui-disclosure`) — 320 − 32 −
// 24 = 264px is what a real Tools-panel row gets at the floor, verbatim what this wrapper reproduces; this
// module's own `--ui-entry-list-card-pad` (12px/side) then narrows the header row itself to ~238px, exactly
// as measured below.
describe('mountEntryList — GH #865: affordances fit the card at the settings pane\'s real narrow floor', () => {
  /** Reproduces the ONE fixed width a real Tools-panel row receives at the pane's measured floor (see the
   *  block comment above) — the section mounts inside it exactly as `agent-admin.ts` hands it a pane-width
   *  ancestor, never document.body's unconstrained width the rest of this file's tests use. */
  function mountNarrow(label: string): { host: HTMLElement; card: HTMLElement } {
    const wrapper = document.createElement('div')
    wrapper.style.inlineSize = '264px' // the measured pane-floor content width (see above)
    wrapper.style.boxSizing = 'border-box'
    document.body.append(wrapper)
    mounted.push(wrapper)
    const store = createMemoryStore({ initial: { [entriesStoreKey(KIND)]: [{ ...SEED, label }] satisfies Entry[] } })
    const section = mountEntryList(
      KIND,
      'Add item',
      {
        onToggle: (id, enabled) => store.set(entriesStoreKey(KIND), readEntries(store, KIND).map((e) => (e.id === id ? { ...e, enabled } : e))),
        onContentChange: (id, content) => store.set(entriesStoreKey(KIND), readEntries(store, KIND).map((e) => (e.id === id ? { ...e, content } : e))),
        onDelete: (id) => store.set(entriesStoreKey(KIND), readEntries(store, KIND).filter((e) => e.id !== id)),
        onAdd: () => true,
        onAvailabilityChange: (id, availability) =>
          store.set(entriesStoreKey(KIND), readEntries(store, KIND).map((e) => (e.id === id ? { ...e, availability } : e))),
        onRename: (id, renamed) => store.set(entriesStoreKey(KIND), renameEntry(readEntries(store, KIND), id, renamed)),
      },
      { rename: true, availabilityToggle: true },
    )
    wrapper.append(section.host)
    mounted.push(section.host)
    section.render(readEntries(store, KIND))
    return { host: section.host, card: section.host.querySelector('[data-part="entry"]') as HTMLElement }
  }

  /** The test-the-whole-shape assertion (not a per-part probe): every header part's WHOLE painted box —
   *  every side, not just "does it exist" — stays inside the card's own bounding box. A part that wrapped to
   *  a second (or third) line must still land inside the SAME card, never spill past its right/left/bottom
   *  edge — the exact failure mode the screenshot showed (the pill "torn at the boundary"). */
  function assertNothingEscapesTheCard(card: HTMLElement): void {
    const cardBox = card.getBoundingClientRect()
    const parts = ['entry-toggle', 'entry-label', 'entry-rename-field', 'entry-spacer', 'entry-availability', 'entry-rename', 'entry-delete']
    let sawAnyPart = false
    for (const part of parts) {
      const el = card.querySelector(`[data-part="${part}"]`) as HTMLElement | null
      if (el === null) continue
      sawAnyPart = true
      const box = el.getBoundingClientRect()
      expect(box.left, `${part} stays at/right of the card's left edge`).toBeGreaterThanOrEqual(Math.floor(cardBox.left))
      expect(box.right, `${part} stays at/left of the card's right edge`).toBeLessThanOrEqual(Math.ceil(cardBox.right))
      expect(box.top, `${part} stays at/below the card's top edge`).toBeGreaterThanOrEqual(Math.floor(cardBox.top))
      expect(box.bottom, `${part} stays at/above the card's bottom edge`).toBeLessThanOrEqual(Math.ceil(cardBox.bottom))
    }
    expect(sawAnyPart, 'the probe actually found real parts to check (not vacuously true)').toBe(true)
  }

  it('a TYPICAL short label: the trailing cluster wraps to its own line, nothing escapes the card', () => {
    const { card } = mountNarrow('Weather')
    assertNothingEscapesTheCard(card)
    // The clean 2-line outcome measured for a realistic label: switch+label+spacer share line one (the
    // label painted at its full natural width — no truncation was even needed once the cluster wrapped),
    // Rename+Remove share a second line below it (a REAL wrap, not a lucky single-line fit).
    const toggleTop = (card.querySelector('[data-part="entry-toggle"]') as HTMLElement).getBoundingClientRect().top
    const deleteTop = (card.querySelector('[data-part="entry-delete"]') as HTMLElement).getBoundingClientRect().top
    expect(deleteTop, 'Remove landed on a LOWER line than the switch — the row actually wrapped').toBeGreaterThan(toggleTop)
    expect((card.querySelector('[data-part="entry-label"]') as HTMLElement).textContent).toBe('Weather')
  })

  it('a LONG compound label: still truncates/wraps to fit — nothing escapes the card, and the full name survives on `title`', () => {
    const LONG = 'Weather / Open-Meteo'
    const { card } = mountNarrow(LONG)
    assertNothingEscapesTheCard(card)
    const label = card.querySelector('[data-part="entry-label"]') as HTMLElement
    // The unconditional title mirror (GH #865): the FULL name is always a hover away, however the visible
    // text is laid out (this card's own width leaves enough room for it to render unclipped in full here —
    // the title mirror is unconditional specifically so a narrower real-world pane, or a longer real-world
    // name, never depends on that).
    expect(label.title).toBe(LONG)
  })

  it('the fixed affordances never shrink — Invocable/Rename/Remove all measure their real, unclipped width', () => {
    const { card } = mountNarrow('Weather')
    for (const part of ['entry-availability', 'entry-rename', 'entry-delete']) {
      const box = (card.querySelector(`[data-part="${part}"]`) as HTMLElement).getBoundingClientRect()
      expect(box.width, `${part} is a real, unshrunk control`).toBeGreaterThan(40)
      expect(box.height, `${part} is a real, unshrunk control`).toBeGreaterThan(16)
    }
  })
})
