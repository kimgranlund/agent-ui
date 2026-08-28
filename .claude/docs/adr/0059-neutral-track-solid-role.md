# ADR-0059 — the solid `--md-sys-color-neutral-track` role for state-bearing widget tracks

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-02 *(authored)* |
> | **Proposed by** | tokens-specialist (item 4 of the 2026-07-02 color-verify audit; Kim-directed) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-03, on Kim's confirmation + the green wave gate |
> | **Repairs** | `references/tokens.md` (NEW neutral `-track`/`-track-hover` role, edited in this change) · shared `tokens.css` (the roles) · `controls/switch/switch.css` · `controls/slider/slider.css` (the repoints) |
> | **Supersedes / Superseded by** | **Extended by ADR-0094** (the thumb-vs-page-surface third contrast dimension — the `--ui-slider-thumb-ring` layer; this record's Decision and floors stand). Relates `ADR-0041`/`ADR-0042` (the widget geometry the track lives in) · `ADR-0008` (role-ladder, no `color-mix`) · `ADR-0009` (the focus ring — a separate fleet ring, untouched) · `ADR-0057` (the switch thumb-position co-signifier — orthogonal SC 1.4.1) |

## Context

The 2026-07-02 color-verify audit (item 4) found the switch **off-track** and slider **rail** both bind
`--md-sys-color-neutral-outline-variant` (`neutral-500 @ 40%`) — a translucent *decorative* outline role. Composited
over the surface it measures **1.51:1 light / 1.73:1 dark**, below **SC 1.4.11's 3:1** non-text bar for a
state-bearing control part.

The near-white/near-black thumb does **not** carry identification in the unselected state either: measured,
the OFF/empty-state thumb is **1.22–1.84:1** against both the track and the surface (light `050` thumb on a
light surface; dark `800` thumb on a dark surface). So at value-0 / switch-off, **neither the track nor the
thumb clears 3:1** — the control goes near-invisible. This disproves the "thumb carries identification"
reading for the unselected state. (The CHECKED switch and the slider FILL already clear: primary track
3.94:1 light / 4.68:1 dark, thumb-on-primary 4.79:1 / 3.32:1 — only the *unselected* track fails.)

## Decision

We **mint a dedicated SOLID track-role pair** in the token layer and repoint the switch off-track + slider
rail to it — a state-bearing part gets its own contrast-gated role, not a decorative-outline reuse. In
`tokens.css` (documented in [`references/tokens.md`](../references/tokens.md), edited here):

```css
--md-sys-color-neutral-track:       light-dark(var(--md-sys-color-neutral-600), var(--md-sys-color-neutral-400));  /* idle  */
--md-sys-color-neutral-track-hover: light-dark(var(--md-sys-color-neutral-700), var(--md-sys-color-neutral-300));  /* switch hover */
```

`switch.css` repoints `--ui-switch-track` → `--md-sys-color-neutral-track` and `--ui-switch-track-hover` →
`--md-sys-color-neutral-track-hover`; `slider.css` repoints `--ui-slider-rail` → `--md-sys-color-neutral-track`.

**Verified** (`color-verify/contrast-check.py`, 2026-07-02):

- `--md-sys-color-neutral-track` clears **3:1 on EVERY surface plane in BOTH schemes** — worst cases **3.80:1** (light
  `--md-sys-color-neutral-surface-highest`) and **4.41:1** (dark `-surface-highest`), up to 6.06:1 (dark background).
- `--md-sys-color-neutral-track-hover` is **monotonic + distinct in both schemes** (light `600→700` darkens, dark
  `400→300` lightens — no light-mode collapse) and clears **5.56–7.81:1**.
- The slider **VALUE is carried by the thumb**, which clears 3:1 against **both** the fill (4.79:1 light /
  3.67:1 dark) **and** the new solid rail (4.69:1 / 3.74:1). The fill↔rail *luminance* boundary stays
  intentionally low (primary and a mid-neutral are L-close by ladder design) — acceptable because the thumb,
  not that boundary, is the value indicator (SC 1.4.11 "identify state").

## Consequences

- **Two new additive public roles** — a name is *added*, none renamed and no vocabulary removed, so the
  consumption seam every existing consumer reads is unchanged (the `--md-sys-color-primary-hover`/`-active`/`-selected`
  precedent).
- The switch off-track and slider rail read **visibly more prominent** — a deliberate accessibility trade:
  the off/empty state is now clearly a control, not a ghost.
- **Disabled tracks are untouched** — an inactive component is SC 1.4.11-exempt, so `slider[disabled]` keeps
  the muted `--md-sys-color-neutral-outline-variant` (which now correctly reads as *inactive* vs the solid enabled rail).
- **Forced-colors unaffected** — switch/slider map their track to system colours in-sheet; the new role is
  not read under WHCM.
- **Gate:** a headless env evaluates neither scheme-switching nor the composited paint, so the **switch +
  slider browser legs (both engines)** are the proof the tracks resolve solid and stay distinct; re-run as
  part of this change.
- **ADR-0057 orthogonality:** its conformance table cites the switch **thumb-position** as the SC 1.4.1
  non-color co-signifier — unchanged; this ADR hardens the track's own SC 1.4.11 *contrast*, a different
  criterion.
- **Stale → re-verify:** `references/tokens.md` (edited here) · `switch.css` / `slider.css` (repointed).

## Acceptance

- `adr_check.py` exit 0; index row present.
- The measured floors above reproduce via `color-verify/contrast-check.py`.
- `npm run check` + `npm test` green; the `switch` + `slider` browser legs (Chromium + WebKit) green, with
  the resolved track a solid neutral (getComputedStyle-verified on a rendered control).
- `references/tokens.md` carries the new `-track` role in this change.

## Alternatives considered

- **Accept thumb-carried identification (the audit's option B), no token change** — rejected on measurement:
  the OFF/empty-state thumb is 1.22–1.84:1, so it cannot carry the 3:1 bar; a solid track is *forced*.
- **Repoint `--md-sys-color-neutral-outline-variant` itself to a solid value** — rejected: blast radius. It is a shared
  *decorative* outline role used elsewhere where the 40% translucency is intentional; solidifying it would
  darken every passive outline consumer.
- **Reuse the existing `--md-sys-color-neutral` role for the track** — rejected: it clears, but only at a tight 3.15:1
  on the worst light plane (`-surface-highest`), and it overloads a general-purpose role with a
  track-specific 3:1 contract a future unrelated repoint could silently break. A dedicated role pins the
  contract where it can be reasoned about.
- **A darker idle (e.g. `light-dark(650, 350)`)** — rejected as unnecessarily heavy: `600/400` already
  clears every plane with ≥ 3.80:1 headroom while staying the more restrained off-track a toggle wants.

## Extended by ADR-0094 — the third contrast dimension (thumb vs page surface)

See [ADR-0094](./0094-slider-thumb-page-surface-ring.md), which extends this record's contrast analysis with a third backdrop dimension — the thumb's dominant page-surface border, covered by the independent `--ui-slider-thumb-ring` paint layer; this record's Decision and every floor measured above stand unchanged (and are re-pinned by ADR-0094's regression guard).

## Amendment — `color-verify/contrast-check.py` citation corrected; standing procedure canonized (2026-08-28, ticket #1692)

The Decision above ("**Verified** (`color-verify/contrast-check.py`, 2026-07-02)") and the
Acceptance section ("The measured floors above reproduce via `color-verify/contrast-check.py`")
both cite a script that was never committed to this repository: `git log --all --
'**/contrast-check.py'` returns no history (re-confirmed 2026-08-28, same finding ticket #1690
made independently for ADR-0058). The 2026-07-02 audit's floors were produced by direct
computation at authoring time, not a checked-in tool.

The standing, canonical procedure for reproducing or re-verifying any contrast figure this ADR
cites — now and going forward — is the method ticket #1690 used and ADR-0058's 2026-08-27
amendment documents in full: OKLCH → OKLab → linear sRGB (the published Ottosson matrices) →
relative luminance (`0.2126R + 0.7152G + 0.0722B` on the linear channels) → WCAG contrast ratio
(`(L_light + 0.05) / (L_dark + 0.05)`). No `color-verify/contrast-check.py` script exists or is
planned; every citation of it in this ADR's Decision and Acceptance sections above should be read
as this computation.

As a spot check against the currently shipped ramp (`packages/agent-ui/shared/src/tokens/tokens.css`)
using this method: the idle track's two headline worst-case floors and its best-case figure
reproduce within rounding — `--md-sys-color-neutral-600` vs the light `-surface-highest` plane
(`neutral-200`) measures 3.81:1 (Decision: 3.80), `--md-sys-color-neutral-400` vs the dark
`-surface-highest` plane (`neutral-800`) measures 4.40:1 (Decision: 4.41), and vs the dark
background (`neutral-900`) measures 6.07:1 (Decision: "up to 6.06"). The Decision's core claim —
every plane clears the 3:1 SC 1.4.11 floor in both schemes — stands. This amendment corrects only
the citation; a full re-audit of every figure in this ADR (including the hover-track range) is out
of this ticket's scope and, if wanted, is its own dedicated re-verification ticket in the pattern
of #1690.
