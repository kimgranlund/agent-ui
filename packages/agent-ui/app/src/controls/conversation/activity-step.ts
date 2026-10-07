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
  /** How many times the step failed and was retried before it settled (a self-correct round, a re-sent
   *  request). Counts above zero put a persistent "N retries" marker in the strip's header, so a turn that
   *  needed repairing never reads as a plain success once it settles. Ignored when absent, zero or not a
   *  finite non-negative number. */
  readonly retries?: number
  /** The raw output behind the step. The strip shows every step's raw text once, together, in a single
   *  collapsed "Raw output" row at the end of the turn. */
  readonly raw?: string
  /** The model's reasoning text behind the step (T-0021, ADR-0240). The strip shows it in a collapsed
   *  "Reasoning" panel on this step's own row, as plain text, cut at `ACTIVITY_REASONING_CAP`. It is read once,
   *  when the row is created: a row born without text never grows a panel later, so a host that streams the
   *  text hands the first excerpt with the first `step()` call and grows it on the later calls. Absent, empty
   *  or whitespace-only shows no panel at all. Never part of `raw`. */
  readonly reasoning?: string
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

/** The most reasoning text one step's panel shows, in characters (T-0021, ADR-0240). A glance, not a transcript:
 *  hosts that accumulate the text stop at this length, and `activityReasoning` cuts whatever still arrives longer. */
export const ACTIVITY_REASONING_CAP = 4000
const REASONING_TRUNCATION_MARKER = '\n… [truncated]'

/** The reasoning text a step's panel renders: the step's `reasoning`, cut at the cap with an explicit marker.
 *  `''` for absent, empty, whitespace-only or non-string text (the step then shows no panel). The text is
 *  otherwise returned exactly as handed, never trimmed or rewritten. */
export function activityReasoning(step: ActivityStep): string {
  const text: unknown = step.reasoning
  if (typeof text !== 'string' || text.trim() === '') return ''
  return text.length > ACTIVITY_REASONING_CAP ? text.slice(0, ACTIVITY_REASONING_CAP) + REASONING_TRUNCATION_MARKER : text
}

/** The strip's retry total: every step's `retries`, summed, ignoring anything that is not a finite number
 *  above zero. `0` when no step retried (the strip then shows no retry marker). */
export function totalActivityRetries(steps: Iterable<ActivityStep>): number {
  let total = 0
  for (const s of steps) if (typeof s.retries === 'number' && Number.isFinite(s.retries) && s.retries > 0) total += Math.floor(s.retries)
  return total
}

/** "1 retry" / "3 retries". */
export function formatActivityRetries(n: number): string {
  return `${n} ${n === 1 ? 'retry' : 'retries'}`
}

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
