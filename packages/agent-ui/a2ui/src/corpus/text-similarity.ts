// text-similarity.ts — the shared TF-IDF/cosine primitives (ADR-0091 §2: extracted out of `retrieve.ts`
// so there is exactly ONE implementation of the math). `retrieve()` (SPEC-R11, corpus LLD-C9) and
// `selectMiniSkills` (ADR-0091 §2, `tools/agent/mini-skills.ts`) are its two callers — one scores
// `CorpusRecord`s, the other scores registry `MiniSkill`s, but both rank via `topKByCosine` over a
// caller-supplied text projection, never re-deriving the tokenizer/term-count/cosine math themselves.
//
// Pure, zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports. Lives under `src/corpus/` (this
// module's own home), so it stays inside the root-barrel purity gate's exemption for `src/corpus/`
// itself (`corpus/index.test.ts`); `tools/agent/` imports it the same way `produce.ts` already imports
// other `src/corpus/*` modules directly (that gate only bars OTHER `src/*` peers, not `tools/`).

const TOKEN_RE = /[a-z0-9]+/g

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? []
}

export function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1)
  return counts
}

/**
 * TF-IDF cosine top-`k` ranking of `items` against `query`, scored over `documentText(item)`.
 *
 * Never throws. Resolves to `[]` for: an empty `items` input, `k <= 0`, or a `query` whose tokens share
 * ZERO vocabulary with `items` — a zero-norm query vector makes cosine similarity undefined for every
 * candidate, so this is a genuine "no match", never an arbitrary top-k of zero-scored items (the
 * degrade-to-empty discipline `retrieve.ts`/`fewShot` already prove).
 *
 * `tieBreak` orders equal-score items deterministically (the caller's identity field — e.g. ascending
 * record `name`, or ascending mini-skill `id`).
 *
 * `floor` (default `-Infinity`, i.e. no filtering — `retrieve.ts`'s original, unchanged behavior) drops
 * any item scoring at or below it BEFORE the top-k slice. `retrieve()` omits it (padding to `k` with a
 * weak-but-nonzero exemplar is acceptable few-shot conditioning); `selectMiniSkills` (ADR-0091 §2) passes
 * `0` — a per-turn prompt injection should never pad with a genuinely unrelated (zero-score) module just
 * to fill `cap`.
 */
export function topKByCosine<T>(
  items: readonly T[],
  documentText: (item: T) => string,
  query: string,
  k: number,
  tieBreak: (a: T, b: T) => number,
  floor: number = -Infinity,
): T[] {
  if (k <= 0 || items.length === 0) return []

  const docCounts = items.map((item) => termCounts(tokenize(documentText(item))))

  const df = new Map<string, number>()
  for (const counts of docCounts) {
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = items.length
  const idf = (term: string): number => {
    const d = df.get(term)
    return d === undefined ? 0 : Math.log((n + 1) / (d + 1)) + 1
  }

  const docNorms = docCounts.map((counts) => {
    let sumSq = 0
    for (const [term, tf] of counts) {
      const w = tf * idf(term)
      sumSq += w * w
    }
    return Math.sqrt(sumSq)
  })

  const queryCounts = termCounts(tokenize(query))
  let queryNormSq = 0
  for (const [term, tf] of queryCounts) {
    const w = tf * idf(term)
    queryNormSq += w * w
  }
  const queryNorm = Math.sqrt(queryNormSq)
  if (queryNorm === 0) return []

  const scored = items.map((item, i) => {
    let dot = 0
    for (const [term, qtf] of queryCounts) {
      const dtf = docCounts[i]!.get(term)
      if (dtf === undefined) continue
      dot += qtf * idf(term) * dtf * idf(term)
    }
    const denom = queryNorm * docNorms[i]!
    return { item, score: denom === 0 ? 0 : dot / denom }
  })

  const filtered = scored.filter((s) => s.score > floor)
  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return tieBreak(a.item, b.item)
  })

  return filtered.slice(0, k).map((s) => s.item)
}
