# Foundations — authoring the agent-ui docs site

> The load-bearing mental models docs-site authoring assumes. The site itself (`site/`) is the canonical
> realization the anchors cite; this names the concepts so the method's judgements have ground to stand
> on. Distilled 2026-06-28 from `site/`, `.claude/docs/process.md`, and the descriptor trip-wires
> (`packages/agent-ui/components/src/descriptor/`).

## What the site is

`site/` is the **published** docs site — a zero-framework, light-DOM Vite app that documents the
`@agent-ui/components` fleet by *showing the real controls*, not by describing them. It is distinct from
`.claude/docs/` (the repo's internal plan / goals / process / `references/`, authored with `reference-author`).
The site is built from page modules under `site/pages/`, each mounted through one shared shell.

## The page shell — `mountPage` (`site/pages/_page.ts`)

Every page module imports `_page.ts` **first**. The shell does two load-bearing things:

- **The foundation cascade (ADR-0003).** It performs the single import sequence that the whole site
  depends on, *in order*: foundation CSS (tokens → dimensions) → per-control CSS → the self-defining
  `ui-*` controls. Because a page imports the shell first, ES depth-first evaluation runs this before any
  other control-touching import, so the cascade order holds site-wide. A page never repeats or reorders
  it.
- **The chrome.** It stamps the shared `<nav data-site-nav>` (one nav, every page, current link flagged),
  the `<h1>` title, an optional intro `<p>`, and the `<main data-page-content>` the page fills, then
  returns `{ content }`. The nav link set is the site's table of contents.

## The four derive-from sources

The site's anti-drift property comes from never hand-maintaining a fact that has an owner. Each owner is
consumed, not copied:

1. **The descriptor (`{name}.md`).** YAML frontmatter is the attributes-as-API record; the markdown body
   is the page's prose. The *canonical parser* (`parseDescriptor`/`splitFrontmatter`, exported at
   `@agent-ui/components/descriptor`) is the single reader. `site/lib/frontmatter.ts` is a thin adapter
   onto it — **one parser, two consumers** (the in-package contract trip-wire and the doc page), so the
   table cannot diverge from the contract (ADR-0004).
2. **The real renderer / control.** A live demo runs `createRenderer` (A2UI) or mounts a `ui-*` control
   through its *public* surface — exactly as the server transport or an app would — and reaches no
   internals. The page *is* the integration proof the renderer/control tests assert, made visible.
3. **The props enum.** Specimen rows iterate the parsed enum members (`attr.values`), so the rendered set
   tracks the descriptor automatically.
4. **The token roles.** Page chrome consumes `--c-{family}-{role}` roles (declared by the foundation
   cascade). A page **never restyles a `ui-*` control** — appearance and interaction states live in the
   control's own `{name}.css`.

## Drift vs honesty — the two failure modes the site is built against

- **Drift** (`.claude/docs/process.md`'s disease): the doc and the thing it documents diverge. The cure is
  *structural* — derive the fact and back it with a deterministic check, so divergence is impossible or
  caught. Where a fact is structurable, a green check is the guarantee; where it isn't (prose), cite the
  upstream owner by ID so a reviewer can re-derive it.
- **Dishonesty**: a demo that claims behaviour it doesn't actually run (a mock, a screenshot, a
  hand-drawn state). The cure is also structural — run the *real* renderer/control. Honest labels (the
  states showcase tags each state as the control's, the canvas logs the real round-trip including errors)
  follow from showing the real thing, not from careful wording.

## The deterministic backstops (already shipped)

- **`component-descriptor-driftwire.test.ts`** — frontmatter `attributes[]` ≡ live `finalize(Class)`
  (the contract↔props trip-wire, ADR-0004). A T4 API page that consumes the same parser inherits it.
- **`component-descriptor-sourcewire.test.ts`** — the descriptor's `customStates`/`slots` match the
  control source (`.ts` `internals.states` + `.css` `:state(…)`/`[slot=…]`).
- **`site-canon.test.ts`** — the **dead slot/role-name guard**: every `slot=`/`data-role=` name used
  anywhere in `site/` must be a canonical name, sourced from the descriptors + control CSS through the
  *same* parser/extractor. A static migration lint (jsdom never evaluates the `:has()` host-grid, so a
  render smoke wouldn't see the break); comments are stripped first, so a historical note in a comment is
  not a violation. This is the guard that catches a name a rename left behind.

## Generator / critic split

The author **builds to the rubric**; a **separate** reviewer scores against it. For the site that
reviewer is the `docs-writer` agent (or the host gate). This mirrors the `component-author` →
`component-reviewer` relationship: the maker doesn't grade its own output, and the deterministic gates
(the trip-wires above) are the non-negotiable half of the verdict either way.
