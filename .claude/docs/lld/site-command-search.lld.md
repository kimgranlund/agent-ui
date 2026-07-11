# LLD — the docs site's `sitemap.json` search palette (TKT-0018)

> Refines: [`../spec/site-command-search.spec.md`](../spec/site-command-search.spec.md) (SPEC-R1…R11) under
> [ADR-0125](../adr/0125-ui-command-modal-composition-and-catalog-exclusion.md) (accepted, unmodified) and
> [ADR-0127](../adr/0127-command-modal-regex-filter-mode.md) (proposed — the filter-mode extension, SPEC-R7's
> contingency). Build plan: [`../decompositions/site-command-search.decomp.json`](../decompositions/site-command-search.decomp.json)
> (plan mode). · proposed · 2026-07-11 · designer (site-feature intake)
>
> **Composes on:** the shipped `ui-command-modal` (unmodified except the ADR-0127 `filter` prop, a build-team
> slice against the CONTROL, not this site feature) + `site/pages/_page.ts`'s shared shell (the mount point) +
> the `generate-llms-full.mjs` derived-index precedent (the generator shape + the `llms.test.ts` drift-gate
> shape) + `site/lib/frontmatter.ts`'s canonical descriptor parser (L1 derivation). **No new package, no router
> adoption, no site-side reimplementation of the palette's filter/grouping/a11y — the control does that.**
>
> **Freeze discipline.** §2's build-slice table is the fan-out contract. A builder who finds the filter-seam
> ruling (§4) unworkable STOPS and escalates — it is a coordinated LLD/ADR repair, never a local site-side
> workaround (ADR-0102's routing law).

## 1 · Intent

Ship a build-time-derived `sitemap.json` (+ two lazy L3 index files) and mount the real, shipped
`ui-command-modal` on every `/site` page as the site-wide navigate-and-search palette — L1 (component/package
pages) and L2 (framework guides) rendered as authored options at mount time; L3 (Changelog, Decision Records)
starting as two cheap loader-stub options, upgraded in place once their per-record indexes resolve in the
background. Typing filters by regex (falling back to substring on an invalid pattern, ADR-0127); results group
by level; choosing one navigates via `location.href`. Nothing here forks the control — every behavior TKT-0018
asks for is either already shipped (grouping, hotkey, selection) or lands as the ONE minimal, ADR-127-gated
control extension (the filter mode).

## 2 · Components (build slices)

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | `generateSitemap(repoRoot)` — walks the descriptor glob (L1) + `site-manifest.json` (L2 + L3 stubs), emits `sitemap.json`'s `{entries}` shape; pure, deterministic, byte-stable (the `generateLlmsFull` precedent) | `scripts/generate-sitemap.mjs` | SPEC-R1, R2, R3, R4 |
| LLD-C2 | descriptor `description` derivation — read an authored `description:` scalar if present, else the first-sentence-of-body fallback (plain-text, Markdown-emphasis-stripped, ≤160 chars, `…`-suffixed on truncation) | `scripts/generate-sitemap.mjs` (a pure helper, unit-testable in isolation) | SPEC-R2 |
| LLD-C3 | `site/lib/site-manifest.json` — the hand-authored L2 + L3-stub manifest (`{href,label,description,level,section,index?}[]`), one row per guide/package page + the two L3 stubs | `site/lib/site-manifest.json` | SPEC-R3, R4 |
| LLD-C4 | `generateAdrIndex()` / `generateChangelogIndex()` — parse `.claude/docs/adr/README.md`'s Index table / `CHANGELOG.md`'s `## ` headings into per-record JSON, reusing `site/lib/adr.ts` (`parseAdr`) and `site/pages/changelog.ts`'s `parseChangelog` shape rather than a third parser | `scripts/generate-sitemap.mjs` (two more pure helpers) | SPEC-R4 |
| LLD-C5 | `sitemap.test.ts` — the drift gate: byte-identity (sitemap + both L3 index files) + page-coverage (`unindexedPages`-shaped negative control, the `llms.test.ts` G1/G2 precedent) | `site/lib/sitemap.test.ts` | SPEC-R5 |
| LLD-C6 | the palette mount — `_page.ts`'s `mountPage`/`mountFullBleedPage` gain one shared call, lazy-`import()`ing a new `site/lib/command-palette.ts` module that creates `<ui-command-modal hotkey="mod+k">`, renders the merged L1+L2+(L3 stubs) options as `[role=option]`/`[role=group]` children, and appends it once per page | `site/pages/_page.ts`, NEW `site/lib/command-palette.ts` | SPEC-R6 |
| LLD-C7 | the `data-keywords` pack — each rendered option's `data-keywords` carries `tag + ' ' + description` (name is already the visible label the control's own filter reads), so the shipped haystack (item label + `data-keywords`) covers name+tag+description with zero control change | `site/lib/command-palette.ts` | SPEC-R7 |
| LLD-C8 | wire `filter="regex"` onto the mounted `<ui-command-modal>` — a single attribute, gated on ADR-0127 shipping; if ADR-0127 is not ratified, this line is simply omitted (the control's substring default) | `site/lib/command-palette.ts` | SPEC-R7 |
| LLD-C9 | `select` handler — `location.href = detail.value` (the entry's `url`, stashed as the option's `value` attribute at render) | `site/lib/command-palette.ts` | SPEC-R9 |
| LLD-C10 | L3 lazy fetch + closed-only element replace — `fetch('./adr-index.json')`/`fetch('./changelog-index.json')` at module init; on resolve, if the palette is closed, tear down + recreate `<ui-command-modal>` with the merged full option set; if open, defer the rebuild to the instance's own `close` event | `site/lib/command-palette.ts` | SPEC-R10 |
| LLD-C11 | ADR card / changelog entry anchors — `adr-index.ts` gains `details.id = `adr-${record.number}``; `changelog.ts` gains `section.id = slug(entry.heading)`; both pages gain a tiny on-load hash handler (scroll-into-view +, for an ADR card, `details.open = true`) | `site/pages/adr-index.ts`, `site/pages/changelog.ts` | SPEC-R9 AC2 |
| LLD-C12 | size measurement — `npm run size` run by hand around the palette mount stub's marginal (the lazy-import precedent); pinned if material | `size` config / manual run | SPEC-R11 |
| LLD-C13 | **[build-team, gated on ADR-0127]** `ui-command-modal` gains the `filter` prop + the mode-dependent `#filter()` test — NOT this site feature's own slice; tracked here only as a hard dependency of LLD-C8 | `packages/agent-ui/components/src/controls/command-modal/{command-modal.ts,command-modal.md}` | ADR-0127 |

## 3 · The sitemap generator (LLD-C1/C2/C4) — mechanics

`scripts/generate-sitemap.mjs` follows `generate-llms-full.mjs`'s exact shape: pure `fs`-based (no bundler, no
TS execution — Node reads real files and regexes/JSON-parses them), a `generateSitemap(repoRoot)` export the
drift gate imports directly (no generator/gate drift pair), deterministic ordering (alphabetical by tag for L1,
manifest order for L2/L3-stubs), written only when run as a CLI (`node scripts/generate-sitemap.mjs`).

- **L1** — reuse `CONTROL_TREES` (the same two trees `generate-llms-full.mjs` walks) and `splitFence`/`tagOf`
  precedents to read each `{name}.md`'s frontmatter fence; extend the fence read to also capture an optional
  `description:` line (a one-line regex, the `tagOf()` shape: `/^description:\s*(.+)$/m`). When absent, take the
  body's first sentence (split at the first `. ` or the first newline, whichever is sooner, after stripping
  `**`/`` ` `` /`_` emphasis markers with a small regex pass), truncate to 160 chars with `…`. `url` = the
  fleet's own `{name}-doc.html` convention (cited in `_page.ts`'s NAV comment: "the coverage gate…derives the
  required set from it").
- **L2 + L3 stubs** — `JSON.parse(readFileSync('site/lib/site-manifest.json'))`, mapped through unchanged (it is
  already `SitemapEntry`-shaped minus `tag`).
- **L3 index files** — `generateAdrIndex()` parses `.claude/docs/adr/README.md`'s Index table rows (`| [NNNN]
  (...) | Title | Status | Repairs |`) via the same row-splitting regex the README's own table already commits
  to (one row per ADR, numbers zero-padded); `generateChangelogIndex()` reuses `changelog.ts`'s own
  `parseChangelog` **split logic** (duplicated as a small pure function here, since the Node script cannot
  import a Vite-transformed TS module — the same constraint `generate-llms-full.mjs`'s own comment names for
  why it re-derives from raw text rather than executing site code) to get one entry per `## ` heading, slugified
  (kebab-case, matching LLD-C11's anchor ids exactly — the SAME slug function used in both places, extracted to
  a tiny shared pure helper so the id-producer and the id-consumer cannot drift apart).

## 4 · The filter-seam ruling (the load-bearing open, resolved)

**Source-verified conclusion:** `command-modal.ts`'s `#ensureParts()` (~110-137, the child-move portion of a
method that continues to ~165 building the status/empty/modal parts) child-moves `this.
firstChild` into the internal list **exactly once**, guarded against re-entry by the `#modal && #search && #list`
early return (line 111) — there is no `MutationObserver`, and the list itself (`#list`) is a private field with
no public append seam. `#filter()` (lines 214-234) is a private method always wired to the search field's own
`input` listener at `connected()` (line 78) — a fixed `hay.includes(q)` substring test, not pluggable from
outside. Both facts are cited directly against the shipped source, not inferred.

This resolves into **two independent findings**, not one:

1. **The matching algorithm (regex) genuinely needs a control change.** No consumer-side technique can safely
   override a private, always-wired listener without either duplicating SPEC-R5/R7/R8's group-hide/status/
   empty-state logic (a "controlled mode" — rejected as broader than needed, ADR-0127 Alternatives) or reaching
   around the listener via registration-order tricks (a genuine site-fork, ADR-0102 lane violation). **Routed to
   ADR-0127** (proposed, Kim's ruling wanted): a closed `filter: 'substring'|'regex'` enum prop, backward
   compatible, additive.
2. **The option-mutation gap (needed for L3 lazy load) does NOT need a control change.** Because the one-shot
   child-move only runs at `connected()`, the site does not fight it — it simply **never asks an already-
   connected instance to accept new children**. Instead: keep ONE `<ui-command-modal>` per page, created once at
   module init with L1+L2+L3-stubs as its initial children (cheap — no network wait, all local/bundled data).
   When an L3 fetch resolves, if the instance is CLOSED, the site removes it and creates a fresh instance (same
   `hotkey` attribute) with the merged L1+L2+L3(resolved) children — an ordinary `element.remove()` +
   `document.body.append(freshElement)`, touching no privates. The fresh instance's `connected()` runs its own
   `#ensureParts()` from scratch (by design — a brand-new custom element always does), and its hotkey listener
   re-arms per the ALREADY-DOCUMENTED SPEC-R10 AC2 guarantee ("the listener rides the connection AbortSignal…
   re-armed on reconnect") — so the "first mod+k after L3 resolves" experience is seamless. If the fetch
   resolves while the instance is OPEN, the swap is deferred: a one-shot `listen(instance, 'close', () => {…
   perform the swap …})` fires the replace the moment the user closes it, rather than yanking an open dialog out
   from under them. This is genuinely zero-control-change — every operation used (element removal, element
   creation, `hotkey` re-arm) is already a documented, tested contract.

**Net:** ONE ADR (ADR-0127, filter mode only), not two. The ticket's own framing ("(b) a small control extension
… its own component ticket + ADR fork if so") is honored for the filter half; the mutation half resolves without
opening a second one.

## 5 · `command-palette.ts` — the mount module (LLD-C6…C10, shape)

Not code (this LLD stays design-level, no source exists yet), but the exact responsibility split a builder
must not blur:

1. On first import (triggered by the lazy `import()` from `_page.ts`'s shell — every page, cheap): read the
   already-bundled `sitemap.json` (L1+L2+L3-stubs; small enough to bundle directly, the `llms-full.txt`
   precedent's own reasoning about "a few hundred KB is small enough to ship as static text"), render each entry
   as `[role=option][value={url}]{name} ({tag}) — {description}` (component pages) or `[role=option][value=
   {url}]{name} — {description}` (guides/stubs), grouped under three `[role=group]` sections in level order, and
   pack `data-keywords="{tag ?? ''} {description}"` per option (LLD-C7).
2. Create `<ui-command-modal hotkey="mod+k" label="Search agent-ui" filter="regex">` (LLD-C8, the `filter`
   attribute conditional on ADR-0127 having shipped — a builder checks the control's descriptor before wiring
   it, never assumes), append the rendered options, mount once into the page (LLD-C6).
3. Wire `select` → `location.href = event.detail.value` (LLD-C9) — no `@agent-ui/router` import anywhere in this
   module (the grep-checkable negative control SPEC-R9 AC1 names).
4. Kick off the two L3 `fetch()` calls at module init, independent of palette open/closed state (LLD-C10). On
   each resolve, merge that corpus's per-record entries into a NEW options render (re-running step 1's render
   logic over L1+L2+L3-stubs-minus-the-resolved-one+the-resolved-corpus's-real-records) and perform the
   closed-swap-or-deferred-swap described in §4 finding 2.

## 6 · Site pages touched (LLD-C11)

- **`adr-index.ts`** — `card()` gains `details.id = \`adr-${record.number}\`` (one line); a new top-level
  `if (location.hash) { const target = document.getElementById(location.hash.slice(1)); if (target instanceof
  HTMLDetailsElement) { target.open = true; target.scrollIntoView() } }` run after the card list mounts.
- **`changelog.ts`** — each `section` gains `section.id = slug(entry.heading)` (the SAME `slug()` helper
  `generate-sitemap.mjs`'s `generateChangelogIndex()` uses — extracted to one tiny shared pure function so the
  id-producer (the generator) and the id-consumer (the page) cannot drift apart); a matching on-load
  `scrollIntoView()` (no expand/collapse state to restore — changelog entries are not `<details>`).

## 7 · Failure/edge summary (cross-cutting)

- **A descriptor with Markdown-heavy prose and no `description:`** — the fallback (LLD-C2) strips emphasis
  markers before truncating; a pathological body with no sentence-ending punctuation within 160 chars still
  truncates cleanly (the char-count ceiling is the hard stop, sentence-boundary is the soft preference).
- **A page added without a `site-manifest.json` row** — caught by `sitemap.test.ts`'s coverage leg (SPEC-R5
  AC2), same failure shape as `llms.test.ts`'s existing "a new page missing an index entry" gate.
- **The user opens the palette before either L3 fetch resolves** — L1+L2+the-two-stub-options render
  immediately (stubs still navigate to their own page, just without a hash); no error, no blank state.
- **The user opens the palette, an L3 fetch resolves mid-session, the user closes and reopens** — the deferred
  swap (§4) fires exactly once, on that `close`; the reopened palette shows the merged set.
- **An invalid regex query** — degrades to literal substring for that keystroke only (ADR-0127); never throws,
  never blanks the list irrecoverably.
- **ADR README table reformatting** — `generateAdrIndex()`'s row regex is a single point of coupling to the
  README's table shape; if the table format ever changes, this generator's row count assertion (`sitemap.test.ts`
  anti-vacuous check, mirroring `llms.test.ts`'s `>50_000` byte floor) fails loudly rather than silently
  under-counting.

## 8 · Gates (the definition of done)

`npm run check`(+site) · `npm test` (`sitemap.test.ts` + a small unit suite for the pure helpers — description
fallback truncation, slug determinism, ADR/changelog row parsing — + `site-coverage.test.ts` unaffected since no
new page is added) · `npm run test:browser` (a cross-engine leg: open→type a valid regex→select→verify
`location.href`; open→type an invalid pattern→verify no throw + substring fallback; a closed-instance L3 swap
proof using a mocked/deferred fetch) · `npm run size` measured by hand for the palette mount stub's marginal
(ADR-0040 §3) · independent `doc-reviewer` GO on this SPEC + LLD before the build dispatches (this intake's own
obligation) · **once ADR-0127 ships**, the command-modal component's own gates (its `component-reviewer` GO) are
a hard prerequisite for LLD-C8/C13 — this site feature does not build ahead of its control dependency.

## 9 · Open (named, not blocking)

- **ADR-0127's ratification** — LLD-C7/C8's `filter="regex"` wiring is a no-op (falls back to the shipped
  substring default) until the control ships the prop; the rest of this LLD (mount, grouping, navigation, lazy
  L3) builds and functions independently of it (substring-only search still works end to end).
- **The exact 160-char fallback ceiling** — a chosen, not derived, number; revisit if real descriptions truncate
  awkwardly in practice (a cosmetic tuning knob, not a contract change).
- **Whether `site-manifest.json`'s L2 rows should also back-fill `_page.ts`'s `NavLink.description`** (so the
  nav rail could someday show a tooltip) — out of this ticket's scope; named as a low-cost future reuse, not a
  requirement here.
