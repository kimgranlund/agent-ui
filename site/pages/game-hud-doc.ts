// site/pages/game-hud-doc.ts: the ui-game-hud API doc page (tier=pattern => {doc, demo}, ADR-0243). Derived
// from `game-hud.md` through the shared doc-page.ts renderer: the attribute and parts tables come from the
// parsed descriptor and the prose from its body, so neither can drift from the contract the trip-wire
// enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadGameHudDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadGameHudDoc()

const { content } = mountPage({
  title: 'ui-game-hud: API',
  intro:
    'The game score and status strip (ADR-0243): a title, a status badge, an optional progress bar and up to ' +
    'six stat tiles with signed deltas. A read-out: no events, no keyboard model, no focus. Generated from ' +
    'game-hud.md: the attribute and parts tables are descriptor-derived; the specimens below are live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Full HUD and title-plus-status only'))
  const desc = document.createElement('p')
  desc.textContent =
    'The first HUD carries every part: header, progress and three stats, one with an intent glyph and a ' +
    'signed delta. The second has an empty stats array, so it renders the title and status only.'
  const column = document.createElement('div')
  column.style.cssText = 'display:grid; gap:1rem; max-inline-size:28rem; margin:0.5rem 0 1.75rem;'

  const full = document.createElement('ui-game-hud')
  Object.assign(full, {
    title: 'Science round',
    status: 'Question 4 of 10',
    statusIntent: 'info',
    progress: { value: 4, max: 10, label: 'Round' },
    stats: [
      { label: 'Score', value: 30, delta: 10, intent: 'success' },
      { label: 'Streak', value: 3 },
      { label: 'Time', value: '0:42' },
    ],
  })

  const minimal = document.createElement('ui-game-hud')
  Object.assign(minimal, { title: 'Lobby', status: 'Waiting for players' })

  column.append(full, minimal)
  section.append(desc, column)
  return section
}
