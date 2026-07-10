// site/pages/status-stream-doc.ts — the ui-status-stream API doc page (ADR-0122, timeline-family.lld.md).
// DERIVED from status-stream.md via the shared doc-page.ts renderer: the attribute table (size/label), the
// empty events[] table (streamed state rides role=log, never a synthetic event), and the properties[]
// table (appendEntry/update/finalize) are read straight from the parse. Deliberately NOT catalogued
// (ADR-0122 F5) — see the App-surface consumption note below. One representative specimen, seeded via the
// real imperative API. See the ui-status-stream demo for the live REAL-stream replay.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadStatusStreamDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { exampleSection } from '../lib/specimens.ts'
import type { UIStatusStreamElement } from '@agent-ui/components/components'

const { descriptor, body } = loadStatusStreamDoc()

const { content } = mountPage({
  title: 'ui-status-stream — API',
  intro:
    'The timeline family’s live host (ADR-0122) — a "what the system is doing now" strip: entries appear ' +
    'imperatively and transition state in place. Deliberately NOT catalogued (an EXCLUSION_ALLOWLIST entry, ' +
    'F5) — a consumer-owned imperative streaming host, not one-shot emittable markup. Generated from ' +
    'status-stream.md. See the ui-status-stream demo for the live REAL recorded-match replay.',
})

const stream = document.createElement('ui-status-stream') as UIStatusStreamElement
stream.setAttribute('label', 'Agent activity')
stream.appendEntry({ key: 'search', status: 'done', label: 'Searching the codebase…', description: '42 files matched' })
stream.appendEntry({ key: 'patch', status: 'active', label: 'Generating the patch…' })
stream.update('patch', { text: 'Reasoning: the failure is in the reconcile step — patching value-drag.ts…' })
stream.appendEntry({ key: 'tests', status: 'pending', label: 'Running tests' })

composeDocPage(content, descriptor, body, exampleSection('A seeded strip (appendEntry + update)', stream))
