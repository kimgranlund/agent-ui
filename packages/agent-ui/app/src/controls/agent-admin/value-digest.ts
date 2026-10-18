// value-digest.ts: the canonical form and the sync value digest that the agent overlay (`agent-overlay.ts`) and
// the site agent-content generator share (T-0355). A leaf: its one runtime import is the repo's canonical JSON,
// so the generator hashes exactly as the browser does without loading the overlay module.
import { canonicalJson } from '@agent-ui/a2ui/agent/agent-bundle'

/** The repo's one canonical JSON (T-0163, `@agent-ui/a2ui/agent/agent-bundle`): the equality and fingerprint
 *  basis (it drops `undefined` members, exactly as the StorageAdapter encoding does, so equal here means
 *  equal after a reload). An absent value reads `undefined`, distinct from `null`. */
export function canonical(value: unknown): string {
  return value === undefined ? 'undefined' : canonicalJson(value)
}

/** Two 32-bit FNV-1a passes (different offsets) over the canonical JSON of any value: a sync, browser-safe
 *  digest. As the overlay's seed fingerprint it only decides whether a merge runs (a false "changed" costs
 *  one no-op merge). As a per-version field digest (`diffOverlay`'s `baseDigests`) a match decides that a
 *  stored value is the old seed's and takes the new seed, so a user value is replaced only on a 64-bit
 *  collision with that old seed value. */
export function valueDigest(value: unknown): string {
  const text = canonical(value)
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x0100019d) >>> 0
  }
  return `fnv:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}
