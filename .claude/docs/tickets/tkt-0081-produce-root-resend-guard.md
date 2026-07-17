---
doc-type: ticket
id: tkt-0081
status: done
date: 2026-07-17
owner:
kind: bug
size: small
---
# TKT-0081 — cross-turn root-resend ships to the wire: the produce validator is session-blind, so every game turn risks a client-error round trip

## Summary
Live Croupier games (TKT-0079's verification, Kim's own screenshot): follow-up turns re-emit the
whole component tree INCLUDING `id:"root"` → the renderer's ADR-0128 IDGRAPH guard rejects the
root delivery client-side → a `VALIDATION_FAILED: id-graph violation` client error echoes into
the conversation and triggers a WHOLE extra heal turn (one Hit turn got spent "re-dealing with a
fixed component graph" instead of playing). Observed twice in one game.

The grammar already teaches root-once + the wrapper idiom (the model even applies it when
healing) — but the produce loop's validator is SESSION-BLIND: `validateA2ui` sees each payload
fresh, and root-resend is only illegal CROSS-turn. The producer HAS the session history
(`sessionKnownSurfaceIds`, the ask-integrity precedent) and can catch this deterministically
BEFORE the wire.

## Repro
Croupier → deal → click Hit repeatedly: any follow-up turn whose updateComponents re-includes
`root` for the session-known surface ships, errors client-side, and burns an extra turn.

## Expected vs actual
- **Expected:** an invalid-by-protocol payload never ships (SPEC-R5 validate-then-stream).
- **Actual:** cross-turn root-resend streams as "valid", failing only at the renderer.

## Classification
Functional, produce-layer policy gap (the ADR-0097 §3 FEED_SCOPE class: a policy check the
shared validator cannot own because it needs non-payload context — here the session). Renderer
and grammar are correct; the gate is missing.

## Severity
major (every interactive game/multi-turn surface risks a wasted round + a visible error echo per
occurrence)

## Acceptance
(rewritten at build — the intake's ROOT_RESEND policy gate turned out to be a DEADLOCK, see
Findings; the shipped design is session-SEEDED validation)
- `validateA2ui` gains an optional `sessionSeed` (per-surface prior components + rootDelivered;
  absent ⇒ byte-identical): seeded, it judges the MERGED cross-turn graph — update-only
  follow-ups validate (refs resolve against the seed), a root re-delivery fails as the
  renderer's own `sid:root`, and a payload re-creating the surface starts fresh.
- `produce()` builds the seed from the session's prior assistant turns (deleteSurface drops a
  surface's seed) and passes it to every round's validate — a root-resend is now a PRE-WIRE
  self-correct round, never a shipped client error.
- Grammar hardening line: on an existing surface send ONLY the changed components, never the
  unchanged tree (baseline re-captured — deliberate change).
- Probes: 5 validator-level (seeded-valid update-only + unseeded negative control + `sid:root`
  resend + re-create-fresh + no-cross-id-leak) and 3 produce-level (resend → self-correct with
  `main:root` fed back then streams; update-only streams clean round 1; fresh first turn
  unchanged).
- Gates green; live: a multi-hit game with zero VALIDATION_FAILED echoes.

## Links
- [TKT-0079](tkt-0079-interaction-turns-stay-in-owning-bubble.md) — the game loop that surfaced it
  (its verification transcript is the repro).
- ADR-0128 (the IDGRAPH root-once law) · ADR-0097 §3 (the produce-layer policy-check precedent).

## Findings

### 2026-07-17 — the intake's design was a DEADLOCK; shipped session-seeded validation instead — CLOSED

**The design turn (recorded because the intake got it wrong):** the planned ROOT_RESEND policy
gate was built first — then reading `checkIdGraph` exposed that it would TRAP the model with no
legal move for structural follow-ups: the standalone validator REQUIRES `root` in any
components-bearing payload (`root-missing` + dangling against prior-turn refs), while the gate
(like the renderer) FORBIDS re-delivering it. The contradiction is precisely WHY live models ship
full trees: full-tree-with-root is the only shape that passes the session-blind produce validator.
The gate was discarded before ever landing; the shipped fix dissolves the contradiction.

**Shipped:** `validateA2ui(…, sessionSeed?)` — optional per-surface seed (prior components +
rootDelivered; absent ⇒ byte-identical; a payload re-creating the surface starts fresh; seeds
never leak across surfaceIds). `produce()` replays the session's prior assistant turns into the
seed once per turn (deleteSurface drops a surface) and seeds every round's validate. Grammar
gained the send-only-what-changed line (baseline re-captured).

**Verified:** 5 validator probes + 3 produce-loop probes (the resend now self-corrects PRE-WIRE
with the renderer's own `main:root` verdict fed back; the update-only follow-up — standalone-
invalid before — streams clean round 1). Live full game (Fable 5): deal → hit → stand, hole card
revealed, ONE bubble, ZERO `VALIDATION_FAILED` echoes — and the Stand turn shipped
`5× updateDataModel + 1× updateComponents`, a partial structural update that this fix made
legal. Gates: check green · full jsdom 6329/6329.
