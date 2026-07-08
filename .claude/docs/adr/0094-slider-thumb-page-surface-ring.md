# ADR-0094 — the slider thumb ring: the thumb-vs-page-surface third contrast dimension

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored — re-filed from ADR-0059's `## Amendment` of the same date, per the doc-reviewer's three-way-test ruling; the underlying build shipped 2026-07-07, reviewed GO, and is unchanged by this re-filing)* |
> | **Proposed by** | system-planner (the Kim-filed "the slider thumb blends into its surroundings" fix; record re-classified amendment → extension on the doc-reviewer's ruling) |
> | **Ratified by** | (pending — an independent doc-reviewer pass, then Kim/coordinator; the shipped build itself passed component review 2026-07-07) |
> | **Repairs** | `controls/slider/slider.css` (the `--ui-slider-thumb-ring` token-block declaration, the 2px `::after` border rule, the file-header root-cause note) · `controls/slider/slider.browser.test.ts` (the "thumb ring" describe block: regression guard + negative control + scheme-flip + ring-vs-fill + diameter-unchanged legs, both engines) · `controls/slider/slider.md` (descriptor: the ring property + the two-layer Anatomy — repaired in this change) · `0059-neutral-track-solid-role.md` (the `## Amendment` extraction + the reciprocal back-link, this change) |
> | **Supersedes / Superseded by** | **Extends ADR-0059** — its Decision (the solid `--md-sys-color-neutral-track` pair, both repoints) and every floor it measured stand unchanged and are re-pinned by a regression guard; this record adds a *third* backdrop dimension to its two-backdrop thumb matrix and a genuinely new mechanism (an independent ring paint layer). Reciprocal `Extended by ADR-0094` back-link landed on ADR-0059 in this change. Relates `ADR-0041` (cl.3 — the `box − 4px` thumb law, held) · `ADR-0009` (the fleet focus ring — a separate ring, untouched) |

## Context

ADR-0059 assigned the slider's SC 1.4.11 identification burden to the thumb ("the VALUE is carried by the
thumb") and verified it against **two** backdrops — the fill (4.79:1 light / 3.67:1 dark) and the new solid
rail (4.69:1 / 3.74:1). But the thumb is taller than the 3px rail, so most of its visible perimeter borders
the general **page surface**, not the rail/fill — a third backdrop the original analysis never measured.
(The switch never has this dimension: its track fills the full control height, so no outside-track perimeter
exists — which is why the 2026-07-02 color-verify audit never surfaced it.)

Measured (2026-07-07, the OKLCH→linear-sRGB→WCAG path `tokens.test.ts` uses): the dark-mode thumb
`--md-sys-color-neutral-surface-brightest` (neutral-800 — the same stop as the dark `-surface-highest`
plane) is only **1.09–1.46:1** against the dark surface ladder (neutral-800…950) — a real SC 1.4.11 fail
along the thumb's *dominant* border, and the root cause of the Kim-filed "the slider thumb blends into its
surroundings."

The constraint that forces a new mechanism rather than a repoint: with current tokens, **no single flat
thumb fill can clear both floors** — 3:1 against the dark rail needs thumb luminance ≤ ~0.077, 3:1 against
the dark surface ladder needs ≥ ~0.21; the intervals are disjoint.

## Decision

We leave the interior fill untouched — `--ui-slider-thumb` keeps the fill/rail floors ADR-0059 verified —
and cover the new dimension with a **second, independent paint layer**: the slider-scoped custom property
**`--ui-slider-thumb-ring: var(--md-sys-color-neutral-on-surface)`** (the fleet page-ink role — AA-verified
against every surface plane by `tokens.test.ts`, and scheme-adaptive: dark in light mode, bright in dark
mode), consumed as a **2px `border` on the thumb `::after`** with `box-sizing: border-box`, so the outer
diameter stays the ADR-0041 cl.3 `box − 4px` law — the ring eats into the fill, it never grows the box. The
`[disabled]` leg mutes the ring to `--md-sys-color-neutral-on-surface-variant` (consistent with ADR-0059's
disabled stance: an inactive control is SC 1.4.11-exempt). No token-layer role is minted — the ring reuses
an existing fleet role whose surface-plane contract is already gated.

**The contract going forward.** The slider thumb's SC 1.4.11 matrix is **three-dimensional**: the fill, the
rail, and the page-surface ladder, in both schemes. Any future repoint of `--ui-slider-thumb`,
`--ui-slider-thumb-ring`, `--ui-slider-rail`, or the neutral surface ladder must clear all three; the
browser legs below are the standing gate.

## Consequences

- The thumb reads against the surface it actually borders in both schemes — the filed defect's root cause is
  closed, not patched (the fill was never the wrong value for its *own* backdrops).
- **Cost, honestly:** the thumb is now a **two-layer paint** — neither token can be judged by ADR-0059's
  two-backdrop matrix alone; the three-dimensional contract above is the new review surface.
- **Cost:** the 2px ring consumes interior fill at every size — most visibly at `size=sm` (thumb 10px → a
  6px visible fill disc) — a deliberate trade for a thumb that clears its dominant border.
- ADR-0059's original floors are **re-pinned, not trusted**: a regression guard asserts the fill still
  clears both original backdrops in both schemes, so this extension cannot silently erode the record it
  builds on.
- **Gate:** a headless env evaluates neither scheme-switching nor the composited paint, so the
  `slider.browser.test.ts` "thumb ring" legs (both engines) — regression guard, negative control,
  scheme-flip, ring-vs-fill, diameter-unchanged — are the proof; re-run on any repoint of the four tokens
  above.
- **Stale → re-verify:** `controls/slider/slider.md` (the two-layer Anatomy + the ring property — repaired
  in this change).

## Acceptance

- `adr_check.py` exit 0; index row present; ADR-0059 carries the reciprocal `Extended by ADR-0094`
  back-link and its `## Amendment` section is reduced to a forward pointer here.
- The measured values above (1.09–1.46:1 thumb-vs-dark-surface-ladder; 2.76:1 flat-white-vs-dark-rail; the
  disjoint ≤ ~0.077 / ≥ ~0.21 luminance intervals) reproduce via the `tokens.test.ts`
  OKLCH→linear-sRGB→WCAG path.
- `npm run check` + `npm test` green; the `slider` browser legs (Chromium + WebKit) green, including the
  negative control and the ADR-0059-floor regression guard.
- `slider.md` documents `--ui-slider-thumb-ring` and describes the thumb as the two-layer ring+fill paint.

## Alternatives considered

- **The flat `primary-on-primary` swap (Kim's literal ask, "like the switch")** — rejected on measurement:
  `--md-sys-color-primary-on-primary` is a flat near-white in both schemes; against the dark-mode rail
  (neutral-400 — the very stop ADR-0059 deliberately brightened) it measures **2.76:1**, regressing below
  the 3:1 rail floor ADR-0059 established. Pinned by a **negative-control browser test**
  (`slider.browser.test.ts`, "would FAIL 3:1 against the dark-mode rail"). The general form of the
  rejection is the disjoint-intervals constraint in the Context: no single flat fill clears both floors,
  which is why the fix is a second layer, not a repoint.
- **Record this as an in-place `## Amendment` on ADR-0059** — rejected per the README's three-way lifecycle
  test (and it *was* initially mis-filed that way; re-classified on the doc-reviewer's ruling): a foreseen
  amendment requires the original ADR to have literally booked the branch (the ADR-0008 precedent — the
  original text named its own future amendment and trigger); ADR-0059 booked nothing. And the fix is
  decision-shaped — its own weighed-and-rejected alternative, a genuinely new mechanism (the independent
  ring layer) pre-specified nowhere, and its own new forward contract (the three-dimensional matrix). That
  is the signature of an **Extension**: a new ADR, two-way `Extends`/`Extended by` link, ADR-0059's Decision
  standing untouched.
