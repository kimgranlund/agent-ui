---
id: T-0580
title: "The 0.2.1 release notes cover every PR merged through 2383"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`.github/release-notes/v0.2.1.md` covers every consumer-facing change merged through PR 2383, so Kim can publish 0.2.1 from main.

## Intent
- Do: add PRs 2368 to 2383 (and 2364 if missing) to the notes, following the package-release skill and the file's existing sections; extend Breaking changes if any of them breaks an export or default (the size gate in check:scripts is repo-internal, not consumer-facing); update the closing "Changes up to and including PR" line; re-run the lockstep 0.2.1 dry run.
- Non-goals: publishing, tagging, moving or deleting a tag (Kim's); the README and CDN 0.2.1 bump (after publish).
- Done when: the notes name each consumer-facing PR through 2383 with no em dash; `npm run publish:packages -- 0.2.1 --dry-run` packs nine tarballs; `npm run check` exits 0.

## Constraints
No em dashes. No paid runs. Security fixes described as hardening only, with no exploit detail.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 6e1b2734db75
- Changed: The 0.2.1 release notes cover every consumer-facing PR merged through 2383
- Commits: none
- Check: 1 The notes name each consumer-facing PR through 2383 with no em dash: pass
- Check: 2 `npm run publish:packages -- 0.2.1 --dry-run` packs nine tarballs: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: .github/release-notes/v0.2.1.md:36 the Producer repairs bullet now... -> notes.md
