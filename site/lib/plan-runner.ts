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
 *  rejected (...): ... Continue"), adapted: names the failed step, states it contributed nothing (SPEC-R5 —
 *  `produce()` yields only fully validated lines, so a failed step never partially shipped), and instructs
 *  the model never to assume that step's output exists. */
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

/**
 * SPEC-R21 Consumption + Bounds — the pure decision: `declared` is already SHALLOW-VALIDATED
 * (`readMetaLine`'s per-field-independent guard, SPEC-R20) by the time it reaches here, so this function's
 * ONLY job is the step-cap check. `undefined` (no `plan` declared, or the model built/declined instead)
 * ⇒ `{consumed:false, reason:'none'}` — never an error, the plan-request turn simply stands as ordinary
 * output. Over cap ⇒ `{consumed:false, reason:'over-cap', ...}` — the host NEVER truncates/rewrites a
 * declaration it didn't author (the advisory law's flip side); the caller is responsible for surfacing the
 * ONE visible warning this refusal requires.
 */
export function consumePlan(declared: PlanDeclaration | undefined, cap: number = DEFAULT_PLAN_STEP_CAP): PlanConsumption {
  if (declared === undefined) return { consumed: false, reason: 'none' }
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
 *  already committed 200) and a genuinely thrown exception from `transport.turn()` (caught by the caller
 *  that opts into catch-and-continue; the plan-request/gate-off dispatch instead lets a throw propagate,
 *  matching "existing single-call failure semantics apply completely unchanged," SPEC-R22). `plan` carries
 *  whatever the model declared on THIS turn's meta-line, whether or not the caller consumes it — a runner-
 *  dispatched turn's own caller (`runPlan`) simply never reads it (no-recursion, SPEC-R21). */
interface TurnOutcome {
  content: string
  failed: boolean
  errorMessage?: string
  plan?: PlanDeclaration
}

/** Drive ONE `transport.turn()` call to completion, peeling every leading/interleaved meta-line the SAME
 *  way every other consumer in this codebase does (`readMetaLine` — never a page-local re-implementation):
 *  `note`/`ask`/`trace` are silently dropped (an ask on a runner-dispatched turn therefore degrades to its
 *  prose note by pure INACTION — SPEC-R21's "Asks during a run": no pending-ask machinery exists in this
 *  module at all, so there is nothing here that could ever mount one); `progress` forwards to `onProgress`
 *  when supplied; a terminal `error` meta-line short-circuits with `failed:true` WITHOUT throwing (the
 *  caller decides whether to rethrow); every non-meta line is content. A genuine exception from
 *  `transport.turn()` itself (a thrown `ProduceHalt`/network fault) is NOT caught here — it propagates to
 *  the caller, which decides per its own tier (SPEC-R22). */
async function drainTurn(transport: AgentTransport, input: TurnInput, onProgress?: (progress: TurnProgress) => void): Promise<TurnOutcome> {
  const lines: string[] = []
  let plan: PlanDeclaration | undefined
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
  return { content: lines.join('\n'), failed: false, plan }
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
   *  (`'done'`/`'failed'`/`'not-run'`). This module never touches `ui-status-stream` itself. */
  onStepState?: (groupKey: string, state: PlanStepState) => void
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
 * `AgentTransport` seam. A step's failure does NOT abort the run (SPEC-R22 tier 2): its group closes
 * `'failed'`, and the acknowledgment folds into the NEXT dispatch (the next step, or synthesis if the
 * failed step was last) — never a separate dispatch. A synthesis failure (tier 3) leaves every step's
 * already-rendered content standing (nothing here disposes anything — this module streams content into
 * `Session.turns` only, never a live surface). An aborted run (SPEC-R22 Abandon) dispatches nothing
 * further and closes every not-yet-dispatched group `'not-run'`.
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
    const outcome = await drainTurn(transport, input, (p) => onProgress?.(groupKey, p))
    session = appendUserTurn(session, text)
    session = appendAssistantTurn(session, outcome.content)
    if (outcome.failed) {
      onStepState?.(groupKey, 'failed')
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
  const synthOutcome = await drainTurn(transport, synthesisInput, (p) => onProgress?.(PLAN_SYNTHESIS_GROUP_KEY, p))
  session = appendUserTurn(session, synthesisText)
  session = appendAssistantTurn(session, synthOutcome.content)
  onStepState?.(PLAN_SYNTHESIS_GROUP_KEY, synthOutcome.failed ? 'failed' : 'done')
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
  onStepState?: (groupKey: string, state: PlanStepState) => void
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
