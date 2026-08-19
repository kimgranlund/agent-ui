# Fill by Default — migration guide (STUB, grows with the ADR-0223 wave)

> Source: [ADR-0223](../adr/0223-fill-by-default-fleet-sizing-contract.md) (accepted 2026-08-19) —
> the fleet component-sizing contract. Opened at slice 0 (the `ui-text-field` pilot); each wave
> slice (1–3) appends its flipped controls here; finalized at slice 4 before the ONE breaking
> release cut. Status: **slices 0–3 landed** (the sizing gate is now ENFORCING, DEBT table empty) ·
> slice 4 (fleet golden regen + reference-consumer sign-off) pending.

## The one-liner

Every non-exempt `ui-*` control now renders **block-level and fills** its parent's inline space.
**Add `inline` where you relied on hug** — the single boolean opt-out flips both display level
(inline) and sizing posture (hug, with the control's content floor active). There is no `hug`
attribute and no block-but-hugging state: set an explicit `inline-size` for that.

## Flipped so far

| Control | Slice | Before | After | Hug floor (now in `[inline]`) |
|---|---|---|---|---|
| `ui-text-field` | 0 (pilot) | `inline-grid` + 20ch default floor | block `grid`, fills | `--ui-text-field-min-inline-size` (~20ch), unchanged name/default |
| `ui-textarea` | 1 | `block` + 20ch default floor | `block`, fills (no floor) | `--ui-textarea-min-inline-size` (~20ch), unchanged name/default (`[inline]` = inline-block) |
| `ui-select` | 1 | `inline-block` + 10ch default floor | `block`, fills | `--ui-select-min-inline-size` (10ch), unchanged name/default (`[inline]` = inline-block + vertical-align) |
| `ui-combo-box` | 1 | `inline-grid` + 20ch default floor | block `grid`, fills | `--ui-combo-box-min-inline-size` (20ch), unchanged name/default (`[inline]` = inline-grid) |
| `ui-multi-select` | 1 | `inline-block` + 12ch default floor | `block`, fills | `--ui-multi-select-min-inline-size` (12ch), unchanged name/default (`[inline]` = inline-block + vertical-align) |
| `ui-conversation-composer` | 1 | `flex` + 20ch default floor | `flex`, fills (no floor) | `--ui-conversation-composer-min-inline-size` (~20ch), unchanged name/default (`[inline]` = inline-flex) |
| `ui-form-popover` (trigger — the §E ruling) | 1 | trigger `inline-grid` + 10ch default floor | trigger `grid`, fills; R3(a) squareness floor (`min-inline-size: height`) survives all states | `--ui-form-popover-min-inline-size` (10ch content floor), unchanged name/default (`[inline]` on the host = inline-grid trigger) |
| `ui-button` | 2 | `inline-grid` (hug) | block `grid`, fills — **the wave's most visible delta**: a bare button in block flow is now full-width | none (no content floor); R3(a) squareness floor (`min-inline-size: var(--ui-button-height)`) survives BOTH states (`[inline]` = inline-grid) |
| `ui-toggle` | 2 | `inline-grid` (hug) | block `grid`, fills | none (`[inline]` = inline-grid) |
| `ui-checkbox` | 2 | `inline-flex` (hug) | `flex`, fills (box + label pin left; the whole row is the hit target) | none (`[inline]` = inline-flex) |
| `ui-radio` | 2 | `inline-flex` (hug) | `flex`, fills | none (`[inline]` = inline-flex) |
| `ui-switch` | 2 | `inline-flex` (hug) | `flex`, fills | none (`[inline]` = inline-flex) |
| `ui-pagination` | 2 | `inline-flex` (hug) | `flex`, fills (stops pin left; `flex-wrap` unchanged) | none (`[inline]` = inline-flex) |
| `ui-calendar` | 2 | `inline-block` (compact shrink-wrap) | `block`, fills — ADR-0105's fluid tracks distribute the width | none (`[inline]` = inline-block + `vertical-align: top`, the pre-wave compact posture; ADR-0102's `max-inline-size: max-content` one-liner still works) |
| `ui-stat` | 3 | `inline-grid` (hug) | block `grid`, fills | none to relocate — the 8em whole-shape floor is ratified **role (d)** (ADR-0223 cl.3(d)) and SURVIVES both postures unchanged (`[inline]` = inline-grid) |
| `ui-attachment` | 3 | `inline-grid` (hug) + `max-inline-size:100%` | block `grid`, fills (`max-inline-size:100%` dropped — redundant on a block host) | none to relocate — the 12em whole-shape floor is ratified **role (d)** (ADR-0223 cl.3(d)) and SURVIVES both postures unchanged (`[inline]` = inline-grid, restores N-up composition) |

## Slice 3 — the gate flips ENFORCING

The sizing gate (`sizing-gates.test.ts`, ADR-0223 cl.5) DEBT allowlist is now the **empty set**: every
migration-wave row (Appendix §B's 15) has landed. From here, any new inline-posture host or
out-of-role floor is a build defect from day one — the same standing-ratchet shape as
`styling-gates.test.ts`/`naming-gates.test.ts`.

## Pending (lands with its slice — see ADR-0223 clause 7)

- **Slice 4:** fleet golden regen + reference-consumer sign-off; the breaking release ships

## Not changing

The R4 exemptions stay as they are, permanently: floating surfaces (menu/popover/tooltip/modal/
drawer/command-modal/form-popover/toast), text-flow atoms (badge/icon/avatar/swatch/sparkline),
and interaction-geometry leaves (otp-field/segment/split-pane drag floor). Whole-shape display
floors (charts, table, progress, ramp, sliders, timeline, status-stream, stat, attachment) survive the fill state
as ratified role 3(d).
