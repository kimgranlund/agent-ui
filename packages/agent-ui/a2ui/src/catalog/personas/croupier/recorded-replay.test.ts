// recorded-replay.test.ts: offline replay of real Haiku Croupier turns (GH #1795, T-0004; re-recorded on
// claude-haiku-5-5, T-0033). The fixtures in __fixtures__/ were captured through produce() with the Croupier
// catalog (capture-meta.json); no network or key is needed here. On 5.5 turn 1 asks for a bet (no hand yet)
// and turn 2 ("stand") answers in a note with no surface, so the old HAND_COUNT symptom (three dealer cards
// listed, two rendered) no longer appears in the recording; the nested-list fix stays pinned in checks.test.ts.

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
  it('turn 1 (bet ask) states no inconsistent hand', () => {
    expect(turn1.length).toBeGreaterThan(0)
    expect(croupierHandConsistency.check({ surfaces: semanticSurfaceViews({ turns: [] }, turn1) })).toEqual([])
  })

  it('turn 2 (stand with no hand in play) emits no surface and no finding', () => {
    expect(turn2).toEqual([])
    expect(croupierHandConsistency.check({ surfaces: semanticSurfaceViews(session, turn2) })).toEqual([])
  })
})
