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
// text in the ui-card, so the Button may sit behind any chain of one-child wrappers (CardFooter > Row > Button). The
// walk is the shared `lone-button-frame.ts`, which `scripts/dogfood-compose.mjs` imports too; see it for the rule.
// It reads only Card and Button, so it `requires` those.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'
import { CARD_PARTS, loneButtonFrame } from './lone-button-frame.ts'

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** Whether a component lists a template ChildList (an object `children`), whose ids are not fixed. */
const hasTemplate = (c: A2uiComponent): boolean => typeof c.children === 'object' && c.children !== null && !Array.isArray(c.children)

/** The lone Button a Card frames (T-0369: through any structural wrappers), via the shared walk. */
function loneButton(view: SurfaceView, card: A2uiComponent): { button: A2uiComponent; wrappers: string[] } | undefined {
  const frame = loneButtonFrame(card.id, (id) => {
    const c = view.components.get(id)
    return c === undefined ? undefined : { component: c.component, ids: childIds(c), template: hasTemplate(c) }
  })
  return frame === undefined ? undefined : { button: view.components.get(frame.button)!, wrappers: frame.wrappers }
}

/** T-0316 (D3): the Card-level wrapper types between a Card and its lone Button, so the repair names only the ones the
 *  surface holds (a2ui-basic has neither). Row and Column are never named: the FRAMED_CHOICE repair builds a Row. */
const cardParts = (wrappers: readonly string[]): string[] => wrappers.filter((w) => CARD_PARTS.has(w))

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
          .filter((c): c is A2uiComponent => c !== undefined && c.component === 'Card' && loneButton(view, c) !== undefined)
        if (framed.length < 2) continue
        for (const c of framed) grouped.add(c.id)
        const found = framed.map((c) => loneButton(view, c)!)
        const labels = found.map((f) => f.button['label']).filter((l): l is string => typeof l === 'string')
        const parts = cardParts([...new Set(found.flatMap((f) => f.wrappers))])
        findings.push({
          code: 'FRAMED_CHOICE',
          path: `${view.surfaceId}:${framed[0]!.id}`,
          message:
            `${view.surfaceId} frames each choice in its own Card (${framed.map((c) => c.id).join(', ')}), each holding one Button${labels.length ? ` (${labels.map((l) => `"${l}"`).join(', ')})` : ''}. ` +
            `Put the Buttons directly in one Row (variant soft, wrap) under ${parent.id} and drop the Cards${parts.length ? ` and their ${parts.join(' or ')}` : ''}.`,
        })
      }
      for (const card of view.components.values()) {
        const lone = card.component === 'Card' && !grouped.has(card.id) ? loneButton(view, card) : undefined
        if (lone === undefined) continue
        const label = typeof lone.button['label'] === 'string' ? ` "${lone.button['label']}"` : ''
        const parts = cardParts(lone.wrappers)
        // grammar.md "Card anatomy": a footer with exactly one action Button skips the Row, so a Row or Column is not
        // part of the fix; the Button either leaves the Card or, where the Card holds content it acts on, is the footer's own child.
        findings.push({
          code: 'LONE_BUTTON_FRAME',
          path: `${view.surfaceId}:${card.id}`,
          message:
            `${view.surfaceId} frames the one Button${label} (${lone.button.id}) alone in Card ${card.id}, a bordered box around a single action. ` +
            `Put Button ${lone.button.id} directly in the surface's flow where ${card.id} sits (or, in the CardFooter of the Card above it that holds the content it acts on, as the footer's own child, since a footer with one Button needs no Row) and drop ${card.id}${parts.length ? ` and its ${parts.join(' and ')}` : ''}.`,
        })
      }
    }
    return findings
  },
}
