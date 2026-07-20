// agent-admin.ts — UIAgentAdminElement, the Agent Admin UI (TKT-0039, ADR-0131/ADR-0132): a live-editable
// agent config + instructions with a working chat preview, composing the shipped M2 (`ui-conversation`)
// and M4 (`ui-split`, `ui-settings`) primitives PLUS the generic ordered-entry-list primitive
// (`entries.ts`/`entry-list.ts`, ADR-0132) — no new primitive FAMILY beyond that one, no new protocol
// dependency.
//
// Two fixed `ui-split-pane` children on ONE composed `ui-split` (vision rev.5, Kim's Figma frame
// 33:1693 — superseding ADR-0131 cl.2's three-pane order): `[ chat canvas | {Settings ⇄ Context: System
// ⇄ Context: Dialog} tabs ]`. The Settings tab carries the WHOLE config column (Agent header row +
// ui-settings + the Model grid + prompt sections + capability sections — the old prompts pane merged
// in); the Context tabs are the read-only introspection surface, split in two (GH #161, superseding the
// single combined "Context" tab): "Context: System" (the compiled Agent System JSON) and "Context:
// Dialog" (the Dialog Turns payload log). Composition is idempotent — the `master-detail.ts`/
// `settings.ts` `#compose()` precedent: built ONCE at first connect, never rebuilt on a later reconnect.
//
// ADR-0132 replaced the single free-text prompt + flat-only settings with FIVE instantiations of one
// generic entry-list primitive: prompt sections (Foundation/Personality/Critical Items, seeded,
// toggle-off-only); Skills/Workflows/Resources/Tools (unseeded, purely custom-authored) alongside the
// "Agent" flat config — all in the Settings tab. All five share ONE shared `SettingsStore` instance
// (settings/store.ts) — one persisted config, five slices of it. Vision rev.5 adds the MASTER switches:
// the Agent ACTIVE toggle (`agentEnabled` — OFF disables the composer, no turns run) and one per
// capability kind (`${kind}sEnabled` — OFF gates the whole kind out, winning over per-entry toggles;
// the `tool` kind's key IS the old `toolsEnabled`, whose Agent-card field retired in the same change).
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
// Side-effect only: registers these tags before this element (or the `entry-list.ts` sibling it composes)
// ever calls `document.createElement` on one. `button`/`icon` (TKT-0048) register entry-list.ts's
// `entry-add-toggle`/`entry-delete` `<ui-button>`s + the add-toggle's leading `<ui-icon>` explicitly;
// `@agent-ui/code/editor` (ADR-0139, superseding TKT-0049's `textarea`) registers entry-list.ts's
// `entry-content`/`entry-add-content` `<ui-code-editor>`s the same way (the import registers the tag only —
// the CodeMirror runtime stays lazy); `text-field` (TKT-0060) registers its `entry-add-label`/`entry-add-description` `<ui-text-field>`s
// — previously these upgraded only via an incidental transitive path (agent-admin → conversation →
// surface-host → the a2ui default catalog's factories.ts, which value-imports the whole family) that a
// future tree-shaking change could sever. `field` (TKT-0073) registers the `<ui-field>` wrapper entry-list.ts
// now hosts those two text-fields in, so their required-validation message renders outside their own box.
import '@agent-ui/components/controls/split'
import '@agent-ui/components/controls/split-pane'
import '@agent-ui/components/controls/switch'
import '@agent-ui/components/controls/select' // vision rev.6 — the Surface Options catalog picker
import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'
import '@agent-ui/code/editor'
import '@agent-ui/components/controls/field'
import '@agent-ui/components/controls/text-field'
// The Model grid's row controls (2026-07-19 rev.2) — ui-switch is already registered above; ui-radio
// registers here for the default-position column (rev.3: a radio SYSTEM — the semantically honest
// pick-exactly-one control; selection coordination stays this element's render, not a ui-radio-group,
// whose roving/one-group contract doesn't fit rows interleaved with switches across provider groups).
import '@agent-ui/components/controls/radio'
// TKT-0085: registers <ui-tabs>/<ui-tab>/<ui-tab-panel> — the responsive-collapse shells `#applyLayout`
// moves pane content into below the wide breakpoint.
import '@agent-ui/components/controls/tabs'
import '@agent-ui/components/controls/disclosure' // vision rev.5 — the Context tabs' accordion primitive
// Vision rev.6 (Surface Options): the Markdown modality renders agent notes through <ui-markdown> —
// sanitized by construction. App → code is the ADR-0139-ruled edge this file already takes for
// `@agent-ui/code/editor`; ui-conversation itself stays code-free (the SPEC-R12 renderer seam carries it).
import '@agent-ui/code/markdown'
import { UISettingsElement } from '../settings/settings.ts'
import { UIConversationElement } from '../conversation/conversation.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import type { SettingsSchema } from '../settings/schema.ts'
import type { SettingsStore } from '../settings/store.ts'
import {
  AGENT_ENABLED_KEY,
  A2UI_CATALOG_KEY,
  A2UI_CATALOG_OPTIONS,
  DEFAULT_MODEL_ID,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_MARKDOWN_KEY,
  defaultAgentConfigSchema,
  isEnabledFlag,
  kindEnabledKey,
  sanitizeCatalog,
  initialValuesFor,
  isModelIncluded,
  modelRoster,
  sanitizeModel,
  runStubAgentTurn,
  sanitizeNumber,
  type AgentConfigSnapshot,
  type AdminAgentTurn,
  type AdminAgentSurfaceTurn,
  type AdminTurn,
  type AdminTurnRequest,
} from './agent-admin-schema.ts'
import { EFFORT_LEVELS, type EffortLevel } from '../conversation/composer-options.ts'
import {
  ENTRY_KINDS,
  entriesStoreKey,
  initialEntryValues,
  readEntries,
  composeSystemPrompt,
  composeLiveSystemPrompt,
  validateNewEntry,
  type Entry,
  type EntryLibraryPack,
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
  // The SURFACE-capable live seam (TKT-0076/ADR-0138) — same DEV-only injection discipline as agentTurn.
  // When set it takes PRECEDENCE over agentTurn: the turn streams typed events (validated A2UI wire lines
  // + the peeled prose note) and the wire lines drive `AgentTurnHandle.ingestLine` — REAL inline surfaces
  // (ADR-0129) instead of a prose reply.
  agentSurfaceTurn: { ...prop.json<AdminAgentSurfaceTurn | undefined>(undefined), attribute: false as const },
  // GH #47/#48 — entry-library packs, keyed by entry kind (skill/workflow/...). Non-reflected pure
  // type-carrier (the schema/store precedent). The section SHELL is still built once at compose time
  // (`#makeSection`, the sections' build-once law) — but GH #143 made the add-from-library MENU inside
  // each shell reactive: a post-connect reassignment (a new object reference, the `schema`/`store`
  // identity-change law) re-runs the `connected()` effect and rebuilds just that menu per kind via
  // `EntryListSection.updateLibraries` — e.g. a caller re-scoping which packs apply on a persona/preset
  // switch. Only the menu updates; a section's rendered ENTRIES are unaffected (those already re-render
  // off `store`, a separate signal).
  libraries: { ...prop.json<Record<string, readonly EntryLibraryPack[]> | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

/** The five ENTRY_KINDS instantiations, each paired with its display copy — the single source of truth
 *  `#compose()`/the reactive effect both iterate, so a future 6th kind (ADR-0132 Fork 2's extensibility)
 *  is one array entry, never new list/toggle/author/render code. */
const CAPABILITY_KINDS: ReadonlyArray<{ kind: string; label: string; addLabel: string; liveHeading: string }> = [
  { kind: ENTRY_KINDS.skill, label: 'Skills', addLabel: 'Add skill', liveHeading: 'Skills available to you' },
  { kind: ENTRY_KINDS.workflow, label: 'Workflows', addLabel: 'Add workflow', liveHeading: 'Workflows available to you' },
  { kind: ENTRY_KINDS.resource, label: 'Resources', addLabel: 'Add resource', liveHeading: 'Resources available to you' },
  { kind: ENTRY_KINDS.tool, label: 'Tools', addLabel: 'Add tool', liveHeading: 'Tools available to you' },
]

type AgentAdminLayout = 'split' | 'narrow'

// TKT-0085 → vision rev.5 (Kim's Figma frame 33:1693) — the responsive shell collapsed from THREE bands
// to TWO: the old wide (chat | prompts | settings) and medium (chat | 2-tab) shapes both dissolve into
// ONE `split` layout (chat | {Settings, Context: System, Context: Dialog} tabs, GH #161), so a single
// threshold remains. Same px rationale
// as before (a ResizeObserver measures px; 640px = 40rem is the repo's own app-shell.css/
// master-detail.css collapse precedent). The 2-pane mechanical floor is canvas 16rem + tabs 20rem =
// 36rem/576px, comfortably under the threshold.
const NARROW_MAX_PX = 640

function layoutFor(widthPx: number): AgentAdminLayout {
  return widthPx >= NARROW_MAX_PX ? 'split' : 'narrow'
}

/** Dialog Turns retention cap (vision rev.5) — a bounded ring; the oldest records fall off. Session-
 *  ephemeral by design (like `#history`): the store persists the agent's CONFIG, never its traffic. */
const TURN_LOG_CAP = 20

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

  // ── TKT-0085: the responsive-collapse shell — three named layouts, ONE set of content nodes moved
  // (never cloned/rebuilt) between whichever shell the current layout uses. See `#applyLayout`'s own
  // doc-comment for the full design; fields here are the STABLE homes + content units it operates on,
  // all built once in `#compose()`.
  #canvasPane: HTMLElement | null = null // split-layout home for `#conversation`
  #tabsPane: HTMLElement | null = null // split-layout home for the {Settings, Context: System, Context: Dialog} ui-tabs (vision rev.5; GH #161 split Context in two)
  #settingsPanel: HTMLElement | null = null // the Settings ui-tab-panel
  // GH #161: the old single Context ui-tab-panel split into two — Agent System and Dialog Turns each
  // get their OWN tab now, in both the split layout (here) and narrow mode (below) — the flat
  // one-content-unit-per-tab shape every OTHER tab (Chat/Settings) already uses, never a nested
  // sub-tab-set special-cased for Context alone (see the #compose() doc comment at the tab strip
  // construction for the full narrow-mode rationale).
  #contextSystemPanel: HTMLElement | null = null // the Context: System ui-tab-panel
  #contextDialogPanel: HTMLElement | null = null // the Context: Dialog ui-tab-panel
  #narrowTabs: HTMLElement | null = null // narrow-only, top-level: 4 tabs: Chat, Settings, Context: System, Context: Dialog (GH #161)
  #narrowChatPanel: HTMLElement | null = null
  #narrowSettingsPanel: HTMLElement | null = null
  #narrowContextSystemPanel: HTMLElement | null = null
  #narrowContextDialogPanel: HTMLElement | null = null
  // The three content UNITS that migrate between a split-layout tab panel and a narrow tab panel —
  // `#conversation` (already a single element) is the fourth; all are built once in `#compose()`.
  // `#settingsContent` bundles the WHOLE config column (Agent header row + ui-settings + model grid +
  // prompt sections + capability sections — the old prompts pane merged in, vision rev.5);
  // `#contextSystemContent`/`#contextDialogContent` are the two halves of the old combined read-only
  // introspection column (Agent System / Dialog Turns respectively, GH #161).
  #settingsContent: HTMLElement | null = null
  #contextSystemContent: HTMLElement | null = null
  #contextDialogContent: HTMLElement | null = null
  #currentLayout: AgentAdminLayout | null = null
  // ── vision rev.5: the master switches + the Context tabs' render slots ──────────────────────────────
  #agentSwitch: (HTMLElement & { checked: boolean }) | null = null
  #kindSwitches: Map<string, HTMLElement & { checked: boolean }> = new Map()
  // ── vision rev.6: the Surface Options controls (built once; state re-applied per store change) ───────
  #surfaceMarkdownSwitch: (HTMLElement & { checked: boolean }) | null = null
  #surfaceA2uiSwitch: (HTMLElement & { checked: boolean }) | null = null
  #surfaceCatalogSelect: (HTMLElement & { value: string; disabled: boolean }) | null = null
  #contextSystemHost: HTMLElement | null = null // Agent System — rebuilt wholesale per store change
  #contextTurnsHost: HTMLElement | null = null // Dialog Turns — rebuilt per logged turn
  /** The Context tabs' shared store subscription (both System and Dialog read off the same store) — its
   *  OWN slot (the #modelGridUnsub precedent): it must outlive `#rewireAllSections`' clear-and-rebuild
   *  of the shared #unsubscribes map. */
  #contextUnsub: (() => void) | undefined
  /** The Dialog Turns ring (newest LAST here; rendered newest-FIRST) — request/response per turn,
   *  every arm (stub, live, surface), failures included. Element-lifetime, never persisted. `n` is a
   *  MONOTONIC turn number (the vision frame's 04→01), stable as the bounded ring drops its oldest. */
  #turnLog: Array<{ n: number; arm: 'stub' | 'live' | 'surface'; request: unknown; response: unknown }> = []
  #turnCounter = 0
  #layoutObserver: ResizeObserver | null = null

  #unsubscribes: Map<string, () => void> = new Map()
  /** The Model grid's host element (composed once, re-rendered wholesale per store change). */
  #modelGrid: HTMLElement | null = null
  /** The grid subscription's own teardown (never the shared #unsubscribes map — rewires clear it). */
  #modelGridUnsub: (() => void) | undefined
  // The no-subscribe fallback trigger — `#updateEntries` calls this directly ONLY when the current
  // store has no `subscribe` method to notify it instead (component-reviewer MODERATE fix).
  #renders: Map<string, () => void> = new Map()
  // The multi-turn conversation history (TKT-0052 Q4, element-lifetime, private): prior COMPLETED turns —
  // user text + reply — appended on BOTH the stub and the live path. Replayed into the live request as
  // PRIOR turns only; the system prompt is rebuilt fresh every turn and NEVER stored here, so a mid-
  // conversation model/prompt/capability switch applies to the NEXT turn only and prior turns are never
  // rewritten (the acceptance criterion falls out by construction).
  #history: AdminTurn[] = []
  // The composer's Effort picker selection (the Figma chat-input refactor) — ephemeral, element-lifetime
  // state, deliberately NOT persisted to `store` (unlike `model`): reasoning effort is a per-conversation
  // dial, not a saved agent-profile setting, and Figma's own composer design carries no Effort field in
  // the settings pane either. Written into `#conversation.effort` imperatively whenever it changes — see
  // `#syncConversationConfig`.
  #effort: EffortLevel = 'medium'
  // GH #145 — the store-swap effect's own "was this a real reassignment or a bare reconnect" memory
  // (the #modelGridUnsub precedent, generalized): a REAL reassignment (a persona switch — a different
  // store object) must start a fresh conversation; a bare reconnect with the SAME store (a layout
  // crossing, TKT-0085) must not wipe an in-progress one. `#storeSeen` distinguishes "never run" (the
  // element's first ever connect — nothing to reset, the conversation is already empty) from "ran once
  // with `undefined`" (a real state a later defined store can still differ from).
  #storeSeen = false
  #lastStore: SettingsStore | undefined

  protected connected(): void {
    this.#compose() // idempotent — builds ONLY the split/pane shell + the composed children, once ever

    // TKT-0085: the responsive-collapse watcher. `ui-split`/`ui-app-shell`/`ui-master-detail`'s own
    // `@container` breakpoints are CSS-only visibility toggles — they can never MOVE a node to a new
    // parent, and this layout needs real reparenting (a pane's content becomes a tab panel's content).
    // A ResizeObserver on this host's own content-box is the only mechanism that can drive that decision
    // in JS; `#applyLayout` is idempotent (a same-layout call is a no-op), so a resize inside the SAME
    // band costs nothing beyond the width comparison. Feature-detected (jsdom carries no
    // ResizeObserver — the traits/scroll-fade.ts precedent) and disconnected in `disconnected()`.
    if (typeof ResizeObserver !== 'undefined' && this.#layoutObserver === null) {
      this.#layoutObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width
        if (width !== undefined) this.#applyLayout(layoutFor(width))
      })
      this.#layoutObserver.observe(this)
    } else if (typeof ResizeObserver === 'undefined') {
      // jsdom (no real layout to measure anyway) — settle on the widest layout so every pane's content
      // stays reachable via a stable DOM shape for jsdom-based tests.
      this.#applyLayout('split')
    }

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
        // `model` seeds explicitly — the Model GRID owns it now and the schema carries no model field
        // for initialValuesFor to walk (Kim, 2026-07-19 rev.2).
        initial: { model: DEFAULT_MODEL_ID, ...initialValuesFor(this.schema), ...initialEntryValues() },
      })
    }
    // The Model GRID (Kim, 2026-07-19 rev.2 — supersedes the one-day-old customModels→schema rebuild:
    // the schema carries no model select anymore, the grid re-renders itself instead; GH #137, 2026-07-20:
    // the customModels admin-add capability itself is now gone too, Kim's option A): render now from
    // the store's current contents, and re-render on either of its two keys through its OWN teardown
    // slot — NEVER the shared #unsubscribes map, which #rewireAllSections clears on every store rewire
    // (this subscription must outlive rewires; it dies with the connection).
    {
      this.#renderModelGrid()
      this.#modelGridUnsub?.()
      this.#modelGridUnsub = this.store?.subscribe?.((key) => {
        if (key === 'model' || key === MODELS_INCLUDED_KEY) this.#renderModelGrid()
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
      const libraries = this.libraries
      untracked(() => {
        // GH #145 — a REAL store reassignment (a persona switch: `admin.store = presetStore(other)`)
        // must start a genuinely fresh conversation for the newly-selected persona: the visible chat
        // log + any open A2UI surfaces (`#conversation.reset()`), the multi-turn `#history` fed into
        // live requests, and the Dialog Turns ring (`#turnLog`) the Context: Dialog tab reads. Gated on
        // `#storeSeen` so the element's FIRST ever connect (nothing to reset yet) and a bare reconnect
        // with the SAME store (e.g. a TKT-0085 layout crossing) both skip it — only a genuine identity
        // change resets. `#rewireContext` below re-renders the (now-empty) Dialog Turns view.
        if (this.#storeSeen && this.#lastStore !== store) this.#resetConversationState()
        this.#storeSeen = true
        this.#lastStore = store
        if (this.#settingsEl) {
          this.#settingsEl.schema = schema
          this.#settingsEl.store = store
        }
        this.#rewireAllSections(store)
        this.#updateLibraries(libraries)
        this.#syncConversationConfig(store)
        this.#rewireContext(store)
      })
    })
  }

  protected disconnected(): void {
    for (const unsubscribe of this.#unsubscribes.values()) unsubscribe()
    this.#unsubscribes.clear()
    this.#modelGridUnsub?.()
    this.#modelGridUnsub = undefined
    this.#contextUnsub?.()
    this.#contextUnsub = undefined
    this.#layoutObserver?.disconnect() // TKT-0085 — otherwise the observer outlives the element (a real leak: it holds a live reference to `this`)
    this.#layoutObserver = null
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
    // TKT-0045: the composer has a genuine content-driven minimum — since the TKT-0058 v2 unroll that
    // is ui-conversation-composer's OWN field frame (its 20ch entry-control min-inline-size floor,
    // ADR-0021, plus frame padding/margins and the options row's picker pills + icon buttons) — below
    // it, ui-conversation's own `overflow-x: hidden` clips the composer with no scrollbar (invisible,
    // not just tight; re-verified against v2 by agent-admin.browser.test.ts's no-horizontal-overflow
    // probe). ui-split-pane's generic --ui-split-pane-min (4rem) knows nothing about this pane's
    // specific content; giving the pane a real `min` lets ui-split's own flex resolution (SPEC-R2)
    // respect that floor instead of squeezing past it.
    canvasPane.setAttribute('min', '16rem')
    const conversation = new UIConversationElement()
    conversation.onSubmit((text) => this.#handleSubmit(text))
    // Models picker → the SAME persisted `model` store key the settings pane's own generated field reads/
    // writes (one source of truth, TKT-0021's own external-store-write precedent) — `#syncConversationConfig`'s
    // subscription feeds the committed value back down into `conversation.model` (props down, callbacks up).
    conversation.onModelChange((id) => this.store?.set('model', id))
    // Effort picker → ephemeral element state only (no persisted counterpart) — write-then-reflect
    // immediately, since nothing external can also change it the way another tab's store write could.
    conversation.onEffortChange((id) => {
      this.#effort = id as EffortLevel
      conversation.effort = this.#effort
    })
    // Surface client messages (an action click inside a mounted ui-surface-host, bubbled per LLD-C4) run
    // the NEXT surface turn — the Hit/Stand loop (TKT-0076). Callback registration, never a CustomEvent
    // (SPEC-R5). A no-op unless the surface arm is armed (the stub/text arms mount no surfaces anyway).
    conversation.onClientMessage((message) => {
      if (this.agentSurfaceTurn === undefined) return
      this.#runSurfaceTurn({ kind: 'client', message })
    })
    // Vision rev.6 — the Markdown surface rides ui-conversation's SPEC-R12 content-render seam: agent
    // notes/system bubbles render through <ui-markdown> (sanitized by construction) while the switch is
    // ON, and fall back to a plain text node (the frame's own "simple text is fallback") when OFF. The
    // store is read FRESH per render — the live-apply law; flipping the switch changes the NEXT bubble.
    conversation.setContentRenderer((text) => {
      if (!isEnabledFlag(this.store?.get(SURFACE_MARKDOWN_KEY))) return document.createTextNode(text)
      const node = document.createElement('ui-markdown') as HTMLElement & { markdown: string }
      node.markdown = text
      return node
    })
    canvasPane.append(conversation)

    // ── Vision rev.5 (Kim's Figma frame 33:1693): the right side is ONE tabbed region — Settings (the
    // whole config column) ⇄ Context: System ⇄ Context: Dialog (the read-only introspection surface,
    // GH #161 — split from the old single combined "Context" tab into two, one per accordion section:
    // Agent System and Dialog Turns). The old three-pane wide layout (chat | prompts | settings) and its
    // medium two-tab collapse both dissolve into this ONE split shape; the prompts pane's content merges
    // INTO the Settings column. ─────────────────────────────────────────────────────────────────────────
    const tabsPane = document.createElement('ui-split-pane')
    tabsPane.setAttribute('data-role', 'tabs')
    // The settings column's own field floor (TKT-0045 lineage — ui-settings' master-detail drill-in +
    // the widest generated control put it at ~280px; 20rem gives headroom across engines).
    tabsPane.setAttribute('min', '20rem')
    const rightTabs = document.createElement('ui-tabs')
    // #14 / ADR-0144 Q1: `fill` = the shipped [pinned tablist | internally-scrolling active panel]
    // posture; the panel's scrollbar rides the `--ui-tabs-panel-scrollbar-width` seam (agent-admin.css).
    rightTabs.setAttribute('fill', '')
    const settingsTab = document.createElement('ui-tab')
    settingsTab.setAttribute('key', 'settings')
    settingsTab.textContent = 'Settings'
    const contextSystemTab = document.createElement('ui-tab')
    contextSystemTab.setAttribute('key', 'context-system')
    contextSystemTab.textContent = 'Context: System'
    const contextDialogTab = document.createElement('ui-tab')
    contextDialogTab.setAttribute('key', 'context-dialog')
    contextDialogTab.textContent = 'Context: Dialog'
    const settingsPanel = document.createElement('ui-tab-panel')
    const contextSystemPanel = document.createElement('ui-tab-panel')
    const contextDialogPanel = document.createElement('ui-tab-panel')
    rightTabs.append(settingsTab, contextSystemTab, contextDialogTab, settingsPanel, contextSystemPanel, contextDialogPanel)
    tabsPane.append(rightTabs)

    // The Settings tab's content unit — the Agent header row (heading + the ACTIVE master switch, Kim's
    // ruling: "the agent master toggle is just if the agent is active/available or not"), the ui-settings
    // card, the model grid, the prompt sections (the old prompts pane, merged in), and the capability
    // sections — ONE reparent-able node (the TKT-0085 wrapper discipline).
    const agentHeader = document.createElement('div')
    agentHeader.setAttribute('data-part', 'agent-header')
    const agentHeading = document.createElement('h3')
    agentHeading.setAttribute('data-part', 'agent-heading')
    agentHeading.textContent = 'Agent'
    const agentSwitch = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
    agentSwitch.setAttribute('data-part', 'agent-enabled')
    agentSwitch.setAttribute('aria-label', 'Agent active')
    agentSwitch.checked = true
    agentSwitch.addEventListener('change', () => {
      this.store?.set(AGENT_ENABLED_KEY, agentSwitch.checked)
      // A no-subscribe store never notifies — apply the composer gate + context view directly (the
      // #updateEntries fallback discipline); with a subscription the callback does both (idempotent).
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#agentSwitch = agentSwitch
    agentHeader.append(agentHeading, agentSwitch)
    const settingsEl = new UISettingsElement()
    // Event-boundary guard (the settings.ts `md`/`rail` precedent, same rationale): `settingsEl` is an
    // internal composition detail — its own bubbling `select`/`change` (a section switch) must not reach
    // a listener on THIS element, which owns no event vocabulary of its own (descriptor `events: []`).
    settingsEl.addEventListener('select', (event) => event.stopPropagation())
    settingsEl.addEventListener('change', (event) => event.stopPropagation())
    const settingsContent = document.createElement('div')
    settingsContent.setAttribute('data-role', 'settings-content')
    // The Model GRID (Kim, 2026-07-19 rev.2): its own heading + card host, sitting between the Agent
    // form card and the prompt/capability sections. Content renders/rerenders from the store.
    const modelHeading = document.createElement('h3')
    modelHeading.setAttribute('data-part', 'model-grid-heading')
    modelHeading.textContent = 'Model'
    const modelGrid = document.createElement('div')
    modelGrid.setAttribute('data-part', 'model-grid')
    this.#modelGrid = modelGrid
    const promptSections = this.#makeSection(ENTRY_KINDS.promptSection, 'Instructions', 'Add section')

    // ── Surface Options (vision rev.6 — the frame's node 34:1312): the agent's output-modality card,
    // after the prompt sections (the frame's own Agent-card order), before the capability sections.
    // Rows build ONCE; their state is (re)applied by #applyMasterStates (the master-switch discipline).
    const surfaceHeading = document.createElement('h3')
    surfaceHeading.setAttribute('data-part', 'surface-options-heading')
    surfaceHeading.textContent = 'Surface Options'
    const surfaceOptions = document.createElement('div')
    surfaceOptions.setAttribute('data-part', 'surface-options')

    // GH #138 (row-pattern standardization, Kim's option-A ruling): switch leads, label next, a
    // flexible spacer, then trailing action/selection content pinned to the right edge — every
    // `surfaceRow` and its caller-appended trailing content (catalog select / note) follows this.
    const surfaceRow = (surface: string, label: string, title: string): { row: HTMLElement; toggle: HTMLElement & { checked: boolean; disabled: boolean } } => {
      const row = document.createElement('div')
      row.setAttribute('data-part', 'surface-row')
      row.setAttribute('data-surface', surface)
      const toggle = document.createElement('ui-switch') as HTMLElement & { checked: boolean; disabled: boolean }
      toggle.setAttribute('data-part', 'surface-toggle')
      toggle.setAttribute('aria-label', `${label} surface`)
      toggle.checked = true
      const rowLabel = document.createElement('span')
      rowLabel.setAttribute('data-part', 'surface-label')
      rowLabel.textContent = label
      rowLabel.title = title
      const spacer = document.createElement('span')
      spacer.setAttribute('data-part', 'surface-spacer')
      row.append(toggle, rowLabel, spacer)
      return { row, toggle }
    }

    const markdown = surfaceRow('markdown', 'Markdown', 'Rendered as rich text — simple text is the fallback')
    markdown.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_MARKDOWN_KEY, markdown.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceMarkdownSwitch = markdown.toggle

    const a2ui = surfaceRow('a2ui', 'A2UI', 'Structured generative UI against the picked catalog')
    a2ui.toggle.addEventListener('change', () => {
      this.store?.set(SURFACE_A2UI_KEY, a2ui.toggle.checked)
      this.#applyMasterStates(this.store)
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceA2uiSwitch = a2ui.toggle
    // The catalog picker (one option today — agent-admin-schema.ts's A2UI_CATALOG_OPTIONS doc owns why).
    const catalogSelect = document.createElement('ui-select') as HTMLElement & { value: string; disabled: boolean }
    catalogSelect.setAttribute('data-part', 'surface-catalog')
    catalogSelect.setAttribute('aria-label', 'A2UI catalog')
    for (const option of A2UI_CATALOG_OPTIONS) {
      const optionEl = document.createElement('div')
      optionEl.setAttribute('role', 'option')
      optionEl.setAttribute('value', option.id)
      optionEl.textContent = option.label
      catalogSelect.append(optionEl)
    }
    // ui-select's ONLY commit event is `select` (select.md; the settings generator's own COMMIT_EVENT law).
    catalogSelect.addEventListener('select', () => {
      this.store?.set(A2UI_CATALOG_KEY, sanitizeCatalog(catalogSelect.value))
      if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
    })
    this.#surfaceCatalogSelect = catalogSelect
    a2ui.row.append(catalogSelect)

    const genui = surfaceRow('genui', 'GenUI', 'Pattern-sourced generative UI — PRD pending (genui-surface.prd.md)')
    genui.toggle.checked = false
    genui.toggle.disabled = true // PRD-gated: .claude/docs/prd/genui-surface.prd.md owns the five open forks
    genui.row.setAttribute('data-disabled', '')
    const genuiNote = document.createElement('span')
    genuiNote.setAttribute('data-part', 'surface-note')
    genuiNote.textContent = 'PRD pending'
    genuiNote.title = 'Ships after .claude/docs/prd/genui-surface.prd.md ratifies (pattern source picker).'
    genui.row.append(genuiNote)

    surfaceOptions.append(markdown.row, a2ui.row, genui.row)

    settingsContent.append(agentHeader, settingsEl, modelHeading, modelGrid, promptSections.host, surfaceHeading, surfaceOptions)
    for (const { kind, label, addLabel } of CAPABILITY_KINDS) {
      // The kind's MASTER switch (vision rev.5) — rendered in the section's header row; `false` gates
      // the whole kind out of the composed prompt + the live roster (isEnabledFlag: default ON).
      const kindSwitch = document.createElement('ui-switch') as HTMLElement & { checked: boolean }
      kindSwitch.setAttribute('data-part', 'kind-enabled')
      kindSwitch.setAttribute('aria-label', `${label} enabled`)
      kindSwitch.checked = true
      kindSwitch.addEventListener('change', () => {
        this.store?.set(kindEnabledKey(kind), kindSwitch.checked)
        this.#applyMasterStates(this.store)
        if (this.store !== undefined && this.store.subscribe === undefined) this.#renderContextSystem()
      })
      this.#kindSwitches.set(kind, kindSwitch)
      const section = this.#makeSection(kind, label, addLabel, kindSwitch)
      settingsContent.append(section.host)
    }

    // GH #161 — the old single Context tab's ONE content unit (two accordion groups stacked) split into
    // TWO content units, one accordion each: `#contextSystemContent` (Agent System — what the agent
    // actually sees, derived fresh from the store per change) and `#contextDialogContent` (Dialog Turns —
    // the per-turn request/response JSON log, newest first). Each is its own reparent-able node (the
    // TKT-0085 wrapper discipline, unchanged) — `data-role`s renamed accordingly. The accordion SHELLS
    // build ONCE; their bodies are render slots rebuilt wholesale (#renderContextSystem / #renderContextTurns),
    // completely unaffected by which tab now hosts them.
    const contextSystemContent = document.createElement('div')
    contextSystemContent.setAttribute('data-role', 'context-system-content')
    const systemSection = document.createElement('ui-disclosure') as HTMLElement & { open: boolean; summary: string }
    systemSection.setAttribute('data-part', 'context-section')
    systemSection.setAttribute('data-section', 'agent-system')
    systemSection.setAttribute('summary', 'Agent System')
    systemSection.setAttribute('open', '')
    const contextSystemHost = document.createElement('div')
    contextSystemHost.setAttribute('data-part', 'context-system')
    systemSection.append(contextSystemHost)
    this.#contextSystemHost = contextSystemHost
    contextSystemContent.append(systemSection)

    const contextDialogContent = document.createElement('div')
    contextDialogContent.setAttribute('data-role', 'context-dialog-content')
    const turnsSection = document.createElement('ui-disclosure') as HTMLElement & { open: boolean; summary: string }
    turnsSection.setAttribute('data-part', 'context-section')
    turnsSection.setAttribute('data-section', 'dialog-turns')
    turnsSection.setAttribute('summary', 'Dialog Turns')
    turnsSection.setAttribute('open', '')
    const contextTurnsHost = document.createElement('div')
    contextTurnsHost.setAttribute('data-part', 'context-turns')
    turnsSection.append(contextTurnsHost)
    this.#contextTurnsHost = contextTurnsHost
    contextDialogContent.append(turnsSection)

    // The split shell is the DEFAULT visible state until the first measurement lands (the TKT-0085
    // discipline — the old code appended the content units into the wide panes right here too): every
    // content unit STARTS in its split-layout tab panel, so a consumer that queries synchronously
    // after append (and the pre-RO first paint) sees the real default shape; `#applyLayout` then MOVES
    // them only on a genuine narrow crossing.
    settingsPanel.append(settingsContent)
    contextSystemPanel.append(contextSystemContent)
    contextDialogPanel.append(contextDialogContent)

    split.append(canvasPane, tabsPane)
    this.append(split)

    // ── The narrow (all-tabs) shell — built ONCE alongside the split shell above, starting EMPTY:
    // `#applyLayout` moves `conversation`/`settingsContent`/`contextSystemContent`/`contextDialogContent`
    // into whichever shell the resolved layout actually uses. GH #161's narrow-mode fork: narrow mode
    // gets a FOURTH top-level tab here (Chat/Settings/Context: System/Context: Dialog) rather than
    // nesting the split under one narrow "Context" tab — narrow mode is a flat re-parenting of the SAME
    // content units into a differently-organized `ui-tabs` (this is exactly what it already does for
    // Chat and Settings: one wide tab, one matching narrow tab, one content unit moved whole between
    // them — see `#applyLayout`'s own doc comment). Nesting Context alone would introduce a sub-tab-set
    // shape that exists NOWHERE else in this file, purely to keep narrow mode's top-level tab count at 3;
    // the flat 4-tab shape costs nothing (the tab strip already scrolls/wraps under `fill`) and keeps
    // every tab behaving identically across the wide/narrow boundary. ────────────────────────────────────
    const narrowTabs = document.createElement('ui-tabs')
    narrowTabs.setAttribute('fill', '') // #14 / ADR-0144 Q1 — the same shipped `fill` posture as the split shell
    narrowTabs.hidden = true // the split shell above is the DEFAULT visible state until the first measurement
    const narrowChatTab = document.createElement('ui-tab')
    narrowChatTab.setAttribute('key', 'chat')
    narrowChatTab.textContent = 'Chat'
    const narrowSettingsTab = document.createElement('ui-tab')
    narrowSettingsTab.setAttribute('key', 'settings')
    narrowSettingsTab.textContent = 'Settings'
    const narrowContextSystemTab = document.createElement('ui-tab')
    narrowContextSystemTab.setAttribute('key', 'context-system')
    narrowContextSystemTab.textContent = 'Context: System'
    const narrowContextDialogTab = document.createElement('ui-tab')
    narrowContextDialogTab.setAttribute('key', 'context-dialog')
    narrowContextDialogTab.textContent = 'Context: Dialog'
    const narrowChatPanel = document.createElement('ui-tab-panel')
    const narrowSettingsPanel = document.createElement('ui-tab-panel')
    const narrowContextSystemPanel = document.createElement('ui-tab-panel')
    const narrowContextDialogPanel = document.createElement('ui-tab-panel')
    narrowTabs.append(
      narrowChatTab,
      narrowSettingsTab,
      narrowContextSystemTab,
      narrowContextDialogTab,
      narrowChatPanel,
      narrowSettingsPanel,
      narrowContextSystemPanel,
      narrowContextDialogPanel,
    )
    this.append(narrowTabs)

    this.#split = split
    this.#conversation = conversation
    this.#settingsEl = settingsEl
    this.#canvasPane = canvasPane
    this.#tabsPane = tabsPane
    this.#settingsPanel = settingsPanel
    this.#contextSystemPanel = contextSystemPanel
    this.#contextDialogPanel = contextDialogPanel
    this.#narrowTabs = narrowTabs
    this.#narrowChatPanel = narrowChatPanel
    this.#narrowSettingsPanel = narrowSettingsPanel
    this.#narrowContextSystemPanel = narrowContextSystemPanel
    this.#narrowContextDialogPanel = narrowContextDialogPanel
    this.#settingsContent = settingsContent
    this.#contextSystemContent = contextSystemContent
    this.#contextDialogContent = contextDialogContent
  }

  /**
   * TKT-0085 — reconcile the composed shell's DOM shape to `layout`. Idempotent (a same-layout call is a
   * no-op) and content-PRESERVING for its DOM identity: `#conversation`/`#instructionsContent`/
   * `#agentContent` are MOVED (plain `append()`), never cloned or rebuilt, into whichever pane/tab-panel
   * the target layout uses (the `master-detail.ts` "relocate a whole pane" idiom, generalized from 2
   * possible homes to 3 per content unit).
   *
   * component-reviewer MAJOR fix: every move below is GUARDED (`if (node.parentElement !== target)`) —
   * an UNguarded `append()`/`replaceChildren()` cycles `disconnectedCallback`+`connectedCallback` even
   * when the node is ALREADY exactly where it needs to be (verified: a real Chromium/WebKit probe showed
   * this for both same-parent re-append AND `replaceChildren()` re-listing an already-present child), so
   * the FIRST draft's unconditional calls were closing `#conversation`'s open A2UI surfaces on EVERY
   * band crossing, including wide↔medium — contradicting this feature's own design intent ("Chat stays
   * its own split pane" in medium). `#split`'s pane SET is reconciled the same way (remove what's no
   * longer wanted, add what's missing, leave what's already correct untouched) so `#canvasPane` — a
   * member of BOTH the wide and medium pane sets — is never removed-then-re-added crossing between them.
   * `#conversation` still disconnects+reconnects (closing any open surface) crossing INTO/OUT OF
   * `narrow` specifically, since `#canvasPane` itself is not a narrow-layout pane and must genuinely
   * leave/rejoin `#split`'s children there — see the ticket's Findings for why a `moveBefore`-based
   * dodge of that ONE remaining case was tried and reverted (the corrected account, not the first
   * draft's misdiagnosis: `moveBefore` provides no benefit here at all — this fleet has no
   * `connectedMoveCallback` support, so it cycles the SAME lifecycle callbacks as `append()`, and a
   * probe found the ORIGINAL narrow branch's detach-before-move ordering could throw
   * `HierarchyRequestError` — zero callbacks fire on a THROW, which is what actually produced the
   * reported "silent, callback-free content loss").
   */
  #applyLayout(layout: AgentAdminLayout): void {
    if (layout === this.#currentLayout) return
    this.#currentLayout = layout
    const split = this.#split as HTMLElement
    const canvasPane = this.#canvasPane as HTMLElement
    const tabsPane = this.#tabsPane as HTMLElement
    const narrowTabs = this.#narrowTabs as HTMLElement
    const conversation = this.#conversation as UIConversationElement
    const settingsContent = this.#settingsContent as HTMLElement
    const contextSystemContent = this.#contextSystemContent as HTMLElement
    const contextDialogContent = this.#contextDialogContent as HTMLElement

    const moveInto = (node: Element, target: Element): void => {
      if (node.parentElement !== target) target.append(node)
    }

    if (layout === 'narrow') {
      moveInto(conversation, this.#narrowChatPanel as HTMLElement)
      moveInto(settingsContent, this.#narrowSettingsPanel as HTMLElement)
      moveInto(contextSystemContent, this.#narrowContextSystemPanel as HTMLElement)
      moveInto(contextDialogContent, this.#narrowContextDialogPanel as HTMLElement)
      if (split.children.length > 0) split.replaceChildren() // guarded: an already-empty split needs no mutation
      split.hidden = true
      narrowTabs.hidden = false
    } else {
      // Vision rev.5 + GH #161: ONE non-narrow shape — [ chat | {Settings, Context: System, Context:
      // Dialog} tabs ]. The pane set is reconciled (never blind-rebuilt) so a narrow→split crossing
      // re-adds both panes while a same-layout call touches nothing (the TKT-0085 guarded-move
      // discipline, unchanged).
      const desiredPanes = [canvasPane, tabsPane]
      for (const child of [...split.children]) {
        if (child.tagName === 'UI-SPLIT-PANE' && !desiredPanes.includes(child as HTMLElement)) child.remove()
      }
      for (const pane of desiredPanes) moveInto(pane, split)
      split.hidden = false
      narrowTabs.hidden = true
      moveInto(conversation, canvasPane)
      moveInto(settingsContent, this.#settingsPanel as HTMLElement)
      moveInto(contextSystemContent, this.#contextSystemPanel as HTMLElement)
      moveInto(contextDialogContent, this.#contextDialogPanel as HTMLElement)
    }
  }

  /** Build ONE entry-list section wired to THIS element's store — the ONE shared mechanism every
   *  instantiation (prompt sections + all four capability kinds) reuses (ADR-0132 cl.1). Registers the
   *  result in `#capabilitySections` (keyed by `kind`, prompt sections included) so
   *  `#rewireAllSections`/`#handleSubmit` can iterate uniformly. */
  #makeSection(kind: string, label: string, addLabel: string, headerControl?: HTMLElement): EntryListSection {
    const section = mountEntryList(
      kind,
      label,
      addLabel,
      {
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
      },
      // GH #47/#48 — this kind's library packs, captured at compose time (the sections' build-once law;
      // the `libraries` prop doc names the set-before-append requirement). `headerControl` (vision
      // rev.5) is the kind's caller-wired master switch, placed in the section's header row.
      { libraries: this.libraries?.[kind], headerControl },
    )
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

  /** GH #143 — rebuild each CAPABILITY kind's add-from-library menu from `libraries`' CURRENT contents.
   *  Runs on every `connected()` effect tick (a fresh connect and a real `libraries` reassignment alike) —
   *  cheap (a handful of menu rows per kind) and idempotent, the `#rewireAllSections` precedent. Prompt
   *  sections never carry a library pack (only the four capability kinds do — `#makeSection`'s own
   *  `{ libraries: this.libraries?.[kind] }` wiring), so this loop is scoped to `CAPABILITY_KINDS`. */
  #updateLibraries(libraries: Record<string, readonly EntryLibraryPack[]> | undefined): void {
    for (const { kind } of CAPABILITY_KINDS) {
      this.#capabilitySections.get(kind)?.updateLibraries(libraries?.[kind] ?? [])
    }
  }

  /** Feed the composer's Models/Effort pickers from THIS element's own current config (the Figma
   *  chat-input refactor) — `models`/`efforts` are static option lists (no re-render cost in setting them
   *  every call); `model` re-derives from `store`'s CURRENT value (the SAME `sanitizeSelect`/fail-closed
   *  guard `#handleSubmit`'s own config snapshot uses) and re-arms a subscription so an EXTERNAL write to
   *  `model` (the settings pane's own field, another tab, TKT-0021's own precedent) also reflects into the
   *  picker — one source of truth, not a second parallel selection. Shares `#unsubscribes` with
   *  `#rewireAllSections` (called first, same effect tick) — that method's own unconditional clear-then-
   *  rebuild at the top of every call is what keeps this subscription from leaking across re-runs. */
  /** (Re)build the Model GRID from the store's CURRENT contents (Kim, 2026-07-19 rev.2): rows grouped
   *  by provider, each `[ label | include ui-switch | default ui-checkbox ]`. Wholesale rebuild per
   *  change (the entry-list render precedent — listeners are per-render, no re-arm bookkeeping).
   *  Semantics: the DEFAULT checkbox is radio-like (checking a row moves the default there; unchecking
   *  the current default is a no-op — a roster always has a default); the default row's include switch
   *  is locked ON (the default is always offered). */
  #renderModelGrid(): void {
    const host = this.#modelGrid
    const store = this.store
    if (!host) return
    const roster = modelRoster()
    const included = store?.get(MODELS_INCLUDED_KEY)
    const current = sanitizeModel(store?.get('model'), roster)
    host.replaceChildren()
    for (const provider of [...new Set(roster.map((m) => m.provider))]) {
      const providerLabel = document.createElement('div')
      providerLabel.setAttribute('data-part', 'model-provider')
      providerLabel.textContent = provider
      host.append(providerLabel)
      for (const model of roster.filter((m) => m.provider === provider)) {
        const row = document.createElement('div')
        row.setAttribute('data-part', 'model-row')
        if (model.id === current) row.setAttribute('data-default', '')

        const label = document.createElement('span')
        label.setAttribute('data-part', 'model-row-label')
        label.textContent = model.label
        label.title = model.id

        const include = document.createElement('ui-switch') as HTMLElement & { checked: boolean; disabled: boolean }
        include.setAttribute('data-part', 'model-include')
        include.setAttribute('aria-label', `Include ${model.label}`)
        include.checked = isModelIncluded(included, model)
        // The default is ALWAYS offered — its include switch locks on (checked + disabled).
        if (model.id === current) {
          include.checked = true
          include.disabled = true
        }
        include.addEventListener('change', () => {
          const record = { ...((store?.get(MODELS_INCLUDED_KEY) as Record<string, boolean> | undefined) ?? {}) }
          record[model.id] = include.checked
          store?.set(MODELS_INCLUDED_KEY, record)
          if (store !== undefined && store.subscribe === undefined) this.#renderModelGrid() // the #updateEntries no-subscribe fallback
        })

        const isDefault = document.createElement('ui-radio') as HTMLElement & { checked: boolean }
        isDefault.setAttribute('data-part', 'model-default')
        isDefault.setAttribute('name', 'model-default') // one logical radio SYSTEM across the provider groups
        isDefault.setAttribute('aria-label', `Default: ${model.label}`)
        isDefault.checked = model.id === current
        isDefault.addEventListener('change', () => {
          if (isDefault.checked) {
            // Moving the default also re-includes the row (the always-offered law) — one write each,
            // the store's own notifications re-render the grid (radio semantics fall out of the render).
            const record = { ...((store?.get(MODELS_INCLUDED_KEY) as Record<string, boolean> | undefined) ?? {}) }
            if (record[model.id] === false) {
              record[model.id] = true
              store?.set(MODELS_INCLUDED_KEY, record)
            }
            store?.set('model', model.id)
            if (store !== undefined && store.subscribe === undefined) this.#renderModelGrid()
          } else {
            // A grouped radio can't untoggle, but a STANDALONE Indicator-class radio can (pressActivation
            // toggles) — the restore guard keeps "a roster always has a default" true regardless.
            this.#renderModelGrid()
          }
        })

        row.append(label, include, isDefault)
        host.append(row)
      }
    }
  }

  #syncConversationConfig(store: SettingsStore | undefined): void {
    const conversation = this.#conversation
    if (!conversation) return
    conversation.efforts = EFFORT_LEVELS
    conversation.effort = this.#effort
    const renderModel = (): void => {
      // The picker offers the INCLUDED roster only (the Model grid's switches, 2026-07-19 rev.2); the
      // committed default always stays offered — the grid disables excluding it, and sanitizeModel
      // falls back to DEFAULT_MODEL_ID for anything off-roster.
      const roster = modelRoster()
      const included = store?.get(MODELS_INCLUDED_KEY)
      conversation.models = roster.filter((m) => isModelIncluded(included, m))
      conversation.model = sanitizeModel(store?.get('model'), roster)
    }
    renderModel()
    const unsubscribe = store?.subscribe?.((key) => {
      if (key === 'model' || key === MODELS_INCLUDED_KEY) renderModel()
    })
    if (unsubscribe) this.#unsubscribes.set('model', unsubscribe)
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
    // Vision rev.5 — the Agent master switch ("active/available or not", Kim's ruling): the composer is
    // already busy-disabled via `conversation.disabled`, so this is the belt (a programmatic submit).
    if (!isEnabledFlag(store?.get(AGENT_ENABLED_KEY))) return

    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    const systemPrompt = composeSystemPrompt(sections)
    // A kind whose MASTER switch is off contributes NOTHING — the section-header toggle wins over
    // per-entry toggles (vision rev.5, generalizing the old tools-only boolean).
    const enabledLabels = (kind: string): string[] =>
      isEnabledFlag(store?.get(kindEnabledKey(kind)))
        ? readEntries(store, kind)
            .filter((e) => e.enabled)
            .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
            .map((e) => e.label)
        : []

    const config: AgentConfigSnapshot = {
      name: typeof store?.get('name') === 'string' ? (store.get('name') as string) : 'Untitled agent',
      model: sanitizeModel(store?.get('model'), modelRoster()),
      temperature: sanitizeNumber(schema, 'temperature', store?.get('temperature'), 0.5),
      toolsEnabled: isEnabledFlag(store?.get(kindEnabledKey(ENTRY_KINDS.tool))),
      systemPrompt,
      skills: enabledLabels(ENTRY_KINDS.skill),
      workflows: enabledLabels(ENTRY_KINDS.workflow),
      resources: enabledLabels(ENTRY_KINDS.resource),
      tools: enabledLabels(ENTRY_KINDS.tool),
    }

    // The SURFACE arm (TKT-0076) — takes precedence when armed AND the A2UI surface is on (vision
    // rev.6: switching the modality off bypasses even an armed runner — the prose arm answers instead).
    if (this.agentSurfaceTurn !== undefined && isEnabledFlag(store?.get(SURFACE_A2UI_KEY))) {
      this.#runSurfaceTurn({ kind: 'intent', text })
      return
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
      this.#logTurn('stub', { text, config }, { reply })
      return
    }

    // Live arm (DEV-only, injected). The system prompt is rebuilt FRESH here (with the capability
    // projection, ADR-0136 Fork 3) and never stored in history; `history` carries PRIOR turns only, so a
    // mid-conversation config switch applies next-turn-only by construction (Q4). The in-flight busy-lock
    // (TKT-0034, auto-tracked off beginAgentTurn) disables the composer until finalize()/fail() runs.
    const request: AdminTurnRequest = {
      text,
      system: composeLiveSystemPrompt(sections, this.#capabilityGroups(store)),
      model: config.model,
      effort: this.#effort,
      history: [...this.#history],
    }
    void (async () => {
      try {
        const reply = await agentTurn(request)
        handle.setNote(reply)
        handle.finalize()
        this.#recordTurn(text, reply)
        this.#logTurn('live', request, { reply })
      } catch (err) {
        // A network/provider fault, a non-2xx proxy response, or the runner's 120s timeout: surface it
        // visibly (an error narration entry + a "⚠ …" system bubble, composer re-enabled) — never a crash
        // or a silent swallow (SPEC-R6 AC3 path, the shipped ui-conversation affordance). The failed
        // exchange is NOT recorded into history — there is no assistant reply to pair. It IS logged to
        // the Dialog Turns view (a failure is exactly what a payload inspector exists to show).
        const message = err instanceof Error ? err.message : String(err)
        handle.fail(message)
        this.#logTurn('live', request, { error: message })
      }
    })()
  }

  /** One SURFACE turn (TKT-0076/ADR-0138): stream the injected runner's typed events — every `line` is a
   *  validated A2UI wire message fed to `ingestLine` (fresh surfaceId ⇒ a new inline ui-surface-host in
   *  this turn's bubble; known ⇒ routed to its ORIGINAL host, ADR-0129 — the Croupier's one-table game);
   *  the peeled `note` renders via setNote at finalize. The persona + model are FRESH store reads (the
   *  live-apply law); the runner owns the transport-side session/history (SPEC-N1 — the component never
   *  sees a transport type). Errors surface through the fail path, exactly the text arm's discipline. */
  #runSurfaceTurn(turn: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown }): void {
    const conversation = this.#conversation
    const surfaceTurn = this.agentSurfaceTurn
    if (!conversation || surfaceTurn === undefined) return
    const store = this.store
    // The Agent master switch gates surface turns too — BOTH kinds: a typed intent and a surface action
    // click (an inactive agent runs nothing, Kim's ruling). The A2UI surface switch gates the same way
    // (vision rev.6): a disabled modality runs no hidden turns, not even from an action click.
    if (!isEnabledFlag(store?.get(AGENT_ENABLED_KEY))) return
    if (!isEnabledFlag(store?.get(SURFACE_A2UI_KEY))) return
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    const toolsEnabled = isEnabledFlag(store?.get(kindEnabledKey(ENTRY_KINDS.tool)))
    const request = {
      turn,
      personaSystem: composeLiveSystemPrompt(sections, this.#capabilityGroups(store)),
      model: sanitizeModel(store?.get('model'), modelRoster()),
      // Vision rev.6 — the catalog picker's sanitized selection (see AdminSurfaceTurnRequest.catalogId).
      catalogId: sanitizeCatalog(store?.get(A2UI_CATALOG_KEY)),
      // GH #49 — the ENABLED tool entries' labels, master-gated on toolsEnabled (the SAME switch that
      // gates the tool kind's prompt projection): the proxy intersects with its registry; non-registry
      // labels are inert. A FRESH store read (the live-apply law).
      integrations: toolsEnabled
        ? readEntries(store, ENTRY_KINDS.tool)
            .filter((entry) => entry.enabled)
            .map((entry) => entry.label)
        : [],
    }
    // TKT-0079 — an action-click/error turn RESUMES the bubble owning its surface (the game loop stays in
    // one card); a typed intent stays a fresh bubble (its reply must not appear above the question).
    const handle = conversation.beginAgentTurn(
      turn.kind === 'client' ? { intoSurface: clientMessageSurfaceId(turn.message) } : undefined,
    )
    void (async () => {
      const wireLines: string[] = []
      let note: string | undefined
      try {
        for await (const event of surfaceTurn(request)) {
          if (event.kind === 'note') note = event.note
          else if (event.kind === 'progress') handle.progress(event.progress) // ADR-0146 F1 — live narration
          else {
            wireLines.push(event.line)
            handle.ingestLine(event.line)
          }
        }
        if (note !== undefined) handle.setNote(note)
        handle.finalize()
        this.#logTurn('surface', request, { note, lines: wireLines })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        handle.fail(message)
        this.#logTurn('surface', request, { error: message, lines: wireLines })
      }
    })()
  }

  /** Each capability kind's raw store slice + its live `##` group heading + its MASTER switch (vision
   *  rev.5), for `composeLiveSystemPrompt` (which does the enabled-filter/sort/master-gate itself). */
  #capabilityGroups(store: SettingsStore | undefined): LiveCapabilityGroup[] {
    return CAPABILITY_KINDS.map(({ kind, liveHeading }) => ({
      kind,
      heading: liveHeading,
      entries: readEntries(store, kind),
      enabled: isEnabledFlag(store?.get(kindEnabledKey(kind))),
    }))
  }

  // ── vision rev.5: master-state application + the Context tabs' renderers ────────────────────────────

  /** (Re-)apply the master states + (re-)render both Context tabs + (re-)arm their shared store
   *  subscription — the Agent System view reads nearly every key (name/model/temperature, the master toggles,
   *  all five entry lists) and writes are commit-time (never per-keystroke), so an unfiltered wholesale
   *  re-render per store write is the honest cheap option. Its OWN teardown slot (the #modelGridUnsub
   *  precedent — it must outlive `#rewireAllSections`' clears); re-armed per store (re)assignment via
   *  the connected() effect, torn down in disconnected(). */
  #rewireContext(store: SettingsStore | undefined): void {
    this.#applyMasterStates(store)
    this.#renderContextSystem()
    this.#renderContextTurns()
    this.#contextUnsub?.()
    this.#contextUnsub = store?.subscribe?.(() => {
      this.#applyMasterStates(store) // keeps the header switches honest on EXTERNAL writes too
      this.#renderContextSystem()
    })
  }

  /** Reflect every master switch's STORED state onto its control + its gated surface — the Agent switch
   *  onto `conversation.disabled` (an inactive agent takes no input), each kind switch onto its section
   *  host's `data-kind-disabled` dim. Called at rewire time, from the context subscription (external
   *  writes), and directly from each switch's own change listener (the no-subscribe fallback). */
  #applyMasterStates(store: SettingsStore | undefined): void {
    const agentOn = isEnabledFlag(store?.get(AGENT_ENABLED_KEY))
    if (this.#agentSwitch) this.#agentSwitch.checked = agentOn
    if (this.#conversation) this.#conversation.disabled = !agentOn
    for (const { kind } of CAPABILITY_KINDS) {
      const on = isEnabledFlag(store?.get(kindEnabledKey(kind)))
      const kindSwitch = this.#kindSwitches.get(kind)
      if (kindSwitch) kindSwitch.checked = on
      this.#capabilitySections.get(kind)?.host.toggleAttribute('data-kind-disabled', !on)
    }
    // Vision rev.6 — the Surface Options rows reflect their stored state the same way; the catalog
    // picker disables while its modality is off (choosing a catalog for a surface that can't run is
    // noise, not configuration).
    if (this.#surfaceMarkdownSwitch) this.#surfaceMarkdownSwitch.checked = isEnabledFlag(store?.get(SURFACE_MARKDOWN_KEY))
    const a2uiOn = isEnabledFlag(store?.get(SURFACE_A2UI_KEY))
    if (this.#surfaceA2uiSwitch) this.#surfaceA2uiSwitch.checked = a2uiOn
    if (this.#surfaceCatalogSelect) {
      this.#surfaceCatalogSelect.value = sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))
      this.#surfaceCatalogSelect.disabled = !a2uiOn
    }
  }

  /** Rebuild the Agent System view (the Context: System tab) from the store's CURRENT contents:
   *  one `Agent` accordion (open by default — the vision frame's expanded JSON preview) carrying the
   *  compiled config + the EXACT live system prompt a turn would send, then one accordion per capability
   *  kind (closed by default — the frame's caret-right rows; Kim's ruling: accordion with nested
   *  elements). Wholesale rebuild per store change; each open/closed fold survives via a pre-rebuild
   *  state capture (`data-item` keyed). */
  #renderContextSystem(): void {
    const host = this.#contextSystemHost
    if (!host) return
    const store = this.store
    const schema = this.schema ?? defaultAgentConfigSchema
    const openStates = new Map<string, boolean>()
    for (const el of host.querySelectorAll<HTMLElement & { open: boolean }>('[data-part="context-item"]')) {
      openStates.set(el.getAttribute('data-item') ?? '', el.open)
    }
    const items: HTMLElement[] = []
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    items.push(
      contextItem(
        'agent',
        'Agent',
        {
          name: typeof store?.get('name') === 'string' ? (store.get('name') as string) : 'Untitled agent',
          model: sanitizeModel(store?.get('model'), modelRoster()),
          temperature: sanitizeNumber(schema, 'temperature', store?.get('temperature'), 0.5),
          effort: this.#effort,
          active: isEnabledFlag(store?.get(AGENT_ENABLED_KEY)),
          surface: {
            markdown: isEnabledFlag(store?.get(SURFACE_MARKDOWN_KEY)),
            a2ui: isEnabledFlag(store?.get(SURFACE_A2UI_KEY)),
            catalog: sanitizeCatalog(store?.get(A2UI_CATALOG_KEY)),
            genui: 'prd-pending', // .claude/docs/prd/genui-surface.prd.md
          },
          systemPrompt: composeLiveSystemPrompt(sections, this.#capabilityGroups(store)),
        },
        openStates.get('agent') ?? true,
      ),
    )
    for (const { kind, label } of CAPABILITY_KINDS) {
      items.push(
        contextItem(
          kind,
          label,
          {
            enabled: isEnabledFlag(store?.get(kindEnabledKey(kind))),
            entries: readEntries(store, kind).map((e) => ({ label: e.label, enabled: e.enabled, description: e.description })),
          },
          openStates.get(kind) ?? false,
        ),
      )
    }
    host.replaceChildren(...items)
  }

  /** Rebuild the Dialog Turns view (the Context: Dialog tab) from `#turnLog`, NEWEST FIRST with
   *  zero-padded descending numbers (the vision frame's 04→01). The newest turn's fold defaults open;
   *  older folds keep whatever state the user left them in (turn-number keyed capture). */
  #renderContextTurns(): void {
    const host = this.#contextTurnsHost
    if (!host) return
    const openStates = new Map<string, boolean>()
    for (const el of host.querySelectorAll<HTMLElement & { open: boolean }>('[data-part="context-turn"]')) {
      openStates.set(el.getAttribute('data-item') ?? '', el.open)
    }
    const items: HTMLElement[] = []
    const newest = this.#turnLog.at(-1)
    for (let i = this.#turnLog.length - 1; i >= 0; i -= 1) {
      const turn = this.#turnLog[i]!
      const label = String(turn.n).padStart(2, '0')
      const item = contextItem(`turn-${turn.n}`, label, { arm: turn.arm, request: turn.request, response: turn.response }, openStates.get(`turn-${turn.n}`) ?? turn === newest)
      item.setAttribute('data-part', 'context-turn')
      items.push(item)
    }
    host.replaceChildren(...items)
  }

  /** Append one turn's request/response to the Dialog Turns ring (every arm, failures included) and
   *  re-render the view. Bounded at TURN_LOG_CAP — the oldest records fall off. */
  #logTurn(arm: 'stub' | 'live' | 'surface', request: unknown, response: unknown): void {
    this.#turnCounter += 1
    this.#turnLog.push({ n: this.#turnCounter, arm, request, response })
    if (this.#turnLog.length > TURN_LOG_CAP) this.#turnLog.splice(0, this.#turnLog.length - TURN_LOG_CAP)
    this.#renderContextTurns()
  }

  /** Append one completed exchange to the multi-turn history (both arms). */
  #recordTurn(text: string, reply: string): void {
    const turns: AdminTurn[] = [
      { role: 'user', content: text },
      { role: 'assistant', content: reply },
    ]
    this.#history.push(...turns)
  }

  /** GH #145 — every piece of PER-PERSONA conversation state, cleared together on a real store
   *  reassignment: the visible chat log + any open A2UI surfaces (`ui-conversation.reset()`, the same
   *  method a consumer calls for a user-facing "start over"), the live-request `#history` ring (so a
   *  freshly-selected persona's first turn carries no prior persona's exchanges), and the Dialog Turns
   *  log (`#turnLog`/`#turnCounter`) the Context: Dialog tab's `#renderContextTurns` reads — the caller
   *  (the connected() effect) re-renders that view immediately after via `#rewireContext`. */
  #resetConversationState(): void {
    this.#conversation?.reset()
    this.#history = []
    this.#turnLog = []
    this.#turnCounter = 0
  }
}

/** TKT-0079 — the surface a client message belongs to (`action.surfaceId` / the error union's
 *  VALIDATION_FAILED arm), for routing the follow-up turn into that surface's OWNING bubble.
 *  `undefined` (e.g. INVALID_FUNCTION_CALL) ⇒ the fresh-bubble path. */
/** One Context-tab accordion item (vision rev.5): a `ui-disclosure` labeled `summary` whose body is the
 *  pretty-printed JSON of `value` — the frame's `[ header + caret | mono JSON preview ]` shape. Built
 *  fresh per render (the wholesale-rebuild law); `data-item` keys the open-state capture across
 *  rebuilds. Kim's ruling: carets are accordion behavior and may nest. */
function contextItem(key: string, summary: string, value: unknown, open: boolean): HTMLElement {
  const item = document.createElement('ui-disclosure') as HTMLElement & { open: boolean }
  item.setAttribute('data-part', 'context-item')
  item.setAttribute('data-item', key)
  item.setAttribute('summary', summary)
  if (open) item.setAttribute('open', '')
  const pre = document.createElement('pre')
  pre.setAttribute('data-part', 'context-json')
  pre.textContent = JSON.stringify(value, null, 2)
  item.append(pre)
  return item
}

function clientMessageSurfaceId(message: unknown): string | undefined {
  const m = message as { action?: { surfaceId?: unknown }; error?: { surfaceId?: unknown } } | null
  if (m && typeof m === 'object' && m.action && typeof m.action.surfaceId === 'string') return m.action.surfaceId
  if (m && typeof m === 'object' && m.error && typeof m.error.surfaceId === 'string') return m.error.surfaceId
  return undefined
}

if (!customElements.get('ui-agent-admin')) customElements.define('ui-agent-admin', UIAgentAdminElement)
