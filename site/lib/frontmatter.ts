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

/** Read `button.md` (the reference control) through the canonical parser. */
export const loadButtonDoc = (): ComponentDoc => parseDoc(buttonMd)

/** Read `text-field.md` (the first FACE form control) through the canonical parser. */
export const loadTextFieldDoc = (): ComponentDoc => parseDoc(textFieldMd)
