---
id: T-0255
title: "GitHub workflows cut to the CI check; review, regen, deploy and publish run locally"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
GitHub runs only the `ci.yml` check on PRs. Everything else runs locally: review by the per-ticket verifiers, fixture regeneration in the merge queue, docs deploys and package publishes by Kim's own commands.

## Context
Kim 2026-10-15: remove as much GitHub workflow work as possible, manage it locally; keep `ci.yml` (the one required check and the only full-suite run).
- Delete `.github/workflows/claude-code-review.yml` (failing on every PR since 2026-10-14 on credit, advisory only).
- Delete `.github/workflows/theme-provider-fixture-regen.yml` (the merge queue runs `npm run regen:theme-provider-fixture` before every merge).
- `.github/workflows/deploy-docs.yml`: drop the `push: branches: [main]` trigger, keep `workflow_dispatch`, so a merge no longer deploys ui.nonoun.io; `npm run deploy:docs` stays Kim's.
- Delete `.github/workflows/publish.yml` and `consumer-smoke.yml`; publishing stays local via `npm run publish:packages` (nothing published yet).
- Repair every record that names these workflows: CLAUDE.md and AGENTS.md, `.claude/docs/process.md`, the package-release and repo-hygiene skills, README or CONTRIBUTING if they mention them, `.sdlc/notes/notes.md` lines about restoring claude-review as a required check, and any test or script that reads the workflow files.
- Ticket T-0191 (claude-review still failing) becomes moot: close it by reason in the same change.

## Done when
- `ls .github/workflows` shows `ci.yml` and `deploy-docs.yml` only; `deploy-docs.yml` has no `push` trigger.
- `git grep -nE 'claude-code-review|consumer-smoke|theme-provider-fixture-regen|publish\.yml'` finds no live instruction (history sections and closed tickets allowed).
- `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2018: only ci.yml and a manual deploy-docs remain; verifier L1 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
