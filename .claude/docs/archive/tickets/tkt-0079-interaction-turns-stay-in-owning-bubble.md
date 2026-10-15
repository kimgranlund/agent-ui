---
doc-type: ticket
id: tkt-0079
status: done
date: 2026-07-16
owner:
kind: feature
size: small
---
# TKT-0079 — interaction turns fold into the surface's OWNING bubble; client-message echoes show the real A2UI payload

## Summary
Kim (2026-07-16, the Croupier loop): "for the games and interactions, can we stay in the same
card unless it has to become a new card?" — plus a follow-up screenshot: the `↳ surface message`
echo hides what actually crossed the wire (there, a VALIDATION_FAILED error — "Root was sent
twice…" — that triggered a heal turn); "these should really show A2UI output."

Today the SURFACE updates in place (ADR-0129) but every action click still opens a fresh agent
bubble carrying only narration + table talk — a game stacks one near-empty card per move. And
`describeClientAction` knows only the `action`/`functionResponse` arms, so an `error`
client-message echoes as the opaque fallback.

## Acceptance
- `ui-conversation.beginAgentTurn(opts?: { intoSurface?: string })`: when `intoSurface` resolves
  to an OPEN registry record whose bubble is still connected, the turn REUSES that bubble — a
  fresh narration strip swaps in place of the finalized old one (ui-status-stream's completion
  invariant stays untouched), the note div is overwritten at finalize, and a fresh surfaceId in
  the resumed turn mounts into the SAME bubble's mounts (Kim's rule: stay in the card unless it
  has to become a new one). Unknown/closed/disconnected ⇒ today's fresh-bubble path,
  byte-identical. No `AgentTurnHandle` change (still exactly four methods).
- `ui-agent-admin`: client-message turns pass the message's `surfaceId` (`action.surfaceId` /
  `error.surfaceId`) as `intoSurface`; typed intent turns keep the fresh-bubble path (a typed ask
  is a new exchange — its reply must not appear above the question).
- The echo helper gains the `error` arm (`⚠ code: message`, truncated) and a compact-JSON
  fallback instead of `'surface message'` — the echo is wire-truthful.
- jsdom probes: resumed turn adds no bubble + replaces narration/note; fresh surface in a resumed
  turn mounts in the owning bubble; unknown `intoSurface` ⇒ new bubble (negative control); error
  echo text. Descriptor/doc rows updated. Gates green; browser-verified on a live Hit/Stand loop.

## Scope/Open
- The `↳ clicked …` user echo chips stay (the visible move record); dropping them is a separate
  taste call.
- Tail-follow on a resumed turn still targets the log bottom; if long chat follows the table
  card, an update can land off-screen — accepted for now (game flow keeps the table recent).

## Links
- [TKT-0076](tkt-0076-agent-admin-real-a2ui-surfaces.md) — the surface arm this refines.
- [TKT-0078](tkt-0078-conversation-narration-font-size.md) — same loop's type fix.
- ADR-0129 (same-surface routing — the precedent this extends to the BUBBLE plane).

## Findings

### 2026-07-16 — built, live-verified: a whole blackjack game in ONE card — CLOSED

`beginAgentTurn({intoSurface})` shipped exactly as designed: the resume probe
(`#resumableBubble`) gates on open-record + connected-bubble + all three parts present; a
resumed turn swaps in a fresh narration strip, overwrites the note, and mounts even a FRESH
surfaceId into the owning bubble's mounts. Two jsdom probes pin the resume + the negative
control (unknown/closed ⇒ fresh bubble). The admin passes `action.surfaceId`/`error.surfaceId`
through for client turns only; the echo helper gained the `error` arm (`⚠ code: message`) and a
compact-JSON fallback.

**Live (Fable 5, full game):** deal → hit (model chose to rebuild its component graph — even
its "Opening a new surface…" heal stayed in the same card, one host) → hit → bust: ONE agent
bubble throughout, tiles updating in place (9♥ Q♣ ✓19 dealer / K♠ 7♦ 5♣ ✗22 danger), the move
log showing `↳ clicked "hit"` chips and the now-truthful `↳ ⚠ VALIDATION_FAILED: id-graph
violation…` echoes. The recurring empty-tile defect surfaced DURING this wave was root-caused
separately — [TKT-0080](tkt-0080-template-relative-binding-teaching-gap.md). Gates: check green
· full jsdom 6320/6320.
