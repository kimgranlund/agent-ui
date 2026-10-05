// legs.ts: the selection and persona leg runners (GH #1810).
//
// Each leg observes every case through `observeTurn` (the real `produce()` loop) and scores it with the
// pure scorer. Exit code 1 when any case fails, each failing line naming the offending type. Repair is
// reported on every line plus summary counts; it never passes or fails a case.
//
// The provider is a plain parameter: the CLI's live arm hands in the real adapter, the selftest and the
// tests hand in `scriptedProvider`. This module never reads a key or the environment.

import { observeTurn } from './observe.ts'
import type { ObserveDeps, TurnObservation } from './observe.ts'
import { loadCaseCatalog, personaFragmentTypes } from './cases.ts'
import type { PersonaCase, SelectionCase } from './cases.ts'
import { foreignTypesFor, scoreConcept, scoreNegative, scorePersona } from './score.ts'
import type { Finding } from './score.ts'

export interface LegResult {
  readonly exitCode: 0 | 1
  readonly lines: string[]
  readonly observations: ReadonlyMap<string, TurnObservation>
}

function repairText(obs: TurnObservation): string {
  const codes = obs.failureCodes === null ? 'not-observed' : `[${obs.failureCodes.join(',')}]`
  return `repair=${obs.outcome} rounds=${obs.rounds} failureCodes=${codes}`
}

async function runLeg<C extends { id: string; prompt: string; catalogId: string }>(
  leg: string,
  cases: readonly C[],
  deps: ObserveDeps,
  score: (c: C, obs: TurnObservation) => Finding[],
): Promise<LegResult> {
  const lines: string[] = []
  const observations = new Map<string, TurnObservation>()
  const repair = { 'first-pass': 0, eventual: 0, halt: 0 }
  let failed = 0
  for (const c of cases) {
    let obs: TurnObservation
    try {
      obs = await observeTurn({ catalog: loadCaseCatalog(c.catalogId), prompt: c.prompt }, deps)
    } catch (err) {
      failed += 1
      lines.push(`FAIL ${c.id} error: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    observations.set(c.id, obs)
    repair[obs.outcome] += 1
    const findings = score(c, obs)
    if (findings.length > 0) failed += 1
    const verdict = findings.length > 0 ? `FAIL ${c.id} ${findings.map((f) => f.message).join('; ')}` : `PASS ${c.id}`
    lines.push(`${verdict} ${repairText(obs)}`)
  }
  lines.push(
    `${leg}: ${cases.length} case(s), ${failed} failed; repair first-pass=${repair['first-pass']} eventual=${repair.eventual} halt=${repair.halt}`,
  )
  return { exitCode: failed > 0 ? 1 : 0, lines, observations }
}

/** Concept and negative selection over derived `notFor` cases. */
export function runSelectionLeg(cases: readonly SelectionCase[], deps: ObserveDeps): Promise<LegResult> {
  return runLeg('selection', cases, deps, (c, obs) => [...scoreNegative(obs, c.forbidType), ...scoreConcept(obs, c.expectType)])
}

/** The persona leg: no round may attempt another persona's type; an `expectType`, when given, must ship. */
export function runPersonaLeg(cases: readonly PersonaCase[], deps: ObserveDeps): Promise<LegResult> {
  const fragmentTypes = personaFragmentTypes()
  return runLeg('persona', cases, deps, (c, obs) => [
    ...scorePersona(obs.attemptedTypes, foreignTypesFor(c.persona, fragmentTypes)),
    ...(c.expectType !== undefined ? scoreConcept(obs, c.expectType) : []),
  ])
}
