// site/pages/option-deck-demo.ts: the ui-option-deck demo (T-0193; pairs with option-deck-doc.ts, the
// descriptor-derived API page). Mounts the real control over the approved playful mockup data on the A2UI canvas
// register (widget / md): the Croupier game picker with Surprise me and its select and action events logged, a
// plan chooser with no index, an onboarding path, the one-column row at 400px and a disabled deck.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-option-deck: demo',
  intro:
    'The option deck, live: each option is one card and the whole card is the choice. A pick marks the card ' +
    'with the Your pick pill and fires select, then action when actionName is set. The API table is on the ' +
    'ui-option-deck API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

/** A canvas-register surface (widget / md), the register an A2UI surface renders the deck at. */
const surface = (width: string, ...nodes: Node[]): HTMLElement => {
  const node = el('div', { 'data-tier': 'widget', 'data-scale': 'md', style: `max-inline-size:${width};` })
  node.append(...nodes)
  return node
}
const deck = (props: Record<string, unknown>): HTMLElement => {
  const node = el('ui-option-deck')
  Object.assign(node, props)
  return node
}

const GAMES = [
  { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21 without going bust.', icon: 'star', tone: 'primary', index: 'A', meta: ['1 to 6 players', '5 min', 'Easy'] },
  { value: 'holdem', title: "Texas Hold'em", description: 'Two hole cards, five on the board, best hand wins.', icon: 'heart', tone: 'accent', index: 'K', meta: ['2 to 9 players', '15 min', 'Medium'] },
  { value: 'draw', title: 'Five-card draw', description: 'Swap up to three cards once, then show down.', icon: 'sparkle', tone: 'info', index: '5', meta: ['2 to 6 players', '10 min', 'Easy'] },
]

// ── [1] Croupier: the game picker, with the events logged ───────────────────────────────────────────────
const picker = deck({
  heading: 'Pick your table',
  subheading: 'Every table starts you with 1,000 chips.',
  allowRandom: true,
  actionName: 'pick_game',
  options: GAMES,
})
const log = el('pre', { class: 'event-log', 'aria-live': 'polite' }, [text('Pick a card.')])
for (const type of ['select', 'action']) {
  picker.addEventListener(type, (e) => {
    log.textContent = `${type} ${JSON.stringify((e as CustomEvent).detail)}\n${log.textContent === 'Pick a card.' ? '' : log.textContent}`
  })
}
const pickerNote = el('p', {}, [
  text('A click, Enter or Space fires one '), code('select'), text(' with the key, then one '), code('action'),
  text(' because '), code('actionName'), text(' is set. Surprise me commits '), code('random'), text('.'),
])

// ── [2] A plan chooser: no index, a picked value set from outside ───────────────────────────────────────
const plans = deck({
  heading: 'Choose a plan',
  value: 'team',
  options: [
    { value: 'starter', title: 'Starter', description: 'One project, community support.', icon: 'user', tone: 'neutral', meta: ['Free'] },
    { value: 'team', title: 'Team', description: 'Unlimited projects and shared workspaces.', icon: 'chats-circle', tone: 'primary', meta: ['$12 a seat', 'Most picked'] },
    { value: 'scale', title: 'Scale', description: 'SSO, audit logs and a named contact.', icon: 'lock-simple', tone: 'success', meta: ['Custom'] },
  ],
})
const plansNote = el('p', {}, [
  code('value'), text(' was set from outside, so the Team card is marked without a click. A second pick moves the mark.'),
])

// ── [3] The 400px column: one track, each card a horizontal row ─────────────────────────────────────────
const narrow = deck({ heading: 'Pick your table', allowRandom: true, value: 'blackjack', options: GAMES })

// ── [4] Onboarding path and a disabled deck ─────────────────────────────────────────────────────────────
const onboarding = deck({
  heading: 'Where do you want to start?',
  options: [
    { value: 'tour', title: 'Take the tour', description: 'Five minutes through the main screens.', icon: 'play', tone: 'secondary', index: '1' },
    { value: 'import', title: 'Import data', description: 'Bring in a CSV or connect a source.', icon: 'upload-simple', tone: 'info', index: '2' },
  ],
})
const disabled = deck({ heading: 'Tables are closed', disabled: true, options: GAMES.slice(0, 2) })

content.append(
  exampleSection('Croupier: the game picker', surface('44rem', picker), log, pickerNote),
  exampleSection('A plan chooser, value set from outside', surface('44rem', plans), plansNote),
  exampleSection('The 400px column', surface('400px', narrow)),
  exampleSection('Onboarding path and a disabled deck', surface('44rem', onboarding), surface('44rem', disabled)),
)
