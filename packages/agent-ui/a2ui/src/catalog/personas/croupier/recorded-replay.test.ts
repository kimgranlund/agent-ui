// recorded-replay.test.ts: offline replay of real Haiku Croupier turns (GH #1795, T-0004). The fixtures
// in __fixtures__/ were captured once through produce() with the Croupier catalog (capture-meta.json); no
// network or key is needed here. Turn 2 ("stand") is the faces symptom: the dealer draws a third card into
// the data model but no PlayingCard component renders it. Red before the nested-list fix in checks.ts.

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

const turn1 = messages('haiku-blackjack-turn1.jsonl')
const turn2 = messages('haiku-blackjack-turn2-stand.jsonl')
const session: Session = {
  turns: [
    { role: 'user', content: 'black jack' },
    { role: 'assistant', content: turn1.map((m) => JSON.stringify(m)).join('\n') },
  ],
}

describe('recorded Haiku Croupier turns replay offline', () => {
  it('turn 1 (deal) states no inconsistent hand', () => {
    expect(croupierHandConsistency.check({ surfaces: semanticSurfaceViews({ turns: [] }, turn1) })).toEqual([])
  })

  it('turn 2 (stand) is caught: three dealer cards listed, two rendered', () => {
    const findings = croupierHandConsistency.check({ surfaces: semanticSurfaceViews(session, turn2) })
    expect(findings.map((f) => f.code)).toEqual(['HAND_COUNT'])
    expect(findings[0]!.path).toContain('dealer-cards')
    expect(findings[0]!.message).toContain('renders 2 cards but /game/dealer/cards lists 3')
  })
})
