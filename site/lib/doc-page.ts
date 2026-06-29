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

// ── API table (derived from the parsed attributes) ────────────────────────────────────────────────────────

/**
 * renderApiTable — one table row per `attributes[]` entry (name · type · default · reflect), read straight from
 * the parse so the published surface IS the contract, not a hand-transcribed copy. Wrapped in a titled section.
 */
export function renderApiTable(attributes: readonly ParsedAttribute[]): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Attributes'))

  const table = document.createElement('table')
  table.append(tableHead('Name', 'Type', 'Default', 'Reflect'))

  const tbody = document.createElement('tbody')
  for (const attr of attributes) {
    tbody.append(
      tableRow(
        codeCell(attr.name ?? '—'),
        textCell(typeLabel(attr)),
        codeCell(attr.default ?? '—'),
        textCell(attr.reflect === undefined ? '—' : String(attr.reflect)),
      ),
    )
  }
  table.append(tbody)
  section.append(table)
  return section
}

/**
 * typeLabel — the codec kind, widened with its enum members when the parse carried a `values[]` list (e.g.
 * `enum (sm · md · lg)`), so the table surfaces the allowed set without a second source.
 */
export function typeLabel(attr: ParsedAttribute): string {
  const kind = attr.type ?? '—'
  return attr.values && attr.values.length > 0 ? `${kind} (${attr.values.join(' · ')})` : kind
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

/** A column of a sequence table: a header + the SequenceItem field it reads (rendered as a code cell or text). */
interface SeqColumn {
  readonly header: string
  readonly field: string
  readonly code?: boolean
}

/** cellText — one SequenceItem field as a display string: '—' when absent, an inline-array field comma-joined. */
function cellText(item: SequenceItem, field: string): string {
  const v = item.get(field)
  if (Array.isArray(v)) return v.join(', ')
  return typeof v === 'string' && v !== '' ? v : '—'
}

/**
 * renderSequenceTable — a titled table over a descriptor sequence (events/properties/slots), one row per parsed
 * item, derived straight from the parse. Returns undefined when the sequence is empty/absent, so the caller ships
 * no empty table.
 */
function renderSequenceTable(title: string, items: SequenceItem[] | undefined, columns: readonly SeqColumn[]): HTMLElement | undefined {
  if (!items || items.length === 0) return undefined
  const section = document.createElement('section')
  section.append(heading(2, title))
  const table = document.createElement('table')
  table.append(tableHead(...columns.map((c) => c.header)))
  const tbody = document.createElement('tbody')
  for (const item of items) {
    tbody.append(tableRow(...columns.map((c) => (c.code ? codeCell(cellText(item, c.field)) : textCell(cellText(item, c.field))))))
  }
  table.append(tbody)
  section.append(table)
  return section
}

/** renderPropertiesTable — the descriptor `properties[]` (IDL beyond attributes-as-API): name · description. */
export function renderPropertiesTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Properties', d.sequences.get('properties'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Description', field: 'description' },
  ])
}

/** renderEventsTable — the descriptor `events[]` vocabulary: name · detail · description (e.g. tabs `select` → { value, index }). */
export function renderEventsTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Events', d.sequences.get('events'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Detail', field: 'detail', code: true },
    { header: 'Description', field: 'description' },
  ])
}

/** renderSlotsTable — the descriptor `slots[]` (named light-DOM positions): name · optional · description. */
export function renderSlotsTable(d: ParsedDescriptor): HTMLElement | undefined {
  return renderSequenceTable('Slots', d.sequences.get('slots'), [
    { header: 'Name', field: 'name', code: true },
    { header: 'Optional', field: 'optional' },
    { header: 'Description', field: 'description' },
  ])
}

/**
 * composeDocPage — the standard T4 page body, in one order every control doc page shares: the descriptor-derived
 * API tables (attributes, then properties · events · slots — each only when the descriptor declares them), an
 * optional live-specimens section, then the rendered markdown body. Keeps the container docs (and the control
 * docs that opt in) on ONE render path, so the page shape can't drift between them and every documented surface
 * is read straight from `{name}.md`.
 */
export function composeDocPage(content: HTMLElement, descriptor: ParsedDescriptor, body: string, specimens?: HTMLElement): void {
  content.append(renderApiTable(descriptor.attributes))
  for (const table of [renderPropertiesTable(descriptor), renderEventsTable(descriptor), renderSlotsTable(descriptor)]) {
    if (table) content.append(table)
  }
  if (specimens) content.append(specimens)
  content.append(renderMarkdownBody(body))
}

// ── prose body (the markdown under the fence) ─────────────────────────────────────────────────────────────

/**
 * renderMarkdownBody — a small, dependency-free markdown render of the body text: fenced code blocks, ATX
 * headings (demoted one level so they nest under the page <h1>), `- ` bullet lists, and blank-line-separated
 * paragraphs. Text-only (textContent, never innerHTML) — enough to read the doc, no markdown engine pulled in.
 */
export function renderMarkdownBody(src: string): HTMLElement {
  const article = document.createElement('article')
  const lines = src.split('\n')
  let i = 0
  let paragraph: string[] = []
  let list: string[] = []

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

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      const lang = line.slice(3).trim() // the info string after the opening fence (```ts → "ts"), if any
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++ // consume the closing fence
      article.append(codeBlock(code.join('\n'), lang || undefined)) // shared <pre><code> chrome (textContent, no injection)
      continue
    }

    const atx = /^(#{1,6})\s+(.*)$/.exec(line)
    if (atx) {
      flushParagraph()
      flushList()
      article.append(heading(Math.min(atx[1].length + 1, 6), atx[2].trim()))
      i++
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      list.push(bullet[1].trim())
      i++
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      flushList()
      i++
      continue
    }

    flushList()
    paragraph.push(line.trim())
    i++
  }

  flushParagraph()
  flushList()
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
