# ADR-0043 — Overlay + selection primitives: the Overlay controller (Popover API + JS positioning) + the roving-focus trait + selection-commit + UIListboxElement

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the control-suite foundation (#49 Wave 0); details in `.claude/docs/lld/overlay-controller.lld.md` + `listbox-roving.lld.md` |
> | **Ratified by** | orchestration-lead — on the green **G7** gate (when select/combo-box/menu prove the primitives) |
> | **Repairs** | **NEW** `traits/overlay.ts` (the Popover-API overlay controller) + `traits/roving-focus.ts` (extracted/generalized from `tabs.ts:130-168`) + `traits/selection-commit.ts` + `controls/_base/listbox-element.ts` (`UIListboxElement`) + their tests + barrels · **REFACTOR** `controls/tabs/tabs.ts` to consume `roving-focus` (behavior-preserving) · `goals.md §G7` (listbox/select/menu) · **Relates ADR-0042** (`UIListboxElement` lives in the `controls/_base/` layer it established) + **ADR-0017** (modal `<dialog>` — the focus-trap boundary) + **ADR-0019** (the two-way `open`/`selected` bind). |
> | **Supersedes / Superseded by** | None — new foundation. Relates ADR-0042/0017/0019/0013. |

## Context

The Overlay class (`ui-select`/`ui-combo-box`/`ui-menu`/`ui-tooltip`/`ui-popover`) needs a **top-layer,
light-dismissable, anchored popup** and a **moving-focus selectable item set**. Two independent mechanisms,
composed: the *overlay surface/placement* and the *roving focus + selection*. `ui-tabs` already implements the
roving half (`tabs.ts:130-168`) — extract it. A true **modal** (focus-trapped) stays on `ui-modal`'s `<dialog>`
`showModal()` (ADR-0017); these are the **non-modal** popovers.

## Decision

1. **The Overlay controller** (`traits/overlay.ts`, a controller — NOT a base; an overlay is composable
   behavior). **Mechanism (settled, support-verified):** the native **Popover API** for the surface (top-layer +
   `::backdrop` + light-dismiss, Baseline-widely-available) + a **zero-dep JS positioning controller** as the
   robust placement baseline, with **CSS anchor-positioning as an `@supports` progressive enhancement** (NOT a v1
   dual-path requirement — anchor-positioning was ~83% at design time). Two-way `open` via the `toggle` event
   (ADR-0019). Full contract: `overlay-controller.lld.md` (LLD-C1..C5).
2. **The `roving-focus` trait** (`traits/roving-focus.ts`) — extracted + generalized from `ui-tabs`: roving
   tabindex + Arrow/Home/End + loop + type-ahead, role-agnostic (`option`/`menuitem`/`tab`/`radio`), with an
   `onMove` hook (couple selection-follows-focus or decouple). **`ui-tabs` migrates to consume it** (a
   behavior-preserving refactor — every existing tabs test stays green). Active-descendant mode for combo-box.
3. **The `selection-commit` controller** (`traits/selection-commit.ts`) — single/multi selection + the
   `select` event + `aria-selected` (internals); value-codec-agnostic.
4. **`UIListboxElement`** (`controls/_base/listbox-element.ts`, ← UIFormElement, the ADR-0042 layer) — the
   listbox **form value** + roving + selection over `[role=option]` children. `ui-menu` is NOT this — it is
   `UIElement` + roving + commit→**action** (non-value, like tabs). Full contract: `listbox-roving.lld.md`.
5. **Geometry boundary (LLD-C5):** listbox/menu **rows** are not Indicator widgets — they take the legacy
   item-pad (geometry-sizing-spec §4.6/§5.1), NOT the `--ui-compact` widget box. (A row's leading check/icon is
   a slot adornment.)

## Consequences

- **`ui-select` = a trigger + `overlay` + `UIListboxElement`; `ui-combo-box` = a text-field + the same +
  a filter; `ui-menu` = `overlay` + roving menuitems.** The popup-selection controls compose, not reinvent.
- **`ui-tabs` gains a shared roving trait** — one roving implementation for tabs/listbox/menu/radio-group (the
  extraction de-duplicates; tabs' behavior is unchanged).
- **The modal/non-modal split is explicit** — `<dialog>` showModal (focus-trap, ADR-0017) vs the Popover
  controller (non-modal). No focus-trap reinvention.
- **Native-first** — the platform supplies top-layer + light-dismiss; the only JS is the positioning baseline
  (because anchor-positioning isn't universal yet) + the value/selection model.
- **Stale → re-verify:** the LLDs · the new files + tests + barrels · `tabs.ts` (the refactor keeps tabs tests
  green) · goals §G7 · the overlay/select browser smoke (Chromium + **WebKit** — overlays are WebKit-sensitive).

## Acceptance (the G7 control bar, proven by the leaf controls)

`roving-focus`: a listbox/menu roves focus + type-ahead (jsdom) + real focus (browser); the `ui-tabs` migration
keeps every tabs test green. `overlay`: a select popup renders in the top layer above an `overflow/transform`
ancestor, light-dismisses (Escape + outside-click), and flips/shifts at the viewport edge (Chromium + WebKit).
`UIListboxElement`: `formValue()` + `valueMissing` + selection. The end-to-end: select opens → keyboard-navigates
→ commits → closes, keyboard-only (the G7 shippable-family box). C10 zero-residue.

## Alternatives considered

- **An Overlay base class** — rejected; an overlay is a behavior on a host (a select), not the host's identity.
  A `host.use(overlay)` controller composes onto any trigger.
- **CSS anchor-positioning as the sole placement** — rejected (~83% support; Firefox/older-Safari gap). The JS
  controller is the uniform baseline; anchor-positioning is the `@supports` enhancement.
- **Reimplement modal focus-trap in the controller** — rejected; `<dialog>` showModal (ADR-0017) gives it free.
- **A new roving impl (not extracting tabs)** — rejected; `ui-tabs` already has it; extracting de-duplicates and
  makes the behavior reusable (tabs migrates to the shared trait).
- **Folding this into ADR-0042** — rejected; the overlay/selection infra is a distinct sub-system (different
  mechanism, different milestone G7) from the widget value-bases (G6). Two coherent, separately-gated ADRs.
