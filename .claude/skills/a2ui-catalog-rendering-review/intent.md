# intent — a2ui-catalog-rendering-review
status: shipped   # re-forged 2026-08-18 for the fix leg (Kim ruling)
species: procedural
dials: { disable-model-invocation: false, user-invocable: true }
freedom: medium          # review: derive → capture → probe → judge → route; fix: the pipeline's layer order + gate matrix (references/catalog-pipeline.md) — one preferred sequence per fix shape
type: capability-uplift  # blind-identify + out-in/in-out grading of a live rendered card is not something Claude does unprompted; the derived expected-card record and the L/R/L↔R quadrant routing are the uplift

## trigger
should:
  - "review the a2ui catalog examples"
  - "grab screenshots of each example in a2ui-catalog.html and review them"
  - "does the rendered A2UI surface on the catalog page make sense for <Component>?"
  - "is the left side (props) ok and does the right side render correctly on the catalog card?"
  - "eval every card across the Widgets, Primitives, Patterns, Features and Inputs tabs"
  - "check the catalog playground for <Component> — knobs vs rendered surface"
  - "fix the <Component> catalog card / its seeds / its catalog row" (2026-08-18 widening)
  - "add a prop or a new type/pattern to the A2UI catalog"
should_not:
  - "grade this catalog row's catalog.json + factory + tests"           # a2ui-review (rubric a2ui-catalog.md)
  - "review this A2UI payload / gallery example"                         # a2ui-review (rubric a2ui-payload.md)
  - "is ui-attachment's anatomy and geometry right"                      # screens:component-checker / component.md
  - "screenshot the docs site pages for the README"                      # plain playwright, no eval

## delta
Today (2026-08-18, this session): asked to "review the catalog examples", Claude either (a) screenshots
and eyeballs with no ground truth — praising a card whose seeds are all blank (Attachment rendered a bare
"File" chip; nothing told it four demonstrable props were empty), or (b) reviews the ui-* control's own
quality instead of the DEMONSTRATION. Desired: per card, derive the expected-card record from
catalog.json + factories.ts + A2UI_INITIAL/SAMPLE_TREES, run the mechanical gates (knob set == props,
kind fidelity, renders via real renderer with the right tag, seed visibility, prop reflection), blind-
identify the component from the image, grade the review dims against
`.claude/docs/rubrics/a2ui-catalog-example.md` (A/B/C axes, out-in × in-out), and route each finding by
defect quadrant (L-only → example-authoring-agent · R-tag/prop → a2ui-build-agent · R-render →
component-build-agent · card → docs-writer). Deleted after a month: reviews regress to (a)/(b).

## fences
- NOT for grading the catalog ROW — catalog.json/factory/tests (a2ui-review, rubric a2ui-catalog.md)
- NOT for grading a composed A2UI payload or gallery example (a2ui-review, rubric a2ui-payload.md)
- NOT for the ui-* control's own anatomy/geometry (screens:component-checker)
- (RETIRED 2026-08-18) "NOT for fixing seeds/knobs" — Kim ruling: the skill owns the fix leg through the catalog pipeline; ownership seats stay the DISPATCH targets for cross-package edits (component-build-agent for control source, a2ui-corpus-curation for admission)
- NOT for the site page shell/nav (docs-writer)

## assertions
1. The report carries one row per card reviewed with a gate ✓/✗ per mechanical dim (A1 A2 A4 B1 B2 C1 C2) and a 1–5 score per review dim (A3 B3 B4 C3), plus a promote/hold verdict from the gate-to-promote rule.
2. Every finding names its defect quadrant (L-only · R-only · L↔R · card) AND the owning seat from the rubric's §6 table.
3. Every review-dim score cites the anchor it matched (1/3/5) and one image-region evidence sentence; B4 opens with the blind identification line ("what is this?") written before the title is consulted.
4. The screenshot set covers every `section.catalog-item` on every tier tab (count == the page's "(N shown)"), with `index.json` alongside; a card whose canvas stayed empty appears as ✗ B1, never dropped.
5. Running the skill against the Attachment card as seeded today yields A3 ≤ 2 and B4 ≤ 2 (blank seeds → bare "File" chip), routed L-only → example-authoring-agent.
6. (fix leg) Asked to fix a held card, the output names the fix shape (i/ii/iii), the files edited in layer order, the regen commands run, `npm run check`/`npm test` exit codes, and a re-graded dim delta on a fresh capture — and a catalog.json edit is always paired with a prompt-baseline recapture.

## delta (2026-08-18 widening — Kim: "the tool MUST understand the pipeline for working with A2UI catalogs")
Without it: a fix for a held card lands as a one-file edit — seed added but the prompt baseline not recaptured
(prompt-equivalence red), a catalog prop added with a `mapsTo` that disagrees with the descriptor
(descriptor-agreement red), a new type without `TIER_OF`/`SAMPLE_TREES`/seed (three site gates red), an
allowlist seed left un-drained (residue guard red). Desired: the fix follows references/catalog-pipeline.md —
layer order, the gate matrix naming the omitted layer, the owed regen commands, seat dispatch for
cross-package edits — and closes with a re-graded card.

## deliverables
- references/catalog-pipeline.md — the 5 layers, ~25-row gate matrix, regen table, seat map, 3 fix shapes (mapped from the tree 2026-08-18)
- SKILL.md (procedure + output contract) · evals/evals.json · scripts: the capture/probe runner lives in the REPO at `scripts/screenshot-a2ui-catalog.mjs` (uses the repo's playwright devDep; a skill-bundled copy would not resolve `playwright`) — the skill invokes it by repo path.
- Rubric of record: `.claude/docs/rubrics/a2ui-catalog-example.md` (proposed v0.1, 2026-08-18) — the skill references it, never restates the dimension table.
- Gap CLOSED 2026-08-18: `scripts/eval-a2ui-catalog.mjs` shipped (#1319, upgraded on #1322 — A3 gate, §1.1 records, comparison/reveal captures); step 3 now invokes it, manual probes are the broken-runner fallback only.

## gates
P0 route:      PASS 2026-08-18 — procedure with judgment + output contract; mechanical leg is a bundled/repo script, not a hook (review dims are not pass/fail-programmable)
P1 intent:     PASS 2026-08-18 — user confirmed (Confirm)
P2 evals:      PASS 2026-08-18 — evals.json (11 trigger / 9 no-trigger, eval_check clean) · 5 assertions · baseline/ {attachment-card-review.md, eval-design.md} captured in fresh -p sessions before SKILL.md existed
P3 draft:      PASS 2026-08-18 — SKILL.md 128 lines + references/catalog-pipeline.md, dials explicit, description ≤700 chars, rubric referenced not restated (re-passed after the fix-leg widening)
P4 language:   PASS 2026-08-18 — potency_lint clean (prohibitions 9→2, NEVER 5→1); load-bearing lines rewritten to declarative spec-present; output contract is a filled skeleton
P5 validate:   PASS 2026-08-18 (review leg) + PASS 2026-08-18 (fix leg: skill_lint clean · skill-checker re-audit 0 blocking / 3 major all fixed [row-grading + docs-writer fences, executor rule in pipeline §4, fix evidence captured] · with-skill/attachment-card-fix.md satisfies assertion 6, pixel-verified in a worktree) — review-leg detail: skill_lint clean · skill-checker FLOOR: 0 blocking / 2 major (R8 coverage count, R5 drift pairs) both FIXED, minors: tier scope + port + who-judges fixed · behavior check with-skill/attachment-card-review.md satisfies assertions 1-5 (gate table, quadrant+owner, anchor+evidence, blind-identify, coverage; A3=1 B4=1 → example-authoring-agent) · reciprocal fence + evals on a2ui-review

## rulings
- Baseline finding (P2): WITHOUT the skill, a fresh session still located scripts/screenshot-a2ui-catalog.mjs (already in tree) and wrote a fair narrative on Attachment (blank seeds, inert href) — but produced no per-dim gate table, no rubric anchors, no quadrant/owner routing, no blind-identify line, no coverage reconciliation. That set is the measured delta.
- Audit minor accepted-with-note: docs-writer fence not in the description (700-char budget); intent.md fences + evals t17 carry it; add if /check-routing shows a leak.
- Audit minor accepted-with-note: screens:component-checker (plugin agent) and example-authoring-agent (agent, no evals) get no reciprocal suite case — not editable from this repo / not skills.
- Behavior-check side finding (not this skill's scope): with-skill run surfaced site/pages/attachment-doc.ts:58 setting `name` instead of `filename` — every attachment-doc specimen renders the fallback label. Route via /file-bug.
- Re-audit minors accepted-with-note: transcribed PropDef schema in catalog-pipeline.md §1 is a drift pair with catalog.ts validators — kept for self-sufficiency, marked with the file's own "re-verify before citing" rule; 7 line refs drift 1–13 lines (nit).
- Fix-leg behavior check left a REAL desirable fix (A2UI_INITIAL.Attachment seed) uncommitted in worktree `.claude/worktrees/agent-a4c56c520a6ee1440` — port to a branch or discard; not this skill's deliverable.
