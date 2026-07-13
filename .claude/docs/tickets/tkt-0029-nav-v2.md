---
doc-type: ticket
id: tkt-0029
status: done
date: 2026-07-12
owner:
kind: feature
size: big
---
# TKT-0029 — nav v2: sitemap-derived, grouped with context labels, name|tag two-column rows

## Summary
Kim's ask (2026-07-12): review the naming system the docs site's `<nav>` presents and plan a v2 —
(1) **groups with group context labels**, (2) **use of space**: at wide widths a component row
shows the proper name on the left and the tag on the right, justified apart
(`Swiper Label      ui-swiper-label`), (3) sourced **from `sitemap.json`** (the TKT-0018 derived
index). Confirmed at capture: today's nav is the opposite on all three — a HAND-MAINTAINED
`NAV` array in `site/pages/_page.ts` (~130 links; the sitemap derives FROM it plus descriptors),
per-component clusters labeled by bare TAG (`ui-button`) each holding page-type links
(Permutations/States/API), no name|tag layout, group labels are tags not context.

## Acceptance
- **Derivation inverts:** the nav renders from the derived index (`sitemap.json` — names, tags,
  levels/sections already there per TKT-0018), the hand array retiring to whatever residue
  genuinely can't derive (ordering/curation hints, if any — one owner). The site-toc/site-nav
  drift gates re-derive accordingly (a page added without an index entry stays red — the gate
  survives the inversion).
- **Groups with context labels:** section-level grouping (the sitemap's level/section axis —
  Components/Guides/A2UI/A2A/… with human context labels), replacing bare-tag group headers.
- **The wide two-column row:** proper name left, tag right (`Swiper Label      ui-swiper-label`),
  space-between; narrow widths degrade gracefully (the tag wraps under or truncates — the intake
  decides; never a broken two-line jumble). Family members render with their real names (the
  naming law's descriptor-derived proper names — the palette's L1 source reused).
- **The per-component page-type links get an explicit disposition** (today's Permutations/States/
  API sub-links): fold into the component's own page chrome, a secondary affordance (disclosure/
  flyout), or stay as sub-rows — the intake decides with the rail's scannability as the criterion.
- Active-state/context-label behavior (`activeGroup`, the page-header's context label) survives
  the restructure; the cross-engine nav smoke re-derives its expected counts from the new source.
- The full pipeline: design intake (the nav is the site's primary navigation — a layout/UX design
  pass with the docs-site owners as contract; forks to Kim if genuine) → build → review → commit.

## Links
- `site/pages/_page.ts:30-90` — the hand `NAV` array + `activeGroup`/`navItem` (the v1 being
  replaced) · `site/pages/_page.css` (the rail's current styling).
- `site/public/sitemap.json` + `scripts/generate-sitemap.mjs` (TKT-0018 — the derived source:
  56 L1 with proper names+tags+descriptions, 24 L2, per-record L3).
- `site-nav.browser.test.ts` / the site-toc/site-canon gates — the drift gates that re-derive.
- `references/naming.md` (the proper-name/tag grammar the two-column row surfaces) ·
  TKT-0018/TKT-0019 (the palette's L1 labels — the SEARCH surface went tag-first by Kim's ruling;
  the NAV is the BROWSE surface going name-first — deliberate, not a conflict).

## Scope / Open
- Group taxonomy: exactly the sitemap's sections, or a curated grouping above it (e.g. splitting
  Components by family class — form/overlay/layout/display)? The intake decides; the choosing-
  guide's taxonomy is prior art.
- Whether the L3 record corpora (Changelog entries, ADRs) surface in the nav at all or stay
  palette-only.
- The hand array's residue: pure derivation vs a small curation layer (ordering, pinned Home).
- **Non-goals:** the palette (shipped, tag-first by ruling); new pages; router adoption.

## Findings

### 2026-07-12 — design phase SUBSUMED by TKT-0030

Kim's same-day reconcile report (two screenshots: the settings rail vs this nav) rules that the
site nav and the settings rail are ONE nav-rail concept with three collapse modes — this ticket's
sitemap-derivation, context-group, and name|tag-row requirements become the MODE-1 CONSUMER's
requirements inside TKT-0030's unified family intake. One seat designs both; this ticket's build
lands as that family's site consumer.

### 2026-07-12 — TKT-0030's design intake landed this ticket's mode-1 consumer slice

`ADR-0130` (proposed) + `spec/nav-rail-family.spec.md` SPEC-R6/R10 + `lld/nav-rail-family.lld.md`
LLD-C11 name the concrete build for this ticket's three asks, as the **mode-1 consumer** of the
shared `ui-nav-rail collapse="menu"` family (not a bespoke rail): **derivation inverts** —
`site/pages/_page.ts`'s `buildNav()` constructs `<ui-nav-rail>`/`<ui-nav-rail-group>`/
`<ui-nav-rail-item>` from `sitemap.json`'s `L1`/`L2` entries grouped by their `section` field
(the sitemap's own taxonomy — no curated re-grouping at v1, this ticket's "exactly the sitemap's
sections" default), the hand `NAV` array retiring to whatever ordering residue genuinely cannot
derive; **context labels** render from each `ui-nav-rail-group`'s `label` (SPEC-R6); **the wide
name|tag row** is `ui-nav-rail-item`'s `slot="trailing" data-role="tag"` (realizing `anatomy.md`'s
previously-RESERVED `tag` role), narrow-degrading by truncation (ellipsis), never a wrapped
two-line jumble — the intake's call on this ticket's own open question. **Sub-links disposition
(Permutations/States/API):** confirmed to STAY on the existing page-header tab strip
(`buildTabs()`) — not folded into the rail, a non-goal (SPEC-R10 AC3). **The narrow collapse**
retires the page's own hand-rolled `<details>` mechanism into the component itself
(`collapse="menu"`, SPEC-R5) — `_page.css`'s `nav[data-site-nav]` block deletes; `site-nav.
browser.test.ts`'s expected-count assertion re-derives from `sitemap.json` instead of
`NAV.length` (SPEC-R10 AC1), so the drift gate survives the inversion as this ticket's acceptance
requires. Build dispatches as LLD-C11 (`n3b`, `decompositions/nav-rail-family.decomp.json`),
parallel-safe with the settings migration, gated on `ADR-0130`'s ratification and the family
(Phase 1) landing first.

### 2026-07-13 — shipped as the mode-1 consumer (TKT-0030 Phase 2)

All three asks landed via the family migration: sitemap-derived (the derivation inverted;
`NAV` retired to the tab-strip residue), context-labeled groups (the sitemap's `section` axis —
Components/Guides/Records; finer A2UI/A2A grouping = a manifest-curation follow-up), and the wide
name|tag two-column row (`data-role="tag"`, ellipsis-truncate narrow). See TKT-0030's Phase-2
Findings for the full delta + gates.
