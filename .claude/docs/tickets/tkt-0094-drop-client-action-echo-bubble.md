---
doc-type: ticket
id: tkt-0094
status: done
date: 2026-07-17
owner:
kind: feature
size: small
---
# TKT-0094 — drop the synthetic `↳ clicked "…"` user-bubble echo for A2UI card action clicks

## Summary
Kim's seed (2026-07-17, `/issue` intake, with a screenshot of a blackjack card's "Deal Again"/
"Stand" action buttons followed by a `YOU` bubble reading `↳ clicked "stand"`): "I don't think we
need to add the user action as a chat bubble."

**Grounded before filing (dedup sweep):** this exact behavior was already named as an explicit
open taste call in [TKT-0079](tkt-0079-interaction-turns-stay-in-owning-bubble.md)'s Scope/Open —
"The `↳ clicked …` user echo chips stay (the visible move record); dropping them is a separate
taste call" — deferred, never resolved. This ticket is that resolution.

**Mechanism, verified (three call sites, same pattern, no shared helper):**
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:295` —
  `conversation.onClientMessage((message) => { conversation.addUserMessage(\`↳ ${describeClientAction(message)}\`); this.#runSurfaceTurn(...) })`.
- `site/pages/a2ui-chat.ts:172` — `conv.addUserMessage(\`↳ ${describeClientMessage(message)}\`)`.
- `site/pages/a2ui-live.ts:415` — `addMessage('user', \`↳ ${describeClientMessage(message)}\`)`.
- **Confirmed side-effect-free to remove:** `UIConversationElement.addUserMessage`
  (`packages/agent-ui/app/src/controls/conversation/conversation.ts:264`) only appends a visual
  bubble to the log (`#log`); it does not feed the model's session/message history. The action
  click itself still reaches the model via the unrelated `#runSurfaceTurn`/`transport.turn(...)`
  call in each file — dropping the bubble is purely cosmetic, no model-context regression.

## Acceptance
- The three `addUserMessage`/`addMessage('user', …)` call sites named above no longer add a
  bubble for an A2UI card action click; the click still drives the next turn exactly as before
  (the surface/canvas update, the narration, the model call — all unchanged).
- No other visible record of the click is required by this ticket (Kim's ask is "we don't need
  it," not "replace it with something else") — if a lighter-weight affordance (e.g. a transient
  highlight on the clicked button) is wanted later, that is a separate ask, not scoped here.
- Existing tests referencing the `↳ clicked "…"` bubble text (e.g.
  `agent-admin.browser.test.ts`'s TKT-0079-era assertions, if any) are updated to match the new
  no-bubble behavior rather than left red or silently skipped.

## Links
- [TKT-0079](tkt-0079-interaction-turns-stay-in-owning-bubble.md) — where this was first named
  and explicitly deferred ("a separate taste call").
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:295,706-714` —
  `describeClientAction` + its one call site.
- `site/pages/a2ui-chat.ts:124,172` and `site/pages/a2ui-live.ts:242,415` — the two demo-page
  siblings with the same pattern.
- `packages/agent-ui/app/src/controls/conversation/conversation.ts:264` — `addUserMessage` itself
  (unchanged; still used for real typed user turns, only these three call sites stop invoking it
  for an action-click echo).

## Scope/Open
- **All three surfaces vs. just agent-admin — not resolved here:** the screenshot's game-card
  UX (`agent-admin-app.html`) is the concrete trigger, but the identical pattern lives in two
  site demo pages too (`a2ui-chat.ts`, `a2ui-live.ts`). Named here rather than presumed: default
  is all three (one taste call, one behavior, applied consistently), but a build should confirm
  before touching the demo pages if that wasn't Kim's intent.
- `describeClientAction`/`describeClientMessage` themselves (the string-formatting helpers) may
  become dead code once their only call site is removed — worth a check at build time rather
  than left as an unused, silently-drifting helper in three separate files.

## Findings

**2026-07-17 — shipped, all three surfaces (the default, per the ticket's own stated Scope/Open
resolution — one taste call, applied consistently).** All three `addUserMessage`/
`addMessage('user', …)` call sites removed exactly as named: `agent-admin.ts:295`,
`a2ui-chat.ts:172`, `a2ui-live.ts:415` — each site's surrounding turn-driving logic
(`#runSurfaceTurn`/`runTurn(nextTurn(...))`) is untouched, confirming the pre-verified claim that
the bubble was purely cosmetic.

- **Dead-code check (Scope/Open's own suggestion) confirmed true in all three files:** each
  `describeClientAction`/`describeClientMessage` helper had exactly one call site (the removed
  bubble line) — all three removed. `agent-admin.ts`'s `truncateEcho` was ONLY called from
  `describeClientAction`, so it went too. `clientMessageSurfaceId` and every other neighboring
  helper are confirmed still live (separate, real call sites) and untouched.
- **No test referenced the bubble text** (`grep -rl "↳\|clicked \\""` across every `*.test.ts` in
  the repo, zero matches) — Acceptance's "existing tests... updated" bullet had nothing to update.
- **Gate:** `npm run check` clean (no unused-import/dead-code type errors from the removed
  helpers); full jsdom sweep 353 files / 6447 tests green. Cross-engine
  `agent-admin`/`a2ui-chat.browser.test.ts`/`a2ui-live.browser.test.ts` run: 4 failures, ALL in
  `a2ui-live.browser.test.ts`'s unrelated "canvas tabs (Batch C)" describe block (both Chromium
  and WebKit) — confirmed pre-existing and unconnected to this change (the diff here touches only
  7 deleted lines, none tabs-related; a sibling session had already independently reproduced this
  exact failure by stashing ITS OWN unrelated change and re-running, same result).

