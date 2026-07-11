# SPEC — the docs site's `sitemap.json` search palette (TKT-0018)

> Status: proposed · v0.1 · 2026-07-11 · Layer: SPEC (execution contract)
> Refines: TKT-0018 (`../tickets/tkt-0018-site-command-search.md`) under Kim's leveled-results ask, dogfooding
> the shipped `ui-command-modal` (TKT-0012 · [ADR-0125](../adr/0125-ui-command-modal-composition-and-catalog-exclusion.md))
> as the site's navigate-and-search palette.
>
> **No owning PRD** — a site feature scoped entirely by its own ticket (the `ui-toolbar`/`ui-command-modal` SPEC
> precedent for a single ticket-scoped surface with no family PRD).
> Refined by: [`../lld/site-command-search.lld.md`](../lld/site-command-search.lld.md). Build plan:
> [`../decompositions/site-command-search.decomp.json`](../decompositions/site-command-search.decomp.json)
> (plan mode — no source exists yet).
> Altitude: owns **what the palette surface does** — the `sitemap.json` schema and its derivation rule, the
> drift gate, the leveled grouping, the filter semantics (contingent on [ADR-0127](../adr/0127-command-modal-regex-filter-mode.md)),
> navigation, and lazy L3 loading. Implementation (the generator script, the mount-point wiring, per-file build
> slices) is the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the docs site's site-wide navigate-and-search surface: a build-time-derived `sitemap.json` (component/
package pages, framework guides, and pointers into two separately-loaded heavy corpora) searched through the
**real, shipped `ui-command-modal`** — no site-only fork of the palette, and no rendered-correctness concern
solved by inventing site-side filtering logic the control could otherwise own (ADR-0102 lane discipline). Typing
narrows results by regex (falling back to literal substring on an invalid pattern) over each entry's name, tag,
and description; results render grouped by level (L1 above L2 above L3); choosing a result navigates via MPA
`location.href` (carrying a hash anchor for a sub-record match). The palette is reachable on every page via the
control's own ratified opt-in `hotkey` (ADR-0125 F2), at zero cost while closed.

## 2. Definitions

- **Sitemap entry** — one row of `sitemap.json`: `{ name, tag?, url, description, level, section }` (§3.1). `tag`
  is present only for L1 component/package entries.
- **Level** — `L1` (component/package pages), `L2` (framework guide pages), `L3` (a pointer into a separately
  fetched, per-record index — Changelog, Decision Records). Levels are **result GROUPS in one flat list**, not a
  drill-in hierarchy (TKT-0018 Scope/Open, confirmed at this intake: Kim's examples read as grouping tiers with
  different load strategies, not navigable folders).
- **L3 index file** — a separate JSON file (`adr-index.json`, `changelog-index.json`) carrying one entry **per
  record** (one per ADR, one per changelog milestone) — never bundled into `sitemap.json` itself, fetched lazily.
- **Description source of truth** — for an L1 entry, the component's own `{name}.md` descriptor's new optional
  `description` scalar (SPEC-R2, §3.1), falling back to a derived truncation of its prose body when absent. For
  an L2 entry (no descriptor — TS-authored guide pages), a new single-owner data file, `site/lib/
  site-manifest.json` (SPEC-R3, §3.1). Exactly one owner per level; the drift gate (§3.2) enforces both stay
  honest.
- **Regex-mode filter** — [ADR-0127](../adr/0127-command-modal-regex-filter-mode.md)'s proposed
  `ui-command-modal[filter=regex]`: a case-insensitive `RegExp` test over the option's item label + `data-
  keywords`, falling back to the existing substring test on an invalid pattern, never throwing.

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 Sitemap schema + derivation

**SPEC-R1 — `sitemap.json` schema.** The build MUST produce `site/public/sitemap.json`, a JSON object
`{ entries: SitemapEntry[] }`, `SitemapEntry = { name: string, tag?: string, url: string, description: string,
level: 'L1'|'L2'|'L3', section: string }`. L1 entries MUST carry `tag`; L2/L3 entries MUST NOT. `url` is
sibling-relative (`./{page}.html[#anchor]`), matching the fleet's existing `NavLink` convention
(`site/pages/_page.ts`). `section` is the display group heading (e.g. `'Components'`, `'Guides'`, `'Records'`).
- **AC1** *Given* a fresh generation, *then* every entry validates against the shape above; every L1 entry's
  `tag` matches `ui-[a-z-]+`; no L2/L3 entry carries a `tag` key at all (not even `undefined`/`''`).
- **AC2** *Given* an L1 entry, *then* `name` is the Title Case component name derived from its tag (e.g.
  `ui-swiper-paddles` → `"Swiper Paddles"`), matching Kim's own example format
  (`Swiper Paddles (ui-swiper-paddles) {description ellipsis…}`) when name+tag+description are concatenated for
  display.

**SPEC-R2 — L1 derivation: the descriptor is the source, `description` is a new optional scalar.** L1 entries
MUST derive from the SAME descriptor glob `scripts/generate-llms-full.mjs` already walks (`CONTROL_TREES`:
`packages/agent-ui/components/src/controls`, `packages/agent-ui/router/src/controls`), reading each `{name}.md`'s
existing `tag`/`tier` frontmatter scalars. Each descriptor MAY declare a new, purely additive top-level
`description` scalar (a one-line blurb); `parseDescriptor`'s generic scalar map (`component-descriptor.ts:166-
179`) already captures any top-level key with zero parser changes, and no existing validator rejects an unknown
key (`component-descriptor.ts:253` only checks REQUIRED fields are *present*, never that extra ones are absent)
— this is additive by construction, not a schema break. When `description` is absent, the generator MUST derive
a fallback: the first sentence of the descriptor's prose body (the text after the closing `---` fence), truncated
to 160 characters with a trailing `…` if cut. `url` is derived by the fleet's own filename convention
(`{name}-doc.html` — cited in `_page.ts`'s NAV comment; `{name}-demo.html` is never the target, `-doc.html` is
the descriptor-derived page).
- **AC1** *Given* a descriptor with an authored `description:`, *then* the sitemap entry uses it verbatim
  (trimmed).
- **AC2** *Given* a descriptor with none, *then* the fallback derivation runs and never exceeds 160 characters;
  a truncated string ends in `…`; a description that already fits is not truncated or suffixed.
- **AC3** *Given* the fallback derivation over a real prose body (e.g. `command-modal.md`'s), *then* the result
  is non-empty and does not include the leading Markdown emphasis markup verbatim (a plain-text extraction, not
  a raw substring with `**`/backtick characters left in — the drift gate's anti-vacuous check, SPEC-R5(d) §3.2,
  asserts this on at least one real descriptor).

**SPEC-R3 — L2 derivation: `site/lib/site-manifest.json` is the single owner.** A new, zero-side-effect JSON
file `site/lib/site-manifest.json` MUST be the sole authored source for L2 entries (the seven conceptual guides
— Getting Started, Theming, Tokens, Sizing & density, Forms, Which component when, Changelog — plus the
ungrouped package/app-tier guide pages: App Shell, Master Detail, Router, A2UI Canvas and siblings, the A2A
pages, Gallery) and for the two L3 loader-stub entries (SPEC-R4, below): `{ href, label, description, level, section,
index? }[]`, mirroring `_page.ts`'s existing `NavLink` shape plus the two new fields. It MUST be hand-maintained
(no descriptor exists for a TS-authored guide page to derive from) and MUST be the ONLY place an L2/L3-stub
description is authored — never duplicated into a page's own source.
- **AC1** *Given* `site-manifest.json`, *then* every entry's `href` matches a real file under `site/pages/*.html`
  minus the `index.html` chrome allowlist (the `llms.test.ts` UNINDEXED precedent).
- **AC2** *Given* the sitemap generator, *then* every L2/L3-stub sitemap entry's `name`/`url`/`description`
  traces to exactly one `site-manifest.json` row — no second, competing description surface exists (grep: no
  other file declares a `description` field for a guide page).

**SPEC-R4 — L3 loader stubs in the primary sitemap; per-record entries in separate index files.** The primary
`sitemap.json` MUST carry exactly two `level: 'L3'` entries (`"Changelog"`, `"Decision Records"`) — cheap
pointers to their own pages, each also naming its lazy index file (`SitemapEntry.index?: string`, e.g.
`"./changelog-index.json"` / `"./adr-index.json"`) — never the per-record content itself. The per-record content
MUST live in two separately generated, separately fetched files: `site/public/adr-index.json` (one entry per
ADR, derived from `.claude/docs/adr/README.md`'s Index table — number, title, status, a one-line summary) and
`site/public/changelog-index.json` (one entry per `## ` milestone heading in `CHANGELOG.md` — heading text + the
first sentence of its body as the description). Per-record granularity settles TKT-0018's own "L3 granularity"
open exactly as its Scope/Open section already reads the `Swiper Paddles` example: per-component (i.e.
per-record) for L1, and per-ADR for Decision Records — the changelog gets the same per-milestone treatment for
consistency, since it is the fleet's other L3 corpus.
- **AC1** *Given* `sitemap.json`, *then* it contains exactly 2 `level: 'L3'` rows, each with a non-empty
  `index` field pointing at a real, separately generated file.
- **AC2** *Given* `adr-index.json`, *then* its entry count equals the ADR README's Index table row count; each
  entry's `url` is `./adr-index.html#{number}` (a hash anchor into that record's card, SPEC-R9 AC2, §3.4).
- **AC3** *Given* `changelog-index.json`, *then* its entry count equals `CHANGELOG.md`'s `## ` heading count;
  each entry's `url` is `./changelog.html#{slug}` where `{slug}` is a deterministic kebab-case slug of the
  heading text.

### 3.2 Drift gate

**SPEC-R5 — the sitemap cannot drift from the real page/descriptor set.** A standing test (`site/lib/
sitemap.test.ts`, the `llms.test.ts` G1/G2 precedent) MUST assert: (a) `sitemap.json` is byte-identical to a
fresh `generateSitemap()` run (same generator function the build script writes with — no generator/gate drift
pair); (b) every real site page (`site/*.html`, minus the `index.html`/chrome allowlist) that is either a
descriptor-derived `{name}-doc.html` OR listed in `site-manifest.json` resolves to at least one `sitemap.json`
entry — a page landing without a sitemap entry (a new component's `-doc.html`, or a new guide page not added to
`site-manifest.json`) fails this gate; (c) `adr-index.json`/`changelog-index.json` are each byte-identical to a
fresh generation from their sources; (d) **anti-vacuous** — the fresh generation is real output, not a
degenerate pass: `entries.length` exceeds the descriptor count alone (L2/L3-stub rows are genuinely present
too), and at least one real descriptor's derived-fallback description (SPEC-R2 AC2) contains no raw `**`/
backtick Markdown-emphasis characters (the `generate-llms-full.mjs` `>50_000`-byte-floor precedent, applied to
this generator).
- **AC1** *Given* the committed `sitemap.json`/`adr-index.json`/`changelog-index.json`, *then* all three match a
  fresh generation byte-for-byte; a negative control (appending one character to the committed file) fails.
- **AC2** *Given* a synthetic page list with one page absent from both the descriptor glob and
  `site-manifest.json`, *then* the coverage check flags exactly that page (the `unindexedPages` pure-function
  negative-control shape `llms.test.ts` already uses).
- **AC3** *Given* a fresh generation, *then* the (d) anti-vacuous checks both pass — a silently-empty or
  markup-leaking generator is caught here, not shipped.

### 3.3 Palette integration — the real control, dogfood-only

**SPEC-R6 — mount point + hotkey, zero cost while closed.** Every `/site` page MUST mount one
`<ui-command-modal hotkey="mod+k">` instance via `site/pages/_page.ts`'s shared shell (the same "every page gets
it" precedent as the nav rail/context header) — a lazy `import()` inside the mount call, so a page that never
opens the palette pays no bundle cost beyond the tiny mount stub (the `text-field type=date` → `ui-calendar`
lazy-import precedent). The palette's authored children are the merged L1+L2 entries (§3.1), rendered as
`[role=option]` items grouped under `[role=group]` sections in level order (L1, then L2, then the two L3 loader-
stub options) — the control's OWN shipped grouping model (command-modal.md `contentModel`), never a bespoke
site-side list.
- **AC1** *Given* any `/site` page, *then* pressing the `mod+k` chord opens the palette (SPEC-R10 of
  `command-modal.spec.md`, unmodified) with the full merged option set already rendered.
- **AC2** *Given* a page where the palette is never opened, *then* no `ui-command-modal` behavior module
  executes beyond the lazy-import stub (a bundle-analysis assertion, the LLD's size-gate leg).

**SPEC-R7 — the filter is regex, with a literal-substring fallback; contingent on ADR-0127.** Typing in the
palette MUST filter entries by a case-insensitive regex test over each entry's `name` + `tag` (when present) +
`description`, packed into the option's `data-keywords` attribute at render time (the control's existing filter
haystack, unchanged — `command-modal.ts` `#labelText()` + `data-keywords`). The regex MUST degrade gracefully on
an invalid pattern: the SAME query that would throw as a `RegExp` instead matches by literal substring for that
keystroke, never surfacing an error to the user. **This requirement stands only if
[ADR-0127](../adr/0127-command-modal-regex-filter-mode.md) is ratified as recommended** (`ui-command-modal`
gains `filter="regex"`); if Kim rules against it, SPEC-R7 collapses to the control's existing substring-only
behavior and TKT-0018's "regex" acceptance line is re-scoped to substring-only in a follow-up ticket edit — a
scoped change, not a silent contradiction (the SPEC-R10/F2 contingency convention `command-modal.spec.md`
already uses).
- **AC1** *Given* `<ui-command-modal filter="regex">` mounted per SPEC-R6, *then* a valid regex query (e.g.
  `^ui-swiper`) narrows results to matching entries only.
- **AC2** *Given* an invalid pattern (e.g. an unbalanced `(`), *then* the palette does not throw, does not go
  blank, and falls back to matching that literal string as a substring.

### 3.4 Leveled grouping + navigation

**SPEC-R8 — grouped rendering, L1 above L2 above L3.** Results MUST render in three `[role=group]` sections in
DOM order — L1 ("Components"), L2 ("Guides"), L3 ("Records") — using the control's own shipped group-hide
behavior (an empty group's heading disappears, SPEC-R5 of `command-modal.spec.md`, unmodified). Within a group,
entries appear in the order the sitemap generator emits them (alphabetical by tag for L1 — the
`generate-llms-full.mjs` precedent — and manifest order for L2).
- **AC1** *Given* an unfiltered palette open, *then* the three group headings appear in L1→L2→L3 order and each
  is followed only by that level's entries.
- **AC2** *Given* a query matching only L2 entries, *then* the L1 and L3 group headings are hidden (the
  control's existing group-hide, unmodified).

**SPEC-R9 — selection navigates via MPA `location.href`.** Choosing an L1/L2 entry MUST navigate
`location.href = entry.url` (a full page load — `ADR-0115`'s router stays catalog-invisible; this is explicitly
NOT a router adoption). Choosing an L3 loader-stub entry (before its index has loaded) MUST navigate to that
corpus's own page (`./changelog.html` / `./adr-index.html`) with no hash. Choosing a resolved L3 per-record
entry (after lazy load, §3.5) MUST navigate with that record's hash anchor (`#{number}` / `#{slug}`), and the
target page MUST scroll to and (for an ADR card) expand the matching element on load.
- **AC1** *Given* a `select` event from the palette, *then* the consumer's handler sets `location.href` to the
  chosen entry's `url` — no `@agent-ui/router` import anywhere in the site's palette wiring (the ADR-0125 F4
  no-router-import law, inherited unmodified).
- **AC2** *Given* navigation to `./adr-index.html#0125`, *then* that ADR's card is scrolled into view and
  expanded (`<details open>`) on load.

### 3.5 Lazy L3 loading

**SPEC-R10 — L3 index files load lazily and never inflate initial page weight; no control mutation required.**
`adr-index.json`/`changelog-index.json` MUST be fetched via `fetch()` at module init on every page (background,
off the critical rendering path — network bytes, never bundled JS/HTML), independent of whether the palette is
ever opened. The site MUST merge a resolved L3 index into the palette's rendered option set ONLY by replacing
the whole `<ui-command-modal>` element (remove + recreate with the merged L1+L2+L3 children, same `hotkey`
attribute) — relying on the control's documented, already-tested reconnect behavior (`command-modal.lld.md`
SPEC-R10 AC2: the hotkey listener is removed on disconnect and re-armed on reconnect) — and MUST perform this
replacement **only while the palette is closed**. If an L3 fetch resolves while the palette is open, the merge
MUST defer to the next `close` event (listened for on the current instance) rather than tearing down an open
dialog. No `ui-command-modal` source change is required for this requirement (settled from source, §2 of the
LLD) — this is the resolved half of TKT-0018's load-bearing open; only the filter (§3.3/SPEC-R7) needs a control
change.
- **AC1** *Given* page load, *then* the two L3 `fetch()` calls start without blocking first paint or the
  palette's own mount, and the initial JS/HTML weight (measured by `npm run size`) is unaffected by their
  payload size.
- **AC2** *Given* an L3 fetch resolving while the palette is closed, *then* the element is replaced and the next
  open shows the merged, complete option set (L1+L2+L3).
- **AC3** *Given* an L3 fetch resolving while the palette is OPEN, *then* the current session shows only
  L1+L2 (a graceful degrade, not a crash or a mid-session teardown), and the merge happens on the palette's next
  `close`.

### 3.6 Non-interference

**SPEC-R11 — size-gate neutrality.** `npm run size`'s standing budget MUST stay green: the palette's mount
stub adds a bounded, measured marginal to every page (the lazy-import precedent keeps the palette's own behavior
module out of the initial bundle); `sitemap.json`/`site-manifest.json` are fetched/imported as data, not
inlined into a JS bundle that the size gate measures as code.
- **AC1** *Given* `npm run size` run by hand (ADR-0040 §3), *then* the measured marginal for the palette mount
  stub is recorded and, if material, pinned — the same discipline every other lazy-imported overlay follows.

## 4. Non-goals (explicit fences)

- **Full-text page-BODY search** — descriptions only (name/tag/description), never a page's full rendered
  content; a future full-text index is an explicitly separate, additive trigger.
- **A search SERVICE** — everything is static, build-time derived; no runtime index server, no network search
  API beyond fetching the two lazy L3 JSON files.
- **Router adoption** — MPA `location.href` navigation only (ADR-0115); `@agent-ui/router` is never imported by
  this feature.
- **A drill-in / hierarchical results view** — levels are flat result GROUPS in one list, not a folder-style
  navigable tree (§2 Level, settled at this intake).
- **Fuzzy/typo-tolerant matching** — regex or literal substring only (ADR-0125 F7's fenced non-goal, unmodified
  by ADR-0127); no ranked
  fuzzy score.
- **A live/continuous option-mutation seam on `ui-command-modal`** — the L3 lazy-load problem is solved by
  element teardown/recreate (SPEC-R10), not a control change; explicitly NOT proposed by ADR-0127.

## 5. Examples

**A leveled result set, unfiltered (illustrative shape).**

```json
{
  "entries": [
    { "name": "Swiper Paddles", "tag": "ui-swiper-paddles", "url": "./swiper-paddles-doc.html", "description": "A coordinator-filled prev/next anchor for ui-swiper.", "level": "L1", "section": "Components" },
    { "name": "Command Modal", "tag": "ui-command-modal", "url": "./command-modal-doc.html", "description": "The CMD-K command palette, nesting ui-modal.", "level": "L1", "section": "Components" },
    { "name": "Getting Started", "url": "./getting-started.html", "description": "The first page a newcomer reads.", "level": "L2", "section": "Guides" },
    { "name": "Changelog", "url": "./changelog.html", "description": "Milestones, newest-first.", "level": "L3", "section": "Records", "index": "./changelog-index.json" },
    { "name": "Decision Records", "url": "./adr-index.html", "description": "Every ratified ADR, searchable.", "level": "L3", "section": "Records", "index": "./adr-index.json" }
  ]
}
```

**A regex query with an invalid pattern (fallback proof).**

```
query: "ui-swiper("     // an unbalanced group — new RegExp(...) throws SyntaxError
behavior: falls back to a literal substring test for "ui-swiper(" — matches nothing (no entry contains the
          literal string), but the palette does NOT throw, does NOT clear the list to an error state.
```

## 6. Trace

| Requirement | ADR | Decomp node(s) |
|---|---|---|
| SPEC-R1 | — | n3 |
| SPEC-R2 | — | n4, n5 |
| SPEC-R3 | — | n6 |
| SPEC-R4 | — | n7, n8 |
| SPEC-R5 | — | n9 |
| SPEC-R6 | ADR-0125 (unmodified) | n10 |
| SPEC-R7 | ADR-0127 (contingent) | n11 |
| SPEC-R8 | ADR-0125 (unmodified) | n12 |
| SPEC-R9 | ADR-0115 | n13, n14 |
| SPEC-R10 | — | n15 |
| SPEC-R11 | ADR-0040 | n16 |
