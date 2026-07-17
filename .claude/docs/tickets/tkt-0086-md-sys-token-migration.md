---
doc-type: ticket
id: tkt-0086
status: open
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0086 — the `--md-sys-*` shared-token migration (ADR-0140): ~34 names, ~150 files, one gated wave

## Summary
Leg 1 of the THEMING arc. Execute ADR-0140's mechanical rename: every shared foundation token in
`dimensions.css`/`base.css` moves to its mapped `--md-sys-*` name (the ADR's table is the contract
— slots stable, values byte-identical), every fleet consumer follows in the same wave, and the
citing laws/gates move with it. Runs in an isolated worktree branch (the other session is active
on main).

## Acceptance
- The ADR-0140 mapping applied verbatim; computed styles byte-identical (spot-verify via the
  browser gallery + the built-CSS fixture regen).
- Grep-zero on every OLD shared name repo-wide (`--ui-height-`, `--ui-space-`, `--ui-scale`, … —
  the full census list), EXCLUDING per-component `--ui-{name}-*` tokens which must be untouched.
- `naming.md` §5 rewritten (prefix = ownership; allowlist retired) + §12 records the 2026-07-12
  ruling's partial supersession; `dimensions.test.ts` / `styling-gates.test.ts` /
  `family-coherence.test.ts` updated per their own deliberate-change rules; ADR-0038's prose refs
  trued.
- `npm run check` + full jsdom + browser smoke green; theme-provider built-CSS fixture regenerated.

## Links
- [ADR-0140](../adr/0140-system-token-md-sys-consolidation.md) — the contract.
- [TKT-0087](tkt-0087-theme-pack-pipeline.md) / [TKT-0088](tkt-0088-site-shell-theme-dogfood.md) —
  the legs this unblocks.

## Scope/Open
- NO compat aliases (ADR-0140 cl.3). NO value changes. NO per-component token renames.

## Findings
