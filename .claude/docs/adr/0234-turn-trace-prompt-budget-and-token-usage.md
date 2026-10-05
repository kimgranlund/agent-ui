# ADR-0234 — Each turn reports its composed prompt against a declared character budget and the provider-billed token usage on the TurnTrace

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-05
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-10-05 |
> | **Proposed by** | the sdlc-lite run `context-budget-trace` (tracking issues GH [#1809](https://github.com/kimgranlund/agent-ui/issues/1809) and the token accounting remainder of GH [#1797](https://github.com/kimgranlund/agent-ui/issues/1797)) |
> | **Ratified by** | pending Kim |
> | **Repairs** | [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) TurnTrace, SPEC-R6 (a whole-prompt budget paragraph and AC8), SPEC-R29 AC3, SPEC-R30 AC3, the typed contract and the SSE note · [`../lld/a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) LLD-C3, LLD-C4, LLD-C10 and the module tree · [`../spec/devtools-harness.spec.md`](../spec/devtools-harness.spec.md) SPEC-R7 (`turn-end.usage`) · code: `packages/agent-ui/a2ui/src/agent/prompt-budget.ts` (new), `src/agent/meta-line.ts`, `src/agent/agent-transport.ts`, `src/agent/system-prompt.ts`, `src/agent/produce.ts`, `src/agent/providers/anthropic.ts`, `packages/agent-ui/devtools/src/timeline/events.ts`, `packages/agent-ui/devtools/src/capture/format.ts` |
> | **Supersedes / Superseded by** | none · relates [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (provider keys and usage parsing stay server-side, behind the dev-proxy) · relates [ADR-0088](./0088-a2ui-live-conversational-channel.md) (the meta-line; this ADR adds optional trace members and does NOT amend it) · relates [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) (the `ProviderEvent` seam gains a non-stage kind) · relates [ADR-0200](./0200-agent-ui-devtools-package.md) (the devtools timeline consumes the trace, never the provider) · relates [ADR-0232](./0232-catalog-selection-guidance-sidecar.md) (the selection-guidance char budget, a per-clause budget this one sits above) |

## Context

A turn's system prompt is composed from up to nine sections (grammar, component inventory, functions,
few-shot exemplars, mini-skills, genui pack, authoring surface, builder mission, persona). Nothing measured
the whole: ADR-0232 budgets one clause, and the producer had no declared ceiling, so a large persona or
genui `sourceBody` could grow the prompt with no signal. The provider bills tokens per request, and that
count was parsed nowhere: the devtools timeline (ADR-0200) showed status, line count and latency, but not
cost. GH #1809 asks for a declared budget that reports and never silently truncates; GH #1797 leaves token
accounting open.

## Decision

We will make every turn report what it assembled and what the provider billed, additively, on the
existing `TurnTrace`:

1. **Additive trace members.** `TurnTrace` gains optional `prompt?: PromptBudgetReport` and
   `usage?: TokenUsage`. Both are optional additions, so this is not an ADR-0088 amendment: a consumer
   that ignores them is unchanged.
2. **A character budget per catalog family, report-only by default.** `prompt-budget.ts` declares
   `PROMPT_CHAR_BUDGET_BASE` and `PROMPT_CHAR_BUDGET_DERIVED` (a `<base>--<persona>` id). Each turn
   carries `{limit, total, sections, over}`. Over budget is reported, never truncated: `produce()` drops
   nothing. Halting is opt-in through `promptBudget: {mode: 'halt'}`, which throws a pre-call
   `ProduceHalt` with the code `PROMPT_OVER_BUDGET`
   (`packages/agent-ui/a2ui/src/agent/produce.ts:1025`), before the round loop's first
   `deps.provider.stream` call and before any line is yielded.
3. **A `usage` `ProviderEvent` kind.** An adapter emits one `{kind: 'usage'}` event per upstream request,
   carrying that request's token counts. `produce()` sums them over every round into `trace.usage`. When
   no provider reports usage, `trace.usage` is absent, never zero-filled.
4. **`turn-end.usage` in devtools.** The timeline's `turn-end` event carries an optional `usage`, latched
   from the meta trace. The capture format stays at version 1: the member is optional and a version-1
   reader accepts it.
5. **Token counts only.** No prices, rates or currency appear anywhere in the trace, the timeline or the
   capture format.
6. **`trace.prompt` reports the composed prompt.** Two runs that differ only in a prompt-composition gate
   (`a2uiEnabled`, genui `exclusive`, `authoringSurface`) now differ in that one field. SPEC-R29 AC3 and
   SPEC-R30 AC3 read "identical apart from `trace.prompt`", and the three stream pins compare through
   `withoutTracePrompt`.

## Consequences

- A prompt that outgrows its budget surfaces on the trace and fails `live-agent/prompt-budget.test.ts`.
  The fix is to re-author tersely or to re-measure deliberately; raising the ceiling just to get green is
  not a fix.
- The gate-OFF stream ACs lose strict byte identity on one field. The comparison helper keeps every other
  byte pinned.
- Every adapter that wants usage on the trace must emit the `usage` event; one that does not leaves
  `trace.usage` absent, which consumers must tolerate.
- Characters are a proxy for tokens. The budget catches growth at composition time; the billed truth
  arrives afterwards in `usage`.

## Alternatives considered

- **Truncate the prompt to the budget** - rejected because silent truncation drops instructions the
  model needs, and the failure would show up as worse payloads with no cause on the trace.
- **Budget in tokens** - rejected because tokens are only known after the provider call; characters are
  exact at composition time and need no tokenizer in the Worker.
- **Bump the capture format version** - rejected because the member is optional and every version-1
  reader still parses the new captures.
- **Report cost in currency** - rejected because prices change and belong to billing, not to the trace.
