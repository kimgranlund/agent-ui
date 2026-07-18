---
doc-type: ticket
id: tkt-0083
status: open
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0083 — agent turns show NO live feedback: `ui-status-stream` narration is entirely retroactive, `produce()` buffers the whole response silently, and the narration itself is a flat list, not the multi-level, richer-status surface Kim wants

## Summary
Kim's seed (2026-07-17, `/feature` intake, screenshot): a user sends "play blackjack" and the
AGENT's reply bubble renders **completely blank** — no text, no spinner, no status — for the
whole duration the model is generating. Kim's ask, in two parts (his message cut off after "and
then," confirmed via clarifying round): **(1)** first identify the most granular lifecycle data
this fleet can actually leverage (sent/received/processing/analyzing/step-by-step reasoning),
**(2)** then design and scope the fix for the *whole pipeline*, not just the narrow "nothing shows
before the first line" symptom — confirmed explicitly over the "just the pre-first-line gap"
alternative.

**Mid-intake follow-up (same session, a second screenshot of today's actual `ui-status-stream`
output — a flat checkmarked list: "Opening a new surface…" / "Updating the surface…" / "Updating
data…"):** Kim raised the bar past "make it live" to "make it sophisticated" — research what
best-in-class systems do for step-by-step reveal + user inspection, and specifically: a
**multi-level accordion** with reasoning steps grouped, a **streaming header** capable of showing
richer status types (waiting, working, success, danger, warning, etc.), not just today's flat,
four-state list.

**Grep/read-verified root cause, three layers deep — worse than the screenshot alone suggests:**

1. **`ui-conversation` narration is 100% post-hoc.** `beginAgentTurn()` creates and appends a
   `<ui-status-stream>` immediately (`conversation.ts:306-318`) — but `narrateCategories()`, the
   only function that ever appends visible entries, is called exclusively inside `finalize()`
   (`conversation.ts:369`), i.e. **after the turn has already ended**. An empty `ui-status-stream`
   renders **zero visible pixels** (`status-stream.css:24-33`: an empty flex column collapses to
   0px; `label` only sets `aria-label`, never visible text — confirmed, not assumed). So the
   narration animation the fleet already ships (SPEC-R6, ADR-0088) is a *replay* of stages that
   already finished, not a live report of stages in progress — narration and reality both land at
   the same instant, the end.
2. **`produce()` buffers the entire model response before yielding anything.** The round loop
   (`produce.ts:344-352`) does `for await (const frag of deps.provider.stream(...)) { raw += frag }`
   — zero yields during that loop. The first yield only happens after the FULL response is
   accumulated, meta-line-peeled, assembled, and validated (`produce.ts:367`/`399`). So even if
   `ui-conversation`'s narration were wired to fire progressively, there is nothing progressive
   flowing INTO it — the wire itself is silent end-to-end for the entire generation.
3. **The granular data Kim asked to identify already exists upstream and is thrown away at the
   very first parsing step.** The Anthropic adapter's own docstring (`providers/anthropic.ts:14`)
   states plainly: *"`ping` and thinking/tool events are ignored"* — `parseAnthropicSSE` yields
   ONLY `content_block_delta` text fragments and discards `message_start` (request
   acknowledged/connecting), `content_block_start` (generation beginning),
   `thinking`-type deltas (step-by-step reasoning, when extended thinking is enabled),
   `content_block_stop`, and `message_delta`/`message_stop` (done) — every one of the
   sent/received/processing/reasoning stages Kim named by name is a **real, already-available SSE
   event** on the wire today; none of it survives past `anthropic.ts`'s own parser.

**The gap was named once and never closed.** [ADR-0122](../adr/0122-timeline-family-and-live-status-stream.md)
(accepted, shipped `ui-status-stream`) explicitly quoted Kim's own original ask for a live surface
showing *"what the system is working on — chain of thought / reasoning / actions / tool-use as it
is occurring"* — the *"as it is occurring"* ambition was never carried through; what shipped is
the entry/animation MACHINERY (real, reusable) with nothing live ever feeding it.

**What today's shape actually is, grounded against the code, not the screenshot alone:**
`ui-timeline-item`'s own `status` enum is exactly `['', 'pending', 'active', 'done', 'error']`
(`timeline-item.ts:45`) — four real states, flat, no nesting; the marker glyph is `check`/`x` for
`done`/`error` only (`timeline-item.ts:173-174`). There is no group/nesting concept anywhere in
`ui-timeline`/`ui-status-stream` today — every entry is a sibling in one flat rail. Two things
this fleet already has that a build can reuse rather than invent: `ui-disclosure` (an existing
expand/collapse primitive — the accordion mechanism Kim's ask needs already exists as a
component) and [ADR-0057](../adr/0057-intent-non-color-signifier-rule.md) (the fleet's own standing
"intent never travels by color alone" law) — the richer status vocabulary this ticket wants
(waiting/working/success/danger/warning) must extend `timeline-item.ts`'s icon-per-status pattern,
never introduce a color-only state.

**Best-in-class research (web-sourced, dated 2026-07-17 — see Links for citations):** the
step-by-step-reveal-plus-inspection pattern Kim described has real precedent, not a novel
invention:
- **Claude Code's own Agent SDK** todo/task system uses an icon-coded (never color-only)
  `pending`/`in_progress`/`completed` lifecycle, with newer `TaskCreate`/`TaskUpdate`/`TaskList`
  tools updating individual items by id rather than rewriting a whole list — the same
  per-item-update shape `ui-status-stream`'s `update(key, patch)` already has.
- **Perplexity's Pro Search** separates *planning* (a shown plan) from *execution* (streamed
  per-step progress) — user research there found people tolerate longer waits when intermediate
  progress is visible, directly on point for the blank-bubble symptom this ticket opened with.
- **OpenAI's reasoning models** show a collapsed-by-default "Thinking…" indicator with the full
  chain-of-thought trace expandable/hidden by product policy, not technical limitation —
  independent evidence for this ticket's own open question about whether raw reasoning text should
  ever reach the end user by default.
- **Devin (Cognition)** splits a live reasoning/plan trace from live tool/terminal output in
  parallel panes; **HatchWorks' agent-UX pattern catalog** names the two recurring primitives
  under a chat surface as "activity timeline" (chronological, collapsible-verbosity log with a
  pinned current-step indicator) and "taskboard" (goal→task→sub-task hierarchy) — Kim's
  "multi-level accordion with reasoning-step groups" reads as this fleet's own version of the
  activity-timeline pattern, extended with taskboard-style nesting.
- Status vocabulary beyond pending/done, as actually used in the wild: **pending, running/working,
  success, error, blocked, skipped** (HatchWorks) — Kim's named list (waiting, working, success,
  danger, warning) maps onto this closely, with "danger"/"warning" separating outcome-failure from
  a lesser advisory the current `error`-only state can't distinguish.

## Acceptance
- The lifecycle stages this ticket targets are the ones grounded above, sourced from real,
  currently-discarded signals — not invented ones: **connecting/sent** (request issued) →
  **first byte / generation started** (`message_start`/`content_block_start`) → **reasoning**
  (`thinking`-type deltas, when extended thinking is on) → **content streaming**
  (`content_block_delta` text) → **validating/healing** (produce()'s own
  assemble+heal+validate step, already real, just not reported) → **done**
  (`message_stop`/successful yield).
- `ui-conversation` shows visible feedback that begins at or near actual turn start, not at
  `finalize()` — closing the "blank bubble for the whole turn" symptom the screenshot shows, not
  merely the pre-first-line sliver of it.
- `produce()`'s buffering behavior changes to forward progress as stages actually occur, OR gains
  a parallel progress-signal channel alongside its existing buffered content yield — either way,
  the existing validate-before-emit invariant for actual A2UI CONTENT is preserved exactly
  (a progress *label* is not validated application content and must never be confused for it).
- Whatever wire-shape change this requires in `AgentTransport`/`produce()`/the `AgentProvider`
  seam is treated as a real contract change against the already-shipped, ratified
  `@agent-ui/a2ui/agent` export (ADR-0137/TKT-0072) — not a quiet signature edit.
- `dev-proxy-plugin.ts`'s own line-based forwarding protocol (the browser-facing half) carries
  whatever new progress signal produce() emits, distinguishable from real A2UI content lines.
- The recorded/demo transport (`createRecordedTransport`, no API key needed) gets a plausible
  synthetic version of the same progressive stages, so the docs site's default (keyless) demo
  still demonstrates the feature — a live-only feature that goes dark in the default demo
  reproduces this exact ticket's own symptom for every visitor without a key.
- The narration surface gains **grouping**: reasoning/tool-use steps that belong to one higher-level
  stage (e.g. every step inside "reasoning," every step inside "validating") nest under a group
  header, expand/collapse via the existing `ui-disclosure` primitive rather than a new mechanism —
  reusing what the fleet already ships, per the research above, not inventing a bespoke accordion.
- A **streaming header** shows the turn's own current overall status live (updating as the turn
  progresses, not just per-item) and supports a status vocabulary richer than today's
  `pending`/`active`/`done`/`error`: at minimum **waiting, working, success, danger, warning**,
  each still icon-coded per [ADR-0057](../adr/0057-intent-non-color-signifier-rule.md) — extending
  `timeline-item.ts`'s existing marker-glyph mechanism, never color-only.
- A user can **inspect** any step or group for more detail on demand (the existing per-turn
  wire-disclosure precedent, SPEC-R6 §4's `disclosure` prop, generalizes here) — inspection is
  opt-in/collapsed by default, matching the OpenAI/Perplexity precedent of not dumping raw
  reasoning text unprompted.

## Links
- [ADR-0122](../adr/0122-timeline-family-and-live-status-stream.md) — shipped `ui-status-stream`
  under exactly this "as it is occurring" ambition; this ticket is the un-closed follow-through.
- [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) SPEC-R6 (per-turn narration, ADR-0088's
  honest-narration law — "never a fabricated sentence") and SPEC-R12 (the content-render hook,
  [TKT-0071](tkt-0071-conversation-bubble-markdown-rendering.md)) — both requirements this ticket's
  fix must keep holding.
- [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) / [ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md)
  / [TKT-0072](tkt-0072-exportable-a2ui-agent-producer-toolkit.md) — the `produce()`/`AgentTransport`/
  `AgentProvider` wire contracts this ticket's fix changes; the just-shipped `./agent` export means
  this is now a real, ratified public surface, not an internal implementation detail.
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts` — the concrete evidence: granular
  lifecycle events are real and on the wire today, discarded at `parseAnthropicSSE`.
- `packages/agent-ui/app/src/controls/conversation/conversation.ts` (`beginAgentTurn`/`finalize`) and
  `packages/agent-ui/components/src/controls/status-stream/` — the retroactive-narration mechanism
  this ticket's fix must turn live.
- `packages/agent-ui/components/src/controls/timeline-item/timeline-item.ts` — today's flat, 4-state
  `status` enum this ticket's richer vocabulary extends.
- `packages/agent-ui/components/src/controls/disclosure/` — the existing expand/collapse primitive
  the grouping/inspection requirement should compose, not reinvent.
- [ADR-0057](../adr/0057-intent-non-color-signifier-rule.md) — the fleet's standing icon-not-color-alone
  law the new status vocabulary must keep holding.
- Best-in-class research (web, 2026-07-17): [Claude Code Agent SDK todo tracking](https://code.claude.com/docs/en/agent-sdk/todo-tracking) ·
  [Claude Code stream-json format](https://backgroundclaude.com/blog/stream-json) ·
  [OpenAI reasoning models guide](https://developers.openai.com/api/docs/guides/reasoning) ·
  [Perplexity Pro Search case study](https://www.langchain.com/breakoutagents/perplexity) ·
  [Devin intro docs](https://docs.devin.ai/get-started/devin-intro) ·
  [HatchWorks agent UX patterns](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/).

## Scope/Open
- **The core architecture fork (system-planner's, not this intake's):** does `AgentTransport.turn()`
  gain a discriminated progress/content signal shape (e.g. `{kind:'progress'|'content', ...}`
  replacing the plain `AsyncIterable<string>`), or does progress ride a SEPARATE channel/callback
  alongside the unchanged content iterable? The first is the more honest long-term shape; the
  second is less contract-disruptive to `AgentTransport`'s existing single-iterable simplicity.
  No recommendation ratified here.
- **Does a progress label conflict with SPEC-R6/ADR-0088's honesty law?** The law bars a
  *fabricated sentence* about outcome/content; a factual stage label ("Thinking…", "Validating…")
  reads as a different kind of claim (process, not content) — but this is a reading that needs
  Kim's ruling, not an assumption baked in by whoever builds this.
- **Extended thinking is a product decision, not an intake one.** Anthropic's `thinking`-type
  deltas require the extended-thinking API flag and carry raw model reasoning text — whether
  surfacing that text to end users (vs. just a generic "Reasoning…" stage label with the content
  hidden) is even desired is unresolved; some products deliberately hide raw chain-of-thought.
- **Per-provider variance.** This ticket grounds itself entirely in the Anthropic adapter (the only
  one implemented today, per TKT-0072's build). The `providers/{openai,gemini}.ts` stubs
  (`tools/agent/providers/`, still site-internal, unimplemented) would need their own granular-event
  mapping whenever they're built — not assumed to match Anthropic's SSE shape.
- **`agent-admin`'s own live-model overlay** (ADR-0136, TKT-0052) composes `ui-conversation` the
  same way `a2ui-chat` does — whatever fix lands here should reach it too, but that wasn't
  independently re-verified at this intake; check at build time.
- **New component or extended composition (system-planner's fork):** does grouping/nesting become
  a NEW component (`ui-timeline-group`, say) in the timeline family, or is it achieved by composing
  existing `ui-timeline`/`ui-timeline-item`/`ui-disclosure` instances without a new element? ADR-0122
  already resolved a similar own-control-vs-one-family fork for the base family — this may be that
  same fork's sequel, or may reuse its answer directly; not re-litigated here.
- **Status escalation rule, unresolved:** if a group's child steps carry different statuses (say
  one `success`, one `warning`), what does the group HEADER show — the worst child status, the
  most recent, something else? Needs a ruling before the streaming header can be built correctly.
- **Two distinct build surfaces, likely two build slices:** (a) the pipeline/data work (Acceptance
  bullets 1-5 — real signals reaching the transport) and (b) the component/UI work (grouping,
  streaming header, richer vocabulary, inspection) are both required for the feature to be
  complete, but are separable — (b) could ship against today's already-real `pending/active/done`
  categories as a visual/structural upgrade, while (a) lands the genuinely live data separately.
  Not decided here whether they ship together or sequenced; named so a build doesn't assume either.

## Findings

**2026-07-17 — design intake complete: [ADR-0146](../adr/0146-live-turn-lifecycle-progress-channel.md)
(proposed) + three spec amendments + a coverage-clean decomposition; nothing self-ratified.** All cited
paths re-verified against the post-ADR-0137 tree first (`produce()`/the Anthropic adapter live in
`src/agent/`, not the `tools/agent/` this ticket's body cites — the shell that stayed behind is only
the dev-proxy/registry, `dev-proxy-plugin.ts:20-30`). The ticket's three-layer root cause CONFIRMED at
the current lines: post-hoc-only narration (`conversation.ts:384` — `narrateCategories` called solely
inside `finalize()`), full-response buffering (`produce.ts:345-352`, first yield at `:367`/`:399`),
and the adapter discarding every lifecycle event (`anthropic.ts:86` — only `content_block_delta`
survives). The Scope/Open forks resolved (recommendations, Kim ratifies): **(1) wire shape** — NOT a
discriminated `turn()` union (would break the ONE-day-old ADR-0137-ratified `./agent` surface + the
NDJSON protocol) and NOT a side channel (no cross-channel ordering, no recorded parity); instead the
ADR-0088 envelope gains a runtime-composed `progress` kind whose lines INTERLEAVE during the turn on
the same `AsyncIterable<string>`; the provider seam gains an additive optional `onEvent` callback (the
`effort?` precedent, `agent-transport.ts:89-104`); 0088's typed-frame trigger weighed and re-deferred
with a sharpened predicate. **(2) honesty law** — no conflict, recommended reading: a stage label from
a closed code-owned table 1:1-keyed to a REAL observed signal is a process claim, not a fabricated
content sentence (the shipped `LABEL` table, `conversation.ts:104-109`, is already exactly this class);
guard made normative in the app-surfaces-m2 amendment. **(3) raw reasoning** — hidden by default at
BOTH layers (`progressDetail: 'stages'` default keeps thinking text off the wire; UI default is the
generic grouped "Reasoning…" with raw text behind the ADR-0129-F3-class opt-in disclosure); tradeoff
named in ADR-0146 F3. **(4) providers** — the stage vocabulary is produce-layer-owned; adapters map
into the optional callback; an unimplemented adapter degrades to the stages `produce()` itself
observes — nothing foreclosed. **(5) grouping** — NO new component: `StatusEntry.parent?: string`
realized through TODAY's sibling ADR-0143 `[data-role="nested"]` slot + shared disclosure (checked
directly against ADR-0143 F1-F7 — its collapsed-summary preview and observer class serve this feature
verbatim; a `ui-timeline-group` would be the second nesting primitive family-coherence bars);
sequenced on ADR-0143's build. **(6) escalation** — worst-child-wins over ONE closed ladder
`error > warning > active > pending > done` (monotone-truthful, fail-closed like the ADR-0122 F4
completion invariant; the `error`-beats-`active` case ruled explicitly). Vocabulary: EXTEND not rename
— waiting/working/success/danger already ARE `pending`/`active`/`done`/`error`; only `warning` is
genuinely missing (renaming would break the ratified ADR-0122 F3 enum, the emittable catalog row, and
the A2A guidance map). The blank-bubble symptom gets a structural fix independent of the wire: an
opt-in visible `header` on `ui-status-stream` reading working-from-t=0 (an empty strip today renders
ZERO pixels — `label` is aria-only). **Sequencing: TWO slices, ONE decomposition**
([live-turn-lifecycle-feedback.decomp.json](../decompositions/live-turn-lifecycle-feedback.decomp.json),
coverage-clean `--strict` exit 0; 17 nodes/15 actions/15 hosts/15 edges incl. an external-gate leaf
graph-blocking the grouping node on ADR-0143's build) — Slice A component/UI first
(closes the visible symptom with zero contract wait), Slice B pipeline second; the shared
`TurnProgress` vocabulary is fixed in the ADR so the slices cannot drift. Spec deltas landed
append-only (the ADR-0143 template): `a2ui-live-agent.spec.md` (SPEC-R5/N4 + §5 contracts),
`app-surfaces-m2.spec.md` (SPEC-R6 live-at-ingest + the §4 `AgentTurnHandle.progress` widening — the
shipped build's own NAMED LLD GAP on `narrateTrace` was the precedent that this contract needed the
design seat), `timeline-family.spec.md` (warning + header + grouping). `agent-admin`'s overlay
(`admin-live-runner.ts`) confirmed to ride the same `readMetaLine` loop — routed in Slice B's n13,
not assumed. Independent doc review (scribe:doc-reviewer, fresh context): fix-then-ship — every
load-bearing file:line claim independently re-verified TRUE against the shipped source; 1 major
(the ADR-0143 sequencing gate lived in prose, not the decomp graph — fixed as a real external-gate
edge n0→n4) + 4 minors (the `content` stage's emitter pinned to produce()'s first text fragment;
the header's mid-flight escalation rule stated once in F8; F2's honesty-law quote re-cited to its
true home, SPEC-R6's proposed codification; A-before-B named a delivery-priority ruling, the graph's
parallelism deliberate) — all applied, coverage re-run clean. NOTE: minted as ADR-0146, not 0144 —
0144/0145 were claimed same-day by TKT-0093/TKT-0092's intakes (numbering race caught at the
pre-push fetch, renumbered before commit).

**2026-07-18 — BUILD (partial; status stays `open`). Slice A + Slice B shipped; the grouping leg
(n4/n6/n5-group) DEFERRED with a concrete escalation.** Two commits on the worktree branch:
- **Slice A (component/UI + live-at-ingest)** — `@agent-ui/icons` gains a `warning` glyph (a Phosphor
  triangle-exclamation, vendored through `scripts/vendor-phosphor.mjs`, count 23→24); `ui-timeline-item`
  gains the `warning` status member (F7) — its own distinct shape-coded glyph, status ink, forced-colors
  legibility (jsdom + browser); `ui-status-stream` gains the opt-in `header` prop (F8) — a sticky
  chrome row reading **working from t=0** (the blank-bubble ROOT fix), plus the pure `escalateStatus`
  worst-child-wins reduce over the closed F6 ladder (`error>warning>active>pending>done`) applied at the
  STREAM level, and a `fail()` method forcing the header to error; `ui-conversation` narrates
  **live-at-ingest** (the post-hoc `narrateCategories` replay + `NARRATION_STEP_MS` DELETED, grep-zero),
  opts its strip into the header, and `AgentTurnHandle` widens with `progress(ev)` routing `TurnProgress`
  through a CLOSED code-owned stage-label table (F2 honesty guard — unknown stage renders nothing).
- **Slice B (the wire)** — `AgentProvider.onEvent(ProviderEvent)` additive seam; the Anthropic adapter
  maps its previously-dropped lifecycle/thinking frames onto it (text accumulation byte-identical, no SDK
  import); `produce()` interleaves `{"a2uiMeta":{"progress":{stage}}}` meta-lines AS THEY HAPPEN
  (sent→started→reasoning→content→validating→retry(n)→done) strictly ahead of content, validate-then-stream
  (SPEC-R5) preserved, `progressDetail`='stages' default keeps thinking text off the wire (F3). NOTE — a
  build refinement the ADR's "always interleave" wording did not spell out: progress emission is **opt-in**
  (`ProduceOptions.progress`, default off) so every predating deterministic gate/consumer stays
  byte-identical (the decomp's own "note-only/halt byte-unchanged" requirement) — the dev proxy + live
  consumers opt in. Recorded transport replays authored `progress` (demo turns 1-2 author it → the keyless
  demo shows the feature); consumer loops (a2ui-chat, agent-admin/admin-live-runner) route `meta.progress`
  → `handle.progress()`; a2ui-live (canvas, no strip) filters it; the dev proxy needs no structural change.
- **DEFERRED — grouping (n4, the group-level part of n5, n6):** F5 requires the live stream to *"lazily
  mount a nested `<ui-timeline>` into the parent item's `[data-role="nested"]` slot"*, but TKT-0091's
  now-landed nested slot adopts **connect-time-only** (idempotent `#ensureAnatomy`, no host-level heal
  observer for a late-appended `[data-role="nested"]` child), and ADR-0143 n16 explicitly ruled **no new
  public method/prop** on `ui-timeline-item`. So there is no seam for the live host to mount a nested
  timeline into an ALREADY-CONNECTED parent item — a genuine gap between two ratified ADRs that F5 did not
  anticipate. **ESCALATION (for the planner):** add a small additive late-mount seam to `ui-timeline-item`
  (e.g. a public `mountNested(timeline)` reusing `#ensureAnatomy`'s disclosure-composition — the exact
  "compose the slot for the live host" F5 intends, a deliberate widening ADR-0143 declined but F5's dynamic
  case needs), OR amend F5 to the stream-side parent-recreation approach (no timeline-item change, at the
  cost of parent node identity). No consumer uses grouping yet, so this defers zero user-facing behaviour.
- **Gates:** `npm run check` GREEN (tsc + site + tools). `npx vitest run` — 6432/6434 green; the 2
  failures are `light-dark-minify` + `theme-provider-build-fixture`, BOTH the SAME broken worktree `vite
  build` (a multi-page asset-resolution RACE — the failing chunk varies run-to-run: `layout-overview`/
  `a2ui-form`/`adr-index`, none touched here — an ENV issue, not this build; verify/regenerate on a clean
  build). `npx vitest run --config vitest.browser.config.ts` (timeline-item + status-stream) GREEN (56).
  `llms-full.txt` + the theme CSS fixture regenerated (CSS content captured — `ui-status-stream-header`
  present). **Independent code-review NOT run: the Agent/Task tool to dispatch `orchestration:code-reviewer`
  is unavailable in the builder's toolset — MUST be run by the coordinator before this closes.** Status
  stays `open` (partial build: grouping deferred + review pending).

**2026-07-18 — grouping escalation RESOLVED; follow-up build dispatched.** A separately-coordinated,
independently-built attempt at this same ticket (draft PR #18, superseded on everything else already
shipped above) hit the identical grouping gap and solved it: `ui-timeline-item.ensureNestedSlot(factory)`,
a new public method composing ADR-0143's existing `[data-role="nested"]` + shared-disclosure +
collapsed-summary-preview mechanism lazily (on first group) instead of eagerly at connect — verified
working via a real test (`appendEntry({parent})` after the parent already connected). Kim ruled
(2026-07-18, in conversation) to accept this as a narrow, additive exception to ADR-0143's original
no-new-public-surface posture — recorded as an append-only amendment on
[ADR-0143](../adr/0143-timeline-item-recursive-nesting-accordion.md) itself. A small follow-up build
ports `ensureNestedSlot` (plus the escalation-observer wiring fix an independent review separately
flagged) onto the already-shipped Slice A+B on main. Status stays `open` until that follow-up lands and
is independently reviewed.

**2026-07-18 — ADR-0146 wording reconciled to the shipped build (append-only amendments; Status
untouched).** Three gaps an independent code review found between the accepted text and the shipped,
reviewed implementation are now recorded on
[ADR-0146](../adr/0146-live-turn-lifecycle-progress-channel.md) as dated amendment blocks: (1) progress
emission is OPT-IN (`ProduceOptions.progress`, default off — the build refinement the 2026-07-18 build
note above already flagged, now on the ADR itself); (2) recorded progress replays UNPACED
(`recorded-transport.ts:85`) — "plausible pacing" struck, SPEC-R2 determinism is why; consumer-side
reveal staggering noted as a possible follow-up, not a requirement; (3) F8's settled header escalation
counts truncated entries as `warning` (`status-stream.ts:303-310`) — the fail-closed reading of "the
escalated final status," now explicit.

**2026-07-18 — BUILD: the grouping leg (n4/n5-group/n6) BUILT on main; status stays `open` pending
independent review (commit `1b1e1bf`, worktree branch).** The final deferred leg of ADR-0146 is built
CLEANLY against the current shipped `timeline-item.ts`/`status-stream.ts` — NOT by merging the reference
squash (`9e0a94d`, which predates main's more-evolved header/`fail()`/`#effectiveStatus` escalation and
would have regressed them); only the grouping delta was re-implemented. Eight files, +483/−8:
- **`ui-timeline-item.ensureNestedSlot(factory: () => HTMLElement): HTMLElement`** — the exact contract the
  ADR-0143 2026-07-18 amendment ratifies (signature confirmed identical). Composes the SAME shared
  `ui-disclosure` + `[data-role="nested"]` slot + collapsed-summary preview + `MutationObserver` that
  `#ensureAnatomy` builds at connect, but LAZILY on first call — two branches (no disclosure yet → compose
  one synchronously; a detail-only disclosure already → append onto it, healed into the body by disclosure's
  own childList observer). Idempotent (second call returns the same node); arms the preview observer/effect
  exactly like the connect-time path and re-arms on reconnect via the existing `#nested` guard. Descriptor
  (`timeline-item.md`) gains the one method; `#previewGlyph` gains the `warning` triangle (F7/ADR-0057 —
  a grouped warning child previews by shape, never hue).
- **`ui-status-stream` grouping (F5)** — `StatusEntry.parent?: string` mounts the child under the parent's
  lazily-created nested `<ui-timeline>` (via `ensureNestedSlot`, once per parent); unknown parent degrades
  to a flat top-level append (never a throw). The keyed registry stays FLAT (`update(childKey)` reaches
  nested entries; `finalize()`/`fail()` truncation already walk `#byKey.values()`, nested included).
- **Escalation (F6)** — worst-child-wins over the closed ladder `error > warning > active > pending > done`
  (the already-exported, unit-tested `escalateStatus` reduce), bubbling up enclosing groups, painting the
  group parent's own status + (via the unchanged top-level `#refreshHeader`) flipping the pinned header on a
  mid-turn nested-child escalation. **The escalation-observer flag is resolved by CONSTRUCTION:** group
  escalation is recomputed the SAME MEDIATED way the stream header already is — imperatively from THIS host's
  own `appendEntry`/`update` calls (every child status change flows through `update`), NOT a
  `MutationObserver`. The nested-slot observer `ensureNestedSlot` installs serves ONLY the collapsed-summary
  preview (ADR-0143 F3); no redundant escalation observer is added. Verified this matches the repo's own
  established stream-level discipline (the file-header comment) and does not regress main's
  `#effectiveStatus` (truncated → warning) header semantics.
- **Gates:** `npm run check` GREEN (tsc + site + tools). `npx vitest run --project packages` (all component
  tests + family-coherence/barrels/layering/naming/descriptor gates) 6026/6026 GREEN, exit 0.
  `npx vitest run --config vitest.browser.config.ts` for timeline-item + status-stream GREEN (62). Full
  `npm test` = 6445 passed / 2 failed — the 2 are the PRE-EXISTING `vite build` fixture flakes
  (`theme-provider-build-fixture` + `light-dark-minify`), confirmed reproducing on the pristine base
  (`cd29851`) with the grouping change stashed; untouched by this build (theme-CSS/site-build only).
  **Independent code-review NOT run (the builder cannot dispatch it) — MUST be run by the coordinator before
  this closes; this ticket's own hard gate, twice-required.** Status stays `open`.
