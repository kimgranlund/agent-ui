// source-list-model.ts — the pure, DOM-free source-attribution hardening (ADR-0214 cl.2). No DOM, no
// host, unit-testable in plain Node/Vitest — the table-model.ts/description-list-model.ts in-folder
// pure-core split (ADR-0111 cl.8). Owns:
//
//   1. `cleanSources` — the DROP-MALFORMED-ENTRIES cleaner (ADR-0214 cl.2, GH #1394): a non-array input
//      is `[]`; an entry survives ONLY as a plain object whose `title` is a non-empty, non-whitespace
//      string — the empty-title omission law, the ADR-0201 idiom verbatim ("drops entries with an empty
//      title BY CONSTRUCTION"). Everything else about a surviving entry is HARDENED, not a second reason
//      to drop it: a non-string/absent `href` degrades to `''` (the safeHref gate's own "no destination"
//      denial, `../text/href.ts` — never a reason to discard the entry, since ADR-0214 cl.2 rules a
//      denied/empty href renders the title as PLAIN TEXT, attribution kept, link stripped — the per-entry
//      safeHref gate is `source-list.ts`'s job at RENDER time, not this cleaner's); a non-string or
//      empty/whitespace `snippet` drops the optional field, never the whole entry. Order preserved
//      (positional) — index markers are the array position (1-based), never producer-authored, so
//      marker↔row drift is unrepresentable (ADR-0214 cl.2's Context 1 payoff).
//   2. `sourcesProp`, the safe JSON codec (the `descriptionRowsProp`/`tableRowsProp` shape verbatim):
//      `from(null)` (attribute absent/removed) is `[]`, never `null`; malformed attribute JSON is caught
//      and also falls back to `[]` — no throw ever reaches `attributeChangedCallback`; every parsed value
//      (well-formed or not) runs through `cleanSources`, so the property never carries an un-hardened
//      array. The generic `dom/props.ts` `jsonType<T>()` is deliberately NOT used — its bare `JSON.parse`
//      throws on malformed attributes and maps a removed attribute to `null` (the exact reasoning
//      table-model.ts/description-list-model.ts record for their own codecs); this is the ADR-0173 OF1
//      bespoke `codec:` reference `source-list.md` names.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One source entry — the wire shape ADR-0214 cl.2 fixes verbatim: `{ href, title, snippet? }`. The SAME
 *  shape serves the public input contract (any field may arrive malformed; the hardening judges it) and
 *  the rendered set (post-`cleanSources`, `title` is always a non-empty string and `href` is always a
 *  string — possibly denied/empty, judged per-entry by the component's `safeHref` gate at render time). */
export interface SourceEntry {
  href: string
  title: string
  snippet?: string
}

/** True for a plain object entry (non-null, non-array) — the structural floor an entry must clear. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Harden an arbitrary input into the rendered source set (ADR-0214 cl.2 — the drop-malformed-entries
 * cleaner, GH #1394): a non-array input yields `[]`; an entry survives only as a plain object with a
 * non-empty, non-whitespace string `title`. A malformed/absent `href` degrades to `''` rather than
 * dropping the entry (the safeHref gate denies `''` the same as any other bad value — that per-entry
 * gate, not this cleaner, is what strips the link); a non-string or empty/whitespace `snippet` is
 * dropped as a field, never as a reason to drop the entry. Order preserved (positional; duplicate
 * titles both survive — the component imposes no key identity, since index markers are POSITION, never
 * an authored identity).
 */
export function cleanSources(input: unknown): SourceEntry[] {
  if (!Array.isArray(input)) return []
  const out: SourceEntry[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue // not an object — malformed, drop
    const title = entry.title
    if (typeof title !== 'string' || title.trim() === '') continue // the empty-title omission law (ADR-0214 cl.2)
    const href = typeof entry.href === 'string' ? entry.href : '' // malformed/absent → "no destination" (safeHref denies '', the entry still renders)
    const snippetRaw = entry.snippet
    const snippet = typeof snippetRaw === 'string' && snippetRaw.trim() !== '' ? snippetRaw : undefined
    out.push(snippet !== undefined ? { href, title, snippet } : { href, title })
  }
  return out
}

/**
 * The safe `sources` codec (the `descriptionRowsProp`/`tableRowsProp` shape verbatim): `from(null)` →
 * `[]`, malformed JSON → `[]`, never throws; every parse result is hardened by `cleanSources`, so the
 * property never holds a raw, un-hardened array (a direct property write is re-hardened by the render
 * effect calling `cleanSources` again — the table.ts/description-list.ts case-3 property-write guard,
 * shared idiom).
 */
const sourcesType: PropType<SourceEntry[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanSources(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const sourcesProp: PropConfig<SourceEntry[]> = {
  type: sourcesType,
  default: [],
}
