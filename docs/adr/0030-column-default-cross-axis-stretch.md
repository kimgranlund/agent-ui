# ADR-0030 — ui-column default cross-axis align: `start` → `stretch` (children fill width); the vertical-stack family asymmetry

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the #22 user-ratified column-default change |
> | **Ratified by** | orchestration-lead (on the build gate) |
> | **Repairs** | `goals §G9` (the layout-family cross-axis default — vertical stacks fill, row does not) · **shipped-default change**: `components/controls/column/{column.ts,column.css,column.md}` (`align` default `start`→`stretch`, CSS base token + descriptor kept consistent) · `components/controls/list/{list.ts,list.css,list.md}` (the same flip — **ratified**, user 2026-06-30) · `components/dom/container.ts` (the shared `flexProps.align` default **stays** `start`; column/list override only the `default`) · **relates ADR-0015** (surface/space) · **relates ADR-0005** (lazy-upgrade: a default is **not** reflected as an attribute, so the CSS base token must carry it) |
> | **Supersedes / Superseded by** | **Extends ADR-0016** — a *separate, new* decision (the per-consumer default + the direction-appropriate cross-axis asymmetry) that builds on the `flexProps` grammar **without reversing it**: ADR-0016's grammar (the prop set, the 1:1 CSS keyword mapping, the container-query switcher) **stands** unchanged; only column's (and list's) `align` *default* differs. Not an amendment (ADR-0016 did **not** anticipate per-consumer default divergence, so there is no foreseen branch to append) and not a supersession (nothing is reversed) — an **Extension** per the ADR-log classification table. |

## Context

A `ui-card` (or any parent-sized child) placed in a `ui-column` **shrink-wraps to its content width** instead of filling the column. The card is correctly *parent-sized* by design (`display:grid`, `min-inline-size:0`, no `width` — it is meant to be sized by its parent), so the fix does **not** belong on the card (no `width:100%`). It belongs at the column: `ui-column` defaults `align-items: flex-start` (column.css base token `--ui-column-align: flex-start`, from the shared `flexProps.align` default `start` — container.ts:50), which on the **cross axis (inline / width)** leaves children at their intrinsic width.

Grounded against the repo at HEAD. The load-bearing facts:

1. **`flexProps` is ONE shared grammar, four consumers.** `container.ts` exposes a single `flexProps` (align/justify/gap/wrap) that `ui-row`, `ui-column`, `ui-list`, `ui-grid` each fold into their own `static props` (ADR-0016 cl.1). `align` defaults to `start` (`values[0]`). A naïve "flip the shared default" would change **all four** — wrong: the desired change is **direction-specific**.
2. **Cross-axis meaning differs by direction.** For a **column** (main axis = block), the cross axis is **inline (width)** — stretching children to fill the width is the common, desirable default (a stacked card/row should span the column). For a **row** (main axis = inline), the cross axis is **block (height)** — stretching children to full height is usually *unwanted*. So the right default is **direction-appropriate**, not uniform.
3. **`ui-list` IS a `ui-column` specialization** (list.ts: "a `ui-column` SPECIALIZATION that adds list semantics", `flex-direction:column` + `role=list`) — it has the **identical** `flex-start` default and the **identical** shrink-wrap behavior.
4. **`ui-grid` does not consume `align`** — it is `display:grid` with `grid-template-columns: repeat(auto-fit, minmax(--ui-grid-min, 1fr))`; items fill their track via `1fr`, and grid.css maps **no** `align`/`align-items` token. The shrink-wrap bug does not apply to grid.
5. **A default is NOT reflected as an attribute** (ADR-0005 lazy-upgrade, property-wins): with no `align` attribute set, the CSS `[align=…]` selectors don't match — the **base token** (`:where(ui-column){--ui-column-align: …}`) supplies the value. So the prop default and the CSS base token must be flipped **together**, and `start` (now a non-default) needs its own repoint selector.
6. **A2UI-fidelity-safe (free choice).** A2UI v1.0 does **not** mandate a default cross-axis align for Row/Column — it is a catalog/renderer detail (the basic-catalog JSON, not the spec text). So `ui-column → stretch` is a **conformance-safe** default choice, not a divergence (Constraint C1 holds).

## Decision

**Flip `ui-column`'s cross-axis `align` default from `start` to `stretch`** (children fill the column's width by default); **`ui-row` keeps `start`** (the direction-appropriate asymmetry — vertical stacks fill, a row does not force full height). The shared `flexProps` grammar and its `start` default are **unchanged**; only the column and list **override the default**.

1. **Per-consumer default override — reuse the shared type, swap only the default (no enum re-list).** `column.ts`:
   ```ts
   const props = {
     ...UIContainerElement.surfaceProps,
     ...UIContainerElement.flexProps,
     align: { ...UIContainerElement.flexProps.align, default: 'stretch' }, // override default ONLY
   } satisfies PropsSchema
   ```
   This spreads the shared `flexProps`, then replaces **only** the `align` entry's `default` field while **reusing the shared `type`** (the `enumType` carrying all five values). The value vocabulary is **not** re-listed — so if `flexProps.align` ever grows a sixth member, column inherits it with zero drift. The shared `flexProps.align` default stays `start`, so `ui-row` (and the grammar's type-level default) are byte-for-byte unchanged.
2. **CSS base token = the prop default (consistency, fact 5).** `column.css`: the base token `--ui-column-align: flex-start` → **`stretch`**; **add** `:where(ui-column[align='start']) { --ui-column-align: flex-start }` (since `start` is now a non-default value needing a repoint); the existing `:where(ui-column[align='stretch'])` rule becomes redundant (it now equals the base) and is **removed**. `center`/`end`/`baseline` repoints unchanged. Net: no-attribute → `stretch` (matches the prop default); explicit `align='start'` → `flex-start`.
3. **Descriptor consistency.** `column.md`'s `align` frontmatter `default: start` → `stretch`, and the prose default note. The `{name}.md ↔ static props` contract trip-wire (ADR-0004) keeps the three (prop / CSS / descriptor) from drifting.
4. **`stretch` yields to an explicit child width — no clobber.** `align-items: stretch` only stretches a child with **no** explicit cross-size; a child with a `width`/`max-width` keeps it (standard box-alignment). The card fills because it is intentionally width-less; a sized child is unaffected. No `!important`, no width forced on children.

### Family reconciliation

| primitive | direction | cross axis | default | change |
|---|---|---|---|---|
| **ui-column** | block | inline (width) | `start` → **`stretch`** | **flip** (the fix, user-ratified) |
| **ui-list** | block (column specialization) | inline (width) | `start` → **`stretch`** | **flip (ratified)** |
| **ui-row** | inline | block (height) | `start` (kept) | **none** (the asymmetry — no forced full-height) |
| **ui-grid** | grid | track (1fr) | n/a (no `align` token) | **none** (items fill their track) |

- **ui-row keeps `start`** (user-ratified): a row's cross axis is height; stretching items to equal full height is usually unwanted, and a row is the natural place to *opt in* with `align='stretch'` when equal-height is desired.
- **ui-grid: no change** — it consumes no `align` token and its `auto-fit 1fr` tracks already fill horizontally; the shrink-wrap bug does not exist here.
- **ui-list: flip to `stretch` (ratified).** `ui-list` *is* a `ui-column` (a column + `role=list`) with the identical default and identical shrink-wrap; a list of cards/rows filling the width is the canonical list rendering. Keeping `ui-list` at `start` while `ui-column` goes `stretch` would make two same-axis primitives disagree on their cross-axis default — an inconsistency. **Flipped identically to `ui-column`** — user-ratified (2026-06-30), after the column+row decision, since `ui-list` is the same axis and the same principle applies.

## Consequences

- **A shipped-component default changes** — any existing `ui-column` (or `ui-list`) whose children previously shrink-wrapped now fills the width. This is the **intended fix**, but it is visible churn. A column that *wants* shrink-wrap now opts in with `align='start'` (the inverse of before) — a one-attribute migration, documented in `column.md`.
- **Regression audit (done) — the in-repo surface is small.** A grep of `ui-column` usages found **no** real cards-in-column layout demo that would visibly shift (the component gallery is dormant, CLAUDE.md G8); the references are the catalog factory map (`Column`→`ui-column`, no align assertion), the barrels/descriptor TOC, and docs. The concrete test updates the build must make: **`column.test.ts:28`** — the default-props assertion `['start','start','none',false]` → `['stretch','start','none',false]` (align flips; justify/gap/wrap unchanged); **`column-css.test.ts`** — base token now `stretch` + a new `[align='start']` repoint selector; **`column-descriptor.test.ts`** — the `.md↔props` trip-wire (column.md `align` default `stretch`); **`column.browser.test.ts`** — the visual fill-width proof. `column-geometry.test.ts` has **no** align assertion (unaffected — verified).
- **The container-query "switcher" now yields equal-height items.** column.css flips `flex-direction: row` under a wide query container (the intrinsic-responsive switcher, ADR-0016 cl.4). With `align-items: stretch`, the switched **row** stretches items on its cross axis = **height**, i.e. **equal-height items**. This is usually *desirable* (equal-height cards in a wide-container row), and it is internally consistent ("the column stretches its children across whatever its current cross axis is"). Recorded as a consequence, not a defect; if a future case wants the switched-row to top-align, that is a scoped follow-up (the switcher rule could reset `align-items`), not this change.
- **The shared `flexProps` grammar is untouched** — the change is a *consumer default override*, reusing the shared `type`. `ui-row`, `ui-grid`, and the grammar's type-level default (`start`) are unchanged; no other consumer regresses. The override pattern (`{ ...flexProps.align, default: 'stretch' }`) is the reusable idiom for any future per-primitive default divergence.
- **`align='start'` gains a CSS repoint selector** — a one-line addition; the now-redundant `[align='stretch']` rule is removed (net zero rule-count change). The `[align]` repoint test (column-css.test.ts) updates to assert the `start` repoint + the `stretch` base default.
- **ui-list flips identically — user-ratified (2026-06-30).** List mirrors column exactly (the same three-file change + tests); grid is mechanically out (no `align` token), and row keeps `start` (the direction asymmetry). The family's vertical stacks (column + list) now agree on `stretch`.
- **Stale → re-verify (on ratify + build gate):** goals §G9 (cross-axis default note) · `column.{ts,css,md}` + column-{css,descriptor,browser}.test · `list.{ts,css,md}` + its tests · a regression sweep of column/list demos · the docs-site layout demos.

## Alternatives considered

- **`width:100%` on `ui-card` (fix at the child)** — rejected. The card is deliberately parent-sized (`min-inline-size:0`, no width) so it composes under *any* parent (a grid cell, a flex item, a column). Forcing `width:100%` would break it in contexts where the parent sizes it differently and pushes the fix to every child type rather than the one container whose default is wrong.
- **Flip the shared `flexProps.align` default to `stretch` for all four primitives** — rejected. It would stretch **row** items to full height (the unwanted case, fact 2) and is semantically wrong: the right default is direction-specific. The override-the-consumer-default pattern keeps the grammar neutral and each primitive correct.
- **Re-list the align enum in column.ts with a `stretch` default** (`prop.enum([...five values...], 'stretch')`) — rejected. It duplicates the value vocabulary, creating drift if `flexProps.align` ever changes. Overriding only the `default` field (`{ ...flexProps.align, default: 'stretch' }`) reuses the one shared `type` and cannot drift.
- **Leave the CSS base token at `flex-start` and rely on the prop default reflecting `stretch`** — rejected (and incorrect): a default is **not** reflected as an attribute (ADR-0005), so with no `align` attribute the `[align='stretch']` selector never matches and the base token governs. The base token **must** carry the new default; this is why the CSS + prop flip together.
- **Flip `ui-list` silently as part of the column change** — rejected in favor of flagging it. It is a second shipped-default change on a primitive the user did not name; the consistency argument is strong (recommended), but a user-facing default change deserves explicit ratification, not a silent bundle.
- **Also reset `align-items` in the container-query switcher so the switched row top-aligns** — rejected for this change (scope). The equal-height result is usually desirable and internally consistent; changing the switcher is a separable concern that should be driven by a real want, not pre-emptively bundled.
