import { describe, it, expect } from 'vitest'
// Read card.css as TEXT (same readFileSync approach as the button/text-field probes).
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
  it('the box-model: the card itself holds NO padding; the region padding rides the shared --ui-box-* tokens (NO --ui-height-*)', () => {
    // Box-model rollout (container-box.css): the card itself has zero padding — each region carries its OWN
    // padding off the shared --ui-box-* tokens (REVISED 2026-07-04: the card-only override is gone; see the
    // next test). The shell is plain block flow now — no grid, no --ui-card-gap row-gap (two tests down).
    expect(cardTokens).toMatch(/--ui-card-padding:\s*0/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-inline:\s*var\(--ui-box-pad-inline,/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-block:\s*var\(--ui-box-pad-block,/)
    expect(css).not.toMatch(/--ui-height-/) // a container has NO control height (geometry.md)
  })

  it('REVISED 2026-07-04: the card-only override is RESCINDED — card reads the SHARED 12px/6px region defaults', () => {
    // Negative control: card.css must NOT declare its own --ui-box-pad-inline/-block anymore (that was the
    // rescinded override) — the derived region tokens read container-box.css's shared values straight, via the
    // SAME fallback-literal pattern (defensive if a [data-box] ancestor never set the channel).
    expect(cardTokens).not.toMatch(/--ui-box-pad-inline:/)
    expect(cardTokens).not.toMatch(/--ui-box-pad-block:/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-inline:\s*var\(--ui-box-pad-inline,\s*0\.75rem\)/)
    expect(cardTokens).toMatch(/--ui-card-region-pad-block:\s*var\(--ui-box-pad-block,\s*0\.375rem\)/)
    // the shared container-box.css defaults are untouched (12px inline / 6px block, since the 2026-07-04 revision)
    const sharedCss = readFileSync(
      `${process.cwd()}/packages/agent-ui/components/src/controls/_surface/container-box.css`,
      'utf8',
    ) as string
    expect(sharedCss).toMatch(/--ui-box-pad-inline:\s*0\.75rem/)
    expect(sharedCss).toMatch(/--ui-box-pad-block:\s*0\.375rem/)
  })

  it('REVISED 2026-07-04: a region is now INSET — the block-flow shell gives every region a uniform 6px margin', () => {
    // A region (header/content/footer) is no longer full-bleed (margin:0); it carries the same 6px inset
    // margin every other [data-box] child gets. ui-card is now plain BLOCK FLOW (flow-root BFC, NOT grid) —
    // so ONE uniform `margin` gives clean 6px gutters (adjacent region margins collapse; the 1px frame border
    // blocks collapse-through at the edges), with no grid gap and no first/last-child split.
    expect(cardTokens).toMatch(/--ui-card-region-margin:\s*var\(--ui-box-inset,\s*0\.375rem\)/)
    expect(css).toMatch(/:scope\s*\{[^}]*display:\s*flow-root/) // block flow, not grid
    expect(cardTokens).not.toMatch(/--ui-card-gap:/) // the grid row-gap is gone
    // one uniform margin on all three region tags — no first/last split, no margin-inline-only
    expect(css).toMatch(/:scope\s*>\s*:where\(ui-card-header,\s*ui-card-content,\s*ui-card-footer\)\s*\{[^}]*margin:\s*var\(--ui-card-region-margin\)/)
    expect(css).not.toMatch(/:where\(ui-card-header,\s*ui-card-content,\s*ui-card-footer\):first-child/)
  })

  it('the adornment column-gap also rides the --ui-space ladder', () => {
    expect(regionTokens).toMatch(/--ui-card-region-gap:\s*var\(--ui-space-/)
  })
})

describe('card.css — presence-driven regions via BLOCK FLOW (no grid rows, no phantom box for an absent region)', () => {
  it('the shell is block flow (flow-root), not a grid with :has() row templates', () => {
    // REVISED 2026-07-04: ui-card no longer uses a grid with :has() row templates. In block flow an absent
    // region simply contributes no box → no space (presence-driven for free), and the region margins collapse
    // to clean 6px gutters. So there are NO grid-template-rows and NO :scope:has() ROW-template rules.
    expect(css).toMatch(/:scope\s*\{[^}]*display:\s*flow-root/)
    expect(css).not.toMatch(/grid-template-rows/)
    expect(css).not.toMatch(/:scope:has\(>\s*ui-card-header\)/) // no presence-driven ROW templates
    expect(css).not.toMatch(/:scope:has\(>\s*ui-card-footer\)/)
  })
})

describe('card.css — header/footer host-as-grid anatomy (anatomy.md leading/label/trailing)', () => {
  it('the presence-driven column structures: [label] · [leading|label] · [label|trailing] · [both]', () => {
    expect(regionTokens).toMatch(/grid-template-columns:\s*1fr/) // [label] slotless default
    expect(css).toMatch(/:has\(>\s*\[slot='leading'\]\):not\(:has\(>\s*\[slot='trailing'\]\)\)\s*\{\s*grid-template-columns:\s*auto 1fr/)
    expect(css).toMatch(/:has\(>\s*\[slot='trailing'\]\):not\(:has\(>\s*\[slot='leading'\]\)\)\s*\{\s*grid-template-columns:\s*1fr auto/)
    expect(css).toMatch(/:has\(>\s*\[slot='leading'\]\):has\(>\s*\[slot='trailing'\]\)\s*\{\s*grid-template-columns:\s*auto 1fr auto/)
  })

  it('REVISED 2026-07-04: a region fill rounds ALL FOUR of its own corners to the DECREMENTED inner radius', () => {
    // A region is now inset (container-box.css's model, adopted here), not full-bleed — it no longer meets the
    // card's outer edge, so rounding it to the outer --ui-card-radius would look oversized/mismatched. It now
    // reads the SAME concentric --ui-card-inner-radius a nested card would (uniformly, not per-side).
    expect(regionTokens).toMatch(/border-radius:\s*var\(--ui-card-inner-radius\)/)
    // negative control: the old per-side outer-radius corner rules are gone
    expect(css).not.toMatch(/border-start-start-radius/)
    expect(css).not.toMatch(/border-end-start-radius/)
  })
})
