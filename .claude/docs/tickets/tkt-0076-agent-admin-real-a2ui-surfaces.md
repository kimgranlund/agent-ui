---
doc-type: ticket
id: tkt-0076
status: done
date: 2026-07-16
owner:
kind: feature
size: big
---
# TKT-0076 — the agent-admin conversation emits REAL A2UI surfaces on the live path (the Croupier stops faking)

## Summary
Kim's screenshot (2026-07-16): the Croupier preset answers with a FAKE ` ```surface ` YAML fence —
the model invents a pseudo-surface format because its persona prompt promises A2UI surfaces the admin
chat path cannot deliver. The admin's live arm is text-only (`agentTurn → string → handle.setNote`),
while the real machinery sits proven one page over: `AgentTurnHandle.ingestLine` mounts live
`ui-surface-host`s per surfaceId (ADR-0129; a2ui-chat drives it), the dev proxy's `/__a2ui/agent`
produce endpoint streams validated A2UI JSONL (compose→validate→self-correct, mini-skills included),
and `ui-conversation.onClientMessage` already bubbles surface action clicks.

Two missing seams:
1. **The producer has no persona seam** — `buildSystemPrompt(catalog, exemplars, mode, miniSkills)`
   is entirely catalog-derived; the admin's composed persona prompt (Foundation/Personality/Surface
   style + capabilities) has no way to ride a produce turn. → ADR-0138 (proposed).
2. **The admin has no surface arm** — a second injected runner returning `AsyncIterable<string>` of
   A2UI JSONL, driven into `ingestLine` (meta-line note peeled per ADR-0088), with the a2ui `Session`
   reducer for multi-turn history and `onClientMessage` framing action clicks as the next turn (the
   Croupier's Hit/Stand actually plays).

## Acceptance
- `buildSystemPrompt` accepts an optional persona section, appended AFTER the catalog/mini-skill
  sections (the catalog wire contract stays authoritative; the persona flavors content, never the
  format — the prompt says so explicitly). Pure-seam test.
- `ProduceOptions.personaSystem` threads it; the dev-proxy produce handler accepts a length-capped
  optional `personaSystem` string in the POST body.
- `ui-agent-admin` gains `agentSurfaceTurn` (attribute:false, injected DEV-only like `agentTurn`):
  when set, the live arm iterates the stream into `handle.ingestLine`, peels the ADR-0088 meta-line
  into `setNote`, maintains the a2ui `Session` via the shipped reducer, and registers
  `conversation.onClientMessage` so a surface action click runs the next turn. `agentTurn` (text)
  stays the fallback; the stub arm is byte-unchanged.
- `admin-live-runner.ts` gains `createAdminSurfaceTurn` (the live-proxy-transport shape + persona);
  `agent-admin-app.ts` prefers it when live.
- Browser-verified: the Croupier deals a REAL mounted surface (cards + Hit/Stand Buttons); clicking
  an action plays a round on the SAME surfaceId (ADR-0129 routing).
- Gates: check + full jsdom green; new pure/jsdom tests for both seams.

## Links
- [TKT-0074](tkt-0074-agent-admin-a2ui-showcase-presets.md) — the presets whose prompts this makes true.
- ADR-0138 (proposed) — the producer persona seam · ADR-0129 (surface routing) · ADR-0088 (meta-line)
  · ADR-0136 (the admin live overlay).

## Scope/Open
- The STUB arm stays text-only (making the stub emit surfaces is out of scope, as TKT-0074 recorded).
- The static build still carries zero live-call code (the ADR-0131 cl.4/7 guard pattern unchanged).

## Findings

### 2026-07-16 — built, live-verified end-to-end: the Croupier DEALS — CLOSED

**The persona seam (ADR-0138, Kim-accepted mid-build):** `buildSystemPrompt` gained the optional
trailing `## Persona` section (fixed precedence sentence; absent/empty ⇒ byte-identical — the
equivalence baseline stayed green untouched, pinned by `persona-seam.test.ts`);
`ProduceOptions.personaSystem` threads it; the dev-proxy produce POST accepts it length-capped
(16 KB).

**The surface arm:** `ui-agent-admin` gained `agentSurfaceTurn` (attribute:false, the `agentTurn`
injection discipline; precedence over the text arm) — typed events stream in: `line` ⇒
`handle.ingestLine` (real inline surfaces), `note` ⇒ `setNote` at finalize; errors ride the fail
path. `conversation.onClientMessage` echoes `↳ clicked "…"` and runs the next turn. The SPEC-N1
fence held: the component declares its OWN envelope (`AdminSurfaceTurnEvent`/`Request` in
agent-admin-schema.ts, the AdminTurn precedent); the RUNNER (`createAdminSurfaceTurn`,
admin-live-runner.ts) owns the a2ui `Session`, the ADR-0088 meta-line peel, and provider pairing —
one fresh session per persona switch (the page re-arms on `applyPreset`).

**Live-verified (browser, Fable 5):** "deal me in" on the Croupier → the producer's
compose→validate→self-correct loop ran VISIBLY (narration: "Opening a new surface… Updating data…
Re-dealing the same table with corrected props" — the heal loop caught its own invalid first
payload) → a REAL mounted blackjack table (title, Bet badge, dealer row 9♥+hidden+score, player
row K♠ 7♦ = 17, Hit/Stand/Deal-again Buttons). Clicking **Hit** echoed the action, ran a turn, and
updated the SAME single `ui-surface-host` in place (host count stayed 1 — ADR-0129 routing): drew
3♠ for 20, chips stat live, table talk in character. The fake ` ```surface ` fence is gone —
the persona's promises are now literally true.

**Gates:** check green · admin jsdom 54/54 (incl. the two new surface-arm probes: ingestLine
mounts a host + the note renders; a thrown runner surfaces a system bubble) · persona-seam 6/6 ·
prompt-equivalence green (the zero-regression claim) · descriptor bijection updated
(agentSurfaceTurn entry).

