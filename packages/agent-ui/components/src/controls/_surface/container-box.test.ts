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

  it('full-bleed children (header/footer/hr/[data-full-bleed]) override the inset to margin:0', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*footer,\s*hr,\s*\[data-full-bleed\]\)\s*\{[^}]*margin:\s*0/)
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
    expect(hr![1]).toMatch(/border-block-start:\s*1px solid var\(--c-neutral-outline-variant\)/)
  })

  it('forced-colors keeps sticky regions opaque (Canvas) so scrolled content cannot show through', () => {
    expect(CODE).toMatch(/@media\s*\(forced-colors:\s*active\)/)
    const fc = CODE.slice(CODE.indexOf('forced-colors'))
    expect(fc).toMatch(/background:\s*Canvas/)
  })
})
