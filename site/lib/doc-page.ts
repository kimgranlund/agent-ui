// site/lib/doc-page.ts — the SHARED render kit for the T4 component API doc page. Every control's doc page
// (button-doc.ts, text-field-doc.ts, and every future control) is the SECOND consumer of the canonical
// descriptor parser (via lib/frontmatter.ts) and the SECOND consumer of this one renderer — so the API table
// and the prose body are produced by ONE code path, never a per-page hand-copy that could drift between pages.
//
// What lives here is GENERIC (carries no per-control fact): the attribute table built row-by-row from the
// parsed `attributes[]`, the dependency-free markdown body render, and the small DOM helpers. What a page
// keeps LOCAL is only what is genuinely underivable — a markup SHAPE (an anatomy diagram), labelled as
// hand-authored. The table/body here cannot drift from a control's `{name}.md` because they are read straight
// from the parse the contract trip-wire validates (ADR-0004).
import type { ParsedAttribute, ParsedDescriptor, SequenceItem } from '@agent-ui/components/descriptor'
import { codeBlock } from './code-block.ts' // shared `<pre><code>` previews — one chrome for every code sample on the site
import './doc-page.css' // Form-B per-attribute/per-item ROW styling (TKT-0033) + the `.doc-body` prose reading
// design (TKT-0036: measure, heading typescale, tint-only chip register, blockquote treatment) — ONE dedicated
// stylesheet, joined by buildSiteCss the same way every other site/lib/*.css sibling is (component-preview.ts's
// own `import './component-preview.css'` precedent). Deliberately NOT in site/pages/_page.css (a concurrent nav
// wave owns that file this session).

// ── API reference rows (Form B: per-attribute rows — TKT-0033, Kim's ruling) ───────────────────────────────
//
// Every one of the five sibling reference tables (Attributes / Properties / Events / Slots / Parts) now renders
// as the SAME row shape: the entry NAME is a prominent left rail (the scan axis / index — a code chip), and its
// payload flows in a right column as small labelled fields (`.api-field`) — an enum's `values[]` widens into a
// WRAPPED chip-set rather than one long dotted string, a rarely-needed boolean (`reflect` / `optional`) demotes to
// a subtle inline `.api-badge` (shown only when true — the common/false case needs no footnote), and an empty
// default reads as a plain em-dash, never a lonely empty `<code>` chip. `apiRow`/`apiField`/`apiChipset`/`apiBadge`
// below are the ONE set of row-builders both `renderApiTable` and `renderSequenceTable` compose from, so the five
// tables stay one coherent reference pattern rather than five independent designs.

/** apiRow — one reference entry: the NAME as a prominent left-rail code chip, then a flowing right column of
 *  `metaChildren` (fields/badges) and an optional prose `description` paragraph underneath them. Degrades to a
 *  stacked block on narrow widths (doc-page.css's `@media` leg) — no dead horizontal gap at any width. */
function apiRow(name: string, metaChildren: readonly Node[], description?: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'api-row'

  const nameCell = document.createElement('div')
  nameCell.className = 'api-row-name'
  const nameCode = document.createElement('code')
  nameCode.textContent = name
  nameCell.append(nameCode)

  const detail = document.createElement('div')
  detail.className = 'api-row-detail'
  if (metaChildren.length > 0) {
    const meta = document.createElement('div')
    meta.className = 'api-row-meta'
    meta.append(...metaChildren)
    detail.append(meta)
  }
  if (description !== undefined && description !== '' && description !== '—') {
    const p = document.createElement('p')
    p.className = 'api-row-description'
    p.textContent = description
    detail.append(p)
  }

  row.append(nameCell, detail)
  return row
}

/** apiField — one labelled meta value (e.g. "Type" → a chip-set, "Default" → a code chip): a small uppercase
 *  label above the value node, flowing inline with its sibling fields inside `.api-row-meta`. */
function apiField(label: string, value: Node): HTMLElement {
  const field = document.createElement('div')
  field.className = 'api-field'
  const lbl = document.createElement('span')
  lbl.className = 'api-field-label'
  lbl.textContent = label
  field.append(lbl, value)
  return field
}

/** apiChipset — an enum's `values[]` as a WRAPPING row of code chips (never one long dotted string). */
function apiChipset(values: readonly string[]): HTMLElement {
  const set = document.createElement('div')
  set.className = 'api-chipset'
  for (const v of values) {
    const chip = document.createElement('code')
    chip.className = 'api-chip'
    chip.textContent = v
    set.append(chip)
  }
  return set
}

/** codeOrDash — `text` as a code chip, or a plain em-dash (never a lonely EMPTY chip) when `text` is absent/empty
 *  or already the sentinel '—' `cellText` returns for a missing sequence field. */
function codeOrDash(text: string | undefined): HTMLElement {
  if (text === undefined || text === '' || text === '—') {
    const dash = document.createElement('span')
    dash.className = 'api-empty'
    dash.textContent = '—'
    return dash
  }
  const code = document.createElement('code')
  code.textContent = text
  return code
}

/** apiBadge — a subtle inline badge/dot for a rarely-needed boolean footnote (`reflect` / `optional`): shown only
 *  when the flag is true (the false/absent case is the unremarkable default and needs no headline column). */
function apiBadge(label: string, title: string): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'api-badge'
  badge.title = title
  badge.textContent = label
  return badge
}

/**
 * renderApiTable — one Form-B row per `attributes[]` entry (name · type[+enum chips] · default · reflect badge),
 * read straight from the parse so the published surface IS the contract, not a hand-transcribed copy. Wrapped in
 * a titled section.
 *
 * `level` is the section-title heading level (DEFAULT 2), so the standard control doc page (composeDocPage) is
 * byte-identical, while a bespoke page that nests these tables under its own sub-headings (the app-shell guide's
 * per-element `h3` labels) can push the title down a level to keep the document outline monotonic (WCAG 1.3.1).
 */
export function renderApiTable(attributes: readonly ParsedAttribute[], level = 2): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(level, 'Attributes'))

  const rows = document.createElement('div')
  rows.className = 'api-rows'
  for (const attr of attributes) rows.append(attributeRow(attr))
  section.append(rows)
  return section
}

/** attributeRow — one Attributes row: Type (chip-set when enum) + Default (code-or-dash) as flowing fields, plus
 *  a "reflects" badge ONLY when the descriptor marks `reflect: true` (false/undefined needs no footnote). */
function attributeRow(attr: ParsedAttribute): HTMLElement {
  const typeValue = attr.values && attr.values.length > 0 ? apiChipset(attr.values) : codeOrDash(attr.type)
  const meta: Node[] = [apiField('Type', typeValue), apiField('Default', codeOrDash(attr.default))]
  if (attr.reflect === true) meta.push(apiBadge('reflects', 'Reflects to a DOM attribute (JS-set values stay visible to CSS/attribute selectors)'))
  return apiRow(attr.name ?? '—', meta)
}

/** findAttr — the parsed attribute named `name`, or undefined; the seam doc pages iterate the enum off of. */
export const findAttr = (d: ParsedDescriptor, name: string): ParsedAttribute | undefined =>
  d.attributes.find((a) => a.name === name)

// ── derived sequence tables (events / properties / slots) ─────────────────────────────────────────────────
// Beyond `attributes[]`, a descriptor records the rest of its public surface as the `events[]` / `properties[]` /
// `slots[]` sequences. These render the SAME way the attribute table does — one row per parsed item, read
// straight from the descriptor — so a control's events/props/slots cannot drift from its `{name}.md` any more
// than its attributes can. Each table renders ONLY when its sequence has rows, so a control with (say) no events
// ships no Events table rather than an empty one.

/** A field of a sequence row beyond name/description: a header + the SequenceItem field it reads, rendered as
 *  a code-or-dash value (`code`) or a subtle true-only badge (`badge` — the `reflect`/`optional` treatment). */
interface SeqColumn {
  readonly header: string
  readonly field: string
  readonly code?: boolean
  readonly badge?: boolean
}

/** cellText — one SequenceItem field as a display string: '—' when absent, an inline-array field comma-joined. */
function cellText(item: SequenceItem, field: string): string {
  const v = item.get(field)
  if (Array.isArray(v)) return v.join(', ')
  return typeof v === 'string' && v !== '' ? v : '—'
}

/**
 * renderSequenceTable — a titled Form-B row group over a descriptor sequence (events/properties/slots/parts), one
 * row per parsed item, derived straight from the parse: `name` is the row's left-rail index, a `description`
 * column (if present) renders as the row's prose, and every other column is a flowing meta field — `code` fields
 * as a code-or-dash chip, `badge` fields (reflect/optional) as a subtle badge shown ONLY when true. Returns
 * undefined when the sequence is empty/absent, so the caller ships no empty section — the SAME row shape
 * `renderApiTable` builds, so all five sibling tables read as one coherent reference pattern.
 */
function renderSequenceTable(title: string, items: SequenceItem[] | undefined, columns: readonly SeqColumn[], level = 2): HTMLElement | undefined {
  if (!items || items.length === 0) return undefined
  const section = document.createElement('section')
  section.append(heading(level, title))

  const nameField = columns.find((c) => c.field === 'name')?.field ?? 'name'
  const descColumn = columns.find((c) => c.field === 'description')
  const metaColumns = columns.filter((c) => c.field !== nameField && c !== descColumn)

  const rows = document.createElement('div')
  rows.className = 'api-rows'
  for (const item of items) {
    const meta: Node[] = []
    for (const c of metaColumns) {
      const text = cellText(item, c.field)
      if (c.badge) {
        if (text === 'true') meta.push(apiBadge(c.header.toLowerCase(), `${c.header}: yes`))
      } else {
        meta.push(apiField(c.header, c.code ? codeOrDash(text) : textNode(text)))
      }
    }
    const description = descColumn ? cellText(item, descColumn.field) : undefined
    rows.append(apiRow(cellText(item, nameField), meta, description))
  }
  section.append(rows)
  return section
}

/** textNode — a plain-text meta value (no column in the current five tables uses this leg outside `description`,
 *  which apiRow handles separately — kept for a future non-code, non-badge meta field). */
function textNode(text: string): Node {
  return document.createTextNode(text)
}

/** renderPropertiesTable — the descriptor `properties[]` (IDL beyond attributes-as-API): name · description. `level` (default 2) sets the section-title heading level (see renderApiTable). */
export function renderPropertiesTable(d: ParsedDescriptor, level = 2): HTMLElement | undefined {
  return renderSequenceTable('Properties', d.sequences.get('properties'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Description', field: 'description' },
  ], level)
}

/** renderEventsTable — the descriptor `events[]` vocabulary: name · detail · description (e.g. tabs `select` → { value, index }). */
export function renderEventsTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Events', d.sequences.get('events'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Detail', field: 'detail', code: true },
    { header: 'Description', field: 'description' },
  ])
}

/** renderSlotsTable — the descriptor `slots[]` (named light-DOM positions): name · optional (badge) · description. */
export function renderSlotsTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Slots', d.sequences.get('slots'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Optional', field: 'optional', badge: true },
    { header: 'Description', field: 'description' },
  ])
}

/** renderPartsTable — the descriptor `parts[]` (control-created interior anatomy nodes, addressed as `[data-part='X']`): name · description. Like every sequence table, renders ONLY when the descriptor declares parts (a part-less control ships no empty Parts section). */
export function renderPartsTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Parts', d.sequences.get('parts'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Description', field: 'description' },
  ])
}

/**
 * composeDocPage — the standard T4 page body, in one order every control doc page shares: the descriptor-derived
 * API tables (attributes, then properties · events · slots · parts — each only when the descriptor declares them),
 * an optional live-specimens section, then the rendered markdown body. Keeps the container docs (and the control
 * docs that opt in) on ONE render path, so the page shape can't drift between them and every documented surface
 * is read straight from `{name}.md`.
 */
export function composeDocPage(content: HTMLElement, descriptor: ParsedDescriptor, body: string, specimens?: HTMLElement): void {
  // The Attributes table renders only when the descriptor declares attributes: an attribute-less control
  // (ui-form-provider — `attributes: []`, a pure coordination element) ships NO vacuous "Attributes" header +
  // empty table, the same "no empty table" discipline the properties/events/slots/parts sequences already follow.
  if (descriptor.attributes.length > 0) content.append(renderApiTable(descriptor.attributes))
  for (const table of [renderPropertiesTable(descriptor), renderEventsTable(descriptor), renderSlotsTable(descriptor), renderPartsTable(descriptor)]) {
    if (table) content.append(table)
  }
  if (specimens) content.append(specimens)
  content.append(renderMarkdownBody(body))
}

// ── prose body (the markdown under the fence) ─────────────────────────────────────────────────────────────

/**
 * renderMarkdownBody — a small, dependency-free markdown render of the body text: fenced code blocks, ATX
 * headings (demoted one level so they nest under the page <h1>), `- ` bullet lists, `>`-prefixed blockquote
 * runs (TKT-0036 — a generic markdown blockquote: contiguous `>` lines join ONE block; nesting/lazy-continuation
 * are NOT supported, kept tiny by design), and blank-line-separated paragraphs. Text-only (textContent, never
 * innerHTML) — enough to read the doc, no markdown engine pulled in. Returns the render as `<article
 * class="doc-body">` — the ONE wrapper class the prose reading-design CSS (doc-page.css) keys on: the 72ch
 * measure, heading typescale, tint-only chip register, and blockquote treatment are ALL scoped to `.doc-body`,
 * so every page composing this render (composeDocPage AND the standalone callers — adr-index.ts, changelog.ts,
 * the hand-assembled *-doc.ts pages) gets the ONE reading design for free, never a per-page opt-in.
 */
export function renderMarkdownBody(src: string): HTMLElement {
  const article = document.createElement('article')
  article.className = 'doc-body'
  const lines = src.split('\n')
  let i = 0
  let paragraph: string[] = []
  let list: string[] = []
  let quote: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    const p = document.createElement('p')
    appendInline(p, paragraph.join(' ')) // render inline `code` chips + **bold** spans (not literal markers)
    article.append(p)
    paragraph = []
  }
  const flushList = (): void => {
    if (list.length === 0) return
    const ul = document.createElement('ul')
    for (const item of list) {
      const li = document.createElement('li')
      appendInline(li, item) // render inline `code` chips + **bold** spans (not literal markers)
      ul.append(li)
    }
    article.append(ul)
    list = []
  }
  // flushQuote — one <blockquote> per contiguous `>` run, its lines joined the same way a paragraph's wrapped
  // lines are (space-joined, then inline-parsed as one unit) — a generic markdown blockquote, no nested
  // constructs (a nested list/heading inside `>` stays plain text, matching the tiny-parser trade-off above).
  const flushQuote = (): void => {
    if (quote.length === 0) return
    const bq = document.createElement('blockquote')
    appendInline(bq, quote.join(' '))
    article.append(bq)
    quote = []
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      flushQuote()
      const lang = line.slice(3).trim() // the info string after the opening fence (```ts → "ts"), if any
      const code: string[] = []
      i++
      // Every line up to the closing fence is opaque code TEXT — a `>` here (e.g. a shell heredoc, a diff hunk)
      // is never matched against the blockquote regex below: this loop only checks for the closing ``` and
      // pushes the raw line, so a lone `>` inside a fence can never be mis-parsed as a blockquote (the negative
      // control this ticket's tests pin).
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++ // consume the closing fence
      article.append(codeBlock(code.join('\n'), lang || undefined)) // shared <pre><code> chrome (textContent, no injection)
      continue
    }

    const atx = /^(#{1,6})\s+(.*)$/.exec(line)
    if (atx) {
      flushParagraph()
      flushList()
      flushQuote()
      article.append(heading(Math.min(atx[1].length + 1, 6), atx[2].trim()))
      i++
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      flushQuote()
      list.push(bullet[1].trim())
      i++
      continue
    }

    const quoteLine = /^>\s?(.*)$/.exec(line)
    if (quoteLine) {
      flushParagraph()
      flushList()
      quote.push(quoteLine[1].trim())
      i++
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      flushList()
      flushQuote()
      i++
      continue
    }

    flushList()
    flushQuote()
    paragraph.push(line.trim())
    i++
  }

  flushParagraph()
  flushList()
  flushQuote()
  return article
}

// ── small DOM helpers (shared scaffold; carry no per-control fact) ─────────────────────────────────────────

/**
 * appendInline — append `text` to `parent`, rendering the docs corpus's small inline-markdown grammar, the rest
 * as plain text. Two spans: a single-backtick run `` `code` `` → a `<code>` chip (VERBATIM — no markup parsed
 * inside code, so `**stars**` inside backticks stays literal), and a `**bold**` run → a `<strong>` whose inner
 * text IS re-parsed (so an inline `code` span inside **bold** still renders). The earliest-starting span wins,
 * then the remainder recurses, so the two compose without pulling in a markdown engine. An unpaired `` ` `` or
 * `*` is left as literal text (graceful — no crash). SAFETY: every run is a Text node / `textContent`, NEVER
 * `innerHTML` — the markdown body is DATA; the `<strong>`/`<code>` elements are ours, their text is the parsed
 * content, so the body can never inject markup.
 */
export function appendInline(parent: HTMLElement, text: string): void {
  // The earliest inline span wins: a code span (verbatim) or a bold span (its content re-parsed). A code span
  // starting at or before a `**` is taken as code first, keeping `**…**` inside backticks literal.
  const codeM = /`([^`]+)`/.exec(text)
  const boldM = /\*\*(.+?)\*\*/.exec(text)
  const useCode = codeM !== null && (boldM === null || codeM.index <= boldM.index)
  const useBold = boldM !== null && !useCode

  if (!useCode && !useBold) {
    if (text.length > 0) parent.append(text) // no span left — the whole run is literal text
    return
  }

  const m = (useCode ? codeM : boldM) as RegExpExecArray
  if (m.index > 0) parent.append(text.slice(0, m.index)) // literal run before the span (Text node)

  if (useCode) {
    const code = document.createElement('code')
    code.textContent = m[1] // verbatim — code is literal, no inline parsing inside
    parent.append(code)
  } else {
    const strong = document.createElement('strong')
    appendInline(strong, m[1]) // recurse — inline `code` inside **bold** is still parsed
    parent.append(strong)
  }

  appendInline(parent, text.slice(m.index + m[0].length)) // continue after the span (recurse on the remainder)
}

export function heading(level: number, text: string): HTMLElement {
  const h = document.createElement(`h${level}`)
  appendInline(h, text) // a markdown heading may carry inline `code`/**bold**; plain headings append one text node
  return h
}

/** specimenRow — a wrapping flex row of live specimens (inline layout; a doc page ships no stylesheet of its own). */
export function specimenRow(children: readonly Node[]): HTMLElement {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; margin:0.5rem 0 1.5rem;'
  row.append(...children)
  return row
}

export function tableHead(...labels: readonly string[]): HTMLElement {
  const thead = document.createElement('thead')
  const tr = document.createElement('tr')
  for (const label of labels) {
    const th = document.createElement('th')
    th.textContent = label
    th.style.textAlign = 'left'
    tr.append(th)
  }
  thead.append(tr)
  return thead
}

export function tableRow(...cells: readonly HTMLElement[]): HTMLElement {
  const tr = document.createElement('tr')
  tr.append(...cells)
  return tr
}

export function textCell(text: string): HTMLElement {
  const td = document.createElement('td')
  td.textContent = text
  return td
}

export function codeCell(text: string): HTMLElement {
  const td = document.createElement('td')
  const code = document.createElement('code')
  code.textContent = text
  td.append(code)
  return td
}

// ── the page-end Changelog table (TKT-0053) ───────────────────────────────────────────────────────────────
// A page's provenance citations (which TKT/ADR built or changed this surface) never belong woven into
// descriptive prose (best-practices.md's provenance-vs-normative split) — they land here instead, one row
// per record, newest-first. Hand-authored (provenance has no canonical index to derive from) — flag the
// entry array as such at the call site, the same discipline as any other underivable fact.

/** One provenance record: `date`/`id` are the record's OWN fields (a ticket's `date:`, an ADR's `Date`),
 *  never invented; `type` is the ticket's `kind:` Title-cased (Feature/Fix/Change) or `Decision` for an ADR. */
export interface ChangelogEntry {
  readonly date: string // ISO YYYY-MM-DD
  readonly type: 'Feature' | 'Fix' | 'Change' | 'Decision'
  readonly id: string // 'TKT-0039' | 'ADR-0131'
  readonly summary: string // one present-tense clause: what changed
}

/** changelogIdCell — the ID column: an ADR-#### id links to the real site surface (adr-index.ts resolves
 *  the `#adr-{number}` hash); a TKT-#### id renders as plain code — no ticket index is published yet. */
function changelogIdCell(id: string): HTMLElement {
  const td = document.createElement('td')
  const adrNumber = /^ADR-(\d+)$/.exec(id)?.[1]
  if (adrNumber) {
    const a = document.createElement('a')
    a.href = `./adr-index.html#adr-${adrNumber}`
    const code = document.createElement('code')
    code.textContent = id
    a.append(code)
    td.append(a)
  } else {
    const code = document.createElement('code')
    code.textContent = id
    td.append(code)
  }
  return td
}

/**
 * renderChangelogTable — the page-end Changelog: one Date | Type | ID | Summary row per provenance record,
 * newest-first. Returns undefined for an empty `entries` list, so a page with no provenance to report ships
 * no section (the same "no empty table" discipline the Properties/Events/Slots/Parts tables above follow).
 */
export function renderChangelogTable(entries: readonly ChangelogEntry[], level = 2): HTMLElement | undefined {
  if (entries.length === 0) return undefined
  const section = document.createElement('section')
  section.append(heading(level, 'Changelog'))

  const table = document.createElement('table')
  table.append(tableHead('Date', 'Type', 'ID', 'Summary'))
  const tbody = document.createElement('tbody')
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  for (const entry of sorted) {
    tbody.append(tableRow(textCell(entry.date), textCell(entry.type), changelogIdCell(entry.id), textCell(entry.summary)))
  }
  table.append(tbody)
  section.append(table)
  return section
}
