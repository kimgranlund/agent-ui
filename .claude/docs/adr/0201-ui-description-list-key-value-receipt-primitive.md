# ADR-0201 — `ui-description-list` (GH #1185): the key–value receipt primitive is minted as a Display-class data-driven control — `rows` as hardened data, empty-value omission by construction, superseding the #1174 grammar composition pattern

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | the GH [#1185](https://github.com/kimgranlund/agent-ui/issues/1185) build lane (Kim's mint-now ruling, find-open-questions round 2026-08-17 — the ruling closes WHETHER to mint; this ADR records the MECHANICS the build needs: anatomy, data model, omission law, tokens, catalog shape, grammar supersession) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-18, via the [`ratify ADR-0201` utterance](https://github.com/kimgranlund/agent-ui/issues/1185#issuecomment-5323431916) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: `controls/description-list/description-list.{ts,css,md}` + `description-list-model.ts` (the DOM-free hardening/codec module, the table-model.ts shape) + barrel export + jsdom/browser tests · the `DescriptionList` catalog row + factory + conformance · site doc page + the standing descriptor/site gates · the ONE `grammar.md` edit repointing the confirm-step receipt clause from the Column-of-Rows composition to the primitive (#1174 wrote that clause to be superseded) + baseline recapture |
> | **Supersedes / Superseded by** | **Supersedes** the GH #1174 grammar composition pattern's CONSTRUCTION half (the Column(gap xs) › per-field Row(gap sm, baseline) › label Text + value Text recipe — replaced by the primitive); the #1174 LAWS survive verbatim, relocated onto the new clause: value humanization stays the PRODUCER's job, empty-value omission (now enforced by construction, no longer prompt-only), adjacency (never `justify: between`, never two side-by-side columns), sentence-case headers. **Relates** ADR-0111 (the Display-class posture — ui-stat/ui-table precedent: no events, no geometry row, not form-associated) · ADR-0163/0173 (`safeJsonCodec` + hardening-function data props, the table `rows` precedent) · ADR-0078 (semantics/style split — type-scale registers without heading stamps) · ADR-0057 (meaning never travels by color alone — here meaning is real text throughout) |

## Context

GH #1174 shipped the confirm-step RECEIPT as a grammar-side composition pattern: a `Column` of
per-field `Row`s, each a label `Text` (variant `label`) with its value `Text` (variant `body`)
adjacent. That clause is the interim — its own report names it "written to be superseded" — and it
has three structural weaknesses a primitive removes:

- **The omission law is prompt-enforced only.** "A field with no value is OMITTED entirely" holds
  exactly as long as every producer obeys it; nothing in the render path prevents an empty row.
- **The rhythm is re-derived per payload.** Every producer re-spells the same gap/align/variant
  quartet; drift (a `justify: "between"` wash, a two-column label/value split) is a payload bug the
  validator cannot see.
- **Payload weight.** A 6-field receipt costs ~19 nodes (1 Column + 6 Rows + 12 Texts) where one
  node with a 6-entry data prop suffices — and a data prop is BINDABLE, so a receipt can ride the
  surface's data model and update in place.

The mint-vs-compose test (ADR-0175's reference, run for form-value aggregates but applied here as
the standing bar): the aggregate-value branch does not apply (no form value); composing stays
possible but leaves all three weaknesses standing; the mint is cheap — `UIElement` + one render
effect (the ui-stat whole-swap shape), one hardened JSON data prop (the ui-table `rows` codec
shape, verbatim), no new base class, no new event, no new geometry row.

## Decision

1. **Mint `ui-description-list` / `UIDescriptionListElement` (`controls/description-list/`),
   tier=`display`** — the ui-stat/ui-table Display-class posture exactly: extends `UIElement`, NOT
   form-associated, no events, no keyboard contract, no focus, no `size`/`scale` geometry row (the
   levers are the type matrix + the space ladder). Naming per the standing law: tag
   `ui-description-list`, class `UIDescriptionListElement`, tokens `--ui-description-list-*`. No
   new custom states (naming-gates untouched beyond the fleet tag list).

2. **Rows are DATA, not children** — `rows`, a JSON-attribute array prop of
   `{ label: string, value: string | number }`, hardened by `cleanDescriptionRows` in
   `description-list-model.ts` and carried by the same `safeJsonCodec` shape as
   `tableColumnsProp`/`tableRowsProp` (`from(null)` → `[]`, malformed JSON → `[]`, never throws;
   the property never holds an un-hardened array). Rejected: adjacency-list CHILDREN (the List/
   Timeline shape) — that would mint two more leaf tags (a term/value pair element) for what is a
   flat record, and the omission law would again depend on the author's discipline instead of the
   component's construction. The catalog analogy is `Table.rows` (typed data), not `List` children:
   a receipt is a RECORD rendered whole, not a collection the agent composes per-item. NOT
   reflected (a JSON-string attribute round-trips through the codec, never `setAttribute` — the
   `Table.rows` posture verbatim); bindable in the catalog.

3. **The empty-value omission law holds BY CONSTRUCTION.** `cleanDescriptionRows` DROPS (never
   renders, never stores): any non-object entry; any entry whose `label` is not a non-empty,
   non-whitespace string; any entry whose `value` is absent, `null`, a non-finite number, an empty
   or whitespace-only string, or any type other than string/number. A surviving number renders via
   the shared default-locale `Intl.NumberFormat` (the table/stat `formatNumber` precedent); a
   surviving string passes through VERBATIM — value humanization ("deluxe-king" → "Deluxe King",
   `true` → "Yes") stays the PRODUCER's job, the #1174 law unchanged.

4. **Anatomy — one render effect, whole-swap** (the ui-stat `replaceChildren` shape; no interior
   user state exists worth preserving): per surviving row one `<div data-part="row">` holding
   `<span data-part="label">` then `<span data-part="value">` in DOM order — the value ADJACENT to
   its label (a flex row, `align-items: baseline`, a fixed pair gap), never opposite-edge flushing,
   never a two-column label/value grid. The receipt rhythm the #1174 clause spelled as payload
   grammar becomes this component's CSS.

5. **No minted ARIA role.** The ui-stat precedent: real, selectable text in reading order (label →
   value, row by row) carries the whole meaning; no internals role is set. Rejected:
   `internals.role = 'list'` (wrong semantics — pairs, not items; a screen reader announcing "list,
   6 items" for 6 pairs misleads); ARIA `term`/`definition` roles and the draft `associationlist`
   family (uneven AT support, and `ElementInternals` cannot mint the native `<dl>/<dt>/<dd>`
   structure relationship anyway). The host stays role-free like `ui-stat`.

6. **Tokens (`--ui-description-list-*`, declared in the `:where()` token block, consumed only
   inside `@scope`):** `--ui-description-list-row-gap` (between rows — `--md-sys-space-xs`,
   density-riding, the #1174 Column gap "xs" made structural) ·
   `--ui-description-list-pair-gap` (label→value — `--md-sys-space-sm`, the Row gap "sm") ·
   `--ui-description-list-label-ink` (the secondary plane —
   `--md-sys-color-neutral-on-surface-variant`, the stat label ink) ·
   `--ui-description-list-label-size` (the label register — `--md-sys-typescale-label-medium-*`) —
   value ink inherits (`color: inherit`, body register `--md-sys-typescale-body-medium-*`). No
   forced-colors block needed: every part is real text (the stat lesson — only background-drawn
   shapes need one).

7. **Catalog: a `DescriptionList` row, INCLUDED from day one** (the mint's whole point — no
   temporary exclusion). One property: `rows` (array of `{label, value}` objects, `bindable: true`,
   `mapsTo: rows`) — a plain 1:1 accessor prop riding the generic `accessorFactory`
   (`setProp` assigns the array to the property; the codec's hardening runs on the property write
   path exactly as Table's does). No `value` mark (nothing two-way), no children key (rows are
   data), no label prop (a receipt's header is composed OUTSIDE — a `Text` heading above it, the
   #1174 sentence-case law unchanged). Feed disposition: FEED-INCLUDED (durable static content — a
   receipt is precisely what a feed transcript should retain; contrast Toast, excluded as
   self-removing).

8. **Grammar supersession — ONE edit.** The `grammar.md` confirm-step clause's construction
   sentence set (Column of Rows of Texts) is replaced by: build the receipt as a single
   `DescriptionList` with one `rows` entry per field. The surviving laws ride the new clause
   verbatim: humanize every value (producer-side), a field with no value is omitted (and the
   component now also drops it by construction), sentence-case headers, never `justify: between`.
   Baseline recapture (`RECAPTURE_BASELINE=1`) with the delta verified to be exactly this clause.

## Consequences

- A 6-field receipt drops from ~19 payload nodes to 1 node + 6 data entries, and becomes bindable
  (an amend-answer turn can update the receipt's data model in place instead of re-emitting the
  tree).
- The empty-row defect class the #1174 clause could only prohibit is now unrepresentable: the
  hardening drops valueless rows before they exist as property state.
- The fleet gains one Display-tier member: site-coverage's display array grows to 15
  (`description-list` requires its `{doc}` page), `measure-size.mjs` gains a per-control budget
  row (expected well under the ≤ ~2 kB tier: one effect + one codec, no interaction machinery),
  the dogfood bundle and site tier map (`a2ui-catalog-tiers.ts`, +1 type) regenerate.
- Producers keep humanization responsibility — the component never invents "Yes"/"No" or title-
  cases an enum id; a raw `true` that a producer leaks now renders as the literal string `"true"`
  only if sent as a string (a boolean `value` is DROPPED by the hardening — a nudge back toward
  the humanization law, not a silent repair of its violation).
- If ratification declines the data-prop shape in favor of children, the render effect and codec
  are the only discard — the CSS rhythm, tokens, and grammar clause survive either shape.
