# ADR-0150 — compact-window body type: the body column drops 1px below `52.5rem` — the token layer's FIRST viewport-responsive lever (the M3-verbatim table stands byte-untouched; the override is a marked extension on the `*` ramp)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-18 *(authored)* |
> | **Proposed by** | Kim's ask (2026-07-18 session): body text should read 1px smaller — refined in-session from "edit the table" to "maybe a breakpoint? `< 992` it goes down 1px". The host turned the mechanism into this contract; the three forks below are laid out for ratification with the host's recommendation marked on each. |
> | **Ratified by** | *(pending — Kim: the in-tree Status edit, or a `ratify ADR-0150` comment/review on GitHub per [ADR-0149](./0149-pr-native-adr-ratification.md). The three forks resolve at ratification — a fork resolved AGAINST a recommendation changes only the named value, never the mechanism.)* |
> | **Repairs** | on ratification+build: `packages/agent-ui/shared/src/tokens/dimensions.css` (the ONE `@media` override block) · `shared/src/tokens/dimensions.test.ts` (the override-block describe) · `components/src/controls/text/text.browser.test.ts` (the viewport leg) · [`../references/dimensional-standard.md`](../references/dimensional-standard.md) (the breakpoint constant + the type-family row's responsive note) · [`../references/geometry.md`](../references/geometry.md) (Display-row note) |
> | **Supersedes / Superseded by** | **Extends [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md)** (cl.2's extension-law list gains a RESPONSIVE leg; the 15 M3-verbatim rows and cl.2b's 12 extension rows stand byte-untouched) · Relates [ADR-0007](./0007-universal-selector-ramp-tokens.md) (the `*`-ramp substitution law — the override obeys it, see cl.1) · [ADR-0038](./0038-control-sizing-size-scale-row-lookup.md) (`--md-sys-scale`'s only-consumer-is-display-type invariant survives unchanged) · [ADR-0025](./0025-ui-text-display-primitive-type-scale.md) (type's density-invariance stands — the new lever is width, never `[density]`) · [ADR-0142](./0142-a2ui-text-heading-compact-scale.md) (proposed — the A2UI compact HEADING fan-out; orthogonal levers on different axes: 0142 re-maps wire headings for ALL widths, this ADR shrinks the body COLUMN below one width — they compose, neither depends on the other) |

## Context

Kim wants body text to render 1px smaller, and proposed a breakpoint (`< 992px`) rather than a
permanent table edit. The breakpoint reframing is load-bearing: a permanent `14px → 13px` in the base
rows would fork [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) cl.2's **M3-verbatim law**
(13px exists nowhere in the M3 type scale — 0078 itself rejected "re-anchor body" for exactly this),
whereas a width-gated override leaves the 15 core rows byte-verifiable against m3.material.io and adds
the compact value as a *marked extension* — the same epistemic status as cl.2b's kicker/overline rows.

What makes this an ADR rather than a token tweak is the **new lever kind**: the token layer today
responds only to subtree attributes (`[scale]` / `[density]` / `[size]`) — a grep (2026-07-18)
confirms **zero width-based media queries anywhere in `packages/`** (only `prefers-*` /
`forced-colors`). This is the fleet's first viewport-responsive token, and the breakpoint value, its
placement (fleet vs app shell), and its scope (column vs one cell) are contract decisions.

On the value: `992` has no provenance in this repo (it is Bootstrap's `lg`). The site's own dialect
is rem-based with `52rem` (832px) its most-used line, and M3's window-size classes put the
compact/medium boundary at **840px = 52.5rem** — the two agree within 8px. cl.2 proposes the
M3-aligned line.

## Decision

### cl.1 — The lever: ONE `@media` block re-declares ONLY the three body `-size` legs, on `*`, after the base ramp

`dimensions.css` gains exactly one override block, placed **after** the `*` ramp it overrides:

```css
/* extension — not MD3 (ADR-0150): the compact-window body register. Below the cl.2 line the body
   COLUMN drops 1px; every other role, every :root constant, and the control ladder are untouched. */
@media (width < 52.5rem) {
  * {
    --md-sys-typescale-body-large-size: calc(15px * var(--md-sys-scale));
    --md-sys-typescale-body-medium-size: calc(13px * var(--md-sys-scale));
    --md-sys-typescale-body-small-size: calc(11px * var(--md-sys-scale));
  }
}
```

- **On `*`, never `:root`** — the ADR-0007 substitution trap applies *inside* a media query too: a
  `:root` override would freeze `--md-sys-scale` at 1 and kill subtree `[scale]` below the line. Each
  element must re-substitute the multiplier it inherits, so the override keeps the ramp's shape.
- **`calc(Npx * var(--md-sys-scale))` is preserved** — `[scale]` composes with the breakpoint
  (a compact window with a `[scale='ui-lg']` subtree gets `13px × 1.125`, exactly as the base ramp
  would). ADR-0038's invariant — display type is `--md-sys-scale`'s only consumer — is untouched.
- **Order is load-bearing.** Both declarations are `*` at specificity 0,0,0 and a media query adds no
  specificity; the override wins the tie ONLY by later declaration. The block must stay below the
  base ramp — the same do-not-reorder law `text.css`'s token block already carries.
- **`-size` legs only.** The `:root` constants (`-weight` / `-line-height` / `-tracking`) stay
  single-sourced: unitless line-height compresses proportionally for free (13px × 1.429 ≈ 18.6px) and
  em tracking rides the size. No second override surface is minted (see Alternatives).

### cl.2 — The line: `width < 52.5rem` (840px) — M3's compact/medium window boundary **[Fork ②]**

The breakpoint is **`52.5rem` = 840px** at the 16px root — the M3 window-size-class boundary between
*compact/medium* and *expanded*-adjacent widths, and within 8px of the site's own dominant `52rem`
line. NOT `992px`: Kim's opening suggestion, but it is Bootstrap's `lg` with no provenance in this
repo, and this ADR surfaces the choice as Fork ② rather than adopting either silently.

A hard constraint, recorded so nobody "fixes" it: **breakpoints cannot be tokenized** — custom
properties are invalid in media-query conditions (`@media (width < var(--x))` does not parse). The
value is a documented literal: it lives here and in
[`dimensional-standard.md`](../references/dimensional-standard.md); any future second use repeats it
verbatim and cites this ADR.

### cl.3 — Scope: the whole body COLUMN moves; everything else stands **[Fork ③]**

- **Moves (below the line):** `body-large 16→15` · `body-medium 14→13` · `body-small 12→11`. The
  column shift keeps the body rhythm intact and one derived surface follows for free: the A2UI
  `caption` wire value maps to `body`/`sm` (ADR-0078 cl.5), so generated captions compact with the
  body they annotate.
- **Stands:** the 15 M3-verbatim rows (base values byte-untouched — the override is additive); the
  other four M3 roles (`display`/`headline`/`title`/`label`) and the four editorial extras; all 27
  `:root` constant triples; the control-band ladder (ADR-0038 — two ledgers: a checkbox label at
  14px control font does NOT shrink, only document typography does); type's density-invariance
  (ADR-0025).
- **Honest wrinkle, recorded not chased:** cl.2b's derivation note "`lead-small` ≡ `body-large`"
  holds only at/above the line (16 vs 15 below). Extension rows derive from M3 *anchors*, and the
  anchors don't move — the equivalence was never a live binding, only a derivation rationale.

### cl.4 — Downstream: every body-role consumer shifts automatically; no consumer edits

The role-pure seam does the propagation: `text.css` repoints `--ui-text-*` at the family, so bare
`<ui-text>` and every `variant='body'` cell follow; verified direct readers follow the same way
(`table.css` body-medium cells, `stat.css` body registers, the A2UI `body`/`caption` fan-outs and
every shipped demo). This is the intended blast radius — "body reads 1px smaller on smaller
windows" *is* fleet-wide by definition under Fork ① — but it is named here so ratification is
informed: below 840px, tables, stats, markdown prose, and generated surfaces all compact together.

### cl.5 — The gates

- **`dimensions.test.ts`** gains an override-block describe: the block exists; it sits AFTER the base
  `*` ramp (position asserted, the order law); it contains exactly the three body `-size` legs and
  nothing else (no constant, no other role); each leg keeps `var(--md-sys-scale)`; the values are
  15/13/11.
- **`text.browser.test.ts`** gains a viewport leg: resize below the line → `body`/`md` computes 13px
  (and a `[scale]` re-multiplication spot-check); at/above the line → the existing 14px pins stand
  (they already pass at the default test viewport and gain an explicit ≥-line comment so the
  dependency is visible, not incidental).

## Open forks for ratification

| # | Fork | Options | Recommendation |
|---|---|---|---|
| ① | Placement | **(a) fleet token layer** (`dimensions.css` — every consumer compacts) · (b) app/site shell override (fleet stays viewport-agnostic; each app opts in) | **(a)** — the ask is a reading-comfort law, not a site skin; (b) re-creates the gallery-local-rule drift ADR-0148 just retired |
| ② | The line | **(a) `52.5rem`/840px** (M3 window boundary, site's 52rem habit) · (b) `992px` (the opening suggestion — Bootstrap `lg`) | **(a)** — provenance over habit; the repo is "an extension of M3" |
| ③ | Scope | **(a) whole body column** 15/13/11 · (b) `body-medium` only 14→13 | **(a)** — keeps the column's rhythm; a lone 13 lands between `title-small` 14 and `body-small` 12 with no partner rows |

## Consequences

- **Realized by** (one small wave): token-builder — the cl.1 block + the `dimensions.test.ts`
  describe → component seat — the `text.browser.test.ts` viewport leg → docs steward — the
  `dimensional-standard.md` breakpoint constant + `geometry.md` Display-row note. Gates:
  `npm run check` + `npm test` + `npm run test:browser` green.
- **Honest negatives.** (a) Viewport is a global signal and components live in panels: a 1440px
  desktop with a 380px side panel keeps 14px body in the cramped panel; a 839px window compacts a
  full-bleed table. The subtree `[scale]` lever remains the panel-context tool — this ADR
  deliberately does NOT try to make the breakpoint container-aware (see Alternatives). (b) The 1px
  step is discrete — visible as a snap when resizing across the line. (c) The breakpoint literal
  cannot be a token (cl.2) — a future second breakpoint must repeat it by hand. (d) A first-of-kind
  lever invites imitation; any future width-responsive token MUST route through its own ADR, not
  copy this block.

## Alternatives considered

- **Permanently edit the base rows (14→13 etc.)** — rejected: forks the M3-verbatim law Kim ratified
  at ADR-0078 (its own rejected "re-anchor" alternative), forfeits spec-greppability for the body
  column, and the desktop rendering wasn't the complaint.
- **A `--md-sys-scale` tier below the line** — rejected: multiplicative and global — it shrinks
  display/headline/title too, and cannot express "−1px".
- **Fluid type (`clamp()`)** — rejected: the token value stops being a greppable literal; the
  exact-table test and the M3 anchor comparison both die.
- **Container queries instead of the viewport** — rejected for v1: the `*` ramp's per-element
  substitution doesn't compose with container contexts without naming containers fleet-wide (every
  ancestor would need `container-type`, a layout-affecting global change). If panel-context type ever
  matters enough, that is its own ADR.
- **A new subtree attribute (`[compact-body]`)** — rejected: invents a third lever *kind* for one
  pixel; the existing `[scale]` lever already covers deliberate subtree sizing, and an attribute
  cannot see the viewport without JS.
- **Tokenize the breakpoint** — impossible, not rejected: custom properties are invalid in
  media-query conditions (cl.2).
- **Also override `-line-height` to preserve M3's 20px rendered line at 13px** — rejected: a second
  override surface for a sub-px concern; unitless compression is the derivation law's intent, and
  ~18.6px at 13px keeps the ratio M3 chose.
- **App-shell placement (Fork ①b)** — viable, recorded as the fallback: the identical media query in
  the consuming app's CSS, zero fleet contract change. Declined by recommendation because the ask is
  fleet-wide reading comfort and per-app copies drift (the ADR-0148 lesson).
