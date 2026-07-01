// site/pages/tooltip-doc.ts — the ui-tooltip API doc page (Wave 4 S2). DERIVED from `tooltip.md` via the shared
// doc-page.ts renderer (the descriptor-derived tables cannot drift). One representative LIVE tooltip mounts the
// real control (hover or focus the anchor); the show-delay + never-steal-focus behaviour + event log is on the
// Tooltip demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadTooltipDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadTooltipDoc()

const { content } = mountPage({
  title: 'ui-tooltip — API',
  intro: 'The non-modal tooltip — an anchor described by a top-layer panel on hover AND keyboard focus, with a ' +
    'show-delay; it never steals focus. Generated from tooltip.md (descriptor-derived tables). See the Tooltip ' +
    'demo for the live hover/focus behaviour.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-tooltip: the first child is the anchor (positional child-move); the remaining text is
// the tooltip content. Hover or focus the button to reveal the tooltip.
const tooltip = el('ui-tooltip', {}, [
  uiButton('Save', 'soft'),
  text('Save your changes (Ctrl+S)'),
])

composeDocPage(content, descriptor, body, exampleSection('Example', tooltip))
