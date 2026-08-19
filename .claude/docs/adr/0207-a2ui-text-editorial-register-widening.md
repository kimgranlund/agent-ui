# ADR-0207 — the A2UI wire `Text.variant` enum widens by FOUR editorial registers (`kicker · overline · quote · lead`), variant stays the single fanned-out dial, and per-register when-to-use guidance lands as ONE grammar.md clause (GH #1321; amends ADR-0078 cl.5 post-#808)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planner seat (design leg of GH [#1321](https://github.com/kimgranlund/agent-ui/issues/1321), size:big due-process), from Kim's seed: "the `<ui-text>` primitive should support ALL the semantic variants we have, and we need to provide instructions for when to use each variant in addition to `as=\"...\"`" |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build (not authored here): `packages/agent-ui/a2ui/src/catalog/default/catalog.json` (`Text.variant` enum, +4 members appended) · `catalog/default/factories.ts` (`TEXT_VARIANT_TABLE`, +4 rows) + `factories.test.ts` (+4 case rows) · `agent/prompts/grammar.md` (the register clause, §Decision D3's text) + `live-agent/prompt-equivalence.baseline.json` (`RECAPTURE_BASELINE=1` recapture, the sanctioned writer) · `.claude/docs/spec/a2ui-catalog.spec.md` §5.2 `Text` row (enum prose + 4 new triple entries) · `.claude/docs/lld/a2ui-catalog.lld.md` `textFactory` description where it enumerates the wire set · `catalog/default/descriptor-agreement.test.ts` `Text.variant` exemption-row NOTE text (mechanism unchanged) · [`0078-ui-text-three-axis-variant-size-as.md`](./0078-ui-text-three-axis-variant-size-as.md) header pointer (the ADR-0142 REV mechanical-pointer precedent) |
> | **Supersedes / Superseded by** | **Amends [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) cl.5's wire vocabulary** (as already amended once: the GH #808 S1 `label` widening, ratified 2026-08-13 — this record is the SECOND widening, same mechanism, four members instead of one; cl.5's factory-seam translation mechanism, `text → textContent` mapping, and every other clause stand unchanged). **Leaves [ADR-0142](./0142-a2ui-text-heading-compact-scale.md) untouched and load-bearing** — its compact heading table and its two constraints (heading ≥ body's 14px; strictly-distinct monotonic rows) are exactly what EXCLUDES `h6` here (§Decision D1). Relates: ADR-0098/ADR-0076 (generic catalog-declared enum enforcement — the widened enum is covered with zero validator code) · ADR-0071 (the derived system prompt derives from `catalog.json` — the inventory line widens truthfully, baseline recaptures) · ADR-0114 (`href` wins `as='a'` — the order-independence law extends unchanged over the two new semantic-stamping rows) · ADR-0057-spirit usage note in spec §5.2 (`emphasis` never the sole signifier — the guidance clause repeats its operative half). |

## Context

The A2UI wire `Text.variant` enum carries 8 members — `h1…h5 | caption | body | label`
(`catalog/default/catalog.json`, `Text` row; `label` joined via ADR-0078's ratified 2026-08-13
Amendment, GH #808 S1). The underlying `ui-text` control carries the full five-axis surface
(ADR-0078/0106/0109/0114): **9 visual roles** (`display · headline · title · body · label` + the
cl.2b editorial extras `kicker · overline · quote · lead`, verified against `controls/text/text.ts`'s
`variant` prop enum) × **3 sizes** (`sm/md/lg`) × **11 `as` semantics** (`none · h1…h6 · p · span ·
blockquote · a`). Four visual roles and two document semantics are unreachable from any payload:
a producing agent cannot emit an eyebrow (`kicker`), a category tag (`overline`), a quotation with
real `<blockquote>` semantics (`quote`), or a standout intro (`lead`) at all — the nearest
approximations (`caption`, `label`, `body` + `emphasis`) are register misuses of the kind the #808
amendment already named for `label`-vs-`caption`.

The translation mechanism is settled law: `textFactory` fans one non-bindable wire `variant`
through `TEXT_VARIANT_TABLE` onto the control's `as`/`variant`/`size` triple (ADR-0078 cl.5), with
ADR-0142's compact scale governing the heading rows and ADR-0098's generic enum gate enforcing
membership straight from `catalog.json` (no per-member validator code). What is NOT settled — the
three forks GH #1321 parks for this record — is (1) exact enum membership, (2) where per-register
when-to-use teaching lives, and (3) whether wire `size`/`as` become independently addressable.

The teaching gap is measured, not hypothetical: the derived inventory grounds only the enum's
SHAPE (`system-prompt.ts` `catalogInventory` → `describePropType`, GH #288), and the one existing
register-routing lesson — grammar.md's Badge clause, minted from GH #1279 where an unshaped clause
produced sentence-length pill headlines — shows both that routing prose belongs in grammar.md and
that a clause must bound usage AND shape.

## Decision

### D1 — the enum widens by exactly FOUR members, all appended after `label`

`catalog.json`'s `Text.variant` becomes (append-only, preserving every existing member's position):

```
[h1, h2, h3, h4, h5, caption, body, label, kicker, overline, quote, lead]
```

`TEXT_VARIANT_TABLE` gains four rows:

| Wire `variant` | → `as` | → `variant` | → `size` | Register (component truth) |
|---|---|---|---|---|
| `kicker` | `none` | `kicker` | `md` | heading eyebrow: label metrics, uppercase, weight 400 / tracking 0.2 (cl.2b + REV 2026-07-30) |
| `overline` | `none` | `overline` | `md` | category tag: label metrics, uppercase, weight 500 / tracking 0.15 |
| `quote` | `blockquote` | `quote` | `md` | quoted speech — the row ALSO stamps real `<blockquote>` semantics (cl.4 doctrine) |
| `lead` | `p` | `lead` | `md` | standout intro sentence — stamps a real `<p>` |

`kicker`/`overline` are straight pass-throughs (wire name IS the M3-extension role name — the
`label` row's class). `quote`/`lead` are the first non-heading rows to stamp a semantic element,
which is the heading rows' own precedent exactly (`h1` the register stamps `<h1>` the element):
the wire register carries role AND semantics in one dial. ADR-0114's order-independence law
extends unchanged — a non-empty `href` still wins `as='a'` over any triple, including these two.

**Per-member exclusions, each with its ground:**

- **`h6` — EXCLUDED.** Unrealizable under ADR-0142's two standing constraints: every heading
  renders ≥ `body`'s 14px, and heading rows stay strictly distinct and monotonically decreasing
  (never two adjacent levels on one token — the exact `title/sm`+`label/lg` 14px tie ADR-0142's
  own first draft was caught on). `h5` already sits AT the 14px floor (`title/sm`), so `h6` must
  either tie it (banned) or dip below prose (banned). Admitting `h6` therefore requires amending
  ADR-0142 first, and no shipped surface motivates that: six heading levels on a compact generated
  card exceeds any real generated-surface depth. Component-only (`as="h6"` remains reachable for
  library consumers via the control itself).
- **`display` — EXCLUDED.** It re-arms the exact defect class ADR-0142 closed (TKT-0082's measured
  "font-sizes are crazy" free-pick, and `display` is the largest register in the system, on
  surfaces that are all compact cards/tiles); and its one legitimate generative use — the big KPI
  number — is already owned by the `Stat` catalog type. Not an agent-appropriate register.
  Component-only.
- **`blockquote` / `p` — NOT enum members.** They are `as` SEMANTICS, not visual registers; on the
  wire they ride `quote`'s and `lead`'s triples (above). Admitting them as `variant` values would
  fork one dial into two vocabularies for the same axis.

### D2 — `variant` stays the SINGLE fanned-out dial; no wire `as`/`size` properties

Resolving GH #1321 Scope item 4: producers do NOT get independently addressable `as`/`size`.
Grounds: (i) the factory seam is the ruled translation mechanism (ADR-0078 cl.5 — the catalog stays
a small protocol vocabulary, the control gets the real triple); (ii) independent axes open a
9×3×11 = 297-combination space, most incoherent (`as:"h1"` + `variant:"label"`), every coherence
rule needing validator or teaching prose the enum gives free; (iii) the derived inventory line
stays ONE enum — three independent props would multiply the `Text` row's token cost for every
catalog consumer on every turn; (iv) the shipped precedent for reaching an `as` value from the
wire is a PAIRED CAPABILITY, not an open axis (`href` wins `as='a'`, ADR-0114) — `quote`/`lead`
follow it. The renderer source confirms nothing else reads wire `as`/`size`: `textFactory` is the
only writer of the triple.

### D3 — the when-to-use guidance lands as ONE clause in `prompts/grammar.md`

The teaching home is grammar.md's component-clause section, adjacent to the Badge clause it
completes (that clause already routes "heading or headline copy" to `Text` variants). The clause,
drafted here as the build-leg text (final bytes may be trimmed, never widened, at build):

> - Text "variant" picks the register — choose by ROLE, never by size appetite: "h1"…"h5" are
>   section headings (use the smallest that still reads as a heading — "h3"/"h4" for card/tile
>   titles; "h1" only for a screen's single top title, never for emphasis); "body" is default
>   prose; "caption" is secondary detail under a value or image; "label" is the key half of a
>   label/value row and compact metric labels; "kicker" is a 2–4 word uppercase eyebrow directly
>   ABOVE a heading, never standalone prose; "overline" is a 1–3 word uppercase category tag above
>   the content it classifies; "quote" is verbatim quoted speech or a testimonial (it renders real
>   blockquote semantics) — one short passage, never multi-paragraph narration and never your own
>   phrasing; "lead" is ONE standout intro sentence right
>   after a heading, at most one per surface. To emphasize, set "emphasis": true — never promote
>   text to a bigger heading.

Shape discipline per the Badge-brevity lesson (GH #1279): every register is bounded on WHEN and on
CONTENT SHAPE (word counts, cardinality, placement), not routed bare.

**Token budget (a2ui-prompt-authoring's mechanics):** the draft is ~880 chars ≈ **220 tokens**
(chars/4) on a 21,917-char ≈ 5,479-token grammar — a +4.0% mode-invariant cost riding all four
composed prompts. The inventory line's own growth is `|kicker|overline|quote|lead` = 27 chars ≈
**7 tokens**. Justified against the alternatives in §Alternatives A2: `Text` appears in effectively
every produced surface, so always-on placement matches usage frequency at roughly one mini-skill's
body cost WITHOUT consuming one of the 3 TF-IDF selection slots.

Baseline consequence: grammar.md is byte-pinned — the build recaptures
`prompt-equivalence.baseline.json` via the checked-in writer (`RECAPTURE_BASELINE=1`, deliberate
change). `prompt-drift.test.ts`'s inventory pin is an unanchored `toContain('variant:
h1|h2|h3|h4|h5|caption|body')` — append-only widening keeps it passing UNEDITED (the #808
amendment's own recorded mechanism); it is verified, never loosened.

## Alternatives

| # | Fork (GH #1321 Scope item) | Alternatives considered | Resolution |
|---|---|---|---|
| A1 | Exact enum membership (item 1 — parked for Kim) | (a) curated registers `+h6 +display`; (b) semantic-`as` additions `blockquote`/`p` as members; (c) full role×size cross-product | **RESOLVED-BY-RECOMMENDATION: the D1 four-member curation.** (a) falls to the ADR-0142 floor (`h6`) and the TKT-0082 defect class + `Stat` ownership (`display`); (b) confuses the axes — semantics ride the triples; (c) is (ii)/(iii) of D2 at full blast: a 297-combo vocabulary no compact teaching or validation story survives. Kim overrules at ratification. |
| A2 | Guidance home (item 3 — parked for Kim) | (a) `catalog.json` per-property description strings; (b) grammar.md clause; (c) a mini-skill module; (d) a standalone reference doc (the meta-line-vocabulary style) | **RESOLVED-BY-RECOMMENDATION: (b) grammar.md.** (a) is not composed today — `describePropType` (`catalog/catalog.ts`) emits type shape only, so it needs a derivation-code change that would push per-member prose into EVERY catalog's inventory (multi-catalog: `a2ui-basic`, personas) and into `produce.ts`'s self-correct path; heaviest option for the same tokens. (c) is TF-IDF trigger-selected on USER text, cap 3/turn — register choice is cross-cutting, not intent-shaped, so no trigger vocabulary reaches it reliably, and a firing evicts a real idiom from one of the 3 slots. (d) is unreachable from `buildSystemPrompt` — it fails #1321's own acceptance line ("reachable from the producer prompt path"). (b) is the ruled home for exactly this class (the Badge precedent, GH #1279/PR #1280) at a bounded +220 tokens. Kim overrules at ratification. |
| A3 | Wire `as`/`size` addressability (item 4 — parked for Kim) | (a) `variant` stays the single dial; (b) add wire `as` (the seed's "in addition to `as=...`" phrasing read literally); (c) add wire `as` AND `size` | **RESOLVED-BY-RECOMMENDATION: (a), per D2.** The seed's `as` phrasing is READ as "the guidance teaches variants alongside the `as` story the component already documents," not as a wire-schema demand — the component's `as` axis stays fully reachable to library consumers, and the two semantics a producer genuinely needs (`blockquote`, `p`) arrive through `quote`/`lead`'s triples. Kim overrules at ratification. |
| A4 | Amendment mechanics | (a) amendment-only on ADR-0078 (the #808 S1 shape); (b) this standalone ADR + on-ratification pointer repair on 0078 (the ADR-0142 shape) | **(b) taken.** #808 widened ONE member with no open forks; this record resolves three parked forks plus a teaching-home decision — a multi-fork decision earns its own number, with 0078's header gaining the mechanical pointer at ratification (the ADR-0142 REV 2026-08-13 precedent). GH #1321's own acceptance bullet names mechanism (a) verbatim ("widens only via a ratified `## Amendment`, the GH #808 S1 `label` precedent"); this record SUPERSEDES that mechanism clause on ratification — Kim ratifying ADR-0207 plus the 0078 pointer repair satisfies the bullet's operative intent ("amended, not bypassed") through the ADR-0142 shape instead. |

## Consequences

- **Renderer mapping** — `factories.ts` `TEXT_VARIANT_TABLE` +4 rows (~240 B source); the
  `applyProp` switch, the `href`-wins law, and the unknown-value → `body` fallback are untouched.
  No component change of any kind: every admitted register has shipped in `ui-text` since
  ADR-0078 cl.2b (2026-07-04) — this record only makes existing control capability wire-reachable
  (the #808 amendment's exact class).
- **Validator** — zero code: ADR-0098's generic enum gate (`conformance.ts`, schema-driven from
  `catalog.json`) covers the four members for free; an excluded value (`h6`, `display`,
  `blockquote`, `p`) keeps failing `CATALOG` exactly as any unknown member does.
- **Catalog row + factory tests** — `factories.test.ts`'s table-driven case list gains the same 4
  rows; `descriptor-agreement.test.ts`'s deliberate `Text.variant` exemption row stands (the
  translation-table rationale is unchanged; its NOTE prose refreshes to name four-more-members).
- **Conformance/corpus** — every existing payload, exemplar, fixture, and corpus shard is
  byte-identical (append-only enum). Optionally, ONE new corpus exemplar exercising
  `kicker`/`quote`/`lead` lands via judged admission (a2ui-corpus-curation — never hand-admitted);
  no disposition-allowlist entry is owed (nothing is refused).
- **Prompt surface** — the derived inventory line widens truthfully (+7 tokens); the D3 clause
  adds ~220 mode-invariant tokens; `prompt-equivalence.baseline.json` recaptures once,
  deliberately; `prompt-drift.test.ts`'s unanchored substring pin passes unedited (verified at
  build, not assumed). Dev-proxy note: prompt files load at module load — restart vite after the
  edit (the a2ui-prompt-authoring rule).
- **Size budget** — no component-family gz budget is touched (`packages/agent-ui/components` has
  zero changes; the 25600 B family budget is components-side). a2ui-side growth is ~240 B
  (factories) + ~880 B (grammar.md) + the recaptured baseline delta — noted, no gate exists or is
  owed here.
- **Docs** — spec §5.2 `Text` row and the a2ui-catalog LLD `textFactory` description repair at
  build (Repairs row); ADR-0078's header pointer repairs at ratification.

## Realization — build decomposition (the #1321 build leg; slices sized, gates named)

| Slice | Content | Size | Gate (exit-code, foreground) |
|---|---|---|---|
| **S1 — enum + fan-out** | `catalog.json` `Text.variant` +4 appended · `TEXT_VARIANT_TABLE` +4 rows · `factories.test.ts` +4 cases | S | `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog` green (factories · conformance · descriptor-agreement · catalog) |
| **S2 — teaching + baseline** | grammar.md D3 clause (final bytes ≤ the draft) · `RECAPTURE_BASELINE=1` recapture via the checked-in writer · verify the drift pin passed UNEDITED · restart vite; one live produce turn rendering a `quote`/`kicker` surface (the validates-cleanly-still-renders-wrong class) | S | `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` green + the live render check |
| **S3 — contract docs** | spec §5.2 `Text` row (enum prose + 4 triples) · LLD `textFactory` description · descriptor-agreement NOTE refresh | S | `npm run check` green (docs-grammar vitest rides `check:site`) |
| **S4 — corpus (optional)** | one judged-admission exemplar exercising `kicker`/`quote`/`lead` · site a2ui catalog page touch IF it enumerates the enum | S | corpus vitest incl. `admission-coverage` green |
| **S0 — on ratification (host)** | `adr_ratify.py` flip · ADR-0078 header pointer repair | — | `npm run check:scripts` green |

Order: S1 → S2 → S3; S4 any time after S1. Whole-wave gate: `npm run check && npm test` green by
EXIT CODES; `npm run test:browser` is untouched (no component change). If Kim rules against any
D1 member at ratification, the fallback is exact: drop that member's enum entry + table row +
test case + its guidance sentence — each member is severable, nothing else moves. If Kim
overrules A2 (the guidance home), S2 restructures to the chosen home — its guidance TEXT and the
baseline-recapture discipline carry over; only the landing file and its composition seam change.
If Kim overrules A3 (wire `as`/`size` addressability), a NEW decision record is owed for that
schema (property additions, coherence validation, inventory cost) — this ADR's D1 register set
and its wire-shape argument stand as recorded and are not silently reinterpreted.
