---
doc-type: ticket
id: tkt-0086
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0086 — the `--md-sys-*` shared-token migration (ADR-0140): ~34 names, ~150 files, one gated wave

## Summary
Leg 1 of the THEMING arc. Execute ADR-0140's mechanical rename: every shared foundation token in
`dimensions.css`/`base.css` moves to its mapped `--md-sys-*` name (the ADR's table is the contract
— slots stable, values byte-identical), every fleet consumer follows in the same wave, and the
citing laws/gates move with it. Runs in an isolated worktree branch (the other session is active
on main).

## Acceptance
- The ADR-0140 mapping applied verbatim; computed styles byte-identical (spot-verify via the
  browser gallery + the built-CSS fixture regen).
- Grep-zero on every OLD shared name repo-wide (`--ui-height-`, `--ui-space-`, `--ui-scale`, … —
  the full census list), EXCLUDING per-component `--ui-{name}-*` tokens which must be untouched.
- `naming.md` §5 rewritten (prefix = ownership; allowlist retired) + §12 records the 2026-07-12
  ruling's partial supersession; `dimensions.test.ts` / `styling-gates.test.ts` /
  `family-coherence.test.ts` updated per their own deliberate-change rules; ADR-0038's prose refs
  trued.
- `npm run check` + full jsdom + browser smoke green; theme-provider built-CSS fixture regenerated.

## Links
- [ADR-0140](../adr/0140-system-token-md-sys-consolidation.md) — the contract.
- [TKT-0087](tkt-0087-theme-pack-pipeline.md) / [TKT-0088](tkt-0088-site-shell-theme-dogfood.md) —
  the legs this unblocks.

## Scope/Open
- NO compat aliases (ADR-0140 cl.3). NO value changes. NO per-component token renames.

## Findings

### 2026-07-17 — migrated, gated green, three real gate-mechanism repairs found and fixed — CLOSED

**The rename:** a two-pass exact/family-stem script (225 files, 34 declared names) applied the
ADR-0140 table across `packages/agent-ui/**` + `site/**` (source, tests, `.md` descriptors) +
`naming.md`/`geometry.md`/`geometry-sizing-spec.md`. Two edge-case comments a scripted pass
couldn't reach (a mid-token line-wrap, a multi-family `--ui-{height,font,icon}-` brace shorthand)
fixed by hand. `site/public/{llms-full.txt,adr-index.json}` — build artifacts, not source —
regenerated via their real generators rather than hand-edited; their surviving `--ui-*` mentions
are HISTORICAL ADR-body text, correctly untouched (per the repo's own never-rewrite-history rule).

**Three gate mechanisms needed real repairs, not just renamed text** (each verified against a
concrete regression before/after):
1. `styling-gates.test.ts`'s `BANNED_READ` regex used a JS alternation
   (`--ui-(?:font|space|radius)`) — not a literal token, so the rename script correctly left it
   alone, which would have SILENTLY DISARMED the gate (never matching the new `--md-sys-*` names).
   Rewritten to the new prefix; the file's own negative-control fixture (which the rename DID
   update, since it embeds literal tokens) re-passed unchanged, proving the fix's shape was right.
2. `row-css.test.ts`'s `ALLOWED` regex had the same alternation shape
   (`--ui-(?:row|container|space)-`) — "space" needed to move to the NEW `--md-sys-space-`
   prefix while "row"/"container" correctly stay `--ui-`, so the single-prefix rename couldn't
   apply here at all; split into a two-branch alternation across both prefixes.
3. `family-coherence.test.ts`'s `tokenAllowedToDeclare` only ever special-cased
   `--md-sys-color-*`/`--md-sys-typescale-*` as universally consumable; widened to the whole
   `--md-sys-*` prefix (ADR-0140's actual boundary) — the exact same permissiveness model the
   original design already used for color/typescale, now extended to the newly-migrated
   dimensional families instead of narrowly gate-keeping them.

**A pre-existing dangling reference on `main`, found and fixed separately:** an earlier commit in
this same session (`a5e3325`) had accidentally swept a CONCURRENT session's uncommitted
README.md edit (an ADR-0139 row) into a THEMING-arc commit, without its supporting files —
invisible in the original working directory (the untracked files still sit on disk there) but a
real dangling-link + ADR-numbering-gap in any fresh checkout, caught the moment this worktree
(a true clean checkout) ran the standing `docs-grammar.test.ts` gate. Fixed forward on `main`
directly (`f695cdf`, removing just the orphaned row) rather than fabricating the other session's
still-unauthored ADR/ticket content.

**A worktree-setup gap, not a code defect:** this worktree was never `npm install`'d after
creation (sibling worktrees were), so `node_modules/@agent-ui/*` was entirely absent and Node's
resolution walked UP into the ORIGINAL directory's `node_modules` — silently fine for most
imports, but Vite's `server.fs.allow` security check denied the one `?raw` CSS import that
resolved to a path outside the worktree's own root. `npm install` in-worktree created the
worktree-local `@agent-ui/*` symlinks and resolved it; incidentally also synced a stale
`package-lock.json` entry (`@agent-ui/a2ui → @agent-ui/shared`, missing since `8787470`).

**Verified:** `npm run check` green; full jsdom 6332/6333 (the ONE remaining red is the
cross-session ADR-0139 numbering gap above, self-resolving once the other session commits its own
file — not this ticket's to fabricate); a scoped real-browser-engine pass (foundation package +
button/row/column/checkbox/switch/slider/text-field + the theme-provider light-dark leg — the
highest-token-density controls) 286/286 green, proving computed-style correctness beyond what
jsdom's text-pinned gates can show. `naming.md` §5 rewritten to the two-tier prefix-is-ownership
model; §12 records the 2026-07-12 ruling's partial supersession.
