# ADR-0059 — the solid `--c-neutral-track` role for state-bearing widget tracks

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-03 — the solid-track decision confirmed by Kim ("proceed"); the thumb-carried alternative was DISPROVEN by measurement [OFF-state thumb 1.22–1.84:1] before minting --c-neutral-track(-hover); checker-verified ≥3:1 on every plane both schemes [worst 3.80/4.41]; the opaque-paint browser probes pin the repoint in both engines; gates check · jsdom 2079 · browser 558/558.)* |
> | **Date** | 2026-07-02 |
> | **Proposed by** | tokens-specialist (item 4 of the 2026-07-02 color-verify audit; Kim-directed) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-03, on Kim's confirmation + the green wave gate |
> | **Repairs** | `references/tokens.md` (NEW neutral `-track`/`-track-hover` role, edited in this change) · shared `tokens.css` (the roles) · `controls/switch/switch.css` · `controls/slider/slider.css` (the repoints) |
> | **Supersedes / Superseded by** | None. Relates `ADR-0041`/`ADR-0042` (the widget geometry the track lives in) · `ADR-0008` (role-ladder, no `color-mix`) · `ADR-0009` (the focus ring — a separate fleet ring, untouched) · `ADR-0057` (the switch thumb-position co-signifier — orthogonal SC 1.4.1) |

## Context

The 2026-07-02 color-verify audit (item 4) found the switch **off-track** and slider **rail** both bind
`--c-neutral-outline-variant` (`neutral-500 @ 40%`) — a translucent *decorative* outline role. Composited
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
--c-neutral-track:       light-dark(var(--c-neutral-600), var(--c-neutral-400));  /* idle  */
--c-neutral-track-hover: light-dark(var(--c-neutral-700), var(--c-neutral-300));  /* switch hover */
```

`switch.css` repoints `--ui-switch-track` → `--c-neutral-track` and `--ui-switch-track-hover` →
`--c-neutral-track-hover`; `slider.css` repoints `--ui-slider-rail` → `--c-neutral-track`.

**Verified** (`color-verify/contrast-check.py`, 2026-07-02):

- `--c-neutral-track` clears **3:1 on EVERY surface plane in BOTH schemes** — worst cases **3.80:1** (light
  `--c-neutral-surface-highest`) and **4.41:1** (dark `-surface-highest`), up to 6.06:1 (dark background).
- `--c-neutral-track-hover` is **monotonic + distinct in both schemes** (light `600→700` darkens, dark
  `400→300` lightens — no light-mode collapse) and clears **5.56–7.81:1**.
- The slider **VALUE is carried by the thumb**, which clears 3:1 against **both** the fill (4.79:1 light /
  3.67:1 dark) **and** the new solid rail (4.69:1 / 3.74:1). The fill↔rail *luminance* boundary stays
  intentionally low (primary and a mid-neutral are L-close by ladder design) — acceptable because the thumb,
  not that boundary, is the value indicator (SC 1.4.11 "identify state").

## Consequences

- **Two new additive public roles** — a name is *added*, none renamed and no vocabulary removed, so the
  consumption seam every existing consumer reads is unchanged (the `--c-primary-hover`/`-active`/`-selected`
  precedent).
- The switch off-track and slider rail read **visibly more prominent** — a deliberate accessibility trade:
  the off/empty state is now clearly a control, not a ghost.
- **Disabled tracks are untouched** — an inactive component is SC 1.4.11-exempt, so `slider[disabled]` keeps
  the muted `--c-neutral-outline-variant` (which now correctly reads as *inactive* vs the solid enabled rail).
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
- **Repoint `--c-neutral-outline-variant` itself to a solid value** — rejected: blast radius. It is a shared
  *decorative* outline role used elsewhere where the 40% translucency is intentional; solidifying it would
  darken every passive outline consumer.
- **Reuse the existing `--c-neutral` role for the track** — rejected: it clears, but only at a tight 3.15:1
  on the worst light plane (`-surface-highest`), and it overloads a general-purpose role with a
  track-specific 3:1 contract a future unrelated repoint could silently break. A dedicated role pins the
  contract where it can be reasoned about.
- **A darker idle (e.g. `light-dark(650, 350)`)** — rejected as unnecessarily heavy: `600/400` already
  clears every plane with ≥ 3.80:1 headroom while staying the more restrained off-track a toggle wants.
