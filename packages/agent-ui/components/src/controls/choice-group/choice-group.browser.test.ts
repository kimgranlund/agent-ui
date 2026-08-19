import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent } from 'vitest/browser'

// choice-group.browser.test.ts — the real-engine proof for ui-choice-group (ADR-0220, GH #1368; the
// pinned browser-shard debt named in choice-group.test.ts's NAMED DEBT comment, blocking precondition
// of GH #1398). jsdom computes no real layout (no auto-fit/minmax reflow), no real focus/Tab traversal,
// and no CustomStateSet — this file proves what jsdom structurally cannot: the group's OWNED grid
// genuinely reflows from a stacked single column to a multi-column card grid at the `min` floor (a REAL
// measured `getBoundingClientRect`/`gridTemplateColumns` proof, the `grid.browser.test.ts` mechanism
// ported), the roving contract holds "exactly one tabindex=0" across a real Tab stop including a
// disabled card, and a REAL pointer click + a REAL Enter keypress both commit through the ADR-0220
// clause 1 trait seams (`itemFromTarget`/`reflectSelected`) — the Enter path in particular resolves via
// `document.activeElement` inside `selectionCommit`, a real-focus-dependent path jsdom's synthetic
// `document.activeElement` cannot exercise the same way a real engine's Tab/focus model does.
//
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the `packages` project's two instances).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then BOTH family stylesheets (choice-card.css is a standalone sheet, never injected from
// choice-group.ts — the file's own header), then the self-defining module (registers ui-choice-group,
// which itself imports+registers ui-choice-card).
import '@agent-ui/components/foundation-styles.css'
import '../choice-card/choice-card.css'
import './choice-group.css'
import './choice-group.ts'
import type { UIChoiceGroupElement } from './choice-group.ts'
import type { UIChoiceCardElement } from '../choice-card/choice-card.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Mount a group with `n` real ui-choice-card children (values card-0..card-n-1) inside a width-
 *  controllable wrapper (the `grid.browser.test.ts` query-container precedent). */
function mount(
  n: number,
  attrs: Record<string, string> = {},
  disabledIndices: number[] = [],
): { wrap: HTMLElement; group: UIChoiceGroupElement; cards: UIChoiceCardElement[] } {
  const wrap = document.createElement('div')
  wrap.style.boxSizing = 'border-box'
  const group = document.createElement('ui-choice-group') as UIChoiceGroupElement
  for (const [k, v] of Object.entries(attrs)) group.setAttribute(k, v)
  const cards: UIChoiceCardElement[] = []
  for (let i = 0; i < n; i++) {
    const card = document.createElement('ui-choice-card') as UIChoiceCardElement
    card.setAttribute('value', `card-${i}`)
    card.textContent = `Card ${i}`
    if (disabledIndices.includes(i)) card.setAttribute('disabled', '')
    group.append(card)
    cards.push(card)
  }
  wrap.append(group)
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, group, cards }
}

const settle = (el: HTMLElement): Promise<void> => (el as unknown as { updateComplete: Promise<void> }).updateComplete
const trackCount = (el: HTMLElement): number => (getComputedStyle(el).gridTemplateColumns.match(/px/g) ?? []).length

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Stacked→grid reflow at the `min` breakpoint (real measured geometry, ADR-0220 cl.6, the
//  ui-grid auto-fit/minmax mechanism ported directly)
//
//  ADR-0223 (Fill-by-Default) posture: every geometry assertion below is pinned against the explicit
//  WRAPPER width (`wrap.style.inlineSize`) and relationships DERIVED from it (track COUNT, "same row"
//  top-alignment, "collapsed vs not") — never a bare intrinsic pixel reading on the group or a card.
//  `min`/`gap` are the group's own public API parameters (inputs to the layout, not width pins) and
//  stay stable across ADR-0223's S1+ host-fill posture flips.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-group — stacked→grid reflow at the `min` breakpoint (real measured geometry, both engines)', () => {
  it('reflows from a stacked single column (min ≥ container, variant A) to a multi-column grid (min < container, variant B) — anti-vacuous', async () => {
    const { wrap, group } = mount(6, { min: '100px' })
    await settle(group)

    wrap.style.inlineSize = '640px' // ≫ min → multiple tracks fit
    const wide = trackCount(group)

    wrap.style.inlineSize = '90px' // < min → the degenerate stacked single-column case
    const narrow = trackCount(group)

    expect(wide, `${server.browser}: a wide container must pack multiple tracks`).toBeGreaterThan(narrow)
    expect(narrow, `${server.browser}: a container narrower than min must stack to exactly ONE column`).toBe(1)
    expect(wide, `${server.browser}: a genuinely wide grid (anti-vacuous, not 1-vs-1)`).toBeGreaterThanOrEqual(3)
  })

  it('the `min` floor changes the track count at a FIXED width (the --ui-choice-group-min thread is live)', async () => {
    const { wrap, group } = mount(6)
    wrap.style.inlineSize = '640px'

    group.setAttribute('min', '100px')
    await settle(group)
    const dense = trackCount(group)

    group.setAttribute('min', '300px')
    await settle(group)
    const roomy = trackCount(group)

    expect(dense, `${server.browser}: a smaller floor must pack MORE tracks`).toBeGreaterThan(roomy)
  })

  it('real card content genuinely occupies the grid tracks (each card renders a non-zero box, side-by-side when wide)', async () => {
    const { wrap, group, cards } = mount(3, { min: '100px' })
    wrap.style.inlineSize = '640px'
    await settle(group)

    const rects = cards.map((c) => c.getBoundingClientRect())
    for (const rect of rects) {
      expect(rect.width, `${server.browser}: a card collapsed to zero width in the grid track`).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
    }
    // three tracks at 640px with a 100px floor: the cards sit on the SAME row (top-aligned).
    expect(Math.abs(rects[1]!.top - rects[0]!.top), 'cards should share the first row at this width').toBeLessThan(2)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Exactly-one-tabindex roving across cards, including disabled ones (real Tab/focus model)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-group — exactly-one-tabindex roving, incl. disabled cards (real Tab/focus model, both engines)', () => {
  it('exactly one card holds tabindex=0 (the first ENABLED card); a disabled first card is skipped by the roving seed', () => {
    const { cards } = mount(3, {}, [0]) // card-0 is disabled
    expect(cards[0]!.tabIndex, `${server.browser}: a disabled card must never seed the roving stop`).toBe(-1)
    expect(cards[1]!.tabIndex, `${server.browser}: the first ENABLED card must be the sole roving stop`).toBe(0)
    expect(cards[2]!.tabIndex).toBe(-1)
  })

  it('one real Tab stop: Tab lands on the roving card, then Tab again leaves the group entirely (not onto a second card)', async () => {
    const { cards } = mount(3)
    await userEvent.tab()
    expect(document.activeElement, `${server.browser}: Tab did not land on the roving card`).toBe(cards[0]!)

    await userEvent.tab()
    expect(document.activeElement, `${server.browser}: a second Tab must leave the group as ONE stop, not land on a sibling card`).not.toBe(cards[1]!)
    expect(document.activeElement).not.toBe(cards[2]!)
  })

  it('ArrowDown (real keyboard) skips a disabled card in the middle and roves the real DOM focus + tabindex', async () => {
    const { cards } = mount(4, {}, [1]) // card-1 disabled
    cards[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(document.activeElement, `${server.browser}: ArrowDown must skip the disabled card`).toBe(cards[2]!)
    expect(cards[2]!.tabIndex).toBe(0)
    expect(cards[1]!.tabIndex, 'the skipped disabled card must never hold the tab stop').toBe(-1)
    expect(cards[0]!.tabIndex).toBe(-1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Real-pointer + real-Enter commit through the ADR-0220 clause 1 trait seams
//  (itemFromTarget / reflectSelected) — the Enter path resolves via document.activeElement inside
//  selectionCommit, a real-focus-dependent path.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-choice-group — real-pointer + real-Enter commit through the trait seams (both engines)', () => {
  it('a REAL pointer click on a card commits it: select fires, value updates, aria-selected flips, AND :state(selected) genuinely arms on the CARD (real CustomStateSet)', async () => {
    const { group, cards } = mount(3)
    const events: unknown[] = []
    group.addEventListener('select', (e) => events.push((e as CustomEvent).detail))

    await userEvent.click(cards[1]!)
    await group.updateComplete

    expect(events, `${server.browser}: click must commit through itemFromTarget`).toEqual(['card-1'])
    expect(group.value).toBe('card-1')
    expect(cards[1]!.getAttribute('aria-selected'), 'FACE — never a host attribute; internals only').toBeNull()
    expect(cards[1]!.matches(':state(selected)'), `${server.browser}: reflectSelected must arm :state(selected) on the CARD in a real engine`).toBe(true)
    expect(cards[0]!.matches(':state(selected)')).toBe(false)
  })

  it('a REAL Enter keypress on the roving-focused card commits it — the document.activeElement Enter path inside selectionCommit', async () => {
    const { group, cards } = mount(3)
    const events: unknown[] = []
    group.addEventListener('select', (e) => events.push((e as CustomEvent).detail))

    cards[2]!.focus() // real focus — document.activeElement === cards[2] in the real engine
    expect(document.activeElement, 'precondition: real focus must actually land on the card').toBe(cards[2]!)

    await userEvent.keyboard('{Enter}')
    await group.updateComplete

    expect(events, `${server.browser}: Enter must commit via the document.activeElement seam`).toEqual(['card-2'])
    expect(group.value).toBe('card-2')
    expect(cards[2]!.matches(':state(selected)')).toBe(true)
  })

  it('a REAL Space keypress toggles/commits the roving-focused card (the synthesized Space→click seam)', async () => {
    const { group, cards } = mount(3)
    cards[0]!.focus()

    await userEvent.keyboard(' ')
    await group.updateComplete

    expect(group.value, `${server.browser}: Space must commit the focused card via the synthesized .click()`).toBe('card-0')
    expect(cards[0]!.matches(':state(selected)')).toBe(true)
  })

  it('a REAL click on a per-card-disabled card commits NOTHING (itemFromTarget short-circuits; the card is pointer-inert)', async () => {
    const { group, cards } = mount(3, {}, [1])
    const events: unknown[] = []
    group.addEventListener('select', (e) => events.push((e as CustomEvent).detail))

    expect(getComputedStyle(cards[1]!).pointerEvents, 'a disabled card must be pointer-inert (real @scope CSS)').toBe('none')
    // A real pointer gesture cannot even reach a pointer-events:none target — prove the JS-layer guard
    // separately with a forced/native click (the multi-select.browser.test.ts defense-in-depth precedent).
    cards[1]!.click()
    await group.updateComplete

    expect(events, `${server.browser}: a disabled card must never commit, even on a forced native click`).toEqual([])
    expect(group.value).toBe('')
  })

  it('multi mode: a REAL click toggles membership; a second click on the SAME card commits it OFF', async () => {
    const { group, cards } = mount(3, { multiple: '' })

    await userEvent.click(cards[0]!)
    await group.updateComplete
    expect(group.values).toEqual(['card-0'])
    expect(cards[0]!.matches(':state(selected)')).toBe(true)

    await userEvent.click(cards[0]!)
    await group.updateComplete
    expect(group.values, `${server.browser}: a second real click must toggle the card back OFF`).toEqual([])
    expect(cards[0]!.matches(':state(selected)')).toBe(false)
  })
})
