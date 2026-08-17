// site/pages/entry-list.ts — the @agent-ui/app ENTRY-LIST guide (GH #1049 — the app-package "leftovers"
// sweep). `mountEntryList`/`entry-data.ts` are HEADLESS: no `customElements.define`, no tag of their own
// (`controls-coverage.test.ts`'s own `entry-list` EXEMPT row states exactly that), so they carry no
// `{name}.md` descriptor and sit OUTSIDE the site-coverage/site-toc/site-canon descriptor-driven gates —
// this is an ungrouped site-level GUIDE page, the SAME posture as settings.ts/traits-doc.ts/data-doc.ts.
//
// DERIVE-FIRST: every interface/table below is sliced VERBATIM out of the real package sources via Vite
// `?raw` static imports + this page's own brace-balanced extractor (the settings.ts/traits-doc.ts
// `extractInterface` precedent, duplicated rather than shared per those pages' own stated convention) —
// never hand-retyped, so a field rename/addition throws at page-load (a real drift gate) instead of
// silently drifting. `EFFORT_LEVELS` and the three persona-patch key-set counts are read from the REAL
// runtime exports (not the source text) — a live proof the same law traits-doc.ts's dogfooded `overlay()`
// demo follows: the number on the page IS the number the shipped module currently answers.
//
// The live demo below mounts the REAL `mountEntryList` (not a mock/screenshot) — one section wired to a
// plain in-memory `Entry[]` array through the SAME `validateNewEntry`/`renameEntry` calls a real consumer
// (`agent-admin.ts`) makes, exercising the library-menu (GH #47/#48), rename (GH #848), and availability
// (GH #850) opt-ins together. `entryDrawer` is deliberately NOT exercised here — this page's honest-labels
// job is the primitive's public surface, and the drawer form (`entry-form.ts`) is an internal implementation
// detail of the SAME writes, already covered live on agent-admin.html/card-grid-drawer.html.
//
// `composer-options.ts` and `agent-admin-persona-patch.ts` are covered in two shorter sections below —
// deliberately NOT full doc pages: both are pure data/logic modules consumed entirely THROUGH other
// documented surfaces (`ui-conversation`'s composer, `ui-agent-admin`'s guided-authoring turn), so this
// page names their exported vocabulary + the ADR/consumer it serves rather than re-narrating logic already
// owned by `conversation-doc.html`/`agent-admin.html`/`persona-library-pattern.html`.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import '@agent-ui/components/component-styles.css' // ui-button/ui-switch/ui-text-field/ui-menu/ui-toggle/etc.'s shipped CSS
import '@agent-ui/code/editor.css' // ADR-0139 — ui-code-editor's own sheet (the per-entry content editors' frame + CM tokens)
import '@agent-ui/app/entry-list.css' // the primitive's own self-sufficient stylesheet (ADR-0164 cl.4/cl.6)
import '@agent-ui/code/editor' // self-defines ui-code-editor (entry-list.ts creates it but never registers it itself)
import './entry-list.css' // page-local demo chrome only (the framed section) — never restyles the primitive's own parts
import { heading, tableHead, tableRow, textCell, codeCell } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import { mountEntryList, showAddError, type EntryListHandlers } from '@agent-ui/app/entry-list'
import { validateNewEntry, renameEntry, entryAvailability, ENTRY_AVAILABILITY, type Entry, type EntryLibraryPack } from '@agent-ui/app/entry-data'
import { EFFORT_LEVELS } from '@agent-ui/app/composer-options'
import { PERSONA_STATE_KEYS, PERSONA_VALUE_KEYS, PERSONA_ENTRY_LIST_KEYS } from '@agent-ui/app/agent-admin-persona-patch'
import entryListSrc from '../../packages/agent-ui/app/src/controls/entry-list/entry-list.ts?raw'
import entryDataSrc from '../../packages/agent-ui/app/src/controls/entry-list/entry-data.ts?raw'
import composerOptionsSrc from '../../packages/agent-ui/app/src/controls/conversation/composer-options.ts?raw'
import personaPatchSrc from '../../packages/agent-ui/app/src/controls/agent-admin/persona-patch.ts?raw'

// ── local derivation helpers (the settings.ts/traits-doc.ts precedent, duplicated rather than shared —
//    each page slices exactly the sources it needs) ──────────────────────────────────────────────────────

function extractInterface(source: string, name: string, file: string): string {
  // The bare marker (no trailing `{`) — EntryListHandlers extends EntryFormHandlers, so its own opening
  // brace isn't the character right after the name (the settings.ts/traits-doc.ts precedent's marker
  // assumed no `extends` clause; widened here to find the brace wherever it actually falls).
  const marker = `export interface ${name}`
  const markerStart = source.indexOf(marker)
  if (markerStart === -1) throw new Error(`entry-list.ts (page): interface "${name}" not found in ${file} — renamed or removed?`)
  const start = markerStart
  const braceStart = source.indexOf('{', markerStart)
  let depth = 0
  let i = braceStart
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(start, i)
}

/** Slice an `export function {name}(…): ReturnType` signature (through the char right before its body's
 *  opening `{`) verbatim — the traits-doc.ts `extractSignature` precedent. */
function extractSignature(source: string, name: string, file: string): string {
  const marker = `export function ${name}(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`entry-list.ts (page): function "${name}" not found in ${file} — renamed or removed?`)
  const bodyStart = source.indexOf('{', start)
  return source.slice(start, bodyStart).trim()
}

function para(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}
function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}

const { content } = mountPage({
  title: 'entry-list — the ordered-entry-list primitive',
  intro:
    '@agent-ui/app’s HEADLESS entry-rendering mechanism (ADR-0132) — mountEntryList()/entry-data.ts, ' +
    'reused verbatim by every capability kind agent-admin renders (skills, workflows, resources, tools, ' +
    'prompt sections, pattern sources, the catalog library) plus the card-grid-drawer recipe’s edit-via-' +
    'drawer shape. No customElements.define, no tag of its own — controls-coverage.test.ts’s own EXEMPT ' +
    'row says exactly that — so it carries no {name}.md descriptor and this page is its guide instead.',
})

content.append(
  pageLead(
    'Call mountEntryList(kind, addLabel, handlers, options) once per kind; render(entries) rebuilds the ' +
      'list body on every entries-array change. This module owns no store of its own — every write routes ' +
      'through the handlers you supply, exactly as the live demo below does.',
  ),
)

// ── 1 · the live demo — a REAL mountEntryList section over a plain in-memory array ──────────────────────

content.append(heading(2, '1 · Live demo'))
content.append(
  para(
    'A real ', code('mountEntryList'), ' section, wired to a plain in-memory ', code('Entry[]'), ' array ' +
      'through the SAME ', code('validateNewEntry'), '/', code('renameEntry'), ' calls a real consumer ' +
      '(agent-admin.ts) makes. Three opt-ins are on: the add-from-library menu (a two-entry pack), rename ' +
      '(GH #848), and the per-entry availability control (GH #850). Reload the page to reset — nothing here ' +
      'persists.',
  ),
)

let demoEntries: Entry[] = [
  { id: 'welcome', kind: 'demo', label: 'Welcome note', description: 'A built-in entry — toggle it, but Remove never renders.', content: 'Hello! Toggle me, or add your own below.', order: 0, enabled: true, builtin: true },
  { id: 'second-entry', kind: 'demo', label: 'A custom entry', description: 'A non-builtin entry — Remove renders for this one.', content: 'Try Rename, or the Invocable pill.', order: 1, enabled: true, builtin: false },
]

const demoLibrary: readonly EntryLibraryPack[] = [
  {
    id: 'starter-pack',
    label: 'Starter pack',
    description: 'Two ready-to-add entries',
    entries: [
      { label: 'Style guide', description: 'House writing style.', content: '# Style guide\n\nWrite short sentences.' },
      { label: 'Escalation policy', description: 'When to hand off to a human.', content: '# Escalation\n\nHand off on repeated failure.' },
    ],
  },
]

const demoHandlers: EntryListHandlers = {
  onToggle: (id, enabled) => {
    demoEntries = demoEntries.map((e) => (e.id === id ? { ...e, enabled } : e))
    section.render(demoEntries)
  },
  onContentChange: (id, contentValue) => {
    demoEntries = demoEntries.map((e) => (e.id === id ? { ...e, content: contentValue } : e))
  },
  onDelete: (id) => {
    demoEntries = demoEntries.filter((e) => e.id !== id || e.builtin)
    section.render(demoEntries)
  },
  onAdd: (input) => {
    const result = validateNewEntry(demoEntries, 'demo', input)
    if (!result.ok) {
      showAddError(section, result.error)
      return false
    }
    demoEntries = [...demoEntries, result.entry]
    section.render(demoEntries)
    return true
  },
  onRename: (id, label) => {
    demoEntries = renameEntry(demoEntries, id, label)
    section.render(demoEntries)
  },
  onAvailabilityChange: (id, availability) => {
    demoEntries = demoEntries.map((e) => (e.id === id ? { ...e, availability } : e))
    section.render(demoEntries)
  },
}

const section = mountEntryList('demo', 'Add entry', demoHandlers, {
  libraries: demoLibrary,
  rename: true,
  availabilityToggle: true,
})
section.render(demoEntries)

const frame = document.createElement('div')
frame.className = 'el-frame'
frame.append(section.host)
content.append(exampleSection('mountEntryList(\'demo\', \'Add entry\', handlers, { libraries, rename: true, availabilityToggle: true })', frame))
content.append(
  el('p', { class: 'el-note' }, [
    document.createTextNode(
      `Read-time default (entryAvailability): an entry with no availability member is "${entryAvailability({})}" — ` +
        `the same fallback whether the field is absent (every entry minted before GH #850) or the string "${ENTRY_AVAILABILITY.invocable}".`,
    ),
  ]),
)

// ── 2 · EntryListOptions — DERIVED from source ───────────────────────────────────────────────────────────

content.append(heading(2, '2 · EntryListOptions — the per-kind knobs'))
content.append(
  para(
    'Every opt-in defaults to byte-identical rendering when omitted (ADR-0132 cl.1: no kind gets bespoke ' +
      'list/toggle/author code). Sliced verbatim from entry-list.ts — a field rename here throws at page-load.',
  ),
)
content.append(codeBlock(extractInterface(entryListSrc, 'EntryListOptions', 'entry-list.ts'), 'ts'))

content.append(heading(3, 'EntryListHandlers — the write seam'))
content.append(
  para(
    'One callback per write. Extends ', code('EntryFormHandlers'),
    ' (entry-form.ts:44 — onAdd/onDelete/onContentChange/onRename/onAvailabilityChange, one declaration shared ' +
      'with the drawer form so the two surfaces can never drift onto different write contracts); ', code('onToggle'),
    ' stays entry-list.ts’s own — the enabled switch never leaves the row (GH #917’s Phase 0 ruling: STATE, ' +
      'not CRUD). ', code('onAdd'), ' returns a boolean (fail-closed — ADR-0132 cl.4): ', code('false'),
    ' keeps the form open with the typed input, and the caller surfaces the reason through ', code('showAddError'), '.',
  ),
)
content.append(codeBlock(extractInterface(entryListSrc, 'EntryListHandlers', 'entry-list.ts'), 'ts'))

// ── 3 · entry-data.ts — the data core ────────────────────────────────────────────────────────────────────

content.append(heading(2, '3 · entry-data.ts — the data core'))
content.append(
  para(
    'Pure types + logic (ADR-0164 cl.2) — entry-list.ts owns rendering, a consumer owns the domain layer ' +
      '(kind constants, seeded defaults, system-prompt projection). Custom-entry depth is deliberately ' +
      'generic (ADR-0132 Fork 3): label + description + free-text content, uniform across every kind.',
  ),
)
content.append(codeBlock(extractInterface(entryDataSrc, 'Entry', 'entry-data.ts'), 'ts'))
content.append(codeBlock(extractInterface(entryDataSrc, 'NewEntryInput', 'entry-data.ts'), 'ts'))
content.append(codeBlock(extractInterface(entryDataSrc, 'EntryLibraryPack', 'entry-data.ts'), 'ts'))
content.append(
  para(
    code('validateNewEntry'), ' is the ONE validated add path (ADR-0132 cl.4) every custom entry AND every ' +
      'library-pack add commits through:',
  ),
)
content.append(codeBlock(extractSignature(entryDataSrc, 'validateNewEntry', 'entry-data.ts'), 'ts'))

content.append(heading(3, 'Consumers'))
content.append(
  para(
    'Five ADR-0132 capability kinds plus ', code('pattern-source'), '/', code('catalog'), ' — all instantiated ',
    'inside ', code('ui-agent-admin'), ' (', el('a', { href: './agent-admin.html' }, [document.createTextNode('agent-admin.html')]), '). ',
    'The card-grid + drawer recipe (', el('a', { href: './card-grid-drawer.html' }, [document.createTextNode('card-grid-drawer.html')]), ') ',
    'extracts the SAME entry-list/entry-form shape for a generic record-CRUD composition outside agent-admin.',
  ),
)

// ── 4 · composer-options.ts — the composer's picker vocabulary ──────────────────────────────────────────

content.append(heading(2, '4 · @agent-ui/app/composer-options — the composer’s picker vocabulary'))
content.append(
  para(
    'Types + pure data only, consumed by ', code('ui-conversation'), '’s composer (', el('a', { href: './conversation-doc.html' }, [document.createTextNode('conversation-doc.html')]), ') ',
    'and rendered by ', code('ui-agent-admin'), '’s Models/Effort/Provider pickers and the GH #849/#891 ',
    'mention/invocable + capabilities-panel vocabulary. Generic by construction: ', code('kind'), '/', code('icon'),
    ' are opaque strings the composer only groups and displays — the consumer owns every kind→meaning mapping.',
  ),
)
content.append(codeBlock(extractInterface(composerOptionsSrc, 'PickerOption', 'composer-options.ts'), 'ts'))
content.append(codeBlock(extractInterface(composerOptionsSrc, 'ReferenceOption', 'composer-options.ts'), 'ts'))
content.append(codeBlock(extractInterface(composerOptionsSrc, 'CapabilityRow', 'composer-options.ts'), 'ts'))
content.append(
  para('The one default option list shipped in-package — read live off the real export, not retyped:'),
)
{
  const table = document.createElement('table')
  table.append(tableHead('id', 'label'))
  const tbody = document.createElement('tbody')
  for (const level of EFFORT_LEVELS) tbody.append(tableRow(codeCell(level.id), textCell(level.label)))
  table.append(tbody)
  content.append(table)
}

// ── 5 · agent-admin-persona-patch.ts — the guided-authoring apply gate ─────────────────────────────────────

content.append(heading(2, '5 · @agent-ui/app/agent-admin-persona-patch — the guided-authoring apply gate'))
content.append(
  para(
    'ADR-0178 cl.2’s three-filter fail-closed gate a declared ', code('personaPatch'), ' passes through before a ' +
      'single byte reaches a draft persona’s store — the mechanism behind agent-admin’s guided-authoring turn ' +
      '(', el('a', { href: './agent-admin.html' }, [document.createTextNode('agent-admin.html')]), '), and the ' +
      'same canonical key set the persona-file export/import round trip (', el('a', { href: './persona-library-pattern.html' }, [document.createTextNode('persona-library-pattern.html')]), ') ' +
      'now re-exports rather than re-enumerates (GH #406’s silent-divergence fix). Read live off the real module, ' +
      `not hand-counted: ${PERSONA_STATE_KEYS.length} total persona-state keys — ${PERSONA_VALUE_KEYS.length} plain ` +
      `VALUE keys and ${PERSONA_ENTRY_LIST_KEYS.length} ENTRY-LIST keys (one per ENTRY_KINDS member).`,
  ),
)
content.append(codeBlock(extractInterface(personaPatchSrc, 'PatchReport', 'persona-patch.ts'), 'ts'))
content.append(
  para(
    'Three filters, in order: (1) an enumerated-key allowlist — ', code('values'), ' keys must be ∈ the VALUE set, ',
    code('entries'), ' keys ∈ the ENTRY-LIST set; (2) a per-key fixpoint ', code('ADMISSION'), ' table (a value is ' +
      'admitted iff its OWN sanitizer returns it unchanged — never a coercion, always a drop); (3) every proposed ' +
      'entry through the IDENTICAL ', code('validateNewEntry'), ' call the pane’s own add path makes, plus ADR-0178’s ' +
      'amendment (GH #696): a member naming an existing BUILTIN prompt section by id UPDATES its content in place ' +
      'instead of appending a duplicate.',
  ),
)
content.append(codeBlock(extractSignature(personaPatchSrc, 'applyPersonaPatch', 'persona-patch.ts'), 'ts'))
