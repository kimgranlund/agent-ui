---
id: T-0016
title: "General-purpose agent activity strip: neutral ActivityStep model, per-step timing and status, generic summaries, collapsed raw output (ADR-0159 amendment)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-06
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Make the Test Chat "Agent activity" strip report useful, general-purpose information: per-step timing and status, a one-line generic summary per step, repair rounds visible, turn-level facts (rounds, token usage, model) when the host has them, and raw output shown once and collapsed. Works for any turn, never tied to a catalog or app.

## Intent
- Do: a neutral `ActivityStep` model consumed by the narration strip of `ui-conversation` (opt-in receipt pattern, ADR-0159); an A2UI adapter that builds steps from the existing progress stages plus `TurnTrace` (`prompt`, `usage`, `rounds`, `failureCodes`, merged in #1822); an ADR-0159 amendment written as PROPOSED.
- Non-goals: any catalog-, type- or persona-specific wording; changing wire formats, `TurnTrace` or the producer loop; default-on behavior for existing consumers.
- Done when: the strip shows per-step time and status, generic summaries, repair rounds and a collapsed single raw block for an A2UI turn AND for a non-A2UI host fixture; gates green; docs and skills scrubbed.

## Context
Screenshot (user, 2026-10-06): the strip prints stage names only ("Request sent", "Generated", "Reasoned", "Wrote the response", "Validated"), repeats the same raw JSONL under "Validated", "Updated data" and "Updated the surface", and shows only a total ("7 steps · 14s"). Kim ruled: the change is global, so it must be general purpose. Layering: `ui-conversation` lives in `app`; it takes only a neutral step model; adapters build steps (A2UI adapter at the a2ui or site layer); imports point downward only. Summaries come from message KIND (counts and verbs), never component or type names. Optional turn facts degrade to nothing. Start from `packages/agent-ui/app/src/controls/conversation/conversation.ts` (narration, around line 1158), `conversation.md`, `packages/agent-ui/a2ui/src/agent/meta-line.ts` (TurnProgressStage, TurnTrace), `agent/produce.ts` (stages), ADR-0159, and `site/lib/admin-live-runner.ts`.

## Constraints
No key reaches a headless run (ADR-0073); no em dashes; ADRs never self-ratified (amendment is proposed); light-DOM, ARIA via ElementInternals, event names ∈ change input select open close toggle action; existing consumers render exactly as before unless they opt in.

## Acceptance criteria
Worktree: `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-activity` (branch `feat/agent-activity-steps`, five commits `17d0b028..02666c83` on top of `d8417cf1`). The verifier runs with this worktree as its cwd; every repo-relative path below resolves there (`git diff d8417cf1..HEAD`).
Gate evidence already captured (read these rather than re-running the heavy legs): `/tmp/t0016/check2.txt` (`npm run check`), `/tmp/t0016/test2.txt` (`npm test`), `/tmp/t0016/size-after2.txt` (`npm run size`), `/tmp/t0016/browser-full.txt` (the two touched browser files), `/tmp/t0016/e2e-admin2.txt` (`npm run e2e:admin`, with the new step-row assertion) and `/tmp/t0016/e2e-neg.txt` (that assertion red with the opt-in off). Cheap legs (single vitest files, `npm run check`) are fine to re-run.

1. A neutral model exists: `ActivityStep` (`id`, `kind`, `label`, `status` running|ok|repaired|failed, optional `startedAt`, `durationMs`, `summary`, `raw`) and `ActivityFooter` (optional `rounds`, `inputTokens`, `outputTokens`, `model`) in `packages/agent-ui/app/src/controls/conversation/activity-step.ts`, importing nothing from a2ui, a catalog or the DOM, re-exported from `@agent-ui/app/conversation`.
2. `ui-conversation` has a reflected boolean `steps` (default false, sampled once per turn) and `AgentTurnHandle.step()` / `footer()`. In step mode each step id is one row with its label, summary line, live elapsed while running, frozen duration once settled, and status (repaired reads done with its own marker); at settle the strip appends exactly one collapsed "Raw output" row (distinct raws once) and an optional footer row; `ingestLine()` / `progress()` add no rows while surfaces still mount.
3. Opt-in default: with `steps` off, `step()` and `footer()` are no-ops and the narration strip's `outerHTML` is byte-identical to a turn that never called them (a test asserts this).
4. An A2UI adapter at the site layer (`site/lib/a2ui-activity.ts`) maps progress stages, `TurnTrace` and shipped lines to steps: per-step times, a visible repair "Round 1 failed (CODE), repaired in round 2", a footer from rounds/usage/model, summaries from message-kind counts, and no component type, catalog id or surface id in any label or summary (a test with distinct type names asserts this); raw attached once.
5. A non-A2UI host fixture (a plain chat with a tool call) renders through the same control with zero A2UI involvement (a test asserts it).
6. The Test Chat (`ui-agent-admin`) opts into `steps` and forwards the runner's `step` / `footer` events; the site runner now feeds the trace to the adapter. Wire formats, the `TurnTrace` shape and the producer loop are unchanged.
7. ADR-0159 carries an appended `## Amendment (2026-10-06, **proposed**)` section; its Status cell is unchanged and no ADR number 0235 to 0237 was used.
8. Records repaired: `conversation.md` (attribute, property, parts, prose), `status-stream.md` (`sourceLabel`), `agent-model.md` glossary, the authoring-flow LLD's stale opt-in line.
9. Gates green by exit code: `npm run check`, `npm test`, `npm run size`, the touched browser files (`conversation.browser.test.ts`, `status-stream.browser.test.ts`), and `npm run e2e:admin` (its selftest rides `check`).
10. No em dash in any text this change added (lines it extended keep their pre-existing text).

## Closed

2026-10-07: Merged in #1833
