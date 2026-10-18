// framed-choice-check.ts: a choice framed in its own Card, repeated per choice (T-0258), or one Button framed alone
// (T-0300), run on every catalog.
//
// T-0172 (Kim's ruling) rules out the per-choice card of a picker: a Card whose only content is one Button. The
// probe's render lint (`lone-button-frame`) and the dogfood compose lint catch it after the fact; this check sends
// the round back. It fires when two or more such Cards sit under one parent (the recorded Haiku 5.5 "hello":
// a Row of Cards, each a CardFooter around one starter Button), and asks for one Row of plain Buttons instead.
// T-0300 (live round 6 :234, Sonnet 5.5 Omaha): a settled table left its actions Card holding only Deal again, one
// lone-button Card with no sibling, which FRAMED_CHOICE skipped. LONE_BUTTON_FRAME now sends back every other Card
// that frames one Button and asks for the plain Button in the surface's flow.
// T-0369 (round 11 :164, Haiku 5.5 seven-card stud): the probe render lint reads the DOM, one ui-button and no other
// text in the ui-card, so a one-child Row or Column wrapper (CardFooter > Row > Button) is seen through as well.
// The detector mirrors `scripts/dogfood-compose.mjs` `lone-button-frame`: the Button is the Card's sole child,
// or the sole child of a chain of one-child CardContent, CardFooter, Row or Column wrappers. It reads only Card and
// Button, so it `requires` those.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** The types a lone Button can sit inside without the Card framing more than that Button. */
const WRAPPERS: ReadonlySet<string> = new Set(['CardContent', 'CardFooter', 'Row', 'Column'])

/** The one Button a Card frames (directly, or through one-child CardContent, CardFooter, Row or Column wrappers), or undefined. */
function loneButton(view: SurfaceView, c: A2uiComponent, depth: number): A2uiComponent | undefined {
  if (!Array.isArray(c.children) && typeof c.child !== 'string') return undefined
  const ids = childIds(c)
  if (ids.length !== 1) return undefined
  const kid = view.components.get(ids[0]!)
  if (kid === undefined) return undefined
  if (kid.component === 'Button') return kid
  return WRAPPERS.has(kid.component) && depth < 3 ? loneButton(view, kid, depth + 1) : undefined
}

/** T-0316 (D3): the wrapper types between a Card and its lone Button, so the repair names only the
 *  wrappers the surface holds (a2ui-basic has neither). */
function wrappersOf(view: SurfaceView, cards: readonly A2uiComponent[]): string[] {
  const types = new Set<string>()
  for (const card of cards) {
    for (let c = view.components.get(childIds(card)[0]!); c !== undefined && c.component !== 'Button'; c = view.components.get(childIds(c)[0]!)) types.add(c.component)
  }
  return [...types]
}

export const framedChoiceCheck: SemanticCheck = {
  id: 'framed-choice',
  requires: ['Card', 'Button'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      const grouped = new Set<string>()
      for (const parent of view.components.values()) {
        const framed = childIds(parent)
          .map((id) => view.components.get(id))
          .filter((c): c is A2uiComponent => c !== undefined && c.component === 'Card' && loneButton(view, c, 0) !== undefined)
        if (framed.length < 2) continue
        for (const c of framed) grouped.add(c.id)
        const labels = framed.map((c) => loneButton(view, c, 0)!['label']).filter((l): l is string => typeof l === 'string')
        const wrappers = wrappersOf(view, framed)
        findings.push({
          code: 'FRAMED_CHOICE',
          path: `${view.surfaceId}:${framed[0]!.id}`,
          message:
            `${view.surfaceId} frames each choice in its own Card (${framed.map((c) => c.id).join(', ')}), each holding one Button${labels.length ? ` (${labels.map((l) => `"${l}"`).join(', ')})` : ''}. ` +
            `Put the Buttons directly in one Row (variant soft, wrap) under ${parent.id} and drop the Cards${wrappers.length ? ` and their ${wrappers.join(' or ')}` : ''}.`,
        })
      }
      for (const card of view.components.values()) {
        const lone = card.component === 'Card' && !grouped.has(card.id) ? loneButton(view, card, 0) : undefined
        if (lone === undefined) continue
        const label = typeof lone['label'] === 'string' ? ` "${lone['label']}"` : ''
        const wrappers = wrappersOf(view, [card])
        findings.push({
          code: 'LONE_BUTTON_FRAME',
          path: `${view.surfaceId}:${card.id}`,
          message:
            `${view.surfaceId} frames the one Button${label} (${lone.id}) alone in Card ${card.id}, a bordered box around a single action. ` +
            `Put Button ${lone.id} directly in the surface's flow where ${card.id} sits (or in the Card above it that holds the content it acts on) and drop ${card.id}${wrappers.length ? ` and its ${wrappers.join(' and ')}` : ''}.`,
        })
      }
    }
    return findings
  },
}
