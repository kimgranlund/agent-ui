// repeat.ts — the `repeat` directive (plan §6; G3 slice 1, the keyed list reconcile).
//
// `repeat(items, keyFn, template)` is a DOM-owning child directive (returns `NO_COMMIT`): it drives one
// sub-`ChildPart` per item and reconciles the keyed list itself, REUSING the part engine rather than any
// kernel/binding primitive — list reconciliation is pure DOM + key bookkeeping, it owns no effect (so it
// needs no scope_seam / `ctx`). The reconcile is a head/tail two-pointer trim plus a key→old-index map for
// the disordered middle: a surviving key REUSES its sub-part (commit the new template value → the part's
// `Object.is` skip), a moved key relocates its sub-part by IDENTITY via `moveBefore`, a new key creates a
// sub-part, a removed key disposes one, and a duplicate key THROWS. Append / remove-tail / a stable prefix
// perform ZERO moves of existing nodes (the head/tail fast paths never reach the move/map branches).
//
// Reorder guarantee — TWO-TIER (ADR-0022, the `moveBefore` seam): DOM node IDENTITY is preserved across a
// reorder ALWAYS, on every engine (the same node objects move, never re-created — what the keyed reconcile
// guarantees). ELEMENT STATE — focus / selection / transitions — additionally survives where the platform's
// native `Node.prototype.moveBefore` is supported (an atomic move); on engines without it the seam falls back
// to detach+reinsert: identity-only, focus NOT preserved (graceful degradation, no regression).
//
// SCOPE LIMIT (from the seam's `moveBefore`): a sub-part's move relocates its owned nodes + anchor —
// complete for an item rendering text or a SINGLE template (the norm). An item whose template renders an
// ARRAY or a nested directive keeps deeper content in sub-anchors `moveBefore` does not track; multi-node
// item moves are out of this slice's scope.
//
// Imports only the directive seam from `./template.ts` (same dom layer) — inward-only layering; not
// re-exported from this file (the dom barrel re-exports `repeat`).

import { Directive, directive, NO_COMMIT, type DirectiveResult } from './template.ts'

/**
 * A structural view of a sub-`ChildPart` handed to a directive via `createPart()` (the concrete class is
 * module-internal — directives reach it only through this method/its returned public surface). Exactly the
 * primitives `repeat` drives: `commit` a value, `dispose` the part, `moveBefore` it by identity, and read
 * its first DOM node (`startNode`) as a reorder reference.
 */
interface ItemPart {
  commit(value: unknown): void
  dispose(): void
  moveBefore(ref: ChildNode): void
  readonly startNode: ChildNode
}

type KeyFn = (item: unknown, index: number) => unknown
type TemplateFn = (item: unknown, index: number) => unknown

/** Render a key for a clear duplicate-key error without throwing on a symbol / object key. */
function describeKey(key: unknown): string {
  if (typeof key === 'string') return JSON.stringify(key)
  if (typeof key === 'symbol') return key.toString()
  return String(key)
}

/**
 * The `repeat` directive instance. Holds the committed list as two aligned arrays — `#keys` (the committed
 * keys, in DOM order) and `#parts` (their sub-parts) — and reconciles them against the new keys on each
 * commit of the SAME hole (state threads across commits). Owns no effect; ignores `ctx`.
 */
class RepeatDirective extends Directive {
  #keys: unknown[] = []
  #parts: ItemPart[] = []

  update(args: readonly unknown[]): unknown {
    const items = args[0] as Iterable<unknown>
    const keyFn = args[1] as KeyFn
    const template = args[2] as TemplateFn

    // Pass 1 — materialize the new keys + values, throwing on a DUPLICATE key BEFORE any DOM mutation, so a
    // bad input never leaves the list half-reconciled. Keys must be unique for the reconcile to be a bijection.
    const newKeys: unknown[] = []
    const newValues: unknown[] = []
    const seen = new Set<unknown>()
    let index = 0
    for (const item of items) {
      const key = keyFn(item, index)
      if (seen.has(key)) {
        throw new Error(`repeat: duplicate key ${describeKey(key)} — every item's key must be unique within one render.`)
      }
      seen.add(key)
      newKeys.push(key)
      newValues.push(template(item, index))
      index++
    }

    this.#reconcile(newKeys, newValues)
    return NO_COMMIT // repeat owns its DOM via the per-item sub-parts → the host part commits nothing
  }

  /** Tear down every sub-part (each removes its content + anchor). The seam isolates a throwing disposer. */
  dispose(): void {
    for (const part of this.#parts) part.dispose()
    this.#keys = []
    this.#parts = []
  }

  /** A move reference: the START node of the part a relocation lands before, or the host hole's end anchor. */
  #refNode(part: ItemPart | null | undefined): ChildNode {
    return part ? part.startNode : this.endNode
  }

  /** Create a sub-part, commit its value, and position it before `before` (or leave it at the tail). */
  #mount(value: unknown, before: ItemPart | null): ItemPart {
    const part: ItemPart = this.createPart() // its anchor lands just before the host anchor → the tail
    part.commit(value)
    if (before) part.moveBefore(before.startNode) // a middle insert moves the (new) node into place
    return part
  }

  /**
   * The keyed reconcile (Levitin/`lit-html` style): a head/tail two-pointer trims the unchanged prefix and
   * suffix in place (committing each surviving key's new value → the part's `Object.is` skip, ZERO moves),
   * the two cross checks catch a head↔tail swap, and a key→old-index map resolves the disordered middle —
   * reusing a surviving key's sub-part (moved by IDENTITY), creating one for a new key, disposing one for a
   * removed key. Append / remove-tail / a stable prefix never leave the head/tail fast paths → zero moves.
   */
  #reconcile(newKeys: unknown[], newValues: unknown[]): void {
    const oldKeys = this.#keys
    const old: (ItemPart | null)[] = this.#parts.slice() // working copy; entries are nulled as consumed
    const newParts: (ItemPart | null)[] = new Array(newKeys.length).fill(null)

    let oldHead = 0
    let oldTail = old.length - 1
    let newHead = 0
    let newTail = newKeys.length - 1

    // The maps over the disordered windows, built lazily on the FIRST middle case and reused thereafter
    // (the windows only shrink, so the first window is a superset of every later one).
    let oldKeyToIndex: Map<unknown, number> | null = null
    let newKeySet: Set<unknown> | null = null

    while (oldHead <= oldTail && newHead <= newTail) {
      if (old[oldHead] === null) {
        oldHead++ // a part consumed out of order by the map branch — skip its hole
      } else if (old[oldTail] === null) {
        oldTail--
      } else if (oldKeys[oldHead] === newKeys[newHead]) {
        // Heads match — update in place, no move.
        old[oldHead]!.commit(newValues[newHead])
        newParts[newHead] = old[oldHead]
        oldHead++
        newHead++
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Tails match — update in place, no move.
        old[oldTail]!.commit(newValues[newTail])
        newParts[newTail] = old[oldTail]
        oldTail--
        newTail--
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old head became the new tail — move it before the already-placed part after the new tail.
        const part = old[oldHead]!
        part.commit(newValues[newTail])
        part.moveBefore(this.#refNode(newParts[newTail + 1]))
        newParts[newTail] = part
        oldHead++
        newTail--
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail became the new head — move it before the current head part.
        const part = old[oldTail]!
        part.commit(newValues[newHead])
        part.moveBefore(this.#refNode(old[oldHead]))
        newParts[newHead] = part
        oldTail--
        newHead++
      } else {
        if (oldKeyToIndex === null) {
          oldKeyToIndex = new Map()
          for (let i = oldHead; i <= oldTail; i++) oldKeyToIndex.set(oldKeys[i], i)
          newKeySet = new Set(newKeys.slice(newHead, newTail + 1))
        }
        if (!newKeySet!.has(oldKeys[oldHead])) {
          old[oldHead]!.dispose() // the head key is gone → remove it
          oldHead++
        } else if (!newKeySet!.has(oldKeys[oldTail])) {
          old[oldTail]!.dispose()
          oldTail--
        } else {
          // The new head's key survives somewhere in the old middle — reuse that sub-part (or create one
          // if it is genuinely new), moving it before the current head part.
          const wantKey = newKeys[newHead]
          const oldIndex = oldKeyToIndex.has(wantKey) ? oldKeyToIndex.get(wantKey)! : -1
          const reusable = oldIndex >= 0 ? old[oldIndex] : null
          if (reusable === null) {
            newParts[newHead] = this.#mount(newValues[newHead], old[oldHead])
          } else {
            reusable.commit(newValues[newHead])
            reusable.moveBefore(this.#refNode(old[oldHead]))
            old[oldIndex] = null // consumed — its old hole is now a skip
            newParts[newHead] = reusable
          }
          newHead++
        }
      }
    }

    // Any new keys left are appended/inserted before the part after the new tail (the tail run lands before
    // the host anchor in ascending order; a middle run moves before its fixed successor).
    while (newHead <= newTail) {
      newParts[newHead] = this.#mount(newValues[newHead], newParts[newTail + 1] ?? null)
      newHead++
    }
    // Any old parts left are removed (their keys are gone).
    while (oldHead <= oldTail) {
      old[oldHead]?.dispose()
      oldHead++
    }

    this.#keys = newKeys
    this.#parts = newParts as ItemPart[] // every slot was filled by the reconcile above
  }
}

const repeatDirective = directive(RepeatDirective)

/**
 * `repeat(items, keyFn, template)` — render a keyed list into a child hole, reusing DOM by key across data
 * changes. `keyFn(item, index)` must return a value UNIQUE per item (a duplicate throws); `template(item,
 * index)` renders each item (text, a `TemplateResult`, …). A reorder MOVES surviving items by identity
 * (node identity preserved always; focus / selection preserved where native `moveBefore` is supported,
 * identity-only fallback otherwise — ADR-0022), while append / remove-tail / a stable prefix cost zero
 * moves. Prefer `repeat` over a positional array hole when items carry identity or interactive state.
 */
export function repeat<T>(
  items: Iterable<T>,
  keyFn: (item: T, index: number) => unknown,
  template: (item: T, index: number) => unknown,
): DirectiveResult {
  return repeatDirective(items, keyFn, template)
}
