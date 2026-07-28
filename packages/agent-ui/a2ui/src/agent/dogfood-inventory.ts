// dogfood-inventory.ts — genui-surface.spec.md SPEC-R13(b): the DERIVED fleet inventory the dogfood
// prompt segment teaches (LLD-C3) — one line per `ui-*` control, read from the SAME `{name}.md`
// descriptor frontmatter ADR-0004 already establishes as each component's public-surface contract.
//
// LLD-C3's own text names "the ONE ADR-0004 parser (`@agent-ui/components/descriptor`)" — but that
// import is a BARE package specifier, and `gates.test.ts`'s ADR-0137 clause-8 SDK-FREE/ZERO-DEP leg
// (measured RED against this exact import while building this module) holds `src/agent/` to relative-
// or-`node:*`-only specifiers, no exception: the package-layering lawfulness LLD-C3 cites (a2ui already
// depends on components) is a DIFFERENT axis from this internal zero-dep fence, which the LLD did not
// anticipate. Rather than widen a deliberately narrow, already-ratified gate, this module carries a
// LOCAL, MINIMAL reader for exactly the two fields it needs (`tag:` + `attributes[].{name,type,values}`)
// — the SAME local-copy resolution `catalog/conformance.ts`'s `SAFE_HREF_SCHEMES` already establishes in
// this codebase for an analogous reachability constraint. It reads the REAL committed `.md` text (never
// hand-transcribed data), so SPEC-R13(b)'s drift-free derivation guarantee holds exactly as designed —
// only the PARSER is local, not the data.
//
// NEVER byte-captured: a fleet edit (a new control, a changed attribute, reworded descriptor prose)
// changes this function's OUTPUT on its very next call, with no baseline to re-capture —
// `prompt-drift.test.ts`'s inventory leg is the drift gate that holds it honest (ADR-0071's discipline,
// extended here to a non-catalog surface: the fleet's WHOLE `controls/` barrel, not the a2ui catalog's
// subset).
//
// Node-only tooling (readdirSync/readFileSync), never a browser bundle (SPEC-N1/N2) — a twin of
// `system-prompt.ts`'s `PROMPTS_DIR` resolution: paths resolve from `process.cwd()`, never
// `import.meta.url` (ADR-0135/TKT-0044 — the vite-temp bundling trap that broke exactly this shape
// once). `gates.test.ts`'s NODE-FENCE leg's `NODE_ALLOWED` set names this file alongside
// `system-prompt.ts`/`mini-skills.ts`/`prompts/genui-packs.ts` — the SAME "Node-only prompt/asset
// loader" class those three already are.

import { readdirSync, readFileSync, statSync } from 'node:fs'

declare const process: { cwd(): string }

const CONTROLS_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls`

/** One `attributes[]` row's shape this module needs — a strict subset of
 *  `@agent-ui/components/descriptor`'s `ParsedAttribute` (name/type/values only; default/reflect are
 *  irrelevant to a teaching inventory). */
interface LocalAttribute {
  name: string
  type?: string
  values?: string[]
}

/** Split the leading `---`…`---` frontmatter fence from the prose body — the SAME two-group shape
 *  `component-descriptor.ts`'s `splitFrontmatter` uses (ADR-0004), reimplemented locally per this
 *  file's header note. Throws if there is no fence (every real `{name}.md` has one; a malformed file is
 *  `validateComponentDescriptor`'s concern, not this module's). */
function splitFrontmatter(src: string): { fence: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src)
  if (!m) throw new Error('dogfood-inventory: source has no leading --- frontmatter fence')
  return { fence: m[1]!, body: m[2]! }
}

/** Read the top-level `tag:` scalar out of a frontmatter fence (a column-0 line, ADR-0004's `tag:
 *  ui-{name}` field) — `undefined` when absent (a structurally invalid descriptor; skipped by the
 *  caller rather than surfaced as an untagged row). */
function readTag(fence: string): string | undefined {
  return /^tag:\s*(\S+)/m.exec(fence)?.[1]
}

/** Read the `attributes[]` sequence block out of a frontmatter fence — every `- name: X` item up to the
 *  next column-0 `key:` line (or end of fence), pulling `type:`/`values: [a, b]` from each item's
 *  indented child lines. A minimal, deliberately narrower re-implementation of
 *  `component-descriptor.ts`'s general `parseSequence`/`toAttribute` (this module's header note) —
 *  sufficient for the two fields (`type`, `values`) a teaching line renders. */
function readAttributes(fence: string): LocalAttribute[] {
  const start = /^attributes:.*$/m.exec(fence)
  if (!start) return []
  const rest = fence.slice(start.index + start[0].length)
  const end = /\n[A-Za-z][\w]*:/.exec(rest)
  const block = end ? rest.slice(0, end.index) : rest
  const attrs: LocalAttribute[] = []
  let current: LocalAttribute | null = null
  for (const line of block.split('\n')) {
    const nameMatch = /^\s*-\s*name:\s*(\S+)/.exec(line)
    if (nameMatch) {
      current = { name: nameMatch[1]! }
      attrs.push(current)
      continue
    }
    if (!current) continue
    const typeMatch = /^\s*type:\s*(\S+)/.exec(line)
    if (typeMatch) {
      current.type = typeMatch[1]
      continue
    }
    const valuesMatch = /^\s*values:\s*\[(.*)\]/.exec(line)
    if (valuesMatch) {
      current.values = valuesMatch[1]!
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
    }
  }
  return attrs
}

/** SPEC-R13(b) — the derived-inventory budget: ≤ 16 000 chars (the SPEC-R9 pack-tier's double, since
 *  this segment teaches the WHOLE fleet, not one exemplar pack). Evidence-revisable per SPEC §8;
 *  enforced by a standing test (`prompt-drift.test.ts`), never by runtime truncation — the derived
 *  output is the fleet's whole truth or nothing, never a silently-clipped subset. */
export const DOGFOOD_INVENTORY_CHAR_BUDGET = 16_000

/** One discovered control: its tag, a one-line role summary (the descriptor's own prose body, first
 *  sentence — never hand-written, so it can never drift from what the component's own docs say), and
 *  the rendered attrs clause. */
interface DogfoodControl {
  tag: string
  summary: string
  attrs: string
}

/** The per-control summary's hard character ceiling (word-boundary trimmed) — deliberately short: 59
 *  controls × a full-sentence summary blew the SPEC-R13(b) 16 000-char budget (measured 18 117 chars
 *  building this module), so the summary is a TERSE role tag, not the descriptor's whole opening
 *  sentence — density over completeness, matching this seat's own briefed instruction. */
const SUMMARY_CHAR_CAP = 110

/** A terse one-line role summary of the descriptor's prose body (everything after the frontmatter
 *  fence) — the SAME `# ui-x` heading's opening paragraph every real `{name}.md` leads with
 *  (button.md/card.md/... house style: "`ui-x` is the ..."). Strips the redundant self-reference (the
 *  bullet already names the tag) and markdown emphasis noise (backticks/`**`), then hard-caps at
 *  `SUMMARY_CHAR_CAP` on a word boundary — never the whole first sentence, which routinely runs past
 *  200 characters in the fleet's ADR-citation-heavy house style and blew the inventory's char budget. */
function firstSentence(body: string): string {
  const afterHeading = body.replace(/^\s*#[^\n]*\n+/, '') // drop the leading `# ui-x` heading line
  const paragraphEnd = afterHeading.search(/\n\s*\n|\n```/)
  const paragraph = paragraphEnd === -1 ? afterHeading : afterHeading.slice(0, paragraphEnd)
  const noMarkdown = paragraph.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1')
  const flat = noMarkdown.replace(/\s+/g, ' ').trim()
  // Drop a leading "ui-x is/are the/a/an " self-reference — the bullet prefix already names the tag.
  const deSelfRef = flat.replace(/^ui-[a-z0-9-]+ (?:is|are) (?:the |an? )?/i, '')
  const capitalized = deSelfRef.length > 0 ? deSelfRef[0]!.toUpperCase() + deSelfRef.slice(1) : deSelfRef
  if (capitalized.length <= SUMMARY_CHAR_CAP) return capitalized
  const cut = capitalized.lastIndexOf(' ', SUMMARY_CHAR_CAP)
  return `${capitalized.slice(0, cut === -1 ? SUMMARY_CHAR_CAP : cut)}…`
}

/** Render one descriptor's `attributes[]` as `name: type|enum(a|b|c)` clauses — `describePropType`'s
 *  shape (`system-prompt.ts`'s catalog-inventory precedent), applied to the descriptor's OWN declared
 *  set (never a further-picked subset, LLD-C3). */
function renderAttrs(attributes: readonly LocalAttribute[]): string {
  if (attributes.length === 0) return 'none'
  return attributes
    .map((a) => {
      const shape = a.type === 'enum' && a.values && a.values.length > 0 ? `enum(${a.values.join('|')})` : (a.type ?? 'unknown')
      return `${a.name}: ${shape}`
    })
    .join(', ')
}

/** Discover every `{name}.md` descriptor under `controls/*` (one level deep — the ADR-0004 fence every
 *  real control carries; `_base`/`_surface`/`_token-surface` hold no `.md` and are naturally skipped) and
 *  parse each into a `DogfoodControl` row. A descriptor missing a `tag:` scalar (structurally invalid —
 *  `validateComponentDescriptor`'s own concern, not this function's) is skipped rather than surfaced as
 *  an untagged row. */
function discoverDogfoodControls(): DogfoodControl[] {
  const controls: DogfoodControl[] = []
  for (const dirName of readdirSync(CONTROLS_DIR)) {
    const dirPath = `${CONTROLS_DIR}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith('.md')) continue
      const src = readFileSync(`${dirPath}/${fileName}`, 'utf8')
      const { fence, body } = splitFrontmatter(src)
      const tag = readTag(fence)
      if (tag === undefined) continue
      controls.push({ tag, summary: firstSentence(body), attrs: renderAttrs(readAttributes(fence)) })
    }
  }
  return controls
}

/** The tags every discovered descriptor declares, tag-sorted — the "inventory-taught tags" half of
 *  SPEC-R13 AC2's set-equality gate (LLD-C5). Exposed standalone so that gate never has to re-parse the
 *  composed prose to recover the tag set. */
export function dogfoodInventoryTags(): readonly string[] {
  return discoverDogfoodControls()
    .map((c) => c.tag)
    .sort()
}

/**
 * The derived fleet inventory (SPEC-R13(b)): one `- <tag> — <summary> (attrs: ...)` line per discovered
 * control, tag-sorted (deterministic — LLD-C3 leaf 8's unit test asserts stable, repeated-call-identical
 * output). `tags`, when given, restricts the rendered rows to that set — the shape LLD-C5's set-equality
 * gate needs to probe both directions (the full discovered set vs. `DOGFOOD_TAGS`, and `DOGFOOD_TAGS`
 * filtered back through this same function). The real composition call in `system-prompt.ts`'s
 * `genuiBlock` passes no argument, so a live turn always teaches every control the fleet documents.
 */
export function dogfoodInventory(tags?: readonly string[]): string {
  const allow = tags === undefined ? undefined : new Set(tags)
  const controls = discoverDogfoodControls()
    .filter((c) => allow === undefined || allow.has(c.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag))
  return controls.map((c) => `- ${c.tag} — ${c.summary} (attrs: ${c.attrs})`).join('\n')
}
