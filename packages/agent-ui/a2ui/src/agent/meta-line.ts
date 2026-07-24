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
 * The closed live-turn lifecycle stage vocabulary (ADR-0146 F1) — produce-layer-owned, provider-agnostic.
 * Each adapter maps its OWN upstream events onto these (F4); `produce()` composes them with its own loop
 * stages. A CLOSED union: an out-of-vocabulary stage is dropped at the guard (`readMetaLine`), never
 * rendered — the honesty-law guard (F2) that a stage never observed is never shown.
 */
// 'tool' joined with GH #49 (the integrations loop): a factual process claim — "executing <registry
// tool name>" — from the closed integration registry, never model-composed prose; the F2 honesty law's
// closed-table growth is recorded in the a2ui-live-agent SPEC's versioned amendment.
export const TURN_PROGRESS_STAGES = ['sent', 'started', 'reasoning', 'content', 'validating', 'retry', 'tool', 'done'] as const
export type TurnProgressStage = (typeof TURN_PROGRESS_STAGES)[number]
const TURN_PROGRESS_STAGE_SET: ReadonlySet<string> = new Set(TURN_PROGRESS_STAGES)

/**
 * A live-turn progress event (ADR-0146 F1) — a runtime-composed, closed-vocabulary lifecycle signal that
 * rides the SAME `AsyncIterable<string>` as `{"a2uiMeta":{"progress":…}}` meta-lines, INTERLEAVED during
 * the turn (never content — it never enters heal/validate/corpus; SPEC-R5 validate-then-stream untouched).
 * `round` carries the self-correct round ordinal on `'retry'`; `detail` carries OPTIONAL factual text
 * (F3-gated: absent by default, forwarded only under `progressDetail:'full'` — never required for any stage).
 * `source` (GH #240/ADR-0159 wave B — the per-step source reveal) carries the raw A2UI JSONL line(s) behind
 * the stage — the actual createSurface/updateDataModel/updateComponents text a step stands for, newline-
 * joined and producer-capped. Attached ONLY under the explicit `progressDetail:'source'` opt-in (produce.ts
 * owns the gate + the cap); absent on every default stream — the privacy gate stays fail-closed.
 */
export interface TurnProgress {
  stage: TurnProgressStage
  round?: number
  detail?: string
  source?: string
}

/**
 * The reserved wrapper (ADR-0088 §1/§2, ADR-0097 §1). `note` is the model's contemporaneous natural-
 * language rationale/reply; `ask` is the model-authored feed-ask routing declaration (produce() peels it,
 * verifies its integrity, and re-composes it on the outgoing meta-line only when it holds); `trace` is the
 * runtime-assembled `TurnTrace` (the model never authors `trace` itself — only `produce()` attaches it
 * before yielding); `progress` is a runtime-composed live-turn lifecycle event (ADR-0146 F1), the one kind
 * that may INTERLEAVE during the turn rather than ride only the single leading line. `error` is a
 * runtime-composed, TERMINAL failure signal (GH #144) — a transport (the dev proxy / the Cloudflare
 * Worker) writes it as the LAST line on a stream whose headers already committed 200 before `produce()`
 * halted (`ProduceHalt`, the round bound exhausted) or otherwise threw mid-loop (an upstream fault): the
 * ONLY way such a transport can turn an already-200 stream into a VISIBLE client-side failure instead of a
 * silently-empty "success" (SPEC-R5's "halt-and-report" was always produce()-internal; nothing carried
 * that report across the wire until this field). The model never authors `error` — only a transport does,
 * exactly like `trace`. All five fields are optional: a note-only line omits `ask`/`trace`/`progress`/
 * `error`; a progress line carries only `progress`; an error line carries only `error`; a malformed/leaked
 * line may omit any of them.
 */
export interface A2uiMetaEnvelope {
  a2uiMeta: {
    note?: string
    ask?: AskDeclaration
    trace?: TurnTrace
    /** ADR-0146 F1: a runtime-composed live-turn lifecycle event, INTERLEAVED during the turn (not just a
     *  single leading line). Shallow-validated the same way `ask` is — a malformed `progress` drops only
     *  itself, never the whole envelope. */
    progress?: TurnProgress
    /** GH #144: a transport-composed terminal failure message — see the interface doc above. Shallow-
     *  validated the same way `note` is (a plain string); a malformed `error` drops only itself. */
    error?: string
  }
}

/**
 * Parse `line` as a meta-line, or `undefined` if it is not one — never throws. A meta-line is a JSON
 * object carrying the reserved `a2uiMeta` wrapper key and, provably, NO `version` key — the
 * `A2uiServerMessage` discriminator (`dispatch.ts`'s version gate) — which is what keeps this
 * convention disjoint from the protocol it rides beside (ADR-0088 §1). Shallow-validates `note`/`trace`/
 * `ask`/`progress` field TYPES (not `trace`'s inner shape — it is runtime-assembled, never wire-validated);
 * a malformed `ask`/`progress` drops only itself, never the whole envelope.
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
  // GH #144: `error` is shallow-validated the SAME way as `note` — a non-string value drops only itself
  // (the field goes `undefined` below), never the whole envelope.
  const error = typeof m.error === 'string' ? m.error : undefined

  // ADR-0097 §1: `ask` is shallow-validated the same way as note/trace, but a MALFORMED `ask` drops only
  // itself — never the whole envelope (note/trace still parse normally). Never throws, never invents a
  // surfaceId.
  let ask: AskDeclaration | undefined
  if (m.ask !== undefined && typeof m.ask === 'object' && m.ask !== null && !Array.isArray(m.ask)) {
    const surfaceId = (m.ask as Record<string, unknown>).surfaceId
    if (typeof surfaceId === 'string') ask = { surfaceId }
  }

  // ADR-0146 F1: `progress` is shallow-validated the SAME way — a malformed `progress` (non-object, or a
  // `stage` outside the closed vocabulary, or a non-number `round` / non-string `detail`/`source`) drops
  // only itself, never the whole envelope. The closed `stage` union is the honesty-law guard (F2): an
  // out-of-vocabulary stage never survives the parse, so it can never be rendered.
  let progress: TurnProgress | undefined
  if (m.progress !== undefined && typeof m.progress === 'object' && m.progress !== null && !Array.isArray(m.progress)) {
    const p = m.progress as Record<string, unknown>
    const stageOk = typeof p.stage === 'string' && TURN_PROGRESS_STAGE_SET.has(p.stage)
    const roundOk = p.round === undefined || typeof p.round === 'number'
    const detailOk = p.detail === undefined || typeof p.detail === 'string'
    const sourceOk = p.source === undefined || typeof p.source === 'string' // GH #240 — same posture as detail
    if (stageOk && roundOk && detailOk && sourceOk) {
      progress = {
        stage: p.stage as TurnProgressStage,
        ...(p.round !== undefined ? { round: p.round as number } : {}),
        ...(p.detail !== undefined ? { detail: p.detail as string } : {}),
        ...(p.source !== undefined ? { source: p.source as string } : {}),
      }
    }
  }

  return {
    a2uiMeta: {
      note: m.note as string | undefined,
      ask,
      trace: m.trace as TurnTrace | undefined,
      progress,
      error,
    },
  }
}

/**
 * Format a transport-composed terminal error line (GH #144) — the wire counterpart `readMetaLine` parses
 * back into `a2uiMeta.error`. A transport (the dev proxy / the Cloudflare Worker) writes this as the LAST
 * line on a stream whose headers already committed 200 before `produce()` halted or otherwise threw
 * mid-loop, so the failure is VISIBLE client-side instead of reading as an empty "success" (a stream that
 * just ends with zero content lines and zero explanation). No `version` key ⇒ provably not an
 * `A2uiServerMessage`, same disjointness proof `readMetaLine`'s header documents for every meta-line kind.
 */
export function formatErrorLine(message: string): string {
  return JSON.stringify({ a2uiMeta: { error: message } })
}

/**
 * `true` iff `line` is a well-formed meta-line (per `readMetaLine`'s guard) — the cheap boolean form for
 * callers that only need to route/filter (e.g. the page's ingest filter, later slices), not read the
 * payload.
 */
export function isMetaLine(line: string): boolean {
  return readMetaLine(line) !== undefined
}
