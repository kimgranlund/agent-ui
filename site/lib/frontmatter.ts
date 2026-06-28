// site/lib/frontmatter.ts — the doc page's thin adapter onto the CANONICAL frontmatter parser (A4, ADR-0004).
// A control's `{name}.md` is the single descriptor source: the contract trip-wire parses it INSIDE the package,
// and a /site doc page is the SECOND consumer of that SAME parser exposed at `@agent-ui/components/descriptor`.
// It does NOT re-implement a frontmatter dialect — it splits the fence and runs `parseDescriptor`, so a doc
// table cannot drift from the contract the trip-wire enforces (one parser, two consumers).
//
// Vite's `?raw` import path must be a static string literal (the bundler reads the file from disk at build
// time), so the {name}.md text cannot be loaded by a runtime-computed path. Each control therefore gets a tiny
// `load{Name}Doc()` that imports ITS OWN `{name}.md?raw` and delegates to the shared `parseDoc` — adding a
// control's doc page is one such 2-line loader, never a new frontmatter reader.
import { parseDescriptor, splitFrontmatter } from '@agent-ui/components/descriptor'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// The raw control descriptors, pulled at build time via Vite's `?raw` import (relative path from /site to the
// control source). `vite build` reads them from disk; each `{name}.md` is the single source of truth for both
// the in-package contract trip-wire and its /site doc page.
import buttonMd from '../../packages/agent-ui/components/src/controls/button/button.md?raw'
import textFieldMd from '../../packages/agent-ui/components/src/controls/text-field/text-field.md?raw'
import rowMd from '../../packages/agent-ui/components/src/controls/row/row.md?raw'
import columnMd from '../../packages/agent-ui/components/src/controls/column/column.md?raw'
import listMd from '../../packages/agent-ui/components/src/controls/list/list.md?raw'
import gridMd from '../../packages/agent-ui/components/src/controls/grid/grid.md?raw'
import cardMd from '../../packages/agent-ui/components/src/controls/card/card.md?raw'
import tabsMd from '../../packages/agent-ui/components/src/controls/tabs/tabs.md?raw'
import modalMd from '../../packages/agent-ui/components/src/controls/modal/modal.md?raw'

/** A parsed control descriptor: the structured frontmatter (its attributes-as-API drive the table) + the prose body. */
export interface ComponentDoc {
  readonly descriptor: ParsedDescriptor
  readonly body: string
}

/** Read a raw `{name}.md` through the canonical parser → the structured descriptor + the markdown body below the fence. */
export function parseDoc(raw: string): ComponentDoc {
  const { fence, body } = splitFrontmatter(raw)
  return { descriptor: parseDescriptor(fence), body }
}

// ── per-control loaders (one 2-line loader per documented control — the convention) ──────────────────────────
export const loadButtonDoc = (): ComponentDoc => parseDoc(buttonMd)
export const loadTextFieldDoc = (): ComponentDoc => parseDoc(textFieldMd)
export const loadRowDoc = (): ComponentDoc => parseDoc(rowMd)
export const loadColumnDoc = (): ComponentDoc => parseDoc(columnMd)
export const loadListDoc = (): ComponentDoc => parseDoc(listMd)
export const loadGridDoc = (): ComponentDoc => parseDoc(gridMd)
export const loadCardDoc = (): ComponentDoc => parseDoc(cardMd)
export const loadTabsDoc = (): ComponentDoc => parseDoc(tabsMd)
export const loadModalDoc = (): ComponentDoc => parseDoc(modalMd)

// ── tier enumeration (for the family overview + tier showcase — a DERIVED member list) ───────────────────────
// The whole `{name}.md` descriptor set, globbed at build time (Vite resolves `import.meta.glob` statically). The
// family overview / tier showcase derive their member list from THIS — a new control in a tier appears
// automatically, so the listing cannot drift from the shipped fleet (the T7 coverage discipline).
const ALL_DESCRIPTORS = import.meta.glob(
  '../../packages/agent-ui/components/src/controls/*/*.md',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** One enumerated member: its tag-derived name + its parsed descriptor doc. */
export interface TierMember {
  readonly name: string
  readonly tag: string
  readonly doc: ComponentDoc
}

/** Every shipped control whose descriptor `tier` matches, sorted by name — the DERIVED member list for a tier page. */
export function membersOfTier(tier: string): TierMember[] {
  const members: TierMember[] = []
  for (const raw of Object.values(ALL_DESCRIPTORS)) {
    const doc = parseDoc(raw)
    const tag = doc.descriptor.scalars.get('tag')
    if (doc.descriptor.scalars.get('tier') === tier && typeof tag === 'string' && tag.startsWith('ui-')) {
      members.push({ name: tag.slice('ui-'.length), tag, doc })
    }
  }
  return members.sort((a, b) => a.name.localeCompare(b.name))
}
