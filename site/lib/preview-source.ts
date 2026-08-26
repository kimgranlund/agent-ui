// site/lib/preview-source.ts — LLD-C1/C2 (`component-preview-code-tabs.lld.md`, GH #1664): the pure source
// generators + the CSS-tab token resolver behind <component-preview>'s tabbed code view. A DELIBERATELY pure
// module — no import from component-preview.ts (so no cycle), no DOM writes of its own (`cssTokenSource`
// only READS via `getComputedStyle`) — every caller-side shape (`KnobLike`, `#state`, sample attrs/children,
// the a2ui JSONL lines, the live root) is passed in as plain data. §3 of the LLD is the frozen contract these
// four functions implement; see that file for the full "mirrors #applyKnob/#rootProps EXACTLY" semantics.

import { descriptorKeyByTag } from './frontmatter.ts'

/** The minimal knob shape the generators need — structurally satisfied by component-preview's internal
 *  `Knob` (name + kind); deliberately NOT an import from component-preview.ts (kept this module cycle-free). */
export interface KnobLike {
  readonly name: string
  readonly kind: string
}

// Mirrors component-preview.ts's own SLOT_TEXT sentinel — kept as a local literal (not imported) for the
// same cycle-free reason KnobLike is a structural shape rather than an import.
const SLOT_TEXT = '#text'

/** Escape the four HTML-significant characters (E10 — output correctness only: `projectHighlight` always
 *  writes via `createTextNode`/`textContent`, so there is no runtime injection surface either way; this is
 *  about the GENERATED TEXT reading as valid, safe markup when a human copies it out). */
function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * generateComponentHtml — the HTML tab (component mode). Mirrors component-preview.ts's own `#applyKnob`
 * EXACTLY: `kind: 'skip'` knobs are omitted; a boolean knob renders as a bare attribute when its raw value is
 * `'true'`, and is absent otherwise (never `="false"`); the `SLOT_TEXT` sentinel renders as an escaped TEXT
 * CHILD, never an attribute; an `undefined`/`''` raw value omits the attribute entirely; every other knob
 * renders `name="escaped value"`. `sampleAttrs` (COMPONENT_SAMPLE_ATTRS) render as ordinary attributes,
 * seeded BEFORE the knob loop (the same order `#buildComponent` itself applies them in); `sampleChildren` is
 * the CALLER's own pre-serialized, pre-indented outerHTML of a fresh `COMPONENT_SAMPLE_CHILDREN[tag]()` call
 * (this module holds no DOM element factory of its own) — `''` when the target has none.
 */
export function generateComponentHtml(
  tag: string,
  knobs: readonly KnobLike[],
  state: ReadonlyMap<string, string>,
  sampleAttrs: Readonly<Record<string, string>>,
  sampleChildren: string,
): string {
  const attrs: string[] = []
  let textChild: string | undefined

  for (const [name, value] of Object.entries(sampleAttrs)) attrs.push(`${name}="${escapeHtml(value)}"`)

  for (const knob of knobs) {
    if (knob.name === SLOT_TEXT) {
      textChild = escapeHtml(state.get(knob.name) ?? '')
      continue
    }
    if (knob.kind === 'skip') continue
    const raw = state.get(knob.name)
    if (knob.kind === 'boolean') {
      if (raw === 'true') attrs.push(knob.name)
      continue
    }
    if (raw === undefined || raw === '') continue
    attrs.push(`${knob.name}="${escapeHtml(raw)}"`)
  }

  const openTag = attrs.length > 0 ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`
  const body = textChild !== undefined ? textChild : sampleChildren !== '' ? `\n${sampleChildren}\n` : ''
  return `${openTag}${body}</${tag}>`
}

/**
 * generateComponentJs — the JS tab (component mode). `document.createElement` + property assignments, typed
 * the same way component-preview.ts's own `#rootProps` types an a2ui root's props, with ONE deliberate
 * correction: a boolean knob assigns `el.name = true` ONLY when its raw value is `'true'` and is OMITTED
 * (never `= false`) otherwise — matching the sibling HTML tab's absent-attribute default, rather than
 * `#rootProps`'s always-explicit boolean. A number knob assigns `Number(raw)`, omitted when non-finite; every
 * other kind assigns `JSON.stringify(raw)`. `kind: 'skip'` is omitted. `SLOT_TEXT` assigns
 * `el.textContent = JSON.stringify(text)`. `sampleAttrs` seed via `el.setAttribute(...)` BEFORE the knob
 * loop (the same order `#buildComponent` applies them in). Closes with `document.body.append(el)`.
 */
export function generateComponentJs(
  tag: string,
  knobs: readonly KnobLike[],
  state: ReadonlyMap<string, string>,
  sampleAttrs: Readonly<Record<string, string>>,
): string {
  const lines: string[] = [`const el = document.createElement('${tag}')`]

  for (const [name, value] of Object.entries(sampleAttrs)) {
    lines.push(`el.setAttribute('${name}', ${JSON.stringify(value)})`)
  }

  for (const knob of knobs) {
    if (knob.name === SLOT_TEXT) {
      lines.push(`el.textContent = ${JSON.stringify(state.get(knob.name) ?? '')}`)
      continue
    }
    if (knob.kind === 'skip') continue
    const raw = state.get(knob.name)
    if (raw === undefined || raw === '') continue
    if (knob.kind === 'boolean') {
      if (raw === 'true') lines.push(`el.${knob.name} = true`)
      continue
    }
    if (knob.kind === 'number') {
      const n = Number(raw)
      if (Number.isFinite(n)) lines.push(`el.${knob.name} = ${n}`)
      continue
    }
    lines.push(`el.${knob.name} = ${JSON.stringify(raw)}`)
  }

  lines.push('document.body.append(el)')
  return lines.join('\n')
}

/**
 * formatA2uiJson — the JSON tab (a2ui mode). Input IS `#a2uiPayload()`'s two JSONL lines verbatim; output is
 * each line parsed and re-stringified with 2-space indent, joined by a blank line — the literal JSONL a real
 * renderer ingests, pretty-printed for reading, NOT a fresh derivation (E7: two pretty-printed objects, not
 * one JSON document — the renderer's actual wire shape).
 */
export function formatA2uiJson(lines: readonly [string, string]): string {
  return lines.map((line) => JSON.stringify(JSON.parse(line), null, 2)).join('\n\n')
}

// ── LLD-C2 — the CSS-tab token source ───────────────────────────────────────────────────────────────────────
// The proven `import.meta.glob(..., { query: '?raw', import: 'default', eager: true })` bulk raw-import
// pattern already used 3x in site/lib (frontmatter.ts / component-gallery.ts / theme-loader.ts) — the exact
// same relative base (site/lib/) as frontmatter.ts's own ALL_DESCRIPTORS glob, so a descriptor glob KEY's
// `.md` → `.css` swap lands on a REAL key in this map (the LLD §5 basename invariant).
const CONTROL_CSS_SOURCES = import.meta.glob('../../packages/agent-ui/components/src/controls/*/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Every distinct `--md-sys-[\w-]+` name referenced via `var(...)` anywhere in `css`, in FIRST-appearance
 *  (source) order, deduped. */
function extractMdSysTokenNames(css: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const m of css.matchAll(/var\(\s*(--md-sys-[\w-]+)/g)) {
    const name = m[1] as string
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/**
 * cssTokenSource — the CSS tab (both modes). Resolves `tag` → its OWN control's `.css` source via
 * `descriptorKeyByTag` + the raw-CSS glob above (correlation by DESCRIPTOR, never folder name — the
 * radio/split/swiper/toast multi-doc-folder precedent), extracts every distinct `--md-sys-*` token name that
 * stylesheet references via `var(...)` (deduped, source order — deliberately NOT selector/state-matched, LLD
 * §5), and resolves each to its CURRENT computed value on `liveRoot` (custom properties inherit, so the live
 * specimen's computed value already reflects whichever cascade branch — scheme/density/scale/knob-driven
 * attribute state — is active). Renders a legible `tag { ... }` block (the tag as selector, light DOM, no
 * `:host`). An unresolvable tag / missing stylesheet / empty extraction / null `liveRoot` degrades to a
 * SINGLE CSS comment line naming the reason (E2/E5) — this function never throws.
 */
export function cssTokenSource(tag: string, liveRoot: Element | null): string {
  const descriptorKey = descriptorKeyByTag(tag)
  if (descriptorKey === undefined) return `/* no descriptor found for "${tag}" — cannot resolve its stylesheet */`

  const cssKey = descriptorKey.replace(/\.md$/, '.css')
  const css = CONTROL_CSS_SOURCES[cssKey]
  if (css === undefined) return `/* "${tag}" has no stylesheet at ${cssKey} */`

  const names = extractMdSysTokenNames(css)
  if (names.length === 0) return `/* "${tag}"'s stylesheet references no --md-sys-* tokens */`

  if (liveRoot === null) return `/* "${tag}"'s live root is not available yet */`

  const computed = getComputedStyle(liveRoot)
  const lines = names.map((name) => `  ${name}: ${computed.getPropertyValue(name).trim()};`)
  return (
    `${tag} {\n` +
    `  /* --md-sys tokens this control's stylesheet consumes, resolved for the current state */\n` +
    `${lines.join('\n')}\n` +
    `}`
  )
}
