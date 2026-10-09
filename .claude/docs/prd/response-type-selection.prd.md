# PRD: Response type selection (the agent chooses text, an A2UI surface, or both, per turn)

> Status: proposed · v0.1 · 2026-10-09 · Layer: PRD (why and what) · architect seat, sdlc-lite run `response-type-selection` (T-0060)
> Parent: [`a2ui-expert-system.prd.md`](./a2ui-expert-system.prd.md) (the A2UI expert system this feature refines). Downstream: [`../spec/response-type-selection.spec.md`](../spec/response-type-selection.spec.md) · [`../lld/response-type-selection.lld.md`](../lld/response-type-selection.lld.md) · [ADR-0242](../adr/0242-render-surface-terminal-tool-response-type.md) (proposed).
> Grounding: Kim's design discussion of 2026-10-09 (the T-0060 handoff): the choice is made inside the turn by the model through a `render_surface` tool, text is the default, and no router model call runs in front of the turn.

## 1. Problem

Today the producer has no decision point for the response type. `grammar.md` opens with "You do NOT reply in prose", teaches the model to put its one-or-two-sentence reply on a leading meta-line (`{"a2uiMeta":{"note":...}}`) and to follow it with A2UI JSONL "omitted entirely if the UI isn't changing". The choice between a text answer and a surface therefore lives in prose the model may or may not weigh, is never observed, and is never measured. `produce()` (`packages/agent-ui/a2ui/src/agent/produce.ts`) only ratifies what came back: a note with zero A2UI lines is a clean text turn; three deterministic demotions turn a surface back into text after the fact (the `NET_NOOP` strip, the ask-integrity degrade, and the round-bound `ProduceHalt`, which discards the last round's note and shows the host's `GENERIC_FAILURE_MESSAGE` instead of an answer).

Two further facts shape the problem. Text never streams first: the note rides the meta-line, which is yielded only after the whole round has validated (SPEC-R5 validate-then-stream), so a user waits for the entire generation before reading a word. And when integration tools are active, the Anthropic adapter buffers every round's text and discards pre-tool text from the wire (the GH #49 loop), so the tool mechanics that exist today cannot carry a "text first, then UI" turn as they stand.

## 2. Users

- The chat user on agent-admin's Test Chat, the a2ui-chat and a2ui-live pages, and any `AgentTransport` consumer: wants a short answer when a short answer is right, and a surface when structure helps (data, comparisons, input, long lists, multi-step actions), without a visible wait.
- The persona author: wants a per-agent lean toward text or surface without rewriting the grammar.
- Kim and the eval seats: want the choice measured on a labelled set, keyless where possible.

## 3. Outcomes (goals)

- PRD-G1: the response type is a deliberate, observable decision made inside the turn. The model calls `render_surface` when it wants UI; otherwise it answers in text. No classifier or router call precedes the turn.
- PRD-G2: text is the default and arrives first. A text turn ships as soon as the model stops; a surface turn ships its text before its surface, and the text streams live when no integration tool is active in the turn.
- PRD-G3: the user and the persona can steer. A user override ("just tell me", "show me", or a composer toggle) is honored mechanically; a persona hint (`prefers: text | surface | auto`) biases the model; the override beats the hint.
- PRD-G4: a failed surface still leaves an answer. When the surface fails validation after the round bound, the turn ships the model's text and tallies the degrade on the trace instead of ending in a halt.
- PRD-G5: an open surface is updated before a new one is created, by teaching and by the tool input naming the open surface.
- PRD-G6: the escalation hook exists as a seam: a repair round can raise the tier (effort, then model) through one injected policy, with no policy shipped in this change beyond the seam.

## 4. Non-goals

- Model-tier routing itself (the policy that picks Haiku think or Sonnet think). Only the seam ships.
- New components, catalog rows, or a redesign of the activity strip.
- Any key, provider adapter or `produce()` import entering `@agent-ui/devtools` (ADR-0073 clause 5, ADR-0200).
- Retiring the leading meta-line. Declarations (`ask`, `plan`, `flowEnd`, `personaPatch`, `team`, `target`) keep their home; only the reply text and the A2UI payload move.
- Token-level text streaming while an integration tool round is in flight. That turn's text ships whole at round end (the adapter's scratch-prose law stands).

## 5. Requirements (what must exist)

- R1: a `render_surface` tool, owned by `produce()`, offered on every turn where A2UI is enabled, whose input carries the A2UI JSONL (and may name the open surface it updates). Calling it ends the model's turn: no tool-result round trip follows a successful call.
- R2: the reply text is the model's ordinary text channel. The wire still carries one leading meta-line per turn whose `note` is that text, so every existing client renders unchanged.
- R3: a legacy fallback: a round whose text channel starts with A2UI JSONL (the pre-change shape) runs today's peel, heal and validate path byte for byte. Every existing scripted fixture, kit scenario and recorded transport stays green without edits.
- R4: streamed text deltas on the wire as an additive meta arm, yielded as the model produces them when the turn offers no integration tool; old clients ignore the arm, new clients paint it and replace it with the final `note`.
- R5: a validation failure of the tool payload is a self-correct round with the structured failures fed back (today's repair loop, same round bound); at the bound a non-empty text ships as a text turn with a `SURFACE_DEGRADED` tally; an empty text keeps today's halt path.
- R6: user override, mechanical: a "text" override withholds the tool for the turn; a "surface" override forces the tool call where the provider allows it, else one correction round.
- R7: persona hint `prefers`, a persona setting sent per request, validated fail-closed, composed as one short teaching paragraph; `auto` and absent compose zero bytes.
- R8: open-surface bias: the tool's per-turn description names the session's open surfaces and asks for an update over a create.
- R9: the escalation seam: an injected per-repair-round policy returning an optional `effort` and `model` for that round.
- R10: measurement: a labelled set of at least 40 prompts tagged `text`, `surface` or `both`, a `response-type` eval leg with a pure scorer (false-surface and missed-surface rates), scripted selftest turns that run keyless in `check:scripts`, and a seeded wrong-choice turn that fails the selftest.
- R11: the prompt stack change is deliberate: the byte-pinned baseline is recaptured once, the whole-prompt budget stays within ADR-0234's ceiling, and tokens per turn stay within K6.

## 6. KPIs

Baselines were measured on this tree (commit `4dda7634`, 2026-10-09) with the keyless commands named in each row. A KPI that needs a model is `pending-live`: Kim's manual run of `npm run eval:agent-behavior -- live --leg response-type` on the labelled set, first on `main` before the build merges (the baseline), then on the built branch (the result). No number below is estimated.

| KPI | Target | Baseline (measured) | How measured | Result |
|---|---|---|---|---|
| K1 selection accuracy on the labelled set (>= 40 prompts tagged text/surface/both) | >= 90% overall | 42/43 right (97.7%), old loop on the 43 labelled prompts, Haiku 5.5 (`claude-haiku-5-5`), 2026-10-09; `.sdlc/response-type-selection/live-baseline.txt` | `npm run eval:agent-behavior -- live --leg response-type` (needs `ANTHROPIC_API_KEY`); the keyless half is the scripted selftest | 42/43 right (97.7%), built loop after T-0061 round 1, Haiku 5.5, 2026-10-09 (`.sdlc/response-type-selection/live-result-r1.txt`); meets >= 90%. Before T-0061 the built loop scored 35/43 (81.4%, `live-result.txt`: missed-surface 8/20), below target. The one remaining miss is `both-workout-intro-plan` (see K2). The script did not print a cost |
| K2 false-surface rate (UI where text was right) / missed-surface rate | <= 5% / <= 10% | false-surface 1/23 (4.3%, `text-explain-closure`), missed-surface 0/20, old loop, Haiku 5.5, 2026-10-09 (`live-baseline.txt`) | same leg; the scorer reports both rates on its summary line | false-surface 0/23 (0%), missed-surface 1/20 (5%), built loop after T-0061 round 1, Haiku 5.5, 2026-10-09 (`live-result-r1.txt`); both inside target. The one miss, `both-workout-intro-plan`, was not repaired: it failed with PARSE then SURFACE_DEGRADED over 3 rounds and degraded to text (`repair=eventual-text`), so the user still got the prose answer (K4 held) but not the schedule surface. Before T-0061 missed-surface was 8/20 (40%), outside target. Repair rounds on the 43 turns: first-pass 42, eventual-text 1, halt 0. The script did not print a cost |
| K3 added model calls per turn vs today, by response type / text-turn time to first token | 0 added calls for a clean text turn and a clean surface turn; a repair round costs one call as today / TTFT within 5% of baseline or better | calls per clean turn today: 1 (`scripted PASS repair-first-pass ... rounds 1`, selftest exit 0); a repair costs one extra call (`repair-eventual rounds 2`) / TTFT: old loop, first line over 43 turns on Haiku 5.5, 2026-10-09 (`live-baseline.txt`): p50 3,410 ms, p90 8,040 ms, max 11,558 ms (the first wire line of any turn followed the whole generation) | `npm run eval:agent-behavior -- selftest` for the call count (the `rounds` column); TTFT from the live leg's per-case timing added in R10 | calls per clean turn: 1 for text (`response-type-text-clean`, `response-type-tool-clean` exit 0) and 1 for a surface (`produce-response-type.test.ts`, one provider request per clean round); a repair adds one round as before (`repair-eventual rounds 2`); 0 added calls. TTFT (first line, 43 turns, Haiku 5.5, 2026-10-09, `live-result-r1.txt`): p50 1,536 ms, p90 3,946 ms, max 4,658 ms, against the old loop's 3,410 / 8,040 / 11,558 ms: p50 is 55% lower, so the "within 5% or better" bound holds. The p90 values are nearest-rank over the per-case `firstLineMs` values in the two files. The T-0060 build before T-0061 measured p50 1,042 ms (`live-result.txt`); p50 rose to 1,536 ms after T-0061. The script did not print a cost |
| K4 turns that end with a user-visible answer after a surface validation failure | 100% | today a round-bound failure ends in `ProduceHalt` and the host's generic message, the model's note discarded: `scripted PASS repair-halt expected outcome halt, rounds 3`; a mid-bound repair that succeeds ships normally | the scripted selftest: a new `degrade-to-text` turn expecting outcome `eventual-text` with `SURFACE_DEGRADED` on the trace | 100% keyless: `scripted PASS response-type-degrade expected outcome eventual-text, rounds 3, failureCodes [CATALOG,SURFACE_DEGRADED]` (selftest exit 0, 2026-10-09); a degrade with empty text still halts (`repair-halt` unchanged) |
| K5 user override honored | 100% in tests | not applicable today (no override exists) | keyless: produce-loop tests that assert the tool is withheld on a text override and forced (or corrected) on a surface override; the kit scenario `response-type-override` | 100% in tests: `produce-response-type.test.ts` (tool withheld on a text override, forced or corrected on a surface override) and the kit scenario `response-type-override` green; `response-type-text-override` scripted PASS. Known limit below |
| K6 tokens per turn | <= +10% vs baseline, prompt rubric included | default composition for the `agent-ui` catalog, no exemplars, no mini-skills: 42,209 chars (grammar 24,035, components 18,029, functions 145); with the three mini-skills a booking intent selects: 43,879 chars. The +10% room is therefore about 4,200 chars for the tool definition, the teaching and the preference paragraph together. ADR-0234's 140,000 is the worst-case matrix budget, a different number | `buildSystemPromptSections` over the default catalog (the measurement script in the LLD) plus the tool definition's serialized length; live token counts ride `TurnTrace.usage` | default + tool 43,270 chars (+2.5% vs 42,209), text preference + tool 43,521 (+3.1%), surface preference + tool 43,557 (+3.2%); tool definition 447, preference sections 251 and 287 (step 5 measurement); inside +10% |
| K7 keyless gates green | exit 0 | `npm run eval:agent-behavior -- selftest` exit 0 (7 scripted turns, 0 mismatches, pins ok); `kit.ts selftest` exit 0 (6 DOM-free seeded fixtures red with their pinned codes, negative control ok); the live leg without a key exits 2 as documented | `npm run check`, `npm test`, the two selftests, judged by exit code | exit 0 on this tree, 2026-10-09: `npm run check` (both selftests ride `check:scripts`: `eval:agent-behavior -- selftest` 16 scripted turns, 0 mismatches, pins ok; `kit.ts selftest` 10 scenarios green, negative control ok) and `npm test` (707 files, 14,739 tests, 0 failed) |

Live comparison, Haiku 5.5 (`claude-haiku-5-5`), 43 labelled prompts, run 2026-10-09 (files under `.sdlc/response-type-selection/`). The script did not print a cost; the figures below are all it reported.

| Measure | Old loop (`live-baseline.txt`) | Built loop, T-0060 (`live-result.txt`) | Built loop, T-0061 round 1 (`live-result-r1.txt`) | Target |
|---|---|---|---|---|
| Right type (K1) | 42/43 (97.7%) | 35/43 (81.4%) | 42/43 (97.7%) | >= 90% |
| False-surface (K2) | 1/23 (4.3%) | 0/23 | 0/23 | <= 5% |
| Missed-surface (K2) | 0/20 | 8/20 (40%) | 1/20 (5%) | <= 10% |
| Repair: first-pass / eventual / eventual-text / halt | 35 / 8 / 0 / 0 | 43 / 0 / 0 / 0 | 42 / 0 / 1 / 0 | no halt (K4) |
| First line p50 / p90 / max (ms) | 3,410 / 8,040 / 11,558 | 1,042 / 4,428 / 6,095 | 1,536 / 3,946 / 4,658 | p50 within 5% of the old loop or better |
| Input / output tokens | 956,137 / 32,621 over 43 turns | 718,589 / 18,298 over 37 of 43 turns | 833,328 / 27,836 over 40 of 43 turns | within K6 |

The one outstanding miss is `both-workout-intro-plan`: the model produced a surface that failed validation three times and the turn fell back to prose, as K4 requires. The model chose the right type, but the surface did not parse, so it counts as missed-surface; it is left open.

## 7. Shape of success

A user asks "what is the capital of Finland": the reply "Helsinki." appears as the model writes it and the turn ends with no card. The same user asks "compare the three plans": the text "Here is the comparison, the Pro plan is the one I would pick for a team of five." appears first, then the comparison surface renders under it. A user says "just tell me" on the next question: no card, whatever the persona prefers. A persona set to `prefers: surface` reaches for a card on a borderline ask and still answers in words when the user says so. A surface that fails validation three times ships the text that was written for it, and the activity strip shows the repair rounds and the degrade, never a dead turn. Kim's live run on the labelled set reads 90% or better with the two error rates inside their bounds, and every keyless gate is green.

## 8. Known limitations

- The override lexicon (RTS-R6) is noun-gated: a surface noun within four words of "show me", "make me" or "build" forces a surface. Surface nouns that are also ordinary words still force a surface wrongly: "build a list of reasons", "make me a table of contents", "show me the list of files in my home folder", "show me how a table join works", "show me what a card game looks like", "build a wizard character". Some real surface asks are not caught and fall to the model's own choice: "show me a diagram", "Build me a form". Whether to tighten further is decided at close-out.
- While an integration tool is active in a turn the reply text ships whole at round end, not streamed (ADR-0242).
- A forced surface override under extended thinking is a correction round, not an API-level force (ADR-0242).
