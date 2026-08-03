// site/pages/persona-library-pattern.ts — the PERSONA-LIBRARY PATTERN guide (GH #406, M-B DoD box 3:
// "SaaS patterns: the persona-library 'preset library' pattern documented as reusable beyond
// agent-admin"). NOT a doc of the agent-admin PAGE — this documents the REUSABLE SHAPE: let a user
// export a whole authored configuration as a shareable file, and re-import it as a NEW library entry,
// never overwriting, with a proof that re-import reproduces identical live behaviour. The concrete,
// shipped instance is agent-admin's persona export/import (agent-admin-persona-file.ts); every artifact
// on this page — the constants, the exported JSON, the fail-closed rejection message, the minted
// id/label — is produced by CALLING that module's real functions live, on a real shipped preset, never a
// hand-typed literal. If the envelope shape, the validation order, or the mint/collision rule ever
// changes, this page's own output changes with it (derived), and `persona-library-pattern.test.ts`
// re-derives the same values independently and asserts DOM-shown ≡ freshly-computed — the drift gate a
// cross-cutting, no-descriptor pattern page can still carry (T9 "recipe/pattern" per docs-author's
// content-types.md: a real, live, minimal composition where shown source == running source — here the
// composition is of the module's own functions, not ui-* controls, since the pattern is a data shape,
// not a UI widget).
import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import { tableHead, tableRow, textCell, codeCell } from '../lib/doc-page.ts'
import { ENTRY_KINDS, entriesStoreKey, createMemoryStore } from '@agent-ui/app'
import { AGENT_PRESETS, personaFromPreset } from './agent-admin-presets.ts'
import {
  PERSONA_FILE_KIND,
  PERSONA_FILE_VERSION,
  exportPersonaFile,
  personaFileText,
  readPersonaFile,
  importedPersonaFrom,
} from './agent-admin-persona-file.ts'

const { content } = mountPage({
  title: 'The persona-library pattern',
  intro:
    'Export a whole authored configuration as a shareable file; re-import it as a NEW library entry, ' +
    'never an overwrite; prove the re-import behaves identically to the original. Shipped once, on ' +
    'agent-admin’s personas (GH #406) — documented here as a shape any surface with user-authored, ' +
    'store-backed config can reuse. Every artifact below is produced by calling the real ' +
    'agent-admin-persona-file.ts functions live, not typed by hand.',
})

// ── the demo persona — a REAL shipped preset, not a fixture invented for this page ─────────────────────
// The Quant: the smallest preset (one skill, one workflow, one resource, no tools) — small enough to read
// in full on the page, still a genuine multi-section persona (config + prompt sections + a skill entry).
const DEMO_PRESET = AGENT_PRESETS.find((p) => p.id === 'quant')
if (!DEMO_PRESET) throw new Error('persona-library-pattern demo: the shipped "quant" preset is gone — pick another demo persona')
const demoPersona = personaFromPreset(DEMO_PRESET)
const demoStore = createMemoryStore({ initial: demoPersona.seed }) // no persistKey — pure ephemeral, no localStorage

// ── the four elements, hand-authored (no canonical index to derive the SHAPE description from — flagged) ──
content.append(
  exampleSection(
    'The pattern, in four parts',
    el('ol', {}, [
      olItem(
        'A versioned envelope wraps the surface’s own state.',
        'Not a bespoke ad hoc format — one discriminated shape ({ kind, version, … }) a reader checks before trusting anything else in the file.',
      ),
      olItem(
        'Export is pure serialization of exactly the state the surface’s own compose/run logic consumes.',
        'Traced from the real consumer, never guessed — export the keys the live turn actually reads, nothing more, nothing less.',
      ),
      olItem(
        'Import validates fail-closed and MINTS a new entry with a collision-safe id.',
        'Reject the whole file on any malformed shape (never sanitize-drop a bad item and import a persona that silently behaves differently); never overwrite an existing entry in place — this is what makes it LIBRARY semantics, not overwrite semantics.',
      ),
      olItem(
        'The proof is a round-trip test that drives the real composing logic on both sides.',
        'A hand-rolled JSON comparison could pass even if the real logic diverges; the proof must run the actual consumer twice — once on the source, once on the reimport — and compare its OUTPUT.',
      ),
    ]),
  ),
)

// ── 1 & 2 — the envelope + export, run live ───────────────────────────────────────────────────────────
const exportedFile = exportPersonaFile(demoPersona, demoStore)
const exportedText = personaFileText(exportedFile)
const exportBlock = codeBlock(exportedText, 'json')
exportBlock.id = 'persona-export-json'

content.append(
  exampleSection(
    'The envelope, exported live from a real shipped preset',
    el('p', {}, [
      document.createTextNode('The discriminator is '),
      codeChip(PERSONA_FILE_KIND),
      document.createTextNode(', the version this build writes/reads is '),
      codeChip(String(PERSONA_FILE_VERSION)),
      document.createTextNode(
        ' — read straight off agent-admin-persona-file.ts’s own PERSONA_FILE_KIND / PERSONA_FILE_VERSION exports, never retyped here. ' +
          'The JSON below is exportPersonaFile(demoPersona, demoStore) → personaFileText(…), called on The Quant, ' +
          'a real shipped agent-admin preset — not a literal typed onto this page.',
      ),
    ]),
    exportBlock,
  ),
)

// ── 3 — fail-closed import: corrupt the SAME text, then feed it to the real validator ───────────────────
const skillsKey = entriesStoreKey(ENTRY_KINDS.skill)
const corruptedObject = JSON.parse(exportedText) as { state: Record<string, unknown> }
const corruptedSkills = corruptedObject.state[skillsKey] as Array<Record<string, unknown>>
delete corruptedSkills[0].description // one required Entry field, dropped — entryListError's REJECT leg
const corruptedText = `${JSON.stringify(corruptedObject, null, 2)}\n`
const rejection = readPersonaFile(corruptedText)
const rejectionBlock = codeBlock(rejection.ok ? '(unexpectedly accepted)' : rejection.error, 'text')
rejectionBlock.id = 'persona-import-rejection'

content.append(
  exampleSection(
    'Import fails closed — a malformed entry rejects the whole file',
    el('p', {}, [
      document.createTextNode(
        'The exported JSON above, parsed back to an object, with one skill entry’s required "description" ' +
          'field deleted, re-stringified, and fed to the real readPersonaFile(text). The message below is that ' +
          'call’s actual return — not a paraphrase: a dropped field is REJECTED, never silently sanitized away ' +
          '(a sanitize-drop would import a persona that looks fine and behaves differently from the one exported ' +
          '— the exact silent-divergence class this pattern exists to close).',
      ),
    ]),
    rejectionBlock,
  ),
)

// ── 4 — library semantics: re-import the UNCORRUPTED export, mint a new persona ─────────────────────────
const accepted = readPersonaFile(exportedText)
const roster = AGENT_PRESETS.map(personaFromPreset) // the real shipped roster, no import history required
const minted = accepted.ok ? importedPersonaFrom(accepted.file, roster) : undefined

const mintTable = document.createElement('table')
const mintTbody = document.createElement('tbody')
mintTbody.append(
  tableRow(textCell('Source persona (on the roster already)'), codeCell(demoPersona.id), codeCell(demoPersona.label)),
  tableRow(textCell('Re-imported from the export above'), codeCell(minted?.id ?? '(rejected)'), codeCell(minted?.label ?? '(rejected)')),
)
mintTable.append(tableHead('', 'id', 'label'), mintTbody)
mintTable.id = 'persona-import-mint'

content.append(
  exampleSection(
    'Import mints a new persona — the source is never overwritten',
    el('p', {}, [
      document.createTextNode(
        'readPersonaFile(exportedText) on the UNCORRUPTED export above, then importedPersonaFrom(file, roster) ' +
          'against the real shipped preset roster (which already carries a "quant" id). The table is that call’s ' +
          'actual return: a collision-safe id/label pair, never a second "quant" silently sharing the first one’s ' +
          'persisted store — the one failure mode library semantics must not have. The imported STATE carries over ' +
          'verbatim; only the roster LABEL is uniquified, so the agent behaves byte-identically to the one exported.',
      ),
    ]),
    mintTable,
  ),
)

// ── where this generalizes (hand-authored; flagged as such — no canonical index of "reusable patterns") ──
content.append(
  exampleSection(
    'Where this generalizes',
    el('p', {}, [
      document.createTextNode(
        'PersonaStateReader (agent-admin-persona-file.ts) is exactly the read half of ',
      ),
      codeChip('SettingsStore'),
      document.createTextNode(
        ' (packages/agent-ui/app/src/controls/settings/store.ts) — one method, get(key): unknown. Any ' +
          'surface already backed by a SettingsStore (the ui-settings persistence seam) already satisfies the ' +
          'export half of this pattern for free; the work is choosing which keys the surface’s own compose/run ' +
          'logic reads (step 2), a validator for that surface’s entry shapes (step 3), and a round-trip test ' +
          'through the surface’s real composing logic (step 4). Reach for this shape — envelope, pure export, ' +
          'fail-closed mint-on-import, round-trip-through-the-real-consumer proof — instead of growing a second, ' +
          'bespoke import/export format elsewhere in the fleet.',
      ),
    ]),
    el('p', {}, [
      document.createTextNode('The shipped instance, end to end: '),
      codeChip('site/pages/agent-admin-persona-file.ts'),
      document.createTextNode(' (the mechanism) and '),
      codeChip('site/pages/agent-admin-persona-file.test.ts'),
      document.createTextNode(
        ' (the round-trip proof — export → import → byte-identical composed system prompt + deep-equal ' +
          'store snapshot, driven through the real ui-agent-admin component, GH #406).',
      ),
    ]),
  ),
)

// ── small local DOM helpers (page-local scaffold only; no per-fact data lives here) ──────────────────────

function olItem(strongText: string, restText: string): HTMLElement {
  const li = document.createElement('li')
  const strong = document.createElement('strong')
  strong.textContent = strongText
  li.append(strong, ` ${restText}`)
  return li
}

function codeChip(text: string): HTMLElement {
  const code = document.createElement('code')
  code.textContent = text
  return code
}
