import { describe, it, expect } from 'vitest'
import {
  createDedupIndex,
  minHashSignature,
  jaccardEstimate,
  shingleSet,
  tokenize,
  DEFAULT_THETA_DUP,
  MINHASH_PERMS,
} from './dedup.ts'

describe('DEFAULT_THETA_DUP — documented, not a buried literal (SPEC-R7)', () => {
  it('is exported as 0.9 and consumed as an ordinary parameter by near()', () => {
    expect(DEFAULT_THETA_DUP).toBe(0.9)
    const index = createDedupIndex()
    const sig = minHashSignature('anything')
    // near() takes theta as a parameter; DEFAULT_THETA_DUP is just the caller's usual choice.
    expect(index.near(sig, DEFAULT_THETA_DUP)).toBeNull()
  })
})

describe('shingleSet / tokenize — the k=3 token-shingle mechanism (LLD §5)', () => {
  it('tokenizes on word boundaries', () => {
    expect(tokenize('build me a login-form, please!')).toEqual(['build', 'me', 'a', 'login', 'form', 'please'])
  })

  it('builds k=3 sliding-window shingles over tokens', () => {
    expect(shingleSet(['the', 'quick', 'brown', 'fox'], 3)).toEqual(['the quick brown', 'quick brown fox'])
  })

  it('degrades to one shingle (the whole joined sequence) when fewer than k tokens exist', () => {
    expect(shingleSet(['solo'], 3)).toEqual(['solo'])
    expect(shingleSet([], 3)).toEqual([''])
  })
})

describe('minHashSignature — determinism (no Math.random)', () => {
  it('the same text always yields a byte-identical signature', () => {
    const text = 'build me a login form with a username and password field'
    const a = minHashSignature(text)
    const b = minHashSignature(text)
    expect(a).toHaveLength(MINHASH_PERMS)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('two calls in a fresh process-independent computation agree bit-for-bit across repeated calls', () => {
    // Re-derives the signature 5x; any Math.random-seeded or clock-seeded coefficient generation would
    // make at least one of these disagree.
    const sigs = Array.from({ length: 5 }, () => minHashSignature('repeat me exactly'))
    for (const s of sigs.slice(1)) expect(Array.from(s)).toEqual(Array.from(sigs[0]!))
  })
})

describe('DedupIndex — exact duplicates (SPEC-R7 AC1)', () => {
  it('an exact canonical-hash collision reports the colliding name', () => {
    const index = createDedupIndex()
    index.addExact('login-form-exemplar', 'sha256:abc123')
    expect(index.exact('sha256:abc123')).toBe('login-form-exemplar')
  })

  it('a non-matching hash reports no collision', () => {
    const index = createDedupIndex()
    index.addExact('login-form-exemplar', 'sha256:abc123')
    expect(index.exact('sha256:def456')).toBeNull()
  })
})

describe('DedupIndex — near duplicates, inclusive θ_dup boundary (SPEC-R7 AC2)', () => {
  // Synthetic signatures (not run through minHashSignature) so the match ratio is EXACT — 128 slots
  // cannot express 0.9 evenly (0.9 * 128 = 115.2), so the inclusive-boundary property is proven at
  // the jaccardEstimate/near level with a length that divides evenly.
  const length = 100
  const base = new Uint32Array(Array.from({ length }, (_, i) => i))

  function withMismatches(count: number): Uint32Array {
    const copy = base.slice()
    for (let i = 0; i < count; i++) copy[i] = 100000 + i // distinct, out-of-range replacement values
    return copy
  }

  it('a signature at EXACTLY the threshold (90/100 = 0.90) counts as a duplicate', () => {
    const atThreshold = withMismatches(10) // 90 matches / 100 = 0.90
    expect(jaccardEstimate(base, atThreshold)).toBeCloseTo(0.9, 10)

    const index = createDedupIndex()
    index.addSignature('earlier-record', base)
    expect(index.near(atThreshold, 0.9)).toBe('earlier-record')
  })

  it('a signature just below the threshold (89/100 = 0.89) is NOT a duplicate', () => {
    const belowThreshold = withMismatches(11) // 89 matches / 100 = 0.89
    expect(jaccardEstimate(base, belowThreshold)).toBeCloseTo(0.89, 10)

    const index = createDedupIndex()
    index.addSignature('earlier-record', base)
    expect(index.near(belowThreshold, 0.9)).toBeNull()
  })

  it('a clearly distinct pair passes (real MinHash signatures over unrelated text)', () => {
    const index = createDedupIndex()
    index.addSignature('login-form', minHashSignature('build me a login form with username and password'))
    const distinct = minHashSignature('render a quarterly revenue chart grouped by region')
    expect(index.near(distinct, DEFAULT_THETA_DUP)).toBeNull()
  })

  it('near-identical real text (one word changed) is flagged as a near-duplicate at the default gate', () => {
    // Long enough that a single-token edit touches only a small fraction of the k=3 shingle set —
    // empirically ~0.93 exact shingle-Jaccard / ~0.945 MinHash estimate, safely above the 0.9 gate.
    // A short near-identical sentence (a handful of shingles) does NOT clear 0.9 — the edit's affected
    // shingles are too large a fraction of the total — so this fixture's length is load-bearing.
    const original =
      'build me a login form with a username field a password field a remember me checkbox ' +
      'a forgot password link styled as a subtle text button and a primary submit button ' +
      'labeled Log In placed below the fields with generous spacing and a card container ' +
      'the card should have a soft shadow and rounded corners with a header that reads ' +
      'welcome back and a short subtitle that reads please sign in to continue to your ' +
      'dashboard and see your latest notifications and account activity summary here now'
    const index = createDedupIndex()
    index.addSignature('login-form-v1', minHashSignature(original))
    const nearIdentical = original.replace('Log In', 'Sign In')
    expect(index.near(minHashSignature(nearIdentical), DEFAULT_THETA_DUP)).toBe('login-form-v1')
  })
})

describe('DedupIndex — empty index (LLD §5 edge case)', () => {
  it('admits the first record: both checks return null against an empty index', () => {
    const index = createDedupIndex()
    expect(index.exact('sha256:anything')).toBeNull()
    expect(index.near(minHashSignature('anything at all'), DEFAULT_THETA_DUP)).toBeNull()
  })
})

describe('DedupIndex — first-record-admits ordering (LLD §13 s4)', () => {
  it('the earlier record wins: a later, identical candidate collides with the FIRST name added', () => {
    const index = createDedupIndex()
    const sig = minHashSignature('build me a login form')

    // Before the first record is added, an identical candidate is not yet a duplicate of anything.
    expect(index.near(sig, DEFAULT_THETA_DUP)).toBeNull()

    index.addSignature('first-admitted', sig)
    // The same candidate, checked again, now collides with the earlier record's name.
    expect(index.near(sig, DEFAULT_THETA_DUP)).toBe('first-admitted')

    // A second later record with the identical signature would ALSO collide with the first (never
    // with itself — it is the candidate being checked, not yet added).
    index.addSignature('second-admitted', sig)
    expect(index.near(sig, DEFAULT_THETA_DUP)).toBe('first-admitted')
  })
})
