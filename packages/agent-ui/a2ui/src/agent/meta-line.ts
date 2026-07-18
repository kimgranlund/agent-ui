// meta-line.ts — ADR-0088 §1: the reserved leading meta-line envelope + its guard.
//
// The demo-transport's natural-language `note` (+ the ADR-0088 §2 `TurnTrace`) rides the SAME
// `AsyncIterable<string>` stream `AgentTransport.turn()` already returns (`agent-transport.ts:67-69`) —
// as a single reserved JSON line, emitted FIRST, ahead of any A2UI JSONL. This is a demo-transport
// FRAMING convention, not part of the A2UI protocol: it carries no `version` key, so it is provably
// **not** an `A2uiServerMessage` — every server message carries `version` plus one of the fixed
// envelope keys that `dispatch()` routes on (`../../src/renderer/dispatch.ts:72-78`: the version gate at
// line 76, the envelope-key `if`-chain after). `produce()` (LLD-C3) peels this line off `raw` BEFORE
// heal/validateA2ui — the note never reaches the shared validator and never enters the corpus path
// (SPEC-N3 wire purity, ADR-0070 clause 3).
//
// ADR-0097 §1 adds ONE additive field, `ask`: the model declares a feed-embedded ask by carrying
// `{surfaceId}` on the SAME leading meta-line as `note`. The `ask` payload itself is ORDINARY A2UI — it
// rides the shared validated stream exactly like every other surface (SPEC-R5 untouched); this envelope
// only carries the ROUTING fact ("that surfaceId is an ask"), never the payload. The `version` guard, the
// note/trace fields, and the disjointness-from-`A2uiServerMessage` proof are all UNCHANGED — `ask` is
// shallow-validated the SAME way `note`/`trace` are: a malformed `ask` (non-object, or missing/non-string
// `surfaceId`) yields the envelope WITHOUT `ask` (never the whole envelope dropped) — the note/trace
// still parse normally, so a broken `ask` never breaks the conversational channel it rides on.
//
// ADR-0146 F1 adds a FOURTH, RUNTIME-COMPOSED kind, `progress`: a closed-vocabulary lifecycle event
// (`{stage, round?, detail?}`) that — unlike the ONE leading `note`/`ask`/`trace` line — MAY interleave
// DURING the turn, yielded by `produce()` as stages actually happen (`produce.ts`) or replayed ahead of a
// recorded turn's lines (`recorded-transport.ts`). It rides the SAME versionless envelope, so a leaked
// progress line still fault-isolates to `VERSION_UNSUPPORTED` at the renderer (the ADR-0088 defense,
// unchanged), and is shallow-validated the SAME way `ask` is: a malformed `progress` (non-object, or a
// `stage` outside the closed union) yields the envelope WITHOUT `progress` — note/trace/ask still parse.
//
// Zero-dep, pure (SPEC-N5): no imports.

/**
 * The per-turn decision trace (ADR-0088 §2) — assembled by `produce()` from data already flowing
 * through its loop (the retrieval query, which exemplars matched, self-correct rounds, healer
 * corrections, the authoritative model). Lives browser-side, parallel to `Session.turns`
 * (`agent-transport.ts`), never inside `session.turns` and never on the validated A2UI wire — only
 * carried, transiently, on this same meta-line.
 */
export interface TurnTrace {
  turnIndex: number
  query: { intent: string; k: number }
  /** WHICH judged-shard records (`CorpusRecord.name`, unique per record) conditioned this turn. */
  exemplarIds: string[]
  /** Self-correct rounds taken (1 = first-try valid). */
  rounds: number
  /** Lines the shared healer (`../../src/corpus/heal.ts`) corrected on the round that succeeded. */
  healed: number
  /** The validator failure codes fed back into the successful round's prompt, if any. */
  failureCodes: string[]
  model: string
}

/**
 * A feed-embedded ask declaration (ADR-0097 §1): `surfaceId` names the FRESH A2UI surface, created on the
 * SAME validated stream, that hosts the ask's structured UI. This is a routing fact only — no payload, no
 * mechanics — the surface it names is ordinary `createSurface`/`updateComponents`/`updateDataModel`.
 */
export interface AskDeclaration {
  surfaceId: string
}

/**
 * The closed lifecycle-stage vocabulary a `progress` meta-line carries (ADR-0146 F1) — provider-agnostic,
 * produce-layer-owned (F4): `sent` (request issued) → `started` (the provider's first signal) →
 * `reasoning` (a thinking delta arrived) → `content` (the round's own first text fragment — `produce()` is
 * that stage's one pinned emitter) → `validating` (assemble/heal/validate entered) → `retry` (a failed
 * self-correct round, carrying its ordinal) → `done` (the turn is about to yield its final content). An
 * adapter that maps nothing degrades to the coarser subset `produce()` observes by itself — never broken.
 */
export const PROGRESS_STAGES = ['sent', 'started', 'reasoning', 'content', 'validating', 'retry', 'done'] as const
export type ProgressStage = (typeof PROGRESS_STAGES)[number]

/**
 * One live lifecycle event (ADR-0146 F1) — a closed, code/observation-authored record, NEVER model prose.
 * `round` is the self-correct ordinal (present on `retry`); `detail` is optional factual text (F3-gated —
 * only forwarded under `progressDetail: 'full'`, never required for any stage, and never on the default
 * `'stages'` dial). Carried as `{"a2uiMeta":{"progress":{…}}}` on the SAME `turn()` stream as every other
 * meta-line.
 */
export interface TurnProgress {
  stage: ProgressStage
  round?: number
  detail?: string
}

/**
 * The reserved wrapper (ADR-0088 §1/§2, ADR-0097 §1). `note` is the model's contemporaneous natural-
 * language rationale/reply; `ask` is the model-authored feed-ask routing declaration (produce() peels it,
 * verifies its integrity, and re-composes it on the outgoing meta-line only when it holds); `trace` is the
 * runtime-assembled `TurnTrace` (the model never authors `trace` itself — only `produce()` attaches it
 * before yielding). All three fields are optional: a note-only line the model emits omits `ask`/`trace`; a
 * malformed/leaked line may omit any of them.
 */
export interface A2uiMetaEnvelope {
  a2uiMeta: {
    note?: string
    ask?: AskDeclaration
    trace?: TurnTrace
    /** ADR-0146 F1 — a runtime-composed lifecycle event; unlike note/ask/trace it MAY interleave during
     *  the turn (produce()) and be replayed ahead of a recorded turn's lines (recorded-transport.ts). */
    progress?: TurnProgress
  }
}

/**
 * Parse `line` as a meta-line, or `undefined` if it is not one — never throws. A meta-line is a JSON
 * object carrying the reserved `a2uiMeta` wrapper key and, provably, NO `version` key — the
 * `A2uiServerMessage` discriminator (`dispatch.ts`'s version gate) — which is what keeps this
 * convention disjoint from the protocol it rides beside (ADR-0088 §1). Shallow-validates `note`/`trace`
 * field TYPES (not `trace`'s inner shape — it is runtime-assembled, never wire-validated).
 */
export function readMetaLine(line: string): A2uiMetaEnvelope | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  if ('version' in parsed) return undefined // provably an A2uiServerMessage shape, never a meta-line
  if (!('a2uiMeta' in parsed)) return undefined

  const meta = (parsed as { a2uiMeta: unknown }).a2uiMeta
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const m = meta as Record<string, unknown>
  if (m.note !== undefined && typeof m.note !== 'string') return undefined
  if (m.trace !== undefined && (typeof m.trace !== 'object' || m.trace === null)) return undefined

  // ADR-0097 §1: `ask` is shallow-validated the same way as note/trace, but a MALFORMED `ask` drops only
  // itself — never the whole envelope (note/trace still parse normally). Never throws, never invents a
  // surfaceId.
  let ask: AskDeclaration | undefined
  if (m.ask !== undefined && typeof m.ask === 'object' && m.ask !== null && !Array.isArray(m.ask)) {
    const surfaceId = (m.ask as Record<string, unknown>).surfaceId
    if (typeof surfaceId === 'string') ask = { surfaceId }
  }

  // ADR-0146 F1: `progress` follows the identical drop-only-itself discipline — a non-object, or a `stage`
  // outside the closed union, yields the envelope WITHOUT `progress` (note/ask/trace still parse). `round`
  // and `detail` are optional and copied only when they carry the right primitive type.
  let progress: TurnProgress | undefined
  if (m.progress !== undefined && typeof m.progress === 'object' && m.progress !== null && !Array.isArray(m.progress)) {
    const p = m.progress as Record<string, unknown>
    if (typeof p.stage === 'string' && (PROGRESS_STAGES as readonly string[]).includes(p.stage)) {
      progress = { stage: p.stage as ProgressStage }
      if (typeof p.round === 'number') progress.round = p.round
      if (typeof p.detail === 'string') progress.detail = p.detail
    }
  }

  return {
    a2uiMeta: {
      note: m.note as string | undefined,
      ask,
      trace: m.trace as TurnTrace | undefined,
      progress,
    },
  }
}

/**
 * `true` iff `line` is a well-formed meta-line (per `readMetaLine`'s guard) — the cheap boolean form for
 * callers that only need to route/filter (e.g. the page's ingest filter, later slices), not read the
 * payload.
 */
export function isMetaLine(line: string): boolean {
  return readMetaLine(line) !== undefined
}
