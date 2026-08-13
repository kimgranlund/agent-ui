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
import { validateNewEntry, readEntries, entriesStoreKey, type Entry } from './entry-data.ts'
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
function mount(store: SettingsStore): EntryListSection {
  let section!: EntryListSection
  section = mountEntryList(KIND, 'Add item', {
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
  })
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
