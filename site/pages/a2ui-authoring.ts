// a2ui-authoring.ts — the A2UI AUTHORING guide: exactly how to author (A) a catalog row and (B) training
// data, written for someone extending @agent-ui/a2ui rather than consuming it. Two derivation rules keep
// the page honest (the docs-site law — pages derive from canonical sources):
//   • every worked ROW example is rendered from the IMPORTED `defaultCatalog` (shown ≡ shipped — a
//     catalog edit re-renders this page with zero edits here);
//   • every worked SEED fact is read off the IMPORTED `allSeeds` shelf (counts, names, promptText).
// The pedagogy prose (the numbered procedures, the "why" sentences) is HAND-AUTHORED — it teaches the
// written-down laws (a2ui-catalog.spec.md §5.2 · ADR-0087 coverage · ADR-0102 lanes · ADR-0106/0109
// presentation-intent props · ADR-0107 array props · ADR-0055 shelf · ADR-0060/0061/0068 corpus store)
// and cites them; it is not derivable content.

import { mountPage, pageLead } from './_page.ts' // FIRST import — foundation CSS cascade + ui-* controls (ADR-0003)
import { codeBlock } from '../lib/code-block.ts'
import { defaultCatalog } from '@agent-ui/a2ui'
import { allSeeds } from '@agent-ui/a2ui/examples'

const { content } = mountPage({ title: 'A2UI authoring guide' })
content.append(
  pageLead(
    'How to author the two things that teach an agent this fleet: a CATALOG ROW (the vocabulary a model ' +
      'may emit) and TRAINING DATA (the seeds that teach idiomatic use). Every worked example below is ' +
      'derived live from the shipped catalog and seed shelf — what you read is what ships.',
  ),
)

// ── tiny local helpers (the guide is prose + derived snippets; no page CSS needed) ─────────────────────
function h(level: 2 | 3, text: string): HTMLElement {
  const el = document.createElement(`h${level}`)
  el.textContent = text
  return el
}
function p(text: string): HTMLElement {
  const el = document.createElement('p')
  el.textContent = text
  return el
}
function steps(items: readonly string[]): HTMLElement {
  const ol = document.createElement('ol')
  for (const item of items) {
    const li = document.createElement('li')
    li.textContent = item
    ol.append(li)
  }
  return ol
}

/** A real catalog row, verbatim from the imported defaultCatalog (derived — cannot drift). */
function rowJson(type: string): string {
  const row = defaultCatalog.components[type]
  return row ? JSON.stringify({ [type]: row }, null, 2) : `/* catalog row "${type}" not found */`
}

// ── PART A — authoring a catalog row ───────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part A — authoring a catalog row'),
  p(
    'A catalog row is the whole contract between the wire and a control: its existence puts the type on ' +
      'the security allowlist (only catalogued types render), its properties define what the validator ' +
      'accepts, and the derived system prompt advertises it to the model automatically (prompt drift is ' +
      'gated, so a new row is taught the moment it lands). Authoring one is five decisions:',
  ),
  steps([
    'NAME the type UpperCamelCase and bind it to exactly one ui-* widget via a factory entry — the table-parity gate demands one factory per type, no gap, no extra.',
    'NAME each bindable prop by the CONTROL’S OWN prop name (the naming law) — the wire vocabulary follows the component, never an adapter’s.',
    'TYPE each prop, and mark data-drivable props "bindable": true. A prop that is per-instance INTENT rather than data state omits the bindable key entirely (never "bindable": false) — the presentation-intent idiom Text.truncate and Text.emphasis established (ADR-0106/0109).',
    'Give an input control at most ONE two-way slot: the value: {prop, event} mark. Display-only rows carry none.',
    'Declare the child model: a children list, a single child, or none — the renderer’s adjacency walk follows it.',
  ]),
  h(3, 'Worked example — a display row with intent props (derived from the shipped catalog)'),
  codeBlock(rowJson('Text')),
  p(
    'Read truncate/emphasis: boolean, no bindable key — the model may set them per instance; the data ' +
      'model can never drive them. Neither needed a line of factory code: booleans with no dedicated ' +
      'mapping ride the factory’s generic setAttr arm, and the reflected attribute IS the CSS hook.',
  ),
  h(3, 'Worked example — an array-typed bindable prop (derived from the shipped catalog)'),
  codeBlock(rowJson('Sparkline')),
  p(
    'values is the catalog’s first array-typed bindable prop: the row declares the full item schema, ' +
      'the shared validator accepts a literal array at top-level type depth, and a {path} binding resolves ' +
      'to the same typed array — re-rendering on every updateDataModel. The component’s own hardened ' +
      'codec (malformed JSON → empty series, never a throw) is the safety net beneath the validator.',
  ),
  h(3, 'Before you add a prop at all — the ADR-0102 chooser'),
  p(
    'The catalog consumer has no CSS verb, so any rendered-correctness concern must be reachable without ' +
      'page CSS. Route the concern through the three lanes IN ORDER: Lane A — can the component own a safe ' +
      'default? (calendar’s fluid tracks); Lane C — can composition express it gracefully? (the form ' +
      'wrapped in Column gap="md", taught by exemplar); only per-instance INTENT over a safe default earns ' +
      'Lane B, a catalog prop (truncate, emphasis). A prop minted to repair a broken default is the ' +
      'anti-pattern — fix the default instead.',
  ),
  h(3, 'The coverage gate, and the duties a row ships with'),
  p(
    'The fleet-derived coverage gate (ADR-0087) turns red the moment a shipped descriptor has neither a ' +
      'catalog row nor a seeded allowlist entry with a recorded reason — so a new control lands its row in ' +
      'the same wave, and a deliberate exclusion is a documented disposition, never silence. Seeded ' +
      'allowlist entries must drain: a residue assertion fails if a drained type’s seed is left behind. ' +
      'Two more duties ship WITH the row: a when-to-use note in the catalog SPEC §5.2 whenever the new ' +
      'type competes with existing vocabulary (tile for a latest value · Sparkline for a series’ ' +
      'shape · BarChart for comparing magnitudes · List table for exact values), and a reference ' +
      'use on the examples shelf — a prop no exemplar renders is a self-correct-convergence hazard the ' +
      'model will misuse (the D6 lesson).',
  ),
)

// ── PART B — authoring training data ───────────────────────────────────────────────────────────────────
const shelfNames = allSeeds.map((s) => s.name).join(' · ')
const reportCard = allSeeds.find((s) => s.name === 'report-card-dashboard')

content.append(
  h(2, 'Part B — authoring training data'),
  p(
    'Training data lives in two homes with different bars. The EXAMPLES SHELF (src/examples/ — ' +
      `${allSeeds.length} seeds today: ${shelfNames}) is the teaching surface: every seed renders in the ` +
      'gallery, feeds the drift gates, and is the reference use for catalog idioms. The CORPUS SHARD ' +
      '(corpus/exemplar/v1_0/) is the retrieval store the live agent draws from: joining it is a separate, ' +
      'judged act — a seed does NOT become a corpus record by existing (the shelf grew by five this month; ' +
      'the shard deliberately stayed at its eleven judged records).',
  ),
  h(3, 'Seed anatomy — the five parts every seed carries'),
  steps([
    'name + description — the gallery card and the gate’s test names derive from them.',
    'promptText — the USER intent this seed answers. Write it as a real ask (“Show a room booking form…”): retrieval and teaching both key off intent vocabulary, not implementation vocabulary.',
    'messages — the canonical stream shape: createSurface → updateDataModel (seed the whole model in one write) → updateComponents (the full adjacency list, one root).',
    'Idioms in the tree — Field-wrapped inputs under a FormProvider, Column gap="md" for form rhythm, {path} bindings for every data-model field you declare (an unreachable model field is dead weight), checks for validity, ONE submit-gated action.',
    'Types — export the messages as readonly A2uiServerMessage[]; the site typecheck pins the envelope shape at check time.',
  ]),
  reportCard
    ? h(3, 'Worked example — the newest seed, derived live')
    : h(3, 'Worked example — (report-card-dashboard not found on the shelf)'),
)

if (reportCard) {
  content.append(
    p(
      `promptText: “${reportCard.promptText}” — and its stream is ${reportCard.messages.length} ` +
        'messages in the canonical order. It exists to TEACH a rule: a metric tile for the latest value, a ' +
        'Sparkline for the series’ shape, a BarChart for the breakdown — the seed is the §5.2 ' +
        'guidance in composition form.',
    ),
    codeBlock(
      JSON.stringify(
        reportCard.messages.map((m) => Object.keys(m).filter((k) => k !== 'version')),
        null,
        2,
      ) + ' // the message kinds, in stream order (derived from the seed itself)',
    ),
  )
}

content.append(
  h(3, 'The quality bar — what a seed must pass before it teaches anyone'),
  steps([
    'Validator-clean: 0 CATALOG and 0 IDGRAPH failures through the SAME shared validator the renderer runs — the standing examples gate re-proves every committed seed on every test run.',
    'Rendered proof: the derived gallery walks every shelf seed in a real browser — a seed that validates but paints a collapsed box fails the whole-shape law.',
    'Idiomatic: graded against the payload rubric (composition, catalog idiom, binding hygiene, accessibility — every dimension ≥4). Authored-clean beats healed: a seed that needs the healer is a draft, not a teacher.',
    'Reference-use duty: if the seed exists to teach a new prop or type, the teaching must be legible IN the composition — the document-row seed carries truncate AND emphasis on one Text node precisely to show two orthogonal intents composing.',
  ]),
  h(3, 'Shard admission — the judged pipeline (only when a seed graduates to retrieval)'),
  p(
    'Admission is validate → heal (a CLOSED, form-only repair list — anything else rejects) → dedupe ' +
      '(exact + near-duplicate) → record (canonical hash; byte-stable JSONL). Quality scoring is a judged ' +
      'act with provenance: an independent critic grades the record against the corpus rubric and emits a ' +
      'verdicts file; the import tool refuses quarantine exits without one (--verdicts is mandatory — a ' +
      'replace can never silently skip judging). Quarantined records stay in the shard, excluded from ' +
      'retrieval, visible in history. If you remember one rule: the shelf is where seeds teach people; ' +
      'the shard is where judged records teach the MODEL — and nothing crosses that line unjudged.',
  ),
  h(3, 'Sources'),
  p(
    'The written-down laws this page teaches: a2ui-catalog.spec.md §5.2 (rows + guidance notes) · ' +
      'ADR-0087 (whole-fleet coverage) · ADR-0102 (the three-lane chooser) · ADR-0106/0109 ' +
      '(presentation-intent props) · ADR-0107 (the chart rows + array props) · ADR-0055 (the seed ' +
      'shelf) · ADR-0060/0061/0068 (admission, the shared healer, the judge seam). The derived examples ' +
      'above import the live defaultCatalog and allSeeds — if this page and the code disagree, the page is ' +
      'stale and its derivation is the bug.',
  ),
)
