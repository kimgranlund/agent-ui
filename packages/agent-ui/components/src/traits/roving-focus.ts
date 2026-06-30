// roving-focus.ts — the keyboard + tabindex roving-focus trait (listbox-roving LLD-C1). Extracted
// from ui-tabs' prior art (tabs.ts:130-168) to serve any "set of items with a moving focus" host:
// ui-listbox, ui-menu, ui-select, ui-radio-group. Role-agnostic: `items` is a live accessor; the
// host declares the item role in its own CSS/internals.
//
// Exactly ONE item holds `tabindex=0`; the rest `-1`. Arrow keys (Up/Down for vertical; Left/Right
// for horizontal) + Home/End move the roving index AND transfer focus. `loop` wraps at the ends;
// `typeAhead` searches by the typed buffer (200ms reset). `onMove(index)` notifies the host: couple
// selection-follows-focus (listbox/tabs) or decouple (menu: focus moves, selection commits on Enter).
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export type RovingOrientation = 'vertical' | 'horizontal'

export interface RovingFocusOptions {
  /** Live accessor returning the current ordered set of candidate items (re-read on each key event). */
  items: () => HTMLElement[]
  /** Arrow-key axis: Up/Down for `'vertical'`, Left/Right for `'horizontal'`. Default: `'vertical'`. */
  orientation?: RovingOrientation
  /** Wrap from last → first and first → last. Default: `true`. */
  loop?: boolean
  /**
   * Focus the next item whose visible text starts with the typed buffer (200 ms reset between bursts).
   * Default: `true`.
   */
  typeAhead?: boolean
  /**
   * Called each time the roving index changes. Use to couple selection-follows-focus (listbox/tabs)
   * or to update `aria-activedescendant` (combobox active-descendant mode).
   */
  onMove?: (index: number) => void
  /**
   * Seed the initial roving index rather than defaulting to the first non-disabled item. A function
   * is re-called at each invocation of `rovingFocus` (useful when calling from `connected()` so the
   * currently-selected position after reconnect is honoured). Out-of-range values fall back to
   * `findFirst`. Default: `findFirst(items())`.
   */
  initialIndex?: number | (() => number)
  /**
   * Called at the start of every keydown event to sync the internal roving index with external state.
   * Use for selection-follows-focus hosts (tabs, listbox) where a click or programmatic selection
   * change updates the host's own index without going through the trait's `onMove` callback.
   * Returning a negative number or an out-of-range index is treated as "no update".
   */
  syncIndex?: () => number
  /**
   * The element to attach the keydown (and type-ahead) listener to. Defaults to `host` itself.
   * Set to a container sub-element (e.g. a `[data-part=tablist]` strip) when the host contains
   * other focusable regions whose Arrow keys must NOT be intercepted by this trait.
   */
  container?: HTMLElement
}

// True if the item carries either the native `disabled` attribute or `aria-disabled="true"`.
function isDisabled(item: HTMLElement): boolean {
  return item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true'
}

// Apply roving tabindexes: the item at `index` gets 0; all others -1. When `index` is -1 (all
// disabled) every item gets -1.
function applyTabindexes(list: HTMLElement[], index: number): void {
  for (let i = 0; i < list.length; i++) {
    list[i].tabIndex = i === index ? 0 : -1
  }
}

// Index of the first non-disabled item, or -1 if the set is all-disabled.
function findFirst(list: HTMLElement[]): number {
  return list.findIndex((item) => !isDisabled(item))
}

// Index of the last non-disabled item, or -1.
function findLast(list: HTMLElement[]): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (!isDisabled(list[i])) return i
  }
  return -1
}

// Walk from `from` in direction `dir` (+1 or -1), skipping disabled items. With `loop`, wraps
// modulo the list length. Without loop, stops at the boundary. Returns -1 when no candidate found.
function walkEnabled(list: HTMLElement[], from: number, dir: 1 | -1, loop: boolean): number {
  const n = list.length
  for (let step = 1; step <= n; step++) {
    const raw = from + dir * step
    const idx = loop ? ((raw % n) + n) % n : raw
    if (idx < 0 || idx >= n) break
    if (!isDisabled(list[idx])) return idx
  }
  return -1
}

/**
 * Wire keyboard + tabindex roving focus on a `UIElement` host. Invoke from `connected()` so the
 * listeners ride the connection AbortSignal (auto-removed on disconnect). Returns cleanup (idempotent).
 */
export function rovingFocus(host: UIElement, opts: RovingFocusOptions): () => void {
  const { items, orientation = 'vertical', loop = true, typeAhead = true, onMove, syncIndex, container } = opts

  let released = false
  // The current roving index (-1 = none; arises when the initial item set is all-disabled).
  let rovingIndex = -1

  // Type-ahead: accumulate printable characters; reset after 200 ms of inactivity.
  let typeBuffer = ''
  let typeTimer: number | null = null

  // Move roving focus to `next`: update tabindexes, transfer real focus, notify the host.
  function moveTo(list: HTMLElement[], next: number): void {
    if (next === -1 || next >= list.length) return
    rovingIndex = next
    applyTabindexes(list, next)
    list[next].focus()
    onMove?.(next)
  }

  // Initialise tabindexes: use `initialIndex` (if provided) to seed from the host's current selection
  // rather than defaulting to the first non-disabled item. This is required when the host's selection
  // effect has already placed tabindex=0 on a non-first item (e.g. tabs reconnecting with tab 1 active).
  const init = items()
  if (opts.initialIndex !== undefined) {
    const seed = typeof opts.initialIndex === 'function' ? opts.initialIndex() : opts.initialIndex
    rovingIndex = (seed >= 0 && seed < init.length) ? seed : findFirst(init)
  } else {
    rovingIndex = findFirst(init)
  }
  applyTabindexes(init, rovingIndex)

  // Keydown handler — attached to `container` (default: host) so it can be scoped to a sub-region
  // (e.g. a tablist strip) without intercepting arrow keys inside focusable panel content.
  const listenerTarget: EventTarget = container ?? host
  host.listen(listenerTarget, 'keydown', (event) => {
    if (released) return
    const e = event as KeyboardEvent
    const list = items() // live re-read: handles dynamic item sets
    if (list.length === 0) return

    // Sync external selection state (e.g. click/programmatic) before any key-based navigation so the
    // next Arrow move starts from the correct position even when the host updated its own index
    // via a path that bypassed `onMove` (tabs' #commit() on click, for example).
    if (syncIndex !== undefined) {
      const synced = syncIndex()
      if (synced >= 0 && synced < list.length) rovingIndex = synced
    }

    const isNextKey = orientation === 'vertical' ? e.key === 'ArrowDown' : e.key === 'ArrowRight'
    const isPrevKey = orientation === 'vertical' ? e.key === 'ArrowUp' : e.key === 'ArrowLeft'
    const isHomeKey = e.key === 'Home'
    const isEndKey = e.key === 'End'

    if (!isNextKey && !isPrevKey && !isHomeKey && !isEndKey) {
      // Type-ahead: single printable character with no modifier key shortcuts active.
      if (typeAhead && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeBuffer += e.key.toLowerCase()
        if (typeTimer !== null) clearTimeout(typeTimer)
        typeTimer = setTimeout(() => {
          typeBuffer = ''
          typeTimer = null
        }, 200) as unknown as number

        // Search from the item AFTER current (wrapping), including current only as the last resort.
        const from = rovingIndex // -1 is safe: ((-1+1) % n + n) % n = 0
        const n = list.length
        for (let step = 1; step <= n; step++) {
          const idx = ((from + step) % n + n) % n
          if (!isDisabled(list[idx])) {
            const label = (list[idx].textContent ?? '').trim().toLowerCase()
            if (label.startsWith(typeBuffer)) {
              e.preventDefault()
              moveTo(list, idx)
              break
            }
          }
        }
      }
      return
    }

    e.preventDefault()

    // Clamp rovingIndex to valid range in case items changed since the last move.
    let current = rovingIndex
    if (current < 0 || current >= list.length) {
      current = findFirst(list)
      if (current === -1) return // all-disabled — nothing to do
    }

    let next: number
    if (isNextKey) next = walkEnabled(list, current, 1, loop)
    else if (isPrevKey) next = walkEnabled(list, current, -1, loop)
    else if (isHomeKey) next = findFirst(list)
    else next = findLast(list) // isEndKey

    moveTo(list, next)
  })

  return () => {
    released = true
  }
}
