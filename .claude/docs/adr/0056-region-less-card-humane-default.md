# ADR-0056 — the region-less card gets a CSS humane default (no factory auto-wrap) + the Card region pedagogy

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-02 — fork F4 ruled (d)+(b) [the CSS humane default + the pedagogy contract], recommendation-defaulted and CONFIRMED by Kim ("proceed"); ratified by the orchestrator on the green wave gate: the fallback leg + cross-engine probes [incl. the streaming :has() flip and the byte-identical region-card no-regression leg] shipped; the nested card>card radius case verified UNCHANGED by the fallback — a pre-existing ADR-0018 depth-≥2 cycle, honestly re-documented after the builder's own browser gate falsified its first draft; all three pedagogy legs live: the seeds model the idiom, the SPEC §5.2 composition note, the patterns-page teaching block)* |
> | **Date** | 2026-07-02 |
> | **Proposed by** | planner (design seat — item 4 of the streaming/examples intake, from Kim's forked diagnosis of the 8 bare example Cards) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-02, on the green wave gate; the fork ruling confirmed by Kim |
> | **Repairs** | `controls/card/card.css` (+ its browser probe — the fallback leg; **component-builder territory**, cross-package) · `a2ui-catalog.spec.md` §5.2 `Card` row (the composition note) · `card.md` (documents the fallback + when real regions are REQUIRED) — all edited at build time, gated on this ADR's ratification |
> | **Supersedes / Superseded by** | None. **Extends ADR-0046** (the container box-model — adds the region-less fallback leg to its "card holds no padding" law) · relates ADR-0053 (the catalog rows the pedagogy teaches) · ADR-0055 (the seeds that model the idiom from birth) · ADR-0018 (the nested-radius chain the fallback must not re-break) |

## Context

All 8 example Cards across the 4 A2UI pages composed BARE children (`Card > form/column`) — no payload ever
emitted a `CardContent` region, so the ADR-0046 box-model never engaged: `ui-card` holds zero padding BY LAW
(`--ui-card-padding: 0`; spacing rides the region sub-elements), and every card rendered cramped. The pages
are corrected in the working tree (`Card > CardContent > …`), but the diagnosis generalizes: A2UI's Basic
catalog `Card` has no region types, so an LLM conditioned on Basic (or on nothing) will emit bare-children
Cards as its DEFAULT — the wild payload our first-party catalog renders worst is the one agents are most
likely to produce. The fork: should the client repair this (and where — factory or CSS), or teach it away?

## Decision

Two legs, both ratified together:

1. **The humane default is COMPONENT-SIDE CSS, not a factory rewrite.** `card.css` gains a region-less
   fallback: a `ui-card` with NO region child (`:not(:has(> ui-card-header, > ui-card-content,
   > ui-card-footer))` — the sheet already keys its grid rows off the same `:has()` structures) applies
   region-equivalent spacing to its own box (the `--ui-card-region-pad-*` values + the content rhythm), so
   a bare-children card reads as a padded card by default. The fallback flips OFF automatically the moment
   any region child exists — streaming-safe by construction (a late-arriving `CardHeader` re-evaluates the
   `:has()`), no double-anything for region-aware payloads, and plain-markup consumers get the same mercy.
   The payload tree, the component tree, and the DOM stay IDENTICAL — no synthetic elements. Mixed
   composition (a region PLUS loose siblings) gets no fallback — regions present means the author owns the
   structure; the loose siblings' rendering is their responsibility (documented, not repaired). The
   nested-radius chain (ADR-0018/0046, re-based off content padding) must be re-verified under the
   fallback for the `card > card` direct-nesting case the sheet already documents.
2. **The pedagogy is the contract; the fallback is the net.** Real regions remain the taught, capability-
   bearing idiom (sticky header/footer and `scrollable` content REQUIRE them — the fallback cannot give
   those): the ADR-0055 seeds model `Card > CardContent` from birth (a bare-children Card in a seed fails
   review); the catalog SPEC §5.2 `Card` row gains the composition note ("children SHOULD be region
   sub-types; a region-less card renders with the fallback padding; sticky/scroll require regions"); the
   patterns page gains a short "composing containers" teaching block (Card regions · Field wraps ONE
   control · Select > Option children).

## Consequences

- **The visual contract of a bare `<ui-card>` changes fleet-wide** (components package, not just A2UI):
  today's zero-padding bare card becomes a padded one. Anyone relying on a bare card as an unpadded frame
  must now add `--ui-card-padding: 0` back or use a region — judged acceptable: the shipped pages
  themselves proved nobody composes a bare card on purpose. Cross-engine `:has()` re-evaluation is the
  load-bearing mechanism — the browser gate (both engines) must probe the fallback AND the late-region
  flip; jsdom cannot (no `:has()` matching in cascade).
- **The corpus signal stays clean:** payload tree ≡ DOM tree, so an exemplar that omits regions is
  visibly identical in structure to what it renders — the tier-2 rubric can still prefer explicit regions
  without the renderer having silently rewritten anything.
- **The factory/renderer stay untouched** — no `childrenTarget` seam, no list-anchor rerouting through
  the highest-risk shipped path (list.ts), no shown≡fed tension.
- **Modal boundary flagged, not settled:** `ui-modal` composes the same container-box; the catalog `Modal`
  row has no region types at all. Whether Modal payloads need the same fallback (or region types) is a
  named follow-up check, deliberately outside this ADR.
- **Stale → re-verify:** `card.css` + card browser probes · `card.md` · catalog SPEC §5.2 Card row ·
  the ADR-0055 seed review rule · ADR-0046's "card holds no padding" phrasing (now "…unless region-less").

## Acceptance

- Browser, both engines: a bare-children `ui-card` renders with region-equivalent padding + rhythm; adding
  a `CardContent` (or any region) at runtime drops the fallback with no double padding; a region-aware
  card is byte-identical to today (negative control).
- The A2UI path: the SAME bare-Card payload that rendered cramped renders padded through the real host,
  with the rendered DOM containing NO element absent from the payload tree.
- Nested `card > card` (direct, no region) keeps the concentric-radius law.
- The seeds contain zero bare-children Cards; the patterns page shows the composition block; SPEC §5.2
  states the rule.

## Alternatives considered

- **(a) Factory always-wraps loose children in a content region** — rejected: region-aware payloads would
  double-wrap; even "wrap only loose ones" makes the rendered tree diverge from the payload tree (a
  catalog-visible element the agent never emitted), diluting the corpus signal and opening the
  auto-repair slope (why not wrap loose options in groups next?).
- **(c) Factory wraps only when NO region child is present** — the offered sweet spot, rejected on
  mechanics: detection must be stable under streaming (a region child may arrive AFTER loose ones —
  out-of-order tolerance is a shipped guarantee), so it degenerates to per-child routing through a new
  `childrenTarget` factory seam that must also reroute list-template anchors (list.ts) — a renderer
  contract widening through the riskiest shipped path, to synthesize DOM the CSS fallback gets for free.
  Held in reserve ONLY if evidence shows CSS-insufficient cases (e.g. a wild-payload eval demanding
  sticky headers by default).
- **(b) Teach the idiom, change nothing** — rejected as the ONLY leg: the corpus can condition OUR
  pipeline's agents, but bare-Card payloads are the expected WILD input (Basic's Card has no regions); a
  first-party catalog that renders the expected wild input worst is a product defect, not a pedagogy gap.
  Kept as leg 2 — the fallback never replaces the taught idiom, it catches what teaching misses.
