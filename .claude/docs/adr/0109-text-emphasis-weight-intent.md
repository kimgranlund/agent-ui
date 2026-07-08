# ADR-0109 — `ui-text` gains an `emphasis` prop: visual weight intent (the bold register), catalog-reachable, purely presentational — the typescale's M3-verbatim weights stay untouched

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08

> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat; the Lane B intake ADR-0102's Consequences named and deliberately deferred ("the catalog `Text` row cannot express **emphasis**", `0102:104-107`); forcing evidence = the 2026-07-08 gallery report ("a name/heading can simply be emphasized or bolded"), fork-diagnosed this session as an EXPRESSIVE gap, not a rendering defect (computed styles pass through the stamp correctly) |
> | **Ratified by** | *(pending — Kim / orchestration-coordinator on gate; doc-reviewer pass first)* |
> | **Repairs** | on ratification+build: `controls/text/text.ts` (the `emphasis` prop — one schema entry, zero behavior code) · `controls/text/text.css` (ONE `[emphasis]` token-block repoint, declared last — no styles-block change, no stamp leg) · `controls/text/text.md` (attributes row + the sole-signifier guidance) · `catalog.json` `Text` row gains `emphasis` (boolean, non-bindable; the factory's existing `default:` `setAttr` arm passes it through — `factories.ts:126-127` (textFactory's `default:` arm, the `truncate` lane) routes to `factories.ts:56-60` (the shared `setAttr` boolean-attribute form), so NO `factories.ts` code change) · `factories.test.ts` + `prompt-drift.test.ts` + catalog `index.test.ts` rows · `a2ui-catalog.spec.md` §5.2 `Text` row · **on accept: the reciprocal `Extended by ADR-0109` back-link on ADR-0078** (per the back-links-land-at-accept convention). Decomp: none — single-decision/one-prop intake cloning ADR-0106's repair pattern; both planes collapse to one node hosting one action |
> | **Supersedes / Superseded by** | Applies **ADR-0102** (Lane B — per-instance weight intent as a catalog-reachable prop over a safe default; chooser walked in Context). Extends **ADR-0078** (the prop schema gains a FIFTH orthogonal axis; cl.2's M3-verbatim token table is explicitly NOT touched — clause 5) · relates **ADR-0106** (the fourth-axis precedent whose boolean-intent shape, non-bindable ruling, and catalog/descriptor repair pattern this record clones) · ADR-0071/0098 (advertising + validation lanes) · ADR-0057 (the non-color-signifier rule, whose sole-carrier logic clause 3 extends to weight) |

## Context

The gallery report asked for "a name/heading can simply be emphasized or bolded." The session's
diagnosis: rendering is NOT the defect — the gap is expressive, twice over:

- **The catalog `Text` row cannot say it.** Its vocabulary is `text · variant(h1…h5/caption/body) ·
  truncate` (`catalog.json:5-10`) — no weight/emphasis knob exists. "Bold this name" is a one-line CSS
  verb for a page author, and the A2UI consumer structurally has no CSS verb (ADR-0096/0102) — the exact
  Lane B shape ADR-0102 flagged.
- **Every factory-produced heading weighs 400.** The wire fan-out lands h1…h5 on display/headline/title-lg
  rows, all weight 400 — `title-large` weighs 400, the same as body (`dimensions.css:132`) — because the
  15 core typescale rows are **M3-verbatim by ratified policy** (ADR-0078 cl.2; Kim resolved both
  ratification knobs to "fully M3-canonical", declining visual-parity forks twice). M3 carries heading
  hierarchy by size/line-height, not weight; a surface that wants a *bolder* title is expressing
  per-instance intent, not exposing a token defect.

The ADR-0102 chooser: (i) the catalog grammar cannot express bold by composition at all → Lane A/B, Lane C
is structurally unavailable; (ii) the no-uptake rendering is graceful (regular weight is readable) → the
safe default is today's rendering; (iii) the concern is per-instance intent → **Lane B**: a prop with a
safe default, `catalog.json` row → ADR-0071 advertising → ADR-0098 validation.

Two facts shape the API (the ADR-0106 method):

- **The weight substrate is register-poor by design.** The fleet typescale uses exactly three registers —
  400 (display/headline/title-lg/body/lead/quote), 500 (title-md/sm, label, overline), 700 (kicker) — and
  kicker vs overline are distinguished BY weight (700 vs 500, `dimensions.css:162-184`). A graded
  `weight` enum has no substrate demand behind it, and an *absolute* one would let authors collapse
  distinctions the role system carries by weight.
- **Emphasis needs ONE CSS leg, not truncate's two.** `font-weight` inherits, and the ADR-0078 cl.4
  stamp-transparency reset (`font: inherit`, `text.css:240-245`) already normalizes UA heading weights —
  a host-level weight change reaches any stamped element for free. Contrast `truncate`, whose
  `overflow`/`text-overflow` do not inherit and needed the second stamp leg (ADR-0106 cl.2).

## Decision

1. **An `emphasis` boolean prop on `ui-text`** (`prop.boolean(false)`, reflected — `[emphasis]` is the
   CSS hook), the schema's **fifth orthogonal axis**: `variant` = role, `size` = row, `as` = semantics,
   `truncate` = overflow intent, `emphasis` = **weight intent**. Default `false` keeps today's rendering —
   no shipped visual changes. The name says the intent, not the mechanism (`bold` names a register;
   `strong` implies HTML semantics this prop deliberately does not stamp — clause 3), and matches M3's own
   "emphasized" type-style concept.
2. **CSS: one token-block repoint, declared LAST in the token block** (the file's order-is-load-bearing
   law — `:where()` keeps specificity 0, so source order lets emphasis beat every role/size weight):
   `:where(ui-text[emphasis]) { --ui-text-weight: 700; }`. **700 is the platform's bold register** (the
   CSS `bold` keyword, the weight the UA gives `<b>`/`<strong>`) — a platform constant, NOT a new fleet
   token and NOT a typescale-row edit. The styles block is untouched (it already consumes
   `font-weight: var(--ui-text-weight)`), and NO stamp leg is added (weight inherits; the cl.4 reset
   guarantees the stamp never fights it). Emphasis lifts 400→700 and 500→700, and no-ops honestly on
   kicker (already 700).
3. **Purely visual — no semantic stamping.** `as` remains the ONLY semantics axis (the ADR-0078 charter;
   re-fusing visual+semantic into one prop recreates the exact conflation that redesign was minted to
   fix). `emphasis` never creates a `<strong>`/`<b>`: whole-block `<strong>` is phrase-level stress
   markup abused as typography; mainstream screen readers announce neither `font-weight` nor
   `<strong>`/`<b>` by default, so a semantic stamp buys ~nothing while a *nested*-stamp invariant would
   tax the heal machinery on every bound-text `textContent` clobber. Phrase-level semantic emphasis stays
   the content model's job — light-DOM `<strong>` children are already legal and flow into the stamp
   untouched — a components-layer freedom the catalog structurally cannot reach (`Text.text` is a plain
   bound string).
4. **Catalog reachability:** the `Text` row gains `emphasis` (boolean, **non-bindable** — ADR-0106's
   presentation-intent ruling applies identically: intent, not data state); `textFactory` passes it
   through the existing `default:` `setAttr` arm (`factories.ts:126-127` → `:56-60` — `true` sets the
   boolean-attribute form, the verified `truncate` lane; no factory code change). The ADR-0071 derived
   inventory advertises it — the prompt line should hint *"names, labels, key values — not whole
   paragraphs"* (build-time wording, the ADR-0071 lane); ADR-0098 has nothing to gate (boolean, no enum).
5. **The token side is OUT — explicitly.** No baseline weight bump on `title-*`/`headline-*`/`display-*`:
   the 15 core rows are M3-VERBATIM under ADR-0078 cl.2, a policy Kim ratified twice over visual-parity
   alternatives; `title-large` 400 IS the spec value (verified 2026-07-04, `dimensions.css:110`).
   Headings-by-size is M3's design, and this record's per-instance prop is the sanctioned way a given
   surface opts into more weight (`Text variant=h3` + `emphasis` is now writable from the wire). A
   fleet-wide "our headings should be bolder than M3" taste ruling would be a theme/foundation decision —
   e.g. adopting M3's emphasized/prominent weight-token concept as extension rows — a future record,
   not forced by this evidence and not smuggled in here.

## Acceptance

- jsdom: `emphasis` defaults `false`, reflects both ways, `@ts-expect-error` leg; `text-descriptor.test.ts`
  mirror gains the fifth attribute (the trip-wire); a grep leg asserts `text.ts` gains NO new
  observer/effect for emphasis (schema-only).
- Cross-engine browser legs: an `[emphasis]` host computes `font-weight: 700`; the **inheritance leg** —
  `as="h4"` + `emphasis` → the stamped `<h4>` computes 700 (and without `emphasis` computes its variant
  weight, pinning the reset against UA bold); the **cascade-order leg** — `variant="label" size="lg"` +
  `emphasis` → 700, not 500 (emphasis beats the size-override block); the **no-op leg** — kicker +
  `emphasis` stays 700. **Negative control:** with the token-block repoint removed, the 700 leg FAILS
  (proves the one line is load-bearing).
- `text-css.test.ts` pins the `[emphasis]` block present and LAST in the token block.
- `prompt-drift.test.ts` green with the new `Text` row; `factories.test.ts` asserts `emphasis: true` lands
  as the boolean attribute on `ui-text`; a live-loop probe lists `emphasis` under `Text`.
- `npm run check && npm test` + `npm run test:browser` green.

## Consequences

- **Emphasis is visual-only, so meaning carried ONLY by weight is invisible to AT** — the same class of
  hazard as color (ADR-0057's non-color-signifier rule, extended here to weight): emphasis must never be
  the sole carrier of a distinction. Descriptor guidance (`text.md`), not a gate.
- **Flat 700 is deliberately blunter than M3's per-role emphasized concept** — an emphasized body is
  14px/700 (the `<b>` register a "simply bolded" ask means), not a graded 500. Accepted for zero new
  tokens and zero verification burden; the per-role emphasized token family stays the named upgrade path,
  and it would land by repointing the SAME `[emphasis]` block — the seam contains the migration.
- **A model can now bold anything**, including 57px display text; bounded by the prompt hint (clause 4),
  deliberately not by validation — over-emphasis is graceful, not destructive.
- **One more boolean in the prompt inventory** (ADR-0071 token cost) — the bounded Lane B growth
  ADR-0102's Consequences already priced in.
- **Zero new runtime machinery**: no observer, no effect, no measurement (contrast truncate's title
  mirror) — the build delta is one schema entry + one CSS declaration block; the `text.md` marginal note
  re-measure is cosmetic.
- **No-op on kicker** (already 700) — stated, honest; an author wanting a *heavier* kicker has no knob,
  and that is correct (900 is not a fleet register).

## Alternatives considered

- **An enum `weight: 'regular' | 'medium' | 'bold'`.** Rejected: nothing in the forcing evidence needs a
  third register; the substrate itself uses only 400/500/700, and an *absolute* weight knob would let
  authors collapse distinctions the role system carries by weight (a `regular` kicker becomes an
  overline). A boolean converts cleanly later if a real graded need appears — the mint-vocabulary-when-
  the-second-value-exists precedent (ADR-0093, reused by ADR-0106's own enum rejection).
- **Stamp `<strong>`/`<b>` alongside the weight (semantic side-effect).** Rejected: re-fuses visual and
  semantic into one prop — the exact ADR-0078 conflation this fleet already paid to unwind; whole-block
  `<strong>` is poor HTML (phrase-stress markup around entire headings/paragraphs); AT ignores both
  `font-weight` and `<strong>` by default, so the payoff is ~zero against a two-level stamp invariant
  through every `textContent` clobber.
- **Extend `as` with `strong`/`em` instead (semantics-only values).** Rejected for this record: the stamp
  wraps ALL content, so `as="strong"` mints the same whole-block phrase-semantics smell — and the stamp
  reset would strip its UA bold anyway, making it a semantics-only value no evidence demands. Phrase
  emphasis belongs IN content (light-DOM children), which already works.
- **Bump the `title-*` (or all heading-role) baseline weights in `dimensions.css`.** Rejected: forks the
  M3-verbatim table ADR-0078 ratified — twice — over visual-parity alternatives; fleet-wide blast radius
  (every title/headline instance + the factory's h1…h5 fan-out) to serve what the evidence shows is
  per-instance intent; and it still would not give the catalog a way to bold a *name* (the body case).
- **Mint the per-role emphasized token family now** (`--md-sys-typescale-{role}-{size}-weight-emphasized`,
  M3's emphasized/prominent concept). Rejected for now: 27 extension tokens plus an M3-emphasized-table
  verification burden (the planner seat cannot fetch; the repo-absence≠spec-absence discipline would gate
  the build on it) to serve one flat intent the platform bold register already serves. Named as the
  upgrade path in Consequences.
- **A bindable `emphasis`** (data-driven bolding, e.g. highlight-the-selected-row). Rejected: ADR-0106's
  non-bindable presentation-intent ruling applies identically; state-driven emphasis is a future need with
  no present evidence, and flipping bindability later is additive.
- **New variant values instead** (`body-strong`, …). Rejected: doubles the role vocabulary and breaks
  orthogonality — emphasis composes with every role; a variant fork composes with none.
