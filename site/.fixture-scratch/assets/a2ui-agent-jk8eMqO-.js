import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{t as n}from"./code-block-DEt2Scp8.js";var r=`// agent-transport.ts — LLD-C1 / SPEC-R1: the live-agent isolation seam + the session/turn model.
//
// This is the ONE interface the demo page binds to (SPEC-R1). Where the A2UI stream originates —
// the deterministic recorded backbone (LLD-C2), the dev-only proxy overlay (LLD-C6/C7), or a future
// client-direct transport — lives entirely BEHIND \`AgentTransport\`; swapping one for another is a
// single construction-site edit, no page change (SPEC-R1 AC2).
//
// Placement (LLD §0, repaired by ADR-0137/TKT-0072): this file lives in \`src/agent/\` — pure, zero-dep TS
// with no \`fs\`/\`fetch\`/key, exported at the package's \`"./agent"\` subpath (SPEC-N1 v0.5). It is imported
// both by the Node harness (produce/proxy) and, for its TYPES only, by the browser page (types erase;
// A2uiClientMessage rides the package's public \`@agent-ui/a2ui\` surface).
//
// Refinement note vs the LLD skeleton: \`AgentProvider\` (the injected model seam, SPEC-R11/ADR-0073)
// is co-located here with the other seam interfaces rather than in \`providers/index.ts\`. Both the
// provider adapters and the \`produce()\` loop depend only on this signature, so hoisting it to the
// shared seam file decouples those two build units (they need no import-ordering between them) and
// keeps every cross-cutting seam type in one place. The adapters + the id→adapter dispatch still live
// under \`providers/\` (LLD-C10); only the interface moves up.

import type { A2uiClientMessage } from '../renderer/index.ts'
import type { GenuiActionMessage } from './genui-line.ts'

// ── The session (SPEC-R8 / ADR-0072) — the standard Messages-API turn array ─────────────────────────

/** A message role. \`assistant.content\` is the emitted A2UI JSONL for that turn. */
export type Role = 'user' | 'assistant'

/** One turn: a user intent / framed client message, or an assistant's emitted A2UI JSONL stream. */
export interface Turn {
  role: Role
  /** For \`assistant\` turns this is the A2UI JSONL the agent emitted; for \`user\` turns, the framed input. */
  content: string
}

/** The ordered turn history the BROWSER holds (SPEC-R8: the proxy is stateless).
 *
 * \`surfacePrefix\` (ecosystem SPEC-R4, GH #475) — OPTIONAL, absent by default (the \`mode\`/\`genuiSurface\`
 * additive precedent: every caller that predates this field is byte-unchanged). The v1.0 spec source
 * itself advises orchestrators to prefix subagent surface IDs to prevent conflicts; when an orchestrator
 * assigns one producer's session a namespace (e.g. \`"box2"\`), \`session.ts\`'s \`prefixSurfaceId\`/
 * \`ownsSurfaceId\`/\`enforceSurfacePrefix\` offer that convention first-class on this seam — so two
 * subagent producers sharing one orchestrator can never mint colliding surfaceIds, nor address each
 * other's surfaces, by construction. See \`session.ts\` for the pure functions that consume this field. */
export interface Session {
  turns: Turn[]
  surfacePrefix?: string
}

/**
 * The provider+model selected for a turn (from the in-chat switcher, SPEC-R12). OPTIONAL: the recorded
 * backbone and the stub-provider tests ignore it; only the live overlay threads it to the proxy, which
 * validates the \`{provider, model}\` PAIR against the \`providers.json\` allowlist (SPEC-R12) before use.
 */
export interface ProviderSelection {
  provider?: string
  model?: string
}

/**
 * One agent turn's framed input (SPEC-R1 / SPEC-R8). Turn 1 is a raw user \`intent\`; every later turn is
 * a \`client\` message (\`action\` | \`functionResponse\` | \`error\`, OR genui-surface SPEC-R8's \`genuiAction\` —
 * a SIBLING kind, never a real \`A2uiClientMessage\`) that the pure \`nextTurn\` reducer (LLD-C5) frames into
 * the next user turn. Both carry the running \`Session\` (the browser is the source of truth) and the
 * optional \`{provider, model}\` selection.
 */
export type TurnInput =
  | ({ kind: 'intent'; text: string; session: Session } & ProviderSelection)
  | ({ kind: 'client'; message: A2uiClientMessage | GenuiActionMessage; session: Session } & ProviderSelection)

// ── The transport seam (SPEC-R1 / ADR-0069) ─────────────────────────────────────────────────────────

/**
 * The isolation seam: one agent turn in, an ordered stream of A2UI JSONL lines out. Zero-dep. The page
 * consumes ONLY this — no \`fetch\`, proxy URL, or concrete transport leaks into the rendering/round-trip
 * logic (SPEC-R1 AC1). Every emitted line is ALREADY validated (validate-then-stream, SPEC-R5); the
 * browser ingests them through one code path regardless of origin.
 */
export interface AgentTransport {
  turn(input: TurnInput): AsyncIterable<string>
}

// ── The provider seam (SPEC-R11 / ADR-0073) ─────────────────────────────────────────────────────────

/** A reasoning-effort dial (the Figma chat-input refactor's Effort picker) — a plain, LOCAL union rather
 *  than importing \`@agent-ui/app\`'s \`EffortLevel\` (composer-options.ts): the package DAG runs
 *  \`a2ui ← app\`, never the reverse — a duplicated four-value union is cheaper than an upward dependency
 *  (the \`AdminTurn\`/a2ui \`Turn\` precedent, TKT-0052). \`undefined\`
 *  ⇒ no effort dial requested, the provider's own default applies — byte-behavior-unchanged for every
 *  caller that predates this. */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * A provider lifecycle event (ADR-0146 F1/F4) — the raw upstream signals an adapter already parses and
 * (today) drops, surfaced through the OPTIONAL \`onEvent\` callback so \`produce()\` can compose them into the
 * closed \`TurnProgress\` stage vocabulary. Provider-agnostic and MINIMAL: each adapter maps its OWN upstream
 * events onto these five kinds; an adapter that maps nothing degrades to the coarser stages \`produce()\`
 * observes by itself (F4 — a coarser dial, never a broken one). \`text\` carries a \`thinking\`-delta excerpt
 * (raw reasoning), forwarded onto the wire only under an explicit \`progressDetail:'full'\` opt-in (F3).
 */
export interface ProviderEvent {
  kind: 'message_start' | 'block_start' | 'thinking' | 'block_stop' | 'done' | 'tool'
  /** \`thinking\`: a reasoning-delta excerpt. \`tool\`: the tool NAME being executed (a factual process
   *  claim from the closed registry, GH #49 — never model-composed prose). */
  text?: string
}

// ── Tool use (GH #49) — the integration seam ────────────────────────────────────────────────────────────

/** One callable tool's declaration — the provider-agnostic JSON-Schema shape (it happens to be
 *  Anthropic-native; an OpenAI adapter maps \`input_schema\` → \`parameters\`). Declarations come from a
 *  REGISTRY the caller owns (site-side, keyless integrations first); the model never invents one. */
export interface ToolDef {
  name: string
  description: string
  /** A JSON Schema object for the tool's input (\`{type:'object', properties, required?}\`). */
  input_schema: Record<string, unknown>
}

/** Execute ONE tool call and return the result TEXT handed back to the model. Rejections are surfaced
 *  to the model as an error-text result (the adapter formats them) — a failed integration degrades the
 *  answer, never the turn. \`signal\` (PR #59 review) is the TURN's abort signal, threaded so an aborted
 *  turn also cancels in-flight tool work (an executor combines it with its own timeout). */
export type ExecuteTool = (name: string, input: Record<string, unknown>, signal?: AbortSignal) => Promise<string>

/**
 * The injected model seam (SPEC-R11): one isolated module PER provider implements this (Anthropic this
 * wave; OpenAI/Gemini the next slices). \`stream\` yields raw text fragments that accumulate into the
 * model's output (the A2UI JSONL the loop then heals+validates). The \`produce()\` driver (LLD-C3) depends
 * ONLY on this signature and never names a vendor; the key is passed IN via the factory, never read at
 * module scope (SPEC-R11: \`process.env[<envKey>]\` server-side). Each adapter is its provider's single
 * upstream-format (SSE → text) boundary (SPEC-N5).
 */
export interface AgentProvider {
  stream(req: {
    model: string
    system: string
    messages: Turn[]
    /** Optional reasoning-effort dial. This is the SEAM's contract, not a guarantee every adapter already
     *  meets: an adapter SHOULD ignore an effort level it can't map (a degraded DIAL, never a degraded
     *  REQUEST) rather than let it reach the upstream API unconditionally. The shipped Anthropic adapter
     *  (code-reviewer finding) currently sends \`thinking\` for every non-'low' value with no model-
     *  capability check — latent today because every \`SUPPORTED_MODELS\` entry supports extended thinking,
     *  but a future non-thinking model added to that list would 400 here, not degrade. Gate on model
     *  capability before adding one. */
    effort?: Effort
    /** ADR-0146 F1 — an OPTIONAL lifecycle callback (the exact additive precedent \`effort?\` set on this
     *  same interface): a stub/adapter that ignores it is byte-behavior-unchanged; the Anthropic adapter
     *  maps its already-parsed-and-dropped SSE frames onto it inside its own frame walk. A CALLBACK, not a
     *  union-yielding stream, because inside \`produce()\` there is exactly one caller and the text-
     *  accumulation contract must not change (F1's principled asymmetry — on the wire it is in-band lines,
     *  here it is a side callback). */
    onEvent?: (ev: ProviderEvent) => void
    /** GH #49 — OPTIONAL tool declarations + executor (the \`effort?\`/\`onEvent?\` additive precedent: an
     *  adapter that ignores them is byte-behavior-unchanged; a caller passing neither gets today's
     *  request shape exactly). When BOTH are present the adapter runs its provider-native tool-use loop
     *  INTERNALLY — executing calls via \`executeTool\`, feeding results back, and yielding only TEXT
     *  fragments throughout (the F1 principled asymmetry: the accumulation contract never changes).
     *  Bounded by the adapter's own round cap; \`tools\` without \`executeTool\` is a caller bug the adapter
     *  treats as "no tools". */
    tools?: readonly ToolDef[]
    executeTool?: ExecuteTool
    signal?: AbortSignal
  }): AsyncIterable<string>
}
`,i=`// produce.ts — LLD-C3 / SPEC-R4/R5/R7, ADR-0070: the bounded runtime loop (streaming LLD-C2 realized).
//
// retrieve exemplars → build the catalog-derived prompt → generate via the injected AgentProvider →
// PEEL a leading meta-line (ADR-0088 §1, before heal/validate) → heal + validate the REMAINING A2UI text
// (the SHARED surfaces, no fork — SPEC-N3) → on failure feed the validator's structured failures back →
// bounded at maxRounds → VALIDATE-THEN-STREAM (yield the meta-line, if any, then ONLY a fully validated
// payload's JSONL lines; SPEC-R5) → halt-and-report at the bound, emitting NOTHING invalid. A note-only
// round (a meta-line with zero remaining A2UI lines) is a CLEAN success, not a halt (ADR-0088
// Consequences: empty ≠ invalid). The deterministic gate is the whole runtime verifier; there is NO
// runtime rubric-grading round (ADR-0070 — the a2ui-payload rubric is authoring/eval-time).
// Provider-agnostic: \`deps.provider\` is the injection point (a stub in tests, an adapter in the proxy),
// so the loop mechanics are gate-covered with no live model.
//
// ADR-0090 §1/§4: \`ProduceOptions.mode\` (a \`GenUiMode\`, alongside \`maxRounds\`/\`model\`/\`k\`) threads
// straight to \`buildSystemPrompt\` — the same per-turn-tuning-knob path \`model\` already proves. Absent
// \`mode\` ⇒ \`buildSystemPrompt\` receives \`undefined\` ⇒ its default/zero-regression composition; nothing
// else in the loop (peel/heal/validate/stream) reads or branches on it.
//
// ADR-0091 §2: \`selectMiniSkills\` runs ONCE per turn, right beside \`deps.retrieve(query)\` — the SAME
// pre-loop position, because \`system\` is built ONCE outside the round loop and never rebuilt per round.
// Its result feeds \`buildSystemPrompt\`'s 4th parameter; an empty/no-match selection composes no new
// block (ADR-0091 Acceptance). The registry (\`MINI_SKILLS\`) is a static committed module, not an
// injected \`ProduceDeps\` surface — unlike \`retrieve\`, it has no store/snapshot to inject.
//
// ADR-0097 §1/§3: the model may additionally author an \`ask\` on the SAME leading meta-line — a feed-
// embedded ask declaration (\`{surfaceId}\`). Two produce-layer checks gate it, both AFTER the shared
// validator passes (never a fork of \`validateA2ui\` itself, SPEC-N3):
//   (a) ASK INTEGRITY (never a retry — a silent degrade): an \`ask\` naming a surface no payload line
//       creates, or colliding with a surface already known to THIS session (a prior turn's own emitted
//       \`createSurface\`), is DROPPED from the outgoing meta-line — the note stands, the turn ships
//       exactly as if no \`ask\` were authored (ADR-0089's prose-ask degrade path).
//   (b) FEED SCOPE (a self-correct round, like a validator failure): every component type on the
//       ask-routed surface must be a member of \`FEED_SURFACE_TYPES\` (\`feed-catalog.ts\`, the single
//       source SPEC-R15 gates) — a violation feeds the failure back as a produce-layer-only \`'FEED_SCOPE'\`
//       literal (never joining the protocol's closed \`ErrorCode\` union) and retries, never streams.
//
// ADR-0174 cl.2 / SPEC-R20: the model may additionally author a \`plan\` on the SAME leading meta-line — a
// step-list declaration (\`{steps: [{id, description}]}\`), following the \`ask\`-arm precedent EXACTLY:
// MODEL-authored, shallow-validated by \`readMetaLine\` (a malformed \`plan\` drops only itself). UNLIKE
// \`ask\`, \`plan\` carries NO produce-layer integrity check and NO self-correct gate — it is peeled alongside
// \`note\`/\`ask\` and passed through UNCHANGED onto the outgoing meta-line whenever the model declared one
// (Scope: no runtime rewriting; the host-side plan→execute→synthesize loop that reads it is a future
// SPEC/LLD's job, not this file's).
//
// genui-surface SPEC-R1/R2/R10: a genui-shaped candidate line (the reserved \`{"genui":{surfaceId,html}}\`
// kind) is peeled OUT of the model's raw output on EVERY round, immediately after the meta-line peel and
// BEFORE \`heal\`/\`validateA2ui\` ever see the remaining text — mirroring the meta-line peel precedent for a
// THIRD reserved wire kind. Unconditional: the peel runs whether or not \`opts.genuiSurface\` invited the
// model to use it (a reserved kind is handled the same way regardless of that per-turn signal, which only
// gates \`buildSystemPrompt\`'s teaching block). A structurally valid candidate ships intact (verbatim,
// SPEC-R1 AC2) alongside the meta-line; a structurally invalid one MAY hitch a ride on the SAME round the
// A2UI validator already needs to retry (never an independent extra round — genui alone never causes the
// eventual \`ProduceHalt\`); on exhaustion or an otherwise-successful round it is silently dropped, never
// halting the turn. At most one genui line ships per turn; extras are dropped + counted
// (\`GENUI_MULTIPLICITY\`, carried on \`TurnTrace.failureCodes\` — a factual tally, never a retry trigger).
//
// ADR-0146 F1/F3: when the caller opts in (\`opts.progress === true\` — absent ⇒ BYTE-IDENTICAL to before,
// the note-only/halt/every-deterministic-gate guarantee), the loop also INTERLEAVES live-turn lifecycle
// progress on the SAME stream — \`{"a2uiMeta":{"progress":{stage,...}}}\` meta-lines yielded AS THEY HAPPEN,
// strictly ahead of any content line. produce() composes the provider's \`onEvent\` signals (\`started\` on the first message_start/
// content_block_start; \`reasoning\` on a thinking delta) with its OWN loop stages (\`sent\` before each
// request; \`content\` on the round's OWN first text fragment — produce() is that stage's one pinned emitter;
// \`validating\` after accumulation; \`retry\` with the attempt ordinal on a self-correct round; \`done\` before
// the final yield). VALIDATE-THEN-STREAM is UNTOUCHED: progress is not content — it never enters
// heal/validate/corpus and no A2UI content line ever precedes validation (SPEC-R5). \`progressDetail\`
// ('stages' default) keeps raw thinking text OFF the wire; 'full' forwards bounded excerpts (F3).

import type { A2uiServerMessage, A2uiOutput } from '../protocol.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { describePropType } from '../catalog/catalog.ts'
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
import type { AskDeclaration, PersonaPatch, PlanDeclaration, TurnProgress, TurnTrace } from './meta-line.ts'
import type { GenUiMode } from './gen-ui-mode.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from './mini-skills.ts'
import { FEED_SURFACE_TYPE_SET } from './feed-catalog.ts'
import { isGenuiCandidate, readGenuiLine, utf8ByteLength, GENUI_MAX_HTML_BYTES } from './genui-line.ts'
import type { GenuiSurfaceConfig } from './genui-surface-config.ts'

const PROTOCOL_VERSION = 'v1.0'
const DEFAULT_MODEL = 'claude-sonnet-5' // the registry's defaultModel (providers.json)

/** The loop's injected surfaces (SPEC §5). \`provider\` is the model seam (stub|real); \`retrieve\` runs
 * over the JUDGED shard; \`catalog\` is the sole component authority. */
export interface ProduceDeps {
  provider: AgentProvider
  retrieve: (query: RetrieveQuery) => CorpusRecord[]
  catalog: Catalog
}

export interface ProduceOptions {
  maxRounds: number
  signal?: AbortSignal
  /** The AUTHORITATIVE model. The dev proxy passes the allowlist-VALIDATED \`{provider,model}\` here, and it
   * takes PRECEDENCE over any client-supplied \`input.model\` — the trust boundary (SPEC-R12): a crafted
   * \`input.model\` must never reach the API. \`input.model\` is only a fallback for callers that don't set it. */
  model?: string
  /** The reasoning-effort dial (\`AgentProvider.stream\`'s own \`effort?: Effort\` field, the SAME additive
   * precedent \`mode\`/\`genuiSurface\` each already set on this seam), relayed VERBATIM to \`deps.provider.stream\`.
   * Never consulted by \`buildSystemPrompt\` or any peel/heal/validate step — it is a provider-call knob, not
   * a prompt-composition one. Absent ⇒ the request shape is byte-identical to before (the adapter's own
   * default applies, per \`AgentProvider.stream\`'s doc). */
  effort?: Effort
  /** Retrieval top-k (defaults to 3). */
  k?: number
  /** ADR-0090 §1/§4 — the per-turn Gen-UI disposition, threaded to \`buildSystemPrompt\`. Absent ⇒
   * \`buildSystemPrompt\` receives \`undefined\` ⇒ the default/zero-regression composition (Decision §1). */
  mode?: GenUiMode
  /** ADR-0135 cl.7 — the mini-skill cap, now a tunable knob (was the hardcoded \`DEFAULT_MINI_SKILL_CAP\`
   * module constant). Absent ⇒ \`DEFAULT_MINI_SKILL_CAP\`, reproducing today's behavior byte-for-byte. */
  miniSkillCap?: number
  /** ADR-0138 — the caller-supplied persona section \`buildSystemPrompt\` appends AFTER the catalog law
   * (voice/content only; the wire contract stays authoritative, the fixed precedence sentence says so).
   * Absent/empty ⇒ byte-identical composition (the \`mode\`-absent precedent). */
  personaSystem?: string
  /** GH #49 — tool declarations + executor, threaded VERBATIM to \`provider.stream\` (the adapter owns the
   * whole tool-use loop; produce() only relays the seam and maps the 'tool' provider event onto the
   * progress stage). Absent ⇒ the request shape is byte-identical to before (the \`effort?\` precedent).
   * Both-or-neither: \`tools\` without \`executeTool\` is treated as no tools by the adapter contract. */
  tools?: readonly ToolDef[]
  executeTool?: ExecuteTool
  /** ADR-0146 F1 — opt IN to interleaved live-turn progress meta-lines. Absent/false ⇒ produce() streams
   * BYTE-IDENTICALLY to before (no progress lines) — the "note-only and halt paths byte-unchanged"
   * guarantee, and every deterministic gate/consumer that predates progress is untouched. \`true\` ⇒ the
   * loop yields \`{"a2uiMeta":{"progress":{stage,…}}}\` meta-lines AS THEY HAPPEN, strictly ahead of any
   * content line (SPEC-R5 validate-then-stream preserved). The live consumer loops (a2ui-chat/a2ui-live/
   * admin-live-runner) set this; the recorded transport carries authored progress instead (SPEC-R5/N4). */
  progress?: boolean
  /** ADR-0146 F3 — how much raw reasoning crosses the wire on \`reasoning\` progress events (only when
   * \`progress\` is on). Absent ⇒ \`'stages'\`: \`produce()\` forwards the reasoning stage TRANSITION only, NO
   * thinking text (the default, conservative posture). \`'full'\`: forwards bounded excerpts on
   * \`TurnProgress.detail\` — an explicit consumer opt-in, never the default. Only affects \`reasoning\`.
   * GH #240/ADR-0159 wave B adds \`'source'\` — a SIBLING member, not a rung above \`'full'\`: stage
   * transitions exactly like \`'stages'\` (still NO thinking text — the two disclosures stay independent),
   * PLUS the per-stage raw-source attachment (\`TurnProgress.source\`): the actual A2UI JSONL behind
   * \`validating\` (this round's candidate lines entering heal/validate) and \`retry\` (the PRIOR round's
   * failed candidate — otherwise never visible anywhere client-side). Capped at
   * \`SOURCE_ATTACHMENT_CAP\`. The gate is fail-closed at every layer: absent ⇒ \`'stages'\` ⇒ zero raw
   * lines ride any progress event; \`'full'\` does NOT imply \`'source'\` and vice versa (a consumer
   * needing both is a deliberate future member, not an accident of ladder ordering). */
  progressDetail?: 'stages' | 'full' | 'source'
  /** genui-surface SPEC-R10 — the per-turn "may this turn emit GenUI" signal, threaded to
   *  \`buildSystemPrompt\`'s genui teaching block. Deliberately NOT a \`GenUiMode\` member and never
   *  consulted by any A2UI-composition logic in this loop (SPEC §4 N2 — a new, orthogonal axis). Absent
   *  ⇒ \`buildSystemPrompt\` composes zero genui bytes (the degradation law) — but the WIRE-LEVEL peel
   *  below (SPEC-R1) runs UNCONDITIONALLY regardless of this flag: a genui line is a reserved kind on the
   *  stream itself, handled the same way whether or not the model was invited to use it. */
  genuiSurface?: GenuiSurfaceConfig
  /** GH #418 — the caller's OWN A2UI Surface Option, threaded to \`buildSystemPrompt\`'s 7th parameter.
   *  Absent/\`true\` ⇒ byte-identical to before this field existed (the \`genuiSurface\`-absent precedent):
   *  the full A2UI grammar/catalog/examples/mini-skills composition, unconditionally. \`false\` ⇒ the caller
   *  has no A2UI renderer this turn — \`buildSystemPrompt\` composes zero A2UI-grammar bytes, and (when
   *  \`genuiSurface.enabled\` is also set) folds an explicit no-A2UI-renderer framing into the genui block
   *  instead. Never consulted by the peel/heal/validate loop below (SPEC-N3 — a produce-layer composition
   *  knob only, the SAME posture \`mode\`/\`genuiSurface\` already hold): a stray A2UI-shaped line the model
   *  emits anyway still runs the ordinary validate/self-correct path, exactly as an \`exclusive\` genui-only
   *  turn's stray A2UI already does today. */
  a2uiEnabled?: boolean
  /** ADR-0178 cl.3 / SPEC-R30 — the persona's OWN authoring modality gate, threaded per call to
   *  \`buildSystemPrompt\`'s authoring teaching block. Absent/\`false\` ⇒ zero teaching bytes compose (the
   *  degradation law every opt-in modality on this seam already carries: byte-identical to before this
   *  capability existed, in every mode). \`true\` ⇒ the model is taught the \`personaPatch\` arm's mechanics.
   *
   *  Used for EXACTLY ONE thing — conditioning prompt composition. It is never consulted by the peel/
   *  passthrough below: SPEC-R29's wire layer is deliberately GATE-BLIND, so there is no gate-conditional
   *  wire branch to drift, and a volunteered patch on a gate-off turn still rides the outgoing meta-line
   *  exactly as a volunteered \`plan\` does. What the gate withholds is CONSUMPTION, which is host-side
   *  (ADR-0178 cl.2's three-filter apply gate — a future slice), never this primitive's. */
  authoringSurface?: boolean
  /** ADR-0182 cl.1/cl.2 / SPEC-R31 — whether THIS turn is the Builder's own dedicated interview (a fact
   *  derived host-side from turn origin, \`session === 'authoring'\`, never a persona-editable flag),
   *  threaded per call to \`buildSystemPrompt\`'s builder-mission teaching block. Absent/\`false\` ⇒ zero
   *  teaching bytes compose. \`true\` ⇒ the model is taught to actively drive the interview toward
   *  completion and declare its own remaining-work view via the ALREADY-SHIPPED \`plan\` arm.
   *
   *  A SEPARATE gate from \`authoringSurface\` above — this primitive never derives one from the other;
   *  the caller (the runner) decides both independently, per ADR-0182 cl.1. Used for exactly the same
   *  ONE thing — conditioning prompt composition — and equally gate-blind at the wire layer: \`plan\` is
   *  SPEC-R20's existing passthrough, unaffected by this flag either way. */
  builderMission?: boolean
}

/** The bounded raw-reasoning excerpt cap (ADR-0146 F3, \`progressDetail:'full'\`) — a \`thinking\` delta can be
 * long; a forwarded excerpt is capped so a polite live region is never token-spammed. */
const REASONING_EXCERPT_CAP = 200

/** GH #240/ADR-0159 wave B — the raw-source attachment cap (\`progressDetail:'source'\`), in characters:
 * 16 KB, the SAME runaway-guard bound the proxies already apply to \`personaSystem\` (dev-proxy-plugin.ts /
 * worker/index.ts — the repo's established "bounded but generous developer text" constant). Rationale: a
 * realistic surface payload runs low single-digit KB (the corpus exemplars' own ceiling), so 16 KB never
 * truncates real traffic; and since the \`validating\` attachment duplicates the payload's bytes on the
 * wire (the final round's candidate IS the content that follows), the cap bounds that duplication to
 * ~16 KB per progress event even against a pathological payload. A capped attachment says so explicitly
 * (the truncation marker below) — never a silent cut. */
export const SOURCE_ATTACHMENT_CAP = 16_384
const SOURCE_TRUNCATION_MARKER = '\\n… [truncated]'
function capSource(source: string): string {
  return source.length <= SOURCE_ATTACHMENT_CAP ? source : source.slice(0, SOURCE_ATTACHMENT_CAP) + SOURCE_TRUNCATION_MARKER
}

/** Serialize a runtime-composed progress meta-line (ADR-0146 F1) — the SAME reserved-envelope shape every
 * meta kind uses (no \`version\` key ⇒ provably not an \`A2uiServerMessage\`; fault-isolates to
 * VERSION_UNSUPPORTED if ever leaked to \`dispatch()\`). Interleaved DURING the turn, never content: it never
 * enters heal/validate/corpus, and no A2UI content line ever precedes validation (SPEC-R5 untouched). */
function formatProgressLine(progress: TurnProgress): string {
  return JSON.stringify({ a2uiMeta: { progress } })
}

/** GH #290 — the channel an \`onEvent\` callback pushes onto (it cannot itself \`yield\` from this generator);
 * \`waitForPush\` is what lets \`interleaveProgress\` below discover a push the INSTANT it happens, rather than
 * only when the provider's \`stream()\` next yields text. */
interface ProgressChannel {
  pending: TurnProgress[]
  push(ev: TurnProgress): void
  /** Resolves as soon as \`pending\` is non-empty (immediately if it already is). */
  waitForPush(): Promise<void>
}

function createProgressChannel(): ProgressChannel {
  const pending: TurnProgress[] = []
  let wake: (() => void) | undefined
  return {
    pending,
    push(ev) {
      pending.push(ev)
      const w = wake
      wake = undefined
      w?.()
    },
    waitForPush() {
      if (pending.length > 0) return Promise.resolve()
      return new Promise((resolve) => {
        wake = resolve
      })
    },
  }
}

/**
 * GH #290 fix: decouples progress-event DELIVERY from the provider's fragment-yield cadence. A provider
 * may run an entire tool round (anthropic.ts's GH #49 loop) without yielding a single text fragment, while
 * its \`onEvent\` callback still fires in real time (e.g. one 'tool' event per call, pushed onto \`channel\`
 * synchronously) — draining \`channel.pending\` only between fragments (the pre-fix behavior) meant a whole
 * tool round's worth of progress sat buffered until the round's text finally arrived. This drives the
 * provider's async iterator manually and RACES its next \`.next()\` against \`channel.waitForPush()\` —
 * whichever settles first wins — so a push surfaces immediately regardless of whether/when the provider
 * yields text next. Any progress queued ahead of a fragment is always yielded before that fragment (the
 * pre-existing "drain pending before handling this frag" ordering is preserved, just re-timed).
 */
async function* interleaveProgress(
  stream: AsyncIterable<string>,
  channel: ProgressChannel,
): AsyncGenerator<{ kind: 'progress'; ev: TurnProgress } | { kind: 'frag'; text: string }> {
  const iter = stream[Symbol.asyncIterator]()
  let nextFrag = iter.next()
  try {
    for (;;) {
      const race = await Promise.race([
        nextFrag.then((r): { tag: 'frag'; r: IteratorResult<string> } => ({ tag: 'frag', r })),
        channel.waitForPush().then((): { tag: 'progress' } => ({ tag: 'progress' })),
      ])
      while (channel.pending.length > 0) yield { kind: 'progress', ev: channel.pending.shift()! }
      if (race.tag === 'progress') continue
      if (race.r.done) return
      yield { kind: 'frag', text: race.r.value }
      nextFrag = iter.next()
    }
  } finally {
    await iter.return?.()
  }
}

/**
 * A round's fed-back failure (ADR-0097 §3): either the shared validator's \`Failure\` (its \`code\` is the
 * protocol's closed \`ErrorCode\` union), OR a produce-layer-only literal — \`'FEED_SCOPE'\` — that never
 * joins that union (no \`ErrorCode\` change; the ADR is explicit about this). Structurally compatible with
 * \`Failure\` (both are \`{code: string; path: string}\` shapes), so a \`Failure[]\` from \`validateA2ui\` is
 * assignable here with no cast, and \`TurnTrace.failureCodes: string[]\` (already a plain string array)
 * carries either kind identically.
 */
interface RoundFailure {
  code: string
  path: string
}

/** Thrown when the loop exhausts \`maxRounds\` without a valid payload — the page shows a "could not
 * compose a valid surface" error, NOT a broken render (SPEC-R5). Carries the last round's failures.
 *
 * GH #307 — the message used to join \`f.code\` only ("… (IDGRAPH)"), which cannot say WHICH of
 * IDGRAPH's four members fired (\`sid:root\`, \`sid:root-missing\`, \`comp->ref\`, \`sid:cycle\` —
 * \`renderer/validate.ts:232-243\`) or where. A live report naming only the code was undiagnosable
 * without re-instrumenting the loop (exactly what happened investigating #307 itself). Each failure
 * now renders as \`CODE at path\` (path omitted only when empty, e.g. a whole-payload PARSE failure),
 * matching the wording already used in the self-correct feedback (\`messagesFor\`, same file) — one
 * format, two audiences. \`f.code\` alone remains safe to surface to an end user (dev-proxy-plugin.ts /
 * worker/index.ts's \`GENERIC_FAILURE_MESSAGE\` comment): \`f.path\` is likewise never raw upstream text,
 * only A2UI ids the model itself emitted. */
export class ProduceHalt extends Error {
  readonly failures: RoundFailure[]
  constructor(failures: RoundFailure[]) {
    const rendered = failures.map((f) => \`\${f.code}\${f.path ? \` at \${f.path}\` : ''}\`).join(', ') || 'unknown'
    super(\`produce: no valid surface within the round bound (\${rendered})\`)
    this.name = 'ProduceHalt'
    this.failures = failures
  }
}

function userContent(input: TurnInput): string {
  return input.kind === 'intent' ? input.text : frameClientMessage(input.message)
}

/** ADR-0169 cl.4 — \`queryOf\` is now catalog-aware: the retrieval query's \`catalogId\` names the
 *  REQUEST's catalog (\`deps.catalog.catalogId\`), not a pinned literal. \`corpus/retrieve.ts\` filters
 *  strictly on \`meta.catalogId\`, so a Basic turn retrieves zero exemplars (no \`a2ui-basic\` shard yet —
 *  a named follow-up) and \`fewShot\` degrades to its designed empty arm; no exemplars beats
 *  wrong-dialect exemplars. */
function queryOf(input: TurnInput, k: number, catalogId: string): RetrieveQuery {
  return { intent: userContent(input), k, catalogId, protocolVersion: PROTOCOL_VERSION }
}

/** ADR-0169 cl.4 clause 2 — the createSurface authority stamp: the SERVER-selected catalog is
 *  authoritative over the model-authored \`catalogId\` (the exact SPEC-R12 posture \`opts.model\` already
 *  takes over \`input.model\`). Runs AFTER \`heal()\` (on the already-parsed \`output\`) and BEFORE
 *  \`validateA2ui\` — an unconditional, idempotent overwrite, never a heal arm (ADR-0061's closed,
 *  form-only repair list is untouched; this is a producer-layer authority step). Keeps the byte-pinned
 *  \`grammar.md\` example (\`"catalogId":"agent-ui"\`) harmless on a non-default-catalog turn — the wire
 *  the client renders always carries the id whose catalog validated it. */
function stampCreateSurfaceCatalogId(output: A2uiOutput, catalogId: string): void {
  for (const msg of output) {
    if ('createSurface' in msg) msg.createSurface.catalogId = catalogId
  }
}

/**
 * Assemble the model messages for one generation round: the session history, the current user turn, and
 * — on a self-correct round — the prior INVALID attempt plus the validator's structured failures, so the
 * model sees exactly what it emitted and what was wrong (ADR-0070's "feed the failures back"). A
 * \`'FEED_SCOPE'\` round-failure (ADR-0097 §3) is fed back through the SAME "INVALID, re-emit" wording — a
 * feed ask hosting an out-of-scope type is exactly as re-emittable as a schema/catalog defect.
 *
 * GH #174: the feedback message ALSO pins the note's audience. The leading meta-line's \`note\` (ADR-0088
 * §1) is the user-visible chat reply — without an explicit instruction, a compliant model narrates its
 * compliance IN the note ("Re-emitting the corrected, validated JSONL…", observed live). The correction
 * loop is invisible plumbing: the note must keep addressing the USER, in persona, on every round.
 *
 * GH #288 (root-caused by #286): a \`CATALOG\` failure's \`path\` alone (\`lbl_in.emphasis\`) taught the model
 * nothing about WHAT was wrong with the value — only WHERE. A live repro showed a model repeat the
 * identical wrong guess across two whole self-correct rounds under that feedback. \`expectedTypeNote\`
 * resolves the failing property's declared type/enum from \`catalog\` + the prior round's OWN parsed
 * output (\`lastOutput\` — the component's \`component\` type names which \`ComponentDef\` to look the
 * property up in) and appends \`(expected: …)\`, the SAME description \`catalogInventory\` renders
 * (\`describePropType\`, catalog.ts) — one source, so the two teaching surfaces never disagree. GH #397
 * extends the SAME resolver to the sibling unknown-property case (component known, property not declared
 * on it — e.g. a \`gap\` guessed off a sibling component's shape): it appends the component's actual
 * declared property set instead of degrading silently. Resolves to \`''\` (no change to the existing
 * \`CODE at path\` wording) only when the path isn't a resolvable \`componentId.prop\` shape or the
 * component type itself isn't in \`lastOutput\`/\`catalog\` — a genuinely unknown-component-type CATALOG
 * failure (SPEC-R9) has no declared shape to teach at all.
 */
/**
 * GH #307 investigation — a PARSE failure (\`RoundFailure.path === ''\`, \`assembleFromRaw\` returned
 * \`undefined\`) carries NO diagnostic detail today, unlike \`CATALOG\`'s \`expectedTypeNote\` (GH #288):
 * the model sees only the bare code and has to guess what was wrong. Live reproduction (the quiz
 * persona's game loop, 3 real turns/9 rounds) caught the two concrete ways a real model breaks the
 * grammar's own "exactly one JSON object per line" rule (grammar.md) under a large/nested payload —
 * pretty-printing ONE message's array across several physical lines, and appending trailing prose
 * after the JSONL — both of which make \`assembleFromRaw\`'s per-line split hand the healer an
 * unparseable FRAGMENT, and both round 2/3 in that repro repeated the identical mistake because the
 * feedback never named it. A static reminder (not dynamically resolved — a PARSE failure carries no
 * component/property to look up, unlike CATALOG) restates the ONE constraint that covers both
 * observed failure shapes, appended once regardless of how many failures this round carries.
 *
 * GH #404 (live observation, \`.claude/ops/mb-live-proof/box2-quizmaster-FAIL.json\`) — a THIRD concrete
 * way a real model breaks the "one JSON object per line" rule: \`claude-haiku-4-5-20251001\` at temp 0.9
 * appended a literal trailing \`</parameter>\` line — tool-call/XML closing-tag bleed-through — after an
 * otherwise-valid single-round payload, and repeated the identical mistake across all 3 retry rounds
 * (the round budget then halted loudly, fail-closed, exactly as designed). The original PARSE_HINT's
 * "never add any text after the JSONL" already COVERED this shape in principle, but never named it
 * concretely, so the model never connected the dots under retry. This ADDS the concrete instruction
 * (ADR-0102 lane 3 — a hint-lane fix only; the validator/peel logic/round budget are untouched): a
 * PARSE retry now explicitly names the output-shape contract — NDJSON payload lines ONLY, never a
 * tool/XML closing tag, never a code fence, never prose outside the leading meta-line.
 */
const PARSE_HINT =
  ' Reminder: every A2UI message must be COMPLETE, valid JSON on a SINGLE line — never split one ' +
  'JSON object across multiple physical lines (no pretty-printing), and never add any text after ' +
  'the JSONL (the note belongs ONLY on the leading meta-line). Your reply is NDJSON payload lines ' +
  'ONLY: never emit an XML or tool-call closing tag (e.g. \`</parameter>\`), never wrap the JSONL in a ' +
  'code fence (\`\`\`), and never add conversational prose anywhere outside that leading meta-line.'

/**
 * GH #307 (second pass, static root-cause) — the SAME teaching gap PARSE_HINT above and \`expectedTypeNote\`
 * (GH #288) close, for the code that actually kills a game-loop turn: \`IDGRAPH\`. Its \`path\` names WHERE
 * (\`main:root\`, \`main:root-missing\`, \`card->expl\`, \`main:cycle\`) but never WHAT to do, and the surrounding
 * fixed instruction — "Re-emit the COMPLETE corrected A2UI JSONL" — reads, on a RESUMED surface, as "send
 * the whole tree again", which re-delivers \`id:"root"\` and is exactly the \`sid:root\` failure being
 * corrected. Each member is reproduced individually against the real loop (\`produce-loop.test.ts\`), and so
 * is the SEQUENCE that makes the feedback self-defeating rather than merely uninformative: a resumed quiz
 * surface driven \`main:root\` → \`main:root-missing\` → \`main:root\`, each round a REASONABLE reading of the
 * prior feedback, dying on the round bound — the reported symptom. The seeding itself
 * (\`sessionSurfaceSeeds\`, TKT-0081) is intact and correct; what was missing is the repair instruction, so
 * a per-member static sentence is appended (deduped, once per member that actually fired this round — the
 * PARSE_HINT shape, not a dynamic catalog lookup: an id-graph failure carries no catalog property to
 * resolve).
 *
 * A long-lived game surface CAN force this (never must — it is contingent on the tree SHAPE the model
 * chose): appending a node under a container patches that container harmlessly, and only a node appended
 * under \`root\` itself forces the resend. That is exactly the prophylaxis grammar.md:86-88 already teaches
 * ("give root one stable wrapper child up front"), which is why a model that ignores it can strand a whole
 * turn — and why the escape hatch below has to be taught somewhere the model actually reads.
 */
const IDGRAPH_HINTS = {
  // Review F1: the re-create branch leads. \`sid:root\` fires only because the payload CONTAINED \`id:"root"\`
  // — the model was trying to change root — so opening with "send only what changed, without root" invites
  // a compliant round that ships the new node UNPARENTED. \`checkIdGraph\` has no orphan/reachability check
  // (validate.ts: root count, dangling refs, cycle — nothing else), so an unreferenced component VALIDATES,
  // streams, and is buffered by tree.ts without ever mounting: a loud halt traded for a silent
  // under-render. The conditional arm is stated second, with the orphan trap named explicitly.
  duplicateRoot:
    ' The surface already received its ONE \`id:"root"\` in an EARLIER turn, and re-sending it is rejected ' +
    "(the old root is kept, your change is dropped). If the root's OWN children must change — you are " +
    'adding or removing a node directly under \`root\` — you CANNOT patch root: re-create the surface ' +
    '(\`createSurface\` with the SAME surfaceId) and send the COMPLETE tree, \`root\` included, in that same ' +
    "turn. If root's children did NOT need to change, instead send only the components that actually " +
    'changed, WITHOUT \`id:"root"\` — but every component you send must be reachable from \`root\` through ' +
    'some parent\\'s "children"/"child", or it will silently never render.',
  // ADR-0187 / GH #829 — the sentence extending this member to the ABANDONED-surface case the finalize
  // signal newly catches (LLD §5's disjunctive repair, additive PROSE on the existing key — no new hint
  // entry: the model is being told the same fact, "this surface has no root", and the two repairs read
  // better as one member's disjunction than as a second sentence competing with it in the same round).
  // Named last, deliberately: the two arms above are the RESUMED-surface readings, this one is the
  // "you opened a surface you then never used" reading.
  rootMissing:
    ' This surface\\'s component set has NO \`id:"root"\`. A payload that creates or re-creates a surface ' +
    'starts it EMPTY, so it must deliver \`root\` AND every component the tree references in that same ' +
    'turn. If instead you meant to update a surface that already exists, drop the \`createSurface\` line ' +
    'and send only the changed components. If you sent a \`createSurface\` you never delivered ANY ' +
    'components for, that surface would render as a permanently blank card: either deliver \`root\` for ' +
    'it in this same turn, or drop that unused \`createSurface\` line entirely.',
  dangling:
    ' A \`parent->child\` id-graph path means that \`parent\` lists a child id that NO component defines — ' +
    'neither in this payload nor in any earlier turn of this conversation. Deliver a component with ' +
    'that exact id in this same payload, or remove the reference from the parent\\'s children.',
  cycle: ' The child/children references form a CYCLE — a component cannot be its own ancestor.',
} as const

/**
 * GH #307 — which \`IDGRAPH\` member(s) fired this round, read off the failure \`path\` the validator produced
 * (\`checkIdGraph\`, renderer/validate.ts). Dangling is decided FIRST, on the \`->\` that only IT carries
 * (\`parent->child\`): both halves of that path are MODEL-authored ids, so a child id ending in \`:cycle\` or
 * \`:root-missing\` would be misread by a suffix-first order (review F5). The three surface-level suffixes
 * are then matched only on a \`->\`-free path. One ambiguity is inherent to the path ENCODING and left
 * unresolved: a surfaceId that itself contains \`->\` reads as dangling. Both misreads degrade to unhelpful
 * prose in a model-facing sentence, never to a wrong verdict — the verdict is the validator's.
 * Returns \`''\` when no IDGRAPH failure fired.
 */
function idgraphHint(failures: RoundFailure[]): string {
  const members = new Set<keyof typeof IDGRAPH_HINTS>()
  for (const f of failures) {
    if (f.code !== 'IDGRAPH') continue
    if (f.path.includes('->')) members.add('dangling')
    else if (f.path.endsWith(':root-missing')) members.add('rootMissing')
    else if (f.path.endsWith(':cycle')) members.add('cycle')
    else if (f.path.endsWith(':root')) members.add('duplicateRoot')
  }
  // A stable order (declaration order), so the same round always composes the same sentence.
  return (Object.keys(IDGRAPH_HINTS) as (keyof typeof IDGRAPH_HINTS)[])
    .filter((m) => members.has(m))
    .map((m) => IDGRAPH_HINTS[m])
    .join('')
}

function messagesFor(
  input: TurnInput,
  failures: RoundFailure[] | undefined,
  lastRaw: string | undefined,
  catalog: Catalog,
  lastOutput: A2uiOutput | undefined,
): Turn[] {
  const turns: Turn[] = [...input.session.turns, { role: 'user', content: userContent(input) }]
  if (failures && failures.length > 0 && lastRaw !== undefined) {
    turns.push({ role: 'assistant', content: lastRaw })
    const summary = failures
      .map((f) => \`\${f.code}\${f.path ? \` at \${f.path}\` : ''}\${expectedTypeNote(f, catalog, lastOutput)}\`)
      .join('; ')
    const hint = (failures.some((f) => f.code === 'PARSE') ? PARSE_HINT : '') + idgraphHint(failures)
    turns.push({
      role: 'user',
      content: \`That output was INVALID (\${summary}).\${hint} Re-emit the COMPLETE corrected A2UI JSONL — nothing else. Your leading meta-line "note" must still address the USER in persona — never mention this correction, the re-emission, validation, or JSONL.\`,
    })
  }
  return turns
}

/** Find a component by \`id\` across every \`updateComponents\` message in one round's parsed output —
 *  \`createSurface\` messages never carry components (protocol.ts), so only that arm is searched. */
function findComponentById(id: string, output: A2uiOutput): A2uiComponent | undefined {
  for (const msg of output) {
    if ('updateComponents' in msg) {
      const found = msg.updateComponents.components.find((c) => c.id === id)
      if (found) return found
    }
  }
  return undefined
}

/** GH #288 — resolve a \`CATALOG\` failure's expected type/enum, or \`''\` when unresolvable (see
 *  \`messagesFor\`'s doc comment for every degrade case). Only \`CATALOG\` failures carry a catalog-declared
 *  property to describe; every other failure code (\`PARSE\`/\`SCHEMA\`/\`FEED_SCOPE\`/…) degrades to \`''\`.
 *
 * GH #397 — a sibling degrade branch to #288's own: a \`component.propName\` path where the COMPONENT is
 * known but the PROPERTY is not (the model guessed a prop the catalog never declared on that type — e.g.
 * \`gap\` on \`CardContent\`, a property \`Row\`/\`Column\` DO declare, ADR-0102 Lane A/B asymmetry) used to
 * degrade to the same bare "CATALOG at path" wording as the genuinely-unresolvable unknown-component-type
 * case, teaching nothing about what IS valid there. It now names the component's actual declared property
 * set, so a repeated wrong guess off a sibling component's shape has a concrete alternative to act on.
 */
function expectedTypeNote(failure: RoundFailure, catalog: Catalog, lastOutput: A2uiOutput | undefined): string {
  if (failure.code !== 'CATALOG' || lastOutput === undefined) return ''
  const dot = failure.path.lastIndexOf('.')
  if (dot === -1) return '' // no property segment (e.g. an unknown-component-type failure)
  const componentId = failure.path.slice(0, dot)
  const propName = failure.path.slice(dot + 1)
  const component = findComponentById(componentId, lastOutput)
  if (!component) return ''
  const def = catalog.components[component.component]
  if (!def) return '' // component type itself unresolvable — nothing declared to describe
  const pd = def.properties[propName]
  if (pd) return \` (expected: \${describePropType(pd)})\`
  // Unknown property: the component type IS known, so its actual declared property set is a real,
  // resolvable constraint — name it instead of degrading silently (GH #397).
  const validProps = Object.keys(def.properties)
  return validProps.length > 0
    ? \` (\${component.component} has no "\${propName}" property; valid properties: \${validProps.join(', ')})\`
    : \` (\${component.component} has no declared properties)\`
}

/** Strip a single wrapping markdown code fence (\`\`\`json … \`\`\`), if the model added one despite the
 * prompt. The inner text is the JSONL the model actually emitted. */
function stripOuterFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/^\`\`\`(?:json|jsonl)?\\s*\\n?([\\s\\S]*?)\\n?\`\`\`$/)
  return (m ? m[1]! : t).trim()
}

/**
 * The model emits JSONL (one A2UI message per line), NOT a single JSON value — so heal PER LINE (the
 * shared healer's designed per-line mode, ADR-0061) and flatten. Returns the assembled \`A2uiOutput\` plus
 * how many lines the healer actually corrected (ADR-0088 §2 \`TurnTrace.healed\`), or \`undefined\` if any
 * line is unparseable (mapped by the caller to a PARSE failure fed back).
 *
 * \`healedCount\` counts a line only when \`heal()\` applied a REAL form repair (fence-strip,
 * trailing-comma, version-fill) — NOT merely \`healed.changed\`. Per-line \`heal()\` always reports the
 * mechanical \`'single-object-envelope'\` repair (each line is a lone object, never an array — ADR-0061's
 * arm (c) fires on every call in this mode), so treating bare \`changed\` as "corrected" would make the
 * trace's healed count saturate to \`lines.length\` on every well-formed turn, defeating its purpose.
 */
function assembleFromRaw(raw: string): { output: A2uiOutput; healedCount: number } | undefined {
  const lines = stripOuterFence(raw)
    .split('\\n')
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
 * NON-EMPTY line (same empty-line-skip idiom \`assembleFromRaw\` uses below), not strictly \`raw\`'s literal
 * first line — a stray leading blank line (a common model artifact) must not silently defeat the peel;
 * "emitted FIRST" (ADR-0088 §1) reads as the first content line under any reasonable reading. When that
 * candidate is not a meta-line (a model that never opts into the convention, or any existing stub, or an
 * all-blank raw), \`note\`/\`ask\` are \`undefined\` and \`rest\` is \`raw\` UNCHANGED — zero blast radius on every
 * caller that doesn't emit the wrapper, and this is a no-op for the well-formed (no leading blank) case.
 * \`ask\` (ADR-0097 §1) is the model-authored feed-ask declaration, peeled alongside \`note\` — its integrity
 * (does a payload line actually create it? does it collide with a session-known surface?) is checked by
 * the caller AFTER heal/validate, never here (this is peel-only, symmetric with \`note\`'s own treatment).
 * \`plan\` (ADR-0174 cl.2 / SPEC-R20) is peeled alongside \`note\`/\`ask\` — it carries NO integrity check
 * (Scope, ADR-0174 Open fork OF1): the caller passes it through to the outgoing meta-line UNCHANGED,
 * exactly as declared, whenever present.
 * \`personaPatch\` (ADR-0178 cl.1 / SPEC-R29) is peeled the same way and on the same terms as \`plan\` — no
 * integrity check, passed through unchanged — and, per SPEC-R29's gate-blind rule, WITHOUT consulting
 * \`opts.authoringSurface\`: the gate governs consumption and teaching, never framing.
 */
function peelMetaLine(raw: string): {
  note: string | undefined
  ask: AskDeclaration | undefined
  plan: PlanDeclaration | undefined
  personaPatch: PersonaPatch | undefined
  rest: string
} {
  const lines = raw.split('\\n')
  const idx = lines.findIndex((l) => l.trim().length > 0) // first NON-EMPTY line
  if (idx === -1) return { note: undefined, ask: undefined, plan: undefined, personaPatch: undefined, rest: raw } // all-blank raw — nothing to peel
  const meta = readMetaLine(lines[idx]!.trim())
  if (meta === undefined) return { note: undefined, ask: undefined, plan: undefined, personaPatch: undefined, rest: raw }
  return {
    note: meta.a2uiMeta.note,
    ask: meta.a2uiMeta.ask,
    plan: meta.a2uiMeta.plan,
    personaPatch: meta.a2uiMeta.personaPatch,
    rest: lines.slice(idx + 1).join('\\n'),
  }
}

/** genui-surface SPEC-R1: which produce-layer-only failure code names a rejected genui candidate —
 *  \`'GENUI_SIZE'\` when the shape is otherwise well-formed but \`html\` is over the SPEC-R2 byte cap,
 *  \`'GENUI_ENVELOPE'\` for every other structural defect (malformed JSON, a non-object \`genui\`, a missing/
 *  empty \`surfaceId\`, a non-string \`html\`, a \`version\`/\`a2uiMeta\` key present). Neither code joins the
 *  protocol's closed \`ErrorCode\` union (the FEED_SCOPE precedent, ADR-0097 §3) — both are carried on
 *  \`TurnTrace.failureCodes\` only. */
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

/** One round's genui peel result (SPEC-R1/R2). \`rest\` is \`afterMeta\` with every genui-shaped candidate
 *  line stripped OUT — the text that continues on to \`heal\`/\`validateA2ui\`, so a genui line (valid or not)
 *  NEVER reaches the shared validator (the meta-line peel precedent, extended to this kind). */
interface GenuiPeelResult {
  /** The accepted candidate line, verbatim as the model authored it (SPEC-R1 AC2's "ships intact") —
   *  \`undefined\` when no candidate validated this round. */
  line: string | undefined
  /** A produce-layer round failure, when a genui-shaped candidate existed but failed structural validation. */
  failure: RoundFailure | undefined
  /** \`true\` iff MORE than one genui-shaped candidate line appeared this round (GENUI_MULTIPLICITY) — the
   *  turn MUST carry at most one; extras are dropped + counted, never fed back for correction. */
  multiplicity: boolean
  rest: string
}

/** Peel every genui-shaped candidate line (SPEC-R1: "a line carrying the \`genui\` key") out of \`afterMeta\`
 *  — the text remaining AFTER the leading meta-line was already peeled, BEFORE \`heal\`/\`validateA2ui\` ever
 *  see it. Detection (\`isGenuiCandidate\`) is deliberately cheaper than full validation (\`readGenuiLine\`):
 *  a candidate that merely carries the reserved key but fails full validation must STILL be pulled out of
 *  the A2UI stream (never partially honored, never fed to the healer, which doesn't know this kind exists)
 *  — it just rejects whole (SPEC-R1) instead of shipping. Only the FIRST candidate is ever considered for
 *  acceptance; every subsequent one is dropped and counted as \`multiplicity\`, regardless of its own
 *  validity (SPEC-R1: "AT MOST ONE genui line; subsequent ones... dropped + counted"). */
function peelGenuiLines(afterMeta: string): GenuiPeelResult {
  const lines = afterMeta.split('\\n')
  const candidateIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim()
    if (trimmed.length > 0 && isGenuiCandidate(trimmed)) candidateIdxs.push(i)
  }
  if (candidateIdxs.length === 0) return { line: undefined, failure: undefined, multiplicity: false, rest: afterMeta }

  const firstLine = lines[candidateIdxs[0]!]!.trim()
  const envelope = readGenuiLine(firstLine)
  const rest = lines.filter((_, i) => !candidateIdxs.includes(i)).join('\\n')
  return {
    line: envelope !== undefined ? firstLine : undefined,
    failure: envelope !== undefined ? undefined : { code: genuiFailureCode(firstLine), path: '' },
    multiplicity: candidateIdxs.length > 1,
    rest,
  }
}

/** Serialize the outgoing meta-line (ADR-0088 §1/§2, ADR-0097 §1, ADR-0174 cl.2 / SPEC-R20, ADR-0178
 * cl.1 / SPEC-R29) — the
 * runtime-composed envelope, carrying the model's own \`note\`, the \`ask\` declaration ONLY when it has
 * passed integrity (\`undefined\` otherwise — JSON.stringify then omits the key entirely, so a note-only
 * turn's wire shape is byte-identical to before ADR-0097), the model's own \`plan\` declaration THROUGH
 * UNCHANGED when present (\`undefined\` when absent — JSON.stringify omits the key entirely, so a plan-less
 * turn's wire shape stays byte-identical to before this field existed; no runtime rewriting, no integrity
 * check — SPEC-R20 Scope), the model's own \`personaPatch\` on the SAME terms as \`plan\` (through unchanged
 * when present, key omitted entirely when absent, and GATE-BLIND — SPEC-R29's rule: the SPEC-R30 gate
 * governs consumption and teaching, never framing), plus the \`TurnTrace\` \`produce()\` assembled for this
 * turn (never the model's raw wrapper verbatim — the model never has \`trace\`). */
function formatMetaLine(
  note: string | undefined,
  trace: TurnTrace,
  ask: AskDeclaration | undefined,
  plan: PlanDeclaration | undefined,
  personaPatch: PersonaPatch | undefined,
): string {
  return JSON.stringify({ a2uiMeta: { note, ask, plan, personaPatch, trace } })
}

/**
 * Every \`createSurface\` id the SESSION already knows about, scanned from prior ASSISTANT turns' emitted
 * A2UI content (\`appendAssistantTurn\` stores exactly the validated JSONL a turn shipped, meta-line already
 * excluded — \`session.ts\`/\`a2ui-live.ts\`). Used ONLY for the ADR-0097 §1 ask-integrity collision guard: an
 * \`ask\` declaring a surfaceId the agent already created in an EARLIER turn of THIS session is a collision
 * (a stale/reused id), not a fresh ask — dropped, never a halt. A malformed/non-JSON turn line (e.g. a
 * framed user turn, which never lands in this scan since only \`assistant\`-role turns are inspected) is
 * skipped rather than thrown.
 */
function sessionKnownSurfaceIds(session: Session): Set<string> {
  const ids = new Set<string>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\\n')) {
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
 * ADR-0097 §1 ask integrity: \`true\` iff SOME message in this round's validated \`output\` actually creates
 * \`ask.surfaceId\` (a \`createSurface\` for it), AND that id does not collide with a surface the session
 * already knows about (\`sessionKnownSurfaceIds\`, prior turns only — this round's own fresh creation is
 * exactly what the first check requires, so a same-round create is never mistaken for a collision).
 */
/** The surfaceId a server message names, or \`undefined\` for the function-call RPC arm (whose id is the
 *  top-level \`functionCallId\`, not a surface). Used ONLY by the GH #1064 whole-degrade suppression below. */
function messageSurfaceId(msg: A2uiServerMessage): string | undefined {
  if ('createSurface' in msg) return msg.createSurface.surfaceId
  if ('updateComponents' in msg) return msg.updateComponents.surfaceId
  if ('updateDataModel' in msg) return msg.updateDataModel.surfaceId
  if ('deleteSurface' in msg) return msg.deleteSurface.surfaceId
  if ('actionResponse' in msg) return msg.actionResponse.surfaceId
  return undefined
}

function askIntegrityHolds(ask: AskDeclaration, output: A2uiOutput, session: Session): boolean {
  const created = output.some((m) => 'createSurface' in m && m.createSurface.surfaceId === ask.surfaceId)
  if (!created) return false
  return !sessionKnownSurfaceIds(session).has(ask.surfaceId)
}

/**
 * ADR-0097 §3 / SPEC-R15 FEED_SCOPE gate: every \`updateComponents\` targeting the ask-routed surface must
 * host ONLY \`FEED_SURFACE_TYPES\` members. Runs AFTER the shared validator passes (never a fork of
 * \`validateA2ui\` — SPEC-N3) — this is a produce-layer POLICY check over an already-protocol-valid payload.
 * Returns one \`RoundFailure\` per offending component (deduplicated by type so a repeated out-of-scope type
 * doesn't inflate the fed-back message), each \`path\` naming both the ask surface and the offending type so
 * the self-correct prompt (\`messagesFor\`) genuinely surfaces "FEED_SCOPE" + the type, per the ADR's own
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
  return [...offendingTypes].map((type) => ({ code: 'FEED_SCOPE', path: \`\${ask.surfaceId}:\${type}\` }))
}

/**
 * TKT-0081 — the cross-turn validation seed: replay the session's prior ASSISTANT turns (validated JSONL,
 * exactly what \`appendAssistantTurn\` stored) into a per-surface \`SurfaceSeed\` for \`validateA2ui\`. Without
 * it the per-round validator is session-blind and structurally CONTRADICTS the renderer on follow-up
 * turns: an update-only payload (no \`root\`) fails \`root-missing\`/dangling standalone, while re-sending
 * \`root\` passes standalone but fails the renderer's cross-turn ADR-0128 IDGRAPH guard — live models
 * resolved the trap by shipping full trees and eating a client-error round per move (the Croupier game
 * loop, measured). Seeded, the validator judges the MERGED graph the renderer will actually hold:
 * update-only follow-ups validate; a root-resend fails HERE (\`sid:root\`) as a pre-wire self-correct
 * round. A prior \`deleteSurface\` drops that surface's seed (a later re-create starts fresh), and so does a
 * prior \`createSurface\` — see below.
 *
 * GH #307 review F2 — a prior-turn \`createSurface\` RESETS that surfaceId's seed, exactly as \`deleteSurface\`
 * does. The renderer's re-create is a teardown-and-rebuild, not a merge (\`renderer.ts\` drops the prior
 * root's DOM, mints a FRESH surface in the store and a FRESH \`SurfaceTree\`), so every component delivered
 * before the re-create is gone from the live surface. Replaying those into the seed anyway left GHOST ids
 * that resolve dangling refs the renderer would then render as nothing — the seed claiming a richer graph
 * than the renderer holds, which is precisely the drift this seed exists to prevent, only in the permissive
 * direction. The reset is order-sensitive within a turn: the SAME turn's later \`updateComponents\` rebuild
 * the seed on top of the cleared surface, which is what a legitimate re-create + full-tree resend does —
 * and that resend is the escape hatch \`IDGRAPH_HINTS.duplicateRoot\` now teaches, so this path went from
 * rare to routine.
 */
function sessionSurfaceSeeds(session: Session): Map<string, SurfaceSeed> {
  const seeds = new Map<string, { components: A2uiComponent[]; byId: Map<string, A2uiComponent>; rootDelivered: boolean }>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\\n')) {
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
        if (msg.createSurface?.surfaceId !== undefined) {
          seeds.delete(msg.createSurface.surfaceId) // teardown-and-rebuild, not a merge (F2)
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
  const query = queryOf(input, k, deps.catalog.catalogId) // ADR-0169 cl.4 — catalog-aware, not the old pinned literal
  const exemplars = deps.retrieve(query) // SPEC-R7 — top-k over the judged shard
  const miniSkills = selectMiniSkills(query.intent, MINI_SKILLS, opts.miniSkillCap ?? DEFAULT_MINI_SKILL_CAP, deps.catalog.catalogId) // ADR-0091 §2 — once per turn, beside retrieve(); ADR-0135 cl.7 — cap now tunable, absent ⇒ default; SPEC-R6 — catalogId-scoped, the SAME value line :762's queryOf already threads into retrieve's own query
  const system = buildSystemPrompt(deps.catalog, exemplars, opts.mode, miniSkills, opts.personaSystem, opts.genuiSurface, opts.a2uiEnabled, opts.authoringSurface, opts.builderMission) // SPEC-R6 — catalog-derived; ADR-0090 mode + ADR-0091 mini-skills + ADR-0138 persona + genui-surface SPEC-R10 + GH #418 a2uiEnabled + SPEC-R30 authoring gate + SPEC-R31 builder-mission gate
  const model = opts.model ?? input.model ?? DEFAULT_MODEL // opts.model = the proxy's allowlist-validated model (SPEC-R12); it WINS over a client-supplied input.model
  // ADR-0088 §2 — data ALREADY flowing above, captured once for the eventual TurnTrace (no new collection).
  // NOTE: this is a \`session.turns\` MESSAGE index (the alternating Messages-API array, user+assistant per
  // exchange), NOT a dense turn ordinal — it is even-valued and advances by 2 per real conversational turn
  // (0, 2, 4, ...). A caller holding a \`traces[]\` array must correlate by ARRAY POSITION, never assume
  // \`traces[i].turnIndex === i\` or treat this field as \`traces.length\`-equivalent.
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
  // \`TurnProgress.source\` ONLY under the explicit 'source' member (fail-closed: the 'stages' default AND
  // 'full' both attach nothing — the reasoning and source disclosures are independent opt-ins).
  const attachSource = emitProgress && progressDetail === 'source'
  let failures: RoundFailure[] | undefined
  let lastRaw: string | undefined
  let lastOutput: A2uiOutput | undefined // GH #288 — the prior round's OWN parsed output, so a self-correct round's feedback can resolve "expected type" per failing path (messagesFor/expectedTypeNote)
  let lastCandidate: string | undefined // the previous round's peeled candidate wire text — the \`retry\` stage's source
  let genuiMultiplicityHit = false // genui-surface SPEC-R1: sticky across rounds — a factual "this happened at least once" tally, never reset
  for (let round = 0; round < opts.maxRounds; round++) {
    const failuresFedBack = failures // what THIS round's prompt carried back — the trace's failureCodes
    // ADR-0146 F1 — the lifecycle stages, yielded AS THEY HAPPEN, strictly BEFORE any content line (content
    // still streams only after full validation, SPEC-R5). A self-correct round announces \`retry\` with the
    // attempt ordinal first, then \`sent\` before the provider request. All gated on the \`progress\` opt-in.
    // GH #240 — under 'source', \`retry\` carries the FAILED round's candidate JSONL (the invalid attempt the
    // feedback loop is correcting — data that otherwise never crosses the wire at all), capped.
    if (emitProgress && round > 0 && failures !== undefined)
      yield formatProgressLine({
        stage: 'retry',
        round: round + 1,
        ...(attachSource && lastCandidate !== undefined && lastCandidate !== '' ? { source: capSource(lastCandidate) } : {}),
      })
    if (emitProgress) yield formatProgressLine({ stage: 'sent' })

    let raw = ''
    // Provider events are pushed onto a channel by the onEvent callback (it cannot yield from this
    // generator itself). GH #290 fix: delivery is driven by \`interleaveProgress\` below, which races the
    // channel's next push against the provider's next fragment — \`started\` on the provider's first
    // signal, \`reasoning\` on a thinking delta (text-free at 'stages', a bounded excerpt at 'full'), and
    // \`tool\` on each GH #49 tool call, ALL surfacing the instant they're pushed, tool-round or not. When
    // progress is OFF, no callback is installed (byte-identical accumulation) and the plain for-await runs.
    const channel = createProgressChannel()
    let sawStarted = false
    let sawReasoning = false
    let sawContent = false
    const onEvent = emitProgress
      ? (ev: ProviderEvent): void => {
          if (!sawStarted && (ev.kind === 'message_start' || ev.kind === 'block_start')) {
            sawStarted = true
            channel.push({ stage: 'started' })
          } else if (ev.kind === 'thinking') {
            if (progressDetail === 'full') channel.push({ stage: 'reasoning', ...(ev.text ? { detail: ev.text.slice(0, REASONING_EXCERPT_CAP) } : {}) })
            else if (!sawReasoning) {
              sawReasoning = true
              channel.push({ stage: 'reasoning' }) // transition only — NO thinking text on the wire (F3 default)
            }
          }
          else if (ev.kind === 'tool') {
            // GH #49 — the adapter is executing a registry tool: a factual process claim (the tool NAME
            // from the closed registry, never model prose — the F2 discipline the 'tool' stage's
            // TURN_PROGRESS_STAGES note records).
            channel.push({ stage: 'tool', ...(ev.text ? { detail: ev.text } : {}) })
          }
          // block_stop/done provider events are NOT mapped to a stage — produce() is the pinned emitter of
          // \`content\`/\`validating\`/\`done\`, owning those transitions itself (F1).
        }
      : undefined
    const providerStream = deps.provider.stream({
      model,
      system,
      messages: messagesFor(input, failures, lastRaw, deps.catalog, lastOutput),
      effort: opts.effort,
      onEvent,
      // GH #49 — relayed verbatim; the adapter owns the tool loop. Its TEXT stays buffered for the whole
      // round (intentional — GH #290's fix is scoped to PROGRESS delivery only), but its onEvent 'tool'
      // pushes now reach the client in real time via interleaveProgress below, not just at round-end.
      tools: opts.tools,
      executeTool: opts.executeTool,
      signal: opts.signal,
    })
    if (emitProgress) {
      for await (const item of interleaveProgress(providerStream, channel)) {
        if (item.kind === 'progress') {
          yield formatProgressLine(item.ev)
          continue
        }
        // \`content\` is produce()'s ONE pinned emission on the round's OWN first text fragment (F1).
        if (!sawContent && item.text.length > 0) {
          sawContent = true
          yield formatProgressLine({ stage: 'content' })
        }
        raw += item.text
      }
    } else {
      for await (const frag of providerStream) raw += frag
    }
    lastRaw = raw

    const { note, ask, plan, personaPatch, rest: afterMeta } = peelMetaLine(raw) // ADR-0088 §1 / ADR-0097 §1 / ADR-0174 cl.2 / ADR-0178 cl.1 — peeled BEFORE heal/validate
    // genui-surface SPEC-R1 — peeled SECOND, still BEFORE heal/validate: a genui line (valid or not) never
    // reaches the shared A2UI healer/validator, which doesn't know this kind exists. Recomputed FRESH every
    // round (never carried over): a round's genui candidate belongs to THAT round's own raw output, never
    // paired with a later, differently-corrected A2UI payload. \`multiplicity\` is the one exception — a
    // factual sticky tally across the whole turn (SPEC-R1: "dropped + counted").
    const genuiPeel = peelGenuiLines(afterMeta)
    const rest = genuiPeel.rest
    if (genuiPeel.multiplicity) genuiMultiplicityHit = true
    const genuiLine = genuiPeel.line
    const restLines = stripOuterFence(rest)
      .split('\\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    // GH #240/ADR-0159 wave B — this round's candidate wire text: the peeled, fence-stripped JSONL entering
    // heal/validate (createSurface/updateDataModel/updateComponents lines — never the meta-line note, which
    // \`peelMetaLine\` already removed). Remembered across rounds for the \`retry\` attachment above. The peel
    // moved ABOVE the \`validating\` yield so the event can carry its own source — the stage's timing contract
    // ("AFTER accumulation, BEFORE assemble/validate") is unchanged: peel is pure string prep, not validation.
    const candidate = restLines.join('\\n')
    lastCandidate = candidate
    if (emitProgress)
      yield formatProgressLine({
        stage: 'validating',
        ...(attachSource && candidate !== '' ? { source: capSource(candidate) } : {}),
      }) // AFTER accumulation, BEFORE assemble/validate

    // A note-only turn (ADR-0088 Consequences) OR a genui-only turn (genui-surface SPEC-R1 — a genui
    // line MAY ship with zero A2UI shape-changes): zero A2UI lines is a CLEAN success whenever there is a
    // note AND/OR a valid genui line to ship — nothing to validate, so nothing to self-correct. Must NOT
    // halt-and-report (empty ≠ invalid). ADR-0097 §1: a declared \`ask\` here is trivially integrity-invalid
    // too (no payload creates ANYTHING) — dropped, never even reaching \`askIntegrityHolds\`.
    if (restLines.length === 0 && (note !== undefined || genuiLine !== undefined)) {
      const failureCodes = (failuresFedBack ?? []).map((f) => f.code)
      if (genuiMultiplicityHit) failureCodes.push('GENUI_MULTIPLICITY') // SPEC-R1 — a factual tally, never a retry trigger
      // SPEC-N4/SPEC-R1 — a genui structural failure on THIS shipping round is dropped from the wire
      // (never blocks a clean note-only/genui-only success), but its failure code MUST still land on the
      // trace — SPEC-N4's "every drop path increments an observable counter" applies to this drop too,
      // not only to the retried case already covered by \`failuresFedBack\` above.
      if (genuiPeel.failure !== undefined) failureCodes.push(genuiPeel.failure.code)
      if (emitProgress) yield formatProgressLine({ stage: 'done' }) // before the final (note-only/genui-only) yield
      if (note !== undefined) yield formatMetaLine(note, traceFor(round + 1, 0, failureCodes), undefined, plan, personaPatch)
      if (genuiLine !== undefined) yield genuiLine // SPEC-R1 AC2 — ships intact, the model's own line verbatim
      return
    }

    const assembled = assembleFromRaw(rest)
    if (assembled === undefined) {
      lastOutput = undefined // GH #288 — no parsed output this round; nothing for the next round's feedback to resolve against
      // genui-surface SPEC-R1 — a genui structural failure MAY hitch a ride on the SAME retry an A2UI
      // parse failure already needs (never an EXTRA round manufactured purely for genui's sake — see the
      // \`verdict.valid\` branch below for the fuller reasoning).
      failures = genuiPeel.failure !== undefined ? [{ code: 'PARSE', path: '' }, genuiPeel.failure] : [{ code: 'PARSE', path: '' }]
      continue
    }
    lastOutput = assembled.output // GH #288 — this round's parsed output, kept for the NEXT round's self-correct feedback (expectedTypeNote)
    stampCreateSurfaceCatalogId(assembled.output, deps.catalog.catalogId) // ADR-0169 cl.4 — the server-selected catalog is authoritative, unconditional + idempotent, BEFORE validateA2ui runs
    // SPEC-N3 — the shared validator, no fork; TKT-0081 — seeded with the session's prior graphs so the
    // per-round judgment matches the MERGED state the renderer will hold (update-only follow-ups valid;
    // a cross-turn root-resend fails pre-wire as \`sid:root\`, a self-correct round).
    //
    // ADR-0187 / GH #829 — the SERVER half of the finalize signal, and the one call site where the
    // assertion is unarguable: \`assembled.output\` IS this turn's FINAL wire payload. The model has
    // stopped; validate-then-stream (live-agent SPEC-R5) means nothing more will be added to this round
    // before it ships. So a \`createSurface\` here with no components is not a mid-stream prefix — it is an
    // abandoned surface that would mount a permanently-empty \`ui-surface-host\` (GH #802). At
    // \`atFinalize: true\` it fails \`\${sid}:root-missing\` PRE-WIRE and becomes an ordinary self-correct
    // round (SPEC-R4), fed back with \`IDGRAPH_HINTS.rootMissing\`'s repair instruction — never a browser.
    const verdict = validateA2ui(assembled.output, deps.catalog, sessionSeeds, { atFinalize: true })
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
      // GH #1064 — the degrade must be WHOLE. ADR-0097 §1's ruling is "the turn degrades to ADR-0089's
      // prose ask", and a prose ask has NO structured surface: shipping the dropped ask's own payload
      // anyway (the pre-#1064 behavior) rendered a clickable card whose routing fact this very branch had
      // just stripped — the client (agent-admin's \`#resumeTargetFor\`) then had no ask on record for it and
      // could only same-bubble-resume the click, the reported "Next does nothing" strand. Worse, a REUSED
      // ask id's lines route into the ORIGINAL bubble client-side (ADR-0129 cl.2's known-surface routing),
      // repainting the answered card in place. So every message NAMING the dropped ask's surfaceId is
      // suppressed with the ask (validation already ran on the FULL output above; messages for any other
      // surface ship untouched — an ask naming an id the payload never mentions suppresses nothing).
      const shippedOutput =
        ask !== undefined && finalAsk === undefined
          ? assembled.output.filter((m) => messageSurfaceId(m) !== ask.surfaceId)
          : assembled.output
      if (emitProgress) yield formatProgressLine({ stage: 'done' }) // ADR-0146 F1 — before the final content yield; still a meta-line, never content
      // GH #1064 (closing ADR-0097's post-ship review finding 4): the meta-line ships whenever it has a
      // note OR a surviving ask to carry — a note-less ask is no longer silently discarded by the note
      // coupling (\`formatMetaLine\` simply omits the absent \`note\` key; the wire reader, \`readMetaLine\`,
      // has always treated every envelope field as optional).
      if (note !== undefined || finalAsk !== undefined) {
        const failureCodes = (failuresFedBack ?? []).map((f) => f.code)
        if (genuiMultiplicityHit) failureCodes.push('GENUI_MULTIPLICITY')
        // SPEC-N4/SPEC-R1 — see the note-only branch's identical comment: a genui failure dropped on an
        // otherwise-successful round still needs to land on the trace, not just the retried case.
        if (genuiPeel.failure !== undefined) failureCodes.push(genuiPeel.failure.code)
        yield formatMetaLine(note, traceFor(round + 1, assembled.healedCount, failureCodes), finalAsk, plan, personaPatch) // meta-line FIRST
      }
      // genui-surface SPEC-R1 — a genui structural failure on an OTHERWISE-valid A2UI round is DROPPED
      // silently here (never manufactures an extra round purely to fix it: "degrade, never halt" — the
      // turn's note/A2UI lines still ship on schedule). \`genuiLine\` is \`undefined\` in exactly that case.
      if (genuiLine !== undefined) yield genuiLine // SPEC-R1 AC2 — ships intact, alongside the note
      for (const msg of shippedOutput) yield JSON.stringify(msg) // SPEC-R5 — validate-then-stream (nothing invalid ever painted)
      return
    }
    // genui-surface SPEC-R1 — a genui failure hitches a ride on the SAME retry the A2UI validator already
    // needs (never an independent extra round; genui alone can never cause the eventual \`ProduceHalt\`
    // below, since that only fires when the A2UI verdict itself is still invalid at round exhaustion).
    failures = genuiPeel.failure !== undefined ? [...verdict.failures, genuiPeel.failure] : verdict.failures // SPEC-R4 — self-correct: feed the structured failures back
  }
  throw new ProduceHalt(failures ?? [{ code: 'SCHEMA', path: '' }])
}
`,a="// system-prompt.ts — LLD-C4 / SPEC-R6, ADR-0071: the catalog-DERIVED, drift-gated machine system prompt.\n//\n// Three parts (LLD §5): a fixed GRAMMAR (how to emit A2UI JSONL) + the catalog INVENTORY derived at RUN\n// TIME from the passed `Catalog` (the sole component authority — never a hand-listed set) + a few-shot\n// block from the retrieved exemplars. A standing drift test (`prompt-drift.test.ts`) asserts the derived\n// inventory equals the catalog's, so a catalog row added without regeneration FAILS (PRD-G6 coherence).\n// Pure of catalog I/O; the caller loads the catalog. ADR-0135 cl.8/13: the hand-authored GRAMMAR half +\n// the mode-scaled consts now LOAD from `./prompts/*.md` at module load (`readFileSync` +\n// `import.meta.url`) rather than living as inline template literals — editable/diffable as prose, with\n// the byte-identity gate below holding the `'default'`-mode contract ADR-0090 established.\n//\n// The prose each ADR added, and where its text now lives (ADR-0135 cl.14 — the condensed index):\n// · ADR-0071 — the catalog-derived inventory + drift gate (this file, `catalogInventory`/`buildSystemPrompt`).\n// · ADR-0088 §1 — the always-first note/meta-line convention (`prompts/grammar.md`, intro section).\n// · ADR-0089 — clarify-before-acting + catalog-boundary honesty, prose-only, never a license to invent\n//   (`prompts/grammar.md`).\n// · ADR-0090 §1 — the per-turn `GenUiMode` axis: GRAMMAR IS the `'default'`/absent composition (byte-identity\n//   by construction). `INTRO_AND_NOTE`/`OUTPUT_RULES` are SLICED from the loaded grammar; `HONESTY_FLOOR`\n//   (§2, never scaled), `CLARIFY_SPECIFIC`/`NEGOTIATE_SPECIFIC` (dialed DOWN) and `CLARIFY_BLUE_SKY`/\n//   `NEGOTIATE_BLUE_SKY` (dialed UP) are the mode-SCALED block `grammarFor` composes (`prompts/*.md`).\n// · ADR-0091 §3 — the fifth composed segment `miniSkillsBlock`, a twin of `fewShot`, additive + orthogonal\n//   to `mode`, degrades to `''` when empty (registry text lives in `prompts/mini-skills/*.md`).\n// · ADR-0091 §4 fix — the three (★) calibration examples are single-sourced from `MINI_SKILLS[id].body`\n//   (`calibrationExampleBullet`) and `NEGOTIATE_BLUE_SKY`'s bullets are appended from the registry in code;\n//   `miniSkillsFor` filters those ids out of a `'blue-sky'` selection to avoid double-injection.\n// · ADR-0097 §4 — feed-embedded ask mechanics (mode-invariant, in `prompts/grammar.md`) + the mode-scaled\n//   archetype vocabulary (`prompts/ask-archetypes-*.md`); the feed-allowed list is composed FROM\n//   `feed-catalog.ts` via the `{{FEED_SURFACE_TYPES}}` placeholder the loader fills (drift-impossible).\n// · ADR-0103 §Decision cl.4 — the `form-rhythm` mini-skill (`prompts/mini-skills/form-rhythm.md`).\n// · ADR-0178 cl.1/cl.3 (SPEC-R30) — the `personaPatch` arm's mechanics teaching\n//   (`prompts/authoring-teaching.md`), composed by `authoringBlock` ONLY under the persona's authoring\n//   gate; host-owned and byte-pinned like every prompt file here, but conditional, unlike the GRAMMAR text.\n// · ADR-0182 cl.2/cl.3 (SPEC-R31) — the builder-mission drive-to-completion teaching\n//   (`prompts/builder-mission.md`), composed by `missionBlock` ONLY when this turn IS the Builder's own\n//   dedicated interview (`session === 'authoring'`, derived host-side) — a separate gate from\n//   `authoringSurface`, since a persona authoring patches is not the same fact as being the Builder itself.\n// · ADR-0126 (LLD-C1, TKT-0016) — the message-lifecycle decision-layer teaching (the four-type choice rule +\n//   deleteSurface wire shape + whole-record-upsert warning + root-immutability), appended inside the\n//   OUTPUT_RULES zone of `prompts/grammar.md`, so it rides `OUTPUT_RULES` into every mode.\n\nimport { readFileSync } from 'node:fs'\nimport type { Catalog } from '../catalog/catalog.ts'\nimport { describePropType } from '../catalog/catalog.ts'\nimport type { CorpusRecord } from '../corpus/record.ts'\nimport type { GenUiMode } from './gen-ui-mode.ts'\nimport { MINI_SKILLS } from './mini-skills.ts'\nimport type { MiniSkill } from './mini-skills.ts'\nimport { FEED_SURFACE_TYPES } from './feed-catalog.ts'\nimport type { GenuiSurfaceConfig } from './genui-surface-config.ts'\nimport { dogfoodInventory } from './dogfood-inventory.ts'\n\ndeclare const process: { cwd(): string }\n\n// Paths resolve from `process.cwd()` (the repo root `vite`/`vitest` runs from), matching\n// `dev-proxy-plugin.ts`'s own established pattern — NOT `import.meta.url`-relative resolution, which this\n// file used at first and which broke live under `npm run dev` (TKT-0044): Vite bundles `vite.config.ts`\n// (via esbuild, into a `node_modules/.vite-temp/*.mjs` temp file) and that bundling pulls in the WHOLE\n// reachable import graph — `dev-proxy-plugin.ts` imports `produce.ts` imports THIS file — so an\n// `import.meta.url`-relative path resolved against the TEMP file's location, not this file's real source\n// location, and `readFileSync` on a path that only exists under the real source tree threw ENOENT.\nconst PROMPTS_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/agent/prompts`\n\n/** Load one prompt file from `PROMPTS_DIR`. Node-only tooling, never a browser bundle (SPEC-R3/N2).\n *  Trimmed so an authored trailing newline never perturbs byte-identity — every prompt const is\n *  whitespace-edge-free by construction (ADR-0090 §1: by construction, never re-transcription). */\nfunction loadPrompt(file: string): string {\n  return readFileSync(`${PROMPTS_DIR}/${file}`, 'utf8').trim()\n}\n\n// GRAMMAR — the whole hand-authored grammar, loaded from ONE file (ADR-0135 cl.8), never pre-sliced into\n// fragments. The `{{FEED_SURFACE_TYPES}}` placeholder is filled from `feed-catalog.ts` at load, so the\n// composed feed-allowed list is derived FROM the single source (drift-impossible, ADR-0097 §3), exactly\n// as the prior `${FEED_SURFACE_TYPES.join(', ')}` interpolation did — byte-identical result.\nconst GRAMMAR = loadPrompt('grammar.md').replace('{{FEED_SURFACE_TYPES}}', FEED_SURFACE_TYPES.join(', '))\n\n// ---- ADR-0090 §1: the mode-INVARIANT spine, sliced (never retyped) out of the literal GRAMMAR above,\n// so the truly mode-invariant prose (the note-line instruction, the JSONL output rules) has exactly ONE\n// source of truth shared by every mode — including `'default'`, which uses GRAMMAR whole. ----\n\nconst CLARIFY_MARKER = 'Ask instead of guess when the turn is underdetermined'\nconst OUTPUT_MARKER = 'Output rules for the A2UI JSONL'\n\nconst INTRO_AND_NOTE = GRAMMAR.slice(0, GRAMMAR.indexOf(CLARIFY_MARKER)).trim()\nconst OUTPUT_RULES = GRAMMAR.slice(GRAMMAR.indexOf(OUTPUT_MARKER)).trim()\n\n// Marker-sanity guard (independent-review hardening, post-ADR-0090): `String.prototype.indexOf` returns\n// -1 on a marker that stops matching GRAMMAR (e.g. a future edit rewords/removes the sliced-out phrase),\n// and `GRAMMAR.slice(0, -1)` degrades SILENTLY to almost the entire GRAMMAR string rather than throwing —\n// bloating `INTRO_AND_NOTE` with duplicated clarify/catalog-wall prose, with no test currently red. Assert\n// both markers are actually present in GRAMMAR, and that the two derived slices are disjoint (neither\n// contains the other's marker), at MODULE LOAD — so a broken marker fails immediately and loudly instead\n// of shipping a bloated/wrong prompt.\nfunction assertMarkersHold(): void {\n  if (GRAMMAR.indexOf(CLARIFY_MARKER) === -1) {\n    throw new Error(`system-prompt: CLARIFY_MARKER not found in GRAMMAR — \"${CLARIFY_MARKER}\"`)\n  }\n  if (GRAMMAR.indexOf(OUTPUT_MARKER) === -1) {\n    throw new Error(`system-prompt: OUTPUT_MARKER not found in GRAMMAR — \"${OUTPUT_MARKER}\"`)\n  }\n  if (INTRO_AND_NOTE.includes(OUTPUT_MARKER)) {\n    throw new Error('system-prompt: INTRO_AND_NOTE unexpectedly contains OUTPUT_MARKER — the slice is not disjoint')\n  }\n  if (OUTPUT_RULES.includes(CLARIFY_MARKER)) {\n    throw new Error('system-prompt: OUTPUT_RULES unexpectedly contains CLARIFY_MARKER — the slice is not disjoint')\n  }\n}\n\nassertMarkersHold()\n\n// ---- ADR-0090 §2: the honesty floor — mode-INVARIANT, never scaled. Carries the SAME two facts as the\n// ADR-0089 catalog-wall paragraph (never invent, never silently substitute) as a standalone paragraph so\n// every mode gets it identically, without each mode-scaled variant having to restate it. ----\n\nconst HONESTY_FLOOR = loadPrompt('honesty-floor.md')\n\n// ---- ADR-0090 §1: the mode-SCALED block — `specific` (directive, dialed DOWN) and `blue-sky`\n// (exploratory, dialed UP, carrying the dual-direction composition discipline + calibration examples).\n// All loaded from `./prompts/*.md` (ADR-0135 cl.9). ----\n\nconst CLARIFY_SPECIFIC = loadPrompt('clarify-specific.md')\n\nconst NEGOTIATE_SPECIFIC = loadPrompt('negotiate-specific.md')\n\nconst CLARIFY_BLUE_SKY = loadPrompt('clarify-blue-sky.md')\n\n// ADR-0091 §4 fix (independent-review defect): the three (★) calibration examples below are now SOURCED\n// from `MINI_SKILLS` (mini-skills.ts) rather than hardcoded here a second time — the registry entry's\n// `body` IS the bullet text. This closes the drift risk of two hand-maintained copies silently diverging,\n// and the composition-site filter in `buildSystemPrompt` below skips re-injecting these same three ids\n// via `miniSkillsBlock` in `'blue-sky'` mode (they're already present here) — see `BLUE_SKY_CALIBRATION_IDS`.\nconst BLUE_SKY_CALIBRATION_IDS = ['card-game-sheet', 'settings-screen', 'dashboard-kpi-grid'] as const\n\nfunction calibrationExampleBullet(id: string): string {\n  const skill = MINI_SKILLS.find((m) => m.id === id)\n  if (!skill) throw new Error(`system-prompt: missing MINI_SKILLS entry for calibration id \"${id}\"`)\n  return `- ${skill.body}`\n}\n\n// ADR-0135 cl.10: the STATIC prose (through the `Calibration examples (…):` header) loads from\n// `prompts/negotiate-blue-sky.md`; the dynamic calibration bullets — computed from `MINI_SKILLS` via\n// `calibrationExampleBullet` — are appended in code after load (a trailing append, chosen over a mid-file\n// placeholder because the dynamic block is strictly TRAILING today, keeping the `MINI_SKILLS` dependency\n// visible in code). Byte-identical to the prior interpolated literal.\nconst NEGOTIATE_BLUE_SKY = `${loadPrompt('negotiate-blue-sky.md')}\n${BLUE_SKY_CALIBRATION_IDS.map(calibrationExampleBullet).join('\\n')}`\n\n// ---- ADR-0097 §4/§5: the feed-ask archetype vocabulary, mode-SCALED alongside the clarify/negotiate\n// paragraphs above. The mechanics (HOW to emit an ask) are mode-INVARIANT — inlined into the literal\n// GRAMMAR string above, so INTRO_AND_NOTE (sliced from it) carries them into every mode automatically.\n// WHEN/how eagerly to reach for an ask, plus the compact archetype recipes, differ per mode — `'default'`\n// gets ONLY the terse \"balanced\" one-liner inlined into GRAMMAR (above, after the catalog-wall paragraph);\n// `'specific'`/`'blue-sky'` get their OWN disposition + the same five archetype recipes, dialed like their\n// CLARIFY_*/NEGOTIATE_* neighbors. ----\n\nconst ASK_ARCHETYPES_SPECIFIC = loadPrompt('ask-archetypes-specific.md')\n\nconst ASK_ARCHETYPES_BLUE_SKY = loadPrompt('ask-archetypes-blue-sky.md')\n\n/**\n * Compose the hand-authored GRAMMAR half for `mode` (ADR-0090 §1). `'specific'`/`'blue-sky'` compose the\n * invariant spine + their scaled variant; an ABSENT `mode` or `'default'` returns the literal `GRAMMAR`\n * constant UNCHANGED — the byte-identity Decision §1/Acceptance AC1 requires, held by construction (this\n * branch never touches the sliced/rewritten pieces at all).\n */\nfunction grammarFor(mode: GenUiMode | undefined): string {\n  if (mode === 'specific') {\n    return [INTRO_AND_NOTE, CLARIFY_SPECIFIC, NEGOTIATE_SPECIFIC, ASK_ARCHETYPES_SPECIFIC, HONESTY_FLOOR, OUTPUT_RULES].join(\n      '\\n\\n',\n    )\n  }\n  if (mode === 'blue-sky') {\n    return [INTRO_AND_NOTE, CLARIFY_BLUE_SKY, NEGOTIATE_BLUE_SKY, ASK_ARCHETYPES_BLUE_SKY, HONESTY_FLOOR, OUTPUT_RULES].join(\n      '\\n\\n',\n    )\n  }\n  return GRAMMAR // undefined or 'default' — byte-identical to the pre-mode ADR-0089 grammar\n}\n\n// GH #288 (root-caused by #286): each prop line now names its declared type/enum (`describePropType`,\n// catalog.ts — the SAME description `produce.ts`'s self-correct feedback resolves per failing path), not\n// just the prop's bare name. Grounds the model on what SHAPE a value must take (e.g. `variant:\n// h1|h2|h3|h4|h5|caption|body`, `emphasis: boolean`) instead of leaving it to guess-and-check blind — the\n// #286 root cause: the corpus carries zero `Text.emphasis` exemplars, so few-shot alone never compensated.\nfunction catalogInventory(catalog: Catalog): string {\n  const lines: string[] = []\n  for (const id of Object.keys(catalog.components)) {\n    const def = catalog.components[id]!\n    const props = Object.keys(def.properties).map((p) => `${p}: ${describePropType(def.properties[p]!)}`)\n    const child = def.children ? ` · children model: ${def.children}` : ''\n    lines.push(`- ${id} (props: ${props.length > 0 ? props.join(', ') : 'none'}${child})`)\n  }\n  return lines.join('\\n')\n}\n\n// ADR-0169 cl.4 clause 3 — a ONE-LINE conditioned teaching addition to the DERIVED inventory half\n// (never the byte-pinned GRAMMAR text): the byte-pinned grammar example teaches `\"catalogId\":\"agent-ui\"`\n// verbatim, which a compliant model would otherwise copy onto a non-default-catalog turn. Composed ONLY\n// when `catalog.catalogId !== 'agent-ui'` — the default-catalog composition therefore stays BYTE-\n// IDENTICAL (the `prompt-equivalence`/`prompt-drift` baselines never move for the default catalog).\nfunction catalogIdTeaching(catalog: Catalog): string {\n  if (catalog.catalogId === 'agent-ui') return ''\n  return `Every createSurface this turn MUST carry \"catalogId\":\"${catalog.catalogId}\" — the grammar example's \"agent-ui\" is a different catalog's id.\\n\\n`\n}\n\nfunction functionsInventory(catalog: Catalog): string {\n  const ids = Object.keys(catalog.functions)\n  if (ids.length === 0) return '(none)'\n  return ids.map((fn) => `- ${fn} (${catalog.functions[fn]!.callableFrom})`).join('\\n')\n}\n\nfunction fewShot(exemplars: readonly CorpusRecord[]): string {\n  if (exemplars.length === 0) return ''\n  const blocks = exemplars.map((ex) => {\n    const jsonl = (ex.a2uiOutput ?? []).map((m) => JSON.stringify(m)).join('\\n')\n    return `PROMPT: ${ex.promptText}\\nA2UI:\\n${jsonl}`\n  })\n  return `\\n\\n## Examples (retrieved — imitate their shape, not their content)\\n\\n${blocks.join('\\n\\n---\\n\\n')}`\n}\n\n// ---- ADR-0091 §3: the `miniSkills` composed segment — a structural twin of `fewShot` above. Returns\n// `''` for an empty selection (the SAME degrade-to-empty idiom `fewShot` uses), or the selected modules'\n// `body`s under one header otherwise. Additive and orthogonal to the `mode`-scaled block (Build-sequencing\n// note): it never touches `grammarFor`, and composes identically in every mode, including `'default'`. ----\n\nfunction miniSkillsBlock(selected: readonly MiniSkill[]): string {\n  if (selected.length === 0) return ''\n  const blocks = selected.map((skill) => skill.body)\n  return `\\n\\n## Composition idioms (matched to your request)\\n\\n${blocks.join('\\n\\n')}`\n}\n\n// ---- genui-surface SPEC-R10: the genui teaching block — a structural TWIN of `miniSkillsBlock` above\n// (degrades to '' on the modality being off, additive/orthogonal to `mode`, never touches `grammarFor`).\n// GENUI_TEACHING is the fixed wire+sandbox-reality prose (loaded once, mode-invariant — genui's own on/off\n// signal is orthogonal to the A2UI `GenUiMode` disposition, SPEC §4 N2). ----\n\nconst GENUI_TEACHING = loadPrompt('genui-teaching.md')\n\n/** The `exclusive` override paragraph (`GenuiSurfaceConfig.exclusive`, genui-surface-config.ts) — composed\n *  AFTER the fixed `GENUI_TEACHING` text, so it reads as a per-turn amendment to that text's own \"A2UI\n *  stays your default\" framing, not a contradiction baked into the fixed prose itself (which stays correct\n *  for a coexistence caller like agent-admin, the SAME `sourceBody` composition-order precedent). Names the\n *  consumer fact plainly — never \"prefer style X\" vaguely — so a compliant model has a concrete reason to\n *  route this turn's ENTIRE output through genui rather than the catalog. */\nconst GENUI_EXCLUSIVE_OVERRIDE = `This turn's caller has NO A2UI catalog renderer at all — it can ONLY display a genui surface. Any A2UI JSONL you emit (createSurface/updateComponents/updateDataModel) will validate but never render as a UI here — the client refuses it with a visible notice, not silently. For this turn, express the ENTIRE response as ONE genui HTML surface (or as a note-only reply with no surface, if nothing needs to render) — never as A2UI JSONL, even for shapes the catalog could otherwise express.`\n\n// ---- genui-surface SPEC-R13: the dogfood segment — GenuiSurfaceConfig.dogfood, GH #316/ADR-0162.\n// GENUI_DOGFOOD_TEACHING is the hand-authored, byte-pinned half (SPEC-R13(a), `prompt-equivalence.test.ts`'s\n// `genuiDogfoodTeaching` field); `dogfoodInventory()` (SPEC-R13(b)) is the DERIVED half — a fleet-descriptor\n// scan re-run on every call, never captured into any baseline (`prompt-drift.test.ts`'s inventory leg). ----\n\nconst GENUI_DOGFOOD_TEACHING = loadPrompt('genui-dogfood-teaching.md')\n\n// GH #418 — the note-line convention (`{\"a2uiMeta\":{\"note\":…}}`, always-first, ADR-0088) normally rides\n// GRAMMAR/INTRO_AND_NOTE into every mode. When `a2uiEnabled` is `false` (below), GRAMMAR composes ZERO\n// bytes — so a genui-only turn would otherwise lose the ONE piece of GRAMMAR that genui itself still\n// depends on (the client's shared `readMetaLine` peel, `admin-live-runner.ts`, applies identically\n// regardless of modality). A2UI_OFF_NOTE_LINE re-teaches JUST that convention, written genui-only (never\n// referencing \"the A2UI JSONL below\", which does not exist this turn) — never a copy of GRAMMAR's own\n// A2UI-specific note-line paragraph (that one says \"you do NOT reply in prose or HTML\", the opposite of\n// what a genui turn does).\nconst A2UI_OFF_NOTE_LINE = loadPrompt('a2ui-off-note-line.md')\n\n// ---- ADR-0178 cl.1/cl.3, SPEC-R30: the persona-authoring teaching segment — a structural TWIN of\n// `genuiBlock`/`miniSkillsBlock` (degrades to '' when the gate is off, additive, orthogonal to `mode`,\n// never touches `grammarFor`). Deliberately NOT inlined into the byte-pinned GRAMMAR constant the way\n// `ask`/`plan` mechanics are, and SPEC-R30 records why: ADR-0178 cl.1 rule 5 requires this teaching be\n// HOST-OWNED and never persona-editable (a byte-pinned prompt file satisfies that exactly), while cl.3\n// requires it compose ONLY when the persona's own authoring gate is on. Inlining it in GRAMMAR would\n// satisfy neither — it would put admin-specific mechanics in EVERY A2UI consumer's prompt and move\n// SPEC-R6's byte-identity baselines (`prompt-drift`/`prompt-equivalence`) for every caller.\nconst AUTHORING_TEACHING = loadPrompt('authoring-teaching.md')\n\n/** SPEC-R30 — composes the persona-authoring teaching when (and only when) the persona's authoring gate\n *  is on for this turn. Absent/`false` ⇒ `''`, the degradation law: byte-identical to the composition\n *  from before this capability existed, in every mode. Mode-INVARIANT when present (the ADR-0090 axis\n *  conditions disposition, never wire mechanics the model must reproduce exactly). */\nfunction authoringBlock(authoringEnabled: boolean | undefined): string {\n  if (authoringEnabled !== true) return ''\n  return `\\n\\n${AUTHORING_TEACHING}`\n}\n\n// ---- ADR-0182 cl.2/cl.3, SPEC-R31: the builder-mission teaching segment — a structural TWIN of\n// `authoringBlock` immediately above (degrades to '' when the gate is off, additive, orthogonal to\n// `mode`, never touches `grammarFor`). Kept OUT of the byte-pinned GRAMMAR constant for the SAME\n// reason SPEC-R30 already gives `authoringBlock`: this teaching is meaningful only to the Builder's\n// own interview turn, never to an ordinary A2UI/genui caller, so inlining it in GRAMMAR would move\n// SPEC-R6's byte-identity baselines for every consumer. Gated on a SEPARATE boolean from\n// `authoringSurface` on purpose (ADR-0182 cl.1) — the two answer different questions: whether this\n// persona may emit personaPatch AT ALL, versus whether THIS specific turn is the Builder's own\n// dedicated interview (a fact derived host-side from turn origin, never a persona-editable flag). ----\n\nconst BUILDER_MISSION_TEACHING = loadPrompt('builder-mission.md')\n\n/** SPEC-R31 — composes the drive-to-completion teaching when (and only when) this turn is the\n *  Builder's own interview (the derived `session === 'authoring'` fact, threaded here as a plain\n *  boolean). Absent/`false` ⇒ `''` — byte-identical to the composition from before this capability\n *  existed, in every mode. Mode-INVARIANT when present, matching `authoringBlock`. */\nfunction missionBlock(builderMission: boolean | undefined): string {\n  if (builderMission !== true) return ''\n  return `\\n\\n${BUILDER_MISSION_TEACHING}`\n}\n\n/** SPEC-R10 — composes ONE genui block when (and only when) the modality is enabled for this turn: the\n *  fixed wire/sandbox-reality teaching; the `exclusive` override paragraph when the caller has named itself\n *  a genui-only consumer; the dogfood segment (teaching + the derived fleet inventory) when `dogfood` is\n *  set (SPEC-R13); then the picked pattern-source's body when one is picked (D3 — never a lookup by id; the\n *  caller already resolved the picked library entry's own `content`, SPEC-R11). Undefined/`enabled:false`\n *  ⇒ `''` — the degradation law: the composed prompt is byte-identical to the pre-GenUI composition (AC1).\n *  `exclusive`/`dogfood` absent/`false` ⇒ byte-identical to before that field existed.\n *\n *  GH #418 — `a2uiEnabled` (the buildSystemPrompt-level axis, threaded from the caller's OWN A2UI Surface\n *  Option) is folded in HERE, not left to the caller: when it's `false`, this turn's caller has no A2UI\n *  renderer available AT ALL (`buildSystemPrompt` composed zero A2UI grammar/catalog bytes above,\n *  regardless of `genui.exclusive`) — the EXACT consumer fact `GenuiSurfaceConfig.exclusive` already\n *  names (genui-surface-config.ts). Most-restrictive-wins (ADR-0034's convention, applied to this axis):\n *  the override composes whenever EITHER `genui.exclusive` OR `!a2uiEnabled` says so, and the note-line\n *  convention (above) is re-taught whenever `!a2uiEnabled`, since GRAMMAR never ran this turn. */\nfunction genuiBlock(genui: GenuiSurfaceConfig | undefined, a2uiEnabled: boolean): string {\n  if (genui === undefined || !genui.enabled) return ''\n  const noteLine = a2uiEnabled ? '' : `\\n\\n${A2UI_OFF_NOTE_LINE}`\n  const exclusive = genui.exclusive === true || !a2uiEnabled ? `\\n\\n${GENUI_EXCLUSIVE_OVERRIDE}` : ''\n  const dogfood =\n    genui.dogfood === true\n      ? `\\n\\n${GENUI_DOGFOOD_TEACHING}\\n\\n## agent-ui components available inside your GenUI document\\n\\n${dogfoodInventory()}`\n      : ''\n  const source = genui.sourceBody !== undefined && genui.sourceBody.trim() !== '' ? `\\n\\n${genui.sourceBody.trim()}` : ''\n  return `\\n\\n${GENUI_TEACHING}${noteLine}${exclusive}${dogfood}${source}`\n}\n\n// ADR-0091 §4 fix (independent-review defect): in `'blue-sky'` mode, `NEGOTIATE_BLUE_SKY` above already\n// carries the three ★ calibration examples' `body` text verbatim (via `calibrationExampleBullet`). If\n// `selectMiniSkills` ALSO picked one of those same three ids, injecting it again through\n// `miniSkillsBlock` would duplicate the identical paragraph in ONE composed prompt — the exact defect an\n// independent reviewer's live probe caught (\"dashboard paragraph occurrences in ONE blue-sky prompt: 2\").\n// Filter those three ids out of the selection ONLY when `mode === 'blue-sky'` — in `'specific'`/`'default'`\n// /absent mode, none of this prose is inlined anywhere, so the registry selection must keep injecting them\n// normally there. `login-form`/`master-detail-split` are never inlined in any mode and are never filtered.\nconst BLUE_SKY_CALIBRATION_ID_SET: ReadonlySet<string> = new Set(BLUE_SKY_CALIBRATION_IDS)\n\nfunction miniSkillsFor(mode: GenUiMode | undefined, selected: readonly MiniSkill[]): readonly MiniSkill[] {\n  if (mode !== 'blue-sky') return selected\n  return selected.filter((skill) => !BLUE_SKY_CALIBRATION_ID_SET.has(skill.id))\n}\n\n/**\n * Compose the machine system prompt (SPEC-R6): the `mode`-composed GRAMMAR half (ADR-0090 §1) + the\n * catalog-derived component/function inventory + the few-shot block + the selected mini-skills block\n * (ADR-0091 §3). The inventory is derived from `catalog` at call time — `buildSystemPrompt` can never\n * advertise a component the catalog lacks (drift-gated by `prompt-drift.test.ts`, untouched by `mode` or\n * `miniSkills` — both only ever condition the hand-authored grammar half).\n *\n * `mode` is optional: an absent `mode` (and `'default'`) reproduce the pre-ADR-0090 grammar byte-for-byte\n * (zero regression, Decision §1). `'specific'` dials the ADR-0089 clarify/negotiate behaviors DOWN;\n * `'blue-sky'` dials them UP. The honesty floor (§2) is identical in every mode.\n *\n * `miniSkills` is optional and defaults to `[]`: an absent/empty selection composes a prompt\n * byte-identical to calling `buildSystemPrompt` without the parameter at all (ADR-0091 Acceptance) — the\n * block is `''` on empty, exactly like `fewShot`. A non-empty selection appends ONE `## Composition\n * idioms` block after the few-shot examples, capped at whatever size the caller (`produce()`,\n * `selectMiniSkills`) already bounded it to. In `'blue-sky'` mode ONLY, `miniSkillsFor` first drops any\n * selected entry whose id is already inlined verbatim in `NEGOTIATE_BLUE_SKY` (§4 fix) — everywhere else\n * the selection composes unfiltered.\n *\n * GH #418 — `a2uiEnabled` is the 7th, additive parameter: absent/`true` reproduces every byte of the\n * pre-existing composition (`grammarFor` + the catalog/functions inventory + `fewShot` + the mini-skills\n * block), exactly as before this parameter existed — every existing caller (`produce.ts`, every test in\n * this package) passes at most 6 arguments and is byte-unaffected. `false` composes ZERO bytes from that\n * whole A2UI-grammar/catalog/examples/mini-skills pipeline (mini-skills are catalog-composition idioms —\n * `prompts/mini-skills/*.md` name concrete A2UI component types — so they are A2UI catalog teaching too,\n * not exempt): the caller has no A2UI renderer this turn, so teaching its dialect would only mislead the\n * model (the exact defect this fixes — a GenUI-only agent-admin turn composed the FULL A2UI catalog wall\n * regardless of the toggle). `genuiBlock` folds this same signal into its own composition (see its own\n * doc comment) so a genui-enabled turn still gets a working note-line convention and an explicit\n * no-A2UI-renderer framing even with zero GRAMMAR bytes above it.\n *\n * ADR-0178 cl.3 / SPEC-R30 — `authoringSurface` is the 8th, additive parameter, the persona's OWN\n * authoring modality gate: absent/`false` composes ZERO bytes (byte-identical to before this capability\n * existed, in every mode — every existing caller passes at most 7 arguments and is unaffected), `true`\n * appends the `personaPatch` arm's host-owned mechanics teaching. It is orthogonal to `mode`, to\n * `a2uiEnabled`, and to the genui axis: an authoring conversation is about the CONFIGURATION of another\n * agent, not about which surface kind this turn paints.\n *\n * ADR-0182 cl.2/cl.3 / SPEC-R31 — `builderMission` is the 9th, additive parameter: absent/`false`\n * composes ZERO bytes (byte-identical to before this capability existed — every existing caller passes\n * at most 8 arguments and is unaffected), `true` appends the drive-to-completion teaching. It is a\n * SEPARATE gate from `authoringSurface` — a persona may author patches (`authoringSurface: true`)\n * without this being ITS OWN dedicated interview turn (`builderMission`), so the two are threaded and\n * composed independently even though only the Builder's own turn ever sets both.\n */\nexport function buildSystemPrompt(\n  catalog: Catalog,\n  exemplars: readonly CorpusRecord[],\n  mode?: GenUiMode,\n  miniSkills?: readonly MiniSkill[],\n  personaSystem?: string,\n  genui?: GenuiSurfaceConfig,\n  a2uiEnabled?: boolean,\n  authoringSurface?: boolean,\n  builderMission?: boolean,\n): string {\n  const a2uiOn = a2uiEnabled !== false // absent ⇒ on — the zero-regression default (Decision precedent)\n  return (\n    (a2uiOn\n      ? grammarFor(mode) +\n        `\\n\\n## Available components (catalog \"${catalog.catalogId}\", protocol ${catalog.protocolVersion})\\n\\n` +\n        catalogIdTeaching(catalog) +\n        catalogInventory(catalog) +\n        `\\n\\n## Available functions\\n\\n` +\n        functionsInventory(catalog) +\n        fewShot(exemplars) +\n        miniSkillsBlock(miniSkillsFor(mode, miniSkills ?? []))\n      : '') +\n    genuiBlock(genui, a2uiOn) +\n    authoringBlock(authoringSurface) +\n    missionBlock(builderMission) +\n    personaBlock(personaSystem)\n  )\n}\n\n/** ADR-0138 cl.1 — the optional trailing persona section. Appended AFTER every catalog/exemplar/mode/\n *  mini-skill section, with ONE fixed precedence sentence: the persona governs voice/content choices;\n *  the wire format + catalog rules above stay authoritative. Absent/empty ⇒ '' — byte-identical output\n *  to the pre-seam composition (the ADR-0090 `mode`-absent precedent, zero regression). */\nfunction personaBlock(personaSystem?: string): string {\n  if (personaSystem === undefined || personaSystem.trim() === '') return ''\n  return (\n    `\\n\\n## Persona\\n\\n` +\n    `The following persona governs your VOICE and CONTENT choices. The A2UI wire format and catalog rules above remain authoritative — the persona never overrides them.\\n\\n` +\n    personaSystem.trim()\n  )\n}\n",o=`// meta-line.ts — ADR-0088 §1: the reserved leading meta-line envelope + its guard.
//
// The demo-transport's natural-language \`note\` (+ the ADR-0088 §2 \`TurnTrace\`) rides the SAME
// \`AsyncIterable<string>\` stream \`AgentTransport.turn()\` already returns (\`agent-transport.ts:67-69\`) —
// as a single reserved JSON line, emitted FIRST, ahead of any A2UI JSONL. This is a demo-transport
// FRAMING convention, not part of the A2UI protocol: it carries no \`version\` key, so it is provably
// **not** an \`A2uiServerMessage\` — every server message carries \`version\` plus one of the fixed
// envelope keys that \`dispatch()\` routes on (\`../../src/renderer/dispatch.ts:72-78\`: the version gate at
// line 76, the envelope-key \`if\`-chain after). \`produce()\` (LLD-C3) peels this line off \`raw\` BEFORE
// heal/validateA2ui — the note never reaches the shared validator and never enters the corpus path
// (SPEC-N3 wire purity, ADR-0070 clause 3).
//
// ADR-0097 §1 adds ONE additive field, \`ask\`: the model declares a feed-embedded ask by carrying
// \`{surfaceId}\` on the SAME leading meta-line as \`note\`. The \`ask\` payload itself is ORDINARY A2UI — it
// rides the shared validated stream exactly like every other surface (SPEC-R5 untouched); this envelope
// only carries the ROUTING fact ("that surfaceId is an ask"), never the payload. The \`version\` guard, the
// note/trace fields, and the disjointness-from-\`A2uiServerMessage\` proof are all UNCHANGED — \`ask\` is
// shallow-validated the SAME way \`note\`/\`trace\` are: a malformed \`ask\` (non-object, or missing/non-string
// \`surfaceId\`) yields the envelope WITHOUT \`ask\` (never the whole envelope dropped) — the note/trace
// still parse normally, so a broken \`ask\` never breaks the conversational channel it rides on.
//
// ADR-0174 cl.2 / SPEC-R20 adds a second additive field, \`plan\`: the model declares a step list by
// carrying \`{steps: [{id, description}]}\` on the SAME leading meta-line as \`note\`/\`ask\`, following the
// \`ask\`-arm precedent EXACTLY — MODEL-authored, shallow-validated the same per-field-independent way (a
// malformed \`plan\` drops only itself, never the whole envelope). The host-side plan→execute→synthesize
// loop that reads a declared \`plan\`, and any \`plan\`-analogue of \`ask\`'s surfaceId-correlation integrity
// check, are a future SPEC/LLD's job — this file carries the wire representation ONLY.
//
// ADR-0178 cl.1 / SPEC-R29 adds a third additive MODEL-authored field, \`personaPatch\`: an authoring turn
// declares persona-state deltas by carrying \`{values?, entries?}\` on the SAME leading meta-line, following
// the \`ask\`/\`plan\`-arm precedent EXACTLY (a malformed \`personaPatch\` drops only itself). The values stay
// \`unknown\` here on purpose: this package is persona-key-AGNOSTIC by construction (the package DAG runs
// \`a2ui\` ← \`app\`, and the persona schema lives in \`app\`), and every semantic filter — the enumerated-key
// filter, the per-key fail-closed sanitizer, \`validateNewEntry\` — is HOST-side (ADR-0178 cl.2, a future
// slice). The merge law those filters apply (incremental per turn; \`values\` last-writer-wins at whole-value
// granularity; \`entries\` appended, never replacing; no deletion semantics) is SPEC-R29's, stated there and
// enforced there — this file carries the wire representation ONLY.
//
// ADR-0198 cl.1 adds a FOURTH additive MODEL-authored field, \`flowEnd\`: the closing turn of an
// ask-flow (the turn AFTER the user commits the flow-final confirm) declares completion by carrying
// \`flowEnd: true\` on the SAME leading meta-line as \`note\`, following the \`ask\`/\`plan\`/\`personaPatch\`
// arm precedent EXACTLY — shallow-validated per-field-independently (anything other than literal
// \`true\` yields the envelope WITHOUT \`flowEnd\`, never the whole envelope dropped). A bare boolean,
// not an object, deliberately: v1 carries no payload; if a future consumer earns structure the field
// widens additively to \`true | {...}\`. A model that omits it degrades safely to today's behavior —
// chrome only ever acts on the explicit field, never a heuristic (ADR-0198 Non-goals).
//
// Zero-dep, pure (SPEC-N5): no imports.

/**
 * The per-turn decision trace (ADR-0088 §2) — assembled by \`produce()\` from data already flowing
 * through its loop (the retrieval query, which exemplars matched, self-correct rounds, healer
 * corrections, the authoritative model). Lives browser-side, parallel to \`Session.turns\`
 * (\`agent-transport.ts\`), never inside \`session.turns\` and never on the validated A2UI wire — only
 * carried, transiently, on this same meta-line.
 */
export interface TurnTrace {
  turnIndex: number
  query: { intent: string; k: number }
  /** WHICH judged-shard records (\`CorpusRecord.name\`, unique per record) conditioned this turn. */
  exemplarIds: string[]
  /** Self-correct rounds taken (1 = first-try valid). */
  rounds: number
  /** Lines the shared healer (\`../../src/corpus/heal.ts\`) corrected on the round that succeeded. */
  healed: number
  /** The validator failure codes fed back into the successful round's prompt, if any. */
  failureCodes: string[]
  model: string
}

/**
 * A feed-embedded ask declaration (ADR-0097 §1): \`surfaceId\` names the FRESH A2UI surface, created on the
 * SAME validated stream, that hosts the ask's structured UI. This is a routing fact only — no payload, no
 * mechanics — the surface it names is ordinary \`createSurface\`/\`updateComponents\`/\`updateDataModel\`.
 */
export interface AskDeclaration {
  surfaceId: string
}

/**
 * One step of a model-declared plan (ADR-0174 cl.2 / SPEC-R20) — \`id\` names the step, \`description\` is
 * the model's own prose for what that step does. Wire representation ONLY: the host-side executor loop
 * that reads a declared plan and drives it is a future SPEC/LLD's job, not this envelope's.
 */
export interface PlanStep {
  id: string
  description: string
}

/**
 * A plan declaration (ADR-0174 cl.2 / SPEC-R20): the model's own step list, following the \`ask\`-arm
 * precedent EXACTLY — MODEL-authored (never runtime-composed), shallow-validated the same
 * per-field-independent way (\`readMetaLine\` below), and carrying NO integrity check here (ADR-0174 Open
 * fork OF1 — a \`plan\` is displayed/passed-through as declared, host-trusted, until a future requirement
 * rules otherwise).
 */
export interface PlanDeclaration {
  steps: PlanStep[]
}

/**
 * A persona-state patch (ADR-0178 cl.1 / SPEC-R29): a MODEL-authored PARTIAL record of persona-scoped
 * store state, declared by an authoring turn on the SAME leading meta-line as \`note\`. \`values\` proposes
 * scalar state (config values, switch states); \`entries\` proposes CONTRIBUTIONS to the entry-list keys.
 * The two members are the two KINDS of proposal ADR-0178 cl.1 enumerates, declared distinctly so the model
 * states its INTENT (set vs. contribute) rather than the host inferring it from a key table.
 *
 * Both members' values are \`unknown\` here — see the file header: no persona key set, sanitizer, or entry
 * shape is known to this package. The host's three-filter apply gate (ADR-0178 cl.2) is what admits any of
 * it, under SPEC-R29's merge law: incremental per turn, \`values\` last-writer-wins at WHOLE-VALUE
 * granularity per key (absent key untouched, no deep merge), \`entries\` appended through the shipped
 * \`validateNewEntry\` add path (never a list replace), and NO deletion semantics in this version — which is
 * what keeps a hallucinated patch non-destructive by construction.
 */
export interface PersonaPatch {
  values?: Record<string, unknown>
  entries?: Record<string, unknown[]>
}

/**
 * The closed live-turn lifecycle stage vocabulary (ADR-0146 F1) — produce-layer-owned, provider-agnostic.
 * Each adapter maps its OWN upstream events onto these (F4); \`produce()\` composes them with its own loop
 * stages. A CLOSED union: an out-of-vocabulary stage is dropped at the guard (\`readMetaLine\`), never
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
 * rides the SAME \`AsyncIterable<string>\` as \`{"a2uiMeta":{"progress":…}}\` meta-lines, INTERLEAVED during
 * the turn (never content — it never enters heal/validate/corpus; SPEC-R5 validate-then-stream untouched).
 * \`round\` carries the self-correct round ordinal on \`'retry'\`; \`detail\` carries OPTIONAL factual text
 * (F3-gated: absent by default, forwarded only under \`progressDetail:'full'\` — never required for any stage).
 * \`source\` (GH #240/ADR-0159 wave B — the per-step source reveal) carries the raw A2UI JSONL line(s) behind
 * the stage — the actual createSurface/updateDataModel/updateComponents text a step stands for, newline-
 * joined and producer-capped. Attached ONLY under the explicit \`progressDetail:'source'\` opt-in (produce.ts
 * owns the gate + the cap); absent on every default stream — the privacy gate stays fail-closed.
 */
export interface TurnProgress {
  stage: TurnProgressStage
  round?: number
  detail?: string
  source?: string
}

/**
 * The reserved wrapper (ADR-0088 §1/§2, ADR-0097 §1). \`note\` is the model's contemporaneous natural-
 * language rationale/reply; \`ask\` is the model-authored feed-ask routing declaration (produce() peels it,
 * verifies its integrity, and re-composes it on the outgoing meta-line only when it holds); \`trace\` is the
 * runtime-assembled \`TurnTrace\` (the model never authors \`trace\` itself — only \`produce()\` attaches it
 * before yielding); \`progress\` is a runtime-composed live-turn lifecycle event (ADR-0146 F1), the one kind
 * that may INTERLEAVE during the turn rather than ride only the single leading line. \`error\` is a
 * runtime-composed, TERMINAL failure signal (GH #144) — a transport (the dev proxy / the Cloudflare
 * Worker) writes it as the LAST line on a stream whose headers already committed 200 before \`produce()\`
 * halted (\`ProduceHalt\`, the round bound exhausted) or otherwise threw mid-loop (an upstream fault): the
 * ONLY way such a transport can turn an already-200 stream into a VISIBLE client-side failure instead of a
 * silently-empty "success" (SPEC-R5's "halt-and-report" was always produce()-internal; nothing carried
 * that report across the wire until this field). The model never authors \`error\` — only a transport does,
 * exactly like \`trace\`. All five fields are optional: a note-only line omits \`ask\`/\`trace\`/\`progress\`/
 * \`error\`; a progress line carries only \`progress\`; an error line carries only \`error\`; a malformed/leaked
 * line may omit any of them.
 */
export interface A2uiMetaEnvelope {
  a2uiMeta: {
    note?: string
    ask?: AskDeclaration
    /** ADR-0174 cl.2 / SPEC-R20: the model's own declared step list, additive alongside \`note\`/\`ask\` on
     *  the SAME leading meta-line. MODEL-authored, shallow-validated the same per-field-independent way
     *  \`ask\` is — a malformed \`plan\` drops only itself, never the whole envelope. */
    plan?: PlanDeclaration
    /** ADR-0178 cl.1 / SPEC-R29: the model's own persona-state delta, additive alongside \`note\`/\`ask\`/
     *  \`plan\` on the SAME leading meta-line. MODEL-authored, shallow-validated the same per-field-
     *  independent way — a malformed \`personaPatch\` drops only itself, never the whole envelope. Whether
     *  a declared patch is ever CONSUMED is the host's call, gated per persona (SPEC-R30); the wire layer
     *  is gate-blind. */
    personaPatch?: PersonaPatch
    /** ADR-0198 cl.1: the model's own flow-completion declaration — the closing turn of an ask-flow
     *  carries literal \`true\`, additive alongside \`note\`/\`ask\`/\`plan\`/\`personaPatch\` on the SAME
     *  leading meta-line. MODEL-authored, shallow-validated the same per-field-independent way — a
     *  malformed \`flowEnd\` (anything but literal \`true\`) drops only itself, never the whole envelope. */
    flowEnd?: true
    trace?: TurnTrace
    /** ADR-0146 F1: a runtime-composed live-turn lifecycle event, INTERLEAVED during the turn (not just a
     *  single leading line). Shallow-validated the same way \`ask\` is — a malformed \`progress\` drops only
     *  itself, never the whole envelope. */
    progress?: TurnProgress
    /** GH #144: a transport-composed terminal failure message — see the interface doc above. Shallow-
     *  validated the same way \`note\` is (a plain string); a malformed \`error\` drops only itself. */
    error?: string
  }
}

/**
 * Parse \`line\` as a meta-line, or \`undefined\` if it is not one — never throws. A meta-line is a JSON
 * object carrying the reserved \`a2uiMeta\` wrapper key and, provably, NO \`version\` key — the
 * \`A2uiServerMessage\` discriminator (\`dispatch.ts\`'s version gate) — which is what keeps this
 * convention disjoint from the protocol it rides beside (ADR-0088 §1). Shallow-validates \`note\`/\`trace\`/
 * \`ask\`/\`progress\` field TYPES (not \`trace\`'s inner shape — it is runtime-assembled, never wire-validated);
 * a malformed \`ask\`/\`progress\` drops only itself, never the whole envelope.
 */
/** A non-null, non-array object — the shape every shallow field guard below already tests inline. Named
 *  once for the \`personaPatch\` arm (SPEC-R29), which tests it three times; the older guards keep their
 *  inline form so their diffs stay byte-quiet. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
  // GH #144: \`error\` is shallow-validated the SAME way as \`note\` — a non-string value drops only itself
  // (the field goes \`undefined\` below), never the whole envelope.
  const error = typeof m.error === 'string' ? m.error : undefined

  // ADR-0097 §1: \`ask\` is shallow-validated the same way as note/trace, but a MALFORMED \`ask\` drops only
  // itself — never the whole envelope (note/trace still parse normally). Never throws, never invents a
  // surfaceId.
  let ask: AskDeclaration | undefined
  if (m.ask !== undefined && typeof m.ask === 'object' && m.ask !== null && !Array.isArray(m.ask)) {
    const surfaceId = (m.ask as Record<string, unknown>).surfaceId
    if (typeof surfaceId === 'string') ask = { surfaceId }
  }

  // ADR-0174 cl.2 / SPEC-R20: \`plan\` is shallow-validated the SAME per-field-independent way as \`ask\` — a
  // malformed \`plan\` (non-object, a missing/non-array \`steps\`, or any step missing a string \`id\` or a
  // string \`description\`) drops ONLY \`plan\`, never the whole envelope (note/ask/trace/progress/error on
  // the same line still parse normally). MODEL-authored, never runtime-composed — never throws, never
  // invents a step.
  let plan: PlanDeclaration | undefined
  if (m.plan !== undefined && typeof m.plan === 'object' && m.plan !== null && !Array.isArray(m.plan)) {
    const steps = (m.plan as Record<string, unknown>).steps
    if (
      Array.isArray(steps) &&
      steps.every(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          !Array.isArray(s) &&
          typeof (s as Record<string, unknown>).id === 'string' &&
          typeof (s as Record<string, unknown>).description === 'string',
      )
    ) {
      plan = { steps: steps as PlanStep[] }
    }
  }

  // ADR-0178 cl.1 / SPEC-R29: \`personaPatch\` is shallow-validated the SAME per-field-independent way as
  // \`ask\`/\`plan\` — a malformed patch drops ONLY \`personaPatch\`, never the whole envelope. The arm
  // validates as a WHOLE (a malformed member drops the entire arm, not just that member): a half-parsed
  // patch is the one shape a host apply loop must never be handed. Malformed = a non-object/array arm; a
  // present-but-non-object \`values\`; a present-but-non-object \`entries\`, or one whose any member is not an
  // array; or NEITHER member present. Member VALUES stay \`unknown\` — this package knows no persona key.
  let personaPatch: PersonaPatch | undefined
  if (m.personaPatch !== undefined && isPlainObject(m.personaPatch)) {
    const p = m.personaPatch
    const values = p.values
    const entries = p.entries
    const valuesOk = values === undefined || isPlainObject(values)
    const entriesOk = entries === undefined || (isPlainObject(entries) && Object.values(entries).every((v) => Array.isArray(v)))
    if (valuesOk && entriesOk && (values !== undefined || entries !== undefined)) {
      personaPatch = {
        ...(values !== undefined ? { values: values as Record<string, unknown> } : {}),
        ...(entries !== undefined ? { entries: entries as Record<string, unknown[]> } : {}),
      }
    }
  }

  // ADR-0198 cl.1: \`flowEnd\` is shallow-validated the SAME per-field-independent way as
  // \`ask\`/\`plan\`/\`personaPatch\` — anything other than literal \`true\` (a string "true", 1, an object,
  // \`false\`) drops ONLY \`flowEnd\`, never the whole envelope (note/ask/plan/personaPatch/trace/
  // progress/error on the same line still parse normally). MODEL-authored; omitted = not a closing
  // turn — the safe-degrade law.
  const flowEnd: true | undefined = m.flowEnd === true ? true : undefined

  // ADR-0146 F1: \`progress\` is shallow-validated the SAME way — a malformed \`progress\` (non-object, or a
  // \`stage\` outside the closed vocabulary, or a non-number \`round\` / non-string \`detail\`/\`source\`) drops
  // only itself, never the whole envelope. The closed \`stage\` union is the honesty-law guard (F2): an
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
      plan,
      personaPatch,
      flowEnd,
      trace: m.trace as TurnTrace | undefined,
      progress,
      error,
    },
  }
}

/**
 * Format a transport-composed terminal error line (GH #144) — the wire counterpart \`readMetaLine\` parses
 * back into \`a2uiMeta.error\`. A transport (the dev proxy / the Cloudflare Worker) writes this as the LAST
 * line on a stream whose headers already committed 200 before \`produce()\` halted or otherwise threw
 * mid-loop, so the failure is VISIBLE client-side instead of reading as an empty "success" (a stream that
 * just ends with zero content lines and zero explanation). No \`version\` key ⇒ provably not an
 * \`A2uiServerMessage\`, same disjointness proof \`readMetaLine\`'s header documents for every meta-line kind.
 */
export function formatErrorLine(message: string): string {
  return JSON.stringify({ a2uiMeta: { error: message } })
}

/**
 * \`true\` iff \`line\` is a well-formed meta-line (per \`readMetaLine\`'s guard) — the cheap boolean form for
 * callers that only need to route/filter (e.g. the page's ingest filter, later slices), not read the
 * payload.
 */
export function isMetaLine(line: string): boolean {
  return readMetaLine(line) !== undefined
}
`,s=`{
  "name": "@agent-ui/a2ui",
  "description": "A2UI (agent-generated UI) support for the agent-ui family: a zero-dependency renderer for the A2UI wire protocol, a strict message validator, and the default component catalog mapping protocol types onto \`ui-*\` elements.",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./examples": "./src/examples/index.ts",
    "./corpus": "./src/corpus/index.ts",
    "./agent": "./src/agent/index.ts",
    "./agent/meta-line": "./src/agent/meta-line.ts",
    "./agent/genui-line": "./src/agent/genui-line.ts",
    "./agent/agent-transport": "./src/agent/agent-transport.ts"
  },
  "dependencies": {
    "@agent-ui/components": "*",
    "@agent-ui/shared": "*"
  },
  "devDependencies": {
    "@agent-ui/icons": "*",
    "@agent-ui/a2a": "*"
  }
}
`,c=`// produce-to-conversation.ts — ADR-0137 clause 7 / TKT-0072: a minimal, runnable SERVER-SIDE example of a
// consumer wiring its OWN model call through the exported \`@agent-ui/a2ui/agent\` producer toolkit into a
// validated A2UI JSONL stream — the exact loop TKT-0072's screenshots show broken ("emit real A2UI, not
// markdown box-art"). This is NOT a second dev-proxy: it holds its OWN key in its OWN env and runs where a
// browser cannot (a server), because the producer calls a model and a browser cannot hold a secret
// (ADR-0069). The validated lines it emits are exactly what a browser hands to \`ui-conversation\` /
// \`ui-surface-host\`'s \`ingestLine()\` — see README.md in this folder for the render-side wiring.
//
// Run (from the repo root, with a real key):
//   ANTHROPIC_API_KEY=sk-ant-... node --experimental-strip-types \\
//     packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts "Build me a login form"
//
// It needs a key by design, so it is NOT a standing CI gate (SPEC-R3) — \`npm run check\` typechecks it
// (check:tools includes \`packages/agent-ui/*/tools\`), \`npm test\` never runs it.

// The ENTIRE producer surface a consumer needs — from the ONE real package export. No relative deep-import
// into the package internals; no vendored LLM SDK (the adapter is hand-rolled, plain \`fetch\`).
import { produce, ProduceHalt, anthropicProvider, readMetaLine } from '@agent-ui/a2ui/agent'
import type { ProduceDeps, ProduceOptions, TurnInput, Session } from '@agent-ui/a2ui/agent'
// The component authority — the same default catalog the renderer validates against (root \`.\` barrel).
import { defaultCatalog } from '@agent-ui/a2ui'

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit(code: number): never }

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === '') {
    console.error('Set ANTHROPIC_API_KEY in this process’s own env (the consumer’s server-side key boundary).')
    process.exit(1)
  }

  // The three injected surfaces (ProduceDeps):
  //  - provider: the exported hand-rolled Anthropic adapter (bring-your-own-fetch impls satisfy the same
  //    \`AgentProvider\` seam — see F4). The key is passed IN, never read at module scope.
  //  - retrieve: run EXEMPLAR-LESS here (ADR-0137 clause 5) — the judged corpus shard is not importable, so
  //    \`fewShot\` degrades to '' by standing contract, and the mini-skill registry (shipped IN the pack)
  //    still delivers the catalog-idiom knowledge. A richer consumer loads its own corpus via
  //    \`@agent-ui/a2ui/corpus\`'s \`createStore\` + its own IO and returns real records here.
  //  - catalog: the sole component authority.
  const deps: ProduceDeps = {
    provider: anthropicProvider({ apiKey }),
    retrieve: () => [],
    catalog: defaultCatalog,
  }

  const session: Session = { turns: [] }
  const input: TurnInput = {
    kind: 'intent',
    text: process.argv[2] ?? 'Build me a login form with an email field, a password field, and a submit button.',
    session,
  }
  const opts: ProduceOptions = { maxRounds: 3, model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5' }

  const validatedLines: string[] = []
  try {
    // \`produce()\` runs the bounded generate → heal+validate → self-correct loop and yields, in order,
    // the leading meta-line (the agent's prose \`note\`) FIRST, then the FULLY-VALIDATED A2UI JSONL lines
    // (validate-then-stream, SPEC-R5): nothing invalid is ever emitted.
    for await (const line of produce(input, deps, opts)) {
      const meta = readMetaLine(line)
      if (meta !== undefined) {
        if (meta.a2uiMeta.note !== undefined) console.log(\`[note] \${meta.a2uiMeta.note}\`)
        continue // the meta-line rides BESIDE the payload; never feed it to the renderer.
      }
      validatedLines.push(line)
      // ── In the BROWSER, hand each validated line straight to the render side (no re-validation): ──
      //   host.ingestLine(line)                       // ui-surface-host
      //   conv.beginAgentTurn().ingestLine(line)      // ui-conversation's per-turn AgentTurnHandle
      // Here (server) we just collect them; the transport hands this JSONL to the client.
    }
  } catch (err) {
    if (err instanceof ProduceHalt) {
      // The loop exhausted its round budget without a valid surface — report, never render garbage.
      console.error(\`produce halted: \${err.failures.map((f) => f.code).join(', ') || 'unknown'}\`)
      process.exit(2)
    }
    throw err
  }

  // The validated A2UI JSONL stream — feedable, line-by-line, to \`ingestLine()\`.
  console.log(validatedLines.join('\\n'))
}

void main()
`,{content:l}=e({title:`A2UI agent guide`});l.append(t('The RENDER half of "an agent emits real A2UI in chat" ships as `ui-surface-host`/`ui-conversation` — transport-agnostic, it takes whatever validated JSONL you feed it. This page is the PRODUCER half: the exported `@agent-ui/a2ui/agent` subpath (ADR-0137) — the drift-gated, catalog-grounded prompt, the bounded self-correct loop, and the transport seam a consumer app wires its own model call through. Every block below is sliced live from the shipped source — if this page and the code disagree, the page is stale and its derivation is the bug.'));function u(e,t,n){let r=document.createElement(`h${e}`);return r.textContent=t,n&&(r.id=n),r}function d(e){let t=document.createElement(`p`);return t.textContent=e,t}function f(e,t){let n=`export interface ${t} {`,r=e.indexOf(n);if(r===-1)throw Error(`a2ui-agent: interface "${t}" not found — renamed or removed?`);let i=0,a=r;for(;a<e.length;a++)if(e[a]===`{`)i++;else if(e[a]===`}`&&(i--,i===0)){a++;break}return e.slice(r,a)}function p(e,t){let n=e.indexOf(t);if(n===-1)throw Error(`a2ui-agent: signature "${t}" not found — renamed or removed?`);let r=e.indexOf(`{`,n);return e.slice(n,r).trim()}function m(e,t){let n=`export type ${t} =`,r=e.indexOf(n);if(r===-1)throw Error(`a2ui-agent: type alias "${t}" not found — renamed or removed?`);let i=e.indexOf(`

`,r);return e.slice(r,i===-1?e.length:i).trim()}l.append(u(2,`Part A — the transport seam`),d("`AgentTransport` is the ONE interface a consuming page/app binds to: one agent turn in, an ordered stream of A2UI JSONL lines out. Zero-dep. Where the stream originates — a real model call, a recorded backbone, a dev-only proxy — lives entirely behind it; swapping one for another is a single construction-site edit."),u(3,`AgentTransport — derived from source`,`a2ui-agent-transport`),n(f(r,`AgentTransport`),`ts`),d("`Session` is the ordered turn history the BROWSER holds (the proxy/server is stateless) — every caller passes it in and gets a new one back, never a mutation."),n(f(r,`Session`),`ts`),d('`TurnInput` frames what is being sent this turn: a raw user `intent` (turn 1), or a `client` message — an `action`/`functionResponse`/`error` bubbled up from the rendered surface, or a GenUI bridge action — that a pure reducer (`nextTurn`, `session.ts`) turns into the next turn automatically ("the agent continues").'),n(m(r,`TurnInput`),`ts`),d("The producer calls a model, so it needs an API key — and a browser cannot hold a secret (ADR-0069). The pack is therefore NODE-FIRST by construction (ADR-0137 clause 4): `buildSystemPrompt` and the mini-skill registry read their prompt files off disk at load. A browser-side consumer imports only the pure, zero-dep seam types — `./agent/meta-line` (Part D) is exactly that subpath, carved out so a renderer-side page can type its progress/plan/ask UI without pulling in a byte of Node-bound producer code.")),l.append(u(2,`Part B — produce(): the bounded self-correct loop`),d("retrieve exemplars → build the catalog-derived prompt → generate via the injected `AgentProvider` → heal + validate the emitted A2UI text (the SAME shared validator the renderer runs, SPEC-N3) → on failure, feed the validator’s structured failures back and retry → bounded at `maxRounds` → VALIDATE-THEN-STREAM: yield only a FULLY validated payload’s JSONL lines (SPEC-R5) → halt-and-report at the bound, emitting NOTHING invalid (`ProduceHalt`). The three injected surfaces:"),n(f(i,`ProduceDeps`),`ts`),u(3,`produce() — derived from source`,`a2ui-agent-produce`),n(p(i,`export async function* produce(`),`ts`),d("It yields, in order: a leading meta-line (Part D — the agent’s prose `note`, if the model opts into the convention), then only fully-validated A2UI JSONL lines. A consumer feeds those straight to `ui-surface-host`/`ui-conversation`’s `ingestLine()` — no re-validation, exactly what Part E shows.")),l.append(u(2,`Part C — buildSystemPrompt(): the catalog-grounded prompt`),d("The drift-gated prompt that teaches a model this fleet’s vocabulary: the grammar, the Gen-UI `mode` disposition, the derived `## Available components` inventory (built straight off the `Catalog` you pass — the SAME authority the renderer validates against), few-shot exemplars from the judged corpus shard, and the mini-skill composition idioms. `produce()` calls it once per turn, outside the round loop."),u(3,`buildSystemPrompt() — derived from source`,`a2ui-agent-prompt`),n(p(a,`export function buildSystemPrompt(`),`ts`)),l.append(u(2,`Part D — the meta-line channel`),d("A reserved JSON line, emitted FIRST on the stream, ahead of any A2UI JSONL — carrying no `version` key, so it is provably NOT an `A2uiServerMessage` (every real server message carries `version`). `produce()` peels it off before heal/validate; it never reaches the shared validator and never enters the corpus path."),u(3,`A2uiMetaEnvelope — derived from source`,`a2ui-agent-meta-envelope`),n(f(o,`A2uiMetaEnvelope`),`ts`),n(p(o,`export function readMetaLine(`),`ts`),d("`note` is the model’s prose reply; `ask` (ADR-0097) routes a feed-embedded interactive surface; `plan` (ADR-0174) is the model’s own declared step list; `personaPatch` (ADR-0178) is an authoring turn’s persona-state delta; `trace` is the runtime-assembled per-turn decision record; `progress` (ADR-0146, opt-in via `ProduceOptions.progress`) INTERLEAVES live-turn lifecycle events — `sent` / `started` / `reasoning` / `content` / `validating` / `retry` / `tool` / `done` — strictly ahead of any content line. Every field is shallow-validated independently: a malformed one drops only itself, never the whole envelope."));var h=JSON.parse(s);l.append(u(2,`Part E — the package’s exports map`),d("The root `.` barrel re-exports NONE of this — a renderer-only consumer bundles zero producer bytes (the identity gate, ADR-0137 clause 8). `./agent` is the full, Node-first producer toolkit (Parts A–D). `./agent/meta-line` and `./agent/genui-line` are separate, additionally-exported subpaths: both modules are pure, zero-import TypeScript (no `node:fs`, no producer code) — so a BROWSER page that only needs the `TurnProgress`/`PlanDeclaration`/`AskDeclaration`/`GenuiEnvelope` wire TYPES (to type its own progress/plan UI, e.g. `ui-conversation`’s own turn handle) imports one of these two subpaths directly, never the whole Node-first `./agent` barrel."),n(JSON.stringify(h.exports,null,2),`json`)),l.append(u(2,`Part F — a runnable consumer example`),d("ADR-0137 clause 7’s consumer example, shown verbatim (shown ≡ shipped — this is the literal, checked-in, `npm run check`-typechecked script at `packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts`; `npm test` never runs it, since it needs a real API key by design). It holds its OWN key in its OWN env — this is NOT a second dev-proxy (that key-holding shell stays site-internal, ADR-0137 clause 3) — and wires `produce()`’s output straight at the render side, exactly as a browser would hand each validated line to `ingestLine()`."),n(c.trimEnd(),`ts`)),l.append(u(3,`Sources`),d("ADR-0137 (the `./agent` export — the portable core, the Node-first pack, the identity/SDK-free/ Node-fence gates, the clause-7 consumer example) · ADR-0069 (the layered demo + key-never-in-a-browser posture) · ADR-0073 (the `AgentProvider` seam) · ADR-0088 (the meta-line envelope + `note`/`trace`) · ADR-0097 (feed-embedded `ask`) · ADR-0146 (live-turn `progress`) · ADR-0174 (the `plan` declaration) · ADR-0178 (`personaPatch`) · TKT-0072 (the owning ticket). The derived blocks above import the live `src/agent/*.ts` source, the real `package.json`, and the real checked-in consumer example — if this page and the code disagree, the page is stale and its derivation is the bug."));