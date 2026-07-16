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
  SPEC-R5's closed six-event vocabulary has no picker-commit/submission kind, and this component inherits
  that same law by lineage, not by re-deriving it). **NEW**: `onSubmit(text: string): void` — the
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
- **CVC-C10 — consumer/test blast radius (selector-only).** The public callback/prop surfaces of both
  this element and `ui-conversation` are unchanged. Selector updates only: a2ui-chat's `sendIntent`
  helpers re-scope `[data-part="composer"] [data-part="editor"]` → `ui-conversation-composer
  [data-part="editor"]` (the typing mechanism — `editor.textContent` + `input` — survives verbatim);
  agent-admin's live-apply browser probe and the conversation/composer test files replace
  field-`.value`/form-`submit` driving with `composer.value` + send-click (or an Enter keydown);
  `conversation.browser.test.ts`'s busy/dim + focus probes retarget the host + editor part. TKT-0057's
  engine-split focus assertion is retargeted at the own editor (same question, new mechanism — the
  observed split is re-verified, not assumed).
