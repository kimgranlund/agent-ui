// produce.ts — LLD-C3 / SPEC-R4/R5/R7, ADR-0070: the bounded runtime loop (streaming LLD-C2 realized).
//
// retrieve exemplars → build the catalog-derived prompt → generate via the injected AgentProvider →
// PEEL a leading meta-line (ADR-0088 §1, before heal/validate) → heal + validate the REMAINING A2UI text
// (the SHARED surfaces, no fork — SPEC-N3) → on failure feed the validator's structured failures back →
// bounded at maxRounds → VALIDATE-THEN-STREAM (yield the meta-line, if any, then ONLY a fully validated
// payload's JSONL lines; SPEC-R5) → halt-and-report at the bound, emitting NOTHING invalid. A note-only
// round (a meta-line with zero remaining A2UI lines) is a CLEAN success, not a halt (ADR-0088
// Consequences: empty ≠ invalid). The deterministic gate is the whole runtime verifier; there is NO
// runtime rubric-grading round (ADR-0070 — the a2ui-payload rubric is authoring/eval-time).
// Provider-agnostic: `deps.provider` is the injection point (a stub in tests, an adapter in the proxy),
// so the loop mechanics are gate-covered with no live model.
//
// ADR-0090 §1/§4: `ProduceOptions.mode` (a `GenUiMode`, alongside `maxRounds`/`model`/`k`) threads
// straight to `buildSystemPrompt` — the same per-turn-tuning-knob path `model` already proves. Absent
// `mode` ⇒ `buildSystemPrompt` receives `undefined` ⇒ its default/zero-regression composition; nothing
// else in the loop (peel/heal/validate/stream) reads or branches on it.
//
// ADR-0091 §2: `selectMiniSkills` runs ONCE per turn, right beside `deps.retrieve(query)` — the SAME
// pre-loop position, because `system` is built ONCE outside the round loop and never rebuilt per round.
// Its result feeds `buildSystemPrompt`'s 4th parameter; an empty/no-match selection composes no new
// block (ADR-0091 Acceptance). The registry (`MINI_SKILLS`) is a static committed module, not an
// injected `ProduceDeps` surface — unlike `retrieve`, it has no store/snapshot to inject.
//
// ADR-0097 §1/§3: the model may additionally author an `ask` on the SAME leading meta-line — a feed-
// embedded ask declaration (`{surfaceId}`). Two produce-layer checks gate it, both AFTER the shared
// validator passes (never a fork of `validateA2ui` itself, SPEC-N3):
//   (a) ASK INTEGRITY (never a retry — a silent degrade): an `ask` naming a surface no payload line
//       creates, or colliding with a surface already known to THIS session (a prior turn's own emitted
//       `createSurface`), is DROPPED from the outgoing meta-line — the note stands, the turn ships
//       exactly as if no `ask` were authored (ADR-0089's prose-ask degrade path).
//   (b) FEED SCOPE (a self-correct round, like a validator failure): every component type on the
//       ask-routed surface must be a member of `FEED_SURFACE_TYPES` (`feed-catalog.ts`, the single
//       source SPEC-R15 gates) — a violation feeds the failure back as a produce-layer-only `'FEED_SCOPE'`
//       literal (never joining the protocol's closed `ErrorCode` union) and retries, never streams.
//
// ADR-0146 F1/F3: when the caller opts in (`opts.progress === true` — absent ⇒ BYTE-IDENTICAL to before,
// the note-only/halt/every-deterministic-gate guarantee), the loop also INTERLEAVES live-turn lifecycle
// progress on the SAME stream — `{"a2uiMeta":{"progress":{stage,...}}}` meta-lines yielded AS THEY HAPPEN,
// strictly ahead of any content line. produce() composes the provider's `onEvent` signals (`started` on the first message_start/
// content_block_start; `reasoning` on a thinking delta) with its OWN loop stages (`sent` before each
// request; `content` on the round's OWN first text fragment — produce() is that stage's one pinned emitter;
// `validating` after accumulation; `retry` with the attempt ordinal on a self-correct round; `done` before
// the final yield). VALIDATE-THEN-STREAM is UNTOUCHED: progress is not content — it never enters
// heal/validate/corpus and no A2UI content line ever precedes validation (SPEC-R5). `progressDetail`
// ('stages' default) keeps raw thinking text OFF the wire; 'full' forwards bounded excerpts (F3).

import type { A2uiServerMessage, A2uiOutput } from '../protocol.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { CorpusRecord } from '../corpus/record.ts'
import type { RetrieveQuery } from '../corpus/retrieve.ts'
import { heal } from '../corpus/heal.ts'
import { validateA2ui } from '../renderer/validate.ts'
import type { SurfaceSeed } from '../renderer/validate.ts'
import type { A2uiComponent } from '../protocol.ts'
import type { AgentProvider, ExecuteTool, ProviderEvent, Session, ToolDef, Turn, TurnInput } from './agent-transport.ts'
import { buildSystemPrompt } from './system-prompt.ts'
import { frameClientMessage } from './session.ts'
import { readMetaLine } from './meta-line.ts'
import type { AskDeclaration, TurnProgress, TurnTrace } from './meta-line.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from './mini-skills.ts'
import { FEED_SURFACE_TYPE_SET } from './feed-catalog.ts'

const PROTOCOL_VERSION = 'v1.0'
const CATALOG_ID = 'agent-ui'
const DEFAULT_MODEL = 'claude-sonnet-5' // the registry's defaultModel (providers.json)

/** The loop's injected surfaces (SPEC §5). `provider` is the model seam (stub|real); `retrieve` runs
 * over the JUDGED shard; `catalog` is the sole component authority. */
export interface ProduceDeps {
  provider: AgentProvider
  retrieve: (query: RetrieveQuery) => CorpusRecord[]
  catalog: Catalog
}

export interface ProduceOptions {
  maxRounds: number
  signal?: AbortSignal
  /** The AUTHORITATIVE model. The dev proxy passes the allowlist-VALIDATED `{provider,model}` here, and it
   * takes PRECEDENCE over any client-supplied `input.model` — the trust boundary (SPEC-R12): a crafted
   * `input.model` must never reach the API. `input.model` is only a fallback for callers that don't set it. */
  model?: string
  /** Retrieval top-k (defaults to 3). */
  k?: number
  /** ADR-0090 §1/§4 — the per-turn Gen-UI disposition, threaded to `buildSystemPrompt`. Absent ⇒
   * `buildSystemPrompt` receives `undefined` ⇒ the default/zero-regression composition (Decision §1). */
  mode?: GenUiMode
  /** ADR-0135 cl.7 — the mini-skill cap, now a tunable knob (was the hardcoded `DEFAULT_MINI_SKILL_CAP`
   * module constant). Absent ⇒ `DEFAULT_MINI_SKILL_CAP`, reproducing today's behavior byte-for-byte. */
  miniSkillCap?: number
  /** ADR-0138 — the caller-supplied persona section `buildSystemPrompt` appends AFTER the catalog law
   * (voice/content only; the wire contract stays authoritative, the fixed precedence sentence says so).
   * Absent/empty ⇒ byte-identical composition (the `mode`-absent precedent). */
  personaSystem?: string
  /** GH #49 — tool declarations + executor, threaded VERBATIM to `provider.stream` (the adapter owns the
   * whole tool-use loop; produce() only relays the seam and maps the 'tool' provider event onto the
   * progress stage). Absent ⇒ the request shape is byte-identical to before (the `effort?` precedent).
   * Both-or-neither: `tools` without `executeTool` is treated as no tools by the adapter contract. */
  tools?: readonly ToolDef[]
  executeTool?: ExecuteTool
  /** ADR-0146 F1 — opt IN to interleaved live-turn progress meta-lines. Absent/false ⇒ produce() streams
   * BYTE-IDENTICALLY to before (no progress lines) — the "note-only and halt paths byte-unchanged"
   * guarantee, and every deterministic gate/consumer that predates progress is untouched. `true` ⇒ the
   * loop yields `{"a2uiMeta":{"progress":{stage,…}}}` meta-lines AS THEY HAPPEN, strictly ahead of any
   * content line (SPEC-R5 validate-then-stream preserved). The live consumer loops (a2ui-chat/a2ui-live/
   * admin-live-runner) set this; the recorded transport carries authored progress instead (SPEC-R5/N4). */
  progress?: boolean
  /** ADR-0146 F3 — how much raw reasoning crosses the wire on `reasoning` progress events (only when
   * `progress` is on). Absent ⇒ `'stages'`: `produce()` forwards the reasoning stage TRANSITION only, NO
   * thinking text (the default, conservative posture). `'full'`: forwards bounded excerpts on
   * `TurnProgress.detail` — an explicit consumer opt-in, never the default. Only affects `reasoning`. */
  progressDetail?: 'stages' | 'full'
}

/** The bounded raw-reasoning excerpt cap (ADR-0146 F3, `progressDetail:'full'`) — a `thinking` delta can be
 * long; a forwarded excerpt is capped so a polite live region is never token-spammed. */
const REASONING_EXCERPT_CAP = 200

/** Serialize a runtime-composed progress meta-line (ADR-0146 F1) — the SAME reserved-envelope shape every
 * meta kind uses (no `version` key ⇒ provably not an `A2uiServerMessage`; fault-isolates to
 * VERSION_UNSUPPORTED if ever leaked to `dispatch()`). Interleaved DURING the turn, never content: it never
 * enters heal/validate/corpus, and no A2UI content line ever precedes validation (SPEC-R5 untouched). */
function formatProgressLine(progress: TurnProgress): string {
  return JSON.stringify({ a2uiMeta: { progress } })
}

/**
 * A round's fed-back failure (ADR-0097 §3): either the shared validator's `Failure` (its `code` is the
 * protocol's closed `ErrorCode` union), OR a produce-layer-only literal — `'FEED_SCOPE'` — that never
 * joins that union (no `ErrorCode` change; the ADR is explicit about this). Structurally compatible with
 * `Failure` (both are `{code: string; path: string}` shapes), so a `Failure[]` from `validateA2ui` is
 * assignable here with no cast, and `TurnTrace.failureCodes: string[]` (already a plain string array)
 * carries either kind identically.
 */
interface RoundFailure {
  code: string
  path: string
}

/** Thrown when the loop exhausts `maxRounds` without a valid payload — the page shows a "could not
 * compose a valid surface" error, NOT a broken render (SPEC-R5). Carries the last round's failures. */
export class ProduceHalt extends Error {
  readonly failures: RoundFailure[]
  constructor(failures: RoundFailure[]) {
    super(`produce: no valid surface within the round bound (${failures.map((f) => f.code).join(', ') || 'unknown'})`)
    this.name = 'ProduceHalt'
    this.failures = failures
  }
}

function userContent(input: TurnInput): string {
  return input.kind === 'intent' ? input.text : frameClientMessage(input.message)
}

function queryOf(input: TurnInput, k: number): RetrieveQuery {
  return { intent: userContent(input), k, catalogId: CATALOG_ID, protocolVersion: PROTOCOL_VERSION }
}

/**
 * Assemble the model messages for one generation round: the session history, the current user turn, and
 * — on a self-correct round — the prior INVALID attempt plus the validator's structured failures, so the
 * model sees exactly what it emitted and what was wrong (ADR-0070's "feed the failures back"). A
 * `'FEED_SCOPE'` round-failure (ADR-0097 §3) is fed back through the SAME "INVALID, re-emit" wording — a
 * feed ask hosting an out-of-scope type is exactly as re-emittable as a schema/catalog defect.
 *
 * GH #174: the feedback message ALSO pins the note's audience. The leading meta-line's `note` (ADR-0088
 * §1) is the user-visible chat reply — without an explicit instruction, a compliant model narrates its
 * compliance IN the note ("Re-emitting the corrected, validated JSONL…", observed live). The correction
 * loop is invisible plumbing: the note must keep addressing the USER, in persona, on every round.
 */
function messagesFor(input: TurnInput, failures: RoundFailure[] | undefined, lastRaw: string | undefined): Turn[] {
  const turns: Turn[] = [...input.session.turns, { role: 'user', content: userContent(input) }]
  if (failures && failures.length > 0 && lastRaw !== undefined) {
    turns.push({ role: 'assistant', content: lastRaw })
    const summary = failures.map((f) => `${f.code}${f.path ? ` at ${f.path}` : ''}`).join('; ')
    turns.push({
      role: 'user',
      content: `That output was INVALID (${summary}). Re-emit the COMPLETE corrected A2UI JSONL — nothing else. Your leading meta-line "note" must still address the USER in persona — never mention this correction, the re-emission, validation, or JSONL.`,
    })
  }
  return turns
}

/** Strip a single wrapping markdown code fence (```json … ```), if the model added one despite the
 * prompt. The inner text is the JSONL the model actually emitted. */
function stripOuterFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/^```(?:json|jsonl)?\s*\n?([\s\S]*?)\n?```$/)
  return (m ? m[1]! : t).trim()
}

/**
 * The model emits JSONL (one A2UI message per line), NOT a single JSON value — so heal PER LINE (the
 * shared healer's designed per-line mode, ADR-0061) and flatten. Returns the assembled `A2uiOutput` plus
 * how many lines the healer actually corrected (ADR-0088 §2 `TurnTrace.healed`), or `undefined` if any
 * line is unparseable (mapped by the caller to a PARSE failure fed back).
 *
 * `healedCount` counts a line only when `heal()` applied a REAL form repair (fence-strip,
 * trailing-comma, version-fill) — NOT merely `healed.changed`. Per-line `heal()` always reports the
 * mechanical `'single-object-envelope'` repair (each line is a lone object, never an array — ADR-0061's
 * arm (c) fires on every call in this mode), so treating bare `changed` as "corrected" would make the
 * trace's healed count saturate to `lines.length` on every well-formed turn, defeating its purpose.
 */
function assembleFromRaw(raw: string): { output: A2uiOutput; healedCount: number } | undefined {
  const lines = stripOuterFence(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return undefined
  const output: A2uiServerMessage[] = []
  let healedCount = 0
  for (const line of lines) {
    const healed = heal(line, { protocolVersion: PROTOCOL_VERSION })
    if (!healed.ok) return undefined
    if (healed.repairs.some((r) => r !== 'single-object-envelope')) healedCount += 1
    output.push(...healed.messages)
  }
  return { output, healedCount }
}

/**
 * Peel a single leading meta-line (ADR-0088 §1) off one round's raw model output, BEFORE heal/validate —
 * a note line would otherwise fail the healer and waste a self-correct round. The candidate is the first
 * NON-EMPTY line (same empty-line-skip idiom `assembleFromRaw` uses below), not strictly `raw`'s literal
 * first line — a stray leading blank line (a common model artifact) must not silently defeat the peel;
 * "emitted FIRST" (ADR-0088 §1) reads as the first content line under any reasonable reading. When that
 * candidate is not a meta-line (a model that never opts into the convention, or any existing stub, or an
 * all-blank raw), `note`/`ask` are `undefined` and `rest` is `raw` UNCHANGED — zero blast radius on every
 * caller that doesn't emit the wrapper, and this is a no-op for the well-formed (no leading blank) case.
 * `ask` (ADR-0097 §1) is the model-authored feed-ask declaration, peeled alongside `note` — its integrity
 * (does a payload line actually create it? does it collide with a session-known surface?) is checked by
 * the caller AFTER heal/validate, never here (this is peel-only, symmetric with `note`'s own treatment).
 */
function peelMetaLine(raw: string): { note: string | undefined; ask: AskDeclaration | undefined; rest: string } {
  const lines = raw.split('\n')
  const idx = lines.findIndex((l) => l.trim().length > 0) // first NON-EMPTY line
  if (idx === -1) return { note: undefined, ask: undefined, rest: raw } // all-blank raw — nothing to peel
  const meta = readMetaLine(lines[idx]!.trim())
  if (meta === undefined) return { note: undefined, ask: undefined, rest: raw }
  return { note: meta.a2uiMeta.note, ask: meta.a2uiMeta.ask, rest: lines.slice(idx + 1).join('\n') }
}

/** Serialize the outgoing meta-line (ADR-0088 §1/§2, ADR-0097 §1) — the runtime-composed envelope,
 * carrying the model's own `note`, the `ask` declaration ONLY when it has passed integrity (`undefined`
 * otherwise — JSON.stringify then omits the key entirely, so a note-only turn's wire shape is byte-
 * identical to before ADR-0097), plus the `TurnTrace` `produce()` assembled for this turn (never the
 * model's raw wrapper verbatim — the model never has `trace`). */
function formatMetaLine(note: string, trace: TurnTrace, ask: AskDeclaration | undefined): string {
  return JSON.stringify({ a2uiMeta: { note, ask, trace } })
}

/**
 * Every `createSurface` id the SESSION already knows about, scanned from prior ASSISTANT turns' emitted
 * A2UI content (`appendAssistantTurn` stores exactly the validated JSONL a turn shipped, meta-line already
 * excluded — `session.ts`/`a2ui-live.ts`). Used ONLY for the ADR-0097 §1 ask-integrity collision guard: an
 * `ask` declaring a surfaceId the agent already created in an EARLIER turn of THIS session is a collision
 * (a stale/reused id), not a fresh ask — dropped, never a halt. A malformed/non-JSON turn line (e.g. a
 * framed user turn, which never lands in this scan since only `assistant`-role turns are inspected) is
 * skipped rather than thrown.
 */
function sessionKnownSurfaceIds(session: Session): Set<string> {
  const ids = new Set<string>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      try {
        const msg = JSON.parse(trimmed) as { createSurface?: { surfaceId?: unknown } }
        if (typeof msg.createSurface?.surfaceId === 'string') ids.add(msg.createSurface.surfaceId)
      } catch {
        // not JSON (shouldn't happen for a stored assistant turn) — skip rather than throw
      }
    }
  }
  return ids
}

/**
 * ADR-0097 §1 ask integrity: `true` iff SOME message in this round's validated `output` actually creates
 * `ask.surfaceId` (a `createSurface` for it), AND that id does not collide with a surface the session
 * already knows about (`sessionKnownSurfaceIds`, prior turns only — this round's own fresh creation is
 * exactly what the first check requires, so a same-round create is never mistaken for a collision).
 */
function askIntegrityHolds(ask: AskDeclaration, output: A2uiOutput, session: Session): boolean {
  const created = output.some((m) => 'createSurface' in m && m.createSurface.surfaceId === ask.surfaceId)
  if (!created) return false
  return !sessionKnownSurfaceIds(session).has(ask.surfaceId)
}

/**
 * ADR-0097 §3 / SPEC-R15 FEED_SCOPE gate: every `updateComponents` targeting the ask-routed surface must
 * host ONLY `FEED_SURFACE_TYPES` members. Runs AFTER the shared validator passes (never a fork of
 * `validateA2ui` — SPEC-N3) — this is a produce-layer POLICY check over an already-protocol-valid payload.
 * Returns one `RoundFailure` per offending component (deduplicated by type so a repeated out-of-scope type
 * doesn't inflate the fed-back message), each `path` naming both the ask surface and the offending type so
 * the self-correct prompt (`messagesFor`) genuinely surfaces "FEED_SCOPE" + the type, per the ADR's own
 * acceptance wording.
 */
function feedScopeFailures(ask: AskDeclaration, output: A2uiOutput): RoundFailure[] {
  const offendingTypes = new Set<string>()
  for (const msg of output) {
    if (!('updateComponents' in msg)) continue
    if (msg.updateComponents.surfaceId !== ask.surfaceId) continue
    for (const comp of msg.updateComponents.components) {
      if (!FEED_SURFACE_TYPE_SET.has(comp.component)) offendingTypes.add(comp.component)
    }
  }
  return [...offendingTypes].map((type) => ({ code: 'FEED_SCOPE', path: `${ask.surfaceId}:${type}` }))
}

/**
 * TKT-0081 — the cross-turn validation seed: replay the session's prior ASSISTANT turns (validated JSONL,
 * exactly what `appendAssistantTurn` stored) into a per-surface `SurfaceSeed` for `validateA2ui`. Without
 * it the per-round validator is session-blind and structurally CONTRADICTS the renderer on follow-up
 * turns: an update-only payload (no `root`) fails `root-missing`/dangling standalone, while re-sending
 * `root` passes standalone but fails the renderer's cross-turn ADR-0128 IDGRAPH guard — live models
 * resolved the trap by shipping full trees and eating a client-error round per move (the Croupier game
 * loop, measured). Seeded, the validator judges the MERGED graph the renderer will actually hold:
 * update-only follow-ups validate; a root-resend fails HERE (`sid:root`) as a pre-wire self-correct
 * round. A prior `deleteSurface` drops that surface's seed (a later re-create starts fresh).
 */
function sessionSurfaceSeeds(session: Session): Map<string, SurfaceSeed> {
  const seeds = new Map<string, { components: A2uiComponent[]; byId: Map<string, A2uiComponent>; rootDelivered: boolean }>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      try {
        const msg = JSON.parse(trimmed) as {
          createSurface?: { surfaceId?: string }
          updateComponents?: { surfaceId?: string; components?: A2uiComponent[] }
          deleteSurface?: { surfaceId?: string }
        }
        if (msg.deleteSurface?.surfaceId !== undefined) {
          seeds.delete(msg.deleteSurface.surfaceId)
          continue
        }
        const body = msg.updateComponents
        if (body?.surfaceId === undefined || !Array.isArray(body.components)) continue
        let seed = seeds.get(body.surfaceId)
        if (seed === undefined) {
          seed = { components: [], byId: new Map(), rootDelivered: false }
          seeds.set(body.surfaceId, seed)
        }
        for (const comp of body.components) {
          if (typeof comp?.id !== 'string') continue
          seed.byId.set(comp.id, comp) // upsert — a later resend REPLACES (the renderer's merge)
          if (comp.id === 'root') seed.rootDelivered = true
        }
      } catch {
        // not JSON (shouldn't happen for a stored assistant turn) — skip rather than throw
      }
    }
  }
  return new Map([...seeds].map(([sid, s]) => [sid, { components: [...s.byId.values()], rootDelivered: s.rootDelivered }]))
}

export async function* produce(input: TurnInput, deps: ProduceDeps, opts: ProduceOptions): AsyncIterable<string> {
  const k = opts.k ?? 3
  const query = queryOf(input, k)
  const exemplars = deps.retrieve(query) // SPEC-R7 — top-k over the judged shard
  const miniSkills = selectMiniSkills(query.intent, MINI_SKILLS, opts.miniSkillCap ?? DEFAULT_MINI_SKILL_CAP) // ADR-0091 §2 — once per turn, beside retrieve(); ADR-0135 cl.7 — cap now tunable, absent ⇒ default
  const system = buildSystemPrompt(deps.catalog, exemplars, opts.mode, miniSkills, opts.personaSystem) // SPEC-R6 — catalog-derived; ADR-0090 mode + ADR-0091 mini-skills + ADR-0138 persona
  const model = opts.model ?? input.model ?? DEFAULT_MODEL // opts.model = the proxy's allowlist-validated model (SPEC-R12); it WINS over a client-supplied input.model
  // ADR-0088 §2 — data ALREADY flowing above, captured once for the eventual TurnTrace (no new collection).
  // NOTE: this is a `session.turns` MESSAGE index (the alternating Messages-API array, user+assistant per
  // exchange), NOT a dense turn ordinal — it is even-valued and advances by 2 per real conversational turn
  // (0, 2, 4, ...). A caller holding a `traces[]` array must correlate by ARRAY POSITION, never assume
  // `traces[i].turnIndex === i` or treat this field as `traces.length`-equivalent.
  const turnIndex = input.session.turns.length
  const sessionSeeds = sessionSurfaceSeeds(input.session) // TKT-0081 — once per turn; seeds every round's validate
  const exemplarIds = exemplars.map((e) => e.name)
  const traceFor = (rounds: number, healed: number, failureCodes: string[]): TurnTrace => ({
    turnIndex,
    query: { intent: query.intent, k: query.k },
    exemplarIds,
    rounds,
    healed,
    failureCodes,
    model,
  })

  const emitProgress = opts.progress === true // ADR-0146 F1 — opt-in; absent ⇒ byte-identical to before
  const progressDetail = opts.progressDetail ?? 'stages' // ADR-0146 F3 — 'stages' (default) keeps thinking text off the wire
  let failures: RoundFailure[] | undefined
  let lastRaw: string | undefined
  for (let round = 0; round < opts.maxRounds; round++) {
    const failuresFedBack = failures // what THIS round's prompt carried back — the trace's failureCodes
    // ADR-0146 F1 — the lifecycle stages, yielded AS THEY HAPPEN, strictly BEFORE any content line (content
    // still streams only after full validation, SPEC-R5). A self-correct round announces `retry` with the
    // attempt ordinal first, then `sent` before the provider request. All gated on the `progress` opt-in.
    if (emitProgress && round > 0 && failures !== undefined) yield formatProgressLine({ stage: 'retry', round: round + 1 })
    if (emitProgress) yield formatProgressLine({ stage: 'sent' })

    let raw = ''
    // Provider events are collected on a queue by the onEvent callback (it cannot yield from this generator
    // itself) and drained into the stream between text fragments — `started` on the provider's first
    // signal, `reasoning` on a thinking delta (text-free at 'stages', a bounded excerpt at 'full'). When
    // progress is OFF, no callback is installed (byte-identical accumulation) and the queue stays empty.
    const pending: TurnProgress[] = []
    let sawStarted = false
    let sawReasoning = false
    let sawContent = false
    const onEvent = emitProgress
      ? (ev: ProviderEvent): void => {
          if (!sawStarted && (ev.kind === 'message_start' || ev.kind === 'block_start')) {
            sawStarted = true
            pending.push({ stage: 'started' })
          } else if (ev.kind === 'thinking') {
            if (progressDetail === 'full') pending.push({ stage: 'reasoning', ...(ev.text ? { detail: ev.text.slice(0, REASONING_EXCERPT_CAP) } : {}) })
            else if (!sawReasoning) {
              sawReasoning = true
              pending.push({ stage: 'reasoning' }) // transition only — NO thinking text on the wire (F3 default)
            }
          }
          else if (ev.kind === 'tool') {
            // GH #49 — the adapter is executing a registry tool: a factual process claim (the tool NAME
            // from the closed registry, never model prose — the F2 discipline the 'tool' stage's
            // TURN_PROGRESS_STAGES note records).
            pending.push({ stage: 'tool', ...(ev.text ? { detail: ev.text } : {}) })
          }
          // block_stop/done provider events are NOT mapped to a stage — produce() is the pinned emitter of
          // `content`/`validating`/`done`, owning those transitions itself (F1).
        }
      : undefined
    for await (const frag of deps.provider.stream({
      model,
      system,
      messages: messagesFor(input, failures, lastRaw),
      onEvent,
      // GH #49 — relayed verbatim; the adapter owns the tool loop (its buffered rounds mean 'tool'
      // stages drain just before the final round's text under the queue design — a recorded latency
      // limit, not a bug).
      tools: opts.tools,
      executeTool: opts.executeTool,
      signal: opts.signal,
    })) {
      while (pending.length > 0) yield formatProgressLine(pending.shift()!)
      // `content` is produce()'s ONE pinned emission on the round's OWN first text fragment (F1).
      if (emitProgress && !sawContent && frag.length > 0) {
        sawContent = true
        yield formatProgressLine({ stage: 'content' })
      }
      raw += frag
    }
    while (pending.length > 0) yield formatProgressLine(pending.shift()!) // drain any trailing (text-less) events
    lastRaw = raw

    if (emitProgress) yield formatProgressLine({ stage: 'validating' }) // AFTER accumulation, BEFORE assemble/validate

    const { note, ask, rest } = peelMetaLine(raw) // ADR-0088 §1 / ADR-0097 §1 — peeled BEFORE heal/validate
    const restLines = stripOuterFence(rest)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (note !== undefined && restLines.length === 0) {
      // A note-only turn (ADR-0088 Consequences): zero A2UI lines is a CLEAN success — nothing to
      // validate, so nothing to self-correct. Must NOT halt-and-report (empty ≠ invalid). ADR-0097 §1: a
      // declared `ask` here is trivially integrity-invalid too (no payload creates ANYTHING) — dropped,
      // never even reaching `askIntegrityHolds` (there is nothing to check it against).
      const failureCodes = (failuresFedBack ?? []).map((f) => f.code)
      if (emitProgress) yield formatProgressLine({ stage: 'done' }) // before the final (note-only) meta-line yield
      yield formatMetaLine(note, traceFor(round + 1, 0, failureCodes), undefined)
      return
    }

    const assembled = assembleFromRaw(rest)
    if (assembled === undefined) {
      failures = [{ code: 'PARSE', path: '' }]
      continue
    }
    // SPEC-N3 — the shared validator, no fork; TKT-0081 — seeded with the session's prior graphs so the
    // per-round judgment matches the MERGED state the renderer will hold (update-only follow-ups valid;
    // a cross-turn root-resend fails pre-wire as `sid:root`, a self-correct round).
    const verdict = validateA2ui(assembled.output, deps.catalog, sessionSeeds)
    if (verdict.valid) {
      // ADR-0097 §3 FEED_SCOPE gate — AFTER the shared validator, BEFORE anything streams. A violation is
      // a self-correct round (never a stream), exactly like a validator failure.
      if (ask !== undefined) {
        const scopeFailures = feedScopeFailures(ask, assembled.output)
        if (scopeFailures.length > 0) {
          failures = scopeFailures
          continue
        }
      }
      // ADR-0097 §1 ask-integrity — a silent degrade (never a retry): an ask with no matching payload, or
      // colliding with a session-known surface, is dropped from the outgoing meta-line; the note stands.
      const finalAsk = ask !== undefined && askIntegrityHolds(ask, assembled.output, input.session) ? ask : undefined
      // Post-ship review finding 4: this `if` is also the reason a note-less ask never ships — `ask`/
      // `finalAsk` only ever ride ON the meta-line `formatMetaLine` builds, and that line is yielded ONLY
      // when `note !== undefined`. A turn that authored `ask` but no `note` would have its ask silently
      // discarded here, never reaching the wire — an implicit coupling worth stating explicitly.
      if (emitProgress) yield formatProgressLine({ stage: 'done' }) // ADR-0146 F1 — before the final content yield; still a meta-line, never content
      if (note !== undefined) {
        const failureCodes = (failuresFedBack ?? []).map((f) => f.code)
        yield formatMetaLine(note, traceFor(round + 1, assembled.healedCount, failureCodes), finalAsk) // meta-line FIRST
      }
      for (const msg of assembled.output) yield JSON.stringify(msg) // SPEC-R5 — validate-then-stream (nothing invalid ever painted)
      return
    }
    failures = verdict.failures // SPEC-R4 — self-correct: feed the structured failures back
  }
  throw new ProduceHalt(failures ?? [{ code: 'SCHEMA', path: '' }])
}
