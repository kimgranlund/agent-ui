// model.ts — the ui-otp-field pure edit model (LLD-C2, code-entry-control.lld.md §3/§5). Zero DOM, zero
// imports — the fleet's pure-core testing shape (checkbox/text-field precedent: behaviour lives in a
// directly jsdom-unit-testable function, the control (otp-field.ts) is a thin DOM-wiring shell around it).
//
// State: `value` is a CONTIGUOUS digit prefix (`/^[0-9]{0,N}$/`, the no-gaps invariant — cells fill
// left-to-right, a hole can never exist) + a session-local `active` index `a ∈ [0, min(len, N−1)]`. `N`
// (this.length) is NOT part of the state — every entry point that needs it receives it as a parameter, so
// the reducer is exercised at every N a caller chooses, including a live length change (LLD-C3/§8).
//
// `reduce` is TOTAL over the §3 action taxonomy (every table row + the default no-op arm); `routeBeforeInput`
// is the SEPARATE, ALSO-TOTAL mapping from the real `beforeinput` inputType space onto that action taxonomy
// (§3's routing prose, verbatim) — kept here, not in otp-field.ts, so the whole "TOTAL over the beforeinput
// inputType space" contract (§3, §12 AC1) is one pure, directly unit-testable surface with no live DOM.

// ── state + actions ──────────────────────────────────────────────────────────────────────────────────

export interface OtpState {
  readonly value: string
  readonly active: number
}

export type OtpAction =
  | { readonly type: 'focus' }
  | { readonly type: 'digit'; readonly digit: string }
  | { readonly type: 'backspace' }
  | { readonly type: 'delete' }
  | { readonly type: 'arrow-left' }
  | { readonly type: 'arrow-right' }
  | { readonly type: 'home' }
  | { readonly type: 'end' }
  | { readonly type: 'pointer-down'; readonly index: number }
  | { readonly type: 'enter' }
  | { readonly type: 'escape' }
  | { readonly type: 'paste'; readonly text: string }
  | { readonly type: 'noop' }

/** The LLD-C8 frozen echo classes — the control (otp-field.ts) owns the STRING templates; this only names
 *  WHICH class fired + the numbers it needs (a `digit`/`count`), keeping model.ts string-literal-free. */
export type EchoEvent =
  | { readonly kind: 'digit'; readonly digit: string }
  | { readonly kind: 'clear' }
  | { readonly kind: 'paste'; readonly count: number }
  | { readonly kind: 'complete' }

export interface ReduceResult {
  readonly state: OtpState
  /** `value` mutated this transition — drives the composed `input` re-emit (§3: "fires after EVERY
   *  transition that changed value"). False for every active-only move (focus/arrow/home/end/pointer-down)
   *  and every no-op. */
  readonly changed: boolean
  /** The `len < N → len === N` completion edge (§2 Events / §3) — drives the completion `change` commit.
   *  A full-code PASTE is the one case that completes unconditionally regardless of the prior length
   *  (§5: "a user pasting a full code mid-edit means 'use this code', never 'splice this in'"). */
  readonly completed: boolean
  /** Enter's commit-if-changed (text-field parity, §3 table) — the control fires `change` only when the
   *  value differs from its own committed baseline; this flag just names "Enter was pressed". */
  readonly commit: boolean
  /** The LLD-C8 user-driven echo for this transition, or `null` for a no-op / active-only move. When
   *  `completed` is true this is ALWAYS `{ kind: 'complete' }` — the completion announcement replaces
   *  whatever the triggering action's own echo would have been (one write, one announcement). */
  readonly echo: EchoEvent | null
}

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────────────

/** normalize — strip every non-digit (separators, whitespace, letters); §5. `"424 242"` / `"code: 424242"`
 *  both land clean. */
export function normalize(text: string): string {
  return text.replace(/[^0-9]/g, '')
}

/** `firstEmpty = min(len, N−1)` (§3) — the no-gaps invariant's own boundary: typing always fills the first
 *  empty cell; a full code's "first empty" is clamped to the last cell. */
export function firstEmptyOf(len: number, n: number): number {
  return Math.min(len, Math.max(0, n - 1))
}

const clampToFirstEmpty = (index: number, len: number, n: number): number =>
  Math.max(0, Math.min(index, firstEmptyOf(len, n)))

function unchanged(state: OtpState): ReduceResult {
  return { state, changed: false, completed: false, commit: false, echo: null }
}

/** Wraps a genuine value mutation: computes the completion edge and — on that edge — REPLACES the
 *  caller's echo with `{ kind: 'complete' }` (one announcement per transition, never two). */
function mutated(state: OtpState, prevLen: number, n: number, echo: EchoEvent): ReduceResult {
  const completed = prevLen < n && state.value.length === n
  return { state, changed: true, completed, commit: false, echo: completed ? { kind: 'complete' } : echo }
}

/** The §5 paste-split algorithm — pure, shared by a real `paste`, every §3-routed multi-character
 *  insertion (`insertText` len>1 / `insertReplacementText` / `insertFromDrop`), and a `compositionend`'s
 *  final text. `n` = this.length (the live cell count) at the moment of the paste. */
function applyPaste(state: OtpState, text: string, n: number): ReduceResult {
  const digits = normalize(text)
  if (digits === '') return unchanged(state) // a wrong-shaped paste is nothing — no event, no error (§5)
  const prevLen = state.value.length

  if (digits.length >= n) {
    // Full-code paste into ANY cell REPLACES the whole value — unconditional completion (§5's own carve-out
    // from the generic rising-edge rule: re-pasting an already-complete code must still announce/commit).
    const value = digits.slice(0, n)
    return { state: { value, active: n - 1 }, changed: true, completed: true, commit: false, echo: { kind: 'complete' } }
  }

  // Partial paste writes FORWARD from the active cell, overwriting; contiguity holds by construction (a ≤ len).
  const a = state.active
  const value = (state.value.slice(0, a) + digits + state.value.slice(a + digits.length)).slice(0, n)
  const active = Math.min(a + digits.length, firstEmptyOf(value.length, n))
  return mutated({ value, active }, prevLen, n, { kind: 'paste', count: digits.length })
}

// ── the §3 reducer (TOTAL) ───────────────────────────────────────────────────────────────────────────

/** `reduce` — the whole §3 cell-focus-graph table, verbatim, plus §5's paste arm. Total: every `OtpAction`
 *  member is handled; `noop`/`escape` and any unmatched shape are explicit no-ops. */
export function reduce(state: OtpState, action: OtpAction, n: number): ReduceResult {
  const { value, active: a } = state
  const len = value.length

  switch (action.type) {
    case 'focus': {
      // The first-empty rule: entering the control always parks the caret at the first empty cell (a full
      // code parks at the last cell). An active-only move — never `changed`, never echoed.
      const active = firstEmptyOf(len, n)
      return active === a ? unchanged(state) : unchanged({ value, active })
    }

    case 'digit': {
      const d = action.digit
      if (!/^[0-9]$/.test(d)) return unchanged(state) // non-digit — filtered, no-op, no event (§3 table)
      const nextValue = value.slice(0, a) + d + value.slice(a + 1) // overwrite at a (appends when a === len)
      const nextActive = Math.min(a + 1, firstEmptyOf(nextValue.length, n)) // auto-advance
      return mutated({ value: nextValue, active: nextActive }, len, n, { kind: 'digit', digit: d })
    }

    case 'backspace': {
      if (value === '') return unchanged(state) // nothing to remove
      if (a < len) {
        // Cell a filled → splice it out, a stays (contiguity preserved).
        const nextValue = value.slice(0, a) + value.slice(a + 1)
        return mutated({ value: nextValue, active: a }, len, n, { kind: 'clear' })
      }
      // Cell a empty (a === len) → walk back, THEN splice out the now-active cell.
      const walked = Math.max(0, a - 1)
      const nextValue = value.slice(0, walked) + value.slice(walked + 1)
      return mutated({ value: nextValue, active: walked }, len, n, { kind: 'clear' })
    }

    case 'delete': {
      // "Delete forward = Backspace's FILLED-cell arm at a (splice, stay)" (§3) — only meaningful when
      // cell a is actually filled (a < len); at/after the end there is nothing to delete forward.
      if (a >= len) return unchanged(state)
      const nextValue = value.slice(0, a) + value.slice(a + 1)
      return mutated({ value: nextValue, active: a }, len, n, { kind: 'clear' })
    }

    case 'arrow-left': {
      const active = Math.max(0, a - 1)
      return active === a ? unchanged(state) : unchanged({ value, active })
    }

    case 'arrow-right': {
      const active = Math.min(a + 1, firstEmptyOf(len, n)) // traversal never passes the first empty cell
      return active === a ? unchanged(state) : unchanged({ value, active })
    }

    case 'home':
      return a === 0 ? unchanged(state) : unchanged({ value, active: 0 })

    case 'end': {
      const active = firstEmptyOf(len, n)
      return active === a ? unchanged(state) : unchanged({ value, active })
    }

    case 'pointer-down': {
      const active = clampToFirstEmpty(action.index, len, n) // a click past the fill clamps to first empty
      return active === a ? unchanged(state) : unchanged({ value, active })
    }

    case 'enter':
      return { state, changed: false, completed: false, commit: true, echo: null } // commit-if-changed, text-field parity

    case 'escape':
      return unchanged(state) // deliberate no-op — no clear-on-escape (a destructive surprise mid-entry)

    case 'paste':
      return applyPaste(state, action.text, n)

    case 'noop':
      return unchanged(state)

    default:
      // Exhaustiveness guard — every real OtpAction member is handled above; this line is unreachable given
      // the closed union. The `never`-typed void expression makes a FUTURE unhandled member a compile error
      // instead of a silent runtime fall-through.
      void (action satisfies never)
      return unchanged(state)
  }
}

// ── beforeinput routing (§3's taxonomy, TOTAL over the inputType space) ─────────────────────────────

/** The DOM facts a `beforeinput` handler resolves BEFORE calling this — kept as plain data (not a live
 *  `InputEvent`) so the whole routing table is a pure, directly unit-testable function.
 *
 *  `collapsed` — GH #589 ROOT-CAUSE REPAIR (§3, a documented exception to "the DOM selection is never
 *  managed and never read"): this used to be `event.getTargetRanges()`-derived. That seam is WRONG for a
 *  delete inputType — the target range describes the CONTENT ABOUT TO BE REMOVED, which is never collapsed
 *  once anything real is being deleted (it always spans at least the one character). Chromium happened to
 *  return an EMPTY ranges array for a plain-caret backspace (an implementation quirk the old code
 *  accidentally rode as "collapsed"); WebKit spec-correctly returns a real, NON-collapsed 1-character range
 *  (proven via real-WebKit instrumentation, GH #589 — `start=(#text,1) end=(#text,2)` for a backspace on
 *  "12"), which the old check misread as "a highlighted selection exists", silently no-opping every WebKit
 *  backspace. The caller now derives `collapsed` from `window.getSelection()?.isCollapsed` instead — read
 *  ONLY to discriminate a plain caret from a real highlighted selection BEFORE routing (never to derive
 *  WHERE to edit; the active index alone still governs that, §3's real concern) — confirmed cross-engine-
 *  robust (`true` for a plain caret, `false` for a real selection, in BOTH engines). */
export interface BeforeInputSource {
  readonly inputType: string
  readonly data: string | null
  /** `event.dataTransfer?.getData('text/plain')`, resolved by the caller — populated for
   *  `insertReplacementText` / `insertFromDrop` / `insertFromPaste`. */
  readonly transferText: string | null
  /** True for a plain caret (`window.getSelection()?.isCollapsed`, GH #589) — the routing default that lets
   *  an edit through; false only when a REAL highlighted selection exists (§3 row 5's "any delete variant
   *  issued while a DOM selection/range exists" case). */
  readonly collapsed: boolean
}

/** `routeBeforeInput` — §3's inputType-space routing, TOTAL: every named arm plus the row-5 default (a
 *  no-op) for deleteByCut / insertParagraph / insertLineBreak / historyUndo / historyRedo / any unnamed
 *  inputType. */
export function routeBeforeInput(src: BeforeInputSource): OtpAction {
  const { inputType, data, transferText, collapsed } = src

  switch (inputType) {
    case 'insertText': {
      const text = data ?? ''
      if (text.length === 1) return /^[0-9]$/.test(text) ? { type: 'digit', digit: text } : { type: 'noop' }
      if (text.length > 1) return { type: 'paste', text } // multi-char insertText (code-suggestion bar, etc.) → §5
      return { type: 'noop' }
    }
    case 'insertReplacementText': // autocorrect replacement → §5
    case 'insertFromDrop': // drag-drop of the code → §5
      return { type: 'paste', text: transferText ?? data ?? '' }
    case 'insertFromPaste':
      // Defense-in-depth: the dedicated `paste` LISTENER is the primary path (its own preventDefault stops
      // the beforeinput chain in every engine tested); this arm exists so a paste that somehow still reaches
      // beforeinput routes through §5 too, rather than silently falling to the default no-op.
      return { type: 'paste', text: transferText ?? data ?? '' }
    case 'deleteContentBackward':
      return collapsed ? { type: 'backspace' } : { type: 'noop' } // a selection present → default arm (row 5)
    case 'deleteContentForward':
      return collapsed ? { type: 'delete' } : { type: 'noop' }
    default:
      // deleteByCut, insertParagraph/insertLineBreak, historyUndo/historyRedo, and any inputType this table
      // does not name — the TOTAL default arm: a no-op (§3 row 5).
      return { type: 'noop' }
  }
}
