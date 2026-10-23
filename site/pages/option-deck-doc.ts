// site/pages/option-deck-doc.ts: the ui-option-deck API doc page (tier=pattern => {doc, demo}, T-0193).
// Derived from `option-deck.md` through the shared doc-page.ts renderer: the attribute and parts tables come
// from the parsed descriptor and the prose from its body, so neither can drift from the contract the
// trip-wire enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadOptionDeckDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadOptionDeckDoc()

const { content } = mountPage({
  title: 'ui-option-deck: API',
  intro:
    'The option deck (T-0193): a deck of option cards for any lone single pick among a few options, where ' +
    'pressing a card is the commit. A pick fires select with the key and, with actionName set, one action. ' +
    'Generated from option-deck.md: the attribute and parts tables are descriptor-derived; the specimen below is live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A game picker with a Surprise me card, Blackjack picked'))
  const desc = document.createElement('p')
  desc.textContent =
    'Three tone cards with a corner index, an icon disc, a description and meta chips, then the dashed ' +
    'Surprise me card. The picked card carries the Your pick pill; every card stays pressable.'
  const surface = document.createElement('div')
  surface.dataset.tier = 'widget'
  surface.dataset.scale = 'md'
  surface.style.cssText = 'max-inline-size:44rem; margin:0.5rem 0 1.75rem;'

  const deck = document.createElement('ui-option-deck')
  Object.assign(deck, {
    heading: 'Pick your table',
    subheading: 'Every table starts you with 1,000 chips.',
    allowRandom: true,
    value: 'blackjack',
    options: [
      { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21 without going bust.', icon: 'star', tone: 'primary', index: 'A', meta: ['1 to 6 players', '5 min', 'Easy'] },
      { value: 'holdem', title: "Texas Hold'em", description: 'Two hole cards, five on the board, best hand wins.', icon: 'heart', tone: 'accent', index: 'K', meta: ['2 to 9 players', '15 min', 'Medium'] },
      { value: 'draw', title: 'Five-card draw', description: 'Swap up to three cards once, then show down.', icon: 'sparkle', tone: 'info', index: '5', meta: ['2 to 6 players', '10 min', 'Easy'] },
    ],
  })
  surface.append(deck)
  section.append(desc, surface)
  return section
}
