# Decomposition — Component Preview · A2UI Catalog page · ADR index page

> Site-infra wave. 2026-07-04. Status: **DONE — built, reviewed, fixed, integrated; all gates green** (check+site · jsdom 2407 · browser 582; component-preview 14 incl. canvas→knob). Nav/landing wired (both TOCs, ungrouped). Two independent reviews applied (adr-review + preview-review; generator≠critic) — a LIVE mis-badged status (0037) + a canvas↔knob desync caught + fixed with regression tests. Reconciled cleanly with a concurrent `/btw` header-lean fork (pageLead). **ADR-0077 accepted 2026-07-04.** Owner: host-orchestrated (docs-writer seats ×2 + 2 layout-reviewers).
>
> Deferred (surfaced by the build, NOT applied this wave): tighten `catalog.json` `Button.variant` → `enum:[solid,soft,ghost]` (verified safe vs examples/corpus; a2ui-builder territory — route on Kim's go). Consolidate `a2ui-live` onto the shared `canvas-surface` module. Repo-wide `@vitest/browser/context` → `vitest/browser` migration.
> Ratified forks (Kim, this session): left panel = **full live-knobs playground**; ADR page = **searchable list, expand to full**.

## Goal

Three docs-site deliverables, all under `site/`:

1. **`<component-preview>`** — a site-local custom element: two-column playground. LEFT = details + live-knob controls (every attribute becomes an editable control that re-renders the canvas) + a derived variant switcher. RIGHT = a canvas artboard (the A2UI-canvas look). Renders EITHER a plain `ui-*` web component (component mode) OR an A2UI catalog item (a2ui mode).
2. **A2UI Catalog page** (`a2ui-catalog.html` + `pages/a2ui-catalog.ts`) — loads the default catalog, lists EVERY component as a long list, each rendered via `<component-preview mode="a2ui">`.
3. **ADR index page** (`adr-index.html` + `pages/adr-index.ts`) — every `.claude/docs/adr/NNNN-*.md`, newest-first, with a live full-text search box; each row expands to the fully rendered ADR.

Non-goals: no changes to `@agent-ui/components` or `@agent-ui/a2ui` package source (consume public APIs only); no new `ui-*` control (the preview is docs infra, a plain custom element); no auth/proxy work.

## Shared architecture

### Canvas surface (shared) — `site/lib/canvas-surface.{ts,css}`
Extract the proven artboard from `pages/a2ui-live.css` (`.canvas-stage` + `.canvas-surface`: translate-centered, checkered bg, **definite** `inline-size: min(32rem, calc(100% - 2rem))`, `max-block-size:100%`, `overflow:auto`, empty-state `::after`). Export a helper that builds `{ stage, surface }` light-DOM elements. The preview's right column uses this. **Adopting the shared module in `a2ui-live` is a DEFERRED host follow-up** — for this wave the preview consumes the shared module and `a2ui-live` is LEFT UNTOUCHED (keeps the freshly-shipped live-agent gates green and the two parallel builds disjoint). The shared CSS is derived from a2ui-live's proven rules; consolidation is tracked, not done now.

### `<component-preview>` element — `site/lib/component-preview.{ts,css}`
Plain `HTMLElement` (NOT a `ui-*` control), light DOM, `customElements.define('component-preview', …)`. Attributes: `mode` (`component` | `a2ui`) · `target` (a tag like `ui-button` in component mode; a catalog component NAME like `Button` in a2ui mode). On connect: resolve metadata → build left (details + knobs + variant chips) and right (canvas) → render.

**Metadata source (derived, never hand-authored):**
- component mode → the canonical `{name}.md` descriptor via the existing `site/lib/frontmatter.ts` (`ALL_DESCRIPTORS` glob → `parseDescriptor`): `attributes[]` carry `name · type · values[] (enum) · default · reflect`.
- a2ui mode → the catalog component def from the default catalog (import the JSON / the a2ui `defaultCatalog` export): `properties[prop] = { type:{ type, enum? }, bindable?, mapsTo }`, plus `children` (`child`|`ChildList`) and `value`.

**Knob derivation (one rule set, both modes):**
| prop kind | control | re-render |
|---|---|---|
| enum (`values[]` / `type.enum`) | `<select>` of members | set knob → re-render |
| boolean | checkbox / `ui-switch` | toggle |
| number | number input / `ui-text-field type=number` | edit |
| string | text input / `ui-text-field` | edit |
| object/complex (e.g. `Button.action`) | SKIP in MVP (read-only note) | — |
| default-slot text (component mode) | text input → `textContent` | edit |

**Live re-render:**
- component mode: create the element ONCE; knob change sets the attribute/property (boolean = presence); slot-text sets `textContent`. No teardown.
- a2ui mode: rebuild the payload and re-render through a FRESH `createRenderer()` each change (teardown-safe, N3): `host = createRenderer(); host.mount(surface); host.ingest(line1); host.ingest(line2); host.finalize(surfaceId)`.

**A2UI payload template (a2ui mode)** — mirrors `examples/canvas-button.ts`:
```
{ version:'v1.0', createSurface:{ surfaceId:'preview', catalogId:'agent-ui' } }
{ version:'v1.0', updateComponents:{ surfaceId:'preview', components:[
    { id:'root', component:<Name>, ...knobValues },
    ...sampleChildren            // only when def.children is 'child'|'ChildList'
] } }
```
Container/child components (Row, Column, Card, Field, Select, FormProvider, …) get default sample children so they render with content (e.g. Card → one Text child `"Sample content"`); knobs edit the ROOT's own props only. A root `ui-column` gets `stretch` (ADR-0075) — reuse `applyRootStretch` behavior from the canvas module.

**Variant switcher (derived):** one chip-row per enum attribute (e.g. `variant: solid soft ghost`, `size: sm md lg`); clicking a chip sets that knob and re-renders. Zero hand-maintained variant data.

### A2UI Catalog page
Standard `mountPage({ title:'A2UI Catalog', intro })` (scroll list, NOT full-bleed). Enumerate the default catalog's component names (skip leaf-only helper types if noisy — Option belongs under Select), render each in a titled section via `<component-preview mode="a2ui" target="<Name>">`. Optional: a name-filter box at the top (mirrors the ADR search; nice-to-have).

### ADR index page
Standard `mountPage({ title:'Decision Records', intro })`. Build-time glob:
`import.meta.glob('../../.claude/docs/adr/*.md', { query:'?raw', import:'default', eager:true })`.
- **VERIFY the glob resolves the dot-dir** (`.claude` is hidden — tinyglobby may skip it). If it returns empty, fix the wiring (a `dot`-aware glob, a Vite plugin, or a generated manifest) — a silently-empty list is a defect, assert a non-zero count.
- Exclude `README.md` (keep only `NNNN-*.md`).
- Parse each: `number` = filename prefix (`0076`) · `title` = the `# ADR-NNNN — …` H1 · `status`/`date` = the blockquote table rows (`| **Status** | accepted |`) · `summary` = first prose paragraph (post-`## Context`). Frontmatter here is a **markdown table**, not YAML.
- Sort by `number` **descending** (monotonic "most recent"; dates tie).
- Render: a search `<input>` (live, case-insensitive, over number+title+body → hide non-matching cards) + newest-first cards (number · title · status badge · date · summary), each a `<details>` expanding to the full body via `renderMarkdownBody` (from `lib/doc-page.ts`). Strip the frontmatter blockquote table from the expanded body (the mini-renderer has no table support) and surface status/date/number as header chips instead.

## Drift-gate constraints (MUST stay green)
- **`site-canon.test.ts`**: any `slot="X"` / `data-role="X"` literal in new site files MUST be a canonical name (`leading`/`label`/`trailing`; `icon`/`caret`). Prefer avoiding such literals in the knob UI.
- **`site-coverage.test.ts`**: site-LEVEL pages (a2ui-catalog, adr-index) are exempt (not component descriptors) — like `a2ui-canvas.html`. `HTML.size` only grows.
- **`site-nav.browser.test.ts`**: rail-entry count DERIVES from `NAV`. Nav wiring is **host-reserved** — agents do NOT edit `pages/_page.ts` (NAV) or `main.ts` (CARD_GROUPS); report the href/title/blurb to use and the host wires + re-greens the count.
- **MPA**: every `site/**/*.html` is auto-discovered by `vite.config.ts` — adding the two shells needs no config edit.

## Acceptance / gates
- **MUST**: `npm run check` (tsc + `check:site`) green · `npm test` (jsdom, existing site gates included) green.
- **SHOULD (preview is the risky visual piece — "test the whole shape")**: a browser smoke in the PACKAGES tree (vitest include is packages-only; follow the `site-nav.browser.test.ts` precedent) mounting `<component-preview mode="a2ui" target="Button">` → a live `ui-button` appears in the canvas AND a knob change re-renders; and `mode="component" target="ui-button"` renders directly. If a packages-tree browser test can't cleanly import the site module, document the smoke gap + hand a manual `npm run dev` checklist.
- ADR page: a parse unit test for the frontmatter-table extraction (number/title/status/date) placed where it runs.

## Orchestration
- **Agent 1 (docs-writer)** — shared canvas + `<component-preview>` + A2UI Catalog page (coupled chain; dogfoods the element in the catalog page). 
- **Agent 2 (docs-writer)** — ADR index page (independent, parallel).
- Both leave nav/landing to the host. After both land: host wires NAV + CARD_GROUPS (two new site-level links under the A2UI group), runs full gates, spawns reviewers, and authors **ADR-0077** (proposed) recording the site-local meta-component + shared-canvas + ADR-index-build-reach decisions for Kim's ratification.
