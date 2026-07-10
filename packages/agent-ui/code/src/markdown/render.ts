// render.ts — the AST → real fleet DOM renderer (LLD-C9, SPEC-C6/C7/C8). Side-effect imports self-define
// the fleet elements this module builds (`ui-text`, `ui-code`, `ui-table`). Every node is built via
// `document.createElement` + property/attribute sets ONLY — no `innerHTML` anywhere (the grep-able
// absence, SPEC-C7 AC2).
//
// Fenced code reaches highlighting ONLY through the core registry (`projectHighlight`, imported from the
// package's own core barrel) — this module never imports `./highlight` (SPEC-C8: `./markdown` alone drags
// zero tokenizer bytes; the two packs compose through the registry, no import edge between them).

import '@agent-ui/components/controls/text' // ui-text (headings, paragraphs, blockquote, links)
import '@agent-ui/components/controls/code' // ui-code (fenced)
import '@agent-ui/components/controls/table' // ui-table (GFM tables)
import { projectHighlight } from '../index.ts'
import type { Block, Inline } from './parse.ts'

/** Render one inline run into real DOM nodes (I-1: em/strong/code as native inline elements). */
function renderInline(nodes: Inline[]): Node[] {
  const out: Node[] = []
  for (const n of nodes) {
    switch (n.kind) {
      case 'text':
        out.push(document.createTextNode(n.text))
        break
      case 'em': {
        const el = document.createElement('em')
        el.append(...renderInline(n.inline))
        out.push(el)
        break
      }
      case 'strong': {
        const el = document.createElement('strong')
        el.append(...renderInline(n.inline))
        out.push(el)
        break
      }
      case 'code': {
        const el = document.createElement('code')
        el.textContent = n.text
        out.push(el)
        break
      }
      case 'link': {
        const el = document.createElement('ui-text')
        el.setAttribute('as', 'a')
        el.setAttribute('href', n.href) // ui-text's #syncLink gate resolves/denies (SPEC-C6 AC3)
        el.textContent = n.text
        out.push(el)
        break
      }
    }
  }
  return out
}

/** Render a block sequence into real DOM nodes — the construct→element map (SPEC-C6 table). */
export function renderBlocks(blocks: Block[]): Node[] {
  const out: Node[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': {
        const el = document.createElement('ui-text')
        el.setAttribute('as', `h${b.level}`)
        el.append(...renderInline(b.inline))
        out.push(el)
        break
      }
      case 'paragraph': {
        const el = document.createElement('ui-text')
        el.setAttribute('as', 'p')
        el.append(...renderInline(b.inline))
        out.push(el)
        break
      }
      case 'blockquote': {
        const el = document.createElement('ui-text')
        el.setAttribute('as', 'blockquote')
        el.append(...renderBlocks(b.blocks))
        out.push(el)
        break
      }
      case 'list': {
        const el = document.createElement(b.ordered ? 'ol' : 'ul')
        for (const item of b.items) {
          const li = document.createElement('li')
          li.append(...renderBlocks(item))
          el.append(li)
        }
        out.push(el)
        break
      }
      case 'code': {
        const el = document.createElement('ui-code')
        el.setAttribute('language', b.language)
        projectHighlight(el, b.text, b.language) // verbatim when ./highlight is not registered (SPEC-C8)
        out.push(el)
        break
      }
      case 'table': {
        const el = document.createElement('ui-table') as HTMLElement & {
          columns: { key: string; label: string }[]
          rows: Record<string, string>[]
        }
        const keys = b.header.map((_, i) => `c${i}`)
        el.columns = b.header.map((label, i) => ({ key: keys[i], label }))
        el.rows = b.rows.map((row) => Object.fromEntries(row.map((v, i) => [keys[i], v])))
        out.push(el)
        break
      }
    }
  }
  return out
}
