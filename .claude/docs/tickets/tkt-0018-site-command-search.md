---
doc-type: ticket
id: tkt-0018
status: doing
date: 2026-07-11
owner:
kind: feature
size: big
---
# TKT-0018 — the docs site dogfoods ui-command-modal: sitemap.json search + leveled navigation

## Summary
Kim's ask (2026-07-11): the docs site should dogfood the just-shipped `ui-command-modal`
(TKT-0012, `3a3458f`) as its site-wide navigate-and-search surface — open with the palette's
ratified opt-in `hotkey` (ADR-0125 F2), search the site by **regex over page content
descriptions** (a frontmatter-extract-like blurb per page) bundled at build time into a
**`sitemap.json`** index, and jump to the chosen page. The results view has 2–3 levels:

- **Level 1 — component/package pages** (Components, A2UI, A2A, Router, Shells, …), with proper
  names in the option label: `Swiper Paddles (ui-swiper-paddles) {description ellipsis…}`.
- **Level 2 — framework docs** (Getting Started, Theming, Tokens, Gallery, …).
- **Level 3 — heavy record corpora loaded as SEPARATE files** (Changelog, Decision Records) —
  their indexes are not bundled into the primary sitemap payload; they load on demand.

## Acceptance
- A build-time-generated `sitemap.json` (derived, never hand-maintained — the llms.txt/nav drift-
  gate discipline): every site page carries a proper name, its tag/id where applicable, the URL,
  a one-line description (frontmatter-extract shape), and its level/section. A drift gate ties it
  to the real page set (a page added without a sitemap entry = red).
- The palette is reachable site-wide (every page, the shell/nav precedent) via the shipped
  `hotkey` opt-in; opening it costs nothing on pages where it stays closed (lazy import — the
  text-field→calendar precedent).
- Typing filters against name + tag + description with **regex** semantics (invalid regex must
  degrade gracefully — literal-substring fallback, never a throw); results render grouped by
  level using the control's shipped `[role=group]` + `[data-role=group-label]` model, L1 above
  L2 above L3.
- Selecting an option navigates to the page (MPA `location.href`; carry a hash/anchor when the
  match is a sub-entry, e.g. one ADR).
- Level 3 sources (CHANGELOG entries, ADR index) come from separate fetched files, loaded lazily
  (on palette open or on first keystroke — intake decides), never inflating the initial page
  weight; the size gate stays green.
- The integration IS the dogfood proof (the docs-site cardinal rule): the real shipped control,
  no site-only fork; anything the control cannot do surfaces as a component ticket, not a
  workaround (the ADR-0102 three-lane routing law).
- Tests: sitemap generation + drift gate; the regex filter incl. the invalid-regex fallback;
  grouped rendering; navigation; lazy L3 (jsdom + at least one cross-engine browser leg on the
  open→type→select arc).

## Links
- `packages/agent-ui/components/src/controls/command-modal/` — the shipped control: grouped
  options (`[role=group]`/group-label; `select` detail carries `group`), `data-keywords`,
  `hotkey` opt-in (ADR-0125 F2), `[slot=empty]`.
- `.claude/docs/tickets/tkt-0012-ui-command-modal.md` — the control's own ticket (shipped).
- `site/pages/_page.ts` (nav = the L1/L2 seed) · descriptors (`{name}.md` frontmatter = the
  component names/descriptions) · `site/lib/frontmatter.ts` (the extract precedent) ·
  `scripts/generate-llms-full.mjs` (the derived-index generation precedent).
- `.claude/docs/tickets/tkt-0001-adr-index-search-broken.md` — prior art on searching the ADR
  index (L3's Decision Records lane).
- ADR-0115 — the router stays catalog-invisible; this is MPA navigation, NOT a router adoption.

## Scope / Open
- **The filter seam (the load-bearing open):** the shipped palette filters author-declared
  options by substring over label+keywords. Regex-over-descriptions needs either (a) the
  consumer OWNING filtering — pre-filtering `sitemap.json` matches and re-rendering the option
  set per keystroke (are dynamically added/removed options after connect supported? the
  child-move happens at connect), or (b) a small control extension (a pluggable
  filter/`filter="regex"` prop or a controlled-results mode) — its own component ticket + ADR
  fork if so. The intake decides the lane; (a) is the no-control-change default IF post-connect
  option mutation works.
- **"2–3 levels" semantics:** captured as result GROUPS in one list (L1/L2/L3 sections), not a
  drill-in hierarchy — Kim's examples read as grouping tiers with different load strategies.
  Confirm at intake.
- **Description source of truth:** component pages have descriptor frontmatter; the seven
  conceptual guides + package pages need a description surface (page frontmatter? a nav-entry
  field?) — one owner, the drift gate enforces it.
- **L3 granularity:** whole-file entries (one "Changelog" option) vs per-record entries (each
  ADR its own option)? The `Swiper Paddles` example implies per-record for L1; per-ADR seems
  intended for Decision Records — sizes the lazy index.
- **Non-goals:** full-text page-body search (descriptions only); a search SERVICE (all static,
  build-time derived); router adoption.
- **Sequencing:** design intake next (site-feature intake — the docs-site + component owners as
  contract; the agent-ui-component-design skill only if lane (b) opens a control change); build
  after the frozen design; no build from this ticket directly.

## Findings

### 2026-07-11 — design intake complete (docs only; no code, no site edits)
Produced the frozen design set: [`site-command-search.spec.md`](../spec/site-command-search.spec.md),
[`site-command-search.lld.md`](../lld/site-command-search.lld.md),
[`site-command-search.decomp.json`](../decompositions/site-command-search.decomp.json), and one new `proposed`
ADR, [`0127-command-modal-regex-filter-mode.md`](../adr/0127-command-modal-regex-filter-mode.md) (extends
ADR-0125, never self-ratified).

**The load-bearing filter-seam open, settled from source (`command-modal.ts`):** it splits into two independent
findings, not one.
1. **Regex matching genuinely needs a control change.** `#filter()` (lines 214-234) is a private method, always
   wired to the search field's `input` listener at `connected()` (line 78), running a fixed `hay.includes(q)`
   substring test — no pluggable seam exists. Routed to **ADR-0127** (proposed): a closed, backward-compatible
   `filter: 'substring'|'regex'` enum prop, regex falling back to literal substring on an invalid pattern
   (never throws). This is the ONE genuine Kim-taste fork from this intake — awaiting ratification.
2. **Post-connect option mutation (needed for lazy L3) does NOT need a control change.** `#ensureParts()`
   (lines 107-137) child-moves `this.firstChild` into the list exactly once at connect, guarded against
   re-entry, with no `MutationObserver` and no public append seam — confirmed dead-end for in-place mutation.
   But the site never needs one: `site-command-search.lld.md` §4 resolves it with ordinary element teardown/
   recreate while the palette is closed (or deferred to the next `close` if resolved while open), relying on the
   already-shipped, already-tested hotkey reconnect-rearm guarantee (`command-modal.lld.md` SPEC-R10 AC2). No
   second ADR was opened for this half.

**Other opens, settled at this intake (no fork needed):**
- **"2-3 levels" semantics** — confirmed: result GROUPS in one flat list (L1 above L2 above L3), the control's
  own shipped `[role=group]` model — not a drill-in hierarchy.
- **Description source of truth** — L1: a new, purely additive optional `description:` descriptor scalar
  (`parseDescriptor`'s generic scalar map needs zero parser change), falling back to a derived first-sentence
  truncation when absent. L2 + the two L3 loader-stubs: a new single-owner `site/lib/site-manifest.json`. The
  drift gate (`sitemap.test.ts`) enforces both stay honest.
- **L3 granularity** — per-record for both corpora: one entry per ADR (`adr-index.json`, from the ADR README's
  own Index table) and one per changelog milestone (`changelog-index.json`), matching the ticket's own reading
  of the `Swiper Paddles` example. The primary `sitemap.json` carries only two cheap L3 loader-stub rows
  pointing at these separately fetched files.

**Doc review:** dispatched `scribe:doc-reviewer` against the SPEC and the LLD independently (fresh context,
generator ≠ critic) — verdicts recorded in the dispatching session's handoff; fixes (if any) applied before
this ticket moves to `done`.

**Next:** build dispatches from this frozen design — gated on ADR-0127's ratification for the filter half
(LLD-C7/C8/C13); the mount/grouping/navigation/lazy-L3 half (LLD-C1-C6, C9-C12) builds independently of it.

### 2026-07-11 — control half built (`ui-command-modal` gains `filter`, ADR-0127 / LLD-C13)

Built the ONE component slice this dispatch owns under the `component-builder` seat contract (one `ui-*`
component per dispatch, `@agent-ui/components` only) — the site half (LLD-C1-C12: the generator script,
`site/lib/site-manifest.json`, the drift gate, `command-palette.ts`, the two site-page anchor edits) is
**out of scope for this seat** and needs routing to whichever seat builds `site/` — reported here, not built,
per the "adjacent gaps reported in handoff, not fixed" rule.

**What shipped, against ADR-0127 + LLD-C1/C5 + SPEC-R2/R5:**
- `UICommandModalElement` gains `filter: 'substring'|'regex'` (`prop.enum`, default `'substring'`, not
  reflected — a behavior switch, not a styling hook).
- `#filter()` builds the `RegExp` ONCE per keystroke (not per option) when `filter==='regex'`; a `SyntaxError`
  from an invalid pattern is caught and the WHOLE keystroke falls back to the substring test — never throws,
  never surfaces an error (SPEC-R5 AC5 proof).
- `command-modal.md` gains the `filter` `attributes[]`/`properties` rows, a keyboard-map update, and a new
  "The filter mode (ADR-0127)" prose section.
- ADR-mandated doc amendments applied: `command-modal.spec.md` SPEC-R2 (REV note + filter's default-read
  clarification) and SPEC-R5 (REV note + new AC4/AC5) and the SPEC-R12 `attributes[]` mirror line;
  `command-modal.lld.md` LLD-C1/LLD-C5 table rows + a REV blockquote at the top-level freeze-discipline note.
- Tests (additive only — the shipped 52 jsdom cases untouched byte-for-byte): `command-modal.test.ts` gains 5
  new cases (LLD-C14) — filter defaults to `'substring'`, a valid regex narrows results, `data-keywords` fold
  into the regex haystack, an invalid pattern does not throw and falls back to literal substring, and the
  default substring mode is unaffected by regex-special characters. `command-modal-descriptor.test.ts`'s
  hardcoded `ATTR_NAMES` fixture updated to include `filter` (the trip-wire itself required this — an additive
  row, not a schema break, confirming ADR-0127's own "Blast radius: none" claim).

**Gates:** `npm run check` green (tsc + site + tools) · `npx vitest run packages/agent-ui/components`: 172
files / 3526 tests, all green · `command-modal` scoped run: 57/57 (was 52; +5) · browser suite scoped to
`command-modal` (both engines): 24/24 unaffected · `npm run size`: `command-modal` marginal 1083 B gz, within
the 2048 B per-control budget (no override needed); family total 42659 B gz within the 45056 B gz budget.

**Deviations from the dispatch:** none on the control half. The dispatch's "end-to-end" framing bundled the
site-feature build (LLD-C1-C12) into the same message; per this seat's contract that half was not built and is
flagged back to the coordinator for routing to a site-capable seat (no site file was touched — `site/`,
`scripts/generate-sitemap.mjs` remain untouched; `tokens.css`/`theme-provider-built.css` untouched per the
standing constraint).

### 2026-07-11 — review fix round (NO-GO → fixed): lowercase-before-compile corrupted case-sensitive escapes

`component-reviewer` returned NO-GO on the control slice above: one blocking defect, one citation nit.

- **Blocking (fixed):** `#filter()` lowercased the query text BEFORE compiling the regex
  (`new RegExp(text.trim().toLowerCase(), 'i')`). Lowercasing corrupts case-sensitive regex metacharacters —
  `\D`→`\d`, `\S`→`\s`, `\W`→`\w`, `\B`→`\b` — a materially different match, not merely a case change (e.g.
  typing `\D` over `["v2","beta"]` wrongly returned only `v2`, since the corrupted `\d` matches digits). Fixed
  by compiling from the trimmed RAW text (`const raw = text.trim(); const q = raw.toLowerCase()`) — substring
  mode still uses `q`; regex mode compiles `new RegExp(raw, 'i')`, relying on the `'i'` flag alone for
  case-insensitivity (SPEC-R5 AC4). Added a regression case (`command-modal.test.ts`, "does NOT lowercase the
  pattern text") using `\D` over `["v2","beta"]`, proving both now match. Verified the test actually catches the
  regression (reintroduced the bug locally, confirmed the new test fails, restored the fix, confirmed 58/58 green).
- **Nit (fixed):** the never-throw fallback was cited as "SPEC-R7 AC2" in three places (`command-modal.ts:37`,
  `command-modal.ts` `#filter()` comment, `command-modal.lld.md`'s REV note) — that resolves to the CONTROL's
  own SPEC-R7 (the live-region requirement), not the never-throw contract, which is the control's own SPEC-R5
  AC5. Re-cited all three to SPEC-R5 AC5.

**Gates after the fix, all green:** `npm run check` (tsc + site + tools) · `npx vitest run
packages/agent-ui/components`: 172 files / 3527 tests (was 3526; +1 for the regression case) ·
`command-modal` scoped: 58/58 jsdom (was 57; +1) · browser suite scoped to `command-modal` (both engines):
24/24 unaffected · `npm run size`: `command-modal` marginal 1088 B gz (was 1083 B; +5 B for the fix), still
well within the 2048 B per-control budget.

### 2026-07-11 — site half built (LLD-C1…C12: the generator, the manifest, the drift gate, the palette mount, the two lazy L3 indexes)

Built the site half the control-half dispatch flagged back (`site/`, `scripts/generate-sitemap.mjs`) against the
frozen `site-command-search.spec.md`/`.lld.md`. `packages/agent-ui/**` was never touched (consumed the shipped
`filter="regex"` prop as-is); `tokens.css`/`theme-provider-built.css` untouched.

**What shipped, against SPEC-R1…R11 / LLD-C1…C12:**
- `scripts/generate-sitemap.mjs` (+ `scripts/slug.mjs`, the shared kebab-slug the id-producer and id-consumer
  both import) — `generateSitemap()` (56 L1 descriptor entries + 24 L2 + 2 L3-stub manifest rows),
  `generateAdrIndex()` (126 ADR README Index rows), `generateChangelogIndex()` (23 CHANGELOG.md milestones),
  `deriveFallbackDescription()` (SPEC-R2's first-sentence-of-body fallback, markup-stripped, 160-char capped),
  `titleCaseFromTag()`. Written outputs: `site/public/{sitemap,adr-index,changelog-index}.json`.
- `site/lib/site-manifest.json` — the 24 L2 rows (7 conceptual guides incl. Changelog + 17 ungrouped
  package/app-tier/A2UI/A2A/meta pages) + 2 L3 loader-stub rows (Changelog, Decision Records).
- `site/lib/sitemap.test.ts` — the drift gate (byte-identity ×3 generated files + anti-vacuous + negative
  controls) plus a pure-helper unit suite (description fallback, slug, title-case). 20 tests.
- `site/lib/command-palette.ts` — the mount module: renders the merged L1/L2/L3-stub options grouped by level
  (`[role=group]`/`[data-role=group-label]`), creates `<ui-command-modal hotkey="mod+k" filter="regex">`, wires
  `select` → `location.href`, and merges the two lazily-fetched L3 indexes in — closed-swap-now or
  deferred-to-next-`close`, re-deriving the merge against LIVE state at apply time (not a stale snapshot) so two
  corpora resolving while open can't clobber each other.
- `site/pages/_page.ts` — `mountPage`/`mountFullBleedPage` each gain one `mountCommandPaletteOnce()` call (a
  lazy `import()`, `.catch`-guarded so a fetch failure — jsdom, offline, 404 — never surfaces as an unhandled
  rejection off page mount).
- `site/pages/adr-index.ts` / `changelog.ts` — per-card/per-section stable ids (`adr-{number}` / `slug(heading)`)
  + an on-load hash handler (scroll-into-view, `<details open>` for ADR cards).
- Tests: `site/lib/command-palette.test.ts` (jsdom, 5 cases incl. the real `location.href` mutation via
  `vi.stubGlobal('location', …)`) + `site/lib/command-palette.browser.test.ts` (both engines: real `mod+k`
  open, real regex narrowing + Enter-select, the invalid-pattern substring fallback, group order).

**Deviations named (all judgment calls the frozen design left open or got slightly wrong in the details):**
1. **L1 derives from ONE tree, not both.** The LLD said "reuse CONTROL_TREES (the same two trees
   generate-llms-full.mjs walks)" — components + router. Verified against the real site: all 56
   `components/src/controls` descriptors have a real 1:1 `{name}-doc.html` page, but the router package's two
   descriptors (`ui-router-outlet`/`ui-router-link`) do NOT — the site ships one combined `router-doc.html`,
   never per-component pages for them. Scoped L1 to `components/src/controls` only, to avoid minting two dead
   links; `router-doc.html` is still fully searchable as one of the L2 manifest rows (matching `_page.ts`'s own
   existing ungrouped-link posture for it).
2. **The description-fallback boundary is a paragraph, not every `\n`.** The LLD's literal wording ("cut at the
   first '. ' or the first newline, whichever is sooner") mis-fires on this repo's own prose convention
   (soft-wrapped single newlines mid-paragraph, verified against `command-modal.md` and a real CHANGELOG.md
   entry) — a literal every-`\n` cut severed real sentences mid-clause. Fixed to treat a single `\n` as an
   unwrapped soft-wrap and only a blank line as a real paragraph boundary.
3. **ADR hash fragments carry the `adr-` prefix (`#adr-0125`), not the bare number SPEC-R4 AC2's example shows
   (`#0125`).** The LLD's own §6 on-load snippet does `getElementById(location.hash.slice(1))` with zero
   translation — that only resolves if the fragment and the DOM id are the same string. Made them match (both
   `adr-0125`) rather than leaving a mismatch between two clauses of the same frozen design; also sidesteps an
   all-numeric CSS id.
4. **`sitemap.json`/`adr-index.json`/`changelog-index.json` are fetched, not statically imported**, despite LLD
   §5's "read the already-bundled sitemap.json" phrasing. A static import from `site/public/` is exactly what
   Vite's own docs warn against (publicDir contents are copied/served as-is, not meant to be pulled through the
   module graph). Fetching all three uniformly avoids that risk and still satisfies SPEC-R11 (their bytes ride
   as fetched data, never inlined into the measured JS bundle).
5. **The ADR README Index-table row regex needed two fix-ups past the LLD's literal description**: several
   Status cells carry trailing annotation prose (`accepted *(amended by 0014: …)*`) rather than a bare keyword,
   and one row's Status is itself `**bold**`-wrapped (`**superseded by ADR-0038**`) — the regex now anchors on
   one of the 4 known status keywords (optionally `**`-wrapped) rather than a generic `\w+`, verified against
   all 126 real rows.
6. **ADR L3 descriptions are truncated to 160 chars**, matching L1's own ceiling — the README's own Title column
   is often a multi-hundred-character summary paragraph, not literally "one line"; SPEC-R4 doesn't name a cap
   explicitly but "a one-line summary" implied one, and an untruncated title would defeat the palette's own
   readability.
7. **Settings (`./settings.html`) was added to `site-manifest.json`** even though SPEC-R3's own enumerated list
   doesn't name it (it shipped the same day as this design intake, likely just missed) — a low-risk addition
   (one more searchable row), not an omission of anything the SPEC named.
8. **One pre-existing, unrelated drift was found and fixed in passing:** `site/public/llms-full.txt` was stale
   against the control-half's `command-modal.md` edit (the new `filter` prop's descriptor rows + prose section)
   — regenerated via `node scripts/generate-llms-full.mjs` so `npm test` stays green; not a site-command-search
   change, just a blocking prerequisite this dispatch's own gates surfaced.
9. **The cross-engine browser test cannot observe the real `location.href` mutation** — a real MPA
   `location.href = …` assignment (unlike `history.pushState`) actually navigates the test's own iframe away,
   crashing the session (measured: "Cannot connect to the iframe…"); `beforeunload.preventDefault()` doesn't
   block it (that gate only guards user-initiated navigation, and Playwright's synthetic key events count as
   one); `vi.stubGlobal('location', …)` — jsdom's own safe technique — throws in real engines (`window.location`
   is spec-`[Unforgeable]`, non-configurable). The browser test instead installs a capturing `document`-level
   `select` listener that `stopImmediatePropagation()`s before the palette's own at-target handler runs,
   asserting the intercepted `detail.value` equals the real target. The jsdom test (`command-palette.test.ts`)
   covers the actual `location.href` mutation, where jsdom's inert Location makes `vi.stubGlobal` safe.
10. **A real correctness bug was found and fixed during the build itself** (not shipped): the first draft's L3
    merge captured a stale `entries` snapshot per corpus at fetch-resolve time, so two L3 fetches resolving
    while the palette was open would have the SECOND deferred swap silently discard the FIRST corpus's already-
    merged records. Fixed by re-deriving the merge against live module state at apply time (`applyMerge`),
    traced through by hand before it was ever exercised by a real dual-fetch race in a test.

**Gates:** `npm run check` (tsc + site + tools) green · `npx vitest run` (full jsdom): 320 files / 5617 tests
green (incl. `sitemap.test.ts` 20 + `command-palette.test.ts` 5, both new) · `npx vitest run --config
vitest.browser.config.ts site/lib/command-palette.test.ts site/lib/command-palette.browser.test.ts`: both
engines green · `npm run size`: package gate unaffected (0 changes under `packages/**`) · a manual `npm run
build` measured the palette mount stub's real marginal: `command-palette.js` lands as its OWN split chunk,
1.60 KB min / **0.78 KB gz** — the three generated JSON files ride as plain static data at the dist root
(`/sitemap.json`, `/adr-index.json`, `/changelog-index.json`), never inlined into any JS chunk the size gate
measures.

**A known-unrelated flake surfaced while running the full `test:browser` suite** (not caused by this work,
confirmed by removing every new file and re-running: the SAME failures persisted) — `component-preview-
fleet.browser.test.ts`'s WebKit leg loses structural children on `ui-swiper-pagination`/`ui-swiper-paddles` and
its STRUCTURAL tag-coverage set omits `ui-status-stream`/`ui-swiper-item`/`ui-timeline`; the full-suite run also
hit a separate, unrelated resource-exhaustion crash in this environment. Both are pre-existing and out of this
ticket's scope — reported here, not fixed, per the "adjacent gaps reported in handoff, not fixed" rule. A
second, ALSO-fixed-in-passing regression this dispatch DID cause and correct before finalizing: an early draft's
module-level `vi.stubGlobal('fetch', …)` in `command-palette.browser.test.ts` had no matching `afterEach`
unstub, and leaked into vitest-browser's own orchestrator protocol (itself `fetch`-based), cascading failures
across ~17 unrelated files sharing the same worker. Fixed by scoping the stub inside the test with a proper
`afterEach(() => vi.unstubAllGlobals())` — the fix is in the file as shipped; re-verified the full `site`
browser project no longer shows this cascade with the fix in place.

**Next:** TKT-0018 is now build-complete on both halves (control: `filter` prop, ADR-0127; site: LLD-C1…C12).
Ticket ready to move toward `done` pending Kim's own smoke of the real palette (`npm run dev`, `mod+k` on any
page) and a final coordinator sign-off; no further build work is anticipated from this ticket.

### 2026-07-11 — review fold-in round (GO with two fold-ins): the anchor example needed a real reorder, not just a reordered `data-keywords`

`code-reviewer` returned GO on the site half above, with two fold-ins before commit.

- **MEDIUM (fixed) — SPEC-R10 AC3 untested.** Added a jsdom test (`command-palette.test.ts`) exercising the
  DEFERRED-merge branch with BOTH corpora resolving while the palette is open: mounts, opens the REAL nested
  `ui-modal` (`current.open = true` + the sanctioned jsdom `<dialog>` stub, copied verbatim from
  `command-modal.test.ts`, since this is the first site-side test to actually open the real control), resolves
  both L3 fetches via manually-controlled promises while open, asserts NO premature swap (both stubs still
  present, no real records yet), then closes via a REAL platform dismissal (`simulatePlatformClose(dialog)` —
  not a hand-fabricated `close` event on the outer element, which would bypass command-modal.ts's own
  `modal 'close' -> this.open=false; this.emit('close')` relay entirely) and asserts BOTH corpora land merged,
  neither clobbering the other — the exact re-entrancy property `applyMerge`'s own doc comment claims.
- **LOW (fixed, and the mechanism was wrong as suggested) — the anchored-regex example didn't work.** The
  reviewer suggested "lead `data-keywords` with the raw tag"; that was ALREADY true in the shipped code and is
  insufficient — verified mathematically before touching anything: command-modal.ts's own haystack is
  `#labelText(opt) + ' ' + data-keywords` with labelText ALWAYS first, so an anchored `^` pattern can only ever
  match position 0 of the WHOLE string and can never reach into `data-keywords` no matter what leads there. The
  real fix: `buildOption` now renders `{tag} ({name}) — {description}` for L1 entries — the TAG leads, the
  Title-Case name follows in parens (was `{name} ({tag}) — {description}`, matching the ticket's own literal
  `Swiper Paddles (ui-swiper-paddles)` example). This is a genuine, deliberate reorder off that example, not a
  cosmetic tweak — surfaced explicitly here rather than silently changed, since SPEC-R1 AC2 cites the OLD order
  and SPEC-R7 AC1 (the one the reviewer named) needs the NEW one; the two cannot both hold literally at once
  given the control's fixed concatenation order, and no aria-hidden/visual-order-mismatch trick avoids this
  (traced through and rejected — see `buildOption`'s own doc comment in `command-palette.ts`). Added the
  reviewer's own named assertion to the browser test (`^ui-swiper` narrows to exactly the 3-member swiper
  family — `ui-swiper`/`ui-swiper-item`/`ui-swiper-paddles` — excluding `ui-button`), plus updated the jsdom
  render assertion for the new order. **Flagged for Kim:** if the exact `Name (tag)` display order is load-
  bearing for some other reason, this needs a ruling; otherwise `tag (Name)` stands as shipped.

Recorded, no action taken (per the reviewer's own note): the 30/56 truncated L1 descriptions (backlog item —
authoring `description:` scalars for the worst offenders) and the Changelog L2+L3 double-listing (contract-
faithful, a SPEC observation for Kim, not a defect).

**Gates after both fold-ins, all green:** `npm run check` (tsc + site + tools) · `npx vitest run site/lib`: 18
files / 247 tests (was 246; +1 for the SPEC-R10 AC3 case) · `npx vitest run` (full jsdom): 320 files / 5618
tests · `npx vitest run --config vitest.browser.config.ts site/lib/command-palette.test.ts
site/lib/command-palette.browser.test.ts`: both Chromium and WebKit green.
