# LLD — `ui-multi-select` (M-F multi-select field)

> Refines: [SPEC — Multi-Select Field](../spec/multi-select-field.spec.md) (accepted v0.1 —
> SPEC-R1..R10 / SPEC-N1..N4; this LLD resolves the four Open forks the SPEC carried forward
> unresolved, §5 there) · [ADR-0175](../adr/0175-association-multiselect-field-design-intake.md)
> (accepted — the ratified architecture this LLD builds: mint a record-edit field primitive,
> single-slot array value, association/relationship editing fenced out). · proposed · v0.1 ·
> 2026-08-07 · planner (design seat) · Layer: LLD (implementation plan)
>
> **Composes on:** the shipped `rovingFocus` / `selectionCommit` traits
> (`listbox-roving.lld.md` LLD-C1/C2 · `traits/roving-focus.ts` · `traits/selection-commit.ts`) ·
> `UIFormElement` (`dom/form.ts`, ADR-0013 — `FormValue` already includes `FormData`, zero base
> widening) · the `ui-select` / `ui-combo-box` composition idiom (traits composed directly on the
> control, never via extending `UIListboxElement` — `controls/select/select.ts` ·
> `controls/combo-box/combo-box.ts`) · `Table.selected`'s array-typed single-slot precedent
> (ADR-0163 cl.9, `controls/table/table.ts`) · `ui-checkbox`'s CSS-only glyph-paint anatomy
> (`checkbox.css`/`checkbox.md` — no shadow DOM, no per-node JS injection) · the geometry-by-part
> composite pattern (`select.md`'s `tier: pattern`) · `ChoicePicker`'s `options` PropDef shape +
> child-rebuild factory (`a2ui-basic/factories.ts:320-332`).
>
> **Freeze discipline.** §3 is the fan-out contract for the builder seat — one writer per
> file/slice below; a builder who finds a seam unworkable STOPS and escalates (a coordinated
> LLD repair) rather than improvising past this document.

## 1 · Intent

Close SPEC-R1..R10 with one new FACE control, `ui-multi-select` (`UIMultiSelectElement extends
UIFormElement`): an **always-visible, non-overlay listbox** whose `[role=option]` rows paint a
CSS-only checkmark on selection, toggled by plain click/Space/Enter (no modifier keys), aggregating
into one bindable `value: string[]` prop and one `select` commit event. No trigger, no popup, no
active-descendant — the simplest anatomy that satisfies cl.3's own scope ("plain multi-pick from a
fixed, already-loaded option list"). Two catalog rows close the wire: the default catalog's new
widget type (SPEC-R9) and the `a2ui-basic` E6 drain (SPEC-R10), shipped in the same build (OF4).

## 2 · Open forks ruled (OF1–OF4)

| Fork | Ruling | Argument |
|---|---|---|
| **OF1** — internal anatomy | **Listbox-with-checkmarks**: an inline (non-overlay) `role=listbox` extending the shipped multi-mode `selectionCommit`/`rovingFocus` trait pair — the SAME machinery `controls/_base/listbox-element.ts` (`UIListboxElement`, shipped, tested, but never consumed by a real tag) already wires for exactly this shape, incl. a `multiple` prop and a Set-of-keys selection model. | Reuses PROVEN, shipped trait plumbing (rovingFocus + selectionCommit, `listbox-roving.lld.md` LLD-C1/C2) instead of inventing a new interaction model; `UIListboxElement`'s own doc comment already anticipates "a list for multi" as `formValue()`'s multi-select case — `ui-multi-select` is that base's first real spiritual consumer (composed, not extended — §3 LLD-C1 explains why extension is wrong). Rejected: **checkbox-children** (ADR-0175 cl.1's other named candidate) — would need a NEW aggregation shell reducing N `ui-checkbox` commits into one array/event, duplicating what `selectionCommit` already solves in one call. Rejected: **chips+popup** — overlay positioning + a removable-chip affordance is unearned complexity for a small fixed list (cl.3's own framing) and reads as reaching toward the fenced-out "currently assigned, removable" relationship-editor shape (cl.3, SPEC-N1) — a scope violation, not just a KISS one. |
| **OF2** — second value-mark slot | **Not needed.** The listbox anatomy has no embedded query/filter prop (SPEC-N1 fences out search); the control's only committed state is the array selection SPEC-R2 already marks. | SPEC §5 routed this "only if the LLD's chosen anatomy needs one" — OF1's anatomy carries no second committable prop, so the SPEC's single `{prop:'value',event:'select'}` mark is the whole wire contract; ADR-0161's multi-slot mechanism stays unconsumed by this primitive, exactly as ADR-0175 cl.2 anticipated as the likely (not certain) outcome. |
| **OF3** — catalog `options` shape | **`PropDef` array of `{label, value}`** — byte-identical to `ChoicePicker.options` (`a2ui-basic/catalog.json:145-156`), not reconciled `children`. | Reuses a shape ALREADY shipped twice over (the default catalog would be a third consumer of the same `{label,value}[]` PropDef `Table.columns`/`ChoicePicker.options` both already use) and lets the new factory's option-rebuild function be a near-verbatim adaptation of `applyChoicePickerOptions` (`a2ui-basic/factories.ts:320-332` — array-in, `[role=option]` children out, a full-rebuild "whole-array bindable prop" per SPEC-R3's own citation of `Table.columns`/`Sparkline.values`). Keeps the DEFAULT catalog's row and the `a2ui-basic` E6 arm (SPEC-R10) sharing one options shape end to end — no shape drift between the two catalogs for the same underlying control. |
| **OF4** — E6-drain sequencing | **Same build**, not a follow-up. | Once OF1/OF3 are decided, SPEC-R10's new `a2ui-basic` factory arm is a near-zero-marginal add: same tag, same value mark, the SAME options-array shape/rebuild function SPEC-R9 already ships — there is no unresolved design risk left to de-risk by deferring (ADR-0169:486 already scoped E6's drain as "widening the declared enum + the factory", nothing more). Shipping both in one build closes GH #498's full recorded gap (default-catalog capability AND upstream interop) in one coherent PR instead of leaving an already-fully-specified drain dangling as a distinct ticket. Reversible: if the PR grows unwieldy, the builder may split step 6 (§12) into a follow-up without invalidating this ruling — the sequencing call is a risk judgment, not a hard gate. |

## 3 · Components (build slices)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| **LLD-C1** | `UIMultiSelectElement` — `extends UIFormElement` (NOT `UIListboxElement`; the `ui-select`/`ui-combo-box` idiom is COMPOSE the traits directly on the control so it owns its own public `value` prop — `UIListboxElement`'s `#selection` is private and its `formValue()` returns a joined string, wrong shape for SPEC-R5). `static props` spreads `UIFormElement.formProps` + `value` (LLD-C2's codec) + `label` (ADR-0085 bare-usage pattern, `select.md`/`combo-box.md` precedent) + `size` (`enum[sm,md,lg]`, default `md`, reflects — LLD-C5's geometry dial). `connected()`: `this.internals.role = 'listbox'`; `this.internals.ariaMultiSelectable = 'true'` (a real ARIAMixin IDL member — never a bespoke ARIA invention, SPEC-R8); `rovingFocus(this, { items, typeAhead: false })` (LLD-C5's keyboard note); `selectionCommit(this, { mode: 'multi-toggle', items, keyOf, onSelect: (selection) => { this.value = [...(selection as ReadonlySet<string>)] } })` (LLD-C4's new mode — `mode` is a compile-time-fixed constant here, never toggled at runtime, so the callback's `selection` is always the `ReadonlySet<string>` arm). `formValue()` — LLD-C6. `formValidity()` — `required && value.length === 0` → `valueMissing` (mirrors `UIListboxElement`'s own required-empty check, `listbox-element.ts:52-59`). `formReset()` — restores `value` to the array the `value` ATTRIBUTE held at connect time (the `combo-box.md` "the attribute seeds the reset baseline" convention). | `controls/multi-select/multi-select.ts` | SPEC-R1, R2, R6 |
| **LLD-C2** | The `value: string[]` prop's codec — an own, small `cleanValue(input): string[]` (drop non-string members, non-array input → `[]`) + a local safe-JSON `PropType<string[]>` (`from` try/catches `JSON.parse` + `clean`s, never throws; `to` = `JSON.stringify`) — the SAME PATTERN `table-model.ts`'s private `safeJsonCodec(cleanSelected)` already uses for `Table.selected`, copied locally (that codec is control-owned, not exported shared infra) because bare `prop.json()` (`dom/props.ts:73-82`) THROWS on malformed attribute JSON and returns `null` on absence — both violate SPEC-R4's "never `null`/`undefined`" floor. | `controls/multi-select/multi-select.ts` (co-located, mirrors `table-model.ts`'s in-file placement) | SPEC-R4 |
| **LLD-C3** | The checkmark anatomy — a NEW additive `data-role="check"` (anatomy.md's open-ended role axis, the `tag`/`badge`-reserved precedent extended) painted **CSS-only** as `[role=option]::before`, keyed off `[aria-selected="true"]` (which `selectionCommit` already reflects onto each option, `selection-commit.ts:70-77` — unchanged), `aria-hidden` by construction (the glyph never carries meaning; `aria-selected` does). Sized `= font` (an inline AFFORDANCE, rhythm family, the §4.1 caret law — NOT `--ui-ind`, the named oversize bug class), centered in an icon-sized leading cell (§1.4/§1.5's slot-presence pad model — same mechanics a trailing caret already uses, just leading position + a new role name; no new sizing mechanism). Zero DOM injection into author/catalog-adopted option nodes — matches `ui-checkbox`'s own "paints entirely in CSS `::before`, no shadow DOM" precedent, and respects that `[role=option]` children are authored/adopted light-DOM the control does not want to mutate structurally. | `controls/multi-select/multi-select.css` | SPEC-R8 |
| **LLD-C4** | `traits/selection-commit.ts` — add `'multi-toggle'` to `SelectionMode`. New arm: BOTH the click handler and the Enter-keydown handler unconditionally toggle the targeted item's Set membership, ignoring Shift/Ctrl modifiers entirely (no range-extend, no separate toggle-vs-replace branch — every commit path is "toggle this one item," full stop). Required because the EXISTING `'multi'` mode's plain click **replaces** the whole selection (`multiKeys = new Set([key])`, `selection-commit.ts:133-137` — the file-manager/`<select multiple>` convention) while its Enter handler already toggles (`:158-169`) — an internal click/Enter asymmetry that fails SPEC-R3's "plain click adds, never replaces" outcome AND SPEC-R8's "keyboard matches pointer byte-for-byte" contract if reused as-is. Additive only: `'single'`/`'multi'` stay byte-untouched (a regression probe in `selection-commit.test.ts` proves it) — this is the one piece of shared trait code the build touches outside the new folder. | `traits/selection-commit.ts` + `selection-commit.test.ts` | SPEC-R3, R8 |
| **LLD-C5** | Geometry row (SPEC-R7) — §7 below. `tier: pattern` composite: a VIRTUAL row-height lever `--ui-multi-select-{height,font,icon}` (never rendered as its own box — there is no trigger) sourced from the SAME `(scale × size) → §1-row` lookup `ui-select`'s trigger uses (ADR-0038): `sm`→row 24 (font 13, icon 16) · `md`→row 28 (font 14, icon 18, the default, byte-identical) · `lg`→row 36 (font 16, icon 20). Listbox surface = Container/surface (`--ui-multi-select-listbox-{bg,radius,padding,min-inline-size,max-block-size}`, `padding = h/4`, the 12-row scroll-cap formula — both DERIVED off the lever, `select.md`'s own listbox-token mechanism copied). Option rows = legacy item-pad (`--ui-multi-select-option-{block,inline,font}`, `paddingBlock = (h−font)/2`, `paddingInline = h/4` — `select.md`'s options-token mechanism copied, `listbox-roving.lld.md` LLD-C5's own "rows are not Indicator widgets" ruling). Checkmark glyph (LLD-C3) `= font`. | `controls/multi-select/multi-select.css` | SPEC-R7 |
| **LLD-C6** | `formValue()` — builds `new FormData()`, `.append(this.name, v)` for every `v` of `this.value` (SPEC-R5's own mechanism: passing a `FormData` to `internals.setFormValue` submits ITS OWN key/value pairs verbatim, not re-keyed by the element's `name` — so `.append(this.name, v)` per selection member is what produces "multiple entries under `name`," per Fact 4's own reading of `dom/form.ts:62`/`:353-356`). Zero selections → an empty `FormData()` (zero `.append` calls) → the platform submits NOTHING, matching native `<select multiple>` empty-selection parity with no special-case code. | `controls/multi-select/multi-select.ts` | SPEC-R5 |

## 4 · Anatomy

No trigger, no popup, no overlay-controller composition — an inline block-level `role=listbox`
surface (via `ElementInternals`, never a host attribute — the FACE pattern every sibling in §Composes
follows) holding author- or catalog-adopted `[role=option]` children, moved/adopted at connect AND
on every later light-DOM mutation via a `MutationObserver` on the host's own `childList` — the SAME
TKT-0026 pattern `select.ts`/`combo-box.ts` each already carry (copied locally here too; the fleet
has not extracted this pattern after its SECOND consumer, so this LLD does not force an extraction
at its third either — flagged, not required, §13). Each option needs a `value` attribute (the
selection key) and text content (the label) — unchanged from `ui-select`'s own option contract.

## 5 · Keyboard interaction (realizes SPEC-R8's outcome contract)

| Keys | Action |
|---|---|
| ArrowDown / ArrowUp | Moves roving focus to the next/previous non-disabled option (vertical, looping) — `rovingFocus`, unchanged. |
| Home / End | Moves roving focus to the first/last non-disabled option — `rovingFocus`, unchanged. |
| Space | Toggles the currently roving-focused option's membership (LLD-C4's `'multi-toggle'` mode). Type-ahead is OFF for this control (`typeAhead: false`, LLD-C1) specifically so Space is never captured by the type-ahead buffer instead — a deliberate simplification for a small, already-loaded option list (cl.3), flagged reversible in §13. |
| Enter | Toggles the currently roving-focused option's membership — identical outcome to Space (both routes exist for muscle-memory: Space matches the universal "check a box" affordance, Enter matches the existing listbox-commit key every other `[role=option]` consumer already uses). |
| Click on an option | Toggles that option's membership — no modifier required, ever (LLD-C4). |
| Tab | Moves focus out of the control in normal document order — no popup to escape, no light-dismiss. |

No Shift-range, no Ctrl-toggle: every commit path is "toggle the one targeted item," so the
keyboard-only and pointer-driven cases are trivially byte-identical (SPEC-R8 AC1) — there is only
one behavior to match.

## 6 · Form participation mechanics (SPEC-R5/R6, traced against `dom/form.ts`)

- `UIFormElement`'s `connectedCallback` (`form.ts:184-186`) installs a scope-owned effect:
  `this.internals.setFormValue(this.formValue())`, reactive on whatever `formValue()` reads — here,
  the `value` signal — so every toggle republishes automatically, zero extra wiring.
- `FormValue` (`form.ts:62`) already includes `FormData` — LLD-C6's `formValue()` needs no base-class
  change (Fact 4, ADR-0175).
- `formValidity()` follows the same override contract every sibling control uses
  (`form.ts:366-368`) — `required && value.length === 0` → `{ valid: false, flags: { valueMissing:
  true }, message: … }`.
- `ui-form-provider.entries()`'s documented "duplicate names PRESERVED" contract
  (`form-provider.md:20-22`) is the FIRST real exerciser of that path (SPEC-R5 AC1) — a jsdom
  `new FormData(form)` probe and a `ui-form-provider.entries()` probe both assert the same multiple-
  entries shape.
- `el.value` (LLD-C1's public prop) is the SEPARATE bindable aggregate a consumer reads/binds
  directly — no `ui-form-provider` aggregation step, no page-side glue (SPEC-R5 AC2, ADR-0175's own
  closed gap).

## 7 · Geometry & tokens (SPEC-R7)

`tier: pattern` (a two-part composite, no trigger — see LLD-C5):

| Token | Source | `md` default |
|---|---|---|
| `--ui-multi-select-height` (virtual lever) | §1-row lookup (ADR-0038), keyed by `[size]` | 28 |
| `--ui-multi-select-font` | same row | 14 |
| `--ui-multi-select-icon` | same row | 18 |
| `--ui-multi-select-glyph` (checkmark) | `= font` (§4.1 caret law) | 14 |
| `--ui-multi-select-listbox-{bg,radius,padding,min-inline-size,max-block-size}` | Container/surface, `padding = h/4`, scroll-cap = the 12-row formula (`select.md` copied) | — |
| `--ui-multi-select-option-{block,inline,font}` | legacy item-pad, `paddingBlock = (h−font)/2`, `paddingInline = h/4` | — |

No ad hoc size value anywhere on this path — every quantity resolves against the §1 ramp or a
directly-derived formula off it, satisfying SPEC-R7 AC1's geometry trip-wire.

## 8 · Error / edge handling

- **Empty option set / all-disabled:** `rovingFocus` already skips `disabled`/`aria-disabled`
  items and leaves no `tabindex=0` when every item is disabled (Home/End/Space no-op gracefully,
  `roving-focus.ts`, unchanged).
- **Dynamic options (added/removed post-connect):** the MutationObserver adoption (§4) re-reads
  `items()` live on every event — a late-adopted option is immediately selectable; removing a
  selected option leaves it in `value` until the next user toggle (matching `select.ts`'s own "no
  automatic clearing" latitude — the author's call, named not silent).
- **Reconnect / zero-residue:** `rovingFocus`/`selectionCommit` listeners are AbortSignal-scoped
  (C10 discipline, unchanged); the selection effect re-applies on reconnect.
- **Required + empty:** `formValidity()` → `valueMissing` (§6); clears the instant `value.length
  ≥ 1`.
- **Zero-selection FormData:** an empty `FormData()` submits nothing — native `<select multiple>`
  parity, no special-case code (LLD-C6).

## 9 · Catalog rows (SPEC-R9/R10)

- **Default catalog (SPEC-R9):** a new widget-type row bound to `ui-multi-select`, value mark
  `{prop: 'value', event: 'select'}` (no `marshal` — the control's DOM value already IS the array,
  SPEC-R2). `options` — OF3's `PropDef` array of `{label, value}` — applies via a new
  `applyMultiSelectOptions` factory function, a near-verbatim adaptation of
  `applyChoicePickerOptions` (`a2ui-basic/factories.ts:320-332`): full-rebuild `[role=option]`
  children from the whole-array prop on every apply.
- **`a2ui-basic` E6 drain (SPEC-R10, OF4 — same build):** `ChoicePicker.variant`'s enum widens
  `['mutuallyExclusive'] → ['mutuallyExclusive', 'multipleSelection']`; a new factory arm binds
  `'multipleSelection'` to `ui-multi-select`, reusing the SAME options-rebuild function and the
  SAME no-marshal value mark. The existing `mutuallyExclusive` arm (`ui-select` +
  `marshal: 'singletonStringList'`) stays byte-identical — a regression probe in the catalog's own
  factory tests proves it (SPEC-R10 AC2).

## 10 · Probe / test plan

**jsdom (`multi-select.test.ts`):** `value` defaults `[]`, never `null`/`undefined` (SPEC-R4 AC1);
toggle-on appends / toggle-off removes, exact array order (insertion-order `Set` → array, SPEC-R3
AC1/AC2 byte match); `required` + empty → `valueMissing`, clears at ≥1 (SPEC-R6 AC1); `formValue()`
FormData round-trip — `new FormData(form)` multiple entries under `name` (SPEC-R5 AC1); `el.value`
external read/write round-trip (SPEC-R5 AC2); the descriptor↔props contract trip-wire (the
`select.test.ts`/`checkbox.test.ts` precedent); the geometry trip-wire (own `*-DIM` source probe,
SPEC-R7 AC1); the `naming-gates.test.ts` trip-wire (SPEC-R1 AC1, zero special-casing). A dedicated
`selection-commit.test.ts` addition: `'multi-toggle'` mode toggles on plain click AND Enter with no
modifier, `'single'`/`'multi'` regression-unchanged (LLD-C4).

**Browser (`multi-select.browser.test.ts`):** a keyboard-only pass (Space/Enter/Arrow/Home/End, no
pointer events) produces the identical committed selection as the pointer-driven pass, byte-for-byte
(SPEC-R8 AC1); an axe-core pass reports zero violations (SPEC-R8 AC2); forced-colors; C10
zero-residue reconnect; a `[scale]×[size]` geometry smoke (checkmark `0 < glyph ≤ icon ≤ box`, the
`GEO-LAW` family) across Chromium + WebKit; dynamic option adoption live (§8).

**Visual (`multi-select.visual.browser.test.ts`):** committed-baseline pixel diff for the checkmark
paint states (unselected / selected / disabled), Chromium-only (ADR-0110, the `text.visual.browser
.test.ts`/`calendar.visual.browser.test.ts` precedent).

**a2ui renderer round-trip (SPEC-R2 AC2 / SPEC-R9 AC1):** a surface-mount probe proving `input.ts`'s
generic two-way controller writes the FULL new array to `surface.data` at `valuePath` with zero
per-component renderer code, alongside `default/factories.test.ts`/`descriptor-agreement.test.ts`
additions.

**`a2ui-basic` catalog conformance (SPEC-R10 AC1/AC2):** an `upstream-fixtures.test.ts`-style probe
— `ChoicePicker.variant: 'multipleSelection'` passes enum conformance and renders via the new arm;
the existing `mutuallyExclusive` arm's target tag/value-mark/marshal are unchanged.

## 11 · Build sequence

1. `traits/selection-commit.ts` — add `'multi-toggle'` (LLD-C4) + its own regression-safe unit
   tests. Ships first: everything downstream depends on it.
2. `controls/multi-select/` — `multi-select.ts` (LLD-C1/C2/C6), `multi-select.css` (LLD-C3/C5),
   `multi-select.md` (descriptor, mirrors `select.md`/`checkbox.md`'s frontmatter shape),
   `multi-select.test.ts`, `multi-select.browser.test.ts`, `multi-select.visual.browser.test.ts`.
3. Barrel export wiring (the components self-defining-on-import convention every sibling control
   already follows).
4. `a2ui/src/catalog/default/{catalog.json,factories.ts}` — the new widget-type row (SPEC-R9) +
   its `factories.test.ts`/`descriptor-agreement.test.ts` additions + the renderer round-trip probe.
5. `a2ui/src/catalog/a2ui-basic/{catalog.json,factories.ts}` — the E6 drain (SPEC-R10, OF4: same
   build, not deferred) + its regression probe for the untouched `mutuallyExclusive` arm.
6. Full gate: `npm run check && npm test` (jsdom) then `npm run test:browser` (six shards) — judged
   by EXIT CODE, never grepped output (the standing CLAUDE.md law).
7. `roadmap.md` §3's M-F line restates to "shipped" at merge time — ADR-0175's own Repairs cell
   already named this; not this LLD's job, flagged for the ship-time housekeeping pass.

## 12 · Risks / non-decisions

- **LLD-C4 touches shared trait code** (`traits/selection-commit.ts`), the one file outside the new
  folder this build writes to. Mitigated: additive-only mode, its own regression probe asserts
  `'single'`/`'multi'` are byte-unchanged.
- **`typeAhead: false`** (§5) is a deliberate scope simplification for a small, already-loaded
  option list (cl.3) — reversible in one line if a future option-heavy consumer wants type-ahead
  back (would need to resolve the Space-vs-buffer collision first, not a blocker today).
- **A third MutationObserver option-adoption copy** (`select.ts` → `combo-box.ts` →
  `multi-select.ts`) now exists with no shared extraction. Named, not built: the fleet did not
  extract it after the second consumer either; forcing an extraction here would widen this
  change's blast radius into two unrelated shipped controls. A future extraction is a legitimate
  candidate the NEXT consumer (or a dedicated refactor slice) should weigh — not required by this
  LLD.
- **OF4 (same build)** is a sequencing risk judgment, not a hard gate — the builder may split step
  5 into a follow-up PR without invalidating this LLD if the combined PR proves unwieldy in review.
- **FormData with an empty `name`** (`this.name === ''`) is unaddressed here, matching every
  existing FACE control's own non-handling of that edge (e.g. `ui-checkbox`) — not a new risk this
  control introduces.

## 13 · Traceability

| SPEC id | Resolved by |
|---|---|
| SPEC-R1 | LLD-C1 (descriptor `tag`/class) |
| SPEC-R2 | LLD-C1/C2 (value prop + mark); OF2 (no second slot) |
| SPEC-R3 | LLD-C4 (`'multi-toggle'` mode) |
| SPEC-R4 | LLD-C2 (never-null codec) |
| SPEC-R5 | LLD-C6 (`formValue()`) |
| SPEC-R6 | LLD-C1 (`formValidity()`) |
| SPEC-R7 | LLD-C5 (geometry row) |
| SPEC-R8 | LLD-C3/C4 (checkmark + toggle mode); §5 (keyboard table) |
| SPEC-R9 | §9 (default-catalog row); OF3 (`options` shape) |
| SPEC-R10 | §9 (E6 drain); OF4 (sequencing) |
