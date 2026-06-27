# ADR-0012 — Button anatomy: position slots × `data-role` roles (the family adornment standard)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead; caret=font (--ui-button-glyph) law-true; data-role vocab icon/caret active + tag/badge reserved; disclosure AX deferred to G7 on the host via internals)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, making the host-refined two-axis anatomy the canonical family standard and closing the one gap the shipped refactor left |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | `goals §G5` (button anatomy: leading-icon-only → position×role adornments) · `controls/button/button.css` (role-driven adornment sizing — the open gap) · `controls/button/button.md` (the slots/roles descriptor — already migrated under `12fdf49`) · `site/pages/button-doc.ts` (anatomy specimens) · `authoring-components` (the family adornment standard) |
> | **Supersedes / Superseded by** | **Extends ADR-0006** (anatomy: optional leading icon slot → position slots × role axis; ADR-0006's host-as-grid/`:has()` mechanism + the law-true `[density]` acceptance remain in force). Relates: `references/geometry.md` (the affordance taxonomy the caret role applies). |

## Context

The host directive (with a reference image) refines the button anatomy into **two orthogonal axes** and makes
it the **family** standard — positional slots + an open-ended content-role axis any future control reuses,
not a button-only feature. This was being built in parallel as the design was written; the current `main`
(HEAD `12fdf49`, "refactor(button): name slots by POSITION … content role via data-role") already implements
most of it — so this ADR **records the shipped two-axis model and pins the one decision it left open** (the
sizing axis). The build arrived ahead of the owning ADR (the discovered-reality up-loop); the prior framing
in earlier drafts (a single `slot="trailing"`, an `icon`→`leading` rename "to do") is superseded by what
shipped.

The relevant commit history on `main`, in order:

- `8eb72e7` — added the trailing slot with the **old** naming (`slot="icon"` leading + `slot="trailing"`, no
  role axis).
- `12fdf49` (**current HEAD**) — the refactor: **renamed slots by position** (`leading` / `label` / `trailing`),
  introduced the **`data-role` content-role convention** (`icon`/`caret` now; `tag`/`badge` reserved), and
  migrated `button.css` selectors + comment, `button.md`, the css + geometry jsdom tests, the geometry browser
  smoke, **and** `site/pages/permutations.ts` (now `slot="leading" data-role="icon"` / `slot="trailing"
  data-role="caret"`). Its commit message records the one deliberate omission: *"the internal
  `--ui-button-icon` token (the adornment cell SIZE) left as-is."*

So **placement is already position-driven and the `data-role` convention is already documented** — but the
**sizing is still slot-driven**: `button.css` sizes both adornments with `:scope > [slot='leading'],
[slot='trailing'] { inline-size: var(--ui-button-icon) }`, and there is **no `[data-role]` rule**. The
consequence is that a trailing **caret is icon-sized**, which `references/geometry.md` (the law) names the
"bug class": a caret/chevron/arrow is an **inline affordance** sized `= font`; at icon size it renders
≈1.2–1.5× the text (oversized). `button-doc.ts` (the doc specimens) was not touched and shows no anatomy.

## Decision

We ratify the **two-axis anatomy as the canonical family adornment standard** and pin the sizing axis:

1. **SLOTS = position** (named light-DOM regions; presence drives the grid columns):
   `leading` · `label` · `trailing`. **`label` is also the default unnamed region** — `<ui-button>Text</ui-button>`
   and `<ui-button><span slot="label">Text</span></ui-button>` both land in the label column. The grid keys
   off `[slot="leading"]` / `[slot="trailing"]` presence (the four structures: `[label]` · `[leading│label]` ·
   `[label│trailing]` · `[leading│label│trailing]`); everything else (default or `slot="label"`) is the label
   column, placed by DOM order.
2. **ROLES = kind of adornment** in a leading/trailing slot, carried on the slotted element via **`data-role`**
   (deliberately **not** the ARIA `role` attribute — keeps the taxonomy off the accessibility channel):
   `icon` · `caret` now; **`tag` · `badge` reserved**. Adding a reserved role later is **purely additive** — a
   new `[data-role]` rule, no new slot, no new column logic. This open-ended role axis is the point.
3. **`button.css` is position-for-placement, role-for-sizing.** Grid columns + which edge carries an adornment
   stay **position-driven** (`:has(> [slot=…])`, edge-pad `½(h−icon)`). The adornment **glyph size** becomes
   **role-driven** (`[data-role]`), replacing the slot-driven sizing:
   - `[data-role="icon"]` → fills the icon cell (`= --ui-button-icon`).
   - `[data-role="caret"]` → sized `= font` via a new `--ui-button-glyph: var(--ui-button-font)` (geometry.md's
     inline-affordance law), **centered in the icon-sized cell** so it lands at the **emergent `½(h−font)`**
     trailing edge ("further from the edge, never authored" — the law). Plus the chevron treatment (e.g.
     rotation) the role wants.
   - `tag` / `badge` → reserved (no rule yet; additive later).
4. **Decorative; disclosure AX rides the host — deferred to G7.** Adornments are `aria-hidden`, layout-only;
   the label stays the accessible name. **Popup/disclosure semantics** (`aria-haspopup`/`aria-expanded`) belong
   on the **host via `ElementInternals`** and are **out of scope** here (presentation-only) — wired when a real
   disclosure/menu control exists (G7), so a plain button never lies to assistive tech.
5. **Family standard.** This `position × role` convention — positional slots for layout, a `data-role` axis for
   content kind, reserved roles for additive growth — is the **fleet** adornment model; future controls
   (`ui-select`'s caret, a field's leading icon, a chip's badge) reuse it, recorded in `authoring-components`.

## Consequences

- **The caret renders at text scale.** Moving sizing to `[data-role]` closes the geometry-law gap `12fdf49`
  left open; the wave-2 cross-engine smoke gains `0 < caret(=font) < icon ≤ box` **and** that the caret sits
  *further* from the edge than an icon would (the emergent `½(h−font)`). The existing cell/structure assertions
  still hold (the cell stays icon-sized for placement).
- **Reserved roles are additive.** `tag`/`badge` land later as one `[data-role]` rule each — no slot, column,
  or descriptor surface change. This is the refinement's payoff.
- **Most of the migration is already shipped.** `12fdf49` did the position rename, the `data-role` convention,
  `button.md`, the tests, and the `permutations.ts` markup. The remaining build is small: the role-driven
  sizing in `button.css` (+ `--ui-button-glyph`), the `button-doc.ts` specimens, a caret-sizing line in
  `button.md`, and swapping the stale "ADR-0006 extended" citation to ADR-0012.
- **`button.css` is single-writer.** The role-sizing delta and the interaction-states deltas (ADR-0008/0009)
  both edit `button.css`, so one slice owns both (see the decomposition) — no collision.
- **No popup AX debt** by recording the disclosure boundary explicitly.

## Open questions (need host ratification)

1. **Caret sizing — law-true `font` vs shipped `icon` (the key call).** `12fdf49` deliberately left the
   adornment size at `--ui-button-icon` for both roles, and the geometry test asserts the icon-sized cell.
   Recommendation: **caret = font** (`--ui-button-glyph`), per `geometry.md`. This adds a `[data-role="caret"]`
   rule + a glyph-level smoke assertion; the cell-size assertion is unchanged. Confirm before `css-button`
   lands the delta.
2. **Reserved-role list.** Pin `icon` · `caret` active; `tag` · `badge` reserved. Confirm that set (and the
   `data-role` attribute name) is the canonical role vocabulary, so later additions are purely additive.

## Alternatives considered

- **Keep sizing slot-driven** (one `--ui-button-icon` size for every adornment, as `12fdf49` shipped) —
  rejected: it contradicts `geometry.md` (an inline affordance at icon size is the named oversize bug) and
  defeats the role axis, whose purpose is that a role carries its own treatment (a caret's font size).
- **A `caret` boolean prop or a dedicated `slot="caret"`** — rejected: re-couples content to position and
  forecloses other trailing roles (tag/badge). The slot names a position; the node names the role.
- **Use the ARIA `role` attribute for the content kind** instead of `data-role` — rejected: it would put a
  decorative styling taxonomy on the accessibility channel; `data-role` keeps it off ARIA, the adornment stays
  `aria-hidden`, and the label remains the accessible name.
- **Wire `aria-haspopup`/`aria-expanded` now** — rejected: presentation-only is the directive; disclosure AX
  is G7's, on the host via internals — a caret with no popup must not announce one.
