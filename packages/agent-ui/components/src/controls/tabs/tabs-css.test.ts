import { describe, it, expect } from 'vitest'
// Read tabs.css as TEXT (the same readFileSync approach as the button/text-field probes).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s8 — tabs.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0104 transparent-by-
// default — no own surface seeding; geometry.md Pattern class — control-height rows / --md-sys-space shell). jsdom
// can't compute the rendered px/colours — these pin the STRUCTURE + the CSS text; the rendered paint + forced-
// colors survival is tabs.browser.test.ts.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/tabs/tabs.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-tabs) {'), css.indexOf('@scope (ui-tabs) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-tabs) {'))

// The fleet tokens a control reads DIRECTLY in @scope (the shared focus ring, ADR-0009; the shared state-
// transition motion). Everything else in @scope must be the own --ui-tabs-* chain.
const sharedFleet = new Set([
  '--md-sys-color-focus-ring',
  '--md-sys-state-focus-ring-width',
  '--md-sys-state-focus-ring-offset',
  '--md-sys-motion-duration-fast',
  '--md-sys-motion-easing-standard',
])

/** @scope token-hygiene predicate — every var() ref that is NEITHER the own --ui-tabs-* chain NOR a fleet token. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !sharedFleet.has(v) && !/^--ui-tabs-/.test(v))

describe('tabs.css — structure + sectioning (s8)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-tabs\)/)
  })

  it('the :where(ui-tabs) block does NOT seed --ui-container-bg — a bare tabs is transparent by default (ADR-0104)', () => {
    expect(tokenBlock).not.toMatch(/--ui-container-bg\s*:/) // negative control — the seeding regressed the pattern-wizard double-surface (#29)
  })

  it('declares the --ui-tabs-* chain — control-height tab rows + the --md-sys-space shell + the ink/indicator roles', () => {
    // the interactive rows take the CONTROL height (geometry.md Pattern class), the shell uses --md-sys-space
    expect(tokenBlock).toMatch(/--ui-tabs-tab-height:\s*var\(--md-sys-height-lg\)/) // GH #297 — repointed up the ramp
    // GH #536 — the per-tab inline padding is gone; the strip gap grew by one former padding unit (xs + md).
    expect(tokenBlock).not.toMatch(/--ui-tabs-tab-pad-inline/)
    expect(tokenBlock).toMatch(/--ui-tabs-strip-gap:\s*calc\(var\(--md-sys-space-xs\)\s*\+\s*var\(--md-sys-space-md\)\)/)
    expect(tokenBlock).toMatch(/--ui-tabs-panel-pad:\s*var\(--md-sys-space-md\)/)
    // the ink ladder + the indicator (SOLID roles)
    expect(tokenBlock).toMatch(/--ui-tabs-ink:\s*var\(--md-sys-color-neutral-on-surface-variant\)/)
    expect(tokenBlock).toMatch(/--ui-tabs-ink-selected:\s*var\(--md-sys-color-neutral-on-surface\)/)
    expect(tokenBlock).toMatch(/--ui-tabs-indicator:\s*var\(--md-sys-color-primary\)/)
    expect(tokenBlock).toMatch(/--ui-tabs-strip-line:\s*var\(--md-sys-color-neutral-outline-variant\)/)
  })
})

describe('tabs.css — @scope token hygiene (s8)', () => {
  it('@scope CONSUMES only --ui-tabs-* (+ the shared focus-ring/motion fleet tokens)', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
    // anti-vacuous: the fleet tokens AND the own chain ARE consumed (the whitelist is live)
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => sharedFleet.has(v))).toBe(true)
    expect(allRefs.some((v) => /^--ui-tabs-/.test(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw-primitive --md-sys-color-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    const planted = '@scope (ui-tabs) { ui-tab:state(selected) { color: var(--md-sys-color-primary); } }'
    expect(foreignScopeRefs(planted)).toEqual(['--md-sys-color-primary'])
  })

  it('NEVER a color-mix and NEVER opacity (components hold zero colour opinion; ADR-0008)', () => {
    expect(css).not.toContain('color-mix(')
    expect(css).not.toMatch(/opacity\s*:/)
  })
})

describe('tabs.css — the tablist strip + tab rows + panel anatomy (s8)', () => {
  it('the tablist strip is a flex row with a bottom divider', () => {
    const m = stylesBlock.match(/:scope > \[data-part='tablist'\]\s*\{([^}]*)\}/)
    expect(m, 'the [data-part=tablist] rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/flex-direction:\s*row/)
    expect(rule).toMatch(/gap:\s*var\(--ui-tabs-strip-gap\)/)
    expect(rule).toMatch(/border-block-end:\s*1px solid var\(--ui-tabs-strip-line\)/)
  })

  it('a tab is a CONTROL-height interactive row; selection keys off :state(selected) (aria-selected is on internals)', () => {
    const m = stylesBlock.match(/\n  ui-tab \{([^}]*)\}/)
    expect(m, 'the ui-tab rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/block-size:\s*var\(--ui-tabs-tab-height\)/)
    // GH #536 — no per-tab inline padding; the clickable area is the label box at the control height.
    expect(rule).not.toMatch(/padding-inline/)
    expect(rule).toMatch(/cursor:\s*pointer/)
    // selected ink + the underline indicator both key on :state(selected) (no [aria-selected] attribute exists)
    expect(stylesBlock).toMatch(/ui-tab:state\(selected\)\s*\{\s*color:\s*var\(--ui-tabs-ink-selected\)/)
    expect(stylesBlock).toMatch(/ui-tab:state\(selected\)::after\s*\{\s*background:\s*var\(--ui-tabs-indicator\)/)
  })

  it('the indicator is a ::after bar, transparent until selected', () => {
    const m = stylesBlock.match(/ui-tab::after\s*\{([^}]*)\}/)
    expect(m, 'the ui-tab::after indicator rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/block-size:\s*var\(--ui-tabs-indicator-size\)/)
    expect(rule).toMatch(/background:\s*transparent/)
  })

  it('a panel authors an explicit [hidden]{display:none} (author display:block OUTRANKS the UA [hidden] rule)', () => {
    expect(stylesBlock).toMatch(/ui-tab-panel\s*\{[^}]*display:\s*block/)
    expect(stylesBlock).toMatch(/ui-tab-panel\[hidden\]\s*\{\s*display:\s*none/) // load-bearing — else block beats UA hidden
    expect(stylesBlock).toMatch(/ui-tab-panel\s*\{[^}]*padding:\s*var\(--ui-tabs-panel-pad\)/)
  })
})

describe('tabs.css — [fill] (ADR-0144 Q1 cl.1) — the shell flex-column + the filled panel scroll leg', () => {
  it(':scope[fill] is a flex column filling a bounded parent', () => {
    const m = stylesBlock.match(/:scope\[fill\]\s*\{([^}]*)\}/)
    expect(m, 'the :scope[fill] rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/flex-direction:\s*column/)
    expect(rule).toMatch(/block-size:\s*100%/)
    expect(rule).toMatch(/min-block-size:\s*0/)
  })

  it('the visible filled panel is the ONE flexible, scrolling item — hidden panels are untouched by this rule', () => {
    const m = stylesBlock.match(/:scope\[fill\] ui-tab-panel:not\(\[hidden\]\)\s*\{([^}]*)\}/)
    expect(m, 'the :scope[fill] ui-tab-panel:not([hidden]) rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/flex:\s*1 1 auto/)
    expect(rule).toMatch(/min-block-size:\s*0/)
    expect(rule).toMatch(/overflow-y:\s*auto/)
  })

  it('the fill panel scrollbar-width reads the consumer-INHERITED var()-fallback seam — the :where() TOKEN block does NOT declare it (the TKT-0065/split-pane lesson)', () => {
    const m = stylesBlock.match(/:scope\[fill\] ui-tab-panel:not\(\[hidden\]\)\s*\{([^}]*)\}/)
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/scrollbar-width:\s*var\(--ui-tabs-panel-scrollbar-width,\s*auto\)/)
    // an OWN declaration in the token block would beat a composing surface's inherited value — must NOT exist there.
    expect(tokenBlock).not.toMatch(/--ui-tabs-panel-scrollbar-width\s*:/)
  })

  it('NEGATIVE control: a fill-less <ui-tabs> is untouched — no bare :scope rule declares block-size/flex/overflow', () => {
    const bareScope = stylesBlock.match(/:scope\s*\{([^}]*)\}/)
    expect(bareScope, 'the bare :scope rule is missing').not.toBeNull()
    const rule = (bareScope as RegExpMatchArray)[1]
    expect(rule).not.toMatch(/flex|block-size|overflow/)
  })
})

describe('tabs.css — [orientation=vertical] (GH #581) — shell row, strip column, edges, labels', () => {
  it(":scope[orientation='vertical'] is a flex ROW (the shell)", () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\]\s*\{([^}]*)\}/)
    expect(m, "the :scope[orientation='vertical'] shell rule is missing").not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/flex-direction:\s*row/)
  })

  it("the vertical strip is a pinned flex COLUMN at max-content width, divider on inline-end, own overflow-y", () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\] > \[data-part='tablist'\]\s*\{([^}]*)\}/)
    expect(m, 'the vertical tablist rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/flex-direction:\s*column/)
    expect(rule).toMatch(/flex:\s*none/)
    expect(rule).toMatch(/inline-size:\s*max-content/)
    expect(rule).toMatch(/border-block-end:\s*0/) // the horizontal divider is off
    expect(rule).toMatch(/border-inline-end:\s*1px solid var\(--ui-tabs-strip-line\)/) // the SAME edge the indicator rides
    expect(rule).toMatch(/overflow-y:\s*auto/) // the strip's own overflow axis flips (GH #221, vertical form)
  })

  it('a vertical tab label re-aligns start (center is a horizontal-strip convention) — EXACT CHILD COMBINATORS (nested-tabs hardening)', () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\] > \[data-part='tablist'\] > ui-tab\s*\{([^}]*)\}/)
    expect(m, 'the vertical ui-tab rule is missing (or regressed to a bare descendant combinator)').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/justify-content:\s*flex-start/)
  })

  it('the vertical indicator rides the inline-end edge as a full-height bar (not a bottom bar) — EXACT CHILD COMBINATORS', () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\] > \[data-part='tablist'\] > ui-tab::after\s*\{([^}]*)\}/)
    expect(m, 'the vertical ui-tab::after rule is missing (or regressed to a bare descendant combinator)').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/inset-inline:\s*auto 0/)
    expect(rule).toMatch(/inset-block:\s*0/)
    expect(rule).toMatch(/inline-size:\s*var\(--ui-tabs-indicator-size\)/)
    expect(rule).toMatch(/block-size:\s*auto/) // overrides the horizontal fixed block-size
  })

  it('the vertical panel is the row shrink-to-fit item (min-inline-size:0) — EXACT CHILD COMBINATOR', () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\] > ui-tab-panel\s*\{([^}]*)\}/)
    expect(m, 'the vertical ui-tab-panel rule is missing (or regressed to a bare descendant combinator)').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/flex:\s*1 1 auto/)
    expect(rule).toMatch(/min-inline-size:\s*0/)
  })

  it('NEGATIVE — zero new tokens: every declaration in the vertical block reads only the EXISTING --ui-tabs-* chain', () => {
    const start = stylesBlock.indexOf(":scope[orientation='vertical']")
    const end = stylesBlock.indexOf("[overflow='menu']")
    const verticalBlock = stylesBlock.slice(start, end)
    expect(verticalBlock.length).toBeGreaterThan(0) // anti-vacuous
    expect(foreignScopeRefs(verticalBlock)).toEqual([])
    const refs = [...verticalBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(new Set(refs)).toEqual(new Set(['--ui-tabs-strip-line', '--ui-tabs-indicator-size'])) // no NEW token names
  })

  it('NEGATIVE — no bare descendant combinator survives for the vertical tab/indicator/panel rules (the nested-tabs leak class of bug)', () => {
    const start = stylesBlock.indexOf(":scope[orientation='vertical']")
    const end = stylesBlock.indexOf("[overflow='menu']")
    const verticalBlock = stylesBlock.slice(start, end)
    expect(verticalBlock).not.toMatch(/:scope\[orientation='vertical'\] ui-tab\s*\{/) // bare descendant, no `>` chain
    expect(verticalBlock).not.toMatch(/:scope\[orientation='vertical'\] ui-tab::after\s*\{/)
    expect(verticalBlock).not.toMatch(/:scope\[orientation='vertical'\] ui-tab-panel\s*\{/)
  })

  it('the forced-colors block covers BOTH divider edges (block-end horizontal, inline-end vertical)', () => {
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/border-inline-end-color:\s*CanvasText/)
  })
})

describe('tabs.css — [overflow=menu] (GH #586) — shell grid, part assignments, trigger geometry', () => {
  it(":scope[overflow='menu'] is a GRID — horizontal template: strip+trigger row over a full-width panel row", () => {
    const m = stylesBlock.match(/:scope\[overflow='menu'\]\s*\{([^}]*)\}/)
    expect(m, "the :scope[overflow='menu'] shell rule is missing").not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*grid/)
    expect(rule).toMatch(/grid-template-columns:\s*1fr auto/)
    expect(rule).toMatch(/grid-template-rows:\s*auto 1fr/)
    expect(rule).toMatch(/'strip trigger'/)
    expect(rule).toMatch(/'panel panel'/)
  })

  it("the vertical×menu corner (§7) uses a HIGHER-specificity compound selector — strip beside panel, trigger at the column's block-end", () => {
    const m = stylesBlock.match(/:scope\[orientation='vertical'\]\[overflow='menu'\]\s*\{([^}]*)\}/)
    expect(m, 'the vertical×menu compound corner rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*grid/)
    expect(rule).toMatch(/grid-template-columns:\s*auto 1fr/)
    expect(rule).toMatch(/grid-template-rows:\s*1fr auto/)
    expect(rule).toMatch(/'strip panel'/)
    expect(rule).toMatch(/'trigger panel'/)
  })

  it('grid-area assignments use EXACT CHILD COMBINATORS (the nested-tabs discipline) — strip, panel, and the promoted trigger button', () => {
    // the strip's grid-area rule ALSO carries the grid-item min-size escape hatch (below) — check CONTAINS,
    // not an exact-body match.
    const stripRule = stylesBlock.match(/:scope\[overflow='menu'\] > \[data-part='tablist'\]\s*\{([^}]*)\}/)
    expect(stripRule, 'the strip grid-area rule is missing').not.toBeNull()
    expect((stripRule as RegExpMatchArray)[1]).toMatch(/grid-area:\s*strip/)
    expect(stylesBlock).toMatch(/:scope\[overflow='menu'\] > ui-tab-panel\s*\{\s*grid-area:\s*panel;?\s*\}/)
    // the trigger's grid-area rides its ONE geometry rule (below), not a separate duplicate selector
    const m = stylesBlock.match(/:scope\[overflow='menu'\] > \[data-part='overflow'\] > \[data-part='trigger'\]\s*\{([^}]*)\}/)
    expect(m, 'the trigger geometry rule is missing').not.toBeNull()
    expect((m as RegExpMatchArray)[1]).toMatch(/grid-area:\s*trigger/)
  })

  it('the strip escapes the grid-item "automatic minimum size" trap (min-inline-size/min-block-size:0) and never flex-shrinks its tabs', () => {
    const stripRule = stylesBlock.match(/:scope\[overflow='menu'\] > \[data-part='tablist'\]\s*\{([^}]*)\}/)
    expect(stripRule, 'the strip grid-area rule is missing').not.toBeNull()
    const rule = (stripRule as RegExpMatchArray)[1]
    expect(rule).toMatch(/min-inline-size:\s*0/)
    expect(rule).toMatch(/min-block-size:\s*0/)
    expect(stylesBlock).toMatch(/:scope\[overflow='menu'\] > \[data-part='tablist'\] > ui-tab\s*\{\s*flex-shrink:\s*0;?\s*\}/)
  })

  it('an overflowed tab renders nowhere; the strip never scrolls in menu mode (overflow:clip)', () => {
    expect(stylesBlock).toMatch(/:scope\[overflow='menu'\] > \[data-part='tablist'\] > ui-tab\[data-overflowed\]\s*\{\s*display:\s*none;?\s*\}/)
    const m = stylesBlock.match(/:scope\[overflow='menu'\] > \[data-part='tablist'\]\s*\{\s*overflow:\s*clip;?\s*\}/)
    expect(m, 'the strip must overflow:clip in menu mode — no bare fallback to overflow-x/y:auto').not.toBeNull()
  })

  it('the trigger is a SQUARE tab-height icon button, zero new tokens (ink + focus ring off the EXISTING --ui-tabs-* chain)', () => {
    const m = stylesBlock.match(/:scope\[overflow='menu'\] > \[data-part='overflow'\] > \[data-part='trigger'\]\s*\{([^}]*)\}/)
    expect(m, 'the trigger geometry rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/inline-size:\s*var\(--ui-tabs-tab-height\)/)
    expect(rule).toMatch(/block-size:\s*var\(--ui-tabs-tab-height\)/)
    expect(rule).toMatch(/color:\s*var\(--ui-tabs-ink\)/)
    expect(stylesBlock).toMatch(/:scope\[overflow='menu'\] > \[data-part='overflow'\] > \[data-part='trigger'\]:hover\s*\{\s*color:\s*var\(--ui-tabs-ink-hover\)/)
    expect(stylesBlock).toMatch(
      /:scope\[overflow='menu'\] > \[data-part='overflow'\] > \[data-part='trigger'\]:focus-visible\s*\{\s*outline:\s*var\(--md-sys-state-focus-ring-width\)\s+solid\s+var\(--md-sys-color-focus-ring\)/,
    )
  })

  it('the overflow part authors its OWN [hidden]{display:none} — ui-menu\'s display:contents (an author rule) outranks the UA [hidden] rule otherwise', () => {
    expect(stylesBlock).toMatch(/:scope\[overflow='menu'\] > \[data-part='overflow'\]\[hidden\]\s*\{\s*display:\s*none;?\s*\}/)
  })

  it('NEGATIVE — zero new tokens: every declaration in the menu-mode block reads only the EXISTING --ui-tabs-* chain (+ the shared focus ring)', () => {
    const start = stylesBlock.indexOf("[overflow='menu']")
    const end = stylesBlock.indexOf('/* Motion —')
    const menuBlock = stylesBlock.slice(start, end)
    expect(menuBlock.length).toBeGreaterThan(0) // anti-vacuous
    expect(foreignScopeRefs(menuBlock)).toEqual([])
  })
})

describe('tabs.css — the shared focus ring + motion + forced-colors (s8)', () => {
  it('the tab focus ring is :focus-visible from the fleet tokens (ADR-0009)', () => {
    const m = stylesBlock.match(/ui-tab:focus-visible\s*\{([^}]*)\}/)
    expect(m, 'the ui-tab:focus-visible rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/outline:\s*var\(--md-sys-state-focus-ring-width\)\s+solid\s+var\(--md-sys-color-focus-ring\)/)
    expect(rule).toMatch(/outline-offset:/)
  })

  it('motion transitions the state PAINT only — enumerated, never `all`, never geometry — gated behind :state(ready)', () => {
    expect(stylesBlock).toMatch(/:scope:state\(ready\) ui-tab\s*\{\s*transition:/)
    const readyRules = [...stylesBlock.matchAll(/:scope:state\(ready\)[^{]*\{([^}]*)\}/g)].map((m) => m[1] as string)
    expect(readyRules.length).toBeGreaterThan(0) // anti-vacuous
    for (const rule of readyRules) {
      if (!/transition:/.test(rule) || /transition:\s*none/.test(rule)) continue // skip the reduced-motion zeroing rule
      expect(rule).not.toMatch(/transition:\s*all/) // enumerated longhands, never `all`
      expect(rule).not.toMatch(/height|padding|inline-size|\bwidth\b|gap|transform|outline/) // geometry/ring SNAP
      expect(rule).toContain('--md-sys-motion-duration-fast') // timing from the shared token
    }
  })

  it('zeroes the transition under prefers-reduced-motion (accessibility — non-negotiable)', () => {
    expect(stylesBlock).toMatch(/prefers-reduced-motion:\s*reduce/)
    const rm = stylesBlock.slice(stylesBlock.indexOf('prefers-reduced-motion'))
    expect(rm).toMatch(/transition:\s*none/)
  })

  it('a forced-colors block keeps the SELECTED-tab indicator + label visible (Highlight) and the divider (CanvasText)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/ui-tab:state\(selected\)\s*\{\s*color:\s*Highlight/) // the selected label survives
    expect(fc).toMatch(/ui-tab:state\(selected\)::after\s*\{\s*background:\s*Highlight/) // the indicator survives
    expect(fc).toMatch(/border-block-end-color:\s*CanvasText/) // the strip divider survives
  })
})
