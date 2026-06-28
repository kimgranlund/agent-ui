// site/lib/code-block.ts — the shared CODE-PREVIEW primitive for the docs site. Every code sample shown on a
// page (the A2UI canvas payload + client-message JSON, a doc page's fenced `{name}.md` example) renders through
// this ONE helper, so each code block is real `<pre><code>` carrying one consistent chrome — never a per-page
// ad-hoc `<pre>` that could drift in look or safety.
//
// SAFETY: the text is assigned with `textContent`, NEVER innerHTML — a code sample is DATA, not markup, so there
// is no HTML-injection surface even when the text is a JSON payload that happens to contain `<` / `>` / `&`. The
// chrome (`.code-block`: white-space:pre, overflow-x:auto, monospace, the surface-role panel) lives once in
// _page.css, which every page loads via _page.ts.

/**
 * codeBlock — a `<pre class="code-block"><code>…</code></pre>` carrying `text` verbatim. An optional `lang` is
 * recorded as `data-lang` on the `<code>` (a forward hook for syntax highlighting; no highlighter is pulled in
 * today). Because the text is set with textContent it is shown literally and can never be parsed as HTML.
 */
export function codeBlock(text: string, lang?: string): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'code-block'
  const code = document.createElement('code')
  if (lang) code.dataset.lang = lang
  code.textContent = text
  pre.append(code)
  return pre
}
