// pagination-model.ts — the pure, DOM-free page-window math (ADR-0163 cl.6, SPEC-R3). No DOM, no host,
// unit-testable in plain Node/Vitest (the table-model.ts / bar-math.ts precedent — the in-folder pure-core
// split). Owns exactly one thing: `computePageWindow`, the FIXED windowing algorithm (no configurable knob
// in v1, cl.6's own wording) that decides which page numbers `pagination.ts` stamps buttons for, and where
// the `ELLIPSIS` marker lands.
//
// The algorithm: always show page 1 and the last page (the two ends), plus `page - 1 … page + 1` (the
// current page and its immediate neighbours), clamped to the valid range. Any GAP greater than one page
// between two consecutive shown numbers collapses to a single `ELLIPSIS` marker — never a page number the
// caller didn't ask for, never more than one ellipsis per gap. Pure and total: any `(page, pages)` pair,
// including out-of-range or non-integer input, produces a sane, never-throwing result.

/** The one non-numeric window item — a visual "there are more pages here" marker, never itself a page number. */
export const ELLIPSIS = 'ellipsis' as const

export type PaginationItem = number | typeof ELLIPSIS

/**
 * The fixed page-window items for `page` of `pages` total pages (ADR-0163 cl.6 — SPEC-R3's `ui-pagination`
 * anatomy: "previous/next + a windowed page list with ellipsis"). `pages <= 0` → `[]` (the honest empty
 * state — `pagination.ts` renders nothing at all when `pages < 2`, matching SPEC-R3). `page` is clamped into
 * `[1, pages]` before windowing (an out-of-range `page` never breaks the window, it just windows around the
 * nearest valid page).
 */
export function computePageWindow(page: number, pages: number): PaginationItem[] {
  const total = Math.trunc(pages)
  if (!Number.isFinite(total) || total <= 0) return []
  if (total === 1) return [1]
  const rawCurrent = Math.trunc(page)
  const current = Math.min(Math.max(1, Number.isFinite(rawCurrent) && rawCurrent !== 0 ? rawCurrent : 1), total)

  const shown = new Set<number>([1, total])
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) shown.add(i)
  }
  const sorted = [...shown].sort((a, b) => a - b)

  const items: PaginationItem[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push(ELLIPSIS)
    items.push(sorted[i])
  }
  return items
}
