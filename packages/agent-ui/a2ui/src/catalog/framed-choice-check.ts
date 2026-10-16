// framed-choice-check.ts: a choice framed in its own Card, repeated per choice (T-0258), run on every catalog.
//
// T-0172 (Kim's ruling) rules out the per-choice card of a picker: a Card whose only content is one Button. The
// probe's render lint (`lone-button-frame`) and the dogfood compose lint catch it after the fact; this check sends
// the round back. It fires when two or more such Cards sit under one parent (the recorded Haiku 5.5 "hello":
// a Row of Cards, each a CardFooter around one starter Button), and asks for one Row of plain Buttons instead.
// The detector mirrors `scripts/dogfood-compose.mjs` `lone-button-frame`: the Button is the Card's sole child,
// or the sole child of a lone CardContent or CardFooter. It reads only Card and Button, so it `requires` those.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** The one Button a Card frames (directly, or through a lone CardContent or CardFooter), or undefined. */
function loneButton(view: SurfaceView, c: A2uiComponent, depth: number): A2uiComponent | undefined {
  if (!Array.isArray(c.children) && typeof c.child !== 'string') return undefined
  const ids = childIds(c)
  if (ids.length !== 1) return undefined
  const kid = view.components.get(ids[0]!)
  if (kid === undefined) return undefined
  if (kid.component === 'Button') return kid
  return (kid.component === 'CardContent' || kid.component === 'CardFooter') && depth < 2 ? loneButton(view, kid, depth + 1) : undefined
}

export const framedChoiceCheck: SemanticCheck = {
  id: 'framed-choice',
  requires: ['Card', 'Button'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      for (const parent of view.components.values()) {
        const framed = childIds(parent)
          .map((id) => view.components.get(id))
          .filter((c): c is A2uiComponent => c !== undefined && c.component === 'Card' && loneButton(view, c, 0) !== undefined)
        if (framed.length < 2) continue
        const labels = framed.map((c) => loneButton(view, c, 0)!['label']).filter((l): l is string => typeof l === 'string')
        findings.push({
          code: 'FRAMED_CHOICE',
          path: `${view.surfaceId}:${framed[0]!.id}`,
          message:
            `${view.surfaceId} frames each choice in its own Card (${framed.map((c) => c.id).join(', ')}), each holding one Button${labels.length ? ` (${labels.map((l) => `"${l}"`).join(', ')})` : ''}. ` +
            `Put the Buttons directly in one Row (variant soft, wrap) under ${parent.id} and drop the Cards and their CardFooter or CardContent.`,
        })
      }
    }
    return findings
  },
}
