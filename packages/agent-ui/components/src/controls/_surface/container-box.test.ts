import { describe, it, expect } from 'vitest'
// node:fs is untyped here (no @types/node devDep) — same reverse-coupling fs-read pattern as the other
// css-structure probes (button-descriptor.test.ts et al.); vitest/node resolves it at runtime.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// container-box.test.ts — the shared container BOX-MODEL foundation (margin inset + sticky-region pattern).
// A static structure scan (jsdom does not resolve @import'd sheets or compute position:sticky), asserting the
// mechanism the panels adopt via [data-box] is present + shaped as ruled: BFC + child inset margins +
// full-bleed override + [padded] + sticky header/footer with bg:inherit + hr divider. Companion to the
// per-control css tests that assert each panel opts in (data-box + option inset margin).

const read = (p: string): string => readFileSync(`${process.cwd()}/${p}`, 'utf8') as string
const CSS = read('packages/agent-ui/components/src/controls/_surface/container-box.css')
// strip comments so a rule name in prose isn't mistaken for a live declaration
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('container-box.css — the shared box-model foundation', () => {
  it('opt-in [data-box] establishes a BFC + declares the 0.25rem inset token', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*\{[^}]*display:\s*flow-root/)
    expect(CODE).toMatch(/--ui-box-inset:\s*0\.25rem/)
  })

  it('every direct child gets the inset margin; the token drives it', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*\*\s*\{[^}]*margin:\s*var\(--ui-box-inset\)/)
  })

  it('[data-box] is its own Z-DEPTH SCOPE — isolation: isolate on the SAME opt-in rule (ADR-0052)', () => {
    // The one purpose-built stacking-context property (no containing block, no paint side effects): every
    // descendant z-index — incl. the sticky brackets' z-index:1 below — resolves INSIDE the box, so no
    // container's chrome can fight a sibling container or the page (no global z ladder can exist). The
    // rendered sibling-overlap proof is container-box.browser.test.ts; this pins the declaration.
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*\{[^}]*isolation:\s*isolate/)
    // The sticky brackets stay SMALL and LOCAL (z-index: 1) — meaningful only inside the scope. A large
    // value appearing here would signal someone re-fighting a global war the isolation was built to end.
    expect(CODE).not.toMatch(/z-index:\s*(?:[2-9]\d|\d{3,})/)
  })

  it('full-bleed children (the region wrappers + hr/[data-full-bleed]) override the inset to margin:0', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*footer,\s*main,\s*hr,\s*\[data-full-bleed\],\s*\[data-region\]\)\s*\{[^}]*margin:\s*0/)
  })

  it('[padded] = full-bleed box with inset padding (margin:0 + padding:inset)', () => {
    const m = CODE.match(/:where\(\[data-box\]\)\s*>\s*:where\(\[padded\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/margin:\s*0/)
    expect(m![1]).toMatch(/padding:\s*var\(--ui-box-inset\)/)
  })

  it('sticky regions: header pins to the block-start, footer to the block-end, both inherit the surface', () => {
    const header = CODE.match(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*\[data-region='header'\]\)\s*\{([^}]*)\}/)
    expect(header).toBeTruthy()
    expect(header![1]).toMatch(/position:\s*sticky/)
    expect(header![1]).toMatch(/inset-block-start:\s*0/)
    expect(header![1]).toMatch(/background:\s*inherit/)
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(footer,\s*\[data-region='footer'\]\)\s*\{[^}]*inset-block-end:\s*0/)
  })

  it('hr is a full-bleed hairline divider off a role token', () => {
    const hr = CODE.match(/:where\(\[data-box\]\)\s*>\s*hr\s*\{([^}]*)\}/)
    expect(hr).toBeTruthy()
    expect(hr![1]).toMatch(/border-block-start:\s*1px solid var\(--md-sys-color-neutral-outline-variant\)/)
  })

  it('forced-colors keeps sticky regions opaque (Canvas) so scrolled content cannot show through', () => {
    expect(CODE).toMatch(/@media\s*\(forced-colors:\s*active\)/)
    const fc = CODE.slice(CODE.indexOf('forced-colors'))
    expect(fc).toMatch(/background:\s*Canvas/)
  })
})

describe('container-box.css — region padding system (header/footer/content: inline 12 · block 4 · gap 8)', () => {
  it('declares the region padding tokens: inline 0.75rem (12px), block 0.25rem (4px), gap 0.5rem (8px)', () => {
    expect(CODE).toMatch(/--ui-box-pad-inline:\s*0\.75rem/)
    expect(CODE).toMatch(/--ui-box-pad-block:\s*0\.25rem/)
    expect(CODE).toMatch(/--ui-box-gap:\s*0\.5rem/)
  })

  it('header/footer regions carry inline+block padding + the region gap', () => {
    const m = CODE.match(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*footer,\s*\[data-region='header'\],\s*\[data-region='footer'\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/padding-inline:\s*var\(--ui-box-pad-inline\)/)
    expect(m![1]).toMatch(/padding-block:\s*var\(--ui-box-pad-block\)/)
    expect(m![1]).toMatch(/gap:\s*var\(--ui-box-gap\)/)
  })

  it('content L1 = pad-inline (12px), and nested content STEPS IN one inset per level (L2 = 12−4, L3 = 4 floor)', () => {
    // L1
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*var\(--ui-box-pad-inline\)/)
    // L2 = one inset in (concentric with the parent ink) — expressed as an explicit descendant level, NOT a
    // self-referencing custom property (a CSS cycle → invalid). This is the load-bearing correctness point.
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*calc\(var\(--ui-box-pad-inline\)\s*-\s*var\(--ui-box-inset\)\)/)
    // L3+ floor
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*var\(--ui-box-pad-block\)/)
  })

  it('the region wrappers (header/footer/content/main + [data-region]) are full-bleed (their padding insets the ink)', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*footer,\s*main,\s*hr,\s*\[data-full-bleed\],\s*\[data-region\]\)\s*\{[^}]*margin:\s*0/)
  })
})
