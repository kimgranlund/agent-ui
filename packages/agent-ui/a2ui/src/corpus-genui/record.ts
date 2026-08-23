// record.ts — LLD-C1 §3.1 (GH #1584, genui-b3-judged-eval.lld.md): `GenuiCorpusRecord` + its validator.
//
// Tier-1 for GenUI is the WIRE's own structural gate (SPEC-R1/R2 — `readGenuiLine`/`GENUI_MAX_HTML_BYTES`,
// `genui-line.ts`), never a second copy of it: a well-formed candidate must round-trip through
// `formatGenuiLine(surfaceId, html)` -> `readGenuiLine()`. There is deliberately no canonicalizer, no
// near-dup index, no healer — the artifact is opaque HTML (§3.4). `validateGenuiRecord` is pure, total,
// batched (never throws, mirrors `src/corpus/record.ts`'s `validateRecord`), and SYNC — the hash
// recompute is async (`genuiRecordHashes`, `globalThis.crypto.subtle`), so a caller that wants the
// `E_HASH` cross-check computes it separately and passes the fresh value in (LLD §3.1: "the validator is
// sync except the hash recompute, which the shell and the gate call separately").
//
// Zero-dep, platform-neutral (ADR-0062): only `../agent/genui-line.ts` (the wire's own constant/reader)
// and `./lint.ts` (the `GenuiHtmlLint` shape) are imported — no `node:*`.

// The gate's own door: ADR-0137 clause 8's COMPOSITION CONTAINMENT leg (gates.test.ts) forbids any
// non-`src/agent/` module from reaching `src/agent/` by a RELATIVE path — "the package's own './agent'
// export is the only legal door". `./agent/genui-line` is a real, declared `package.json` exports
// subpath (`"./agent/genui-line": "./src/agent/genui-line.ts"`) — Node's own package self-reference
// resolves this bare specifier from within the SAME package with no node_modules entry required.
import { formatGenuiLine, readGenuiLine } from '@agent-ui/a2ui/agent/genui-line'
import type { GenuiHtmlLint } from './lint.ts'

/** v1: eval only (§3.4) — `'exemplar'` is reserved, deliberately not a member: a GenUI record is never
 *  retrieval-conditioning material (the PACKS condition the prompt, not records). */
export type GenuiFacet = 'eval'
/** No quarantine — an eval record below bar IS the measurement (§3.4's no-quarantine posture). */
export type GenuiStatus = 'pending' | 'judged'
export type GenuiProvenanceSource = 'generated' | 'captured'

export interface GenuiCorpusRecord {
  /** `<packId|control>--<promptId>--<runId>` — unique across the dir (the A2UI `name` join-key law). */
  name: string
  /** ∈ prompts.json. */
  promptId: string
  /** Verbatim copy of the prompt that produced `html` (pinned — prompts.json may evolve). */
  promptText: string
  /** `null` = the pack-less control arm (§4.3); else ∈ `GENUI_PACKS` ids. */
  packId: string | null
  /** From the genui envelope. */
  surfaceId: string
  /** The envelope's html VERBATIM. */
  html: string
  meta: {
    facet: GenuiFacet
    status: GenuiStatus
    /** `prompts.json`'s `promptSetVersion` at generation time. */
    promptSetVersion: number
    /** sha-256 of the pack body that conditioned the turn — `null` for the control arm. */
    packHash: string | null
    /** sha-256 of `html` — identity + exact-dedup key + what a verdict binds to. */
    htmlHash: string
    /** The allowlisted model id (`generate`) — `null` for captured. */
    model: string | null
    /** The `GenuiSurfaceConfig.dogfood` pin (v1 default `false`). */
    dogfood: boolean
    /** ISO-8601. */
    generatedAt: string
    provenance: { source: GenuiProvenanceSource; origin: string }
    /** Deterministic D4 evidence, filled at write time. */
    lint: GenuiHtmlLint
    /** Present iff `status === 'judged'`; copied from the archived verdict. */
    qualityScore?: number
    passed?: boolean
    failingDimensions?: string[]
    /** The archived `GenuiVerdictsFile`'s own `date` — the traceability pointer. */
    verdictDate?: string
  }
}

export type GenuiAdmitCode = 'E_SCHEMA' | 'E_WIRE' | 'E_HASH' | 'E_SCORE_ORPHAN' | 'E_DUP' | 'E_NO_GENUI' | 'E_JUDGE_PARSE'

export interface GenuiRecordFailure {
  code: GenuiAdmitCode
  path: string
}

const FACETS: ReadonlySet<string> = new Set<GenuiFacet>(['eval'])
const STATUSES: ReadonlySet<string> = new Set<GenuiStatus>(['pending', 'judged'])
const PROVENANCE_SOURCES: ReadonlySet<string> = new Set<GenuiProvenanceSource>(['generated', 'captured'])

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function requireStr(o: Record<string, unknown>, key: string, path: string, failures: GenuiRecordFailure[]): string | undefined {
  const v = o[key]
  if (typeof v !== 'string' || v === '') {
    failures.push({ code: 'E_SCHEMA', path })
    return undefined
  }
  return v
}

function requireStrOrNull(o: Record<string, unknown>, key: string, path: string, failures: GenuiRecordFailure[]): void {
  const v = o[key]
  if (v !== null && typeof v !== 'string') failures.push({ code: 'E_SCHEMA', path })
}

function requireNumber(o: Record<string, unknown>, key: string, path: string, failures: GenuiRecordFailure[]): void {
  if (typeof o[key] !== 'number') failures.push({ code: 'E_SCHEMA', path })
}

function requireBoolean(o: Record<string, unknown>, key: string, path: string, failures: GenuiRecordFailure[]): void {
  if (typeof o[key] !== 'boolean') failures.push({ code: 'E_SCHEMA', path })
}

function checkLint(lint: unknown, path: string, failures: GenuiRecordFailure[]): void {
  if (!isObject(lint)) {
    failures.push({ code: 'E_SCHEMA', path })
    return
  }
  requireNumber(lint, 'byteLength', `${path}.byteLength`, failures)
  requireNumber(lint, 'externalRefs', `${path}.externalRefs`, failures)
  requireNumber(lint, 'tokenRefs', `${path}.tokenRefs`, failures)
  requireNumber(lint, 'scriptBlocks', `${path}.scriptBlocks`, failures)
  requireBoolean(lint, 'hasDoctype', `${path}.hasDoctype`, failures)
}

function checkProvenance(provenance: unknown, path: string, failures: GenuiRecordFailure[]): void {
  if (!isObject(provenance)) {
    failures.push({ code: 'E_SCHEMA', path })
    return
  }
  if (typeof provenance.source !== 'string' || !PROVENANCE_SOURCES.has(provenance.source)) {
    failures.push({ code: 'E_SCHEMA', path: `${path}.source` })
  }
  requireStr(provenance, 'origin', `${path}.origin`, failures)
}

function checkMeta(meta: unknown, failures: GenuiRecordFailure[]): Record<string, unknown> | undefined {
  if (!isObject(meta)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta' })
    return undefined
  }
  if (typeof meta.facet !== 'string' || !FACETS.has(meta.facet)) failures.push({ code: 'E_SCHEMA', path: 'meta.facet' })
  if (typeof meta.status !== 'string' || !STATUSES.has(meta.status)) failures.push({ code: 'E_SCHEMA', path: 'meta.status' })
  requireNumber(meta, 'promptSetVersion', 'meta.promptSetVersion', failures)
  requireStrOrNull(meta, 'packHash', 'meta.packHash', failures)
  requireStr(meta, 'htmlHash', 'meta.htmlHash', failures)
  requireStrOrNull(meta, 'model', 'meta.model', failures)
  requireBoolean(meta, 'dogfood', 'meta.dogfood', failures)
  requireStr(meta, 'generatedAt', 'meta.generatedAt', failures)
  checkProvenance(meta.provenance, 'meta.provenance', failures)
  checkLint(meta.lint, 'meta.lint', failures)

  if (meta.qualityScore !== undefined && typeof meta.qualityScore !== 'number') {
    failures.push({ code: 'E_SCHEMA', path: 'meta.qualityScore' })
  }
  if (meta.passed !== undefined && typeof meta.passed !== 'boolean') {
    failures.push({ code: 'E_SCHEMA', path: 'meta.passed' })
  }
  if (meta.failingDimensions !== undefined) {
    const fd = meta.failingDimensions
    if (!Array.isArray(fd) || fd.some((d) => typeof d !== 'string')) failures.push({ code: 'E_SCHEMA', path: 'meta.failingDimensions' })
  }
  if (meta.verdictDate !== undefined && typeof meta.verdictDate !== 'string') {
    failures.push({ code: 'E_SCHEMA', path: 'meta.verdictDate' })
  }

  // E_SCORE_ORPHAN: a score-bearing field on a non-'judged' record (LLD §3.1) — the archive cross-check
  // (an ADDITIONAL, gate-side leg over the archived verdict) lives on top of this, in the standing gate.
  if (meta.qualityScore !== undefined && meta.status !== 'judged') {
    failures.push({ code: 'E_SCORE_ORPHAN', path: 'meta.qualityScore' })
  }

  return meta
}

/**
 * Pure, total, batched (LLD §3.1). Returns `[]` on a well-formed record, else every defect found.
 *
 * `fresh`, when supplied, is the CALLER's own async hash recomputation (`genuiRecordHashes`) — comparing
 * it against the record's stored `meta.htmlHash`/`meta.packHash` is the ONLY thing this function does
 * asynchronously-adjacent (the compare itself is sync; the hash math is the caller's job, kept outside
 * this pure/total/sync contract).
 */
export function validateGenuiRecord(r: unknown, fresh?: { htmlHash: string; packHash: string | null }): GenuiRecordFailure[] {
  try {
    return run(r, fresh)
  } catch {
    return [{ code: 'E_SCHEMA', path: '' }]
  }
}

function run(r: unknown, fresh: { htmlHash: string; packHash: string | null } | undefined): GenuiRecordFailure[] {
  const failures: GenuiRecordFailure[] = []
  if (!isObject(r)) {
    failures.push({ code: 'E_SCHEMA', path: '' })
    return failures
  }

  requireStr(r, 'name', 'name', failures)
  requireStr(r, 'promptId', 'promptId', failures)
  requireStr(r, 'promptText', 'promptText', failures) // D3's floor (LLD §6): non-empty promptText
  requireStrOrNull(r, 'packId', 'packId', failures)
  const surfaceId = requireStr(r, 'surfaceId', 'surfaceId', failures)
  const html = typeof r.html === 'string' ? r.html : undefined
  if (typeof r.html !== 'string') failures.push({ code: 'E_SCHEMA', path: 'html' })

  const meta = checkMeta(r.meta, failures)

  // E_WIRE — the wire's own structural gate (SPEC-R1/R2): a well-formed candidate must round-trip
  // through formatGenuiLine -> readGenuiLine. Only run once surfaceId/html are both real strings — a
  // missing/wrong-typed field is already E_SCHEMA above, and re-flagging it as E_WIRE would be noise.
  if (surfaceId !== undefined && html !== undefined) {
    const line = formatGenuiLine(surfaceId, html)
    if (readGenuiLine(line) === undefined) failures.push({ code: 'E_WIRE', path: 'html' })
  }

  // E_HASH — stored vs fresh recomputation (only when the caller supplied one, per the LLD's sync/async split).
  if (fresh !== undefined && meta !== undefined) {
    if (typeof meta.htmlHash === 'string' && meta.htmlHash !== fresh.htmlHash) failures.push({ code: 'E_HASH', path: 'meta.htmlHash' })
    const storedPackHash = meta.packHash
    if ((typeof storedPackHash === 'string' || storedPackHash === null) && storedPackHash !== fresh.packHash) {
      failures.push({ code: 'E_HASH', path: 'meta.packHash' })
    }
  }

  return failures
}

/** sha-256 hex over UTF-8 bytes — the `canonical.ts` precedent (`globalThis.crypto.subtle`, no
 *  `node:crypto`): pure-core hashing rides the platform's own primitive, portable to Node/browser/jsdom. */
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Recompute `htmlHash`/`packHash` fresh from the artifact bytes (LLD §3.1) — `packHash` is `null` for
 *  the pack-less control arm, exactly as `meta.packHash` is. */
export async function genuiRecordHashes(html: string, packBody: string | null): Promise<{ htmlHash: string; packHash: string | null }> {
  const htmlHash = await sha256Hex(html)
  const packHash = packBody === null ? null : await sha256Hex(packBody)
  return { htmlHash, packHash }
}
