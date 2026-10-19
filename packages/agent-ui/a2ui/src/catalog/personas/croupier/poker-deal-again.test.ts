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

const MID_HAND = { phase: 'River', status: 'River dealt. Your move: check or bet 50.' }

describe('croupier bet controls: a poker hand settled through the data model offers Deal again (T-0380)', () => {
  it("the r12 :52 hold'em round 2 (only updateDataModel, phase Showdown, Check, Bet and Fold live) is DEAL_AGAIN_MISSING", () => {
    const [f, ...rest] = findings(fixture.holdem, fixture.holdem.output, 1)
    expect(rest).toEqual([])
    expect([f!.code, f!.path]).toEqual(['DEAL_AGAIN_MISSING', 'table-1:btnCheck'])
    expect(f!.message).toMatch(/\/phase reads "Showdown"/)
    expect(f!.message).toMatch(/still offers btnCheck and btnFold as live moves, with no Deal again Button/)
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

  it('a hand still in play (Pre-showdown is a street before), a settled hand with no move left, or moves disabled, is not judged here', () => {
    expect(run(fixture.holdem, [shipped(fixture.holdem, MID_HAND)])).toEqual([])
    expect(run(fixture.holdem, [shipped(fixture.holdem, { ...MID_HAND, phase: 'Pre-showdown' })])).toEqual([])
    expect(run(fixture.stud, [shipped(fixture.stud, { street: 'Sixth street', status: 'Sixth street. Your move: check, bet 20 or fold' })])).toEqual([])
    expect(run(fixture.holdem, [...fixture.holdem.output, comps([{ id: 'actRow', component: 'Row', children: [] }])])).toEqual([])
    const disabled = ['btnCheck', 'btnBet', 'btnFold'].map((id) => ({ id, component: 'Button', label: id.slice(3), action: { action: id.slice(3).toLowerCase() }, disabled: true }))
    expect(run(fixture.holdem, [...fixture.holdem.output, comps(disabled)])).toEqual([])
  })

  it('a hand over is read from a settled /phase or /status, a fold ending, or a result on screen', () => {
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'Settled', status: '' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'River', status: 'settled' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'River', status: 'The dealer folded. Hand over.' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
    expect(run(fixture.holdem, [shipped(fixture.holdem, { phase: 'River', status: 'You win the 100 pot.' })])).toEqual([['DEAL_AGAIN_MISSING', 'table-1:btnCheck']])
    expect(findings(fixture.holdem, [shipped(fixture.holdem, { phase: 'River', status: 'Folded' })])[0]!.message).toMatch(/\/status reads "Folded"/)
  })

  it('a next-hand press is not a live move: Place bet, place_bet, new_hand and Deal stay out of the moves', () => {
    const only = (button: Record<string, unknown>) => run(fixture.holdem, [...fixture.holdem.output, comps([{ id: 'actRow', component: 'Row', children: ['b'] }, { id: 'b', component: 'Button', ...button }])])
    expect(only({ label: 'Place bet', action: { action: 'place_bet' } })).toEqual([])
    expect(only({ label: 'Next', action: { action: 'new_hand' } })).toEqual([])
    expect(only({ label: 'Deal', action: { action: 'deal' } })).toEqual([])
  })

  it('a Deal Button with no newRound beside the stale moves is named in the repair, not called missing', () => {
    const out = [...fixture.holdem.output, comps([{ id: 'actRow', component: 'Row', children: ['btnCheck', 'btnFold', 'deal'] }, { id: 'deal', component: 'Button', label: 'Deal again', action: { action: 'deal' } }])]
    const [f] = findings(fixture.holdem, out)
    expect(f!.message).toMatch(/while deal deals with no "context":\{"newRound":true\}/)
    expect(f!.message).toMatch(/give deal's action "context":\{"newRound":true\}/)
    expect(f!.message).not.toMatch(/no Deal again Button/)
  })

  it('a new surface this turn with a Deal Button, or a poker table still in play, is the next hand', () => {
    const create = (sid: string) => ({ version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--croupier', sendDataModel: true } })
    const next = [create('table-2'), { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [{ id: 'root', component: 'Card', children: ['deal'] }, { id: 'deal', component: 'Button', label: 'Deal', action: { action: 'deal' } }] } }]
    expect(run(fixture.holdem, [...fixture.holdem.output, ...next])).toEqual([])
    const playing = [create('table-2'), { version: 'v1.0', updateDataModel: { surfaceId: 'table-2', value: { ...MID_HAND, pot: 20 } } }, { version: 'v1.0', updateComponents: { surfaceId: 'table-2', components: [{ id: 'root', component: 'Card', children: ['title', 'check'] }, { id: 'title', component: 'Text', text: "Texas hold'em" }, { id: 'check', component: 'Button', label: 'Check', action: { action: 'check' } }] } }]
    expect(run(fixture.holdem, [...fixture.holdem.output, ...playing])).toEqual([])
  })
})
