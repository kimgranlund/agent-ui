// index.ts — the `./highlight` pack barrel (LLD-C7, SPEC-C4). Self-registers the bundled highlighter into
// the default registry on import (the `@agent-ui/icons/phosphor` self-registration precedent, ADR-0066),
// and exports the explicit `registerHighlight(registry?)` control for a consumer holding its own isolated
// registry. Dispatches by `language` to the matching tokenizer; an unknown language returns a single plain
// token — verbatim, never throws (SPEC-C4 AC3).

import { registerHighlighter, type HighlighterRegistry } from '../core/registry.ts'
import type { Highlighter, Token } from '../core/token.ts'
import { tsjs } from './langs/ts.ts'
import { json } from './langs/json.ts'
import { html } from './langs/html.ts'
import { css } from './langs/css.ts'
import { python } from './langs/python.ts'
import { shell } from './langs/shell.ts'
import { markdown } from './langs/markdown.ts'

const GRAMMARS: Record<string, (code: string) => Token[]> = {
  ts: tsjs,
  js: tsjs,
  json,
  html,
  css,
  python,
  shell,
  markdown,
  md: markdown,
}

/** The bundled dispatch-by-language highlighter — unknown languages return a single verbatim plain token
 *  (never throw, SPEC-C4 AC3). */
export const bundledHighlighter: Highlighter = (code, language) =>
  (GRAMMARS[language.toLowerCase()] ?? ((c: string) => [{ kind: 'plain', text: c }]))(code)

/** Register the bundled highlighter into `registry` (default: the package's singleton). Idempotent —
 *  last-wins, like every `registerHighlighter` call. Explicit control for a consumer holding an isolated
 *  `Registry` instance rather than the default singleton. */
export const registerHighlight = (registry?: HighlighterRegistry): void =>
  registry !== undefined ? registry.registerHighlighter(bundledHighlighter) : registerHighlighter(bundledHighlighter)

registerHighlight() // self-register into the default singleton on import (SPEC-C4 AC1)
