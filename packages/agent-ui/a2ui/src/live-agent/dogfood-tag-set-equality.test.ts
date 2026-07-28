// dogfood-tag-set-equality.test.ts — genui-surface.spec.md SPEC-R13 AC2 (LLD-C5 leaf 14, GH #316/ADR-0162):
// the cross-half gate holding `DOGFOOD_TAGS` (S1's real bundle scan, `dogfood-assets.ts`) and
// `dogfoodInventoryTags()` (S3's descriptor-derived teaching set) from silently drifting apart.
//
// **Ruling #346 — RESOLVED (Kim, 2026-07-28): extend the derivation.** `dogfoodInventoryTags()` teaches
// each descriptor's own `tag:` scalar PLUS each compound family's sibling tags, scanned from that family's
// own `.define('ui-x'` call sites — the SAME technique `build-dogfood-assets.mjs` uses to derive
// `DOGFOOD_TAGS` from the built bundle. ADR-0004's schema is UNCHANGED (fork 3 declined): five real,
// shipped custom elements (`ui-card-header`/`-content`/`-footer`, `ui-tab`, `ui-tab-panel`) are documented
// only in unstructured PROSE by their family's descriptor, and the derivation now reaches them anyway.
//
// The INTERIM `KNOWN_UNDOCUMENTED_FAMILY_TAGS` allowlist this file carried between S5 and that ruling is
// GONE, and this gate is restored to the exact three-way SET-EQUALITY SPEC-R13 AC2 asked for originally:
// bundle-defined ≡ inventory-taught ≡ an independent re-scan of the committed tree. No allowlist, no
// subset-only leg, no named exceptions — a gap in EITHER direction reds this gate.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { DOGFOOD_TAGS } from '@agent-ui/components/dogfood-frame'
import { dogfoodInventoryTags } from '../agent/dogfood-inventory.ts'

declare const process: { cwd(): string }

/** The SAME independent re-scan `prompt-drift.test.ts`'s own inventory leg uses for the SDK-fence reason
 *  named there — a bare regex read over the committed tree, never importing `dogfood-inventory.ts`'s
 *  internals, so this is a genuine second derivation path for SPEC-R13 AC2's third leg, not a tautological
 *  re-check of the same code. Both halves of the ruled derivation are re-derived here independently: the
 *  descriptors' `tag:` scalars, and the family siblings each control folder self-defines (`.define('ui-x'`,
 *  minus every tag some descriptor already claims — the same fleet-wide exclusion, arrived at separately). */
function independentlyScannedTaughtTags(): Set<string> {
  const controlsDir = `${process.cwd()}/packages/agent-ui/components/src/controls`
  const descriptorTags = new Set<string>()
  const definedTags = new Set<string>()
  for (const dirName of readdirSync(controlsDir)) {
    const dirPath = `${controlsDir}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    const files = readdirSync(dirPath)
    let hasDescriptor = false
    for (const f of files) {
      if (!f.endsWith('.md')) continue
      const m = /^tag:\s*(\S+)/m.exec(readFileSync(`${dirPath}/${f}`, 'utf8'))
      if (!m) continue
      descriptorTags.add(m[1]!)
      hasDescriptor = true
    }
    if (!hasDescriptor) continue
    for (const fileName of files) {
      if (!fileName.endsWith('.ts') || fileName.endsWith('.test.ts')) continue
      const src = readFileSync(`${dirPath}/${fileName}`, 'utf8')
      for (const m of src.matchAll(/\.define\((["'`])(ui-[a-z0-9-]+)\1/g)) definedTags.add(m[2]!)
    }
  }
  for (const t of definedTags) descriptorTags.add(t)
  return descriptorTags
}

describe('DOGFOOD_TAGS ≡ dogfoodInventoryTags() — TRUE set equality, no allowlist (SPEC-R13 AC2)', () => {
  it('the bundle-defined tags and the inventory-taught tags are the SAME set, in both directions', () => {
    const bundle = new Set(DOGFOOD_TAGS)
    const inventory = new Set(dogfoodInventoryTags())
    const taughtButNotShipped = [...inventory].filter((t) => !bundle.has(t)).sort()
    const shippedButNotTaught = [...bundle].filter((t) => !inventory.has(t)).sort()
    expect(taughtButNotShipped, `taught but not shipped: ${taughtButNotShipped.join(', ')}`).toEqual([])
    expect(shippedButNotTaught, `shipped but not taught: ${shippedButNotTaught.join(', ')}`).toEqual([])
    expect(inventory).toEqual(bundle)
  })

  // The five tags GH #346 was filed about, pinned by NAME: the ruling's whole point is that the derivation
  // now REACHES a compound family's prose-only sub-elements. A regression that quietly dropped the sibling
  // scan would still satisfy a generic equality check on a future tree where nothing else moved; this one
  // names them, so it cannot.
  it('teaches the five compound-family siblings GH #346 named — the tags a `tag:`-only derivation cannot see', () => {
    const inventory = new Set(dogfoodInventoryTags())
    for (const tag of ['ui-card-header', 'ui-card-content', 'ui-card-footer', 'ui-tab', 'ui-tab-panel']) {
      expect(inventory.has(tag), `${tag} must be taught (GH #346's ruled derivation extension)`).toBe(true)
    }
  })

  // NEGATIVE CONTROL — a tag in the inventory but not the bundle must fail (proving the equality actually
  // bites, not just that real data happens to satisfy it).
  it('NEGATIVE CONTROL — a phantom taught tag absent from the bundle fails the equality', () => {
    const bundle = new Set(DOGFOOD_TAGS)
    const inventory = new Set([...dogfoodInventoryTags(), 'ui-planted-phantom-control'])
    expect(inventory).not.toEqual(bundle)
  })

  // NEGATIVE CONTROL — the OTHER direction, the one the interim allowlist used to excuse: a tag the bundle
  // self-defines that the inventory never teaches must ALSO fail. This is the leg #346 closed — an
  // untaught shipped tag is now a RED, not an allowlist row.
  it('NEGATIVE CONTROL — a bundle tag the inventory never teaches fails the equality (the allowlisted leg, now closed)', () => {
    const bundle = new Set([...DOGFOOD_TAGS, 'ui-planted-phantom-sibling'])
    expect(new Set(dogfoodInventoryTags())).not.toEqual(bundle)
  })
})

describe('dogfoodInventoryTags() ≡ an independent re-scan of the committed tree (SPEC-R13 AC2, the third leg)', () => {
  it('the inventory-taught tags exactly match an independent regex re-derivation (descriptors + family defines)', () => {
    expect(new Set(dogfoodInventoryTags())).toEqual(independentlyScannedTaughtTags())
  })

  // NEGATIVE CONTROL — a control missing from BOTH the inventory and the independent scan's expectation
  // would go undetected by a tautological check; this proves the independent re-scan genuinely diverges
  // from the inventory's own output when fed a different input, not merely a copy of it.
  it('NEGATIVE CONTROL — a control absent from the inventory\'s own output fails the equality', () => {
    const scanned = independentlyScannedTaughtTags()
    scanned.add('ui-planted-phantom-control') // a control "the tree carries" that the inventory never taught
    expect(new Set(dogfoodInventoryTags())).not.toEqual(scanned)
  })
})
