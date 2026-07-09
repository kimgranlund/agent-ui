// site/pages/badge-doc.ts — the ui-badge API doc page (tier=display ⇒ {doc} only, ADR-0111 /
// report-family.lld.md LLD-C11). DERIVED from `badge.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]` (label, the [intent] enum), the parts[] surface renders as the
// descriptor-derived Parts table (glyph/label), and the prose from the body — so neither can drift from the
// descriptor the contract trip-wire enforces (ADR-0004). The specimen is a live five-intent strip iterating the
// PARSED `intent` enum (never a hand-listed set), so a future intent addition renders here for free.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadBadgeDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'

// Representative label text per intent — hand-authored (a doc page has no descriptor source for example
// content), but the SET of intents iterated below is DERIVED from the parsed enum (see renderSpecimens).
const LABEL_BY_INTENT: Record<string, string> = {
  neutral: 'beta',
  info: '3 updates',
  success: '11 passing',
  warning: '2 pending',
  danger: '3 failing',
}

const { descriptor, body } = loadBadgeDoc()

const { content } = mountPage({
  title: 'ui-badge — API',
  intro:
    'The compact-realm, non-interactive display leaf (ADR-0111, report family v1) — an intent-keyed status ' +
    'token with a component-drawn, non-colour glyph (ADR-0057: hue is never the only channel). Generated from ' +
    'badge.md: the attribute and parts tables are descriptor-derived; the strip below iterates the parsed ' +
    '[intent] enum live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

// renderSpecimens — one live <ui-badge> per PARSED intent enum member (findAttr off the descriptor, never a
// hand-listed set), so a future intent addition on badge.md renders here automatically.
function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Every intent'))
  const desc = document.createElement('p')
  desc.textContent = "neutral renders no glyph — absence is its own signifier; every other intent's glyph is pairwise-distinct (tick / cross / triangle / disc)."
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; margin:0.5rem 0 1.75rem;'

  const intents = findAttr(descriptor, 'intent')?.values ?? []
  for (const intent of intents) {
    const badge = document.createElement('ui-badge')
    badge.setAttribute('label', LABEL_BY_INTENT[intent] ?? intent)
    badge.setAttribute('intent', intent)
    row.append(badge)
  }
  section.append(desc, row)
  return section
}
