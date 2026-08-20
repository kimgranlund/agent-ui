import { describe, it, expect, afterEach } from 'vitest'
import { UIPlayingCardElement } from './playing-card.ts'
import { pipsFor, isLetterRank, PIP_RANKS, LETTER_RANKS } from './playing-card-pips.ts'

// playing-card.test.ts — jsdom behaviour probes (ADR-0225, GH #1478). jsdom is blind to painted
// geometry/transform/contrast — the aspect-ratio ramp, ink-contrast, rotated-index, pip-gestalt-bounding-
// box, flip-transition, and reduced-motion proofs live in playing-card.browser.test.ts. This file covers:
// n-pips-table (the per-rank pip layout table, table-driven), n-host (typed props/reflection, internals
// role/label incl. the no-leak-while-faceDown branch, ready-state gate), and DOM shape (flipper/face/
// back parts always present, index text, pip/letter node counts).

// A throwaway subclass re-exposing the protected `internals` (the pie-chart/bar-chart precedent).
class ProbePlayingCard extends UIPlayingCardElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-playing-card-probe', ProbePlayingCard)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// ── n-pips-table — the per-rank pip layout table (accept: pip count per rank === the rank's numeric
//    value for A,2..10; J/Q/K take the letter treatment, no pip grid) ──────────────────────────────────

describe('playing-card-pips.ts — pipsFor(rank) table-driven truth', () => {
  const EXPECTED_COUNT: Record<string, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 }

  it('anti-vacuous: the pip-rank and letter-rank sets are non-empty and disjoint', () => {
    expect(PIP_RANKS.length).toBe(10)
    expect(LETTER_RANKS.length).toBe(3)
    for (const r of PIP_RANKS) expect(LETTER_RANKS as readonly string[]).not.toContain(r)
  })

  for (const rank of PIP_RANKS) {
    it(`rank "${rank}" renders exactly ${EXPECTED_COUNT[rank]} pip(s) (its own numeric value)`, () => {
      expect(pipsFor(rank)).toHaveLength(EXPECTED_COUNT[rank])
    })
  }

  it('J, Q, K take the letter treatment — pipsFor returns [] (no pip grid)', () => {
    for (const rank of LETTER_RANKS) {
      expect(isLetterRank(rank)).toBe(true)
      expect(pipsFor(rank)).toEqual([])
    }
  })

  it('the "" blank face has no pips and is not a letter rank', () => {
    expect(pipsFor('')).toEqual([])
    expect(isLetterRank('')).toBe(false)
  })

  it('every pip position is inside the 3-column × 5-row grid, and `rotated` derives from row > center (2)', () => {
    for (const rank of PIP_RANKS) {
      for (const pos of pipsFor(rank)) {
        expect(pos.col).toBeGreaterThanOrEqual(0)
        expect(pos.col).toBeLessThanOrEqual(2)
        expect(pos.row).toBeGreaterThanOrEqual(0)
        expect(pos.row).toBeLessThanOrEqual(4)
        expect(pos.rotated).toBe(pos.row > 2)
      }
    }
  })

  it('rank 7 is the deliberate real-deck asymmetry — its center pip (row 1) has no row-3 partner', () => {
    const seven = pipsFor('7')
    expect(seven.some((p) => p.col === 1 && p.row === 1)).toBe(true)
    expect(seven.some((p) => p.col === 1 && p.row === 3)).toBe(false)
  })
})

// ── n-host — typed props + reflection, internals a11y (role/label incl. the no-leak branch), ready-state,
//    and the always-both-faces DOM shape ────────────────────────────────────────────────────────────────

describe('UIPlayingCardElement — upgrade + typed props', () => {
  it('upgrades to the class; rank/suit default to "", faceDown defaults to false, size defaults to md', () => {
    const el = document.createElement('ui-playing-card') as UIPlayingCardElement
    expect(el).toBeInstanceOf(UIPlayingCardElement)
    expect(el.rank).toBe('')
    expect(el.suit).toBe('')
    expect(el.faceDown).toBe(false)
    expect(el.size).toBe('md')
  })

  it('self-defines as ui-playing-card, guarded against double-define', () => {
    expect(customElements.get('ui-playing-card')).toBe(UIPlayingCardElement)
    expect(() => {
      if (!customElements.get('ui-playing-card')) customElements.define('ui-playing-card', UIPlayingCardElement)
    }).not.toThrow()
  })

  it('rank/suit/size attributes reflect (CSS keys off the live attribute)', () => {
    const el = document.createElement('ui-playing-card') as UIPlayingCardElement
    el.rank = 'K'
    el.suit = 'spades'
    el.size = 'lg'
    expect(el.getAttribute('rank')).toBe('K')
    expect(el.getAttribute('suit')).toBe('spades')
    expect(el.getAttribute('size')).toBe('lg')
  })

  it('faceDown reflects to the kebab `face-down` attribute (boolean presence semantics)', () => {
    const el = document.createElement('ui-playing-card') as UIPlayingCardElement
    el.faceDown = true
    expect(el.hasAttribute('face-down')).toBe(true)
    el.faceDown = false
    expect(el.hasAttribute('face-down')).toBe(false)
  })

  it('an unknown rank/suit/size attribute snaps back to enumType\'s fallback (the codec\'s FIRST declared member — never the config `default`, the pie-chart `variant` precedent; rank/suit\'s first member IS their default, "")', () => {
    const el = document.createElement('ui-playing-card') as UIPlayingCardElement
    el.setAttribute('rank', 'bogus')
    el.setAttribute('suit', 'bogus')
    el.setAttribute('size', 'bogus')
    mount(el)
    expect(el.rank).toBe('') // values[0] === '' === the declared default
    expect(el.suit).toBe('') // values[0] === '' === the declared default
    expect(el.size).toBe('sm') // values[0] === 'sm' (NOT the declared default 'md') — enumType.from's own documented fallback shape
  })
})

describe('UIPlayingCardElement — a11y (internals.role + the derived accessible name)', () => {
  it('role = img via ElementInternals (never a host attribute)', () => {
    const el = mount(document.createElement('ui-playing-card-probe')) as ProbePlayingCard
    expect(el.probeInternals.role).toBe('img')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('face-up with rank+suit: the label reads "<Rank name> of <suit>"', async () => {
    const el = mount(document.createElement('ui-playing-card-probe')) as ProbePlayingCard
    el.rank = 'A'
    el.suit = 'spades'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Ace of spades')

    el.rank = '10'
    el.suit = 'hearts'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('10 of hearts')

    el.rank = 'K'
    el.suit = 'diamonds'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('King of diamonds')
  })

  it('blank rank or suit ("") yields an unset (null) label — a legally unlabeled img, never an empty string', async () => {
    const el = mount(document.createElement('ui-playing-card-probe')) as ProbePlayingCard
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.suit = 'spades' // rank still ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })

  it('face-down: the label is the CONSTANT "Face-down card" and NEVER leaks rank/suit, even when both are set', async () => {
    const el = mount(document.createElement('ui-playing-card-probe')) as ProbePlayingCard
    el.rank = 'A'
    el.suit = 'spades'
    el.faceDown = true
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Face-down card')
    // un-flipping restores the real label — proves the branch is reactive, not a one-shot snapshot
    el.faceDown = false
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Ace of spades')
  })
})

describe('UIPlayingCardElement — DOM shape (component-built, both faces always present)', () => {
  it('renders flipper > (face + back); face holds two index nodes + a pips node', () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    const flipper = el.querySelector("[data-part='flipper']")
    expect(flipper).not.toBeNull()
    expect(flipper?.querySelector("[data-part='face']")).not.toBeNull()
    expect(flipper?.querySelector("[data-part='back']")).not.toBeNull()
    expect(el.querySelectorAll("[data-part='index']")).toHaveLength(2)
    expect(el.querySelector("[data-part='pips']")).not.toBeNull()
  })

  it('BOTH faces stay in the DOM when faceDown is true — a real flip needs both painted (ADR-0225 cl.6)', () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    el.faceDown = true
    expect(el.querySelector("[data-part='face']")).not.toBeNull()
    expect(el.querySelector("[data-part='back']")).not.toBeNull()
  })

  it('the top-left index is upright (no data-inverted); the bottom-right twin carries data-inverted', () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    const indices = el.querySelectorAll("[data-part='index']")
    const inverted = [...indices].filter((n) => n.hasAttribute('data-inverted'))
    const upright = [...indices].filter((n) => !n.hasAttribute('data-inverted'))
    expect(inverted).toHaveLength(1)
    expect(upright).toHaveLength(1)
  })

  it('each index node\'s textContent contains the literal rank string and the suit glyph character', async () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    el.rank = 'A'
    el.suit = 'spades'
    await el.updateComplete
    for (const index of el.querySelectorAll("[data-part='index']")) {
      expect(index.textContent).toContain('A')
      expect(index.textContent).toContain('♠')
    }
  })

  it('a numeric rank renders exactly that many [data-part=pip] nodes; a letter rank renders one [data-part=letter]', async () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    el.rank = '5'
    el.suit = 'clubs'
    await el.updateComplete
    expect(el.querySelectorAll("[data-part='pip']")).toHaveLength(5)
    expect(el.querySelector("[data-part='letter']")).toBeNull()

    el.rank = 'Q'
    await el.updateComplete
    expect(el.querySelectorAll("[data-part='pip']")).toHaveLength(0)
    const letter = el.querySelector("[data-part='letter']")
    expect(letter).not.toBeNull()
    expect(letter?.textContent).toBe('Q')
  })

  it('the blank ("") face renders zero pips and zero letter nodes', () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    expect(el.querySelectorAll("[data-part='pip']")).toHaveLength(0)
    expect(el.querySelector("[data-part='letter']")).toBeNull()
  })

  it('a rotated pip (below the grid center) carries data-rotated; an upright one does not', async () => {
    const el = mount(document.createElement('ui-playing-card')) as UIPlayingCardElement
    el.rank = '4' // pipsFor('4'): 2 upright (row 0), 2 rotated (row 4)
    el.suit = 'clubs'
    await el.updateComplete
    const pips = [...el.querySelectorAll("[data-part='pip']")]
    expect(pips.filter((p) => p.hasAttribute('data-rotated'))).toHaveLength(2)
    expect(pips.filter((p) => !p.hasAttribute('data-rotated'))).toHaveLength(2)
  })
})

describe('UIPlayingCardElement — :state(ready) motion gate + connect/disconnect residue', () => {
  // jsdom's ElementInternals.states support is capability-gated (the checkbox.test.ts precedent) — this
  // probe only asserts when the environment actually implements CustomStateSet; the cross-engine timing
  // proof (the flip transition only present under :state(ready)) lives in playing-card.browser.test.ts.
  it('arms ready one frame past first paint (ADR-0008 §4a-c) — not synchronously on connect', async () => {
    const el = mount(document.createElement('ui-playing-card-probe')) as ProbePlayingCard
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('ready')).toBe(false)
      await new Promise((r) => requestAnimationFrame(r))
      expect(el.probeInternals.states.has('ready')).toBe(true)
    }
  })

  it('reconnect produces a stable DOM shape — no doubled parts (zero residue)', () => {
    const el = document.createElement('ui-playing-card') as UIPlayingCardElement
    el.rank = 'A'
    el.suit = 'spades'
    document.body.append(el)
    el.remove()
    document.body.append(el)
    expect(el.querySelectorAll("[data-part='flipper']")).toHaveLength(1)
    expect(el.querySelectorAll("[data-part='index']")).toHaveLength(2)
    el.remove()
  })
})
