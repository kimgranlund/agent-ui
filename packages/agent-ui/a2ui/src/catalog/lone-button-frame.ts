// lone-button-frame.ts: the one definition of "a Card that frames a single Button" (T-0172, T-0300, T-0369), shared by
// the producer's framed-choice check and `scripts/dogfood-compose.mjs` (which imports it), so the two cannot drift.
//
// The probe's render lint (`lone-button-frame` in `scripts/e2e-admin/probe/run.ts`) reads the DOM: a `ui-card` with one
// `ui-button` and no other text. This mirrors that from the payload side: the Card's whole subtree holds exactly one
// Button and nothing else that can carry text. A node counts as text-free only when it is a known structural type
// (TRANSPARENT: the Card parts, Row, Column, List, Grid, Divider); any other type (Text, Badge, Image, Stat, a field)
// may render text or content, so the walk stops and the Card is not framed alone. A template ChildList or a dangling
// child id is unknown content and stops the walk the same way. There is no depth cap, as the DOM lint has none; a
// visited set guards a cyclic payload. A node's `child` and `children` both count, in the same way on both sides.
// Import-free so node scripts can load it directly.

/** One component as the walk sees it: its type, the child ids it lists, and whether it holds a template ChildList. */
export interface FrameNode {
  component: string
  ids: readonly string[]
  template: boolean
}

/** The structural types a lone Button may sit inside (or beside, as an empty header or a divider) without the Card holding more. */
export const TRANSPARENT: ReadonlySet<string> = new Set(['CardHeader', 'CardContent', 'CardFooter', 'Row', 'Column', 'List', 'Grid', 'Divider'])

/** The Card-level wrapper types a repair drops with the Card (never Row or Column, which a Button group legitimately uses). */
export const CARD_PARTS: ReadonlySet<string> = new Set(['CardHeader', 'CardContent', 'CardFooter'])

/** The lone Button a Card frames and the component types between the Card and that Button (its ancestors, never an
 *  empty sibling such as a bare CardHeader), or undefined when the Card holds more. */
export function loneButtonFrame(cardId: string, get: (id: string) => FrameNode | undefined): { button: string; wrappers: string[] } | undefined {
  const card = get(cardId)
  if (card === undefined || card.template) return undefined
  const seen = new Set<string>([cardId])
  const parent = new Map<string, string>()
  const buttons: string[] = []
  const queue = [...card.ids]
  for (const id of card.ids) parent.set(id, cardId)
  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = get(id)
    if (node === undefined) return undefined
    if (node.component === 'Button') {
      buttons.push(id)
      continue
    }
    if (!TRANSPARENT.has(node.component) || node.template) return undefined
    for (const kid of node.ids) if (!parent.has(kid)) parent.set(kid, id)
    queue.push(...node.ids)
  }
  if (buttons.length !== 1) return undefined
  const wrappers = new Set<string>()
  for (let up = parent.get(buttons[0]!); up !== undefined && up !== cardId; up = parent.get(up)) wrappers.add(get(up)!.component)
  return { button: buttons[0]!, wrappers: [...wrappers].reverse() }
}
