// dogfood-tag-set-equality.test.ts — genui-surface.spec.md SPEC-R13 AC2 (LLD-C5 leaf 14, GH #316/ADR-0162):
// the cross-half gate holding `DOGFOOD_TAGS` (S1's real bundle scan, `dogfood-assets.ts`) and
// `dogfoodInventoryTags()` (S3's descriptor-derived teaching set) from silently drifting apart.
//
// **Ruling #346** (design fork, recorded — read before touching this file): `dogfoodInventoryTags()` is
// PURELY descriptor-derived (SPEC-R13(b)'s own wording, and the SAME property #342 has under review for a
// different reason — no second, unratified change to what "descriptor-derived" means lands the same
// night). The bundle, by construction (`build-dogfood-assets.mjs`'s `.define('ui-x'` scan), also carries
// FIVE real custom elements a "compound family" self-defines but documents only in unstructured PROSE, not
// a machine-readable `tag:` row of their own (`card.md`'s own frontmatter comment says it outright: "The
// region sub-elements (ui-card-header/-content/-footer) are documented in the prose body... " — same shape
// in `tabs.md` for `ui-tab`/`ui-tab-panel`). ADR-0004 has no field for a family sub-element today.
//
// Until that's resolved (the RECOMMENDED end state, recorded in #346, is extending the inventory's own
// derivation to also scan for sibling `.define(` call sites, the SAME technique the bundle's own generation
// script already uses — NOT done here, on purpose, per the ruling above), this gate holds the KNOWN gap to
// an EXPLICIT, NAMED, fail-closed allowlist: not a superset, not a subset — EXACTLY these five, named
// individually, never a pattern. A sixth tag joining the gap (or the gap shrinking) REDS this gate rather
// than silently absorbing the drift — "an allowlist that absorbs new drift is worse than no gate" (#346).

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { DOGFOOD_TAGS } from '@agent-ui/components/dogfood-frame'
import { dogfoodInventoryTags } from '../agent/dogfood-inventory.ts'

declare const process: { cwd(): string }

/** The five real, shipped, bundle-defined tags with NO descriptor row of their own — recorded, named,
 *  cited to #346. NEVER a pattern/prefix match: each addition to this exact set is a deliberate,
 *  reviewed edit, not something a future control can silently grow into by naming convention alone. */
const KNOWN_UNDOCUMENTED_FAMILY_TAGS: ReadonlySet<string> = new Set([
  'ui-card-content', // card.ts's region sub-element — card.md's own frontmatter: "documented in the prose body"
  'ui-card-footer', // ditto
  'ui-card-header', // ditto
  'ui-tab', // tabs.ts's compound-family sibling — tabs.md's own frontmatter: "documents all THREE elements"
  'ui-tab-panel', // ditto
])

/** The SAME independent re-scan `prompt-drift.test.ts`'s own inventory leg uses for the SDK-fence reason
 *  named there — a bare regex read over the committed tree, never importing `dogfood-inventory.ts`'s
 *  internals, so this is a genuine second derivation path for the "descriptor-bearing barrel controls"
 *  third leg (SPEC-R13 AC2's own wording), not a tautological re-check of the same code. */
function independentlyScannedDescriptorTags(): Set<string> {
  const controlsDir = `${process.cwd()}/packages/agent-ui/components/src/controls`
  const tags = new Set<string>()
  for (const dirName of readdirSync(controlsDir)) {
    const dirPath = `${controlsDir}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith('.md')) continue
      const src = readFileSync(`${dirPath}/${fileName}`, 'utf8')
      const m = /^tag:\s*(\S+)/m.exec(src)
      if (m) tags.add(m[1]!)
    }
  }
  return tags
}

describe('DOGFOOD_TAGS ⊇ dogfoodInventoryTags() — the subset half (SPEC-R13 AC2, unambiguous under either fork)', () => {
  it('every tag the inventory teaches is a tag the bundle actually self-defines', () => {
    const bundle = new Set(DOGFOOD_TAGS)
    const inventory = new Set(dogfoodInventoryTags())
    const taughtButNotShipped = [...inventory].filter((t) => !bundle.has(t))
    expect(taughtButNotShipped, `taught but not shipped: ${taughtButNotShipped.join(', ')}`).toEqual([])
  })

  // NEGATIVE CONTROL — a tag in the inventory but not the bundle must fail the subset check above (proving
  // it actually bites, not just that real data happens to satisfy it).
  it('NEGATIVE CONTROL — a phantom taught tag absent from the bundle fails the subset check', () => {
    const bundle = new Set(DOGFOOD_TAGS)
    const inventory = new Set([...dogfoodInventoryTags(), 'ui-planted-phantom-control'])
    const taughtButNotShipped = [...inventory].filter((t) => !bundle.has(t))
    expect(taughtButNotShipped).toEqual(['ui-planted-phantom-control'])
  })
})

describe('dogfoodInventoryTags() ≡ the descriptor-bearing barrel controls (SPEC-R13 AC2, the third leg)', () => {
  it('the inventory-taught tags exactly match an independent regex re-scan of every real committed descriptor', () => {
    expect(new Set(dogfoodInventoryTags())).toEqual(independentlyScannedDescriptorTags())
  })

  // NEGATIVE CONTROL — a descriptor-bearing control missing from BOTH the inventory and the independent
  // scan's expectation would go undetected by a tautological check; this proves the independent re-scan
  // genuinely diverges from the inventory's own output when fed a different input, not merely a copy of it.
  it('NEGATIVE CONTROL — a descriptor-bearing control absent from the inventory\'s own output fails the equality', () => {
    const scanned = independentlyScannedDescriptorTags()
    scanned.add('ui-planted-phantom-control') // a control "the descriptor tree carries" that the inventory never taught
    expect(new Set(dogfoodInventoryTags())).not.toEqual(scanned)
  })
})

describe('the bundle-minus-inventory gap ≡ the KNOWN_UNDOCUMENTED_FAMILY_TAGS allowlist, EXACTLY (#346, fail-closed)', () => {
  function bundleOnlyTags(): Set<string> {
    const inventory = new Set(dogfoodInventoryTags())
    return new Set(DOGFOOD_TAGS.filter((t) => !inventory.has(t)))
  }

  it('the real, measured gap is EXACTLY the five named tags — no more, no fewer', () => {
    expect(bundleOnlyTags()).toEqual(KNOWN_UNDOCUMENTED_FAMILY_TAGS)
  })

  // NEGATIVE CONTROL — a SIXTH bundle-only tag (simulating a future compound family shipping a new
  // undocumented sibling) must widen the real gap PAST the allowlist and fail the exact-equality check
  // above — the allowlist does not silently absorb it. Simulated by unioning a synthetic tag into the
  // REAL bundle-only set (never a planted file — this proves the ASSERTION'S shape bites, independent of
  // how the sixth tag would concretely arise).
  it('NEGATIVE CONTROL — a sixth, unlisted bundle-only tag fails the exact-equality allowlist check', () => {
    const withSixth = new Set([...bundleOnlyTags(), 'ui-planted-phantom-sibling'])
    expect(withSixth).not.toEqual(KNOWN_UNDOCUMENTED_FAMILY_TAGS)
  })

  // NEGATIVE CONTROL — the allowlist is EXACT, not a ceiling: the gap shrinking (a family tag gaining
  // real descriptor coverage without this allowlist being updated to drop it) must ALSO fail — a stale
  // allowlist entry is exactly as much silent drift as a missing one.
  it('NEGATIVE CONTROL — a stale allowlist entry (the gap having shrunk) also fails the exact-equality check', () => {
    const shrunk = new Set(bundleOnlyTags())
    shrunk.delete('ui-tab-panel') // simulates ui-tab-panel having gained real descriptor coverage
    expect(shrunk).not.toEqual(KNOWN_UNDOCUMENTED_FAMILY_TAGS)
  })
})
