import { describe, it, expect, afterEach } from 'vitest'
import { UIGameHudElement } from './game-hud.ts'
import { cleanProgress, cleanStats, formatDelta, progressProp, statsProp } from './game-hud-model.ts'

// game-hud.test.ts: jsdom probes for ui-game-hud (ADR-0243, GameHud fork sheet). jsdom cannot prove paint
// or geometry (game-hud.browser.test.ts owns that); this pins the declared behaviour: the hardening, the
// part anatomy, ARIA through internals, and the patch-in-place update that keeps the live region quiet.

class ProbeGameHud extends UIGameHudElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-game-hud-probe', ProbeGameHud)

const mounted: HTMLElement[] = []
function make(init: (el: ProbeGameHud) => void = () => {}): ProbeGameHud {
  const el = new ProbeGameHud()
  init(el)
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const q = (el: Element, sel: string): HTMLElement | null => el.querySelector(sel)
const all = (el: Element, sel: string): HTMLElement[] => Array.from(el.querySelectorAll(sel))
const statTexts = (el: Element): string[][] =>
  all(el, '[data-part="stat"]').map((s) => Array.from(s.children).map((c) => `${(c as HTMLElement).dataset.part}:${c.textContent}`))

describe('UIGameHudElement: anatomy', () => {
  it('empty stats renders title and status only', () => {
    const el = make((h) => {
      h.title = 'Table 4'
      h.status = 'Your turn'
    })
    expect(Array.from(el.children).map((c) => (c as HTMLElement).dataset.part)).toEqual(['header'])
    expect(q(el, '[data-part="title"]')?.textContent).toBe('Table 4')
    expect(q(el, '[data-part="status"]')).not.toBeNull()
    expect(q(el, '[data-part="stats"]')).toBeNull()
    expect(q(el, '[data-part="progress"]')).toBeNull()
  })

  it('renders nothing at all when title, status, stats and progress are empty', () => {
    const el = make()
    expect(el.children.length).toBe(0)
  })

  it('renders one stat part per entry with label, value and delta', () => {
    const el = make((h) => {
      h.stats = [
        { label: 'Chips', value: 1240, delta: 60 },
        { label: 'Bet', value: 50 },
        { label: 'Shoe', value: '3.1' },
      ]
    })
    expect(statTexts(el)).toEqual([
      ['label:Chips', `value:${new Intl.NumberFormat().format(1240)}`, 'delta:+60'],
      ['label:Bet', 'value:50'],
      ['label:Shoe', 'value:3.1'],
    ])
  })

  it('deltas are signed: numbers and numeric strings get a sign, other strings pass through', () => {
    expect(formatDelta(60)).toBe('+60')
    expect(formatDelta(-12)).toBe('-12')
    expect(formatDelta(0)).toBe('0')
    expect(formatDelta('  7 ')).toBe('+7')
    expect(formatDelta('-3')).toBe('-3')
    expect(formatDelta('x2')).toBe('x2')
    expect(formatDelta('   ')).toBeNull()
    expect(formatDelta(Number.NaN)).toBeNull()
    expect(formatDelta(null)).toBeNull()
    const el = make((h) => {
      h.stats = [{ label: 'Gold', value: 48, delta: -12 }, { label: 'Streak', value: 3, delta: 'x2' }]
    })
    expect(all(el, '[data-part="delta"]').map((d) => d.textContent)).toEqual(['-12', 'x2'])
  })

  it('keeps at most 6 stats and drops malformed entries', () => {
    const raw = [
      null,
      'nope',
      [1, 2],
      { label: '', value: Number.NaN },
      ...Array.from({ length: 8 }, (_, i) => ({ label: `S${i}`, value: i })),
    ]
    expect(cleanStats(raw).map((s) => s.label)).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'S5'])
    expect(cleanStats({ label: 'not an array' })).toEqual([])
    expect(cleanStats([{ label: 5, value: Infinity }])).toEqual([{ label: '5', value: '' }])
    const el = make((h) => {
      h.stats = raw as never
    })
    expect(all(el, '[data-part="stat"]')).toHaveLength(6)
  })

  it('an out-of-set intent is dropped; a stat intent renders a glyph part and data-intent', () => {
    const el = make((h) => {
      h.stats = [
        { label: 'Chips', value: 1, intent: 'success' },
        { label: 'Bet', value: 2, intent: 'bogus' },
        { label: 'Shoe', value: 3, intent: 'neutral' },
      ]
    })
    const [a, b, c] = all(el, '[data-part="stat"]')
    expect(a!.dataset.intent).toBe('success')
    const glyph = a!.firstElementChild as HTMLElement & { symbol: string; label: string }
    expect(glyph.dataset.part).toBe('glyph')
    expect(glyph.localName, 'the stat mark is a ui-glyph (T-0351)').toBe('ui-glyph')
    expect(glyph.symbol, 'the shared intent table: success is check').toBe('check')
    expect(glyph.label, 'decorative: ui-glyph hides itself through ElementInternals').toBe('')
    expect(glyph.hasAttribute('aria-hidden'), 'no ARIA host attribute').toBe(false)
    for (const s of [b!, c!]) {
      expect(s.hasAttribute('data-intent')).toBe(false)
      expect(q(s, '[data-part="glyph"]')).toBeNull()
    }
  })

  it('status renders as a ui-badge carrying statusIntent', async () => {
    const el = make((h) => {
      h.status = 'Wounded'
      h.statusIntent = 'warning'
    })
    const badge = q(el, '[data-part="status"]') as HTMLElement & { label: string; intent: string }
    expect(badge.localName).toBe('ui-badge')
    expect(badge.label).toBe('Wounded')
    expect(badge.intent).toBe('warning')
    ;(el as unknown as { statusIntent: string }).statusIntent = 'bogus'
    await el.updateComplete
    expect(badge.intent).toBe('neutral')
  })

  it('progress renders a progressbar part with label, value and max', () => {
    const el = make((h) => {
      h.progress = { value: 4, max: 10, label: 'Round' }
    })
    const bar = q(el, '[data-part="progress"]')!
    expect(bar.getAttribute('role')).toBe('progressbar')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('10')
    expect(bar.getAttribute('aria-valuenow')).toBe('4')
    expect(bar.getAttribute('aria-label')).toBe('Round')
    expect(q(bar, '[data-part="progress-text"]')?.textContent).toBe('Round 4 / 10')
    expect(q(bar, '[data-part="progress-fill"]')?.style.getPropertyValue('--_fill')).toBe('0.4')
    expect(cleanProgress({ value: 99, max: 24 })).toEqual({ value: 24, max: 24, label: '' })
    expect(cleanProgress({ value: -3, max: 24 })).toEqual({ value: 0, max: 24, label: '' })
  })

  it('a non-positive max renders no progress part', () => {
    for (const max of [0, -5, Number.NaN, '10']) {
      expect(cleanProgress({ value: 1, max })).toBeNull()
      const el = make((h) => {
        h.progress = { value: 1, max }
      })
      expect(q(el, '[data-part="progress"]')).toBeNull()
    }
  })

  it('places parts in DOM order: header, progress, stats', () => {
    const el = make((h) => {
      h.stats = [{ label: 'Score', value: 30 }]
    })
    el.progress = { value: 1, max: 2 }
    el.title = 'Science round'
    return el.updateComplete.then(() => {
      expect(Array.from(el.children).map((c) => (c as HTMLElement).dataset.part)).toEqual(['header', 'progress', 'stats'])
    })
  })
})

describe('UIGameHudElement: ARIA and attributes', () => {
  it('role group, aria-label and the polite live region come from internals, never host attributes', async () => {
    const el = make()
    expect(el.probeInternals.role).toBe('group')
    expect(el.probeInternals.ariaLive).toBe('polite')
    expect(el.probeInternals.ariaLabel).toBe('Game status')
    el.title = '  Science round  '
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Science round')
    el.title = '   '
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Game status')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('tabindex')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
  })

  it('the hud-title attribute sets title and the host never gets a title attribute', async () => {
    const el = make()
    el.setAttribute('hud-title', 'The Undervault')
    await el.updateComplete
    expect(el.title).toBe('The Undervault')
    expect(q(el, '[data-part="title"]')?.textContent).toBe('The Undervault')
    el.title = 'Room 3'
    await el.updateComplete
    expect(el.hasAttribute('title')).toBe(false)
    el.setAttribute('title', 'native tooltip')
    await el.updateComplete
    expect(el.title).toBe('Room 3')
  })

  it('the stats and progress codecs parse attributes and never throw on malformed JSON', () => {
    expect(statsProp.type.from(null)).toEqual([])
    expect(statsProp.type.from('{not json')).toEqual([])
    expect(statsProp.type.from('[{"label":"Bet","value":50}]')).toEqual([{ label: 'Bet', value: '50' }])
    expect(progressProp.type.from(null)).toBeNull()
    expect(cleanProgress(progressProp.type.from('{not json'))).toBeNull()
    expect(progressProp.type.from('{"value":9,"max":24,"label":"HP"}')).toEqual({ value: 9, max: 24, label: 'HP' })
    const el = make()
    el.setAttribute('stats', '[{"label":"Gold","value":48,"delta":-12,"intent":"danger"}]')
    expect(statTexts(el)).toEqual([])
    return el.updateComplete.then(() => {
      expect(statTexts(el)).toEqual([['glyph:', 'label:Gold', 'value:48', 'delta:-12']])
    })
  })
})

describe('UIGameHudElement: in-place updates', () => {
  it('a stats update patches text in place and keeps the same stat elements', async () => {
    const el = make((h) => {
      h.stats = [
        { label: 'Chips', value: 1240, delta: 60, intent: 'success' },
        { label: 'Bet', value: 50 },
      ]
    })
    const before = all(el, '[data-part="stat"]')
    const beforeLabel = q(before[0]!, '[data-part="label"]')
    const beforeValue = q(before[0]!, '[data-part="value"]')
    const betValueText = q(before[1]!, '[data-part="value"]')!.firstChild
    const stats = q(el, '[data-part="stats"]')

    el.stats = [
      { label: 'Chips', value: 1300, delta: 60, intent: 'success' },
      { label: 'Bet', value: 50 },
    ]
    await el.updateComplete

    const after = all(el, '[data-part="stat"]')
    expect(after).toEqual(before)
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(q(el, '[data-part="stats"]')).toBe(stats)
    expect(q(after[0]!, '[data-part="label"]')).toBe(beforeLabel)
    expect(q(after[0]!, '[data-part="value"]')).toBe(beforeValue)
    expect(beforeValue!.textContent).toBe(new Intl.NumberFormat().format(1300))
    // an unchanged readout is not rewritten, so its text node survives
    expect(q(after[1]!, '[data-part="value"]')!.firstChild).toBe(betValueText)

    el.stats = [{ label: 'Chips', value: 1300 }]
    await el.updateComplete
    expect(all(el, '[data-part="stat"]')).toEqual([before[0]])
    expect(q(before[0]!, '[data-part="glyph"]')).toBeNull()
    expect(q(before[0]!, '[data-part="delta"]')).toBeNull()
    expect(before[0]!.hasAttribute('data-intent')).toBe(false)
  })
})
