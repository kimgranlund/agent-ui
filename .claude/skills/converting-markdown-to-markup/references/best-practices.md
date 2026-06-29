# Best practices — extending a markdown→markup renderer

## The `appendInline` pattern (the home for every inline form)

One function parses a text run into a parent element. To add a form, add a matcher to the earliest-match selection — never a second parser:

```
function appendInline(parent, text) {
  // find the EARLIEST of: `code`, **bold**, _em_, [text](url)
  // emit the literal run before it (a Text node)
  // emit the parsed span:
  //   code  → createElement('code'); el.textContent = inner            // verbatim, no recurse
  //   bold  → createElement('strong'); appendInline(el, inner)         // re-parse inner
  //   em    → createElement('em'); appendInline(el, inner)
  //   link  → createElement('a'); el.textContent = label; el.setAttribute('href', safeUrl(url))
  // recurse appendInline(parent, remainder)
}
```

Rules that keep it correct:
- **Earliest match wins**, scanning left to right — not "first form in the if-chain". Compare the match indices.
- **Code is verbatim**: do NOT recurse into a code span; its content is literal text (so `` `a **b** c` `` keeps the stars).
- **Emphasis/strong/link re-parse** their inner text (so `**foo `bar`**` renders bold wrapping a code chip).
- **Unpaired delimiter → literal**: no close found ⇒ append the delimiter as text and move on. Never throw on malformed input.
- **Links validate the URL**: only `http:`/`https:`/`mailto:`/relative; reject `javascript:` and other active schemes. The label is `textContent`; the href is `setAttribute`.

## Per-form mapping (the CommonMark subset)

| Markdown | Element | Inner |
|---|---|---|
| `` `code` `` | `<code>` (chip) | verbatim text |
| `**strong**` | `<strong>` | re-parsed |
| `_emphasis_` | `<em>` | re-parsed |
| `[label](url)` | `<a href>` | label re-parsed; href validated |
| `# … ######` (block) | `<h1>…<h6>` | heading text → `appendInline` |
| `- item` (block) | `<ul><li>` | item text → `appendInline` |
| blank-line run (block) | `<p>` | → `appendInline` |
| ```` ``` ```` fence (block) | `<pre><code>` | verbatim; chip treatment RESET |

## Safety — the non-negotiables

- **Never `innerHTML`** (nor `insertAdjacentHTML`, nor a `<template>` fed source). Text is `textContent`; structure is `createElement`.
- **Validate hrefs** — an unvalidated `[x](javascript:…)` is an injection via the markup you DO mint.
- **No markdown library** — hand-roll; the grammar is small and the safety must stay visible in-repo.

## Don't

- **Don't fix one delimiter at a time.** When the renderer shows a form literally, audit the whole inline class (code · bold · em · link) and the block set, and close the gaps together — the alternative is the observed code→bold→line-height drip.
- **Don't hardcode the chip colour.** Inline-code styling reads `--c-*`/`--ui-*` roles (scheme + forced-colors safe); a literal colour fails in one scheme.
- **Don't re-parse a code span**, and don't leave a strong/em/link span un-recursed — the two directions of the nesting rule are both load-bearing.
- **Don't strip an unpaired marker** — render it literally; a lone `*` in prose is text, not a bug.
