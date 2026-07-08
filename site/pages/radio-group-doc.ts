// site/pages/radio-group-doc.ts — the ui-radio-group API doc page (T4). DERIVED from `radio-group.md`: the API
// table is built from the canonical parser's `attributes[]`, so it cannot drift from the descriptor the contract
// trip-wire enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are the SHARED
// lib/doc-page.ts. ui-radio-group is the FACE container that owns single-selection exclusivity + roving over its
// ui-radio children + the group form value (ADR-0042/0043). A worked group specimen accompanies the table.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadRadioGroupDoc } from '../lib/frontmatter.ts'
import { heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'

const { descriptor, body } = loadRadioGroupDoc()

const { content } = mountPage({
  title: 'ui-radio-group — API',
  intro: 'The FACE container for a single-selection radio set: it owns the group form value, exclusivity, roving ' +
    'focus over its ui-radio children, and required → valueMissing (matches ARIA radiogroup). This page is ' +
    'generated from radio-group.md, so the API table cannot drift. See the demo page for live keyboard roving.',
})

content.append(renderApiTable(descriptor.attributes), renderExample(), renderMarkdownBody(body))

// ── a worked group specimen (markup SHAPE: a ui-radio-group owning a few ui-radio members) ──────────────────

// renderExample — a real <ui-radio-group> with three <ui-radio> members, the second selected by default. The
// group owns selection exclusivity + roving; each member carries its own value. (Live keyboard roving is on the
// demo page; this is the structural example beside the API table.)
function renderExample(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Example — a single-selection group'))

  const group = document.createElement('ui-radio-group')
  group.setAttribute('name', 'plan')
  group.setAttribute('value', 'pro')
  // ADR-0103: ui-radio-group now owns its own interior layout (flex column by default, a wrapping row + gap
  // under `orientation="horizontal"`). The inline `style` below just matches the demo page's identical
  // plan-picker shape (radio-group-demo.ts, `--ui-space-md` — this page's own gap choice, not the component's
  // `--ui-space-sm` default) so the two pages read consistently; the roving-focus axis matches the row either way.
  group.setAttribute('orientation', 'horizontal')
  group.setAttribute('style', 'display:flex; flex-wrap:wrap; align-items:center; gap:var(--ui-space-md);')
  for (const [value, label] of [
    ['free', 'Free'],
    ['pro', 'Pro'],
    ['team', 'Team'],
  ]) {
    const radio = document.createElement('ui-radio')
    radio.setAttribute('value', value)
    radio.textContent = label
    group.append(radio)
  }

  section.append(specimenRow([group]))
  return section
}
