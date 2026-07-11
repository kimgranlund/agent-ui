import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// swiper-css.test.ts — the FIVE swiper family sheets, static structural check (ADR-0003 sectioning + token
// hygiene; swiper-family.lld.md §7 REV; ADR-0124 Consequences — the family-root resolution). swiper.css is
// the PRIMARY sheet: it declares the whole family's `--ui-swiper-*` token table and styles the HOST only;
// the four leaf sheets (swiper-item/-pagination/-paddles/-label.css) declare NOTHING of their own and
// CONSUME the family prefix (the family-root rule family-coherence.test.ts's amended invariant B allows).
// jsdom can't compute rendered px/scroll geometry — these pin the STRUCTURE + the CSS text; the rendered
// scroll-snap/loop/forced-colors proof is swiper.browser.test.ts.

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/swiper`
const read = (f: string): string => readFileSync(`${DIR}/${f}`, 'utf8') as string

const sharedFleet = new Set([
  '--md-sys-color-focus-ring',
  '--ui-focus-ring-width',
  '--ui-focus-ring-offset',
  '--ui-motion-fast',
  '--ui-ease-standard',
  '--ui-font-sm',
  '--ui-space-xs',
  '--ui-space-sm',
  '--md-sys-color-neutral-on-surface-variant',
])

/** Every var() ref in `text` that is NEITHER the family --ui-swiper-* chain NOR a shared fleet token. */
const foreignRefs = (text: string): string[] =>
  [...text.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !sharedFleet.has(v) && !/^--ui-swiper-/.test(v))

/** Every custom property DECLARED in a bare `:where(...)` block anywhere in `text`. */
const declaredProps = (text: string): string[] => {
  const out: string[] = []
  for (const block of text.matchAll(/:where\([^)]*\)\s*\{([^}]*)\}/g)) {
    for (const d of block[1].matchAll(/(?:^|;)\s*(--[\w-]+)\s*:/gm)) out.push(d[1])
  }
  return out
}

// ── swiper.css — the PRIMARY sheet ──────────────────────────────────────────────────────────────────────

const primary = read('swiper.css')
const primaryToken = primary.slice(primary.indexOf(':where(ui-swiper) {'), primary.indexOf('@scope (ui-swiper)'))
const primaryStyles = primary.slice(primary.indexOf('@scope (ui-swiper)'))

describe('swiper.css (PRIMARY) — structure + sectioning', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(primary).toContain('[1] TOKEN BLOCK')
    expect(primary).toContain('[2] STYLES BLOCK')
    expect(primaryToken.length).toBeGreaterThan(0)
    expect(primaryStyles).toMatch(/@scope \(ui-swiper\)/)
  })

  it('does NOT seed --ui-container-bg — a bare swiper is transparent by default (ADR-0015 cl.1)', () => {
    expect(primaryToken).not.toMatch(/--ui-container-bg\s*:/)
  })

  it('declares the WHOLE family --ui-swiper-* chain (columns/align/gap/duration/easing + the dot ladder)', () => {
    expect(primaryToken).toMatch(/--ui-swiper-columns:\s*1/)
    expect(primaryToken).toMatch(/--ui-swiper-align:\s*start/)
    expect(primaryToken).toMatch(/--ui-swiper-gap:\s*var\(--ui-space-md\)/)
    expect(primaryToken).toMatch(/--ui-swiper-duration:\s*var\(--ui-motion-fast\)/)
    expect(primaryToken).toMatch(/--ui-swiper-easing:\s*var\(--ui-ease-standard\)/)
    expect(primaryToken).toMatch(/--ui-swiper-dot-size:\s*var\(--ui-compact-sm\)/)
    expect(primaryToken).toMatch(/--ui-swiper-dot-color-active:\s*var\(--md-sys-color-primary\)/)
  })

  it('never uses color-mix or opacity (components hold zero colour opinion; ADR-0008)', () => {
    expect(primary).not.toMatch(/color-mix\(/)
    expect(primary).not.toMatch(/opacity\s*:/)
  })

  it('@scope styles the HOST only — no leaf-tag ANATOMY (pagination/paddles/label structural rules moved out)', () => {
    // the ONE deliberate exception: a cross-tag MOTION rule gated on THIS host's :state(ready) — ready is
    // owned by ui-swiper alone, so the rule referencing it lives here, not in swiper-pagination.css
    // (checked separately below). No paddles/label reference of any kind belongs in the primary.
    expect(primaryStyles).not.toMatch(/ui-swiper-paddles/)
    expect(primaryStyles).not.toMatch(/ui-swiper-label/)
    const paginationRefs = [...primaryStyles.matchAll(/[^\n]*ui-swiper-pagination[^{]*\{/g)]
    expect(paginationRefs.length, 'only the ready-gated motion rule (+ its reduced-motion variant) may reference ui-swiper-pagination here').toBe(2)
    for (const ref of paginationRefs) expect(ref[0]).toMatch(/:state\(ready\)/)
  })

  it('@scope CONSUMES only --ui-swiper-* (+ the shared fleet tokens)', () => {
    expect(foreignRefs(primaryStyles)).toEqual([])
    const allRefs = [...primaryStyles.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => sharedFleet.has(v))).toBe(true)
    expect(allRefs.some((v) => /^--ui-swiper-/.test(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw-primitive ref is CAUGHT by the hygiene predicate', () => {
    expect(foreignRefs('@scope (ui-swiper) { :scope { color: var(--md-sys-color-primary); } }')).toEqual(['--md-sys-color-primary'])
  })

  it('the track is a grid-auto-flow column scroll container with x-mandatory snap; vertical swaps the axis', () => {
    const m = primaryStyles.match(/:scope > \[data-part='track'\]\s*\{([^}]*)\}/)
    expect(m, 'the [data-part=track] rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*grid/)
    expect(rule).toMatch(/grid-auto-flow:\s*column/)
    expect(rule).toMatch(/scroll-snap-type:\s*x mandatory/)
    expect(primaryStyles).toMatch(/:scope\[orientation='vertical'\] > \[data-part='track'\]\s*\{[^}]*grid-auto-flow:\s*row/)
    expect(primaryStyles).toMatch(/:scope\[orientation='vertical'\] > \[data-part='track'\]\s*\{[^}]*scroll-snap-type:\s*y mandatory/)
  })

  it('the live region is visually hidden (the stat.css delta-word idiom)', () => {
    const m = primaryStyles.match(/:scope > \[data-part='live'\]\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect((m as RegExpMatchArray)[1]).toMatch(/clip-path:\s*inset\(50%\)/)
  })

  it('reduced-motion zeroes the track scroll-behavior', () => {
    expect(primaryStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:scope > \[data-part='track'\]\s*\{\s*scroll-behavior:\s*auto/)
  })

  it('the cross-tag ready-gated pagination-dot motion rule lives HERE (ready is owned by ui-swiper alone)', () => {
    expect(primaryStyles).toMatch(/:scope:state\(ready\) ui-swiper-pagination \[data-part='dot'\]\s*\{\s*transition:/)
    expect(primaryStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:scope:state\(ready\) ui-swiper-pagination \[data-part='dot'\]\s*\{\s*transition:\s*none/,
    )
  })
})

// ── swiper-item.css — declares nothing; consumes the family prefix only ────────────────────────────────

const item = read('swiper-item.css')

describe('swiper-item.css — declares NOTHING of its own; consumes the family prefix only', () => {
  it('declares zero :where() tokens', () => {
    expect(declaredProps(item)).toEqual([])
  })

  it('consumes only --ui-swiper-* (+ shared fleet tokens) — no cross-control reach', () => {
    expect(foreignRefs(item)).toEqual([])
    expect(item).toMatch(/var\(--ui-swiper-align\)/)
  })

  it('sizes the slide off the track: min-inline/block-size 0 + snap-align/-stop', () => {
    const m = item.match(/:scope\s*\{([^}]*)\}/)
    expect(m, 'the :scope rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/min-inline-size:\s*0/)
    expect(rule).toMatch(/min-block-size:\s*0/)
    expect(rule).toMatch(/scroll-snap-align:\s*var\(--ui-swiper-align\)/)
    expect(rule).toMatch(/scroll-snap-stop:\s*always/)
  })
})

// ── swiper-pagination.css — declares nothing; consumes the family dot ladder ───────────────────────────

const pagination = read('swiper-pagination.css')

describe('swiper-pagination.css — declares NOTHING of its own; consumes the family dot ladder', () => {
  it('declares zero :where() tokens', () => {
    expect(declaredProps(pagination)).toEqual([])
  })

  it('consumes only --ui-swiper-* (+ shared fleet tokens) — no cross-control reach', () => {
    expect(foreignRefs(pagination)).toEqual([])
    expect(pagination).toMatch(/var\(--ui-swiper-dot-size\)/)
    expect(pagination).toMatch(/var\(--ui-swiper-dot-color-active\)/)
  })

  it('the active dot is SIZE-larger (ADR-0057, not colour-only)', () => {
    const m = pagination.match(/:scope \[data-part='dot'\]\[aria-current='true'\]\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/inline-size:\s*var\(--ui-swiper-dot-size-active\)/)
    expect(rule).toMatch(/background:\s*var\(--ui-swiper-dot-color-active\)/)
  })

  it('carries NO :state() reference of its own — ready is owned by ui-swiper, that motion rule lives in swiper.css', () => {
    expect(pagination).not.toMatch(/:state\(/)
  })

  it('forced-colors keeps the dots visible (system colours) in addition to the size signifier', () => {
    const fc = pagination.slice(pagination.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/:scope \[data-part='dot'\]\s*\{\s*background:\s*CanvasText/)
    expect(fc).toMatch(/\[aria-current='true'\]\s*\{\s*background:\s*Highlight/)
  })
})

// ── swiper-paddles.css — declares nothing; no --ui-swiper-* consumption (each ui-button owns its own geometry) ──

const paddles = read('swiper-paddles.css')

describe('swiper-paddles.css — declares NOTHING of its own; pure layout wrapper', () => {
  it('declares zero :where() tokens', () => {
    expect(declaredProps(paddles)).toEqual([])
  })

  it('the default-stamped overlay is absolutely positioned, pointer-events:none except the buttons', () => {
    const m = paddles.match(/:scope\[data-default\]\s*\{([^}]*)\}/)
    expect(m).not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/position:\s*absolute/)
    expect(rule).toMatch(/pointer-events:\s*none/)
    expect(paddles).toMatch(/:scope\[data-default\] ui-button\s*\{\s*pointer-events:\s*auto/)
  })
})

// ── swiper-label.css — declares nothing; trivial inline display ────────────────────────────────────────

const label = read('swiper-label.css')

describe('swiper-label.css — declares NOTHING of its own; trivial inline display', () => {
  it('declares zero :where() tokens and consumes none', () => {
    expect(declaredProps(label)).toEqual([])
    expect([...label.matchAll(/var\(/g)]).toEqual([])
  })

  it('is display:inline', () => {
    expect(label).toMatch(/@scope \(ui-swiper-label\)\s*\{\s*:scope\s*\{\s*display:\s*inline/)
  })
})
