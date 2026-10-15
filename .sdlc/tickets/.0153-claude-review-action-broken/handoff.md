---
id: T-0153
title: "claude-review CI action fails before any work since 2026-10-14 12:50 UTC (any credential)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The `claude-review` job in `.github/workflows/claude-code-review.yml` runs a real review again, so it can return to the required checks (Kim 2026-10-14: "Fix it").

## Repro
1. Any PR since about 12:50 UTC on 2026-10-14 (e.g. #1968 to #1975): the `claude-review` check fails in about 0.5 s with `is_error`, zero turns and zero cost.

## Expected
The action runs a review turn and posts or passes.

## Actual
Fails before any model turn, with either `anthropic_api_key` or `claude_code_oauth_token` (the switch to OAuth in #1964 did not help), so it is not the credential value.

## Context
- Use `gh run view <id> --log` on a recent failing `claude-review` run (gh is authenticated) to read the action's own error lines before guessing. Suspects, all guesses: the action version pin moved or a new required input; the model id in the workflow (it names `claude-sonnet-5-5`; check the action accepts it, or whether a model arg format changed); workflow `permissions` (id-token, pull-requests); a breaking change in `anthropics/claude-code-action` release notes around that time (check its GitHub releases).
- Fix in the workflow file. A workflow change only proves itself on a PR run: push the branch, open the PR through the conductor (never merge yourself), and read the `claude-review` result on that PR.
- Never print secret values. Commit on `chore/claude-review-fix` off origin/main.

## Constraints
- Do not touch branch protection; restoring the required check is Kim's (the restore command is in `.sdlc/notes/notes.md`). No em dashes.

## Closed

2026-10-14: merged as PR #1979; verify on the next PR
