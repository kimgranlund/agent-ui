// legs.ts: the selection, persona and response-type leg runners (GH #1810, T-0060).
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
import type { PersonaCase, ResponseTypeCase, SelectionCase } from './cases.ts'
import type { Session } from '../../src/agent/agent-transport.ts'
import { foreignTypesFor, responseTypeRates, scoreConcept, scoreNegative, scorePersona, scoreResponseType } from './score.ts'
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

async function runLeg<C extends { id: string; prompt: string; catalogId: string; session?: Session }>(
  leg: string,
  cases: readonly C[],
  deps: ObserveDeps,
  score: (c: C, obs: TurnObservation) => Finding[],
  detail?: (obs: TurnObservation) => string,
): Promise<LegResult> {
  const lines: string[] = []
  const observations = new Map<string, TurnObservation>()
  const repair = { 'first-pass': 0, eventual: 0, halt: 0 }
  let failed = 0
  for (const c of cases) {
    let obs: TurnObservation
    try {
      obs = await observeTurn(
        { catalog: loadCaseCatalog(c.catalogId), prompt: c.prompt, ...(c.session !== undefined ? { session: c.session } : {}) },
        deps,
      )
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
    lines.push(`${verdict} ${repairText(obs)}${detail?.(obs) ?? ''}`)
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

/** The response-type leg over the labelled set: scored by `scoreResponseType`, then one rates line after
 *  the summary. `timing` (the live arm) appends ` firstLineMs=<n>` to each case line. */
export async function runResponseTypeLeg(
  cases: readonly ResponseTypeCase[],
  deps: ObserveDeps,
  opts?: { timing?: boolean },
): Promise<LegResult> {
  const detail = opts?.timing === true ? (obs: TurnObservation) => ` firstLineMs=${obs.firstLineMs === null ? 'null' : Math.round(obs.firstLineMs)}` : undefined
  const result = await runLeg('response-type', cases, deps, (c, obs) => scoreResponseType(obs, c.expect), detail)
  const rows = cases.flatMap((c) => {
    const obs = result.observations.get(c.id)
    return obs === undefined ? [] : [{ expect: c.expect, hasSurface: obs.hasSurface, usage: obs.usage }]
  })
  const rates = responseTypeRates(rows)
  const billed = rows.flatMap((r) => (r.usage === null ? [] : [r.usage]))
  const input = billed.reduce((n, u) => n + u.inputTokens, 0)
  const output = billed.reduce((n, u) => n + u.outputTokens, 0)
  result.lines.push(
    `response-type rates: false-surface=${rates.falseSurface}/${rates.textCases} missed-surface=${rates.missedSurface}/${rates.surfaceCases}; usage input=${input} output=${output} over ${billed.length} of ${cases.length} turns`,
  )
  return result
}
