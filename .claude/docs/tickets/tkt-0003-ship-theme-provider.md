---
doc-type: ticket
id: tkt-0003
status: done
date: 2026-07-09
owner:
---
# TKT-0003 — promote `theme-provider` to a shipped library component

## Summary
`<theme-provider>` exists only as docs-site chrome (`site/lib/theme-provider.ts` — a passive
wrapper built for the gallery, ADR-0079 cl.3): a consumer installing the library gets no theming
element at all and must hand-roll the wrapper the theming guide describes. Kim directed
(2026-07-09): add building a real, shipped `theme-provider` to the plan.

## Acceptance
- A design intake resolves the real forks before any build (the house process — decomposition +
  ADR with firm recommendations): the tag under the fleet naming law (`ui-*` tags — likely
  `ui-theme-provider`; the site element's bare `theme-provider` name predates the law's reach into
  site chrome), the package home (components' controls/ tier vs elsewhere — scheme/scale/density
  are token-system axes, which argues components), the contract (the three live axes + the
  reserved `theme` package seam, ADR-0079's next-tier multi-theme scope explicitly NOT pulled in),
  and the migration (the site's local copy is replaced by the shipped element; the theming guide +
  llms.txt updated in the same change — keep-context-live).
- The shipped component meets the full per-control bar: descriptor + contract trip-wire, jsdom +
  cross-engine browser probes (including a real per-subtree `light-dark()` resolution proof — the
  TKT-0002 production-build regression class must be covered against the BUILT output), independent
  review, barrel/exports/size integration.
- The docs site dogfoods the shipped element everywhere the local copy is used today (theming.html,
  component-gallery), with zero site-local `theme-provider` definition remaining.

## Links
- `site/lib/theme-provider.ts` — the current site-local element (the contract to promote).
- `site/pages/theming.ts` — the theming guide (honest today about the site-local status; updates
  when this ships).
- ADR-0079 cl.3 — the original gallery-scoped design + the reserved `theme` seam.
- TKT-0002 — the `light-dark()` production-build regression class the new component's browser legs
  must guard against.
- `.claude/docs/adr/README.md` — the intake ADR lands at the next free number when picked up.

## Findings
### 2026-07-09 — shipped: design intake → double doc review → build → double build review → fix pass, all gates green

- **Design (committed `a25f250`):** ADR-0117 (proposed — F1 `ui-theme-provider` clean cutover ·
  F2 controls/ + UIElement · F3 four `''`-default reflected props, unset `scheme` CLEARS the
  color-scheme override [fixes the site version's collapse-to-light bug] · F4 tier container +
  permanent a2ui `EXCLUSION_ALLOWLIST`) + `spec/theme-provider.spec.md` (R1–R11) +
  `lld/theme-provider.lld.md` (C1–C12) + decomp. Doc review took THREE delta passes: HIGH
  migration completeness (the component-gallery.css ink-re-root rule), the unrunnable
  spawnSync-in-browser-test C11 design, and an unsatisfiable R9 grep — all repaired pre-build.
- **Build:** `controls/theme-provider/` (element + css + descriptor + 3 test files, 27 jsdom +
  10 cross-engine browser assertions), full ten-file site migration (`site/lib/theme-provider.ts`
  DELETED, zero bare `theme-provider` in site/ per the R9 gate), new doc+demo pages, the SPEC-R11
  two-test built-output bridge (node byte-identity freshness gate + `?raw` browser leg against a
  committed production-build fixture) — the TKT-0002 regression class covered against REAL built
  bytes. Marginal size 156 B gz.
- **Two reviewer-ratified build deviations** (recorded in LLD §6/SPEC-R11): descriptor YAML
  block-style expansion; the C11 vehicle swap solid/background → soft/ink because
  `--md-sys-color-primary` is deliberately scheme-INVARIANT (the frozen assertion was
  vacuous-by-construction). The freeze-discipline gap (deviation built before escalation) is
  recorded honestly in the deviation notes.
- **Build review found one REAL infra hole (fixed same wave):** the shared vite-build cache
  (`site/lib/build-css.ts`, single-flight lock — itself the root-cause fix for a reproduced
  two-concurrent-builds test flake) was time-windowed and could false-green the freshness gate
  during edit→rerun iteration; now keyed on real source mtimes (`isCacheStale` +
  `build-css.test.ts` regression suite), reviewer re-ran its own repro: red-on-edit confirmed.
  Residual: a full-suite a2a-tic-tac-toe.live.test.ts flake under extreme machine load (avg 24)
  — reviewer-concurred pre-existing environmental fragility, unreachable from this diff.
- Known-red exclusions throughout (Kim's in-progress edits, untouched): `tokens.css`/tokens.test.ts
  and the ADR-0116 `accpted` status edit/adr.test.ts. ADR-0117 remains **proposed**.
