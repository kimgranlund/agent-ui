// template.ts — the tagged-template engine (plan §6; G3 slice 1, the template core).
//
// `html\`…\`` returns an inert `TemplateResult` (the frozen `strings` + the dynamic `values`). The FIRST
// render of a call site `prepare`s its `strings` ONCE — markers → one `<template>` parse → a parts
// manifest — memoized in a `WeakMap` keyed by `strings` IDENTITY (stable per call site). Re-renders
// re-parse nothing: they reuse the prepared template + the live parts and write only the holes whose
// values changed (per-part `Object.is` skip). This fills `UIElement.render()` (the no-op G2 left): the
// host's one scope-owned render effect calls `render()`, which calls this engine into `renderRoot`.
//
// Parts: ChildPart (text · nested template · array · directive), AttrPart (string attribute), BooleanPart
// (`?bool`), PropertyPart (`.prop`), EventPart (`@event`, stable listener identity). `svg\`\`` fragments
// parse in the SVG namespace, and unsupported binding positions (tag-name, comment, partial attribute)
// throw at prepare naming the position. A child hole also routes a branded `DirectiveResult` to a stateful
// `Directive` (the opt-in seam below; `repeat`/`watch` are riders that import it from here). Imports nothing
// — the engine is pure DOM; reactivity comes from the host render effect re-running `render()`.
// `render(result, container, ctx?)` threads an optional `RenderContext` (the host's scope-owned `effect`)
// down to directives, so a per-hole directive effect (`watch`) is owned by the connection scope; 2-arg
// calls keep working. The seam types are module-internal — NOT re-exported from the dom barrel.

// ── TemplateResult — the inert result (t-result) ─────────────────────────────

/**
 * The inert product of `html\`…\`` / `svg\`…\``: the call site's frozen `strings`, this render's dynamic
 * `values`, and the parse MODE (`svg` fragments parse in the SVG namespace). No DOM work happens at the
 * call site — preparation is lazy, at render.
 */
export class TemplateResult {
  readonly strings: TemplateStringsArray
  readonly values: readonly unknown[]
  readonly svg: boolean
  constructor(strings: TemplateStringsArray, values: readonly unknown[], svg = false) {
    this.strings = strings
    this.values = values
    this.svg = svg
  }
}

/** Tagged-template tag → an inert HTML `TemplateResult`. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return new TemplateResult(strings, values)
}

/** Like `html`, but the fragment parses in the SVG NAMESPACE — `<circle>`/`<path>`/… become real SVGElements. */
export function svg(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return new TemplateResult(strings, values, true)
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

/**
 * One hole's source position. `child` and `attr` (whole value) are supported; the rest are unsupported
 * binding positions that throw at prepare with a NAMING message (rubric D6).
 */
type HolePosition =
  | { kind: 'child' }
  | { kind: 'attr'; name: string }
  | { kind: 'tag' } // `<${x}>` / `</${x}>` — dynamic tag name
  | { kind: 'comment' } // inside `<!-- … -->`
  | { kind: 'partial-attr' } // mixed into a multi-string attribute value

const ST_TEXT = 0
const ST_TAG_NAME = 1
const ST_TAG_ATTRS = 2
const ST_COMMENT = 3

const isNameStart = (c: string): boolean => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'

/**
 * Classify each hole's position by a minimal state scan of the static source. Deliberately NOT a full
 * tokenizer: quotes inside attribute values are not tracked, so a literal `>` inside a quoted value can
 * misclassify (same crude-scan caveat as slices 1–2). Enough to route child/attr and to NAME the three
 * unsupported positions (tag-name, comment, partial attribute).
 */
function classifyHoles(strings: TemplateStringsArray): HolePosition[] {
  const out: HolePosition[] = []
  let state = ST_TEXT
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i]
    for (let j = 0; j < s.length; j++) {
      const c = s[j]
      if (state === ST_COMMENT) {
        if (s.startsWith('-->', j)) {
          state = ST_TEXT
          j += 2 // + the loop's ++ skips `-->`
        }
      } else if (state === ST_TEXT) {
        if (s.startsWith('<!--', j)) {
          state = ST_COMMENT
          j += 3
        } else if (c === '<') {
          const n = s[j + 1]
          if (n === undefined || n === '/' || isNameStart(n)) state = ST_TAG_NAME // a real tag (or a tag-name hole)
        }
      } else if (state === ST_TAG_NAME) {
        if (c === '>') state = ST_TEXT
        else if (isSpace(c)) state = ST_TAG_ATTRS
      } else if (c === '>') {
        state = ST_TEXT // ST_TAG_ATTRS
      }
    }
    if (i < strings.length - 1) out.push(classifyAt(state, s))
  }
  return out
}

function classifyAt(state: number, chunk: string): HolePosition {
  if (state === ST_COMMENT) return { kind: 'comment' }
  if (state === ST_TAG_NAME) return { kind: 'tag' }
  if (state === ST_TAG_ATTRS) {
    const name = attrNameBefore(chunk)
    return name != null ? { kind: 'attr', name } : { kind: 'partial-attr' }
  }
  return { kind: 'child' }
}

/**
 * Prepare a call site's `strings`: build the marker HTML, parse it into one `<template>`, and walk it
 * once to build the parts manifest (cleaning attribute markers). Memoized by `strings` IDENTITY — a
 * re-render of the same call site hits the cache and re-parses nothing. Exported for the cache probes
 * (an internal seam; NOT re-exported from the dom barrel).
 */
export function prepare(strings: TemplateStringsArray, svg = false): PreparedTemplate {
  const cached = PREPARED.get(strings)
  if (cached) return cached

  // Pass 0 — classify each hole's position and throw (NAMING the position) on an unsupported one.
  const positions = classifyHoles(strings)
  positions.forEach((pos, i) => {
    if (pos.kind === 'tag') {
      throw new Error(`template: hole #${i} is in TAG-NAME position (\`<\${…}>\` / \`</\${…}>\`) — the tag name must be static; a dynamic tag is not supported.`)
    }
    if (pos.kind === 'comment') {
      throw new Error(`template: hole #${i} is inside an HTML COMMENT (\`<!-- \${…} -->\`) — not a supported binding position.`)
    }
    if (pos.kind === 'partial-attr') {
      throw new Error(`template: hole #${i} is in a PARTIAL attribute value (\`name="… \${…} …"\`) — only a whole-value attribute hole (\`name=\${…}\`) is supported.`)
    }
  })

  // Pass 1 — build the marker HTML from the validated positions, capturing each hole's SOURCE attribute
  // name (the HTML parser lowercases attribute names, which would corrupt a `.prop`'s camelCase). `null` = child.
  let markup = ''
  const holeNames: (string | null)[] = []
  for (let i = 0; i < strings.length; i++) {
    markup += strings[i]
    if (i < strings.length - 1) {
      const pos = positions[i]
      if (pos.kind === 'attr') {
        markup += MARKER
        holeNames.push(pos.name)
      } else {
        markup += CHILD_MARKER // 'child' (tag/comment/partial already threw)
        holeNames.push(null)
      }
    }
  }

  // Parse. For `svg`, wrap the markup in an `<svg>` so its children parse in the SVG namespace, then LIFT
  // those children up to the template content (their namespace is fixed at creation, so lifting/cloning
  // keeps it) and drop the wrapper.
  const template = document.createElement('template')
  if (svg) {
    template.innerHTML = `<svg>${markup}</svg>`
    const wrap = template.content.firstElementChild
    if (wrap) {
      while (wrap.firstChild) template.content.appendChild(wrap.firstChild)
      wrap.remove()
    }
  } else {
    template.innerHTML = markup
  }

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

// ── directives — the opt-in extension seam (d-seam) ──────────────────────────
//
// A directive is a BRANDED factory → a stateful instance whose `update` threads state across commits of
// the SAME child hole, with a `dispose()`. `ChildPart` recognizes a branded `DirectiveResult` and routes
// to the instance — the SOLE extension point; `repeat`/`watch` (later slices) are riders, never special-
// cased in the part engine. The seam base lives HERE (beside `ChildPart`) so the rider files import it
// from this module with no import cycle; none of it is re-exported from the dom barrel (an internal seam).

const DIRECTIVE_BRAND = Symbol('ui.directive')

/**
 * The render-side handle a directive uses to reach the host's CONNECTION SCOPE — the scope_seam. A host
 * (`UIElement`) satisfies it structurally via its scope-owned `effect`. Threaded read-only into the render
 * path so a per-hole directive effect (e.g. `watch`) is owned by the connection scope, NOT the transient
 * render effect — which re-runs (scheduler flush) with no active owner, so a bare `effect()` created there
 * would leak. `ctx.effect` re-establishes scope ownership explicitly on every render.
 *
 * Install-once invariant for an effect-owning directive: gate the install on a flag, but re-assert that flag
 * at the TOP of the effect body — NOT once after `ctx.effect`. The kernel runs an effect's cleanup before
 * EVERY re-run (not only on disposal), so a cleanup that clears the flag clears it on normal re-runs too;
 * re-asserting in the body nets `true` on a re-run and `false` only on disposal, so a later host re-render
 * won't double-install. (See `watch.ts`; the `scope_seam` probe in template-directives.test.ts pins it.)
 */
export interface RenderContext {
  effect(fn: () => void | (() => void)): () => void
}

/** A directive's `update` returns this when it manages its OWN DOM (via sub-parts) — the host part commits nothing. */
export const NO_COMMIT = Symbol('ui.directive.no-commit')

/**
 * A directive instance: `update` runs on every commit of its hole (threading state across commits of the
 * SAME hole), returning a value the host part commits through its normal child path OR `NO_COMMIT` when the
 * directive drives its own DOM; `dispose` tears it down. The host `ChildPart` is handed to the constructor
 * so a DOM-owning directive can drive sub-parts via the `protected` primitives below. Subclassed by the
 * rider files (repeat.ts/watch.ts) — never instantiated by consumers; reached only through `directive()`.
 */
export abstract class Directive {
  readonly #part: ChildPart
  constructor(part: ChildPart) {
    this.#part = part
  }

  /**
   * Create a sub-`ChildPart` rendering into THIS directive's hole (its anchor sits just before the host
   * hole's anchor). `watch` drives one inner part; `repeat` drives one per item. The returned part's
   * `commit` / `dispose` / `moveBefore` / `startNode` are the directive's DOM primitives.
   */
  protected createPart(): ChildPart {
    return this.#part.createChild()
  }

  /** The host hole's end boundary — sub-part content orders BEFORE this node (a `repeat` reorder reference). */
  protected get endNode(): ChildNode {
    return this.#part.endNode
  }

  /** Recognize the directive on each commit of the hole; return a value to commit, or `NO_COMMIT`. */
  abstract update(args: readonly unknown[], ctx?: RenderContext): unknown

  /** Tear down owned DOM/effects. Default no-op; the part isolates a throw so sibling teardown still runs. */
  dispose(): void {}
}

type DirectiveConstructor = new (part: ChildPart) => Directive

/** The inert product of a directive factory call — like `TemplateResult`, no DOM work at the call site. */
export interface DirectiveResult {
  readonly [DIRECTIVE_BRAND]: true
  readonly ctor: DirectiveConstructor
  readonly args: readonly unknown[]
}

function isDirectiveResult(value: unknown): value is DirectiveResult {
  return typeof value === 'object' && value !== null && (value as Partial<DirectiveResult>)[DIRECTIVE_BRAND] === true
}

/**
 * Wrap a `Directive` subclass into a factory: `const repeat = directive(RepeatDirective)`. Calling the
 * factory returns an inert branded `DirectiveResult` that a child hole routes to its (per-hole, state-
 * threading) instance. Rider files import this from template.ts — the one extension point.
 */
export function directive(ctor: DirectiveConstructor): (...args: unknown[]) => DirectiveResult {
  return (...args) => ({ [DIRECTIVE_BRAND]: true, ctor, args })
}

/** Teardown isolation: a throwing directive disposer is reported, never rethrown, so siblings still tear down. */
function reportDirectiveError(err: unknown): void {
  console.error('directive dispose threw (isolated):', err)
}

// ── parts — one site, one Object.is dirty check (t-child-part, t-attr-parts) ──

const UNCOMMITTED = Symbol('uncommitted') // never Object.is-equal to any committed value → first commit always runs

interface Part {
  commit(value: unknown, ctx?: RenderContext): void
}

/** A child hole: commits a primitive (text, updated in place), a nested `TemplateResult`, an array, or a directive. */
class ChildPart implements Part {
  #anchor: Comment // the marker comment; content is inserted as its previous siblings
  #committed: unknown = UNCOMMITTED
  #nodes: ChildNode[] = [] // the nodes this part directly owns (text / nested-template top nodes)
  #nested: Instance | null = null // the live instance when the value is a nested template
  #items: ChildPart[] | null = null // one sub-part per array item, each with its own anchor
  #directive: Directive | null = null // the live directive when the value is a branded DirectiveResult
  #directiveCtor: DirectiveConstructor | null = null // its ctor, so a same-ctor re-commit threads state
  #ctx: RenderContext | undefined = undefined // the render context for THIS commit pass (handed to directives)

  constructor(anchor: Comment) {
    this.#anchor = anchor
  }

  commit(value: unknown, ctx?: RenderContext): void {
    this.#ctx = ctx
    if (isDirectiveResult(value)) {
      this.#commitDirective(value)
      return
    }
    if (this.#directive) {
      // Leaving directive mode (the hole is no longer a directive) → dispose it (it owned the DOM) and reset.
      this.#disposeDirective() // isolated; #clear() only touches content, never the directive
      this.#clear()
      this.#committed = UNCOMMITTED
    }
    this.#commitChild(value)
  }

  /** Remove this part's content + its directive AND its own anchor — for an array sub-part being dropped. */
  dispose(): void {
    this.#disposeDirective()
    this.#clear()
    this.#anchor.remove()
  }

  /** Create a sub-part whose anchor sits just before THIS part's anchor — a directive's DOM primitive. */
  createChild(): ChildPart {
    const anchor = document.createComment('')
    this.#anchor.before(anchor)
    return new ChildPart(anchor)
  }

  /** This part's end boundary — a directive orders sub-part content before it. */
  get endNode(): ChildNode {
    return this.#anchor
  }

  /** The first DOM node of this part's range (its first owned node, else its anchor) — a reorder reference. */
  get startNode(): ChildNode {
    return this.#nodes.length > 0 ? this.#nodes[0] : this.#anchor
  }

  /**
   * Relocate this part's owned nodes + anchor to just before `ref`. TWO-TIER guarantee (ADR-0022): NODE
   * IDENTITY is preserved always, on every engine (the same node objects move, never re-created). ELEMENT
   * STATE — focus, selection, transitions, `<iframe>`/media — survives ONLY on the native path, where the
   * parent supports `Node.prototype.moveBefore` (an atomic move that never detaches the node from the
   * document); on the `before()` fallback (native absent) the nodes are detached + re-inserted, so identity
   * is kept but focus/state are NOT (graceful degradation — the reconcile stays correct, only the focus
   * nicety is absent). Covers a part holding text or a single nested template (the `repeat` item norm); a
   * part holding an array/nested directive keeps deeper content in sub-anchors `#nodes` does not track.
   *
   * Caller invariant (repeat): `ref` and the moving `#nodes`/`#anchor` always share the same connected
   * parent (the directive's container) — native `moveBefore`'s happy path, so no `try/catch` is needed; a
   * future caller that violated same-parent/connected would get a loud `HierarchyRequestError`, not a
   * silent mis-move.
   */
  moveBefore(ref: ChildNode): void {
    const parent = ref.parentNode
    if (parent && 'moveBefore' in parent) {
      // native atomic move: relocate WITHOUT leaving the document → focus/selection/state survive
      const p = parent as ParentNode & { moveBefore(node: Node, child: Node | null): void }
      for (const node of this.#nodes) p.moveBefore(node, ref)
      p.moveBefore(this.#anchor, ref)
    } else {
      // fallback: detach+reinsert — identity preserved, focus/selection NOT (graceful degradation)
      for (const node of this.#nodes) ref.before(node)
      ref.before(this.#anchor)
    }
  }

  /** Commit a plain (non-directive) value through the text/template/array dispatch, honoring the Object.is skip. */
  #commitChild(value: unknown): void {
    if (Object.is(value, this.#committed)) return // Object.is skip — an equal (same-ref) hole writes no DOM
    if (Array.isArray(value)) this.#commitArray(value)
    else if (value instanceof TemplateResult) this.#commitTemplate(value)
    else this.#commitText(value)
    this.#committed = value
  }

  /**
   * Route a branded `DirectiveResult` to its instance: a same-ctor re-commit reuses the instance (state
   * threads across commits of the same hole); a different ctor (or first entry) disposes the prior content
   * + directive and constructs a fresh one. The instance's `update` either RETURNS a value committed through
   * the normal child path, or `NO_COMMIT` when it drives its own DOM. The ctx (the host's connection scope)
   * is handed through so a per-hole effect (`watch`) is scope-owned.
   */
  #commitDirective(result: DirectiveResult): void {
    if (this.#directiveCtor !== result.ctor) {
      this.#disposeDirective() // dispose any prior directive (isolated) before swapping in a different one
      this.#clear() // clear leftover content (a value-producing directive's host-owned DOM)
      this.#committed = UNCOMMITTED
      this.#directive = new result.ctor(this)
      this.#directiveCtor = result.ctor
    }
    const out = this.#directive!.update(result.args, this.#ctx)
    if (out === NO_COMMIT) {
      this.#committed = result // in directive mode; a fresh DirectiveResult each render never Object.is-skips
      return
    }
    this.#commitChild(out) // a value-producing directive commits through the normal child path
  }

  /** Dispose the live directive, ISOLATING a throwing disposer (reported, not rethrown) so siblings tear down. */
  #disposeDirective(): void {
    const dir = this.#directive
    if (!dir) return
    this.#directive = null
    this.#directiveCtor = null
    try {
      dir.dispose()
    } catch (err) {
      reportDirectiveError(err)
    }
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
      commitInstance(this.#nested, result.values, this.#ctx) // same call site → update parts in place (recursive skip)
      return
    }
    this.#clear() // a DIFFERENT template (or leaving text/array mode) → replace
    const created = createInstance(result)
    commitInstance(created.instance, result.values, this.#ctx)
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
    for (let i = 0; i < items.length; i++) parts[i].commit(items[i], this.#ctx)
  }

  /** Clear CONTENT only (items / owned nodes / nested instance). The directive is torn down separately, at
   *  the real teardown points (leaving directive mode, swapping directives, disposing the part) — never on a
   *  value-producing directive's own #commitChild, which routes through here. */
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
function createInstance(result: TemplateResult): { instance: Instance; fragment: DocumentFragment } {
  const prepared = prepare(result.strings, result.svg)
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
  return { instance: { strings: result.strings, parts }, fragment }
}

/** Commit each value to its part (each part owns its own `Object.is` skip); thread the render context to directives. */
function commitInstance(instance: Instance, values: readonly unknown[], ctx?: RenderContext): void {
  for (let i = 0; i < instance.parts.length; i++) instance.parts[i].commit(values[i], ctx)
}

const RENDERED = new WeakMap<Node, Instance>()

/**
 * Commit `result` into `container`. The first render of a given `strings` at a container instantiates the
 * prepared template; a re-render with the SAME `strings` reuses that instance and writes only the changed
 * holes (per-part `Object.is`). A different `strings` replaces the container's content. The optional `ctx`
 * (the host's scope-owned `effect`) threads to directives so a per-hole effect (`watch`) is scope-owned;
 * 2-arg calls keep working (`ctx` undefined → directives that need it simply have none).
 */
export function render(result: TemplateResult, container: Node, ctx?: RenderContext): void {
  let instance = RENDERED.get(container)
  if (!instance || instance.strings !== result.strings) {
    container.textContent = '' // this container is render-owned; clear before a fresh instantiation
    const created = createInstance(result)
    instance = created.instance
    container.appendChild(created.fragment)
    RENDERED.set(container, instance)
  }
  commitInstance(instance, result.values, ctx)
}
