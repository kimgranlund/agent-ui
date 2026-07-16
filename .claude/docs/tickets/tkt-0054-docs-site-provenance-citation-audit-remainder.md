---
doc-type: ticket
id: tkt-0054
status: open
date: 2026-07-15
owner:
kind: bug
---
# TKT-0054 — docs-site provenance-citation audit: the remainder beyond TKT-0053's exemplar + confirmed batch

## Summary
Follow-up to [TKT-0053](./tkt-0053-docs-site-provenance-citations-in-descriptive-prose.md), which
extended `docs-author`'s standard with the provenance-vs-normative citation split + the page-end
Changelog table, then fixed the two files it found to be **confirmed** violations
(`site/pages/agent-admin.ts`, the reported exemplar, and `site/pages/app-shell.ts`, found during the
audit). This ticket enumerates what TKT-0053 did **not** finish: files whose ADR/TKT mentions were
never individually read (screened only by a mechanical heuristic), plus specific citations TKT-0053
classified as normative but flagged as close enough to the line to deserve a second, fresh read.

TKT-0053's audit method, for context: `grep -lE "TKT-[0-9]{4}|ADR-[0-9]{4}" site/pages/*.ts` hit 116
non-test files. A comment-stripping + trailing-comment filter (documented below) narrowed that to 51
files whose ADR/TKT mentions plausibly land in rendered prose rather than code comments; all 51 were
read in context and classified normative (rule-owner citation, legitimate, no action) or provenance
(build receipt, needs fixing). Only `agent-admin.ts` and `app-shell.ts` came back provenance. The
other 65 files were screened out by the heuristic (their hits are in `//` comments) and spot-checked
(5 files: `button-doc.ts`, `checkbox-doc.ts`, `text-field-doc.ts`, `tabs-doc.ts`, `modal-doc.ts` — all
confirmed comment-only) but **not individually read end to end**.

## Acceptance
- Every file in the "not yet individually audited" list below gets a real read (not a repeat of the
  mechanical filter) and a normative/provenance classification; any provenance citation found gets
  fixed per TKT-0053's standard (`.claude/skills/docs-author/references/best-practices.md`'s
  `## Provenance vs. normative citations` section).
- Every citation in the "borderline — re-classify" list gets a fresh read against the standard's test
  (delete the parenthetical; what's lost?) — TKT-0053's own call may stand or flip; record the
  reasoning either way.
- `npm run check && npm test` green for anything actually changed.

## Repro
No fixed repro — an audit-completeness gap, not a runtime bug.

## Expected vs actual
- **Expected:** every ADR/TKT mention across `site/pages/*.ts` has been individually classified
  normative or provenance, with reasoning recorded, and every provenance citation moved to a
  page-end Changelog.
- **Actual:** 65 of 116 candidate files were only mechanically screened (comment-filter), not read;
  4 specific citations were read and called normative but are close enough to the line to warrant a
  second opinion.

## Classification
Axis: structural/content (documentation IA), same as TKT-0053. Plane: `site/pages/*.ts`, the 69 files
below (65 unaudited + 4 files carrying a borderline citation — `icon-doc.ts`, `segmented-control-doc.ts`,
`swiper-doc.ts`, `textarea-doc.ts`).

## Severity
**cosmetic** — same rationale as TKT-0053: a readability/IA defect, not a functional break.

## Links
- [TKT-0053](./tkt-0053-docs-site-provenance-citations-in-descriptive-prose.md) — the standard + the
  exemplar/confirmed-batch fix this ticket continues.
- `.claude/skills/docs-author/references/best-practices.md` — the provenance-vs-normative test + the
  Changelog table spec to apply.
- `site/lib/doc-page.ts`'s `renderChangelogTable`/`ChangelogEntry` — the shared implementation to reuse
  (added by TKT-0053).

## The mechanical filter (reproduce before re-auditing)

```sh
# 1. every candidate file
grep -lE "TKT-[0-9]{4}|ADR-[0-9]{4}" site/pages/*.ts | grep -v '\.test\.ts$'

# 2. strip full-line comments / jsdoc continuations (awk, per-line)
awk -F: '{
  rest=$0; sub(/^[^:]*:[^:]*:/, "", rest); gsub(/^[ \t]+/, "", rest)
  if (rest ~ /^\/\//) next; if (rest ~ /^\*/) next; if (rest ~ /^\/\*/) next
  print
}' <hits-with-line-numbers>

# 3. drop import lines and lines whose ADR/TKT id sits only in a trailing // comment
```

This heuristic has **not** been proven complete — it is a fast narrowing pass, not a certification
that the 65 screened-out files are clean. Re-verify by reading, not by re-running the filter.

## Not yet individually audited (65 files — mechanical filter only, 5 spot-checked clean)

`site/pages/`: `_page.ts` · `a2a-artifact-feed.ts` · `a2a-concepts.ts` · `a2a-tic-tac-toe.ts` ·
`a2ui-catalog.ts` · `a2ui-chat.ts` · `a2ui-gallery.ts` · `a2ui-list.ts` · `a2ui-live.ts` ·
`adr-index.ts` · `button-doc.ts`\* · `calendar-doc.ts` · `card-doc.ts` · `changelog.ts` ·
`checkbox-doc.ts`\* · `color-picker-demo.ts` · `color-picker-doc.ts` · `column-doc.ts` ·
`combo-box-demo.ts` · `combo-box-doc.ts` · `command-modal-demo.ts` · `command-modal-doc.ts` ·
`disclosure-demo.ts` · `field-demo.ts` · `form-provider-demo.ts` · `form-provider-doc.ts` ·
`gallery.ts` · `grid-doc.ts` · `layout-permutations.ts` · `list-doc.ts` · `menu-demo.ts` ·
`menu-doc.ts` · `modal-demo.ts` · `modal-doc.ts`\* · `popover-doc.ts` · `radio-group-demo.ts` ·
`radio-group-doc.ts` · `router-doc.ts` · `row-doc.ts` · `segmented-control-demo.ts` ·
`select-demo.ts` · `select-doc.ts` · `sizing.ts` · `slider-multi-doc.ts` · `status-stream-demo.ts` ·
`swiper-demo.ts` · `swiper-item-doc.ts` · `swiper-label-doc.ts` · `swiper-paddles-demo.ts` ·
`swiper-paddles-doc.ts` · `swiper-pagination-demo.ts` · `swiper-pagination-doc.ts` · `tabs-demo.ts` ·
`tabs-doc.ts`\* · `text-doc.ts` · `text-field-doc.ts`\* · `theme-provider-demo.ts` ·
`theme-provider-doc.ts` · `theming.ts` · `timeline-demo.ts` · `toast-demo.ts` · `toolbar-demo.ts` ·
`toolbar-doc.ts` · `tooltip-demo.ts` · `tooltip-doc.ts`

(\* = one of the 5 spot-checked-clean files above — still worth a full read, since the spot-check only
sampled the file's grep hits, not its entire prose.)

## Borderline — re-classify with a fresh read (TKT-0053 called these normative; a reasonable second
reader might not)

- **`site/pages/icon-doc.ts`** intro: `"The Display-class icon primitive — the declarative consumer
  surface over the @agent-ui/icons adapter (ADR-0065/0066)."` — TKT-0053's reasoning: cites the
  adapter architecture's owner (normative). Counter-read: ADR-0065/0066 is cited **only** on this one
  page (in prose — 4 more raw hits elsewhere are all comments), the same single-page signature as
  agent-admin's confirmed violation.
- **`site/pages/segmented-control-doc.ts`** intro: `"The standalone joined-button single-select
  control (ADR-0095, superseding ADR-0086's ui-radio-group[variant=\"segmented\"])"` — TKT-0053's
  reasoning: a migration note (a current API fact), normative. Counter-read: could equally be read as
  "here's the ticket that replaced the old variant" — provenance dressed as a migration note.
- **`site/pages/swiper-doc.ts`** intro: `"A CSS-native scroll-snap carousel (ADR-0124) — the fleet's
  first scroll-snap surface."` — TKT-0053's reasoning: cites a mechanism/architecture claim,
  normative. Counter-read: "the fleet's first X (ADR-####)" is structurally the "here's the ticket
  that built this" shape, just with an ADR instead of a TKT.
- **`site/pages/textarea-doc.ts`** intro: `"The fleet's first FACE multi-line text primitive
  (ADR-0134) — a sibling of ui-text-field, not one of its modes."` — same shape/counter-read as
  `swiper-doc.ts` above. (The REST of ADR-0134's citations across `textarea-states.ts`/
  `textarea-permutations.ts` — e.g. "press Enter and it inserts a newline instead of committing" —
  are NOT borderline: they state the actual behavioral rule inline and are confidently normative.
  Only this one intro-clause citation is in question.)

## Findings
