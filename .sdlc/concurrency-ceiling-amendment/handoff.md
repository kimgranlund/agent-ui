---
id: T-0009
title: "Amend the 2026-08-20 concurrency ceiling ruling for the 20-core M1 Ultra (5 lanes x maxWorkers 4)"
type: chore           # feature | bug | chore | spike | idea
status: done
size: S
priority: P2
depends: []
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Record Kim's amendment (2026-10-05) of the 2026-08-20 concurrency ceiling ruling for this host: an Apple M1 Ultra with 20 cores (16 performance, 4 efficiency) and 128 GB. Docs only.

## Intent
- Do: update the ruling text to the recorded decision.
- Non-goals: any change to the full-suite ceiling, the load rule, or gate commands beyond the numbers below.
- Done when: the two files state the same numbers and `doc_lint` plus `check` exit 0.

## Context
Current text, `.claude/skills/seat-map/SKILL.md` (lines about 87-92): at most 3 gate-running lanes on "10 cores: `(cores - 2) / 3`, rounded down", each lane about 3 cores, every worktree gate command carries `--maxWorkers=4` (3 x 4 = 12 about the cores), a desk that sees 1-min load above 40 stops dispatching and reaps finished worktrees first. The full-suite ceiling of 2 concurrent `npm test` runs (2026-08-29, counted across every repo, about lines 124-128) is unchanged. `.claude/skills/component-testing/references/test-craft.md` also mentions the ceiling or `maxWorkers`.
Kim's decision (this session): 5 gate-running lanes x `--maxWorkers=4` on this 20-core host. Her own formula scaled: `(20 - 2) / 3 = 6`, run at 5 to leave headroom for other sessions; lanes x maxWorkers about 20 cores. Keep: full-suite ceiling 2, load-over-40 stop rule, and a cap of 2 lanes running browser shards at once (the heavy Chromium work). Re-measure the formula on any other host.

## Constraints
Only the ruling numbers and the host note change; keep the structure and the "(Kim ruling ...)" attribution style, adding the new dated amendment beside the old one, not replacing history. No em dashes.

## Scrub and upsert list
`.claude/skills/seat-map/SKILL.md`; `.claude/skills/component-testing/references/test-craft.md` (whichever lines mention the ceiling or `maxWorkers`); check `CLAUDE.md`, `AGENTS.md`, `.claude/docs/process.md` and `.claude/agents/repo-orchestrator-agent.md` for the number 3 or the ceiling (a prior grep found only the two skill files).

## Dependencies and conflicts
Land before the first wave-1 fanout so briefs and dispatchers quote the new numbers. Small docs lane; `seat-map` is also edited by no other open ticket.

## Size and lane
S, `/sdlc-lite:fix` lane (builder L1 or L2, verifier L1).

## Acceptance outline
Both skill files state 5 lanes x 4, the host (M1 Ultra, 20 cores), the retained limits, and the dated amendment; `grep` for the old "3 gate-running lanes" statement shows only the dated history line; `doc_lint` plus `npm run check` exit 0.

## Closed

2026-10-05: done by #1818 (merged)
