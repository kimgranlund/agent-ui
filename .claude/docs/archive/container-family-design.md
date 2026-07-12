> **ARCHIVED 2026-07-12 (repo-alignment Phase 5, manifest M3):** parked 2026-06-28; its entire
> scope (the card/container family + the nested-radius law + the elevation/brightness surface model)
> shipped via ADR-0046 and the G9/container waves WITHOUT ever citing this draft — a dead orphan with
> zero inbound references. Kept as the dated exploration record.

# Container family — design notes

> **Status: design decisions RATIFIED via a planning session (2026-06-28); handed to planning-lead for
> the PRD → coverage-clean decomp → ADRs (the gate before any build).** See "Ratified design" immediately
> below — it supersedes the parked card-centric exploration further down (which is kept as supporting
> detail; some of it, e.g. the JS nested-radius controller, was NOT chosen).

## Ratified design (planning session, 2026-06-28)

**This milestone = "A2UI's layout primitives land"** — the catalog's reserved `Row/Column/Card/Tabs/Modal`
(a2ui-catalog.spec §5.2, currently `experimental`) go to shipped, bound **directly** to new `ui-*` controls
(SPEC-R8, no adapter), with the `ChildList` child model.

**Outside-in (Structural):**
- **Scope:** the full A2UI container set — `ui-row`, `ui-column`, `ui-card` (+ `ui-card-header/-content/-footer`),
  `ui-list`, `ui-grid`, `ui-tabs` (+ `ui-tab`/`ui-tab-panel`), `ui-modal` (~12 elements).
- **Driver:** A2UI-catalog-first; regions are **sub-elements** composed as `ChildList` children (component-native).
- **Build:** **all-at-once parallel fan-out** (one large agent-team wave, file-disjoint slices).
- **A2UI binding:** **renderer LLD-C8 (two-way binding) is pulled into this milestone** — Tabs `selected` /
  Modal `open` bind in the catalog (and it back-fills the deferred text-field two-way input).

**Inside-out (Mechanism):**
- **Layout:** A2UI-faithful flexbox (Row/Column with alignment / distribution / gap / wrap); **container-query
  intrinsic responsiveness** (primitives reflow on their OWN container width — no breakpoint props).
- **Surface:** elevation (**tint-only**) + brightness, **7 steps each**, **reusing the EXISTING
  `--md-sys-color-neutral-surface-*` ladders** (already in `tokens.css`: `-lowest…-low / -high…-highest` = the
  scheme-INVERTING elevation axis; `-dimmest…-dim / -bright…-brightest` = the scheme-consistent brightness
  axis). Container repoints `--ui-container-bg` to the role per `[elevation=n]`/`[brightness=n]`. **No new
  surface tokens** — the open detail is only how the two axes COMPOSE when both set (tokens-specialist call).
  Signed `n ∈ [-3..3]` literal-union reflected props.
- **Radius:** CSS **one-level** only (a parent publishes `--ui-card-child-radius`; manual past one level — the
  JS controller was REJECTED). Wants the shared `--ui-radius-base` token (also #71).
- **Spacing:** a dedicated **`--ui-space`** token ladder (tokens-specialist), **density-responsive** (scales
  with the `[density]` attribute, like the controls).
- **Modal:** native **`<dialog>` `showModal()`** — top-layer / `::backdrop` / focus containment / Escape come
  free (NOT a form widget, so it honours "no native form elements"; zero-dependency).
- **Tabs/Modal a11y (full widget contract):** Tabs = roving-tabindex arrow-key nav + `tablist/tab/tabpanel`
  ARIA + bindable `selected`; Modal = focus trap + restore + Escape + dialog ARIA + bindable `open`.

**ADRs this needs** (planning-lead to author): the surface/space token model + the two-axis composition rule ·
the A2UI-faithful flex layout system + container-query responsiveness · native-`<dialog>` Modal · CSS-one-level
radius · pulling renderer LLD-C8 (two-way binding) into scope. Where it sits in `goals.md`: a new milestone
(provisionally **G9 — containers/layout**), after the form family.

---

# Appendix — the original card-centric exploration (UNRATIFIED; superseded above)

> Captured 2026-06-28 from three background
> fork outputs during the G3/text-field build. A container/card family is **unplanned** — it is not in
> `.claude/docs/goals.md` (G0–G8 cover only the FACE form-control family). Before any build, this must go through
> the normal intake: **planning-lead → `system-decompose` (coverage-clean) → an ADR for the
> nested-radius controller + one for the elevation/brightness model → `tokens-specialist` for the new
> token ladders.** The logic below has not been independently reviewed for correctness; it is preserved so
> the thinking isn't lost. Naming/conventions are aligned to the existing repo (light-DOM custom elements,
> `@scope` CSS, host-as-grid anatomy, role/`data-role` slots, boolean props by presence, literal-union
> typed props, tokens consumed via roles not literals).

## 1. `ui-card` family — elements & anatomy

A **structural/container** family (NOT FACE form controls — no `ElementInternals`, no value/validity). Four elements, all self-define on import; barrels deferred to an integration slice:

| Element | Role | Notes |
|---|---|---|
| `ui-card` | the container | owns surface, border, radius, padding, the row grid |
| `ui-card-header` | top region | reuses `leading / label / trailing / description` anatomy |
| `ui-card-content` | body region | `scroll`, `scroll-fade` behaviors |
| `ui-card-footer` | bottom region | same anatomy as header (corrected from a `ui-footer` sketch → `ui-card-*` namespace) |

**Layout.** `ui-card` is `display: grid` with **presence-driven rows** (`:has(ui-card-header)` etc.), content row `1fr`:

```
[ header? ]
[ content ]   ← 1fr
[ footer? ]
```

`ui-card-header` / `ui-card-footer` reuse the row anatomy (host-as-grid, `:has()` columns):

```
[ leading? | label + description | trailing? ]
```

- `leading` / `trailing` = adornment slots (icon/action/badge) via `data-role`.
- `label` = primary line; `description` = secondary line stacked under it (a 2-row label cell). *(Open: stacked under label vs. its own full-width row.)*
- `ui-card-content` = default slot (children); no anatomy — pure body.

## 2. The nested-radius system (the load-bearing part)

**Concentric-corner law** — for nested rounded rectangles to keep a constant corner gap:

```
r_child = max(0, r_parent − padding_parent − border_parent)
```

(the border term ≈ the 1px frame; fold in or ignore per taste). Same-radius nesting looks wrong — the inner corner bows away from the outer at the diagonal.

**Why pure CSS can't do this past one level (the ADR rationale):** the natural idea — an inherited custom property each card self-decrements (`--r: calc(var(--r) − var(--pad))`) — is a **self-referential custom property = a CSS cycle**, so it computes invalid. Two-name ping-pong only works by alternating on nesting-depth parity, and CSS has no arbitrary-ancestor depth counter. **CSS-only handles exactly one level** (a parent publishes a separate `--ui-card-child-radius`); depth ≥ 2 needs a depth signal → a JS controller.

**Recommended controller — `nestedRadius(host)`** (why cards being web-components pays off):
- On `connected()` + on `ResizeObserver` / style-or-attribute mutation: find the nearest ancestor `ui-card` (`host.parentElement?.closest('ui-card')`); read its **resolved** `border-radius` + `padding` via `getComputedStyle`; set **own** `--ui-card-radius = max(0, parentRadius − parentPadding)`. A root card (no ancestor card) uses the base token `--ui-card-radius: var(--ui-radius-base)`.
- Each card renders from its own `--ui-card-radius`; children read the **parent's** resolved value via JS (not CSS inheritance) → **no cycle, exact, arbitrary depth**, reacts to runtime padding changes.
- A header/footer/content that paints a fill (or `ui-card-content`'s clip radius under `scroll`) uses the card's **inner** radius = `r_card − card_padding`.

### Concrete radius chain (worked numbers)

Root `border-radius: 1.00rem`, card padding `0.25rem`, decrement per level = the parent card's padding (floored at 0):

| Nesting level | `border-radius` | derivation |
|---|---|---|
| 0 (root, author-set) | **1.00rem** | given |
| 1 | **0.75rem** | 1.00 − 0.25 |
| 2 | **0.50rem** | 0.75 − 0.25 |
| 3 | **0.25rem** | 0.50 − 0.25 |
| 4+ | **0.00rem** | `max(0, …)` floor |

### Authoring model (this REVISED/RETRACTED an earlier "padding must be tokenized")

Author with **plain CSS** on the root:

```html
<ui-card style="padding:.25rem; gap:.25rem; border-radius:1rem">
```

- **Only the root sets `border-radius`.** Nested `ui-card`s set nothing — the controller derives. An explicit `border-radius` on a nested card is the **escape hatch** that reseeds the chain from there.
- The controller reads the ancestor's **computed** `border-radius` + `padding` via `getComputedStyle`, so inline `style`, a class, or `--ui-card-*` tokens all work interchangeably — tokens become defaults, not a requirement.
- `nestedRadius(host)` recomputes on `connected()` + `ResizeObserver` + a style/attr mutation observer (cheap: read 2 values, set 1).

### What is / isn't in the chain
- **Only `ui-card → ui-card` padding drives it.** A section's `padding: .25rem .75rem` is **content inset**, not part of the chain (a nested card subtracts the card's `.25rem`, never the section's `.75rem`).
- `gap: .25rem` is the header/content/footer **row gap** — independent of radius.
- A section/content that paints a fill takes the card's **inner** radius `r_card − card_padding` → `0.75rem` at the root. Transparent sections don't care.

### Edge — asymmetric card padding
If a card itself has `padding: .25rem .75rem`, strict concentricity would reduce per-axis. **Recommended simple rule:** subtract the card's **block** padding uniformly to all four corners — matches how the eye reads the side gap and keeps "−0.25/level" exact. True per-corner concentricity is a later refinement.

## 3. Container background — the `elevation` / `brightness` two-axis surface model

Both axes signed, symmetric, base-at-0; `n ∈ [-3..3]` a **literal union**, the attribute **reflects**. `0` in either axis = the neutral base surface (`--md-sys-color-neutral-surface`) → an unset container is unchanged.

**`elevation` → `--md-sys-color-surface-elevation-{step}`** (surface *hierarchy* / layering):

```
-3 lowest · -2 lower · -1 low · 0 base · 1 high · 2 higher · 3 highest
```

**`brightness` → `--md-sys-color-surface-brightness-{step}`** (tonal shift *within* a layer):

```
-3 dimmest · -2 dimmer · -1 dim · 0 base · 1 bright · 2 brighter · 3 brightest
```

**Prop / attribute contract:**
- `elevation: -3|-2|-1|0|1|2|3` and `brightness: -3|-2|-1|0|1|2|3`, both reflected (so `[elevation]`/`[brightness]` selectors work for JS-set values), default `0`.
- Typed as literal unions (not `number`) — matches `size: 'sm'|'md'|'lg'`; a `@ts-expect-error` proves a bare number is rejected.
- CSS consumes a **role**, never a literal: the host sets `background: var(--ui-container-bg)`, and each `[elevation=n]`/`[brightness=n]` rule repoints `--ui-container-bg` to the corresponding `--md-sys-color-surface-*` role. The signed-int→name mapping lives in `@scope`/`:where`; tokens stay role-pure.

**Decisions to resolve at intake (`tokens-specialist`):**
1. **Scheme inversion.** In dark mode "elevation up" conventionally means *lighter* (additive light) — the opposite of light mode. Each `--md-sys-color-surface-elevation-*` role must be designed deliberately per scheme via `light-dark()`, not a mechanical mirror.
2. **Composition contrast.** `elevation` and `brightness` compose, so on-surface ink (`--md-sys-color-neutral-on-surface`) must stay WCAG-AA across the **combined** extremes (`elevation=3,brightness=-3` and `elevation=-3,brightness=3`) — a 7×7 contrast surface, both schemes.
3. **Orthogonality.** Keep the axes visually distinct: recommend `elevation` = surface-role step (optionally + a shadow ramp), `brightness` = pure tonal tint within a layer. Decide whether `elevation` also carries shadow (real elevation usually implies shadow + tint together) or stays background-only.

## 4. Scroll system (`ui-card-content`)
- **`scroll`** (boolean, presence-based, not `="true"`): `overflow: auto; min-block-size: 0` so it scrolls *within* a sized card instead of growing it. **Requires** the card to have a constrained block-size (document it).
- **`scroll-fade`** (boolean): a `mask-image` linear-gradient fading the scroll edges. Recommended impl = edge-*aware* fade (top fade only when scrolled down, etc.) via **scroll-driven animations** (`animation-timeline: scroll()` driving the mask stops) — zero JS; degrade to a static both-edges mask where unsupported. A JS scroll listener is the heavier fallback only if a target engine lacks scroll-timelines.

## 5. Geometry & tokens
- `--ui-card-radius` (controller-managed, base `--ui-radius-base`), `--ui-card-padding`, `--ui-card-gap`; surface `--md-sys-color-neutral-surface`, border `--md-sys-color-neutral-outline-variant`, ink `--md-sys-color-neutral-on-surface`.
- **New shared tokens needed (→ `tokens-specialist`):** `--ui-radius-base` (also wanted by `ui-text-field`, see follow-up #71), the `--md-sys-color-surface-elevation-*` + `--md-sys-color-surface-brightness-*` ladders.
- Header/footer geometry follows the existing control ramp (height off `--ui-{height}`, edge insets `h/2` value / `½(h−icon)` slot) so a card header lines up with sibling controls.

## 6. Semantics
- `ui-card` → optional `role="group"`/`region` (or none — presentational by default; `region` only with an accessible name). A header's `label` may map to a heading. Keep ARIA minimal + opt-in; **no host attributes** — applied via the element's own internals where needed.

## 7. Open decisions (for the intake)
1. **Elevation-by-depth** (the `nestedRadius` controller could also step the surface role per nesting level) — ship with radius now, or defer? (Recommend defer.)
2. **`scroll-fade`** — accept scroll-driven-animation (no-JS) as primary with a static fallback? (Recommend yes.)
3. **`description` slot** placement — stacked under `label` (assumed) vs. its own full-width row.
4. **`--ui-radius-base`** — coordinate with the `ui-text-field` radius follow-up (#71): one fleet radius token serving both controls and containers.

> Cross-refs: the `ui-text-field` pill-radius follow-up (#71) wants the same `--ui-radius` fleet token;
> the `tokens-specialist` agent owns the surface/elevation ladders. This file is the parking lot — promote
> it into a real PRD/decomp/ADR via planning-lead when the container family is actually scheduled.
