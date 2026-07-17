# ADR-0146 — the live-turn lifecycle channel: progress meta-lines riding the existing stream DURING the turn, a `warning`-extended status vocabulary, a status-stream header + grouped entries (reusing ADR-0143's nesting), and a two-slice build

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat ([TKT-0083](../tickets/tkt-0083-live-turn-lifecycle-feedback.md) intake — Kim's two-part ask: identify the most granular lifecycle data the fleet can leverage, then design the fix for the WHOLE pipeline — plus the mid-intake raise to "sophisticated": a multi-level accordion of grouped reasoning steps and a streaming header with a richer status vocabulary) |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build: `packages/agent-ui/a2ui/src/agent/{meta-line.ts,agent-transport.ts,produce.ts,providers/anthropic.ts,recorded-transport.ts}` (the progress envelope kind + the additive provider `onEvent` seam + interleaved progress yields + synthetic recorded stages) · `packages/agent-ui/components/src/controls/status-stream/*` (+`timeline-item/*` for the `warning` member) · `packages/agent-ui/app/src/controls/conversation/conversation.ts` (`AgentTurnHandle.progress` + ingest-time narration) · consumer turn loops (`site/pages/a2ui-chat.ts`/`a2ui-live.ts`/`site/lib/admin-live-runner.ts`) · docs-only NOW (this intake): [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R5/N4 amendment · [`../spec/app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) SPEC-R6/§4 amendment · [`../spec/timeline-family.spec.md`](../spec/timeline-family.spec.md) status-vocabulary/header/grouping amendment · NEW [`../decompositions/live-turn-lifecycle-feedback.decomp.json`](../decompositions/live-turn-lifecycle-feedback.decomp.json) · [TKT-0083](../tickets/tkt-0083-live-turn-lifecycle-feedback.md) |
> | **Supersedes / Superseded by** | Extends [ADR-0088](./0088-a2ui-live-conversational-channel.md) (the `a2uiMeta` envelope gains a runtime-composed `progress` kind, and meta-lines may now interleave DURING the turn — 0088's note/trace/ask decisions stand; its "typed frame if meta kinds proliferate" trigger is weighed and re-deferred, F1) · Extends [ADR-0122](./0122-timeline-family-and-live-status-stream.md) (F3's status enum gains `warning`; F4's imperative API gains a `parent` key + a header — the five-axis host split stands) · Composes on [ADR-0143](./0143-timeline-item-recursive-nesting-accordion.md) (grouping REUSES its `[data-role="nested"]` slot + shared disclosure + collapsed-summary preview — no second nesting mechanism, F5) · Relates [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the day-old ratified `./agent` export is why `AgentTransport.turn()`'s signature stays byte-identical) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (every new status/stage signifier is icon-coded, never color-only) · [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) F3 (the opt-in disclosure precedent F3 reuses for raw reasoning text) |

## Context

TKT-0083, grep/read-verified three layers deep against the shipped tree (all paths re-verified at this
intake against the post-ADR-0137 `src/agent/` home):

1. **Narration is 100% post-hoc.** `beginAgentTurn()` appends a `<ui-status-stream>` immediately
   (`conversation.ts:307-317`), but `narrateCategories()` — the only writer of visible entries — runs
   exclusively inside `finalize()` (`conversation.ts:384`). An empty `ui-status-stream` renders zero
   visible pixels (`label` is `aria-label` only — `status-stream.ts:81`), so the agent bubble is BLANK
   for the whole generation.
2. **`produce()` buffers everything.** The round loop accumulates the full model response
   (`produce.ts:345-352`) and first yields after assemble+heal+validate (`produce.ts:367`/`399`-`401`).
   This half is RATIFIED behavior — validate-then-stream (SPEC-R5) — the A2UI content MUST NOT stream
   early. What is missing is any signal BESIDE the content while it buffers.
3. **The granular data exists and is discarded at the first parse.** `parseAnthropicSSE`
   (`anthropic.ts:80-108`) yields only `content_block_delta` text; `message_start` (request
   acknowledged), `content_block_start` (generation began), thinking deltas (reasoning), and
   `message_delta`/`message_stop` (done) are dropped by design — its own docstring says so
   (`anthropic.ts:14-15`). `produce()` additionally OBSERVES stages it never reports: request sent,
   first fragment, assemble/heal/validate, a self-correct retry, the final yield.

ADR-0122 shipped `ui-status-stream` under exactly the "as it is occurring" ambition and built the
machinery (imperative keyed API, tail-follow, completion invariant) — nothing live has ever fed it.
On the display side, `ui-timeline-item.status` is the flat 4-state `''|pending|active|done|error`
(`timeline-item.ts:45`), no grouping exists, and TODAY's sibling record ADR-0143 (proposed) just gave
`ui-timeline-item` a `[data-role="nested"]` slot composing a nested `<ui-timeline>` under one shared
`ui-disclosure` — a directly reusable nesting mechanism this intake must compose, not duplicate
(the family-coherence law ADR-0143 F1 itself applied: never a second nesting primitive).

## Decision

Eight forks, each with a firm recommendation; F1/F5 are the contract-shaping ones. Nothing here is
self-ratified — Kim rules, particularly on F2 (the honesty-law reading) and F3 (product posture).

### F1 — wire shape: progress rides the SAME `AsyncIterable<string>` as interleaved `{"a2uiMeta":{"progress":…}}` meta-lines; the provider seam gains an additive optional callback. NOT a typed-frame break, NOT a side channel

**Recommendation: generalize ADR-0088's reserved envelope.** The `a2uiMeta` envelope gains a fourth,
RUNTIME-COMPOSED kind — `progress` — and the "one leading meta-line" convention generalizes to
"meta-lines MAY also interleave DURING the turn." A progress line is a closed-vocabulary event:

```ts
interface TurnProgress {
  stage: 'sent' | 'started' | 'reasoning' | 'content' | 'validating' | 'retry' | 'done'
  round?: number      // self-correct round ordinal, on 'retry'
  detail?: string     // optional factual text (F3-gated; never required for any stage)
}
// carried as {"a2uiMeta":{"progress":{…}}} — one JSON line on the SAME turn() stream
```

- `AgentTransport.turn(input): AsyncIterable<string>` stays **byte-identical** — load-bearing because
  ADR-0137 ratified `./agent` as a public surface ONE day ago; a discriminated-union stream
  (`AsyncIterable<{kind:'progress'|'content'}>`) would break every consumer (`a2ui-live.ts`,
  `a2ui-chat.ts`, `admin-live-runner.ts`, the recorded transport, `round-trip.test.ts`, the dev-proxy
  NDJSON protocol) on a day-old contract.
- The dev proxy needs **no protocol change**: it already writes each yielded line
  (`dev-proxy-plugin.ts:257-259`); progress lines flush as ordinary NDJSON lines as `produce()` yields
  them mid-loop. TKT-0083's "distinguishable from real A2UI content" acceptance is met by the SAME
  discriminator every meta kind already uses: no `version` key ⇒ provably not an `A2uiServerMessage`,
  and a leaked line fault-isolates to `VERSION_UNSUPPORTED`, returned not thrown (ADR-0088's own
  defense-in-depth, unchanged).
- Consumer loops already filter per-line via `readMetaLine` (`a2ui-chat.ts:144`) — routing
  `meta.progress` to the turn handle is the same filter growing one arm, not a new parse path.
- **The ADR-0088 trigger, weighed honestly:** 0088 recorded the typed frame as "the natural upgrade if
  meta kinds proliferate." Four kinds now exist (`note`/`trace`/`ask`/`progress`) — the trigger
  arguably fires. Re-deferred anyway, deliberately: every kind is a closed, runtime-or-model-authored
  JSON object behind ONE `readMetaLine` guard that has scaled through three prior additions without
  incident, and the break cost is categorically higher now than in 0088's day (then an internal demo
  seam; today a ratified export). The trigger is re-affirmed with a sharper predicate: upgrade when a
  meta kind needs ORDERING guarantees relative to content lines that in-band framing cannot give, not
  merely when kinds count up.
- **The provider seam** (`AgentProvider.stream`) gains an OPTIONAL request member —
  `onEvent?: (ev: ProviderEvent) => void`, `ProviderEvent = {kind:'message_start'|'block_start'|'thinking'|'block_stop'|'done', text?: string}`
  — the exact additive precedent `effort?` set on this same interface (`agent-transport.ts:89-104`):
  a stub/adapter that ignores it is byte-behavior-unchanged; the Anthropic adapter maps its already-
  parsed-and-dropped SSE events onto it inside `parseAnthropicSSE`'s existing frame walk. A callback
  (not a union-yielding stream) because inside `produce()` there is exactly one caller and the text
  accumulation contract must not change; on `AgentTransport` the signal must cross an HTTP wire, so
  THERE it is in-band lines — the asymmetry is principled, not accidental.
- `produce()` composes provider events + its OWN loop stages (`sent` before `stream()`, `started` on
  the provider's first signal, `content` on the round's OWN first text fragment — `produce()` is that
  stage's one pinned emitter, `validating` after accumulation, `retry` with the round ordinal on a
  failed round, `done` before the final content yield) into progress lines yielded AS THEY HAPPEN. Validate-then-stream is UNTOUCHED: no
  A2UI content line ever precedes validation; progress is not content and never enters
  heal/validate/corpus (the SPEC-R5 amendment states this normatively).
- **Recorded/keyless parity** (the TKT-0083 acceptance bullet): `RecordedTurn` gains an optional
  `progress?: TurnProgress[]` replayed with plausible pacing ahead of the turn's lines — the same
  optional-field pattern `note`/`ask` already follow (`recorded-transport.ts:35-40`), so the docs
  site's default demo demonstrates the feature with zero key.

**Rejected:** the discriminated-union `turn()` (breaks the day-old ratified export + the NDJSON
protocol for a shape the meta-line already carries); a separate progress callback/channel on
`AgentTransport` (splits one turn's story across two channels with no ordering guarantee between
them, and the recorded transport would need a second parallel mechanism to keep parity).

### F2 — the honesty law: a factual process-stage label does NOT conflict with SPEC-R6/ADR-0088 — recommended reading for Kim's ratification, plus a normative guard

**Recommendation: no conflict — process claims and content claims are different kinds.** ADR-0088's
law bars a FABRICATED sentence about outcome/content; SPEC-R6's codification of it
(`app-surfaces-m2.spec.md`, proposed) words the boundary as "the `summarize()` fallback tally is the
only synthesized text, and it states counts, never invented prose." The shipped narration already
renders fixed factual process labels from a closed code-owned table ("Opening a new surface…",
`conversation.ts:104-109`) — shipped and independently reviewed under that law. A stage label ("Reasoning…", "Validating…") derived 1:1 from a REAL observed
signal (`thinking` delta arrived; validate entered) is the same class of claim: a factual report of
an observed process event, never model-authored prose and never a claim about what the content says.
The guard that keeps this honest, made normative in the app-surfaces-m2 amendment: **stage labels
MUST come from a closed, code-owned label table keyed by observed lifecycle signals — never model
text, never a speculative or decorative claim (no invented percentages, no "almost done…"), and a
stage never observed is never shown.** This is a recommended READING of the law, not an assumption —
it needs Kim's ruling with this ADR.

### F3 — raw reasoning text: hidden by default at BOTH layers; a generic "Reasoning…" stage is the default surface

**Recommendation: conservative.** Anthropic `thinking` deltas flow only when extended thinking is on
(the `effort` dial, `anthropic.ts:119-136`), and carry raw chain-of-thought. Default posture:

- **Pipeline:** `ProduceOptions` gains `progressDetail?: 'stages' | 'full'` (absent ⇒ `'stages'`).
  At `'stages'`, `produce()` forwards the `reasoning` stage TRANSITION only — no thinking text
  crosses the wire. `'full'` forwards bounded excerpts on `TurnProgress.detail` — an explicit
  consumer opt-in, never the default.
- **UI:** the default rendering is the generic grouped "Reasoning…" entry; raw text (when a consumer
  opted in) renders ONLY behind the existing opt-in disclosure-class affordance (the ADR-0129 F3
  `disclosure` precedent — collapsed by default, inspect on demand).

**The tradeoff, named:** raw CoT is genuinely useful for debugging/power users and hiding it costs
transparency; but it is unpolished, sometimes wrong-then-corrected text that reads as a claim,
it token-spams a `role="log"` polite live region, and the ecosystem precedent (OpenAI's collapsed
"Thinking…", Perplexity's staged progress — the ticket's dated research) treats hiding as product
policy, not limitation. Default-hidden with two explicit opt-in gates keeps both audiences honest.

### F4 — per-provider variance: the stage vocabulary is produce-layer-owned; adapters map INTO it; nothing forecloses OpenAI/Gemini

**Recommendation:** the `TurnProgress.stage` union is defined at the produce/meta-envelope layer,
provider-agnostic. Each adapter maps its OWN upstream events onto the optional `onEvent` callback
(SPEC-N5's one-module-per-upstream isolation, unchanged); an adapter that maps nothing — or the
unimplemented OpenAI/Gemini stubs whenever they land — degrades to the stages `produce()` observes
by itself (`sent` → `started` on first fragment → `validating` → `done`): a coarser dial, never a
broken one. Only Anthropic is designed here (the only implemented adapter); the seam is the
extension point, deliberately additive.

### F5 — grouping: NO new component — `StatusEntry` gains a `parent` key; the DOM realization IS ADR-0143's nested slot + shared disclosure

**Recommendation: compose, never mint.** `ui-status-stream`'s imperative API gains one optional
field — `StatusEntry.parent?: string` (an existing entry's key). When set, the host lazily mounts a
nested `<ui-timeline>` into the parent item's `[data-role="nested"]` slot and appends the child item
THERE — exactly the mechanism ADR-0143 F1/F2 just ruled for `ui-timeline-item` (the shared composed
`ui-disclosure` wrapping `detail`+`nested`, the collapsed-summary preview F3, independent per-level
rails F4, no size cascade F7 — all inherited verbatim, zero new nesting machinery). The stream's
keyed registry stays FLAT (keys unique across the whole strip; `update(key, patch)` reaches nested
entries identically), tail-follow/scroll stays the OUTER host's alone (the nested `ui-timeline` is
durable, owns no scroll — the ADR-0122 F1 axis split undisturbed), and inspection-on-demand falls
out of the disclosure for free (the TKT-0083 inspection acceptance). A `ui-timeline-group` element
would be the second nesting primitive the family-coherence law bars, one week after the first shipped.
**Sequencing dependency, named:** this leg composes ADR-0143's build — it lands WITH or AFTER the
nested slot ships, never before (the decomposition encodes it as a real graph edge: an external-gate
leaf, satisfied only by TKT-0091's build, blocks the grouping node).

**Rejected:** a new `ui-timeline-group` element (a second nesting mechanism; fails the same test
ADR-0143 F1 just ran); grouping via bespoke status-stream-internal DOM (same duplication one layer
down, and it would orphan the durable host's identical need).

### F6 — status escalation: worst-child-wins over ONE closed severity ladder, recomputed live

**Recommendation:** a group header's status = the WORST of its children's, under the total order
**`error` > `warning` > `active` > `pending` > `done`** (neutral `''` children contribute nothing).
Why this rule: it is monotone-truthful as children settle (a group never reads calmer than its worst
child — the same fail-closed posture as the ADR-0122 F4 completion invariant), it is predictable and
one-glyph-codeable per ADR-0057 (each status already carries a distinct non-color signifier — the
header simply wears the escalated one), and it degrades correctly mid-flight: a group with one
`error` child and one still-`active` child reads `error` (the truth that something already failed
outranks "still working"; the running child's own row still shows `active`). Recomputed live via the
same `MutationObserver` class ADR-0143 F3 already installs on the nested subtree — one observer
serves both the collapsed-summary preview and the escalation. **Rejected:** most-recent-child (hides
a failure the moment a later step starts); manual consumer-set-only (the consumer would re-implement
this exact reduce, wrongly, per app).

### F7 — status vocabulary: EXTEND with `warning`; never rename the shipped enum

**Recommendation:** `ui-timeline-item.status` becomes `'' | pending | active | done | error | warning`
— ONE new member. Kim's named vocabulary maps onto the shipped enum almost entirely: waiting ≡
`pending`, working ≡ `active`, success ≡ `done`, danger ≡ `error`; only **`warning`** (a lesser
advisory outcome the single `error` state cannot express) is genuinely missing. Renaming the four to
Kim's words would break the ratified ADR-0122 F3 contract, the emittable `TimelineItem` catalog row,
the A2A `TaskState` §guidance mapping, and every shipped consumer — for zero semantic gain. `warning`
gets its own distinct marker glyph (ADR-0057: shape first, hue second — the build picks the glyph;
the RULE that it is non-color-coded is normative) and joins the escalation ladder (F6) and the
catalog row's enum (an a2ui-builder follow-up slice, the ADR-0122 F5 pattern).

### F8 — the streaming header: an opt-in visible header on `ui-status-stream` carrying label + the turn's live overall status

**Recommendation:** `ui-status-stream` gains a reflected boolean prop `header` (default `false` —
every shipped consumer renders byte-identically). When set: a `[data-part="header"]` row renders the
`label` VISIBLY (today aria-only) plus a live overall-status glyph under ONE rule: while
un-finalized, the header shows the F6 escalation over the strip's TOP-LEVEL entries whenever that
escalation OUTRANKS `active` (a mid-turn `error`/`warning` child flips the header immediately — the
F6 monotone-truth applied to the header itself), and `active` otherwise — so an EMPTY un-finalized
stream reads working from construction, by definition. `ui-conversation` opts in on its narration strips — which closes
the blank-bubble symptom AT ITS ROOT: the header shows "working" from `beginAgentTurn()` at t=0,
before any entry or any wire signal exists, so even a progress-less transport gets honest immediate
feedback. `finalize()` settles the header to the escalated final status; `fail()` settles it `error`
(the completion invariant now has a header-level face). **Rejected:** default-on (a visible rendering
change to every shipped strip without opt-in); a header entry faked as a first timeline item (it
would scroll away — the header is chrome, pinned outside the scroll region).

### Sequencing — TWO sequenced build slices, ONE decomposition

**Slice A (component/UI first):** `warning` + the header (F7/F8) + grouping (F5, gated on ADR-0143's
build) + `ui-conversation` goes live-at-ingest: categories narrate as `ingestLine()` sees them (not
replayed at `finalize()`), `AgentTurnHandle` gains `progress(ev: TurnProgress): void` (the §4
contract widening the app-surfaces-m2 amendment records — the same widening the shipped build's own
NAMED LLD GAP on `narrateTrace` flagged as design-seat work, now threaded properly), and the header
shows working-from-t=0. Ships against today's wire unchanged — the recorded demo and every consumer
get the visible fix immediately.
**Slice B (pipeline):** the provider `onEvent` seam + Anthropic mapping + `produce()`'s interleaved
progress yields + `progressDetail` + recorded synthetic stages + consumer loops routing
`meta.progress` → `handle.progress()`.
A before B — A closes the user-visible symptom with zero contract wait; B's wire vocabulary is fixed
HERE (the `TurnProgress` union) so the slices cannot drift. ONE decomposition with the two slices as
separate node groups (not two documents): the progress vocabulary is one shared spine — two manifests
would duplicate it and invite exactly the drift the single spine prevents.

## Consequences

- The blank agent bubble is closed twice over: structurally at t=0 (F8's header) and genuinely
  live as the wire matures (F1) — narration stops being a replay.
- The `a2uiMeta` envelope is now four kinds; the typed-frame trigger is re-affirmed with a sharper
  predicate (F1) — the next meta kind that needs ordering guarantees pays for the migration.
- `AgentTransport`/`AgentProvider` public signatures stay byte-identical/additive one day after
  ratification (ADR-0137 protected); `AgentTurnHandle` widens by one method — a REAL SPEC §4 contract
  change, recorded by amendment, never a quiet signature edit.
- `ui-status-stream` remains allowlisted-not-emittable (ADR-0122 F5 undisturbed); the `TimelineItem`
  catalog row's status enum gains `warning` as a follow-up a2ui-builder slice.
- Cost accepted: the grouping leg is coupled to ADR-0143's ratification+build order; the
  aria-live discipline must be re-proven with grouped/nested entries (role=log announces additions —
  nested appends must not double-announce through two hosts; a Slice-A acceptance).
- Stale → re-verify at build: `agent-admin`'s overlay (`admin-live-runner.ts`) consumes the same
  loop — verify it routes progress rather than dropping it (the ticket's own flagged check);
  the `NARRATION_STEP_MS` replay pacing (`conversation.ts:156`) becomes dead once ingest-time
  narration lands — remove, don't strand.

## Acceptance

*(Predicates for the eventual build, if ratified — this is a design record; nothing here ran.)*

- A stub provider driving `onEvent` through `produce()` yields interleaved
  `{"a2uiMeta":{"progress":…}}` lines BEFORE the content lines, content still validate-then-stream
  (no A2UI line precedes validation), note-only and halt paths unchanged — deterministic unit tests,
  no key. `progressDetail` absent ⇒ no `detail` text on any `reasoning` event.
- `readMetaLine` round-trips the `progress` kind; a progress line reaching `dispatch()` unfiltered
  still fault-isolates as `VERSION_UNSUPPORTED` (the standing ADR-0088 defense, extended to the new kind).
- The recorded transport replays authored `progress` events ahead of lines; the keyless demo shows
  staged feedback (SPEC-R2's determinism gates green, no network).
- `ui-status-stream` with `header` shows the visible label + a live escalated status from
  construction; grouped entries (`parent`) nest via `[data-role="nested"]`, escalate worst-child-wins
  (F6's ladder asserted including the `error`-beats-`active` case), collapse/inspect via the shared
  disclosure, and `finalize()` truncation reaches nested entries; `warning` carries a distinct
  non-color glyph legible under `forced-colors: active` — jsdom + browser suites, ADR-0057 checks.
- `ui-conversation` narrates categories at ingest time (SPEC-R6 AC1's amended wording), routes
  `handle.progress()` into the strip live, and the composed header reads working at t=0 in a turn
  that has produced zero lines — the blank-bubble regression proof.
- `npm run check && npm test` green throughout; independent reviewer GO per slice before commit.

## Alternatives considered

- **`AgentTransport.turn()` → `AsyncIterable<{kind:'progress'|'content'}>`** — rejected (F1): breaks
  a one-day-old ratified public surface + the NDJSON line protocol + every consumer, for framing the
  reserved envelope already provides; recorded as the typed-frame upgrade path with its sharpened trigger.
- **A separate progress callback/channel beside the content iterable** — rejected (F1): two channels
  for one turn's story, no cross-channel ordering guarantee, and the recorded transport needs a
  parallel second mechanism to keep SPEC-R5/N4 parity.
- **`AgentProvider.stream` yielding a discriminated union** — rejected (F1): breaks every adapter and
  stub where an optional callback (the `effort?` precedent on the same interface) is additive.
- **Raw thinking text shown by default** — rejected (F3): unpolished CoT as apparent claims, token
  spam in a polite live region, against the ecosystem's own settled posture; kept as double opt-in.
- **A new `ui-timeline-group` element** — rejected (F5): a second nesting primitive one week after
  ADR-0143 ruled nesting composes `ui-timeline` itself; fails family-coherence.
- **Renaming the status enum to waiting/working/success/danger** — rejected (F7): breaks the ratified
  ADR-0122 F3 contract, the emittable catalog row, and the A2A guidance mapping for a synonym swap;
  `warning` is the only genuinely missing state.
- **Most-recent-child group escalation** — rejected (F6): hides a failure the moment a later step
  starts; worst-child-wins is monotone-truthful.
- **One monolithic build** — rejected (Sequencing): the UI slice closes the visible symptom with zero
  wire dependency; coupling it to the pipeline slice makes the user wait on the largest contract work
  for the smallest visible fix.
