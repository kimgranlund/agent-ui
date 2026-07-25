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
// genui-surface SPEC-R1/R2/R10: a genui-shaped candidate line (the reserved `{"genui":{surfaceId,html}}`
// kind) is peeled OUT of the model's raw output on EVERY round, immediately after the meta-line peel and
// BEFORE `heal`/`validateA2ui` ever see the remaining text — mirroring the meta-line peel precedent for a
// THIRD reserved wire kind. Unconditional: the peel runs whether or not `opts.genuiSurface` invited the
// model to use it (a reserved kind is handled the same way regardless of that per-turn signal, which only
// gates `buildSystemPrompt`'s teaching block). A structurally valid candidate ships intact (verbatim,
// SPEC-R1 AC2) alongside the meta-line; a structurally invalid one MAY hitch a ride on the SAME round the
// A2UI validator already needs to retry (never an independent extra round — genui alone never causes the
// eventual `ProduceHalt`); on exhaustion or an otherwise-successful round it is silently dropped, never
// halting the turn. At most one genui line ships per turn; extras are dropped + counted
// (`GENUI_MULTIPLICITY`, carried on `TurnTrace.failureCodes` — a factual tally, never a retry trigger).
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
import type { AgentProvider, Effort, ExecuteTool, ProviderEvent, Session, ToolDef, Turn, TurnInput } from './agent-transport.ts'
import { buildSystemPrompt } from './system-prompt.ts'
import { frameClientMessage } from './session.ts'
import { readMetaLine } from './meta-line.ts'
import type { AskDeclaration, TurnProgress, TurnTrace } from './meta-line.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from './mini-skills.ts'
import { FEED_SURFACE_TYPE_SET } from './feed-catalog.ts'
import { isGenuiCandidate, readGenuiLine, utf8ByteLength, GENUI_MAX_HTML_BYTES } from './genui-line.ts'
import type { GenuiSurfaceConfig } from './genui-surface-config.ts'

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
  /** The reasoning-effort dial (`AgentProvider.stream`'s own `effort?: Effort` field, the SAME additive
   * precedent `mode`/`genuiSurface` each already set on this seam), relayed VERBATIM to `deps.provider.stream`.
   * Never consulted by `buildSystemPrompt` or any peel/heal/validate step — it is a provider-call knob, not
   * a prompt-composition one. Absent ⇒ the request shape is byte-identical to before (the adapter's own
   * default applies, per `AgentProvider.stream`'s doc). */
  effort?: Effort
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
   * `TurnProgress.detail` — an explicit consumer opt-in, never the default. Only affects `reasoning`.
   * GH #240/ADR-0159 wave B adds `'source'` — a SIBLING member, not a rung above `'full'`: stage
   * transitions exactly like `'stages'` (still NO thinking text — the two disclosures stay independent),
   * PLUS the per-stage raw-source attachment (`TurnProgress.source`): the actual A2UI JSONL behind
   * `validating` (this round's candidate lines entering heal/validate) and `retry` (the PRIOR round's
   * failed candidate — otherwise never visible anywhere client-side). Capped at
   * `SOURCE_ATTACHMENT_CAP`. The gate is fail-closed at every layer: absent ⇒ `'stages'` ⇒ zero raw
   * lines ride any progress event; `'full'` does NOT imply `'source'` and vice versa (a consumer
   * needing both is a deliberate future member, not an accident of ladder ordering). */
  progressDetail?: 'stages' | 'full' | 'source'
  /** genui-surface SPEC-R10 — the per-turn "may this turn emit GenUI" signal, threaded to
   *  `buildSystemPrompt`'s genui teaching block. Deliberately NOT a `GenUiMode` member and never
   *  consulted by any A2UI-composition logic in this loop (SPEC §4 N2 — a new, orthogonal axis). Absent
   *  ⇒ `buildSystemPrompt` composes zero genui bytes (the degradation law) — but the WIRE-LEVEL peel
   *  below (SPEC-R1) runs UNCONDITIONALLY regardless of this flag: a genui line is a reserved kind on the
   *  stream itself, handled the same way whether or not the model was invited to use it. */
  genuiSurface?: GenuiSurfaceConfig
}

/** The bounded raw-reasoning excerpt cap (ADR-0146 F3, `progressDetail:'full'`) — a `thinking` delta can be
 * long; a forwarded excerpt is capped so a polite live region is never token-spammed. */
const REASONING_EXCERPT_CAP = 200

/** GH #240/ADR-0159 wave B — the raw-source attachment cap (`progressDetail:'source'`), in characters:
 * 16 KB, the SAME runaway-guard bound the proxies already apply to `personaSystem` (dev-proxy-plugin.ts /
 * worker/index.ts — the repo's established "bounded but generous developer text" constant). Rationale: a
 * realistic surface payload runs low single-digit KB (the corpus exemplars' own ceiling), so 16 KB never
 * truncates real traffic; and since the `validating` attachment duplicates the payload's bytes on the
 * wire (the final round's candidate IS the content that follows), the cap bounds that duplication to
 * ~16 KB per progress event even against a pathological payload. A capped attachment says so explicitly
 * (the truncation marker below) — never a silent cut. */
export const SOURCE_ATTACHMENT_CAP = 16_384
const SOURCE_TRUNCATION_MARKER = '\n… [truncated]'
function capSource(source: string): string {
  return source.length <= SOURCE_ATTACHMENT_CAP ? source : source.slice(0, SOURCE_ATTACHMENT_CAP) + SOURCE_TRUNCATION_MARKER
}

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

/** genui-surface SPEC-R1: which produce-layer-only failure code names a rejected genui candidate —
 *  `'GENUI_SIZE'` when the shape is otherwise well-formed but `html` is over the SPEC-R2 byte cap,
 *  `'GENUI_ENVELOPE'` for every other structural defect (malformed JSON, a non-object `genui`, a missing/
 *  empty `surfaceId`, a non-string `html`, a `version`/`a2uiMeta` key present). Neither code joins the
 *  protocol's closed `ErrorCode` union (the FEED_SCOPE precedent, ADR-0097 §3) — both are carried on
 *  `TurnTrace.failureCodes` only. */
function genuiFailureCode(candidateLine: string): 'GENUI_ENVELOPE' | 'GENUI_SIZE' {
  try {
    const parsed = JSON.parse(candidateLine) as { genui?: { html?: unknown } }
    const html = parsed.genui?.html
    if (typeof html === 'string' && utf8ByteLength(html) > GENUI_MAX_HTML_BYTES) return 'GENUI_SIZE'
  } catch {
    // malformed JSON — falls through to GENUI_ENVELOPE below
  }
  return 'GENUI_ENVELOPE'
}

/** One round's genui peel result (SPEC-R1/R2). `rest` is `afterMeta` with every genui-shaped candidate
 *  line stripped OUT — the text that continues on to `heal`/`validateA2ui`, so a genui line (valid or not)
 *  NEVER reaches the shared validator (the meta-line peel precedent, extended to this kind). */
interface GenuiPeelResult {
  /** The accepted candidate line, verbatim as the model authored it (SPEC-R1 AC2's "ships intact") —
   *  `undefined` when no candidate validated this round. */
  line: string | undefined
  /** A produce-layer round failure, when a genui-shaped candidate existed but failed structural validation. */
  failure: RoundFailure | undefined
  /** `true` iff MORE than one genui-shaped candidate line appeared this round (GENUI_MULTIPLICITY) — the
   *  turn MUST carry at most one; extras are dropped + counted, never fed back for correction. */
  multiplicity: boolean
  rest: string
}

/** Peel every genui-shaped candidate line (SPEC-R1: "a line carrying the `genui` key") out of `afterMeta`
 *  — the text remaining AFTER the leading meta-line was already peeled, BEFORE `heal`/`validateA2ui` ever
 *  see it. Detection (`isGenuiCandidate`) is deliberately cheaper than full validation (`readGenuiLine`):
 *  a candidate that merely carries the reserved key but fails full validation must STILL be pulled out of
 *  the A2UI stream (never partially honored, never fed to the healer, which doesn't know this kind exists)
 *  — it just rejects whole (SPEC-R1) instead of shipping. Only the FIRST candidate is ever considered for
 *  acceptance; every subsequent one is dropped and counted as `multiplicity`, regardless of its own
 *  validity (SPEC-R1: "AT MOST ONE genui line; subsequent ones... dropped + counted"). */
function peelGenuiLines(afterMeta: string): GenuiPeelResult {
  const lines = afterMeta.split('\n')
  const candidateIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim()
    if (trimmed.length > 0 && isGenuiCandidate(trimmed)) candidateIdxs.push(i)
  }
  if (candidateIdxs.length === 0) return { line: undefined, failure: undefined, multiplicity: false, rest: afterMeta }

  const firstLine = lines[candidateIdxs[0]!]!.trim()
  const envelope = readGenuiLine(firstLine)
  const rest = lines.filter((_, i) => !candidateIdxs.includes(i)).join('\n')
  return {
    line: envelope !== undefined ? firstLine : undefined,
    failure: envelope !== undefined ? undefined : { code: genuiFailureCode(firstLine), path: '' },
    multiplicity: candidateIdxs.length > 1,
    rest,
  }
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
  const system = buildSystemPrompt(deps.catalog, exemplars, opts.mode, miniSkills, opts.personaSystem, opts.genuiSurface) // SPEC-R6 — catalog-derived; ADR-0090 mode + ADR-0091 mini-skills + ADR-0138 persona + genui-surface SPEC-R10
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
  // GH #240/ADR-0159 wave B — the per-step source reveal's producer gate: raw wire lines ride
  // `TurnProgress.source` ONLY under the explicit 'source' member (fail-closed: the 'stages' default AND
  // 'full' both attach nothing — the reasoning and source disclosures are independent opt-ins).
  const attachSource = emitProgress && progressDetail === 'source'
  let failures: RoundFailure[] | undefined
  let lastRaw: string | undefined
  let lastCandidate: string | undefined // the previous round's peeled candidate wire text — the `retry` stage's source
  let genuiMultiplicityHit = false // genui-surface SPEC-R1: sticky across rounds — a factual "this happened at least once" tally, never reset
  for (let round = 0; round < opts.maxRounds; round++) {
    const failuresFedBack = failures // what THIS round's prompt carried back — the trace's failureCodes
    // ADR-0146 F1 — the lifecycle stages, yielded AS THEY HAPPEN, strictly BEFORE any content line (content
    // still streams only after full validation, SPEC-R5). A self-correct round announces `retry` with the
    // attempt ordinal first, then `sent` before the provider request. All gated on the `progress` opt-in.
    // GH #240 — under 'source', `retry` carries the FAILED round's candidate JSONL (the invalid attempt the
    // feedback loop is correcting — data that otherwise never crosses the wire at all), capped.
    if (emitProgress && round > 0 && failures !== undefined)
      yield formatProgressLine({
        stage: 'retry',
        round: round + 1,
        ...(attachSource && lastCandidate !== undefined && lastCandidate !== '' ? { source: capSource(lastCandidate) } : {}),
      })
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
      effort: opts.effort,
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

    const { note, ask, rest: afterMeta } = peelMetaLine(raw) // ADR-0088 §1 / ADR-0097 §1 — peeled BEFORE heal/validate
    // genui-surface SPEC-R1 — peeled SECOND, still BEFORE heal/validate: a genui line (valid or not) never
    // reaches the shared A2UI healer/validator, which doesn't know this kind exists. Recomputed FRESH every
    // round (never carried over): a round's genui candidate belongs to THAT round's own raw output, never
    // paired with a later, differently-corrected A2UI payload. `multiplicity` is the one exception — a
    // factual sticky tally across the whole turn (SPEC-R1: "dropped + counted").
    const genuiPeel = peelGenuiLines(afterMeta)
    const rest = genuiPeel.rest
    if (genuiPeel.multiplicity) genuiMultiplicityHit = true
    const genuiLine = genuiPeel.line
    const restLines = stripOuterFence(rest)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    // GH #240/ADR-0159 wave B — this round's candidate wire text: the peeled, fence-stripped JSONL entering
    // heal/validate (createSurface/updateDataModel/updateComponents lines — never the meta-line note, which
    // `peelMetaLine` already removed). Remembered across rounds for the `retry` attachment above. The peel
    // moved ABOVE the `validating` yield so the event can carry its own source — the stage's timing contract
    // ("AFTER accumulation, BEFORE assemble/validate") is unchanged: peel is pure string prep, not validation.
    const candidate = restLines.join('\n')
    lastCandidate = candidate
    if (emitProgress)
      yield formatProgressLine({
        stage: 'validating',
        ...(attachSource && candidate !== '' ? { source: capSource(candidate) } : {}),
      }) // AFTER accumulation, BEFORE assemble/validate

    // A note-only turn (ADR-0088 Consequences) OR a genui-only turn (genui-surface SPEC-R1 — a genui
    // line MAY ship with zero A2UI shape-changes): zero A2UI lines is a CLEAN success whenever there is a
    // note AND/OR a valid genui line to ship — nothing to validate, so nothing to self-correct. Must NOT
    // halt-and-report (empty ≠ invalid). ADR-0097 §1: a declared `ask` here is trivially integrity-invalid
    // too (no payload creates ANYTHING) — dropped, never even reaching `askIntegrityHolds`.
    if (restLines.length === 0 && (note !== undefined || genuiLine !== undefined)) {
      const failureCodes = (failuresFedBack ?? []).map((f) => f.code)
      if (genuiMultiplicityHit) failureCodes.push('GENUI_MULTIPLICITY') // SPEC-R1 — a factual tally, never a retry trigger
      // SPEC-N4/SPEC-R1 — a genui structural failure on THIS shipping round is dropped from the wire
      // (never blocks a clean note-only/genui-only success), but its failure code MUST still land on the
      // trace — SPEC-N4's "every drop path increments an observable counter" applies to this drop too,
      // not only to the retried case already covered by `failuresFedBack` above.
      if (genuiPeel.failure !== undefined) failureCodes.push(genuiPeel.failure.code)
      if (emitProgress) yield formatProgressLine({ stage: 'done' }) // before the final (note-only/genui-only) yield
      if (note !== undefined) yield formatMetaLine(note, traceFor(round + 1, 0, failureCodes), undefined)
      if (genuiLine !== undefined) yield genuiLine // SPEC-R1 AC2 — ships intact, the model's own line verbatim
      return
    }

    const assembled = assembleFromRaw(rest)
    if (assembled === undefined) {
      // genui-surface SPEC-R1 — a genui structural failure MAY hitch a ride on the SAME retry an A2UI
      // parse failure already needs (never an EXTRA round manufactured purely for genui's sake — see the
      // `verdict.valid` branch below for the fuller reasoning).
      failures = genuiPeel.failure !== undefined ? [{ code: 'PARSE', path: '' }, genuiPeel.failure] : [{ code: 'PARSE', path: '' }]
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
        if (genuiMultiplicityHit) failureCodes.push('GENUI_MULTIPLICITY')
        // SPEC-N4/SPEC-R1 — see the note-only branch's identical comment: a genui failure dropped on an
        // otherwise-successful round still needs to land on the trace, not just the retried case.
        if (genuiPeel.failure !== undefined) failureCodes.push(genuiPeel.failure.code)
        yield formatMetaLine(note, traceFor(round + 1, assembled.healedCount, failureCodes), finalAsk) // meta-line FIRST
      }
      // genui-surface SPEC-R1 — a genui structural failure on an OTHERWISE-valid A2UI round is DROPPED
      // silently here (never manufactures an extra round purely to fix it: "degrade, never halt" — the
      // turn's note/A2UI lines still ship on schedule). `genuiLine` is `undefined` in exactly that case.
      if (genuiLine !== undefined) yield genuiLine // SPEC-R1 AC2 — ships intact, alongside the note
      for (const msg of assembled.output) yield JSON.stringify(msg) // SPEC-R5 — validate-then-stream (nothing invalid ever painted)
      return
    }
    // genui-surface SPEC-R1 — a genui failure hitches a ride on the SAME retry the A2UI validator already
    // needs (never an independent extra round; genui alone can never cause the eventual `ProduceHalt`
    // below, since that only fires when the A2UI verdict itself is still invalid at round exhaustion).
    failures = genuiPeel.failure !== undefined ? [...verdict.failures, genuiPeel.failure] : verdict.failures // SPEC-R4 — self-correct: feed the structured failures back
  }
  throw new ProduceHalt(failures ?? [{ code: 'SCHEMA', path: '' }])
}
