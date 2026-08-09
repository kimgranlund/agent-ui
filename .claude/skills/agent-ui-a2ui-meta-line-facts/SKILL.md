---
name: agent-ui-a2ui-meta-line-facts
description: >-
  The a2ui producer's meta-line/envelope architecture: model-authored fields
  (note/ask/plan/personaPatch) vs runtime-composed (progress/trace/error), the ask-arm precedent a
  new additive field must follow, the SURFACE_*_KEY modality-gate pattern for opt-in persona
  capabilities, and the host-side apply-gate write
  discipline for model-proposed store state (drop-never-coerce). Use for "how does the meta-line
  envelope work", "add a field to the envelope", "what's a modality gate", "how was the
  plan/personaPatch arm designed", "how does a model-authored patch reach the store". NOT for the
  producer's PROMPT STACK (a2ui-prompt-author); NOT for composing A2UI payloads (a2ui-compose).
user-invocable: false
disable-model-invocation: false
---

# A2UI meta-line and envelope architecture

The `a2uiMeta` envelope (`packages/agent-ui/a2ui/src/agent/meta-line.ts`, ADR-0088) is a reserved,
versionless, out-of-band channel riding alongside the validated A2UI wire — every `produce()` call's
leading line, never itself part of `A2uiServerMessage`. This skill states the two-axis architecture
the envelope has grown by (ADR-0088 → ADR-0097 → ADR-0146 → ADR-0159 → ADR-0174 → ADR-0178) and the ONE precedent
a new additive field must follow. It answers architecture questions; it does not author prompt
files (`a2ui-prompt-author`) or payloads (`a2ui-compose`).

## The two field classes — never conflate them

| Class | Fields | Who authors it | Validation | Precedent ADR |
|---|---|---|---|---|
| **Model-authored, additive, shallow-validated** | `note`, `ask`, `plan`, `personaPatch` | The model declares it on its own leading meta-line | A malformed field drops ONLY itself, never the whole envelope (`readMetaLine`'s per-field-independent guard) | ADR-0097 (`ask`), ADR-0174 (`plan`), ADR-0178 (`personaPatch`) |
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
`SURFACE_GENUI_KEY`, `SURFACE_GENUI_DOGFOOD_KEY`, `SURFACE_PLANNER_KEY` joining them per
ADR-0174 cl.1, and `SURFACE_AUTHORING_KEY` per ADR-0178 cl.3), OFF by default, admin-authored per persona, dimmed in the admin UI while its own
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

## Worked example: how `personaPatch` (ADR-0178) applied the rules — with ONE ruled divergence

`personaPatch: { values?: {...}, entries?: {...} }` (SPEC-R29, `a2ui-live-agent.spec.md` §3.2d) is
the third model-authored arm — an authoring turn declares persona-state deltas on the same leading
meta-line. Its wire shape is TWO sibling maps, not one: `values` proposes scalar store state (set),
`entries` proposes entry-list contributions (contribute) — declared distinctly so the model states
its INTENT rather than the host inferring it from a key table. Both members' values stay `unknown`
at the wire: the producer package is persona-key-AGNOSTIC by construction (the DAG runs `a2ui` ←
`app`, where the persona schema lives), and every semantic filter is host-side (ADR-0178 cl.2).

Three points where its realization is worth reading against the five rules:

- **Whole-arm drop validation (rule 3, applied at ARM granularity).** `readMetaLine` still validates
  per-field-independently — a malformed `personaPatch` drops only itself, `note`/`ask`/`plan` on the
  same line parse normally — but WITHIN the arm there is deliberately ONE simple rule: a malformed
  member drops the ENTIRE arm, never just that member, because a half-parsed patch is the one shape
  a host apply loop must never be handed (SPEC-R29's malformed-shape enumeration).
- **Gate-blind passthrough with conditional key omission.** `produce()` passes a declared patch
  through UNCHANGED (the `note`/`plan` passthrough treatment) and `JSON.stringify` omits the key
  entirely on a patch-less turn, so the wire stays byte-identical to before the field existed. The
  passthrough never inspects the SPEC-R30 gate — the gate governs CONSUMPTION and TEACHING, never
  framing (SPEC-R29 AC3: gate-ON and gate-OFF runs emit identical streams; one peel path, no
  gate-conditional wire branch).
- **The ONE deliberate divergence from the plan precedent (rule 5, satisfied differently).** The
  arm's mechanics teaching is host-owned, byte-pinned, drift-gated — rule 5's actual requirement —
  but it lives in a CONDITIONAL segment (`system-prompt.ts`'s `authoringBlock`, the `genuiBlock`
  structural twin: degrade-to-`''`, additive, mode-invariant), NOT inlined into the unconditional
  `GRAMMAR` constant the way `ask`/`plan` mechanics are. SPEC-R30's reasoning: `plan`'s teaching is
  generic enough to ride every consumer's prompt, whereas persona-authoring mechanics are meaningful
  only to a persona that authors personas — inlining them in `GRAMMAR` would put admin-specific
  teaching in every A2UI consumer's prompt AND move SPEC-R6's byte-identity baselines for every
  caller. Rule 5 constrains OWNERSHIP (host, never persona-editable prose), not placement.

The gate is `SURFACE_AUTHORING_KEY` — the `SURFACE_PLANNER_KEY` shape verbatim (persona-scoped,
inverse-default OFF, fail-closed boolean-`true`-only read), threaded per-call as `buildSystemPrompt`'s
additive `authoringSurface` parameter; `produce()` uses it for exactly one thing — conditioning the
teaching — and never consumes a patch itself. Consumption is additionally host-FENCED beyond the
gate: a patch is consumed only when the turn's driving store IS the authoring draft store AND a fresh
gate read is ON, conjunctive (Kim's store-identity ruling, `agent-authoring-flow.lld.md` §15) — read
that LLD for the mechanism; this skill only records that gate-ON alone does not imply consume.

## Host-side apply-gate write discipline: a model-authored write never reaches a store raw

The genuinely new axis ADR-0178 cl.2 added: when a model-authored arm PROPOSES store state, the
host applies it through exactly three filters, in order, fail-closed at every step — a drop removes
the ITEM, never the patch, never the turn (`persona-patch.ts`'s `applyPersonaPatch`,
`agent-authoring-flow.lld.md` §3 — cite those, never copy the tables):

1. **Enumerated-key filter, Object-prototype-safe.** `values` keys must be ∈ `PERSONA_VALUE_KEYS`,
   `entries` keys ∈ `PERSONA_ENTRY_LIST_KEYS`; unknown keys (and wrong-intent keys — a `values` key
   naming an entry list) drop silently. The admission table is a `ReadonlyMap`, NEVER plain-object
   indexing — wire-originated keys can be `__proto__`/`toString`/`hasOwnProperty`, and a plain-object
   lookup walks the prototype chain: measured outcomes were TypeErrors escaping into the turn `catch`
   (failing the whole turn, violating the drop-the-item law) and truthy inherited members ADMITTING
   an unknown key past filter 1 (the GH #645 review catch; the full measurement lives in
   `persona-patch.ts`'s `ADMISSION` doc comment).
2. **Per-key FIXPOINT admission — drop, never coerce.** The shipped read-time sanitizers COERCE
   (`sanitizeModel` answers the default id for garbage) — right for reads, catastrophic for an apply
   gate, which would write a wrong-but-valid-looking value and call it the model's intent. So a value
   is admitted iff its own sanitizer returns it UNCHANGED (`sanitize(v) === v`); a coercing
   sanitizer's OUTPUT is never written. This reuses each key's existing judgment without inventing a
   second validation vocabulary, and makes every rejection a DROP recorded on the turn log
   (`PatchReport`), never an error surface mid-conversation.
3. **Entries through the host's single validated add path.** Each proposed entry goes through the
   IDENTICAL `validateNewEntry` call the pane's own add form makes (ADR-0132 cl.4's single-add-path
   law, ADR-0164's extraction) — append-only, never a list replacement, and NO deletion semantics
   exist in the code path at all, which is what keeps a hallucinated patch non-destructive by
   construction (SPEC-R29's merge law).

The pattern generalizes: any future model-proposed-state arm inherits this chain's shape —
enumerate the writable keys, admit by fixpoint over the keys' own fail-closed readers, route
list-shaped contributions through whatever single validated add path already exists.

## Lineage — read in this order if you need the full argument chain

ADR-0088 (the envelope itself: reserved, versionless, `A2uiServerMessage`-disjoint) → ADR-0097
(`ask`, the model-authored/shallow-validated precedent) → ADR-0146 (`progress`, the
runtime-composed counter-example + the closed-vocabulary honesty law) → ADR-0159 (the receipt
pattern for rendering a progress-driven field live, reused by `plan`'s status-stream grouping) →
ADR-0174 (`plan` + `SURFACE_PLANNER_KEY`, the worked application of every rule above to a new
field AND a new modality gate at once) → ADR-0178 (`personaPatch` + `SURFACE_AUTHORING_KEY` +
the host-side three-filter apply gate — the second application of the whole pattern, plus the
ruled conditional-teaching divergence and the write-discipline axis; SPEC-R29/R30 pin the wire
and gate contracts, `agent-authoring-flow.lld.md` §3/§15 the host apply mechanics).
