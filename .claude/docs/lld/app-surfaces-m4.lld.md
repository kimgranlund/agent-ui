# LLD — Agent-App Surfaces M4 (panes + settings)

> Status: **proposed · v0.1 · 2026-07-10 · pending doc-review** · Layer: LLD (implementation plan)
> Implements: [`../spec/app-surfaces-m4.spec.md`](../spec/app-surfaces-m4.spec.md) (`SPEC-R1…R14`). Realizes the ratified [`../adr/0120-app-surfaces-m4-panes-settings.md`](../adr/0120-app-surfaces-m4-panes-settings.md).
> Decomposition: [`../decompositions/app-surfaces-m4.decomp.json`](../decompositions/app-surfaces-m4.decomp.json) (coverage-clean; nodes ≈ the components below). Build-order edges are the decomposition's.
> Precedents: `traits/value-drag.ts` + `controls/slider-multi/slider-multi.ts` (the multi-handle pointer gesture + nearer-handle gate + per-handle ARIA + keyboard-step-with-clamp — the shape `ui-split`'s separators generalize) · `traits/roving-focus.ts` (keyboard-nav prior art) · `controls/row|column|grid` (the layout-family box model + `tier: layout` geometry) · `controls/form-provider` + `controls/field` + `dom/form.ts` (the form spine SPEC-R11 generates onto; ADR-0050/0051) · `controls/app-shell` (the M1 shell M4 composes; the `collapse` prop + the isolated `:host` mirror keep-in-sync obligation, LLD-C5).
> Altitude: owns **how M4 is built** — file map, concrete interfaces, per-component failure/edge handling, build sequence. Behavior is the SPEC's; this doc never re-derives it. **Open forks needing Kim/an ADR are in §11 — this LLD recommends but does not self-ratify them.**

## 1. Component map (LLD-C# → SPEC-R#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | `ui-split` + `ui-split-pane` behavior | `packages/agent-ui/components/src/controls/split/split.ts` | SPEC-R1, R2 | n1a |
| **LLD-C2** | pane-resize gesture controller | `.../traits/pane-resize.ts` (+ `.test.ts`) | SPEC-R3, R4 | n1b |
| **LLD-C3** | constraint solver (two-neighbor redistribution) | `.../controls/split/constrain.ts` (+ `.test.ts`) | SPEC-R2 | n1c |
| **LLD-C4** | separator management + ARIA | `.../controls/split/split.ts` (separator path) | SPEC-R1, R4 | n1a |
| **LLD-C5** | `ui-split.css` (geometry · divider · hit-slop · focus · forced-colors · RTL) | `.../controls/split/split.css` | SPEC-R1, R5 | n1d |
| **LLD-C6** | descriptors + contract↔props | `.../controls/split/{split.md,split-pane.md}` | SPEC-R6 | n1e |
| **LLD-C7** | `ui-split` gates (jsdom + cross-engine browser drag/keyboard/whole-shape) | `.../controls/split/{split.test.ts, split.browser.test.ts}` | SPEC-R1..R5 | n1f |
| **LLD-C8** | catalog disposition (`Split` row OR allowlist) | `a2ui/src/catalog/default/{catalog.json,factories.ts}` · `a2ui/.../index.test.ts` | SPEC-R6 | n1g |
| **LLD-C9** | family budget re-base | `scripts/measure-size.mjs` | SPEC-R14 | n4a |
| **LLD-C10** | `ui-master-detail` (app tier) | `app/src/controls/master-detail/{master-detail.ts,.css,.md}` | SPEC-R7 | n2a |
| **LLD-C11** | `collapse:"toggle"` realized | `app/src/controls/app-shell/{app-shell.ts,app-shell.css,app-shell-isolation.css}` | SPEC-R8 | n2b |
| **LLD-C12** | `ui-settings` shell | `app/src/controls/settings/{settings.ts,.css,.md}` | SPEC-R9 | n3a |
| **LLD-C13** | `SettingsSchema` types + field→control registry + generator | `.../settings/{schema.ts, generate.ts}` (+ `.test.ts`) | SPEC-R10, R11 | n3b |
| **LLD-C14** | validation wiring (schema → control validity) | `.../settings/validate.ts` (+ `.test.ts`) | SPEC-R11 | n3c |
| **LLD-C15** | `SettingsStore` seam + reference adapter | `.../settings/{store.ts, memory-store.ts}` (+ `.test.ts`) | SPEC-R12 | n3d |
| **LLD-C16** | app barrel + size line-items + layering trip-wire + reviewer gate | `app/src/index.ts` · `app/src/layering.test.ts` · `scripts/measure-size.mjs` | SPEC-R13, R14 | n4a, n4b |

No orphan components (each traces to a SPEC-R); no SPEC-R without a component.

---

## 2. Phase 1 — `ui-split` (components tier). The wave's hardest contract.

### 2.1 LLD-C1 — `ui-split` + `ui-split-pane` (→ SPEC-R1, R2)

Two elements under `controls/split/` (one folder, the packaging law):
- **`ui-split`** — the container. `axis` (reflected `'horizontal'|'vertical'`, default `horizontal`), `sizes` (a **property**, `number[] | undefined` — a JS array, NOT an attribute; too structured to reflect). Light-DOM; host-as-grid over its `ui-split-pane` children + the injected separators. **Base class = fork F1** (`UIContainerElement` if it earns surface/box-model participation, else `UIElement`; recommend `UIContainerElement` for parity with `ui-row`/`-column`/`-grid`, all `UIContainerElement`). `formAssociated: false`.
- **`ui-split-pane`** — the generic pane. `initial` (`number | undefined`, the ratio seed — renamed from `size` at build: the family-coherence A2 gate reserves that name for the widget enum; review-ratified), `min`/`max` (CSS length strings), `collapsible` (boolean). Reflected where an attribute selector needs them (`min`/`max` drive CSS clamp via custom props; `collapsible` gates the Enter keybind). Host-as-block over its own light children.

```ts
const splitProps = {
  axis: { ...prop.enum(['horizontal','vertical'], 'horizontal'), reflect: true },
  // `sizes` is a PROPERTY (structured array) — not in the reflected attribute set; the descriptor
  // declares it type=array (ADR-0004), the contract↔props trip-wire targets the property.
  sizes: prop.array<number>(),        // undefined ⇒ UNCONTROLLED (internal ratios); present ⇒ CONTROLLED
} satisfies PropsSchema
const paneProps = {
  initial: prop.number(),                // undefined ⇒ equal-share seed
  min:  { ...prop.string(''), reflect: true },   // CSS length; '' ⇒ the --ui-split-pane-min floor
  max:  { ...prop.string(''), reflect: true },
  collapsible: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema
```

**Sizing realization.** The container is a CSS grid/flex along `axis`; each pane's extent is a CSS custom property `--pane-ratio-{i}` (or a `grid-template` string) the element writes from the resolved ratios; the separators sit between tracks. Uncontrolled: the element holds a `signal<number[]>` of ratios, seeded in `connected()` from panes' `initial` (equal-fill the rest, normalize to sum 1). Controlled (`sizes` present): the element **renders** `sizes` and, on user resize, **emits** the proposal but does NOT mutate `sizes` (prop-as-source-of-truth, ADR-0102) — the consumer writes it back or it does not move (SPEC-R2 AC3).

**Failure/edge handling.**
- *0/1 pane* — no separators; the single pane fills. No throw.
- *`sizes` length ≠ pane count* — reconcile to pane count (truncate extra, equal-fill missing), `console.warn` once. No throw (SPEC-R2 AC4).
- *Dynamic panes (add/remove after connect) — NOW REQUIRED (SPEC-R2, M1 repair), realized by fork F3's `MutationObserver`.* A `MutationObserver` on the light child list re-derives the separator set (N−1) and re-normalizes the ratio vector on every pane add/remove: a removed pane's ratio is redistributed to the survivors (normalize to sum 1); an added pane is seeded from its `initial` or an equal share taken proportionally from the others — never an orphaned/missing separator, never a throw. **Mid-drag mutation (SPEC-R2 M2):** the observer callback calls `paneResize`'s `abortDrag()` (C2) FIRST when the count changed during an in-flight drag, settling at the pre-mutation ratios before re-deriving. Static-at-connect is no longer an acceptable fallback (SPEC-R2 mandates dynamism — the app-tier consumers depend on it); the observer is in scope for `ui-split`.
- *Deep-import guard* — `split.ts` imports only `../../dom` + `../../traits` (inward); the components `layering.test.ts` (SPEC-R13) guards it.

### 2.2 LLD-C2 — the pane-resize gesture controller (→ SPEC-R3, R4)

**Finding (SPEC-R3): the shipped `value-drag` trait does not fit.** `value-drag` is 1-D, horizontal, LTR-only (`ratioFromX = (clientX − rect.left)/width`) and maps ONE track to ONE `[min,max]` value via `onValue`. `ui-split` needs, per separator: an **axis-aware** mapping (`clientX` OR `clientY`), an **RTL-aware** mapping (`(rect.right − clientX)/width` when `direction: rtl`), and a **delta** (not an absolute value) fed to the two-neighbor solver. **Fork F2 — recommend a NEW `traits/pane-resize.ts` controller**, modeled on `value-drag` + `slider-multi`'s nearer-handle gate, NOT a generalization of `value-drag` (widening `value-drag`'s contract risks the shipped `ui-slider`/`ui-slider-multi` — the test-the-whole-shape law; a sibling trait is zero-risk and the two stay independently testable).

`pane-resize.ts` shape (mirrors `value-drag`'s host-scoped listener + per-drag AbortController lifetime):
```ts
export interface PaneResizeOptions {
  separators: () => HTMLElement[]          // live: the current separators (re-read on pointerdown)
  axis: () => 'horizontal' | 'vertical'
  rtl: () => boolean                       // getComputedStyle(host).direction === 'rtl'
  onResize: (separatorIndex: number, deltaRatio: number, commit: boolean) => void  // → the C3 solver
}
export function paneResize(host: UIElement, opts: PaneResizeOptions): () => void
```
Protocol: `pointerdown` on a separator → identify its index (the nearer-handle gate: `event.target.closest('[data-separator]')`) → `setPointerCapture` → `pointermove` computes `deltaRatio` along `axis` (RTL-inverted for horizontal) since the press point → `onResize(i, delta, false)` (live, drives an `input`) → `pointerup`/`lostpointercapture`/`pointercancel` → `onResize(i, finalDelta, true)` (commit, drives a `change`). Keyboard lives in the ELEMENT (C1/C4), not the gesture controller (the roving-focus split: gesture ≠ key), OR the controller exposes a `keyStep(i, dir)` helper — recommend keyboard in the element's own keydown effect (it needs the ARIA/`aria-valuenow` write anyway).

**Failure/edge handling.** Per-drag AbortController bounds all move/up listeners (the `value-drag` pattern — zero residue). A press that misses a separator is ignored. `rect.width/height ≤ 0` ⇒ delta 0 (degenerate). Pointer id tracked to ignore secondary pointers mid-drag. **Mid-drag pane mutation (SPEC-R2 M2):** `paneResize` MUST expose an **`abortDrag()`** on its return (or the returned cleanup doubles as it) so the element's MutationObserver (C1) can **abort an in-flight drag when the pane count changes** — the captured separator index is stale after add/remove; abort → settle at the pre-mutation ratios → re-derive. Freeze-and-continue is NOT the contract (resizes against a stale index).

**Test-drive (SPEC-R3 INSTRUMENT-BRIDGE — the fleet's only cross-engine drag precedent).** The browser gate CANNOT call real `setPointerCapture`: a synthetic `PointerEvent` is not an active pointer, so `setPointerCapture(pointerId)` throws `NotFoundError` in Playwright/WebKit (`slider.browser.test.ts:30-31,379-381` stubs it; `slider-multi.browser.test.ts:45-60` too). So `pane-resize.test.ts`/`split.browser.test.ts` drive drags via **synthetic `dispatchEvent(new PointerEvent(...))` + a stubbed `setPointerCapture` no-op** (the slider helper `stubCapture`). **Capture-continuity is proven STRUCTURALLY, not via real capture:** because the move/up listeners live on the per-drag AbortController (not the separator's hover/`pointerleave` lifetime), a synthetic `pointermove` dispatched after a synthetic `pointerleave` still resizes — the assertion that bites is binding the listeners to the wrong lifetime. **Re-test trigger:** promote to real-capture continuity when Playwright drives synthetic events as active pointers (the deferred trigger the slider tests already carry). "Real pointer/real drag" phrasing is retired from this LLD (C7 below) and SPEC-R3/R6.

### 2.3 LLD-C3 — the constraint solver (→ SPEC-R2)

A pure function `constrain.ts` (separately unit-tested — the hard math isolated from the DOM, the `value-codec` precedent):
```ts
// Two-neighbor local redistribution. Given current ratios, the separator index, a requested delta,
// and each pane's [minRatio, maxRatio] window, return the new ratios (sum-invariant, clamped).
function redistribute(ratios: number[], sepIndex: number, deltaRatio: number,
                      bounds: Array<[number, number]>): number[]
```
Semantics: `i = sepIndex`, `j = i+1`. Proposed: `ratios[i] + delta`, `ratios[j] - delta`. Clamp `delta` to the tightest of: `ratios[i]` can't exceed `bounds[i].max` or drop below `bounds[i].min`; likewise `ratios[j]`. The **binding constraint** is `min(delta_max_from_i, delta_max_from_j)` — the residual is **dropped** (local clamp; push-through to pane `i+2` is reserved, fork F5). All other ratios unchanged. Post-condition asserted in the test: `sum(new) == sum(old)` (±ε), every ratio within its bounds.

**Failure/edge handling.** `min`/`max` given as CSS lengths (px, rem, %) — resolved to ratios against the measured container extent at drag time (the element measures, passes `bounds` in ratio space to the pure solver, keeping `constrain.ts` DOM-free). Unset `min` ⇒ the `--ui-split-pane-min` floor (a small default, e.g. `2rem` → ratio); unset `max` ⇒ 1. Contradictory bounds (min>max) ⇒ clamp to min, warn.

### 2.4 LLD-C4 — separator management + ARIA (→ SPEC-R1, R4)

The element renders **one separator element per adjacent pane pair** in `connected()` (and on the MutationObserver re-derive, C1). Each separator: a `<div data-separator role="separator" tabindex="0">` with a reactive effect writing `aria-orientation` (`axis`), `aria-controls` (the primary/leading pane's id — assign pane ids if absent), `aria-valuenow`/`-valuemin`/`-valuemax` (integer % of the two-neighbor pair's combined extent, from the current ratios + bounds), and `aria-label` (default `"Resize panel"`, overridable). A keydown effect on the separator maps Arrow (axis+RTL logical), Home/End, Enter (if the leading pane is `collapsible`) → a `keyStep`/snap → the C3 solver → ratios update → `aria-valuenow` re-derives → an `input`+`change`.

**Failure/edge handling.** Separators are control-owned — removed/re-created on pane-count change (never orphaned). `aria-valuenow` recomputed on every resize (SPEC-R4). RTL logical mapping: ArrowRight → `deltaRatio` sign inverted when `rtl` (SPEC-R4 AC3). Enter with a non-collapsible leading pane is a no-op (documented).

### 2.5 LLD-C5 — `ui-split.css` (→ SPEC-R1, R5)

Single `split.css`, sectioned (ADR-0003): a `:where(ui-split)` block declaring only `--ui-split-*` (`--ui-split-divider` thickness, `--ui-split-hit-slop`, `--ui-split-pane-min`, `--ui-split-key-step`, the divider ink + focus roles), then `@scope (ui-split)`. **Geometry = Container/layout size-class** (geometry §"the five size-classes"): NO control height, NO `--ui-height-*`; the divider + hit-slop are layout dimensions. The separator visual is a thin divider (`--ui-split-divider`, e.g. 1px) with a **transparent hit-slop** (`padding`/`::before` expanding the pointer target to ≥24px on the cross-axis, SPEC-R5 AC1) that does NOT displace the pane tracks (absolutely-positioned slop or negative margins). Focus ring via the interaction-states law on `:focus-visible`. **Forced-colors:** the divider is a real `border`/`currentColor` (never fill-only) so it survives `forced-colors: active` (SPEC-R5 AC2; watch the `*/`-in-comment CSS pitfall — browser-smoke-only catch). RTL: the axis mapping is logical (`inline-size`/`block-size`), the JS drag handles the physical inversion (C2).

**Failure/edge handling.** Zero-width container ⇒ tracks collapse without error. Reduced-motion: no resize transition by default; any optional transition wrapped in `@media (prefers-reduced-motion: no-preference)` and disabled during active drag (a `[data-dragging]` state).

### 2.6 LLD-C6/C7 — descriptors + gates (→ SPEC-R6, R1..R5)

- **C6 descriptors** (`split.md` + `split-pane.md`): frontmatter per ADR-0004; `tier: layout`; `extends: UIContainerElement`; `attributes[]` mirrors `static props` (incl. `sizes` as `type: array`, a **property** not a reflected attribute — the descriptor marks it accordingly); `marginal:` line measured at build. Contract↔props trip-wire must equal `finalize(UISplitElement)`/`finalize(UISplitPaneElement)`.
- **C7 gates.** jsdom `split.test.ts`: prop→DOM mapping; separator count = N−1; `aria-*` on separators; keyboard step → ratio + `aria-valuenow` (incl. RTL logical mapping + out-of-set `axis` coercion); the C3 solver's sum-invariance + clamp via the element; `sizes` length-mismatch reconcile; **dynamic panes** (append/remove → separators + ratios re-derive, sum 1, no throw — SPEC-R2 AC5); **mid-drag mutation** (a count change during a synthetic in-flight drag aborts it and settles at pre-mutation ratios — SPEC-R2 AC6, biting NC: the resize continues against the stale index). Browser `split.browser.test.ts` (**Chromium AND WebKit**, **synthetic-dispatch + stubbed `setPointerCapture`** — the slider `stubCapture` precedent, NOT real pointer capture): whole-shape (N panes + N−1 separators, non-zero boxes, tile the container ±1px); a **synthetic drag** (`pointerdown`→`pointermove`s→`pointerup`) resizes adjacent panes with one `change` on release + `input` per move; **capture-continuity STRUCTURAL** (a `pointermove` after a `pointerleave`, before `pointerup`, still resizes — the AbortController-lifetime proof, biting NC: listeners bound to the separator's `pointerleave` lifetime); the **RTL** drag inversion; **clamp** at `min` (biting NC: drop the clamp); **touch-target** ≥24px (biting NC: remove the slop); **forced-colors** divider visible; **keyboard** Arrow/Home/End. Each new leg ships a biting negative control. **Re-test trigger (deferred):** promote the continuity leg to real `setPointerCapture` when Playwright drives synthetic events as active pointers (the slider tests' standing trigger).

### 2.7 LLD-C8 — catalog disposition (→ SPEC-R6)

When `split.md` lands, the a2ui whole-fleet coverage gate (`a2ui/src/catalog/default/index.test.ts`, SPEC-N2, ADR-0087) demands `ui-split` resolve. **Recommend: add a `Split` container row** to `catalog.json` (+ a `ui-split` factory in `factories.ts`) — parity with the already-bound `Row`/`Column`/`Grid`/`Slider`/`SliderMulti`/`List` (verified in `catalog.json`, 44 components). The row exposes `axis` + initial `sizes` + a `ChildList` of panes; the resize is a host-owned affordance (as `Slider`'s drag is). **Fallback:** if the build finds the resize can't be safely agent-parameterized, add a cited `EXCLUSION_ALLOWLIST` entry (the ADR-0117 `ThemeProvider`/app-owner-chrome precedent) — no residue either way (the gate is red on an unresolved control).

**Failure/edge handling.** `ui-split-pane` is a structural child of `Split` (a `ChildList` template item) — *CONFIRMED AT BUILD (2026-07-10): the guess here was backwards — `CardHeader`/`-Content`/`-Footer` each carry their OWN catalog row (structural = own row + ChildList, no `value` mark), and the fleet-derived coverage gate requires the same of `SplitPane`; landed accordingly.*

---

## 3. Phase 2 — app-tier panes chrome (`@agent-ui/app`)

### 3.1 LLD-C10 — `ui-master-detail` (→ SPEC-R7)

`app/src/controls/master-detail/master-detail.ts`: a `UIElement` composing `ui-split` (list | detail) wide, drilling in narrow (a container-query threshold, the M1 shell precedent). Props: `selected` (reflected, item key). Slots/regions: a `list` and a `detail` region (fork F8 — authored sub-elements `ui-master-detail-list`/`-detail`, OR named slots; recommend the M1 generic-region precedent: two light-DOM regions the element arranges). Emits `select`/`change` on selection. Narrow: a `[data-view=list|detail]` state (driven by whether `selected` is set + the container width) toggles which region shows + a back affordance. **Imports only `@agent-ui/components` (incl. `ui-split`) — NEVER `@agent-ui/router`** (SPEC-R13).

**Failure/edge handling.** No selection narrow ⇒ show the list. Wide ⇒ both via `ui-split` (the split's own resize/keyboard/DoD is inherited — master-detail adds no bespoke split code, SPEC-R7). Selection binding to a URL is the consumer's 3 lines (ADR-0115); the element exposes state/events only.

### 3.2 LLD-C11 — `collapse:"toggle"` realized (→ SPEC-R8)

Edit `app-shell.ts`: add `'toggle'` to `COLLAPSE_VALUES` (`['hide','stack','toggle']`). A `collapse="toggle"` region gains a **user-collapsible affordance** (a toggle button in the region, or a host-level expander) that flips a `collapsed` custom-state and emits a `toggle` event (allow-listed). Edit **BOTH** grid copies (the LLD-C5 keep-in-sync obligation from `agent-app-shell.lld.md`): the base `app-shell.css` AND the injected isolated `:host` mirror `app-shell-isolation.css` gain the `[collapse=toggle]` + `[data-collapsed]`/`:state(collapsed)` rules — **stack/toggle rules stay AFTER the hide rule** (the source-order caveat: equal specificity, source order wins; a reorder silently inverts the fix). **Wide-layout-unchanged invariant (SPEC-R8 AC2):** the collapsed state is opt-in per user action; the expanded wide layout is byte-identical to today — the toggle rules only bite when `[data-collapsed]` is set.

**Failure/edge handling.** A `collapse="toggle"` region with no interactive affordance authored ⇒ the element provides a default expander (the region can't become unreachable). Isolation ON: the mirror carries the rule (SPEC-R8 AC3, biting NC = omit it from the mirror). Keyboard-operable affordance (SPEC-R8 AC1).

⚠️ **This edits shipped, gate-green M1 files** — the reviewer + full M1 browser suite (app-shell) MUST stay green (no regression to `hide`/`stack`); treat as a shipped-control change under the fleet DoD.

---

## 4. Phase 3 — the settings surface + schema framework (`@agent-ui/app`)

> Phased shell → framework (SPEC-R9 before R10..R12; ADR-0120 clause 4).

### 4.1 LLD-C12 — `ui-settings` shell (→ SPEC-R9)

`app/src/controls/settings/settings.ts`: a `UIElement` presenting a **sections rail** (navigation) + **panel** area (main), composing the M1 shell + `ui-split`/layout family. Props: `schema` (property, C13), `store` (property, C15), `section` (reflected, active section id). Wide: rail + active panel together; narrow: drill in (rail → panel + back), the master-detail drill-in mechanism (fork F8 — recommend `ui-settings` **composes `ui-master-detail`** for the rail|panel layout + drill-in, so the drill-in behavior is built once; settings adds the schema-driven panels on top). Emits `select`/`change` on section change. **NEVER imports `@agent-ui/router`** (SPEC-R13).

### 4.2 LLD-C13 — schema types + field→control registry + generator (→ SPEC-R10, R11)

- **`schema.ts`** — the `SettingsSchema`/`SettingsSection`/`SettingsField` types (SPEC §4) + the **field-type → control registry** (the ADR-0065 swappable-pack precedent): a `Record<FieldType, (field) => HTMLElement>` mapping `text→ui-text-field`, `number→ui-text-field[type=number]` (+ the numeric codec), `boolean→ui-switch`, `select→ui-select`(+options), `slider→ui-slider`, `date→ui-text-field[type=date]`. An unknown type → a disabled placeholder factory + a one-shot warn (SPEC-R10 AC2). The registry is a seam (a consumer could extend it) but v1 ships the fixed set.
- **`generate.ts`** — the schema→form-out generator: for each section, build a `ui-form-provider` wrapping one `ui-field` per field (label/description/`for` from the schema) wrapping the registry-produced control, with the `default`/store value applied. **0 app-authored form CSS** — the generated tree is fleet controls only (SPEC-R11 AC1).

**Failure/edge handling.** Unsupported `version` (≠1) → the surface renders an empty/notice state + warns (SPEC-R10 AC3), never crashes. A `select` field with no `options` → an empty select + warn. The generator writes ids/`for` deterministically (the `field.ts` `fieldSeq` precedent) so labels associate.

### 4.3 LLD-C14 — validation wiring (→ SPEC-R11)

`validate.ts`: map each `Field.validation` onto the generated control's **own validity** — `required`/`min`/`max`/`step`/`pattern` via the control's native constraint props where they exist (text-field/number/slider), else a `setCustomValidity` write on a reactive effect over the value. Errors then render through the control's existing `user-invalid` timing + the `ui-field` error part + the `ui-form-provider` aggregate (ADR-0050/0051) — **no second timing source, no bespoke validation engine** (the ADR-0051 reactive-error law; the two shipped error-timing bugs are the cautionary precedent). Submit/commit uses the provider's `submit()`/`valid()` aggregate.

**Failure/edge handling.** A `pattern` on a non-text control → ignored + warn (type mismatch). `min>max` in a field → the schema is the author's error, surfaced by a dev warn, clamped. Validation timing is the control's own (`user-invalid` after interaction) — the framework only wires the constraint, it does not re-time.

### 4.4 LLD-C15 — `SettingsStore` seam + reference adapter (→ SPEC-R12)

- **`store.ts`** — the `SettingsStore` interface only (`get`/`set`/optional `subscribe`; fork F7 — sync `get`/`set` vs async `load`/`save`; **recommend sync `get`/`set` + optional `subscribe`** for v1, with an optional batch `save(values)` for stores that prefer it; async remote sync is out-of-scope, PRD fence). `ui-settings` reads initial values via `store.get(key) ?? field.default`, writes via `store.set(key, value)` on commit. Timing (fork): per-field-on-change (recommend) vs batched-on-save; the element supports both via a `commit` mode — recommend per-field-on-`change` with dirty tracking, a batched `save()` exposed as a method for a save-button flow.
- **`memory-store.ts`** — a reference in-memory (or `localStorage`-backed) `SettingsStore` for the demo/tests. **`ui-settings` imports only the `store.ts` interface, never a concrete store** (SPEC-R12 AC3 — the seam is a contract; grep-guarded).

**Failure/edge handling.** No store supplied → render from `field.default`, no throw (SPEC-R12 AC2). `store.get` returning a type-mismatched value → coerce via the control's codec or fall back to `default` + warn. `subscribe` absent → no external-change reactivity (documented; the store is authoritative on read).

---

## 5. Cross-cutting — LLD-C9/C16

- **LLD-C9 / C16 — budget re-base (→ SPEC-R14).** `scripts/measure-size.mjs`: the components family ceiling re-based **measured-at-build** (provisional 32 KB gz — current 30 KB ceiling at ~127 B headroom + `ui-split`'s marginal; the ceiling is the worst-case-all-defined figure, the real gate is `ui-split`'s per-control leave-one-out marginal ≤ the ~2 KB `MARGINAL_BUDGET_DEFAULT`). The `@agent-ui/app` line gains `ui-master-detail` + `ui-settings` marginals; its ceiling re-based measured-at-build (M1 was ≤3 KB provisional). **Single-writer:** `measure-size.mjs` is edited once, in the integration slice. A planted over-budget number proves the gate bites.
- **LLD-C16 — layering trip-wire + barrel + reviewer.** `app/src/index.ts` exports `UIMasterDetailElement`/`UISettingsElement` (+ the settings types/store interface). **No hole to close** — `app/src/layering.test.ts`'s `isAllowedAppSpecifier` allowlist already admits only `{components, a2ui, shared, local}`, so `@agent-ui/router` fails the existing gate by construction. The M4 work is a **named negative-control** (SPEC-R13 AC2): plant a `@agent-ui/router` import under `app/src` (unique-token NC, grep-confirmed applied then reverted), prove the EXISTING test turns RED — making the no-`router` edge explicit for the reader, not adding a new assertion. The components `layering.test.ts` already guards `ui-split`'s inward-only imports (re-run as the folder lands). **Reviewer gate:** `component-reviewer` GO ≥4 both axes on `ui-split` (the load-bearing one), `ui-master-detail`, `ui-settings` BEFORE each phase's commit.

---

## 6. Build sequence — three dispatchable phases (one-writer-per-file within each)

The wave is multi-seat-sized (ADR-0120). Sequence in three phases the host can dispatch separately; within a phase the files are writer-disjoint.

**Phase 1 — `ui-split` (components tier). The gate for everything else.**
1. LLD-C3 `constrain.ts` (pure solver + tests) ∥ LLD-C2 `pane-resize.ts` (trait + tests) — DOM-free/trait, parallel-safe.
2. LLD-C1 + C4 + C5 + C6 `ui-split`/`ui-split-pane` (element + separators + CSS + descriptors) — one owning slice (`controls/split/`).
3. LLD-C7 gates (jsdom + cross-engine browser drag/keyboard/whole-shape/RTL/touch/forced-colors).
4. LLD-C8 catalog disposition (`Split` row OR allowlist; the a2ui coverage gate green).
5. LLD-C9 budget re-base (measure `ui-split`'s marginal; name the new ceiling).
6. **Reviewer gate:** `component-reviewer` GO ≥4 both axes on `ui-split` BEFORE the Phase-1 commit (the whole-shape + synthetic-drag DoD, SPEC-R3 INSTRUMENT-BRIDGE; the overlay-wave discipline).

**Phase 2 — app-tier panes chrome (after Phase 1 ships `ui-split`).**
7. LLD-C10 `ui-master-detail` (composes `ui-split`) + gates + descriptor.
8. LLD-C11 `collapse:"toggle"` realized (edits shipped M1 app-shell files — both grid copies keep-in-sync, source-order preserved; M1 app-shell suite stays green).
9. Reviewer gate on `ui-master-detail` + the region change before the Phase-2 commit.

**Phase 3 — settings surface + schema framework (after Phase 2; phased shell → framework).**
10. LLD-C12 `ui-settings` shell (composes `ui-master-detail`/`ui-split`) + drill-in gates.
11. LLD-C13 schema types + registry + generator ∥ LLD-C15 store seam + reference adapter (disjoint files).
12. LLD-C14 validation wiring (after C13 — wires onto the generated controls).
13. LLD-C16 app barrel + layering trip-wire extension + size line-items (single-writer integration) + reviewer gate on `ui-settings` before the Phase-3 commit.

Gates green before each phase's commit: `npm run check` (+`check:site`) · `npm test` + `npm run test:browser` (Chromium AND WebKit) · `npm run size` (manual, ADR-0040 §3).

---

## 7. Failure/edge summary (cross-cutting)

- **Cross-engine divergence** — every browser leg runs Chromium AND WebKit; a one-engine pass is a fail (the 18-bug overlay-wave lesson; `ui-split`'s drag gesture + RTL sense + capture-continuity are the highest-risk since overlays — all driven via the SPEC-R3 synthetic INSTRUMENT-BRIDGE, not real capture).
- **Shipped-file edits (LLD-C11)** — realizing `collapse:"toggle"` touches gate-green M1 files; the keep-in-sync (both grid copies) + source-order caveat are the drift traps; the M1 app-shell suite is the regression guard.
- **Prop-as-source-of-truth (`sizes`, `selected`, `section`)** — controlled props are never self-mutated (ADR-0102); the control emits, the consumer writes back.
- **Token migration** — pin ROLE-level color mappings only (`--md-sys-color-*` roles); NEVER edit `tokens.css` or `site/lib/__fixtures__/` (another seat owns the migration).
- **Negative-control discipline** — each new gate's NC anchored on a unique token, grep-confirmed applied before trusting green.

## 8. Forks — recommended, NOT self-ratified (need Kim/an ADR if contested)

1. **F1 — `ui-split` base class.** *Recommend `UIContainerElement`* (parity with `ui-row`/`-column`/`-grid`; earns the box-model participation). Alt: `UIElement` if it paints no surface. Low-stakes; the LLD picks `UIContainerElement`, confirm at build.
2. **F2 — pane-resize: new trait vs generalize `value-drag`.** *Recommend a NEW `traits/pane-resize.ts`* (zero risk to shipped `ui-slider`/`-multi`; `value-drag`'s 1-D/LTR contract doesn't fit N separators + RTL + delta semantics). Contested only if the size budget objects — but a sibling trait is trivially tree-shaken.
3. **F3 — dynamic panes. RESOLVED by SPEC-R2 (M1 repair) — no longer open.** Dynamism (add/remove after connect) is now a REQUIRED behavior; the `MutationObserver` re-deriving separators + ratios (+ `abortDrag()` on a mid-drag count change, SPEC-R2 M2) is its realization. Static-at-connect is no longer an acceptable alternative.
4. **F4 — `aria-valuenow` scale. SPEC-RESOLVED (SPEC-R4) — no longer open.** SPEC-R4 normatively fixes it: integer % of the two-neighbor pair's combined extent (`valuemin`/`valuemax` = the clamp window) — the most announceable scale, matching the two-neighbor semantics. Recorded here only as the rationale trail, not a decision awaiting a ruling.
5. **F5 — push-through (cascade a clamped delta to non-adjacent panes).** *Recommend RESERVED for v2* (local clamp at v1 — predictable, matches VS Code sash behavior + the one-separator-per-pair ARIA model). Not built at M4.
6. **F7 — `SettingsStore` sync vs async.** *Recommend sync `get`/`set` + optional `subscribe`* (+ optional batch `save`); async/remote sync is out-of-scope (PRD fence). Revisit if a real async store need appears.
7. **F8 — settings shell composes master-detail vs bespoke.** *Recommend `ui-settings` composes `ui-master-detail`* for the rail|panel drill-in (build the drill-in once), adding the schema-driven panels on top. Alt: settings has its own shell. Recommend reuse.
8. **F-catalog — `Split` row vs `EXCLUSION_ALLOWLIST`.** *Recommend a `Split` container row* (parity with the bound layout+slider family). The allowlist arm is the fallback if resize can't be agent-parameterized safely. Resolved at the C8 build against the catalog's real shape.
