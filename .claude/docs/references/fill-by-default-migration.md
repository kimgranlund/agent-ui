# Fill by Default — migration guide (STUB, grows with the ADR-0223 wave)

> Source: [ADR-0223](../adr/0223-fill-by-default-fleet-sizing-contract.md) (accepted 2026-08-19) —
> the fleet component-sizing contract. Opened at slice 0 (the `ui-text-field` pilot); each wave
> slice (1–3) appends its flipped controls here; finalized at slice 4 before the ONE breaking
> release cut. Status: **slices 0–4 landed** (the sizing gate is ENFORCING, DEBT table empty; the
> fleet golden regen + follow-up fixes are done) · the ONE breaking release cut is **pending Kim's
> sign-off comment on #1422** (the slices only prepare the evidence; the sign-off + release cut are
> the host's, per ADR-0223 cl.7).

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

### §E — the five ambiguous-row rulings, all executed

Four of the five Appendix §E rows already have their disposition on record: `otp-field`/`segment`/
split-pane's drag floor are R4 interaction-geometry exempt (see "Not changing" below, permanent), and
the `ui-form-popover` trigger's ruling landed with slice 1 (its row in the table above). The fifth —
**surface-host `[bare]`** — is closed here:

**The §E surface-host `[bare]` ruling — moot.** Appendix §E cited `surface-host.css:156,181`
(`inline-size: fit-content`) against the `[bare]` row, proposing to keep it as a hug-state precedent
pending a possible `[inline]` naming alignment. Re-examined at slice 4: those two cited lines belong
to the **`[wrap]`** variant (TKT-0084's opt-in content-hugging chat-bubble mount, a block-axis
concern), not `[bare]` — `[bare]` itself has never carried an intrinsic width. [GH #1150](https://github.com/kimgranlund/agent-ui/issues/1150)'s
structural-containment fix (merged the day before this ADR's own authoring pass) left
`:scope[bare] { inline-size: 100%; }` as `[bare]`'s only width rule — a fill posture already, and
`:scope[bare] [data-part='surface']` reinforces the same `inline-size: 100%`. The ambiguity is moot:
no rename, no ruling needed for `[bare]`. `[wrap]`'s `fit-content` stays exactly as TKT-0084 shipped
it — an orthogonal, pre-existing block-axis hug affordance, untouched by this wave and not an R2
`inline`-attribute candidate (surface-host mints no `inline` prop; `[bare]`/`[wrap]` are unrelated
axes to the fill-by-default contract).

## Slice 4 — fleet golden regen + wave close

- **Golden regen:** `npm run test:visual` ran clean across the full fleet (23 files / 54 tests,
  0 drift) — every prior slice minted its own goldens correctly; the wave's one full-fleet pass found
  nothing left to regenerate.
- **stat's checker follow-up:** `stat.visual.browser.test.ts`'s mount now applies a test-only host
  outline + tint (never in component CSS) so `ui-stat`'s fill-vs-hug posture delta is a visible pixel
  truth in its two goldens (`stat-fill-default` / `stat-inline-hug`) — the slice-3 `component-checker`
  finding, closed.
- **The §E surface-host disposition** — see directly above.
- **cl.7 S4 row: done.** The sizing gate (`sizing-gates.test.ts`) verified still ENFORCING with the
  DEBT table empty on the full current fleet, including `ui-service-card` (ADR-0224, minted after
  slice 3) and `ui-table`'s composed checkbox/radio/button children (#1445) — both are ordinary rows
  in the same fs-read scan, no gate change needed.
- **Release cut: pending Kim's sign-off comment on #1422** (ADR-0223 cl.7's own law — no slice ships
  the release before it; `main` carries the wave behind the now-enforcing gate until the train
  departs).

## Not changing

The R4 exemptions stay as they are, permanently: floating surfaces (menu/popover/tooltip/modal/
drawer/command-modal/form-popover/toast), text-flow atoms (badge/icon/avatar/swatch/sparkline),
and interaction-geometry leaves (otp-field/segment/split-pane drag floor). Whole-shape display
floors (charts, table, progress, ramp, sliders, timeline, status-stream, stat, attachment) survive the fill state
as ratified role 3(d).
