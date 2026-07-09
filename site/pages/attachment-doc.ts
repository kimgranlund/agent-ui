// site/pages/attachment-doc.ts — the ui-attachment API doc page (tier=display ⇒ {doc} only, ADR-0112 /
// feed-family.lld.md LLD-C12). DERIVED from `attachment.md` via the shared doc-page.ts renderer: the
// attribute table (name, mimeType, sizeBytes, href) and the parts[] table (glyph, body, name, meta) are read
// straight from the parse — so neither can drift from the descriptor the contract trip-wire enforces
// (ADR-0004). The specimens are hand-authored (a doc page has no source to derive representative data from):
// one card per fileCategory (image/audio/video/pdf/text/archive/data/default) plus a degenerate strip — an
// empty name falling back to the category label, and an absent/negative sizeBytes yielding no size cell.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadAttachmentDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface AttachmentSpecimen {
  readonly name?: string
  readonly mimeType: string
  readonly sizeBytes?: number
}

// One representative card per fileCategory (LLD-C4's map) — HAND-AUTHORED example content.
const CATEGORIES: readonly AttachmentSpecimen[] = [
  { name: 'sunset.png', mimeType: 'image/png', sizeBytes: 482_000 },
  { name: 'standup.mp3', mimeType: 'audio/mpeg', sizeBytes: 3_100_000 },
  { name: 'demo.mp4', mimeType: 'video/mp4', sizeBytes: 24_600_000 },
  { name: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 48_200 },
  { name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 1_200 },
  { name: 'archive.zip', mimeType: 'application/zip', sizeBytes: 9_800_000 },
  { name: 'export.csv', mimeType: 'text/csv', sizeBytes: 15_400 },
  { name: 'unknown.bin', mimeType: 'application/octet-stream', sizeBytes: 2_048 },
]

const { descriptor, body } = loadAttachmentDoc()

const { content } = mountPage({
  title: 'ui-attachment — API',
  intro:
    'The Display-class, FilePart-aligned compact file card (ADR-0112, feed family v1) — a category glyph plus ' +
    'a name/size cell, real selectable DOM text throughout. Not interactive, not form-associated. Generated ' +
    'from attachment.md: the attribute and parts tables are descriptor-derived; the grid below shows every ' +
    'file category plus SPEC-R8/R9 degenerate cases as live fixtures.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelled('Every file category', 'One card per fileCategory — the glyph derives from mimeType; size formats through Intl.NumberFormat.', grid(CATEGORIES.map(card))),
    labelled('Degenerate cases', 'An empty name falls back to the category label ("Image") — never an empty title. Absent/negative sizeBytes means the size cell is absent, never a fabricated "0 B".', grid([
      card({ mimeType: 'image/png' }),
      card({ name: 'no-size.pdf', mimeType: 'application/pdf', sizeBytes: -1 }),
    ])),
  )
  return section
}

function card(spec: AttachmentSpecimen): HTMLElement {
  const el = document.createElement('ui-attachment')
  if (spec.name !== undefined) el.setAttribute('name', spec.name)
  el.setAttribute('mime-type', spec.mimeType)
  if (spec.sizeBytes !== undefined) el.setAttribute('size-bytes', String(spec.sizeBytes))
  return el
}

function grid(children: readonly HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex; gap:0.75rem; flex-wrap:wrap;'
  wrap.append(...children)
  return wrap
}

function labelled(title: string, description: string, node: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.5rem;'
  const desc = document.createElement('p')
  desc.textContent = description
  wrap.append(heading(3, title), desc, node)
  return wrap
}
