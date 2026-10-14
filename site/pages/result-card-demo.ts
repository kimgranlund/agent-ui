// site/pages/result-card-demo.ts: the ui-result-card demo (ADR-0244; pairs with result-card-doc.ts, the
// descriptor-derived API page). Mounts the real control over the approved mockup data: a blackjack win, an
// Admiral loss, a tic-tac-toe draw, a booked trip (done) and the empty-box quiz card. A "Lose the hand"
// button flips the blackjack card's `outcome`; the pill patches in place, so the polite header announces once.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-result-card: demo',
  intro:
    'The settled outcome card, live: a win, a loss, a draw and a done summary, each stating the outcome in ' +
    'words, showing the final figures and holding its next action. The API table is on the ui-result-card ' +
    'API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface CardSpec {
  readonly outcome: string
  readonly title: string
  readonly summary: string
  readonly stats?: readonly Record<string, unknown>[]
  readonly actions?: readonly (readonly [string, string?])[]
}
const card = (spec: CardSpec): HTMLElement => {
  const { actions = [], ...props } = spec
  const node = el('ui-result-card')
  Object.assign(node, props)
  node.style.maxInlineSize = '30rem'
  for (const [label, variant] of actions) node.append(el('ui-button', variant ? { variant } : {}, [text(label)]))
  return node
}

// ── [1] Croupier: a blackjack win, with a live outcome change ──────────────────────────────────────────
const blackjack = card({
  outcome: 'win',
  title: 'Blackjack, hand 12',
  summary: 'You beat the dealer 20 to 18. Your stack is up for the night.',
  stats: [
    { label: 'Chips', value: 1290, delta: 50, intent: 'success' },
    { label: 'Hands', value: 12 },
    { label: 'Win rate', value: '58%' },
  ],
  actions: [['Play again'], ['Change bet', 'soft']],
})
// T-0142: the column stretches (the card fills like its siblings below); only the trigger hugs, as a flex item.
const flip = el('ui-button', { variant: 'soft', style: 'align-self:flex-start;' }, [text('Toggle win and loss')])
flip.addEventListener('click', () => {
  const host = blackjack as HTMLElement & { outcome: string }
  host.outcome = host.outcome === 'win' ? 'lose' : 'win'
})
const blackjackBlock = el('div', { style: 'display:flex; flex-direction:column; gap:1rem;' }, [blackjack, flip])
const blackjackNote = el('p', {}, [
  text('Each click writes '), code('outcome'), text(' again. The card reuses the same pill and rewrites only ' +
    'the word and glyph, so a screen reader hears the new outcome once.'),
])

// ── [2] Admiral: a loss ─────────────────────────────────────────────────────────────────────────────────
const admiral = card({
  outcome: 'lose',
  title: 'Admiral, battle over',
  summary: 'All five of your ships are sunk. The enemy fleet has two left.',
  stats: [
    { label: 'Shots', value: 23 },
    { label: 'Hits', value: 5, delta: -3, intent: 'danger' },
    { label: 'Ships left', value: 0 },
  ],
  actions: [['Play again'], ['Show board', 'soft']],
})

// ── [3] A draw and a settled summary that is not a game ────────────────────────────────────────────────
const draw = card({
  outcome: 'draw',
  title: 'Tic-tac-toe',
  summary: 'The board is full and nobody has three in a row.',
  stats: [{ label: 'Moves', value: 9 }, { label: 'Rounds won', value: '1 / 1' }],
  actions: [['Play again']],
})
const trip = card({
  outcome: 'done',
  title: 'Trip plan booked',
  summary: 'Lisbon, 4 nights, 12 to 16 March. Your confirmation was sent.',
  stats: [{ label: 'Nights', value: 4 }, { label: 'Total', value: '$1,240' }],
  actions: [['View itinerary', 'soft'], ['Share', 'soft']],
})
const doneNote = el('p', {}, [
  code('done'), text(' is the neutral outcome for a settled summary that is not a game, such as a booked trip.'),
])

// ── [4] The empty-box law ───────────────────────────────────────────────────────────────────────────────
const quiz = card({ outcome: 'done', title: 'Quiz complete', summary: 'You answered 8 of 10 correctly.' })
const emptyNote = el('p', {}, [
  text('No stats and no children: the card renders the header and summary only, with no empty stats box and ' +
    'no actions row.'),
])

content.append(
  exampleSection('Croupier: blackjack win, live outcome change', blackjackBlock, blackjackNote),
  exampleSection('Admiral: a loss', admiral),
  exampleSection('Draw and done', el('div', { style: 'display:grid; gap:1rem;' }, [draw, trip]), doneNote),
  exampleSection('The empty-box law', quiz, emptyNote),
)
