---
doc-type: ticket
id: tkt-0002
status: done
date: 2026-07-09
owner:
kind: bug
---
# TKT-0002 — production CSS minification breaks `light-dark()` per-subtree scheme switching

## Summary
`vite build`'s CSS minifier (LightningCSS) rewrites every `light-dark(a, b)` in `tokens.css` into
the `var(--lightningcss-light, a) var(--lightningcss-dark, b)` polyfill pair — which resolves off
`prefers-color-scheme` ONLY and ignores a per-element `color-scheme` override. `<theme-provider
scheme="…">`'s entire per-subtree scheme mechanism (and `component-gallery.ts`'s existing manual
scheme toggle) is therefore silently broken in every production build today, while `vite dev` and
native `light-dark()` behave correctly. Discovered by the docs-content wave while building
`theming.html`'s live side-by-side scheme demo; independently confirmed by the host.

## Acceptance
- ✅ The shipped production CSS preserves working per-subtree scheme switching: a
  `<theme-provider scheme="dark">` subtree inside a light page resolves dark token values (and
  vice versa) in the `npm run build` output, not only under `vite dev` — proven live against the
  served `dist/` under both OS scheme preferences (see Findings), and independently re-confirmed
  by the host on the settled tree (zero `--lightningcss-` in dist CSS, native `light-dark(`
  present).
- ✅ The root cause is fixed at the build-config level: `vite.config.ts` `css.lightningcss.exclude:
  Features.LightDark` — the narrowest option; mechanism recorded in Findings.
- ✅ Standing gate: `site/lib/light-dark-minify.test.ts` — a real `vite build` into a scratch dir
  asserting the acceptance criterion, plus a biting negative control proving the downlevel is real
  and the exclude suppresses it.

## Links
- `vite.config.ts` — the build config where the CSS minifier is selected/configured.
- `packages/agent-ui/shared/src/tokens/tokens.css` — the source: 310 `light-dark()` declarations.
- `site/pages/theming.ts` — the new theming guide whose live demo surfaced this.
- `site/lib/component-gallery.ts` — the pre-existing, already-shipped consumer whose scheme toggle
  is silently broken in production builds today.
- TKT-0001 — unrelated bug, but the same lesson shape: dev-mode/test-green while the real rendered
  artifact is broken.

## Repro
1. `npm run build`.
2. `grep -c "lightningcss-light" dist/assets/foundation-styles-*.css` → 310 (every `light-dark()`
   rewritten; confirmed 2026-07-09).
3. Serve `dist/` and view any page with a `color-scheme`-overriding subtree (the gallery's scheme
   toggle, or the new `theming.html` demo): both halves resolve to the OS scheme instead of their
   declared per-subtree scheme.
Dev-mode control: the same pages under `vite dev` resolve correctly per-subtree (no rewrite).

## Expected vs actual
- **Expected:** the production CSS preserves `light-dark()` semantics — per-element
  `color-scheme` participates in resolution, as it does natively and in dev.
- **Actual:** LightningCSS's polyfill substitutes a `prefers-color-scheme`-driven custom-property
  pair, collapsing every subtree to the OS-level scheme in minified builds.

## Classification
Axis: **functional (build-pipeline)** — a semantics-changing transform applied by the CSS
minifier; the source, the components, and the dev server are all correct. Plane: `vite.config.ts`
build configuration (likely the LightningCSS `targets` not declaring `light-dark()` support, so
the minifier "helpfully" downlevels it; alternatives include pinning browser targets that support
`light-dark()` — Chrome 123+/Safari 17.5+/Firefox 120+ — or switching `build.cssMinify` to a
non-transforming minifier). Blast radius of any fix is every page's shipped CSS — the fix needs a
real before/after behavioral verification, not just a grep.

## Severity
**major** — a silent, production-only, site-wide defect in a shipped mechanism (`theme-provider`'s
scheme axis); invisible to every existing gate because tests and dev mode both run un-minified.

## Findings

### 2026-07-09 — root cause confirmed at the exact config line, fix option chosen

Traced through the installed versions (vite 8.1.0, lightningcss 1.32.0, both confirmed via `npm ls`/
`node_modules/*/package.json`, not assumed):

- `node_modules/vite/dist/node/chunks/logger.js:182` — Vite 8's default `build.target` /
  `build.cssTarget` (when unset, "baseline-widely-available") resolves to
  `["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"]` — every one of those predates
  `light-dark()` (needs chrome123+/safari17.5+/firefox120+). This is WHY the polyfill fires by
  default with zero explicit config from this repo — not a misconfiguration, a version-default gap.
- `node_modules/vite/dist/node/chunks/node.js:22462-22467` (`minifyCSS`, the function `build.cssMinify`'s
  `'lightningcss'` default routes through) — the minify call is
  `lightningcss.transform({ ...config.css.lightningcss, targets: convertTargets(config.build.cssTarget), … })`.
  **Critical finding: `targets` is unconditionally OVERWRITTEN after the spread**, so candidate fix (a)
  from the brief — setting `css.lightningcss.targets` — is a dead end for the MINIFY step specifically
  (it would only affect the separate `transformer: 'lightningcss'` path, which this repo doesn't use;
  default transformer stays `'postcss'`). Raising `build.cssTarget` (or `build.target`) itself would
  work for (a), but changes the downlevel threshold for every OTHER CSS feature and the JS output too —
  wider blast radius than the bug needs.
- Everything else in `...config.css.lightningcss` SPREADS THROUGH untouched, including `exclude` —
  confirmed lightningcss 1.32.0 exposes `Features.LightDark = 1048576` (`node_modules/lightningcss/node/targets.d.ts`)
  and `TransformOptions.exclude?: number` ("Features that should never be compiled, even when unsupported
  by targets" — `node_modules/lightningcss/node/index.d.ts:29`).

**Fix chosen: candidate (b)** — `vite.config.ts` now sets `css: { lightningcss: { exclude: Features.LightDark } }`
(imported `Features` from `'lightningcss'`, added as an explicit `^1.32.0` devDependency — it was
previously only a transitive optional dep of vite, a phantom-dependency risk for a file that now
statically imports from it). Chosen over (a)/raising `cssTarget` because it changes nothing about the
site's declared browser-support matrix for any other feature — the narrowest fix that keeps
minification, per the ticket's own steer. (c) (`build.cssMinify: 'esbuild'`) was not needed.

### 2026-07-09 — behavioral verification (production build, real headless Chromium)

1. Grep, both directions: `npm run build` with the fix → `light-dark(` present 308× in
   `dist/assets/foundation-styles-*.css` (616× across all shipped CSS), `--lightningcss-` present
   **0×** anywhere in `dist/assets/*.css`. Reverting only `vite.config.ts` (`git stash`) and rebuilding
   → `--lightningcss-` reappears 620× — confirms the fix is the load-bearing change, not incidental.
2. Real behavioral proof, not just text: served the built `dist/` via `vite preview`, drove it with
   headless Chromium (Playwright, the repo's established throwaway-script pattern) against
   `theming.html`'s live side-by-side `<theme-provider scheme="light">` / `scheme="dark"` demo, forcing
   the OS-level `prefers-color-scheme` to each of `light`/`dark` in turn (Playwright's
   `newPage({ colorScheme })`).
   - **With the fix:** both OS runs resolve the SAME two button-background values
     (`oklch(0.5585 0.184 258.34)` for the light panel, `oklch(0.6468 0.1726 258.27)` for the dark
     panel) — i.e. per-subtree `color-scheme` wins over the OS preference, exactly as `theme-provider`
     and native `light-dark()` promise.
   - **With the fix reverted:** both panels collapse to whatever the OS preference was
     (`OS=light` → both panels render the light value; `OS=dark` → both render the dark value) — the
     exact silent breakage this ticket describes, reproduced live in a real browser against the actual
     production artifact.

### 2026-07-09 — standing gate added

`site/lib/light-dark-minify.test.ts` (runs under `npm test`, vitest's `site` project). Two-part,
mirroring the repo's deterministic-check-plus-negative-control convention:
1. Shells out to the real `vite build` CLI (`spawnSync('npx', ['vite', 'build', '--outDir', <scratch>,
   '--emptyOutDir', ...])` against the repo's actual `vite.config.ts`, into a scratch dir outside the
   real `dist/`) and asserts the shipped CSS contains native `light-dark(` and zero `--lightningcss-`.
   This is the literal acceptance criterion, automated.
2. Negative control: calls lightningcss's own `transform()` directly on a minimal `light-dark()`
   snippet under old (`chrome111`) targets — asserts it DOES produce `--lightningcss-` when `exclude`
   is omitted, and does NOT when `exclude: Features.LightDark` is passed. Proves part 1 is a meaningful
   assertion (the downlevel is real and reachable), not vacuously true.
   Verified biting both ways: with `vite.config.ts` reverted, test 1 fails with
   `AssertionError: expected ':root{--lightningcss-light:initial;...' to contain 'light-dark('`; with
   the fix restored, both tests pass.

Design note: chose `spawnSync` over importing `{ build } from 'vite'`'s Node API. Importing `vite`
directly here pulled `@types/node`'s AMBIENT module declarations into `site/tsconfig.json`'s whole
program (site is deliberately a browser-app project — `types: ["vite/client"]` only, no `"node"` —
see the existing `@ts-expect-error` precedent guarding `node:fs` imports elsewhere, e.g.
`site/pages/tokens-doc.test.ts`). Ambient declarations are global, not file-scoped: importing `vite`'s
own `.d.ts` (which itself needs Node types) silently flipped 7 UNRELATED site test files'
`@ts-expect-error` suppressions into `TS2578: Unused '@ts-expect-error' directive` errors — verified
empirically (reproduced with only the `vite` import present, gone once removed). `lightningcss`'s own
`.d.ts` does not have this effect (confirmed the same way) — its two direct calls stayed as an import.
`npm run check` is clean with this test file in place.

Gates run clean: `npm run check` (tsc + check:site + check:tools) and `npx vitest run
site/lib/light-dark-minify.test.ts` both pass.
