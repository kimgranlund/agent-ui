// produce-narration.test.ts: T-0234. An ordinary turn's reply talks about the game or the booking, never about the
// surfaces: a reply that names a surface id of the session ("I've built it now as table-2", Opus 5.5,
// 2026-10-15.jsonl:260) or opens a correction of an earlier turn ("I need to correct my last turn", Haiku 5.5, :44)
// gets NARRATED_MECHANICS and one repair round. A second narrated reply ships tallied (NARRATION_UNCORRECTED), never
// a halt. Keyless, scripted provider, no persona checks: the finding is the producer's own.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { AgentProvider, Session, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { croupierFragment } from '../catalog/personas/croupier/manifest.ts'
import { DEAL_TURN, toJsonl } from '../catalog/personas/croupier/hands.fixture.ts'

const catalog = composeCatalog(defaultCatalog, croupierFragment, 'croupier')
const session: Session = { turns: [{ role: 'user', content: 'Deal round 3' }, { role: 'assistant', content: toJsonl(DEAL_TURN) }] }
const input: TurnInput = { kind: 'intent', text: 'Check, or call if there is a bet.', session }

function scripted(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: string[] } {
  let n = 0
  const reqs: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      reqs.push(req.messages.at(-1)!.content)
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs }
}

async function run(outputs: string[]): Promise<{ calls: number; reqs: string[]; rounds: number; codes: string[]; note: string | undefined }> {
  const s = scripted(outputs)
  const lines: string[] = []
  for await (const line of produce(input, { provider: s.provider, retrieve: () => [], catalog }, { maxRounds: 3 })) lines.push(line)
  const meta = lines.map((l) => readMetaLine(l)?.a2uiMeta).find((m) => m?.trace !== undefined)
  return { calls: s.calls(), reqs: s.reqs, rounds: meta?.trace?.rounds ?? 0, codes: [...(meta?.trace?.failureCodes ?? [])], note: meta?.note }
}

const note = (text: string): string => JSON.stringify({ a2uiMeta: { note: text } })
const CLEAN = note('I check behind. The turn is the K of diamonds; you act first: check, or bet up to the pot.')
const UPDATE = '{"version":"v1.0","updateComponents":{"surfaceId":"table-3","components":[{"id":"messageZone","component":"Text","variant":"body","text":"Dealer stands on 17."}]}}'

describe('produce(): a reply that narrates the surfaces is sent back once (T-0234, NARRATED_MECHANICS)', () => {
  it('a reply naming a surface id of the session spends one repair round naming the fragment', async () => {
    const r = await run([note('Last turn I never built its table, so I have built it now as table-3.'), CLEAN])
    expect(r.calls).toBe(2)
    expect(r.reqs[1]).toContain('NARRATED_MECHANICS')
    expect(r.reqs[1]).toContain('table-3')
    expect(r.rounds).toBe(2)
    expect(r.codes).toEqual(['NARRATED_MECHANICS'])
    expect(r.note).toMatch(/^I check behind/)
  })

  it('the repair sentence leaves the surface as it is when the turn needs no change (T-0332, round 9 :182)', async () => {
    // "Hit me again." after a bust: the reply rightly says nothing is left to hit but names table-3. Told only that a
    // fix is made silently on the surface, Sonnet 5.5 dealt a new round; the hint must say a no-change turn changes nothing.
    const r = await run([note('There is no hand to hit; the round on table-3 is settled.'), CLEAN])
    expect(r.reqs[1]).toContain('NARRATED_MECHANICS')
    expect(r.reqs[1]).toContain('if the turn needs no surface change, leave every surface as it is and reword only your reply')
    expect(r.reqs[1]).toContain('make the fix silently on the surface')
  })

  it('a capitalized surface id at the start of a sentence is sent back too (T-0297, "Table-3 is dealt.")', async () => {
    const r = await run([`${note('Table-3 is dealt. You have 10 and 5 for 15 against the dealer\'s 9.')}\n${UPDATE}`, `${CLEAN}\n${UPDATE}`])
    expect(r.calls).toBe(2)
    expect(r.reqs[1]).toContain('NARRATED_MECHANICS')
    expect(r.codes).toEqual(['NARRATED_MECHANICS'])
    expect(r.note).toMatch(/^I check behind/)
  })

  it('a reply that opens a correction of an earlier turn is sent back, with a payload too', async () => {
    for (const said of ['I need to correct my last turn: I described the draw but never updated your cards.', 'I made a mistake last turn.', 'I win with a pair of queens, Q of hearts... correction: Q of diamonds.']) {
      const r = await run([`${note(said)}\n${UPDATE}`, `${CLEAN}\n${UPDATE}`])
      expect(r.codes, said).toEqual(['NARRATED_MECHANICS'])
      expect(r.calls, said).toBe(2)
    }
  })

  it('a second narrated reply ships tallied, never a halt; a clean reply ships on round 1', async () => {
    const twice = await run([note('I also need to correct my opening.')])
    expect(twice.calls).toBe(2)
    expect(twice.codes).toEqual(['NARRATED_MECHANICS', 'NARRATION_UNCORRECTED'])
    const clean = await run([CLEAN])
    expect(clean.calls).toBe(1)
    expect(clean.codes).toEqual([])
  })
})
