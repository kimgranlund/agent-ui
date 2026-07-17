// index.ts — the `@agent-ui/code/editor` subpath barrel (ADR-0139). Importing it registers `ui-code-editor`
// (the self-define side effect in editor.ts) and re-exports the class. The CodeMirror runtime is NOT reached
// here — it arrives via a dynamic `import('./cm-editor.ts')` inside editor.ts, so importing this barrel drags
// ZERO CodeMirror bytes into the importer's main graph (the confinement + identity + size gates, ADR-0139
// cl.8). This subpath joins `.` / `./highlight` / `./markdown` on the ADR-0065/0119 pure-core + opt-in-subpath
// geometry; the default barrels stay CodeMirror-free and byte-identical for any consumer not importing it.
export { UICodeEditorElement } from './editor.ts'
