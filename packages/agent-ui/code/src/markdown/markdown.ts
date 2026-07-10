// markdown.ts — UIMarkdownElement, the `ui-markdown` element (LLD-C9, SPEC-C6). A Display-class UIElement
// defined IN this pack (ADR-0119 fork F4 — the element IS the grammar). A single bindable `markdown`
// string prop (the source document — a prop, not host-as-content, since the source is generated; the
// `ui-table` columns/rows precedent), non-reflected (a document string is not an attribute-sane value). On
// `markdown` change it parses the subset and REPLACES its children with real fleet DOM (never `innerHTML`).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import { parse } from './parse.ts'
import { renderBlocks } from './render.ts'

const props = {
  markdown: { ...prop.string(''), reflect: false },
} satisfies PropsSchema

export interface UIMarkdownElement extends ReactiveProps<typeof props> {}
export class UIMarkdownElement extends UIElement {
  static props = props

  protected connected(): void {
    this.internals.role = '' // transparent container (no explicit role) — SPEC §4
    this.effect(() => this.replaceChildren(...renderBlocks(parse(this.markdown))))
  }
}

if (!customElements.get('ui-markdown')) customElements.define('ui-markdown', UIMarkdownElement) // idempotent self-define
