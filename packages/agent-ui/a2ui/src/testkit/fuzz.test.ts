// fuzz.test.ts: seeded mutation fuzz over the green scenarios (T-0011). For every scenario whose first turn is
// a `lines` turn, every operator and every seed in a fixed list:
//   - the validator and the renderer never throw on the raw mutant;
//   - a form mutant heals back to the original line's messages, and the mutated line's repair set gains
//     exactly its FORM_REPAIR name;
//   - a semantic mutant is rejected with its SEMANTIC_CODE.
// Each case is its own test named by scenario, operator and seed, so a failure prints both. Every operator
// must apply to at least one case, or the fuzz is vacuous for it.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { kitScenarioFiles } from '../../tools/testkit/load.vite.ts'
import { resolveKitCatalog } from '../../tools/testkit/catalogs.ts'
import { parseScenario, isLinesTurn } from '../../tools/testkit/scenario.ts'
import { FORM_REPAIR, OPERATORS, SEMANTIC_CODE, mutateWith } from '../../tools/testkit/mutate.ts'
import { createKitMount } from '../../tools/testkit/mount.ts'
import { heal } from '../corpus/heal.ts'
import { validateA2ui } from '../renderer/validate.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const SEEDS = [1, 17, 2026]
const PIN = { protocolVersion: 'v1.0' }

const firstTurns = kitScenarioFiles()
  .map((f) => parseScenario(f.raw))
  .flatMap((s) => {
    const t = s.turns[0]!
    return isLinesTurn(t) ? [{ scenario: s, lines: t.respond.lines, atFinalize: t.atFinalize === true }] : []
  })

const cases = firstTurns.flatMap(({ scenario, lines, atFinalize }) =>
  OPERATORS.flatMap((op) => SEEDS.flatMap((seed) => {
    const mutant = mutateWith(lines, op.name, seed)
    return mutant === undefined ? [] : [{ scenario, lines, atFinalize, op, seed, mutant }]
  })),
)

const healLine = (line: string) => heal(line, PIN)
const repairs = (line: string): string[] => {
  const h = healLine(line)
  return h.ok ? h.repairs.filter((r) => r !== 'single-object-envelope') : []
}

describe('mutation fuzz over the green scenarios', () => {
  it('there are green lines turns to fuzz, and every operator applies to at least one case', () => {
    expect(firstTurns.length).toBeGreaterThan(0)
    for (const op of OPERATORS) expect(cases.some((c) => c.op.name === op.name), op.name).toBe(true)
  })

  for (const { scenario, lines, atFinalize, op, seed, mutant } of cases) {
    it(`${scenario.name} ${op.name} seed=${seed}`, async () => {
      const catalog = resolveKitCatalog(scenario.catalogId)!
      expect(() => validateA2ui(mutant.lines.join('\n'), catalog)).not.toThrow()
      const m = createKitMount()
      try {
        expect(() => {
          m.ingest(mutant.lines)
          m.finalize()
        }).not.toThrow()
        await new Promise((r) => setTimeout(r, 0))
      } finally {
        m.dispose()
      }
      const original = lines[mutant.index]!
      const mutated = mutant.lines[mutant.index]!
      if (op.kind === 'form') {
        const before = healLine(original)
        const after = healLine(mutated)
        expect(after.ok, `seed=${seed} op=${op.name}`).toBe(true)
        expect(after.ok && before.ok && after.messages, `seed=${seed} op=${op.name}`).toEqual(before.ok && before.messages)
        const gained = repairs(mutated).filter((r) => !repairs(original).includes(r))
        expect(gained, `seed=${seed} op=${op.name}`).toEqual([FORM_REPAIR[op.name]])
      } else {
        const messages = mutant.lines.flatMap((l) => {
          const h = healLine(l)
          return h.ok ? h.messages : []
        })
        const verdict = validateA2ui(messages, catalog, undefined, { atFinalize })
        expect(verdict.failures.map((f) => f.code), `seed=${seed} op=${op.name}`).toContain(SEMANTIC_CODE[op.name])
      }
    })
  }
})
