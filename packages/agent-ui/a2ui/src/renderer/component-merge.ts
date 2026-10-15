// component-merge.ts: one `updateComponents` batch applied to a surface's component records the way the
// renderer applies it (T-0220), DOM-free, for the server-side replays that must hold the renderer's graph:
// the cross-turn validation seed (`agent/surface-seeds.ts`), the semantic surface views
// (`catalog/semantic-check.ts`) and the validator's per-payload id graph (`validate.ts`, T-0226).
//
// The renderer (`tree.ts` `apply`) first upserts every delivered record by id, then reconciles each id that
// was already mounted: a child its new list no longer names is disposed with its whole subtree, and the
// records go with it (`#reconcileChildren`, `#disposeSubtree`, RSR-C7). A pure upsert keeps those records,
// so a later turn that lists the child again without redelivering it passed the server and dangled in the
// renderer (`acts->bBet`, the five-card-draw trace). "Mounted" is approximated as reachable from `root`
// through `child`/`children` before the batch; nothing mounts before `root` exists, as in the renderer.
//
// Pure, total and import-free at runtime, so the catalog-side views (DOM-less, node-free) may import it.

import type { A2uiComponent } from '../protocol.ts'

/** A node's static child ids: `child`, then `children` when it is an id list (tree.ts `childRefs`). */
function childRefs(node: A2uiComponent): string[] {
  const out: string[] = []
  if (typeof node.child === 'string') out.push(node.child)
  if (Array.isArray(node.children)) for (const c of node.children) if (typeof c === 'string') out.push(c)
  return out
}

function reachableFromRoot(byId: ReadonlyMap<string, A2uiComponent>): Set<string> {
  const seen = new Set<string>()
  const stack = byId.has('root') ? ['root'] : []
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    const node = byId.get(id)
    if (node === undefined) continue
    seen.add(id)
    stack.push(...childRefs(node))
  }
  return seen
}

/** Delete `id` and every descendant that has a record, children first (tree.ts `#disposeSubtree`). */
function disposeSubtree(byId: Map<string, A2uiComponent>, id: string, visiting = new Set<string>()): void {
  if (visiting.has(id)) return // a cycle never reaches the renderer's reconcile; stay total anyway
  visiting.add(id)
  const node = byId.get(id)
  if (node !== undefined) for (const childId of childRefs(node)) if (byId.has(childId)) disposeSubtree(byId, childId, visiting)
  byId.delete(id)
}

/** Apply one `updateComponents` batch to `byId` in place: upsert by id, then dispose the subtrees a
 *  resent, mounted container dropped from its children. Entries without a string `id` are skipped. */
export function applyComponentBatch(byId: Map<string, A2uiComponent>, components: readonly unknown[]): void {
  const mounted = reachableFromRoot(byId)
  const resent = new Map<string, A2uiComponent>()
  for (const comp of components) {
    if (typeof comp !== 'object' || comp === null || typeof (comp as { id?: unknown }).id !== 'string') continue
    const record = comp as A2uiComponent
    const previous = byId.get(record.id)
    if (previous !== undefined && mounted.has(record.id)) resent.set(record.id, previous)
    byId.set(record.id, record)
  }
  for (const [id, previous] of resent) {
    const next = byId.get(id)
    if (next === undefined) continue // an earlier reconcile in this batch already disposed it
    const kept = new Set(childRefs(next))
    for (const removed of childRefs(previous)) if (!kept.has(removed)) disposeSubtree(byId, removed)
  }
}
