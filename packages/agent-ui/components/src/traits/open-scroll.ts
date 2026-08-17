// open-scroll.ts — the shared open-time selection-centering helpers (GH #1100).
//
// A menu/select panel is a bounded scroll viewport (TKT-0027: max-block-size + overflow-y: auto).
// Opening one over a large option list used to land at scroll offset 0 regardless of which option
// was selected. These two helpers give every overlay-listbox host the same open-time behavior:
//
//   `seedOpenFocus(items, selected)` — BEFORE `handle.open()`: stamp `tabindex=0` on the selected
//   item (all others -1) so the overlay controller's `moveFocusIn()` (traits/overlay.ts LLD-C4 —
//   "focus the first keyboard-focusable descendant", i.e. the one non-`-1` tabindex) lands REAL
//   focus on the selection, the ARIA pattern both hosts already follow (real roving focus, never
//   `aria-activedescendant` — roving-focus.ts is the fleet convention). The host's `rovingFocus`
//   wiring then continues arrows from there via its `syncIndex` seam (`activeElementIndex` below).
//
//   `centerInViewport(viewport, item)` — AFTER `handle.open()` (the popover must be laid out for
//   scroll geometry to exist): scroll the viewport so `item` sits centered, clamped to the scroll
//   bounds (GH #1100 fork (b) — an option near either end is only as centered as bounds allow;
//   the browser clamps the assignment natively). A non-overflowing viewport, or no selection, is
//   left byte-untouched (fork (c) — today's behavior exactly).
//
// Rect-based math (not `offsetTop`): the panel lives in the Popover top layer, so relying on
// `offsetParent` chains is engine-sensitive; client-rect deltas plus the current scrollTop are not.
//
// `traits` imports nothing here — pure DOM helpers, callable from any control's `connected()`.

// True if the item carries either the native `disabled` attribute or `aria-disabled="true"`
// (the roving-focus.ts predicate — a disabled selection must not receive open-time focus).
function isDisabled(item: HTMLElement): boolean {
  return item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true'
}

/**
 * Stamp roving tabindexes so `selected` is the panel's one tab stop — the item the overlay's
 * `moveFocusIn()` will focus when the panel opens. No-op when `selected` is null, disabled, or
 * not in `items` (the existing tabindex=0 item keeps focus — today's behavior).
 */
export function seedOpenFocus(items: HTMLElement[], selected: HTMLElement | null): void {
  if (!selected || isDisabled(selected) || !items.includes(selected)) return
  for (const item of items) item.tabIndex = item === selected ? 0 : -1
}

/**
 * Scroll `viewport` so `item` sits centered in the visible scroll area, clamped to the scroll
 * bounds. No-op when there is no item or the viewport does not overflow.
 */
export function centerInViewport(viewport: HTMLElement, item: HTMLElement | null): void {
  if (!item) return
  if (viewport.scrollHeight <= viewport.clientHeight) return // non-overflowing — unchanged
  const viewportRect = viewport.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const itemTop = itemRect.top - viewportRect.top + viewport.scrollTop
  // Center: item midpoint aligned to viewport midpoint; the assignment clamps natively.
  viewport.scrollTop = itemTop - (viewport.clientHeight - itemRect.height) / 2
}

/**
 * `syncIndex` seam for `rovingFocus` (roving-focus.ts): the index of the currently-focused item,
 * or -1 ("no update") when focus is elsewhere. Keeps the trait's internal roving index true to
 * where open-time focus seeding actually landed, so the first Arrow key continues from the
 * selection instead of the trait's stale internal index.
 */
export function activeElementIndex(items: HTMLElement[]): number {
  const active = document.activeElement
  return active instanceof HTMLElement ? items.indexOf(active) : -1
}
