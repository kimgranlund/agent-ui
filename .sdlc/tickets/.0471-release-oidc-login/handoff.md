---
id: T-0471
title: "The release workflow gets an npm credential through trusted publishing"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Pushing a vX.Y.Z tag publishes the eight packages from GitHub Actions with no npm token.

## Context
Run 40341014351 (tag v0.2.0 at 70d024c98) failed with ENEEDAUTH: npm 11.19.0 was in place but the OIDC exchange returned no credential, so nothing was published. T-0466 removed setup-node `registry-url`; the trusted publisher entries on npmjs.com were confirmed set by Kim. Candidate causes: the missing `registry-url` (npm reads the registry from it for the OIDC audience), a publisher entry naming a different workflow file or environment, or the scratch-dir publish in `scripts/publish/publish-packages.mjs` losing the job's OIDC env. Wave 1.

## Constraints
Diagnose from the run log and npm docs before changing anything; never read or print .env or keys. Do not push a tag or publish: a test run is Kim's call. No em dashes.

## Done when
- The diagnosis names the cause with evidence (run log line, npm doc, or a dry run).
- `.github/workflows/release.yml` and `.claude/skills/package-release/SKILL.md` carry the fix and say what Kim must check on npmjs.com, if anything.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The publish step sets npm to verbose so a refused OIDC exchange prints its reason: `grep -q "NPM_CONFIG_LOGLEVEL: verbose" .github/workflows/release.yml`
- A failed publish keeps npm's debug logs: `grep -q "if: failure()" .github/workflows/release.yml`
- The skill names the ENEEDAUTH reading and the npmjs.com checklist: `grep -q "Failed token exchange request" .claude/skills/package-release/SKILL.md`
- The gate is green: `npm run check`

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 215357f24670
- Changed: The release workflow logs npm verbosely and uploads npm logs on failure, and the package-release skill says what to check on npmjs.com after an ENEEDAUTH
- Commits: none
- Check: 1 The publish step sets npm to verbose: pass
- Check: 2 A failed publish keeps npm's debug logs: pass
- Check: 3 The skill names the ENEEDAUTH reading and the npmjs.com checklist: pass
- Check: 4 The gate is green: pass
- Follow-up: note: no em dashes in added lines of release.yml and SKILL.md grep count 0. -> notes.md
- Follow-up: note: redck deviations printed no process deviation: line; no red... -> notes.md
- Follow-up: note: the diagnosis rests on the builder's reading of npm's source and... -> notes.md
