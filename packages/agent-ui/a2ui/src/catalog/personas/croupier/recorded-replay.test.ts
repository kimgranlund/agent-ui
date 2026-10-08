// recorded-replay.test.ts: offline replay of real Haiku Croupier turns, one set per model (GH #1795,
// T-0004; 5.5 set added by T-0033). Fixtures in __fixtures__/ were captured through produce() with the
// Croupier catalog (capture-meta.json); no network or key is needed here. The 4.5 turn 2 ("stand") is the
// faces symptom: the dealer draws a third card into the data model but no PlayingCard renders it (red
// before the nested-list fix in checks.ts). On 5.5 turn 1 asks for a bet and turn 2 is a note with no surface.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { croupierHandConsistency } from './checks.ts'
import { semanticSurfaceViews } from '../../semantic-check.ts'
import type { Session } from '../../../agent/agent-transport.ts'
import type { A2uiOutput, A2uiServerMessage } from '../../../protocol.ts'

const dir = join(import.meta.dirname, '__fixtures__')
const messages = (file: string): A2uiOutput =>
  readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as A2uiServerMessage)
    .filter((m) => !('a2uiMeta' in m))

const sessionFor = (turn1: A2uiOutput): Session => ({
  turns: [
    { role: 'user', content: 'black jack' },
    { role: 'assistant', content: turn1.map((m) => JSON.stringify(m)).join('\n') },
  ],
})
const findings = (session: Session, out: A2uiOutput) =>
  croupierHandConsistency.check({ surfaces: semanticSurfaceViews(session, out) })

describe('recorded Haiku 4.5 Croupier turns replay offline', () => {
  const turn1 = messages('haiku-4-5-blackjack-turn1.jsonl')
  const turn2 = messages('haiku-4-5-blackjack-turn2-stand.jsonl')

  it('turn 1 (deal) states no inconsistent hand', () => {
    expect(findings({ turns: [] }, turn1)).toEqual([])
  })

  it('turn 2 (stand) is caught: three dealer cards listed, two rendered', () => {
    const f = findings(sessionFor(turn1), turn2)
    expect(f.map((x) => x.code)).toEqual(['HAND_COUNT'])
    expect(f[0]!.path).toContain('dealer-cards')
    expect(f[0]!.message).toContain('renders 2 cards but /game/dealer/cards lists 3')
  })
})

describe('recorded Haiku 5.5 Croupier turns replay offline', () => {
  const turn1 = messages('haiku-blackjack-turn1.jsonl')
  const turn2 = messages('haiku-blackjack-turn2-stand.jsonl')

  it('turn 1 asks for a bet: an ask-1 surface with a bet Slider, no hand, no finding', () => {
    expect(JSON.stringify(turn1)).toContain('"surfaceId":"ask-1"')
    expect(JSON.stringify(turn1)).toContain('"component":"Slider"')
    expect(findings({ turns: [] }, turn1)).toEqual([])
  })

  it('turn 2 (stand with no hand in play) is a note only: no surface, no finding', () => {
    expect(turn2).toEqual([])
    expect(findings(sessionFor(turn1), turn2)).toEqual([])
  })
})
