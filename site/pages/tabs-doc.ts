// site/pages/tabs-doc.ts — the ui-tabs API doc page (T4). DERIVED from `tabs.md` via the shared doc-page.ts
// renderer (the attribute table is surfaceProps + the bindable `selected`). The sub-elements ui-tab /
// ui-tab-panel are documented in the descriptor prose; one representative LIVE specimen mounts the real compound.
// The rich interaction (select event + roving keyboard) is the Tabs demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadTabsDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadTabsDoc()

const { content } = mountPage({
  title: 'ui-tabs — API',
  intro: 'The tabs compound — ui-tabs coordinating ui-tab rows and ui-tab-panel regions, with a bindable ' +
    'selected prop. Generated from tabs.md (descriptor-derived tables). See the Tabs demo for selection + roving keyboard.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-tabs: two tabs + two panels, the second selected. Real compound — clicking / arrow
// keys switch tabs (the rich interaction + the select log are on the Tabs demo). `ui-tabs` is transparent by
// default (ADR-0104) — this specimen sits on the .canvas-surface grid stage, so it asks for its plane explicitly.
const tabs = el('ui-tabs', { selected: 'pricing', elevation: '0' }, [
  el('ui-tab', { value: 'overview' }, [text('Overview')]),
  el('ui-tab', { value: 'pricing' }, [text('Pricing')]),
  el('ui-tab-panel', {}, [text('The overview panel content.')]),
  el('ui-tab-panel', {}, [text('The pricing panel content.')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', tabs))
