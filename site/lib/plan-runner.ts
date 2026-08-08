// plan-runner.ts — SPEC-R21/R22 (a2ui-live-agent.spec.md §3.2c, ADR-0174 cl.1/cl.3/cl.4/cl.6): the
// host-side sequential plan→execute→synthesize loop. Lives entirely ABOVE the `AgentTransport` seam
// (SPEC-R1): every turn this module dispatches is an ordinary `{kind:'intent', text, session}` `TurnInput`
// — the SAME shape `a2ui-chat.ts`/`a2ui-live.ts`/`gen-ui-live.ts` already fire at every turn index — so
// `produce()`, `ProduceOptions`, `ProduceDeps`, the dev proxy, and the Worker are byte-UNTOUCHED (ADR-0174
// cl.1/cl.3 Context: a plan run is, below the seam, indistinguishable from N ordinary chat turns). This
// module drives `transport.turn()` — it NEVER imports or calls `produce()` directly.
//
// Placement: site/app layer (ADR-0174's Repairs cell — "a new host-side plan-runner module, site/app
// layer"), pure of key/proxy/registry shapes (SPEC-N1's shell law). Consumes only the browser-safe seam
// re-exported by `./agent-runtime.ts` (the SAME shim `a2ui-live.ts`/`admin-live-runner.ts` already use) +
// the zero-dep `PlanStep`/`PlanDeclaration`/`TurnProgress` TYPES from `@agent-ui/a2ui/agent/meta-line`
// (`import type` only — erased at build, never a runtime module load, the `TurnProgress`/`TurnProgressStage`
// precedent `a2ui-live.ts` already sets).
//
// Two layers, kept deliberately separate (the §5 indicative trio's own split, "testable without a live
// model"):
//   1. PURE framing (`framePlanRequest`/`frameStepInstruction`/`frameSynthesis`) + the pure `consumePlan`
//      decision — no I/O, byte-deterministic, unit-testable with zero transport at all.
//   2. The imperative driver (`runPlan`/`runPlannerTurn`) — sequences `transport.turn()` calls and folds
//      the pure framing output into each dispatch's `TurnInput.text`.
//
// Advisory law (SPEC-R22 / ADR-0174 OF1): this module verifies NOTHING about a step's emitted content
// against its declaration — a group's terminal state is the CALL's outcome (done/failed), never a
// content-vs-description match. No plan-analogue of the `ask` field's surfaceId-integrity check is
// performed here, by design (Open fork OF1 stands, genuinely undecided).

import type { AgentTransport, Session, TurnInput } from './agent-runtime.ts'
import { appendAssistantTurn, appendUserTurn, readMetaLine } from './agent-runtime.ts'
import type { PlanDeclaration, PlanStep, TurnProgress } from '@agent-ui/a2ui/agent/meta-line'

// ── Pure framing (SPEC-R21 §5's `framePlanRequest`/`frameStepInstruction`/`frameSynthesis`) ────────────
//
// Each function is a plain string → string transform: called twice with the same input, it returns the
// SAME output (SPEC-R21 AC3). A step's own `id`/`description` ride verbatim — DATA from the declared plan,
// never admin-authored teaching prose (ADR-0174 cl.3/cl.6: "the step's own instruction text is DATA").

/**
 * Frame the host-owned plan-request turn (ADR-0174 cl.2's Consumption paragraph): the trigger text that
 * activates the GRAMMAR's request-triggered "Plan declarations:" teaching (SPEC-R6 AC6) — it does NOT
 * forbid the model from just building directly; a plan-request turn with no consumable `plan` declared
 * (the model built directly, declined, or over-declared) legally stands as an ordinary turn (SPEC-R21
 * Consumption).
 */
export function framePlanRequest(intent: string): string {
  return (
    `${intent}\n\n` +
    'Before building, lay out your plan for this request: break it into an ordered list of concrete steps ' +
    'and declare it on this turn (the "plan" field on your leading meta-line, per your instructions).'
  )
}

/**
 * Frame ONE step dispatch (SPEC-R21 Sequencing) — embeds the declared step's `id` + `description` verbatim
 * (AC3). `priorFailure`, when present, folds the SPEC-R22 tier-2 failure acknowledgment into THIS SAME
 * dispatch's user content — never a separate dispatch (the SPEC-R21 K+1 budget stays exact) — reusing the
 * `frameClientMessage` `error`-arm's cross-turn recovery SHAPE (session.ts: "The previous X was rejected
 * (...): ... Continue."), adapted to a plan step's own vocabulary so the model can never hallucinate the
 * missing work.
 */
export function frameStepInstruction(step: PlanStep, priorFailure?: PlanStep): string {
  const ack = priorFailure ? `${failureAcknowledgment(priorFailure)} ` : ''
  return `${ack}Plan step "${step.id}": ${step.description}`
}

/**
 * Frame the closing synthesis dispatch (ADR-0174 cl.4) — triggers the GRAMMAR's synthesis-turn mechanics
 * teaching (SPEC-R6 AC6, v0.11): "compose the final surface set from what the conversation already shows,"
 * never host-side assembly (SPEC-R5's validate-then-stream stays the ONLY path to a shipped surface).
 * `priorFailure` folds a FAILED LAST step's acknowledgment onto this dispatch (SPEC-R22: "a failed LAST
 * step's acknowledgment rides the synthesis dispatch").
 */
export function frameSynthesis(plan: PlanDeclaration, priorFailure?: PlanStep): string {
  const ack = priorFailure ? `${failureAcknowledgment(priorFailure)} ` : ''
  return (
    `${ack}Every one of the ${plan.steps.length} plan step${plan.steps.length === 1 ? '' : 's'} has now run. ` +
    'Compose the final surface set from what this conversation already shows — do not restate or re-plan.'
  )
}

/** SPEC-R22 tier-2 fold-in wording — the `frameClientMessage` error-arm shape ("The previous X was
 *  rejected (...): ... Continue"), adapted: names the failed step, states it contributed nothing, and
 *  instructs the model never to assume that step's output exists. This is FRAMING advice for the model's
 *  NEXT dispatch, not a claim about the recorded session: SPEC-R22's Advisory Law separately requires that
 *  "whatever validated content [a step] did emit renders as ordinary output," so a failed step MAY still
 *  have recorded some pre-fault content (#602 — `drainTurn`/`drainStepTurn` above). "Contributed nothing"
 *  binds the model's planning going forward, not the transcript. */
function failureAcknowledgment(step: PlanStep): string {
  return (
    `Note: plan step "${step.id}" ("${step.description}") failed to produce a valid surface — it ` +
    "contributed nothing. Continue with the plan; do not reference or assume that step's output exists."
  )
}

// ── Consumption (SPEC-R21 Consumption + Bounds) ─────────────────────────────────────────────────────────

/** The shipped default plan-step cap (SPEC-R21 Bounds: "indicative 8" — tunable without a spec change,
 *  the SPEC-R13 mini-skill-budget precedent). */
export const DEFAULT_PLAN_STEP_CAP = 8

export type PlanConsumption =
  | { consumed: true; plan: PlanDeclaration }
  | { consumed: false; reason: 'none' }
  | { consumed: false; reason: 'over-cap'; declaredSteps: number; cap: number }
  | { consumed: false; reason: 'duplicate-ids'; duplicateId: string }

/**
 * SPEC-R21 Consumption + Bounds — the pure decision: `declared` is already SHALLOW-VALIDATED
 * (`readMetaLine`'s per-field-independent guard, SPEC-R20) by the time it reaches here, so this function's
 * job is the step-cap check plus two cheap structural guards the SPEC leaves silent on:
 *   - a ZERO-step declaration ({steps:[]}) is treated as `{consumed:false, reason:'none'}` — the SAME
 *     "no consumable plan" outcome an absent `plan` field gets. Consuming it would drive a K=0 run whose
 *     only dispatch is a lone, contextless synthesis turn — a vacuous shape SPEC-R21's own "K steps + 1
 *     synthesis" framing never contemplates (K is always presented as a positive step count).
 *   - DUPLICATE declared step ids are REJECTED, never deduped/renamed: two steps sharing one `id` would
 *     collide onto the SAME status-stream group key (`planStepGroupKey`, derived FROM the declared id), so
 *     their `pending`/`running`/terminal states and progress events would overwrite/interleave under one
 *     key — a silent projection corruption, not a visible failure. The SPEC is silent on this case; reject
 *     (never consumed) is the choice made here, on the SAME "the host never rewrites a declaration it
 *     didn't author" ground the over-cap refusal already stands on (a dedupe/rename would be exactly that
 *     rewrite). Checked BEFORE the cap (a duplicate-id plan is malformed regardless of its length).
 * `undefined` (no `plan` declared, or the model built/declined instead) ⇒ `{consumed:false, reason:'none'}`
 * — never an error, the plan-request turn simply stands as ordinary output. Over cap ⇒
 * `{consumed:false, reason:'over-cap', ...}` — the caller is responsible for surfacing the ONE visible
 * warning THAT refusal requires (SPEC-R21 Bounds); the zero-step/duplicate-id refusals carry no such
 * requirement (the SPEC's visible-warning language is over-cap-specific: "the model's note announced a
 * plan" — a genuinely malformed declaration was never announced as a usable one).
 */
export function consumePlan(declared: PlanDeclaration | undefined, cap: number = DEFAULT_PLAN_STEP_CAP): PlanConsumption {
  if (declared === undefined) return { consumed: false, reason: 'none' }
  if (declared.steps.length === 0) return { consumed: false, reason: 'none' } // a vacuous plan is "no plan"
  const seen = new Set<string>()
  for (const s of declared.steps) {
    if (seen.has(s.id)) return { consumed: false, reason: 'duplicate-ids', duplicateId: s.id }
    seen.add(s.id)
  }
  if (declared.steps.length > cap) return { consumed: false, reason: 'over-cap', declaredSteps: declared.steps.length, cap }
  return { consumed: true, plan: declared }
}

// ── Projection keys (SPEC-R21 Projection — ADR-0146 F5 `parent` groups, ADR-0159's receipt pattern) ─────
//
// Stable, deterministic group keys a caller feeds straight to `ui-status-stream`'s `appendEntry({key,
// parent})` (`status-stream.ts`) — this module never imports or touches that component itself (SPEC-R21:
// "the runner never touches the component itself"; "NO new component may be introduced").

/** A step's group key — derived from the declared step `id` (SPEC-R21 Projection: "a stable per-step
 *  `parent` key derived from the declared step `id`"). */
export function planStepGroupKey(stepId: string): string {
  return `plan-step:${stepId}`
}

/** The synthesis turn's group key — a stable, HOST-derived key (SPEC-R21 Projection), distinct from any
 *  declared step id by construction (the `plan-step:` prefix step keys carry, this one deliberately lacks). */
export const PLAN_SYNTHESIS_GROUP_KEY = 'plan-synthesis'

export type PlanStepState = 'pending' | 'running' | 'done' | 'failed' | 'not-run'

// ── The imperative driver ───────────────────────────────────────────────────────────────────────────────

/** One dispatch's outcome — `failed` folds BOTH failure shapes SPEC-R22 tiers 2/3 govern uniformly: a
 *  transport-composed terminal `error` meta-line (GH #144 — a `ProduceHalt`/upstream fault AFTER headers
 *  already committed 200) and a genuinely thrown exception from `transport.turn()` (caught by
 *  `drainStepTurn` below, the caller that opts into catch-and-continue; the plan-request/gate-off dispatch
 *  instead lets a throw propagate via plain `drainTurn`, matching "existing single-call failure semantics
 *  apply completely unchanged," SPEC-R22). On EITHER failure shape, `content` may still carry whatever
 *  lines streamed before the fault (#602 — SPEC-R22's Advisory Law: "whatever validated content it did
 *  emit renders as ordinary output," unconditional on the call's terminal state); it is never a claim that
 *  the step succeeded. `plan` carries whatever the model declared on THIS turn's meta-line, whether or not
 *  the caller consumes it — a runner-dispatched turn's own caller (`runPlan`) simply never reads it
 *  (no-recursion, SPEC-R21). */
interface TurnOutcome {
  content: string
  failed: boolean
  errorMessage?: string
  plan?: PlanDeclaration
}

/** #602 — a genuine mid-stream throw's PARTIAL content: whatever lines had already been yielded (and,
 *  through the page's `renderingTransport` wrapper, already painted to the canvas line-by-line) before
 *  `transport.turn()` faulted. Thrown ONLY by `drainTurn` below, carrying the SAME `Error.message` the raw
 *  cause had, so a plain `(e as Error).message` read (every existing caller's own handling) is untouched;
 *  `.partialLines` is the ADDITIVE part a catching caller (`drainStepTurn`) reads to keep the render-vs-
 *  record arms consistent with the pre-existing meta-line arm below (`content: lines.join('\n')` on an
 *  `error` meta-line already retains pre-fault lines the SAME way). */
class PartialTurnError extends Error {
  readonly partialLines: readonly string[]
  constructor(cause: unknown, partialLines: readonly string[]) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.partialLines = partialLines
  }
}

/** Drive ONE `transport.turn()` call to completion, peeling every leading/interleaved meta-line the SAME
 *  way every other consumer in this codebase does (`readMetaLine` — never a page-local re-implementation):
 *  `note`/`ask`/`trace` are silently dropped (an ask on a runner-dispatched turn therefore degrades to its
 *  prose note by pure INACTION — SPEC-R21's "Asks during a run": no pending-ask machinery exists in this
 *  module at all, so there is nothing here that could ever mount one); `progress` forwards to `onProgress`
 *  when supplied; a terminal `error` meta-line short-circuits with `failed:true` WITHOUT throwing (the
 *  caller decides whether to rethrow), its `content` already keeping whatever lines preceded that terminal
 *  line; every non-meta line is content. A genuine exception from `transport.turn()` itself (a thrown
 *  `ProduceHalt`/network fault) propagates to the caller (SPEC-R22 decides per its own tier) — as of #602 it
 *  is wrapped in `PartialTurnError` first (same `.message`, plus whatever `lines` had already accumulated),
 *  so a catching caller can keep pre-fault content consistent with the `error`-meta-line branch above; a
 *  caller that just lets it propagate (`runPlannerTurn`'s plan-request/gate-off dispatches) never reads the
 *  added `.partialLines` field and sees no behavior change. */
async function drainTurn(transport: AgentTransport, input: TurnInput, onProgress?: (progress: TurnProgress) => void): Promise<TurnOutcome> {
  const lines: string[] = []
  let plan: PlanDeclaration | undefined
  try {
    for await (const line of transport.turn(input)) {
      const meta = readMetaLine(line)
      if (meta !== undefined) {
        if (typeof meta.a2uiMeta.error === 'string' && meta.a2uiMeta.error.length > 0) {
          return { content: lines.join('\n'), failed: true, errorMessage: meta.a2uiMeta.error, plan }
        }
        if (meta.a2uiMeta.progress !== undefined) onProgress?.(meta.a2uiMeta.progress)
        if (meta.a2uiMeta.plan !== undefined) plan = meta.a2uiMeta.plan
        continue // note/ask/trace/plan are never ingested as content — the meta-line peel every consumer shares
      }
      lines.push(line)
    }
  } catch (e) {
    throw new PartialTurnError(e, lines)
  }
  return { content: lines.join('\n'), failed: false, plan }
}

/** GH #592 fix — the "caller that opts into catch-and-continue" the `TurnOutcome` doc above promises.
 *  `runPlan`'s step/synthesis dispatches are the ONLY callers that route through here: a genuinely THROWN
 *  `transport.turn()` exception (a network fault, a rejected promise — as opposed to a completed turn's
 *  transport-composed `error` meta-line) is folded into the SAME `failed:true` outcome shape a `drainTurn`
 *  error-meta-line already produces. SPEC-R22 tier 2/3 ("a step's/synthesis's failure does NOT abort the
 *  run") therefore governs identically regardless of HOW the dispatch failed; `runPlan`'s own failure
 *  handling below (group→failed, fold-in acknowledgment, run continues) never has to know which happened.
 *  The plan-request/gate-off dispatch (`runPlannerTurn`) deliberately calls plain `drainTurn` instead —
 *  its throw propagates unchanged, matching SPEC-R22's "the plan turn's own failure is the one true abort."
 *
 *  #602 — `content` keeps whatever lines streamed before the fault (`PartialTurnError.partialLines`) rather
 *  than discarding them: a mid-stream throw is otherwise the ONLY place partial pre-fault content used to
 *  vanish from the recorded session while the SAME lines had already painted the canvas per-line through
 *  the page's `renderingTransport` wrapper — a render-vs-record divergence (the session claiming the user
 *  never saw what they, in fact, already saw). The meta-line branch above never had this bug (it already
 *  retains pre-error `lines`); this brings the throw arm to the SAME rule rather than the reverse (dropping
 *  the meta-line arm's content too) — SPEC-R22's Advisory Law text is explicit that "whatever validated
 *  content it did emit renders as ordinary output" REGARDLESS of the call's terminal state, so retaining
 *  pre-fault content on a failure is spec-consistent, not merely spec-silent. This does NOT change the
 *  fold-in acknowledgment's wording (`failureAcknowledgment` below still tells the model the step
 *  "contributed nothing" and to never rely on its output) — that instruction is FRAMING advice for the next
 *  dispatch, not a claim about what the transcript records; SPEC-R22's "contributed ZERO wire content" line
 *  binds that framing contract, not the session's content field. */
async function drainStepTurn(transport: AgentTransport, input: TurnInput, onProgress?: (progress: TurnProgress) => void): Promise<TurnOutcome> {
  try {
    return await drainTurn(transport, input, onProgress)
  } catch (e) {
    const partialLines = e instanceof PartialTurnError ? e.partialLines : []
    return { content: partialLines.join('\n'), failed: true, errorMessage: e instanceof Error ? e.message : String(e) }
  }
}

// ── Display honesty — a sanitized, ONE-LINE failure reason for a status entry ONLY (#602) ─────────────────
//
// `TurnOutcome.errorMessage` is transport/upstream-controlled text (a `ProduceHalt` fault's message or a
// raw thrown exception's `.message`) that MAY carry sensitive fragments — an upstream fault echoing back a
// header, a stack frame with an embedded credential. `sanitizeFailureReason` is the ONE place that text is
// allowed to reach a rendered surface: the failed group's status-entry LABEL, via `onStepState`'s `reason`
// argument (`runPlan` below). It goes ONLY there — it is NEVER folded into `frameStepInstruction`/
// `frameSynthesis` (the fold-in acknowledgment's wording is fixed, step id/description only —
// `failureAcknowledgment` above never reads `errorMessage`/`reason` at all), so there is no path from a raw
// upstream message into a turn the model ever sees.

/** A key/token/bearer-shaped credential run: one of the listed keywords, an optional `:`/`=` separator, then
 *  a contiguous alnum/`.`/`_`/`~`/`+`/`/`/`-` run of 8+ chars that (via the lookahead) contains at least one
 *  digit or symbol — excludes plain English words that happen to follow one of the keywords ("token
 *  expired", "unauthorized" after "Authorization") while still catching the shapes a real leaked secret/API
 *  key/bearer token/JWT segment actually takes. Conservative in the security sense (biased toward stripping
 *  over leaking), not in the sense of matching rarely. */
const CREDENTIAL_SHAPE =
  /\b(api[-_ ]?key|apikey|access[-_ ]?token|refresh[-_ ]?token|token|secret|bearer|authorization|password|passwd)\b\s*[:=]?\s*(?=\S*[0-9._~+/-])[A-Za-z0-9._~+/-]{8,}/gi

/** A bare JWT-shaped substring (three dot-separated base64url segments, header starting `eyJ` — base64 for
 *  `{"`) — distinctive enough to redact with NO keyword context required. */
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g

/** A status label is ONE line, not a log dump. */
const MAX_REASON_LENGTH = 120

/**
 * #602 — the ONE sanitized line of `TurnOutcome.errorMessage` a failed group's status entry may show. Pure,
 * never throws:
 *   1. collapses to ONE line (embedded newlines/CR → a single space — a raw multi-line fault/stack trace
 *      must never blow up a one-line status label);
 *   2. strips any key/token/bearer-shaped substring (`CREDENTIAL_SHAPE`/`JWT_SHAPE` above) to `[redacted]`;
 *   3. truncates to `MAX_REASON_LENGTH` (120) chars total, trailing `…` marker included in the count.
 * An empty/whitespace-only message degrades to a fixed fallback string, never an empty label.
 */
export function sanitizeFailureReason(message: string): string {
  const oneLine = message.replace(/[\r\n]+/g, ' ').trim()
  if (oneLine.length === 0) return 'unspecified error'
  const redacted = oneLine.replace(CREDENTIAL_SHAPE, '$1 [redacted]').replace(JWT_SHAPE, '[redacted]')
  return redacted.length > MAX_REASON_LENGTH ? `${redacted.slice(0, MAX_REASON_LENGTH - 1)}…` : redacted
}

export interface RunPlanOptions {
  transport: AgentTransport
  /** The session AFTER the plan-request turn (the plan turn INCLUDED) — SPEC-R21 Sequencing: "step N's
   *  dispatched session MUST contain every prior turn (the plan turn included)." */
  session: Session
  /** The CONSUMED, FROZEN declaration (SPEC-R21 Consumption: "the consumed plan is FROZEN at consumption —
   *  nothing declared mid-run restructures the running loop"). Already within the step cap. */
  plan: PlanDeclaration
  /** Checked before every future dispatch (SPEC-R22 Abandon). `AgentTransport.turn()` itself takes no
   *  signal parameter — there is no way to cancel an in-flight call through this seam — so an abort mid-
   *  dispatch never interrupts that ONE in-flight call ("the in-flight call's own signal semantics apply
   *  unchanged," SPEC-R22); it only stops the runner from STARTING anything further. */
  signal?: AbortSignal
  /** The status-stream projection seam (SPEC-R21 Projection) — `groupKey` is the ALREADY-DERIVED per-step/
   *  synthesis group key (`planStepGroupKey(step.id)` for a step, `PLAN_SYNTHESIS_GROUP_KEY` for synthesis),
   *  ADR-0146 F5's `parent` key. Fires `'pending'` for every K+1 group up front (seeding, on consumption),
   *  then `'running'` immediately before that group's dispatch, then exactly one terminal state
   *  (`'done'`/`'failed'`/`'not-run'`). This module never touches `ui-status-stream` itself. A `'failed'`
   *  terminal state additionally carries `reason` — a SANITIZED, ≤120-char, ONE-line string derived from
   *  `TurnOutcome.errorMessage` via `sanitizeFailureReason` (#602 display honesty). `reason` is ALWAYS
   *  absent for every other state; it is the ONLY place `errorMessage`-derived text reaches a caller — it
   *  NEVER rides any dispatch (`frameStepInstruction`/`frameSynthesis`'s fold-in acknowledgment is fixed
   *  wording, unrelated to this string). */
  onStepState?: (groupKey: string, state: PlanStepState, reason?: string) => void
  /** Forwards each dispatch's OWN `TurnProgress` events under its group key (SPEC-R21 Projection: "project
   *  each dispatch's own TurnProgress events as children under its group"). `TURN_PROGRESS_STAGES` is never
   *  widened by this module — these are the SAME closed-vocabulary events `produce()` already emits. */
  onProgress?: (groupKey: string, progress: TurnProgress) => void
}

/**
 * SPEC-R21 Sequencing/Synthesis + SPEC-R22 — drive a CONSUMED, frozen K-step plan to completion: exactly
 * one turn per step in declared order, plus exactly one closing synthesis turn (K+1 dispatches total,
 * never more). Every dispatch is a plain `{kind:'intent'}` `TurnInput` over the SAME growing `Session`
 * (the UNCHANGED `appendUserTurn`/`appendAssistantTurn` reducers) — nothing plan-shaped ever crosses the
 * `AgentTransport` seam. A step's failure does NOT abort the run (SPEC-R22 tier 2) — WHETHER the dispatch
 * completed with a transport-composed `error` meta-line OR `transport.turn()` itself threw (GH #592: both
 * route through `drainStepTurn`'s catch-and-continue into the SAME `failed:true` outcome, `content`
 * included — #602): its group closes `'failed'` carrying a sanitized `reason` (#602 display honesty), and
 * the acknowledgment folds into the NEXT dispatch (the next step, or synthesis if the failed step was
 * last) — never a separate dispatch. A synthesis failure (tier 3) leaves every step's already-rendered
 * content standing (nothing here disposes anything — this module streams content into `Session.turns`
 * only, never a live surface). An aborted run (SPEC-R22 Abandon) dispatches nothing further and closes
 * every not-yet-dispatched group `'not-run'`.
 */
export async function runPlan(opts: RunPlanOptions): Promise<Session> {
  const { transport, plan, signal, onStepState, onProgress } = opts
  let session = opts.session
  let priorFailure: PlanStep | undefined

  // Seed all K+1 groups up front, at consumption (SPEC-R21 Projection) — before any dispatch begins.
  for (const step of plan.steps) onStepState?.(planStepGroupKey(step.id), 'pending')
  onStepState?.(PLAN_SYNTHESIS_GROUP_KEY, 'pending')

  for (const step of plan.steps) {
    const groupKey = planStepGroupKey(step.id)
    if (signal?.aborted) {
      onStepState?.(groupKey, 'not-run')
      continue // Abandon: dispatch nothing further, but still report every remaining group honestly
    }
    onStepState?.(groupKey, 'running')
    const text = frameStepInstruction(step, priorFailure)
    const input: TurnInput = { kind: 'intent', text, session }
    const outcome = await drainStepTurn(transport, input, (p) => onProgress?.(groupKey, p))
    session = appendUserTurn(session, text)
    session = appendAssistantTurn(session, outcome.content)
    if (outcome.failed) {
      onStepState?.(groupKey, 'failed', sanitizeFailureReason(outcome.errorMessage ?? ''))
      priorFailure = step
    } else {
      onStepState?.(groupKey, 'done')
      priorFailure = undefined
    }
  }

  if (signal?.aborted) {
    onStepState?.(PLAN_SYNTHESIS_GROUP_KEY, 'not-run')
    return session
  }
  onStepState?.(PLAN_SYNTHESIS_GROUP_KEY, 'running')
  const synthesisText = frameSynthesis(plan, priorFailure)
  const synthesisInput: TurnInput = { kind: 'intent', text: synthesisText, session }
  const synthOutcome = await drainStepTurn(transport, synthesisInput, (p) => onProgress?.(PLAN_SYNTHESIS_GROUP_KEY, p))
  session = appendUserTurn(session, synthesisText)
  session = appendAssistantTurn(session, synthOutcome.content)
  onStepState?.(
    PLAN_SYNTHESIS_GROUP_KEY,
    synthOutcome.failed ? 'failed' : 'done',
    synthOutcome.failed ? sanitizeFailureReason(synthOutcome.errorMessage ?? '') : undefined,
  )
  return session
}

export interface RunPlannerTurnOptions {
  transport: AgentTransport
  session: Session
  /** The user's raw intent for this turn (the SAME text a plain `{kind:'intent'}` dispatch would carry). */
  intent: string
  /** ADR-0174 cl.1 — the persona-scoped, `ProduceOptions`-adjacent opt-in gate: read by the HOST LOOP
   *  (here) BEFORE deciding which shape to run, never inside `produce()` itself. Absent/`false` ⇒ the
   *  single-`produce()`-call microloop runs exactly as it does today, byte-identical — INCLUDING when the
   *  model volunteers a `plan` declaration anyway (SPEC-R20's degrade law: the host never consumes it). */
  plannerEnabled: boolean
  stepCap?: number
  signal?: AbortSignal
  /** See `RunPlanOptions.onStepState` — forwarded verbatim to `runPlan` below, `reason` included (#602). */
  onStepState?: (groupKey: string, state: PlanStepState, reason?: string) => void
  onProgress?: (groupKey: string, progress: TurnProgress) => void
  /** SPEC-R21 Bounds — fires ONCE when a declared plan exceeds the step cap (zero step dispatches follow).
   *  The caller is responsible for the ONE visible warning-state status entry this refusal requires
   *  ("the model's note announced a plan, so silent non-execution would lie by omission"). */
  onRefused?: (info: { declaredSteps: number; cap: number }) => void
}

/**
 * The single entry point a page calls INSTEAD OF dispatching `transport.turn({kind:'intent', ...})`
 * directly (SPEC-R21 AC1/AC2's own framing: "the runner with planner mode OFF/absent"). Composes the
 * opt-in gate (cl.1) + plan-request dispatch + consumption (Consumption) + the K+1 driver (`runPlan`)
 * into one call, so a page's turn-dispatch call site is a ONE-LINE swap regardless of gate state.
 *
 * Gate OFF/absent: dispatches exactly `intent` as a plain turn — byte-identical to today's single-turn
 * path, including a thrown/`error`-meta-line failure propagating EXACTLY as it does today (no session
 * mutation on failure — "existing single-call failure semantics," SPEC-R22).
 *
 * Gate ON: dispatches a host-framed plan-request turn first. That turn's OWN failure is the one true
 * abort (SPEC-R22: "no steps have run, no partial session exists") — this function does NOT catch it; it
 * propagates exactly like the gate-off path's failure. On completion, a well-formed, within-cap `plan`
 * declaration is consumed and driven by `runPlan`; anything else (no `plan`, over-cap) leaves the
 * plan-request turn standing as ordinary output — the loop simply never starts (never an error).
 */
export async function runPlannerTurn(opts: RunPlannerTurnOptions): Promise<Session> {
  const { transport, intent, plannerEnabled, signal, onStepState, onProgress, onRefused } = opts

  if (!plannerEnabled) {
    const input: TurnInput = { kind: 'intent', text: intent, session: opts.session }
    const outcome = await drainTurn(transport, input)
    if (outcome.failed) throw new Error(outcome.errorMessage ?? 'Live agent turn failed.')
    let session = appendUserTurn(opts.session, intent)
    session = appendAssistantTurn(session, outcome.content)
    return session
  }

  const planText = framePlanRequest(intent)
  const planInput: TurnInput = { kind: 'intent', text: planText, session: opts.session }
  const planOutcome = await drainTurn(transport, planInput)
  if (planOutcome.failed) throw new Error(planOutcome.errorMessage ?? 'Live agent turn failed.') // the ONE true abort (SPEC-R22)
  let session = appendUserTurn(opts.session, planText)
  session = appendAssistantTurn(session, planOutcome.content)

  const consumption = consumePlan(planOutcome.plan, opts.stepCap ?? DEFAULT_PLAN_STEP_CAP)
  if (!consumption.consumed) {
    if (consumption.reason === 'over-cap') onRefused?.({ declaredSteps: consumption.declaredSteps, cap: consumption.cap })
    return session // no consumable plan — the plan-request turn stands as ordinary output (Consumption)
  }

  return runPlan({ transport, session, plan: consumption.plan, signal, onStepState, onProgress })
}
