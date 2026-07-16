// composer-options.ts — the composer's opt-in picker/context-chip vocabulary (ui-conversation). Types +
// pure data only — conversation.ts owns the rendering, a consumer (e.g. ui-agent-admin) owns supplying
// its own option lists + selected value. Generic on purpose: `models` is inherently host-specific (each
// consumer names its own model list), so ui-conversation never hardcodes one; `effort` is a fleet-wide
// concept every live-model consumer can share, so its option list is built in here as the one default.

/** One picker's selectable entry — reused for BOTH the Models and Effort pickers (and any future one). */
export interface PickerOption {
  id: string
  label: string
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
