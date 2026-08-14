import { describe, it, expect } from 'vitest'
// Read drawer.css as TEXT (the modal-css.test.ts precedent).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0188 s1 — drawer.css static structural check (ADR-0003 sectioning + token hygiene; the modal.css
// precedent for the native-dialog surface + ::backdrop scrim + the surface seam). jsdom can't compute the
// rendered colours/px/insets nor the top-layer paint — these pin the STRUCTURE + the CSS text; the rendered
// docked geometry + motion is drawer.browser.test.ts's built-output cross-engine smoke.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/drawer/drawer.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-drawer) {'), css.indexOf('@scope (ui-drawer) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-drawer) {'))

// A container reads the role-pure `--ui-container-*` surface SEAM plus its OWN `--ui-drawer-*` chain. Nothing
// else may appear in @scope (no raw `--md-sys-color-*` role, no `--md-sys-space-*`/`--md-sys-shape-corner-base`
// outside the token block) EXCEPT the two fleet-wide motion constants (--md-sys-motion-duration-fast /
// -easing-standard) — the sanctioned direct-read list (component-standards' own routing table).
const surfaceSeam = new Set(['--ui-container-bg', '--ui-container-tint'])
const motionConstants = new Set(['--md-sys-motion-duration-fast', '--md-sys-motion-easing-standard'])

/** @scope token-hygiene predicate — every var() ref that is NEITHER the own --ui-drawer-* chain, the surface
 *  seam, NOR a sanctioned motion constant. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !surfaceSeam.has(v) && !motionConstants.has(v) && !/^--ui-drawer-/.test(v))

describe('drawer.css — structure + sectioning', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-drawer\)/)
  })

  it('the :where() block sets the drawer’s OWN default surface + DECLARES the --ui-drawer-* chain from roles/dimensions', () => {
    // ui-drawer is an OPAQUE plane — it repoints the container base default (transparent) to a surface role.
    expect(tokenBlock).toMatch(/--ui-container-bg:\s*var\(--md-sys-color-neutral-surface\)/)
    for (const slot of ['ink', 'outline', 'radius', 'padding', 'scrim', 'inline-size', 'max-block-size']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-drawer-${slot}:`))
    }
    expect(tokenBlock).toMatch(/--ui-drawer-scrim:\s*var\(--md-sys-color-dialog-backdrop\)/) // the modal TKT-0019 wash, reused
    expect(tokenBlock).toMatch(/--ui-drawer-radius:\s*var\(--md-sys-shape-corner-base\)/) // the shared fleet radius
    expect(tokenBlock).toMatch(/--ui-drawer-padding:\s*var\(--md-sys-space-/) // the density-responsive layout spacing
  })

  it('GH #918 — declares the drawer’s OWN region spacing rhythm + the region hairline colour', () => {
    for (const slot of ['pad-inline', 'pad-block', 'gap', 'region-border']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-drawer-${slot}:`))
    }
    expect(tokenBlock).toMatch(/--ui-drawer-pad-inline:\s*var\(--md-sys-space-/)
    expect(tokenBlock).toMatch(/--ui-drawer-pad-block:\s*var\(--md-sys-space-/)
    expect(tokenBlock).toMatch(/--ui-drawer-gap:\s*var\(--md-sys-space-/)
    // the hairline colour reuses the SAME frame role already declared for the dialog's own outline — no new role
    expect(tokenBlock).toMatch(/--ui-drawer-region-border:\s*var\(--ui-drawer-outline\)/)
  })

  it('NO control height — the drawer shell never reads --md-sys-height-* (geometry.md container class)', () => {
    expect(css).not.toMatch(/var\(--md-sys-height-/)
    expect(css).not.toContain('color-mix(') // a mix ratio is a component colour opinion (ADR-0008)
  })

  it('mints ZERO new --md-sys-* roles — every declared token consumes an EXISTING role (ADR-0188 cl.5)', () => {
    // every --md-sys-* the token block READS must already be a role/dimension name, never something this
    // file invents; a crude but effective anti-vacuous check: the file declares --ui-drawer-* on the LEFT of
    // `:`, and every --md-sys-* it references is inside a var(...) on the RIGHT — never declared itself.
    const declaresSystemRole = /^\s*--md-sys-[\w-]+:/m.test(css)
    expect(declaresSystemRole, 'drawer.css declares (mints) a --md-sys-* custom property — it must only CONSUME one').toBe(false)
  })
})

describe('drawer.css — the @scope dialog surface + ::backdrop', () => {
  it('the host is display:contents (a logical wrapper — only the dialog PART renders)', () => {
    expect(stylesBlock).toMatch(/:scope\s*\{\s*display:\s*contents/)
  })

  it('the dialog part paints the surface from the role-pure --ui-container-* seam (base plane + tonal wash)', () => {
    const m = stylesBlock.match(/:scope > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(m, 'the dialog part rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/background-color:\s*var\(--ui-container-bg\)/)
    expect(rule).toMatch(/background-image:\s*linear-gradient\(var\(--ui-container-tint\),\s*var\(--ui-container-tint\)\)/)
    expect(rule).toMatch(/color:\s*var\(--ui-drawer-ink\)/)
    expect(rule).toMatch(/padding:\s*0/)
    expect(rule).toMatch(/margin:\s*0/) // overrides the UA showModal() centring margin — a drawer docks, never centres
  })

  it('the ::backdrop reads the scrim from the own chain (the blocking layer)', () => {
    expect(stylesBlock).toMatch(/\[data-part='dialog'\]::backdrop\s*\{\s*background-color:\s*var\(--ui-drawer-scrim\)/)
  })

  it('every edge gets an OPEN resting rule + a matching @starting-style (entry motion, all three edges)', () => {
    for (const [edgeSel, insetProp] of [
      [`:scope:is\\(\\[edge='end'\\], :not\\(\\[edge\\]\\)\\) > \\[data-part='dialog'\\]\\[open\\]`, 'inset-inline-end'],
      [`:scope\\[edge='start'\\] > \\[data-part='dialog'\\]\\[open\\]`, 'inset-inline-start'],
      [`:scope\\[edge='bottom'\\] > \\[data-part='dialog'\\]\\[open\\]`, 'inset-block-end'],
    ] as const) {
      const restRe = new RegExp(`${edgeSel}\\s*\\{\\s*${insetProp}:\\s*0`)
      expect(stylesBlock, `missing OPEN resting rule for ${insetProp}`).toMatch(restRe)
    }
    // @starting-style block exists at least once per edge (three edges → at least 3 occurrences)
    const startingBlocks = stylesBlock.match(/@starting-style/g) ?? []
    expect(startingBlocks.length).toBeGreaterThanOrEqual(3)
  })

  it('the docked edge zeros its radius; the exposed edge keeps the fleet base (all three edges)', () => {
    // edge='end' docks the inline-end corners — zeroed; inline-start corners keep the base
    const endRule = stylesBlock.match(/:scope:is\(\[edge='end'\], :not\(\[edge\]\)\) > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(endRule).not.toBeNull()
    expect((endRule as RegExpMatchArray)[1]).toMatch(/border-start-end-radius:\s*0/)
    expect((endRule as RegExpMatchArray)[1]).toMatch(/border-end-end-radius:\s*0/)
    expect((endRule as RegExpMatchArray)[1]).toMatch(/border-start-start-radius:\s*var\(--ui-drawer-radius\)/)

    // edge='start' docks the inline-start corners — zeroed; inline-end corners keep the base
    const startRule = stylesBlock.match(/:scope\[edge='start'\] > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(startRule).not.toBeNull()
    expect((startRule as RegExpMatchArray)[1]).toMatch(/border-start-start-radius:\s*0/)
    expect((startRule as RegExpMatchArray)[1]).toMatch(/border-start-end-radius:\s*var\(--ui-drawer-radius\)/)

    // edge='bottom' docks the block-end (bottom) corners — zeroed; the top corners keep the base
    const bottomRule = stylesBlock.match(/:scope\[edge='bottom'\] > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(bottomRule).not.toBeNull()
    expect((bottomRule as RegExpMatchArray)[1]).toMatch(/border-end-start-radius:\s*0/)
    expect((bottomRule as RegExpMatchArray)[1]).toMatch(/border-end-end-radius:\s*0/)
    expect((bottomRule as RegExpMatchArray)[1]).toMatch(/border-start-start-radius:\s*var\(--ui-drawer-radius\)/)
  })

  it('the bottom edge sizes from max-block-size, the inline edges size from inline-size + full block-size', () => {
    const endRule = stylesBlock.match(/:scope:is\(\[edge='end'\], :not\(\[edge\]\)\) > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect((endRule as RegExpMatchArray)[1]).toMatch(/inline-size:\s*var\(--ui-drawer-inline-size\)/)
    expect((endRule as RegExpMatchArray)[1]).toMatch(/block-size:\s*100svh/)

    const bottomRule = stylesBlock.match(/:scope\[edge='bottom'\] > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect((bottomRule as RegExpMatchArray)[1]).toMatch(/max-block-size:\s*var\(--ui-drawer-max-block-size\)/)
  })

  it('the inline edges reset max-block-size to none (the UA `dialog:modal` default max-height would otherwise silently clamp the authored 100svh below full viewport — measured live in drawer.browser.test.ts)', () => {
    const endRule = stylesBlock.match(/:scope:is\(\[edge='end'\], :not\(\[edge\]\)\) > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect((endRule as RegExpMatchArray)[1]).toMatch(/max-block-size:\s*none/)
    const startRule = stylesBlock.match(/:scope\[edge='start'\] > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect((startRule as RegExpMatchArray)[1]).toMatch(/max-block-size:\s*none/)
  })

  it('a `prefers-reduced-motion: reduce` block suppresses the transition entirely', () => {
    expect(stylesBlock).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    const rm = stylesBlock.slice(stylesBlock.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(rm).toMatch(/transition:\s*none/)
  })

  it('positioning rides LOGICAL inset-inline-* only — NEVER a transform-based slide (the bidi-correctness law)', () => {
    // Strip comments FIRST (preserving newlines) — a banner comment merely NAMING the forbidden mechanism in
    // prose would otherwise false-positive this check (component-testing's own named trap: TKT-0066 item 5's
    // 44-file false census, the exact same class of bug).
    const stripped = stylesBlock.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    expect(stripped).not.toMatch(/transform\s*:/)
    expect(stripped).not.toMatch(/:dir\(/) // the super-shell precedent — logical properties need no :dir() at all
  })
})

describe('drawer.css — GH #918: the content layout system (region rhythm + scroll-conditional hairline)', () => {
  it('the dialog part repoints the shared [data-box] region defaults to the drawer’s OWN --ui-drawer-* rhythm', () => {
    const m = stylesBlock.match(/:scope > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(m, 'the dialog part rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/--ui-box-pad-inline:\s*var\(--ui-drawer-pad-inline\)/)
    expect(rule).toMatch(/--ui-box-pad-block:\s*var\(--ui-drawer-pad-block\)/)
    expect(rule).toMatch(/--ui-box-gap:\s*var\(--ui-drawer-gap\)/)
  })

  it('a header/footer hairline is SCROLL-CONDITIONAL — gated on the dialog’s own data-fade-top/-bottom flags, never a static rule', () => {
    expect(stylesBlock).toMatch(
      /:scope > \[data-part='dialog'\]\[data-fade-top\] > :is\(header, \[data-region='header'\]\)\s*\{\s*border-block-end:\s*1px solid var\(--ui-drawer-region-border\)/,
    )
    expect(stylesBlock).toMatch(
      /:scope > \[data-part='dialog'\]\[data-fade-bottom\] > :is\(footer, \[data-region='footer'\]\)\s*\{\s*border-block-start:\s*1px solid var\(--ui-drawer-region-border\)/,
    )
    // NEGATIVE — an unconditional (non-flag-gated) header/footer border would be a static decoration,
    // exactly what the ticket's own "border earns its keep once content scrolls beneath it" call rejects.
    expect(stylesBlock).not.toMatch(/:scope > \[data-part='dialog'\] > :is\(header, \[data-region='header'\]\)\s*\{\s*border-block-end/)
  })

  it('the border selectors target the dialog’s DIRECT children only — never a nested [data-box]’s own region one level deeper', () => {
    const headerRule = stylesBlock.match(/:scope > \[data-part='dialog'\]\[data-fade-top\] > :is\(header, \[data-region='header'\]\)/)
    expect(headerRule).not.toBeNull()
    const footerRule = stylesBlock.match(/:scope > \[data-part='dialog'\]\[data-fade-bottom\] > :is\(footer, \[data-region='footer'\]\)/)
    expect(footerRule).not.toBeNull()
  })
})

describe('drawer.css — @scope token hygiene', () => {
  it('@scope CONSUMES only the own --ui-drawer-* chain + the role-pure --ui-container-* seam + the sanctioned motion constants', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => surfaceSeam.has(v))).toBe(true)
    expect(allRefs.some((v) => /^--ui-drawer-/.test(v))).toBe(true)
    expect(allRefs.some((v) => motionConstants.has(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw-primitive --md-sys-color-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    const planted = "@scope (ui-drawer) { :scope > [data-part='dialog'] { background: var(--md-sys-color-neutral-surface); } }"
    expect(foreignScopeRefs(planted)).toEqual(['--md-sys-color-neutral-surface'])
  })
})

describe('drawer.css — forced-colors survival', () => {
  it('a forced-colors block keeps the dialog surface/frame/ink visible (Canvas/CanvasText) and drops the wash', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/background-color:\s*Canvas/)
    expect(fc).toMatch(/background-image:\s*none/)
    expect(fc).toMatch(/border-color:\s*CanvasText/)
    expect(fc).toMatch(/color:\s*CanvasText/)
  })
})
