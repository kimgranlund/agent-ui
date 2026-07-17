---
doc-type: ticket
id: tkt-0080
status: done
date: 2026-07-16
owner:
kind: bug
size: small
---
# TKT-0080 — recurring EMPTY card tiles: the grammar never taught template item-relative binding (the producer writes absolute "/glyph")

## Summary
Recurring live defect on the Croupier (2 of 3 fresh deals): the table renders with the right
anatomy but every card tile EMPTY. TKT-0077's Findings recorded a first (incomplete) diagnosis —
"bound path never set" — and shipped a guard sentence; the tiles went empty again WITH the guard
in place.

## Repro
`agent-admin-app.html` → Croupier → "deal me in", repeated: any deal where the model chooses the
ChildList-template shape for hands (vs per-card scalar paths) renders empty tiles.

## Expected vs actual
- **Expected:** template-stamped card tiles show their item's glyph.
- **Actual:** tiles stamp (count tracks the hand array) but every glyph Text is empty.

## Classification
**Taught-idiom lane** (ADR-0102). The captured live wire (fetch tee): hands are templates —
`"children":{"path":"/dealer/hand","componentId":"card_tile"}` over `[{glyph:"9♠"},…]` — and the
tile's Text binds `{"path":"/glyph"}`. `scopedPointer` (binding.ts:118) treats ANY leading-slash
path as ABSOLUTE (spec-faithful; only slash-less paths rewrite to `/hand/{i}/…`), so `/glyph`
reads the whole-model root — nothing there — and legally renders empty (late data is a feature;
the validator cannot reject it). The renderer is exonerated across every ordering/shape
(`renderer/bound-text.test.ts`, 5 probes incl. the template-relative positive and the
absolute-miss negative control). The producer's grammar taught the template mechanism in ONE line
and NEVER the item-relative binding syntax — the model had no way to know `"glyph"` not
`"/glyph"`.

## Severity
major (a hosted mechanism silently renders empty on the natural-but-wrong authoring; recurring)

## Acceptance
- grammar.md teaches the rule at the dynamic-list line: relative = item field, `""` = the item,
  leading slash = absolute whole-model (renders empty for item fields).
- card-layout teaches the templated-hand idiom with the relative binding explicitly.
- Equivalence baseline re-captured (deliberate text change, the fixture's own rule); budget gates
  green; the two template probes pinned.
- Live: a fresh Croupier deal choosing the template shape renders glyph tiles.

## Links
- [TKT-0077](tkt-0077-game-ui-mini-skills.md) — the first diagnosis this supersedes (its guard
  sentence was aimed at the wrong mechanism; replaced by the template teaching).
- ADR-0024 (positional list) · ADR-0102 (lane routing) · ADR-0090 §1 (grammar byte-identity —
  moved deliberately here).

## Findings

### 2026-07-16 — root-caused from the captured wire, fixed in the teaching lane, live-verified — CLOSED

**The chain of evidence:** (1) live DOM — template-stamped tiles whose count tracked the hand
array but whose Texts were empty; (2) the fetch-teed wire — `card_glyph` binds
`{"path":"/glyph"}` under a `{"path":"/dealer/hand","componentId":"card_tile"}` template;
(3) `scopedPointer` (binding.ts:117-121) — leading slash = ABSOLUTE, only slash-less rewrites to
`/hand/{i}/…`; (4) five jsdom probes (`renderer/bound-text.test.ts`) exonerating the renderer
across data-first/components-first/per-path orderings and pinning template-relative-resolves +
absolute-misses (the negative control documenting the trap).

**Fix (taught-idiom lane):** grammar.md's dynamic-list bullet now teaches the rule (relative =
item field, `""` = the item, leading slash = whole-model absolute that renders empty);
card-layout teaches the templated-hand idiom with the relative binding inline. Equivalence
baseline re-captured (all four composed prompts + the mini-skill entry — the fixture's own
deliberate-change rule); card-layout trimmed back under the 200-token budget.

**Live:** fresh Croupier deal with the template shape → glyph tiles (9♥/🂠/K♠/7♦), hole card
revealed on settle, tiles surviving the model's own mid-game component-graph rebuild. TKT-0077's
earlier "bound path never set" guard sentence was aimed at the wrong mechanism and is superseded
by this teaching (the sentence itself was replaced in the same edit).
