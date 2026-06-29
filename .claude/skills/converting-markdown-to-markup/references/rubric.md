# Rubric — markdown→markup rendering quality (rubric-md-to-markup)

Score a markdown-rendering change (a new inline/block form, or a renderer). Dimensions × 1–5 anchors × a gate. Authored in the `authoring-rubrics` shape.

| Dim | Name | [gate] |
|---|---|---|
| **M1** | Injection safety | gate |
| **M2** | Grammar correctness | gate |
| **M3** | Graceful degradation | |
| **M4** | Inline-class completeness | |
| **M5** | Treatment & tokens | |

## M1 — Injection safety [gate]

- **1** — `innerHTML` / `insertAdjacentHTML` anywhere on body content, or an unvalidated href scheme.
- **3** — all text via `textContent`/Text nodes; elements via `createElement`; hrefs scheme-validated.
- **5** — + a test proves a markup-bearing source string (`<img onerror>`, `[x](javascript:…)`) renders inert/rejected.

## M2 — Grammar correctness [gate]

- **1** — wrong nesting/ordering; a form mis-parses (e.g. stars inside backticks get bolded).
- **3** — earliest-span-wins; code is verbatim (no inner parse); strong/em/link re-parse their inner; blocks delegate to the one inline pass.
- **5** — + nesting cases proven (bold-wrapping-code renders; code-with-literal-stars stays literal) and blocks share the inline parser (no duplicate inline logic).

## M3 — Graceful degradation

- **1** — an unpaired/malformed delimiter throws or corrupts the run.
- **3** — an unpaired marker renders literally; malformed input never throws.
- **5** — + the literal-vs-parsed boundary is tested for each form.

## M4 — Inline-class completeness

- **1** — one delimiter added in isolation while sibling forms still render literally.
- **3** — the change covers the inline class it touches (not a single-delimiter patch), and states what is deferred.
- **5** — + the renderer handles the corpus's full inline + block set, deferrals named with their reason.

## M5 — Treatment & tokens

- **1** — a hardcoded colour/size on the rendered element; the chip treatment leaks into fenced blocks.
- **3** — styling rides `--c-*`/`--ui-*` roles; inline chip vs block panel are distinct (chip reset in blocks).
- **5** — + scheme + forced-colors safety verified for the rendered element.

## Gate rule

**M1 and M2 must both be ≥ 3.** An unsafe or mis-parsing renderer fails regardless of polish — injection safety and grammar correctness are the load-bearing pair. M3–M5 below 3 are findings to fix.
