# ADR-0021 — `ui-text-field` intrinsic width: the entry-control `min-inline-size` floor (native `<input size>` parity), the chars-width prop rejected

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the `exec-browser-wave` (s11 smoke / s14 review) escalation |
> | **Ratified by** | orchestration-lead (on gate) |
> | **Repairs** | `references/geometry.md` (the frame-law `min-inline-size` class-split) · **controls/text-field/\*** (the host floor token + `text-field.md` + the browser-smoke leg) |
> | **Supersedes / Superseded by** | Relates **ADR-0014** (the `ui-text-field` control whose geometry this completes) · sibling of the **#71 radius class-split** (ADR-0015 amendment) — the second frame quantity that splits by control class |

## Context

The `exec-browser-wave` cross-engine smoke (`s11`) found a real-engine defect the jsdom probes could not:
`ui-text-field` is an `inline-grid` with a **`1fr` editor cell**, so a **bare, unsized, empty** field has no
content to size the grid and **collapses to just its padding + border chrome** (~30px for md — a ~0-width typing
target) — a real-engine pointer has almost nothing to hit. Native `<input>`
never does this: it carries a default preferred width via **`size`** (≈ 20 characters).

The fleet already has the remedy in its law and applies it elsewhere. `geometry.md`'s frame family lists
**`min-inline-size`** as a frame quantity, and `button.css` **honours** it — `min-inline-size:
var(--ui-button-height)`, the icon-only square tap-target floor. `ui-text-field` **shipped without a host floor**:
its only `min-inline-size: 0` is on the **inner editor cell** (deliberate — so long text scrolls within the field
instead of widening it). With no host minimum, an empty unsized field has nothing to hold it open.

Two shapes were on the table (the `s14` reviewer flag): a default host **`min-inline-size`**, or a **chars-width
prop** (native input's `size`). The prop carries a hard **name collision** — `ui-text-field`'s `size` is already
the **height-class enum** (`sm` / `md` / `lg`, reflected, driving the `[size]` dimensional ramp), *not* native
`size`-in-characters.

## Decision

We add a **host `min-inline-size` floor** to `ui-text-field`, calibrated as a **typing-width floor** (native
`<input size>` parity) via the component token **`--ui-text-field-min-inline-size`** (default **~`20ch`**). It is
the **entry-control leg of the frame-law `min-inline-size`** — the sibling of button's **action-control** square
floor (`= height`), and a parallel of the #71 corner-radius class-split. A bare field now reads as a usable,
hittable text field; **width above the floor stays the layout's / author's job** (a flex/grid track or an explicit
`inline-size` grows it; the token is the per-field / theme override). We **reject a chars-width prop**. The owning
law — `geometry.md` *“Frame quantities that split by control class”* — gains the `min-inline-size` split.

## Consequences

- **The bare control is honest.** An unsized `ui-text-field` no longer collapses; the `s11` browser smoke gains a
  reviewer-confirmable leg asserting a bare field's `offsetWidth ≥ the computed floor` (non-vacuous — it was ~0).
- **The “width is the layout's job” stance is preserved, not reversed.** The floor only prevents the degenerate
  0px collapse; it imposes **no** opinionated fixed width. Layout still owns width above the floor, and the token
  overrides it. The G7 `ui-field` wrapper still sizes fields in real layouts — the floor just makes the bare
  control hittable in isolation. The height geometry law (the vertical lever, the centring law) is unchanged and
  width-independent, as the smoke already proved.
- **No new prop, no `size` collision, no new shared token.** `--ui-text-field-min-inline-size` is a component-local
  token (like `--ui-text-field-height`); the host floor and the editor cell's `min-inline-size: 0` are
  **complementary** (the host holds the box open; the editor scrolls long text within it).
- **Negative (accepted):** a hard *floor* (unlike native's shrinkable `size=` basis) means the field will not
  shrink below ~`20ch` in a very tight flex row, so it can overflow there. Accepted because a tight row is exactly
  where an author sizes fields anyway, the token is overridable, and a slight overflow is better than the 0px
  sliver the floor removes. A shrinkable preferred-`inline-size` basis (the heavier alternative) is left on the
  shelf behind a future ADR if tight-row shrinkability is ever required.
- **Stale → re-verify:** `geometry.md` gains the `min-inline-size` class-split; `text-field.css` / `text-field.md`
  and the geometry browser smoke regenerate. Net-new otherwise (nothing else reads the field width).

## Build brief — for execution-lead (no re-decision)

No new shared token; **no `tokens-specialist`**. One control folder, role-purity preserved.

1. **`controls/text-field/text-field.css`** —
   - In the **`:where(ui-text-field)` TOKEN block** (the base block, **once** — `ch` is font-relative so a single
     `~20ch` already scales with `--ui-text-field-font` across `[size]`), declare:
     `--ui-text-field-min-inline-size: 20ch;`
   - In the **`@scope (ui-text-field)` `:scope` rule**, consume the **component token** (role-purity — `@scope`
     reads only `--ui-text-field-*`): `min-inline-size: var(--ui-text-field-min-inline-size);`
   - **Leave the editor cell's `min-inline-size: 0`** (the `:scope > [part=editor]`/`1fr` cell, currently
     line ~126) — it is complementary (long text scrolls within the field, the host floor holds the box open).
   - Comment: the host typing-width floor (the entry-control frame-law leg, ADR-0021) so a bare field is hittable;
     width above the floor is the layout's job.
2. **`controls/text-field/text-field.md`** — in the `geometry:` frontmatter, add:
   `minInlineSize: var(--ui-text-field-min-inline-size) (~20ch — the entry-control typing-width floor, native <input size> parity; ADR-0021)`, and a one-line prose note (a bare field carries a default minimum width; layout owns width above it). The `size` *attribute* descriptor is the **height enum** — do **not** add a chars `size`.
3. **`controls/text-field/text-field-geometry.browser.test.ts`** — add the reviewer-confirmable leg: a **BARE**
   `<ui-text-field>` (no `[size]`, empty) has `offsetWidth` ≥ the resolved `--ui-text-field-min-inline-size`
   (and the negative control: it is **not** ~0). This is the cross-engine proof the collapse is fixed.

Gate: `npm run check && npm test && npm run test:browser`. The existing geometry probes (inline-**padding** `h/2` /
`½(h−icon)`) are unaffected — padding is untouched.

## Alternatives considered

- **A chars-width prop** (native `size`) — rejected: (a) `size` is taken (the height-class enum), forcing an
  awkward second name (`cols` / `width` / `chars`); (b) a chars width is already expressible in CSS
  (`inline-size: 20ch`, or the token) with **no** reflected prop; (c) a width *prop* re-litigates “width is the
  layout's job” — a quiet `min` floor fixes the degenerate case without claiming width as a control opinion. The
  token gives the same per-field control declaratively, without the collision.
- **A default preferred `inline-size` basis** (~`20ch`, shrinkable — closest to native `size=`) instead of a floor
  — rejected as the *primary*: heavier (a basis layout must override to fill), and the floor is the minimal fix for
  the flagged defect while matching button's existing frame-law `min-inline-size` treatment. Left on the shelf for
  a future ADR if tight-row shrinkability is needed.
- **Do nothing** (width is purely the layout's job; rely on the G7 `ui-field` wrapper) — rejected: a bare
  `ui-text-field` collapsing to an unhittable 0px sliver is a real footgun the browser wave caught; the most basic
  usage must be honest. The floor costs one token and preserves the layout-owns-width stance everywhere above it.
- **A square floor `= height`** (button's exact action-control value) for the field too — rejected: a ~40px square
  is hittable but reads as a *square*, not a text field. An entry control's sensible minimum is a **typing width**
  (measured in characters) — which is precisely why the frame quantity splits by class.
