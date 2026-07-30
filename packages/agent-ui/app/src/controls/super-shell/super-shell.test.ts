// super-shell.test.ts — ui-super-shell (M5, GH #83) vs shell-archetypes-m5.spec.md.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { UISuperShellElement } from './super-shell.ts'
declare const process: { cwd(): string }

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

function make(slots: Partial<Record<string, string>>): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  for (const [slot, text] of Object.entries(slots)) {
    const child = document.createElement('div')
    child.setAttribute('data-slot', slot)
    child.textContent = text ?? slot
    el.append(child)
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-super-shell — the SPEC-R1 grammar', () => {
  it('upgrades and sorts authored children into [ bar | rail|pane|canvas|pane|rail | bar ] (full grammar)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP', 'global-options': 'GO', footer: 'F' })
    expect(el).toBeInstanceOf(UISuperShellElement)
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    // filter the composed-once scrim (SPEC-R9d, the middle row's first child) — this asserts region placement
    const order = [...middle.children].filter((c) => c.getAttribute('data-part') !== 'scrim').map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-side') ?? '-'}`)
    expect(order).toEqual(['rail:start', 'pane:start', 'canvas:-', 'pane:end', 'rail:end'])
    expect(el.querySelectorAll('[data-part="bar"]')).toHaveLength(2)
    expect((el.querySelector('[data-bar="header"]') as HTMLElement).textContent).toContain('H')
  })

  it('ABSENCE law: unfilled slots contribute no box; unmarked children fold into content; missing content warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = make({ content: 'C' })
    expect(el.querySelector('[data-part="bar"]')).toBeNull()
    expect(el.querySelector('[data-part="rail"]')).toBeNull()
    expect(el.querySelector('[data-part="pane"]')).toBeNull()
    expect(el.querySelector('[data-part="side-toggle"]')).toBeNull() // no header ⇒ no toggles (R2b)
    const bare = document.createElement('ui-super-shell') as UISuperShellElement
    bare.append(document.createElement('p')) // unmarked ⇒ content
    document.body.append(bare); mounted.push(bare)
    expect(bare.querySelector('[data-part="canvas"] p')).not.toBeNull()
    const empty = document.createElement('ui-super-shell')
    document.body.append(empty); mounted.push(empty as HTMLElement)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no content slot'))
    warn.mockRestore()
  })

  it('R1b ring-dropping recursion: a nested shell in content composes with panes and NO rails (depth 2)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: '' })
    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const inner = document.createElement('ui-super-shell') as UISuperShellElement
    const innerPane = document.createElement('div'); innerPane.setAttribute('data-slot', 'nav-pane'); innerPane.textContent = 'selections'
    const innerContent = document.createElement('div'); innerContent.setAttribute('data-slot', 'content'); innerContent.textContent = 'inner canvas'
    inner.append(innerPane, innerContent)
    canvas.append(inner)
    // the nested level authors no rails — none render (zero extra code, the absence law)
    expect(inner.querySelector('[data-part="rail"]')).toBeNull()
    expect(inner.querySelector('[data-part="pane"]')).not.toBeNull()
    expect(inner.querySelector('[data-part="canvas"]')?.textContent).toBe('inner canvas')
  })
})

describe('ui-super-shell — SPEC-R5 amendment: N stacked panes per side, asymmetric composition (LLD-C3, GH #96)', () => {
  it('R5a: a side stacks MULTIPLE panes (rail, then panes outer-to-content) — no longer a rail+pane ceiling', () => {
    const el = make({ 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].filter((c) => c.getAttribute('data-part') !== 'scrim').map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-slot-name')}:${c.getAttribute('data-side')}`)
    expect(order).toEqual(['rail:global-nav:start', 'pane:nav-pane:start', 'pane:section-nav:start', 'canvas:content:null'])
  })

  it('R5b: the two sides compose INDEPENDENTLY — a side may stack more panes than its mirror (dual-sidebar frame shape)', () => {
    const el = make({ 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C', 'options-pane': 'OP', 'global-options': 'GO' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].filter((c) => c.getAttribute('data-part') !== 'scrim').map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-side') ?? '-'}`)
    // left (start): rail + 2 panes · right (end): 1 pane + rail — asymmetric pane counts, R5b
    expect(order).toEqual(['rail:start', 'pane:start', 'pane:start', 'canvas:-', 'pane:end', 'rail:end'])
    expect(el.querySelectorAll('[data-side="start"]')).toHaveLength(3)
    expect(el.querySelectorAll('[data-side="end"]')).toHaveLength(2)
  })

  it('R5c: options-section (the end-side mirror of section-nav) stacks closest to content, absence law applies to both new slots', () => {
    const el = make({ content: 'C', 'options-pane': 'OP', 'options-section': 'OS', 'global-options': 'GO' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].filter((c) => c.getAttribute('data-part') !== 'scrim').map((c) => c.getAttribute('data-slot-name'))
    expect(order).toEqual(['content', 'options-section', 'options-pane', 'global-options'])
    // section-nav authored on neither side ⇒ no box anywhere (R1 absence law extends to the new slots)
    expect(el.querySelector('[data-slot-name="section-nav"]')).toBeNull()
  })

  it('R5c: section-nav and options-section carry navigation/complementary landmarks, matching their primary-pane mirrors', () => {
    const el = make({ 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C', 'options-section': 'OS', 'options-pane': 'OP' })
    expect(el.querySelector('[data-slot-name="section-nav"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="options-section"]')?.getAttribute('role')).toBe('complementary')
  })

  it('R5d: collapsing a side hides its WHOLE stack together — no per-pane collapse', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C' })
    el.collapsedStart = true
    // the existing whole-side CSS rule (`[collapsed-start] [data-side='start']`) targets every part
    // sharing that attribute — jsdom doesn't compute layout, so assert the SHARED selector surface
    // rather than a computed style: all three start-side parts carry the identical data-side value
    // the collapse rule keys off, with no per-pane escape hatch anywhere in the markup.
    const startParts = el.querySelectorAll('[data-part="middle"] > [data-side="start"]')
    expect(startParts).toHaveLength(3)
    for (const part of startParts) expect(part.getAttribute('data-side')).toBe('start')
  })
})

describe('ui-super-shell — landmarks (LLD-C1, GH #94)', () => {
  it('every part carries its default ARIA landmark', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP', 'global-options': 'GO', footer: 'F' })
    expect(el.querySelector('[data-bar="header"]')?.getAttribute('role')).toBe('banner')
    expect(el.querySelector('[data-bar="footer"]')?.getAttribute('role')).toBe('contentinfo')
    expect(el.querySelector('[data-part="canvas"]')?.getAttribute('role')).toBe('main')
    expect(el.querySelector('[data-slot-name="global-nav"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="global-options"]')?.getAttribute('role')).toBe('complementary')
    expect(el.querySelector('[data-slot-name="options-pane"]')?.getAttribute('role')).toBe('complementary')
  })

  it('a data-landmark override on the first authored child wins over the slot default', () => {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    const nav = document.createElement('div')
    nav.setAttribute('data-slot', 'nav-pane')
    nav.setAttribute('data-landmark', 'complementary') // the a2ui-live chat-composer precedent (ADR-0083)
    const content = document.createElement('div')
    content.setAttribute('data-slot', 'content')
    el.append(nav, content)
    document.body.append(el)
    mounted.push(el)
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('complementary')
  })

  it('an unrecognized data-landmark value is ignored — falls back to the slot default (fail-closed)', () => {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    const nav = document.createElement('div')
    nav.setAttribute('data-slot', 'nav-pane')
    nav.setAttribute('data-landmark', 'not-a-real-role')
    const content = document.createElement('div')
    content.setAttribute('data-slot', 'content')
    el.append(nav, content)
    document.body.append(el)
    mounted.push(el)
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('navigation')
  })

  it('only the HOST carries no role of its own — the landmarks live on the parts, not the custom element', () => {
    const el = make({ header: 'H', content: 'C' })
    expect(el.getAttribute('role')).toBeNull()
  })
})

describe('ui-super-shell — the SPEC-R2 collapse contract (logical start/end, LLD-C4)', () => {
  it('header toggles flip the reflected per-side state, PAIRED, aria-expanded mirrors (wide)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP' })
    // jsdom rects are 0-width; the toggle's narrow arm requires width>0, so jsdom exercises the WIDE arm
    const start = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const end = el.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(el.hasAttribute('collapsed-start')).toBe(false)
    start.click()
    expect(el.collapsedStart).toBe(true)
    expect(el.hasAttribute('collapsed-start')).toBe(true)
    expect(el.collapsedEnd).toBe(false) // sides are independent (R2a)
    end.click()
    expect(el.collapsedEnd).toBe(true)
    start.click()
    expect(el.collapsedStart).toBe(false) // round-trip
  })

  it('R2d: the state is SETTABLE as props (a consumer restores a persisted choice)', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    el.collapsedStart = true
    expect(el.hasAttribute('collapsed-start')).toBe(true)
  })

  it('toggle aria-labels are direction-agnostic text ("start"/"end"), never "left"/"right"', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP' })
    const start = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const end = el.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(start.getAttribute('aria-label')).toBe('Toggle start panes')
    expect(end.getAttribute('aria-label')).toBe('Toggle end panes')
  })
})

describe('ui-super-shell — SPEC-R8/R9/R10 responsive system (jsdom coverage, LLD-C7/ADR-0155)', () => {
  it('SPEC-R8b: collapse-band is a reflected enum prop (narrow default, compact settable)', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    expect(el.collapseBand).toBe('narrow')
    expect(el.hasAttribute('collapse-band')).toBe(false) // default not reflected as an attribute
    el.collapseBand = 'compact'
    expect(el.getAttribute('collapse-band')).toBe('compact')
  })

  it('SPEC-R9a presence: a toggle composes ONLY for an authored side — the docs-site shape (start only) has NO end toggle', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' }) // the docs site: a start nav side, no end side
    expect(el.querySelector('[data-part="side-toggle"][data-side="start"]')).not.toBeNull()
    expect(el.querySelector('[data-part="side-toggle"][data-side="end"]')).toBeNull() // the dead end-button, gone (defect 2)
    // an options-only shell gets the mirror: an end toggle, no start toggle
    const endOnly = make({ header: 'H', content: 'C', 'options-pane': 'OP' })
    expect(endOnly.querySelector('[data-part="side-toggle"][data-side="start"]')).toBeNull()
    expect(endOnly.querySelector('[data-part="side-toggle"][data-side="end"]')).not.toBeNull()
  })

  it('SPEC-R9b: each toggle carries BOTH glyphs (list menu + x close) in the leading cell', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    const toggle = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const menu = toggle.querySelector('ui-icon[data-glyph="menu"]')
    const close = toggle.querySelector('ui-icon[data-glyph="close"]')
    expect(menu?.getAttribute('glyph')).toBe('list')
    expect(close?.getAttribute('glyph')).toBe('x')
    expect(menu?.getAttribute('slot')).toBe('leading')
    expect(close?.getAttribute('slot')).toBe('leading')
  })

  it('SPEC-R9d: the scrim part is composed once as the middle row\'s FIRST child', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    expect(middle.firstElementChild?.getAttribute('data-part')).toBe('scrim')
    expect(el.querySelectorAll('[data-part="scrim"]')).toHaveLength(1)
  })

  it('SPEC-R9c: the overlay side\'s first box carries tabindex="-1" (the focus landing, non-modal)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C' })
    // the side's FIRST box in DOM order (the rail here) is the focus landing
    const firstStart = el.querySelector('[data-part="middle"] > [data-side="start"]') as HTMLElement
    expect(firstStart.getAttribute('tabindex')).toBe('-1')
  })
})

// GH #185 (parity gap b) — the pane-resizer's forced-colors annotation, source-presence pinned (jsdom
// cannot evaluate `forced-colors: active` visually — the card-css.test.ts/swiper-css.test.ts precedent
// for pinning a WHCM rule's CSS TEXT rather than its rendered paint). The rendered cross-engine leg (the
// same "no error" smoke split.browser.test.ts itself settles for, since headless Playwright doesn't
// emulate forced-colors:active either) lives in super-shell-resize-tabs.browser.test.ts.
describe('ui-super-shell — pane-resizer forced-colors annotation (GH #185 parity gap b, split.css precedent)', () => {
  const css = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/super-shell/super-shell.css`, 'utf8') as string

  it('a forced-colors block keeps [data-part="pane-resizer"] a real, visible system colour (ButtonText)', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/)
    const fc = css.slice(css.indexOf('@media (forced-colors: active)'))
    const rule = fc.slice(fc.indexOf("[data-part='pane-resizer']"), fc.indexOf('}', fc.indexOf("[data-part='pane-resizer']")))
    // GH #214 — `background-color`, not the `background` shorthand (the shorthand resets
    // `background-clip` to its initial value, which would silently undo the resizer's ink
    // content-box clip — verified live, both engines, super-shell-resize-tabs.browser.test.ts).
    expect(rule).toMatch(/background-color:\s*ButtonText/)
    expect(rule).toMatch(/forced-color-adjust:\s*none/)
  })
})

// ADR-0166 (GH #371) — the bar-seam / per-side-corner CSS contract, source-presence pinned (the
// forced-colors precedent just above: pin the CSS TEXT of a rule jsdom cannot render). These pins exist
// so DELETING a rule reds without a browser — the cross-engine measurement leg lives in
// super-shell-bar-seam.browser.test.ts. Each pin names the clause it holds.
describe('ui-super-shell — the bar-seam contract, source-pinned (ADR-0166, GH #371)', () => {
  const css = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/super-shell/super-shell.css`, 'utf8') as string
  // The token block is everything before the @scope rule; the styles block is everything after. Pinning
  // against the right half is what makes "declared in :where()" vs "consumed in @scope" a real assertion
  // rather than a substring search over the whole file (the styling-gates law). The split anchors on a
  // LINE-INITIAL `@scope (` — the file's own header comment names `@scope (ui-super-shell)` in prose, and
  // a bare indexOf on that string lands in the comment, silently making tokenBlock the header alone and
  // stylesBlock the whole file (which passes every positive pin and every count vacuously).
  const scopeAt = css.indexOf('\n@scope (')
  expect(scopeAt, 'the line-initial @scope at-rule').toBeGreaterThan(-1)
  const tokenBlock = css.slice(0, scopeAt)
  const stylesBlock = css.slice(scopeAt)
  /** The declaration body of a rule whose selector text contains `needle` (brace-matched). `which:'last'`
   *  is for a selector that also appears as one arm of an EARLIER grouped rule — the per-side narrow-stack
   *  restores, whose selectors are re-used verbatim from the stack arm they key off. */
  const ruleBody = (needle: string, which: 'first' | 'last' = 'first'): string => {
    const at = which === 'last' ? stylesBlock.lastIndexOf(needle) : stylesBlock.indexOf(needle)
    expect(at, `selector not found in the @scope block: ${needle}`).toBeGreaterThan(-1)
    const open = stylesBlock.indexOf('{', at)
    let depth = 0
    for (let i = open; i < stylesBlock.length; i++) {
      if (stylesBlock[i] === '{') depth++
      else if (stylesBlock[i] === '}') {
        depth--
        if (depth === 0) return stylesBlock.slice(open + 1, i)
      }
    }
    throw new Error(`unbalanced rule for ${needle}`)
  }

  it('cl.2 — the seam token is declared in the :where() token block as ONE composite value (the TKT-0062 repoint law)', () => {
    expect(tokenBlock).toMatch(/--ui-super-shell-bar-seam:\s*1px solid var\(--md-sys-color-neutral-outline-variant\);/)
  })

  it('cl.4 — BOTH block-axis radius tokens are declared in the token block, each chained to --ui-super-shell-radius', () => {
    expect(tokenBlock).toMatch(/--ui-super-shell-radius-block-start:\s*var\(--ui-super-shell-radius\);/)
    expect(tokenBlock).toMatch(/--ui-super-shell-radius-block-end:\s*var\(--ui-super-shell-radius\);/)
  })

  it('cl.1 — [data-part="frame"] declares NO gap, and the three inline-axis gap owners are untouched', () => {
    expect(ruleBody("[data-part='frame'] {")).not.toMatch(/\bgap:/)
    expect(tokenBlock).toMatch(/--ui-super-shell-gap:\s*var\(--ui-super-shell-module\);/)
    expect(ruleBody("[data-part='bar'] {")).toMatch(/gap:\s*var\(--ui-super-shell-gap\);/)
    expect(ruleBody("[data-part='middle'] {")).toMatch(/gap:\s*var\(--ui-super-shell-gap\);/)
  })

  it('cl.2 — each bar draws the seam on its OWN bar-facing edge, per-side, off the token', () => {
    expect(ruleBody("[data-part='bar'][data-bar='header']")).toMatch(/border-block-end:\s*var\(--ui-super-shell-bar-seam\);/)
    expect(ruleBody("[data-part='bar'][data-bar='footer']")).toMatch(/border-block-start:\s*var\(--ui-super-shell-bar-seam\);/)
    // #253's no-radius-on-a-bar clause, re-affirmed: no bar rule declares any radius
    expect(ruleBody("[data-part='bar'] {")).not.toMatch(/radius/)
  })

  it('cl.2 — the bar keeps box-sizing: border-box (what ABSORBS the seam inside the 54px instead of growing the bar)', () => {
    expect(ruleBody("[data-part='bar'] {")).toMatch(/box-sizing:\s*border-box;/)
    expect(ruleBody("[data-part='bar'] {")).toMatch(/min-block-size:\s*var\(--ui-super-shell-bar-size\);/)
  })

  it('cl.3 — BOTH frame bar-presence rules exist AND use the mandatory `> ` CHILD combinator', () => {
    // The child combinator IS the mechanism: a `:has()` argument is not constrained by @scope's lower
    // limit, so the descendant form matches an outer frame on a NESTED shell's bar. An edit "simplifying"
    // it away compiles clean — this pin plus the nested browser probe are what red.
    expect(stylesBlock).toMatch(/\[data-part='frame'\]:has\(>\s*\[data-bar='header'\]\)/)
    expect(stylesBlock).toMatch(/\[data-part='frame'\]:has\(>\s*\[data-bar='footer'\]\)/)
    expect(ruleBody("[data-part='frame']:has(> [data-bar='header'])")).toMatch(/--ui-super-shell-radius-block-start:\s*0;/)
    expect(ruleBody("[data-part='frame']:has(> [data-bar='footer'])")).toMatch(/--ui-super-shell-radius-block-end:\s*0;/)
    // no DESCENDANT-form variant of either rule may exist anywhere (the leak shape)
    expect(stylesBlock).not.toMatch(/\[data-part='frame'\]:has\(\s*\[data-bar=/)
  })

  it('cl.4 — the carded parts consume the pair as the four LOGICAL longhands and declare no radius shorthand', () => {
    const grouped = ruleBody("[data-part='rail'],")
    expect(grouped).toMatch(/border-start-start-radius:\s*var\(--ui-super-shell-radius-block-start\);/)
    expect(grouped).toMatch(/border-start-end-radius:\s*var\(--ui-super-shell-radius-block-start\);/)
    expect(grouped).toMatch(/border-end-start-radius:\s*var\(--ui-super-shell-radius-block-end\);/)
    expect(grouped).toMatch(/border-end-end-radius:\s*var\(--ui-super-shell-radius-block-end\);/)
    // the three shorthands at rail/pane/pane-resizer are GONE (n10's negative half)
    expect(stylesBlock).not.toMatch(/^\s+border-radius:\s*var\(--ui-super-shell-radius\)/m)
  })

  it('cl.6 — ALL SIX overlay arms restore BOTH pairs on the overlaid card (three blocks × two arms)', () => {
    for (const anchor of [
      "[data-auto-collapsed-start][data-narrow-open='start'] [data-part='middle']",
      ":scope[data-narrow-open='start'] [data-part='middle'] > [data-side='start']:not([data-part='pane-resizer']),",
      "[collapse-band='compact']:not([narrow-start='stack']):not([narrow-start='tabs'])[data-narrow-open='start']",
    ]) {
      const body = ruleBody(anchor)
      expect(body, anchor).toMatch(/--ui-super-shell-radius-block-start:\s*var\(--ui-super-shell-radius\);/)
      expect(body, anchor).toMatch(/--ui-super-shell-radius-block-end:\s*var\(--ui-super-shell-radius\);/)
    }
    // A census, so a FOURTH posture cannot be added without reading cl.6/cl.7: three overlay blocks plus
    // one narrow-end='stack' arm restore block-start; three overlay blocks plus one narrow-start='stack'
    // arm restore block-end.
    expect(stylesBlock.match(/--ui-super-shell-radius-block-start:\s*var\(--ui-super-shell-radius\);/g) ?? []).toHaveLength(4)
    expect(stylesBlock.match(/--ui-super-shell-radius-block-end:\s*var\(--ui-super-shell-radius\);/g) ?? []).toHaveLength(4)
  })

  it('cl.7 fork F2 — the narrow-stack restores are keyed PER SIDE and restore OPPOSITE pairs', () => {
    // start-stacked ⇒ card at the column TOP ⇒ keeps block-start squared, restores block-END.
    const startArm = ruleBody(":scope[narrow-start='stack'] [data-part='middle'] > [data-side='start']:not([data-part='pane-resizer']) {", 'last')
    expect(startArm).toMatch(/--ui-super-shell-radius-block-end:\s*var\(--ui-super-shell-radius\);/)
    expect(startArm).not.toMatch(/--ui-super-shell-radius-block-start:/)
    // end-stacked ⇒ card at the column BOTTOM ⇒ the pairing inverts.
    const endArm = ruleBody(":scope[narrow-end='stack'] [data-part='middle'] > [data-side='end']:not([data-part='pane-resizer']) {", 'last')
    expect(endArm).toMatch(/--ui-super-shell-radius-block-start:\s*var\(--ui-super-shell-radius\);/)
    expect(endArm).not.toMatch(/--ui-super-shell-radius-block-end:/)
  })

  it('cl.7 exception C — the narrow-tabs strip owns its own block-start seam at one module THIRD', () => {
    expect(ruleBody("ui-tabs[data-part='narrow-tabs'] {")).toMatch(/margin-block-start:\s*calc\(var\(--ui-super-shell-module\) \/ 3\);/)
  })

  it("cl.7 exception C — the strip composes ABOVE middle, which is why the clause's own pane-restore half is NOT built", () => {
    // ADR-0166 Context fact 3 / cl.7 state the strip is a frame child "between middle and the footer".
    // It is not: #buildNarrowTabs calls middle.before(strip). This pin holds the MEASURED order so the
    // discrepancy cannot drift out of view before the record is repaired (escalated on GH #371).
    const ts = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/super-shell/super-shell.ts`, 'utf8') as string
    expect(ts).toMatch(/\.before\(strip\)/)
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    el.setAttribute('narrow-end', 'tabs') // set BEFORE connect — #buildNarrowTabs runs once, in #compose
    for (const slot of ['header', 'content', 'options-pane', 'footer']) {
      const child = document.createElement('div')
      child.setAttribute('data-slot', slot)
      child.textContent = slot
      el.append(child)
    }
    document.body.append(el)
    mounted.push(el)
    const frame = el.querySelector('[data-part="frame"]')!
    expect([...frame.children].map((c) => c.getAttribute('data-part'))).toEqual(['bar', 'narrow-tabs', 'middle', 'bar'])
  })
})
