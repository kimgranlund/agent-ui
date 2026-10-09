// score.ts: the agent-behavior eval's pure scorer (GH #1810). No IO.
//
// - Negative selection fails when the forbidden `notFor` type was emitted.
// - Concept selection fails when the expected type was not emitted; a halt emits nothing, so it fails.
// - Persona fails when ANY round attempted a foreign type (a type from another persona's fragment),
//   naming the type and the round. Attempted, not emitted: a Quant turn reaching for `PlayingCard` on the
//   base catalog halts on `CATALOG` and ships nothing, yet the reach is the behavior under test.
// - Response type (T-0060, RTS-R10) fails `text` on a shipped surface (false-surface), `surface` or `both`
//   on no surface (missed-surface), and `both` on no text (missing-text); a halt ships no answer, so it
//   fails every expect (K4).
// - Repair is reported, never passed or failed: first-pass (valid in round 1), eventual (valid later),
//   eventual-text (a `render_surface` payload still invalid at the bound degraded to its text,
//   `SURFACE_DEGRADED`), or halt (`ProduceHalt`).

import type { RepairOutcome } from './observe.ts'
import type { ResponseTypeExpect } from './cases.ts'

/** The repair outcome for a turn that halted, or shipped valid after `rounds` produce() rounds. A degrade
 *  to text (`eventual-text`) is read from the trace by `observe.ts`, never derived here. */
export function repairOutcome(halted: boolean, rounds: number): Exclude<RepairOutcome, 'eventual-text'> {
  if (halted) return 'halt'
  return rounds === 1 ? 'first-pass' : 'eventual'
}

/** One failed check, with the offending type named in `message`. */
export interface Finding {
  readonly check: 'concept' | 'negative' | 'persona' | 'response-type'
  readonly type: string
  readonly message: string
}

interface Emitted {
  readonly outcome: RepairOutcome
  readonly emittedTypes: readonly string[]
}

/** Negative selection: `forbidType` must not be in `emittedTypes`. */
export function scoreNegative(obs: Emitted, forbidType: string): Finding[] {
  return obs.emittedTypes.includes(forbidType)
    ? [{ check: 'negative', type: forbidType, message: `negative: emitted forbidden ${forbidType}` }]
    : []
}

/** Concept selection: `expectType` must be in `emittedTypes`; a halt always fails. */
export function scoreConcept(obs: Emitted, expectType: string): Finding[] {
  if (obs.outcome === 'halt') return [{ check: 'concept', type: expectType, message: `concept: halted before emitting ${expectType}` }]
  return obs.emittedTypes.includes(expectType)
    ? []
    : [{ check: 'concept', type: expectType, message: `concept: expected ${expectType}, not emitted` }]
}

/** Persona: no round may attempt a type in `foreignTypes`. One finding per (round, type). */
export function scorePersona(attemptedTypes: readonly (readonly string[])[], foreignTypes: readonly string[]): Finding[] {
  const out: Finding[] = []
  attemptedTypes.forEach((types, i) => {
    for (const type of new Set(types)) {
      if (foreignTypes.includes(type)) out.push({ check: 'persona', type, message: `persona: round ${i + 1} attempted foreign ${type}` })
    }
  })
  return out
}

/** The foreign types for `persona`: every fragment type of every OTHER persona. A base-catalog persona
 *  (no fragment, the Quant) therefore treats every fragment type as foreign. */
export function foreignTypesFor(persona: string, fragmentTypes: ReadonlyMap<string, readonly string[]>): string[] {
  const out: string[] = []
  for (const [id, types] of fragmentTypes) if (id !== persona) out.push(...types)
  return out
}

interface Shipped {
  readonly outcome: RepairOutcome
  readonly hasText: boolean
  readonly hasSurface: boolean
}

/** Response type: one finding per failure against `expect`; a halt fails every expect. */
export function scoreResponseType(obs: Shipped, expect: ResponseTypeExpect): Finding[] {
  const finding = (message: string): Finding => ({ check: 'response-type', type: expect, message: `response-type: ${message}` })
  if (obs.outcome === 'halt') return [finding(`halted, expected ${expect}`)]
  const out: Finding[] = []
  if (expect === 'text' && obs.hasSurface) out.push(finding('false-surface, expected text'))
  if (expect !== 'text' && !obs.hasSurface) out.push(finding(`missed-surface, expected ${expect}`))
  if (expect === 'both' && !obs.hasText) out.push(finding('missing-text, expected both'))
  return out
}

/** The leg's two rates over observed cases only: false-surface over `text` cases, missed-surface over
 *  `surface` and `both` cases. */
export function responseTypeRates(rows: readonly { readonly expect: ResponseTypeExpect; readonly hasSurface: boolean }[]): {
  falseSurface: number
  textCases: number
  missedSurface: number
  surfaceCases: number
} {
  const text = rows.filter((r) => r.expect === 'text')
  const surface = rows.filter((r) => r.expect !== 'text')
  return {
    falseSurface: text.filter((r) => r.hasSurface).length,
    textCases: text.length,
    missedSurface: surface.filter((r) => !r.hasSurface).length,
    surfaceCases: surface.length,
  }
}
