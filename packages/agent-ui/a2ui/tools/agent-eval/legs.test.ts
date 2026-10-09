// legs.test.ts: the agent-behavior eval's leg and repair proofs (GH #1810). Every stub output is loaded
// from the PINNED `fixtures/scripted-turns.json` by turn id, so the pinned turns are the acceptance proofs.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runPersonaLeg, runResponseTypeLeg, runSelectionLeg } from './legs.ts'
import { observeTurn } from './observe.ts'
import { scriptedProvider } from './scripted.ts'
import { loadCaseCatalog } from './cases.ts'
import type { PersonaCase, ResponseTypeCase, SelectionCase } from './cases.ts'
import { scoreResponseType } from './score.ts'

const FIXTURES = join(process.cwd(), 'packages/agent-ui/a2ui/tools/agent-eval/fixtures')

interface Turn {
  id: string
  case: Record<string, unknown>
  rounds: string[]
}

const turns = (JSON.parse(readFileSync(join(FIXTURES, 'scripted-turns.json'), 'utf8')) as { turns: Turn[] }).turns
function turn(id: string): Turn {
  const t = turns.find((x) => x.id === id)
  if (t === undefined) throw new Error(`no scripted turn "${id}"`)
  return t
}
const deps = (t: Turn) => ({ provider: scriptedProvider(t.rounds), retrieve: () => [] })
const repairTurn = (id: string) => {
  const t = turn(id)
  return observeTurn({ catalog: loadCaseCatalog(t.case.catalogId as string), prompt: t.case.prompt as string }, deps(t))
}

describe('selection leg', () => {
  it('selection leg exits 1 and names the forbidden notFor type', async () => {
    const t = turn('selection-forbidden-code')
    const c = t.case as unknown as SelectionCase
    expect(c.forbidType).toBe('Code')
    const result = await runSelectionLeg([c], deps(t))
    expect(result.exitCode).toBe(1)
    const fail = result.lines.find((l) => l.startsWith(`FAIL ${c.id}`))
    expect(fail).toBeDefined()
    expect(fail).toContain('negative: emitted forbidden Code')
    expect(result.observations.get(c.id)?.emittedTypes).toContain('Code')
  })

  it('a clean scripted selection turn passes concept and negative selection', async () => {
    const t = turn('selection-clean-text')
    const c = t.case as unknown as SelectionCase
    const result = await runSelectionLeg([c], deps(t))
    expect(result.exitCode).toBe(0)
    expect(result.lines.some((l) => l.startsWith(`PASS ${c.id}`))).toBe(true)
    expect(result.lines.some((l) => l.startsWith('FAIL '))).toBe(false)
    expect(result.observations.get(c.id)?.emittedTypes).toEqual(['Text'])
  })
})

describe('repair accounting', () => {
  it('invalid then valid scores eventual success with rounds 2 and the fed-back failureCodes', async () => {
    const obs = await repairTurn('repair-eventual')
    expect(obs.outcome).toBe('eventual')
    expect(obs.rounds).toBe(2)
    expect(obs.failureCodes).toEqual(['CATALOG'])
    expect(obs.attemptedTypes).toEqual([['NotARealComponent'], ['Button']])
  })

  it('first valid scores first-pass with rounds 1', async () => {
    const obs = await repairTurn('repair-first-pass')
    expect(obs.outcome).toBe('first-pass')
    expect(obs.rounds).toBe(1)
    expect(obs.failureCodes).toEqual([])
    expect(obs.emittedTypes).toEqual(['Button'])
  })

  it('never valid scores a halt', async () => {
    const obs = await repairTurn('repair-halt')
    expect(obs.outcome).toBe('halt')
    expect(obs.rounds).toBe(3)
    expect(obs.failureCodes).toEqual(['CATALOG'])
    expect(obs.emittedTypes).toEqual([])
  })
})

describe('persona leg', () => {
  it('a Quant turn containing a Croupier-only type fails the persona leg and names the type', async () => {
    const t = turn('persona-quant-playing-card')
    const c = t.case as unknown as PersonaCase
    expect(c.persona).toBe('quant')
    const result = await runPersonaLeg([c], deps(t))
    expect(result.exitCode).toBe(1)
    const fail = result.lines.find((l) => l.startsWith(`FAIL ${c.id}`))
    expect(fail).toContain('persona: round 1 attempted foreign PlayingCard')
    // the base catalog rejects PlayingCard, so the turn halts and the attempt is what convicts it
    expect(result.observations.get(c.id)?.outcome).toBe('halt')
  })

  it('a croupier turn with PlayingCard on its derived catalog passes the persona leg', async () => {
    const t = turn('persona-croupier-clean')
    const c = t.case as unknown as PersonaCase
    expect(c.catalogId).toBe('agent-ui--croupier')
    const result = await runPersonaLeg([c], deps(t))
    expect(result.exitCode).toBe(0)
    expect(result.observations.get(c.id)?.emittedTypes).toEqual(['PlayingCard'])
    expect(result.observations.get(c.id)?.outcome).toBe('first-pass')
  })
})

describe('response-type leg', () => {
  const shipped = (hasText: boolean, hasSurface: boolean) => ({ outcome: 'first-pass' as const, hasText, hasSurface })

  it('scores all three literals both ways, and a halt fails every expect', () => {
    expect(scoreResponseType(shipped(true, false), 'text')).toEqual([])
    expect(scoreResponseType(shipped(true, true), 'text').map((f) => f.message)).toEqual(['response-type: false-surface, expected text'])
    expect(scoreResponseType(shipped(false, true), 'surface')).toEqual([])
    expect(scoreResponseType(shipped(true, false), 'surface').map((f) => f.message)).toEqual(['response-type: missed-surface, expected surface'])
    expect(scoreResponseType(shipped(true, true), 'both')).toEqual([])
    expect(scoreResponseType(shipped(false, true), 'both').map((f) => f.message)).toEqual(['response-type: missing-text, expected both'])
    expect(scoreResponseType(shipped(true, false), 'both').map((f) => f.message)).toEqual(['response-type: missed-surface, expected both'])
    for (const e of ['text', 'surface', 'both'] as const) {
      expect(scoreResponseType({ outcome: 'halt', hasText: false, hasSurface: false }, e).map((f) => f.message)).toEqual([`response-type: halted, expected ${e}`])
    }
  })

  it('the seeded wrong choice exits 1 naming false-surface', async () => {
    const t = turn('response-type-wrong-choice')
    const c = t.case as unknown as ResponseTypeCase
    const result = await runResponseTypeLeg([c], deps(t))
    expect(result.exitCode).toBe(1)
    expect(result.lines.find((l) => l.startsWith(`FAIL ${c.id}`))).toContain('response-type: false-surface, expected text')
  })

  it('the rates line counts a known mix', async () => {
    const text = turn('response-type-text-clean')
    const surface = turn('response-type-surface-legacy')
    const tc = (id: string, expect: string): ResponseTypeCase => ({ ...(text.case as unknown as ResponseTypeCase), id, expect } as ResponseTypeCase)
    // text-only rounds: a text case passes and a surface case is a miss; surface rounds: a false surface
    const textRounds = await runResponseTypeLeg([tc('t1', 'text'), tc('s1', 'surface')], deps(text))
    expect(textRounds.lines.at(-1)).toBe('response-type rates: false-surface=0/1 missed-surface=1/1; usage input=0 output=0 over 0 of 2 turns')
    const surfaceRounds = await runResponseTypeLeg([tc('t1', 'text'), tc('t2', 'text'), tc('b1', 'both')], deps(surface))
    expect(surfaceRounds.lines.at(-1)).toBe('response-type rates: false-surface=2/2 missed-surface=0/1; usage input=0 output=0 over 0 of 3 turns')
    expect(surfaceRounds.exitCode).toBe(1)
  })

  it('appends firstLineMs to each case line only when timing is on', async () => {
    const t = turn('response-type-text-clean')
    const c = t.case as unknown as ResponseTypeCase
    const timed = await runResponseTypeLeg([c], deps(t), { timing: true })
    expect(timed.lines[0]).toMatch(/^PASS \S+ repair=first-pass .* firstLineMs=\d+$/)
    const plain = await runResponseTypeLeg([c], deps(t))
    expect(plain.lines[0]).not.toContain('firstLineMs')
    expect(typeof timed.observations.get(c.id)?.firstLineMs).toBe('number')
  })

  it('the session-update turn passes with its session and halts without it', async () => {
    const t = turn('response-type-session-update')
    const c = t.case as unknown as ResponseTypeCase
    expect(c.session?.turns).toHaveLength(2)
    const withSession = await runResponseTypeLeg([c], deps(t))
    expect(withSession.exitCode).toBe(0)
    expect(withSession.observations.get(c.id)).toMatchObject({ hasText: true, hasSurface: true, outcome: 'first-pass' })
    const { session: _dropped, ...bare } = c
    const without = await runResponseTypeLeg([bare], deps(t))
    expect(without.exitCode).toBe(1)
    expect(without.observations.get(c.id)?.failureCodes).toEqual(['IDGRAPH'])
    expect(without.lines.find((l) => l.startsWith(`FAIL ${c.id}`))).toContain('response-type: halted, expected both')
  })
})
