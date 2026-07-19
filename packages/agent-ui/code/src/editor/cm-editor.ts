// cm-editor.ts — the ONE module in `@agent-ui/code/editor` that statically imports CodeMirror 6 (ADR-0139
// cl.1/cl.8b). It is reached ONLY via a dynamic `import('./cm-editor.ts')` from editor.ts, so the entire CM
// runtime lands in a lazy chunk a non-editor consumer never pays for; editor.ts's own module graph carries
// ZERO static CM imports (the confinement trip-wire, editor/confinement.test.ts, enforces both halves — the
// gen-ui-kit `code.class.js` (CM-free) / `code-editor.js` (CM-carrying) split, verified-followed).
//
// v1 language = markdown ONLY (ADR-0139 cl.1). `@codemirror/lang-markdown` is an OPTIONAL dependency, so it
// is a NESTED dynamic import here (not a static one) — a consumer omitting it still builds this module and
// simply gets no highlighting (the extension resolves to null). Every colour rides class-based highlight
// tokens (`tok-*`), mapped in editor.css to the `--ui-code-editor-token-*` roles fed by the fleet
// `--md-sys-color-*` ladders — `EditorView.theme()` cannot emit custom properties, so the theme below is
// STRUCTURAL-ONLY (ADR-0139 cl.4, gen-ui-kit's same split).

import { EditorState, Compartment, Annotation } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { richtextExtension } from './cm-richtext.ts'
import { formattingKeymap, pasteLinkHandler } from './cm-commands.ts'

// Marks a PROGRAMMATIC document write (a model→surface `setDoc`) so the update listener can distinguish it
// from a real user edit — a programmatic write must NOT fire `onDocChange` (which would re-emit `input` on a
// value the model already holds), matching the plain contenteditable path + ui-textarea, which never emit
// `input` on a programmatic `value` set (reviewer M2).
const programmatic = Annotation.define<boolean>()

// Structural-only theme — layout/box, never colour (colour rides `tok-*` classes → editor.css). `inherit`
// pulls the host's font/ink so the CM surface is visually continuous with the plain fallback it replaces.
const structuralTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', height: '100%' },
  '&.cm-focused': { outline: 'none' }, // the focus ring rides the HOST frame (editor.css), never the CM node
  '.cm-content': { caretColor: 'currentColor', padding: '0' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit' },
  '.cm-line': { padding: '0' },
})

// Class-based highlight — the markdown constructs `@codemirror/lang-markdown` tags, mapped to `tok-*`
// classes editor.css colours from `--ui-code-editor-token-*` (SPEC-C5's "token colour is a non-essential
// enhancement" holds: the source stays legible as plain ink with or without this sheet).
const highlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'tok-comment' },
  { tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], class: 'tok-heading' },
  { tag: t.strong, class: 'tok-strong' },
  { tag: t.emphasis, class: 'tok-emphasis' },
  { tag: [t.link, t.url], class: 'tok-link' },
  { tag: t.list, class: 'tok-list' },
  { tag: t.quote, class: 'tok-quote' },
  { tag: t.monospace, class: 'tok-code' },
  { tag: t.keyword, class: 'tok-keyword' },
  { tag: t.string, class: 'tok-string' },
  { tag: [t.processingInstruction, t.contentSeparator], class: 'tok-punctuation' },
])

/** The live handle editor.ts drives after a successful mount. */
export interface CmHandle {
  /** The CodeMirror view — `view.contentDOM` is the focusable surface (a validity anchor). */
  view: EditorView
  /** Push a new document value in (model→surface); a no-op when already equal (no redundant transaction). */
  setDoc(value: string): void
  /** Focus the surface and collapse the caret to the END (the `selectToEnd()` seam, CM side). */
  focusEnd(): void
  /** Reconfigure editable vs read-only at runtime (own `disabled`/`readonly` or a form-disabled change). */
  setEditable(editable: boolean): void
  /** Whether richtext CAN render here — true iff the lang-markdown pack loaded (no tree ⇒ nothing to decorate,
   *  ADR-0147 cl.6). False forever for this mount when the optional markdown pack failed to load. */
  readonly richtextAvailable: boolean
  /** Reconfigure the richtext decoration layer at runtime (the `setEditable` Compartment precedent, ADR-0147 cl.2). */
  setRichtext(on: boolean): void
  /** Tear the view down (disconnect / stale-mount discard). */
  destroy(): void
}

export interface CmOptions {
  parent: HTMLElement
  doc: string
  placeholder: string
  editable: boolean
  /** Initial mode, captured at mount (like `placeholder`/`language`) — but LIVE afterward via `setRichtext` (ADR-0147 cl.1). */
  richtext: boolean
  /** Fired on every document change (surface→model) — editor.ts sets `value` + emits `input`. */
  onDocChange(value: string): void
  /** Fired on focus (true) / blur (false) — editor.ts drives the blur-with-change `change` timing. */
  onFocusChange(focused: boolean): void
}

/** Read-only vs editable as a compartment-swappable extension (gen-ui-kit's `Compartment` toggle). */
function editableExtensions(editable: boolean): Extension {
  if (editable) return []
  return [EditorView.editable.of(false), EditorState.readOnly.of(true)]
}

/** Best-effort markdown language support — the OPTIONAL dependency, dynamically imported so its absence
 *  degrades to plain (unhighlighted) CM editing rather than a build/mount failure (ADR-0139 cl.1). */
async function loadMarkdown(): Promise<Extension | null> {
  try {
    const mod = await import('@codemirror/lang-markdown')
    return mod.markdown()
  } catch {
    return null
  }
}

/** Construct a CodeMirror view inside `parent`, seeded from `doc`. The single entry editor.ts awaits behind
 *  its own 10s ceiling (ADR-0139 cl.5) — this function loads the markdown pack and builds the view. */
export async function mountCodeMirror(opts: CmOptions): Promise<CmHandle> {
  const languageExtension = await loadMarkdown()
  const editableCompartment = new Compartment()
  const richtextCompartment = new Compartment()
  // No syntax tree ⇒ nothing to decorate (ADR-0147 cl.6) — richtext stays unavailable for this mount's
  // lifetime when the optional markdown pack failed to load, matching the shipped highlight-degrade parity.
  const richtextAvailable = languageExtension !== null

  const extensions: Extension[] = [
    structuralTheme,
    syntaxHighlighting(highlightStyle),
    history(),
    // The formatting keymap goes FIRST — the ordering is load-bearing, not just insurance: Mod-i collides
    // with defaultKeymap's own selectParentSyntax binding, and this precedence deliberately shadows it (a
    // markdown editor's users need italic far more often than syntax-tree selection; see cm-commands.ts's
    // own formattingKeymap doc comment for the full rationale). Mode-INDEPENDENT: bound here, not inside
    // richtextExtension()'s Compartment, since the underlying document is markdown text in BOTH modes —
    // only the decoration differs by mode, never a command's correctness (Kim's ask, cm-commands.ts).
    keymap.of([...formattingKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    pasteLinkHandler, // same mode-independence reasoning — a paste-time text transform, not a decoration.
    EditorView.lineWrapping, // markdown prose wraps (native <textarea> parity), never a horizontal scroll
    EditorView.updateListener.of((update: ViewUpdate) => {
      // Skip PROGRAMMATIC writes (model→surface setDoc) — only a genuine USER edit re-baselines the model +
      // emits `input` (reviewer M2; the plain path + ui-textarea are silent on a programmatic value set).
      if (update.docChanged && !update.transactions.some((tr) => tr.annotation(programmatic))) {
        opts.onDocChange(update.state.doc.toString())
      }
      if (update.focusChanged) opts.onFocusChange(update.view.hasFocus)
    }),
    editableCompartment.of(editableExtensions(opts.editable)),
    richtextCompartment.of(opts.richtext && richtextAvailable ? richtextExtension() : []),
  ]
  if (opts.placeholder) extensions.push(cmPlaceholder(opts.placeholder))
  if (languageExtension) extensions.push(languageExtension)

  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({ doc: opts.doc, extensions }),
  })

  return {
    view,
    setDoc(value: string): void {
      const current = view.state.doc.toString()
      if (current === value) return
      // Annotated programmatic — the update listener will NOT treat this model→surface write as a user edit.
      view.dispatch({ changes: { from: 0, to: current.length, insert: value }, annotations: programmatic.of(true) })
    },
    focusEnd(): void {
      view.focus()
      view.dispatch({ selection: { anchor: view.state.doc.length } })
    },
    setEditable(editable: boolean): void {
      view.dispatch({ effects: editableCompartment.reconfigure(editableExtensions(editable)) })
    },
    richtextAvailable,
    setRichtext(on: boolean): void {
      // A pure Compartment reconfigure — same doc, same selection, same undo history; nothing remounts,
      // nothing reparses from DOM (ADR-0147 cl.2).
      view.dispatch({ effects: richtextCompartment.reconfigure(on && richtextAvailable ? richtextExtension() : []) })
    },
    destroy(): void {
      view.destroy()
    },
  }
}
