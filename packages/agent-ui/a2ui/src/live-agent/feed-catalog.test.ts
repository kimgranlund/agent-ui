// feed-catalog.test.ts — ADR-0097 §3 / SPEC-R15 / LLD-C14: the feed sub-catalog partition gate. Lives here
// (not co-located with `tools/agent/feed-catalog.ts`) for the SAME globbing-driven reason
// `produce-loop.test.ts`/`system-prompt-grammar.test.ts` exercise their `tools/agent/*.ts` subjects from
// `src/live-agent/` — the vitest `packages` project only globs `src/**/*.test.ts` (the site-canon
// reach-out precedent, LLD §0/§2).
//
// Asserts `FEED_SURFACE_TYPES ∪ FEED_EXCLUDED` equals the DEFAULT CATALOG's component set EXACTLY and
// DISJOINTLY, that the known composite families stay IN/OUT together (closure), and — the load-bearing
// negative control — that the SAME union-equality check the gate runs would FAIL to cover an
// undispositioned future catalog type, proving the mechanism actually bites (the ADR-0087 lesson).

import { describe, it, expect } from 'vitest'
import { defaultCatalog } from '../catalog/default/index.ts'
import { FEED_SURFACE_TYPES, FEED_EXCLUDED, FEED_SURFACE_TYPE_SET, isFeedSurfaceType } from '../../tools/agent/feed-catalog.ts'

const catalogTypes = new Set(Object.keys(defaultCatalog.components))
const inSet = new Set<string>(FEED_SURFACE_TYPES)
const outSet = new Set<string>(FEED_EXCLUDED.map((e) => e.type))

describe('feed sub-catalog partition gate (ADR-0097 §3 / SPEC-R15 / LLD-C14)', () => {
  it('has the exact ADR-0097 §3 counts — 27 IN, 27 OUT (11 at ratification + the chart-family pair, ADR-0097 Amendment / ADR-0107 Amendment 2 + the report/content/feed catalog wave\'s 3 IN / 5 OUT, ADR-0111/0113/0112 + the token-surface family\'s 0 IN / 3 OUT, ADR-0118 cl.6 + the M4 app-surfaces panes wave\'s 0 IN / 2 OUT, ADR-0120 cl.5 + the toolbar wave\'s 1 IN / 0 OUT, ADR-0121 F7 + the timeline-family wave\'s 0 IN / 2 OUT, ADR-0122 F5 + the swiper-family wave\'s 0 IN / 2 OUT, ADR-0124 F5)', () => {
    expect(FEED_SURFACE_TYPES.length).toBe(27)
    expect(FEED_EXCLUDED.length).toBe(27)
  })

  it('IN and OUT are disjoint — no type carries two dispositions', () => {
    for (const t of inSet) expect(outSet.has(t)).toBe(false)
    for (const t of outSet) expect(inSet.has(t)).toBe(false)
  })

  it("IN ∪ OUT equals the default catalog's component set EXACTLY — a TOTAL partition", () => {
    const union = new Set([...inSet, ...outSet])
    expect(union.size).toBe(catalogTypes.size)
    for (const t of union) expect(catalogTypes.has(t)).toBe(true) // no phantom disposition of a non-existent type
    for (const t of catalogTypes) expect(union.has(t)).toBe(true) // every real catalog type has a disposition
  })

  it('every FEED_EXCLUDED entry carries a non-empty recorded reason — never a bare deny-list', () => {
    expect(FEED_EXCLUDED.length).toBeGreaterThan(0)
    for (const entry of FEED_EXCLUDED) {
      expect(typeof entry.reason).toBe('string')
      expect(entry.reason.length).toBeGreaterThan(10)
    }
  })

  it('composite closure holds: a composite parent is IN/OUT together with EVERY child', () => {
    const families: readonly (readonly [string, readonly string[]])[] = [
      ['RadioGroup', ['Radio']],
      ['SegmentedControl', ['Segment']],
      ['Card', ['CardHeader', 'CardContent', 'CardFooter']],
      ['Tabs', ['Tab', 'TabPanel']],
      ['Menu', ['MenuItem']],
      ['Split', ['SplitPane']],
      ['Timeline', ['TimelineItem']],
      ['Swiper', ['SwiperItem']],
    ]
    for (const [parent, children] of families) {
      const parentIn = inSet.has(parent)
      for (const child of children) {
        expect(inSet.has(child), `${parent}=${parentIn ? 'IN' : 'OUT'} but child ${child} disagrees`).toBe(parentIn)
      }
    }
    // Select and ComboBox share Option as their child — both hosts AND the shared child are all IN.
    expect(inSet.has('Select')).toBe(true)
    expect(inSet.has('ComboBox')).toBe(true)
    expect(inSet.has('Option')).toBe(true)
  })

  it('isFeedSurfaceType/FEED_SURFACE_TYPE_SET agree with the array for every IN and every OUT type', () => {
    for (const t of FEED_SURFACE_TYPES) {
      expect(isFeedSurfaceType(t)).toBe(true)
      expect(FEED_SURFACE_TYPE_SET.has(t)).toBe(true)
    }
    for (const entry of FEED_EXCLUDED) expect(isFeedSurfaceType(entry.type)).toBe(false)
  })

  it('NEGATIVE CONTROL: an undispositioned future catalog type is CI-VISIBLE — the union check would FAIL to cover it', () => {
    // Simulate a catalog.json addition nobody has dispositioned yet. The exact union-equality assertion
    // this describe block runs above ("IN ∪ OUT equals the catalog's component set EXACTLY") is what would
    // turn CI red on such an addition — proven here by re-running the SAME comparison against a catalog
    // set that includes one extra, undispositioned type.
    const plantedType = 'FutureWidget'
    expect(catalogTypes.has(plantedType)).toBe(false) // sanity: this is genuinely not a real type today
    const union = new Set([...inSet, ...outSet])
    const syntheticCatalogTypes = new Set([...catalogTypes, plantedType])
    expect(union.size).not.toBe(syntheticCatalogTypes.size) // the real gate's `expect(union.size).toBe(...)` would fail here
    expect([...syntheticCatalogTypes].every((t) => union.has(t))).toBe(false) // "every real catalog type has a disposition" fails
  })
})
