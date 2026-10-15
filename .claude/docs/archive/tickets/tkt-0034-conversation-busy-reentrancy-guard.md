---
doc-type: ticket
id: tkt-0034
status: done
date: 2026-07-13
owner:
kind: bug
---
# TKT-0034 — ui-conversation has no busy/re-entrancy guard: a re-send mid-turn drops the typed text

## Summary
Surfaced by the M2 Phase-2 a2ui-chat migration review (2026-07-13). `UIConversationElement`'s send
path (`conversation.ts` `#send`) unconditionally `addUserMessage(text)` + clears the composer +
fires `#onSubmitCb` — with NO guard against a turn already being in flight. If the consumer's submit
callback is itself busy-guarded (the normal pattern — one agent turn at a time), a second Send during
the in-flight window appends an orphan user bubble, clears the field, and silently discards the typed
text with zero in-flight affordance. The primitive exposes no `busy`/`disabled` prop, so a consumer
cannot reflect "turn in flight" onto the composer either. The bespoke `a2ui-chat` page (pre-migration)
HAD both guards (`if (text === '' || busy) return` + a `.is-busy { pointer-events:none; opacity:.55 }`
composer affordance + `aria-disabled` on Send); the migration onto the primitive lost them because the
primitive never had them.

## Acceptance
- `ui-conversation` no longer loses input on a re-entrant send: while a turn is in flight (a
  `beginAgentTurn()` handle exists that is not yet `finalize()`/`fail()`-ed), `#send` is a no-op (the
  typed text is retained, not cleared/discarded) OR the composer is disabled so the send can't fire.
- The composer shows an in-flight affordance (disabled/dimmed + `aria-disabled`/`aria-busy`) while a
  turn is in flight — the primitive owns this, so every consumer inherits it (no per-page wiring).
- A test exercises the regression: begin a turn (un-finalized handle), attempt a second send, assert
  the text is retained and no orphan user bubble / no second submit fired; finalize, assert send works
  again.
- Design call (fork, if any): does the primitive AUTO-track in-flight turns (preferred — protects all
  consumers with no wiring), or expose an explicit `busy` prop the consumer sets? Recommend auto-track,
  since the primitive already owns the `AgentTurnHandle` lifecycle.

## Repro
Mount `ui-conversation`; register an `onSubmit` that begins an agent turn and is itself busy-guarded
(one turn at a time). Submit once (turn starts, handle un-finalized). Submit again before the turn
finalizes → an orphan user bubble appends, the composer clears, and the second submit is swallowed —
the typed text is gone.

## Expected vs actual
- **Expected:** a send while a turn is in flight is prevented (text retained) and the composer shows
  it's busy.
- **Actual:** the send fires unconditionally — orphan bubble, cleared field, discarded text, no
  affordance.

## Classification
Axis: **functional (silent data loss / missing re-entrancy guard)** — plane:
`packages/agent-ui/app/src/controls/conversation/conversation.ts` (`#send` + the composer + the
turn-handle lifecycle). A PRIMITIVE gap (ADR-0129 M2 Phase-1), not a consumer bug — every
`ui-conversation` consumer is exposed.

## Severity
**minor** — no live user-facing impact TODAY (the only consumer, a2ui-chat, hits it solely on its
DEV-only live arm, which is tree-shaken from the shipped build; the recorded default's busy window is
tens of ms and the tests serialize turns). But it is genuine silent data loss on the live arm and a
latent robustness hole for any future consumer with a real (seconds-long) agent turn.

## Links
- `packages/agent-ui/app/src/controls/conversation/conversation.ts` (`#send` ~L369-375; the
  `beginAgentTurn`/`AgentTurnHandle` lifecycle the guard keys off) · `site/pages/a2ui-chat.ts` (the
  consumer whose migration surfaced this — its `runTurn` `if (busy) return`) · ADR-0129 (the M2
  primitives) · SPEC-R6/R7 (ui-conversation's contract) · the pre-migration `a2ui-chat.ts` `send()`
  guard (`git show HEAD~N:site/pages/a2ui-chat.ts`) for the lost affordance's exact prior shape.

## Findings
### 2026-07-13 — fix (auto-track, build seat; NOT yet reviewed/closed)

Fork resolved per the ticket's own recommendation: AUTO-track (`#turnsInFlight`, a count not a bool, so
overlapping `beginAgentTurn()` handles keep the composer busy until the LAST one ends). `beginAgentTurn()`
increments + disables the composer; `finalize()`/`fail()` (via a shared `endTurn()` closure, double-call
safe) decrement + re-enable the moment either runs — `#send()` no-ops while the count is > 0, retaining the
typed text (`conversation.ts:369` count field, `:387-411` `#send`/`#setComposerBusy`, `:265-276`/`:323-340`
the begin/end wiring). The composer's `[data-part="composer"][data-busy]` CSS dim (`conversation.css`)
mirrors the pre-migration `a2ui-chat.ts` `.is-busy` rule; the field/Send button's own `disabled` reflected
prop supplies the pointer-inert + AX half for free (button.css/text-field.css).

`a2ui-chat.ts`'s own page-level `busy` guard is **NOT simplified** (flagged, not touched, per scope) — it
remains load-bearing for a re-entrancy path the primitive does not cover: a click on an already-rendered
A2UI surface calling `runTurn()` (→ `beginAgentTurn()`) again mid-turn via `onClientMessage`, never through
`#send()`. It is redundant-but-harmless for the composer-send path specifically, now double-guarded.

Proof: new `conversation.test.ts` describe block ("busy/re-entrancy guard (TKT-0034)", 3 cases) — the
regression repro (2nd send mid-turn retains text/no orphan bubble/no 2nd callback), `fail()` also
re-enabling, and the overlapping-turns count semantics. Non-vacuity: the guard line was temporarily
commented out and the new test caught the EXACT regression (`received` gained an unwanted 2nd entry) before
being restored — see the build hand-off for the exact assertion. New `conversation.browser.test.ts` leg
(Chromium+WebKit) proves the dim/pointer-inert CSS genuinely cascades in a real engine, not just a DOM
attribute jsdom can't refute. `conversation.md` documents the new guard (a "Busy/re-entrancy guard" section
+ the composer `parts[]` entry).

Gates: `npm run check` exit 0 · `npm test` 6018 passed / 7 skipped (1 pre-existing, UNRELATED failed suite —
`site/pages/a2ui-live.ask-lifecycle.test.ts`, a Vite `fs.allow` "Denied ID …app-shell-isolation.css?raw"
error reproduced identically on a clean stash of this change, tied to this worktree's nested path, not this
fix) · `npm run test:browser` scoped to `conversation` (12/12) + `a2ui-chat.browser.test.ts` (6/6, the one
consumer, unaffected). Status left `open` — the component-reviewer pass (both rubric axes ≥ 4) has not run
yet; a build seat does not self-close.

### 2026-07-13 — independent review GO + one finding INVESTIGATED and found not to reproduce (host)

`ui:component-reviewer` returned GO, thoroughly verified (independently reproduced the non-vacuity claim
from a checksum backup, confirmed every idiom, confirmed the a2ui-chat.ts judgment call is correct). Two
minor findings raised, both closed at merge:

1. **Focus-loss/restore concern — INVESTIGATED, found NOT to reproduce in any engine.** The reviewer's
   plausible hypothesis ("disabling a focused field drops the caret to `<body>`") was tested empirically
   (a `#fieldHadFocus` capture-and-restore mechanism was built, then pressure-tested in jsdom AND real
   Chromium/WebKit) — focus is NEVER actually lost: `ui-text-field`'s disabled state rides
   `contenteditable=false` + a removed `tabindex`, never a native `disabled` attribute, and only the latter
   carries a browser-mandated blur. The speculative restoration code + its tests were REMOVED (dead code for
   a scenario that does not occur is its own defect); a browser test now pins the actual cross-engine fact
   (focus never leaves) so a future change to the disabled mechanism that DOES start dropping focus would be
   caught, at which point a real restoration fix would be warranted.
2. **`reset()` not zeroing the in-flight count — REAL, fixed.** `reset()` now zeroes `#turnsInFlight` and
   clears the busy state, so a consumer that resets mid-turn (abandoning an un-finalized handle) doesn't
   leave the composer permanently disabled. New jsdom test, non-vacuity proven (reverted, confirmed the test
   catches it, restored byte-identical).

Final gates (main, not the review's fs.allow-limited worktree): `npm run check` exit 0 · `conversation.test.ts`
25/25 · `conversation.browser.test.ts` + `surface-host.browser.test.ts` 14/14 both engines ·
`a2ui-chat.test.ts` 6/6 (unaffected) · full jsdom suite 6027 passed (the one fixture-drift failure is the
theme-provider CSS-bundle fixture, resolved by regenerating at commit alongside the concurrently-landed
tkt-0035 CSS changes, not a TKT-0034 regression).