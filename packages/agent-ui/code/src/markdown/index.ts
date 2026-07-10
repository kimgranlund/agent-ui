// index.ts — the `./markdown` pack barrel (LLD-C1/C9). Self-defines `<ui-markdown>` on import (the
// `@agent-ui/icons/phosphor` / `./highlight` self-registration precedent) and re-exports the element type
// for a consumer that wants to reference `UIMarkdownElement` directly.
export { UIMarkdownElement } from './markdown.ts'
