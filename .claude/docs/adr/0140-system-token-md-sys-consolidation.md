# ADR-0140 — the system-token consolidation: the SHARED foundation tier migrates `--ui-*` → `--md-sys-*` (slots stable, families swapped); the control tier stays `--ui-{name}-*`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat (the THEMING intake, Kim's directive: "embrace `--md-sys-*` pattern throughout and migrate any `--ui-*` patterns", clarified via AskUserQuestion notes to the FULL shared migration — invented md-sys names where M3 has no upstream family) |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build: `shared/src/tokens/dimensions.css` + `base.css` (the declarations) · every fleet consumer of the ~34 shared names (~150 files) · `naming.md` §5/§12 (the foundation-tier canon + the 2026-07-12 ruling's supersession note) · `dimensions.test.ts`/`styling-gates.test.ts`/`family-coherence.test.ts` (the gates) · the ADR-0038 geometry tables' prose · the theme-provider built-CSS fixture |
> | **Supersedes / Superseded by** | **Partially supersedes the 2026-07-12 "permanent two-tier, no convergence" naming ruling** (naming.md §5, recorded at its lines 113-114/192): its FOUNDATION half ("foundation constants share `--ui-` by history") is reversed by Kim's 2026-07-17 theming directive — three affirmations: the ask, the full-shared clarification note, the ratified intent read-back. Its CONTROL half **stands and strengthens**: per-component `--ui-{name}-*` stays, so "prefix = ownership" becomes CLEAN (`--ui-` ⇒ component-owned, `--md-sys-` ⇒ system-owned) instead of allowlist-managed. Extends ADR-0078 (the md-sys color/typescale adoption this completes). |

## Context

The shared token layer is split across two namespaces by history, not by design: `tokens.css` (1014
`--md-sys-color-*` declarations — primitive tonal ramps + `light-dark()` semantic roles, generated) and
`--md-sys-typescale-*` (the display type scale) already speak M3's system-token grammar, while
`dimensions.css`/`base.css` declare ~34 distinct foundation names (117 declarations incl. per-`[scale]`
re-tablings) under `--ui-*` — the SAME prefix the per-component consumer-knob contract uses
(`--ui-button-*`, ADR-0003), disambiguated only by an allowlist (naming.md §5's own admission: "share
the `--ui-` prefix by history"). The theming arc (ADR-0141) makes the system tier the THEME-ADDRESSABLE
surface — a single, predictable system namespace is now load-bearing, not cosmetic.

## Decision

1. **Every SHARED foundation token migrates to `--md-sys-*`, slot names stable, family names swapped.**
   The rename is mechanical (no re-slotting, no value change — byte-identical computed styles). The
   mapping, complete:

   | Family (old) | New | M3 status |
   |---|---|---|
   | `--ui-radius-base` | `--md-sys-shape-corner-base` | upstream (shape) |
   | `--ui-motion-fast` | `--md-sys-motion-duration-fast` | upstream (motion) |
   | `--ui-ease-standard` | `--md-sys-motion-easing-standard` | upstream (motion) |
   | `--ui-focus-ring-{width,offset}` | `--md-sys-state-focus-ring-{width,offset}` | M3-adjacent (state) |
   | `--ui-sans` / `--ui-mono` | `--md-sys-typeface-sans` / `--md-sys-typeface-mono` | M3-adjacent (`--md-ref-typeface-*` analog) |
   | `--ui-height-{sm,md,lg}` | `--md-sys-height-{sm,md,lg}` | **invented** |
   | `--ui-font{,-sm,-md,-lg}` | `--md-sys-font{,-sm,-md,-lg}` | **invented** (control band — distinct from typescale, documented) |
   | `--ui-icon-{sm,md,lg}` | `--md-sys-icon-{sm,md,lg}` | **invented** |
   | `--ui-gap{,-sm,-md,-lg}` | `--md-sys-gap{,-sm,-md,-lg}` | **invented** |
   | `--ui-space-{none,xs,sm,md,lg,xl,2xl}` | `--md-sys-space-{…}` | **invented** |
   | `--ui-compact-{sm,md,lg}` | `--md-sys-compact-{sm,md,lg}` | **invented** |
   | `--ui-widget-inset` | `--md-sys-widget-inset` | **invented** |
   | `--ui-control-line-height` | `--md-sys-control-line-height` | **invented** |
   | `--ui-scale` / `--ui-density` | `--md-sys-scale` / `--md-sys-density` | **invented** (the two multipliers) |

   Any bare inherited helper the `*`-rules derive (`--ui-font`, `--ui-gap`, caret analogs) rides the
   same swap. Invented families are documented in `naming.md` §5 as DELIBERATE non-upstream extensions
   of the md-sys grammar (the repo's system tier speaks ONE prefix; upstream fidelity is kept where
   upstream vocabulary exists and consciously extended where it does not — Kim's explicit choice over
   the M3-real-families-only alternative).

2. **The per-component `--ui-{name}-*` tier is UNTOUCHED** — it is the consumer-knob contract
   (ADR-0003), a different system with a different owner. Post-migration the prefix IS the ownership
   boundary: `--ui-` ⇒ declared by a component folder; `--md-sys-` ⇒ declared by the system tier
   (generator- or law-owned). naming.md §5's allowlist mechanism retires.

3. **No compatibility aliases.** The fleet is pre-publish and self-contained; the wave cuts clean in
   one gated sweep (grep-zero on the old names is a standing acceptance check, not a shim).

4. **The [scale]/[density] machinery is name-only-touched.** The ADR-0038 lookup-table LAW (literal
   per-`[scale]` re-tabling, no multiplier on the control path, `*`-rule derivation for gap/caret) is
   untouched — only the names inside it change.

## Consequences

- ADR-0141's theme packs address one namespace; a future UT-generated DIMENSIONS pack (UT already
  exports geometry/spacing/motion) would extend the same surface without a second rename.
- ~150 files change mechanically; the gates that pin token names (`dimensions.test.ts`,
  `styling-gates.test.ts`, `family-coherence.test.ts`, the built-CSS fixture) move in the same wave,
  per their own deliberate-change rules.
- The 2026-07-12 naming ruling's supersession is recorded in naming.md itself (§12 exceptions +
  §5 rewrite) — the record never silently contradicts a prior ruling.
- Risk: out-of-repo consumers of the old names (none known; the packages are unpublished) break —
  accepted, stated.
