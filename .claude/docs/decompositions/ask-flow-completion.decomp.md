# Decomposition — ask-flow COMPLETION (closing turn + end-of-flow chrome, GH #1101)

> Status: proposed · v0.1 · 2026-08-17 · Contract: [ADR-0198](../adr/0198-ask-flow-completion-flowend-meta-signal.md)
> (proposed — build starts only from the RATIFIED text). Fork decided there: wire-visible `flowEnd`
> on the META-LINE (fourth additive field, `ask`/`plan`/`personaPatch` precedent), never a heuristic
> and never an A2UI-protocol widening. One writer per file per slice; every slice ends
> `npm run check && npm test` green (exit codes, never grep).

## Plane 1 — outside-in (the whole, broken into parts)

The gap: after a flow-final Confirm the conversation dead-ends (GH #1101). Two halves per the
issue, plus the seam ADR-0198 cl.5 mints:

1. **Producer half** — the closing turn as DEFAULT behavior: `grammar.md`'s new mode-invariant
   "Flow completion" paragraph (closing prose `note` + `flowEnd: true`, no new ask, no A2UI) and
   the `meta-line.ts` `flowEnd` arm. Mini-skills and `ask-archetypes-*.md` untouched (optional/
   mode-scaled — completion is unconditional).
2. **Shared seam** — a `site/lib` flow-chrome module (ask-registry pattern: lifecycle + logic, no
   page markup): reads the peeled envelope, on `flowEnd` builds the done/start-over row, wires
   dismiss + the page-supplied reset callback.
3. **Surface half ×2** — a2ui-live page chrome + the agent-admin test-chat conversation consume
   the shared module; agent-admin is the acceptance surface (pixel-truth, #1081 pattern).

## Plane 2 — the slices

| Slice | What | Files (primary writer) | Depends on | Blast radius |
|---|---|---|---|---|
| S0 | Ratify ADR-0198 (Kim; `adr_ratify.py`) | the ADR header | — | none (docs) |
| S1 | `flowEnd` meta-line arm + tests (shallow-validation per the three-arm precedent); SPEC reserved-field row REV | `packages/agent-ui/a2ui/src/agent/meta-line.ts`, its test, `a2ui-live-agent.spec.md` | S0 | a2ui agent core only; additive — every existing envelope byte-identical; zero validator/renderer touch |
| S2 | grammar.md "Flow completion" paragraph + prompt pin-test moves (`buildSystemPrompt` output changes for ALL modes — byte-pinned texts re-pinned in-slice) | `prompts/grammar.md`, `system-prompt.test.ts` pins | S0 (∥ S1) | every produced system prompt (all modes); no code paths |
| S3 | Shared flow-chrome module + unit tests (detect via `readMetaLine(...)?.flowEnd`; build row: solid Done, ghost Start over — ADR-0153 vocabulary; dismiss-on-done; callbacks injected) | new `site/lib/flow-chrome.ts` (+ test) | S1 | site lib only; consumed by nobody until S4/S5 |
| S4 | a2ui-live consumption: wire module into the feed's note-bubble path; Start over → existing Reset/`disposeAll`; page CSS | `site/pages/a2ui-live.ts`, `a2ui-live.css`, browser test | S3 | one page; ask-registry untouched |
| S5 | agent-admin test-chat consumption: wire into the admin conversation's meta-line peel (`admin-live-runner`/conversation path); Start over → conversation clear; LIVE pixel-truth verification of the full intake flow (#1081 pattern) closes GH #1101 | agent-admin conversation glue in `site/lib`/`@agent-ui/app` seam, browser test | S3 (S2 for the live proof) | admin chat surface; the acceptance gate |

Sequencing: S0 → {S1, S2 in parallel} → S3 → {S4, S5 in parallel} → live verification in S5
closes the issue. S1/S2 are independent writers (different files); S4/S5 are independent
consumers of the frozen S3 API.

## Non-goals (verbatim from ADR-0198)

No A2UI protocol change · no handoff affordance (revisit: a surface with a handoff target) · no
new event name · no card-level completion UI (ADR-0196's territory) · no auto-reset/teardown on
`flowEnd` · no heuristic completion inference in chrome.

## Risks / watch items

- **Degrade path**: a model omitting `flowEnd` = today's behavior for that turn, never a misfired
  affordance — assert this negative in S3's tests.
- **Prompt pins**: S2 touches byte-pinned prompt text; the pins move in the SAME slice (ADR-0137
  discipline) or `check` reds.
- **#1064/#1073 adjacency**: the turn-advance fix shares the questionnaire template lane; this arc
  touches no card template, so no sequencing gate — but S5's live verification runs on top of the
  merged #1073 behavior.
