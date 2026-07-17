---
doc-type: ticket
id: tkt-0087
status: open
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0087 — the theme-pack pipeline (ADR-0141): UT export → wrap → parity gate → ≥2 proof packs

## Summary
Leg 2 of the THEMING arc. Build the Ultimate-Tokens→agent-ui pack pipeline: the
`tools/themes/wrap-pack.mts` wrapper (UT oklch CSS export with the `md-sys-color` prefix →
`[theme='<name>']` pack at `shared/src/tokens/themes/<name>.css`), the `"./themes/*"` subpath
export, the STANDING parity gate (`theme-packs.test.ts`: every pack declares ⊇ the default's
`--md-sys-color-*` property set), and at least TWO real UT-generated proof packs.

## Acceptance
- `wrap-pack.mts`: validates its input is UT's export grammar (fails loudly on drift), wraps the
  body under `[theme='<name>']`, writes the pack; idempotent re-runs.
- Proof packs generated from REAL UT output (the sibling repo's engine drives a headless export
  with `export.colorPrefix='md-sys-color'`, or a hand-run UT export — either way the committed
  artifact is genuine UT output, never hand-forged).
- Parity gate standing and anti-vacuous (a deliberately truncated pack fixture reds it).
- Packs are scheme-complete (`light-dark()` on every role the default carries both values for).
- Exports resolve: `@agent-ui/shared/themes/<name>.css` loads under vite dev + build.

## Links
- [ADR-0141](../adr/0141-theme-packs-ultimate-tokens-pipeline.md) — the contract ·
  [ADR-0118](../adr/0118-token-surfaces-v1-scope.md) — the generator-owns-math fence.
- [TKT-0086](tkt-0086-md-sys-token-migration.md) (prerequisite) ·
  [TKT-0088](tkt-0088-site-shell-theme-dogfood.md) (the consumer).

## Scope/Open
- Color-only packs in v1; dimensions/type packs are a named follow-up on the same seam.
- No UT repo changes; the pipeline consumes export artifacts only.

## Findings
