# LLD — the roving-focus trait + UIListboxElement + selection-commit (listbox · menu · select-options · radio-group)

> Component LLD for the control suite (#49 Wave 0). Trace: ADRs + `goals.md §G7`. · proposed · 2026-06-30 ·
> planning-lead
>
> **Composes on:** `ui-tabs` roving prior art (`tabs.ts:130-168` — EXTRACT) · `UIFormElement` (ADR-0013, for
> the listbox value) · the anatomy slot model. · **Layer:** the traits `traits/`; `UIListboxElement`
> `controls/_base/`.

## Intent

Three composable pieces power every **set-of-items-with-a-moving-focus** control:
1. a shared **`roving-focus` trait** (the keyboard + tabindex movement), extracted from `ui-tabs`;
2. a **`selection-commit` controller** (single/multi selection + the `select` event);
3. **`UIListboxElement`** (the form value for `ui-listbox`/`ui-select`).
`ui-menu` = roving + commit→action (NOT form-associated, like tabs); `ui-radio-group` = roving + exclusive
selection; `ui-select`/`ui-combo-box` = `UIListboxElement` in an Overlay popup.

## Components

- **LLD-C1 — the roving-focus trait (NEW, `traits/roving-focus.ts`, generalized from `tabs.ts:130-168`).**
  `rovingFocus(host, { items, orientation='vertical', loop=true, typeAhead=true, onMove })` → cleanup. Exactly
  ONE item is `tabindex=0` (the rest `-1`); ArrowUp/Down (or Left/Right for horizontal) + Home/End move the
  roving index AND focus; `loop` wraps; **type-ahead** focuses the next item whose text starts with the typed
  buffer (200ms reset). `items` is a live accessor (the host's option/menuitem/tab/radio set) — role-agnostic.
  `onMove(index)` lets the host couple selection-follows-focus (listbox/tabs) or decouple it (menu: focus moves,
  selection commits only on Enter). **`ui-tabs` migrates to consume this trait** (a follow-up refactor slice —
  tabs.ts; file-disjoint from this NEW file). Active-descendant mode (`aria-activedescendant`, focus stays on a
  combobox input) is an option for `ui-combo-box`.
- **LLD-C2 — the selection-commit controller (NEW, `traits/selection-commit.ts`).** `selectionCommit(host, {
  mode='single', onSelect })` → cleanup. Tracks the selected key(s); single = one, multi = a Set with
  Shift/Ctrl range/toggle; commit on click/Enter (or selection-follows-focus when coupled). Publishes
  `aria-selected` (via internals element-reflection) + emits `select`. The model is value-codec-agnostic.
- **LLD-C3 — UIListboxElement (`controls/_base/listbox-element.ts`, ← UIFormElement).** `role=listbox`; owns the
  **form value** (the selected option's `value`, or a list for multi) via `formValue()`; wires `rovingFocus` +
  `selectionCommit` over its `[role=option]` children; `required` → `valueMissing` when nothing selected. The
  options are light-DOM children (`ui-option`, or `<li role=option>`); the host carries no role attribute (FACE
  internals).
- **LLD-C4 — menu (non-value).** `ui-menu` is NOT `UIListboxElement` — it is a `UIElement` + `rovingFocus`
  (role=menu, items role=menuitem) + commit→**action** (emits `select`/an action, no form value). Like
  `ui-tabs`, it is not form-associated.
- **LLD-C5 — geometry.** Listbox/menu **rows** are not Indicator widgets — they take the legacy item-pad (the
  `dropdown`/`listbox` item rows are not "comfortable controls", geometry-sizing-spec §4.6/§5.1); a leading
  check/icon is a slot adornment (anatomy). Not the `--ui-compact` widget box.

## Composition

`ui-listbox` = UIListboxElement (LLD-C3). `ui-select` = a trigger + Overlay (the overlay LLD) + a UIListboxElement
popup, the trigger reflecting the selected option's label. `ui-combo-box` = a text-field + Overlay + listbox
(active-descendant, LLD-C1) + a filter. `ui-menu` = LLD-C4. `ui-radio-group` = rovingFocus + single
selection-commit over `ui-radio`s.

## Error / edge handling (L5)

- **empty set / all-disabled:** roving skips `disabled`/`aria-disabled` items; an all-disabled set has no
  `tabindex=0` (nothing focusable); Home/End/type-ahead no-op gracefully.
- **dynamic items (added/removed while open):** `items` is re-read live; if the roving item is removed, focus
  moves to the nearest surviving item; a re-render (the `repeat` directive) keeps node identity so focus
  survives where the platform allows (the ADR-0022 two-tier guarantee).
- **multi-select range with a moving anchor:** Shift+Arrow extends from the anchor; Ctrl+Space toggles without
  moving the anchor; the controller holds the anchor key across moves.
- **type-ahead vs single-letter activation:** the buffer disambiguates "tt" (type-ahead "tt…") from two "t"
  presses (cycle matches) by the 200ms reset — the platform listbox rule.
- **select with closed popup:** keyboard on the *closed* select trigger (Arrow) opens the popup AND moves
  (platform parity); the value commits on close.
- **Reconnect / zero-residue:** the roving + selection listeners are AbortSignal-scoped; the selection effect
  re-applies on reconnect; connect→disconnect zero residue (C10).

## New-ADR flags

- **NEW ADR — the roving-focus trait extraction + UIListboxElement + selection-commit**, proposed: the trait
  seam (the role-agnostic roving contract), the `ui-tabs` migration to consume it (an extends-existing refactor
  — tabs keeps its behavior, now via the shared trait), the listbox value + the menu non-value split. Relates
  ADR-0013 (form base), ADR-0019 (two-way for select's `selected`/`open`).

## Acceptance (G7)

jsdom: roving index + Arrow/Home/End + type-ahead + loop; selection single/multi + `aria-selected` + `select`;
listbox `formValue()` + `valueMissing`; the `ui-tabs` migration keeps every existing tabs test green (the
extraction is behavior-preserving). Browser smoke (Chromium + WebKit): real focus roves; select opens the
listbox in the overlay, keyboard-navigates, commits, closes; forced-colors. C10 zero-residue.
