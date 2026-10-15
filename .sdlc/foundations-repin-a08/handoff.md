---
id: T-0115
title: "Cut re-pin lane a08 (a2ui): update old-value browser pins to the derived values (ADR-0245)"
type: chore
status: done
size: L2
priority: P1
depends: []
created: 2026-10-12
router: .sdlc/AGENTS.md
---

## Goal
The foundations cut (branch feat/foundations-cut, T-0107) made the derived system the default, so browser tests that pin OLD values fail. Re-pin the failing tests of lane a08 (a2ui).

## Scope (one brief paragraph, per the Inner loop rule)
Open .sdlc/foundations-cut/repin-list.md, section "## a08". For each listed file and test update only the failing assertions: a value pin takes the derived value (check it against scale.mjs resolve or node scripts/foundations-probe.mjs, never copy a number blindly); an outside leg keeps today's value under data-foundations="legacy" as the lane *-foundations tests do; a NaN read (the test parses a token's raw calc() text) is read through a probe box; an "investigate" row (for example pdf-extractor dynamic-import failures in Chromium only) is re-run once on a quiet machine and reported, not edited. Touch only the listed test files in your lane's folders; never change production code or goldens (if a failure is a real production regression, stop and report it as blocked with the file and line). Run those files in the shard the list names (npx vitest run --config vitest.browser.config.ts --project <packages | packages-rest | site as the list says> <files>) and they must exit 0. Commit early locally, do not push, no per-ticket verifier, no em dashes, report in one short message.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
