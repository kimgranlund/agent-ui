// dogfood-inventory.test.ts — genui-surface.spec.md SPEC-R13(b): the DERIVED fleet inventory
// (`dogfood-inventory.ts`, LLD-C3 leaf 8) — deterministic, budget-capped, and NEVER byte-captured (a
// fleet edit changes the output on its very next call, with no baseline to re-capture). Lives under
// `src/live-agent/` — the `mini-skills.test.ts`/`genui-packs.test.ts` precedent (the vitest `packages`
// project only globs `src/**/*.test.ts`, and the agent modules' own tests live in this sibling dir).

import { describe, it, expect } from 'vitest'
import { dogfoodInventory, dogfoodInventoryTags, DOGFOOD_INVENTORY_CHAR_BUDGET } from '../agent/dogfood-inventory.ts'

describe('dogfoodInventory — deterministic, descriptor-derived (SPEC-R13(b))', () => {
  it('is deterministic — two calls (a real filesystem re-scan each time) produce byte-identical output', () => {
    expect(dogfoodInventory()).toBe(dogfoodInventory())
  })

  it('discovers a real, non-trivial slice of the fleet — every row names a `ui-` tag and an attrs clause', () => {
    const inv = dogfoodInventory()
    const lines = inv.split('\n')
    expect(lines.length).toBeGreaterThan(20) // the fleet's controls/ barrel is 50+ descriptors deep
    for (const line of lines) {
      expect(line).toMatch(/^- ui-[a-z0-9-]+ — .+ \(attrs: .+\)$/)
    }
  })

  it('is tag-sorted, and every discovered tag is unique', () => {
    const tags = dogfoodInventoryTags()
    expect(tags).toEqual([...tags].sort())
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('carries real, shipped controls by name (a spot check, not an exhaustive listing)', () => {
    const inv = dogfoodInventory()
    expect(inv).toContain('- ui-button — ')
    expect(inv).toContain('- ui-card — ')
    expect(inv).toContain('- ui-text-field — ')
  })

  it('renders a control-declared enum attribute with its members, and a boolean/plain attribute by kind', () => {
    const inv = dogfoodInventory()
    const buttonLine = inv.split('\n').find((l) => l.startsWith('- ui-button — '))
    expect(buttonLine).toBeDefined()
    expect(buttonLine).toContain('variant: enum(solid|soft|ghost)')
    expect(buttonLine).toContain('disabled: boolean')
  })

  it('stays within the SPEC-R13(b) budget (≤ 16 000 chars) — evidence-revisable per SPEC §8, never silently exceeded', () => {
    expect(dogfoodInventory().length).toBeLessThanOrEqual(DOGFOOD_INVENTORY_CHAR_BUDGET)
  })

  it('`tags` restricts the rendered rows to exactly that set (the LLD-C5 set-equality probe shape)', () => {
    const allTags = dogfoodInventoryTags()
    const subset = [allTags[0]!, allTags[allTags.length - 1]!]
    const filtered = dogfoodInventory(subset)
    const renderedTags = filtered
      .split('\n')
      .map((line) => /^- (ui-[a-z0-9-]+) —/.exec(line)?.[1])
      .filter((t): t is string => t !== undefined)
    expect(renderedTags.sort()).toEqual([...subset].sort())
  })

  // The drift-gate design's own negative control (LLD-C3 leaf 8 acceptance): a tag that the FLEET never
  // declares must never appear when asking for the unfiltered (real composition-call) inventory — proving
  // the function derives from the real descriptor set rather than tolerating/echoing an arbitrary filter.
  // (No file is planted on disk here — `discoverDogfoodControls` walks the real committed tree, so the
  // phantom tag below can only ever surface if this function stopped deriving and started trusting input.)
  it('NEGATIVE CONTROL — a phantom tag the fleet never declares never appears in the unfiltered inventory', () => {
    const inv = dogfoodInventory()
    expect(inv).not.toContain('ui-planted-phantom-control')
    expect(dogfoodInventoryTags()).not.toContain('ui-planted-phantom-control')
  })

  // The other half of the same negative control: asking for a phantom tag explicitly yields NOTHING for
  // it (the filter can only ever narrow a real discovered set — it can never fabricate a row for a tag
  // that has no descriptor on disk).
  it('NEGATIVE CONTROL — filtering to a phantom tag yields an empty inventory, never a fabricated row', () => {
    expect(dogfoodInventory(['ui-planted-phantom-control'])).toBe('')
  })
})
