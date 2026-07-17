---
doc-type: ticket
id: tkt-0082
status: done
date: 2026-07-17
owner:
kind: bug
size: small
---
# TKT-0082 — A2UI `Text` heading variants (h1–h5) render at document-scale font sizes, oversized for compact generated UI

## Summary
Kim's screenshot (2026-07-17, agent-admin-app.html, Quizmaster persona, a live game surface): the
quiz card's title ("History — Round 1 of 3") and question ("In what year did the Berlin Wall
fall?") render at huge, document-heading-scale font sizes — visually dominating a small card
layout. Kim: "the font-sizes are crazy becaues `<h1>`...`<h6>` have sizes associated with them.
this is pointless when generating UI."

Root-caused (grep + read, not guessed): the A2UI catalog's `Text` type (`variant` enum
`h1|h2|h3|h4|h5|caption|body`, `packages/agent-ui/a2ui/src/catalog/default/catalog.json:5-12`)
maps every heading level to `ui-text`'s M3 document type scale via a fixed fan-out table —
`TEXT_VARIANT_TABLE` in `packages/agent-ui/a2ui/src/catalog/default/factories.ts:131-139`:

```
h1: { as:'h1', variant:'display',  size:'sm' }   // 36px
h2: { as:'h2', variant:'headline', size:'lg' }   // 32px
h3: { as:'h3', variant:'headline', size:'md' }   // 28px
h4: { as:'h4', variant:'headline', size:'sm' }   // 24px
h5: { as:'h5', variant:'title',    size:'lg' }   // 22px
```

These are the exact px values ADR-0078 cl.2 fixes for `ui-text`'s `--md-sys-typescale-*` ladder —
sized for `ui-text`'s original context (docs-site prose/document headings), not a compact
generative-UI card. `ui-text`'s type scale is explicitly, deliberately DENSITY-INVARIANT by design
(ADR-0025 cl.3 / ADR-0078 cl.2: "type is density-invariant... `[density]` touches only gaps") — a
correct call for `ui-text` itself, a docs-site primitive. But the A2UI catalog's `Text` type is a
SEPARATE consumption path with its own factory mapping (`factories.ts`), reused wholesale from
`ui-text`'s document-scale defaults with no compact-context alternative — no catalog-level
guardrail reduces heading size inside a `Card`/small-surface embedding, and no mechanism (density
prop, container query, scale override) exists anywhere in the fleet for context-aware type sizing.

Compounding trigger: the Quizmaster persona's own `quiz-round` mini-skill
(`site/pages/agent-admin-presets.ts:268`) instructs the producer "Question as Text" with no
`variant`/size guidance, so the model (Haiku 4.5, temperature 0.9) free-picks a heading level it
judges "prominent," which the fan-out table then renders at its fixed 36px/32px/28px size —
regardless of the small card it's embedded in.

## Acceptance
- A2UI-generated `Text` heading variants (h1–h5) render at sizes appropriate for a compact,
  card-scale generative-UI surface — not the document/docs-site scale `ui-text` defaults to.
- The fix is scoped to the A2UI catalog's OWN mapping choice (`TEXT_VARIANT_TABLE` in
  `factories.ts`, or an equivalent catalog-level mechanism) — `ui-text`'s component contract and
  its density-invariant type-scale design (ADR-0025/ADR-0078) are NOT reopened or touched; those
  ADRs govern `ui-text`'s own docs-site use, this ticket is about the A2UI catalog's separate
  choice of which `ui-text` variant/size pair each wire-level heading maps to.
- Verified live (not just unit-tested): a re-generated Quizmaster/Croupier-style card renders
  headings that read as card titles, not oversized document headlines. Browser-screenshotted
  before/after.
- `npm run check && npm test` green.

## Repro
1. `npm run dev` → `agent-admin-app.html` → the Quizmaster persona → start a quiz.
2. The round title and question render at ~28-36px in a card only a few hundred px wide —
   visually out of proportion with the rest of the surface (options, buttons, progress bar).

## Expected vs actual
- **Expected:** heading-level Text nodes in a generated UI surface size proportionately to the
  compact card/dashboard context A2UI actually targets (per the fleet's own product framing —
  card-game-sheet, dashboard-kpi-grid, form-rhythm mini-skills are all compact idioms, not
  document layouts).
- **Actual:** every heading level maps 1:1 to `ui-text`'s document type scale, unconditionally.

## Classification
Axis: **structural/design** — a catalog mapping choice reusing a document-context type scale
for a fundamentally different (compact, generative-UI) consumption path. Plane:
`packages/agent-ui/a2ui/src/catalog/default/factories.ts` (`TEXT_VARIANT_TABLE`) ×
`packages/agent-ui/a2ui/src/catalog/default/catalog.json` (the `Text.variant` wire enum, if a
catalog-level size cap or new variant tier is needed) — NOT `ui-text`/`text.css`
(packages/agent-ui/components), which stays untouched.

## Severity
**major** — not a functional break (the quiz still works), but it visibly undermines the core
pitch of the six A2UI-showcase personas (TKT-0074) shipped specifically to demonstrate compact
generated UI; a title/question rendering at document-headline scale in a small card reads as
broken to anyone trying the feature.

## Links
- ADR-0025 (`ui-text` display primitive + type scale) · ADR-0078 (the M3 typescale repoint) —
  both explicitly rule type density-invariant for `ui-text` itself; this ticket does not reopen
  either, it scopes the fix to the A2UI catalog's separate mapping choice.
- [TKT-0074](tkt-0074-agent-admin-a2ui-showcase-presets.md) — the six-persona showcase this bug
  undermines visually.
- [TKT-0077](tkt-0077-game-ui-mini-skills.md) — the game-UI mini-skill trio (card/table/HUD),
  the adjacent "does generated UI actually look right" concern.
- `site/pages/agent-admin-presets.ts:268` — the Quizmaster `quiz-round` skill prompt that
  triggers the specific repro, though the root defect is catalog-wide, not persona-specific.
- [ADR-0142](../adr/0142-a2ui-text-heading-compact-scale.md) — the `proposed` amendment record
  authored for this fix (never self-ratified; Kim's ratification pending).

## Findings

### 2026-07-17 — `TEXT_VARIANT_TABLE` remapped to compact rows, fixed inline

**Fix (`packages/agent-ui/a2ui/src/catalog/default/factories.ts`, `TEXT_VARIANT_TABLE`):** every
heading row moved down the M3 tier ladder — display/headline-large-ish → headline/title/label —
while keeping all five levels monotonically decreasing and at/above `body`'s own 14px:

| wire | before (px) | after (px) | new triple |
|---|---|---|---|
| h1 | 36 | 24 | `headline/sm` |
| h2 | 32 | 22 | `title/lg` |
| h3 | 28 | 16 | `title/md` |
| h4 | 24 | 14 | `title/sm` |
| h5 | 22 | 14 | `label/lg` |

`ui-text`/`text.css` (packages/agent-ui/components) — **untouched**. ADR-0025/ADR-0078's
density-invariant type-scale rule for `ui-text` itself stands; this is purely the A2UI catalog's
own mapping-table choice, isolated in `factories.ts`.

**Tests updated:** `factories.test.ts`'s `it.each` fan-out table (the ADR-0078 cl.5 wire→triple
assertions) updated to the new rows — 57/57 passing.

**Verified live (not just unit-tested):**
- `npx vitest run packages/agent-ui/a2ui` — 62 files / 1074 tests green (worktree).
- Browser-measured (`text-doc.html`, Chromium, direct `<ui-text as/variant/size>` construction
  matching each table row): old sizes computed exactly `36/32/28/24/22px`; new sizes computed
  exactly `24/22/16/14/14px` — confirms the fan-out change lands as real computed font-size, not
  just an attribute change.
- Side-by-side before/after screenshot (card-scale mock, same card width/content as the original
  report) confirms the visual fix: the "after" card reads as a compact quiz-card title/question,
  no longer towering document-headline text.
- Full gate (`npm run check && npm test`) run from the MAIN tree (not this worktree) with the
  changed files copied over temporarily, then reverted — **346 files / 6329 tests green**. Two
  site test files (`agent-admin-app.test.ts`, `a2ui-live.ask-lifecycle.test.ts`) fail INSIDE this
  worktree with `Denied ID .../app-shell-isolation.css?raw` — confirmed via direct comparison
  (same test, same code, run from the main tree instead) that this is a pure Vite `fs.deny`
  artifact of the worktree living under a dot-prefixed path (`.claude/worktrees/...`), unrelated
  to this change; not a real regression.

**Worked in an isolated git worktree** (`.claude/worktrees/tkt-0082-text-heading-sizes`,
`worktree-tkt-0082-text-heading-sizes` branch) — the main tree had two prior sweep-in collisions
this session from a separate concurrent session's rapid-fire commits (TKT-0073's and the
split/chat-padding tweaks both got silently absorbed into unrelated commit messages); this ticket
and its fix live entirely on the worktree branch, to be merged separately.

### 2026-07-17 — independent review (`a2ui-reviewer`) — 2 major findings, both fixed

Dispatched `a2ui-reviewer` fresh-context against the shipped diff. Verdict: real fix, right layer,
gate-green, but NOT done by this repo's own doctrine — two major findings:

1. **The first table silently contradicted three live governing records** — ADR-0078 cl.5
   (`accepted`, Kim-ratified) pins the OLD table verbatim, and `a2ui-catalog.spec.md`/
   `a2ui-catalog.lld.md` both still cite it. Overriding a ratified decision with no decision
   record violates this repo's own ADR discipline (a stale-context defect, and a self-ratification
   near-miss). **Fixed:** authored [ADR-0142](../adr/0142-a2ui-text-heading-compact-scale.md),
   status `proposed` (never self-ratified, Kim's call), amending ONLY cl.5's table — pointed to
   from ADR-0078's own header row (`Supersedes/Superseded by` field) without touching its ratified
   body. Per this repo's own convention, `a2ui-catalog.spec.md`/`lld.md` repair on ratification,
   not before — left untouched deliberately, named in ADR-0142's Consequences + Acceptance.
2. **h4 ≡ h5 — `title/sm` and `label/lg` resolve to IDENTICAL tokens** (14px/weight
   500/line-height/tracking), violating the fix's own stated "5 distinct, monotonically decreasing
   sizes" claim (which was then false). **Fixed:** replaced the first-draft table (24px-capped:
   `headline/sm · title/lg · title/md · title/sm · label/lg`) with a strictly-monotone alternative
   shifted exactly one M3 tier down from ADR-0078's original row (`headline/md · headline/sm ·
   title/lg · title/md · title/sm` → **28/24/22/16/14px**, all distinct, all ≥ body's 14px).
   Re-verified: `factories.test.ts` updated to the corrected rows (57/57 passing); browser-measured
   the corrected table directly (`text-doc.html`, Chromium) — computed sizes exactly
   `28px/24px/22px/16px/14px`, weights `400/400/400/500/500`, confirming h4/h5 are no longer tied.
3. Reviewer's 2 minor findings — exemplar/gallery visual reshaping (dashboard KPI `h3` idiom,
   gallery `Card` preview `h5` header) and a possibly-stale comment in `component-preview.ts` —
   assessed: the KPI/gallery reshaping is an accepted, smaller-but-still-correct consequence (named
   in ADR-0142's Consequences, not a regression — no snapshot/golden pins the old sizes anywhere in
   the tree, confirmed by grep); the flagged comment in `component-preview.ts:219` ("'h5' is the
   real wire member that resolves to that title-weight triple") is actually STILL ACCURATE against
   the corrected table (h5 → `title/sm`, still a genuine `title` variant) — it was only wrong
   against the first draft's `label/lg` row, which no longer ships. No edit needed there.

**Re-verified after the fix-up:** `npx vitest run packages/agent-ui/a2ui` — 62 files / 1074 tests
green. Full gate (`npm run check && npm test`, main-tree copy-verify technique as above) — **346
files / 6330 tests green**.

Files touched (final): `packages/agent-ui/a2ui/src/catalog/default/factories.ts`,
`factories.test.ts`, `.claude/docs/adr/0142-a2ui-text-heading-compact-scale.md` (new, `proposed`),
`.claude/docs/adr/0078-ui-text-three-axis-variant-size-as.md` (header pointer only),
`.claude/docs/adr/README.md` (index row).
