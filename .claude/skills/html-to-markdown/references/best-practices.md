# Best practices — converting HTML to markdown

## The element map (semantic → syntax)

Walk the tree depth-first; emit per element, recurse into children, unwrap the rest.

| HTML | Markdown | Notes |
|---|---|---|
| `<h1>`…`<h6>` | `# `…`###### ` + text | one blank line around |
| `<p>` | text, blank line after | inline children flow in |
| `<strong>`,`<b>` | `**…**` | inner = inline children |
| `<em>`,`<i>` | `_…_` | |
| `<code>` (inline) | `` `…` `` | content **verbatim**, not escaped |
| `<pre><code>` | ```` ```\n…\n``` ```` | verbatim; language from a `language-x` class if present |
| `<a href="u">` | `[label](u)` | label = inline children; `<a>` w/o href → just its text |
| `<img alt="a" src="s">` | `![a](s)` | |
| `<ul>`,`<ol>` + `<li>` | `- ` / `1. ` per item | nested list → indent 2 spaces per level |
| `<blockquote>` | `> ` prefix each line | nested → `> > ` |
| `<hr>` | `---` | |
| `<br>` | two trailing spaces or `\` | hard break inside a block |
| `<div>`,`<span>`,unknown,class/style | **unwrap** | drop wrapper, process children in place |

## Escaping — escape the DATA, not the syntax you emit

In every **text node** (not inside `<pre>`/`<code>`), backslash-escape characters that would re-parse as markdown:
- inline: `` \` ``, `\*`, `\_`, `\[`, `\]`, `\(`, `\)` (and `\<` where a literal `<` could start a tag);
- line-start: a leading `#`, `-`, `+`, `>`, or digits-then-`.` (`1.`) — escape so the line is not read as a heading / list / quote.
Code spans and `<pre>` content are **never escaped** (their content is literal by definition). The rule of thumb: you are escaping so a renderer reads the text as *text*; you are not escaping the markers you intentionally produce.

## Structure & whitespace

- **Collapse** runs of inter-element whitespace to a single space within a block (HTML whitespace is not significant); **preserve** it inside `<pre>`.
- **Block separation** is exactly one blank line; never rely on multiple blanks for spacing.
- **Nesting**: a list within a list indents by its level; a blockquote within a blockquote repeats `>`. Carry the depth through the walk — do not flatten.
- **Trim** leading/trailing whitespace per block; a stray indent can accidentally open a code block.

## Don't

- **Don't smuggle HTML through** to "preserve" a div/class/style — markdown has no slot for it; unwrap (see `foundations.md` §6). (Raw HTML in markdown is a last resort for a construct with no markdown form, e.g. a table in a flavor that lacks them — never for presentation.)
- **Don't copy text unescaped** — the missed-escape is the top defect (`foundations.md` §4).
- **Don't escape inside code/pre** — that corrupts literal content.
- **Don't flatten nesting** — indent/repeat to preserve list and quote depth.
- **Don't delete a presentational wrapper's children** — unwrap, keep the content.
- **Verify by round-trip** — render the output and confirm semantic equivalence (`foundations.md` §3); pair with the `markdown-to-markup` skill for the second half.
