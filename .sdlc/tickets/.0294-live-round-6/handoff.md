---
id: T-0294
title: "Live round 6: full matrix, every preset on Haiku, Sonnet and Opus ($20 cap)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0289, T-0290, T-0292, T-0293]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A clean scorecard after five rounds of fixes: every shipped preset (Croupier, Concierge, Lexicographer, Admiral) on Haiku, Sonnet and Opus, across their round scenarios and long flows, with the routing pack.

## Approval
Kim 2026-10-16: full matrix, spend cap $42 (Kim raised it from $20 on 2026-10-16 after the phase 1 estimate of about $41; the runner stops at $42 whatever is queued; order Haiku, then Sonnet, then Opus so the cap drops Opus first). Runs after the round 5 Concierge lane merges. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- A round 6 generator beside `round5.ts` (pinned by a test): every scenario from the current generators (`concierge.ts`, `croupier.ts`, the Lexicographer and Admiral scenarios, `routing.ts`, the long flows) on all three models, one run each.
- `run-capped.ts --describe` and `--cap 20 --dry-run`. Phase 1 stops and reports the run command and count; the conductor runs the round; phase 2 writes the report.

## Report
`.sdlc/evals/rounds/<date>-r6-matrix/report.md`: a preset by model pass-rate matrix with rounds 3 to 5 for comparison; the cheapest model that passes each preset; per round 5 fix ticket (T-0289 to T-0293, T-0291) fixed live, partly or still failing; check fire and save rates; routing-expect misses; spend. Then the context-fog-of-war decision analysis as rounds 4 and 5 did it: cluster fails by root cause with exposure chains, hydrate decisions, guidance edges and findings, classify each cluster, a `## Why it failed and how to fix it` table, publish and record the report id. One proposed ticket per uncovered cluster; useful fails become keyless replays.

## Constraints
Screenshots go to the evidence cache, never the repo. No prompt or code fixes in this ticket.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the matrix and the why-and-fix table; spend at or under $42.
- The hydrated fog report is published and its id recorded.
- `tickets.py check` and `npm run check` exit 0.

## Phase 2 uses the updated context-fog-of-war skill (Kim 2026-10-16)
Kim: "make sure round 6 uses the new skill and verifies the improvements made". The skill changed today (`~/.claude/skills/context-fog-of-war/updates-log/20261016-runtime-harness-learnings/` and `20261016-skill-md-restructure/`).
- Phase 2 reads `~/.claude/skills/context-fog-of-war/SKILL.md` fresh from disk and follows its routing table (runtime-harness bundle, diagnose) and Autonomous run checklist on its own; the conductor sends no step list. Classify clusters with the cause classes in `references/learnings/README.md` and its triage file, and report detector prerequisites as the skill's Prerequisites block says.
- The report gets a `## Skill improvements, verified` section, one row per change, verdict held, partly or failed, with evidence:
  1. The checklist alone reached the published report id and the why-and-fix table (name every point where the ticket, not the skill, had to supply a step).
  2. The routing table picked the right entry for a runtime-harness bundle.
  3. The Prerequisites block: the detectors' coverage lines match what the round's traces record; a missing prerequisite is reported as the finding.
  4. The script fixes on a real trace: `scripts/diagnostics.py` `lookup_request` (no `cat > file` write counted as a lookup; failed discovery needs the error to name a requested target) and `scripts/wrapped.py` (batch plus indexed loop pairing), against this round's bundle; say if the bundle exercises neither.
  5. The learnings: each round 6 cluster maps to a lesson and its "Applies to" tag fits (runtime harness).
  6. The round 5 repo fixes live (T-0289, T-0290, T-0291, T-0292, T-0293), already in the Report scope.
- Any skill gap found is a proposed note for the skill's `updates-log/` (a new dated entry with front matter per its `AGENTS.md`), not a repo ticket.

Done when also: the report holds `## Skill improvements, verified` with all six rows, each with evidence.

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Round 6 full matrix: 76 of 87 pass, $36.82 of $42; fog d242f3e13e7408d0d5327c38; skill improvements verified (checklist partly); verifier L2 pass) · verifier: verifier-L2 (sonnet) · base: da6c7321c6ef
- Changed: see commits
- Commits: 05afd6e T-0294: live round 6 report, fog decision analysis and three keyless replays; 6c0e7a9 T-0294: phase 2 uses and verifies the updated context-fog-of-war skill (Kim); a8ce4f5 T-0294: cap raised to $42 (Kim); afe5658 T-0294: live round 6 full matrix generator and live commands; 510326c T-0294: commit pending ticket records
- Check: 1 Round folder holds traces, ledger, round.json, runs/, README, report.md with the matrix and the w...: pass
- Check: 2 Hydrated fog report published and id recorded: pass
- Check: 3 `tickets.py check` and `npm run check` exit 0: pass
- Check: 4 Report holds `## Skill improvements, verified` with all six rows, each with evidence: pass
- Check: 5 Constraint: no prompt or code fixes, screenshots not in the repo: pass
