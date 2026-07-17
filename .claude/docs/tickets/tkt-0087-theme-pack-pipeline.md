---
doc-type: ticket
id: tkt-0087
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0087 — the theme-pack pipeline (ADR-0141): UT export → wrap → parity gate → ≥2 proof packs

## Summary
Leg 2 of the THEMING arc. Build the Ultimate-Tokens→agent-ui pack pipeline: the
`shared/tools/themes/wrap-pack.ts` wrapper (UT oklch CSS export with the `md-sys-color` prefix →
`[theme='<name>']` pack at `shared/src/tokens/themes/<name>.css`), the `"./themes/*"` subpath
export, the STANDING parity gate (`theme-packs.test.ts`: every pack declares the default's CORE
`--md-sys-color-*` property set — minus 16 named, enumerated, hand-authored roles no stock UT
export produces), and at least TWO real UT-generated proof packs. (Rewritten post-investigation —
see Findings: `pack ⊇ default` as a literal strict superset is not achievable from any real UT
export; the core-minus-16-exempt shape is.)

## Acceptance
- `wrap-pack.ts`: validates its input is UT's export grammar (fails loudly on drift: no `:root`,
  no `color-scheme: light dark;`, a foreign custom property), wraps the body under
  `[theme='<name>']`, writes the pack; idempotent re-runs. No palette-name rename table (verified
  unnecessary against the real config).
- Proof packs generated from REAL UT output (the sibling repo's engine drives a headless export
  with `export.colorPrefix='md-sys-color'`, or a hand-run UT export — either way the committed
  artifact is genuine UT output, never hand-forged).
- Parity gate standing and anti-vacuous (two genuine negative controls, each exercising the same
  detection function the real per-pack checks use).
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

### 2026-07-17 (later, from the sibling UT session) — Option (A) confirmed with hard evidence; the
### fork is closed, no guessing required, and (B)/(C) are both moot

Read this ticket from the ultimate-tokens side and went looking for the real state before treating
the fork as genuinely open. Found it: **the real project file exists, sitting in this very repo**
— `.claude/docs/brand/ultimate-tokens-modal-jazz-the-cool-blue-session/ultimate-tokens-modal-jazz-the-cool-blue-session-config.json`
— a full 11-palette Ultimate Tokens config (`neutral · primary/primary-muted ·
secondary/secondary-muted · accent/accent-muted · info · success · warning · danger`) with
`export.colorPrefix: "md-sys-color"` already baked in.

**Verified, not assumed:** drove this exact config through UT's real `exportOKLCH` (same engine,
same repo, `src/engine/exports.js`) and diffed the output against the actual committed
`packages/agent-ui/shared/src/tokens/tokens.css`, property-name-for-property-name AND
value-for-value:

- 991 property names generated. Every one of the 11 `key-dominant` tokens, every semantic role
  across all 11 palettes, every solid stop — **byte-identical** oklch() values against the real
  file (spot-checked `primary-key-dominant`, `neutral-100`, `primary-muted-key-dominant`,
  `accent-500`, `primary-on-primary` — all exact matches, including the `light-dark()` wiring).
- The ONLY divergence was the raw scrim leaf shape (`{family}-500-{step}` in the committed file vs
  `{family}-scrim-{step}` from a fresh export) — and that gap is not real either: it's the ADR-016
  kebab-nesting rename that landed in ultimate-tokens' `main` in THIS SAME SESSION, after the
  committed `tokens.css` was captured. Reversing that one rename (`scrim-{step}` →
  `500-{step}`) makes the generated set a **perfect subset**: 991/991 generated names present in
  the real file, **zero** names generated that the real file doesn't have.
- The real file has exactly **16 names beyond that** — and every one is a name this ticket's own
  investigation already called out by name as a bespoke agent-ui extension: `focus-ring`, the six
  `neutral-tint-{dim,dimmer,dimmest,bright,brighter,brightest}` roles + their six raw alpha support
  values (`neutral-{050,950}-{50,100,140}`), `neutral-track`/`neutral-track-hover`,
  `primary-selected`. Nothing unaccounted for remains.

**This retires two of the three options and corrects a premise in the ticket's own cause #2:**

1. **(A) is confirmed, not just plausible — use this file.** It doesn't need "recovering"; it was
   never lost. It's checked in at the path above.
2. **Cause #1 (the Tertiary→Accent rename) is not a real divergence to encode in `wrap-pack.mts`.**
   There is no generic UT-role → agent-ui-name rename needed. This config's third accent-family
   palette is simply **named** `"accent"` — a legitimate custom palette name UT allows for any
   preset (confirmed: it's UT's OWN curated "Modal jazz" brand story in
   `docs/reference/colors/categories/brands.json`, carrying `accent`/`accent-muted` natively, not
   a config someone hand-edited). `wrap-pack.mts` should pass palette names through verbatim — no
   hardcoded rename table, one less piece of bespoke logic than the ticket provisionally scoped in.
3. **Cause #2's framing needs correcting: `-muted` siblings, scrims, and `key-dominant` are NOT
   agent-ui extensions layered on top of a base UT export — they are what a stock UT export of
   THIS preset natively produces.** Option (C) — teaching `wrap-pack.mts` to derive them — is
   therefore unnecessary and should be dropped; there is nothing here to derive. The real, narrow
   extension set is the 16 names above, and (B)'s "named, tracked gap" framing is the right shape
   for exactly those 16 — now enumerable instead of estimated at "382ish."

**One new, genuine fork this surfaced (not resolved here — an agent-ui-side call):** any FRESH
proof pack generated from ultimate-tokens' `main` from now on will emit the ADR-016 shape
(`{family}-scrim-{step}`), not the `{family}-500-{step}` shape the committed `tokens.css` still
uses. Before wiring `wrap-pack.mts` for real, decide: (i) regenerate/migrate `tokens.css` itself to
the new scrim grammar so pack and default agree, or (ii) have the parity gate/consumers tolerate
either shape. Recommend (i) — the two-collection dance is exactly what ultimate-tokens itself just
finished retiring repo-wide (ADR-016, `ultimate-tokens` `main`), and carrying two grammars forward
in agent-ui would just reintroduce the same drift class one repo later.

**Suggested next step:** treat the fork as closed, re-run this ticket's own acceptance criteria
against the confirmed config (11-palette export, `md-sys-color` prefix, no rename table needed in
`wrap-pack.mts`), decide the scrim-grammar question above, and build the real pipeline — no further
recovery or design work needed on the palette-shape question.

### 2026-07-17 (same day, agent-ui side) — the fork closed, the pipeline built, CLOSED

Independently re-verified the sibling session's claim before building on it (drove the real config
through UT's own `exportOKLCH` myself, diffed against the committed `tokens.css` property-name-for-
name): confirmed 991/991 shared names, confirmed the exact same 16-name bespoke residual. Decided
the scrim-grammar question (agent-ui's own call, as flagged): adopted (i), migrating `tokens.css`
itself to the `-scrim-{step}` primitive name — a small, separately-committed change (424 sites,
values byte-identical, only the name changed), with two real gate-mechanism repairs it required
(`token-parse.ts`'s primitive-exclusion regex, `tokens.test.ts`'s completeness matrix) — see that
commit's own message for the full account. Consumer blast-radius was verified LOW before committing
(grepped for any component CSS reading the raw primitive directly — none; it is consumed only by
tokens.css's own semantic `-scrim-{role}` layer + one docs-site test file).

**Built:**
- `packages/agent-ui/shared/tools/themes/wrap-pack.ts` — validates a UT export's shape (single
  `:root` block, `color-scheme: light dark;` present, every custom property `--md-sys-color-*`),
  wraps it under `[theme='<name>']`, writes `src/tokens/themes/<name>.css`. NO palette-name
  adaptation table (the sibling session's finding held under my own re-verification — UT's own
  config already names the third identity family "accent"). Fails loudly on three real defect
  shapes (no `:root`, illegal name, foreign custom property) — proven via manual invocation, not
  just claimed. Tested from its `src/` sibling (`tokens/wrap-pack.test.ts`, 10 cases) per the
  repo's own tools-vs-src vitest-glob convention (the mini-skills.ts precedent) — a file placed
  directly under `tools/` would have been silently never run.
- `packages/agent-ui/shared/src/tokens/theme-packs.test.ts` — the standing parity gate. "Core" =
  the default's full property set minus the 16 named bespoke exemptions (enumerated exactly, not
  estimated); every pack must carry every core name AND match the default's `light-dark()` pairing
  per-property (never flatten a paired role to one scheme). TWO genuine negative controls exercise
  the SAME detection functions the real per-pack checks use (not self-referential fixtures) — both
  confirmed to bite before trusting the real packs' green result.
- TWO real proof packs (`themes/ocean.css`, `themes/ember.css`) — genuine hue-rotated derivatives of
  the repo's own real 11-palette config (status colors info/success/warning/danger left untouched;
  only the seven IDENTITY palettes rotated), generated via UT's actual engine, wrapped via the real
  tool. Independently diffed against the migrated default: exactly the 16 known-exempt names
  missing, zero unexpected names either direction — the parity gate's design is proven against a
  real artifact, not just a synthetic fixture.
- `"./themes/*": "./src/tokens/themes/*"` added to `shared/package.json`. Live-verified under real
  `vite dev`: `import '@agent-ui/shared/themes/ocean.css'` resolves to the real wrapped pack file
  with correct HMR wiring (fetched the served module transform directly — not just "no error").

**Not built (correctly out of scope):** `site/lib/theme-loader.ts` (the on-demand loading helper)
and the site-shell picker are TKT-0088's job (Leg 3), which also carries Kim's newer directive
(memory: `theme-ticket-header-activation-convention`) to activate the docs shell's currently-inert
`Theme` header placeholder, not just wire the machinery underneath it.

**Verified:** `npm run check` green; full jsdom clean except the pre-existing cross-session
ADR-0139 numbering gap (unrelated, self-resolving); the theme-provider built-CSS fixture
regenerated after the scrim rename. ADR-0141 updated to match what was actually built (tool path,
the real parity-gate shape, the scrim-grammar prerequisite) — status stays `proposed`, not
self-ratified.
