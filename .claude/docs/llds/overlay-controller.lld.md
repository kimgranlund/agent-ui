# LLD — the Overlay controller (the non-modal popover primitive: select-popup · menu · tooltip · popover)

> Component LLD for the control suite (#49 Wave 0). Trace: ADRs + `goals.md §G7` (`SPEC-R#` **N/A by design** — the components layer has no SPEC family). · proposed · 2026-06-30 ·
> planning-lead
>
> **Composes on:** the native **Popover API** + a **zero-dep JS positioning controller** (mechanism settled by
> the team-lead, support-verified) · `ui-modal` `<dialog>` prior art (ADR-0017, the modal special case) · the
> two-way `open` bind (ADR-0019). · **Layer:** `traits/` (a controller, NOT a base — an overlay is a *behavior*
> bolted on a host, not its identity).

## Intent

The Overlay controller gives any host a **top-layer, light-dismissable, anchored popup** — the surface a
`ui-select`/`ui-combo-box`/`ui-menu`/`ui-tooltip`/`ui-popover` shows. It is a `host.use(overlay, …)` controller,
not a base class: the host element is a select (or a tooltip trigger) by identity and *has* an overlay; the
overlay is composable behavior. A true **modal** (focus-trapped) stays on `ui-modal`'s `<dialog>` `showModal()`
(ADR-0017) — the controller is the **non-modal** path.

## Mechanism (settled — support-verified by the host)

- **Surface = the native Popover API.** The popup is `[popover]` (manual/auto) → the platform gives **top-layer
  stacking** (above any z-index/overflow), `::backdrop`, and **light-dismiss** (Escape + outside-click for
  `popover=auto`) for free. Baseline-widely-available (Chrome 114+ / Safari 17.4+ / Firefox 125+). `showPopover()`/
  `hidePopover()` + the `toggle` event drive the two-way `open` (ADR-0019).
- **Placement = a zero-dep JS positioning controller (the robust baseline).** A small measure-and-place routine
  (anchor rect + popup rect + viewport → a `placement` with flip/shift) sets the popup's inset, uniform
  cross-browser. **CSS anchor-positioning is a PROGRESSIVE ENHANCEMENT** (`@supports (anchor-name: --x)` /
  feature-detect) where available (Chrome; Safari 18.4+ for `@position-try`; Firefox ~147+) — NOT a v1 dual-path
  requirement; the JS controller is the reliable path. *(Rationale: anchor-positioning was ~83% at design time;
  the JS baseline avoids a Firefox/Safari gap.)*

## Components

- **LLD-C1 — the surface seam.** `overlay(host, { popup, anchor, placement='bottom-start', auto=true })` →
  `{ open, close, toggle, cleanup }`. `popup` = the control-owned popover part; `anchor` = the trigger element.
  Wires `popup.showPopover()/hidePopover()` + the `toggle` event → `open` two-way (ADR-0019: `value:{prop:'open',
  event:'toggle'}`).
- **LLD-C2 — light-dismiss + the announce contract (ADR-0101).** `popover=auto` gives Escape + outside-click
  dismiss free; the controller maps those to `open=false`. The trait announces `toggle` on EVERY actual
  open-state transition it drives — platform-, component-, or model-driven alike — with `close` alongside
  every real hide, emitted after `open` has settled to its new value (native ToggleEvent timing fidelity;
  supersedes the platform-dismiss-only discriminator ADR-0045 shipped — see ADR-0101). `popover=manual` is
  used for tooltips that dismiss on blur/leave instead of Escape/outside-click, but announce identically.
- **LLD-C3 — positioning.** On open + on scroll/resize (throttled), the controller measures anchor+popup and
  sets the inset for `placement` with **flip** (insufficient space → opposite side) + **shift** (clamp to
  viewport). The `@supports` anchor-positioning branch sets `position-anchor`/`inset-area` instead where
  available. The placement is exposed as `data-placement` for arrow/caret styling.
- **LLD-C4 — focus policy (non-modal).** No focus-trap (that is `<dialog>` showModal). Opening a *menu*/*listbox*
  popup moves focus INTO it (roving, the Listbox primitive); a *tooltip* never takes focus. The controller
  takes a `focusOnOpen` option; restores focus to the anchor on close.
- **LLD-C5 — the modal boundary.** When a focus-trap IS wanted (a dialog, a confirm), use `ui-modal`'s
  `<dialog>` `showModal()` (ADR-0017) — the controller does NOT reimplement it; it documents the boundary.

## Composition (who uses it)

`ui-select` = a trigger button + `host.use(overlay, {popup: the listbox})` + the Listbox primitive. `ui-combo-box`
= a text-field + the same overlay + listbox + a filter. `ui-menu` = an anchor + overlay + roving menuitems.
`ui-tooltip` = `popover=manual` + hover/focus triggers, no focus move. All share LLD-C1..C4.

## Error / edge handling (L5)

- **anchor-positioning unsupported (Firefox/older Safari):** the JS controller is the default path — no
  degradation; the `@supports` branch simply isn't taken.
- **top-layer + transforms:** the Popover API top-layer escapes ancestor `overflow`/`transform` (the platform
  guarantee) — no z-index war; a transformed ancestor does NOT clip the popup.
- **anchor removed / detached while open:** the controller observes the anchor; if it leaves the DOM, the
  overlay closes (no orphaned popup). Scroll-away beyond the viewport → flip/shift or close (option).
- **double-open / re-entrancy:** `showPopover()` on an already-open popup is a no-op (guarded); the `open`
  effect is idempotent.
- **Reconnect / zero-residue:** the toggle/scroll/resize listeners are AbortSignal-scoped; the popup part is
  created once (idempotent, never re-rendered — the ADR-0017 pattern). Connect→disconnect zero residue (C10).
- **forced-colors / reduced-motion:** the `::backdrop` + the surface honor forced-colors; the open/close
  transition respects reduced-motion.

## New-ADR flags

- **NEW ADR — the Overlay controller (Popover API + JS positioning baseline + anchor-positioning PE)**, proposed:
  the surface/placement mechanism (the settled decision), the non-modal-vs-modal boundary (controller vs
  `<dialog>`), the two-way `open` (relates ADR-0019), the light-dismiss mapping. Relates ADR-0017 (modal).

## Acceptance (G7)

Browser smoke (Chromium + **WebKit**, overlays are WebKit-sensitive): the popup renders in the top layer above
an `overflow:hidden`/`transform` ancestor; light-dismiss (Escape + outside-click) closes + syncs `open`;
positioning flips/shifts at the viewport edge (the JS controller); a menu/listbox popup roves focus, a tooltip
does not; forced-colors. C10 zero-residue.
