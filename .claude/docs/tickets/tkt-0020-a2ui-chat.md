---
doc-type: ticket
id: tkt-0020
status: open
date: 2026-07-11
owner:
kind: feature
size: big
---
# TKT-0020 — a2ui-chat: the conversational agent surface

## Summary
Kim's goal directive (2026-07-11): complete work on `a2ui-chat` — the surface TKT-0013 named as
the eventual consumer ("display in real time what the system is working on… chain of
thought/reasoning/action/tool-use… as it is occurring") and the TKT-0016 lifecycle demo was
flagged as the embryo of. Everything it composes has now shipped: `ui-status-stream` (the live
role=log region), the four-type message-lifecycle decision layer + its a2ui-live dialog arc,
`ui-command-modal`, the app-shell/master-detail/settings chrome, and the A2UI renderer with
per-path waking. `a2ui-chat` resolves to nothing in the repo today — genuinely greenfield.

## Acceptance
- A dialog-shaped chat surface where a user converses with an agent and the agent's work is
  visible AS IT OCCURS: reasoning/action/tool-use narration streams through the shipped
  `ui-status-stream`, and the agent's UI turns render through the REAL A2UI renderer using the
  full four-type lifecycle (create/updateComponents/updateDataModel/delete per the
  a2ui-message-lifecycle SPEC's decision rules — the surface IS the lifecycle teaching's
  integration proof at scale).
- Recorded-first with the live arm optional (the ADR-0073/recorded-default posture; a2ui-live's
  transcript machinery is the precedent — reuse, don't fork).
- The wire visible (the feed page's disclosure precedent); honest per-turn labels (ADR-0088).
- Placement decided at intake: a site page composing existing pieces vs a new package surface
  (the intake argues it; the site-page lane is the lighter default — PRD-D2 keeps app chrome
  catalog-invisible either way).
- The full house pipeline: design intake (SPEC/LLD/decomp, doc-reviewed, forks to Kim via a
  proposed ADR if genuine) → build → independent review → commit.

## Links
- `.claude/docs/tickets/tkt-0013-ui-status-stream.md` (names a2ui-chat as the future surface) ·
  `tkt-0016-a2ui-message-lifecycle.md` (the embryo demo; "flag, don't couple" — this ticket is
  the coupling point, deliberately).
- `.claude/docs/spec/a2ui-message-lifecycle.spec.md` — the decision rules the agent side obeys.
- `site/pages/a2ui-live.ts` + `packages/agent-ui/a2ui/tools/agent/transcript.ts` — the recorded
  dialog machinery to build on · `controls/status-stream/` · `src/live-agent/` (the live arm).

## Scope / Open
- Intake decides: page vs package; the chat log's anatomy (user turns, agent narration via
  status-stream, rendered A2UI surfaces inline per turn); how the recorded transcript scales to
  a longer arc; whether the live arm ships in v1 or stays recorded-only.
- **Non-goals:** a chat framework; protocol changes; new controls (compose the shipped fleet —
  a gap surfaces as its own component ticket, the ADR-0102 routing law).

## Findings
