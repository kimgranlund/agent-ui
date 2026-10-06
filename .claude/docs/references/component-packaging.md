# Component packaging — folder, barrels, host page

> Canonical how-to-apply standard for how an agent-ui component is laid out on disk, exposed by the
> package, and consumed by a host page. **Derived** from the decisions [`ADR-0003`](../adr/0003-single-file-component-css-barrels-host-page.md)
> (single-file CSS + barrels + host-page packaging) and [`ADR-0004`](../adr/0004-component-descriptor-md-frontmatter.md)
> (the `{name}.md` frontmatter descriptor) — those carry the rationale; this doc is the resolved shape.
> The styling *content* rules live in [`geometry.md`](./geometry.md) + [`tokens.md`](./tokens.md); the
> authoring procedure is the `make-component` skill, which points here. Distilled 2026-06-27.

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
   roles (`--md-sys-color-{family}-{role}`) and the dimensional ramp (`--ui-{height,font,gap}-{size}`); `[variant]`/
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

**The `uses:` field is derived, never hand-written** ([`ADR-0233`](../adr/0233-per-control-entries-and-generated-control-registry.md)).
Every fleet descriptor (`controls/{folder}/{name}.md` outside a `_` folder) carries `uses:`, on the line after
`extends:`: a block sequence of the other fleet tags its entry module reaches through relative imports
(`uses: []` when none). The crawl lives in `src/descriptor/control-graph.ts`; sync the field after any
import change with `node scripts/codemod-uses.mjs` (`--check` writes nothing and exits 1 naming each
out-of-sync file). The schema rejects a malformed block as `BAD_USES`, and `src/controls/uses-driftwire.test.ts`
holds every declared list equal to the import graph. The field is optional in the schema, so app descriptors
validate without it.

**The `defines:` field names a family's sub-elements** ([`ADR-0233`](../adr/0233-per-control-entries-and-generated-control-registry.md)).
A family entry module that self-defines tags besides its own (`ui-card` and its three regions, `ui-tabs` and
its tab and panel, `ui-drill` and its panel) lists them in an optional `defines:` block after `uses:`, same
grammar (`BAD_DEFINES`), sorted. It is the one hand-declared list: `src/controls/defines-driftwire.test.ts`
holds it equal to the `customElements.define` literals in the modules the entry reaches
(`deriveDefines` in `src/descriptor/control-graph.ts`), so a new region module reds until the parent
descriptor names it. `node scripts/generate-controls.mjs` then writes the list onto the family's record in
`registry.gen.ts` (`ControlRecord.defines`); the A2UI built-in loader serves each listed tag as an alias that
loads the family module. A sub-element has no descriptor and no record of its own.

**A sheet carries its `uses` too: the prologue rule.** The same codemod writes the CSS half. A sheet
`{folder}/{name}.css` whose `uses` is non-empty opens, before its first non-comment token, with one marker
comment (`/* uses: synced from {name}.md by scripts/codemod-uses.mjs */`) and then one relative import per
used control's sheet, sorted by tag (`./{name}.css` for a same-folder control, else `../{folder}/{name}.css`);
an empty `uses` means no prologue. Linking `table/table.css` therefore brings the button, checkbox,
pagination and radio sheets along. A control sheet never imports a `_` seam and never declares a foreign
`:where(ui-other)` rule: `src/controls/css-uses.test.ts` gates both, plus the prologue itself, and
`src/controls/css-order.browser.test.ts` proves on both engines that control sheets load in any order.

**The `description:` field describes, it doesn't cite provenance.** It flows verbatim into every `/site`
T4 API page (`site-authoring`'s DERIVE-FIRST principle — one source, many consumers), so the same rule
`site-authoring`'s `best-practices.md` states for page prose applies here, at the source: say what the
component *is* and *does* for a reader deciding whether to use it — never which `TKT-####`/`ADR-####`
built or changed it. A **normative** citation is still fine if the description states a rule/contract the
reader needs (rare for a one-line summary); a **provenance** citation (which ticket shipped this, which
ADR record exists) never belongs here — link it from the component's own ADR/ticket instead, not the
public-facing descriptor. `textarea.md`'s `description:` was the one fleet instance found carrying this
(`"...the fleet's first long-form editable primitive (ADR-0134), a sibling of..."`) — fixed alongside this
rule (TKT-0053).

## The package exports map — the barrels

The package exposes its surface through `exports` subpaths, not deep file paths. Verified against
`packages/agent-ui/components/package.json`:

| Subpath | Target | What it is |
|---|---|---|
| `@agent-ui/components` | `src/index.ts` | Framework primitives (the `reactive` + `dom` layers — `UIElement`, props, template). No controls, no styles. |
| `@agent-ui/components/descriptor` | `src/descriptor/index.ts` | The `{name}.md` frontmatter reader + schema + contract↔props trip-wire (ADR-0004). |
| `@agent-ui/components/controls/{name}` | `src/controls/{folder}/{name}.ts` | **One control** (generated key): importing it self-defines that tag and the tags it `uses`, nothing else. |
| `@agent-ui/components/controls/{name}.css` | `src/controls/{folder}/{name}.css` | **That control's sheet** (generated key): self-contained through its `uses` prologue; link `shared-styles.css` once before it. |
| `@agent-ui/components/registry` | `src/controls/registry.gen.ts` | **The control registry** (generated): `CONTROLS`, one lazy `ControlRecord` per tag (`load()`, `css`, `uses`), for hosts that load controls on demand. |
| `@agent-ui/components/all` | `src/all.gen.ts` | **DEMO-ONLY** (generated): imports every control entry module. Never imported by package code. |
| `@agent-ui/components/all.css` | `src/all.gen.css` | **DEMO-ONLY** (generated): `shared-styles.css`, then every control sheet sorted by path. Never imported by package code. |
| `@agent-ui/components/foundation-styles.css` | `src/foundation-styles.css` | **Foundation CSS barrel** — `@agent-ui/shared/tokens.css` (colour roles) then `dimensions.css` (the ramp). |
| `@agent-ui/components/shared-styles.css` | `src/shared-styles.css` | **The seam sheet** (ADR-0233): the cross-family `_surface/container.css`, `_surface/container-box.css` and `_chart/chart-axis.css` layers, in that order, loaded once before any control sheet. |
| `@agent-ui/components/base-styles.css` | `src/base-styles.css` | **Document BASE barrel** (opt-in) — `@agent-ui/shared/base.css`: the foundational theme for a SHELL-LESS host page (body typeface `--ui-sans`, body leading, ambient ink/surface, font smoothing). A page composing a shell that sets its own document rule (the docs `_page.css`) does not need it. |

The CSS barrels chain across the one allowed cross-package edge: `foundation-styles.css` imports
`@agent-ui/shared`'s `tokens.css` + `dimensions.css`, and `base-styles.css` imports its `base.css`
(all three also `exports` subpaths of that package).

### Generator-owned exports (ADR-0233)

`node scripts/generate-controls.mjs` owns every `./controls/*` key (the `./controls/{name}` module and the
`./controls/{name}.css` sheet per fleet descriptor), `./registry`, `./all` and `./all.css`, and writes the
three files behind them (`src/controls/registry.gen.ts`, `src/all.gen.ts`, `src/all.gen.css`). It drops a
stale `./controls/*` key, keeps every other key and field as written, and leaves the keys in plain sorted
order. Every other `exports` key is hand-owned. `--check` writes nothing and exits 1 naming each stale
artifact; the drift gate is `src/controls/controls-gen-driftwire.test.ts`. Never hand-edit a generated key
or file.

`all` and `all.css` are **demo-only**: the docs site and quick demos link them to get the whole fleet. Package
code never imports them (gate: `src/controls/all-purity.test.ts`), so an app that imports one control never
pays for the rest.

### `sideEffects`

The components `package.json` declares `"sideEffects": ["./src/controls/**", "./src/all.gen.ts",
"./src/**/*.css"]`: the self-defining control modules, the demo-only `all` entry and every sheet. A bundler
may drop any other module whose exports go unused, so `reactive/`, `dom/`, `traits/` and `descriptor/`
must carry no top-level effect. `scripts/side-effects.test.mjs` holds the declaration honest against the
source (and proves a per-control import keeps its `customElements.define`); the publish transform carries
the field into the published manifest, mapped to `./dist/`.

## The CSS order: four lines

The foundation and the seams load in a fixed order; control sheets do not. A control's `:where()` token
block reads the `--md-sys-color-*` roles and the `--ui-{height,font,gap}-*` ramp, and the container family
reads the `_surface/` seam, so those must be declared first. The host contract (ADR-0233):

```
foundation-styles.css   (1) tokens.css  →  dimensions.css          ← FIRST: roles, then the ramp
base-styles.css         (1b) base.css: OPT-IN document basics      ← after foundation (reads its roles/constants)
shared-styles.css       (2) the _surface/ and _chart/ seams, ONCE  ← after foundation, before any control sheet
control sheets          (3) any {name}.css, in ANY order           ← each imports the sheets of its `uses`
the JS modules          (4) self-define                            ← any time; CSS styles the host even before upgrade
```

Inside `foundation-styles.css` and `shared-styles.css` the `@import` order is load-bearing: tokens before
dimensions; the container paint seam, then the box model, then the chart vocabulary. Link the seam sheet
once: a browser applies every duplicate import separately, so a second seam copy after `card.css` would reset
the `--ui-container-bg` seed card declares by later source. Control sheets are order-free: each is
self-scoped (no foreign `:where(ui-other)` rule), so a sheet duplicated by several prologues is harmless.
The demo-only `all.css` covers lines 2 and 3 in one link: it imports `shared-styles.css` first, then every
control sheet.

## Host-page consumption: the 4-line contract

Any app (the demo, `/site`, the A2UI canvas) consumes the package through the four lines above. The
MPA/page mechanism belongs to the *site*, not the package. An app links the seams once, then the sheets
and entries of the controls it uses:

```html
<link rel="stylesheet" href="@agent-ui/components/foundation-styles.css" />  <!-- 1: roles + ramp, first -->
<link rel="stylesheet" href="@agent-ui/components/shared-styles.css" />      <!-- 2: the seams, once -->
<link rel="stylesheet" href="@agent-ui/components/controls/button.css" />    <!-- 3: each control sheet, any order -->
<script type="module">import '@agent-ui/components/controls/button'</script>  <!-- 4: self-defines ui-button -->
```

Each `./controls/{name}` subpath (deep file paths are *not* the contract) drags only that control, the
tags it `uses` and its real deps, so tree-shaking holds; its `./controls/{name}.css` sheet is the matching
CSS line. A host that loads controls on demand reads `./registry` instead. The docs site and quick demos
use the demo-only `all.css` (lines 2 and 3) and `all` (line 4) to get the whole fleet; a host that links
`all.css` never also links `shared-styles.css`, which would load the seams a second time.

## Resolution: the `exports` map, not bundler aliases

Subpaths resolve through the package `exports` map (above) — **not** Vite path aliases. Under Vite 8's
Rolldown engine, aliases mangle package subpaths (`@agent-ui/components/foundation-styles.css` and the
`@agent-ui/shared/*` CSS subpaths in particular); the `exports` map is the resolver of record. Add a new
control by adding its folder and descriptor, then running `node scripts/codemod-uses.mjs` to write its
`uses` and its sheet's prologue, then `node scripts/generate-controls.mjs` to write its registry record,
its `all.gen.ts` / `all.gen.css` lines and its two `exports` keys; no shared list is hand-edited, and the
existing public subpaths never change. A new cross-family seam goes in `shared-styles.css`, never in a control sheet.

## Siblings

- `make-component` (skill) — the procedure that *produces* this shape; points here for the layout.
- [`tokens.md`](./tokens.md) — the colour-role channel pattern the `:where()` block declares.
- [`geometry.md`](./geometry.md) — the geometry law the `@scope` block obeys.
- [`ADR-0003`](../adr/0003-single-file-component-css-barrels-host-page.md) · [`ADR-0004`](../adr/0004-component-descriptor-md-frontmatter.md) — the decisions this doc applies.
