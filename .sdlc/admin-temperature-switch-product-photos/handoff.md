---
id: T-0129
title: "agent-admin temperature float and off switch; ProductCard seed photos missing"
type: bug             # feature | bug | chore | spike | idea
status: ready
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Three small defects seen in the T-0120 parity review, all present before it.

## Scope (one brief paragraph, per the Inner loop rule)
(1) agent-admin shows temperature as 0.6000000000000001: format the displayed value (and fix the step arithmetic if that is the cause) so it reads 0.6; (2) in agent-admin's model list the Sonnet 5 row's off switch reads as a bare dot: find why the track is not visible in the off state there (a local override, a missing token or contrast) and fix the root cause in agent-admin, not in switch.css; (3) the ProductCard seeds point at /rooms/*.jpg which do not exist, so the alt text overlaps the badge: find where the seed images were meant to live (git log) and restore them or repoint the seeds at assets that exist, and make a missing image degrade without overlapping the badge only if that is a one-rule fix in product-card's own sheet. Evidence: before and after screenshots of each, viewed, in the ticket folder. Local gate: npm run check plus the touched folders' tests (browser files through gate_lock.py; a golden only with '<file> --update', the file filter before the flag, and only after viewing it). Regenerate generated files with their scripts, never by hand. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Two other lanes are running: stay out of the shell, page chrome and container CSS (T-0121) and out of control padding, badge, checkbox and scripts/generate-foundations.mjs (T-0122). Commit locally, do not push, no per-ticket verifier, no em dashes, report in one short message with exit codes.
