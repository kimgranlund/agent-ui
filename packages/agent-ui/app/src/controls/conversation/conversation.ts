// conversation.ts — UIConversationElement, the M2 thread/composer/narration primitive (LLD-C4/C5 ·
// SPEC-R4/R5/R6/R7; ADR-0129 clauses 2/3). BEHAVIOUR + props + the internal per-surface registry +
// narration + self-define ONLY; the thread/bubble/composer layout lives in conversation.css, the public
// contract in conversation.md.
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
// Narration (SPEC-R6, ADR-0088): each agent turn composes a fresh `ui-status-stream`, categorizing lines
// via the SAME envelope-key inspection technique `a2ui-live.ts`'s `summarize()`/`a2ui-chat.ts`'s
// `categoryOf` already use — promoted UNCHANGED, never re-invented. Narration ships unconditionally (no
// opt-out); the raw-wire `<details>` disclosure is gated behind the OPT-IN `disclosure` prop (default
// false, ADR-0129 clause 3) — the mechanism is rebuilt dependency-free here (no `@agent-ui/code` import;
// `site/lib/code-block.ts`'s syntax highlighting was page-local chrome, not part of this SPEC's contract)
// as a plain `<pre>` dump of the pretty-printed JSONL — same functional disclosure, no new dependency.
//
// NAMED LLD GAP (flagged, not silently resolved): the LLD's own narration slice (§6) names `narrateTrace`
// (a `TurnTrace`-shaped fourth narration entry, live-arm only) as promoted "unchanged" alongside
// `categoryOf`/`narrateCategories`. But SPEC §4's typed `AgentTurnHandle` contract — the ratified public
// surface — exposes exactly four methods (`ingestLine`/`setNote`/`finalize`/`fail`), none of which lets a
// caller ever SUPPLY a `TurnTrace` to narrate. There is no reachable call site for `narrateTrace` under the
// frozen contract as written; adding a fifth handle method (e.g. `setTrace`) would be inventing NEW public
// API the SPEC never asked for, a local deviation this build declines to make unilaterally. `narrateTrace`
// is therefore NOT built this pass — surfaced in the build hand-off for the design seat to thread through
// (either widen `AgentTurnHandle` or drop the LLD's promotion note) rather than resolved here.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { UIStatusStreamElement } from '@agent-ui/components/components'
import '../surface-host/surface-host.ts' // registers <ui-surface-host> — composed internally (ADR-0129 clause 2)
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
import type { ClientMessageListener } from '@agent-ui/a2ui'
import type { UITextFieldElement, UIButtonElement } from '@agent-ui/components/components'

const props = {
  // OPT-IN raw-wire disclosure (ADR-0129 clause 3) — reflected, default false. Narration itself (below)
  // ships unconditionally; this gates only the per-turn `<details>` wire dump, a debugging/inspection
  // affordance most product surfaces should not show by default.
  disclosure: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

/** The imperative per-turn driver the APP'S OWN transport loop calls — NOT a DOM type (SPEC-R8). */
export interface AgentTurnHandle {
  /** Routes one raw A2UI JSONL line by `surfaceId` to a fresh/known `ui-surface-host`, or narrates a
   *  no-surface line under this turn's own category tracking. */
  ingestLine(line: string): void
  /** Stashes this turn's own prose note (ADR-0088); rendered verbatim at `finalize()` — never a fabricated sentence. */
  setNote(text: string): void
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

const LABEL: Record<Category, string> = {
  open: 'Opening a new surface…',
  restructure: 'Updating the surface…',
  react: 'Updating data…',
  close: 'Closing the surface…',
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

const NARRATION_STEP_MS = 60 // status-stream-demo.ts's delay(60) precedent — visibly live pacing
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** One entry per DISTINCT category, in emission order — pending -> active -> done. Never a fabricated
 *  sentence — the label table's own text is the entire vocabulary. */
async function narrateCategories(stream: UIStatusStreamElement, turnSeq: number, categories: readonly Category[]): Promise<void> {
  for (const cat of categories) {
    const key = `t${turnSeq}-${cat}`
    stream.appendEntry({ key, status: 'pending', label: LABEL[cat] })
    await delay(NARRATION_STEP_MS)
    stream.update(key, { status: 'active' })
    await delay(NARRATION_STEP_MS)
    stream.update(key, { status: 'done' })
  }
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
  #composer: HTMLFormElement | undefined
  #field: UITextFieldElement | undefined
  #sendBtn: UIButtonElement | undefined
  #warnedPreConnect = false

  readonly #registry = new Map<string, SurfaceRecord>()
  #onSubmitCb: ((text: string) => void) | undefined
  #onClientMessageCb: ClientMessageListener | undefined
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

      // A native <form> — this is the fleet's first native form ELEMENT (as opposed to a native form
      // WIDGET: <input>/<button type=submit>/<select>/etc.). ADR-0017 bans the latter (every fleet control
      // is its own FACE re-implementation of a widget's behavior); it says nothing about the structural
      // <form> element itself, which contributes no widget semantics of its own — only Enter-triggers-
      // submit plumbing this composer already handles directly via its own listeners below, never relying
      // on native form-submission/validation.
      this.#composer = document.createElement('form')
      this.#composer.dataset.part = 'composer'
      this.#field = document.createElement('ui-text-field') as UITextFieldElement
      this.#field.setAttribute('label', 'Message')
      this.#field.dataset.part = 'field'
      this.#sendBtn = document.createElement('ui-button') as UIButtonElement
      this.#sendBtn.setAttribute('variant', 'solid')
      this.#sendBtn.dataset.part = 'send'
      this.#sendBtn.textContent = 'Send'
      this.#composer.append(this.#field, this.#sendBtn)

      this.append(this.#log, this.#composer)
    }

    // Listeners ride THIS connection's abort signal — re-armed every connect (the app-shell-region.ts
    // `wired`-per-connection precedent): the DOM parts persist across a reconnect, but a listener bound to
    // a PRIOR connection's signal already died with it.
    this.listen(this.#composer!, 'submit', (e) => {
      e.preventDefault()
      this.#send()
    })
    this.listen(this.#sendBtn!, 'click', () => this.#send())
    this.listen(this.#field!, 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault()
        this.#send()
      }
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
   *  no-op-stub handle pre-connect (never throws — the same documented-no-op discipline as ui-surface-host). */
  beginAgentTurn(): AgentTurnHandle {
    if (!this.#guard('beginAgentTurn')) {
      return { ingestLine: () => {}, setNote: () => {}, finalize: () => {}, fail: () => {} }
    }

    const wasNear = this.#isNearLogBottom()
    const bubble = this.#makeBubble('agent')
    const narration = document.createElement('ui-status-stream') as UIStatusStreamElement
    narration.setAttribute('size', 'sm')
    narration.setAttribute('label', 'Agent activity')
    narration.dataset.part = 'narration'
    const note = document.createElement('p')
    note.dataset.part = 'body'
    const mounts = document.createElement('div')
    mounts.dataset.part = 'mounts'
    bubble.append(narration, note, mounts)
    this.#log!.append(bubble)
    void this.#tailFollowLog(wasNear)

    this.#turnSeq += 1
    const seq = this.#turnSeq
    // TKT-0034 — this handle is now genuinely in flight: bump the count + reflect busy onto the composer.
    // ONE #endTurn() per handle guards against a caller invoking BOTH finalize() and fail() (never legal
    // per the SPEC, but a stray double-call must not under-flow the count into a stuck-busy negative).
    this.#turnsInFlight += 1
    this.#setComposerBusy(true)
    let ended = false
    const endTurn = (): void => {
      if (ended) return
      ended = true
      this.#turnsInFlight = Math.max(0, this.#turnsInFlight - 1)
      this.#setComposerBusy(this.#turnsInFlight > 0)
    }
    let noteText: string | undefined
    const turnLines: string[] = []
    const touchedIds = new Set<string>()
    const categoriesSeen: Category[] = []
    const seenCats = new Set<Category>()
    let freshHostThisTurn: UISurfaceHostElement | undefined
    const heldNoIdLines: string[] = []

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
        }
        routeLine(line)
      },
      setNote: (text: string) => {
        noteText = text
      },
      finalize: () => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT finalize() runs, not after narration settles
        void narrateCategories(narration, seq, categoriesSeen).then(() => narration.finalize())
        note.textContent = noteText ?? summarize(turnLines)
        if (this.disclosure && turnLines.length > 0) bubble.append(this.#buildDisclosure(turnLines))
        this.#settleTouchedHosts(touchedIds)
        void this.#tailFollowLog(wasNear)
      },
      fail: (message: string) => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT fail() runs
        // A genuine finally-scoped truncation (SPEC-R6 AC3) — never a2ui-live's try-scoped mistake.
        // narrateCategories was never started on this path (finalize() never ran), so this is the ONLY
        // narration entry the failed turn gets; still settles whatever surfaces the partial turn touched
        // (the a2ui-chat.ts `finally` block precedent, unconditional on success/failure).
        narration.appendEntry({ key: `t${seq}-error`, status: 'error', label: `Turn failed — ${message}` })
        narration.finalize()
        this.#settleTouchedHosts(touchedIds)
        this.#addSystemBubble(`⚠ ${message}`)
      },
    }
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
    this.#setComposerBusy(false)
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

  /** TKT-0034 — a no-op while a turn is in flight (`#turnsInFlight > 0`): the typed text is RETAINED, not
   *  cleared — no `addUserMessage`, no `#onSubmitCb`. Auto-tracked off `beginAgentTurn()`/`finalize()`/
   *  `fail()`, so every consumer gets this for free (the composer is ALSO disabled while busy, below, but
   *  this guard holds even if a caller somehow fires `#send()` past that — e.g. a stray Enter keydown
   *  racing the disabled-effect's own attribute write). */
  #send(): void {
    if (this.#turnsInFlight > 0) return
    const text = this.#field!.value.trim()
    if (text === '') return
    this.addUserMessage(text)
    this.#field!.value = ''
    this.#onSubmitCb?.(text)
  }

  /** TKT-0034 — the composer's in-flight affordance: the field + Send button disable (each control's OWN
   *  disabled styling/AX already dims + pointer-inerts them, button.css/text-field.ts), and the composer
   *  form itself carries `aria-busy`/`aria-disabled` + a `data-busy` CSS hook (conversation.css) for the
   *  whole-composer dim, mirroring the pre-migration a2ui-chat.ts `.is-busy` affordance this replaces.
   *  A focus-loss/restore concern was raised and INVESTIGATED (component-reviewer note, 2026-07-13): disabling
   *  a focused field does NOT drop focus in ANY engine (jsdom, Chromium, WebKit — verified empirically) —
   *  `ui-text-field`'s disabled state rides `contenteditable=false` + a removed `tabindex`, never a native
   *  `disabled` attribute, and only the latter carries a browser-mandated blur. No restoration code is needed;
   *  adding it would be speculative complexity for a scenario that does not occur. */
  #setComposerBusy(busy: boolean): void {
    this.#field!.disabled = busy
    this.#sendBtn!.disabled = busy
    this.#composer!.toggleAttribute('data-busy', busy)
    if (busy) {
      this.#composer!.setAttribute('aria-busy', 'true')
      this.#composer!.setAttribute('aria-disabled', 'true')
    } else {
      this.#composer!.removeAttribute('aria-busy')
      this.#composer!.removeAttribute('aria-disabled')
    }
  }

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
    const body = document.createElement('p')
    body.dataset.part = 'body'
    body.textContent = text
    bubble.append(body)
    this.#log!.append(bubble)
    void this.#tailFollowLog(wasNear)
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
