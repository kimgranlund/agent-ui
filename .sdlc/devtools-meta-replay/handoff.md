---
id: T-0018
title: "Replay note, ask, patch, plan, team and flowEnd meta-lines in capturedLineTimelines (needs SPEC-R3/R10 amendment; follow-up of T-0010)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: M              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-05
router: .claude/.sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Make `capturedLineTimelines` in `@agent-ui/devtools` (`transports/replay.ts`) replay the note, ask, patch, plan, team and flowEnd meta-lines that `recordTurn` moves into `meta` events (`timeline/events.ts`), so a capture replay is lossless for the admin runner; needs a SPEC-R3/R10 amendment (the replay law is `line`-only today). Follow-up of T-0010 (GH #1815).

## Intent
- Do: `capturedLineTimelines` re-emits each `meta` event as `{"a2uiMeta": <meta>}` in capture order, interleaved with the `line` events, for every arm of the closed `a2uiMeta` vocabulary in `a2ui/src/agent/meta-line.ts` (the whole payload, no arm list in devtools). Record the widened law as proposed ADR-0239 (extends ADR-0200), amend devtools SPEC-R3, R7, R10 and the N1 note, agent-model SPEC-R27, and the `a2ui-jsonl-mcp` skill's record-and-replay docs.
- Non-goals: no change to `recordTurn`, the `DevtoolsEvent` vocabulary, the capture format or version, `AgentTransport`, or `scripts/e2e-admin` fixtures; no byte-identical meta replay (the original meta bytes are not recorded); no self-ratification of ADR-0239; no push, PR or ticket.
- Done when: the replay, round-trip and line-only tests pass, `npm run check`, the devtools vitest project and `npm test` exit 0, the sitemap indexes carry ADR-0239, and an independent verifier passes the acceptance criteria below.

## Context
- Code: `packages/agent-ui/devtools/src/transports/replay.ts` (`capturedLineTimelines`), `timeline/events.ts` (`recordTurn`, `compactMeta`), `capture/format.ts`. The closed arm list is `A2uiMetaEnvelope` in `packages/agent-ui/a2ui/src/agent/meta-line.ts`: note, ask, plan, personaPatch, flowEnd, team, target, trace, progress, error.
- Decision: replay the whole payload rather than a hand-kept arm list (the list would drift and already omits `target`, `trace`, `progress`, `error`). Equivalence is under `readMetaLine`, not byte identity.
- Docs: ADR-0239 (new, proposed, `Extends` ADR-0200 whose header cell now says `Extended by`), `.claude/docs/spec/devtools-harness.spec.md`, `.claude/docs/spec/agent-model.spec.md` SPEC-R27, `.claude/skills/a2ui-jsonl-mcp/`.
- The existing replay test fixture held one `meta` event and asserted it never replays; it is split so the base fixture is line-only and the meta cases have their own fixtures.
- Branch `feat/devtools-meta-replay` in worktree `.claude/worktrees/wave-replay`, commit `5a3a9e5f`.

## Constraints
- Trust boundary: no key, provider or `produce()` import enters `@agent-ui/devtools` (ADR-0073, ADR-0200); `devtools/src/layering.test.ts` stays green and unchanged.
- A capture with no `meta` events replays byte-identically to before.
- ADR-0239 stays `proposed`; only Kim ratifies.
- No em dashes in new prose (the ADR H1 separator is the one grammar-required exception, `scripts/generate-sitemap.mjs`).

## Acceptance criteria
- AC1: `capturedLineTimelines` of a capture whose turn holds one `meta` event per arm (note, ask, plan, personaPatch, flowEnd, team, target, trace, progress, error) returns one array holding `{"a2uiMeta": <meta>}` lines and the `line` payloads in the original event order (`replay.test.ts`, "every arm replays as an a2uiMeta line").
- AC2: every replayed meta-line parses with `readMetaLine` back to its event's payload, and `replayTransport` yields them byte-identical run over run.
- AC3: a capture with no `meta` events replays exactly its `line` payloads; the pre-existing replay, format and debug-export tests pass with only the one fixture split in `replay.test.ts`.
- AC4: `recordTurn`, then `replayTransport`, then `recordTurn` over a two-turn capture with every arm yields an identical timeline (kinds, order, payloads, `turn-end.status` `halt`, `usage`).
- AC5: the exhaustive fixture type fails `tsc` if an arm is added to `A2uiMetaEnvelope` without a fixture.
- AC6: the devtools `layering.test.ts` passes and `replay.ts` adds no import.
- AC7: ADR-0239 exists, status `proposed`, `Extends` ADR-0200, number 0239 is the next free one (0238 is the highest on disk, in sibling worktrees, on remote branches, and in open PRs); ADR-0200's header cell names `Extended by` ADR-0239 and no other ADR-0200 text changed.
- AC8: devtools SPEC R3 (body and AC3), R7, R10 (AC1, AC4), the N1 note, agent-model SPEC-R27, and the `a2ui-jsonl-mcp` skill (`record-and-replay.md`, `SKILL.md`, `intent.md`, `evals.json` t06) no longer say replay is `line`-only.
- AC9: `node scripts/generate-sitemap.mjs` output is committed (`site/public/adr-index.json` lists ADR-0239); `npm run check`, `npx vitest run --project packages packages/agent-ui/devtools`, and `npm test` exit 0.
- AC10: the diff adds no em dash except the ADR-0239 H1 separator.

## Closed

2026-10-06: Merged to main in #1840
