---
id: T-0123
title: "Skill v2 re-pin: entry and action controls (a01)"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
T-0120 (branch feat/skill-v2-sync, your base) re-vendored the mathematical-design-system scale.mjs: the page root moved one n down (product/sm is n 5 / 6 / 7, heights 20 / 24 / 28, was 24 / 28 / 32; the A2UI canvas widget/md reads the same), so tests that pin the old pixels are red by design. Re-pin sections a01 of the list.

## Scope (one brief paragraph, per the Inner loop rule)
Open .sdlc/skill-v2-sync/repin-list.md (tracked on your branch), sections a01 only. For each listed test update only the failing assertions: a value pin takes the derived value (prefer reading scale.mjs resolve() at the test's register over a literal; check the measured number against resolve, never copy a wrong number); a golden is re-minted for that file only (`-u` on that one visual test file) and you VIEW the new PNG before keeping it, reporting anything that looks broken (clipped text, overlap, a control visibly off) instead of minting it; a law check ("Needs a look first") is ruled as follows: control font < icon box becomes <= with a comment naming the n 6 tie; a fixed fixture floor or box (toolbar 28, tabs overflow box, tile 128, pre-scroll 60, heading gap 24) is re-derived from n or the fixture is resized so the test still proves its behaviour, never deleted or loosened to vacuous; tests marked red on main too are left alone. Touch only the listed test files, their goldens and a tiny helper in the same folder; never change production code, generated files or tests outside your sections; if a pin can only go green by changing production code, stop on that test and report it. Run the listed files in both engines until exit 0 (`npx vitest run --config vitest.browser.config.ts --project <shard> <files>`, heavy runs through `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.22.6/scripts/gate_lock.py run --name repin -- <cmd>`), plus `npm run check`. Commit early locally on your branch, do not push, no per-ticket verifier, no em dashes, report in one short message: files, exit codes, and any golden or law check you want eyes on.

## Closed

2026-10-13: merged as #1942
