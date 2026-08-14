// selection-commit.ts — the selection model + commit controller (listbox-roving LLD-C2). Tracks
// the selected key(s) for any "set of options" host: single or multi. Publishes `aria-selected`
// via internals element-reflection and emits `select` on commit. Value-codec-agnostic: the host
// maps its option elements to string keys.
//
// Consumer contract (trued by the TKT-0065 lateral review — the original header named hosts that
// lawfully cannot consume this trait): the selection marker is an `aria-selected` ATTRIBUTE on each
// item, so the trait fits attribute-reflected `[role=option]` hosts ONLY (ui-select is the shipped
// consumer). `role=menuitem` hosts (ui-menu) must not carry aria-selected (action semantics — menu.ts
// commits via its own click + Enter/Space path, which this trait also lacks a Space leg for), and
// ui-tab items drive selection through ElementInternals, never host attributes (the fleet ARIA law).
//
// GH #908/#905 — this trait's OWN `aria-selected` reflect (below) is COMMIT-TIME ONLY: it fires from
// a real user gesture (click/Enter), never from an external write. A host whose selection can ALSO
// be set declaratively (an initial attribute) or programmatically (`el.value = …`, a two-way data
// bind) must layer its OWN value-keyed reflect ON TOP — this trait has no visibility into a host's
// value prop at all (it tracks its own internal `singleKey`/`multiKeys` cursor, seeded only by a
// commit or by `syncSelection`'s re-seed at the START of the NEXT commit). `multi-select.ts` and
// `select.ts` both do this today (their own `this.effect` reading `this.value` + a call at
// option-adoption time) — harmless redundancy on a user commit (both this trait's reflect and the
// host's own agree), load-bearing on every OTHER value write. Do not assume this trait's reflect
// alone is sufficient for a host with an externally-settable value.
//
// `traits → dom` is the one allowed cross-layer direction; the host type only.

import type { UIElement } from '../dom/index.ts'

export type SelectionMode = 'single' | 'multi' | 'multi-toggle'

export interface SelectionCommitOptions {
  /**
   * `'single'` — at most one selected key. `'multi'` — a Set with Shift/Ctrl range-toggle and
   * Ctrl+Space per-item toggle. `'multi-toggle'` (multi-select-field.lld.md LLD-C4) — every commit
   * path (plain click AND Enter) unconditionally TOGGLES the targeted item's Set membership, ignoring
   * Shift/Ctrl modifiers entirely — no range-extend, no separate toggle-vs-replace branch. Default:
   * `'single'`.
   */
  mode?: SelectionMode
  /**
   * Called when the committed selection changes.
   * Single mode: a `string` key, or `''` when nothing is selected.
   * Multi mode: a `ReadonlySet<string>` of selected keys (may be empty).
   */
  onSelect?: (selection: string | ReadonlySet<string>) => void
  /**
   * Live accessor returning the ordered option elements (re-read on each event for Shift-range
   * ordering). Default: `[...host.querySelectorAll('[role=option]')]`.
   */
  items?: () => HTMLElement[]
  /**
   * Extract the string key from an option element. An empty string is treated as "no key" —
   * items without a key are skipped. Default: `el.dataset['key'] ?? ''`.
   */
  keyOf?: (el: HTMLElement) => string
  /**
   * Multi/multi-toggle modes ONLY (multi-select-field.lld.md — closes a real gap SPEC-R3/R9 both
   * depend on): re-seed the internal Set from LIVE EXTERNAL state at the START of every click/Enter
   * event, before that event's own toggle is computed — the `rovingFocus` `syncIndex` precedent,
   * applied to selection state instead of a roving index. Without this, a host whose bindable value
   * prop can be written from OUTSIDE a user commit (an attribute-seeded initial value, a programmatic
   * `el.value = […]`, a two-way data bind) would have that write be INVISIBLE to this trait's own
   * internal Set — the next user toggle would silently DISCARD it (only the trait-tracked members
   * would survive a toggle, since a toggle always starts from `multiKeys`, never from the host's own
   * prop). Ignored in `'single'` mode (no analogous internal cursor gap: `singleKey` is always
   * immediately overwritten by a fresh commit, so a stale value never leaks into the next one).
   */
  syncSelection?: () => ReadonlySet<string>
}

/**
 * Wire single/multi selection tracking on a `UIElement` host. Invoke from `connected()` so
 * listeners ride the connection AbortSignal (auto-removed on disconnect). Returns cleanup (idempotent).
 */
export function selectionCommit(host: UIElement, opts: SelectionCommitOptions): () => void {
  const mode = opts.mode ?? 'single'
  const getItems: () => HTMLElement[] = opts.items ??
    (() => [...host.querySelectorAll<HTMLElement>('[role=option]')])
  const keyOf: (el: HTMLElement) => string = opts.keyOf ??
    ((el) => el.dataset['key'] ?? '')

  // A disabled option is non-committable — guards BOTH commit paths (click + Enter) so a disabled
  // option cannot be selected even where CSS `pointer-events:none` is absent (jsdom) or bypassed
  // (keyboard). Matches the rovingFocus/menu disabled convention: the HTML `[disabled]` attribute OR
  // `aria-disabled="true"`. (Selection-follows-focus hosts already skip disabled at the roving layer;
  // this is the commit-layer backstop.)
  const isDisabled = (el: HTMLElement): boolean =>
    el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'

  // Single-mode cursor; multi-mode Set; anchor key held across moves for Shift-range extension.
  let singleKey = ''
  let multiKeys = new Set<string>()
  let anchorKey = ''
  let released = false

  // Reflect aria-selected on every option element in the host. The attribute is set on the ITEMS
  // (NOT on the host) — aria-selected belongs to each option, not the listbox container.
  const reflectAriaSelected = (): void => {
    for (const item of getItems()) {
      const k = keyOf(item)
      const selected = mode === 'single'
        ? (k !== '' && k === singleKey)
        : multiKeys.has(k)
      item.setAttribute('aria-selected', String(selected))
    }
  }

  // Reflect ARIA, invoke `onSelect`, and emit `select` with the current committed selection.
  const publish = (): void => {
    reflectAriaSelected()
    const selection: string | ReadonlySet<string> =
      mode === 'single' ? singleKey : new Set(multiKeys)
    opts.onSelect?.(selection)
    host.emit('select', selection)
  }

  // Resolve the closest [role=option] ancestor of a click target, constrained within the host.
  const optionFromTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof HTMLElement)) return null
    const item = target.closest('[role=option]') as HTMLElement | null
    return item && host.contains(item) ? item : null
  }

  host.listen(host, 'click', (event) => {
    if (released) return
    const e = event as MouseEvent
    const item = optionFromTarget(e.target)
    if (!item || isDisabled(item)) return
    const key = keyOf(item)
    if (key === '') return

    if (mode === 'single') {
      singleKey = key
      anchorKey = key
      publish()
      return
    }

    // Re-seed from live external state BEFORE computing this event's toggle (the syncSelection doc
    // comment above) — multi/multi-toggle only; a no-op when the option is absent.
    if (opts.syncSelection) multiKeys = new Set(opts.syncSelection())

    if (mode === 'multi-toggle') {
      // LLD-C4: every plain click toggles the targeted item's membership, no modifier keys ever
      // consulted (SPEC-R3/R8) — the SAME toggle the Enter-keydown branch below already performs for
      // 'multi'/'multi-toggle' alike, so click and Enter are byte-identical outcomes.
      const next = new Set(multiKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      multiKeys = next
      publish()
      return
    }

    // Multi mode — modifier keys determine how the selection evolves.
    if (e.shiftKey && anchorKey !== '') {
      // Range-extend: replace selection with the range from anchor to the clicked item (inclusive).
      // The anchor itself does not move on Shift — it stays at the last plain click/Enter.
      const items = getItems()
      const ai = items.findIndex((el) => keyOf(el) === anchorKey)
      const ci = items.indexOf(item)
      if (ai >= 0 && ci >= 0) {
        const lo = Math.min(ai, ci)
        const hi = Math.max(ai, ci)
        multiKeys = new Set(
          items.slice(lo, hi + 1).map(keyOf).filter((k) => k !== ''),
        )
        publish()
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle: flip this item's membership without moving the anchor.
      const next = new Set(multiKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      multiKeys = next
      publish()
    } else {
      // Plain click: replace the selection and set a new anchor.
      multiKeys = new Set([key])
      anchorKey = key
      publish()
    }
  })

  host.listen(host, 'keydown', (event) => {
    if (released) return
    const e = event as KeyboardEvent
    if (e.key !== 'Enter') return
    // Commit the currently focused option (set by rovingFocus or any active-descendant approach).
    const active = document.activeElement as HTMLElement | null
    if (!active || !host.contains(active)) return
    const item = active.closest('[role=option]') as HTMLElement | null
    if (!item || isDisabled(item)) return
    const key = keyOf(item)
    if (key === '') return

    // Enter COMMITS here — suppress its default action so a host that closes an overlay on commit and
    // restores focus to a <button> trigger does NOT let the SAME Enter re-activate that button (which
    // would re-toggle the popup open). Cross-engine bug caught by ui-select's commit-close smoke.
    e.preventDefault()

    if (mode === 'single') {
      singleKey = key
      anchorKey = key
      publish()
    } else {
      // Re-seed from live external state BEFORE toggling (the syncSelection doc comment above).
      if (opts.syncSelection) multiKeys = new Set(opts.syncSelection())
      // Toggle the focused item; anchor stays.
      const next = new Set(multiKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      multiKeys = next
      publish()
    }
  })

  return () => {
    released = true
  }
}
