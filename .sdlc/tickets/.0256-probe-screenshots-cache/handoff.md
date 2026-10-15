---
id: T-0256
title: "chat:probe and live rounds write screenshots to a cache folder, not .sdlc"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Screenshots from `chat:probe` and live rounds (`probe/run-capped.ts`) are written to a cache folder outside the repo; the repo keeps only the text records worth analyzing (traces, ledger, round.json, report.json, fixture.json, README).

## Context
Kim 2026-10-15: screenshots are for testing and analysis, not record keeping; they go in tmp or cache folders. sdlc-lite ruling (Kim, via the plugin author): images and heavier evidence go in a user-scope cache outside the repo, never `.sdlc`; plugin T-0568 will add `wtroot.py evidence <ticket>` and a check that warns on tracked binaries under `.sdlc`.
Today `run-capped.ts` and the probe write turn PNGs into `.sdlc/evals/rounds/<round>/runs/<run>/` (and chat:probe into its report dir).

## Constraints
- Default screenshot root: `$AGENT_UI_EVIDENCE_DIR` if set, else `~/Library/Caches/agent-ui/evidence/` on macOS and `${XDG_CACHE_HOME:-~/.cache}/agent-ui/evidence/` elsewhere, then `<round>/<run>/`. One small helper owns this path.
- `report.json` and the round README name each screenshot's cache path (absolute) and say it is local and may be gone.
- No new PNG under `.sdlc` or anywhere in the repo.
- Existing round PNGs on disk under `.sdlc/evals/rounds/*/runs/` move to the cache folder (they are git-ignored, so this is a local move); the READMEs regenerate with `--describe`.

## Done when
- A probe or run-capped selftest run writes its screenshots under the cache root and none under the repo (`git status --porcelain --ignored | grep -c '\.png'` is 0 after the run, for paths the run wrote).
- `report.json` carries the cache paths; `--describe` READMEs mention the cache location.
- scripts/e2e-admin tests, the chat-probe selftest and `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2023: screenshots go to the evidence cache; verifier L1 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
