// dogfood-descriptor.ts: the PURE half of the dogfood fleet inventory (genui-surface.spec.md SPEC-R13(b),
// LLD-C3). Every function here works over strings: the raw `{name}.md` descriptor texts and the raw
// non-test `.ts` sources of each `components/src/controls/*/` folder. It imports nothing, so
// `scripts/generate-agent-assets.mjs` runs the derivation at build time (it reads the folders off disk)
// and embeds the derived rows as `dogfood-fleet.gen.ts`, which `dogfood-inventory.ts` renders (ADR-0236).
//
// The local, minimal descriptor reader (`splitFrontmatter`, `readTag`, `readAttributes`) exists because
// `gates.test.ts`'s ADR-0137 clause-8 SDK-FREE/ZERO-DEP leg holds `src/agent/` to relative-or-`node:*`
// specifiers, so the real `@agent-ui/components/descriptor` parser cannot be imported here;
// `dogfood-inventory.ts`'s header carries the full ruling. Only the PARSER is local, never the data, and
// `dogfood-inventory-parity.test.ts` (`src/live-agent/`) holds that claim to its word by running both
// parsers over every real committed descriptor.

/** One `attributes[]` row's shape this module needs — a strict subset of
 *  `@agent-ui/components/descriptor`'s `ParsedAttribute` (name/type/values only; default/reflect are
 *  irrelevant to a teaching inventory). Exported: `dogfood-inventory-parity.test.ts` (`src/live-agent/`)
 *  compares this shape directly against the real parser's own `ParsedAttribute[]`. */
export interface LocalAttribute {
  name: string
  type?: string
  values?: string[]
}

/** One discovered control: its tag, a one-line role summary (the descriptor's own prose body, first
 *  sentence — never hand-written, so it can never drift from what the component's own docs say), the
 *  rendered attrs clause, and its compound family's SIBLING tags (GH #346) — the self-defined `ui-*`
 *  elements that ride this descriptor rather than carrying one of their own. */
export interface DogfoodControl {
  readonly tag: string
  readonly summary: string
  readonly attrs: string
  readonly siblings: readonly string[]
}

/** One `components/src/controls/*` folder as raw text: its `.md` descriptor texts and its non-test `.ts`
 *  source texts (one level deep). The input `deriveDogfoodFleet` derives rows from. */
export interface DogfoodFolder {
  readonly descriptors: readonly string[]
  readonly sources: readonly string[]
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

/** Every `.define('ui-x'` call site in one control family's own source texts — the SAME method-call scan
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
 *  Scanned over the family's own committed SOURCE (`*.ts`, non-test, one level deep — the fence the
 *  callers walk to build each `DogfoodFolder`), never the built bundle: a nested `dogfood/` sibling (the
 *  generated asset module, whose `DOGFOOD_JS` string is full of real `.define("ui-…")` bytes) is a
 *  DIRECTORY, so the one-level-deep `*.ts` filter never reads it. */
function definedTagsIn(sources: readonly string[]): Set<string> {
  const tagRe = /\.define\((["'`])(ui-[a-z0-9-]+)\1/g
  const tags = new Set<string>()
  for (const source of sources) {
    const src = stripComments(source)
    for (const m of src.matchAll(tagRe)) tags.add(m[2]!)
  }
  return tags
}

/** Derive one `DogfoodControl` row per `{name}.md` descriptor across the given control folders, sorted by
 *  tag (`localeCompare`, the order `dogfoodInventory` renders). A descriptor missing a `tag:` scalar
 *  (structurally invalid — `validateComponentDescriptor`'s own concern, not this function's) is skipped
 *  rather than surfaced as an untagged row; a folder with no tagged descriptor contributes no row.
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
export function deriveDogfoodFleet(folders: readonly DogfoodFolder[]): DogfoodControl[] {
  const parsed: { sources: readonly string[]; descriptors: { tag: string; summary: string; attrs: string }[] }[] = []
  const descriptorTags = new Set<string>()
  for (const folder of folders) {
    const descriptors: { tag: string; summary: string; attrs: string }[] = []
    for (const src of folder.descriptors) {
      const { fence, body } = splitFrontmatter(src)
      const tag = readTag(fence)
      if (tag === undefined) continue
      descriptors.push({ tag, summary: firstSentence(body), attrs: renderAttrs(readAttributes(fence)) })
      descriptorTags.add(tag)
    }
    parsed.push({ sources: folder.sources, descriptors })
  }
  // Second pass — siblings can only be recognised once EVERY descriptor tag in the fleet is known.
  const controls: DogfoodControl[] = []
  for (const { sources, descriptors } of parsed) {
    if (descriptors.length === 0) continue
    const siblings = [...definedTagsIn(sources)].filter((t) => !descriptorTags.has(t)).sort()
    // ATTRIBUTION, when a folder carries MORE THAN ONE descriptor — four do today: `radio` (2),
    // `split` (2), `swiper` (5), `toast` (2). Siblings ride the descriptor whose tag sorts FIRST, and
    // the sort is applied HERE rather than assumed: `descriptors` follows the caller's file order,
    // which is not guaranteed stable across filesystems, so without this line attribution is
    // genuinely non-deterministic (review-caught, GH #351 F1 — a `.define` planted in
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
    controls.push({ ...first!, siblings })
    for (const d of rest) controls.push({ ...d, siblings: [] })
  }
  return controls.sort((a, b) => a.tag.localeCompare(b.tag))
}
