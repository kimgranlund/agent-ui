// cm-richtext.ts — the richtext live-preview DECORATION ENGINE (ADR-0147). A pure VIEW transform over the
// SAME EditorView/document cm-editor.ts already builds: styles the v1 markdown constructs (headings/strong/
// emphasis/inline-code/links/bullets/blockquote) and HIDES their raw markup — except on the line(s) the
// selection touches (reveal-near-cursor, Obsidian-style). There is no second DOM tree and no serializer: the
// decorations are computed fresh from `syntaxTree()` (the same parse `cm-editor.ts`'s `highlightStyle` already
// rides) on every doc/viewport/selection change, viewport-bounded via `view.visibleRanges` (the per-keystroke
// cost stays O(visible), ADR-0147's Consequences bullet).
//
// Statically imported ONLY by cm-editor.ts (confinement.test.ts's lazy PAIR invariant) — this module is
// reached exclusively through cm-editor.ts's own dynamic import, so it lands in the SAME lazy chunk and never
// enters any main bundle. It carries no CSS — `rt-*` classes are coloured/sized by editor.css (ADR-0147 cl.8).

import { RangeSetBuilder } from '@codemirror/state'
import type { Extension, EditorState } from '@codemirror/state'
import { Decoration, WidgetType, ViewPlugin, EditorView } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { safeHref, LINK_REL, LINK_TARGET } from '@agent-ui/components/controls/text'

// ── the bullet widget — a real text glyph (readable, matches the visual; no aria-hidden games) ──
class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true // stateless — every bullet instance is interchangeable, never redrawn needlessly
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'rt-bullet'
    span.textContent = '•' // •
    return span
  }
}

const HEADING_LEVEL: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
}

interface Entry {
  from: number
  to: number
  deco: Decoration
}

/**
 * Build the full decoration set for the CURRENT state — viewport-bounded (walks only `view.visibleRanges`),
 * reveal-aware (suppresses HIDE decorations on the selection's line(s), keeps styling everywhere).
 */
function buildDecorations(view: EditorView): DecorationSet {
  const state = view.state
  const doc = state.doc
  const tree = syntaxTree(state)

  // The reveal set: every line any selection range touches (ADR-0147 cl.3).
  const revealedLines = new Set<number>()
  for (const range of state.selection.ranges) {
    const from = doc.lineAt(range.from).number
    const to = doc.lineAt(range.to).number
    for (let n = from; n <= to; n++) revealedLines.add(n)
  }
  const touchesRevealedLine = (from: number, to: number): boolean => {
    const start = doc.lineAt(from).number
    const end = doc.lineAt(Math.max(from, to - 1)).number
    for (let n = start; n <= end; n++) if (revealedLines.has(n)) return true
    return false
  }

  const entries: Entry[] = []
  const style = (from: number, to: number, deco: Decoration): void => {
    entries.push({ from, to, deco })
  }
  // A HIDE decoration is suppressed entirely when it sits on a revealed line — the raw markup then simply
  // renders as ordinary (unhidden) source text, with its styling decoration still applied (cl.3).
  const hide = (from: number, to: number): void => {
    if (to <= from) return
    if (touchesRevealedLine(from, to)) return
    entries.push({ from, to, deco: Decoration.replace({}) })
  }
  // One following space folded into a hide range (headings/blockquote — "## " / "> " collapse together).
  const hideMarkAndSpace = (markFrom: number, markTo: number): void => {
    let to = markTo
    if (doc.sliceString(to, to + 1) === ' ') to += 1
    hide(markFrom, to)
  }

  for (const { from: rangeFrom, to: rangeTo } of view.visibleRanges) {
    tree.iterate({
      from: rangeFrom,
      to: rangeTo,
      enter(ref) {
        const name = ref.name

        const level = HEADING_LEVEL[name]
        if (level !== undefined) {
          const line = doc.lineAt(ref.from)
          style(line.from, line.from, Decoration.line({ class: `rt-heading rt-h${level}` }))
          const mark = ref.node.getChild('HeaderMark')
          if (mark) hideMarkAndSpace(mark.from, mark.to)
          return
        }

        if (name === 'StrongEmphasis' || name === 'Emphasis') {
          style(ref.from, ref.to, Decoration.mark({ class: name === 'StrongEmphasis' ? 'rt-strong' : 'rt-emphasis' }))
          for (const mark of ref.node.getChildren('EmphasisMark')) hide(mark.from, mark.to)
          return
        }

        if (name === 'InlineCode') {
          style(ref.from, ref.to, Decoration.mark({ class: 'rt-code' }))
          for (const mark of ref.node.getChildren('CodeMark')) hide(mark.from, mark.to)
          return
        }

        if (name === 'Link') {
          const marks = ref.node.getChildren('LinkMark') // [ '[', ']', '(', ')' ] in document order
          const open = marks[0]
          const close = marks[1]
          const paren = marks[3] ?? marks[2]
          if (open && close) {
            style(open.to, close.from, Decoration.mark({ class: 'rt-link' })) // the link TEXT span only
            hide(open.from, open.to) // '['
            hide(close.from, paren ? paren.to : close.to) // ']' through the closing ')' (URL included)
          }
          return
        }

        if (name === 'ListItem') {
          const mark = ref.node.getChild('ListMark')
          // Lezer's markdown grammar uses ListItem/ListMark for BOTH bullet lists ("-"/"*"/"+") AND ordered
          // lists ("1."/"2)"...) — ADR-0147 cl.4 names UNORDERED-list bullets only; an ordered marker must
          // render as source (the ADR's own "everything unnamed renders as source" rule). Guard on the
          // mark's own TEXT rather than the parent node name — robust regardless of nesting depth.
          const isBulletMark = mark && /^[-*+]$/.test(doc.sliceString(mark.from, mark.to))
          if (mark && isBulletMark && !touchesRevealedLine(mark.from, mark.to)) {
            style(mark.from, mark.to, Decoration.replace({ widget: new BulletWidget() }))
          }
          return
        }

        if (name === 'QuoteMark') {
          const line = doc.lineAt(ref.from)
          style(line.from, line.from, Decoration.line({ class: 'rt-quote-line' }))
          hideMarkAndSpace(ref.from, ref.to)
          return
        }

        // FencedCode / Table / Image / TaskMarker / SetextHeading* / HorizontalRule / HTML nodes: no case ⇒
        // verbatim source (ADR-0147 cl.4's v1 outs — the walk simply has no branch for them).
      },
    })
  }

  // Sorted by (from, startSide) — CodeMirror's own RangeSetBuilder contract. No further tie-break is needed:
  // `Array.prototype.sort` has been spec-guaranteed STABLE since ES2019 (both Chromium and WebKit, the two
  // engines this fleet's browser tests target, implement it), and entries are pushed in tree-iteration
  // (document) order — a stable sort preserves that order on ties with no extra bookkeeping. Line decorations
  // carry the lowest startSide, so they land first at an equal `from` (the heading/quote line class before
  // its own hidden mark — ADR-0147 cl.8's ordering note).
  entries.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide)

  const builder = new RangeSetBuilder<Decoration>()
  for (const entry of entries) builder.add(entry.from, entry.to, entry.deco)
  return builder.finish()
}

class RichtextView {
  decorations: DecorationSet
  constructor(view: EditorView) {
    this.decorations = buildDecorations(view)
  }
  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view)
    }
  }
}

const richtextPlugin = ViewPlugin.fromClass(RichtextView, {
  decorations: (v) => v.decorations,
})

/** Resolve the enclosing `Link` node (if any) at `pos`, returning its URL text. Recursive (rather than a
 *  reassigned `let`) so the walk-up stays typed off `syntaxTree()`'s own return shape — no `@lezer/common`
 *  type import is needed (ADR-0147's zero-new-dependency bound; `@lezer/common` is a transitive type only). */
function linkAt(state: EditorState, pos: number): string | null {
  const start = syntaxTree(state).resolveInner(pos, -1)
  const walkUp = (node: typeof start): string | null => {
    if (node.name === 'Link') {
      const url = node.getChild('URL')
      return url ? state.doc.sliceString(url.from, url.to) : null
    }
    return node.parent ? walkUp(node.parent) : null
  }
  return walkUp(start)
}

// Cmd+click ALWAYS opens the link's URL — the universal, collision-free "open" modifier. Ctrl+click does the
// same off macOS (the Windows/Linux convention), but NOT on macOS: Ctrl+click is the platform's own
// context-menu gesture on a single-button pointer, and a bare `ctrlKey` check would silently hijack it
// (code-review finding) — a plain click falls through to CM either way (cursor placement stays primary,
// editing is the whole story, ADR-0147 cl.3).
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)
/** Exported for the jsdom platform-gate regression test ONLY (`cm-richtext.test.ts`) — `isMac` is computed
 *  ONCE at module load, so the test re-imports this module fresh (`vi.resetModules()`) after stubbing
 *  `navigator` to exercise both branches. Nothing else imports this — `confinement.test.ts`'s lazy-pair
 *  invariant (only `cm-editor.ts` may statically import this module) is unaffected: `.test.ts` files are
 *  excluded from that walk by construction. */
export function isOpenModifier(event: MouseEvent): boolean {
  if (event.metaKey) return true
  return event.ctrlKey && !isMac
}

// The fleet's own scheme gate (@agent-ui/components/controls/text, ADR-0114) — the SAME allowlist + `noopener
// noreferrer` policy every other link-opening surface in the fleet uses, imported rather than re-declared
// (code-review finding: a hand-rolled copy here had drifted weaker — a raw-string scheme check instead of
// `safeHref`'s `new URL()` parse, and a bare `noopener` missing `noreferrer`).
const linkClickHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!isOpenModifier(event)) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const url = linkAt(view.state, pos)
    if (!url) return false
    const allowed = safeHref(url, document.baseURI)
    if (allowed === null) return false
    event.preventDefault()
    window.open(allowed, LINK_TARGET, LINK_REL)
    return true
  },
})

/** The richtext live-preview extension — decorations + the modifier-click link handler (ADR-0147 cl.2/cl.3/cl.4). */
export function richtextExtension(): Extension {
  return [richtextPlugin, linkClickHandler]
}
