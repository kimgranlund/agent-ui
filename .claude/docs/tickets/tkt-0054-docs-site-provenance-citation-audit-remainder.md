---
doc-type: ticket
id: tkt-0054
status: done
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

### 2026-07-16 — full sweep complete

**Method.** Every one of the 65 "not yet individually audited" files was opened and read in full (not
re-grepped) — every `//` comment AND every rendered-prose string (`intro`/`pageLead`/paragraph text) was
inspected for an ADR/TKT id. For the 7 largest/most complex files (`_page.ts`, `a2a-artifact-feed.ts`,
`a2a-concepts.ts`, `a2a-tic-tac-toe.ts`, `a2ui-catalog.ts`, `a2ui-chat.ts`, `a2ui-list.ts`, `a2ui-live.ts`)
the read was cross-checked with a script that isolates every line carrying an ADR/TKT id and classifies it
as comment-only / trailing-comment-only / other, to make sure nothing in a multi-hundred-line file was
missed by eye.

**Result — all 65 files: NORMATIVE / no action (every ADR/TKT hit is `//`-comment-only or a trailing
comment on an import/attribute line; zero citations appear in rendered prose).** The mechanical filter's
narrowing turned out to be complete for this batch, though it was correctly *not* trusted going in — this
sweep is the actual verification, not a re-run of the filter.

| File | Verdict |
|---|---|
| `_page.ts` | comment-only (nav config + `//` build notes; NAV link labels themselves carry no ids) |
| `a2a-artifact-feed.ts` | comment-only + 2 trailing-comment lines (`TKT-0004` on `revealScroll(...)` calls) |
| `a2a-concepts.ts` | comment-only |
| `a2a-tic-tac-toe.ts` | comment-only |
| `a2ui-catalog.ts` | comment-only |
| `a2ui-chat.ts` | comment-only (page uses `mountFullBleedPage`, no `intro`/`pageLead` prose at all) |
| `a2ui-gallery.ts` | comment-only |
| `a2ui-list.ts` | comment-only |
| `a2ui-live.ts` | comment-only |
| `adr-index.ts` | comment-only |
| `button-doc.ts`\* | comment-only (spot-check confirmed) |
| `calendar-doc.ts` | comment-only |
| `card-doc.ts` | comment-only |
| `changelog.ts` | comment-only |
| `checkbox-doc.ts`\* | comment-only (spot-check confirmed) |
| `color-picker-demo.ts` | comment-only |
| `color-picker-doc.ts` | comment-only |
| `column-doc.ts` | comment-only |
| `combo-box-demo.ts` | comment-only |
| `combo-box-doc.ts` | comment-only |
| `command-modal-demo.ts` | comment-only |
| `command-modal-doc.ts` | comment-only |
| `disclosure-demo.ts` | comment-only |
| `field-demo.ts` | comment-only |
| `form-provider-demo.ts` | comment-only |
| `form-provider-doc.ts` | comment-only |
| `gallery.ts` | comment-only |
| `grid-doc.ts` | comment-only |
| `layout-permutations.ts` | comment-only |
| `list-doc.ts` | comment-only |
| `menu-demo.ts` | comment-only |
| `menu-doc.ts` | comment-only |
| `modal-demo.ts` | comment-only |
| `modal-doc.ts`\* | comment-only (spot-check confirmed) |
| `popover-doc.ts` | comment-only |
| `radio-group-demo.ts` | comment-only |
| `radio-group-doc.ts` | comment-only |
| `router-doc.ts` | comment-only |
| `row-doc.ts` | comment-only |
| `segmented-control-demo.ts` | comment-only (`ADR-0095 clause 1` is a trailing `//` continuation, not prose) |
| `select-demo.ts` | comment-only |
| `select-doc.ts` | comment-only |
| `sizing.ts` | comment-only |
| `slider-multi-doc.ts` | comment-only |
| `status-stream-demo.ts` | comment-only |
| `swiper-demo.ts` | comment-only (header comment only; `ADR-0124` never reaches prose) |
| `swiper-item-doc.ts` | comment-only |
| `swiper-label-doc.ts` | comment-only |
| `swiper-paddles-demo.ts` | comment-only |
| `swiper-paddles-doc.ts` | comment-only |
| `swiper-pagination-demo.ts` | comment-only |
| `swiper-pagination-doc.ts` | comment-only |
| `tabs-demo.ts` | comment-only |
| `tabs-doc.ts`\* | comment-only (spot-check confirmed) |
| `text-doc.ts` | comment-only |
| `text-field-doc.ts`\* | comment-only (spot-check confirmed) |
| `theme-provider-demo.ts` | comment-only |
| `theme-provider-doc.ts` | comment-only |
| `theming.ts` | comment-only |
| `timeline-demo.ts` | comment-only |
| `toast-demo.ts` | comment-only |
| `toolbar-demo.ts` | comment-only |
| `toolbar-doc.ts` | comment-only |
| `tooltip-demo.ts` | comment-only |
| `tooltip-doc.ts` | comment-only |

No edits were made to any of the 65 files — none needed one.

**Borderline re-classification (4 files) — 1 stands, 3 flip to provenance and are fixed.**

- **`site/pages/icon-doc.ts` → NORMATIVE, stands (no edit).** Verified against the source ADR
  (`.claude/docs/adr/0065-icon-adapter-swappable-pack-architecture.md`): `ADR-0065`/`ADR-0066` are the
  authority behind the swappable-pack **adapter architecture** itself — a reusable mechanism genuinely
  consumed across `@agent-ui/icons/{types,registry,resolve,phosphor/index}.ts` and every icon-emitting
  control, not a one-off "which ticket built this page" receipt. Deleting the parenthetical loses the
  reader's pointer to *how* the swap mechanism works (real, un-restated design detail) — rule 1 of the
  standard's test (`best-practices.md` "Provenance vs. normative citations" §4's "authority behind a
  reusable mechanism" exception) calls this normative even though it is cited on only this one page.
- **`site/pages/segmented-control-doc.ts` → FLIPPED to provenance. Fixed.** `ADR-0095` (+ its superseded
  predecessor `ADR-0086`) is cited in the page's own opening intro, before any rule content, and the full
  factual content of the citation (the retired `ui-radio-group[variant="segmented"]` spelling) is already
  stated inline — nothing about *how the control works* is gated behind the ADR. This is the "which record
  built/changed this surface" shape (matching the confirmed `agent-admin.ts`/`app-shell.ts` violations),
  not the reusable-mechanism-authority shape. Edit: intro no longer names `ADR-0095`/`ADR-0086` (keeps the
  migration fact in prose); a new page-end `## Changelog` cites both (`ADR-0086` 2026-07-06, `ADR-0095`
  2026-07-07 — both dates read from each ADR's own frontmatter table).
- **`site/pages/swiper-doc.ts` → FLIPPED to provenance. Fixed.** `"the fleet's first scroll-snap surface
  (ADR-0124)"` is a build-announcement, not a rule citation — verified against
  `.claude/docs/adr/0124-swiper-family-scroll-snap-loop.md`: the ADR is swiper's own origin story (F1–F8
  fork resolutions specific to *this* family), not an authority other pages/mechanisms depend on (nothing
  else in the fleet uses scroll-snap). Deleting the parenthetical loses nothing the sentence needs. Edit:
  intro drops `(ADR-0124)`; new `## Changelog` cites `ADR-0124` (2026-07-10, from its own frontmatter Date).
- **`site/pages/textarea-doc.ts` → FLIPPED to provenance. Fixed.** Same shape as `swiper-doc.ts`: `"The
  fleet's first FACE multi-line text primitive (ADR-0134) — a sibling of ui-text-field, not one of its
  modes"` is `ui-textarea`'s own build/scope announcement (verified against
  `.claude/docs/adr/0134-multiline-textarea-face-editor.md`), cited nowhere else in site prose. Edit: intro
  drops `(ADR-0134)`; new `## Changelog` cites `ADR-0134` (2026-07-14, from its own frontmatter Date). (The
  ticket's own note stands: the *other* `ADR-0134` citations on `textarea-states.ts`/
  `textarea-permutations.ts` — inline behavioural rules like the Enter-inserts-a-newline fact — were never
  in scope here and remain untouched/normative.)

**Files edited (3), all via the `renderChangelogTable`/`ChangelogEntry` shared implementation
(`site/lib/doc-page.ts`), matching the `agent-admin.ts`/`app-shell.ts` precedent shape exactly:**

- `site/pages/segmented-control-doc.ts` — intro de-cited; `## Changelog` added (`ADR-0086`, `ADR-0095`).
- `site/pages/swiper-doc.ts` — intro de-cited; `## Changelog` added (`ADR-0124`).
- `site/pages/textarea-doc.ts` — intro de-cited; `## Changelog` added (`ADR-0134`).

No new drift gate was added in this pass — the Changelog table itself is already the drift-proof surface
(`renderChangelogTable` returns `undefined`/no section for an empty list, and its dates/ids are read from
each ADR's own frontmatter at authoring time, not invented); the existing `doc-page.test.ts` coverage for
`renderChangelogTable` (added under TKT-0053) already exercises the shared renderer these 3 pages now call.
No page-level test changes were needed or made.

**Gate results.**

- `npm run check` (`tsc` (packages) `&& check:site` `&& check:tools`) — **green**, no errors.
- `npm test` (Vitest) — **6299 passed, 1 failed** (`site/lib/sitemap.test.ts` > "the committed file matches
  the generator byte-for-byte"). Verified via `git stash` (stashing only the 3 files this ticket touched,
  and separately stashing everything) that this failure is **pre-existing and unrelated to this ticket's
  edits**: it is caused by a concurrent, uncommitted, out-of-scope change already sitting in the working
  tree before this session started (a new untracked `.claude/docs/adr/0138-a2ui-producer-persona-seam.md` +
  a modified `.claude/docs/adr/README.md`, both belonging to TKT-0076/TKT-0072 work, not TKT-0054) — the
  generated `adr-index.json` sitemap hasn't been regenerated to include the new `ADR-0138` row yet. With
  only this ticket's 3 files reverted, the same test still fails identically; with everything reverted
  (including the other agent's uncommitted ADR work), it passes. `site/pages` tests in isolation: **58/58
  passed**. This ticket does not touch ADR content or the sitemap generator and is not implicated in the
  red result — flagging it here rather than fixing it, since it's outside TKT-0054's plane and belongs to
  whoever owns the TKT-0076/ADR-0138 intake.

**Soft-drift note for the reviewer (not a citation defect, informational only).** The file-header `//`
comments on `swiper-doc.ts`, `segmented-control-doc.ts`, and `textarea-doc.ts` still name their own ADR
(`ADR-0124`/`ADR-0095`/`ADR-0134`) — left untouched deliberately: the standard's citation rule governs
*rendered prose*, not authorship comments, and every sibling page in each family (`swiper-item-doc.ts`,
`swiper-paddles-doc.ts`, etc.) carries the same header-comment convention.
