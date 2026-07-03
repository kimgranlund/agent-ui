// dedup.ts — hasher + dedup index (corpus LLD-C4, SPEC-R7).
//
// Two independent duplicate checks, kept as two indices inside one `DedupIndex` (LLD §5):
//   - EXACT: `canonicalHash` (LLD-C3's SHA-256 over the canonical form) equality against every
//     already-admitted record's hash. A byte-for-byte identical A2UI output, however it was spelled.
//   - NEAR: a MinHash(128 permutations) estimate of Jaccard similarity over k=3 TOKEN shingles of
//     `promptText + " " + canonicalSerialized` (the exact recipe is the caller's, LLD-C5 §6 — this
//     module only turns text into a signature and signatures into a similarity estimate). A tie at
//     exactly `θ_dup` counts as a duplicate — SPEC-R7 AC2's bound is "≥", inclusive.
//
// `DedupIndex` widens the LLD §5 sketch by one method: the sketch's `addSignature(name, sig)` has no
// counterpart for populating `exact()`'s backing map, so `addExact(name, hash)` is added here as the
// minimal, symmetric completion (documented — not a new duplicate-detection MECHANISM, just the write
// side of the read the LLD already specifies).
//
// Determinism (no `Math.random`, SPEC-N6-adjacent): the MinHash permutation family is generated once,
// at module load, from a FIXED-seed 64-bit LCG (Knuth/PCG constants) — same coefficients every run,
// every platform. Zero-dep, platform-neutral (SPEC-N5): no imports at all.

/** MinHash permutation count (LLD §5 — fixed by the algorithm, not a tunable). */
export const MINHASH_PERMS = 128
/** Token-shingle window size (LLD §5 — fixed by the algorithm, not a tunable). */
export const SHINGLE_K = 3
/** Default near-duplicate similarity gate (SPEC-R7: "SHOULD be documented and tunable" — callers
 * pass their own `theta` to `near()`; this is the named default so it is never a literal buried in
 * admission code). */
export const DEFAULT_THETA_DUP = 0.9

// A Mersenne prime — the standard modulus choice for MinHash's universal-hash permutation family
// (large enough that a 32-bit shingle hash is always a valid residue).
const PRIME = (1n << 61n) - 1n
// Reduce a permutation result down to the Uint32Array-storable domain (0..2^32-1). A second, fixed
// reduction — distinct from PRIME — so the stored signature entries are plain 32-bit values while the
// permutation math itself runs in the full 61-bit field.
const UINT32_MOD = 1n << 32n

/**
 * Split text into word tokens (`\w+`). Case-sensitive and unopinionated about punctuation beyond
 * word-character boundaries — SPEC-R7 doesn't prescribe normalization, so none is invented here.
 */
export function tokenize(text: string): string[] {
  return text.match(/\w+/g) ?? []
}

/**
 * Build the k-token shingle set (LLD §5 "token shingles (k=3)"): sliding windows of `k` consecutive
 * tokens, joined with a space. Fewer than `k` tokens (including zero) degrade to ONE shingle — the
 * full (possibly empty) token sequence — so short/empty text still yields a well-defined, consistent
 * signature rather than an empty shingle set.
 */
export function shingleSet(tokens: readonly string[], k: number = SHINGLE_K): string[] {
  if (tokens.length < k) return [tokens.join(' ')]
  const out: string[] = []
  for (let i = 0; i <= tokens.length - k; i++) out.push(tokens.slice(i, i + k).join(' '))
  return out
}

// FNV-1a, 32-bit — a fast, well-known, synchronous string hash (no crypto needed here; canonical.ts
// owns the cryptographic SHA-256 exact-hash, this is only the MinHash base hash per shingle).
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

interface Coefficients {
  a: bigint
  b: bigint
}

// Fixed-seed 64-bit LCG (the Knuth/PCG multiplier+increment pair) — deterministic, NOT Math.random,
// so the same 128 (a,b) pairs are generated every run/platform (LLD-C4's near-dup signatures must be
// reproducible, not just self-consistent within one process).
function generateCoefficients(count: number): Coefficients[] {
  let state = 0x2f6e2b1n // arbitrary fixed seed
  const next = (): bigint => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn
    return state
  }
  const out: Coefficients[] = []
  for (let i = 0; i < count; i++) {
    const a = (next() % (PRIME - 1n)) + 1n // nonzero multiplier
    const b = next() % PRIME
    out.push({ a, b })
  }
  return out
}

const COEFFICIENTS: readonly Coefficients[] = generateCoefficients(MINHASH_PERMS)

/**
 * Compute the MinHash signature of `text` (LLD §5): tokenize → k=3 shingle → per-shingle FNV-1a base
 * hash → 128 universal-hash permutations, each signature entry the min permuted value across all
 * shingles. Pure and deterministic — identical input always yields a byte-identical signature.
 *
 * The caller composes the exact text to hash (LLD-C5 §6: `promptText + " " + canonicalSerialized`);
 * this function is a generic text→signature primitive, not coupled to `CorpusRecord`.
 */
export function minHashSignature(text: string): Uint32Array {
  const shingles = shingleSet(tokenize(text))
  const baseHashes = shingles.map((s) => BigInt(fnv1a(s)))
  const sig = new Uint32Array(MINHASH_PERMS)

  for (let i = 0; i < MINHASH_PERMS; i++) {
    const { a, b } = COEFFICIENTS[i]!
    let min = PRIME
    for (const h of baseHashes) {
      const v = (a * h + b) % PRIME
      if (v < min) min = v
    }
    sig[i] = Number(min % UINT32_MOD)
  }
  return sig
}

/** Estimate Jaccard similarity from two equal-length MinHash signatures: the fraction of matching
 * slots. Mismatched lengths or empty signatures have no defined overlap and estimate to 0. */
export function jaccardEstimate(a: Uint32Array, b: Uint32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let matches = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) matches++
  return matches / a.length
}

/** The LLD §5 dedup index: an exact-hash map plus an accumulating set of near-dup signatures. */
export interface DedupIndex {
  /** Register an admitted record's exact canonical hash (the `exact()` read side's write path). */
  addExact(name: string, hash: string): void
  /** Register an admitted record's MinHash signature (LLD §5's sketch). */
  addSignature(name: string, sig: Uint32Array): void
  /** The colliding record name if `hash` exactly matches an admitted record's, else `null`. */
  exact(hash: string): string | null
  /** The best-matching record name if its similarity to `sig` is `>= theta` (inclusive), else `null`. */
  near(sig: Uint32Array, theta: number): string | null
}

/** Create an empty `DedupIndex`. An empty index always returns `null` from both checks — the first
 * record admitted against it never collides (LLD §5 "empty corpus" edge). */
export function createDedupIndex(): DedupIndex {
  const byHash = new Map<string, string>()
  const signatures: Array<{ name: string; sig: Uint32Array }> = []

  return {
    addExact(name, hash) {
      byHash.set(hash, name)
    },
    addSignature(name, sig) {
      signatures.push({ name, sig })
    },
    exact(hash) {
      return byHash.get(hash) ?? null
    },
    near(sig, theta) {
      let best: { name: string; score: number } | null = null
      for (const entry of signatures) {
        const score = jaccardEstimate(sig, entry.sig)
        // ">=" — SPEC-R7 AC2's inclusive bound; a tie at exactly theta counts as a duplicate.
        if (score >= theta && (best === null || score > best.score)) best = { name: entry.name, score }
      }
      return best?.name ?? null
    },
  }
}
