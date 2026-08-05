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
