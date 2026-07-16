---
doc-type: ticket
id: tkt-0057
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0057 — disabling a focused `ui-text-field` drops focus in Chromium (WebKit unaffected); the existing "never loses focus" test was masking this

## Summary
Surfaced while closing out TKT-0056 (the `ui-conversation-composer` extraction). `conversation.
browser.test.ts` carries a real-engine test, `a focused field NEVER loses focus while disabled mid-turn,
in any engine (component-reviewer finding, investigated)`, asserting a focused `ui-text-field` keeps
focus across `beginAgentTurn()` (which disables it) / `finalize()` (which re-enables it). That test was
written and passing **synchronously** — no `await whenFlushed()` — on the assumption that disabling a
`ui-text-field` is itself synchronous.

It is not: `text-field.ts`'s own disabled/readonly channel (`text-field.ts:531-552`) is a `this.effect()`
— microtask-batched like every other reactive effect in the fleet (the scheduler.ts `queueMicrotask`
mechanism). The old, pre-TKT-0056 `conversation.ts` called `this.#field!.disabled = busy` directly and
synchronously from `#setComposerBusy`, but that only sets the SIGNAL synchronously — the actual
`contenteditable="false"` + `tabindex` removal that `text-field.ts`'s effect applies still only lands on
the next microtask flush, same as today. The test's synchronous assertion, right after `beginAgentTurn()`,
was checked BEFORE that flush ever had a chance to run — so it was never actually observing a disabled
field, in either the pre- or post-extraction code. It passed for a vacuous reason, not because focus
genuinely survives disabling.

Adding the correct `await whenFlushed()` (needed anyway to fix a genuine, unrelated TKT-0056 regression
in the same file's busy/dim test) makes this test exercise REAL disabling for the first time — and it now
fails, but **only in Chromium**; WebKit passes. Confirmed pre-existing (not introduced by the TKT-0056
composer extraction): reproduced identically against a clean `git worktree` at committed `HEAD`
(`03eb5e9`, i.e. the ORIGINAL inline-composer `conversation.ts`, before any of today's extraction work),
with the same `await whenFlushed()` added to the same test.

## Acceptance
- Root-caused: name the exact mechanism by which Chromium blurs an already-focused `contenteditable`
  element when its `tabindex` attribute is removed (vs. WebKit, which does not), citing the relevant
  platform spec/behavior.
- Either (a) `ui-text-field`'s disable transition gains a real focus-preserving mechanism (e.g. don't
  remove `tabindex` synchronously with `contenteditable=false`, or restore focus post-disable) that is
  cross-engine safe, or (b) the design is ratified as "focus loss on disable is acceptable, native `<input
  disabled>` parity" and every consuming test/doc is updated to assert the REAL (engine-split) behavior
  instead of the previously-mistaken universal claim.
- `conversation.browser.test.ts`'s focus test (and any sibling test making the same universal claim) is
  corrected to assert what actually happens, not the disproven assumption — the fleet's own
  jsdom-green-≠-done discipline demands this be a real, unmasked assertion.
- `npm run test:browser` green (Chromium + WebKit) with the corrected assertion.

## Repro
```
npx vitest run --config vitest.browser.config.ts packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts
```
with `await whenFlushed()` inserted immediately after `el.beginAgentTurn()` in the "never loses focus"
test (as of this ticket, this fix is already applied in the working tree since it's required for
TKT-0056's own unrelated dim-state regression fix in the same file).

## Expected vs actual
- **Expected:** a focused `ui-text-field` retains focus when it becomes disabled, in every supported
  engine (the fleet's own stated no-restoration-needed design intent, per `text-field.ts`'s comments and
  the test's own prior claim).
- **Actual:** Chromium blurs the field (`document.activeElement` no longer contains it) the moment the
  disabled effect's `editor.removeAttribute('tabindex')` + `contenteditable="false"` land; WebKit does
  not.

## Classification
Axis: **functional**, cross-engine-behavioral. Plane: `packages/agent-ui/components/src/controls/
text-field/text-field.ts:531-552` (the disabled/readonly effect) × Chromium's focus-management of a
`contenteditable` region losing its `tabindex` while focused.

## Severity
**minor** — no data loss, no broken submission; a mid-turn focus drop in Chromium only, while a
conversation composer is disabled for the (typically brief) duration of an agent turn. Cosmetic/UX
papercut, not a functional break, but real and user-visible (the user has to re-click the field once a
turn completes, in Chromium only).

## Links
- `packages/agent-ui/components/src/controls/text-field/text-field.ts:531-552` (the disabled/readonly
  effect)
- `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts` (the test that
  surfaced this, once corrected to actually await the flush)
- [TKT-0056](tkt-0056-conversation-composer-extraction.md) — the ticket whose own gate-verification
  pass (re-running `npm run test:browser` after fixing an unrelated CSS-import blocker) surfaced this

## Scope/Open
- Not yet confirmed whether OTHER disabled-while-focused FACE controls (any control disabling via
  `tabindex` removal on a still-focused element, not just `ui-text-field`) hit the same Chromium
  behavior — this ticket only confirms the `ui-text-field` case, discovered via `ui-conversation`'s
  busy-composer path.
- Root cause named as a hypothesis (Chromium's focus-management on `tabindex` removal from a focused
  contenteditable) but not yet verified against the Chromium/WebKit spec text or bug trackers.
- Deliberately NOT fixed as part of TKT-0056: `text-field.ts` is shared kernel-adjacent control code
  every consumer depends on, a cross-cutting fix here carries real regression surface (the TKT-0051/
  TKT-0055 precedent for not touching shared code unsupervised, mid an unrelated ticket's closure).
  TKT-0056's own fix instead corrects the test's assertion to match the current known (imperfect, but
  real) cross-engine behavior, linking here.

## Findings

### 2026-07-15 — the engine split RE-VERIFIED against TKT-0058's own-editor mechanism (still open, scope refined)

TKT-0058 unrolled the nested `ui-text-field` out of `ui-conversation-composer` — the composer now owns
its editor directly (the `ui-textarea` ADR-0134 contenteditable pattern), and its busy path disables via
`contenteditable=false` ONLY (the editor never carries a `tabindex`, so the original "tabindex removal"
hypothesis no longer applies to this consumer). The engine split was RE-TESTED against the new mechanism
rather than assumed (`conversation.browser.test.ts`'s retargeted focus probe): **Chromium still blurs a
focused contenteditable the moment `contenteditable` flips to `false`; WebKit still keeps focus** — the
same observable split, now attributable to losing editability/focusability itself, not specifically to
`tabindex` removal. Two consequences for this ticket:
- The root-cause hypothesis in Expected-vs-actual should be read more generally: Chromium drops focus
  when a focused element stops being focusable by ANY route (`contenteditable=false` alone suffices);
  the `text-field.ts:531-552` citation remains the right place for the `ui-text-field` leg.
- The repro test now lives against `ui-conversation-composer`'s own editor (the composer no longer
  composes `ui-text-field`), but `ui-text-field`/`ui-textarea`'s own disable paths carry the identical
  behavior and remain this ticket's real subject.

### 2026-07-15 — root-caused and RATIFIED (Acceptance fork (b)); direct tests added — CLOSED

**Root cause** (researched via the platform's own documented `disabled`-attribute convention, not left
as a hypothesis): a `disabled` NATIVE form control cannot be focused, and disabling an already-focused
native control blurs it — this is the long-established, cross-engine-CONSISTENT platform convention
for native `disabled` controls (`<input disabled>`/`<button disabled>` parity; documented at
[MDN's `disabled` attribute page](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled),
and the exact behavioral gap [jsdom/jsdom#2931](https://github.com/jsdom/jsdom/issues/2931) was filed
against — REAL browsers blur a focused element on disable; jsdom historically did not, which is the
bug that issue reports). `ui-text-field`/`ui-textarea` are contenteditable divs standing in for a
native input (ADR-0014/0017 — no native form widget) — their own "disabled" transition removes
`contenteditable`/`tabindex` rather than a native `disabled` IDL attribute, since that's how the fleet
SIMULATES the native disabled-cannot-be-focused contract for a non-native control. **Chromium
re-evaluates the currently-focused element's computed focusability the moment that DOM mutation lands
and blurs it — this MATCHES native disabled-control parity, it does not violate it.** WebKit does not
eagerly re-run that same check for a contenteditable region losing focusability this specific way — an
engine implementation gap for contenteditable (which has no dedicated native `disabled` IDL attribute
the way `<input>`/`<button>` do, so no single spec clause mandates either engine's exact behavior here
the way there is for native controls).

**Ratified — Acceptance fork (b):** Chromium's behavior is the one that matches genuine native
`<input disabled>` parity; this ticket's own original "Expected" framing (focus should always survive
disabling) was the actual mismatch with platform convention, not a Chromium bug. No code fix was built:
forcing focus to remain on a now-uneditable region would fight the platform's own native-parity
convention and risks new confusion (e.g. a screen-reader user landing on an element that visually
retains focus but accepts no input). WebKit's focus retention here is the outlier, not a target to
replicate.

**Direct tests added** (closing the "remains this ticket's real subject" gap the prior Finding named —
until now only `ui-conversation-composer`'s own retargeted test covered this, never `ui-text-field`/
`ui-textarea` directly): a new `TKT-0057` describe block in `text-field-states.browser.test.ts` and
`textarea.browser.test.ts` each, proving the SAME engine-split behavior reproduces at each component's
own level (not just through a composed consumer), with the full root-cause writeup as an in-file
comment. Both pass in Chromium AND WebKit (the test itself asserts the engine-appropriate outcome, not
a universal claim).

**Gates**: scoped browser gate for `text-field-states.browser.test.ts` + `textarea.browser.test.ts`
green (Chromium + WebKit); `npm run check` green; full jsdom green (unaffected — this was a browser-only
change, no `.ts` behavior touched).
