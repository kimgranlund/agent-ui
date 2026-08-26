#!/usr/bin/env node
// catalog-attr-diff.mjs — GH #1637: a real catalog-vs-component prop-diff, attributes-only and alias-aware.
//
// Diffs every packages/agent-ui/a2ui/src/catalog/default/catalog.json component entry against the REAL
// reflected-attribute surface its live custom element documents — each `ui-*` control's ADR-0004 descriptor
// `{name}.md` `attributes:` fence, read through the SAME canonical parser the contract↔props trip-wire uses
// (component-descriptor.ts's `parseDescriptor`), never a bespoke regex. `parseDescriptor` shapes ONLY the
// `attributes:` sequence into `.attributes` — `parts:`/`events:` are separate top-level sequences it never
// touches, so this script cannot repeat the prior attempt's parts/events bleed-through (GH #1637's own root
// cause) by construction, not by a filter bolted on after.
//
// Resolution is TAG-INDEXED, not path-guessed: every descriptor's OWN frontmatter `tag:` field is read (via
// the same parser) to build a tag→file index, so a family file living under a differently-named folder
// (radio-group.md under controls/radio/, split-pane.md under controls/split/, swiper-item.md under
// controls/swiper/) resolves correctly with no alias needed — only a catalog name whose REAL tag has no
// dedicated frontmatter declaration anywhere needs the explicit ALIAS_TABLE below.
//
// Verified against the full 80-entry catalog (2026-08-25) exactly nine such names exist — three shapes:
//   (a) sanctioned NON-`ui-*` primitives (Option, MenuItem — factories.ts's own comment: "the Option
//       precedent, a sanctioned NON-ui-* primitive"): no ADR-0004 fence exists for them at all.
//   (b) a real tag whose naive kebab-case guess is WRONG (AudioPlayer — the live tag is `ui-audio`
//       (audio.ts's own `customElements.define`), not the guessable `ui-audio-player`; audio.md documents it
//       directly once the tag is corrected).
//   (c) a real, distinct custom-element tag documented ONLY in a shared family `.md`'s PROSE, never its own
//       attributes: fence (CardHeader/CardContent/CardFooter share card.md, whose fence covers ui-card only;
//       Tab/TabPanel share tabs.md, whose fence covers ui-tabs only; DrillPanel has no .md at all — drill.md
//       covers ui-drill only). Diffing these against the family fence would fabricate false positives (the
//       family's OWN axes flagged "missing", the sub-element's real props flagged "extra") — worse than the
//       parts/events bleed-through this script exists to fix. They report `no-descriptor` instead: correct
//       non-coverage, not a defect.
//
// The ticket's own hand-picked examples for two of the nine were themselves imprecise (`MenuItem→ui-menu-item`
// — no such tag exists; `AudioPlayer→ui-audio-player` — ditto) — corrected below against the live source
// (factories.ts's own `tag:` literals + each control's `customElements.define` call), per the ticket's own
// instruction to verify/extend rather than assume the hand count exhaustive.
//
// Usage: node scripts/catalog-attr-diff.mjs [--json]
// Report-only — always exits 0. `--json` prints the structured rows instead of the text table (piping into
// another tool, or diffing two runs).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { splitFrontmatter, parseDescriptor } from '../packages/agent-ui/components/src/descriptor/component-descriptor.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const CATALOG_PATH = join(repoRoot, 'packages/agent-ui/a2ui/src/catalog/default/catalog.json')
const CONTROLS_DIR = join(repoRoot, 'packages/agent-ui/components/src/controls')

/**
 * The nine catalog names a naive kebab-case transform cannot resolve to a usable descriptor (see the file
 * banner's three shapes). `null` ⇒ no ADR-0004 fence exists anywhere for the real element (shape a). A
 * string ⇒ the real tag (shapes b/c) — still resolved through the tagToFile index below, so a shared-family
 * tag with no OWN fence (shape c) still correctly falls through to `no-descriptor`, never a fabricated diff
 * against an unrelated fence.
 */
const ALIAS_TABLE = {
  Option: null,
  MenuItem: null,
  AudioPlayer: 'ui-audio',
  CardHeader: 'ui-card-header',
  CardContent: 'ui-card-content',
  CardFooter: 'ui-card-footer',
  Tab: 'ui-tab',
  TabPanel: 'ui-tab-panel',
  DrillPanel: 'ui-drill-panel',
}

const kebab = (name) => name.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase()

const resolveTag = (name) => (Object.hasOwn(ALIAS_TABLE, name) ? ALIAS_TABLE[name] : `ui-${kebab(name)}`)

/** Every descriptor `.md` under controls/**, keyed by its OWN frontmatter `tag:` (never a path guess). */
function buildTagIndex() {
  const tagToFile = new Map()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        const src = readFileSync(full, 'utf8')
        if (!src.startsWith('---\n')) continue
        const { fence } = splitFrontmatter(src)
        const tag = parseDescriptor(fence).scalars.get('tag')
        if (tag) tagToFile.set(tag, full)
      }
    }
  }
  walk(CONTROLS_DIR)
  return tagToFile
}

/**
 * The descriptor-type-kind(s) a catalog PropDef's `type` is compatible with. `enum` short-circuits (a
 * `type: 'string', enum: [...]` is ALWAYS descriptor `enum`, never plain `string`). Otherwise every
 * JSON-schema type token in `type.type` (a bare string, or a union array for a bindable value/index prop —
 * e.g. Tabs.selected `['string','number']`, Table.sort `['object','null']`) maps onto the ADR-0173 vocabulary;
 * `null` (an optional-bindable union member) contributes no kind of its own and is dropped, never compared.
 */
function acceptableDescriptorTypes(catalogType) {
  if (catalogType.enum) return new Set(['enum'])
  const tokens = Array.isArray(catalogType.type) ? catalogType.type : [catalogType.type]
  const kinds = new Set()
  for (const t of tokens) {
    if (t === 'array' || t === 'object') kinds.add('json') // reflect:false JSON-typed attrs (Drill.path, Table.sort)
    else if (t !== 'null') kinds.add(t) // 'string' | 'boolean' | 'number' pass through as-is
  }
  return kinds
}

/** Diff one resolved component's catalog properties against its descriptor's attributes[]. */
function diffComponent(name, catalogProps, descriptorPath) {
  const src = readFileSync(descriptorPath, 'utf8')
  const { fence } = splitFrontmatter(src)
  const desc = parseDescriptor(fence)
  const attrsByName = new Map(desc.attributes.filter((a) => a.name).map((a) => [a.name, a]))
  const propertyOnlyNames = new Set(
    (desc.sequences.get('properties') ?? []).map((item) => item.get('name')).filter((n) => typeof n === 'string'),
  )

  const missing = []
  const staleEnum = []
  const typeMismatch = []
  const extraUnknown = []
  const covered = new Set()

  for (const [propName, propDef] of Object.entries(catalogProps)) {
    const mapsTo = propDef.mapsTo ?? propName
    if (mapsTo === 'textContent') continue // light-DOM content, never a reflected attribute (the ui-text `text` precedent) — not a defect

    const attr = attrsByName.get(mapsTo)
    if (!attr) {
      if (propertyOnlyNames.has(mapsTo)) continue // documented as a JS-only `properties:` accessor, not an attribute — expected, not a drift
      extraUnknown.push(`${propName}${propName !== mapsTo ? ` (mapsTo: ${mapsTo})` : ''}`)
      continue
    }
    covered.add(mapsTo)

    const acceptable = acceptableDescriptorTypes(propDef.type)
    if (!acceptable.has(attr.type)) {
      typeMismatch.push(`${propName}: catalog=${[...acceptable].join('|')} descriptor=${attr.type ?? '?'}`)
      continue
    }
    if (attr.type === 'enum') {
      const catalogValues = (propDef.type.enum ?? []).map(String)
      const descValues = attr.values ?? []
      const sameSet = catalogValues.length === descValues.length && catalogValues.every((v) => descValues.includes(v))
      if (!sameSet) {
        staleEnum.push(`${propName}: catalog=[${catalogValues.join(', ')}] descriptor=[${descValues.join(', ')}]`)
      }
    }
  }

  for (const attrName of attrsByName.keys()) {
    if (!covered.has(attrName)) missing.push(attrName)
  }

  return { missing, staleEnum, typeMismatch, extraUnknown }
}

function run() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  const tagToFile = buildTagIndex()
  const names = Object.keys(catalog.components)
  const rows = []

  for (const name of names) {
    const tag = resolveTag(name)
    const descriptorPath = tag === null ? undefined : tagToFile.get(tag)
    if (!descriptorPath) {
      rows.push({
        component: name,
        tag: tag ?? '(non-ui-* primitive)',
        status: 'no-descriptor',
        missing: [],
        staleEnum: [],
        typeMismatch: [],
        extraUnknown: [],
      })
      continue
    }
    const { missing, staleEnum, typeMismatch, extraUnknown } = diffComponent(name, catalog.components[name].properties ?? {}, descriptorPath)
    const status =
      missing.length === 0 && staleEnum.length === 0 && typeMismatch.length === 0 && extraUnknown.length === 0
        ? 'match'
        : [
            missing.length > 0 && 'missing-from-catalog',
            staleEnum.length > 0 && 'stale-enum-value(s)',
            typeMismatch.length > 0 && 'type-mismatch',
            extraUnknown.length > 0 && 'catalog-has-extra-unknown-prop',
          ]
            .filter(Boolean)
            .join('; ')
    rows.push({ component: name, tag, status, missing, staleEnum, typeMismatch, extraUnknown })
  }

  return rows
}

function printTable(rows) {
  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  console.log(`catalog-attr-diff: ${rows.length} catalog entries\n`)
  for (const row of rows) {
    if (row.status === 'match') continue
    console.log(`${row.component}  [${row.tag}]  ${row.status}`)
    for (const m of row.missing) console.log(`    missing-from-catalog: ${m}`)
    for (const s of row.staleEnum) console.log(`    stale-enum-value(s): ${s}`)
    for (const t of row.typeMismatch) console.log(`    type-mismatch: ${t}`)
    for (const e of row.extraUnknown) console.log(`    catalog-has-extra-unknown-prop: ${e}`)
  }
  console.log('\nsummary:')
  for (const [status, count] of Object.entries(counts).sort()) console.log(`  ${status}: ${count}`)
}

function main() {
  const rows = run()
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else printTable(rows)
}

main()
