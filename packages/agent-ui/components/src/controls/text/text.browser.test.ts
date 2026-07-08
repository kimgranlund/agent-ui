import { describe, it, expect } from 'vitest'
import { server, cdp } from 'vitest/browser'
import type { UITextElement } from './text.ts'

// ADR-0078 — ui-text cross-engine browser smoke. jsdom computes no real font metrics and can't prove
// zero-geometry-delta layout, so the REAL proofs live here: the role×size matrix resolves to distinct
// computed font-sizes, `[scale]` re-multiplies them, the `as` stamp changes semantics with NO layout
// delta, and the stamping mechanism (parser streaming / textContent clobber) self-heals in a real engine.
// Runs in BOTH Chromium and WebKit via vitest.browser.config.ts → playwright instances.
//
// CSS wiring is SELF-CONTAINED: foundation-styles (the --md-sys-color-* roles + the --md-sys-typescale-*
// ramp from dimensions.css) then component-styles (text.css), then the self-defining module.
import '@agent-ui/components/foundation-styles.css' // the --md-sys-color-* roles + the --md-sys-typescale-* type scale
import '@agent-ui/components/component-styles.css' // includes text.css (added to the barrel)
import '@agent-ui/components/components' // self-defines ui-text + the whole family

/** A CDP session for Chromium-only emulation probes. */
type CdpSession = { send(method: string, params?: object): Promise<unknown> }

/** Wait one microtask tick — long enough for a MutationObserver callback queued earlier to run (FIFO). */
const tick = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

describe('ui-text browser-truth harness — the role×size matrix resolves to real px (ADR-0078)', () => {
  it('body/md (the bare default) resolves to 14px — the fully-M3-canonical size (ADR-0078 knob ①)', () => {
    const el = document.createElement('ui-text')
    el.textContent = 'Body text'
    document.body.append(el)
    const fontSize = getComputedStyle(el).fontSize
    expect(fontSize).toMatch(/px$/)
    expect(Number.parseFloat(fontSize)).toBeCloseTo(14, 0)
    el.remove()
  })

  it('display/sm → 36px · title/lg → 22px · body/md → 14px (the ADR-named computed samples)', () => {
    const cases: Array<[string, string, number]> = [
      ['display', 'sm', 36],
      ['title', 'lg', 22],
      ['body', 'md', 14],
    ]
    for (const [variant, size, px] of cases) {
      const el = document.createElement('ui-text')
      el.setAttribute('variant', variant)
      el.setAttribute('size', size)
      el.textContent = `${variant}/${size}`
      document.body.append(el)
      expect(Number.parseFloat(getComputedStyle(el).fontSize), `${variant}/${size}`).toBeCloseTo(px, 0)
      el.remove()
    }
  })

  it('the 9 variants at size=md produce distinct computed font-sizes (the matrix is genuinely live)', () => {
    const variants = ['display', 'headline', 'title', 'body', 'label', 'kicker', 'overline', 'quote', 'lead'] as const
    const sizes = new Set<number>()
    for (const v of variants) {
      const el = document.createElement('ui-text')
      el.setAttribute('variant', v)
      el.textContent = v
      document.body.append(el)
      sizes.add(Number.parseFloat(getComputedStyle(el).fontSize))
      el.remove()
    }
    // Two groups collapse by DESIGN (cl.2b): quote ≡ lead (18px, "own tokens, changeable independently")
    // and label/kicker/overline all borrow the M3 label-medium size (12px — kicker/overline are label
    // metrics emboldened/tracked, not resized). So 9 variants land on exactly 6 distinct sizes: display
    // 45 · headline 28 · title 16 · body 14 · {label,kicker,overline} 12 · {quote,lead} 18.
    expect(sizes.size).toBe(6)
  })

  it('size=sm/lg repoint within ONE role produce a strictly ascending triple (sm < md < lg)', () => {
    const px = (size: string): number => {
      const el = document.createElement('ui-text')
      el.setAttribute('variant', 'headline')
      el.setAttribute('size', size)
      el.textContent = size
      document.body.append(el)
      const v = Number.parseFloat(getComputedStyle(el).fontSize)
      el.remove()
      return v
    }
    const sm = px('sm')
    const md = px('md')
    const lg = px('lg')
    expect(sm).toBeLessThan(md)
    expect(md).toBeLessThan(lg)
  })

  it("a bare <ui-text size='lg'> (no [variant]) hits the body/large row — the absent-variant law", () => {
    const el = document.createElement('ui-text')
    el.setAttribute('size', 'lg')
    el.textContent = 'no variant'
    document.body.append(el)
    // body-large = 16px (vs. body-medium's 14px) — proves the :not([variant]) compound selector is live
    expect(Number.parseFloat(getComputedStyle(el).fontSize)).toBeCloseTo(16, 0)
    el.remove()
  })
})

// ── [scale] subtree re-multiplication (the `*` ramp pre-substitution law, ADR-0078 cl.2 / dimensions.css) ──

describe('ui-text subtree-[scale] — --md-sys-typescale-*-size re-multiplies for a scaled ancestor', () => {
  it('display/lg under [scale=content-lg] resolves to 99.75px (57px × 1.75 — the * pre-substitution law)', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('scale', 'content-lg') // --ui-scale → 1.75
    document.body.append(wrap)

    const el = document.createElement('ui-text')
    el.setAttribute('variant', 'display')
    el.setAttribute('size', 'lg')
    el.textContent = 'Scaled display'
    wrap.append(el)

    expect(Number.parseFloat(getComputedStyle(el).fontSize)).toBeCloseTo(99.75, 0)
    wrap.remove()
  })

  it('the scaled font-size differs from the unscaled baseline (anti-vacuous: the ramp is live)', () => {
    const unscaled = document.createElement('ui-text')
    unscaled.setAttribute('variant', 'headline')
    unscaled.textContent = 'baseline'
    document.body.append(unscaled)
    const basePx = Number.parseFloat(getComputedStyle(unscaled).fontSize)
    unscaled.remove()

    const wrap = document.createElement('div')
    wrap.setAttribute('scale', 'ui-sm') // --ui-scale → 0.875 (a SMALLER multiplier for clear contrast)
    document.body.append(wrap)
    const scaled = document.createElement('ui-text')
    scaled.setAttribute('variant', 'headline')
    scaled.textContent = 'ui-sm'
    wrap.append(scaled)
    const compactPx = Number.parseFloat(getComputedStyle(scaled).fontSize)
    wrap.remove()

    expect(compactPx).toBeLessThan(basePx)
    expect(compactPx).toBeCloseTo(basePx * 0.875, 0)
  })
})

// ── Stamping (`as`) — real-element creation, node identity, unwrap, self-heal (ADR-0078 cl.4) ──────────

describe('ui-text stamping — create / re-stamp / unwrap, node identity preserved', () => {
  it('as="h4" stamps a REAL <h4> in the light DOM (real-heading exposure)', () => {
    const el = document.createElement('ui-text')
    el.setAttribute('as', 'h4')
    el.textContent = 'A real heading'
    document.body.append(el)
    const h4 = el.querySelector('h4')
    expect(h4).not.toBeNull()
    expect(h4?.tagName).toBe('H4')
    expect(h4?.textContent).toBe('A real heading')
    el.remove()
  })

  it('as change (h4 → span) moves the SAME text node into the new stamp — never a clone', async () => {
    const el = document.createElement('ui-text')
    el.setAttribute('as', 'h4')
    el.textContent = 'Content'
    document.body.append(el)
    const textNode = el.querySelector('h4')?.firstChild
    el.setAttribute('as', 'span')
    await (el as UITextElement).updateComplete
    const span = el.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.firstChild).toBe(textNode)
    el.remove()
  })

  it('as="none" unwraps — no stamp element remains, content returns to the host', async () => {
    const el = document.createElement('ui-text')
    el.setAttribute('as', 'h4')
    el.textContent = 'Unwrap me'
    document.body.append(el)
    el.setAttribute('as', 'none')
    await (el as UITextElement).updateComplete
    expect(el.querySelector('h4')).toBeNull()
    expect(el.childElementCount).toBe(0)
    expect(el.textContent).toBe('Unwrap me')
    el.remove()
  })
})

describe('ui-text stamping — parser-streamed adoption + textContent-clobber self-heal', () => {
  it('parser-streamed: children appended to the host AFTER connect are adopted into the stamp', async () => {
    const el = document.createElement('ui-text')
    el.setAttribute('as', 'h4') // connects with NO children — mirrors an in-flight HTML-parser upgrade
    document.body.append(el)
    expect(el.querySelector('h4')).not.toBeNull() // the stamp already exists, empty

    el.appendChild(document.createTextNode('Streamed content')) // lands on the host, not the stamp
    await tick()
    await tick()
    expect(el.querySelector('h4')?.textContent).toBe('Streamed content')
    expect(el.childElementCount).toBe(1)
    el.remove()
  })

  it('textContent clobber (the A2UI bound-text path): a fresh stamp re-wraps the new text within a microtask', async () => {
    const el = document.createElement('ui-text')
    el.setAttribute('as', 'h4')
    el.textContent = 'Original bound text'
    document.body.append(el)
    const before = el.querySelector('h4')
    expect(before?.textContent).toBe('Original bound text')

    el.textContent = 'Updated bound text' // destroys ALL children, stamp included
    await tick()
    await tick()
    const after = el.querySelector('h4')
    expect(after).not.toBeNull()
    expect(after).not.toBe(before) // a fresh stamp — the stale one is never reused
    expect(after?.textContent).toBe('Updated bound text')
    expect(el.childElementCount).toBe(1)
    el.remove()
  })
})

// ── Zero geometry delta (cl.4) — the stamp is visually transparent: same rendered box with vs without it ──

describe('ui-text stamping — zero geometry delta (cl.4: as changes semantics, never layout)', () => {
  it('a stamped <p> renders the SAME bounding box as the unstamped host, for identical content', () => {
    const container = document.createElement('div')
    container.style.width = '300px'
    document.body.append(container)

    const plain = document.createElement('ui-text')
    plain.textContent = 'Identical content for a geometry comparison'
    container.append(plain)
    const plainBox = plain.getBoundingClientRect()

    const stamped = document.createElement('ui-text')
    stamped.setAttribute('as', 'p')
    stamped.textContent = 'Identical content for a geometry comparison'
    container.append(stamped)
    const stampedBox = stamped.getBoundingClientRect()

    expect(stampedBox.width).toBeCloseTo(plainBox.width, 0)
    expect(stampedBox.height).toBeCloseTo(plainBox.height, 0)
    container.remove()
  })
})

// ── Editorial treatments (cl.2b) — uppercase / italic + rule + indent ─────────────────────────────────

describe('ui-text editorial treatments — kicker/overline uppercase, quote italic + rule + indent', () => {
  it('kicker and overline compute text-transform: uppercase', () => {
    for (const variant of ['kicker', 'overline']) {
      const el = document.createElement('ui-text')
      el.setAttribute('variant', variant)
      el.textContent = 'eyebrow'
      document.body.append(el)
      expect(getComputedStyle(el).textTransform, variant).toBe('uppercase')
      el.remove()
    }
  })

  it('quote computes font-style: italic and a non-zero inline-start border + padding', () => {
    const el = document.createElement('ui-text')
    el.setAttribute('variant', 'quote')
    el.textContent = 'A block quotation'
    document.body.append(el)
    const cs = getComputedStyle(el)
    expect(cs.fontStyle).toBe('italic')
    expect(Number.parseFloat(cs.borderInlineStartWidth || cs.borderLeftWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(cs.paddingInlineStart || cs.paddingLeft)).toBeGreaterThan(0)
    el.remove()
  })
})

// ── forced-colors (ADR-0078 cl.3 / text.css forced-colors block) ───────────────────────────────────────

// ── truncate (ADR-0106) — CSS-only single-line ellipsis + the unconditional title mirror ─────────────────

describe('ui-text truncate — clipped single line + ellipsis (ADR-0106)', () => {
  it('a 12rem box with long content clips to one line — clientWidth < scrollWidth, computed text-overflow: ellipsis', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.truncate = true
    el.style.display = 'block' // ui-text already computes display:block; explicit for the inline style write below
    el.style.width = '12rem'
    el.textContent = 'A title long enough that it will not fit in twelve rem of width at all'
    document.body.append(el)

    const cs = getComputedStyle(el)
    expect(cs.whiteSpace).toBe('nowrap')
    expect(cs.overflow).toBe('hidden')
    expect(cs.textOverflow).toBe('ellipsis')
    expect(el.scrollWidth, 'content did not actually overflow the box — the fixture is not long enough').toBeGreaterThan(el.clientWidth)
    el.remove()
  })

  it('title mirrors the full untruncated text — present even in a box wide enough that nothing clips', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.truncate = true
    el.style.width = '40rem' // comfortably wider than the content — nothing is actually clipped
    el.textContent = 'Short title'
    document.body.append(el)

    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1) // anti-vacuous: genuinely NOT clipped
    expect(el.getAttribute('title')).toBe('Short title') // the unconditional mirror — present regardless
    el.remove()
  })

  it('toggling `as` (none ↔ h4) under truncation keeps the rendered box identical (cl.4 invariant extends)', async () => {
    const container = document.createElement('div')
    container.style.width = '12rem'
    document.body.append(container)

    const plain = document.createElement('ui-text') as UITextElement
    plain.truncate = true
    plain.textContent = 'A title long enough to clip under twelve rem'
    container.append(plain)
    const plainBox = plain.getBoundingClientRect()

    const stamped = document.createElement('ui-text') as UITextElement
    stamped.truncate = true
    stamped.setAttribute('as', 'h4')
    stamped.textContent = 'A title long enough to clip under twelve rem'
    container.append(stamped)
    await stamped.updateComplete
    const stampedBox = stamped.getBoundingClientRect()

    expect(stampedBox.width).toBeCloseTo(plainBox.width, 0)
    expect(stampedBox.height).toBeCloseTo(plainBox.height, 0)
    container.remove()
  })

  it('an author-set title attribute survives truncation (never overwritten by the mirror)', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.setAttribute('title', 'A curated tooltip')
    el.textContent = 'A title long enough to clip under a narrow box'
    document.body.append(el)
    el.truncate = true
    expect(el.getAttribute('title')).toBe('A curated tooltip')
    el.remove()
  })

  it('POSITIVE control: a stamped as="h4" under truncate computes ellipsis/hidden on the h4 ITSELF (the stamp leg is live)', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.truncate = true
    el.setAttribute('as', 'h4')
    el.textContent = 'Section'
    document.body.append(el)
    await el.updateComplete
    const h4 = el.querySelector('h4')!
    expect(getComputedStyle(h4).overflow).toBe('hidden')
    expect(getComputedStyle(h4).textOverflow).toBe('ellipsis')
    el.remove()
  })

  it('NEGATIVE: neutralizing the stamp leg (`:scope[truncate] > :is(...)`) FAILS the as="h4" truncation leg — proves it is load-bearing', async () => {
    // Force the SAME specificity fight the ADR's negative control describes without editing the shipped
    // stylesheet: an ID-scoped override on the STAMPED h4 itself that cancels exactly what the stamp leg
    // supplies (overflow/text-overflow). `white-space: nowrap` (the host leg, inherited) is untouched — if
    // the second leg carried no unique information, this override would be redundant and change nothing;
    // it does, because overflow/text-overflow are NOT inherited properties — only the stamp leg supplies
    // them on the h4 itself.
    const style = document.createElement('style')
    style.textContent = '#truncate-negative-h4 { overflow: visible !important; text-overflow: clip !important; }'
    document.head.append(style)

    const el = document.createElement('ui-text') as UITextElement
    el.truncate = true
    el.setAttribute('as', 'h4')
    el.textContent = 'Section'
    document.body.append(el)
    await el.updateComplete
    el.querySelector('h4')!.id = 'truncate-negative-h4' // target the STAMP element itself, not the host

    const h4 = el.querySelector('h4')!
    expect(getComputedStyle(h4).textOverflow, 'ellipsis still won — the stamp leg is not the sole source (negative control is vacuous)').toBe('clip')
    expect(getComputedStyle(h4).overflow).toBe('visible')

    style.remove()
    el.remove()
  })
})

// ── emphasis (ADR-0109) — CSS-only weight intent, one token-block repoint declared last ─────────────────

describe('ui-text emphasis — computes font-weight: 700, the platform bold register (ADR-0109)', () => {
  it('an [emphasis] host computes font-weight: 700', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.emphasis = true
    el.textContent = 'Bolded'
    document.body.append(el)
    expect(getComputedStyle(el).fontWeight).toBe('700')
    el.remove()
  })

  it('without emphasis, computes its variant weight — pinning the reset against UA bold (the inheritance leg, negative half)', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.textContent = 'Not bolded'
    document.body.append(el)
    expect(getComputedStyle(el).fontWeight).toBe('400') // body-medium's weight, not UA-bold 700
    el.remove()
  })

  it('the inheritance leg: as="h4" + emphasis → the stamped <h4> computes 700 (font-weight inherits through the stamp)', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.setAttribute('as', 'h4')
    el.emphasis = true
    el.textContent = 'Emphasized heading'
    document.body.append(el)
    await el.updateComplete
    const h4 = el.querySelector('h4')!
    expect(getComputedStyle(h4).fontWeight).toBe('700')
    el.remove()
  })

  it('the inheritance leg, negative half: as="h4" WITHOUT emphasis computes its variant weight, not UA-bold 700', async () => {
    const el = document.createElement('ui-text') as UITextElement
    el.setAttribute('as', 'h4')
    el.textContent = 'Plain heading'
    document.body.append(el)
    await el.updateComplete
    const h4 = el.querySelector('h4')!
    // The stamp-transparency reset (`font: inherit`) normalizes the UA's own <h4> bold — this pins that
    // reset still holds now that emphasis exists as a sibling axis.
    expect(getComputedStyle(h4).fontWeight).toBe('400')
    el.remove()
  })

  it('the cascade-order leg: variant="label" size="lg" + emphasis computes 700, not label-large\'s own 500', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.setAttribute('variant', 'label')
    el.setAttribute('size', 'lg')
    el.textContent = 'Emphasized label'
    document.body.append(el)
    const baselineWeight = getComputedStyle(el).fontWeight
    expect(baselineWeight).toBe('500') // label-large's own weight, unemphasized — anti-vacuous baseline

    el.emphasis = true
    expect(getComputedStyle(el).fontWeight).toBe('700') // emphasis beats the [variant][size] override block
    el.remove()
  })

  it('the no-op leg: kicker + emphasis stays 700 (kicker is already the bold register)', () => {
    const el = document.createElement('ui-text') as UITextElement
    el.setAttribute('variant', 'kicker')
    el.textContent = 'KICKER'
    document.body.append(el)
    expect(getComputedStyle(el).fontWeight).toBe('700') // kicker's own weight, unemphasized

    el.emphasis = true
    expect(getComputedStyle(el).fontWeight).toBe('700') // unchanged — an honest no-op
    el.remove()
  })

  it('specificity precedence: a page-author ID + !important override beats the :where() [emphasis] repoint', () => {
    // Review-relabelled (was "NEGATIVE ... proves the one line is load-bearing" — a false claim: this leg
    // passes identically with the [emphasis] line deleted, since the un-repointed host also computes 400).
    // What it DOES prove: the repoint rides specificity-0 `:where()`, so any real page selector can
    // override it — the ADR-0102 escape-hatch posture. The genuine load-bearing differential for the
    // [emphasis] line is the positive 700 leg + the without-emphasis 400 baseline above: delete the line
    // and THAT pair flips.
    const style = document.createElement('style')
    style.textContent = '#emphasis-negative { --ui-text-weight: 400 !important; }'
    document.head.append(style)

    const el = document.createElement('ui-text') as UITextElement
    el.id = 'emphasis-negative'
    el.emphasis = true
    el.textContent = 'Neutralized'
    document.body.append(el)
    expect(getComputedStyle(el).fontWeight, 'the page-author override lost — [emphasis] must stay specificity-0 overridable').toBe('400')

    style.remove()
    el.remove()
  })
})

describe('ui-text forced-colors — CanvasText mapping keeps display text visible', () => {
  it('forced-colors @media block keeps display text visible — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = document.createElement('ui-text')
    el.textContent = 'High-contrast visible text'
    document.body.append(el)

    const alphaOf = (color: string): number => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color)
      if (m) return m[4] !== undefined ? Number(m[4]) : 1
      return color !== '' && color !== 'transparent' ? 1 : 0
    }
    expect(alphaOf(getComputedStyle(el).color), 'baseline text colour is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      el.remove()
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(el).color), 'display text colour vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }

    el.remove()
  })
})
