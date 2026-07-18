---
doc-type: ticket
id: tkt-0096
status: done
date: 2026-07-17
owner:
kind: bug
---
# TKT-0096 — the theme picker (Ocean/Ember) silently fails to apply; the header's Search placeholder should be a real button opening ui-command-modal

## Summary
Kim's screenshot (2026-07-17, `/bug-report` intake): the docs-shell header's theme picker dropdown
(Default/Ocean/Ember) open, scheme toggle showing "Dark". Report: "the themeing toggle does not
work at all. Search should be a button and open ui-command modal."

Two distinct defects under one report, both in `site/pages/_page.ts`'s header chrome (TKT-0088's
Theme control + the still-inert Search placeholder TKT-0088 explicitly deferred):

1. **A genuine functional bug** — selecting a non-default theme (Ocean/Ember) in the picker does
   nothing: no visual change, no error surfaced to the user (a silently-swallowed rejection).
2. **A real gap, not new** — the header's "Search" slot has been an inert placeholder span since
   TKT-0018 shipped the command-search feature elsewhere; TKT-0018's own scope never wired the
   header control itself (see [[theme-ticket-header-activation-convention]] memory, 2026-07-17).

## Acceptance
- Selecting Ocean or Ember in the theme picker visibly repaints the site (a real pack stylesheet
  loads and applies), with no console error.
- A persisted non-default theme choice survives a page reload and re-applies without error.
- The header's "Search" slot is a real, clickable control (not an inert `<span>`) that opens the
  already-shipped `ui-command-modal` palette (TKT-0018) — the same surface `mod+k` already opens.
- No regression to the scheme toggle (Auto/Light/Dark), which was already working correctly.

## Repro (as investigated, real Chromium + WebKit — vitest-browser, not jsdom)
1. Mount any `/site` page, open the header's theme `ui-menu` picker, click "Ocean".
2. **Before the fix:** `provider.getAttribute('theme')` stays `''`, no `<link data-theme-pack="ocean">`
   ever gets injected, `select` event fires correctly (`{value:"ocean", index:1}`) — the failure is
   downstream of the app's own listener, not the menu component.
3. Calling `applyTheme(provider, 'ocean')` directly threw, in-engine:
   `TypeError: Failed to resolve module specifier '@agent-ui/shared/themes/ocean.css?url'` (Chromium)
   and `TypeError: Module name, '@agent-ui/shared/themes/ocean.css?url' does not resolve to a valid
   URL.` (WebKit) — a REAL browser-level module-resolution error, swallowed silently because the
   call site was `void applyTheme(provider, id)` (fire-and-forget, TKT-0088-era code, also present
   verbatim in `buildThemedShell`'s own reload-time restore-persisted-choice call).

## Expected vs actual
- **Expected:** `ensurePackLoaded(name)` resolves the pack's stylesheet URL and injects a `<link>`.
- **Actual:** `theme-loader.ts:36`'s `import(\`@agent-ui/shared/themes/${name}.css?url\`)` — a
  template-literal dynamic import — is not statically analyzable by Vite's import-analysis plugin
  (its own build-time warning: "The above dynamic import cannot be analyzed by Vite"). Unanalyzable
  dynamic imports fall through unresolved to the browser's native ESM loader, which cannot resolve
  a bare package specifier without a build-time rewrite — throwing, every time, for every non-default
  theme, including on the reload-time restore path.

## Classification
Two axes, same header region:
1. **Functional / build-tooling** — `site/lib/theme-loader.ts`'s `ensurePackLoaded`, a genuine
   dynamic-import-analysis defect (not a component bug — `ui-menu`'s own commit/select mechanism
   verified correct in isolation).
2. **Missing wiring / scope gap** — `site/pages/_page.ts`'s `buildContextHeader`, an inert
   `<span class="app-context-slot">` never upgraded to a real control, despite the already-shipped
   `ui-command-modal` palette (`site/lib/command-palette.ts`) being fully wired and mounted on every
   page via `mountCommandPaletteOnce()` — only the header's OWN click affordance was missing.

## Severity
**major** — the theme-pack feature (TKT-0087/0088/ADR-0141) is completely non-functional for any
theme beyond the default, silently, with zero user-facing feedback; the Search gap is a
discoverability/UX miss on an already-shipped feature (its `mod+k` hotkey still works).

## Links
- `site/lib/theme-loader.ts` — `ensurePackLoaded`/`applyTheme` (the functional bug's location).
- `site/pages/_page.ts` — `buildContextHeader`/`buildThemedShell` (the Search wiring gap; the
  reload-time `void applyTheme(...)` call sharing the same swallowed-rejection bug).
- `site/lib/command-palette.ts` — the already-shipped, already-mounted `ui-command-modal` palette
  the Search button now opens.
- [TKT-0087](tkt-0087-theme-pack-pipeline.md) / [TKT-0088](tkt-0088-site-shell-theme-dogfood.md) /
  [ADR-0141](../adr/0141-theme-packs-ultimate-tokens-pipeline.md) — the theme-pack feature this
  bug breaks.
- [TKT-0018](tkt-0018-site-command-search.md) — the command-search feature the Search button opens.

## Findings

### 2026-07-17 — root-caused (real-engine repro, both Chromium/WebKit) and fixed inline

**Fix 1 — theme pack loading (`site/lib/theme-loader.ts`):** replaced the unanalyzable
template-literal dynamic import with `import.meta.glob('../../packages/agent-ui/shared/src/tokens/
themes/*.css', { query: '?url', import: 'default' })` (a literal glob pattern Vite CAN statically
rewrite) + a `themePackKey()` lookup. One real gotcha hit and fixed along the way:
`import.meta.glob`'s pattern must itself start with `/` or `./` — a bare package specifier
(`@agent-ui/shared/themes/*.css`) throws `Invalid glob` at Vite's dev-transform layer even though a
`vite build` run silently succeeded first (misleading — the dev-server transform is the one that
matters for `npm run dev`, and it's stricter). Re-verified live, both engines: `applyTheme(provider,
'ocean')` now resolves cleanly, injects the real `<link data-theme-pack="ocean">`, sets the `theme`
attribute; the full click path (open menu → click "Ember") verified end-to-end with a real
synthetic click.

**Fix 2 — Search button (`site/pages/_page.ts`):** the inert `<span class="app-context-slot">`
replaced with a real `<ui-button variant="soft">Search</ui-button>`, click handler lazy-imports
`../lib/command-palette.ts` (same module `mountCommandPaletteOnce` already loaded at shell-build
time, so this resolves from cache, no second fetch) and calls a new exported
`openCommandPalette()` (`site/lib/command-palette.ts`) that flips `.open = true` on the
already-mounted instance. `_page.css`'s now-fully-dead `.app-context-slot` rule removed (both
slots are real controls now, matching this repo's own dead-CSS-is-a-defect convention).

**Verification:** `site/pages/_page-theme.test.ts` updated (Search assertion now checks for a real
`ui-button`, not the old inert-placeholder pattern) — confirmed a stale test would have masked this
fix's own regression risk otherwise. `theme-provider-built.css` fixture regenerated (now correctly
includes ocean.css/ember.css as real emitted chunks — they simply couldn't code-split before, given
the bug). Full gate sweep: `npm run check` clean, `npm test` 6446/6446 green, `test:browser`
(site project) 40/42 files green — the 2 pre-existing failures (`a2ui-live.browser.test.ts`'s
ui-tabs commit test) independently reproduced as unrelated by stashing this change entirely and
re-running the same test (identical failure with zero changes applied) — not a regression from
this ticket.

Status → `doing` (fixed, verified, awaiting the user's own live confirmation before `done`).

**2026-07-18 — Kim confirmed live.** Status → `done`.
