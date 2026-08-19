---
name: a2ui-catalog-rendering-review
description: >-
  Screenshots, reviews AND fixes the a2ui catalog examples — each card on site/a2ui-catalog.html
  (props panel left, rendered A2UI surface right) — graded against rubrics/a2ui-catalog-example.md,
  then fixed through the catalog pipeline (catalog.json → factories.ts → ui-* control → preview
  seeds → tests/regen). Use for "review the a2ui catalog examples", "screenshot each example and
  review them", "does the rendered surface make sense for X", "fix the X catalog card / seeds /
  catalog row", "add a prop or new type to the A2UI catalog". NOT for GRADING a row, payload or
  corpus record (a2ui-review); NOT for ui-* control source (component-build-agent); NOT for the
  page shell (docs-writer).
disable-model-invocation: false
user-invocable: true
argument-hint: "[Component | TIER | all] [--base URL] [--theme dark|light|both] [--fix]"
---

# a2ui-catalog-rendering-review

Produces a per-card verdict table for the live catalog page — gates from real probes, review scores
from the screenshot judged against `.claude/docs/rubrics/a2ui-catalog-example.md` (the rubric of record;
its dimension table A1–C3, anchors, and §6 owner map live there alone) — with every finding routed by
defect quadrant, and, on `--fix` or an explicit fix ask, carried through the catalog pipeline in
`references/catalog-pipeline.md` (layers, gate matrix, regen commands, seat map, three fix shapes) to
green gates and a re-graded card.

## Ground truth (derived from source)

A card is a pure function of three sources; the review reads them BEFORE it looks at any pixel:

| Card part | Source of truth |
|---|---|
| L — knobs + seeds | `packages/agent-ui/a2ui/src/catalog/default/catalog.json` `components[T].properties` · `A2UI_INITIAL[T]` in `site/lib/component-preview.ts` |
| R — root tag + specimen | `factories.ts` `WidgetFactory.tag` for `T` · `SAMPLE_TREES[T]` / `sampleFor()` in `component-preview.ts` |
| tier · uses line | `site/lib/a2ui-catalog-tiers.ts` (`TIERS`, `tierOf`, `seedsUsingType`) |

From these the review writes the **expected-card record** per `T` exactly as rubric §1.1 defines it
(fields, `demonstrable` rule) — the record IS the answer to "what should this card demonstrate". A
review that scores B4 without that record scored the control, not the demonstration.

## Procedure

1. **Scope.** `` names one component, one tier key (`WIDGET|PRIMITIVE|PATTERN|FEATURE|INPUT`),
   or `all` (default). Dev server: the runner defaults to `http://localhost:5174`; vite's own default
   is 5173 — pass `--base` to whichever answers 200. When the page 404s → the report opens with the
   blocker (which port, `npm run dev`) and stops there.
2. **Capture.** `node scripts/screenshot-a2ui-catalog.mjs --out <dir> [--theme …] [--only T]` — the
   repo runner (playwright is a repo devDep; run it from the repo root). A tier scope captures `all`
   and filters `index.json` rows by `tier`. Coverage counts DISTINCT `name` values per theme in
   `index.json` (the runner emits one row per theme × card): for `all`, distinct names == the page
   header's "(N shown)"; each missing name is a ✗ B1 row. `status: empty-canvas` rows are ✗ B1.
3. **Probe the gates** — `node scripts/eval-a2ui-catalog.mjs --out <dir> [--only T]` (shipped 2026-08-18,
   rubric §5): A1 A2 A3 A4 B1 B2 B3g C1 C2 per card, exit-coded, with the §1.1 record fields, the
   component-mode comparison shot, and each overlay's revealed capture emitted alongside. Its header
   comment and `references/catalog-pipeline.md` §"probe-artifact taxonomy" carry the hardening rules —
   when a NEW probe goes red, triage against that taxonomy before filing a defect. `probes: manual` (a
   hand Playwright pass) is the fallback only when the runner itself is broken, and the report says so.
   A gate carries ✓/✗ only; scores 1–5 belong to review dims.
4. **Blind identify.** For each card, look at the screenshot's RIGHT half FIRST and write one line —
   *"this is a ⟨component⟩ doing ⟨job⟩"* — before reading the title or the record. A miss is B4 = 1.
5. **Score the review dims** A3 B3 B4 C3 against the rubric anchors, in rubric §4's order (out-in
   verdict, then in-out). Each score cites its matched anchor (1/3/5) and one image-region evidence
   sentence. The invoking session may score a spot-check; a promotion-grade run (a whole tier or
   `all`) dispatches the scoring to a fresh-context critic (`a2ui-review-agent` class), per §4.
6. **Verdict + route.** Apply the rubric's gate-to-promote rule verbatim. Every non-promoting finding
   names its quadrant — L-only · R-only · L↔R · card — and the owner from rubric §6.
7. **Fix (on `--fix`, or when the ask is "fix/add/change …").** Review first (steps 1–6) so the fix
   targets a graded finding, then pick the fix shape from `references/catalog-pipeline.md §5` by
   quadrant: L-only → shape (i) seed-only (`A2UI_INITIAL`/`SAMPLE_TREES`); R-only or L↔R on a
   missing/mis-mapped prop → shape (ii) prop on an existing type (`catalog.json` `mapsTo` ↔ descriptor
   attribute, `factories.ts` mapping, conformance test, prompt-baseline recapture); a type that does
   not exist → shape (iii) end to end; `card` quadrant (tier/nested/uses/page) → `TIER_OF`/`NESTED_ONLY`
   in `a2ui-catalog-tiers.ts`, or dispatch docs-writer for page shell. Edit in the pipeline's layer
   ORDER (control → row → seed → site), run each regen command as soon as its layer is touched
   (§3 — a `catalog.json` edit owes the prompt-baseline recapture immediately), and finish with
   `npm run check` and `npm test` read by exit code. Then re-capture the card and re-grade — the
   fix is done when the held dims read ≥ 3 / ✓ on the NEW screenshot, not when the edit compiles.
   Cross-package edits stay with their owner: a control-side change (new `static props`, descriptor)
   is dispatched to `component-build-agent`; a corpus admission to `a2ui-corpus-curation`.

If the ask is one component's card only → skip step 2's `all` count check; capture with `--only`.
If the ask is review-only → stop after step 6; the report's owner column is the handoff.

## Output contract

```
# a2ui catalog rendering review — <scope> — <date> — probes: script|manual — theme: …
| card | tier | A1 A2 A4 B1 B2 C1 C2 | A3 B3 B4 C3 | verdict |
| Attachment | WIDGET | ✓ ✓ ✓ ✓ ✓ ✗ ✓ | 1 3 1 3 | HOLD |
…
## Findings (severity-ordered)
- <card> · <dim> · quadrant <L-only|R-only|L↔R|card> · owner <seat> — <anchor matched> — <evidence: image region / file:line>
## Blind-identify log
- <card>: "<one line written before the title>" — hit|miss
## Coverage
captured N / expected N · empty-canvas: [...] · screenshots: <dir>
## Fixes (only when step 7 ran)
- <card> · shape (i|ii|iii) · files: <path:line…> · regen: <commands run> · gates: check <exit> / test <exit> · re-graded: <dim old→new> · screenshot: <path>
```

## Failure branches

- Dev server unreachable → the report is the blocker line (port + `npm run dev`); PNGs from an earlier run stay out of it.
- Runner captures fewer cards than "(N shown)" → the missing names appear as ✗ B1 rows and the coverage line reads `captured N / expected M`.
- Overlay card seeded closed by rule → the rubric's A3 `open` exemption applies; B4 is judged on the
  revealed state (toggle `open` during probing, then close it — C2).
- A review dim cannot be judged from the image (clipped, offscreen) → score it `?`, name the reason,
  and re-capture with `--crop canvas` before holding the card on it.
- A fix's gate goes red on a test named in `catalog-pipeline.md §2` → the matrix row names the omitted
  layer; the fix lands in that layer (a missing regen, an un-drained allowlist seed, a stale
  `TIER_OF`), never in the test.
- A fix needs a control-side change (`static props`, descriptor) → dispatch `component-build-agent`
  with the exact interface need and hold the row until it lands (a2ui-build never crosses the package).
- `catalog.json` changed → the prompt baseline recapture is owed in the same change; a diff that moves
  anything beyond inventory lines is a defect to report, not to commit.

Done when every in-scope card has a table row, every non-promoting row has at least one routed
finding, the coverage line reconciles captured vs expected — and, when step 7 ran, every fixed card
shows its held dims cleared on a fresh capture with `npm run check` and `npm test` exit 0.

## Example

Good — Attachment, seeded blank (2026-08-18):
`B4 = 1 (anchor 1: bare "File" chip — a reader cannot tell what an Attachment shows) · A3 = 1
(demonstrable name/mimeType/sizeBytes/href all unseeded) · quadrant L-only · owner
example-authoring-agent · blind-identify: "a file chip / attachment affordance" — hit on type, miss on
job.`

Counter-example — do not imitate:
`Attachment looks fine — clean chip, nice icon, renders in dark mode.` (scores the ui-attachment
control's looks, no record, no anchor, no owner — the exact regression this skill exists to prevent.)
