import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
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

// TKT-0085 — the responsive-shell breakpoint watcher. jsdom carries no real ResizeObserver, so
// `connected()` falls back to unconditionally applying 'wide' (every OTHER describe block in this file
// relies on that fallback for the pre-TKT-0085 3-pane shape). This stub restores an OBSERVABLE,
// MANUALLY-DRIVEN ResizeObserver so `#applyLayout` can be exercised through its real public entry point
// (a resize notification) rather than reaching into the private method — the same "test through the
// real API" discipline the rest of this file follows. The actual painted CSS (@scope, [hidden]
// specificity, real box geometry) is agent-admin.browser.test.ts's job; this file proves the DOM
// RESTRUCTURING (which pane/tab-panel each content unit ends up in) is correct at each of the three
// bands, and that content nodes are MOVED, never rebuilt, across a round trip.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  #callback: ResizeObserverCallback
  target: Element | null = null
  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
    FakeResizeObserver.instances.push(this)
  }
  observe(el: Element): void {
    this.target = el
  }
  unobserve(): void {
    this.target = null
  }
  disconnect(): void {
    this.target = null
  }
  /** Synthesize a resize notification carrying `width` as `contentRect.width` — the one field
   *  `agent-admin.ts`'s observer callback reads. */
  trigger(width: number): void {
    this.#callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

describe('UIAgentAdminElement — responsive shell (TKT-0085): wide / medium / narrow', () => {
  let realResizeObserver: typeof ResizeObserver | undefined
  beforeAll(() => {
    realResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
  })
  afterAll(() => {
    globalThis.ResizeObserver = realResizeObserver as typeof ResizeObserver
  })
  afterEach(() => {
    FakeResizeObserver.instances = []
  })

  function mountAndResize(width: number): { el: UIAgentAdminElement; ro: FakeResizeObserver } {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const ro = FakeResizeObserver.instances.at(-1) as FakeResizeObserver
    ro.trigger(width)
    return { el, ro }
  }

  it('connected() observes itself via ResizeObserver, disconnected() disconnects it', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const ro = FakeResizeObserver.instances.at(-1) as FakeResizeObserver
    expect(ro.target).toBe(el)
    el.remove()
    expect(ro.target).toBeNull()
  })

  it('wide (≥1024px): the 3-pane split shows, the narrow all-tabs shell stays hidden', () => {
    const { el } = mountAndResize(1200)
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    expect(split.hidden).toBe(false)
    const paneRoles = [...split.children].filter((c) => c.tagName === 'UI-SPLIT-PANE').map((c) => c.getAttribute('data-role'))
    expect(paneRoles).toEqual(['canvas', 'prompts', 'settings'])
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    expect(narrowTabs.hidden).toBe(true)
    expect(el.querySelector('[data-role="canvas"] ui-conversation')).not.toBeNull()
    expect(el.querySelector('[data-role="prompts"] [data-part="entry-section-heading"]')).not.toBeNull()
    expect(el.querySelector('[data-role="settings"] [data-part="agent-heading"]')).not.toBeNull()
  })

  it('medium (640–1023px): [ Chat | {Instructions, Agent} tabs ] — canvas pane + ONE tabs-medium pane', () => {
    const { el } = mountAndResize(800)
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    expect(split.hidden).toBe(false)
    const paneRoles = [...split.children].filter((c) => c.tagName === 'UI-SPLIT-PANE').map((c) => c.getAttribute('data-role'))
    expect(paneRoles).toEqual(['canvas', 'tabs-medium'])
    expect(el.querySelector('[data-role="canvas"] ui-conversation')).not.toBeNull()
    const tabsMediumPane = el.querySelector('[data-role="tabs-medium"]') as HTMLElement
    const tabLabels = [...tabsMediumPane.querySelectorAll('ui-tab')].map((t) => t.textContent)
    expect(tabLabels).toEqual(['Instructions', 'Agent'])
    // Both panels' real content live inside this ONE tabs-medium pane (panel visibility is a CSS/ui-tabs
    // concern, not a DOM-presence one — both panels stay in the DOM, only the inactive one is [hidden]).
    expect(tabsMediumPane.querySelector('[data-part="entry-section-heading"]')).not.toBeNull()
    expect(tabsMediumPane.querySelector('[data-part="agent-heading"]')).not.toBeNull()
  })

  it('narrow (<640px): {Chat, Instructions, Agent} tabs — the split is hidden and empty', () => {
    const { el } = mountAndResize(500)
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    expect(split.hidden).toBe(true)
    expect([...split.children].filter((c) => c.tagName === 'UI-SPLIT-PANE')).toHaveLength(0)
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    expect(narrowTabs.hidden).toBe(false)
    const tabLabels = [...narrowTabs.querySelectorAll('ui-tab')].map((t) => t.textContent)
    expect(tabLabels).toEqual(['Chat', 'Instructions', 'Agent'])
    expect(narrowTabs.querySelector('ui-conversation')).not.toBeNull()
    expect(narrowTabs.querySelector('[data-part="entry-section-heading"]')).not.toBeNull()
    expect(narrowTabs.querySelector('[data-part="agent-heading"]')).not.toBeNull()
  })

  it('content nodes are MOVED (same identity), never rebuilt, across a wide → narrow → wide round trip', () => {
    const { el, ro } = mountAndResize(1200)
    const conversation = el.querySelector('ui-conversation')
    const settingsHeading = el.querySelector('[data-part="agent-heading"]')
    const instructionsHeading = el.querySelector('[data-part="entry-section-heading"]')

    ro.trigger(500) // -> narrow
    expect(el.querySelector('ui-conversation')).toBe(conversation)
    expect(el.querySelector('[data-part="agent-heading"]')).toBe(settingsHeading)
    expect(el.querySelector('[data-part="entry-section-heading"]')).toBe(instructionsHeading)

    ro.trigger(1200) // -> back to wide
    expect(el.querySelector('ui-conversation')).toBe(conversation)
    expect(el.querySelector('[data-part="agent-heading"]')).toBe(settingsHeading)
    expect(el.querySelector('[data-part="entry-section-heading"]')).toBe(instructionsHeading)
    // Landed back in the ORIGINAL wide-shell panes, not left behind in a detached tab shell.
    expect(el.querySelector('[data-role="canvas"] ui-conversation')).toBe(conversation)
    expect(el.querySelector('[data-role="settings"] [data-part="agent-heading"]')).toBe(settingsHeading)
  })

  it('is idempotent — re-triggering a resize WITHIN the same band does not rebuild the shell', () => {
    const { el, ro } = mountAndResize(1200)
    const split = el.querySelector(':scope > ui-split') as HTMLElement
    ro.trigger(1100) // still wide (≥1024) — a different width, same band
    expect(el.querySelector(':scope > ui-split')).toBe(split) // same node — #applyLayout no-op'd
  })

  it('pane order stays correct (left-to-right) across a long chain of back-and-forth crossings', () => {
    const { el, ro } = mountAndResize(1200) // wide
    const paneRoles = () =>
      [...(el.querySelector(':scope > ui-split') as HTMLElement).children]
        .filter((c) => c.tagName === 'UI-SPLIT-PANE')
        .map((c) => c.getAttribute('data-role'))

    ro.trigger(800) // -> medium
    expect(paneRoles()).toEqual(['canvas', 'tabs-medium'])
    ro.trigger(1200) // -> wide
    expect(paneRoles()).toEqual(['canvas', 'prompts', 'settings'])
    ro.trigger(500) // -> narrow
    expect(paneRoles()).toEqual([])
    ro.trigger(800) // -> medium
    expect(paneRoles()).toEqual(['canvas', 'tabs-medium'])
    ro.trigger(1200) // -> wide
    expect(paneRoles()).toEqual(['canvas', 'prompts', 'settings'])

    // Content stays reachable at real DOM locations after the whole chain — not just structurally present.
    expect(el.querySelector('[data-role="canvas"] ui-conversation')).not.toBeNull()
    expect(el.querySelector('[data-role="prompts"] [data-part="entry-section-heading"]')).not.toBeNull()
    expect(el.querySelector('[data-role="settings"] [data-part="agent-heading"]')).not.toBeNull()
  })

  it('capability sections (Skills/Workflows/Resources/Tools) travel with the Agent content unit at every band', () => {
    const { el } = mountAndResize(500) // narrow — the smallest content-unit-grouping test
    const narrowTabs = el.querySelector(':scope > ui-tabs') as HTMLElement
    const agentPanel = [...narrowTabs.querySelectorAll('ui-tab-panel')][2] as HTMLElement
    for (const label of ['Skills', 'Workflows', 'Resources', 'Tools']) {
      expect([...agentPanel.querySelectorAll('[data-part="entry-section-heading"]')].some((h) => h.textContent === label), `missing ${label} section`).toBe(true)
    }
  })
})

describe('UIAgentAdminElement — upgrade + defaults', () => {
  it('upgrades to the class; schema/store both start undefined pre-connect (the ui-settings precedent)', () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    expect(el).toBeInstanceOf(UIAgentAdminElement)
    expect(el.schema).toBeUndefined()
    expect(el.store).toBeUndefined()
  })

  it('static props is exactly [schema, store, agentTurn, agentSurfaceTurn, libraries]', () => {
    expect(Object.keys(UIAgentAdminElement.props)).toEqual(['schema', 'store', 'agentTurn', 'agentSurfaceTurn', 'libraries'])
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
    const composer = el.querySelector('[data-role="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
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

describe('UIAgentAdminElement — composition (ADR-0131 cl.2 three panes; ADR-0132 five entry-list instantiations)', () => {
  it('builds one ui-split with three ui-split-pane children: canvas, prompts, settings', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const split = el.querySelector(':scope > ui-split')
    expect(split).not.toBeNull()
    const panes = [...split!.querySelectorAll(':scope > ui-split-pane')]
    expect(panes.map((p) => p.getAttribute('data-role'))).toEqual(['canvas', 'prompts', 'settings'])
  })

  it('TKT-0045: the three panes\' real content-floor `min`s sum (+ frame chrome) to the docs demo frame\'s stated minimum', () => {
    // Coherence guard (component-reviewer M1 fix): site/pages/agent-admin.css's `.agent-admin-resize`
    // hardcodes `min-inline-size: 48rem` as "the sum of the three panes' own `min` ... plus chrome" — a
    // claim nothing else checks. If a pane's `min` here drifts without a matching frame-floor update (or
    // vice versa), the docs demo silently regresses to the exact TKT-0045 clipping bug. This test is the
    // gate: it re-derives the expected frame floor from the LIVE pane `min` attributes rather than from a
    // second hardcoded copy of 16/10/20, so only the frame's own constant (asserted at the bottom) can
    // drift out of sync.
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const panes = [...el.querySelectorAll(':scope > ui-split > ui-split-pane')]
    const paneMinsRem = panes.map((p) => {
      const min = p.getAttribute('min') ?? ''
      const match = /^([\d.]+)rem$/.exec(min)
      expect(match, `pane min "${min}" must be an explicit rem value`).not.toBeNull()
      return Number.parseFloat(match![1]!)
    })
    const paneMinsSum = paneMinsRem.reduce((sum, n) => sum + n, 0)
    // Divider (2 × 1px) + .agent-admin-resize padding (2 × 0.5rem) + its border (2 × 1px) + .agent-admin-demo
    // border (2 × 1px) — site/pages/agent-admin.css's own chrome constants, restated here as the ONE other
    // place this arithmetic lives (matching that file's own comment).
    const chromeRem = 2 / 16 + 1 + 2 / 16 + 2 / 16
    const expectedFloorRem = Math.ceil(paneMinsSum + chromeRem)
    expect(expectedFloorRem).toBeLessThanOrEqual(48) // the frame's actual stated floor must cover the real need
    expect(paneMinsSum).toBe(46) // 16 + 10 + 20 — pins the THREE pane mins together as one changeset
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
    const composer = el.querySelector('[data-role="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
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
    const composer = el.querySelector('[data-role="canvas"] ui-conversation-composer') as HTMLElement & { value: string }
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
    expect(conversation.models).toEqual(SUPPORTED_MODELS)
    expect(conversation.model).toBe(DEFAULT_MODEL_ID)

    // An EXTERNAL store write (another tab, the settings pane's own field) feeds back into `conversation.model`.
    const target = SUPPORTED_MODELS.find((m) => m.id !== DEFAULT_MODEL_ID)!
    el.store!.set('model', target.id)
    await whenFlushed()
    expect(conversation.model).toBe(target.id)

    // Committing a Models picker choice writes the SAME store key — never a second, parallel selection.
    const other = SUPPORTED_MODELS.find((m) => m.id !== target.id)!
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

  it('toolsEnabled gates the Tools projection: a Tool entry only reaches `system` when the master switch is on', async () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    addEntry(el, ENTRY_KINDS.tool, 'Calculator')
    const runner = recordingRunner('ok')
    el.agentTurn = runner.fn

    submit(el, 'one') // toolsEnabled default false
    await waitFor(() => runner.calls.length === 1, 'first call')
    expect(runner.calls[0]!.system).not.toContain('## Tools available to you')

    el.store!.set('toolsEnabled', true)
    submit(el, 'two')
    await waitFor(() => runner.calls.length === 2, 'second call')
    expect(runner.calls[1]!.system).toContain('## Tools available to you')
    expect(runner.calls[1]!.system).toContain('### Calculator')
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
    const composer = el.querySelector('[data-role="canvas"] ui-conversation-composer') as HTMLElement
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
  const ATTR_NAMES = ['schema', 'store', 'agentTurn', 'agentSurfaceTurn', 'libraries']

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
    el.store = createMemoryStore({ initial: { model: 'claude-fable-5' } })
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
    expect(req.model).toBe('claude-fable-5')
    expect(req.personaSystem.length).toBeGreaterThan(0)

    // The wire line mounted a REAL inline surface host; the note rendered at finalize.
    expect(el.querySelector('ui-surface-host')).not.toBeNull()
    const agentBody = el.querySelector('[data-part="bubble"][data-role="agent"] [data-part="body"]')
    expect(agentBody?.textContent).toBe('Dealt.')
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

// ── the model lists + admin-added models (Kim, 2026-07-19) ──────────────────────────────────────────────

describe('SUPPORTED_MODELS lists + the Haiku default (2026-07-19)', () => {
  it('the default model is Haiku; Sonnet remains an offered option', async () => {
    const { DEFAULT_MODEL_ID, SUPPORTED_MODELS } = await import('./agent-admin-schema.ts')
    expect(DEFAULT_MODEL_ID).toBe('claude-haiku-4-5-20251001')
    expect(SUPPORTED_MODELS.some((m) => m.id === 'claude-sonnet-5')).toBe(true)
    // every model carries a list assignment (the grouped-select contract)
    for (const m of SUPPORTED_MODELS) expect(m.group.length, m.id).toBeGreaterThan(0)
  })

  it('parseCustomModels: id|Label pairs, dedupe against built-ins and itself, malformed ⇒ dropped', async () => {
    const { parseCustomModels } = await import('./agent-admin-schema.ts')
    expect(parseCustomModels('claude-x, claude-y | My Y, claude-x, claude-sonnet-5, , |')).toEqual([
      { id: 'claude-x', label: 'claude-x', group: 'Additional' },
      { id: 'claude-y', label: 'My Y', group: 'Additional' },
    ])
    expect(parseCustomModels(undefined)).toEqual([])
    expect(parseCustomModels(42)).toEqual([])
    expect(parseCustomModels('   ')).toEqual([])
  })

  it('agentConfigSchema(custom) folds the Additional list into the model options + keeps the customModels field', async () => {
    const { agentConfigSchema, CUSTOM_MODELS_KEY } = await import('./agent-admin-schema.ts')
    const schema = agentConfigSchema([{ id: 'claude-x', label: 'X', group: 'Additional' }])
    const model = schema.sections[0]!.fields.find((f) => f.key === 'model')!
    expect(model.options!.some((o) => o.value === 'claude-x' && o.group === 'Additional')).toBe(true)
    expect(model.options!.some((o) => o.value === 'claude-haiku-4-5-20251001' && o.group === 'Fast')).toBe(true)
    expect(schema.sections[0]!.fields.some((f) => f.key === CUSTOM_MODELS_KEY)).toBe(true)
  })
})

describe('ui-agent-admin — admin-added models rebuild the schema reactively (2026-07-19)', () => {
  it('writing customModels to the store folds an Additional option into the rendered Model select', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    const store = createMemoryStore()
    el.store = store
    mount(el)
    await el.updateComplete
    expect(el.querySelector('[role="option"][value="claude-custom-1"]'), 'no custom option before the write').toBeNull()
    store.set('customModels', 'claude-custom-1 | Custom One')
    await el.updateComplete
    await whenFlushed()
    const custom = el.querySelector('[role="option"][value="claude-custom-1"]')
    expect(custom, 'the Additional option renders after the store write').not.toBeNull()
    const group = custom!.closest('[role="group"]')!
    expect(group, 'the option lives inside a group wrapper').not.toBeNull()
    // ui-select consumes the wrapper's `label` attribute into its rendered group-label header part
    expect(group.querySelector('[data-part="group-label"]')?.textContent).toBe('Additional')
    // the churn guard: an unrelated store write must not rebuild (same schema reference)
    const schemaBefore = el.schema
    store.set('name', 'Renamed')
    await el.updateComplete
    expect(el.schema).toBe(schemaBefore)
  })
})
