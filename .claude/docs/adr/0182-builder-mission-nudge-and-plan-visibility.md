# ADR-0182 — Builder-interview mission nudge + `plan` visibility (GH #716): the drive-to-completion teaching gates on `session === 'authoring'` (derived host-side), NEVER on the broader `authoringSurface` modality; the received `plan` renders through the EXISTING append-only note composition, no new UI component

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-11
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-11 |
> | **Proposed by** | host session (solo design pass — the Agent-tool subagent spawn ceiling was reached this session; no dedicated planner seat available) — GH [#716](https://github.com/kimgranlund/agent-ui/issues/716), filed against the shipped agent-authoring family (ADR-0178/#633) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-12, via the [`ratify ADR-0182` utterance](https://github.com/kimgranlund/agent-ui/issues/716#issuecomment-5270016163) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification+build:** [`gh716-builder-mission.spec-amendment.md`](../decompositions/gh716-builder-mission.spec-amendment.md) applied verbatim to [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md), adding **SPEC-R31** (the `builderMission` gate + `missionBlock` teaching, the SPEC-R30 pattern applied a second time) · `packages/agent-ui/a2ui/src/agent/system-prompt.ts` (`missionBlock(builderMission)` + `buildSystemPrompt`'s 9th positional arg) + new byte-pinned `prompts/builder-mission.md` · `packages/agent-ui/a2ui/src/agent/produce.ts` (`ProduceOptions.builderMission?: boolean`, threaded) · `packages/agent-ui/a2ui/tools/agent/chat-validation.ts` (`validateBuilderMission`, the `validateAuthoringSurface` shape) · `worker/index.ts` + `dev-proxy-plugin.ts` (both transports thread the validated boolean) · `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts` (`AdminSurfaceTurnEvent` gains `{kind:'plan'; plan: PlanDeclaration}`) · `site/lib/admin-live-runner.ts` (derives `builderMission` from `req.session === 'authoring'` into the POST body; peels `plan` into the new event kind) · `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (`#runSurfaceTurn` folds a formatted plan checklist into the existing `outgoing` note composition). |
> | **Supersedes / Superseded by** | **Extends** [ADR-0178](./0178-agent-authoring-conversational-persona-hydration.md) (this is the family's own "genuinely undecided" hydration-loop follow-up — GH #716 is a direct sequel to #633, filed after ADR-0178 shipped; applies its cl.1/cl.3 rules — additive-only, model-authored, shallow-validated, modality-gated — a third time) · **Extends** [ADR-0174](./0174-planner-stage-pilot-sequential-opt-in-loop.md) (reuses the shipped `plan`/SPEC-R20 meta-line arm as-is — no wire change to `plan` itself, only a new CONSUMER of the already-parsed field) · **Relates** [`agent-ui-a2ui-meta-line-facts`](../references/) skill (the five-rule envelope precedent this ADR's cl.1 applies verbatim) · **Resolves** GH [#716](https://github.com/kimgranlund/agent-ui/issues/716) (the issue's own Findings comments name the placement question this ADR answers). |

## Context

**The ask (GH #716).** The Builder's conversational persona-hydration interview (ADR-0178) should
actively nudge the user toward finishing the agent definition each turn, and surface its own sense
of progress ("3 of 6 sections filled") rather than leaving the model to improvise pacing. The issue's
own Findings comments already narrowed the shape: reuse the shipped `plan` meta-line arm
(ADR-0174/SPEC-R20) for the progress signal, and add a new host-owned teaching section for the
drive-to-completion instruction — but left the gate signal as an open placement question, quoted
verbatim in the issue: "the builder should add it as its own host-composed section under the
authoring gate ... or amend ADR-0178 if that boundary reads otherwise."

**Verified facts, standing on real source:**

- **`session: 'authoring'` is structurally Builder-interview-exclusive; `authoringSurface` is not.**
  `agent-admin.ts`'s `#contextFor(origin)` sets `session: 'authoring'` if and only if
  `authoringStore !== undefined && origin === 'copilot' && this.#authoringConversation` — i.e. only
  when the turn is driving through the Builder persona's own dedicated Co-pilot pane with an armed
  authoring store. `authoringSurface` (`SURFACE_AUTHORING_KEY`, ADR-0178 cl.3/SPEC-R30) is a
  persona-scoped modality flag ANY persona can enable, for its OWN chat turn — enabling it on, say,
  a shipped croupier persona's test chat would (under the issue's literal suggestion) have taught
  that persona to nudge the user toward finishing *an agent definition*, which it is not authoring.
  The issue's literal suggestion ("under the authoring gate") is therefore imprecise; `session ===
  'authoring'` is the correct, already-existing signal, and it requires no new field anywhere.
- **`session` is client-local today — never sent over the wire.** `admin-live-runner.ts`'s
  `createAdminSurfaceTurn` reads `req.session` only to key its own local `sessions` Map
  (`sessionKey = req.session ?? 'test'`); the POST body built at lines ~153-184 enumerates every
  field sent to the produce endpoint and `session` is not among them. The runner is therefore the
  ONE place that can derive a new wire-bound boolean from it without touching
  `AdminSurfaceTurnRequest`'s public shape at all.
- **`readMetaLine` already parses `plan` correctly; the gap is entirely on the consumption side.**
  `meta-line.ts` (lines 233-249) builds a full `PlanDeclaration` from the wire today. `admin-live-
  runner.ts`'s event-peel loop (lines ~190-217) reads `.error`/`.progress`/`.note`/`.personaPatch`
  but falls through `.plan` to `continue` unconditionally — no event kind carries it forward, so the
  component never sees a plan the model already declared.
- **The append-only note composition is the existing, correct extension point for rendering it.**
  `#runSurfaceTurn`'s closing line folds `note`, `assetWarning`, and the `a2uiRefused` notice into one
  `outgoing` string via `.filter(Boolean).join('\n\n')` — the SAME shape a formatted plan checklist
  needs, with zero new UI component and zero risk of colliding with the existing note surface.

## Decision

1. **Gate signal: `session === 'authoring'`, derived host-side, never `authoringSurface`.** The new
   mission-nudge teaching is NOT a persona-configurable modality — it is a fact about which pane is
   driving the turn, decided once, in `admin-live-runner.ts`, from the request's existing `session`
   field. No new field is added to `AdminSurfaceTurnRequest`; the runner computes
   `builderMission = req.session === 'authoring'` and includes that ONE derived boolean in the POST
   body sent to the produce endpoint. This corrects the issue's own literal placement suggestion.
2. **A new modality gate at the wire boundary: `builderMission` (SPEC-R31).** Once the derived
   boolean crosses into the untrusted wire boundary, it is validated the SAME fail-closed way every
   sibling gate is (`validateAuthoringSurface`'s exact shape): non-boolean degrades to `undefined`,
   never a 400. `buildSystemPrompt` gains a 9th positional parameter and a `missionBlock(gate)`
   function mirroring `authoringBlock` byte-for-byte — a literal `true` composes the new teaching
   block; anything else composes zero bytes (the byte-identical-to-before-this-parameter-existed
   law every sibling parameter already holds).
3. **No new wire arm for progress — reuse `plan` (SPEC-R20) exactly as shipped.** The mission-nudge
   teaching instructs the model to declare its own progress using the ALREADY-SHIPPED `plan` arm
   (steps = the agent-definition sections still open); this ADR adds no new meta-line field.
4. **Runner: peel `plan`, mirroring the `personaPatch` peel precedent.** `admin-live-runner.ts`'s
   event loop gains `if (meta.a2uiMeta.plan) yield { kind: 'plan', plan: meta.a2uiMeta.plan }`,
   the same shape as its existing arms. `AdminSurfaceTurnEvent` gains
   `| { kind: 'plan'; plan: PlanDeclaration }`.
5. **Rendering: fold into the existing append-only `outgoing` composition — no new component.**
   `#runSurfaceTurn` formats `PlanDeclaration.steps` into a plain checklist string and adds it as a
   third member of the existing `[note, assetWarning, ...].filter(Boolean).join('\n\n')` fold. A
   dedicated progress-bar/checklist UI component is explicitly deferred — this ADR ships the
   smallest correct increment, matching the family's own S1/S4 "plain reuse, no new doc" tier for
   slices this mechanical.
6. **Prose is a first-draft, not a final one.** The new `prompts/builder-mission.md` teaching text
   is authored to the same rigor as every other byte-pinned prompt file, but — unlike the WIRING,
   which is fully gate-tested and mechanical — its exact wording can only be fully validated against
   a live model's actual behavior. Kim should smoke-test a real Builder turn before treating the
   prose as final; the wiring around it merges regardless of that outcome.

## Consequences

- Zero new client-facing fields on `AdminSurfaceTurnRequest`; one new event kind on
  `AdminSurfaceTurnEvent`. The public component contract widens by exactly the minimum this ticket
  needs.
- `builderMission` OFF (any persona other than the Builder's own authoring turn, or a malformed
  wire value) is byte-identical to today's behavior at every layer — same degrade law as every
  sibling gate.
- The mission-nudge teaching can never reach a non-Builder persona's turn, because its gate is
  derived from structural turn-origin, not a flag a persona document could set on itself.

## Open items

- **OF1 — plan-step framing for "sections of a form," not "steps of a task."** SPEC-R20/R21's
  existing plan-runner prose (ADR-0174) frames steps as work items to execute sequentially; this
  ADR's use is closer to a checklist of already-open sections. The `missionBlock` teaching text must
  make this framing explicit so the model does not conflate the two `plan` usages — flagged for
  Kim's live smoke-test (Decision cl.6), not a wire-level ambiguity.
