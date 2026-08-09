---
name: agent-ui-a2ui-meta-line-facts
description: >-
  The a2ui producer's meta-line/envelope architecture: model-authored fields (note/ask/plan) vs
  runtime-composed fields (progress/trace/error), the ask-arm precedent a new additive field must
  follow, and the persona-scoped modality-gate pattern (SURFACE_A2UI_KEY/SURFACE_GENUI_KEY/
  SURFACE_PLANNER_KEY) for opting a capability in without changing default behavior. Use for "how
  does the meta-line envelope work", "add a field to the envelope", "what's a modality gate",
  "how was the plan arm designed", "is this model-authored or runtime-composed", "does this
  persona feature need its own gate". NOT for the producer's PROMPT STACK (a2ui-prompt-author);
  NOT for composing A2UI payloads (a2ui-compose).
user-invocable: false
disable-model-invocation: false
---

# A2UI meta-line and envelope architecture

The `a2uiMeta` envelope (`packages/agent-ui/a2ui/src/agent/meta-line.ts`, ADR-0088) is a reserved,
versionless, out-of-band channel riding alongside the validated A2UI wire — every `produce()` call's
leading line, never itself part of `A2uiServerMessage`. This skill states the two-axis architecture
the envelope has grown by (ADR-0088 → ADR-0097 → ADR-0146 → ADR-0159 → ADR-0174) and the ONE precedent
a new additive field must follow. It answers architecture questions; it does not author prompt
files (`a2ui-prompt-author`) or payloads (`a2ui-compose`).

## The two field classes — never conflate them

| Class | Fields | Who authors it | Validation | Precedent ADR |
|---|---|---|---|---|
| **Model-authored, additive, shallow-validated** | `note`, `ask`, `plan` | The model declares it on its own leading meta-line | A malformed field drops ONLY itself, never the whole envelope (`readMetaLine`'s per-field-independent guard) | ADR-0097 (`ask`), ADR-0174 (`plan`) |
| **Runtime-composed** | `progress`, `trace`, `error` | The host/produce loop assembles it from what actually happened | N/A — never model output | ADR-0146 (`progress`), ADR-0088 (`trace`), GH #144 (`error`) |

The whole envelope is written in `formatMetaLine` (plus `formatTerminalErrorLine`, the one narrow
second writer for GH #144's terminal-error case) and read in `readMetaLine`; a new field always
widens both, never a third parse path — there is exactly ONE meta-line reader, ever.

## Adding a new model-authored field: the ask-arm precedent, exactly

ADR-0097's `ask` field is the reference shape every later additive field (`plan`, ADR-0174; any
future one) follows point-for-point — not "inspired by," but the literal precedent argued from
clause-by-clause at each later ADR:

1. **Additive only.** The envelope stays versionless; a new field is a new optional key, never a
   breaking reshape. `AgentTransport.turn`'s signature stays byte-identical.
2. **Model-authored, never runtime-assembled.** The model declares the field itself, the same way
   it declares `note` — this rules out treating a new field's DATA as something the host computes
   and injects.
3. **Shallow-validated, independently of every other field.** A malformed instance of the new field
   drops only that field on read; it never invalidates `note`/`ask`/whatever else rode the same
   line. There is no envelope-wide "if any field is malformed, drop the whole line" rule — don't
   invent one for a new field.
4. **Never overload a CLOSED, narrower-scoped vocabulary to carry the new fact.** `TURN_PROGRESS_STAGES`
   (`progress`'s closed stage table, ADR-0146 F2's honesty-law guard) describes ONE round's
   internal lifecycle — it is not a place to smuggle task-level or model-declared structure, no
   matter how tempting the "just add a stage" shortcut looks. If the new fact is a genuinely
   different KIND of thing than what an existing field's vocabulary was designed for, it earns its
   own field, not a widened closed enum.
5. **Wire mechanics teaching lives in `GRAMMAR`, host-owned, never persona-editable prose.**
   `system-prompt.ts`'s `GRAMMAR` constant is byte-pinned and drift-gated
   (`system-prompt-grammar.test.ts`); a persona-editable `kind: "prompt-section"` entry (ADR-0132)
   is for VOICE, never for teaching the model exact JSON shape it must reproduce for the protocol
   to keep working. ADR-0097 §4 (`ask`) and ADR-0126 (the message-lifecycle rule) both landed their
   mechanics teaching in `GRAMMAR`; ADR-0174 cl.6 confirms the SAME rule for `plan`, with the
   reasoning made explicit: a persona author editing worded teaching prose risks silently breaking
   model adherence to a JSON shape `readMetaLine` can shallow-validate but never RECOVER from if the
   teaching itself was garbled.

If a proposed new field fails any one of these five, it is not following the ask-arm precedent —
stop and re-derive, don't ship a variant shape.

## The modality-gate seam: opt-in persona capabilities that stay byte-identical when off

The fleet's pattern for a persona-scoped capability that must never regress the default turn
shape: a `SURFACE_*_KEY`-style boolean constant (`agent-admin-schema.ts` — `SURFACE_A2UI_KEY`,
`SURFACE_GENUI_KEY`, `SURFACE_GENUI_DOGFOOD_KEY`, and `SURFACE_PLANNER_KEY` joining them per
ADR-0174 cl.1), OFF by default, admin-authored per persona, dimmed in the admin UI while its own
gate is off ("noise, not configuration" — ADR-0170 cl.5's phrasing, reused verbatim at ADR-0174).

The seam has two load-bearing properties, both required together — a gate satisfying only one is
not this pattern:

- **Absent/false ⇒ byte-identical to before the capability existed.** This is the SAME standing
  law every `ProduceOptions` field already carries (`produce.ts`'s own doc comments: "Absent ⇒
  byte-identical composition"). A modality gate that changes ANY observable behavior while off is
  not opt-in, it's a silent default change wearing a flag.
- **The gate lives at BOTH layers, never only one.** A per-persona STORE key (so an admin can author
  "this persona uses X") that threads to a per-call `ProduceOptions`-adjacent flag the host loop
  reads BEFORE deciding which shape to run — never `produce()` deciding internally, which would
  make the primitive itself branch on persona config it shouldn't need to know about. ADR-0174 cl.1
  rules out a request-only flag (no persona-authoring surface) and a global always-on default
  (regresses every task class that doesn't need the capability) as the SOLE mechanism, for exactly
  this reason.

## Worked example: how `plan` (ADR-0174) actually applied both rules

`plan: { steps: [...] }` is model-authored on the leading meta-line (ask-arm rule 2), shallow-
validated independently (rule 3), does NOT ride `TURN_PROGRESS_STAGES` (rule 4 — a plan is
task-level structure, not one round's lifecycle), and its mechanics teaching landed in `GRAMMAR`
(rule 5). The capability that turns planning on at all is `SURFACE_PLANNER_KEY`, gated exactly the
way `SURFACE_A2UI_KEY` already was — persona-scoped, OFF by default, threaded to a host-loop flag
`produce()` itself never inspects (the multi-call plan→execute→synthesize loop lives host-side,
outside any one `produce()` call). Read ADR-0174 cl.1–cl.2 for the full argument if extending this
further; this skill states the reusable PATTERN, not this one field's complete design.

## Lineage — read in this order if you need the full argument chain

ADR-0088 (the envelope itself: reserved, versionless, `A2uiServerMessage`-disjoint) → ADR-0097
(`ask`, the model-authored/shallow-validated precedent) → ADR-0146 (`progress`, the
runtime-composed counter-example + the closed-vocabulary honesty law) → ADR-0159 (the receipt
pattern for rendering a progress-driven field live, reused by `plan`'s status-stream grouping) →
ADR-0174 (`plan` + `SURFACE_PLANNER_KEY`, the worked application of every rule above to a new
field AND a new modality gate at once).
