---
doc-type: ticket
id: tkt-0087
status: doing
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

### 2026-07-17 — a real UT export is a STRUCTURAL SUBSET of agent-ui's current default, not a
### superset candidate — blocked pending a design decision, no code built

Drove Ultimate Tokens' real engine directly (`src/engine/exports.js`'s `exportCSS`, `colorPrefix:
'md-sys-color'`) against its stock 8-palette `role-table.json` defaults, with two genuine hue
rotations (+140°/-95°, through UT's own perceptual pipeline) as candidate proof packs — the
"drive the engine once, out-of-band, to bootstrap two sample states" reading of ADR-0141 cl.3
(wrap-pack.mts itself still never imports UT; this was a one-time generation step). First
diff against `tokens.css`'s declared property names surfaced **713 vs 1007** names — far short of
the parity gate's `pack ⊇ default` bar. Two distinct causes, only the first cheaply fixable:

1. **A 1:1 naming divergence** — agent-ui's tokens.css has zero `--md-sys-color-tertiary-*`
   declarations; UT's role-table always names that slot "Tertiary". agent-ui renamed it "Accent"
   at some prior point (no ADR trail found by a scoped grep). Fixed in the generation script
   (`name === 'Tertiary' ? 'Accent' : name`) — closes part of the gap, and is now documented as a
   REQUIRED adaptation `wrap-pack.mts` itself must carry (ADR-0141's "wraps" undersold this — it
   is "wraps + the one Tertiary→Accent family rename", not a byte-verbatim passthrough).
2. **A real structural gap (382 names) that renaming can't close.** agent-ui's actual default
   config is NOT the stock 8-palette state at all — it independently carries THREE ADDITIONAL
   full palette instances (`primary-muted`/`secondary-muted`/`accent-muted`, each a complete
   53-role set — 3×~110 names alone), plus per-family `-500-{alpha}` scrim rows (11×8=88),
   per-family `-key-dominant`, and a handful of bespoke roles (`neutral-tint-*`,
   `neutral-track{,-hover}`, `focus-ring`, `primary-selected`). Confirmed these are NOT a UT
   feature gated behind an export option I missed (grepped `semantic.js` for `muted`/
   `key-dominant`/`focus-ring` as role/palette vocabulary — none exist) — they are agent-ui-side
   extensions layered on top of (or instead of) a base UT export. No persisted UT state/project
   file exists anywhere in either repo to replay the ACTUAL 11-palette+extensions configuration
   that produced the current `tokens.css` (grepped for `.uts`/state-file patterns — none found).

**This is a real fork, not an implementation detail — recorded here rather than resolved by
guessing:**
- **(A) Recover the real state.** If Kim (or a prior session) has an actual Ultimate Tokens
  project/export session that produced the CURRENT `tokens.css` — even just the palette list with
  its `-muted` siblings — replaying THAT exact config would close the gap for real, and is
  probably the "right" answer if it exists.
- **(B) Redefine what a v1 proof pack covers.** Relax ADR-0141's parity claim to "the CORE 8-family
  role surface" (what a stock UT export actually produces) and treat `-muted` siblings/scrims/
  key-dominant/the bespoke handful as a NAMED, tracked GAP a pack may legitimately omit in v1 —
  the provider's own architecture (system tier consumed by prefix, `light-dark()` scheme-complete)
  still works fine with a smaller-but-real role set; components reading a role a given pack
  doesn't override simply keep resolving through `:root`'s cascade default for that one role
  (needs verifying that's actually how the provider's subtree scoping behaves before relying on
  it — an open sub-question, not yet checked).
- **(C) Teach wrap-pack.mts to DERIVE the extensions.** Have the wrap tool compute `-muted`
  variants / alpha scrims / `key-dominant` itself from the raw UT roles it does receive — this
  makes wrap-pack.mts a real derivation engine, in tension with ADR-0141 cl.3's stated "never
  imports UT's engine, just wraps" boundary (though deriving FROM already-exported values, not
  re-running UT's math, may or may not cross that line — worth Kim's read).

No pipeline code, no `theme-packs.test.ts`, no committed pack files from this session — the two
candidate CSS exports (ocean/ember, real UT output) sit in the scratchpad, not the repo, since
committing them as "proof packs" against a gate they're known to fail would be exactly the
misleading-artifact failure this ticket's own acceptance criteria guards against.
