# SPEC — Agent-App Surfaces M4 (panes + settings)

> Status: **proposed · v0.1 · 2026-07-10 · pending doc-review** · Layer: SPEC (execution contract)
> Direction (ratified, frozen): [`../adr/0120-app-surfaces-m4-panes-settings.md`](../adr/0120-app-surfaces-m4-panes-settings.md) (accepted 2026-07-10 — F1 `ui-split` MULTI-PANE in v1 · F2 master-detail = shipped composition · F3 settings surface INCLUDES the schema-driven preferences framework) + [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) v1.2 (**PRD-G7** panes · **PRD-G8** settings · **PRD-G6** fleet DoD + layering · milestone **M4**).
> Refined by: [`../lld/app-surfaces-m4.lld.md`](../lld/app-surfaces-m4.lld.md) (implementation). Decomposition: [`../decompositions/app-surfaces-m4.decomp.json`](../decompositions/app-surfaces-m4.decomp.json) (coverage-clean).
> Relates: [`agent-app-shell.spec.md`](./agent-app-shell.spec.md) (M1 shell M4 composes; **SPEC-R5** = the `collapse` prop M4's `toggle` value extends) · [`../adr/0084-app-shell-narrow-reflow-collapse.md`](../adr/0084-app-shell-narrow-reflow-collapse.md) (the reserved `collapse:"toggle"` value M4 realizes) · [`../adr/0082-app-shell-per-instance-isolation.md`](../adr/0082-app-shell-per-instance-isolation.md) (the isolated `:host` grid mirror the `toggle` rule must keep-in-sync) · [`../adr/0115-spa-router-v1-scope.md`](../adr/0115-spa-router-v1-scope.md) (`app` never imports `router` — settings navigation stays consumer wiring) · [`../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md`](../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md)/[`../adr/0117-theme-provider-shipped-component.md`](../adr/0117-theme-provider-shipped-component.md) (the whole-fleet catalog gate + the `EXCLUSION_ALLOWLIST` arm `ui-split` disposition uses) · [`../adr/0040-foundation-barrel-budget-7kb.md`](../adr/0040-foundation-barrel-budget-7kb.md)/[`../adr/0049-family-barrel-budget-22kb.md`](../adr/0049-family-barrel-budget-22kb.md) (the budget re-base discipline).
> Altitude: owns the **M4 behavior contract** — `ui-split` (components tier), the app-tier master-detail + `collapse:"toggle"` chrome, and the settings surface incl. the schema framework. Internal build order + file map are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define what **M4** of `agent-app-surfaces` is and how it behaves. M4 lets a developer (a) arrange **resizable/collapsible panes** — the master-detail agent-app layout and user-collapsible regions — without hand-building drag/resize/collapse machinery (PRD-G7), and (b) stand up a **settings surface** — a sections rail + panels + narrow drill-in, with its forms **generated from a typed schema** over the fleet's own form spine, persisted through a store-adapter seam (PRD-G8). The wave splits by tier (ADR-0120): **one interactive split primitive `ui-split` lands in `@agent-ui/components`**' layout family; the **chrome that composes it (master-detail, the realized `collapse:"toggle"`, the settings surface) lands in `@agent-ui/app`**.

`ui-split` is the wave's hardest contract — the fleet's most interaction-heavy control since the overlay family (ADR-0120 Consequences). Its **N-pane constraint-distribution + per-separator keyboard/announcement contract** (SPEC-R2/R3/R4) is designed here.

## 2. Definitions

- **`ui-split`** — a components-tier, **multi-pane (N-slot)** user-resizable split container: a **Container/layout** size-class element (sibling to `ui-row`/`ui-column`/`ui-grid`; geometry §"the five size-classes", `tier: layout` — no control height) that lays out **N panes** along one axis, separated by **N−1 control-managed separators**, each a draggable + keyboard-resizable ARIA `separator`.
- **`ui-split-pane`** — the generic pane child of `ui-split` (the slider-thumb precedent: the control renders the interactive separators, the author authors only the panes). Carries the per-pane constraint props (`min`/`max`, initial `size`).
- **Separator** — a control-rendered divider between one adjacent **pane pair**. Exactly **one per adjacent pair** (ARIA APG "Window Splitter"). Carries `role="separator"`, `aria-orientation`, `aria-valuenow`/`-valuemin`/`-valuemax`, `aria-controls`, `tabindex="0"`.
- **Two-neighbor (local) redistribution** — the resize semantics: dragging separator *i* transfers extent between its **two immediately-adjacent panes only** (pane *i* grows, pane *i+1* shrinks, sum-invariant); non-adjacent panes are unaffected (SPEC-R2). Push-through (cascading a clamped delta to further panes) is a **reserved** v2 behavior, not v1.
- **Master-detail** — the `ui-master-detail` app-tier composition: a docked list | detail arrangement over `ui-split` + the M1 shell, with narrow-width drill-in.
- **Settings surface** — the `ui-settings` app-tier composition: a sections rail + per-section panels + narrow drill-in, whose panels are generated from a **`SettingsSchema`** (SPEC-R10) over `ui-form-provider`/`ui-field`, persisted through a **`SettingsStore`** adapter seam (SPEC-R12).
- **`SettingsSchema`** — the typed, versioned preferences description (schema-in). **`SettingsStore`** — the persistence adapter contract (the app may bring its own store).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, a PRD/ADR trace, and testable acceptance criteria. Behavior only — the trait vs. inline-controller choice, the separator-injection mechanism, the schema-generator internals, and the file map are the LLD's (open LLD forks are listed in the decomposition `.md`/`.json` `notes`).

### 3.1 `ui-split` — the split primitive (components tier)

**SPEC-R1 — `ui-split` composition + geometry.** `ui-split` MUST be a components-tier layout control: extend `UIContainerElement` (or `UIElement` if it paints no surface — LLD F1), **light-DOM by default**, **`formAssociated: false`**, and lay out its `ui-split-pane` children along a single axis set by a reflected `axis: 'horizontal' | 'vertical'` prop (default `horizontal` = a row of columns). It MUST render **exactly one separator between each adjacent pane pair** (N panes ⇒ N−1 separators), control-managed (the author authors panes, never separators — the slider-thumb precedent). Its single `ui-split.css` MUST follow the fleet single-file `@scope` convention (ADR-0003): a `:where(ui-split)` block declaring only `--ui-split-*` custom properties, then `@scope (ui-split)`. Geometry is **Container/layout size-class** (geometry §"the five size-classes"): **no control height**; the divider thickness (`--ui-split-divider`) and separator hit-slop are layout dimensions off the space/dimension scale, NOT `--ui-height-*`. *(→ PRD-G7; ADR-0120 clause 2)*
- **AC1** *Given* `ui-split` with 3 `ui-split-pane` children, *when* rendered (browser whole-shape), *then* 3 panes and **2** separators render with non-zero boxes, the panes tile the container along `axis` with no gap/overlap beyond the divider, and the total occupied extent equals the container extent (±1px).
- **AC2** *Given* `ui-split.css`, *when* checked, *then* the `:where()` block declares only `--ui-split-*`, no deep `packages/**/src` import appears (grep), and no `--ui-{split}-height`/`--ui-height-*` control-height token is consumed (it is layout-class, geometry trip-wire).
- **AC3** *Given* `axis="vertical"`, *when* rendered, *then* panes stack top-to-bottom and separators are horizontal (drag/keyboard axis follows `axis`, SPEC-R3/R4).

**SPEC-R2 — N-pane size model + constraint distribution (the core contract).** `ui-split` MUST support **controlled and uncontrolled** sizing. Controlled: a `sizes` property (an array of fractions/ratios, one per pane, normalized to sum 1) is the source of truth; the control renders it and re-emits on user resize but does not self-mutate it (the prop-as-source-of-truth law, ADR-0102). Uncontrolled: absent `sizes`, the control holds internal ratios seeded from each `ui-split-pane`'s `size` prop (or equal distribution when unset) and mutates them on resize. Each pane MAY declare a `min` and `max` extent (CSS length; default `min` = a floor `--ui-split-pane-min`, default `max` = none). Resize MUST use **two-neighbor local redistribution** (§2): a drag/step on separator *i* of Δ grows pane *i* by Δ and shrinks pane *i+1* by Δ, **sum-invariant**, clamped so neither neighbor violates its `min`/`max`; the residual delta that would violate a neighbor's constraint is **dropped at v1 (local clamp), NOT cascaded** to non-adjacent panes (push-through is reserved). Degenerate cases MUST NOT throw: zero/one pane (no separators), all-`min`-equal (a drag that can't move clamps in place), a `sizes` array whose length ≠ pane count (the control reconciles to pane count — extra ratios dropped, missing ratios equal-filled — and warns once, never throws). **Dynamic panes (M1 repair):** `ui-split` MUST support **adding/removing `ui-split-pane` children after connect** — the separator set (N−1) and the ratio vector MUST re-derive so the layout stays valid (a removed pane's ratio is redistributed to the survivors, normalized to sum 1; an added pane is seeded from its `size` or an equal share taken proportionally from the others), never throwing and never leaving an orphaned or missing separator. This is load-bearing: the app-tier consumers (`ui-master-detail`, `ui-settings`) add/remove panes at runtime. **Mid-drag mutation (M2 repair):** a pane add/remove that lands **during an in-flight pointer/keyboard drag** MUST **abort the in-flight drag** (the captured separator index is invalidated by a count change) and settle at the pre-mutation ratios before re-deriving — the cheapest well-defined behavior; a mid-drag freeze-and-continue is explicitly NOT the contract (it would resize against a stale index). *(→ PRD-G7; ADR-0120 clause 2)*
- **AC1** *Given* 3 equal panes, *when* separator 0 is dragged +10% of the container, *then* pane 0 = 43.3%, pane 1 = 23.3%, pane 2 unchanged at 33.3% (two-neighbor, sum-invariant); a unit test asserts the ratios sum to 1 (±ε) after any resize.
- **AC2** *Given* pane 1 with `min` reached, *when* separator 0 is dragged further to shrink it, *then* the separator **clamps** (pane 1 stays at `min`, pane 0 stops growing) and pane 2 is **untouched** — the biting negative control drops the clamp and pane 1 goes below `min`.
- **AC3** *Given* controlled `sizes`, *when* the user drags, *then* the control emits the proposed ratios (SPEC-R3) and the rendered layout only changes if the consumer writes `sizes` back (prop-as-source-of-truth); *given* uncontrolled, *then* the internal ratios update directly.
- **AC4** *Given* a `sizes` length mismatch or a single pane, *when* connected, *then* the control reconciles/renders without throwing and (mismatch case) warns once.
- **AC5** *(dynamic panes, M1)* *Given* a connected 2-pane split, *when* a third `ui-split-pane` is appended (and later one removed), *then* the separator count re-derives to N−1, the ratios re-normalize to sum 1 (survivors absorb a removed pane's share; an added pane takes an equal share proportionally), and no separator is orphaned or missing — no throw.
- **AC6** *(mid-drag mutation, M2)* *Given* an in-flight drag on separator *i*, *when* a pane is added/removed before `pointerup`, *then* the drag **aborts** and the layout settles at the pre-mutation ratios before re-deriving (the captured index is invalidated) — the assertion bites if the resize continues against the stale index after the count changed.

**SPEC-R3 — Pointer drag, axis- and RTL-correct.** Each separator MUST be draggable via pointer with **pointer capture** (the `value-drag`/`slider-multi` gesture precedent: `pointerdown` → `setPointerCapture` → `pointermove` maps position along `axis` to a proposed resize → `pointerup`/`lostpointercapture`/`pointercancel` commit). During drag the control MUST emit a live **`input`** event (the proposed ratios) and on drag-end a **`change`** event (both allow-listed names). The position→delta mapping MUST honor `axis` (`clientX` for horizontal, `clientY` for vertical) **and writing direction**: under `direction: rtl` on the horizontal axis the mapping and grow/shrink sense MUST invert so a physical drag moves the visually-adjacent boundary correctly. *(Finding: the shipped `value-drag` trait is 1-D, horizontal, LTR-only — `ratioFromX` is `(clientX−rect.left)/width`; M4 needs an axis+RTL-aware resize gesture. Whether that is a new trait or a generalization of `value-drag` is the LLD's — SPEC requires only the behavior; a generalization MUST NOT regress shipped `ui-slider`/`ui-slider-multi`.)* *(→ PRD-G7)*

> **Drive mechanism — the INSTRUMENT-BRIDGE (the fleet's only cross-engine drag precedent).** `setPointerCapture` **cannot** be exercised for real in the browser gate: a synthetic `PointerEvent` does not represent an active pointer, so `setPointerCapture(pointerId)` throws `NotFoundError` in Playwright/WebKit (`slider.browser.test.ts` stubs it to a no-op; `slider-multi.browser.test.ts` the same). The M4 browser gate therefore drives every drag by **synthetic `dispatchEvent(new PointerEvent(...))` with `setPointerCapture` stubbed** — the shipped slider precedent. **"Capture-continuity" (the drag surviving the pointer leaving the separator) is proven STRUCTURALLY, not via real capture:** the `pane-resize` per-drag `AbortController` keeps the `pointermove`/`pointerup` listeners live from `pointerdown` until `pointerup`/`pointercancel`/abort regardless of where the pointer travels (LLD-C2) — a synthetic `pointermove` dispatched after a synthetic `pointerleave` still resizes. **Re-test trigger:** promote to real `setPointerCapture` continuity assertions when Playwright drives synthetic events as active pointers (the same deferred trigger the slider tests carry). No AC below asserts "real pointer capture"; the phrase is retired from R3/R6/LLD-C7.

- **AC1** *Given* a horizontal split (browser, **synthetic-dispatch + stubbed capture**, **Chromium AND WebKit**), *when* a separator receives a `pointerdown` then a sequence of `pointermove`s, *then* the adjacent panes resize live and an `input` fires per move; *when* a `pointerup` is dispatched, *then* exactly one `change` fires. (Live `input`/single `change`/adjacent-pane resize are the drivable core; the RTL/axis sense are AC2/AC3.)
- **AC2** *(capture-continuity, structural)* *Given* an in-flight drag (a `pointerdown` on a separator), *when* a `pointerleave`/out-of-bounds `pointermove` is dispatched **before** `pointerup`, *then* the resize still applies (the `pane-resize` AbortController-scoped listeners survive pointer-leave until `pointerup`/abort) — the assertion bites if the move listeners are bound to the separator's own hover/`pointerleave` lifetime instead of the per-drag AbortController.
- **AC3** *(RTL)* *Given* `dir="rtl"` on a horizontal split, *when* a separator is dragged (synthetic) toward the inline-end, *then* the resize direction is inverted vs LTR (the visually-correct boundary moves) — proven cross-engine; the assertion bites under an LTR-only mapping.
- **AC4** *(axis)* *Given* `axis="vertical"`, *when* a separator is dragged (synthetic), *then* the mapping uses `clientY` and the panes resize vertically.

**SPEC-R4 — Keyboard resize + the ARIA separator/announcement contract.** Each separator MUST be a focusable **`role="separator"`** with `tabindex="0"`, `aria-orientation` matching `axis`, `aria-controls` referencing its **primary** (leading) pane's id, and an accessible name (`aria-label`, default e.g. `"Resize panel"`, author-overridable). It MUST expose **`aria-valuenow` / `aria-valuemin` / `aria-valuemax`** describing the primary pane's current extent as an **integer percentage of the two-neighbor pair's combined extent** (`valuemin`/`valuemax` = the clamp window from both neighbors' `min`/`max`); `aria-valuenow` MUST update on every resize (pointer or keyboard). Keyboard: **Arrow keys along the axis** (Left/Right horizontal, Up/Down vertical) step the separator by a `--ui-split-key-step` (default a small percentage/px), **Home**/**End** drive the primary pane to its `valuemin`/`valuemax`, and (if `collapsible`) **Enter** toggles collapse to the last position. Under RTL the Arrow keys MUST map **logically** (ArrowRight decreases the inline-start pane). Focus MUST be visible (SPEC-R5). *(→ PRD-G7; ARIA APG Window Splitter)*
- **AC1** *Given* a focused separator (jsdom + browser), *when* ArrowRight/Down is pressed on a horizontal/vertical split, *then* the primary pane grows by the key step, `aria-valuenow` updates to the new integer percentage, and the change is clamped to `valuemin`/`valuemax`.
- **AC2** *Given* a separator, *when* the AX tree is read, *then* it exposes `role="separator"`, `aria-orientation`, `aria-controls`=the primary pane id, `aria-valuenow`/`-valuemin`/`-valuemax` as integers, and an accessible name.
- **AC3** *(RTL)* *Given* `dir="rtl"`, *when* ArrowRight is pressed, *then* the inline-start pane **shrinks** (logical mapping), not grows — the assertion bites under a physical mapping.
- **AC4** *Given* Home/End on a focused separator, *then* the primary pane snaps to its `valuemin`/`valuemax` respectively.

**SPEC-R5 — Touch targets, focus ring, forced-colors, reduced-motion.** The separator's **interactive hit area MUST be ≥ 24×24 CSS px** (WCAG 2.5.8) even when the visual divider is 1–2px — a transparent hit-slop centered on the divider, without shifting the pane layout. The focused separator MUST show the fleet focus ring (interaction-states law). Under **`forced-colors: active`** the divider + focus indicator MUST remain visible (real border/`currentColor`, no fill-only affordance that vanishes). The control MUST NOT animate resize by default (respect `prefers-reduced-motion`; any optional transition is off during active drag). *(→ PRD-G7, PRD-G6)*
- **AC1** *Given* a 2px visual divider (browser), *when* the separator's hit box is measured, *then* the pointer-interactive area is ≥ 24px on the cross-axis; the assertion bites when the slop is removed.
- **AC2** *Given* `forced-colors: active`, *when* rendered, *then* the divider and the focused separator's ring stay visible (no ink vanish); a browser leg asserts it.
- **AC3** *Given* a focused separator, *then* the fleet focus ring is present and meets the ring contract.

**SPEC-R6 — `ui-split` fleet DoD + whole-shape/drag browser + catalog disposition.** `ui-split` (+ `ui-split-pane`) MUST ship `{name}.md` descriptor(s) validating against the frontmatter schema (ADR-0004) with the contract↔props trip-wire green; MUST pass an independent `component-reviewer` at **COMPOSE ≥4 AND REALIZE ≥4** before commit; MUST prove its behavior **whole-shape + synthetic-drag (INSTRUMENT-BRIDGE, SPEC-R3) in Chromium AND WebKit** (SPEC-R1..R5 browser legs). **Catalog disposition (SPEC-N2 whole-fleet gate, ADR-0087):** when the `ui-split` descriptor lands it enters the coverage gate and MUST resolve to **either a `Split` catalog container row OR a reasoned `EXCLUSION_ALLOWLIST` entry — with no residue** (the gate goes red on an unresolved shipped control). **Recommendation (SPEC-level, build confirms): a `Split` container row** — `ui-row`/`ui-column`/`ui-grid`/`ui-slider`/`ui-slider-multi` are all already catalog-bound (verified in `catalog.json`), so a split layout is agent-emittable by parity: the agent emits the pane structure + `axis` + initial `sizes` (a `ChildList` of panes), and the resize is a host-owned affordance exactly as `Slider`'s drag is. The **`EXCLUSION_ALLOWLIST`** arm (the ADR-0117 `ThemeProvider` precedent) is the fallback **only if** the build finds the resize interaction cannot be safely agent-parameterized. *(→ PRD-G6; ADR-0120 clause 5)*
- **AC1** *Given* `ui-split.md`/`ui-split-pane.md`, *when* the trip-wire runs, *then* it equals `finalize(UISplitElement)`/`finalize(UISplitPaneElement)` (green).
- **AC2** *Given* the finished control, *when* `component-reviewer` scores it, *then* both axes ≥4, zero blockers, recorded BEFORE the wave commit.
- **AC3** *Given* the `ui-split` descriptor, *when* the a2ui `index.test.ts` (SPEC-N2) coverage gate runs, *then* `Split` resolves to a catalog row OR a cited `EXCLUSION_ALLOWLIST` entry, with the whole-fleet gate GREEN and no unresolved-control residue.

### 3.2 App-tier panes chrome (`@agent-ui/app`)

**SPEC-R7 — `ui-master-detail` shipped composition + drill-in.** A `ui-master-detail` element MUST ship in `@agent-ui/app`, composing `ui-split` (list | detail) over the M1 shell's regions with **0 bespoke split/resize code**. It MUST expose selection state as a reflected prop (`selected`, an item key) and emit an allow-listed **`select`**/**`change`** on selection. At/below a narrow container-width threshold it MUST **drill in**: show the list OR the detail (not both), with a way back to the list; wide, it shows both via `ui-split`. Navigation binding stays consumer wiring — the element MUST NOT import `@agent-ui/router` (ADR-0115). *(→ PRD-G7; ADR-0120 clause 3a; F2 = shipped composition)*
- **AC1** *Given* a wide container (browser, both engines), *when* rendered, *then* list and detail show side-by-side via `ui-split` (resizable); *when* narrowed below threshold, *then* only one shows and a back affordance returns to the list — proven cross-engine; the drill-in assertion bites on a fixed (non-reflowing) layout.
- **AC2** *Given* a selection, *when* an item is chosen, *then* `selected` reflects and one `select`/`change` fires; no `@agent-ui/router` import appears under the element's source (layering grep).

**SPEC-R8 — `collapse:"toggle"` realized (the ADR-0084 reserved value).** The `ui-app-shell-region` `collapse` prop MUST gain its third value **`toggle`** (currently reserved — `COLLAPSE_VALUES=['hide','stack']`): a **user-collapsible** region behind an affordance that emits an allow-listed **`toggle`** event and carries a collapsed custom-state. The **wide-layout-unchanged invariant** MUST hold: with the region expanded, the wide layout is byte-identical to today (the affordance/collapse only changes the region when the user collapses it). The new `@container`/state rules MUST land in **both** grid copies — the base `app-shell.css` AND the injected isolated `:host` mirror `app-shell-isolation.css` (the LLD-C5 keep-in-sync obligation), preserving the **stack-after-hide source-order caveat**. *(→ PRD-G7; ADR-0084, ADR-0120 clause 3b)*
- **AC1** *Given* `collapse="toggle"` (browser, both engines), *when* the affordance is activated, *then* the region collapses/expands, a `toggle` event fires, and a collapsed custom-state reflects; keyboard-operable.
- **AC2** *(wide-layout invariant)* *Given* an expanded `collapse="toggle"` region wide, *then* the layout is identical to a `collapse="hide"`/default region wide (no wide-layout effect) — the assertion bites if the toggle path alters the wide grid.
- **AC3** *(keep-in-sync)* *Given* isolation ON, *when* a `collapse="toggle"` region renders, *then* the collapse behavior holds in-shadow (the `:host` mirror carries the rule) — the assertion bites when the mirror omits it.

### 3.3 The settings surface + schema framework (`@agent-ui/app`)

> The SPEC permits **phasing shell → framework within the wave** (ADR-0120 clause 4): SPEC-R9 (shell) MAY ship before SPEC-R10..R12 (schema framework).

**SPEC-R9 — Settings shell (sections rail + panels + drill-in).** A `ui-settings` element MUST ship in `@agent-ui/app` presenting a **sections rail** + **per-section panel** area with **0 bespoke shell CSS**, composing the M1 shell + `ui-split`/layout family where apt. It MUST expose the active section as a reflected prop (`section`) and emit an allow-listed **`select`**/**`change`** on section change; at/below a narrow threshold it MUST **drill in** (rail → panel, with back). Navigation binding stays consumer wiring — MUST NOT import `@agent-ui/router` (ADR-0115). *(→ PRD-G8; ADR-0120 clause 4)*
- **AC1** *Given* multiple sections (browser, both engines), *when* rendered wide, *then* rail + active panel show together; *when* narrowed, *then* the panel drills in with a back path — cross-engine; drill-in bites on a fixed layout.
- **AC2** *Given* a section change, *then* `section` reflects, one `select`/`change` fires, and no `@agent-ui/router` import appears (layering grep).

**SPEC-R10 — The `SettingsSchema` contract + the v1 fence.** `ui-settings` MUST accept a typed, **versioned** `SettingsSchema` **property** (a JS object, not an attribute): `{ version: 1, sections: Section[] }`, `Section = { id, label, description?, fields: Field[] }`, `Field = { key, type, label, description?, default, validation?, ... }`. The `type` MUST map to a fleet control via a **field-type → control registry** (the swappable-pack precedent, ADR-0065): v1 types **`text` · `number` · `boolean` · `select` · `slider` · `date`** binding to `ui-text-field`(+codecs) · `ui-switch` · `ui-select` · `ui-slider` respectively. An **unknown `type` MUST degrade** (render a disabled placeholder + warn once) — never throw. **Schema v1 explicitly does NOT model** (the fence — routes to a later intake): conditional/dependent fields (show-B-if-A), repeatable/array groups, cross-field validation, async/remote validation, async/dynamic option sources, i18n of labels, and file inputs. *(→ PRD-G8; ADR-0120 clause 4 + Consequences "the fence moved, it did not vanish")*
- **AC1** *Given* a v1 schema with each supported `type`, *when* `ui-settings` renders it, *then* each field yields the mapped fleet control with its `default` applied, grouped by section.
- **AC2** *Given* an unknown `type`, *then* a disabled placeholder renders and one warning is logged — no throw.
- **AC3** *Given* a `version` the runtime doesn't support, *then* the surface refuses gracefully (renders an empty/notice state + warns), not a crash — the versioning is load-bearing.

**SPEC-R11 — Schema-in → form-out generation + validation wiring.** `ui-settings` MUST **generate the panels' forms** by composing the fleet's own primitives — one **`ui-form-provider`** per section (or per surface) wrapping **`ui-field`**-wrapped controls — with **0 app-authored form CSS/glue**; generated controls MUST meet the same participation contract as hand-authored ones (ADR-0050/0051 field labelling + aggregate). **Validation MUST derive from the schema**: each `Field.validation` (e.g. `required`, `min`/`max`, `pattern`, `step`) MUST wire onto the generated control's **own validity** (native constraint or `setCustomValidity`) so errors render through the control's existing `user-invalid` timing and the `ui-form-provider` aggregate — **no bespoke validation engine**, one timing source (the ADR-0051 reactive-error law). *(→ PRD-G8)*
- **AC1** *Given* a section schema, *when* generated, *then* the section is a `ui-form-provider` whose members are `ui-field`-wrapped fleet controls whose labels/descriptions come from the schema (jsdom structural + browser).
- **AC2** *Given* a `required`/`min`/`pattern` field left invalid, *when* the user interacts and submit is attempted, *then* the error renders through the control's own `user-invalid` path and the provider aggregate reports it invalid — the assertion bites when the validation wiring is dropped (the field reports valid).

**SPEC-R12 — The persistence store-adapter SEAM.** `ui-settings` MUST persist through a **`SettingsStore` adapter interface** (`get(key)` / `set(key, value)` / an optional `subscribe`/change notification; batch `load()`/`save(values)` MAY be part of the contract — LLD finalizes) supplied as a **property** — **the app brings its own store** (ADR-0120 clause 4). The surface MUST read initial field values from the store (falling back to `Field.default`) and write changes back on commit; the **read/write timing** (per-field-on-change vs batched-on-save, dirty tracking) MUST be defined and testable. A **reference adapter** (e.g. an in-memory or `localStorage`-backed `SettingsStore`) MUST ship for the demo/tests, but it is a reference, not a dependency — no store implementation is baked into `ui-settings`. *(→ PRD-G8; PRD §Out-of-scope "the app brings its own store"; the fence stays: remote sync/account/policy layers route to new intakes)*
- **AC1** *Given* a `SettingsStore` with seeded values, *when* `ui-settings` mounts, *then* fields render the store's values (not just `default`); *when* a field changes and commits, *then* the store's `set` is called with the field key + new value (spy/asserted).
- **AC2** *Given* no store supplied, *then* the surface still renders from `Field.default` and does not throw (the store seam is optional-but-defined); *given* the reference adapter, *then* a round-trip (write → reload) preserves values.
- **AC3** *Given* the store seam, *when* `ui-settings` source is grepped, *then* no concrete store (localStorage, fetch) is imported by the element itself — only the interface (the seam is a contract, not an implementation).

### 3.4 Cross-cutting — layering + DoD + budget

**SPEC-R13 — Layering: `ui-split` components-tier (no cycle); `app` never imports `router`.** `ui-split`/`ui-split-pane` MUST live under `@agent-ui/components` (`controls/split/`), importing only inward (`dom`/`traits`) — no cycle; the components `layering.test.ts` trip-wire stays green. The M4 app-tier surfaces (`ui-master-detail`, `ui-settings`, the `collapse:"toggle"` change) MUST NOT import `@agent-ui/router` (ADR-0115 catalog-invisible law) nor any deep `packages/**/src` path. **This edge is ALREADY forbidden by construction** — `app/src/layering.test.ts`'s `isAllowedAppSpecifier` allowlist admits only `{@agent-ui/components, @agent-ui/a2ui, @agent-ui/shared, local}`, so `@agent-ui/router` fails the existing gate with no new assertion needed; the M4 work is a **named negative-control** proving a planted `@agent-ui/router` import under `app/src` turns the existing test RED (making the `router` case explicit for the reader), NOT closing an open hole. *(→ PRD-G6; ADR-0115, ADR-0120 clause 4)*
- **AC1** *Given* `ui-split`, *when* the components layering test runs, *then* it imports only `dom`/`traits`/local and introduces no cycle; a planted upward import turns it RED (negative control, unique token).
- **AC2** *Given* the existing `app/src/layering.test.ts` allowlist (which already excludes `@agent-ui/router`), *when* a `@agent-ui/router` import is planted under `app/src` (unique-token NC, grep-confirmed applied then reverted), *then* the existing test turns RED — the named negative-control that makes the no-`router` edge explicit; no source imports `@agent-ui/router` or a deep `packages/**/src` path in the shipped tree.

**SPEC-R14 — Fleet DoD across all M4 surfaces + the budget re-base.** Every M4 surface (`ui-split`, `ui-split-pane`, `ui-master-detail`, `ui-settings`, the region change) MUST clear the standing bar: `{name}.md` descriptor + contract↔props trip-wire + `component-reviewer` **≥4 both axes** + **cross-engine browser truth** + a `size` line-item. **The family budget re-base is PART of this wave** (ADR-0040/0049 discipline, ADR-0120 clause 2): `ui-split` is interaction-heavy and is expected to push the `@agent-ui/components` worst-case family ceiling (currently 30 KB gz, **~127 B headroom** per the M4 intake — the token-surfaces wave narrowed it) over budget; the new ceiling MUST be **named as measured-at-build** (provisional **32 KB gz**) with `ui-split`'s **per-control marginal within the standing ≤ ~2 KB cap** (the real gate). The **`@agent-ui/app` marginal** gains line-items for `ui-master-detail` + `ui-settings`; its ceiling is re-based measured-at-build (M1 provisional was ≤ ~3 KB — M4 will re-base upward, named against the measured baseline). *(→ PRD-G6)*
- **AC1** *Given* each M4 element, *when* its descriptor trip-wire runs, *then* green; *when* `component-reviewer` scores it, *then* ≥4 both axes before commit; *when* the browser gate runs, *then* its legs pass in **Chromium AND WebKit**.
- **AC2** *Given* `npm run size`, *when* run, *then* the components family + `@agent-ui/app` line-items report against **re-based ceilings named at build against a measured baseline** (not guessed), `ui-split`'s per-control marginal is within the ≤ ~2 KB cap, and a planted over-budget number fails the gate (negative control).

---

## 4. Typed contracts (behavioral — signatures illustrative; internals are the LLD's)

```ts
// ── ui-split (components tier) — Container/layout size-class, formAssociated:false ──
interface UISplitElement {
  axis: 'horizontal' | 'vertical'          // reflected; default 'horizontal'
  sizes?: number[]                          // controlled ratios (sum→1); absent ⇒ uncontrolled (internal)
  // events: 'input' (live, per pointer move / key step) · 'change' (commit / drag-end)
}
interface UISplitPaneElement {
  size?: number                             // initial ratio seed (uncontrolled) ; min/max = CSS length props
  min?: string ; max?: string               // per-pane clamp (default min = --ui-split-pane-min floor)
  collapsible?: boolean                     // Enter toggles collapse-to-last (SPEC-R4)
}
// separator (control-rendered, one per adjacent pair): role="separator" · aria-orientation ·
//   aria-controls=<primary pane id> · aria-valuenow/-valuemin/-valuemax (int %) · tabindex=0 · aria-label

// ── ui-app-shell-region (app tier) — collapse gains 'toggle' (SPEC-R8) ──
interface UIAppShellRegionElement { collapse: 'hide' | 'stack' | 'toggle' }   // 'toggle' now REAL; emits 'toggle'

// ── ui-master-detail (app tier) ──
interface UIMasterDetailElement { selected?: string /* item key */ }          // events: 'select' | 'change'

// ── ui-settings (app tier) + the schema/store seam ──
interface UISettingsElement { schema: SettingsSchema ; store?: SettingsStore ; section?: string } // events: 'select'|'change'
interface SettingsSchema { version: 1 ; sections: SettingsSection[] }
interface SettingsSection { id: string ; label: string ; description?: string ; fields: SettingsField[] }
interface SettingsField {
  key: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'slider' | 'date'   // v1 set; unknown ⇒ degrade+warn
  label: string ; description?: string ; default: unknown
  validation?: { required?: boolean ; min?: number ; max?: number ; step?: number ; pattern?: string }
  options?: { value: string ; label: string }[]                        // for type='select'
}
interface SettingsStore {                                              // the persistence SEAM (app brings its own)
  get(key: string): unknown
  set(key: string, value: unknown): void
  subscribe?(listener: (key: string, value: unknown) => void): () => void
  // batch load()/save(values) MAY be part of the contract — LLD finalizes
}
```

- **Events:** all M4 events are allow-listed simple names — `input · change · select · toggle`. No native form elements; ARIA via `ElementInternals`/managed attributes only (CLAUDE.md invariants).
- **No new tokens on `tokens.css`** — M4 pins **role-level** color mappings only (the token sheet is mid-migration by another seat); `ui-split`'s dimensional tokens are `--ui-split-*` in its own single-file block.

## 5. Non-functionals

- **Cross-engine truth (gate):** SPEC-R1..R5, R7..R9, R11 browser legs pass in **Chromium AND WebKit** (the fleet whole-shape discipline + the synthetic-drag INSTRUMENT-BRIDGE of SPEC-R3; the 18-bug overlay-wave lesson).
- **Budget (gate):** the components family + `@agent-ui/app` line-items within the **re-based, measured-at-build** ceilings (SPEC-R14).
- **Layering (gate):** `ui-split` no-cycle + `app` never-imports-`router` hold as standing trip-wires (SPEC-R13).
- **A11y floor:** WCAG 2.5.8 touch target (≥24px) on separators; ARIA APG Window-Splitter conformance; forced-colors legibility; reduced-motion respected.

## 6. Traceability (this SPEC → PRD / ADR)

| SPEC-R | Requirement | Traces to |
|---|---|---|
| SPEC-R1 | `ui-split` composition + geometry | PRD-G7 · ADR-0120 cl.2 |
| SPEC-R2 | N-pane size model + constraint distribution | PRD-G7 · ADR-0120 cl.2 |
| SPEC-R3 | pointer drag, axis + RTL | PRD-G7 |
| SPEC-R4 | keyboard resize + ARIA separator/announcement | PRD-G7 |
| SPEC-R5 | touch targets · focus · forced-colors · reduced-motion | PRD-G7 · PRD-G6 |
| SPEC-R6 | `ui-split` DoD + whole-shape/drag + catalog disposition | PRD-G6 · ADR-0120 cl.5 |
| SPEC-R7 | `ui-master-detail` composition + drill-in | PRD-G7 · ADR-0120 cl.3a |
| SPEC-R8 | `collapse:"toggle"` realized | PRD-G7 · ADR-0084 · ADR-0120 cl.3b |
| SPEC-R9 | settings shell (rail + panels + drill-in) | PRD-G8 · ADR-0120 cl.4 |
| SPEC-R10 | `SettingsSchema` contract + v1 fence | PRD-G8 · ADR-0120 cl.4 |
| SPEC-R11 | schema→form-out generation + validation wiring | PRD-G8 |
| SPEC-R12 | persistence store-adapter seam | PRD-G8 |
| SPEC-R13 | layering (split no-cycle; app ≠ router) | PRD-G6 · ADR-0115 · ADR-0120 cl.4 |
| SPEC-R14 | fleet DoD across M4 + budget re-base | PRD-G6 · ADR-0040/0049 |

_Every M4 PRD goal is covered: PRD-G7 (R1–R8), PRD-G8 (R9–R12), PRD-G6 (R6, R13, R14). The M1–M3 goals (G1–G5) are out of this SPEC._
