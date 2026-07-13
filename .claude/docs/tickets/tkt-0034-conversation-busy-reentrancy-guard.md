---
doc-type: ticket
id: tkt-0034
status: open
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
