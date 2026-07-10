// index.ts — the @agent-ui/code CORE barrel (LLD-C11a, SPEC-C1/C10). Token types + registry + the
// projection seam ONLY. NEVER a pack — a "convenience re-export" of ui-markdown or a tokenizer is the
// regression this header names (the @agent-ui/router index.ts precedent). `./highlight` and `./markdown`
// are reachable ONLY on their own subpaths, so a core-only consumer drags no tokenizer and no
// `ui-markdown` bytes (the tree-shake contract, SPEC-C1 AC3).
export type { Token, TokenKind, Highlighter } from './core/token.ts'
export { Registry, highlighterRegistry, registerHighlighter, tokenize } from './core/registry.ts'
export type { HighlighterRegistry } from './core/registry.ts'
export { projectHighlight } from './core/project.ts'
