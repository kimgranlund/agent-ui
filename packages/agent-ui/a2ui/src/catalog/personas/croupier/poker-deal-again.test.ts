// poker-deal-again.test.ts (T-0380, round 12 cluster M): a poker hand settled through the data model alone. The
// showdown came in an ACTION_NOT_APPLIED repair round that sent only updateDataModel (hold'em `"phase": "Showdown"`
// at :52, stud `"street": "Showdown"` at :77), so Check, Bet and Fold stayed live and no Deal again was offered.
// The fixture copies each run's earlier turns and the shipped round unedited from the round 12 archive.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { croupierBetControls, croupierSemanticChecks } from './checks.ts'
import { toJsonl } from './hands.fixture.ts'
import { semanticSurfaceViews } from '../../semantic-check.ts'
import type { Session } from '../../../agent/agent-transport.ts'
import type { A2uiOutput } from '../../../protocol.ts'

interface Recorded {
  turns: A2uiOutput[]
  output: Record<string, unknown>[]
}
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'r12-poker-showdown-data-only.json'), 'utf8')) as Record<'holdem' | 'stud', Recorded>

const session = (rec: Recorded): Session => ({ turns: rec.turns.flatMap((t) => [{ role: 'user', content: 'go' }, { role: 'assistant', content: toJsonl(t) }]) })
const findings = (rec: Recorded, output: readonly unknown[], round?: number) =>
  croupierBetControls.check({ surfaces: semanticSurfaceViews(session(rec), output as A2uiOutput), ...(round !== undefined ? { round } : {}) }).filter((f) => f.code === 'DEAL_AGAIN_MISSING')
const run = (rec: Recorded, output: readonly unknown[]) => findings(rec, output).map((f) => [f.code, f.path])

const comps = (components: Record<string, unknown>[]) => ({ version: 'v1.0', updateComponents: { surfaceId: 'table-1', components } })
const data = (value: Record<string, unknown>) => ({ version: 'v1.0', updateDataModel: { surfaceId: 'table-1', value } })
const again = { id: 'again', component: 'Button', label: 'Deal again', variant: 'solid', action: { action: 'deal', context: { newRound: true } } }
/** The shipped data model with one key changed. */
const shipped = (rec: Recorded, patch: Record<string, unknown>) => {
  const msg = rec.output[0] as { updateDataModel: { value: Record<string, unknown> } }
  return data({ ...msg.updateDataModel.value, ...patch })
}

describe('croupier bet controls: a poker hand settled through the data model offers Deal again (T-0380)', () => {
  it("the r12 :52 hold'em round 2 (only updateDataModel, phase Showdown, Check, Bet and Fold live) is DEAL_AGAIN_MISSING", () => {
    const [f, ...rest] = findings(fixture.holdem, fixture.holdem.output, 1)
    expect(rest).toEqual([])
    expect([f!.code, f!.path]).toEqual(['DEAL_AGAIN_MISSING', 'table-1:btnCheck'])
    expect(f!.message).toMatch(/btnCheck, btnBet and btnFold/)
    expect(f!.message).toMatch(/"newRound":true/)
    expect(f!.message).toMatch(/an answer the checks rejected never reached the player/)
  })

  it('the r12 :77 stud round 2 (street Showdown) is DEAL_AGAIN_MISSING', () => {
    expect(run(fixture.stud, fixture.stud.output)).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
  })

  it('the same showdown with the moves replaced by Deal again passes every check', () => {
    const settled = comps([{ id: 'actRow', component: 'Row', gap: 'md', justify: 'end', children: ['again'] }, again])
    expect(run(fixture.holdem, [...fixture.holdem.output, settled])).toEqual([])
    const all = croupierSemanticChecks.flatMap((c) => c.check({ surfaces: semanticSurfaceViews(session(fixture.holdem), [...fixture.holdem.output, settled] as A2uiOutput) }))
    expect(all.map((f) => f.code)).toEqual([])
    const stud = comps([{ id: 'actions', component: 'Row', gap: 'sm', children: ['again'] }, again])
    expect(run(fixture.stud, [...fixture.stud.output, stud])).toEqual([])
  })

  it('a hand still in play, a settled hand with no move left, or moves disabled beside no forward, is not judged here', () => {
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'River' })])).toEqual([])
    expect(run(fixture.stud, [shipped(fixture.stud, { street: 'Sixth street' })])).toEqual([])
    expect(run(fixture.holdem, [...fixture.holdem.output, comps([{ id: 'actRow', component: 'Row', children: [] }])])).toEqual([])
    const disabled = ['btnCheck', 'btnBet', 'btnFold'].map((id) => ({ id, component: 'Button', label: id.slice(3), action: { action: id.slice(3).toLowerCase() }, disabled: true }))
    expect(run(fixture.holdem, [...fixture.holdem.output, comps(disabled)])).toEqual([])
  })

  it('a phase that reads settled is judged as the showdown is', () => {
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'Settled' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
  })
})
