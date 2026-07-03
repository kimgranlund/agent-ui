# ADR-0065 — the icon adapter: a swappable-pack registry + a `@agent-ui/icons` leaf package, feeding SVG content into the existing icon-cell geometry

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; the full adapter [types/registry/resolve/barrel + `ui-icon`] shipped to the revised LLD exactly, incl. the deferred-pack-swap-reactivity call and the `icons ↛ components` negative control; independently reviewed GO — zero blocker/major; gates check · jsdom 2311 · browser 564/564 both engines · size 22193/22528.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the icon-adapter-architecture intake) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | `icon-adapter.lld.md` LLD-C1/C2/C3/C5 (authored this change) · `packages/agent-ui/components/src/layering.test.ts:57` (allowlist gains `@agent-ui/icons` as a second lower-tier sibling — build-time, gated on ratification) · NEW `packages/agent-ui/icons/` workspace (gated on ratification) |
> | **Supersedes / Superseded by** | Relates ADR-0062 (the corpus pure-core + subpath-data packaging pattern this mirrors) · ADR-0055 (the subpath-export bundle-hygiene precedent) · ADR-0006/0012 (the button host-as-grid `[data-role='icon'|'caret']` contract this feeds without redesigning) · ADR-0035 (the `--ui-icon-*` §1-SET cell table) |

## Context

There is **no icon system today** — every glyph is an ad-hoc literal set imperatively at a part-creation
site: `select.ts:282` (`caretSpan.textContent = '▾'`), `calendar.ts:318/332` (`'‹'`/`'›'`),
`text-field.ts:725/742/764/798/805` (`'✕'`/`'👁'`/`'📅'`/`'▲'`/`'▼'`). Two of those are emoji
(`👁`/`📅`) that render inconsistently across platforms. The goal is one swappable icon-sourcing
architecture — Phosphor Icons as the concrete default (ADR-0066) — behind a uniform interface, so a
control asks for an icon *by name* without knowing which pack is active, and a later pack (Lucide,
Material) drops in without touching a single consuming control.

Three facts constrain the shape. **(1)** The repo's hard pillar is zero *runtime* dependencies
(CLAUDE.md). **(2)** A geometry contract is already load-bearing and must NOT be redesigned: the
host-as-grid `[data-role='icon']` cell (icon-sized, fills its cell) vs `[data-role='caret']` cell
(the *same* icon-sized cell, but the glyph is inset to font-rhythm by `padding: (icon − glyph)/2`) —
`button.css:118-140`, `select.css:165-178`. The adapter must feed *content into* those cells, not
re-cut them. **(3)** The `svg\`\`` tagged template exists (`dom/template.ts:44`) but is deliberately
module-**private** ("a directive is the only PUBLIC render unit" — `dom/index.ts`), and the controls
inject these glyphs **imperatively** (`document.createElement` + `textContent` in `#ensureParts` /
`#createAffordanceAdornment`), never through a template. So the natural injection primitive is an
imperative one, not a directive.

## Decision

We adopt a **swappable-pack icon adapter** in a **new leaf package `@agent-ui/icons`**, with two
consumption surfaces, feeding inline `<svg>` into the *existing* geometry cells.

1. **Package boundary — a new zero-dep leaf `@agent-ui/icons`** (sibling of `@agent-ui/shared`,
   mirroring the ADR-0062 pure-core shape). It holds only a registry, a resolver, and inert SVG-data
   packs — no `@agent-ui/components` dependency, so the edge runs `@agent-ui/components → @agent-ui/icons`
   (inward, like `components → shared`). This keeps the large vendored SVG data OUT of the zero-dep core
   bundle and makes "swap a pack" a package/import swap. The layering trip-wire
   (`layering.test.ts:57`, today "only `@agent-ui/shared`") is widened to admit `@agent-ui/icons` as a
   second declared lower-tier sibling — a reviewed architectural addition, not rot.

2. **The adapter core (pack-agnostic).** A canonical **name vocabulary** is the contract: an
   `as const` string array → `IconName` union (erasableSyntaxOnly-safe — no enum). An **`IconPack`** is
   `{ id: string; viewBox: string; icons: Record<IconName, string /* inner SVG body */> }` — inert data.
   An **`IconRegistry`** holds packs + an active id with `registerPack(pack)` (last-wins) /
   `setActivePack(id)` / `activePack()` / `overrideIcon(name, body)`; a default singleton `iconRegistry`
   is exported. **`resolveIcon(name, registry = iconRegistry): SVGElement`** builds the `<svg>` from the
   active pack's body (`createElementNS` + `svg.innerHTML = body`, parsed in the SVG namespace — zero-dep,
   jsdom-safe); an unknown name or no active pack returns a non-throwing empty
   `<svg data-icon-missing="…">` so a control never breaks.

3. **Content-into-cell contract (the geometry reconciliation — NO law change).** `resolveIcon` stamps
   the returned `<svg>` with `fill="currentColor"`, `width="100%"`, `height="100%"`,
   `aria-hidden="true"`, `focusable="false"`. An SVG at 100%×100% of its content box fills whatever cell
   it is dropped into: in an `[data-role='icon']` cell it fills icon size; in a `[data-role='caret']`
   cell the cell's *existing* `padding: (icon − glyph)/2` insets the SVG to font-rhythm — so the §4.1
   caret law is preserved **for free**, with no CSS edit to the geometry blocks. `currentColor` inherits
   the control's ink, so no per-icon color plumbing.

4. **Two consumption surfaces over one core.** (a) **`setIcon(el, name, registry?)`** — an imperative
   helper in `@agent-ui/icons` (`el.replaceChildren(resolveIcon(...))`) that the internal controls will
   call at their existing imperative injection sites (a one-line swap per glyph — deferred to the
   migration wave, ADR-0066 §rollout). (b) **`ui-icon`** (`UIIconElement`, `controls/icon/`) — the
   declarative consumer surface: `<ui-icon name="caret-down">`, a light-DOM host that is its own sized
   cell (default `1em`, `fill: currentColor`), decorative by default with an optional `label` for a
   meaningful icon (role=img + aria-label). It re-resolves when `name` (or `label`) changes. **Live
   pack-swap reactivity is DEFERRED** — an already-rendered `ui-icon` does not auto-update when a pack is
   swapped *after* it rendered, because the registry (clause 2) exposes no subscribable signal and apps
   register their pack once at startup before first render; re-setting `name` reflects a swap. The future
   extension (the first live-swap consumer) adds a zero-dep `subscribe(cb)` listener to the registry that
   `ui-icon` bridges into an effect — never a signal *inside* `@agent-ui/icons` (that would import the
   components kernel and invert the arrow). `ui-icon` imports `setIcon` from `@agent-ui/icons` (the edge
   that first trips the widened trip-wire).

5. **Extensibility reaches end-consumers (two-tier, the a2ui-registry precedent).** `registerPack` /
   `setActivePack` / `overrideIcon` are PUBLIC on `@agent-ui/icons` — a consuming app swaps Phosphor for
   its own pack or overrides a single icon **with zero package edits**, exactly as a project registers
   its own catalog against the a2ui `Registry` (`a2ui/src/catalog/registry.ts:39`). Phosphor is merely
   the default that self-registers on import of its subpath (ADR-0066).

## Consequences

- **The zero-dep runtime pillar holds** — `@agent-ui/icons` ships a tiny registry + inert SVG-data
  modules; the only Phosphor coupling is a build-time devDependency in ADR-0066. The core component
  bundle pays nothing until a control imports `setIcon` (migration wave) or an app imports `ui-icon`.
- **The geometry blocks are untouched** — the whole point of clause 3 is that the migration is
  content-only: `caretSpan.textContent = '▾'` → `setIcon(caretSpan, 'caret-down')`, no `.css` change.
  A geometry regression in a migrated control would therefore signal a *content* bug, not a re-cut cell.
- **A second cross-package edge exists** (`components → icons`), so the trip-wire allowlist is now a
  two-entry list; a future third sibling is a deliberate ADR call, not a silent widening.
- **`ui-icon` adds one control to the family barrel** — a marginal size cost (tracked by `npm run size`,
  ADR-0040 discipline); it drags only its own resolve path + the active pack the app registers.
- **Emoji glyphs (`👁`/`📅`) become real, uniform SVG** once migrated — a rendering-consistency and
  WHCM win (`currentColor` participates in forced-colors like the existing cells).
- **Stale → re-verify on the build gate:** the trip-wire allowlist · the new package's tsconfig wiring
  into `npm run check` · the `size` budget after `ui-icon` lands.

## Acceptance

- `import { resolveIcon, setIcon, iconRegistry } from '@agent-ui/icons'` resolves; with Phosphor
  registered, `resolveIcon('caret-down')` returns an `<svg>` (SVG namespace) with a non-empty child and
  `fill="currentColor"`; an unregistered name returns `<svg data-icon-missing>` and does NOT throw.
- Dropping that `<svg>` into a live `[data-role='caret']` cell renders at font-rhythm and into an
  `[data-role='icon']` cell at icon size, with **no** edit to `button.css`/`select.css` (a browser probe
  asserting the rendered box in both cells).
- `<ui-icon name="caret-down">` renders the SVG; changing `name` re-resolves; `overrideIcon('x', …)`
  then `resolveIcon('x')` reflects the override (registry unit test).
- `layering.test.ts` stays green with `components/src/controls/icon/*` importing `@agent-ui/icons`
  (the allowlist widening is the only diff).
- `npm run check` and `npm test` green; `npm run size` reported (family budget note).

## Alternatives considered

- **Put the adapter in `@agent-ui/shared`** (no new package, no trip-wire edit — components already
  depends on shared) — rejected: `shared/src/index.ts` is literally `export {}` (tokens-only by design);
  a runtime registry + a vendored SVG corpus changes shared's character from "static tokens" to a
  stateful runtime module, and buries the swappable-pack story inside the token package. A dedicated leaf
  matches the repo's own precedent (shared, a2ui are peer packages with their own export maps).
- **A module inside `@agent-ui/components/src/icons/`** (no new package) — rejected: the vendored SVG
  data would live in the zero-dep core package, and `ui-icon` (which `extends UIElement`) forces the
  icon package to depend on components — inverting the intended `components → icons` direction. Splitting
  the pure adapter out as a leaf is what keeps the dependency arrow correct.
- **A template directive `icon(name)`** — rejected: controls inject these glyphs imperatively
  (`createElement` in `#ensureParts`), not through `html\`\``; a directive needs the private template
  entry and would force every injection site to adopt templating it doesn't use. `setIcon` fits the
  existing imperative sites with a one-line change.
- **A `name` prop on every control instead of a shared surface** — rejected: it re-implements resolution
  N times and couples each control to the pack vocabulary; `setIcon`/`ui-icon` over one resolver keeps
  the pack a single swappable seam.
- **Icon fonts / a sprite sheet** — rejected: an icon font is a runtime asset dependency and fails
  `currentColor`/WHCM cleanly per-glyph; inline SVG with `currentColor` reuses the existing cell CSS and
  the forced-colors handling already in the geometry blocks.
