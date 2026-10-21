// site/pages/step-flow-doc.ts: the ui-step-flow API doc page (tier=pattern => {doc, demo}, T-0198).
// Derived from `step-flow.md` through the shared doc-page.ts renderer: the attribute and parts tables come from the
// parsed descriptor and the prose from its body, so neither can drift from the contract the trip-wire enforces
// (ADR-0004). The specimen scenes are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadStepFlowDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadStepFlowDoc()

const { content } = mountPage({
  title: 'ui-step-flow: API',
  intro:
    'The client-side wizard (T-0198): scenes as direct children shown one at a time under a "Step n of m" bar, ' +
    'Back and Next of its own, Next gated on the scene\'s validity, and a last scene that commits. Generated from ' +
    'step-flow.md: the attribute and parts tables are descriptor-derived; the specimen below is live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Three scenes and a finish action'))
  const desc = document.createElement('p')
  desc.textContent =
    'Each scene is a direct child. Back and Next walk them on the client; on the last scene the finish button ' +
    'emits the finish action with the bound draft folded into its context.'

  const flow = document.createElement('ui-step-flow')
  flow.style.maxInlineSize = '30rem'
  Object.assign(flow, {
    steps: ['Dates', 'Guests', 'Extras'],
    finishAction: { action: 'review_stay' },
    finishLabel: 'Review',
    draft: { guests: 2 },
  })
  for (const line of ['Pick your arrival and departure.', 'How many guests are staying?', 'Breakfast, spa or late check-out?']) {
    const scene = document.createElement('ui-text')
    scene.textContent = line
    flow.append(scene)
  }

  section.append(desc, flow)
  return section
}
