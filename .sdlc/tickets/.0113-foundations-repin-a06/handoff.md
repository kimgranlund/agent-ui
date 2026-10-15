---
id: T-0113
title: "Cut re-pin lane a06: update the old-value browser pins to the derived values (ADR-0245)"
type: chore
status: done
size: L2
priority: P1
depends: []
created: 2026-10-12
router: .sdlc/AGENTS.md
---

## Goal
The foundations cut (branch feat/foundations-cut, T-0107) made the derived system the default, so component browser tests that pin OLD values now fail. Re-pin the failing tests of lane a06.

## Scope (one brief paragraph, per the Inner loop rule)
Open .sdlc/tickets/.0107-foundations-cut/repin-list.md, section "## a06". For each listed file and test, update only the failing assertions: a value pin takes the derived value shown as measured (check it against node scripts/foundations-probe.mjs or scale.mjs resolve, never just copy a wrong number); an outside leg keeps today's value but under data-foundations="legacy" as the lane *-foundations tests already do; a custom property read is parsed the way the list says. Touch only the listed test files (and a tiny helper in the same folder if needed); never change production code or goldens. Run those files in both engines: npx vitest run --config vitest.browser.config.ts --project packages <the section's files> must exit 0. Commit early locally, do not push, no per-ticket verifier, no em dashes, report in one short message with the files and exit code.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
