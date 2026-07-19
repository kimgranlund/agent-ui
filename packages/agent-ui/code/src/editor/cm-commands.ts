// cm-commands.ts — ui-code-editor's markdown FORMATTING commands (Kim's ask, 2026-07-19, following ADR-0147):
// keyboard-driven bold/italic/inline-code toggle-wrap, heading/list line-prefix toggle, and a paste-time
// "selected text + a pasted URL become a link" transform. These are TEXT commands over the SAME CodeMirror
// document `cm-richtext.ts`'s decorations already render — never a second model, never a serializer (the
// ADR-0147 architecture this build reuses verbatim). Wired at the BASE keymap in cm-editor.ts (not inside
// `richtextExtension()`'s mode Compartment), so every command works identically in BOTH `source` and
// `richtext` mode: the document is markdown text either way, and only the VISUAL decoration differs by mode
// — a command's correctness must never depend on which mode happens to be active.
//
// Statically imported only from cm-editor.ts (the ONE module in this package allowed to import CodeMirror,
// ADR-0139 cl.1/cl.8b) — this file adds no new CM package dependency, it only uses what cm-editor.ts/
// cm-richtext.ts already import.

import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { KeyBinding } from '@codemirror/view'
import { safeHref } from '@agent-ui/components/controls/text'

// ── toggle-wrap (bold/italic/inline code) ──────────────────────────────────────────────────────────────
//
// A selection already immediately bounded by `marker` on both sides toggles OFF (the markers are removed).
// A selection whose OWN start/end already ARE the markers (the common "select-all (or the whole line)
// after a prior toggle-on, now including the markers themselves" case) ALSO toggles off — both are real,
// expected interaction shapes, not just one canonical selection anchor. Otherwise it toggles ON (wrapped).
// An EMPTY selection (a bare cursor) inserts an empty pair with the cursor parked between them, ready to
// type. Uses CodeMirror's own `changeByRange` — the canonical multi-range-safe transaction shape
// `defaultKeymap`'s own commands use internally — so this stays correct even under CM's native multi-
// cursor selection, not just the common single-selection case.
//
// KNOWN LIMITATION, not fixed here: nested/overlapping emphasis (e.g. toggling italic `*` on a selection
// that is ITSELF an already-bold `**span**`, or toggling italic inside a bold span some other way) is
// detected by exact character-run match only — it does not understand markdown's own nesting grammar, so
// a doubly-wrapped span may not toggle exactly as a human would expect. Acceptable for v1; every
// mainstream lightweight markdown editor has the same limitation.
function toggleWrap(marker: string) {
  return (view: EditorView): boolean => {
    const { state } = view
    const tr = state.changeByRange((range) => {
      if (range.empty) {
        const insert = marker + marker
        return { changes: { from: range.from, insert }, range: EditorSelection.cursor(range.from + marker.length) }
      }
      const before = state.sliceDoc(Math.max(0, range.from - marker.length), range.from)
      const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + marker.length))
      if (before === marker && after === marker) {
        // toggle OFF — the markers flank the selection from OUTSIDE it.
        return {
          changes: [
            { from: range.from - marker.length, to: range.from },
            { from: range.to, to: range.to + marker.length },
          ],
          range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
        }
      }
      const selected = state.sliceDoc(range.from, range.to)
      if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
        // toggle OFF — the selection ITSELF includes the markers (e.g. select-all after a prior toggle-on).
        return {
          changes: [
            { from: range.from, to: range.from + marker.length },
            { from: range.to - marker.length, to: range.to },
          ],
          range: EditorSelection.range(range.from, range.to - marker.length * 2),
        }
      }
      // toggle ON — wrap the selection, keeping the SAME text selected (now inside the markers).
      return {
        changes: [{ from: range.from, insert: marker }, { from: range.to, insert: marker }],
        range: EditorSelection.range(range.from + marker.length, range.to + marker.length),
      }
    })
    view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input' }))
    return true
  }
}

// ── line-prefix transforms (headings, lists) ───────────────────────────────────────────────────────────
//
// Uses `changeByRange`, so it applies `mapLine` to every line EACH selection RANGE touches (start line
// through end line, inclusive) — not just the primary selection — replacing that range's whole span with
// the newly-joined text in one change per range, and re-selecting each transformed span. `mapLine(text,
// index)` receives each line's CURRENT text and its 0-based position within ITS OWN range's touched span,
// restarting at 0 per range (list numbering needs the index; headings/bullets ignore it).
//
// KNOWN LIMITATION, not fixed here (mirrors toggleWrap's own nested-emphasis limitation above): the toggle
// DIRECTION (heading level / list-on-or-off) is decided ONCE from `state.selection.main`'s first line and
// baked into `mapLine`'s closure, then applied uniformly to every range — a multi-cursor selection whose
// ranges start from lines in DIFFERENT existing states (one already a heading, one not) all flip the same
// way rather than each toggling independently. Acceptable for v1: line-level formatting under genuinely
// divergent multi-cursor state is a narrow edge case, and every touched line still gets a well-formed
// result — it just may not be the per-range-independent toggle a human doing that specific edit might
// expect.
function transformLines(view: EditorView, mapLine: (lineText: string, index: number) => string): boolean {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const startLine = state.doc.lineAt(range.from)
    const endLine = state.doc.lineAt(range.to)
    const lines: string[] = []
    for (let n = startLine.number; n <= endLine.number; n++) lines.push(mapLine(state.doc.line(n).text, lines.length))
    const insert = lines.join('\n')
    return {
      changes: { from: startLine.from, to: endLine.to, insert },
      range: EditorSelection.range(startLine.from, startLine.from + insert.length),
    }
  })
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input' }))
  return true
}

const HEADING_RE = /^(#{1,6})\s+/
const BULLET_RE = /^(\s*)[-*+]\s+/
const NUMBERED_RE = /^(\s*)\d+\.\s+/

/** Toggle an ATX heading (`#`…`######`) on every line the selection touches. The toggle DIRECTION is
 *  decided once, from the selection's first line: if it's already exactly this level, every touched line
 *  is stripped back to plain text; otherwise every touched line is (re)set to this level, replacing
 *  whatever heading marker (if any) it had. */
function toggleHeading(level: number) {
  const prefix = '#'.repeat(level)
  return (view: EditorView): boolean => {
    const { state } = view
    const anchorLine = state.doc.lineAt(state.selection.main.from).text
    const anchorMatch = HEADING_RE.exec(anchorLine)
    const isThisLevel = anchorMatch !== null && anchorMatch[1].length === level
    return transformLines(view, (text) => {
      const match = HEADING_RE.exec(text)
      const stripped = match ? text.slice(match[0].length) : text
      return isThisLevel ? stripped : `${prefix} ${stripped}`
    })
  }
}

/** Toggle a bullet list (`- `) on every line the selection touches — direction decided from the first
 *  touched line, matching `toggleHeading`. A line already carrying the OTHER list type (numbered) has that
 *  marker replaced, never doubled. */
function toggleBulletList(view: EditorView): boolean {
  const { state } = view
  const isOn = BULLET_RE.test(state.doc.lineAt(state.selection.main.from).text)
  return transformLines(view, (text) => {
    const stripped = text.replace(BULLET_RE, '$1').replace(NUMBERED_RE, '$1')
    return isOn ? stripped : `- ${stripped}`
  })
}

/** Toggle a numbered list (`1.`, `2.`, …) on every line the selection touches — same direction/replace
 *  rule as `toggleBulletList`. Numbering is always renumbered 1..N over the touched lines (v1 simplicity —
 *  it does not try to continue an existing list's own count from outside the selection); the RESTART is
 *  per-range (via `mapLine`'s own `index` — `transformLines` resets it to 0 for each `changeByRange` range),
 *  not a running total across every simultaneous cursor — a second range would otherwise silently continue
 *  the first range's count instead of restarting at 1 (caught in review; the earlier version closed over a
 *  single shared counter across all ranges). */
function toggleNumberedList(view: EditorView): boolean {
  const { state } = view
  const isOn = NUMBERED_RE.test(state.doc.lineAt(state.selection.main.from).text)
  return transformLines(view, (text, index) => {
    const stripped = text.replace(BULLET_RE, '$1').replace(NUMBERED_RE, '$1')
    return isOn ? stripped : `${index + 1}. ${stripped}`
  })
}

/** The formatting keymap — bound at the BASE level in cm-editor.ts (mode-independent). Precedence: placed
 *  BEFORE `defaultKeymap`/`historyKeymap` in the composed array (cm-editor.ts) so these bindings WIN over
 *  any CM built-in on the same key — load-bearing, not just insurance: `Mod-i` collides with
 *  `defaultKeymap`'s own `selectParentSyntax` binding, and this ordering deliberately shadows it (a markdown
 *  editor's users need italic far more often than syntax-tree selection). Keybinding choices, each
 *  following an existing convention rather than inventing one: Mod-b/Mod-i (universal bold/italic), Mod-e
 *  (Slack's inline-code convention — no true cross-editor standard exists), Mod-Alt-1..4 (Notion/Google
 *  Docs' heading-level convention), Mod-Shift-8/Mod-Shift-7 (Google Docs' bullet/numbered-list convention). */
export const formattingKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: toggleWrap('**') },
  { key: 'Mod-i', run: toggleWrap('*') },
  { key: 'Mod-e', run: toggleWrap('`') },
  { key: 'Mod-Alt-1', run: toggleHeading(1) },
  { key: 'Mod-Alt-2', run: toggleHeading(2) },
  { key: 'Mod-Alt-3', run: toggleHeading(3) },
  { key: 'Mod-Alt-4', run: toggleHeading(4) },
  { key: 'Mod-Shift-8', run: toggleBulletList },
  { key: 'Mod-Shift-7', run: toggleNumberedList },
]

// ── paste-to-link ───────────────────────────────────────────────────────────────────────────────────────
//
// A paste while text is SELECTED, whose clipboard plain-text is (after trimming) nothing but a safe,
// ABSOLUTE URL, replaces the selection with a markdown link wrapping it — "select a word, paste a link, the
// word becomes clickable" (richtext mode's existing link decoration + Cmd/Ctrl-click handler,
// cm-richtext.ts, then makes it actually clickable; the underlying text edit is identical in source mode,
// just shown as raw syntax).
//
// Reuses the FLEET's own scheme gate (`safeHref`, @agent-ui/components/controls/text, ADR-0114) — the exact
// function cm-richtext.ts's link-click handler already validates against — rather than a second, hand-
// rolled URL check. `safeHref` takes a BASE because its usual caller (an anchor href) legitimately accepts
// a relative destination resolved against the page. A pasted clipboard string must NOT get that treatment —
// `safeHref(text.trim(), document.baseURI)` would resolve a bare word like "hello" into a valid same-origin
// URL and hijack an ordinary paste (caught in review). Passing the trimmed text as BOTH the raw string and
// its own base forces the WHATWG URL parser to require `raw` be independently absolute — a relative string
// has no valid base to resolve against (parsing IT as a base throws) and is correctly denied, while a
// genuinely absolute URL parses identically regardless of base (the base is unused once `raw` is absolute).
// This still reuses `safeHref` verbatim (no second hand-rolled scheme check) while excluding every relative
// form. Anything else — multi-line text, prose, an unsafe scheme, unparseable garbage — falls through to
// the browser's default paste untouched.
//
// The DESTINATION slot additionally percent-encodes '(', ')', and whitespace before interpolation —
// `safeHref` returns `raw` byte-identical (never rewrites), so an absolute URL whose PATH legally contains
// unescaped parens (e.g. `https://x/)[evil](javascript:alert(1))` — '(' and ')' are valid, unreserved URI
// path characters) would otherwise close the destination's `(...)` early and open a SECOND, attacker-chosen
// link right after it (caught in review). Square brackets are deliberately left untouched here: unlike
// the parens (the destination's own delimiters), `[`/`]` carry no special meaning inside a parenthesized
// CommonMark destination, so they need no escaping in THIS slot (they matter only in the link TEXT below).
// Never bracket-wrapped (`<dest>`) — that form was the ORIGINAL scheme-parsing bypass risk finding 2 flagged.
// Literal `[`/`]` in the selected text are escaped (`\[`/`\]`) — CommonMark's own link-text escapes — so
// the selection can never prematurely close the link's `[...]` span or create an ambiguous nested-bracket
// parse; a literal `\` is escaped FIRST (`\\`) so a selection ending in a backslash can't turn the
// subsequently-inserted `\[`/`\]` escape into a differently-parsed escape sequence of its own (caught in
// review). This is the escaping the LINK'S OWN syntax needs, not a general-purpose markdown escaper.
function encodeLinkDestination(href: string): string {
  return href
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replace(/\s/g, (ch) => encodeURIComponent(ch))
}

export const pasteLinkHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const range = view.state.selection.main
    if (range.empty) return false // nothing selected — a normal paste
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return false
    const trimmed = text.trim()
    const allowed = safeHref(trimmed, trimmed) // self-as-base — requires `trimmed` to be independently absolute
    if (allowed === null) return false // not a clean, safe, ABSOLUTE URL — a normal paste
    event.preventDefault()
    const selected = view.state
      .sliceDoc(range.from, range.to)
      .replaceAll('\\', '\\\\')
      .replaceAll('[', '\\[')
      .replaceAll(']', '\\]')
    const insert = `[${selected}](${encodeLinkDestination(allowed)})`
    view.dispatch(
      view.state.update({
        changes: { from: range.from, to: range.to, insert },
        selection: EditorSelection.cursor(range.from + insert.length),
        scrollIntoView: true,
        userEvent: 'input',
      }),
    )
    return true
  },
})
