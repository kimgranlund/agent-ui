// site/pages/agent-schema.ts — the AGENT SCHEMA reference (GH #781): what `ui-agent-admin` reads and
// writes, in two layers. NOT a component API doc (no `{name}.md` descriptor exists for this — it is a
// data shape, not a tagged element) — the nearest docs-author taxonomy row is T6 "conceptual guide"
// (content-types.md), widened with T9's "derive by calling the real function live" discipline
// (persona-library-pattern.ts's own precedent) wherever a fact genuinely has a runtime owner to call.
//
// Two owners, two tables, both DERIVED (never hand-transcribed):
//   1. The CONFIG surface — `agentConfigSchema()` (agent-admin-schema.ts), the `SettingsSchema` `ui-settings`
//      renders as the Agent section's form. The table below iterates this function's OWN return value —
//      add/rename/redefault a field there and this table changes with it, no page edit.
//   2. The Model roster — `modelRoster()`/`SUPPORTED_MODELS`, the SAME file. ADR-0131 cl.1 (2026-07-19
//      rev.2) moved model selection OUT of the schema into this roster-driven Model GRID; GH #137
//      (2026-07-20) then removed the roster's own free-text "Additional models" extension field. Both facts
//      are asserted as STRUCTURAL claims in agent-schema.test.ts (a `model` field reappearing in
//      `agentConfigSchema()` would fail that gate, not just this page's prose).
//   3. The turn-time READ shape — `AgentConfigSnapshot` (the same file), what `agent-admin.ts`'s
//      `#handleSubmit` actually assembles and hands to a turn runner. An interface has no runtime
//      reflection, so the field table is built from a REAL sample object typed against the interface (an
//      excess-property/missing-property compile error the moment the interface's field set changes — a
//      `tsc`-enforced trip-wire, `npm run check`) and then fed live into the real `runStubAgentTurn`, whose
//      actual output is shown below — not a paraphrase of what it would say.
//
// "And others" (the ticket's own open question, resolved here): the ticket's own Summary names the answer
// — persona files, entry libraries, presets — so this page POINTS to their existing, dedicated pages
// (persona-library-pattern.html, agent-admin.html, agent-admin-app.html) and cites their shapes by
// file:line, rather than re-deriving tables that page already owns (one fact, one home). The a2ui `./agent`
// producer toolkit's OWN `liveAgentConfigSchema` (a2ui/tools/agent/agent-config-schema.ts) is a DIFFERENT
// schema builder for a different surface (the live-agent dev proxy, not ui-agent-admin) — out of scope here,
// named so a reader doesn't conflate the two.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import { exampleSection, el } from '../lib/specimens.ts'
import { tableHead, tableRow, textCell, codeCell, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import {
  agentConfigSchema,
  modelRoster,
  DEFAULT_MODEL_ID,
  runStubAgentTurn,
  type AgentConfigSnapshot,
} from '@agent-ui/app/agent-admin-schema'

const { content } = mountPage({
  title: 'Agent Schema',
  intro:
    'What ui-agent-admin reads and writes, in two layers: the CONFIG surface an admin edits ' +
    '(agentConfigSchema(), a SettingsSchema rendered by ui-settings) and the turn-time snapshot a runner ' +
    'reads (AgentConfigSnapshot). Every table below is produced by calling the real agent-admin-schema.ts ' +
    'functions live, on this page load — never a hand-typed copy of their shape.',
})

content.append(
  pageLead(
    'agent-admin-schema.ts builds the Agent section’s form data (agentConfigSchema()) and the model roster ' +
      '(modelRoster()) as plain, DOM-free data — ui-settings maps each field to a fleet control (settings.html), ' +
      'and ui-agent-admin’s own Model GRID renders the roster directly, outside the schema.',
  ),
)

// ── 1 — the CONFIG surface, derived live from agentConfigSchema() ────────────────────────────────────────

const schema = agentConfigSchema()
const schemaFields = schema.sections.flatMap((section) => section.fields.map((field) => ({ section, field })))

function validationText(v?: { required?: boolean; min?: number; max?: number; step?: number }): string {
  if (!v) return '—'
  const parts: string[] = []
  if (v.required) parts.push('required')
  if (v.min !== undefined) parts.push(`min ${v.min}`)
  if (v.max !== undefined) parts.push(`max ${v.max}`)
  if (v.step !== undefined) parts.push(`step ${v.step}`)
  return parts.length > 0 ? parts.join(', ') : '—'
}

const schemaTable = document.createElement('table')
const schemaTbody = document.createElement('tbody')
for (const { section, field } of schemaFields) {
  schemaTbody.append(
    tableRow(
      textCell(section.label),
      codeCell(field.key),
      codeCell(field.type),
      textCell(field.label),
      codeCell(JSON.stringify(field.default)),
      textCell(validationText(field.validation)),
    ),
  )
}
schemaTable.append(tableHead('Section', 'Key', 'Type', 'Label', 'Default', 'Validation'), schemaTbody)
schemaTable.id = 'agent-schema-config-table'

content.append(
  exampleSection(
    '1 · The config surface — agentConfigSchema()',
    el('p', {}, [
      document.createTextNode(
        'One row per field agentConfigSchema() actually returns (agent-admin-schema.ts) — version ',
      ),
      codeChip(String(schema.version)),
      document.createTextNode(', '),
      codeChip(String(schema.sections.length)),
      document.createTextNode(
        ' section(s) today. name is a required ui-text-field; temperature is a ui-slider bounded to the ' +
          'validation shown. There is deliberately no model field here — see §2.',
      ),
    ]),
    schemaTable,
  ),
)

// ── 2 — the Model roster, derived live from modelRoster() ────────────────────────────────────────────────

const roster = modelRoster()
const modelTable = document.createElement('table')
const modelTbody = document.createElement('tbody')
for (const model of roster) {
  modelTbody.append(
    tableRow(
      codeCell(model.id),
      textCell(model.label),
      textCell(model.provider),
      codeCell(String(model.includedByDefault)),
      codeCell(model.id === DEFAULT_MODEL_ID ? 'yes' : ''),
    ),
  )
}
modelTable.append(tableHead('id', 'label', 'provider', 'included by default', 'schema default'), modelTbody)
modelTable.id = 'agent-schema-model-table'

content.append(
  exampleSection(
    '2 · The Model roster — modelRoster() (moved out of the schema)',
    el('p', {}, [
      document.createTextNode(
        'ADR-0131 cl.1 (2026-07-19 rev.2, agent-admin-schema.ts:101-106): model selection moved OUT of ' +
          'agentConfigSchema() into this roster-driven Model GRID — ui-agent-admin renders it as provider-grouped ' +
          'rows with an include switch, reading/writing the SAME modelsIncluded/model store keys the schema-era ' +
          'select field used to. GH #137 (2026-07-20, agent-admin-schema.ts:67-71) then removed the roster’s own ' +
          '"Additional models" free-text extension field entirely — the roster below is the closed, ' +
          'code-defined list; there is no admin-typed row.',
      ),
    ]),
    modelTable,
  ),
)

// ── 3 — the turn-time snapshot, AgentConfigSnapshot ───────────────────────────────────────────────────────
// A plain interface has no runtime reflection: SAMPLE is typed AgentConfigSnapshot, so adding, removing, or
// renaming a field on the real interface is a `tsc` error right here (an excess or a missing property) —
// npm run check (not just this file's own test) is this fact's drift gate. DOCS is the SAME
// `Record<keyof AgentConfigSnapshot, string>` shape, so a field the interface gains with no matching row
// here is ALSO a compile error, independently. agent-schema.test.ts adds a THIRD, independent runtime
// check (a source-text scan of the real interface, the component-descriptor-sourcewire.test.ts precedent) —
// three different gate homes (tsc twice, vitest once) rather than one relied on three times.

const AGENT_CONFIG_SNAPSHOT_SAMPLE: AgentConfigSnapshot = {
  name: 'Ada',
  model: DEFAULT_MODEL_ID,
  temperature: 0.7,
  toolsEnabled: true,
  systemPrompt: 'You are a careful, concise research assistant.',
  skills: ['Summarizing'],
  workflows: ['Weekly report'],
  resources: ['Style guide'],
  tools: ['Web search'],
}

const AGENT_CONFIG_SNAPSHOT_DOCS: Record<keyof AgentConfigSnapshot, string> = {
  name: 'The agent’s display name — the schema’s own name field, read verbatim (§1).',
  model: 'The sanitized SUPPORTED_MODELS id (sanitizeModel) — from the Model GRID’s store keys, not the schema (§2).',
  temperature: 'The schema’s own temperature field, fail-closed sanitized against its own min/max (§1).',
  toolsEnabled: 'Whether the tool kind’s section-header MASTER switch is on (kindEnabledKey("tool")) — not a schema field.',
  systemPrompt: 'The COMPOSED multi-section prompt (entries.ts composeSystemPrompt) — not a single flat key.',
  skills: 'The skill kind’s ENABLED entry labels, ordered — empty when the skill kind’s master switch is off.',
  workflows: 'The workflow kind’s ENABLED entry labels, ordered — same law as skills.',
  resources: 'The resource kind’s ENABLED entry labels, ordered — same law as skills.',
  tools: 'The tool kind’s ENABLED entry labels, ordered — same law as skills (independent of toolsEnabled above).',
}

const snapshotTable = document.createElement('table')
const snapshotTbody = document.createElement('tbody')
for (const [key, value] of Object.entries(AGENT_CONFIG_SNAPSHOT_SAMPLE) as [keyof AgentConfigSnapshot, unknown][]) {
  const type = Array.isArray(value) ? 'readonly string[]' : typeof value
  snapshotTbody.append(tableRow(codeCell(key), codeCell(type), textCell(AGENT_CONFIG_SNAPSHOT_DOCS[key])))
}
snapshotTable.append(tableHead('Key', 'Type', 'What it carries'), snapshotTbody)
snapshotTable.id = 'agent-schema-snapshot-table'

const stubOutput = runStubAgentTurn('What can you help me with?', AGENT_CONFIG_SNAPSHOT_SAMPLE)
const stubBlock = codeBlock(stubOutput, 'text')
stubBlock.id = 'agent-schema-stub-output'

content.append(
  exampleSection(
    '3 · The turn-time snapshot — AgentConfigSnapshot',
    el('p', {}, [
      document.createTextNode(
        'What agent-admin.ts’s own #handleSubmit assembles before every turn (agent-admin-schema.ts:372-382) — ' +
          'always a fresh read of the current store, never cached. The sample below is a real value typed against ' +
          'the interface (adding a field the interface doesn’t have, or omitting one it requires, fails npm run ' +
          'check right on this page).',
      ),
    ]),
    snapshotTable,
    heading(3, 'Fed live into the real runStubAgentTurn'),
    el('p', {}, [
      document.createTextNode(
        'runStubAgentTurn(text, config) — ADR-0131’s deterministic, clearly-labelled stub (no external runtime ' +
          'dependency): its whole job is making the live-apply wiring provable, by citing back the config it read. ' +
          'The block below is that call’s ACTUAL return for the sample above, not a paraphrase.',
      ),
    ]),
    stubBlock,
  ),
)

// ── 4 — "and others": pointers, not restatements (one fact, one home) ─────────────────────────────────────
content.append(
  exampleSection(
    '4 · Related agent-record shapes — pointers, not copies',
    el('p', {}, [
      document.createTextNode(
        'The broader "agent record" ui-agent-admin reads/writes beyond this config surface already has its ' +
          'own dedicated page each — this section names the shape and cites it by file:line rather than growing ' +
          'a second, driftable copy of a table those pages already own.',
      ),
    ]),
    el('ul', {}, [
      relatedItem(
        'Persona',
        'site/pages/agent-admin-presets.ts:711-722',
        'One roster entry’s identity + seed — id, label, tagline, category, seed (the store’s initial values). Export/import format, validation, and the collision-safe mint rule: ',
        'persona-library-pattern.html',
      ),
      relatedItem(
        'AgentRosterEntry / GenerateSeed',
        'packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts:418-432',
        'The header’s agent-select row shape (id, label) and the pre-arm Model pick a card hands to a fresh mint. Live in the full composition: ',
        'agent-admin-app.html',
      ),
      relatedItem(
        'Entry / EntryLibraryPack',
        'packages/agent-ui/app/src/controls/entry-list/entry-data.ts:13-84',
        'The generic prompt-section/skill/workflow/resource/tool row (id, kind, label, description, content, order, enabled, builtin) and the add-from-library pack it can seed from. Live demo: ',
        'agent-admin.html',
      ),
      // GH #783 / SPEC-N2 — the MCP-services grain of the tool kind (the ADR-0185 wire widening). No new
      // store key, schema field, or entry kind (SPEC-R1): a service reference is just a tool-kind Entry
      // whose id happens to be `mcp:<server-id>:*`. Cited by its owning SPEC requirement, not transcribed —
      // the grammar's one home is service-ref.ts; this page only names the grain and points at the pack.
      relatedItem(
        'MCP service reference (tool kind)',
        'mcp-agent-config.spec.md SPEC-R1/R2',
        'A tool-kind entry’s id may be a service reference mcp:<server-id>:* — "every tool this server currently has" — expanded server-side against the live registry at turn time, never a new store key, schema field, or entry kind (SPEC-R1). Added from the live-derived MCP services pack (MCP_SERVICES_PACK, site/pages/agent-admin-libraries.ts), which is absent unless the dev proxy is serving live. Live in the full composition: ',
        'agent-admin-app.html',
      ),
    ]),
    el('p', { class: 'as-caption' }, [
      document.createTextNode(
        'Out of scope: the a2ui ./agent producer toolkit’s OWN liveAgentConfigSchema ' +
          '(packages/agent-ui/a2ui/tools/agent/agent-config-schema.ts) — a different SettingsSchema builder for ' +
          'the live-agent dev proxy, not ui-agent-admin. Named here so the two are not conflated.',
      ),
    ]),
  ),
)

// ── page-end Changelog (TKT-0053 convention) — hand-authored provenance, flagged as such ───────────────────
const changelog = renderChangelogTable([
  {
    date: '2026-07-19',
    type: 'Change',
    id: 'ADR-0131 cl.1 rev.2',
    summary: 'Model selection moved out of agentConfigSchema() into the roster-driven Model GRID.',
  },
  {
    date: '2026-07-20',
    type: 'Change',
    id: 'GH #137',
    summary: 'Removed the roster’s "Additional models" free-text extension field.',
  },
  {
    date: '2026-08-12',
    type: 'Feature',
    id: 'GH #781',
    summary: 'Added this Agent Schema reference, derived from agent-admin-schema.ts live.',
  },
  {
    date: '2026-08-12',
    type: 'Change',
    id: 'GH #783',
    summary: 'Noted the tool kind’s MCP service-reference grain (mcp:<server-id>:*, ADR-0185) — §4 pointer, per SPEC-R1/R2.',
  },
])
if (changelog) content.append(changelog)

// ── small local DOM helpers (page-local scaffold only; no per-fact data lives here) ──────────────────────

function codeChip(text: string): HTMLElement {
  const code = document.createElement('code')
  code.textContent = text
  return code
}

function relatedItem(name: string, cite: string, lead: string, pageHref: string): HTMLElement {
  const li = document.createElement('li')
  const strong = document.createElement('strong')
  strong.textContent = name
  const cite2 = document.createElement('code')
  cite2.textContent = cite
  const link = document.createElement('a')
  link.href = `./${pageHref}`
  link.textContent = pageHref
  li.append(strong, ' — ', cite2, '. ', lead, link, '.')
  return li
}
