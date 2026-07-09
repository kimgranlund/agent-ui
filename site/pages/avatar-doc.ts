// site/pages/avatar-doc.ts — the ui-avatar API doc page (tier=indicator ⇒ {doc} only, ADR-0112 /
// feed-family.lld.md LLD-C12). DERIVED from `avatar.md` via the shared doc-page.ts renderer: the attribute
// table (src, name, label, the [size] enum) and the parts[] table (initials) are read straight from the parse
// — so neither can drift from the descriptor the contract trip-wire enforces (ADR-0004). The fallback-chain
// specimens are hand-authored (a doc page has no source to derive representative data from): a real inline-SVG
// image (link 1), an intentionally-broken data URI proving the fallback (link 1 → 2), initials-only (link 2),
// and the empty leaf → glyph (link 3). The size row iterates the PARSED `size` enum (never a hand-listed set).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadAvatarDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'

// A self-contained inline SVG data URI — no network fetch, works offline and in every test environment.
const PORTRAIT_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#6750a4"/><circle cx="32" cy="24" r="12" fill="#fff"/><rect x="12" y="40" width="40" height="20" rx="10" fill="#fff"/></svg>',
  )
// An intentionally malformed data URI — fails to decode with no network round-trip, so the fallback (link 1 →
// 2) demonstrates honestly without a flaky live-network dependency.
const BROKEN_SRC = 'data:image/png;base64,not-a-real-image'

const { descriptor, body } = loadAvatarDoc()

const { content } = mountPage({
  title: 'ui-avatar — API',
  intro:
    'The Indicator-class compact identity mark (ADR-0112, feed family v1) — a circle-masked widget box that ' +
    'walks a fallback chain: image, then initials, then a generic person glyph. Not interactive, not ' +
    'form-associated. Generated from avatar.md: the attribute and parts tables are descriptor-derived; the ' +
    'strip below shows every link of the fallback chain plus every parsed [size] tier.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelled('The fallback chain', 'Image (link 1) · a failed image falling back to initials (link 1 → 2) · initials-only (link 2) · no src/no name → the generic glyph (link 3).', row(
      avatar({ src: PORTRAIT_SRC, name: 'Ada Lovelace' }),
      avatar({ src: BROKEN_SRC, name: 'Grace Hopper' }),
      avatar({ name: 'Katherine Johnson' }),
      avatar({}),
    )),
    labelled('Sizes', 'Every parsed [size] tier, off the shared compact-realm ramp.', row(...sizeRow())),
  )
  return section
}

function sizeRow(): HTMLElement[] {
  const sizes = findAttr(descriptor, 'size')?.values ?? []
  return sizes.map((size) => avatar({ name: 'Ada Lovelace', size }))
}

function avatar(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-avatar')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function row(...children: readonly HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;'
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
