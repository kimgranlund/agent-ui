import { describe, it, expect } from 'vitest'
// Read card.css as TEXT (no @types/node devDep — same readFileSync approach as the button/text-field probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s7 — card.css STATIC geometry probes (ADR-0018 one-level nested radius · ADR-0015 --ui-space padding ·
// anatomy.md host-as-grid). jsdom can't resolve @scope / :has() / computed px — these pin the DECLARED
// formulas + structure; the RENDERED decrement (measured px) is card.browser.test.ts. The load-bearing law:
// the concentric-corner chain `r_child = max(0, r_parent − pad_parent)`, realized CYCLE-FREE (a card publishes
// its inner radius to its DESCENDANTS, never reads back its own published value — ADR-0018's recorded cycle).

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/card/card.css`, 'utf8') as string

/** A flat `:where(...) {` declaration block — from the marker to its first closing brace. */
const whereBlock = (marker: string): string => {
  const start = css.indexOf(marker)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

const cardTokens = whereBlock(':where(ui-card) {')
const publishBlock = whereBlock(':where(ui-card) > * {')
const regionTokens = whereBlock(':where(ui-card-header, ui-card-footer) {')

describe('card.css — the concentric-corner radius chain (ADR-0018, cycle-free)', () => {
  it('the root radius reads the inherited child-radius channel, else the shared --ui-radius-base', () => {
    // cl.1 root fallback + cl.2 nested read, in ONE token: a nested card inherits --ui-card-child-radius from
    // its parent; a root card (channel unset) falls to --ui-radius-base.
    expect(cardTokens).toMatch(
      /--ui-card-radius:\s*var\(--ui-card-child-radius,\s*var\(--ui-radius-base\)\)/,
    )
  })

  it('the inner radius IS the concentric-corner law max(0, radius − content inline padding) [box-model]', () => {
    // Under the box-model the card holds NO padding; the inset that a nested card sits inside is the CONTENT
    // region's inline padding, so the concentric chain re-bases off --ui-card-region-pad-inline.
    expect(cardTokens).toMatch(
      /--ui-card-inner-radius:\s*max\(\s*0px\s*,\s*calc\(\s*var\(--ui-card-radius\)\s*-\s*var\(--ui-card-region-pad-inline\)\s*\)\s*\)/,
    )
  })

  it('publishes the DECREMENTED inner radius to descendants (NOT the radius unchanged) — the negative control', () => {
    // The cycle-free publish: a card hands its children --ui-card-child-radius = its INNER radius (decremented),
    // set on `> *` (the children), never on the card itself. A broken impl that published the radius UNCHANGED
    // (no decrement → same-radius nesting) would fail BOTH assertions here.
    expect(publishBlock).toMatch(/--ui-card-child-radius:\s*var\(--ui-card-inner-radius\)/)
    expect(publishBlock).not.toMatch(/--ui-card-child-radius:\s*var\(--ui-card-radius\)\s*;/) // would be the no-decrement bug
  })

  it('the publish is on the DESCENDANTS (`> *`), never on the card itself (no self-referential cycle)', () => {
    // ADR-0018: a card both reading AND declaring --ui-card-child-radius is a CSS cycle. The card's own
    // :where(ui-card) token block must NOT declare --ui-card-child-radius; only the `> *` child rule does.
    expect(cardTokens).not.toMatch(/--ui-card-child-radius:/)
    expect(css).toMatch(/:where\(ui-card\)\s*>\s*\*\s*\{/) // the descendant publish rule exists
  })
})

describe('card.css — padding/gap off the --ui-space ladder (Container/layout class, no control height)', () => {
  it('the box-model: the card holds NO padding/gap; the region padding rides the --ui-box-* tokens (NO --ui-height-*)', () => {
    // Box-model rollout (container-box.css): the card itself has zero padding + zero grid gap — each region is
    // full-bleed and carries its OWN region padding off the shared --ui-box-* tokens (inline 12 · block 4).
    expect(cardTokens).toMatch(/--ui-card-padding:\s*0/)
    expect(cardTokens).toMatch(/--ui-card-gap:\s*0/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-inline:\s*var\(--ui-box-pad-inline,/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-block:\s*var\(--ui-box-pad-block,/)
    expect(css).not.toMatch(/--ui-height-/) // a container has NO control height (geometry.md)
  })

  it('the adornment column-gap also rides the --ui-space ladder', () => {
    expect(regionTokens).toMatch(/--ui-card-region-gap:\s*var\(--ui-space-/)
  })
})

describe('card.css — presence-driven region ROWS (no phantom row for an absent region)', () => {
  it('the four :has() row structures: content-only · +header · +footer · +both', () => {
    expect(css).toMatch(/:scope\s*\{[^}]*grid-template-rows:\s*1fr/) // content-only default
    expect(css).toMatch(/:scope:has\(>\s*ui-card-header\):not\(:has\(>\s*ui-card-footer\)\)\s*\{\s*grid-template-rows:\s*auto 1fr/)
    expect(css).toMatch(/:scope:has\(>\s*ui-card-footer\):not\(:has\(>\s*ui-card-header\)\)\s*\{\s*grid-template-rows:\s*1fr auto/)
    expect(css).toMatch(/:scope:has\(>\s*ui-card-header\):has\(>\s*ui-card-footer\)\s*\{\s*grid-template-rows:\s*auto 1fr auto/)
  })

  it('the content row is the 1fr slack (the body grows, the header/footer take auto rows)', () => {
    // every present-region template carries exactly one `1fr` row — the content slack.
    for (const tmpl of ['1fr', 'auto 1fr', '1fr auto', 'auto 1fr auto']) {
      expect(css.includes(`grid-template-rows: ${tmpl}`), `missing row template: ${tmpl}`).toBe(true)
    }
  })
})

describe('card.css — header/footer host-as-grid anatomy (anatomy.md leading/label/trailing)', () => {
  it('the presence-driven column structures: [label] · [leading|label] · [label|trailing] · [both]', () => {
    expect(regionTokens).toMatch(/grid-template-columns:\s*1fr/) // [label] slotless default
    expect(css).toMatch(/:has\(>\s*\[slot='leading'\]\):not\(:has\(>\s*\[slot='trailing'\]\)\)\s*\{\s*grid-template-columns:\s*auto 1fr/)
    expect(css).toMatch(/:has\(>\s*\[slot='trailing'\]\):not\(:has\(>\s*\[slot='leading'\]\)\)\s*\{\s*grid-template-columns:\s*1fr auto/)
    expect(css).toMatch(/:has\(>\s*\[slot='leading'\]\):has\(>\s*\[slot='trailing'\]\)\s*\{\s*grid-template-columns:\s*auto 1fr auto/)
  })

  it('a full-bleed region fill clips its CARD-EDGE corners to the OUTER radius (header top · footer bottom)', () => {
    // Box-model: regions are full-bleed (no card padding), so a painted header/footer meets the card's rounded
    // border and rounds its card-edge corners to the OUTER --ui-card-radius (not the inner/decremented radius).
    expect(css).toMatch(/:where\(ui-card-header\)\s*\{[^}]*border-start-start-radius:\s*var\(--ui-card-radius\)/)
    expect(css).toMatch(/:where\(ui-card-footer\)\s*\{[^}]*border-end-start-radius:\s*var\(--ui-card-radius\)/)
  })
})
