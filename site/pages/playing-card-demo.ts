// site/pages/playing-card-demo.ts — the ui-playing-card demo (the Display-class true card-face/back
// leaf, ADR-0225, GH #1478; pairs with playing-card-doc.ts, the descriptor-derived API page). Mounts the
// REAL control over a dealt hand, the [size] em-box ramp, and a live `faceDown` flip driven by a real
// ui-button — never a mock. A display leaf emits nothing; the honesty proof is the mounted control's own
// flipper rotor re-deriving its rotation under a real prop write.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-playing-card — demo',
  intro:
    'A real standard playing card, live: a dealt hand across every suit, the `size` em-box ramp holding ' +
    'the bridge aspect, and a live `faceDown` flip driven by a real button. The API table is on the ' +
    'ui-playing-card API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

const playingCard = (attrs: Record<string, string>): HTMLElement => el('ui-playing-card', attrs)

// ── [1] a dealt hand — one card per suit + a face-down hole card (the example-authoring bar) ───────────
const hand = el('div', { class: 'demo-grid' }, [
  captioned('rank="A" suit="spades"', playingCard({ rank: 'A', suit: 'spades' })),
  captioned('rank="K" suit="hearts"', playingCard({ rank: 'K', suit: 'hearts' })),
  captioned('rank="Q" suit="diamonds"', playingCard({ rank: 'Q', suit: 'diamonds' })),
  captioned('rank="10" suit="clubs"', playingCard({ rank: '10', suit: 'clubs' })),
  captioned('face-down — a concealed hole card', playingCard({ rank: 'A', suit: 'spades', 'face-down': '' })),
])
const handNote = el('p', {}, [
  text('Red/black ink is a '), strong('redundant'), text(' identity carrier — rank text + shape-distinct ' +
    'suit glyphs already carry it. The face-down card conceals its rank/suit from BOTH the paint and the ' +
    'accessible name ('), code('"Face-down card"'), text(', never a leaking string).'),
])

// ── [2] the size ramp — sm/md/lg, the 9/14 bridge aspect held at every tier ──────────────────────────────
const ramp = el('div', { class: 'demo-grid' }, [
  captioned('size="sm"', playingCard({ rank: 'A', suit: 'spades', size: 'sm' })),
  captioned('size="md" (default)', playingCard({ rank: 'A', suit: 'spades' })),
  captioned('size="lg"', playingCard({ rank: 'A', suit: 'spades', size: 'lg' })),
])

// ── [3] a live flip — a real `faceDown` prop write, watch the flipper rotor re-derive its rotation ───────
const live = playingCard({ rank: 'Q', suit: 'hearts' })
applyDemoWidth(live, '8rem')
let faceDown = false
const readout = code('faceDown: false')
const flip = uiButton('Flip')
flip.addEventListener('click', () => {
  faceDown = !faceDown
  ;(live as HTMLElement & { faceDown: boolean }).faceDown = faceDown // a real prop write — the flipper rotor transitions
  readout.textContent = `faceDown: ${faceDown}`
})
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [flip, readout]),
])
const liveNote = el('p', {}, [
  text('Every click writes '), code('faceDown'), text(' directly; the flipper rotor transitions under '),
  code(':state(ready)'), text(' (armed one frame past first paint — the upgrade itself never animates).'),
])

content.append(
  exampleSection('A dealt hand', hand, handNote),
  exampleSection('`size` — sm / md / lg', ramp),
  exampleSection('A live flip', liveBlock, liveNote),
)
