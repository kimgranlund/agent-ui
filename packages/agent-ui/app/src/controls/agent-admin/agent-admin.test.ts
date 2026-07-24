import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIAgentAdminElement } from './agent-admin.ts'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
import { defaultAgentConfigSchema, SUPPORTED_MODELS, DEFAULT_MODEL_ID, SURFACE_MARKDOWN_KEY, SURFACE_A2UI_KEY, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID, sanitizeCatalog } from './agent-admin-schema.ts'
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

// jsdom probes for ui-agent-admin (TKT-0039, ADR-0131/ADR-0132). jsdom cannot resolve CSS container-
// query/flex layout — the actual visual geometry is agent-admin.browser.test.ts's job (the
// master-detail.test.ts / master-detail.browser.test.ts split, mirrored). This file proves: the
// connect-time composition (GH #52/ADR-0154: ONE ui-chat-shell hosting content=conversation + an
// options-pane segmented into Settings/Context: System/Context: Dialog — the settings segment
// composing the Agent config + four capability entry-lists, the prompts pane composing the
// prompt-section entry-list), the generic entry-list primitive's own behavior (toggle/edit/delete/add,
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

// GH #52/ADR-0154 — the responsive shell is now ui-chat-shell/ui-super-shell's OWN grammar (SPEC-R6/
// R7): content=conversation, options-pane segments=Settings/Context:System/Context:Dialog, narrow-end
//="tabs" flattens them. TKT-0085's ResizeObserver-driven reparenting is GONE — there is no width
// threshold in this element anymore, and content is authored once, never moved. jsdom cannot resolve
// the real container query (super-shell.browser.test.ts's own precedent), but the segment/narrow-tab
// SWITCHING is pure JS/DOM behavior, independent of which band is actually painted — this file proves
// that DOM behavior; agent-admin.browser.test.ts proves the real cross-engine geometry/survival.
describe('UIAgentAdminElement — shell composition (GH #52/ADR-0154): segments + narrow-tabs', () => {
  it('composes ONE ui-chat-shell: content=conversation, options-pane segmented into Settings/Context: System/Context: Dialog', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const shell = el.querySelector(':scope > ui-chat-shell') as HTMLElement
    expect(shell).not.toBeNull()
    expect(shell.getAttribute('resizable-end')).toBe('')
    expect(shell.getAttribute('narrow-end')).toBe('tabs')
    expect(el.querySelector('[data-part="canvas"] ui-conversation')).not.toBeNull()
    const pane = el.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(pane.hasAttribute('data-segmented')).toBe(true)
    const segmentLabels = [...pane.querySelectorAll(':scope > [data-segment]')].map((s) => s.getAttribute('data-segment'))
    expect(segmentLabels).toEqual(['Settings', 'Context: System', 'Context: Dialog'])
  })

  it('the Settings segment carries the WHOLE config column; each Context segment carries ONLY its own accordion — no cross-segment leakage', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settings = el.querySelector('[data-segment="Settings"]') as HTMLElement
    const contextSystem = el.querySelector('[data-segment="Context: System"]') as HTMLElement
    const contextDialog = el.querySelector('[data-segment="Context: Dialog"]') as HTMLElement
    expect(settings.querySelector('[data-part="settings-item"][data-item="agent"]')).not.toBeNull()
    expect(settings.querySelector('[data-part="settings-item"] [data-part="entry-section"]')).not.toBeNull()
    expect(contextSystem.matches('[data-role="context-system-content"]')).toBe(true)
    expect(contextSystem.querySelector('[data-role="context-dialog-content"]')).toBeNull()
    expect(contextSystem.querySelector('[data-part="context-turns"]')).toBeNull()
    expect(contextDialog.matches('[data-role="context-dialog-content"]')).toBe(true)
    expect(contextDialog.querySelector('[data-role="context-system-content"]')).toBeNull()
    expect(contextDialog.querySelector('[data-part="context-system"]')).toBeNull()
  })

  it('clicking the pane-tabs strip switches which segment is [data-active] — never a reparent (SPEC-R7c)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const pane = el.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    const settings = pane.querySelector('[data-segment="Settings"]') as HTMLElement
    const contextSystem = pane.querySelector('[data-segment="Context: System"]') as HTMLElement
    expect(settings.hasAttribute('data-active')).toBe(true)
    const tabs = [...pane.querySelectorAll('[data-part="pane-tab"]')]
    expect(tabs.map((t) => t.textContent)).toEqual(['Settings', 'Context: System', 'Context: Dialog'])
    ;(tabs[1] as HTMLElement).click()
    expect(settings.hasAttribute('data-active')).toBe(false)
    expect(contextSystem.hasAttribute('data-active')).toBe(true)
    expect(settings.isConnected, 'switching segments never reparents').toBe(true)
  })

  it('the narrow-tabs strip flattens content + every segment into ONE top-level strip: Chat, Settings, Context: System, Context: Dialog', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(strip).not.toBeNull()
    const labels = [...strip.querySelectorAll('[data-part="narrow-tab"]')].map((t) => t.textContent)
    expect(labels).toEqual(['Chat', 'Settings', 'Context: System', 'Context: Dialog'])
  })

  it('clicking a narrow tab moves data-narrow-active to the addressed participant, syncing the wide segment strip too', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const canvasBox = el.querySelector('[data-part="canvas"]') as HTMLElement
    const pane = el.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(canvasBox.hasAttribute('data-narrow-active')).toBe(true)

    const narrowTabs = [...el.querySelectorAll('[data-part="narrow-tab"]')] as HTMLElement[]
    const contextSystemNarrowTab = narrowTabs.find((t) => t.textContent === 'Context: System')!
    contextSystemNarrowTab.click()
    expect(canvasBox.hasAttribute('data-narrow-active')).toBe(false)
    expect(pane.hasAttribute('data-narrow-active')).toBe(true)
    expect(pane.querySelector('[data-segment="Context: System"]')?.hasAttribute('data-active')).toBe(true)

    const chatNarrowTab = narrowTabs.find((t) => t.textContent === 'Chat')!
    chatNarrowTab.click()
    expect(canvasBox.hasAttribute('data-narrow-active')).toBe(true)
    expect(pane.hasAttribute('data-narrow-active')).toBe(false)
  })

  it('content nodes are the SAME identity across repeated segment/narrow-tab switches — nothing is ever rebuilt', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const conversation = el.querySelector('ui-conversation')
    const agentItem = el.querySelector('[data-part="settings-item"][data-item="agent"]')
    const instructionsSection = el.querySelector('[data-part="entry-section"]')

    const tabs = [...el.querySelectorAll('[data-part="narrow-tab"]')] as HTMLElement[]
    tabs.find((t) => t.textContent === 'Settings')!.click()
    tabs.find((t) => t.textContent === 'Context: System')!.click()
    tabs.find((t) => t.textContent === 'Chat')!.click()

    expect(el.querySelector('ui-conversation')).toBe(conversation)
    expect(el.querySelector('[data-part="settings-item"][data-item="agent"]')).toBe(agentItem)
    expect(el.querySelector('[data-part="entry-section"]')).toBe(instructionsSection)
  })

  it('capability sections (Skills/Workflows/Resources/Tools) live in the Settings segment', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settings = el.querySelector('[data-segment="Settings"]') as HTMLElement
    for (const label of ['Instructions', 'Skills', 'Workflows', 'Resources', 'Tools']) {
      expect([...settings.querySelectorAll('[data-part="settings-item"]')].some((h) => h.getAttribute('summary') === label), `missing ${label} section`).toBe(true)
    }
  })

  // ── GH #225 — the Settings sections are heading-row folds (the GH #222 Context pattern applied to
  // the config column). jsdom pins the STRUCTURE; agent-admin.browser.test.ts proves the real
  // fold/register/toggle-vs-fold geometry cross-engine. ──────────────────────────────────────────────
  it('GH #225: every Settings section is a settings-item fold — eight sections, in order, ALL open by default (config is an editing surface)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settings = el.querySelector('[data-segment="Settings"]') as HTMLElement
    const items = [...settings.querySelectorAll(':scope > [data-part="settings-item"]')]
    expect(items.map((i) => i.getAttribute('data-item'))).toEqual([
      'agent', 'model', ENTRY_KINDS.promptSection, 'surface',
      ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool,
    ])
    expect(items.map((i) => i.getAttribute('summary'))).toEqual([
      'Agent', 'Model', 'Instructions', 'Surface Options', 'Skills', 'Workflows', 'Resources', 'Tools',
    ])
    for (const item of items) expect(item.hasAttribute('open'), `${item.getAttribute('data-item')} defaults open`).toBe(true)
    // The section content is the fold's BODY (the disclosure adopted it — SPEC-R16 children=body).
    expect(settings.querySelector('[data-item="agent"] [data-part="body"] ui-settings')).not.toBeNull()
    expect(settings.querySelector('[data-item="model"] [data-part="body"] [data-part="model-grid"]')).not.toBeNull()
    expect(settings.querySelector('[data-item="surface"] [data-part="body"] [data-part="surface-options"]')).not.toBeNull()
    expect(settings.querySelector(`[data-item="${ENTRY_KINDS.skill}"] [data-part="body"] [data-part="entry-section"][data-kind="${ENTRY_KINDS.skill}"]`)).not.toBeNull()
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
  it('builds one ui-chat-shell with content=conversation and one segmented options-pane', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const shell = el.querySelector(':scope > ui-chat-shell')
    expect(shell).not.toBeNull()
    expect(shell?.querySelector('[data-part="canvas"] ui-conversation')).not.toBeNull()
    expect(shell?.querySelector('[data-slot-name="options-pane"][data-segmented]')).not.toBeNull()
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

  it('…and INTO the per-step source reveal (GH #240/ADR-0159 wave B — part 3 of the same ruling): conversation.sources is set, so each activity step reveals the wire line(s) behind it', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const conversation = el.querySelector('ui-conversation') as UIConversationElement
    expect(conversation.sources, 'the developer surface\'s standing opt-in — every other consumer stays default-off').toBe(true)
  })

  it('the Settings content composes the Agent config (real ui-settings, wired to schema/store) PLUS all FIVE entry-sections (prompts merged in, vision rev.5)', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const settingsContent = el.querySelector('[data-role="settings-content"]') as HTMLElement
    const settingsEl = settingsContent.querySelector('ui-settings') as UISettingsElement
    expect(settingsEl).toBeInstanceOf(UISettingsElement)
    expect(settingsEl.schema).toBe(el.schema)
    expect(settingsEl.store).toBe(el.store)

    const sections = [...settingsContent.querySelectorAll('[data-part="entry-section"]')]
    expect(sections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.promptSection,
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
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
    expect(items.map((i) => i.getAttribute('data-item'))).toEqual(['agent', ENTRY_KINDS.skill, ENTRY_KINDS.workflow, ENTRY_KINDS.resource, ENTRY_KINDS.tool])
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
  it('re-parenting a connected instance leaves EXACTLY ONE ui-chat-shell — no duplicate composition', () => {
    const el = mount(document.createElement('ui-agent-admin') as UIAgentAdminElement)
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    wrapper.append(el) // detach + reattach — connectedCallback fires again
    expect(el.querySelectorAll(':scope > ui-chat-shell').length).toBe(1)
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

  it('composes the card: markdown/a2ui/genui rows in order; GenUI is PRD-gated (disabled); the catalog picker carries the roster', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="surface-row"]')]
    expect(rows.map((r) => r.getAttribute('data-surface'))).toEqual(['markdown', 'a2ui', 'genui'])
    const genui = rows[2] as HTMLElement
    expect(genui.hasAttribute('data-disabled')).toBe(true)
    expect((genui.querySelector('[data-part="surface-toggle"]') as HTMLElement & { disabled: boolean }).disabled).toBe(true)
    expect(genui.querySelector('[data-part="surface-note"]')?.textContent).toBe('PRD pending')
    const catalog = el.querySelector('[data-part="surface-catalog"]') as HTMLElement
    const options = [...catalog.querySelectorAll('[role="option"]')]
    expect(options.map((o) => o.getAttribute('value'))).toEqual(A2UI_CATALOG_OPTIONS.map((o) => o.id))
    // both live modalities ship ON
    expect((rows[0]!.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }).checked).toBe(true)
    expect((rows[1]!.querySelector('[data-part="surface-toggle"]') as HTMLElement & { checked: boolean }).checked).toBe(true)
  })

  it('Markdown ON by default: an agent note renders through <ui-markdown>; an explicit OFF falls back to a plain text node (live-apply, next bubble)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
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

    // the catalog picker disables with the modality (choosing a catalog for a dead surface is noise)
    expect((el.querySelector('[data-part="surface-catalog"]') as HTMLElement & { disabled: boolean }).disabled).toBe(true)

    el.store!.set(SURFACE_A2UI_KEY, true)
    await whenFlushed()
    expect((el.querySelector('[data-part="surface-catalog"]') as HTMLElement & { disabled: boolean }).disabled).toBe(false)
    composerSubmit(el, 'draw again')
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    expect(seen).toHaveLength(1)
    expect(seen[0]!.catalogId).toBe(DEFAULT_A2UI_CATALOG_ID)
  })

  it('the Context Agent System JSON carries the surface block (markdown/a2ui/catalog/genui)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()
    const agentJson = JSON.parse(
      el.querySelector('[data-part="context-item"][data-item="agent"] [data-part="context-json"]')!.textContent ?? '{}',
    ) as { surface: { markdown: boolean; a2ui: boolean; catalog: string; genui: string } }
    expect(agentJson.surface).toEqual({ markdown: true, a2ui: true, catalog: DEFAULT_A2UI_CATALOG_ID, genui: 'prd-pending' })
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
