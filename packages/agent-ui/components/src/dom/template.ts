// template.ts — the tagged-template engine (plan §6; G3 slice 1, the template core).
//
// `html\`…\`` returns an inert `TemplateResult` (the frozen `strings` + the dynamic `values`). The FIRST
// render of a call site `prepare`s its `strings` ONCE — markers → one `<template>` parse → a parts
// manifest — memoized in a `WeakMap` keyed by `strings` IDENTITY (stable per call site). Re-renders
// re-parse nothing: they reuse the prepared template + the live parts and write only the holes whose
// values changed (per-part `Object.is` skip). This fills `UIElement.render()` (the no-op G2 left): the
// host's one scope-owned render effect calls `render()`, which calls this engine into `renderRoot`.
//
// Slice 1 parts: ChildPart (text + nested template) and AttrPart (a string attribute). The rest of the
// part family (child array, ?bool, .prop, @event) + the directive seam land in later slices. Imports
// nothing — the engine is pure DOM; reactivity comes from the host render effect re-running `render()`.
// `render(result, container)` stays positionally extensible: a later slice adds an optional trailing
// render-context (the host exposing its scope-owned `effect`) for `watch`, without breaking 2-arg calls.

// ── TemplateResult — the inert result (t-result) ─────────────────────────────

/** The inert product of `html\`…\``: the call site's frozen `strings` + this render's dynamic `values`. */
export class TemplateResult {
  readonly strings: TemplateStringsArray
  readonly values: readonly unknown[]
  constructor(strings: TemplateStringsArray, values: readonly unknown[]) {
    this.strings = strings
    this.values = values
  }
}

/** Tagged-template tag → an inert `TemplateResult`. No DOM work happens here (preparation is lazy, at render). */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return new TemplateResult(strings, values)
}

// ── prepare — parse once, cache by `strings` identity (t-prepare) ─────────────

/** Where one hole binds: a child position (the marker comment) or an attribute on the host element. */
type PartInfo = { kind: 'child'; nodeIndex: number } | { kind: 'attr'; nodeIndex: number; name: string }

interface PreparedTemplate {
  template: HTMLTemplateElement
  parts: PartInfo[]
}

// A per-process unique marker so it cannot collide with template text. Child holes become a comment node
// (an anchor); attribute holes become this marker as the attribute value (cleaned out at prepare time).
const MARKER = `ui$${String(Math.random()).slice(2)}$`
const CHILD_MARKER = `<!--${MARKER}-->`

const PREPARED = new WeakMap<TemplateStringsArray, PreparedTemplate>()

/** Crude tag-state scan: are we inside a tag (attribute position) after this static chunk? */
function scanInTag(chunk: string, inTag: boolean): boolean {
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk.charCodeAt(i)
    if (c === 60 /* < */) inTag = true
    else if (c === 62 /* > */) inTag = false
  }
  return inTag
}

/**
 * Prepare a call site's `strings`: build the marker HTML, parse it into one `<template>`, and walk it
 * once to build the parts manifest (cleaning attribute markers). Memoized by `strings` IDENTITY — a
 * re-render of the same call site hits the cache and re-parses nothing. Exported for the cache probes
 * (an internal seam; NOT re-exported from the dom barrel).
 */
export function prepare(strings: TemplateStringsArray): PreparedTemplate {
  const cached = PREPARED.get(strings)
  if (cached) return cached

  let markup = ''
  let inTag = false
  for (let i = 0; i < strings.length; i++) {
    markup += strings[i]
    inTag = scanInTag(strings[i], inTag)
    if (i < strings.length - 1) markup += inTag ? MARKER : CHILD_MARKER
  }

  const template = document.createElement('template')
  template.innerHTML = markup

  const parts: PartInfo[] = []
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT)
  let nodeIndex = -1
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodeIndex++
    if (node.nodeType === Node.COMMENT_NODE) {
      if ((node as Comment).data === MARKER) parts.push({ kind: 'child', nodeIndex })
    } else {
      const el = node as Element
      const markerAttrs: string[] = []
      for (const attr of Array.from(el.attributes)) {
        if (attr.value === MARKER) {
          parts.push({ kind: 'attr', nodeIndex, name: attr.name })
          markerAttrs.push(attr.name)
        }
      }
      for (const name of markerAttrs) el.removeAttribute(name) // the AttrPart sets the real value
    }
  }

  // Invariant: one binding site per hole. A mismatch means a hole landed in a position slice 1 doesn't
  // support (mixed into static attribute text, tag-name, or comment position) and would otherwise drop
  // its value SILENTLY. Fail loud instead; slice 3 (t-positions) enriches this into a position-naming message.
  const holes = strings.length - 1
  if (parts.length !== holes) {
    throw new Error(
      `template: ${holes} hole(s) but ${parts.length} binding site(s) — an unsupported binding position ` +
        `(slice 1 supports a whole-value attribute hole and a child hole; richer diagnostics land in slice 3).`,
    )
  }

  const prepared: PreparedTemplate = { template, parts }
  PREPARED.set(strings, prepared)
  return prepared
}

// ── parts — one site, one Object.is dirty check (t-child-part, t-attr-parts) ──

const UNCOMMITTED = Symbol('uncommitted') // never Object.is-equal to any committed value → first commit always runs

interface Part {
  commit(value: unknown): void
}

/** A child hole: commits a primitive (as a text node, updated in place) or a nested `TemplateResult`. */
class ChildPart implements Part {
  #anchor: Comment // the marker comment; content is inserted as its previous siblings
  #committed: unknown = UNCOMMITTED
  #nodes: ChildNode[] = [] // the nodes this part currently owns (for replacement)
  #nested: Instance | null = null // the live instance when the value is a nested template

  constructor(anchor: Comment) {
    this.#anchor = anchor
  }

  commit(value: unknown): void {
    if (value instanceof TemplateResult) {
      this.#commitTemplate(value)
      this.#committed = value
      return
    }
    if (Object.is(value, this.#committed)) return // Object.is skip — an equal hole writes no DOM
    this.#commitText(value)
    this.#committed = value
  }

  #commitText(value: unknown): void {
    const text = value == null ? '' : String(value)
    const only = this.#nodes.length === 1 ? this.#nodes[0] : null
    if (only && only.nodeType === Node.TEXT_NODE) {
      ;(only as Text).data = text // reuse the text node — stable identity, in-place update
      return
    }
    this.#clear()
    const node = document.createTextNode(text)
    this.#anchor.before(node)
    this.#nodes = [node]
  }

  #commitTemplate(result: TemplateResult): void {
    if (this.#nested && this.#nested.strings === result.strings) {
      commitInstance(this.#nested, result.values) // same call site → update parts in place (recursive skip)
      return
    }
    this.#clear()
    const created = createInstance(result.strings)
    commitInstance(created.instance, result.values)
    this.#nodes = Array.from(created.fragment.childNodes) // capture BEFORE insertion empties the fragment
    this.#anchor.before(created.fragment)
    this.#nested = created.instance
  }

  #clear(): void {
    for (const node of this.#nodes) node.remove()
    this.#nodes = []
    this.#nested = null
  }
}

/** An attribute hole: commits a string attribute; `null`/`undefined`/`false` remove it. */
class AttrPart implements Part {
  #el: Element
  #name: string
  #committed: unknown = UNCOMMITTED

  constructor(el: Element, name: string) {
    this.#el = el
    this.#name = name
  }

  commit(value: unknown): void {
    if (Object.is(value, this.#committed)) return // Object.is skip
    this.#committed = value
    if (value == null || value === false) this.#el.removeAttribute(this.#name)
    else this.#el.setAttribute(this.#name, String(value))
  }
}

function assertNever(x: never): never {
  throw new Error(`template: unhandled part kind ${JSON.stringify(x)}`)
}

// ── render — instantiate-or-update, commit holes (t-render) ───────────────────

/** A live template instance: the call site's `strings` (the cache key) + the live parts in hole order. */
interface Instance {
  strings: TemplateStringsArray
  parts: Part[]
}

/** Pre-order (element + comment) node list — the same order `prepare` indexed, so manifest indices map. */
function collectNodes(root: Node): Node[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT)
  const nodes: Node[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n)
  return nodes
}

/** Clone a prepared template and bind a live part to each manifest entry. The fragment is the new content. */
function createInstance(strings: TemplateStringsArray): { instance: Instance; fragment: DocumentFragment } {
  const prepared = prepare(strings)
  const fragment = prepared.template.content.cloneNode(true) as DocumentFragment
  const nodes = collectNodes(fragment)
  const parts = prepared.parts.map((info): Part => {
    const node = nodes[info.nodeIndex]
    switch (info.kind) {
      case 'child':
        return new ChildPart(node as Comment)
      case 'attr':
        return new AttrPart(node as Element, info.name)
      default:
        return assertNever(info)
    }
  })
  return { instance: { strings, parts }, fragment }
}

/** Commit each value to its part (each part owns its own `Object.is` skip). */
function commitInstance(instance: Instance, values: readonly unknown[]): void {
  for (let i = 0; i < instance.parts.length; i++) instance.parts[i].commit(values[i])
}

const RENDERED = new WeakMap<Node, Instance>()

/**
 * Commit `result` into `container`. The first render of a given `strings` at a container instantiates the
 * prepared template; a re-render with the SAME `strings` reuses that instance and writes only the changed
 * holes (per-part `Object.is`). A different `strings` replaces the container's content. Designed to accept
 * an additive trailing render-context param (for the `watch` directive) in a later slice — non-breaking.
 */
export function render(result: TemplateResult, container: Node): void {
  let instance = RENDERED.get(container)
  if (!instance || instance.strings !== result.strings) {
    container.textContent = '' // this container is render-owned; clear before a fresh instantiation
    const created = createInstance(result.strings)
    instance = created.instance
    container.appendChild(created.fragment)
    RENDERED.set(container, instance)
  }
  commitInstance(instance, result.values)
}
