// site/lib/frontmatter.ts — the doc page's thin adapter onto the CANONICAL frontmatter parser (A4, ADR-0004).
// `button.md` is the single descriptor source: the contract trip-wire parses it inside the package, and this
// page is the SECOND consumer of that SAME parser exposed at `@agent-ui/components/descriptor`. It does NOT
// re-implement a frontmatter dialect — it splits the fence and runs `parseDescriptor`, so the doc table cannot
// drift from the contract the trip-wire enforces.
import { parseDescriptor, splitFrontmatter } from '@agent-ui/components/descriptor'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// The raw `button.md` text, pulled at build time via Vite's `?raw` import (relative path from /site to the
// control's source). `vite build` reads it from disk; the descriptor is the single source of truth for both
// the in-package contract trip-wire and this doc page.
import buttonMd from '../../packages/agent-ui/components/src/controls/button/button.md?raw'

/** The parsed `button.md`: the structured descriptor (its attributes-as-API drive the table) + the prose body. */
export interface ButtonDoc {
  readonly descriptor: ParsedDescriptor
  readonly body: string
}

/** Read `button.md` through the canonical parser → the structured descriptor + the markdown body below the fence. */
export function loadButtonDoc(): ButtonDoc {
  const { fence, body } = splitFrontmatter(buttonMd)
  return { descriptor: parseDescriptor(fence), body }
}
