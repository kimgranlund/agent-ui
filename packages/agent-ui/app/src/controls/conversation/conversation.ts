// conversation.ts — UIConversationElement, the M2 thread/composer/narration primitive (LLD-C4/C5 ·
// SPEC-R4/R5/R6/R7; ADR-0129 clauses 2/3). BEHAVIOUR + props + the internal per-surface registry +
// narration + self-define ONLY; the thread/bubble layout lives in conversation.css, the public contract
// in conversation.md. The message-COMPOSITION UI itself (TKT-0056) is a separate composed child,
// `ui-conversation-composer` (own `.ts`/`.css`/`.md`) — this file forwards props down and callbacks up to
// it (the master-detail.ts → ui-split precedent), it does not build the composer's own DOM.
//
// Renders its OWN internal thread (user/agent/system bubbles) + composer — never author-composed, driven
// entirely through the imperative API (SPEC-R4). Composes `ui-surface-host` INTERNALLY, one instance per
// OPEN A2UI surface (ADR-0129 clause 2) — generalizing `site/lib/surface-registry.ts`'s per-surface
// lifecycle (itself a generalization of `site/lib/ask-registry.ts`, ADR-0097 §2) as this element's OWN
// mechanism: a fresh `surfaceId` mounts a NEW `ui-surface-host` inline in that turn's own bubble; a KNOWN
// `surfaceId` (open or closed) routes to that surface's ORIGINAL host, at its original bubble — never a
// new mount for the same id (persistent identity across turns); a `deleteSurface` line disposes that ONE
// surface's host and leaves a VISIBLE, non-removable "Closed." annotation — history is never silently
// removed (SPEC-R7). This composition is edge-to-edge sound only because the accepted ADR-0128 makes a
// resent, already-mounted container's record reconcile correctly — a precondition this file assumes.
//
// `onSubmit`/`onClientMessage` are callback registrations, NEVER `CustomEvent`s (SPEC-R5) — the closed
// six-event vocabulary (`change · input · select · open · close · toggle`, references/naming.md §4) has no
// submission/client-message kind, and inventing a seventh is an ADR-gated admission this SPEC declines to
// request; callback registration follows the shipped `RendererHost.onClientMessage` precedent exactly.
//
// Narration (SPEC-R6, ADR-0088, ADR-0146): each agent turn composes a fresh `ui-status-stream` (with its
// opt-in streaming header set — ADR-0146 F8, so the strip reads "working" from t=0, closing the blank-
// bubble symptom at its root), categorizing lines via the SAME envelope-key inspection technique
// `a2ui-live.ts`'s `summarize()`/`a2ui-chat.ts`'s `categoryOf` already use — promoted UNCHANGED, never
// re-invented. Categories narrate LIVE-AT-INGEST now (ADR-0146 SPEC-R6 amendment): a category's entry
// appears the moment its FIRST line is ingested (`active` during the turn, `done` at finalize) — never the
// old post-hoc replay at finalize() (the `NARRATION_STEP_MS` pacing + `narrateCategories` replay are DELETED,
// not stranded). The turn's live lifecycle progress (ADR-0146 F1) routes through `AgentTurnHandle.progress`
// into the SAME strip via a CLOSED code-owned stage-label table (never model text — the F2 honesty guard).
// Narration ships unconditionally (no opt-out); the raw-wire `<details>` disclosure is gated behind the
// OPT-IN `disclosure` prop (default false, ADR-0129 clause 3) — the mechanism is rebuilt dependency-free
// here (no `@agent-ui/code` import; `site/lib/code-block.ts`'s syntax highlighting was page-local chrome,
// not part of this SPEC's contract) as a plain `<pre>` dump of the pretty-printed JSONL — same functional
// disclosure, no new dependency.
//
// SPEC-R12 (TKT-0071, added 2026-07-16): agent-turn `note` text and system-bubble text render through an
// OPTIONAL `setContentRenderer` hook instead of bare `textContent` when a consumer registers one — this
// file still imports NOTHING from `@agent-ui/code`; the renderer function itself (e.g. one backed by
// `ui-markdown`) is entirely consumer-supplied at the app/site layer, which already has permission to
// import that package. `addUserMessage` never routes through it (SPEC-R4 AC1 unchanged).
//
// RESOLVED LLD GAP (ADR-0146): the shipped build's own NAMED GAP flagged that SPEC §4's `AgentTurnHandle`
// exposed exactly four methods with no reachable call site to SUPPLY a fifth narration input — declining to
// widen the contract unilaterally, it surfaced the "widen `AgentTurnHandle` or drop the promotion note"
// fork to the design seat. ADR-0146 F1/F8 rules WIDEN: the handle gains `progress(ev: TurnProgress)` (the
// §4 contract change the app-surfaces-m2 amendment records), routing the live-turn lifecycle channel into
// the strip. (The LLD's `narrateTrace`/`TurnTrace` is a separate browser-side DIAGNOSTIC, not a narration
// entry — it stays out of this narration surface, unchanged by this widening.)

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { UIStatusStreamElement } from '@agent-ui/components/components'
import '../surface-host/surface-host.ts' // registers <ui-surface-host> — composed internally (ADR-0129 clause 2)
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
import type { ClientMessageListener } from '@agent-ui/a2ui'
// ADR-0146 F1: the live-turn progress vocabulary is produce-layer-owned (a2ui) — imported TYPE-ONLY (it
// erases at build, so zero producer bytes cross the ADR-0137 identity gate) as the shared spine both the
// pipeline (produce()) and this narration surface consume, so the two never drift. Imported from the PURE
// `meta-line` module (not the `./agent` barrel) so the app/site type-check never drags in the barrel's
// NODE-FIRST modules (system-prompt/mini-skills `readFileSync` at load — no node types under those tsconfigs).
import type { TurnProgress, TurnProgressStage } from '@agent-ui/a2ui/agent/meta-line' // cross-package specifier stays extensionless (the repo's own local-.ts-only convention) — a2ui/package.json exports this as its own subpath
import './conversation-composer.ts' // registers <ui-conversation-composer> (TKT-0056) — composed internally, the master-detail.ts → ui-split precedent
import type { UIConversationComposerElement } from './conversation-composer.ts'
import type { PickerOption, ContextItem } from './composer-options.ts'

const props = {
  // OPT-IN raw-wire disclosure (ADR-0129 clause 3) — reflected, default false. Narration itself (below)
  // ships unconditionally; this gates only the per-turn `<details>` wire dump, a debugging/inspection
  // affordance most product surfaces should not show by default.
  disclosure: { ...prop.boolean(false), reflect: true },

  // Vision rev.5 (agent-admin's Agent master switch) — the whole-conversation availability gate: while
  // true the composer renders busy-disabled (same visual/behavioral state as a turn in flight, ONE
  // mechanism) and `#send` no-ops. Orthogonal to the TKT-0034 in-flight COUNT — the two OR together at
  // every reflect site, so flipping this mid-turn can never unstick or double-free the busy counter.
  disabled: { ...prop.boolean(false), reflect: true },

  // GH #239/ADR-0159 — the OPT-IN receipt pattern for the per-turn narration strip (Kim's 2026-07-23
  // ruling): when true, every turn's `ui-status-stream` gets BOTH stream-level opt-ins (`oneline` — the
  // live one-morphing-line mode — and `receipt` — the terminal one-line receipt). Reflected, default
  // false: every existing consumer keeps the always-expanded narration byte-identically.
  receipt: { ...prop.boolean(false), reflect: true },

  // ── The opt-in composer capabilities (the Figma chat-input refactor) ────────────────────────────────
  // Every one below defaults to undefined/empty, so an existing consumer that never sets them (a2ui-chat,
  // a2ui-live) gets the ORIGINAL field+Send composer, unchanged. A consumer (e.g. ui-agent-admin) opts in
  // by supplying its own option list + selected value; ui-conversation stays generic — it never names a
  // model or hardcodes "Effort"'s levels beyond the shared `EFFORT_LEVELS` constant a consumer may reuse.
  models: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  model: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  efforts: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  effort: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // `undefined`, not `[]` (the schema/store/models/efforts precedent) — an array literal default cannot
  // round-trip through the descriptor's `default:` token (ADR-0004); forwarded straight through to the
  // composed `ui-conversation-composer` child (TKT-0056), which coalesces to `[]` at its own read site.
  contextItems: { ...prop.json<readonly ContextItem[] | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

/** The imperative per-turn driver the APP'S OWN transport loop calls — NOT a DOM type (SPEC-R8). */
export interface AgentTurnHandle {
  /** Routes one raw A2UI JSONL line by `surfaceId` to a fresh/known `ui-surface-host`, or narrates a
   *  no-surface line under this turn's own category tracking. */
  ingestLine(line: string): void
  /** Stashes this turn's own prose note (ADR-0088); rendered verbatim at `finalize()` — never a fabricated sentence. */
  setNote(text: string): void
  /** ADR-0146 F1/F8 — routes one live-turn lifecycle event into the narration strip through a CLOSED,
   *  code-owned stage-label table (never model text, never a fabricated/speculative claim — the F2 honesty
   *  guard; an unobserved/unknown stage renders NOTHING). The fifth handle method the app-surfaces-m2 §4
   *  amendment records. A consumer that never calls it is byte-behavior-unchanged. */
  progress(ev: TurnProgress): void
  /** Ends narration, renders the note (or a factual fallback tally), and settles every surface host this turn touched. */
  finalize(): void
  /** A thrown turn (SPEC-R6 AC3): narration truncates with an error entry, a system bubble surfaces `message`, still finalizes cleanly. */
  fail(message: string): void
}

type Role = 'user' | 'agent' | 'system'
type SurfaceState = 'open' | 'closed'

interface SurfaceRecord {
  readonly host: UISurfaceHostElement
  readonly bubble: HTMLElement
  state: SurfaceState
}

// ── narration categories (LLD-C5, SPEC-R6) — promoted UNCHANGED from a2ui-chat.ts ─────────────────────────

type Category = 'open' | 'restructure' | 'react' | 'close'

/** A stage/category label PAIR (GH #238/ADR-0159): the progressive `live` form while the step runs, the
 *  quiet past-tense `done` form stamped ON the transition to done — a done checkmark never wears an
 *  "-ing…" label again (Kim's 2026-07-23 receipt-pattern ruling, part 1). A step that never finishes
 *  (truncated/failed) keeps its `live` form — the done form is never claimed for work not completed. */
interface LabelPair {
  live: string
  done: string
}

const LABEL: Record<Category, LabelPair> = {
  open: { live: 'Opening a new surface…', done: 'Opened a new surface' },
  restructure: { live: 'Updating the surface…', done: 'Updated the surface' },
  react: { live: 'Updating data…', done: 'Updated data' },
  close: { live: 'Closing the surface…', done: 'Closed the surface' },
}

/** The SAME envelope-key inspection technique a2ui-live.ts's summarize()/a2ui-chat.ts's categoryOf already
 *  use — never a re-invented parser. `undefined` for an envelope kind narration has no category for. */
function categoryOf(line: string): Category | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, unknown>
  if ('createSurface' in m) return 'open'
  if ('updateComponents' in m) return 'restructure'
  if ('updateDataModel' in m) return 'react'
  if ('deleteSurface' in m) return 'close'
  return undefined
}

/** `surfaceId` targeted by one raw A2UI JSONL line — `undefined` for an envelope kind with no surface
 *  context (e.g. `callFunction`) or an unparseable line. Never throws. Promoted from ask-registry.ts. */
function surfaceIdOf(line: string): string | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, { surfaceId?: unknown } | undefined>
  for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const) {
    const body = m[key]
    if (body && typeof body.surfaceId === 'string') return body.surfaceId
  }
  return undefined
}

function isDeleteSurfaceFor(line: string, id: string): boolean {
  try {
    const msg = JSON.parse(line) as { deleteSurface?: { surfaceId?: string } }
    return msg.deleteSurface?.surfaceId === id
  } catch {
    return false
  }
}

// The closed, code-owned progress stage → label table (ADR-0146 F2/F8) — factual PROCESS labels keyed 1:1
// to a REAL observed lifecycle signal, NEVER model text, never a speculative/decorative claim (no invented
// percentages, no "almost done…"). A stage ABSENT from this table renders NOTHING — an unobserved/unknown
// stage is never shown (the honesty-law guard, asserted as a negative control). The `retry` label composes
// the real self-correct round ordinal in at call time (a factual number, not fabricated prose).
// GH #238/ADR-0159: each stage is a live/done PAIR (see LabelPair) — the done form stamps on the entry's
// transition to done, quiet past-tense, claude.ai's register. `sent` is already a completed fact (its two
// forms coincide); `done` is the settle signal itself, never rendered as its own row (routeProgress).
// This table remains THE single owning site of the stage vocabulary's rendering — the F2 closed-table
// guard (meta-line.ts's closed `TurnProgressStage` union at the wire, this closed Record here) still gates
// every label: an out-of-vocabulary stage can neither parse nor render.
const PROGRESS_LABEL: Record<TurnProgressStage, LabelPair> = {
  sent: { live: 'Request sent', done: 'Request sent' },
  started: { live: 'Generating…', done: 'Generated' },
  reasoning: { live: 'Reasoning…', done: 'Reasoned' },
  content: { live: 'Writing the response…', done: 'Wrote the response' },
  validating: { live: 'Validating…', done: 'Validated' },
  retry: { live: 'Self-correcting…', done: 'Self-corrected' },
  tool: { live: 'Running an integration…', done: 'Ran an integration' }, // GH #49 — detail carries the registry tool NAME, composed at call time
  done: { live: 'Done', done: 'Done' },
}

/** Backward-compat fallback for a turn with no `note` (ADR-0088: a factual message-kind tally, never a
 *  fabricated sentence) — the a2ui-live.ts summarize() precedent. */
function summarize(lines: readonly string[]): string {
  if (lines.length === 0) return ''
  const kinds = lines.map((l) => {
    const msg = JSON.parse(l) as Record<string, unknown>
    return Object.keys(msg).find((k) => k !== 'version') ?? '?'
  })
  return `Emitted ${lines.length} A2UI message(s): ${kinds.join(', ')}.`
}

// The outer log's OWN stick-to-bottom guard (SPEC-R4 AC2) — sampled ONCE per turn, before that turn's own
// content starts growing, never re-sampled reactively mid-turn (a naive reactive-scroll-listener
// regresses this — the a2ui-chat.ts banner's own documented failure mode; promoted unchanged).
const LOG_STICK_THRESHOLD_PX = 24
const TAIL_FOLLOW_STABLE_CHECKS = 3
const TAIL_FOLLOW_CHECK_MS = 40
const TAIL_FOLLOW_MAX_CHECKS = 25

export interface UIConversationElement extends ReactiveProps<typeof props> {}
export class UIConversationElement extends UIElement {
  static props = props

  #log: HTMLElement | undefined
  // The composed message-composition child (TKT-0056) — JS-created ONCE (the master-detail.ts → ui-split
  // precedent), forwarded props down via an effect, forwarded callbacks via the closures registered in
  // #compose() below.
  #composer: UIConversationComposerElement | undefined
  #warnedPreConnect = false

  readonly #registry = new Map<string, SurfaceRecord>()
  #onSubmitCb: ((text: string) => void) | undefined
  #onClientMessageCb: ClientMessageListener | undefined
  #onModelChangeCb: ((id: string) => void) | undefined
  #onEffortChangeCb: ((id: string) => void) | undefined
  #onContextDismissCb: ((id: string) => void) | undefined
  #onMicClickCb: (() => void) | undefined
  // SPEC-R12 (TKT-0071) — a consumer-supplied render hook for agent-turn note / system-bubble text.
  // `undefined` (default) ⇒ byte-identical plain `textContent`, no dependency. NEVER applied to
  // `addUserMessage` (SPEC-R4 AC1 — user text stays unescaped/unmodified, deliberately unaffected).
  #contentRenderer: ((text: string) => Node) | undefined
  #turnSeq = 0
  // TKT-0034 — the busy/re-entrancy guard: a COUNT (not a bool) of `beginAgentTurn()` handles that exist
  // but have not yet `finalize()`d/`fail()`d. `#send` no-ops while this is > 0 (auto-tracked, zero consumer
  // wiring — the primitive already owns the AgentTurnHandle lifecycle); the composer reflects it visually.
  #turnsInFlight = 0

  protected connected(): void {
    if (this.#log === undefined) {
      this.#log = document.createElement('div')
      this.#log.dataset.part = 'log'
      this.#log.setAttribute('aria-live', 'polite')

      // JS-created internal child (TKT-0056, the master-detail.ts → ui-split precedent) — the message-
      // composition UI (context chips, field, Models/Effort pickers, mic/send) lives entirely inside
      // ui-conversation-composer now; this element only forwards props down and callbacks up (below).
      const composer = document.createElement('ui-conversation-composer') as UIConversationComposerElement
      // The four side-effect-free forwarders — safe to register ONCE, unconditionally: none of them has a
      // visible effect on registration, and each reads its own `#onXCb` field FRESH on every invocation, so
      // it works regardless of whether the consumer's own `onXChange(cb)` call happens before or after
      // THIS element connects (LLD CVC-C5, code-reviewer finding F1).
      composer.onSubmit((text) => {
        if (this.disabled) return // belt to the composer's own busy-disable — no bubble, no callback
        this.addUserMessage(text)
        this.#onSubmitCb?.(text)
      })
      composer.onModelChange((id) => this.#onModelChangeCb?.(id))
      composer.onEffortChange((id) => this.#onEffortChangeCb?.(id))
      composer.onContextDismiss((id) => this.#onContextDismissCb?.(id))
      // `onMicClick` is DIFFERENT: the composer's own onMicClick has a visible side effect (revealing the
      // mic button) — forwarding it unconditionally here would un-hide the mic for every consumer
      // regardless of whether they ever asked for voice input. Only forward if a real callback is ALREADY
      // registered (the pre-connect registration case) — `onMicClick` below handles the post-connect case.
      if (this.#onMicClickCb !== undefined) composer.onMicClick(() => this.#onMicClickCb?.())

      this.#composer = composer
      this.append(this.#log, composer)
    }

    // Forward models/model/efforts/effort/contextItems straight through — the composed child's OWN
    // reference-equality guards (rebuild only when the option-list REFERENCE changes) handle avoiding
    // unnecessary DOM churn; this element just re-assigns the current values on every relevant change.
    this.effect(() => {
      if (!this.#composer) return
      this.#composer.models = this.models
      this.#composer.model = this.model
      this.#composer.efforts = this.efforts
      this.#composer.effort = this.effort
      this.#composer.contextItems = this.contextItems
      this.#reflectBusy() // `disabled` reads here too — the effect re-runs on its change
    })
  }

  /** A user bubble with `text`, unescaped/unmodified (SPEC-R4 AC1). A documented no-op pre-connect. */
  addUserMessage(text: string): void {
    if (!this.#guard('addUserMessage')) return
    const wasNear = this.#isNearLogBottom()
    const bubble = this.#makeBubble('user')
    const body = document.createElement('p')
    body.dataset.part = 'body'
    body.textContent = text
    bubble.append(body)
    this.#log!.append(bubble)
    void this.#tailFollowLog(wasNear)
  }

  /** Opens one agent turn: a fresh bubble (narration strip + note + mounts container, reserved in that
   *  literal order, SPEC-R2) and the routing state the returned handle closes over (SPEC-R6/R7). A
   *  no-op-stub handle pre-connect (never throws — the same documented-no-op discipline as ui-surface-host).
   *
   *  TKT-0079 — `opts.intoSurface`: when it names an OPEN registry record whose bubble is still connected,
   *  the turn RESUMES that bubble instead of opening a new card (Kim: "stay in the same card unless it has
   *  to become a new card" — ADR-0129's same-surface routing extended to the bubble plane, for the
   *  action-click game loop). A FRESH narration strip swaps in place of the finalized old one (finalize()
   *  truncate-marks its entries — ui-status-stream's completion invariant is per-strip, so a resumed turn
   *  gets its own strip rather than un-finalizing the last one); the note div is reused (overwritten at
   *  finalize); a fresh surfaceId in a resumed turn mounts into the SAME bubble's mounts. Anything else —
   *  unknown id, closed record, disconnected bubble — falls through to the fresh-bubble path unchanged. */
  beginAgentTurn(opts?: { intoSurface?: string }): AgentTurnHandle {
    if (!this.#guard('beginAgentTurn')) {
      return { ingestLine: () => {}, setNote: () => {}, progress: () => {}, finalize: () => {}, fail: () => {} }
    }

    const wasNear = this.#isNearLogBottom()
    const resumed = opts?.intoSurface !== undefined ? this.#resumableBubble(opts.intoSurface) : undefined
    let bubble: HTMLElement
    let narration: UIStatusStreamElement
    let note: HTMLElement
    let mounts: HTMLElement
    if (resumed !== undefined) {
      ;({ bubble, note, mounts } = resumed)
      narration = this.#makeNarration()
      resumed.narration.replaceWith(narration)
    } else {
      bubble = this.#makeBubble('agent')
      narration = this.#makeNarration()
      note = document.createElement('div')
      note.dataset.part = 'body'
      mounts = document.createElement('div')
      mounts.dataset.part = 'mounts'
      bubble.append(narration, note, mounts)
      this.#log!.append(bubble)
    }
    void this.#tailFollowLog(wasNear)

    this.#turnSeq += 1
    const seq = this.#turnSeq
    // TKT-0034 — this handle is now genuinely in flight: bump the count + reflect busy onto the composer.
    // ONE #endTurn() per handle guards against a caller invoking BOTH finalize() and fail() (never legal
    // per the SPEC, but a stray double-call must not under-flow the count into a stuck-busy negative).
    this.#turnsInFlight += 1
    this.#reflectBusy()
    let ended = false
    const endTurn = (): void => {
      if (ended) return
      ended = true
      this.#turnsInFlight = Math.max(0, this.#turnsInFlight - 1)
      this.#reflectBusy()
    }
    let noteText: string | undefined
    const turnLines: string[] = []
    const touchedIds = new Set<string>()
    const categoriesSeen: Category[] = []
    const seenCats = new Set<Category>()
    let freshHostThisTurn: UISurfaceHostElement | undefined
    const heldNoIdLines: string[] = []
    // ADR-0146 F1/F8 progress state — the keys this turn has already narrated, and the current active
    // progress entry (settled to `done` as the next stage begins, so lifecycle stages check off in order).
    // GH #238/ADR-0159: each narrated key remembers its composed DONE-form label (the pair table, with the
    // same factual round/tool suffix its live form carried) so every settle site stamps the past-tense
    // form on the transition — a truncated/failed entry is never settled, so it keeps its live form.
    const progressKeysSeen = new Set<string>()
    const doneLabelByKey = new Map<string, string>()
    let lastProgressKey: string | undefined
    /** Settle one narrated progress entry to done, stamping its done-form label (GH #238). */
    const settleProgress = (key: string): void => {
      const doneLabel = doneLabelByKey.get(key)
      narration.update(key, doneLabel === undefined ? { status: 'done' } : { status: 'done', label: doneLabel })
    }

    /** Route ONE live-turn progress event into the strip (ADR-0146 F1/F8) through the CLOSED code-owned
     *  label table — never model text. An unknown/unobserved stage renders NOTHING (the F2 honesty guard).
     *  Each stage's entry goes `active` when it begins and settles `done` — with its done-form label
     *  (GH #238) — as the NEXT stage begins; `done` simply settles the last stage (no redundant "Done"
     *  row). `retry` composes the real round ordinal in. */
    const routeProgress = (ev: TurnProgress): void => {
      const pair = PROGRESS_LABEL[ev.stage] as LabelPair | undefined
      if (pair === undefined) return // unknown/unobserved stage — nothing is shown
      if (ev.stage === 'done') {
        if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
        lastProgressKey = undefined
        return
      }
      // `retry` composes the real round ordinal; `tool` composes the registry tool NAME from detail —
      // both factual values from the closed vocabularies, never model prose (GH #49 / ADR-0146 F2). The
      // SAME factual suffix rides both forms of the pair (live "Self-correcting… (round 2)" settles to
      // "Self-corrected (round 2)").
      const suffix =
        ev.stage === 'retry'
          ? (ev.round === undefined ? '' : ` (round ${ev.round})`)
          : ev.stage === 'tool' && ev.detail
            ? ` (${ev.detail})`
            : ''
      const label = `${pair.live}${suffix}`
      const key =
        ev.stage === 'retry'
          ? `t${seq}-progress-retry-${ev.round ?? 1}`
          : ev.stage === 'tool'
            ? `t${seq}-progress-tool-${ev.detail ?? 'unknown'}`
            : `t${seq}-progress-${ev.stage}`
      doneLabelByKey.set(key, `${pair.done}${suffix}`)
      if (lastProgressKey !== undefined && lastProgressKey !== key) settleProgress(lastProgressKey)
      if (progressKeysSeen.has(key)) narration.update(key, { status: 'active', label })
      else {
        progressKeysSeen.add(key)
        narration.appendEntry({ key, status: 'active', label })
      }
      lastProgressKey = key
    }

    const routeLine = (line: string): void => {
      const id = surfaceIdOf(line)
      if (id === undefined) {
        if (freshHostThisTurn !== undefined) freshHostThisTurn.ingest(line)
        else heldNoIdLines.push(line)
        return
      }
      touchedIds.add(id)
      const known = this.#registry.get(id)
      if (known !== undefined) {
        known.host.ingest(line) // SPEC-R7: routes to the surface's ORIGINAL host, never this turn's own
        if (known.state === 'open' && isDeleteSurfaceFor(line, id)) this.#closeSurface(id)
        return
      }
      // A FRESH surfaceId — this turn's own createSurface line. A new ui-surface-host, inline HERE.
      const host = document.createElement('ui-surface-host') as UISurfaceHostElement
      host.wrap = true // TKT-0084: a chat bubble hugs its rendered surface's content, never clips it to an arbitrary fixed height
      mounts.append(host)
      host.onClientMessage((m) => this.#onClientMessageCb?.(m)) // bubble up (LLD-C4)
      this.#registry.set(id, { host, bubble, state: 'open' })
      host.ingest(line)
      freshHostThisTurn = host
      for (const held of heldNoIdLines) host.ingest(held)
      heldNoIdLines.length = 0
    }

    return {
      ingestLine: (line: string) => {
        turnLines.push(line)
        const cat = categoryOf(line)
        if (cat !== undefined && !seenCats.has(cat)) {
          seenCats.add(cat)
          categoriesSeen.push(cat)
          // LIVE-AT-INGEST (SPEC-R6 amendment, ADR-0146): a category narrates the moment its FIRST line is
          // ingested — `active` during the turn, settled at finalize() — never the old post-hoc replay of
          // stages that already finished. The label table's own text is the entire vocabulary (ADR-0088
          // honesty law — never a fabricated sentence). GH #238: the live form here; finalize() stamps the
          // done form on the settle transition.
          narration.appendEntry({ key: `t${seq}-${cat}`, status: 'active', label: LABEL[cat].live })
        }
        routeLine(line)
      },
      setNote: (text: string) => {
        noteText = text
      },
      progress: (ev: TurnProgress) => routeProgress(ev),
      finalize: () => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT finalize() runs, not after narration settles
        // Settle the LIVE entries this turn narrated (categories + the current progress stage) to `done`
        // — stamping each entry's done-form label on the transition (GH #238/ADR-0159: a done checkmark
        // never wears an "-ing…" label) — then run the completion invariant (which truncates anything
        // still un-settled, fail-closed, keeping its live form: the done form is never claimed for work
        // not completed).
        for (const cat of categoriesSeen) narration.update(`t${seq}-${cat}`, { status: 'done', label: LABEL[cat].done })
        if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
        narration.finalize()
        this.#renderBody(note, noteText ?? summarize(turnLines))
        if (this.disclosure && turnLines.length > 0) bubble.append(this.#buildDisclosure(turnLines))
        this.#settleTouchedHosts(touchedIds)
        void this.#tailFollowLog(wasNear)
      },
      fail: (message: string) => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT fail() runs
        // A genuine finally-scoped truncation (SPEC-R6 AC3) — never a2ui-live's try-scoped mistake. The
        // live-narrated category/progress entries stay as they were (whatever completed shows done, the
        // rest truncate under fail()); `narration.fail()` forces the streaming header to `error` (ADR-0146
        // F8's header-level face) and truncates the in-flight entries. Still settles whatever surfaces the
        // partial turn touched (the a2ui-chat.ts `finally` block precedent, unconditional on success/failure).
        narration.appendEntry({ key: `t${seq}-error`, status: 'error', label: `Turn failed — ${message}` })
        narration.fail()
        this.#settleTouchedHosts(touchedIds)
        this.#addSystemBubble(`⚠ ${message}`)
      },
    }
  }

  /** The per-turn narration strip, ONE creation site for both the fresh-bubble and resumed-turn paths
   *  (they had drifted into a hand-duplicated block each). ADR-0146 F8: `header` is always set — the strip
   *  reads "working" from t=0, closing the blank-bubble symptom at its ROOT (even a zero-line,
   *  zero-progress turn shows a visible working header). GH #239/ADR-0159: the opt-in `receipt` prop adds
   *  the receipt pattern's two stream-level opt-ins; default false leaves the strip byte-identical. */
  #makeNarration(): UIStatusStreamElement {
    const narration = document.createElement('ui-status-stream') as UIStatusStreamElement
    narration.setAttribute('size', 'sm')
    narration.setAttribute('label', 'Agent activity')
    narration.setAttribute('header', '')
    if (this.receipt) {
      narration.setAttribute('oneline', '') // the live one-morphing-line mode (GH #239)
      narration.setAttribute('receipt', '') // the terminal one-line receipt (GH #239)
    }
    narration.dataset.part = 'narration'
    return narration
  }

  /** TKT-0079 — the resume probe: `id`'s OPEN record whose bubble is still in this log, plus the three
   *  turn parts a resumed turn writes into. `undefined` on ANY miss (unknown id, closed record,
   *  disconnected bubble, missing part) ⇒ the caller takes the fresh-bubble path unchanged. */
  #resumableBubble(
    id: string,
  ): { bubble: HTMLElement; narration: UIStatusStreamElement; note: HTMLElement; mounts: HTMLElement } | undefined {
    const record = this.#registry.get(id)
    if (record === undefined || record.state !== 'open' || !record.bubble.isConnected) return undefined
    const narration = record.bubble.querySelector<UIStatusStreamElement>(':scope > [data-part="narration"]')
    const note = record.bubble.querySelector<HTMLElement>(':scope > [data-part="body"]')
    const mounts = record.bubble.querySelector<HTMLElement>(':scope > [data-part="mounts"]')
    if (narration === null || note === null || mounts === null) return undefined
    return { bubble: record.bubble, narration, note, mounts }
  }

  /** The reply affordance — a callback, NEVER a CustomEvent (SPEC-R5). Safe to call before OR after connect. */
  onSubmit(cb: (text: string) => void): void {
    this.#onSubmitCb = cb
  }

  /** Outbound client messages bubbled from whichever composed `ui-surface-host` emitted them (SPEC-R7). Safe
   *  to call before OR after connect. */
  onClientMessage(cb: ClientMessageListener): void {
    this.#onClientMessageCb = cb
  }

  /** Fires with a `models` entry's `id` when the Models picker commits a choice — a callback, matching
   *  `onSubmit`'s own precedent (SPEC-R5's closed event vocabulary has no picker-commit kind). The picker
   *  itself never writes `this.model` — the consumer owns that (its own store), then hands the new value
   *  back down through the `model` prop, same "props down, callbacks up" shape as everywhere else in this
   *  fleet. Safe to call before or after connect. */
  onModelChange(cb: (id: string) => void): void {
    this.#onModelChangeCb = cb
  }

  /** Fires with an `efforts` entry's `id` when the Effort picker commits a choice. See `onModelChange`. */
  onEffortChange(cb: (id: string) => void): void {
    this.#onEffortChangeCb = cb
  }

  /** Fires with a `contextItems` entry's `id` when its dismiss affordance is clicked — the consumer owns
   *  actually removing it from `contextItems` (props down, callbacks up, the `onModelChange` precedent). */
  onContextDismiss(cb: (id: string) => void): void {
    this.#onContextDismissCb = cb
  }

  /** Fires when the mic button is clicked. OPT-IN: the button stays hidden until this is actually called —
   *  reveals it immediately if already connected, or on the next connect otherwise (matching `onSubmit`'s
   *  "safe to call before or after connect" law). Deliberately inert beyond this callback — `ui-conversation`
   *  has no speech-to-text mechanism of its own; a consumer that wants real voice input wires it here. */
  onMicClick(cb: () => void): void {
    this.#onMicClickCb = cb
    // Forward immediately if the composer already exists (post-connect case); the pre-connect case is
    // handled at compose time in connected() (LLD CVC-C5, code-reviewer finding F1).
    this.#composer?.onMicClick(() => this.#onMicClickCb?.())
  }

  /** SPEC-R12 (TKT-0071) — registers a render hook applied to agent-turn `note` text and system-bubble
   *  text in place of plain `textContent`. `undefined` restores the default (byte-identical plain text).
   *  `ui-conversation` never imports a markdown/highlight package itself (the `app` DAG stays untouched,
   *  CLAUDE.md's layering law) — the renderer is entirely consumer-supplied code the APP layer already
   *  has permission to import (e.g. `ui-markdown` from `@agent-ui/code`). NEVER applied to
   *  `addUserMessage` — user-authored text stays unescaped/unmodified (SPEC-R4 AC1, unchanged). Safe to
   *  call before or after connect; applies to bubbles rendered after the call, not retroactively. */
  setContentRenderer(fn: ((text: string) => Node) | undefined): void {
    this.#contentRenderer = fn
  }

  /** Disposes every open surface host and clears the thread. A documented no-op pre-connect. A consumer that
   *  resets mid-turn (abandoning an un-finalized `AgentTurnHandle` rather than calling `finalize()`/`fail()`
   *  on it) must not leave the composer permanently disabled — TKT-0034's counter/busy-state zero here too
   *  (component-reviewer note, 2026-07-13; the shipped consumer always finalizes, so this is a robustness
   *  floor for a future one, not a fix to an observed bug). */
  reset(): void {
    if (!this.#guard('reset')) return
    for (const record of this.#registry.values()) record.host.dispose()
    this.#registry.clear()
    this.#log!.replaceChildren()
    this.#turnsInFlight = 0
    this.#reflectBusy()
  }

  /** The ONE composer-busy write site: in-flight turns OR the `disabled` availability gate. */
  #reflectBusy(): void {
    if (this.#composer) this.#composer.busy = this.disabled || this.#turnsInFlight > 0
  }

  /** Leak-safety net (the select.ts/text-field.ts "heavyweight per-connection resource" precedent) — a
   *  consumer that removes this element WITHOUT calling `reset()`/disposing its surfaces itself must not
   *  leak every composed `ui-surface-host`'s `RendererHost`. Disposing each host here is DEFENSE IN DEPTH:
   *  the platform ALSO fires each host's own `disconnected()` (surface-host.ts) automatically as this
   *  element's connected subtree is removed — this loop is a no-op in that ordinary case (`dispose()` is
   *  idempotent-safe) and is what actually matters if a surface host were ever detached independently.
   *
   *  MUST mark each record `closed` via `#closeSurface`, NEVER `this.#registry.clear()` (a regression this
   *  fix corrects): `connected()` does not rebuild the thread DOM on reconnect, so a plain `remove()` +
   *  re-`append()` (an ordinary router detach/reattach, not a `moveBefore`) leaves the OLD bubbles/hosts
   *  physically in the log — if the registry were wiped instead of marked, a later line re-targeting an
   *  already-seen `surfaceId` would read as "unknown" and `routeLine`'s fresh-id branch would mint a SECOND
   *  host in a SECOND bubble (SPEC-R7 AC1's persistent-identity guarantee broken, the original bubble now a
   *  dead husk). Marking `closed` (the SAME transition `deleteSurface` already drives, "Closed." annotation
   *  included) keeps the id KNOWN, so the already-tested known-but-closed routing path — never a fresh
   *  mint — is what a post-disconnect line hits instead. The thread DOM itself is left untouched (this is
   *  teardown, not a user-facing "start over" action, unlike `reset()`). */
  protected override disconnected(): void {
    for (const id of this.#registry.keys()) this.#closeSurface(id)
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────────────

  /** `finalize()` every OPEN surface host this turn touched (LLD-C4) — shared by the success and the
   *  fail() path alike (the a2ui-chat.ts `finally` block precedent: settling is unconditional). */
  #settleTouchedHosts(touchedIds: ReadonlySet<string>): void {
    for (const id of touchedIds) {
      const record = this.#registry.get(id)
      if (record !== undefined && record.state === 'open') record.host.finalize()
    }
  }

  #closeSurface(id: string): void {
    const record = this.#registry.get(id)
    if (record === undefined || record.state === 'closed') return
    record.host.dispose()
    record.state = 'closed'
    record.bubble.dataset.state = 'closed'
    const note = document.createElement('p')
    note.dataset.part = 'annotation'
    note.textContent = 'Closed.'
    record.bubble.append(note)
  }

  #addSystemBubble(text: string): void {
    const wasNear = this.#isNearLogBottom()
    const bubble = this.#makeBubble('system')
    const body = document.createElement('div')
    body.dataset.part = 'body'
    this.#renderBody(body, text)
    bubble.append(body)
    this.#log!.append(bubble)
    void this.#tailFollowLog(wasNear)
  }

  /** SPEC-R12 — writes `text` into `el` via the registered content renderer, or plain `textContent`
   *  (default, byte-identical to pre-TKT-0071 behavior) when none is registered. Never called for
   *  `addUserMessage`'s body (SPEC-R4 AC1 — that call site keeps its own direct `textContent` write). */
  #renderBody(el: HTMLElement, text: string): void {
    if (this.#contentRenderer === undefined) {
      el.textContent = text
      return
    }
    el.replaceChildren(this.#contentRenderer(text))
  }

  #makeBubble(role: Role): HTMLElement {
    const bubble = document.createElement('div')
    bubble.dataset.part = 'bubble'
    // setAttribute, NOT `dataset.role =` — naming-gates.test.ts's Gate-3 dynamic-role matcher recognizes
    // `setAttribute('data-role', ident)` but not a `dataset.X =` write, so this is what makes the closed
    // §6 registry actually govern THIS call site (not just the CSS attribute selectors that consume it).
    bubble.setAttribute('data-role', role)
    if (role !== 'system') {
      const who = document.createElement('span')
      who.dataset.part = 'who'
      who.textContent = role === 'user' ? 'You' : 'Agent'
      bubble.append(who)
    }
    return bubble
  }

  /** A collapsed raw-wire disclosure of this turn's own JSONL lines (ADR-0129 clause 3, opt-in via
   *  `disclosure`) — dependency-free (no `@agent-ui/code`): a plain pretty-printed `<pre>` dump, not
   *  syntax-highlighted (the LLD's `code-block.ts` reuse was page-local chrome, not this SPEC's contract). */
  #buildDisclosure(turnLines: readonly string[]): HTMLElement {
    const pretty = turnLines.map((l) => JSON.stringify(JSON.parse(l), null, 2)).join('\n')
    const details = document.createElement('details')
    details.dataset.part = 'disclosure'
    const summary = document.createElement('summary')
    summary.textContent = 'wire ▸'
    const pre = document.createElement('pre')
    pre.dataset.part = 'wire'
    pre.textContent = pretty || '(no payload this turn)'
    details.append(summary, pre)
    return details
  }

  #isNearLogBottom(): boolean {
    const log = this.#log!
    return log.scrollHeight - log.scrollTop - log.clientHeight <= LOG_STICK_THRESHOLD_PX
  }

  /** Scroll to the log's newest content IFF `wasNear` held — never re-samples reactively. Resolves once the
   *  log's OWN scroll position has genuinely stopped moving (or a ~1s ceiling is hit); promoted unchanged
   *  from a2ui-chat.ts's `tailFollowLog` (the biting negative control this guard exists to survive). */
  #tailFollowLog(wasNear: boolean): Promise<void> {
    const log = this.#log!
    if (!wasNear) return Promise.resolve()
    return new Promise((resolve) => {
      let prevTop = -1
      let stableStreak = 0
      let checks = 0
      const tick = (): void => {
        log.scrollTop = log.scrollHeight
        const top = log.scrollTop
        stableStreak = top === prevTop ? stableStreak + 1 : 0
        prevTop = top
        checks += 1
        if (stableStreak >= TAIL_FOLLOW_STABLE_CHECKS || checks >= TAIL_FOLLOW_MAX_CHECKS) {
          resolve()
          return
        }
        setTimeout(tick, TAIL_FOLLOW_CHECK_MS)
      }
      tick()
    })
  }

  /** `true` once connected (the log/composer exist); else warns ONCE (across every guarded method) and
   *  returns `false` — a documented no-op, never a throw (the ui-surface-host precedent, this same wave). */
  #guard(method: string): boolean {
    if (this.#log !== undefined) return true
    if (!this.#warnedPreConnect) {
      this.#warnedPreConnect = true
      console.warn(`<ui-conversation>: .${method}() called before connect — no thread exists yet; this call is a no-op.`)
    }
    return false
  }
}

if (!customElements.get('ui-conversation')) customElements.define('ui-conversation', UIConversationElement)
