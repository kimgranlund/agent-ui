// canary.ts — LLD §2: `A2A-ISOLATION-CANARY-${seatId}-${hex128()}`, deterministically derived (not
// crypto-random) from `matchId`+`mark` via a plain FNV-1a hash. Determinism is load-bearing here, not
// incidental: SPEC-N3 requires the scripted CI backbone to produce a BYTE-IDENTICAL transcript across
// repeated runs of the SAME matchId (SPEC-R12 AC1) — true randomness would break that. Uniqueness within
// one match is guaranteed by mixing `mark` into the seed (X and O always hash to different values).
import type { Mark } from '../../src/arena/board.ts'

function fnv1a(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function deriveCanary(matchId: string, mark: Mark): string {
  const hex = fnv1a(`${matchId}:${mark}`).toString(16).padStart(8, '0')
  return `A2A-ISOLATION-CANARY-${mark}-${hex}`
}

/**
 * Derive BOTH seat canaries for one match (the review's fix, LLD §7): asserts `X !== O`, fail-fast, at
 * match construction. Deterministic derivation (SPEC-N3) means a collision can never be papered over by
 * "regenerate and retry" — the SAME matchId always re-derives the SAME pair, so a loop would spin forever
 * on a real collision. A throw is the correct guard instead: cheap (one string compare), and fail-safe —
 * a collision could only ever make the isolation gate's canary check (check 1) throw a FALSE-POSITIVE
 * ("X's canary found in O's context" when it's really just the same value, no leak), never hide a real
 * leak, so failing loudly here is strictly safer than shipping a match built on colliding canaries.
 * Mixing `mark` into the seed already keeps X and O apart for any real matchId — this guard exists for
 * the fixed-width-hash edge case, not because collision is expected.
 *
 * `derive` is a test-only injectable seam (defaults to `deriveCanary`, every real caller's implicit
 * choice) — it exists so the throw branch itself is exercised directly, with a forced collision, rather
 * than left unreachable-in-practice and untested (canary.test.ts).
 */
export function deriveCanaryPair(matchId: string, derive: (matchId: string, mark: Mark) => string = deriveCanary): { X: string; O: string } {
  const X = derive(matchId, 'X')
  const O = derive(matchId, 'O')
  if (X === O) {
    throw new Error(`deriveCanaryPair: canary collision for matchId "${matchId}" — X and O derived the same canary (${X})`)
  }
  return { X, O }
}
