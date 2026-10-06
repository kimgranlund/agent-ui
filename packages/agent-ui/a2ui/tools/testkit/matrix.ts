// matrix.ts: the one cell predicate of the generated per-type matrix (T-0011), shared by the jsdom leg
// (`src/testkit/matrix.test.ts`, every catalog) and the real-engine leg (`matrix.browser.test.ts`, the two
// base catalogs). A cell derives its minimal surface (minimal-node.ts), validates it at finalize, mounts it,
// and requires its root, no placeholder, no error client message, and every custom-element-named node
// defined. Browser-safe.

import type { Catalog } from '../../src/catalog/catalog.ts'
import { validateA2ui } from '../../src/renderer/validate.ts'
import { minimalMessages, MinimalUnderivable, cellSurfaceId } from './minimal-node.ts'
import { createKitMount, RenderError } from './mount.ts'
import type { KitMount } from './mount.ts'

/** Every defect of one (catalog, type) cell; `[]` when the cell is green. `before` runs on the fresh mount
 *  before ingest (a negative control registers its planted catalog there). */
export async function cellDefects(catalog: Catalog, type: string, before?: (m: KitMount) => void): Promise<string[]> {
  let messages
  try {
    messages = minimalMessages(catalog, type)
  } catch (err) {
    if (err instanceof MinimalUnderivable) return [err.message]
    throw err
  }
  const verdict = validateA2ui(messages, catalog, undefined, { atFinalize: true })
  if (!verdict.valid) return verdict.failures.map((f) => `validate: ${f.code} at ${f.path}`)
  const sid = cellSurfaceId(type)
  const m = createKitMount()
  const defects: string[] = []
  try {
    before?.(m)
    m.ingest(messages.map((msg) => JSON.stringify(msg)))
    m.finalize(sid)
    try {
      await m.settle()
    } catch (err) {
      if (!(err instanceof RenderError)) throw err
      return [err.message]
    }
    const root = m.surfaceRoot(sid)
    if (root === undefined) return ['no surface root']
    const nodes = [root, ...Array.from(root.querySelectorAll('*'))]
    if (nodes.some((n) => n.localName === 'a2ui-placeholder')) defects.push('a placeholder rendered')
    for (const n of nodes) if (n.localName.includes('-') && customElements.get(n.localName) === undefined) defects.push(`<${n.localName}> is not defined`)
    for (const c of m.clientMessages()) if ('error' in c) defects.push(`error message: ${JSON.stringify(c.error)}`)
  } finally {
    m.dispose()
  }
  return defects
}
