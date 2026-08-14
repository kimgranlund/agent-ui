# LLD — `ui-conversation-composer` (the extracted composer, TKT-0056)

> Component LLD for TKT-0056 (feature intake, same-day extraction of the Figma chat-input refactor's
> composer out of `ui-conversation`). Trace: TKT-0056 · governed by `app-surfaces-m2.spec.md` SPEC-R4/R5
> (no new R# minted — this design derives FROM those clauses, it doesn't amend them). · proposed ·
> 2026-07-15 · planning-lead
>
> **Composes on:** `UIElement` (the coordinator base — the `ui-command-modal`/`ui-theme-provider`/
> `ui-form-provider` precedent, no surface of its own) + `ui-text-field` + `ui-menu`×2 (Models/Effort
> pickers) + `ui-button`×2–3 (mic/send/picker-triggers) + `ui-icon`, all sanctioned sibling-control
> imports (the `avatar.ts`/`master-detail.ts` precedent — JS-created, not author-composed). **Layer:**
> `@agent-ui/app`, `packages/agent-ui/app/src/controls/conversation/` (same folder as `conversation.ts` —
> the `split`/`split-pane`, `master-detail`/`master-detail-pane` sibling-in-one-folder precedent).

## Intent

Extract the composer (context-chip row + text field + Models/Effort pickers + mic/send buttons +
busy-state) that `UIConversationElement` currently builds inline into its own standalone component,
`ui-conversation-composer`, so the two concerns — thread/narration/surface-registry (stays on
`ui-conversation`) vs. message-composition UI (moves to the new component) — have their own boundary,
each independently testable and each with its own descriptor. This is a **promotion**, not a redesign:
every prop, callback, DOM part, and CSS rule already exists (built + independently reviewed this same
session inside `conversation.ts`) and moves verbatim; no new visual design, interaction pattern, token,
event name, or geometry row is introduced.

**The load-bearing fork this LLD resolves**: `ui-conversation-composer` is a **JS-created internal
child** `ui-conversation` composes itself (the `master-detail.ts` → `ui-split` precedent), **NOT** an
author-composed declarative child (the `ui-split-pane`/`ui-master-detail-pane` precedent). `ui-conversation`'s
own existing contract (SPEC-R4: "renders its OWN internal thread + composer — never author-composed,
driven entirely through the imperative API") is unchanged and governs this decision — an author-composed
composer would require every existing consumer to add new markup, a breaking change nothing in this
ticket's own ask requires or justifies. The real consumers (code-reviewer finding F5 — `a2ui-live.ts` was
a stale claim, verified: it composes a canvas surface directly and never `ui-conversation`) are
`agent-admin.ts` (`packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`) and
`site/pages/a2ui-chat.ts`, plus their own tests (`agent-admin.test.ts`, `a2ui-chat.test.ts`).

## Components

- **CVC-C1 — the promoted prop surface.** `models: readonly PickerOption[] | undefined` (opt-in, default
  `undefined`), `model: string | undefined`, `efforts: readonly PickerOption[] | undefined`,
  `effort: string | undefined`, `contextItems: readonly ContextItem[] | undefined` (default `undefined`,
  coalesced to `[]` at the one read site — the array-literal-default-can't-round-trip-through-the-
  descriptor lesson, unchanged from `conversation.ts`'s own fix this session) — all `attribute: false`,
  moved verbatim from `conversation.ts`'s own `props` object. **NEW**: `busy: boolean` (reflected, default
  `false`) — replaces `ui-conversation` reaching into the composer's own field/send/mic/picker-trigger
  parts directly to set `.disabled`; the composer now owns disabling its OWN parts from this ONE prop
  (an encapsulation improvement — `ui-conversation` no longer needs to know the composer's internal part
  names at all).
- **CVC-C2 — the promoted callback surface.** `onModelChange`/`onEffortChange`/`onContextDismiss`/
  `onMicClick` move verbatim (the `onSubmit` precedent — callback registration, never a `CustomEvent`;
  SPEC-R5 declines the fleet's closed event vocabulary — whose single owning home is the `ALLOWED_EVENTS`
  constants in `family-coherence.test.ts` + `naming-gates.test.ts` (ADR-0153), never re-enumerated or
  counted in prose — for picker-commit/submission, and this component inherits that same law by lineage,
  not by re-deriving it). **NEW**: `onSubmit(text: string): void` — the
  field+send submission logic (`#send()`'s trim/empty-guard/clear) moves INTO the composer; it calls
  `onSubmit` with the trimmed text and clears its own field, mirroring `ui-conversation`'s current
  `#send()` exactly. `ui-conversation` no longer touches `#field`/`#sendBtn` directly for submission at
  all — it only listens for the composer's `onSubmit`.
  **LOAD-BEARING ORDERING (code-reviewer finding F2)**: the composer's OWN internal send path (the form
  `submit` listener, the send-button click, the field's Enter keydown) MUST check `if (this.busy) return`
  **synchronously, before reading or clearing the field** — exactly the position `conversation.ts`'s
  current `#send()` already guards at (`#turnsInFlight > 0` first, "the typed text is RETAINED, not
  cleared"), which its own comment names as a deliberate backstop against "a stray Enter keydown racing
  the disabled-effect's own attribute write." `busy` becomes reflected/effect-driven here (CVC-C4) rather
  than a synchronous call as today — WIDENING that race window if the guard isn't ALSO re-checked
  synchronously inside the send path itself, not only via the disabled attribute. This is real behavior,
  not styling: a busy-window Enter must retain the typed text, never silently drop it.
- **CVC-C3 — the promoted DOM anatomy.** The host wraps a nested `<form>` (unchanged — ADR-0017's "first
  native form ELEMENT, not a form WIDGET" carve-out this element already relies on): `[data-part="context-
  chips"]` → `[data-part="field"]` (`ui-text-field`) → `[data-part="options"]` (`options-leading`/
  `options-trailing` cells: the Models/Effort `ui-menu` pickers with their `data-picker="models"|"effort"`
  trigger-selector workaround, and the mic/send `ui-button`s). Every PART name, its own CSS rule, and the
  `ui-menu` trigger `data-part` re-tagging workaround moves byte-for-byte from `conversation.ts`/
  `conversation.css`.
  **The one CSS rule that CANNOT move byte-for-byte (code-reviewer finding F3)**: today
  `[data-part='composer']` (the `<form>`) is a DIRECT flex child of `ui-conversation`'s own `:scope` flex
  column (`conversation.css:26-27` `display:flex;flex-direction:column`, `:151-154`
  `flex:0 0 auto` on the composer). After extraction, the flex child `ui-conversation`'s own column
  arranges is `<ui-conversation-composer>` itself (a custom element, `display:inline` by default) — NOT
  the nested `<form>` one level inside it. **As shipped** (a deliberate simplification from the
  `display:contents` mechanism first pinned here — see the ticket's second Findings entry): the new
  component's OWN stylesheet gives its `:scope` (the host) `display:block;flex:0 0 auto` — participating
  in `ui-conversation`'s flex column as a plain block-level flex item — while the nested
  `<form data-part='composer']` KEEPS its own pre-existing `display:flex;flex-direction:column;gap;
  padding;border-block-start` unchanged (it never becomes `display:contents`; there was no need to erase
  its own box, only to make the HOST participate correctly one level up). `ui-conversation`'s OWN
  stylesheet drops the old `[data-part='composer']` rule entirely (that selector no longer exists in its
  light DOM) and instead sizes `ui-conversation-composer` as its flex child directly
  (`conversation.css`'s `ui-conversation-composer { flex: 0 0 auto; }`).
- **CVC-C4 — busy-state, now internal.** The `busy` prop drives a scope-owned effect (mirroring
  `conversation.ts`'s own `#setComposerBusy`, moved here): disables `#field`/`#sendBtn`/`#micBtn`/
  `#modelsTrigger`/`#effortTrigger`, toggles `data-busy`/`aria-busy`/`aria-disabled` on the host's own
  `<form>` part. **A real, minor timing shift from the pre-extraction code (found during the build-level
  review's gate re-run, not previously named here)**: the OLD `#setComposerBusy` was a plain imperative
  method call from `beginAgentTurn()`/`endTurn()` — genuinely synchronous. Routing it through `busy` (a
  real reactive prop) means the DOM application now rides the SAME microtask-batched `effect()` every
  other reactive prop in this fleet already has (the checkbox `checked`-effect precedent) — imperceptible
  to a real user (it lands before the next paint), but a synchronous test assertion immediately after
  `beginAgentTurn()` no longer observes it without `await whenFlushed()` first. `conversation.browser.
  test.ts`'s own busy/dim cross-engine test needed this fix; doing so also unmasked a genuine, unrelated,
  PRE-EXISTING bug (`ui-text-field` disabling blurs focus in Chromium only — filed as TKT-0057, not fixed
  here) that the old synchronous assertion had been vacuously passing around the whole time. `ui-conversation`
  sets `composer.busy = true` the instant a `beginAgentTurn()` handle
  opens and `false` the instant the last one `finalize()`s/`fail()`s (its own existing `#turnsInFlight`
  tracking, TKT-0034 — unchanged; only the WRITE TARGET changes, from "several internal fields" to "one
  prop").
- **CVC-C5 — `ui-conversation`'s own composition.** `#compose()` (`conversation.ts`) creates
  `document.createElement('ui-conversation-composer')` ONCE (the `master-detail.ts` → `ui-split`
  precedent: side-effect import registers the tag before first `createElement` call), appends it where
  the inline composer used to live, and: (a) forwards `models`/`model`/`efforts`/`effort`/`contextItems`
  down via a reactive effect (replacing `#syncModelsPicker`/`#syncEffortsPicker`/`#syncContextChips`,
  which move INTO the new component and are driven by ITS OWN props instead of reading `this.` from
  `ui-conversation`).

  **The forwarding mechanism, PINNED (code-reviewer finding F1 — the naive plan had a real hole)**:
  `ui-conversation` KEEPS its five existing private callback fields (`#onSubmitCb`, `#onModelChangeCb`,
  `#onEffortChangeCb`, `#onContextDismissCb`, `#onMicClickCb`) exactly as today — its own public
  `onSubmit`/`onModelChange`/`onEffortChange`/`onContextDismiss` methods are UNCHANGED (`this.#onXCb = cb`,
  callable before or after connect, per the existing precedent). At compose time, `#compose()` registers
  FOUR forwarder closures on the new composer that read those fields FRESH on every invocation — never the
  callback value itself, since registration must be safe regardless of whether the consumer's own
  `onXChange(cb)` call happened before or after `ui-conversation` connected. **As shipped** (a deliberate
  simplification from the guarded `#send`-retaining snippet first pinned here — see the ticket's second
  Findings entry): `#send`/`#turnsInFlight` do NOT survive on `ui-conversation`'s own side at all; the
  `onSubmit` forwarder is unconditional, identical in shape to the other three:
  ```ts
  composer.onSubmit((text) => {
    this.addUserMessage(text)
    this.#onSubmitCb?.(text)
  })
  composer.onModelChange((id) => this.#onModelChangeCb?.(id))
  composer.onEffortChange((id) => this.#onEffortChangeCb?.(id))
  composer.onContextDismiss((id) => this.#onContextDismissCb?.(id))
  ```
  `addUserMessage` unconditionally appends the turn regardless of whether a real `onSubmit` consumer
  callback is registered (mirroring the pre-extraction behavior, where a submit always rendered the
  user's bubble even with no consumer listening) — the busy-window guard against a stray double-send
  lives entirely in the composer's OWN `#send()` (CVC-C2's F2 fix: `if (this.busy) return` first line),
  not in a second guard re-derived on `ui-conversation`'s side. These four are registration-side-effect-
  free on the composer (nothing about calling `composer.onModelChange(...)` changes what's visibly
  rendered), so registering them unconditionally at compose time is safe regardless of timing.

  `onMicClick` is DIFFERENT and needs its own handling: the composer's OWN `onMicClick(cb)` has a VISIBLE
  side effect (it reveals the mic button — CVC-C1's opt-in law, promoted from `conversation.ts`'s existing
  mic-opt-in fix). If `#compose()` unconditionally forwarded an `onMicClick` closure the way it does the
  other four, EVERY consumer's composer would un-hide its mic button regardless of whether that consumer
  ever asked for voice input — a visible regression the "byte-behavior-unchanged" bar (this LLD's own
  Intent) explicitly forbids. Fix: `ui-conversation`'s own public `onMicClick(cb)` gains the SAME
  conditional-reveal shape its composer child already has — store `this.#onMicClickCb = cb`, then forward
  to the composer IMMEDIATELY if it already exists (`this.#composer?.onMicClick((id) => cb())`), and
  `#compose()` ALSO checks, at the moment it creates the composer, whether `this.#onMicClickCb` is already
  set (the pre-connect registration case) and forwards it then. Net effect: the mic button reveals on
  `ui-conversation` exactly when a real consumer callback exists, regardless of registration order —
  identical to today's own pre/post-connect law, just one level removed.

  Every other consumer call site (`agent-admin.ts`'s `conversation.onModelChange(cb)` etc.) needs ZERO
  changes — the public method signatures and behavior on `ui-conversation` are unchanged byte-for-byte;
  only the internal implementation (a stored field read by a forwarder, instead of a directly-registered
  listener) changes.
- **CVC-C6 — descriptor + tests.** `conversation-composer.md` (own attributes/properties/events/parts/
  geometry/aria blocks, `tier: pattern`, `extends: UIElement`, `composes: [ui-text-field, ui-menu,
  ui-button, ui-icon]` — documentary only, not schema-gated per `component-descriptor.ts`'s `FIELD_SHAPE`).
  `conversation-composer.test.ts` — the jsdom behavioral suite for models/efforts pickers, context chips,
  mic opt-in, busy-state, AND the reconnect regression test (all currently in `conversation.test.ts`,
  proving the composer's OWN contract directly rather than through `ui-conversation`'s). `conversation.
  test.ts` keeps (or gains, if none exist) a THIN integration-level check that `ui-conversation` correctly
  forwards props/callbacks to a composed `ui-conversation-composer` instance — it does not re-prove the
  composer's own internals.

## Composition ordering (the fan-out this LLD gates)

One writer per file, matching this repo's own parallel-build discipline (`system-decompose`'s own
best-practice): `composer-options.ts` (unchanged, already shared) → `conversation-composer.ts`/`.css`/
`.md`/`.test.ts` (net-new, the donor code moves here) → `conversation.ts`/`.css`/`.md`/`.test.ts` (the
consuming edit — composes the new tag, its OWN composer-building code deleted). The consuming edit is
SEQUENCED after the new component's own file (code-reviewer finding F4 — softened from an earlier
"cannot start before," which overstated it: `conversation.ts` could in principle be authored in parallel
against this LLD's own frozen CVC-C1/C2 interface, with the type gate as the integration check; sequential
is still the right call for a one-folder wave this size, not a hard technical edge).

## Error / edge handling

- Every edge case already resolved this session for the inline composer (the `ui-menu` trigger
  `data-part` re-tagging workaround; the `role="menuitem"`/`tabindex` explicit-set fix for lazily-added
  picker items; the reconnect-safe listener-arming flag, reset per connection; the reference-equality
  guards for the picker option lists AND the context-chip list, including the `EMPTY_CONTEXT_ITEMS`
  stable-reference fix; the mic button's opt-in-hidden-until-`onMicClick` fix; closing an open popover
  when its picker is hidden) moves WITH the code, unchanged. This LLD introduces no new edge case of its
  own — verified by the "byte-behavior-unchanged" acceptance bar (TKT-0056's own Acceptance).
- The one genuinely new edge: `ui-conversation`'s reactive effect that forwards
  `models`/`model`/`efforts`/`effort`/`contextItems` down to the composed child must handle the composer
  not existing yet (pre-first-connect) the same way the existing `#settingsEl`/`#rewireAllSections`
  pattern in `agent-admin.ts` already handles an equivalent case (`if (this.#composer) { ... }` guard) —
  not a new mechanism, the SAME established idiom this repo already uses for "forward props to a composed
  child once it exists."

## New-ADR flags

None. No new event name, base class, catalog admission, geometry row, or token is introduced — every
mechanism this component uses was already built and independently reviewed this session inside
`conversation.ts` (see TKT-0056's own Acceptance/Scope-Open). Catalog posture: outside ADR-0087's
fleet-derived coverage gate by package placement (`packages/agent-ui/app/src/controls`, not
`packages/agent-ui/components/src/controls` — the `master-detail-pane` precedent, verified against
`a2ui/src/catalog/default/index.test.ts`'s own `CONTROLS_ROOT` scan root) — no allowlist edit needed, no
fork to rule.

## Acceptance (TKT-0056)

- `npm run check && npm test` green.
- Every existing `ui-conversation` consumer (`agent-admin.ts`, `site/pages/a2ui-chat.ts`, and their own
  tests `agent-admin.test.ts`/`a2ui-chat.test.ts` — the verified real consumer list, code-reviewer finding
  F5; `a2ui-live.ts` was a stale claim, never composes `ui-conversation`) needs ZERO call-site changes —
  `onSubmit`/`onModelChange`/`onEffortChange`/`onContextDismiss`/`onMicClick`/`beginAgentTurn`/
  `disclosure` all keep their exact current public signatures and behavior on `ui-conversation` itself.
- `conversation-composer.test.ts` covers the composer's own behavior directly (promoted from
  `conversation.test.ts`, including the reconnect regression test); `conversation.test.ts` proves the
  forwarding/composition integration, not a re-derivation of the composer's internals.
- Independent review (generator ≠ critic) before this is treated as done — the same discipline every
  other build this session has held to.

---

## v2 — the unrolled field-frame anatomy (TKT-0058, 2026-07-15; supersedes CVC-C3's nested-`ui-text-field` anatomy)

Kim's redesign directive: unroll the nested `ui-text-field`; the composer ITSELF is "a type of advanced
ui-text-field (or textarea)" — one field frame containing a tags row above the text, the multi-line text,
and a menus/icon-buttons row below it. This section pins the v2 mechanism; everything it does not name
(the picker sync machinery, chips row, the five callbacks, the busy-guard-first `#send()` ordering, the
reconnect-armed flags, `ui-conversation`'s composition/forwarding — CVC-C1/C2/C5) is UNCHANGED from v1.

- **CVC-C3′ — the v2 DOM anatomy.** The nested `<form data-part="composer">` and the `ui-text-field`
  child are both GONE. The HOST is the field frame AND the flex column:
  `[data-part="context-chips"]` (hidden when empty) → `[data-part="editor"]` →
  `[data-part="options"]` (leading pickers / trailing mic+send). The editor is the ADR-0014
  contenteditable pattern via its multi-line sibling `ui-textarea` (ADR-0134), reused: a stable,
  control-created `<div data-part="editor" contenteditable="plaintext-only" role="textbox"
  aria-multiline="true" aria-label="Message" data-placeholder="Ask anything..">`, created ONCE
  (idempotent), never re-rendered. Two wires: surface→model on `input` (suppressed mid-IME-composition;
  `compositionend` catches the model up), model→surface inside an effect under the CARET GUARD
  (`editor.textContent !== value` before writing), plus the `data-empty` placeholder toggle. NEW public
  `value` string prop (`attribute: false` — never author-composed, no markup value to seed). The
  ADR-0017 native-`<form>` carve-out dependency disappears with the form.
- **CVC-C7 — keyboard (the multi-line inversion).** Enter (no Shift, `!isComposing`) → preventDefault +
  `#send()`; Shift+Enter falls through to the platform's newline insertion. This deliberately sits
  BETWEEN its two donors: `ui-text-field` submits on every Enter (single-line), `ui-textarea` never
  submits on Enter (ADR-0134's inversion) — a chat composer is the third shape: Enter commits, Shift+Enter
  authors. `#send()` reads `this.value.trim()` (the signal, synchronous — the busy guard stays the first
  line, TKT-0056 F2 unchanged) and clears via `this.value = ''` (the caret-guard effect wipes the surface).
- **CVC-C8 — focus.** `host.focus()` overrides to `editor.focus()` (the ui-textarea precedent). A host
  `click` listener focuses the editor UNLESS the click target sits inside `ui-button`, `ui-menu`, or a
  `[data-part="context-chip"]` (Kim: "not its tags, menus, buttons"). The focus ring renders on the HOST
  frame via `:scope:has([data-part='editor']:focus)` — deliberately NOT `:focus-within`: focus on the
  send/mic buttons or inside a picker menu must NOT light the field frame (each has its own ring; a
  double indication is the exact hazard ADR-0014 dev#1's border-to-transparent rule exists to avoid).
- **CVC-C9 — states + geometry (the text-input law, multi-line).** The frame adopts `ui-textarea`'s
  ADR-0014 field-frame map verbatim as `--ui-conversation-composer-*` tokens: idle border
  `--md-sys-color-neutral`, hover `neutral-high`, focus `transparent` (the shared outline ring is the
  sole indicator), bg `neutral-surface`, ink `neutral-on-surface`, placeholder/variant
  `neutral-on-surface-variant`; prose `line-height: 1.5`; radius `--ui-radius-base`; the entry-control
  `min-inline-size: 20ch` floor (ADR-0021). The editor auto-grows from a one-line minimum
  (`font × line-height`), capped at `max-block-size: 6em` → `overflow-y: auto` (Kim's cap; the ADR-0134
  growable-minimum law, bounded). Motion: `:state(ready)` gate (rAF after first paint), border/bg/color
  transitions only. `busy` (v1's whole-composer dim + part disabling, unchanged in intent) now keys off
  the host's own reflected `[busy]` attribute instead of the removed form's `data-busy`; the editor
  becomes `contenteditable=false` + pointer-inert while busy; host ARIA (`ariaBusy`/`ariaDisabled`)
  rides `internals` — the fleet's ARIA-never-host-attributes law now applies since the carrier is the
  host itself, not an internal part. Forced-colors: frame border/ink/placeholder → `CanvasText`, busy →
  `GrayText` (the textarea block, adapted).
- **CVC-C10 — consumer/test blast radius (selector-only).** (v2) The public callback/prop surfaces of both
  this element and `ui-conversation` are unchanged. Selector updates only: a2ui-chat's `sendIntent`
  helpers re-scope `[data-part="composer"] [data-part="editor"]` → `ui-conversation-composer
  [data-part="editor"]` (the typing mechanism — `editor.textContent` + `input` — survives verbatim);
  agent-admin's live-apply browser probe and the conversation/composer test files replace
  field-`.value`/form-`submit` driving with `composer.value` + send-click (or an Enter keydown);
  `conversation.browser.test.ts`'s busy/dim + focus probes retarget the host + editor part. TKT-0057's
  engine-split focus assertion is retargeted at the own editor (same question, new mechanism — the
  observed split is re-verified, not assumed).

---

## v3 — the reference typeahead (GH #849 · `capability-availability-tagging.spec.md` S2, 2026-08-13)

Governed by [`capability-availability-tagging.spec.md`](../spec/capability-availability-tagging.spec.md)
SPEC-R5 (grammar) / R6 (commit shape) / R7 (keyboard, AX, event law) — slice **S2**, "composer grammar
core". No new R# minted; this section is the build-level mechanism those clauses left to an LLD, plus the
§10-booked repair of this record's own pre-widening seam inventory. Everything v1/v2 pin and this section
does not name is UNCHANGED. **No ADR flag**: no new event name (the closed vocabulary gains nothing — the
`ALLOWED_EVENTS` constants are untouched), no new base class, no catalog admission, no geometry row, and no
new dependency (the panel is control-created light DOM; the ONE import added is the *pure* `computePosition`
function already shipped in `@agent-ui/components/traits/overlay`).

- **CVC-C11 — the vocabulary + prop seam (SPEC-R6).** `composer-options.ts` gains two types:
  `ReferenceOption {id, label, kind, description?}` (a roster entry) and `TurnReference {id, label, kind}`
  (a committed one — the ONLY load-bearing representation of a mention/invocation). Two additive-optional
  props, `mentionables` / `invocables` (`readonly ReferenceOption[] | undefined`, `attribute: false`, the
  `models`/`providers` shape verbatim) sit between `contextItems` and `busy` in the props order (the
  descriptor's `attributes[]` bijection follows). **`kind` is OPAQUE here**: this element groups and
  displays it and nothing else — never `Entry`, never a store, never a kind's semantics (the SPEC's layering
  clause; `ui-agent-admin` owns that projection in S3). `undefined` OR empty ⇒ that trigger is a plain
  character and NO panel DOM is ever built (SPEC-R6 AC3's byte-identity, enforced by construction rather
  than by a hidden-element check).
- **CVC-C12 — the grammar as one pure function (SPEC-R5).** `activeTokenAt(text, caret)` walks back from the
  caret to the last whitespace and accepts that word ONLY if its first character is `@`/`/`. That single
  rule delivers all three clauses at once: a mid-word `@` yields a word starting elsewhere (no menu),
  whitespace ends the word (menu closes, characters stay plain inert text), and everything after the trigger
  is a whitespace-free filter query. Filtering is case-insensitive CONTAINS over `label`. Zero matches
  CLOSES the panel (never an empty one); because every pass re-derives from the current token, backspacing
  to a matching prefix reopens it with no state to unwind. Escape records `{trigger, start}` in
  `#dismissedToken`, which suppresses reopening while the caret stays in that same token.
  **The caret probe is the one real trap** (found by this slice's own suite, fixed at root): the selection's
  end must be a TEXT NODE inside the editor. An element-level end is either an empty editor (same answer as
  the end-of-text fallback) or a STALE selection from a previous DOM generation — trusting one read offset 0
  for a five-character line, so no token was seen, the menu silently failed to open, and the following Enter
  SENT instead of committing.
- **CVC-C13 — the panel (SPEC-R7).** A control-created `<div data-part="reference-menu" role="listbox"
  popover="manual" aria-label="References">`, built LAZILY on the first live trigger, placed with the overlay
  trait's PURE `computePosition` (preferring `top-start` — a chat composer sits at the bottom of its surface,
  so the panel must not cover the text being typed; flip/shift keep it on screen). **Deliberately NOT the
  `overlay()` controller**: that controller announces `close`/`toggle` ON ITS HOST (ADR-0101), and this
  element's contract is `events: []` with no menu event allowed to escape (SPEC-R7 AC2) — borrowing only the
  placement math keeps the fleet's one positioning model without opening an event surface the descriptor
  denies exists. `popover="manual"` (not `auto`) because the composer then owns EVERY close path
  (Escape/blur/whitespace/commit/send/busy/disconnect) and there is no platform light-dismiss whose `toggle`
  could desync the open flag — the exact desync class `combo-box.ts` needs its own echo-guard for.
  `[data-open]` is the element's own state truth (set alongside `showPopover()`), which is also what makes
  the whole slice jsdom-testable and keeps the panel hidden in a Popover-API-less environment.
  Group headers (`[role="group"]` + `aria-label`, plus an `aria-hidden` sighted label) render exactly when
  the visible set spans MORE THAN ONE kind: that is the `/` menu's grouped shape and it also suppresses a
  redundant single header on the Resources-only `@` menu. Kind order = order of first appearance in the
  consumer's roster.
- **CVC-C14 — keyboard + AX (SPEC-R7).** `ui-combo-box`'s active-descendant discipline RESTATED (not an
  embedded `ui-combo-box`): DOM focus never leaves the editor; ArrowUp/ArrowDown move `[data-active]` +
  `aria-activedescendant` (wrapping); Escape closes; Enter commits. The typeahead branch sits at the TOP of
  the existing editor `keydown` listener, ahead of the Enter-sends law — so an Enter with the panel open
  commits and never sends, while Shift+Enter's newline law falls through untouched. Opening always
  highlights the FIRST option, which is what makes "Enter with an open menu commits" true unconditionally.
  `aria-expanded`/`aria-controls`/`aria-activedescendant` ride the EDITOR part (role=textbox supports all
  three) and are REMOVED on close, so a roster-less composer's editor attributes are byte-identical. The
  panel's own `pointerdown` is preventDefaulted so a commit-by-click never moves focus off the editor.
- **CVC-C15 — commit + the chip row's cohabitation (SPEC-R6; the SPEC's open question, ruled).** A commit
  removes the token text `[start, end)`, writing the editor SURFACE and the `value` model synchronously (so
  the caret can be restored in the same turn and the caret-guard effect sees no divergence to fight), then
  appends a `{trigger, ref}` entry — deduped by `kind`+`id` — and closes the panel. **Cohabitation ruling**:
  ONE row (`[data-part="context-chips"]`), consumer-owned `[data-part="context-chip"]`s FIRST, composer-owned
  `[data-part="reference-chip"]`s after; each family rebuilds only its OWN chips (`#syncContextChips`'s
  previous `replaceChildren()` would have wiped a just-minted reference chip, so it now removes its own and
  inserts before the first reference chip), and the row is `[hidden]` iff it holds no chips at all — for a
  roster-less consumer, `contextItems.length === 0` verbatim. No wrapper elements were added, which is what
  keeps SPEC-R6 AC3's DOM byte-identity literally true. Per-kind visual treatment = the typed trigger
  character as a `[data-part="reference-chip-sigil"]` (mention vs invocation) plus `data-kind` for CSS, on
  the accent family so a turn attachment reads distinct from a neutral consumer context tag — no second icon
  vocabulary. *(That sigil sentence is SUPERSEDED by **CVC-C18** below — GH #891/SPEC-R9 removes the node and
  moves kind identity to an optional consumer-supplied glyph; it stays here verbatim as the S2 ship record,
  and every other clause in this bullet still holds.)* Reference chips are composer-OWNED state (there is no `references` prop): they survive a
  reconnect in the DOM while their listeners do not, so `connected()` rebuilds them once per connect (the
  `#contextItemsBuiltFrom` reset precedent).
- **CVC-C16 — `onSubmit`, widened additively (SPEC-R6).** `onSubmit(cb: (text, references?) => void)`; the
  send delivers a stable EMPTY array when there are none (the `EMPTY_CONTEXT_ITEMS` reason) and clears the
  chips alongside the text. A single-parameter consumer is byte-unaffected. `ui-conversation` forwards both
  rosters down in its existing props effect and passes `references` through its `onSubmit` forwarder — a
  PASS-THROUGH only (it adds no semantics of its own, and the user bubble still shows the typed text alone).
  That seam is what S3 (`ui-agent-admin`'s roster projection + turn-time resolution, SPEC-R8/R4) builds on.
- **CVC-C17 — tests.** `conversation-composer.test.ts` carries the whole slice in jsdom (grammar, filter,
  dismissal, commit, dedupe, chip cohabitation, the reconnect re-arm, ARIA wiring, Enter/Arrow/Escape, the
  `events: []` leak probe, busy/disconnect closure); `conversation-composer.browser.test.ts` (NEW, both
  engines) carries what only a real engine can prove — SPEC-R7 AC1's Arrow→Arrow→Enter walk under REAL
  keystrokes with `document.activeElement` asserted throughout, plus the panel really entering the top layer
  out of an `overflow: hidden` chat shell (hit-tested at its own centre, the GH #260 clipping class) and the
  committed chip's real painted box. `conversation.test.ts` proves the pass-through seam only, never the
  composer's internals.

---

## v4 — the de-sigilled chip (GH #891 · the same SPEC's §11, SPEC-R9 — slice S4, 2026-08-14)

Governed by [`capability-availability-tagging.spec.md`](../spec/capability-availability-tagging.spec.md)
**SPEC-R9**; this section is the §11.5-booked repair of v3's own chip-anatomy record (CVC-C15's per-kind
treatment clause) plus the build-level mechanism R9 leaves to this altitude. Everything else in v1/v2/v3
stands unchanged. **No ADR flag**: no new event name, no new dependency, no new base/geometry — one node
removed, one optional node added.

- **CVC-C18 — the chip's anatomy, amended (supersedes CVC-C15's "per-kind visual treatment" sentence).**
  The `[data-part="reference-chip-sigil"]` node is **REMOVED, not restyled** — the trigger character the user
  typed is not part of the chip's label (the owner's screenshot: "/ itinerary-timeline ×"). What identifies a
  chip now: (1) FAMILY — the shipped accent ink (`--ui-conversation-composer-reference-chip-*`), unchanged;
  (2) KIND — the shipped `data-kind` attribute (a themed consumer's own hook) plus an OPTIONAL leading
  `[data-part="reference-chip-icon"]` `ui-icon[data-role="icon"]` rendering the glyph the CONSUMER named on
  the roster entry. `icon` absent ⇒ label + dismiss only, never a placeholder box. The composer maps NOTHING
  (§5's layering clause holds verbatim: `icon` is as opaque to this element as `kind` — `ui-agent-admin`'s
  `entries.ts` owns the kind→glyph table). AX is unchanged by construction: the sigil was decorative, the
  glyph is decorative for free (`ui-icon`'s own `internals.ariaHidden`, icon.ts — no host `aria-hidden` to
  set from here), and the dismiss button still carries the accessible name.
- **CVC-C19 — the vocabulary widening + the dropped trigger.** `ReferenceOption` and `TurnReference` each
  gain `icon?: string` (composer-options.ts), round-tripped verbatim exactly as `kind` is and OMITTED rather
  than sent as `undefined`, so a no-icon consumer's delivered reference keeps the pre-R9 `{id,label,kind}`
  key set byte-for-byte (asserted, not assumed — the R9 AC2 negative case reads `Object.keys`). The internal
  `CommittedReference {trigger, ref}` wrapper is GONE: the sigil was `trigger`'s only reader, so
  `#references` now holds `TurnReference`s themselves — dead state removed with the node that read it, never
  left behind as a field nothing consumes.
- **CVC-C20 — tests.** Four jsdom cases (`conversation-composer.test.ts`, the R9 block): AC1 asserts the
  WHOLE chip's rendered text equals the label and that no descendant's text is a trigger character (never a
  per-part read of a node the requirement deletes); AC2 covers both arms — glyph present (leading `ui-icon`,
  `data-role="icon"`, the reference carrying the same glyph) and glyph absent (no icon node, no `icon` key);
  AC3 re-proves dismiss/dedupe/clear-on-send over icon-carrying chips. The pre-existing browser case's chip
  assertions stand unmodified (a painted, non-zero pill) — R9 changes what is INSIDE the pill, not that it
  paints — and TWO real-engine cases join it (both engines): the glyph really resolves against the registered
  curated pack to a painted `<svg>` LEADING the label and inheriting the chip's accent ink (an unknown name
  would render `data-icon-missing`, resolve.ts — which is what makes this a proof rather than a name
  comparison, and why an `ICON_NAMES` re-listing in a unit test was rejected: it would copy an enumerable set
  AND open an app→icons edge the DAG does not grant), and an icon-less entry still commits a real pill.

---

## v5 — the capabilities panel (GH #891 · SPEC-R11 — slice S6, 2026-08-14)

Governed by the same SPEC's **SPEC-R11**; the §11.5-booked repair of this record's prop/callback inventory
(CVC-C1/C2) plus the build-level mechanism R11 leaves to this altitude. **Composer-only**: `ui-conversation`
is deliberately NOT widened here and `ui-agent-admin` is not touched at all — that wiring is S7's, gated on
ADR-0190 (this section is buildable and correct under EITHER arm). **No ADR flag**: no new event name (the
`ALLOWED_EVENTS` constants are untouched), no new dependency, no geometry row; one already-shipped sibling
control (`ui-switch`) joins the composed set.

- **CVC-C21 — the prop + callback seam.** `composer-options.ts` gains `CapabilityRow {id, label, kind,
  description?, icon?, included}`. One additive-optional prop, `capabilities` (`readonly CapabilityRow[] |
  undefined`, `attribute: false`), sits between `invocables` and `busy` (the descriptor's `attributes[]`
  bijection follows), plus one registration, `onCapabilityToggle(id, included)`. `kind`/`icon` are OPAQUE
  (§5's layering clause, the `mentionables` law verbatim); `undefined` OR empty ⇒ no trigger, no panel DOM
  ever built — AC1's byte-identity by construction, not by a hidden element.
- **CVC-C22 — why NOT a `ui-menu` (the one real fork at this altitude).** The four shipped pickers are
  `ui-menu`s. This panel is not: `ui-menu`'s items are `role=menuitem` — ACTION semantics that close on
  activate — while a steering surface must stay open across several toggles in one visit, and its rows hold
  real focusable controls rather than commit targets. So it reuses the REFERENCE MENU's discipline instead:
  a control-created `<div role="group" popover="manual" aria-label="Capabilities">` in the top layer, placed
  by the same pure `computePosition` (anchored to its own TRIGGER, preferring above — the composer sits at
  the bottom of its surface), with `[data-open]` as the element's own state truth and THIS element owning
  every close path: the trigger, Escape (which also returns focus to the trigger), an outside `pointerdown`
  on the document, a send, `busy`, and the connection's disposer. `role="group"`, not `listbox`/`menu`:
  DOM focus really does move into these switches, so the platform's own switch semantics are the AX story.
- **CVC-C23 — zero local mutation, and the focus trap it opens.** A `ui-switch` toggles ITSELF on click
  (`UIIndicatorElement`), so "the composer mutates nothing" is an active discipline, not an absence: the
  panel's `change` handler reads the flipped value, RE-ASSERTS `checked` from the CURRENT prop, then reports
  `onCapabilityToggle(id, next)`. The consumer's answer (a new array) is then the ONLY thing that moves the
  visible state. That answer must NOT rebuild the panel: replacing the `ui-switch` a keyboard user just
  Space-toggled drops DOM focus to the body mid-visit. Hence a STRUCTURAL signature (`#capabilityShapeOf` —
  ids/labels/kinds/glyphs/descriptions, deliberately NOT `included`): shape unchanged ⇒ a state-only pass
  over the existing nodes; shape changed (a real roster change) ⇒ a full rebuild. Both proven, jsdom AND
  real-engine (same-node identity + `document.activeElement`).
- **CVC-C24 — the event fence, widened by measurement.** SPEC-R11 names the switch's "`change`/`toggle`";
  the shipped `UIIndicatorElement` actually emits **`input` AND `change`** (bubbling + composed), which this
  slice's own `events: []` leak probe caught. Both are stopped at the panel boundary (the editor-`input`
  suppression discipline, applied one level out) — the fence is "no switch event crosses the host", never a
  name list. Also widened for the same reason: the click-to-focus exclusion now covers
  `[data-part="capabilities-panel"]` WHOLESALE — without it, clicking a switch stole focus to the editor and
  undid the interaction that landed there (a real defect, caught by its own probe, fixed at the region level
  rather than by naming `ui-switch` so a future row adornment cannot fall outside it).
- **CVC-C25 — tests.** Eleven jsdom cases (the R11 block): AC1 (unset AND empty ⇒ no trigger/panel, plus the
  leading cell's exact child list), the trigger's pill anatomy + LAST position, AC2 (grouping, per-row
  switch state, aria-labels, row anatomy with/without glyph+description), the single-kind no-header case,
  AC2's flip semantics (callback with the NEW state · panel stays open · row reverts to prop truth · the
  prop object itself untouched · a consumer answer moving it), the in-place-update/node-identity case, AC3's
  leak probe, every close path in one case, the clear-mid-visit case, and the click-to-focus exclusion. ONE
  browser case per R11 AC3 (both engines): open → real click toggle → keyboard Space toggle → consumer
  answer → Escape, asserting the top layer out of an `overflow: hidden` shell, painted switch tracks pinned
  to the row's trailing edge, `document.activeElement` at every step, and `aria-expanded` back to false.
