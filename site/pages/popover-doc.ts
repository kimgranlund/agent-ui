// site/pages/popover-doc.ts — the ui-popover API doc page (Wave 4 S1). DERIVED from `popover.md` via the shared
// doc-page.ts renderer (attributes + properties/events/slots/parts tables, all read straight from the descriptor
// the contract trip-wire validates — it cannot drift). One representative LIVE popover mounts the real overlay
// control; the two-way `open` + light-dismiss `close`/`toggle` log is on the Popover demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadPopoverDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadPopoverDoc()

const { content } = mountPage({
  title: 'ui-popover — API',
  intro: 'The disclosure popover — a trigger toggling a top-layer panel (native Popover API), with a bindable ' +
    'open prop and platform light-dismiss. Generated from popover.md (descriptor-derived tables). See the ' +
    'Popover demo for the live open/close event log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-popover: the first child is the trigger (positional child-move), the rest is the
// panel content moved into the top-layer panel at connect. Click the trigger to reveal the panel.
const popover = el('ui-popover', {}, [
  uiButton('Open settings', 'solid'),
  el('section', {}, [
    el('h3', {}, [text('Settings')]),
    el('p', {}, [text('Panel content in the top layer. Escape or an outside click dismisses it.')]),
  ]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', popover))
