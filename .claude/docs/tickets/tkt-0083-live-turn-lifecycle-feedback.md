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
