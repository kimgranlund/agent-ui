// composer-options.ts — the composer's opt-in picker/context-chip vocabulary (ui-conversation). Types +
// pure data only — conversation.ts owns the rendering, a consumer (e.g. ui-agent-admin) owns supplying
// its own option lists + selected value. Generic on purpose: `models` is inherently host-specific (each
// consumer names its own model list), so ui-conversation never hardcodes one; `effort` is a fleet-wide
// concept every live-model consumer can share, so its option list is built in here as the one default.

/** One picker's selectable entry — reused for the Models/Effort/Provider/Mode pickers alike. */
export interface PickerOption {
  id: string
  label: string
  /** GH #257 — a non-committable option, rendered but never selectable (`aria-disabled`, ui-menu's own
   *  click/keydown delegation already skips it, menu.ts). The "coming soon" provider precedent
   *  (provider-switcher.ts's `implemented:false` roadmap entries) — optional, unused by Models/Effort today. */
  disabled?: boolean
}

/** GH #257 — one selectable provider: its OWN model list (narrows the composer's Models picker while this
 *  provider is selected) and the model a provider switch resets to when the CURRENT model doesn't belong
 *  to the new provider's list (mirrors `provider-switcher.ts`'s own `defaultModel` reset exactly). A model
 *  belongs to exactly one provider — this is why `providers`/`provider` narrows the SAME `models`/`model`
 *  picker rather than standing up an independent fourth axis. */
export interface ProviderOption extends PickerOption {
  models: readonly PickerOption[]
  defaultModel: string
}

/** A dismissable context indicator shown above the composer field (e.g. "something was selected
 *  elsewhere and is attached to this turn's context"). `id` is opaque to ui-conversation — round-tripped
 *  to the consumer's own `onContextDismiss` callback so it knows WHICH item to drop from its own state. */
export interface ContextItem {
  id: string
  label: string
  /** GH #1211 — an OPTIONAL secondary line rendered under the label (e.g. a file size, an "extracting…"
   *  progress word, a truncation notice). Opaque free text to this element, exactly like `label` — a
   *  consumer ingesting a document (`ui-agent-admin`) is the one that knows what belongs here; the
   *  composer never derives it. Absent ⇒ a label-only chip, byte-identical to every pre-#1211 consumer. */
  description?: string
}

/** GH #849 (capability-availability-tagging.spec.md SPEC-R6) — ONE selectable entry of a composer
 *  reference roster: the `mentionables` (`@`) or `invocables` (`/`) list a consumer injects. GENERIC by
 *  construction (the SPEC's layering clause): `kind` is an OPAQUE string this element only groups and
 *  displays — the composer never learns `Entry`, a store, or any kind's semantics; `ui-agent-admin` owns
 *  that projection exactly as it already owns `PickerOption`'s. `description` is optional secondary text
 *  shown under the label in the typeahead. */
export interface ReferenceOption {
  id: string
  label: string
  kind: string
  description?: string
  /** GH #891 (SPEC-R9) — OPTIONAL: a `ui-icon` glyph name identifying this entry's KIND on the committed
   *  chip (and, GH #891 ask 3, on a capabilities row). OPAQUE to the composer, exactly as `kind` is: this
   *  element renders the glyph it is handed and never maps a kind to one — the CONSUMER owns that table
   *  (`ui-agent-admin`'s `KIND_GLYPHS`), the SPEC's §5 layering clause. Absent ⇒ a label-only chip (the
   *  generic-consumer default), never a placeholder box. */
  icon?: string
}

/** GH #849 (SPEC-R6) — the STRUCTURED reference a committed mention/invocation attaches to a turn, and
 *  the ONLY load-bearing representation of one (the SPEC's "never bare text" clause): the composer hands
 *  these to `onSubmit`'s second argument, and the consumer resolves by `id` (GH #402's id-not-label law —
 *  `label` rides for display + the turn log only). `kind` is the same opaque string its `ReferenceOption`
 *  carried, round-tripped verbatim. */
export interface TurnReference {
  id: string
  label: string
  kind: string
  /** GH #891 (SPEC-R9 AC2) — the `ReferenceOption.icon` this reference was committed from, round-tripped
   *  VERBATIM exactly as `kind` is (absent when the roster entry carried none). It rides so a consumer can
   *  render the same kind mark on the SENT turn (SPEC-R10's bubble tags) without re-deriving the mapping
   *  it already owns; resolution is still by `id` alone (GH #402), and nothing here is load-bearing on the
   *  wire (SPEC-R4's resolution never reads it). */
  icon?: string
}

/** GH #891 (capability-availability-tagging.spec.md SPEC-R11) — ONE row of the composer's capabilities
 *  panel: the BROWSE/STEER surface beside the `@`/`/` typeahead's keyboard-first quick path. GENERIC by the
 *  same construction as `ReferenceOption` (the SPEC's §5 layering clause): `kind` and `icon` are OPAQUE
 *  strings this element groups/renders and never interprets, and `included` is CONSUMER-OWNED state — the
 *  composer renders it, reports a flip through `onCapabilityToggle`, and mutates nothing (props down,
 *  callbacks up, the `onModelChange` law verbatim).
 *
 *  What `included` MEANS — a per-turn inclusion vs a persisted roster write — is deliberately NOT decided
 *  here: it is the consumer-side fork of ADR-0190 (SPEC-R12), and this contract is identical under either
 *  arm because the composer never writes a store under either. */
export interface CapabilityRow {
  id: string
  label: string
  kind: string
  description?: string
  /** A `ui-icon` glyph name, same opaque-string law as `ReferenceOption.icon` (SPEC-R9). */
  icon?: string
  /** Whether this capability is currently steered ON. Reflected onto the row's `ui-switch`; never written
   *  by this element — a flip fires `onCapabilityToggle(id, included)` and the CONSUMER hands a new
   *  `capabilities` array down. */
  included: boolean
}

/** The reasoning-effort levels a live model call can be dialed to — the same low/medium/high/xhigh
 *  vocabulary this repo's own agent-authoring tooling already uses for a seat's reasoning tier, reused
 *  here rather than inventing a parallel scale. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh'

export const EFFORT_LEVELS: readonly PickerOption[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'X-High' },
]
