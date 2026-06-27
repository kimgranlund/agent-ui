// site/pages/button-doc.ts — the ui-button API doc page (wave-2 slice A4). The page is DERIVED from
// `button.md`: the API table is built row-by-row from the canonical parser's `attributes[]`, and the live
// variant/size/state specimens iterate the parsed enum members — so neither the table nor those examples can
// drift from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The prose
// under the fence is rendered as the human doc beneath it. The one hand-authored section is the Anatomy
// specimens (ADR-0012): the position×role adornment STRUCTURES (slot=leading/trailing × data-role=icon/caret)
// are markup shapes, not attributes, so they are authored here rather than derived from the parse.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadButtonDoc } from '../lib/frontmatter.ts'
import type { ParsedAttribute, ParsedDescriptor } from '@agent-ui/components/descriptor'

// Declared up top (not beside its anatomy-section users) so it is initialised before the line-18 render runs:
// the helpers that read it are reached during that eager `content.append`, ahead of the helper definitions below.
const SVG_NS = 'http://www.w3.org/2000/svg'

const { descriptor, body } = loadButtonDoc()

const { content } = mountPage({
  title: 'Button — API',
  intro: 'The reference FACE control. This page is generated from button.md: the API table and the live ' +
    'specimens are derived from the same frontmatter the contract trip-wire validates, so they cannot drift.',
})

content.append(renderApiSection(descriptor.attributes), renderExamples(descriptor), renderAnatomy(), renderBody(body))

// ── API table (derived from the parsed attributes) ──────────────────────────────────────────────────────

// renderApiSection — one table row per `attributes[]` entry (name · type · default · reflect), read straight
// from the parse so the published surface is the contract, not a hand-transcribed copy.
function renderApiSection(attributes: readonly ParsedAttribute[]): HTMLElement {
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

// typeLabel — the codec kind, widened with its enum members when the parse carried a `values[]` list (e.g.
// `enum (solid · soft · ghost)`), so the table surfaces the allowed set without a second source.
function typeLabel(attr: ParsedAttribute): string {
  const kind = attr.type ?? '—'
  return attr.values && attr.values.length > 0 ? `${kind} (${attr.values.join(' · ')})` : kind
}

// ── live specimens (derived from the parsed enum members) ───────────────────────────────────────────────

// renderExamples — working <ui-button> specimens. The variant + size rows iterate the PARSED enum members,
// so adding a variant to button.md adds a specimen here for free; a disabled row shows the inert state.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const variant = findAttr(d, 'variant')
  if (variant?.values) section.append(heading(3, 'Variants'), specimenRow(variant.values.map((v) => button({ variant: v }, v))))

  const size = findAttr(d, 'size')
  if (size?.values) section.append(heading(3, 'Sizes'), specimenRow(size.values.map((s) => button({ size: s }, s))))

  section.append(heading(3, 'States'), specimenRow([button({}, 'Default'), button({ disabled: '' }, 'Disabled')]))
  return section
}

const findAttr = (d: ParsedDescriptor, name: string): ParsedAttribute | undefined =>
  d.attributes.find((a) => a.name === name)

// button — a live specimen: a real <ui-button> with the given attributes set and a text label (its a11y name).
function button(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-button')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}

// specimenRow — a wrapping flex row of specimens (inline layout; the page ships no stylesheet of its own).
function specimenRow(children: readonly HTMLElement[]): HTMLElement {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; margin:0.5rem 0 1.5rem;'
  row.append(...children)
  return row
}

// ── anatomy specimens (hand-authored: the position × role adornment structures, ADR-0012) ───────────────

// The structure of one anatomy specimen: a structure caption + which adornment slots are filled. These are
// markup SHAPES (slot = position × data-role = kind), not attributes, so they are hand-authored here rather
// than derived from the parser.
interface AnatomyShape {
  readonly caption: string
  readonly leading: boolean
  readonly trailing: boolean
}

// renderAnatomy — a real <ui-button> per structure the family standard names (ADR-0012): a leading icon, a
// trailing caret, and the full [ icon | label | caret ]. The shapes are local (not a module const) so they
// initialise when this runs, inside the eager line-18 render. Each specimen is captioned with its notation.
function renderAnatomy(): HTMLElement {
  const shapes: readonly AnatomyShape[] = [
    { caption: '[ icon | label ]', leading: true, trailing: false },
    { caption: '[ label | caret ]', leading: false, trailing: true },
    { caption: '[ icon | label | caret ]', leading: true, trailing: true },
  ]
  const section = document.createElement('section')
  section.append(heading(2, 'Anatomy — [ icon | label | caret ]'), specimenRow(shapes.map(anatomySpecimen)))
  return section
}

// anatomySpecimen — one captioned figure: the live button above its structure notation, so the slot/role
// shape reads next to the rendering (the page ships no stylesheet, so the figure carries inline layout).
function anatomySpecimen(shape: AnatomyShape): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:0.5rem; margin:0;'
  const caption = document.createElement('figcaption')
  const code = document.createElement('code')
  code.textContent = shape.caption
  caption.append(code)
  figure.append(anatomyButton(shape), caption)
  return figure
}

// anatomyButton — a live <ui-button> with the structure's adornments in DOM order (icon → label → caret). The
// label text is the accessible name; the leading icon and trailing caret are decorative slotted children.
function anatomyButton(shape: AnatomyShape): HTMLElement {
  const el = document.createElement('ui-button')
  if (shape.leading) el.append(makeIcon()) // slot="leading" data-role="icon"
  el.append(document.createTextNode('Label')) // the label region (the accessible name)
  if (shape.trailing) el.append(makeCaret()) // slot="trailing" data-role="caret"
  return el
}

// makeIcon — a decorative leading icon (download glyph), mirroring permutations.ts so the doc renders the same.
// slot="leading" places it (POSITION); data-role="icon" is the content role (sized to the icon cell, ADR-0012).
// `currentColor` inherits the button ink; `aria-hidden` keeps the label as the accessible name.
function makeIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', 'leading') // POSITION (start cell)
  svg.setAttribute('data-role', 'icon') // CONTENT role (icon · caret · future tag/badge)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M12 3v10m0 0l-4-4m4 4l4-4M5 21h14')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

// makeCaret — a decorative trailing chevron-down (the dropdown/disclosure adornment), mirroring permutations.ts.
// slot="trailing" places it (POSITION); data-role="caret" is the inline-affordance role (sized = font, ADR-0012
// §4.6). The caret carries NO semantics — disclosure AX rides the host (G7), so a plain button never lies.
function makeCaret(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', 'trailing') // POSITION (end cell)
  svg.setAttribute('data-role', 'caret') // CONTENT role
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M6 9l6 6 6-6') // chevron-down
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

// ── prose body (the markdown under the fence) ───────────────────────────────────────────────────────────

// renderBody — a small, dependency-free markdown render of the body text: fenced code blocks, ATX headings
// (demoted one level so they nest under the page <h1>), `- ` bullet lists, and blank-line-separated paragraphs.
// Text-only (textContent, never innerHTML) — enough to read the doc, no markdown engine pulled in.
function renderBody(src: string): HTMLElement {
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

// ── small DOM helpers ───────────────────────────────────────────────────────────────────────────────────

function heading(level: number, text: string): HTMLElement {
  const h = document.createElement(`h${level}`)
  h.textContent = text
  return h
}

function tableHead(...labels: readonly string[]): HTMLElement {
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

function tableRow(...cells: readonly HTMLElement[]): HTMLElement {
  const tr = document.createElement('tr')
  tr.append(...cells)
  return tr
}

function textCell(text: string): HTMLElement {
  const td = document.createElement('td')
  td.textContent = text
  return td
}

function codeCell(text: string): HTMLElement {
  const td = document.createElement('td')
  const code = document.createElement('code')
  code.textContent = text
  td.append(code)
  return td
}
