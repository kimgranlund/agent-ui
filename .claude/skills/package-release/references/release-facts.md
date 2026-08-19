# Release facts (don't re-derive these)

Corpus-shaped standing knowledge about the release pipeline. Consulted from `package-release/SKILL.md`
§The release procedure; nothing here is a step — it's context that saves re-deriving history the hard way.

## Release history (2026-07-19)

`v0.0.1` was cut but never published (CI E403 on a brand-new package name — the security posture on
the account requires full interactive/user auth for a package's FIRST-EVER publish; a CI automation
token only works from the second version of an ALREADY-EXISTING package onward; tag retracted).
`v0.0.2` published the launch-day UNSCOPED `agent-ui-*` names, done locally under real user auth to
clear that first-publish barrier. `v0.0.3` is the SCOPED debut: `@agent-ui-kit/*` with the redundant
`agent-ui-` prefix dropped (Kim's ruling, same day) — since the scope IS the org, restating it in the
name is redundant. The unscoped `agent-ui-*@0.0.2` set was fully UNPUBLISHED the same day (not merely
deprecated) — those 8 names are gone from the registry entirely; never publish to them again. `v0.0.3`
through `v0.0.5` (and onward) all published cleanly via CI — the first-publish barrier only ever
applied to a package's very first version, so `@agent-ui-kit/*` normal CI releases work exactly as the
procedure documents.

## Facts worth knowing

- Published package names are SCOPED under the org: `@agent-ui-kit/shared`, `@agent-ui-kit/components`,
  … (the `agent-ui-kit` org owns the scope; the redundant `agent-ui-` prefix dropped with it — Kim,
  2026-07-19). This repo's internal `@agent-ui/*` names/imports stay completely untouched; the publish
  script transforms a COPY of each `package.json` (+ emitted specifiers) at publish time only. The
  launch-day unscoped `agent-ui-*@0.0.2` set was fully UNPUBLISHED the same day — those 8 names no
  longer exist on the registry at all; never republish to them.
- **Package-page content ships AUTOMATICALLY via the transform** (v0.0.4/v0.0.5 waves) — never
  hand-edit a scratch dir: each package's `README.md` (authored in the PUBLISHED `@agent-ui-kit/*`
  names — it copies without specifier rewriting, and its CDN examples' `@<pkg>@<semver>` version pins
  are REWRITTEN to the release version at publish time), the root `LICENSE` (npm only auto-packs one
  from the package root, i.e. the scratch dir), `description` (single-sourced from the workspace
  `package.json`), and `keywords`/`homepage`/`bugs` (the script's own `PACKAGE_KEYWORDS` map).
  **Adding a 9th package** = its README + a `description` in its manifest + a `PACKAGE_KEYWORDS`
  entry + a `PACKAGE_ORDER` slot.
- **The CDN recipes are load-bearing contracts** (README `## CDN` sections, probe-verified 2026-07-19):
  esm.sh resolves the exports-map subpaths for BOTH JS and CSS and rewrites bare `@agent-ui-kit/*`
  sibling imports; `component-styles.css` must stay RELATIVE-imports-only (CDN-safe today) while
  `foundation-styles.css` is known-bare (browsers can't resolve its `@import`s — the recipes link
  shared's `tokens.css` + `dimensions.css` directly instead). A CSS-barrel edit that introduces a bare
  `@import` silently breaks the documented recipe — the SHIPPED install-from-registry smoke
  (`.github/workflows/consumer-smoke.yml`) is the gate that catches it (GH #71, closed — the
  should-catch-it framing this line once carried is history, GH #761).
- License: MIT (`LICENSE` at repo root) — Kim's decision, 2026-07-19.
- The app package's Vite-only consumer profile is HISTORY (relaxed GH #283, 2026-07-27, on a real
  esbuild+webpack+browser install smoke): its forcing mechanism was `?url`/`?raw` import-query specifiers
  in the now-removed `app-shell.ts` (ADR-0156), and no publishable package source carries such a specifier
  today. Releases through `0.0.5` still ship the old constrained artifact. `publish-packages.mjs`'s own
  header is the authority on the current status — read it there rather than restating it here. Two gaps
  stay documented in `app/README.md`, not silently dropped: plain Node ESM (no DOM) works for no control
  package in the family, and no CDN probe covers the app package yet.
- **The published a2ui EXCLUDES its `./agent` subpath** — `EXCLUDE_EXPORTS_FROM_PUBLISH` in
  `publish-packages.mjs` (its own comment is the authority: the node-first producer reads prompt
  `.md` files via a cwd path no consumer install can have, so the export would throw on import;
  `./agent/meta-line`, pure type-only, stays published). Shipping the producer for real is a
  separate deliberate effort, never a silent default.
- **Adding a package to the family** = extend `PACKAGE_ORDER` (+ its keywords row) in
  `publish-packages.mjs` — the one knob; the DAG-ordered list is the publish order, so a new
  package lands AFTER everything it depends on.
- npm version numbers are burned forever once published, even after unpublish — decide deliberately
  per step 1 of the release procedure rather than tagging speculatively and fixing forward.
