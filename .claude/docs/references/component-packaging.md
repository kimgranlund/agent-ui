# Component packaging — folder, barrels, host page

> Canonical how-to-apply standard for how an agent-ui component is laid out on disk, exposed by the
> package, and consumed by a host page. **Derived** from the decisions [`ADR-0003`](../adr/0003-single-file-component-css-barrels-host-page.md)
> (single-file CSS + barrels + host-page packaging) and [`ADR-0004`](../adr/0004-component-descriptor-md-frontmatter.md)
> (the `{name}.md` frontmatter descriptor) — those carry the rationale; this doc is the resolved shape.
> The styling *content* rules live in [`geometry.md`](./geometry.md) + [`tokens.md`](./tokens.md); the
> authoring procedure is the `component-author` skill, which points here. Distilled 2026-06-27.

## The per-component folder

One folder per control, **self-defining on import**. A FACE control lives under its enforced layer
`controls/{name}/`; the later display/pattern catalog is reserved `components/{name}/`. The folder is
moved/renamed/deleted as a unit — nothing reaches across folders.

The exact file set is `{name}.{ts,css,md}` plus co-located tests:

| File | Role |
|---|---|
| `{name}.ts` | **Behaviour only** — props (`static props`), role/ARIA via `ElementInternals`, traits, and the self-`define` at module end. No styling, no runtime style injection (plan §2). |
| `{name}.css` | **One** stylesheet (ADR-0003) — two sectioned blocks: a `:where(ui-{name})` token block then an `@scope (ui-{name})` styles block. Standalone; never injected from the `.ts`. |
| `{name}.md` | The descriptor (ADR-0004) — YAML frontmatter (the machine-checkable public surface) + a prose body (the `/site` doc). Replaces the former `{name}.api.json`. |
| `{name}.test.ts` | jsdom unit/behaviour probes. |
| `{name}-*.browser.test.ts` | Cross-engine (real-browser) probes — geometry/state behaviour jsdom can't see. |
| `{name}-{css,geometry,descriptor,…}.test.ts` | Content-level trip-wire probes (token hygiene, geometry law, descriptor↔`static props`). |

Worked reference: `packages/agent-ui/components/src/controls/button/` (the gold `ui-button` every later
control copies).

### The single `{name}.css` — two sectioned blocks

The CSS-trio (`{name}-tokens.css` + `{name}-styles.css` + a barrel) collapsed to **one file** (ADR-0003);
the styling invariants are unchanged — only the file count dropped from three to one. The two layers must
stay visibly sectioned (a comment banner) so the token-hygiene probe can still tell the declaration layer
from the consumption layer in one file:

1. **`:where(ui-{name})` token block** (specificity 0,0,0) — *declares* `--ui-{name}-*` from the colour
   roles (`--c-{family}-{role}`) and the dimensional ramp (`--ui-{height,font,gap}-{size}`); `[variant]`/
   `[size]`/state selectors repoint those tokens. No `color-mix` — colour opinions stay in the token layer.
2. **`@scope (ui-{name})` styles block** — *consumes only* `--ui-{name}-*`. Geometry per `geometry.md`,
   colour channels per `tokens.md`.

### The `{name}.md` descriptor

The frontmatter is the **one** source of truth for the public surface — the same file is both the
machine-checkable contract and the human doc, so a contract file and a doc file cannot drift (they are the
same file, ADR-0004). Frontmatter fields: `tag · tier · extends · attributes[type/reflect/default/values]
· properties · events · slots · parts · customStates · face · aria · keyboard · geometry · forcedColors`;
the markdown body below the fence is the prose `/site` page. Two consumers read it through the
`@agent-ui/components/descriptor` parser — the contract↔props trip-wire (frontmatter `attributes[]` ≡ the
live `finalize(Class)` table) and the `/site` doc generator — **one parser, never a forked dialect**.

## The package exports map — the barrels

The package exposes its surface through `exports` subpaths, not deep file paths. Verified against
`packages/agent-ui/components/package.json`:

| Subpath | Target | What it is |
|---|---|---|
| `@agent-ui/components` | `src/index.ts` | Framework primitives (the `reactive` + `dom` layers — `UIElement`, props, template). No controls, no styles. |
| `@agent-ui/components/components` | `src/controls/index.ts` | **The self-defining `ui-*` family barrel.** Importing it runs every control's top-level `customElements.define` and re-exports each element class (`UIButtonElement`, …). Grows one `export *` per control. |
| `@agent-ui/components/descriptor` | `src/descriptor/index.ts` | The `{name}.md` frontmatter reader + schema + contract↔props trip-wire (ADR-0004). |
| `@agent-ui/components/component-styles.css` | `src/component-styles.css` | **Per-component CSS barrel** — one `@import` per control's single `{name}.css`. |
| `@agent-ui/components/foundation-styles.css` | `src/foundation-styles.css` | **Foundation CSS barrel** — `@agent-ui/shared/tokens.css` (colour roles) then `dimensions.css` (the ramp). |

The two CSS barrels chain across the one allowed cross-package edge: `foundation-styles.css` imports
`@agent-ui/shared`'s `tokens.css` + `dimensions.css` (both also `exports` subpaths of that package).

## The load-bearing CSS order

Order is **not** cosmetic — a control's `:where()` token block reads the `--c-*` roles and the
`--ui-{height,font,gap}-*` ramp, so those must already be declared when it resolves. The contract:

```
foundation-styles.css   (1) tokens.css  →  (2) dimensions.css     ← FIRST: roles, then the ramp
component-styles.css    (3) each control's {name}.css             ← AFTER foundation
@agent-ui/components/components  (4) the JS modules self-define   ← any time; CSS styles the host even before upgrade
```

Within each barrel the `@import` order is itself load-bearing (tokens before dimensions; foundation before
any component) and is annotated "do not reorder" in the barrel files. Do not rely on link order alone if a
bundler reorders — keep the `@import`s in the barrels as the canonical sequence.

## Host-page consumption — the 3-line contract

Any app (the demo, `/site`, the A2UI canvas) consumes the package with **two ordered `<link>`s + one
module import**. The MPA/page mechanism belongs to the *site*, not the package; the package's contract is
just these three lines, in this order:

```html
<link rel="stylesheet" href="@agent-ui/components/foundation-styles.css" />  <!-- 1: roles + ramp, first -->
<link rel="stylesheet" href="@agent-ui/components/component-styles.css" />   <!-- 2: per-control CSS, after -->
<script type="module">import '@agent-ui/components/components'</script>       <!-- 3: self-defines ui-* -->
```

No per-control wiring: the third line registers the whole family (each module self-`define`s its tag);
importing a single control instead (`import '@agent-ui/components/components/button.ts'`-style deep paths
are *not* the contract — prefer the barrel) drags only that control + its real deps, so tree-shaking holds.

## Resolution: the `exports` map, not bundler aliases

Subpaths resolve through the package `exports` map (above) — **not** Vite path aliases. Under Vite 8's
Rolldown engine, aliases mangle package subpaths (`@agent-ui/components/foundation-styles.css` and the
`@agent-ui/shared/*` CSS subpaths in particular); the `exports` map is the resolver of record. Add a new
control by adding its `export *` to `src/controls/index.ts` and its `@import` to `component-styles.css` —
the public subpaths never change.

## Siblings

- `component-author` (skill) — the procedure that *produces* this shape; points here for the layout.
- [`tokens.md`](./tokens.md) — the colour-role channel pattern the `:where()` block declares.
- [`geometry.md`](./geometry.md) — the geometry law the `@scope` block obeys.
- [`ADR-0003`](../adr/0003-single-file-component-css-barrels-host-page.md) · [`ADR-0004`](../adr/0004-component-descriptor-md-frontmatter.md) — the decisions this doc applies.
