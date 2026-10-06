// activity-step.ts: the neutral activity model a host feeds into ui-conversation's per-turn narration
// strip once it opts in with the `steps` prop (ADR-0159 amendment, T-0016). Pure data plus two
// formatters: no DOM, no A2UI, no catalog, no persona. Adapters build these shapes (the A2UI one is
// site/lib/a2ui-activity.ts; any other host, a plain tool-calling chat included, builds its own) and the
// control renders only these shapes, so the strip stays general purpose.

/** A step's outcome. `repaired` is a step that failed at least once and then succeeded (a self-correct
 *  round); `failed` is a step that ended without succeeding. */
export type ActivityStatus = 'running' | 'ok' | 'repaired' | 'failed'

/** One row of the activity strip. Every optional field degrades to nothing when absent. */
export interface ActivityStep {
  /** Stable identity within one turn: a later `step()` call with the same id updates the row in place. */
  readonly id: string
  /** The host's own category for the step (e.g. `request`, `tool`, `validate`). An opaque hook, stamped
   *  as `data-kind` on the row and never rendered as text. */
  readonly kind: string
  /** The row's name, already in the host's chosen tense. */
  readonly label: string
  readonly status: ActivityStatus
  /** Epoch milliseconds the running span counts from. While `running`, the row shows a live elapsed time
   *  from this instant; ignored otherwise. */
  readonly startedAt?: number
  /** How long the step took, shown on the row once it is no longer `running`. */
  readonly durationMs?: number
  /** One line under the label, built from counts and verbs, never from catalog or component type names. */
  readonly summary?: string
  /** The raw output behind the step. The strip shows every step's raw text once, together, in a single
   *  collapsed "Raw output" row at the end of the turn. */
  readonly raw?: string
}

/** Turn-level facts for the strip's footer row. Every field is optional; an absent field renders nothing. */
export interface ActivityFooter {
  /** Model rounds the turn took (more than one means the host repaired a failed attempt). */
  readonly rounds?: number
  readonly inputTokens?: number
  readonly outputTokens?: number
  /** The model id that answered, verbatim. */
  readonly model?: string
}

const grouped = new Intl.NumberFormat('en-US')

/** A count with its noun, or `undefined` for a value that is not a finite, non-negative number. */
function counted(n: number | undefined, one: string, many: string): string | undefined {
  if (n === undefined || !Number.isFinite(n) || n < 0) return undefined
  return `${grouped.format(n)} ${n === 1 ? one : many}`
}

/** The footer row's text: the present facts in a fixed order, `·`-separated. `''` when nothing is present
 *  (the strip then renders no footer row at all). */
export function formatActivityFooter(footer: ActivityFooter): string {
  const parts = [
    counted(footer.rounds, 'round', 'rounds'),
    counted(footer.inputTokens, 'input token', 'input tokens'),
    counted(footer.outputTokens, 'output token', 'output tokens'),
    footer.model !== undefined && footer.model !== '' ? footer.model : undefined,
  ]
  return parts.filter((p) => p !== undefined).join(' · ')
}

/** The single raw block for a turn: every distinct non-empty `raw`, in step order, blank-line separated.
 *  `''` when no step carries any (the strip then renders no raw row). Distinct, so two steps handed the
 *  same text never show it twice. */
export function joinActivityRaw(steps: Iterable<ActivityStep>): string {
  const seen = new Set<string>()
  for (const s of steps) if (s.raw !== undefined && s.raw !== '') seen.add(s.raw)
  return [...seen].join('\n\n')
}
