# ADR-0214 — A2UI `SourceList` — source attribution as ONE hardened data-prop leaf (mint; the source-card list ships, the in-prose citation marker is structurally out of reach and fenced as its own later intake)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19

> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning seat (planning-leader dispatch on Kim's three-widget charter), on [GH #1370](https://github.com/kimgranlund/agent-ui/issues/1370) — semantic source attribution, the core agentic-trust pattern |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0214` utterance](https://github.com/kimgranlund/agent-ui/issues/1370#issuecomment-5343986037) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (design-only NOW — nothing below is applied by this ADR): `a2ui/src/catalog/default/catalog.json` (the new `SourceList` row per the Decision) · [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.2 (the row delta drafted in "SPEC §5.2 row delta" below) + the preamble's shipped-set enumeration · NEW control `packages/agent-ui/components/src/controls/source-list/` (`ui-source-list`: `.md` descriptor + generated props + control + CSS + tests; ADR-0087/SPEC-N2 descriptor↔row agreement) · `a2ui/src/agent/feed-catalog.ts` (`FEED_SURFACE_TYPES` gains `SourceList` — the partition gate forces the disposition; this ADR rules IN) · `live-agent/prompt-equivalence.baseline.json` (recapture, `RECAPTURE_BASELINE=1` — the ADR-0207/0209 precedent) · a corpus seed demonstrating a cited answer (rows graded ≥4 vs `rubrics/a2ui-catalog.md` + `rubrics/a2ui-catalog-example.md`; C1 seed-visibility per the issue's DoD — the href must demonstrably land as a real gated `<a>`) · component tests: the per-entry `safeHref` gate (denied scheme strips the link, never an announced-broken anchor), the drop-malformed-entries cleaner |
> | **Supersedes / Superseded by** | **Relates [ADR-0114](./0114-text-hyperlink-href.md)** (the two-gate safe-href law this type's per-entry hrefs ride — with the honest static-leg limitation recorded in Context fact 2) · **[ADR-0201](./0201-ui-description-list-key-value-receipt-primitive.md)** (the aggregate-data-prop mint precedent and hardening idiom this decision reuses — `DescriptionList.rows` is the shipped shape `sources` mirrors) · **[ADR-0184](./0184-status-stream-reasoning-trace-extension.md)** (the territory boundary: live reasoning narration is `ui-status-stream`'s, a PERMANENT catalog exclusion — durable source attribution is catalog content; if a live trace ever wants mid-run citations, that is a status-stream extension fork, not this type's) (permanence: ADR-0122 F5 / spec §5.2.1) · **[ADR-0112](./0112-feed-family-v1-scope.md)** (`Attachment` — the compact reference-card anatomy precedent, incl. its `href` follow-up lesson) · smallest-floor method: ADR-0107 → [ADR-0205](./0205-line-chart-v1-axis-vocabulary.md) (`component-design` `references/mint-vs-compose.md`) · GH #1370 |

## Context

**The gap (TYPE).** A source reference carrying href + title + snippet + index as a semantic unit
is the core agentic-trust pattern (every 2026 agentic-UX survey — grounded answers cite sources).
The catalog (66 types, verified 2026-08-19) has no source territory: today's hack is `Text` +
`href`, which loses the marker/card duality, the numbered-source gestalt, and any per-source
snippet. Composition CAN approximate the card half — a `List` of `Card`s with `Text.href` titles
— but two laws then live only in producer prose:

1. **Marker↔card index consistency.** The whole point of a numbered source list is that "[2]"
   means THE second source; a composed list has N independently-authored index literals that
   nothing reconciles (the exact enforcement-locus failure ADR-0201 minted `DescriptionList`
   over: a law only prompt discipline upholds, which a primitive enforces by construction —
   indexes assigned by POSITION cannot drift).
2. **No-dead-source hygiene.** A source row with a denied/empty href or an empty title is
   attribution theater; a composition renders it happily. The ADR-0201 cleaner idiom drops such
   entries before they exist as state.

Plus ADR-0201's supporting signals verbatim: a 4-source composed list costs ~20 nodes vs ONE leaf
with a 4-entry bindable prop — and bindable means the producer can stream/extend sources via
`updateDataModel` as retrieval completes.

**Verified mechanics this decision stands on** (inspected 2026-08-19, not recalled):

1. **The aggregate-leaf shape is shipped and proven.** `DescriptionList.rows`
   (`catalog/default/catalog.json`: bindable array-of-objects with `required` keys) + control-side
   `cleanDescriptionRows` (ADR-0201) — validator, renderer, and prompt-baseline machinery all
   already handle this PropDef shape generically.
2. **The static safe-href leg does NOT descend into array items.** `conformance.ts:82` fires
   `matchesSafeHref` only when `pd.format === 'safe-href' && typeof value === 'string'` — a
   top-level string prop. Per-entry hrefs inside a `sources` array are statically UNCHECKED
   today. The component-side gate is therefore load-bearing: `controls/text/href.ts`'s `safeHref`
   resolver (ADR-0114) is the sole writer of any stamped `<a>`'s `href`/`rel`/`target`; denied or
   empty strips all three, rendering plain text — never an announced-broken link. Whether the
   validator grows per-entry format descent is an LLD fork for the build wave (relates ADR-0098's
   generic-enforcement discipline), NOT assumed here.
3. **The in-prose marker has no rendering vehicle.** `Text.text` is one string; catalog children
   are box-level nodes (`Row`/`Column`/`List` arrangement) — there is NO inline rich-text
   mechanism anywhere in the catalog's rendering model, so a "[1]" marker INSIDE a sentence
   cannot be a catalog node without either a `Text` micro-syntax widening or the markdown surface
   (`@agent-ui/code`'s `ui-markdown` — catalog-invisible by construction, ADR-0119/CLAUDE.md).
   Any "both renderings of one type" design would be pretending this mechanism exists.
4. **`role=list` is free.** The catalog's `List` carries `role=list` (ADR-0087 Fork A); a
   dedicated source leaf hosting its own rows carries its own list semantics internally — no
   `SourceList`-container-plus-`Source`-children split is needed for a11y.

## Decision

Four clauses.

1. **Mint catalog type `SourceList` → new control `ui-source-list`.** ONE aggregate leaf (the
   `DescriptionList` shape), NOT a `Source` card child type hosted in a plain `List`: the
   index-consistency law (Context 1) only becomes structural when one element owns ALL the rows
   and numbers them by position; a per-source child type re-opens exactly the drift the mint is
   for. A single source card is a one-entry `SourceList`.
2. **Wire shape:** `sources` (bindable, `mapsTo:'sources'`) — array of
   `{ href: string, title: string, snippet?: string }`. Control-side `cleanSources` (the ADR-0201
   idiom) drops entries with an empty title BY CONSTRUCTION; an entry whose href the `safeHref`
   gate denies renders its title as PLAIN TEXT (the ADR-0114 degrade — attribution survives, the
   link does not). **No producer-authored `index`** — markers are assigned by array position
   (1-based), making marker↔row drift unrepresentable (Context 1). Display-only leaf: no `value`
   mark, no `action`, no `ChildList`.
3. **Anatomy floor** (geometry/exact parts are the build LLD's): a numbered row per source —
   positional index marker + title-as-gated-link + optional muted snippet. The per-entry href
   crosses the component-side `safeHref` gate (Context 2) — the sole writer of `href`/`rel`/
   `target`, the `Text.href`/`Attachment.href` contract verbatim.
4. **Feed disposition: IN.** Static, non-interactive attribution content with no overlay/
   pagination/dashboard shape — the `DescriptionList` parity argument exactly (ADR-0201 ruled the
   receipt IN as ask furniture; a grounded ask cites its sources the same way), and its links are
   the same class `Text.href` already brings into the feed set. The partition gate forces the
   disposition at build time; this clause records IN and why.

## SPEC §5.2 row delta (drafted here, UNAPPLIED — the build wave lands it)

| Type | Control | Notes |
|---|---|---|
| `SourceList` | `ui-source-list` | **shipped** (ADR-0214). Source attribution — a hardened aggregate leaf (the `DescriptionList` shape, ADR-0201): bindable `sources` array of `{href, title, snippet?}`; control-side `cleanSources` drops empty-title entries before they exist as state; index markers are POSITIONAL (1-based, never producer-authored — marker↔row drift unrepresentable). Each entry's `href` crosses the component-side `safeHref` gate (ADR-0114 — sole writer of `href`/`rel`/`target`; denied/empty renders the title as plain text, attribution kept, link stripped; NOTE: the static `format:'safe-href'` leg does not descend into array items — the component gate is load-bearing, `conformance.ts:82`). Display-only leaf: no `value` mark, no `action`, no children. Feed sub-catalog: **IN** (ADR-0214 cl.4, the `DescriptionList` parity argument) |

Plus the §5.2 preamble gains "PLUS the 1 type landed by the source-attribution wave (ADR-0214) —
`SourceList`", per the standing pattern.

## Alternatives considered

- **Keep composing (`List` of `Card`s + `Text.href`)** — rejected: index consistency and
  no-dead-source hygiene stay prompt-enforced (Context 1-2, the ADR-0201 enforcement-locus bar,
  crossed); ~5× payload weight; no single bindable prop to stream sources into.
- **A `Source` card child type in a plain `List`** — rejected: positional numbering (the law that
  makes "[2]" trustworthy) needs one owner of all rows; N siblings re-open index drift. A
  container/child pair costs two types where one leaf suffices (smallest floor).
- **One type, TWO renderings (inline marker + card)** — rejected on mechanism, not taste: the
  catalog has no inline rich-text vehicle (Context 3); shipping the type while its marker half is
  unrenderable would be a paper capability.
- **Widen `Text` with a citation micro-syntax** (e.g. `[1]` tokens resolved against a sibling
  `SourceList`) — rejected for v1: it invents a cross-node reference mechanism the catalog has
  nowhere, and its natural home is the markdown/rich-prose surface — fenced below.
- **Widen `Attachment`** — rejected: `Attachment` is `FilePart`-aligned (mime/size semantics, a
  file the conversation carries); a source is a claim's evidence (title/snippet/index semantics).
  One card LOOK, two different contracts — the Badge/Chip lesson from the same charter.

## Out of scope (the smallest-floor fences — each a named LATER intake, never a rider)

- **The in-prose citation marker** ("[1]" inside a sentence, marker↔card hover/scroll linking) —
  needs an inline rich-text mechanism (a `Text` micro-syntax, or `ui-markdown` territory outside
  the catalog); its own intake, citing Context fact 3.
- **Favicon/domain glyphs, retrieved-at timestamps, confidence scores** — anatomy widenings a
  real consumer must demand first.
- **Cross-surface dedupe** (the same source cited by two answers) — producer-side.
- **Per-entry static validator descent** (`format` inside array items) — the build LLD's fork
  (Context fact 2), not silently assumed.
