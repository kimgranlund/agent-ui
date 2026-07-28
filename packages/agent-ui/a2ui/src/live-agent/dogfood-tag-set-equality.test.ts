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
// bundle-defined ≡ inventory-taught ≡ the tags the real barrel REGISTERS AT RUNTIME. No allowlist, no
// subset-only leg, no named exceptions — a gap in EITHER direction reds this gate.
//
// **The third leg is a RUNTIME derivation, deliberately (GH #351 F3).** It used to be a source re-scan,
// which — once the ruled derivation grew its own `.define(` leg — was a line-for-line TRANSCRIPTION of
// `dogfood-inventory.ts`: same walk, same filters, same regex. A transcription cannot disagree with its
// original, and review proved the cost empirically: a commented-out `.define('ui-x')` planted in a real
// control flowed through BOTH source re-scans unchallenged, leaving a three-way gate that was two-way on
// siblings. So this leg now asks the question by a genuinely different MECHANISM: intercept
// `customElements.define` and import the real components barrel, recording what actually registers. It
// reads no source text and no descriptor — it observes behavior. That also cross-checks the bundle
// generator itself: `DOGFOOD_TAGS` is `extractTags`' STATIC scan of the MINIFIED bundle, so a minifier
// change that defeated that regex would show up here as a disagreement rather than as a silent zero.

import { describe, it, expect, beforeAll } from 'vitest'
import { DOGFOOD_TAGS } from '@agent-ui/components/dogfood-frame'
import { dogfoodInventoryTags } from '../agent/dogfood-inventory.ts'

/** Every `ui-*` tag the REAL components barrel registers when it loads — captured by wrapping
 *  `customElements.define` before the import, so this is a behavioral observation, never a re-reading of
 *  the same bytes `dogfood-inventory.ts` parses. Computed ONCE (`beforeAll`): the barrel self-defines on
 *  first import, and a module-cached second import would register nothing. */
let runtimeRegisteredTags: Set<string>

beforeAll(async () => {
  const seen = new Set<string>()
  const realDefine = customElements.define.bind(customElements)
  customElements.define = (name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
    if (name.startsWith('ui-')) seen.add(name)
    return realDefine(name, ctor, options)
  }
  try {
    await import('@agent-ui/components/components')
  } finally {
    customElements.define = realDefine
  }
  runtimeRegisteredTags = seen
})

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

describe('dogfoodInventoryTags() ≡ what the real barrel REGISTERS at runtime (SPEC-R13 AC2, the third leg)', () => {
  it('the inventory-taught tags exactly match the tags the components barrel actually self-defines', () => {
    expect(new Set(dogfoodInventoryTags())).toEqual(runtimeRegisteredTags)
  })

  // The leg's own independence, asserted rather than claimed: a RUNTIME observation cannot be a
  // transcription of a source scan, and this pins that it observed a real, non-trivial fleet (a broken
  // interception that captured nothing would otherwise make the equality above vacuously interesting).
  it('the runtime observation is real and non-trivial — the whole fleet registered, not an empty capture', () => {
    expect(runtimeRegisteredTags.size).toBeGreaterThan(50)
    expect(runtimeRegisteredTags.has('ui-card-header')).toBe(true) // a prose-only family sibling, registered for real
  })

  // NEGATIVE CONTROL — proves the equality bites: a tag the runtime registered that the inventory never
  // taught fails. This is the leg the OLD source re-scan could not honestly provide, because a
  // transcription of the inventory's own scan agreed with it by construction (GH #351 F3).
  it('NEGATIVE CONTROL — a registered tag absent from the inventory\'s own output fails the equality', () => {
    const registered = new Set([...runtimeRegisteredTags, 'ui-planted-phantom-control'])
    expect(new Set(dogfoodInventoryTags())).not.toEqual(registered)
  })
})
