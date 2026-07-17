---
doc-type: ticket
id: tkt-0082
status: wontfix
date: 2026-07-17
owner:
kind: bug
size: small
---
# TKT-0082 — one-off full-sweep flake: factories.test.ts Text h1–h5 fan-out failed 5 tests, unreproducible

## Summary
One full jsdom sweep (2026-07-17 ~00:40, tree = c8aee65 clean) failed exactly the five
`factories.test.ts` "wire variant h1–h5 fans out to the ui-text triple" tests; `body`/`caption`
in the same `it.each` passed. The identical tree passed 6329/6329 immediately before commit, and
four consecutive full sweeps after (1 isolated file run + 1 immediate full re-run + a 3× capture
loop) were all clean. No repro; the failing run's assertion bodies were not captured (only the
FAIL list survived the pipe).

## Repro
None. 1 occurrence in 6 full sweeps on the same tree. The failing run shared the machine with
the vite dev server + live browser-automation sessions (system under load).

## Expected vs actual
- **Expected:** the standing gate is deterministic.
- **Actual:** five synchronous accessor-read assertions (`target.as/variant/size` immediately
  after `applyProp('variant', …)` — no async, no reflect wait) failed once, heading rows only.

## Classification
Test-infrastructure flake, mechanism UNKNOWN. What was ruled out: cross-file pollution
(vitest default per-file isolation, no `isolate`/`pool` overrides in vitest.config.ts); an
order-dependence (the file passes alone AND in four subsequent full sweeps); a tree change
(git clean, same HEAD both sides). The heading-rows-only pattern (`as: 'h1'…'h5'` failing while
`as: 'none'` rows pass) is the one unexplained signature worth checking against a captured log
next time.

## Severity
minor (a standing-gate credibility issue if it recurs; zero product impact)

## Acceptance
(For a future reopen.) Reopen ONLY with a captured full log of a failing run (`npx vitest run > sweep.log 2>&1`) — the
assertion diff is the missing evidence. Until then: wontfix (could not reproduce, not chasing
further — the bug-report discipline's own arm).

## Links
- TKT-0081's Findings (the passing 6329/6329 run on the same tree, minutes earlier).

## Findings

### 2026-07-17 — observed once, ruled out the structural causes, unreproducible in 4 further sweeps — WONTFIX

Recorded so a recurrence starts from evidence, not memory: the five failures were heading rows
only; isolation defaults rule out leakage; the assertions are synchronous accessor reads with no
timing seam; the machine was under combined dev-server + browser-automation + sweep load during
the one failure. Next occurrence: keep the log, diff the actual `as/variant/size` values against
`TEXT_VARIANT_TABLE`, and check the worker's memory/error preamble in the same log.
