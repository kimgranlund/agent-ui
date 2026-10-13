// result-card-model.ts: the pure, DOM-free hardening and formatting for ui-result-card (ADR-0244, ResultCard
// fork sheet). No DOM, no host, unit-testable in plain Node (the game-hud-model.ts in-folder split). Owns:
//
//   1. `cleanStats`: a non-array is `[]`; a non-object entry is dropped; `label` and `value` harden to strings
//      (a finite number value formats through one module-memoized default-locale Intl.NumberFormat); an entry
//      whose value is empty is dropped (ADR-0201: a final figure with no figure is no figure); the first
//      `MAX_STATS` survivors are kept and the rest dropped (the catalog warning is the ResultCard factory's job).
//   2. `formatDelta`: a finite number, or a string that parses to one, prints signed through
//      `signDisplay: 'exceptZero'` (+50, -3, 0); other non-empty text passes through verbatim; anything else is
//      `null` and no delta part renders. The sign is text, never color.
//   3. `outcomeOf` / `OUTCOME_WORDS`: an out-of-set outcome is `done`; each outcome has one word.
//   4. `statsProp`: the safe JSON codec. A removed attribute or malformed JSON falls back to `[]` and never
//      throws into attributeChangedCallback. A property write bypasses the codec, so result-card.ts re-cleans
//      every value on the render path.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** The most stats a card renders; extra entries are dropped. */
export const MAX_STATS = 4

export const OUTCOMES = ['win', 'lose', 'draw', 'done'] as const
export type Outcome = (typeof OUTCOMES)[number]

/** The word each outcome shows in its pill (the approved mockup: the `lose` value reads Loss). */
export const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = { win: 'Win', lose: 'Loss', draw: 'Draw', done: 'Done' }

const STAT_INTENTS = ['info', 'success', 'warning', 'danger'] as const
/** A stat intent: neutral, absent or out-of-set means no intent. */
export type StatIntent = (typeof STAT_INTENTS)[number]

/** One stat as an author or agent writes it. Every field may arrive malformed; the cleaner judges it. */
export interface ResultCardStat {
  label?: unknown
  value?: unknown
  delta?: unknown
  intent?: unknown
}

/** One stat after hardening: display-ready strings, with the optional parts present only when real. */
export interface CleanStat {
  label: string
  value: string
  delta?: string
  intent?: StatIntent
}

const numberFormat = new Intl.NumberFormat() // module-memoized default-locale formatter
const signedNumberFormat = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' })

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The outcome, with anything out of set read as `done`. */
export function outcomeOf(raw: unknown): Outcome {
  return typeof raw === 'string' && (OUTCOMES as readonly string[]).includes(raw) ? (raw as Outcome) : 'done'
}

/** A finite number through the default-locale formatter, a string trimmed, anything else ''. */
export function formatValue(raw: unknown): string {
  if (isFiniteNumber(raw)) return numberFormat.format(raw)
  if (typeof raw === 'string') return raw.trim()
  return ''
}

/** The signed delta text, or `null` when there is no delta to show. */
export function formatDelta(raw: unknown): string | null {
  if (isFiniteNumber(raw)) return signedNumberFormat.format(raw)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? signedNumberFormat.format(n) : trimmed
}

/** A stat intent other than `neutral`, or `undefined`. */
export function statIntent(raw: unknown): StatIntent | undefined {
  return typeof raw === 'string' && (STAT_INTENTS as readonly string[]).includes(raw) ? (raw as StatIntent) : undefined
}

/** Harden an arbitrary input into at most `MAX_STATS` display-ready stats, in order. */
export function cleanStats(input: unknown): CleanStat[] {
  if (!Array.isArray(input)) return []
  const out: CleanStat[] = []
  for (const entry of input) {
    if (out.length === MAX_STATS) break
    if (!isPlainObject(entry)) continue
    const value = formatValue(entry.value)
    if (value === '') continue
    const label = typeof entry.label === 'string' ? entry.label : isFiniteNumber(entry.label) ? String(entry.label) : ''
    const stat: CleanStat = { label, value }
    const delta = formatDelta(entry.delta)
    if (delta !== null) stat.delta = delta
    const intent = statIntent(entry.intent)
    if (intent !== undefined) stat.intent = intent
    out.push(stat)
  }
  return out
}

const statsType: PropType<ResultCardStat[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanStats(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const statsProp: PropConfig<ResultCardStat[]> = {
  type: statsType,
  default: [],
}
