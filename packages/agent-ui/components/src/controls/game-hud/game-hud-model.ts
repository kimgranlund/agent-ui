// game-hud-model.ts: the pure, DOM-free hardening and formatting for ui-game-hud (ADR-0243, GameHud fork
// sheet). No DOM, no host, unit-testable in plain Node (the stat-model.ts / source-list-model.ts in-folder
// split). Owns:
//
//   1. `cleanStats`: a non-array is `[]`; a non-object entry is dropped; `label` and `value` harden to
//      strings (a finite number value formats through one module-memoized default-locale
//      Intl.NumberFormat); an entry whose label and value are both empty is dropped; the first
//      `MAX_STATS` survivors are kept and the rest dropped silently (the catalog warning is the catalog
//      row's job, not this cleaner's).
//   2. `formatDelta`: a finite number, or a string that parses to one, prints signed through
//      `signDisplay: 'exceptZero'` (+60, -12, 0); other non-empty text passes through verbatim; anything
//      else is `null` and no delta part renders. The sign is text, never color.
//   3. `cleanProgress`: `null` unless `max` is a finite number above zero (so no broken bar ever renders);
//      `value` clamps into [0, max].
//   4. `statsProp` / `progressProp`: the safe JSON codecs. A removed attribute or malformed JSON falls back
//      to `[]` / no progress and never throws into attributeChangedCallback. A property write bypasses the
//      codec, so game-hud.ts re-cleans every value on the render path (`progressProp` therefore parses
//      verbatim; `statsProp` also cleans, the source-list codec shape).
//
// A non-finite value never prints a placeholder glyph: it hardens to '' like any other non-value.

import type { PropConfig, PropType } from '../../dom/props.ts'
import { INTENTS } from '../badge/badge.props.gen.ts'

/** The most stats a HUD renders; extra entries are dropped silently. */
export const MAX_STATS = 6

/** A stat intent: a badge intent other than `neutral` (neutral, absent or out-of-set means no intent). */
export type StatIntent = Exclude<(typeof INTENTS)[number], 'neutral'>

/** One stat as an author or agent writes it. Every field may arrive malformed; the cleaner judges it. */
export interface GameHudStat {
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

/** The progress readout as written. */
export interface GameHudProgress {
  value?: unknown
  max?: unknown
  label?: unknown
}

/** The progress readout after hardening: `max` is finite and above zero, `value` is in [0, max]. */
export interface CleanProgress {
  value: number
  max: number
  label: string
}

const numberFormat = new Intl.NumberFormat() // module-memoized default-locale formatter
const signedNumberFormat = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' })

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A finite number through the default-locale formatter, a string verbatim, anything else ''. */
export function formatValue(raw: unknown): string {
  if (isFiniteNumber(raw)) return numberFormat.format(raw)
  if (typeof raw === 'string') return raw
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

/** A badge intent other than `neutral`, or `undefined`. */
export function statIntent(raw: unknown): StatIntent | undefined {
  if (typeof raw !== 'string' || raw === 'neutral') return undefined
  return (INTENTS as readonly string[]).includes(raw) ? (raw as StatIntent) : undefined
}

/** The status badge intent: an out-of-set value is `neutral`. */
export function statusIntentOf(raw: unknown): (typeof INTENTS)[number] {
  return typeof raw === 'string' && (INTENTS as readonly string[]).includes(raw) ? (raw as (typeof INTENTS)[number]) : 'neutral'
}

/** Harden an arbitrary input into at most `MAX_STATS` display-ready stats, in order. */
export function cleanStats(input: unknown): CleanStat[] {
  if (!Array.isArray(input)) return []
  const out: CleanStat[] = []
  for (const entry of input) {
    if (out.length === MAX_STATS) break
    if (!isPlainObject(entry)) continue
    const label = typeof entry.label === 'string' ? entry.label : isFiniteNumber(entry.label) ? String(entry.label) : ''
    const value = formatValue(entry.value)
    if (label === '' && value === '') continue
    const stat: CleanStat = { label, value }
    const delta = formatDelta(entry.delta)
    if (delta !== null) stat.delta = delta
    const intent = statIntent(entry.intent)
    if (intent !== undefined) stat.intent = intent
    out.push(stat)
  }
  return out
}

/** Harden an arbitrary input into a drawable progress readout, or `null` (no bar renders). */
export function cleanProgress(input: unknown): CleanProgress | null {
  if (!isPlainObject(input)) return null
  const max = input.max
  if (!isFiniteNumber(max) || max <= 0) return null
  const raw = input.value
  const value = isFiniteNumber(raw) ? Math.min(max, Math.max(0, raw)) : 0
  const label = typeof input.label === 'string' ? input.label : ''
  return { value, max, label }
}

const statsType: PropType<GameHudStat[]> = {
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

const progressType: PropType<GameHudProgress | null> = {
  from(attr) {
    if (attr === null) return null
    try {
      // Parsed verbatim, not cleaned: the render path re-cleans every value anyway. The table-model
      // `tableSortProp` shape: the descriptor trip-wire's kindOf needs from('"x"') to return 'x' unchanged,
      // and a malformed string falls back to undefined (not null, which kindOf would read as a number codec).
      // Either way cleanProgress renders no bar.
      return JSON.parse(attr) as GameHudProgress | null
    } catch {
      return undefined as unknown as null
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const statsProp: PropConfig<GameHudStat[]> = {
  type: statsType,
  default: [],
}

export const progressProp: PropConfig<GameHudProgress | null> = {
  type: progressType,
  default: null,
}
