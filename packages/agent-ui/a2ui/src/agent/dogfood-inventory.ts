// dogfood-inventory.ts — genui-surface.spec.md SPEC-R13(b): the DERIVED fleet inventory the dogfood
// prompt segment teaches (LLD-C3) — one line per `ui-*` control, read from the SAME `{name}.md`
// descriptor frontmatter ADR-0004 already establishes as each component's public-surface contract,
// plus each compound family's sibling tags scanned from its own `.define('ui-x'` call sites (GH #346's
// ruling — `discoverDogfoodControls`'s own note carries the mechanics and the reason).
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
// only the PARSER is local, not the data. That claim is BACKED by a standing parity test
// (`dogfood-inventory-parity.test.ts`, `src/live-agent/` — the real `@agent-ui/components/descriptor`
// parser is a lawful import THERE, outside the `src/agent/` fence), not merely asserted: it runs both
// parsers over every real committed descriptor and asserts attribute-for-attribute agreement. A first
// cut of this reader shipped WITHOUT that test and disagreed with the real parser on 4 real attributes
// (a QUOTED empty-string enum member, `''` — ADR-0083's `landmark` edge case — unquoted by the real
// parser's `addField`, left quoted-verbatim here) — independent review caught it; the parity test now
// holds the "only the parser is local" claim to its word going forward.
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
 *  irrelevant to a teaching inventory). Exported: `dogfood-inventory-parity.test.ts` (`src/live-agent/`)
 *  compares this shape directly against the real parser's own `ParsedAttribute[]`. */
export interface LocalAttribute {
  name: string
  type?: string
  values?: string[]
}

/** Split the leading `---`…`---` frontmatter fence from the prose body — the SAME two-group shape
 *  `component-descriptor.ts`'s `splitFrontmatter` uses (ADR-0004), reimplemented locally per this
 *  file's header note. Throws if there is no fence (every real `{name}.md` has one; a malformed file is
 *  `validateComponentDescriptor`'s concern, not this module's). Exported for the parity test. */
export function splitFrontmatter(src: string): { fence: string; body: string } {
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

/** Drop a single pair of surrounding quotes (e.g. `'null'` → `null`, `''` → `''` empty) — the SAME
 *  `unquote` `component-descriptor.ts:117-121` (`parseDescriptor`'s `addField`) applies to every
 *  `attributes[].values[]` element before this module's local reader existed; the review-caught
 *  reason it must be reproduced HERE too, byte-for-byte. */
function unquote(s: string): string {
  const m = /^(['"])([\s\S]*)\1$/.exec(s)
  return m ? m[2]! : s
}

/** Read the `attributes[]` sequence block out of a frontmatter fence — every `- name: X` item up to the
 *  next column-0 `key:` line (or end of fence), pulling `type:`/`values: [a, b]` from each item's
 *  indented child lines. A minimal, deliberately narrower re-implementation of
 *  `component-descriptor.ts`'s general `parseSequence`/`toAttribute` (this module's header note) —
 *  sufficient for the two fields (`type`, `values`) a teaching line renders. Exported for the parity
 *  test (`dogfood-inventory-parity.test.ts`). */
export function readAttributes(fence: string): LocalAttribute[] {
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
      // Drop a single matching quote pair per element (`component-descriptor.ts`'s own `unquote`,
      // ADR-0083's `landmark`/theme-provider's `scheme`/`scale`/`density` edge case: a QUOTED empty-
      // string enum member, `''`, must unquote to a real empty string — review-caught defect: the
      // FIRST cut of this reader split/trimmed/filtered-blank but never unquoted, so `''` (the quoted
      // token, 2 real characters) survived verbatim into the rendered inventory instead of becoming
      // an empty member, disagreeing with the real parser on 4 attributes across 2 real files).
      current.values = valuesMatch[1]!
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => unquote(s))
    }
  }
  return attrs
}

/** SPEC-R13(b) — the derived-inventory budget: ≤ 16 700 chars (the SPEC-R9 pack-tier's double, since
 *  this segment teaches the WHOLE fleet, not one exemplar pack). Evidence-revisable per SPEC §8;
 *  enforced by a standing test (`prompt-drift.test.ts`), never by runtime truncation — the derived
 *  output is the fleet's whole truth or nothing, never a silently-clipped subset.
 *  REVISED 2026-08-18 (GH #1209): 16 000 → 16 500 — measured 16 336 after the ui-video/ui-audio media
 *  mint (+2 controls); the movers are the two new descriptor role lines, evidence per SPEC §8.
 *  REVISED 2026-08-19 (ADR-0219/GH #1397): 16 500 → 16 700 — measured 16 537 after the ui-pie-chart
 *  control-mint (the chart family's fourth control); the mover is the one new descriptor role line,
 *  evidence per SPEC §8. */
// 2026-08-19 merge rebase: measured 17151 on the tree carrying ui-pie-chart (ADR-0219/GH #1397),
// ui-suggestions (ADR-0213/GH #1393), ui-file-drop (ADR-0210/GH #1391), ui-rating (ADR-0216/GH #1395)
// AND ui-choice-group/ui-choice-card (ADR-0220/GH #1398) descriptors — the full 2026-08-19 nine-ADR
// campaign wave; budget 18_100 (measured 17958 + headroom; SPEC-R13(b) budget line bumped in the same
// change per genui-surface.spec.md §8 — a SPEC version bump, not silent drift).
// 2026-08-19 (ADR-0223 slice 2, GH #1426 + ADR-0224/GH #1429, merged at the desk): the seven
// action/selection controls' `inline` descriptor attribute rows (measured 18179) AND the
// ui-service-card control mint (measured 18296 pre-slice-2) both ride the inventory; budget 18_600
// (combined measured + headroom, GH #1209 format; evidence per SPEC §8 — genui-surface.spec.md v0.8
// amendment, same change — never silent drift).
export const DOGFOOD_INVENTORY_CHAR_BUDGET = 18_600

/** One discovered control: its tag, a one-line role summary (the descriptor's own prose body, first
 *  sentence — never hand-written, so it can never drift from what the component's own docs say), the
 *  rendered attrs clause, and its compound family's SIBLING tags (`familySiblings`, GH #346) — the
 *  self-defined `ui-*` elements that ride this descriptor rather than carrying one of their own. */
interface DogfoodControl {
  tag: string
  summary: string
  attrs: string
  family: string[]
}

/** The per-control summary's hard character ceiling (word-boundary trimmed) — deliberately short: 59
 *  controls × a full-sentence summary blew the SPEC-R13(b) 16 000-char budget (measured 18 117 chars
 *  building this module), so the summary is a TERSE role tag, not the descriptor's whole opening
 *  sentence — density over completeness, matching this seat's own briefed instruction. */
const SUMMARY_CHAR_CAP = 110

/** A trailing function-word (article/negation/conjunction/preposition/pronoun) that reads as a dangling
 *  fragment when it is the LAST word before a truncation ellipsis (review-caught defect: a blind
 *  word-boundary cut routinely lands right after "not"/"a"/"the"/"with" in the fleet's ADR-citation-
 *  heavy house style — 17 of 59 real summaries, measured). Stripped, possibly repeatedly (`"is not"` →
 *  strips "not" → strips "is"), so the cut lands on the last word that reads as a complete thought. */
const DANGLING_TRAILING_WORD = /\s+(?:a|an|the|is|are|was|were|not|no|and|or|but|with|for|to|of|in|on|at|by|its|it's|that|which|who|whose|via|per|as)$/i

/** Cut `text` to fit `cap` characters, clause-aware (review-caught defect: a blind last-space-before-cap
 *  cut produced dangling negations/articles/unclosed parens in 17 of 59 real summaries). Two-tier
 *  strategy: (1) prefer the LAST sentence-ending punctuation (`.`/`!`/`?` followed by whitespace or
 *  end-of-string) within the cap window, as long as it doesn't cut absurdly short (< 40% of the cap —
 *  a defensive floor against a stray abbreviation period near the very start); (2) otherwise, cut at the
 *  last word boundary within the cap, then repeatedly strip a trailing dangling function word, a
 *  trailing comma/semicolon/colon, and — if what remains ends inside an UNMATCHED open paren — everything
 *  from that paren onward, so the result never ends mid-clause. Returns the untruncated `text` unchanged
 *  when it already fits. */
function clauseAwareTruncate(text: string, cap: number): string {
  if (text.length <= cap) return text
  const window = text.slice(0, cap + 1)
  let lastSentenceEnd = -1
  for (const m of window.matchAll(/[.!?](?=\s|$)/g)) lastSentenceEnd = m.index!
  if (lastSentenceEnd !== -1 && lastSentenceEnd >= cap * 0.4) {
    return text.slice(0, lastSentenceEnd + 1)
  }
  const wordCut = text.lastIndexOf(' ', cap)
  let clause = text.slice(0, wordCut === -1 ? cap : wordCut)
  for (;;) {
    const stripped = clause.replace(DANGLING_TRAILING_WORD, '').replace(/[,;:]+$/, '')
    if (stripped === clause) break
    clause = stripped
  }
  const openParenIdx = clause.lastIndexOf('(')
  if (openParenIdx !== -1 && !clause.includes(')', openParenIdx)) {
    clause = clause.slice(0, openParenIdx).trimEnd()
  }
  return `${clause}…`
}

/** A terse one-line role summary of the descriptor's prose body (everything after the frontmatter
 *  fence) — the SAME `# ui-x` heading's opening paragraph every real `{name}.md` leads with
 *  (button.md/card.md/... house style: "`ui-x` is the ..."). Strips the redundant self-reference (the
 *  bullet already names the tag) and markdown emphasis noise (backticks/`**`), then clause-aware-caps at
 *  `SUMMARY_CHAR_CAP` (`clauseAwareTruncate`) — never the whole first sentence, which routinely runs past
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
  return clauseAwareTruncate(capitalized, SUMMARY_CHAR_CAP)
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

/** Blank out `/* … *\/` block comments and `// …` line comments so a COMMENTED-OUT `.define('ui-x')`
 *  can never become a taught tag (review-caught defect, GH #351 F2: a `// TODO(probe): …
 *  customElements.define('ui-swiper-planted', …)` line raised the taught set 64 → 65 — dead code
 *  taught to the model as a real component). `//` preceded by `:` is left alone so a `https://` inside
 *  a string literal is not mistaken for a comment. Exported for the parity/gate tests.
 *
 *  This is a heuristic, not a JS lexer: an unbalanced `/*` inside a string literal would over-strip.
 *  BOTH failure directions are GATED, not assumed, and `dogfood-tag-set-equality.test.ts` is what
 *  gates them — over-stripping DROPS a real define and reds as "shipped but not taught"; under-
 *  stripping ADDS a phantom and reds as "taught but not shipped", against the built bundle AND the
 *  runtime-registration leg independently (measured, GH #351 re-review). A lexer is the wrong weight
 *  for a scan whose every error is caught loudly, in either direction, by a standing gate. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Every `.define('ui-x'` call site in one control family's own source — the SAME method-call scan
 *  `scripts/build-dogfood-assets.mjs`'s `extractTags` runs over the BUILT bundle to derive
 *  `DOGFOOD_TAGS` (LLD-C1: the `.define(` method-call form, all three quote characters, deliberately
 *  not the full `customElements.define(` literal a minifier may alias away). Reused verbatim rather
 *  than re-invented — GH #346's own root cause is two derivations that disagreed, and a SECOND,
 *  differently-written scanner would be exactly that bug again. That script is an `.mjs` tool outside
 *  this package, and importing it from here would be a bare specifier the ADR-0137 fence bars, so the
 *  REGEX is what travels; `dogfood-tag-set-equality.test.ts` is the standing gate that holds the two
 *  copies to the same answer over the real tree.
 *
 *  **The one place the reused regex is NOT equivalent — its INPUT CLASS (GH #351 F2).** `extractTags`
 *  runs over the MINIFIED bundle, where comments no longer exist; this runs over RAW COMMITTED SOURCE,
 *  where they do. The identical regex therefore has a failure mode there that it cannot have in the
 *  build script: a commented-out `.define('ui-x')` reads as a real registration. `stripComments` is
 *  what closes that gap, and it is required precisely BECAUSE the regex is shared — the byte-identical
 *  scan is only byte-equivalent once the two inputs are in the same class.
 *
 *  Scanned over the family's own committed SOURCE (`*.ts`, non-test, one level deep — the same fence
 *  `discoverDogfoodControls` walks), never the built bundle: this module reads the source tree, and a
 *  nested `dogfood/` sibling (the generated asset module, whose `DOGFOOD_JS` string is full of real
 *  `.define("ui-…")` bytes) is a DIRECTORY, so the one-level-deep `*.ts` filter never reads it. */
function definedTagsIn(dirPath: string): Set<string> {
  const tagRe = /\.define\((["'`])(ui-[a-z0-9-]+)\1/g
  const tags = new Set<string>()
  for (const fileName of readdirSync(dirPath)) {
    if (!fileName.endsWith('.ts') || fileName.endsWith('.test.ts')) continue
    const src = stripComments(readFileSync(`${dirPath}/${fileName}`, 'utf8'))
    for (const m of src.matchAll(tagRe)) tags.add(m[2]!)
  }
  return tags
}

/** Discover every `{name}.md` descriptor under `controls/*` (one level deep — the ADR-0004 fence every
 *  real control carries; `_base`/`_surface`/`_token-surface` hold no `.md` and are naturally skipped) and
 *  parse each into a `DogfoodControl` row. A descriptor missing a `tag:` scalar (structurally invalid —
 *  `validateComponentDescriptor`'s own concern, not this function's) is skipped rather than surfaced as
 *  an untagged row.
 *
 *  **Family siblings (GH #346, Kim's 2026-07-28 ruling — "extend the derivation").** ADR-0004's schema
 *  has no machine-readable field for a compound family's sub-elements (`card.md`'s own frontmatter says
 *  it outright: "The region sub-elements (ui-card-header/-content/-footer) are documented in the prose
 *  body"; `tabs.md` is the same shape for `ui-tab`/`ui-tab-panel`) — so a strictly `tag:`-derived
 *  inventory STRUCTURALLY cannot see five real, shipped, model-facing tags the bundle self-defines.
 *  The ruling extends the derivation rather than the schema: each family folder is also scanned for its
 *  own `.define('ui-x'` call sites (`definedTagsIn`), and any tag that no descriptor ANYWHERE in the
 *  fleet claims as its own becomes a sibling ON ITS PARENT'S ROW — never a free-floating row, because a
 *  sibling has no descriptor, hence no summary and no attributes of its own to teach. The
 *  fleet-wide-tag exclusion (not merely the folder's own tag) is what keeps a control that happens to
 *  define a neighbour's element from being taught twice. */
function discoverDogfoodControls(): DogfoodControl[] {
  const dirs: { dirPath: string; descriptors: { tag: string; summary: string; attrs: string }[] }[] = []
  const descriptorTags = new Set<string>()
  for (const dirName of readdirSync(CONTROLS_DIR)) {
    const dirPath = `${CONTROLS_DIR}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    const descriptors: { tag: string; summary: string; attrs: string }[] = []
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith('.md')) continue
      const src = readFileSync(`${dirPath}/${fileName}`, 'utf8')
      const { fence, body } = splitFrontmatter(src)
      const tag = readTag(fence)
      if (tag === undefined) continue
      descriptors.push({ tag, summary: firstSentence(body), attrs: renderAttrs(readAttributes(fence)) })
      descriptorTags.add(tag)
    }
    dirs.push({ dirPath, descriptors })
  }
  // Second pass — siblings can only be recognised once EVERY descriptor tag in the fleet is known.
  const controls: DogfoodControl[] = []
  for (const { dirPath, descriptors } of dirs) {
    if (descriptors.length === 0) continue
    const siblings = [...definedTagsIn(dirPath)].filter((t) => !descriptorTags.has(t)).sort()
    // ATTRIBUTION, when a folder carries MORE THAN ONE descriptor — four do today: `radio` (2),
    // `split` (2), `swiper` (5), `toast` (2). Siblings ride the descriptor whose tag sorts FIRST, and
    // the sort is applied HERE rather than assumed: `descriptors` is filled in `readdirSync` order,
    // which is not sorted and is not guaranteed stable across filesystems, so without this line
    // attribution is genuinely non-deterministic (review-caught, GH #351 F1 — a `.define` planted in
    // `swiper/swiper.ts` attached to `ui-swiper-item`, not `ui-swiper`). What tag order buys is
    // DETERMINISM, which is the property that matters here; it does NOT universally pick the family
    // ROOT. The shortest tag sorts first, which IS the root for `split`/`swiper` (`ui-swiper` <
    // `ui-swiper-item`) — but not for `radio`/`toast`, where the container is the LONGER tag by those
    // descriptors' own words (`radio.md`: "`ui-radio` is the radio-button leaf" vs `radio-group.md`'s
    // "container for the radio-button family"; `toast-region.md`: "the top-layer host `ui-toast`
    // instances stack inside"). Latent only — neither folder carries siblings today, and the only two
    // that do (`card`, `tabs`) hold a single descriptor each, so nothing is mis-attributed now. If a
    // sibling ever appears in `radio`/`toast` it would ride the leaf rather than the container: the
    // set-equality gate reds only on an UNTAUGHT tag, not on a wrongly-parented one, so that case
    // needs an explicit parent rule here rather than more sorting.
    const byTag = [...descriptors].sort((a, b) => a.tag.localeCompare(b.tag))
    const [first, ...rest] = byTag
    controls.push({ ...first!, family: siblings })
    for (const d of rest) controls.push({ ...d, family: [] })
  }
  return controls
}

/** Every tag the inventory TEACHES, tag-sorted — each descriptor's own `tag:` scalar PLUS the family
 *  siblings that ride its row (GH #346). The "inventory-taught tags" half of SPEC-R13 AC2's set-equality
 *  gate (LLD-C5), exposed standalone so that gate never has to re-parse the composed prose to recover
 *  the tag set. */
export function dogfoodInventoryTags(): readonly string[] {
  return discoverDogfoodControls()
    .flatMap((c) => [c.tag, ...c.family])
    .sort()
}

/**
 * The derived fleet inventory (SPEC-R13(b)): one `- <tag> — <summary> (attrs: ...)` line per discovered
 * control, tag-sorted (deterministic — LLD-C3 leaf 8's unit test asserts stable, repeated-call-identical
 * output). A compound family's sibling tags close the line as ` (family: ui-a, ui-b)` — attached to the
 * PARENT descriptor's entry, under its own summary and attrs, because that is the only place the fleet
 * documents them (GH #346); they are never rows of their own, having neither summary nor attributes.
 * `tags`, when given, restricts the rendered rows to that set — the shape LLD-C5's set-equality gate
 * needs to probe both directions (the full discovered set vs. `DOGFOOD_TAGS`, and `DOGFOOD_TAGS`
 * filtered back through this same function); a restricted call filters family members by the SAME set,
 * so the function can never teach a tag the caller did not ask for. The real composition call in
 * `system-prompt.ts`'s `genuiBlock` passes no argument, so a live turn always teaches every control the
 * fleet documents.
 */
export function dogfoodInventory(tags?: readonly string[]): string {
  const allow = tags === undefined ? undefined : new Set(tags)
  const controls = discoverDogfoodControls()
    .filter((c) => allow === undefined || allow.has(c.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag))
  return controls
    .map((c) => {
      const family = allow === undefined ? c.family : c.family.filter((t) => allow.has(t))
      const familyClause = family.length === 0 ? '' : ` (family: ${family.join(', ')})`
      return `- ${c.tag} — ${c.summary} (attrs: ${c.attrs})${familyClause}`
    })
    .join('\n')
}
