# ADR-0066 — Phosphor is the default pack: a curated subset vendored at build time from a devDependency into committed inert TS, regular weight, self-registering on subpath import

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; the curated 9-icon `regular`-weight subset ships vendored at build time via `scripts/vendor-phosphor.mjs`; `@phosphor-icons/core` confirmed devDependency-only [`package-lock.json` "dev": true] with zero runtime bytes reachable outside the `"./phosphor"` subpath, verified by the independent review and a dedicated negative-control test.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the icon-adapter-architecture intake) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | `icon-adapter.lld.md` LLD-C4/C6 (authored this change) · `packages/agent-ui/icons/package.json` gains a `@phosphor-icons/core` **devDependency** + a `"./phosphor"` subpath export (build-time, gated on ratification) |
> | **Supersedes / Superseded by** | Extends ADR-0065 (the pack-agnostic adapter this supplies the default for) · Relates ADR-0062 (build-time codegen → committed inert data, no runtime dep) · ADR-0040 (the manual `npm run size` discipline the vendored subset respects) |

## Context

ADR-0065 defines a pack-agnostic adapter; it needs exactly one concrete default. Phosphor Icons
(phosphoricons.com, ~1,300 glyphs across six weights) is the chosen source. Two questions are
load-bearing and cannot be left to the builder: **how** Phosphor SVG reaches the shipped runtime
without adding a runtime npm dependency (the zero-dep pillar), and **how much** of Phosphor is carried
(the whole library vs only what the audit needs — a bundle-size and repo-weight question, ADR-0040
discipline). The audit (icon-adapter.lld.md §Audit) enumerates the concrete need: the disclosure caret,
the calendar month-nav chevrons, and the text-field adornment glyphs — **nine** distinct icons, no more.

## Decision

1. **Phosphor `regular` is the default weight.** It is Phosphor's own baseline; thin/light/bold/fill/
   duotone are not load-bearing for this wave and are not vendored. (A future weight is a curation-list
   edit, not an architecture change.)

2. **Vendor a curated subset, not the library.** Exactly the nine the audit needs — a canonical→Phosphor
   name map baked into the vendor script:
   `caret-down · caret-up · caret-left · caret-right · x · eye · eye-slash · calendar-blank · check`
   (`check` is the forward companion for the *optional* future checkbox migration; all nine exist in
   Phosphor `regular`). Adding an icon later is a one-line map edit + a re-run of the script.

3. **Build-time codegen from a devDependency → committed inert TS (zero runtime dep).** A Node script
   `packages/agent-ui/icons/scripts/vendor-phosphor.mjs` reads the `regular`-weight SVGs from
   **`@phosphor-icons/core` (a devDependency, never shipped)**, strips each SVG's fixed
   `width`/`height`/`fill`/`stroke`, extracts the inner body (the `<path>`/`<rect>` markup, viewBox
   `0 0 256 256`), and emits **`src/phosphor/icons.gen.ts`** — an inert
   `Record<IconName, string>` of SVG bodies. The generated file is **committed**, so `npm ci` without the
   devDependency still builds and the runtime graph carries zero Phosphor code; the script is re-run only
   to change the curated set.

4. **The pack self-registers on subpath import.** `@agent-ui/icons/phosphor` (`src/phosphor/index.ts`)
   exports `phosphorPack: IconPack = { id: 'phosphor', viewBox: '0 0 256 256', icons: phosphorIcons }`
   AND, as an import side-effect, calls `iconRegistry.registerPack(phosphorPack)` + activates it —
   mirroring the fleet's self-define-on-import idiom (a control registers its tag on import). An app that
   wants explicit control imports `phosphorPack` and registers it itself (ADR-0065 clause 5). The root
   `@agent-ui/icons` barrel does NOT pull `phosphor` (the ADR-0055/0062 subpath rule — a consumer that
   only wants the adapter, or its own pack, bundles zero Phosphor bytes).

## Consequences

- **Zero runtime dependency, verifiable** — no `src/**` module imports `@phosphor-icons/*`; the only
  reference is the devDependency used by the vendor script (a greppable invariant, candidate trip-wire).
- **Repo + bundle weight is bounded to nine icons** — Phosphor bodies are small path strings; the
  `"./phosphor"` subpath keeps them off any consumer that doesn't import it, and off the `@agent-ui/icons`
  root barrel entirely. `npm run size` is reported when `ui-icon` + a registered pack land.
- **The generated file is a build artifact under source control** — a reviewer diffs `icons.gen.ts` like
  any committed codegen (ADR-0062's type-stripping-runner precedent); re-running the script must be
  byte-stable for the same curation list + Phosphor version (a determinism obligation on the script).
- **Weight/subset changes are cheap and local** — both are edits to the vendor script's map/weight
  constant + a re-run; no consuming code changes.
- **A second real pack is a non-goal this wave** — the adapter is pack-agnostic by construction (ADR-0065),
  but shipping Lucide/Material speculatively is out; the design is proven swappable by the
  `overrideIcon`/`registerPack` unit tests, not by a second vendored pack.
- **Stale → re-verify on the build gate:** the devDependency pin · the `"./phosphor"` export · the
  no-runtime-Phosphor-import invariant · `icons.gen.ts` byte-stability.

## Acceptance

- `node packages/agent-ui/icons/scripts/vendor-phosphor.mjs` runs on the repo's Node, reads
  `@phosphor-icons/core`, and writes ONLY `src/phosphor/icons.gen.ts`; re-running with an unchanged
  curation list + pinned version produces a byte-identical file.
- `import '@agent-ui/icons/phosphor'` registers + activates the pack; `resolveIcon('eye-slash')` then
  returns a non-empty `<svg>` (the emoji `👁`/`📅` sources now resolve to real SVG).
- No module under `packages/agent-ui/icons/src/**` imports any `@phosphor-icons/*` package (grep
  invariant); importing `@agent-ui/icons` (root) tree-shakes to zero Phosphor bytes.
- All nine curated names resolve to distinct non-empty bodies (a data-completeness unit test over
  `ICON_NAMES`).
- `npm run check` and `npm test` green.

## Alternatives considered

- **A runtime dependency on a Phosphor npm package** (`@phosphor-icons/core` / `@phosphor-icons/web`) —
  rejected: breaks the zero-runtime-dependency pillar outright; the whole point of build-time vendoring
  is that Phosphor is a dev-time source, not a shipped dependency.
- **Vendor the whole ~1,300-icon library** — rejected: repo weight + a large size-tracked export surface
  for nine used glyphs; the curated-list-plus-script gives the same "add later" ergonomics without
  carrying the kitchen sink (ADR-0040 discipline).
- **Ship the adapter with NO default pack** — rejected: the intake wave's deliverable is a *working*
  default; an unregistered adapter renders `data-icon-missing` for every name, so nothing is demonstrably
  end-to-end. Phosphor-as-default is the point.
- **Hand-draw the nine as bespoke SVG in-repo** (skip Phosphor entirely) — rejected: loses the curated,
  consistent, licensed source and the "swap the whole pack" story; re-introduces the ad-hoc-glyph problem
  ADR-0065 exists to end.
- **Emit one `.ts` module per icon** (vs one `icons.gen.ts` map) — rejected for this subset: nine entries
  in one map tree-shake fine and keep the generated surface a single reviewable file; per-file emission is
  a scaling option if the curated set grows large (noted, not adopted).
