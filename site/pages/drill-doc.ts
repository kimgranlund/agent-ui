// site/pages/drill-doc.ts — the ui-drill API doc page (ADR-0195 + its Amendment, GH #1510). DERIVED from
// `drill.md` via the shared doc-page.ts renderer (the attribute table is surfaceProps + path +
// view-transitions + `layout`/`chrome`). One representative LIVE specimen mounts a real 2-level drill (root →
// settings), stack/backbar default. All three layout/chrome combinations (stack, chrome="crumbs",
// layout="columns" incl. the narrow-degrade) are the Drill demo's job, live — this page's own body prose
// (composeDocPage, straight from drill.md below the frontmatter fence) already documents each mode's mechanics.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadDrillDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadDrillDoc()

const { content } = mountPage({
  title: 'ui-drill — API',
  intro: 'A contained, card-like container that drills down an N-level selection tree (ADR-0195 + its ' +
    'Amendment, GH #1510) — stack (default), chrome="crumbs", and layout="columns" (Miller columns, with a ' +
    'narrow-host auto-degrade back to stack). Generated from drill.md (descriptor-derived table). See the ' +
    'Drill demo for all three modes live + the change-event log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative 2-level ui-drill: root lists two categories; drilling into "Appearance" shows its panel.
const drill = el('ui-drill', { 'aria-label': 'Example settings' }, [
  el('ui-drill-panel', { key: 'root', heading: 'Settings' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'appearance' }, [text('Appearance')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'notifications' }, [text('Notifications')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'appearance', parent: 'root', heading: 'Appearance' }, [
    el('p', { style: 'margin:0' }, [text('Theme, density, and font-size controls would live here.')]),
  ]),
  el('ui-drill-panel', { key: 'notifications', parent: 'root', heading: 'Notifications' }, [
    el('p', { style: 'margin:0' }, [text('Notification-channel toggles would live here.')]),
  ]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', drill))

content.append(
  (() => {
    const p = document.createElement('p')
    const a = document.createElement('a')
    a.href = './motion.html'
    a.textContent = 'View transitions'
    p.append('See the ', a, ' guide for view-transitions’ opt-in law and the other three ADR-0183 surfaces.')
    return p
  })(),
)
