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
