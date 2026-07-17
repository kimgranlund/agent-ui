---
doc-type: ticket
id: tkt-0088
status: done
date: 2026-07-17
owner:
kind: feature
size: small
---
# TKT-0088 — the site shell dogfoods scheme + theme through `ui-theme-provider` (ADR-0141 cl.4/5)

## Summary
Leg 3 of the THEMING arc. The docs shell (and the standalone app pages) mounts ONE
`ui-theme-provider` around its content; a shell-header control offers the scheme toggle
(auto/light/dark) and the theme picker (default + packs). `site/lib/theme-loader.ts` lazy-injects
a pack's stylesheet on first selection and persists both choices — the provider component itself
stays untouched (its LLD's own prediction for this seam).

## Acceptance
- Shell-wide provider: every doc page + `agent-admin-app.html` render inside it; scheme unset
  still tracks the OS (the ADR-0117 unset-inherits fix must not regress).
- Theme picker switches among default + the TKT-0087 proof packs LIVE: first selection injects
  the pack CSS once, re-selection is instant, choice + scheme persist across reloads.
- Browser-verified in both schemes × ≥2 themes (the tokens actually repaint — computed-style
  spot checks on a role each pack overrides).
- No fetch/env code enters any packaged component; the loader lives site-side.

## Links
- [ADR-0141](../adr/0141-theme-packs-ultimate-tokens-pipeline.md) — the contract ·
  [TKT-0087](tkt-0087-theme-pack-pipeline.md) — the packs this consumes.

## Scope/Open
- The gallery/theming teaching pages update to point at the live shell mechanism (small prose
  deltas), not rebuilt.

## Findings

**2026-07-17 — shipped.** Leg 3 of the THEMING arc, built in an isolated worktree
(`.claude/worktrees/tkt-0088-site-theme-dogfood`) alongside the concurrent TKT-0084 session.

- **`site/lib/theme-loader.ts`** (new) — the site-side loader ADR-0141 cl.5 assigns: `THEME_OPTIONS`
  (`default`/`ocean`/`ember`, the TKT-0087 proof packs), `applyTheme`/`applyScheme` (the latter a pure
  passthrough — never remaps `''`, so the ADR-0117 unset-inherits fix survives), an idempotent
  `ensurePackLoaded` (dynamic `import(...?url)`, injects a `<link>` once per pack), and
  `persist*`/`loadPersisted*` (localStorage, garbage-degrades to the default rather than throwing). No
  fetch/env code — the loader owns only DOM + localStorage, per the ticket's Acceptance.
- **`site/pages/_page.ts`** — `mountPage`/`mountFullBleedPage` now build their shell as a real
  `<ui-theme-provider>` (was a plain `<div>`), applying the persisted scheme synchronously (no
  default-then-repaint flash) and the persisted theme via a fire-and-forget async pack load. The header's
  previously-inert "Theme" placeholder span is replaced by a real control: a scheme-cycle `ui-button`
  (Auto → Light → Dark → Auto) plus a theme `ui-menu` picker, both wired to `theme-loader.ts` and
  persisting on every change.
  Every doc page and `agent-admin-app.html` route through these two entry points, satisfying the
  "shell-wide provider" acceptance line without a per-page change.
- **jsdom proof** — `site/lib/theme-loader.test.ts` (9 tests) + `site/pages/_page-theme.test.ts` (9 tests),
  both green: persistence round-trips, the unset-scheme-stays-`''` regression guard (caught a wrong test
  assumption along the way — `hasAttribute` is not the right check for a reflected prop's default; see
  below), the full scheme-cycle button behavior, and structural proof the inert placeholder is gone, not
  just sat beside the real control.
- **Browser proof (the ticket's own hardest acceptance line)** —
  `site/lib/theme-pack-apply.browser.test.ts` (new, 6 tests, real Chromium via the `test:browser` project,
  following the `theme-provider-build.browser.test.ts` precedent: production built CSS injected via
  `?raw`, real elements mounted, real `getComputedStyle` reads). Proves, against real production bytes:
  ocean and ember each genuinely repaint `--md-sys-color-primary` (and differ from each other, not just
  from the default); a status color (`danger`) is untouched by either pack, as designed; a bespoke
  16-exempt role (`focus-ring`) correctly falls through to `:root`'s value inside a themed subtree — the
  cascade-inheritance claim from TKT-0087's Findings, measured rather than assumed; `scheme` still resolves
  correctly *inside* a themed provider (scheme × theme are orthogonal, per ADR-0141 cl.1); an un-themed
  sibling provider is unaffected by a themed one nearby (subtree independence holds with a real pack now in
  play, not just the synthetic override the original ADR-0117 proof used).
- **Teaching-page prose sync** (the ticket's own Scope/Open line) — `site/pages/theming.ts` §5 rewritten
  from "reserved, not-yet-implemented seam" to describe the shipped mechanism and point at this site's own
  header picker as the live demo; `site/main.ts`'s two nav blurbs ("Theming", "ui-theme-provider API
  reference") had the same "reserved …/not-yet-implemented" language, fixed. One further staleness found
  and fixed *outside* `site/`: the component's own owned descriptor,
  `packages/agent-ui/components/src/controls/theme-provider/theme-provider.md`, still asserted "no
  `[theme='<name>']` CSS layer exists anywhere in the fleet yet" — false since TKT-0087 shipped two. Fixing
  it required regenerating `site/public/llms-full.txt` (a byte-identical-to-generator gate,
  `site/lib/llms.test.ts`, derives from this descriptor) — caught by the standing test, not missed.
- **Full gate sweep, in the worktree:** `npm run check` clean (tsc + check:site + check:tools); full jsdom
  run 6371/6372 (the one failure is the pre-existing, cross-session, self-resolving ADR-0139 numbering gap
  from the concurrent TKT-0084 work — unrelated, same single failure present before this ticket's changes);
  `npx vitest run --config vitest.browser.config.ts` real-Chromium proof green (12/12 across the precedent
  file + the new one).
- **What was NOT done:** the gallery's (`site/lib/component-gallery.ts`) own `THEMES = ['default']`
  knob was left as-is — it is an accurate description of the gallery's own current, narrower vocabulary
  (one specimen-preview knob, not the site shell), and wiring live pack-loading into the gallery's
  toolbar would be a rebuild, not the "small prose deltas" the ticket's Scope/Open line called for.
