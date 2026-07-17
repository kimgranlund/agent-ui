import { describe, it, expect } from 'vitest'
// Raw-text fs read — same reverse-coupling fs-read pattern as the other
// css-structure probes (button-descriptor.test.ts et al.); vitest/node resolves it at runtime.
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
  it('opt-in [data-box] establishes a BFC + declares the 0.375rem inset token', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*\{[^}]*display:\s*flow-root/)
    expect(CODE).toMatch(/--ui-box-inset:\s*0\.375rem/)
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

  it('full-bleed children (hr/[data-full-bleed] ONLY) override the inset to margin:0', () => {
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(hr,\s*\[data-full-bleed\]\)\s*\{[^}]*margin:\s*0/)
  })

  it('REVISED 2026-07-04: header/footer/main/[data-region] are NO LONGER in the full-bleed override list', () => {
    // Negative control — the region wrappers used to override to margin:0; now they keep the generic inset
    // margin (the next test) instead, so this selector must NOT mention them.
    const fullBleed = CODE.match(/:where\(\[data-box\]\)\s*>\s*:where\(([^)]*)\)\s*\{[^}]*margin:\s*0/)
    expect(fullBleed).toBeTruthy()
    for (const tag of ['header', 'footer', 'main', '[data-region]']) {
      expect(fullBleed![1], `${tag} still full-bleed — regions should now be inset`).not.toMatch(new RegExp(tag.replace(/[[\]]/g, '\\$&')))
    }
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
    // REVISED 2026-07-04: the inset offset is --ui-box-inset (6px), NOT 0 — a cross-engine finding that a
    // stuck sticky box does not honor its own margin as extra offset (container-box.browser.test.ts), so the
    // offset itself must carry the 6px gutter to avoid a flush-snap once the region actually sticks.
    expect(header![1]).toMatch(/inset-block-start:\s*var\(--ui-box-inset\)/)
    expect(header![1]).toMatch(/background:\s*inherit/)
    expect(CODE).toMatch(/:where\(\[data-box\]\)\s*>\s*:where\(footer,\s*\[data-region='footer'\]\)\s*\{[^}]*inset-block-end:\s*var\(--ui-box-inset\)/)
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

describe('container-box.css — region padding system (header/footer/content: inline 12 · block 6 · gap 8)', () => {
  it('declares the region padding tokens: inline 0.75rem (12px), block 0.375rem (6px), gap 0.5rem (8px)', () => {
    expect(CODE).toMatch(/--ui-box-pad-inline:\s*0\.75rem/)
    expect(CODE).toMatch(/--ui-box-pad-block:\s*0\.375rem/)
    expect(CODE).toMatch(/--ui-box-gap:\s*0\.5rem/)
  })

  it('header/footer regions carry inline+block padding + the region gap', () => {
    const m = CODE.match(/:where\(\[data-box\]\)\s*>\s*:where\(header,\s*footer,\s*\[data-region='header'\],\s*\[data-region='footer'\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/padding-inline:\s*var\(--ui-box-pad-inline\)/)
    expect(m![1]).toMatch(/padding-block:\s*var\(--ui-box-pad-block\)/)
    expect(m![1]).toMatch(/gap:\s*var\(--ui-box-gap\)/)
  })

  it('content L1 = pad-inline (12px), and nested content STEPS IN one inset per level (L2 = 12−6, L3 = 6 floor)', () => {
    // L1
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*var\(--ui-box-pad-inline\)/)
    // L2 = one inset in (concentric with the parent ink) — expressed as an explicit descendant level, NOT a
    // self-referencing custom property (a CSS cycle → invalid). This is the load-bearing correctness point.
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*calc\(var\(--ui-box-pad-inline\)\s*-\s*var\(--ui-box-inset\)\)/)
    // L3+ floor
    expect(CODE).toMatch(/:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*:where\(\[data-region='content'\],\s*main\)\s*\{[^}]*padding-inline:\s*var\(--ui-box-pad-block\)/)
  })

  it('REVISED 2026-07-04: the region wrappers (header/footer/content/main + [data-region]) are now INSET, not full-bleed', () => {
    // Their padding still insets their OWN ink (the test above); their MARGIN now comes from the generic
    // `[data-box] > *` rule (6px) instead of an override to 0 — the combined structural + rendered proof that
    // regions float inside the frame is container-box.browser.test.ts.
    expect(CODE).not.toMatch(/:where\(\[data-box\]\)\s*>\s*:where\([^)]*header[^)]*\)\s*\{[^}]*margin:\s*0/)
  })
})

describe('container-box.css — edge-aware scroll fade (the gutter-exposure fix, data-fade-top/bottom)', () => {
  it('declares --ui-box-fade off the density-linked --md-sys-space-lg (a self-contained literal fallback too)', () => {
    expect(CODE).toMatch(/--ui-box-fade:\s*var\(--md-sys-space-lg,\s*1rem\)/)
  })

  it('BOTH flags present → the offset-aware symmetric mask (ramps PAST a present bracket; the original recipe at 0px)', () => {
    const m = CODE.match(/:where\(\[data-fade-top\]\[data-fade-bottom\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/-webkit-mask-image:\s*linear-gradient\(/) // WebKit still needs the prefix
    expect(m![1]).toMatch(/\n\s*mask-image:\s*linear-gradient\(/)
    expect(m![1]).toMatch(/transparent 0,/) // top: transparent at the true viewport edge
    // the ramp's OPAQUE end lands past the header band (--ui-box-head); the 0px fallback collapses to --ui-box-fade
    expect(m![1]).toMatch(/#000 calc\(var\(--ui-box-head,\s*0px\)\s*\+\s*var\(--ui-box-fade,\s*1rem\)\)/)
    expect(m![1]).toMatch(/#000 calc\(100% - var\(--ui-box-foot,\s*0px\)\s*-\s*var\(--ui-box-fade,\s*1rem\)\)/)
    expect(m![1]).toMatch(/transparent 100%/) // bottom: transparent at the true viewport edge
  })

  it('top ONLY (no more below) → fade ramps past a present header; the bottom stays fully opaque (#000 100%)', () => {
    const m = CODE.match(/:where\(\[data-fade-top\]\):not\(\[data-fade-bottom\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/transparent 0,/) // the top fades
    expect(m![1]).toMatch(/#000 calc\(var\(--ui-box-head,\s*0px\)\s*\+\s*var\(--ui-box-fade,\s*1rem\)\)/) // ramps past the header band
    expect(m![1]).toMatch(/#000 100%/) // the bottom does not
    expect(m![1]).not.toMatch(/transparent 100%/)
  })

  it('bottom ONLY (nothing hidden above) → the top stays fully opaque (#000 0); fade ramps past a present footer', () => {
    const m = CODE.match(/:where\(\[data-fade-bottom\]\):not\(\[data-fade-top\]\)\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/#000 0,/) // the top does not fade
    expect(m![1]).toMatch(/#000 calc\(100% - var\(--ui-box-foot,\s*0px\)\s*-\s*var\(--ui-box-fade,\s*1rem\)\)/) // ramps past the footer band
    expect(m![1]).toMatch(/transparent 100%/) // the bottom does
    expect(m![1]).not.toMatch(/transparent 0,/)
  })

  it('forced-colors drops the mask on either flag (a mask over system text harms legibility)', () => {
    const fc = CODE.slice(CODE.lastIndexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/:where\(\[data-fade-top\],\s*\[data-fade-bottom\]\)\s*\{[^}]*mask-image:\s*none/)
  })

  it('anti-vacuous: with NEITHER flag, no rule in this file matches at all (never faded by default)', () => {
    // A crude but sufficient proxy for "no selector requiring [data-fade-top] or [data-fade-bottom] can ever
    // match an element carrying neither" — every fade rule's selector mentions one of the two attributes.
    const fadeRules = [...CODE.matchAll(/:where\(\[data-fade-[a-z-]+\][^{]*\)\s*\{[^}]*\}/g)]
    expect(fadeRules.length).toBeGreaterThan(0) // anti-vacuous: the rules DO exist
    for (const rule of fadeRules) expect(rule[0]).toMatch(/\[data-fade-(top|bottom)\]/)
  })
})
