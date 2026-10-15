---
id: T-0191
title: "claude-review still fails in 0.5s with a working API key (not the credential)"
type: bug             # feature | bug | chore | spike | idea
status: blocked      # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`claude-review` completes a real review on a PR, so Kim can restore it as a required check.

## Facts so far (T-0153, PR #1979, #1980)
- A probe step on PR #1979 showed `ANTHROPIC_API_KEY` returns HTTP 200 and the OAuth token 429. The workflow now uses the API key (merged).
- PR #1980 still fails: the result block is `is_error: true`, `duration_ms: 458`, `num_turns: 1`, `total_cost_usd: 0`, `modelUsage: {}`. The model never ran, so the CLI errors before the first API call. The plugin `code-review@claude-code-plugins` installs fine, and init reports model `claude-sonnet-5-5`.
- The action hides the CLI output. It also skips itself when the workflow file differs from main, so a workflow change only proves itself after it merges.
- Suspects (guesses): the slash-command prompt `/code-review:code-review --comment ...` (the command not found, or its args changed in the plugin since about 12:50 UTC); `settings: '{"effortLevel": "xhigh"}'` (an invalid settings key or value for the CLI version); `--allowedTools` quoting in `claude_args`.

## Intent
- Do:
  1. Reproduce locally first. Install the same plugin from the same marketplace in a temporary `CLAUDE_CONFIG_DIR` scratch dir and run the same `claude -p` prompt, model, settings and allowedTools against a throwaway PR URL or a dry form. Find the exact error, without spending more than a few cents; never print keys.
  2. If local repro is not possible, add the action's `show_full_output: true` input, or the documented debug input. Report to the conductor so it merges that one-line change and reads the next PR's log.
  3. Fix the cause in the workflow and commit. The conductor ships it, and the next PR proves it.
- Done when: a PR after the fix shows `claude-review` pass with nonzero cost; the root cause is stated in the PR body.

## Context
- Branch `chore/claude-review-fix-2` off origin/main. Never print secrets. Branch protection is Kim's.

## Constraints
- No em dashes.

## Deferred
2026-10-14: root cause found on PR #1982 with show_full_output: the API key account returns 400 billing_error "Credit balance is too low". Waits on Kim topping up the account credit; then remove show_full_output and confirm on the next PR.
