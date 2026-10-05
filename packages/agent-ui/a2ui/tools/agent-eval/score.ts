// score.ts: the agent-behavior eval's pure scorer (GH #1810). No IO.
//
// - Negative selection fails when the forbidden `notFor` type was emitted.
// - Concept selection fails when the expected type was not emitted; a halt emits nothing, so it fails.
// - Persona fails when ANY round attempted a foreign type (a type from another persona's fragment),
//   naming the type and the round. Attempted, not emitted: a Quant turn reaching for `PlayingCard` on the
//   base catalog halts on `CATALOG` and ships nothing, yet the reach is the behavior under test.
// - Repair is reported, never passed or failed: first-pass (valid in round 1), eventual (valid later),
//   or halt (`ProduceHalt`).

import type { RepairOutcome } from './observe.ts'

/** The repair outcome for a turn that halted, or shipped valid after `rounds` produce() rounds. */
export function repairOutcome(halted: boolean, rounds: number): RepairOutcome {
  if (halted) return 'halt'
  return rounds === 1 ? 'first-pass' : 'eventual'
}

/** One failed check, with the offending type named in `message`. */
export interface Finding {
  readonly check: 'concept' | 'negative' | 'persona'
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
