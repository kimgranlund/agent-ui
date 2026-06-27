// template.ts — the tagged-template engine (plan §6; G3 slice 1, the template core).
//
// `html\`…\`` returns an inert `TemplateResult` (the frozen `strings` + the dynamic `values`). The FIRST
// render of a call site `prepare`s its `strings` ONCE — markers → one `<template>` parse → a parts
// manifest — memoized in a `WeakMap` keyed by `strings` IDENTITY (stable per call site). Re-renders
// re-parse nothing: they reuse the prepared template + the live parts and write only the holes whose
// values changed (per-part `Object.is` skip). This fills `UIElement.render()` (the no-op G2 left): the
// host's one scope-owned render effect calls `render()`, which calls this engine into `renderRoot`.
//
// Parts: ChildPart (text · nested template · array), AttrPart (string attribute), BooleanPart (`?bool`),
// PropertyPart (`.prop`), EventPart (`@event`, stable listener identity). The directive seam + svg/position
// validation land in later slices. Imports nothing — the engine is pure DOM; reactivity comes from the
// host render effect re-running `render()`.
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

/**
 * Where one hole binds. A child position (the marker comment), or one of the attribute-position kinds
 * routed by binding sigil: `attr` (string attribute), `bool` (`?name`), `prop` (`.name`, a DOM property),
 * `event` (`@name`). `nodeIndex` is the host node's pre-order index; `name` is the SOURCE name (sigil
 * stripped) — taken from the template strings, NOT the parsed DOM, so a `.prop`'s camelCase survives the
 * HTML parser's attribute-name lowercasing.
 */
type PartInfo =
  | { kind: 'child'; nodeIndex: number }
  | { kind: 'attr'; nodeIndex: number; name: string }
  | { kind: 'bool'; nodeIndex: number; name: string }
  | { kind: 'prop'; nodeIndex: number; name: string }
  | { kind: 'event'; nodeIndex: number; name: string }

/** The attribute name (with any binding sigil) immediately before a hole, captured from the source chunk. */
const ATTR_NAME = /([.?@]?[A-Za-z][\w.:-]*)\s*=\s*["']?$/

function attrNameBefore(chunk: string): string | null {
  const m = ATTR_NAME.exec(chunk)
  return m ? m[1] : null
}

/** Route a source attribute name (with sigil) to its part kind, stripping the sigil from the bound name. */
function attrPartInfo(nodeIndex: number, sourceName: string): PartInfo {
  switch (sourceName[0]) {
    case '?':
      return { kind: 'bool', nodeIndex, name: sourceName.slice(1) }
    case '.':
      return { kind: 'prop', nodeIndex, name: sourceName.slice(1) }
    case '@':
      return { kind: 'event', nodeIndex, name: sourceName.slice(1) }
    default:
      return { kind: 'attr', nodeIndex, name: sourceName }
  }
}

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

  // Pass 1 — build the marker HTML and capture each hole's SOURCE attribute name (with sigil), since the
  // HTML parser lowercases attribute names (which would corrupt a `.prop`'s camelCase). `null` = a child hole.
  let markup = ''
  let inTag = false
  const holeNames: (string | null)[] = []
  for (let i = 0; i < strings.length; i++) {
    markup += strings[i]
    inTag = scanInTag(strings[i], inTag)
    if (i < strings.length - 1) {
      markup += inTag ? MARKER : CHILD_MARKER
      holeNames.push(inTag ? attrNameBefore(strings[i]) : null)
    }
  }

  const template = document.createElement('template')
  template.innerHTML = markup

  // Pass 2 — walk pre-order (element + comment); collect the marker sites in document order (= source
  // order), cleaning marker attributes. A marker comment is a child site; a marker-valued attribute is an
  // attribute site (its parsed, lowercased name is only used to clean it — the real name is the source one).
  type Found = { kind: 'child'; nodeIndex: number } | { kind: 'attr'; nodeIndex: number }
  const found: Found[] = []
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT)
  let nodeIndex = -1
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodeIndex++
    if (node.nodeType === Node.COMMENT_NODE) {
      if ((node as Comment).data === MARKER) found.push({ kind: 'child', nodeIndex })
    } else {
      const el = node as Element
      const markerAttrs: string[] = []
      for (const attr of Array.from(el.attributes)) {
        if (attr.value === MARKER) {
          found.push({ kind: 'attr', nodeIndex })
          markerAttrs.push(attr.name)
        }
      }
      for (const name of markerAttrs) el.removeAttribute(name) // the live part sets the real value
    }
  }

  // Zip the found sites (document order) with the source names (source order) — they align hole-for-hole.
  // Invariant: one site per hole, and the site's kind matches the source's classification; otherwise a hole
  // landed in a position slice 1–2 doesn't support and would drop its value SILENTLY. Fail loud instead;
  // slice 3 (t-positions) enriches this into a position-naming message.
  const holes = strings.length - 1
  const mismatch = (): never => {
    throw new Error(
      `template: ${holes} hole(s) but ${found.length} binding site(s), or a mis-positioned hole — an ` +
        `unsupported binding position. Supported: a child hole, or a whole-value attribute hole ` +
        `(plain, or ?bool / .prop / @event). Richer diagnostics land in slice 3.`,
    )
  }
  if (found.length !== holes) mismatch()
  const parts: PartInfo[] = found.map((site, k): PartInfo => {
    if (site.kind === 'child') {
      if (holeNames[k] != null) return mismatch()
      return { kind: 'child', nodeIndex: site.nodeIndex }
    }
    const name = holeNames[k]
    if (name == null) return mismatch()
    return attrPartInfo(site.nodeIndex, name)
  })

  const prepared: PreparedTemplate = { template, parts }
  PREPARED.set(strings, prepared)
  return prepared
}

// ── parts — one site, one Object.is dirty check (t-child-part, t-attr-parts) ──

const UNCOMMITTED = Symbol('uncommitted') // never Object.is-equal to any committed value → first commit always runs

interface Part {
  commit(value: unknown): void
}

/** A child hole: commits a primitive (text, updated in place), a nested `TemplateResult`, or an array. */
class ChildPart implements Part {
  #anchor: Comment // the marker comment; content is inserted as its previous siblings
  #committed: unknown = UNCOMMITTED
  #nodes: ChildNode[] = [] // the nodes this part directly owns (text / nested-template top nodes)
  #nested: Instance | null = null // the live instance when the value is a nested template
  #items: ChildPart[] | null = null // one sub-part per array item, each with its own anchor

  constructor(anchor: Comment) {
    this.#anchor = anchor
  }

  commit(value: unknown): void {
    if (Object.is(value, this.#committed)) return // Object.is skip — an equal (same-ref) hole writes no DOM
    if (Array.isArray(value)) this.#commitArray(value)
    else if (value instanceof TemplateResult) this.#commitTemplate(value)
    else this.#commitText(value)
    this.#committed = value
  }

  /** Remove this part's content AND its own anchor — for an array sub-part being dropped. */
  dispose(): void {
    this.#clear()
    this.#anchor.remove()
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
    this.#clear() // a DIFFERENT template (or leaving text/array mode) → replace
    const created = createInstance(result.strings)
    commitInstance(created.instance, result.values)
    this.#nodes = Array.from(created.fragment.childNodes) // capture BEFORE insertion empties the fragment
    this.#anchor.before(created.fragment)
    this.#nested = created.instance
  }

  /** Position reconcile (NOT keyed — that is `repeat`, slice 5): append/remove/update each item by index. */
  #commitArray(items: readonly unknown[]): void {
    if (!this.#items) {
      this.#clear() // leaving text/template mode
      this.#items = []
    }
    const parts = this.#items
    while (parts.length < items.length) {
      const anchor = document.createComment('')
      this.#anchor.before(anchor) // each sub-part's anchor sits before this part's anchor, in order
      parts.push(new ChildPart(anchor))
    }
    while (parts.length > items.length) parts.pop()?.dispose()
    for (let i = 0; i < items.length; i++) parts[i].commit(items[i])
  }

  #clear(): void {
    if (this.#items) {
      for (const item of this.#items) item.dispose()
      this.#items = null
    }
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

/** A `?bool` hole: toggles the boolean attribute's presence (truthy adds, falsy removes). */
class BooleanPart implements Part {
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
    this.#el.toggleAttribute(this.#name, Boolean(value))
  }
}

/** A `.prop` hole: assigns the DOM PROPERTY (not an attribute). The name keeps its source camelCase. */
class PropertyPart implements Part {
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
    ;(this.#el as unknown as Record<string, unknown>)[this.#name] = value
  }
}

/**
 * An `@event` hole with STABLE listener identity: `addEventListener` is called once for a stable wrapper
 * that forwards to the CURRENT handler, so re-renders never churn the platform listener (no remove/add,
 * no event dropped mid-swap). A changed handler just swaps the internal ref; an `Object.is`-equal handler
 * is a no-op; clearing to a non-function removes the listener.
 */
class EventPart implements Part {
  #el: Element
  #type: string
  #handler: EventListener | null = null
  #attached = false
  #committed: unknown = UNCOMMITTED
  readonly #listener = (event: Event): void => {
    this.#handler?.(event)
  }

  constructor(el: Element, type: string) {
    this.#el = el
    this.#type = type
  }

  commit(value: unknown): void {
    if (Object.is(value, this.#committed)) return // Object.is skip — same handler, no churn
    this.#committed = value
    this.#handler = typeof value === 'function' ? (value as EventListener) : null
    if (this.#handler && !this.#attached) {
      this.#el.addEventListener(this.#type, this.#listener) // the ONE, stable listener
      this.#attached = true
    } else if (!this.#handler && this.#attached) {
      this.#el.removeEventListener(this.#type, this.#listener)
      this.#attached = false
    }
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
      case 'bool':
        return new BooleanPart(node as Element, info.name)
      case 'prop':
        return new PropertyPart(node as Element, info.name)
      case 'event':
        return new EventPart(node as Element, info.name)
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
