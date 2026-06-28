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
import type { ParsedAttribute, ParsedDescriptor } from '@agent-ui/components/descriptor'

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
    p.textContent = paragraph.join(' ')
    article.append(p)
    paragraph = []
  }
  const flushList = (): void => {
    if (list.length === 0) return
    const ul = document.createElement('ul')
    for (const item of list) {
      const li = document.createElement('li')
      li.textContent = item
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
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++ // consume the closing fence
      const pre = document.createElement('pre')
      const codeEl = document.createElement('code')
      codeEl.textContent = code.join('\n')
      pre.append(codeEl)
      article.append(pre)
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

export function heading(level: number, text: string): HTMLElement {
  const h = document.createElement(`h${level}`)
  h.textContent = text
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
