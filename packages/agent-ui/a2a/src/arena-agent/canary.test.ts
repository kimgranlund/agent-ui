// canary.test.ts — review finding 3 (LLD §7): `deriveCanary` is deterministic (FNV-1a); `deriveCanaryPair`
// asserts X !== O at match construction, fail-fast, rather than the stale "regenerate (guard loop)"
// wording a deterministic derivation can never actually satisfy. Lives under `src/` (not `tools/`) for the
// same vitest-glob reason as `model-seat.test.ts`/`match.test.ts` (only `packages/agent-ui/*/src/**/*.test.ts`
// is included — see the root `vitest.config.ts`).
import { describe, expect, it } from 'vitest'
import { deriveCanary, deriveCanaryPair } from '../../tools/arena/canary.ts'

describe('deriveCanary (LLD §2/§7) — deterministic, mark-mixed', () => {
  it('is byte-identical across repeated calls for the same matchId+mark (SPEC-N3)', () => {
    expect(deriveCanary('m1', 'X')).toBe(deriveCanary('m1', 'X'))
  })

  it('differs between X and O for the same matchId (mark is mixed into the seed)', () => {
    expect(deriveCanary('m1', 'X')).not.toBe(deriveCanary('m1', 'O'))
  })

  it('differs across matchIds for the same mark', () => {
    expect(deriveCanary('m1', 'X')).not.toBe(deriveCanary('m2', 'X'))
  })
})

describe('deriveCanaryPair (review finding 3) — the fail-fast collision guard', () => {
  it('returns the same two values deriveCanary would, for an ordinary matchId', () => {
    const pair = deriveCanaryPair('flagship-001')
    expect(pair).toEqual({ X: deriveCanary('flagship-001', 'X'), O: deriveCanary('flagship-001', 'O') })
  })

  it('asserts X !== O — throws loudly (never silently regenerates) on a forced collision', () => {
    // A real FNV-1a collision isn't cheaply reachable by picking a "bad" matchId in a unit test (32-bit
    // hash space) — the injectable `derive` seam exercises the ACTUAL throw branch directly instead of
    // duplicating the guard's logic in the test.
    expect(() => deriveCanaryPair('collision-fixture', () => 'SAME-CANARY-FOR-BOTH')).toThrow(/canary collision/)
  })

  it('never calls `derive` for a mark other than X/O, and calls it exactly once per mark', () => {
    const calls: string[] = []
    const derive = (matchId: string, mark: 'X' | 'O') => {
      calls.push(`${matchId}:${mark}`)
      return `${matchId}-${mark}`
    }
    deriveCanaryPair('m3', derive)
    expect(calls).toEqual(['m3:X', 'm3:O'])
  })
})
