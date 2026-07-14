import { describe, it, expect, afterEach } from 'vitest'
import { UIAgentAdminElement } from './agent-admin.ts'
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
import { defaultAgentConfigSchema, SUPPORTED_MODELS, DEFAULT_MODEL_ID } from './agent-admin-schema.ts'
import { ENTRY_KINDS, entriesStoreKey, initialEntryValues, readEntries, composeSystemPrompt, DEFAULT_SYSTEM_PROMPT_FALLBACK, type Entry } from './entries.ts'
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

// jsdom probes for ui-agent-admin (TKT-0039, ADR-0131/ADR-0132). jsdom cannot resolve CSS Grid/flex
// layout — the actual visual 3-pane geometry is agent-admin.browser.test.ts's job (the master-detail.test.ts
// / master-detail.browser.test.ts split, mirrored). This file proves: the connect-time composition (one
// ui-split hosting three panes, the settings pane composing the Agent config + four capability
// entry-lists, the prompts pane composing the prompt-section entry-list), the generic entry-list
// primitive's own behavior (toggle/edit/delete/add, fail-closed validation, built-in non-deletability),
// the composed-prompt + enabled-capabilities live-apply wiring, persistence across a real reload,
// reconnect idempotence, and the descriptor's structural + contract↔props + contract↔source trip-wires.

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

describe('UIAgentAdminElement — upgrade + defaults', () => {
  it('upgrades to the class; schema/store both start undefined pre-connect (the ui-settings precedent)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    expect(el).toBeInstanceOf(UIAgentAdminElement)
    expect(el.schema).toBeUndefined()
    expect(el.store).toBeUndefined()
  })

  it('static props is exactly [schema, store]', () => {
    expect(Object.keys(UIAgentAdminElement.props)).toEqual(['schema', 'store'])
  })

  it('connecting lazily assigns the real default schema + a real, persisted store seeded for BOTH the flat Agent config and every entry-list kind', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(el.schema).toBe(defaultAgentConfigSchema)
    expect(el.store).toBeDefined()
    expect(el.store?.get('nonexistent-key')).toBeUndefined() // a real SettingsStore.get, not a stub
  })
})

describe('UIAgentAdminElement — real models + real seeded content (TKT-0043)', () => {
  it("the model field's options are real named models, not the old default/fast/careful tiers", () => {
    const modelField = defaultAgentConfigSchema.sections[0].fields.find((f) => f.key === 'model')
    expect(modelField?.options?.map((o) => o.value)).toEqual(SUPPORTED_MODELS.map((m) => m.id))
    expect(modelField?.options?.map((o) => o.value)).not.toContain('default')
    expect(modelField?.options?.map((o) => o.value)).not.toContain('fast')
    expect(modelField?.default).toBe(DEFAULT_MODEL_ID)
  })

  it('selecting a model and submitting cites its display LABEL, not its raw id, in the next stub reply', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const target = SUPPORTED_MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    const field = el.querySelector('[data-role="canvas"] [data-part="field"]') as HTMLElement & { value: string }
    const form = el.querySelector('[data-role="canvas"] [data-part="composer"]') as HTMLFormElement
    field.value = 'ping'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
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

describe('UIAgentAdminElement — composition (ADR-0131 cl.2 three panes; ADR-0132 five entry-list instantiations)', () => {
  it('builds one ui-split with three ui-split-pane children: canvas, prompts, settings', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const split = el.querySelector(':scope > ui-split')
    expect(split).not.toBeNull()
    const panes = [...split!.querySelectorAll(':scope > ui-split-pane')]
    expect(panes.map((p) => p.getAttribute('data-role'))).toEqual(['canvas', 'prompts', 'settings'])
  })

  it('the canvas pane composes a real ui-conversation', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const canvasPane = el.querySelector('[data-role="canvas"]')
    expect(canvasPane?.querySelector('ui-conversation')).toBeInstanceOf(UIConversationElement)
  })

  it('the prompts pane composes ONE entry-section, kind=prompt-section', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const promptsPane = el.querySelector('[data-role="prompts"]')
    const section = promptsPane?.querySelector('[data-part="entry-section"]')
    expect(section?.getAttribute('data-kind')).toBe(ENTRY_KINDS.promptSection)
  })

  it('the settings pane composes the Agent config (real ui-settings, wired to schema/store) PLUS four capability entry-sections', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settingsPane = el.querySelector('[data-role="settings"]') as HTMLElement
    const settingsEl = settingsPane.querySelector('ui-settings') as UISettingsElement
    expect(settingsEl).toBeInstanceOf(UISettingsElement)
    expect(settingsEl.schema).toBe(el.schema)
    expect(settingsEl.store).toBe(el.store)

    const sections = [...settingsPane.querySelectorAll('[data-part="entry-section"]')]
    expect(sections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
    ])
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
    ;(section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = 'Web search'
    ;(section.querySelector('[data-part="entry-add-description"]') as HTMLInputElement).value = 'Searches the web'
    ;(section.querySelector('[data-part="entry-add-content"]') as HTMLTextAreaElement).value = 'search(query)'
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    const stored = readEntries(el.store, ENTRY_KINDS.skill)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: 'web-search', label: 'Web search', enabled: true, builtin: false })
    const reRenderedSection = el.querySelector('[data-kind="skill"]') as HTMLElement
    expect((reRenderedSection.querySelector('[data-part="entry-add-form"]') as HTMLElement).hidden).toBe(true)
  })

  it('an empty name is rejected — fail-closed, nothing added, an error note shown', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="tool"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    expect(readEntries(el.store, ENTRY_KINDS.tool)).toHaveLength(0)
    const error = section.querySelector('[data-part="entry-add-error"]') as HTMLElement
    expect(error.hidden).toBe(false)
    expect(error.textContent).toMatch(/name/i)
  })

  it('a REJECTED submit keeps the form open AND the typed description/content — never silently discarded (component-reviewer MAJOR fix)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="tool"]') as HTMLElement
    const descriptionField = section.querySelector('[data-part="entry-add-description"]') as HTMLInputElement
    const contentField = section.querySelector('[data-part="entry-add-content"]') as HTMLTextAreaElement
    descriptionField.value = 'A description worth keeping'
    contentField.value = 'Content worth keeping'
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement
    expect(form.hidden).toBe(false) // stays open — a rejection is not a reset
    expect(descriptionField.value).toBe('A description worth keeping')
    expect(contentField.value).toBe('Content worth keeping')
  })

  it('a duplicate label gets a suffixed id, not a rejection', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="workflow"]') as HTMLElement
    const addOnce = (label: string): void => {
      ;(section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = label
      ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    }
    addOnce('Deploy')
    addOnce('Deploy')
    const stored = readEntries(el.store, ENTRY_KINDS.workflow)
    expect(stored.map((e) => e.id)).toEqual(['deploy', 'deploy-2'])
  })

  it('a custom entry CAN be deleted (unlike a built-in)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const section = el.querySelector('[data-kind="resource"]') as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = 'Docs site'
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
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
    ;(skillSection.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = 'Persisted skill'
    ;(skillSection.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    first.remove()
    mounted.length = 0

    const second = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    expect(contentFieldOf(entryEl(second, ENTRY_KINDS.promptSection, 'foundation')).value).toBe('Survives a reload.')
    expect(readEntries(second.store, ENTRY_KINDS.skill).map((e) => e.label)).toEqual(['Persisted skill'])
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
    const field = el.querySelector('[data-role="canvas"] [data-part="field"]') as HTMLElement & { value: string }
    const form = el.querySelector('[data-role="canvas"] [data-part="composer"]') as HTMLFormElement
    field.value = text
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  function lastAgentBody(el: UIAgentAdminElement): string {
    const bubbles = [...el.querySelectorAll('[data-role="agent"]')]
    const last = bubbles[bubbles.length - 1]
    return (last?.querySelector('[data-part="body"]') as HTMLElement)?.textContent ?? ''
  }

  function addEntry(el: UIAgentAdminElement, kind: string, label: string): void {
    const section = el.querySelector(`[data-kind="${kind}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = label
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
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
    ;(section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement).value = 'No-subscribe skill'
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    const row = el.querySelector('[data-kind="skill"] [data-entry-id="no-subscribe-skill"]')
    expect(row, 'the fallback direct-render must have fired since no subscribe() could').not.toBeNull()
  })
})

describe('UIAgentAdminElement — composition survives a RECONNECT (the master-detail.ts/settings.ts precedent)', () => {
  it('re-parenting a connected instance leaves EXACTLY ONE ui-split — no duplicate composition', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el) // detach + reattach — connectedCallback fires again
    expect(el.querySelectorAll(':scope > ui-split').length).toBe(1)
    expect(el.querySelectorAll('[data-role="canvas"]').length).toBe(1)
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

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/agent-admin`
const agentAdminTs = readFileSync(`${DIR}/agent-admin.ts`, 'utf8') as string
const agentAdminCss = readFileSync(`${DIR}/agent-admin.css`, 'utf8') as string

describe('agent-admin.md descriptor (ui-agent-admin)', () => {
  const md = readFileSync(`${DIR}/agent-admin.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['schema', 'store']

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
