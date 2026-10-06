// minimal-node.ts: derive the smallest valid surface for one catalog type (T-0011), so the per-type matrix
// is generated from the catalogs and a new type gets a cell with no hand file.
//
// `minimalMessages(catalog, type)` returns `[createSurface, updateComponents]`:
//   - Required props come from `PropDef.required`, filled by schema type: an `enum` takes its first member,
//     `string` 'x', `number` or `integer` 1, `boolean` true, `array` [], `object` {}. Any other schema throws
//     `MinimalUnderivable` carrying a `MINIMAL_UNDERIVABLE` finding.
//   - A type whose def declares `children` gets one `Text` leaf from the same catalog: `child: 'leaf'` for
//     the `child` kind, otherwise `children: ['leaf']`. A catalog with no `Text` is underivable. (Menu,
//     Popover and Tooltip throw "provide a trigger as the first child" without it.)
//   - A Card region type (`CARD_REGION_TYPES`, the validator's own set) is wrapped in a `Card` root.
// Browser-safe.

import type { Catalog, JsonSchema } from '../../src/catalog/catalog.ts'
import type { A2uiServerMessage } from '../../src/protocol.ts'
import { CARD_REGION_TYPES } from '../../src/renderer/validate.ts'
import { kitFinding } from './findings.ts'
import type { KitFinding } from './findings.ts'

export class MinimalUnderivable extends Error {
  override name = 'MinimalUnderivable'
  readonly finding: KitFinding
  constructor(catalogId: string, type: string, why: string) {
    super(`MINIMAL_UNDERIVABLE: ${catalogId} ${type}: ${why}`)
    this.finding = kitFinding('MINIMAL_UNDERIVABLE', { path: `${catalogId}#${type}`, detail: why })
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function fill(schema: JsonSchema): { ok: true; value: unknown } | { ok: false } {
  if (!isObject(schema)) return { ok: false }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return { ok: true, value: schema.enum[0] }
  switch (schema.type) {
    case 'string':
      return { ok: true, value: 'x' }
    case 'number':
    case 'integer':
      return { ok: true, value: 1 }
    case 'boolean':
      return { ok: true, value: true }
    case 'array':
      return { ok: true, value: [] }
    case 'object':
      return { ok: true, value: {} }
    default:
      return { ok: false }
  }
}

/** The surfaceId a matrix cell uses for one type. */
export const cellSurfaceId = (type: string): string => `cell-${type.toLowerCase()}`

export function minimalMessages(catalog: Catalog, type: string): A2uiServerMessage[] {
  const def = catalog.components[type]
  if (def === undefined) throw new MinimalUnderivable(catalog.catalogId, type, 'not a catalog type')
  const node: Record<string, unknown> = { id: 'cell', component: type }
  for (const [prop, pd] of Object.entries(def.properties)) {
    if (pd.required !== true) continue
    const filled = fill(pd.type)
    if (!filled.ok) throw new MinimalUnderivable(catalog.catalogId, type, `required prop ${prop} has an unsupported schema ${JSON.stringify(pd.type)}`)
    node[prop] = filled.value
  }
  const components: Record<string, unknown>[] = [node]
  if (def.children !== undefined) {
    if (catalog.components.Text === undefined) throw new MinimalUnderivable(catalog.catalogId, type, 'a container needs a Text leaf and the catalog has no Text')
    if (def.children === 'child') node.child = 'leaf'
    else node.children = ['leaf']
    components.push({ id: 'leaf', component: 'Text', text: 'x' })
  }
  if (CARD_REGION_TYPES.has(type)) {
    const card = catalog.components.Card
    if (card === undefined) throw new MinimalUnderivable(catalog.catalogId, type, 'a Card region needs a Card and the catalog has none')
    components.unshift(card.children === 'child' ? { id: 'root', component: 'Card', child: 'cell' } : { id: 'root', component: 'Card', children: ['cell'] })
  } else node.id = 'root'
  const surfaceId = cellSurfaceId(type)
  return [
    { version: 'v1.0', createSurface: { surfaceId, catalogId: catalog.catalogId } },
    { version: 'v1.0', updateComponents: { surfaceId, components: components as never } },
  ] as A2uiServerMessage[]
}
