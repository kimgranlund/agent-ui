---
doc-type: ticket
id: tkt-0095
status: done
date: 2026-07-17
owner:
kind: bug
---
# TKT-0095 — `ui-code-editor`'s doc page is nav-classified as an L2 Guide instead of an L1 Component

## Summary
Kim's screenshot (2026-07-17): the docs site's left nav rail shows "Code Editor" grouped under
**Guides**, active/selected, with the main pane rendering "ui-code-editor — API" — a page shaped
exactly like every other **Components** page (Attributes/Properties tables), not a prose guide.

## Acceptance
- `ui-code-editor`'s doc page is classified `level: L1`, `section: Components`, carrying
  `tag: ui-code-editor`, and appears in the left nav rail's Components group (right-justified tag,
  same row shape as Textarea/Select/every other `ui-*` control) instead of Guides.
- The fix generalizes, not a one-off hand-edit: whatever currently hardcodes the L1-derivation
  tree so it excludes `packages/agent-ui/code/src/editor/` is corrected (or `ui-code-editor`'s
  descriptor is otherwise wired into the same L1 pipeline every `components/src/controls`
  descriptor already goes through), so a FUTURE `@agent-ui/code` control doesn't silently repeat
  this same misclassification.
- `site/lib/site-manifest.json`'s manually-added L2 "Code Editor" row (added in 618b43f) is
  removed once the L1 pipeline correctly derives it — no duplicate nav entry.
- `scripts/generate-sitemap.mjs` / `site/lib/sitemap.test.ts` (the generator + its drift gate) and
  `site/public/sitemap.json` + `site/sitemap.json` are regenerated/updated to match.
- `site-toc`/`site-coverage`/`site-canon` gates (already components/src-scoped per the generator's
  own comment) and `site-nav.browser.test.ts`'s rail-entry-count gate stay green.

## Links
- `scripts/generate-sitemap.mjs:9-16` — `L1_TREE = 'packages/agent-ui/components/src/controls'`,
  hardcoded to ONE tree, with a comment explaining why `@agent-ui/router` is deliberately excluded
  (its 2 descriptors → 1 combined page is NOT a clean 1:1) — that reasoning does not hold for
  `ui-code-editor` (see Classification).
- `packages/agent-ui/code/src/editor/editor.md` — the full attributes-as-API descriptor, real
  `tag: ui-code-editor` frontmatter, same shape as every L1 component descriptor; note its own
  comment ("lives OUTSIDE @agent-ui/components, so it carries NO catalog row") is about A2UI
  catalog exposure (ADR-0139 cl.4), never about site-nav classification — not a documented
  exclusion from L1.
- `site/lib/site-manifest.json:79-85` — the hand-added L2 "Code Editor" ungrouped-Guides row
  (commit 618b43f), explicitly modeled on Router's row at `site-manifest.json:72-78`.
- `site/pages/_page.ts:544-575` (`buildNav`) — groups strictly by each sitemap entry's own
  `section` field; this code is correct, the INPUT data is wrong.
- `site/public/sitemap.json` — live data confirms the mismatch: Select/Textarea both carry
  `level: L1, section: Components, tag: ui-select|ui-textarea`; Code Editor carries
  `level: L2, section: Guides`, no `tag`, identical in shape to Router's entry (which has no tag
  and no attributes-as-API descriptor at all).
- Commit `618b43f` ("fix(site): ui-code-editor missing from docs nav/search") — the originating
  change; its own message states the Guides placement was deliberate, "matching Router's own
  posture," the precedent this ticket argues doesn't actually transfer.

## Repro
1. Run the docs site (`npm run dev`), open any page.
2. Look at the left nav rail: "Code Editor" sits under the **Guides** group (alongside Router,
   Theming, Forms, …), not under **Components** (alongside Textarea, Select, Checkbox, …).
3. Click it — the page rendered is titled "ui-code-editor — API" with Attributes/Properties
   tables, the exact shape of a Components page, not a Guides page.

## Expected vs actual
- **Expected:** `ui-code-editor` — a real tagged FACE control with a full attributes-as-API
  descriptor and a clean 1:1 doc page — sits in the Components nav group like every sibling
  control (Textarea, Select, Checkbox, …), with its tag (`ui-code-editor`) right-justified in the
  row per SPEC-R6's name|tag convention.
- **Actual:** it sits in the Guides group, ungrouped, no tag shown — the SAME nav posture as
  `@agent-ui/router`, a package with no tagged custom element and no attributes-as-API descriptor
  at all.

## Classification
Site nav / sitemap-generation (`scripts/generate-sitemap.mjs`'s L1 derivation), not a
`_page.ts`/`buildNav` rendering bug — the grouping code correctly follows whatever `section` each
sitemap entry carries; the entries themselves are wrong for this one page. Root cause: the
generator's `L1_TREE` constant predates `@agent-ui/code`'s existence and was hardcoded to the one
tree that existed with a clean descriptor↔page match at the time
(`packages/agent-ui/components/src/controls`); `@agent-ui/router`'s exclusion from that tree was
deliberate and well-reasoned (a genuine 2-descriptors→1-page mismatch), but `packages/agent-ui/
code/src/editor/` was never added to the derivation, and TKT-0090/618b43f's fix reached for
Router's exclusion as the nearest precedent without checking whether the SAME reasoning (the
1:1-page-match test) actually applies — it does not: `ui-code-editor` has exactly one descriptor
and exactly one page, same as every real L1 component.

## Severity
**minor** — no functional break; the page renders correctly and is reachable (nav link works,
content is correct). The defect is discoverability/consistency: a shipped `ui-*` control is
findable under the wrong nav category and command-palette group (`command-palette.ts:24` maps
`L2` to "Guides"), inconsistent with every sibling component.

## Findings

**2026-07-17 — root-caused and fixed, generalized rather than hand-patched.** The ticket's own
diagnosis was correct: `generate-sitemap.mjs`'s `L1_TREE` was a single hardcoded string
(`components/src/controls`), and 618b43f reached for router's own L2-exclusion precedent for
`ui-code-editor` without checking whether router's actual reasoning (a 2-descriptors→1-page
mismatch) applied — it didn't; `ui-code-editor` has exactly one descriptor and one real page.

- **The generalized fix:** `L1_TREE` (string) → `L1_TREES` (array), now walking both
  `components/src/controls` and `code/src`. Rather than hardcoding a second fixed exception,
  `generateL1` gained a REAL 1:1-page-existence gate: an entry is only emitted when its derived
  `./{slug}-doc.html` actually exists under `site/` (`existsSync`, not assumed). This was the
  deciding design choice — a naive "just widen the tree" fix would have ALSO pulled in
  `ui-markdown` (which has a real tagged descriptor, `code/src/markdown/markdown.md`, but ships
  NO doc page yet — a separate, already-known, explicitly out-of-scope gap) into L1 with a URL
  pointing at a page that doesn't exist, minting a brand-new dead link while fixing this one. The
  existence gate makes the fix generalize exactly as Acceptance asked: a future `@agent-ui/code`
  control is picked up automatically the moment it ships BOTH a descriptor and a real page, never
  before.
- `site/lib/site-manifest.json`'s hand-added L2 "Code Editor" row (618b43f) removed — the L1
  pipeline now derives it correctly, no duplicate.
- Router itself is unaffected: `packages/agent-ui/router/src/controls` was never added to
  `L1_TREES`, so it keeps resolving via its own L2 site-manifest.json row exactly as before.
- **Deliberately NOT touched:** `_page.ts`'s own `NAV` array (the SEPARATE page-header tab-strip,
  a different UI surface than the sitemap-driven left rail) — `ui-code-editor`'s existing ungrouped
  entry there has no outer `label:`, so it was already invisible to `site-toc.test.ts`'s own
  `FAMILY_ROOTS`-derived expectations (which don't include `code/src` and would have flagged a
  NEW `ui-code-editor` GROUP as unexpected/stale). Left as-is — out of this ticket's scope, which
  is the sitemap/left-rail classification only.
- **Verified:** `sitemap.json` now carries `ui-code-editor` as `level: L1, section: Components,
  tag: ui-code-editor`; `ui-markdown` correctly absent (no page). Full gate sweep: `npm run check`
  clean, jsdom 353 files / 6447 tests green (incl. `site-toc`/`sitemap.test.ts`/`site-coverage`/
  `site-canon`, all unmodified and still passing against the new derivation), cross-engine
  `site-nav.browser.test.ts` 14/14 green.

