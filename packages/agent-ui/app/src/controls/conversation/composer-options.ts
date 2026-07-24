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
