// site/pages/segmented-control-doc.ts — the ui-segmented-control API doc page (ADR-0095). DERIVED from
// `segmented-control.md` via the shared doc-page.ts renderer (the attribute table is name/disabled/required/
// orientation — the SAME shape ui-radio-group's own attributes had, minus `variant`, which retired). One
// representative LIVE specimen mounts the real compound; the rich interaction (roving keyboard + the shared
// moving indicator) is the Segmented control demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSegmentedControlDoc } from '../lib/frontmatter.ts'
import { composeDocPage, renderChangelogTable } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadSegmentedControlDoc()

const { content } = mountPage({
  title: 'ui-segmented-control — API',
  intro: 'The standalone joined-button single-select control, superseding the retired ' +
    'ui-radio-group[variant="segmented"] presentation — a real M3-style segmented control: a joined track + ' +
    'one shared sliding indicator. Generated from segmented-control.md (descriptor-derived table). See the ' +
    'Segmented control demo for the live moving indicator + roving keyboard.',
})

// A representative live ui-segmented-control: three segments, the second selected. Real compound — clicking /
// arrow keys move the shared indicator (the rich interaction + the event log are on the demo page). The
// group's `value` is a property-only accessor (not a reflected attribute — the same shape ui-radio-group's
// own `value` has), so the initial selection is seeded from the CHILD's `checked` attribute, the mechanism
// the control's own `connected()` actually reads at markup-parse time.
const control = el('ui-segmented-control', { name: 'density' }, [
  el('ui-segment', { value: 'compact' }, [document.createTextNode('Compact')]),
  el('ui-segment', { value: 'comfortable', checked: '' }, [document.createTextNode('Comfortable')]),
  el('ui-segment', { value: 'spacious' }, [document.createTextNode('Spacious')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', control))

// Provenance (TKT-0054): the decision records this page's intro previously cited inline now live here only —
// HAND-AUTHORED, not derivable from any canonical index (no ADR/TKT index cross-links to the pages it built).
const changelog = renderChangelogTable([
  { date: '2026-07-06', type: 'Decision', id: 'ADR-0086', summary: 'Shipped the segmented presentation as a ui-radio-group[variant="segmented"] variant (later superseded).' },
  { date: '2026-07-07', type: 'Decision', id: 'ADR-0095', summary: 'Promoted the segmented presentation to a standalone ui-segmented-control component, retiring the ui-radio-group variant.' },
])
if (changelog) content.append(changelog)
