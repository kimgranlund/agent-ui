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
> | **Supersedes / Superseded by** | **Extends ADR-0006** (anatomy: optional leading icon slot → position slots × role axis; ADR-0006's host-as-grid/`:has()` mechanism + the law-true `[density]` acceptance remain in force). **Sizing authority: `references/geometry-sizing-spec.md` (v4)** — §1.4 (frame/rhythm), §4.1/§4.6 (`caret = font`, `--ui-glyph-ratio: 1`), §1.5 (slot-presence padding), §3/§7.1 (no size-ramp migration), §6 (`BTN-CARET` probe). Relates: `references/geometry.md` (the distilled law). |

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
consequence is that a trailing **caret is icon-sized** — and the authoritative sizing law,
`references/geometry-sizing-spec.md` (v4, §4.6), names this *exactly*: an inline affordance sized to `--ui-ind`
is **"the bug class"** — "Kim caught the button caret" — rendering ≈1.2–1.5× the text. The law is that a
caret/chevron/arrow is an **inline affordance** sized `= font` (§4.1, `--ui-glyph-ratio: 1`), and it is
**LANDED + probe-locked** (§5/§6: the `BTN-CARET` probe — "the probe that would have caught the oversized
caret"). So `caret = font` is not a judgment call; the shipped icon-sized caret is a regression against a
ratified law. `button-doc.ts` (the doc specimens) was not touched and shows no anatomy.

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
3. **`button.css` is position-for-placement, role-for-sizing** (per `geometry-sizing-spec.md` §1.4 — the
   frame/rhythm split: the slot/cell/pad are **frame ∝ height**, the caret is **rhythm ∝ font**). Grid columns +
   which edge carries an adornment stay **position-driven** (`:has(> [slot=…])`, slot edge-pad `½(h−icon)`,
   slotless edge `h/2`, §1.5). The adornment **glyph size** becomes **role-driven** (`[data-role]`), replacing
   the slot-driven sizing:
   - `[data-role="icon"]` (content icon, **frame**) → `= --ui-button-icon` (the icon ramp `--ui-ind`, §4.2),
     filling the icon-sized cell.
   - `[data-role="caret"]` (inline affordance, **rhythm**) → `= font` via a new
     `--ui-button-glyph: var(--ui-button-font)` (`--ui-glyph-ratio: 1`, §4.1/§4.6). Since `font < icon` at every
     ramp row, the smaller caret **centers in the icon-sized slot** and lands at the **emergent `½(h−font)`**
     trailing edge — the asymmetric trailing edge "never authored" (§1.4/§2). The one implementation mechanic:
     the adornment **cell stays icon-sized** so the font caret centers within it (rather than the column
     collapsing to font-width and landing too close); the `BTN-CARET` probe (§6) locks `caret = font` + the
     `½(h−font)` edge.
   - `tag` / `badge` → reserved (no rule yet; additive later, each its own `[data-role]` sizing).
4. **Decorative; disclosure AX rides the host — deferred to G7.** Adornments are `aria-hidden`, layout-only;
   the label stays the accessible name. **Popup/disclosure semantics** (`aria-haspopup`/`aria-expanded`) belong
   on the **host via `ElementInternals`** and are **out of scope** here (presentation-only) — wired when a real
   disclosure/menu control exists (G7), so a plain button never lies to assistive tech.
5. **Family standard.** This `position × role` convention — positional slots for layout, a `data-role` axis for
   content kind, reserved roles for additive growth — is the **fleet** adornment model; future controls
   (`ui-select`'s caret, a field's leading icon, a chip's badge) reuse it, recorded in `authoring-components`.

## Consequences

- **The caret renders at text scale.** Moving sizing to `[data-role]` closes the geometry-law gap `12fdf49`
  left open; the **`BTN-CARET`** probe (`geometry-sizing-spec.md` §6 — "the probe that would have caught the
  oversized caret") + the wave-2 cross-engine smoke assert `caret = font`, `0 < caret(=font) < icon ≤ box`, and
  the caret *further* from the edge than an icon would be (the emergent `½(h−font)`). The existing cell/structure
  assertions still hold (the cell stays icon-sized for placement).
- **No size-ramp conflict (the reconciliation the host asked to surface).** Per `geometry-sizing-spec.md`
  §3/§7.1 there is **no size-ramp migration**: the shipped `scale × size(sm/md/lg)` model *maps onto* the v4
  XS→2XL law. Verified token-for-token — `dimensions.css`'s `--ui-height-{sm,md,lg}` = **24·28·36**,
  `--ui-font` = **13·14·16**, `--ui-gap` = **font/2 × density**, and the button's inlined icon = **16·18·20**
  are **exactly the spec's SM·MD·LG rows**. So `sm/md/lg` is a faithful 3-row sample of the 6-row law, not a
  rival ramp. The one open plumbing nuance: the spec names a *shared* `--ui-ind` icon ramp + a `--ui-glyph-ratio`
  token, but the repo **inlines** them per-control (`--ui-button-icon`; this adds `--ui-button-glyph = font`).
  Hoisting `--ui-ind`/`--ui-glyph-ratio` into `@agent-ui/shared` is a future dimensional consolidation (when a
  second control needs the icon ramp), **not** this pass — recorded so it is not re-derived.
- **Reserved roles are additive.** `tag`/`badge` land later as one `[data-role]` rule each — no slot, column,
  or descriptor surface change. This is the refinement's payoff.
- **Most of the migration is already shipped; `permutations.ts` is DONE.** `12fdf49` committed the position
  rename, the `data-role` convention, `button.md`, the tests, **and the `permutations.ts` markup** (it now
  emits `slot="leading" data-role="icon"` / `slot="trailing" data-role="caret"` across the four-structure
  axis). So the **remaining anatomy build is exactly two things**: **(a)** the caret-sizing fix in `button.css`
  (`--ui-button-glyph: var(--ui-button-font)` + a `[data-role="caret"]` font rule; the cell stays icon-sized),
  and **(b)** the `button-doc.ts` anatomy specimens (button-doc still has none). Trailing residue only: a
  caret-sizing line in `button.md` + swapping the stale "ADR-0006 extended" citation to ADR-0012 (and an
  optional one-line `makeCaret` comment touch in the already-migrated `permutations.ts`).
- **`button.css` is single-writer.** The role-sizing delta and the interaction-states deltas (ADR-0008/0009)
  both edit `button.css`, so one slice owns both (see the decomposition) — no collision.
- **No popup AX debt** by recording the disclosure boundary explicitly.

## Resolved on ratification (2026-06-27)

1. **Caret sizing — `caret = font` (law-true).** RESOLVED: ratified, and grounded in `geometry-sizing-spec.md`
   §4.1/§4.6 (`--ui-glyph-ratio: 1`) + the `BTN-CARET` probe (§6) — the shipped icon-sized caret is the spec's
   named "bug class," so this is a regression fix against a LANDED law, not a judgment call. The `css-button`
   slice adds the `[data-role="caret"]` font rule + the glyph-level assertion; the icon-cell assertion is
   unchanged.
2. **Role vocabulary — RESOLVED:** `icon` · `caret` active; `tag` · `badge` reserved; the attribute is
   `data-role`. Later additions are purely additive (one `[data-role]` rule each).
3. **Trailing content icon — RESOLVED (YES).** A trailing `slot="trailing" data-role="icon"` content icon
   (icon-sized, `= --ui-button-icon`, filling the cell) is a **supported role**, distinct from the caret
   affordance — the natural reading of position ⟂ role, and it needs **no extra CSS** (the `[data-role="icon"]`
   sizing rule already covers it at either edge).

**Remaining note (not a blocker):** the shared `--ui-ind` icon ramp + `--ui-glyph-ratio` the spec names are
inlined per-control today (`--ui-button-icon`; this adds `--ui-button-glyph`). Hoisting them into
`@agent-ui/shared` is a future dimensional consolidation, surfaced to orchestration-lead, not part of this pass.

## Alternatives considered

- **Keep sizing slot-driven** (one `--ui-button-icon` size for every adornment, as `12fdf49` shipped) —
  rejected: it contradicts `geometry-sizing-spec.md` §4.6 (an inline affordance at icon size is the named
  oversize bug class, probe `BTN-CARET`) and
  defeats the role axis, whose purpose is that a role carries its own treatment (a caret's font size).
- **A `caret` boolean prop or a dedicated `slot="caret"`** — rejected: re-couples content to position and
  forecloses other trailing roles (tag/badge). The slot names a position; the node names the role.
- **Use the ARIA `role` attribute for the content kind** instead of `data-role` — rejected: it would put a
  decorative styling taxonomy on the accessibility channel; `data-role` keeps it off ARIA, the adornment stays
  `aria-hidden`, and the label remains the accessible name.
- **Wire `aria-haspopup`/`aria-expanded` now** — rejected: presentation-only is the directive; disclosure AX
  is G7's, on the host via internals — a caret with no popup must not announce one.
