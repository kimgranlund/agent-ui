# Fill by Default — migration guide (STUB, grows with the ADR-0223 wave)

> Source: [ADR-0223](../adr/0223-fill-by-default-fleet-sizing-contract.md) (accepted 2026-08-19) —
> the fleet component-sizing contract. Opened at slice 0 (the `ui-text-field` pilot); each wave
> slice (1–3) appends its flipped controls here; finalized at slice 4 before the ONE breaking
> release cut. Status: **slice 0 landed** · slices 1–4 pending.

## The one-liner

Every non-exempt `ui-*` control now renders **block-level and fills** its parent's inline space.
**Add `inline` where you relied on hug** — the single boolean opt-out flips both display level
(inline) and sizing posture (hug, with the control's content floor active). There is no `hug`
attribute and no block-but-hugging state: set an explicit `inline-size` for that.

## Flipped so far

| Control | Slice | Before | After | Hug floor (now in `[inline]`) |
|---|---|---|---|---|
| `ui-text-field` | 0 (pilot) | `inline-grid` + 20ch default floor | block `grid`, fills | `--ui-text-field-min-inline-size` (~20ch), unchanged name/default |

## Pending (lands with its slice — see ADR-0223 clause 7)

- **Slice 1:** `ui-textarea` · `ui-select` · `ui-combo-box` · `ui-multi-select` ·
  `conversation-composer` (+ the form-popover trigger ruling)
- **Slice 2:** `ui-button` · `ui-toggle` · `ui-checkbox` · `ui-radio` · `ui-switch` ·
  `ui-pagination` · `ui-calendar` — buttons full-width in block flow is the wave's most visible delta
- **Slice 3:** `ui-stat` · `ui-attachment`; the sizing gate flips ENFORCING
- **Slice 4:** fleet golden regen + reference-consumer sign-off; the breaking release ships

## Not changing

The R4 exemptions stay as they are, permanently: floating surfaces (menu/popover/tooltip/modal/
drawer/command-modal/form-popover/toast), text-flow atoms (badge/icon/avatar/swatch/sparkline),
and interaction-geometry leaves (otp-field/segment/split-pane drag floor). Whole-shape display
floors (charts, table, progress, ramp, sliders, timeline, status-stream) survive the fill state
as ratified role 3(d).
