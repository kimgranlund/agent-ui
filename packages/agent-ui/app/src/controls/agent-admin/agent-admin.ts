// agent-admin.ts — UIAgentAdminElement, the Agent Admin UI (TKT-0039, ADR-0131/ADR-0132): a live-editable
// agent config + instructions with a working chat preview, composing the shipped M2 (`ui-conversation`)
// and M4 (`ui-split`, `ui-settings`) primitives PLUS the generic ordered-entry-list primitive
// (`entries.ts`/`entry-list.ts`, ADR-0132) — no new primitive FAMILY beyond that one, no new protocol
// dependency.
//
// Three fixed `ui-split-pane` children on ONE composed `ui-split` (axis=horizontal, the ADR-0131 cl.2
// ruled order): `[ chat canvas | prompts pane | settings pane ]`. Composition is idempotent — the
// `master-detail.ts`/`settings.ts` `#compose()` precedent: built ONCE at first connect, never rebuilt on
// a later reconnect.
//
// ADR-0132 replaced the single free-text prompt + flat-only settings with FIVE instantiations of one
// generic entry-list primitive: prompt sections (Foundation/Personality/Critical Items, seeded,
// toggle-off-only) in the prompts pane; Skills/Workflows/Resources/Tools (unseeded, purely
// custom-authored) alongside the UNCHANGED "Agent" flat config in the settings pane. All five share ONE
// shared `SettingsStore` instance (settings/store.ts) — one persisted config, five slices of it.
//
// LIVE-APPLY (ADR-0131's "no manual reload" requirement, now ADR-0132's richer version): the stub turn
// loop reads the store's CURRENT entries at turn time — a `composeSystemPrompt` over the enabled prompt
// sections, plus the enabled labels of each capability kind. No propagation channel exists because none
// is needed — a store read trivially reflects whatever any pane most recently committed.
//
// FAIL-CLOSED: `ui-settings`' own generated fields already validate before commit (SPEC-R11/generate.ts);
// `entries.ts`'s `validateNewEntry` guards every custom entry (a required name, no id collision); an
// empty/all-disabled prompt-section set falls back to `DEFAULT_SYSTEM_PROMPT_FALLBACK` — never an empty
// instruction silently reaching the stub reply.
//
// `controls → @agent-ui/components` (+ this package's own `../settings/`/`../conversation/` siblings)
// only — NEVER `@agent-ui/router`/`@agent-ui/a2a`; the app `layering.test.ts` trip-wire guards it.

import { UIElement, prop, untracked, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
// Side-effect only: registers `ui-split` / `ui-split-pane` before this element's `connected()` ever calls
// `document.createElement` on either tag.
import '@agent-ui/components/controls/split'
import '@agent-ui/components/controls/split-pane'
import '@agent-ui/components/controls/switch'
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsSchema } from '../settings/schema.ts'
import type { SettingsStore } from '../settings/store.ts'
import {
  DEFAULT_MODEL_ID,
  defaultAgentConfigSchema,
  initialValuesFor,
  runStubAgentTurn,
  sanitizeNumber,
  sanitizeSelect,
  type AgentConfigSnapshot,
  type AdminAgentTurn,
  type AdminTurn,
  type AdminTurnRequest,
} from './agent-admin-schema.ts'
import {
  ENTRY_KINDS,
  entriesStoreKey,
  initialEntryValues,
  readEntries,
  composeSystemPrompt,
  composeLiveSystemPrompt,
  validateNewEntry,
  type Entry,
  type LiveCapabilityGroup,
} from './entries.ts'
import { mountEntryList, showAddError, type EntryListSection } from './entry-list.ts'

const agentAdminProps = {
  // Non-reflected properties — too structured for an attribute (the `ui-split` `sizes` / `ui-settings`
  // `schema`/`store` precedent). Both default to `undefined` at the PROP level (matching `ui-settings`'
  // own convention exactly — and the ADR-0004 descriptor's `default: undefined` token, which a real
  // object literal cannot represent cleanly) and are lazily assigned a real, usable default in
  // `connected()`: `schema` gets the shared `defaultAgentConfigSchema` (plain, read-only data — safe to
  // share across instances); `store` gets its OWN fresh persisted instance (a shared module-level default
  // would leak state across independently-constructed instances — each element gets its OWN default store).
  schema: { ...prop.json<SettingsSchema | undefined>(undefined), attribute: false as const },
  store: { ...prop.json<SettingsStore | undefined>(undefined), attribute: false as const },
  // The DEV-only live-turn seam (TKT-0052/ADR-0136): default `undefined` ⇒ the stub branch runs, so the
  // static build carries no live-call code (the site page assigns this ONLY under `import.meta.env.DEV`,
  // the a2ui-live.ts construction-site precedent — the packaged component itself stays fetch/env/proxy-free).
  agentTurn: { ...prop.json<AdminAgentTurn | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

/** The five ENTRY_KINDS instantiations, each paired with its display copy — the single source of truth
 *  `#compose()`/the reactive effect both iterate, so a future 6th kind (ADR-0132 Fork 2's extensibility)
 *  is one array entry, never new list/toggle/author/render code. */
const CAPABILITY_KINDS: ReadonlyArray<{ kind: string; label: string; addLabel: string; liveHeading: string }> = [
  { kind: ENTRY_KINDS.skill, label: 'Skills', addLabel: '+ Add skill', liveHeading: 'Skills available to you' },
  { kind: ENTRY_KINDS.workflow, label: 'Workflows', addLabel: '+ Add workflow', liveHeading: 'Workflows available to you' },
  { kind: ENTRY_KINDS.resource, label: 'Resources', addLabel: '+ Add resource', liveHeading: 'Resources available to you' },
  { kind: ENTRY_KINDS.tool, label: 'Tools', addLabel: '+ Add tool', liveHeading: 'Tools available to you' },
]

export interface UIAgentAdminElement extends ReactiveProps<typeof agentAdminProps> {}
export class UIAgentAdminElement extends UIElement {
  static props = agentAdminProps

  // The composed SHELL — created ONCE (idempotent, `#split` doubles as the guard) and PERSISTS across a
  // reconnect (the `master-detail.ts`/`settings.ts` precedent).
  #split: HTMLElement | null = null
  #conversation: UIConversationElement | null = null
  #settingsEl: UISettingsElement | null = null
  // Every entry-list instantiation (prompt sections + all four capability kinds), keyed by `kind` — the
  // ONE registry `#rewireAllSections`/`#compose` both iterate uniformly.
  #capabilitySections: Map<string, EntryListSection> = new Map()

  #unsubscribes: Map<string, () => void> = new Map()
  // The no-subscribe fallback trigger — `#updateEntries` calls this directly ONLY when the current
  // store has no `subscribe` method to notify it instead (component-reviewer MODERATE fix).
  #renders: Map<string, () => void> = new Map()
  // The multi-turn conversation history (TKT-0052 Q4, element-lifetime, private): prior COMPLETED turns —
  // user text + reply — appended on BOTH the stub and the live path. Replayed into the live request as
  // PRIOR turns only; the system prompt is rebuilt fresh every turn and NEVER stored here, so a mid-
  // conversation model/prompt/capability switch applies to the NEXT turn only and prior turns are never
  // rewritten (the acceptance criterion falls out by construction).
  #history: AdminTurn[] = []

  protected connected(): void {
    this.#compose() // idempotent — builds ONLY the split/pane shell + the composed children, once ever

    // Lazily default `schema`/`store` (once ever — a later reconnect finds them already set and skips
    // this). `schema` shares the module-level constant (plain, read-only data); `store` gets its OWN
    // fresh persisted instance per element, seeded from BOTH the flat "Agent" schema's own defaults
    // (agent-admin-schema.ts's `initialValuesFor`) AND every entry-list kind's seed data
    // (entries.ts's `initialEntryValues`) — disjoint key sets, merged so the localStorage read-back
    // (the CRITICAL component-reviewer fix) covers the whole persisted shape, not just the flat half.
    if (this.schema === undefined) {
      this.schema = defaultAgentConfigSchema
    }
    if (this.store === undefined) {
      this.store = createMemoryStore({
        persistKey: 'ui-agent-admin',
        initial: { ...initialValuesFor(this.schema), ...initialEntryValues() },
      })
    }

    // schema/store → the composed ui-settings pane + every entry-list section's render + subscription.
    // Reactive: a real reassignment (different object references) re-wires from scratch; a reconnect with
    // the SAME store re-arms only. Entries are block-level content (not per-keystroke), so — unlike the
    // v1 single-field case — always re-rendering from the CURRENT store value on every connect (real
    // reassignment or bare reconnect alike) is safe: there is no in-progress-edit-preservation concern a
    // full list rebuild could clobber the way reseeding a live textarea mid-edit would.
    this.effect(() => {
      const schema = this.schema
      const store = this.store
      untracked(() => {
        if (this.#settingsEl) {
          this.#settingsEl.schema = schema
          this.#settingsEl.store = store
        }
        this.#rewireAllSections(store)
      })
    })
  }

  protected disconnected(): void {
    for (const unsubscribe of this.#unsubscribes.values()) unsubscribe()
    this.#unsubscribes.clear()
  }

  // ── composition (idempotent — the master-detail.ts/settings.ts `#compose` doc-comment precedent) ──────

  /** Build the split/pane shell + the five composed entry-list sections + the composed ui-settings,
   *  once ever. The store-driven CONTENT (each section's rendered entries) is the `connected()` effect's
   *  job, not this method's. */
  #compose(): void {
    if (this.#split) return

    const split = document.createElement('ui-split')

    const canvasPane = document.createElement('ui-split-pane')
    canvasPane.setAttribute('data-role', 'canvas')
    const conversation = new UIConversationElement()
    conversation.onSubmit((text) => this.#handleSubmit(text))
    canvasPane.append(conversation)

    const promptsPane = document.createElement('ui-split-pane')
    promptsPane.setAttribute('data-role', 'prompts')
    const promptSections = this.#makeSection(ENTRY_KINDS.promptSection, 'Instructions', '+ Add section')
    promptsPane.append(promptSections.host)

    const settingsPane = document.createElement('ui-split-pane')
    settingsPane.setAttribute('data-role', 'settings')
    const agentHeading = document.createElement('h3')
    agentHeading.setAttribute('data-part', 'agent-heading')
    agentHeading.textContent = 'Agent'
    const settingsEl = new UISettingsElement()
    // Event-boundary guard (the settings.ts `md`/`rail` precedent, same rationale): `settingsEl` is an
    // internal composition detail — its own bubbling `select`/`change` (a section switch) must not reach
    // a listener on THIS element, which owns no event vocabulary of its own (descriptor `events: []`).
    settingsEl.addEventListener('select', (event) => event.stopPropagation())
    settingsEl.addEventListener('change', (event) => event.stopPropagation())
    settingsPane.append(agentHeading, settingsEl)
    for (const { kind, label, addLabel } of CAPABILITY_KINDS) {
      const section = this.#makeSection(kind, label, addLabel)
      settingsPane.append(section.host)
    }

    split.append(canvasPane, promptsPane, settingsPane)
    this.append(split)

    this.#split = split
    this.#conversation = conversation
    this.#settingsEl = settingsEl
  }

  /** Build ONE entry-list section wired to THIS element's store — the ONE shared mechanism every
   *  instantiation (prompt sections + all four capability kinds) reuses (ADR-0132 cl.1). Registers the
   *  result in `#capabilitySections` (keyed by `kind`, prompt sections included) so
   *  `#rewireAllSections`/`#handleSubmit` can iterate uniformly. */
  #makeSection(kind: string, label: string, addLabel: string): EntryListSection {
    const section = mountEntryList(kind, label, addLabel, {
      onToggle: (id, enabled) => this.#updateEntries(kind, (entries) => entries.map((e) => (e.id === id ? { ...e, enabled } : e))),
      onContentChange: (id, content) => this.#updateEntries(kind, (entries) => entries.map((e) => (e.id === id ? { ...e, content } : e))),
      // The `|| e.builtin` guard is defensive, mirroring entry-list.ts's own choice not to render a
      // delete affordance for a builtin entry in the first place (ADR-0132 Fork 4: toggle off, never
      // delete) — a stray call still cannot remove one.
      onDelete: (id) => this.#updateEntries(kind, (entries) => entries.filter((e) => e.id !== id || e.builtin)),
      onAdd: (input) => {
        const existing = readEntries(this.store, kind)
        const result = validateNewEntry(existing, kind, input)
        if (!result.ok) {
          showAddError(section, result.error)
          return false
        }
        this.#updateEntries(kind, (entries) => [...entries, result.entry])
        return true
      },
    })
    this.#capabilitySections.set(kind, section)
    return section
  }

  /** Read → transform → persist one kind's entry list. `store.subscribe` (armed by `#rewireAllSections`)
   *  is the PREFERRED re-render trigger — calling it here too would double-render (this element's own
   *  `set()` synchronously re-fires its own subscription before a direct call would even return).
   *  Component-reviewer MODERATE fix: `SettingsStore.subscribe` is OPTIONAL (store.ts) — a bring-your-own
   *  store that omits it would otherwise never re-render after this write (add/delete/toggle would
   *  persist but never visibly appear). Falls back to a direct render ONLY when this store genuinely has
   *  no `subscribe` to rely on. */
  #updateEntries(kind: string, updater: (entries: Entry[]) => Entry[]): void {
    const store = this.store
    const current = readEntries(store, kind)
    store?.set(entriesStoreKey(kind), updater(current))
    if (store !== undefined && store.subscribe === undefined) {
      this.#renders.get(kind)?.()
    }
  }

  /** (Re-)render every section from `store`'s CURRENT contents + (re-)arm each kind's subscription — the
   *  `settings.ts`/TKT-0021 field-subscription precedent, generalized to five keys: a subscription dies
   *  with every disconnect and must be re-armed on every connect. Always renders (never skipped on a
   *  bare reconnect) — see the `connected()` doc comment for why that is safe for entries specifically.
   *  Also (re)populates `#renders` — `#updateEntries`' own no-subscribe fallback trigger. */
  #rewireAllSections(store: SettingsStore | undefined): void {
    for (const unsubscribe of this.#unsubscribes.values()) unsubscribe()
    this.#unsubscribes.clear()
    this.#renders.clear()

    const allKinds = [ENTRY_KINDS.promptSection, ...CAPABILITY_KINDS.map((c) => c.kind)]
    for (const kind of allKinds) {
      const section = this.#capabilitySections.get(kind)
      if (!section) continue
      const render = (): void => section.render(readEntries(store, kind))
      this.#renders.set(kind, render)
      render()
      const unsubscribe = store?.subscribe?.((key) => {
        if (key === entriesStoreKey(kind)) render()
      })
      if (unsubscribe) this.#unsubscribes.set(kind, unsubscribe)
    }
  }

  /** The turn loop. Reads the store's CURRENT entries at turn time (the live-apply mechanism itself — no
   *  propagation channel, just a fresh read): composes the enabled prompt sections into the final prompt
   *  string (`composeSystemPrompt`, fail-closed to `DEFAULT_SYSTEM_PROMPT_FALLBACK` if every section is
   *  disabled/empty), and gathers each capability kind's enabled entry labels (ADR-0132 cl.6).
   *
   *  Two arms (TKT-0052/ADR-0136): `agentTurn` UNSET ⇒ the deterministic stub (ADR-0131, byte-unchanged —
   *  the only path the static build ever carries); `agentTurn` SET (a DEV-only, site-page-injected runner)
   *  ⇒ a real live turn through the reused `dev-proxy-plugin.ts` trust boundary, single-shot into
   *  `setNote`/`finalize` (LLD Q3), degrading a thrown/rejected runner via `handle.fail()` (LLD Q5, no crash,
   *  no silent swallow). Both arms append the completed exchange to `#history`. */
  #handleSubmit(text: string): void {
    const conversation = this.#conversation
    if (!conversation) return
    const store = this.store
    const schema = this.schema ?? defaultAgentConfigSchema

    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    const systemPrompt = composeSystemPrompt(sections)
    const enabledLabels = (kind: string): string[] =>
      readEntries(store, kind)
        .filter((e) => e.enabled)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((e) => e.label)

    const config: AgentConfigSnapshot = {
      name: typeof store?.get('name') === 'string' ? (store.get('name') as string) : 'Untitled agent',
      model: sanitizeSelect(schema, 'model', store?.get('model'), DEFAULT_MODEL_ID),
      temperature: sanitizeNumber(schema, 'temperature', store?.get('temperature'), 0.5),
      toolsEnabled: store?.get('toolsEnabled') === true,
      systemPrompt,
      skills: enabledLabels(ENTRY_KINDS.skill),
      workflows: enabledLabels(ENTRY_KINDS.workflow),
      resources: enabledLabels(ENTRY_KINDS.resource),
      tools: enabledLabels(ENTRY_KINDS.tool),
    }

    // setNote (not ingestLine): ingestLine expects A2UI wire JSONL (surfaceIdOf/categoryOf parse it) — a
    // plain prose reply is exactly what setNote's contract is for ("rendered verbatim at finalize()").
    const handle = conversation.beginAgentTurn()
    const agentTurn = this.agentTurn

    // Stub arm — byte-unchanged (ADR-0131). The only path the static build carries.
    if (agentTurn === undefined) {
      const reply = runStubAgentTurn(text, config)
      handle.setNote(reply)
      handle.finalize()
      this.#recordTurn(text, reply)
      return
    }

    // Live arm (DEV-only, injected). The system prompt is rebuilt FRESH here (with the capability
    // projection, ADR-0136 Fork 3) and never stored in history; `history` carries PRIOR turns only, so a
    // mid-conversation config switch applies next-turn-only by construction (Q4). The in-flight busy-lock
    // (TKT-0034, auto-tracked off beginAgentTurn) disables the composer until finalize()/fail() runs.
    const request: AdminTurnRequest = {
      text,
      system: composeLiveSystemPrompt(sections, this.#capabilityGroups(store), config.toolsEnabled),
      model: config.model,
      history: [...this.#history],
    }
    void (async () => {
      try {
        const reply = await agentTurn(request)
        handle.setNote(reply)
        handle.finalize()
        this.#recordTurn(text, reply)
      } catch (err) {
        // A network/provider fault, a non-2xx proxy response, or the runner's 120s timeout: surface it
        // visibly (an error narration entry + a "⚠ …" system bubble, composer re-enabled) — never a crash
        // or a silent swallow (SPEC-R6 AC3 path, the shipped ui-conversation affordance). The failed
        // exchange is NOT recorded into history — there is no assistant reply to pair.
        handle.fail(err instanceof Error ? err.message : String(err))
      }
    })()
  }

  /** Each capability kind's raw store slice + its live `##` group heading, for `composeLiveSystemPrompt`
   *  (which does the enabled-filter/sort/tools-gate itself). */
  #capabilityGroups(store: SettingsStore | undefined): LiveCapabilityGroup[] {
    return CAPABILITY_KINDS.map(({ kind, liveHeading }) => ({
      kind,
      heading: liveHeading,
      entries: readEntries(store, kind),
    }))
  }

  /** Append one completed exchange to the multi-turn history (both arms). */
  #recordTurn(text: string, reply: string): void {
    const turns: AdminTurn[] = [
      { role: 'user', content: text },
      { role: 'assistant', content: reply },
    ]
    this.#history.push(...turns)
  }
}

if (!customElements.get('ui-agent-admin')) customElements.define('ui-agent-admin', UIAgentAdminElement)
