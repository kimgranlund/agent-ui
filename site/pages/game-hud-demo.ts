// site/pages/game-hud-demo.ts: the ui-game-hud demo (ADR-0243; pairs with game-hud-doc.ts, the
// descriptor-derived API page). Mounts the real control three times over the approved mockup data: a
// blackjack table, a quiz round and a dungeon room, each sitting quietly beside its game. A "Win hand"
// button rewrites `stats` on the blackjack HUD; the HUD patches the Chips value in place, so the polite
// live region announces only that readout.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-game-hud: demo',
  intro:
    'The game score and status strip, live: a blackjack table, a quiz round and a dungeon room, each with a ' +
    'status badge, signed deltas and (for two of them) a progress bar. The API table is on the ui-game-hud ' +
    'API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface HudSpec {
  readonly title: string
  readonly status: string
  readonly statusIntent: string
  readonly stats: readonly Record<string, unknown>[]
  readonly progress?: { readonly value: number; readonly max: number; readonly label: string }
}
const hud = (spec: HudSpec): HTMLElement => {
  const node = el('ui-game-hud')
  Object.assign(node, spec)
  node.style.maxInlineSize = '26rem'
  return node
}

// ── [1] Croupier: a blackjack table, with a live score update ───────────────────────────────────────────
let chips = 1240
const croupierStats = (): Record<string, unknown>[] => [
  { label: 'Chips', value: chips, delta: 60, intent: 'success' },
  { label: 'Bet', value: 50 },
  { label: 'Shoe', value: '3.1' },
]
const croupier = hud({ title: 'Table 4 · Blackjack', status: 'Your turn', statusIntent: 'success', stats: croupierStats() })
// T-0142: the column stretches (the HUD fills like its siblings below); only the trigger hugs, as a flex item.
const win = el('ui-button', { variant: 'soft', style: 'align-self:flex-start;' }, [text('Win hand')])
win.addEventListener('click', () => {
  chips += 60
  ;(croupier as HTMLElement & { stats: unknown }).stats = croupierStats()
})
const croupierBlock = el('div', { style: 'display:flex; flex-direction:column; gap:1rem;' }, [croupier, win])
const croupierNote = el('p', {}, [
  text('Each click adds 60 to Chips and writes '), code('stats'), text(' again. The HUD reuses the same stat ' +
    'elements and rewrites only the text that changed, so a screen reader hears the new Chips value once.'),
])

// ── [2] Quizmaster: a quiz round with progress ──────────────────────────────────────────────────────────
const quizmaster = hud({
  title: 'Science round',
  status: 'Question 4 of 10',
  statusIntent: 'info',
  progress: { value: 4, max: 10, label: 'Round' },
  stats: [
    { label: 'Score', value: 30, delta: 10, intent: 'success' },
    { label: 'Streak', value: 3 },
  ],
})

// ── [3] Dungeon Master: a room with hit points ──────────────────────────────────────────────────────────
const dungeonMaster = hud({
  title: 'The Undervault · Room 3',
  status: 'Wounded',
  statusIntent: 'warning',
  progress: { value: 9, max: 24, label: 'HP' },
  stats: [
    { label: 'Gold', value: 48, delta: -12, intent: 'danger' },
    { label: 'Pack', value: '4/6' },
  ],
})
const intentNote = el('p', {}, [
  text('The sign is text and never picks the color: '), code('-12'), text(' on Gold reads danger because its '),
  code('intent'), text(' says so, and the tile shows a cross glyph beside the label, so the meaning never ' +
    'rides color alone.'),
])

content.append(
  exampleSection('Croupier: blackjack table, live update', croupierBlock, croupierNote),
  exampleSection('Quizmaster: quiz round with progress', quizmaster),
  exampleSection('Dungeon Master: room with hit points', dungeonMaster, intentNote),
)
