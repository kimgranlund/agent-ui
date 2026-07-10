---
name: a2ui-compose
description: >-
  Compose an A2UI payload/surface — the server→client message stream (createSurface,
  updateComponents, updateDataModel) that renders a Generative UI. Use when authoring,
  extending, or debugging an A2UI payload against a catalog: idiomatic node shapes per
  catalog type, adjacency-list component trees, ChildList list templates, data bindings,
  actions, and validity checks, plus the bounded compose→validate→self-correct loop.
  NOT for ui-* control source (agent-ui-component-create), a2ui package/renderer/catalog
  code (a2ui-builder), corpus curation (a2ui-corpus-curate), docs-site pages (docs-author),
  or direct-DOM feature composition with shipped controls — no wire protocol involved
  (agent-ui-compose-ui).
user-invocable: true
disable-model-invocation: false
---

# Compose A2UI payloads

Author the A2UI message stream an agent emits to render a Generative UI against a named catalog. Scope:
the payload — node shapes per catalog type, the adjacency-list tree, `ChildList` list templates, data
bindings, actions and checks — and the bounded loop that proves it valid before it ships.

**This skill composes payloads; it does not write code.** NOT for `ui-*` control source (that is the
`agent-ui-component-create` skill / `component-builder` agent), NOT for `@agent-ui/a2ui` package, renderer,
validator, or catalog source (that is the `a2ui-builder` agent), NOT for corpus curation —
importing/judging/rescoring seeds (that is `a2ui-corpus-curate`), NOT for docs-site pages (that is
`docs-author`), NOT for direct-DOM composition with shipped controls (that is `agent-ui-compose-ui` — this
skill exists for the WIRE: an agent emitting messages a renderer paints).

## Mental model

An A2UI payload is an ordered stream of `version:"v1.0"` server→client messages (`protocol.ts:143-150`), of
three kinds you compose:

1. **`createSurface`** — opens the surface (`{ surfaceId, catalogId, sendDataModel? }`). Always first.
2. **`updateDataModel`** — the JSON data model bound paths read (`{ surfaceId, path?, value }`).
3. **`updateComponents`** — a FLAT adjacency list of nodes (`{ surfaceId, components: [...] }`), each
   `{ id, component, …props, child?|children? }`, wired parent→child by `id` string, not nested JSON.

Everything reactive — text that tracks data, two-way inputs, list templates, actions, validity — hangs off
those nodes via bindings. The catalog (`packages/agent-ui/a2ui/src/catalog/default/catalog.json`) is the
authority on which components and props exist; never invent a component or prop.

## Compose

Condition on real payloads FIRST, then build outside-in:

1. **Read the nearest idiom.** Skim the committed corpus shard
   (`packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`) and the 11-seed shelf
   (`packages/agent-ui/a2ui/src/examples/`) for the closest existing payload — a settings form, a dashboard of
   tiles, a wizard, a dynamic list. Adapt a shipped shape rather than inventing one.
2. **Open the surface.** Emit `createSurface` with the target `catalogId` (default `agent-ui`). Add
   `sendDataModel:true` when a triggered action must carry the model back.
3. **Seed the model.** Emit `updateDataModel` with the initial JSON for every path a control will bind.
   Load required fields empty when a blocked-submit state is the point.
4. **Build the tree, root-first.** Emit nodes as a flat list. Start at `id:"root"`, wire children by id.
   Use `child` for a `Field`'s single control, `children` (a static id list OR a `{path, componentId}`
   template) for containers. Depth: `references/trees-and-lists.md`.
5. **Wire the dynamics.** Bind bindable props (`{path}`), compose labels (`${…}`), attach `action` to Buttons,
   `checks` to inputs, and gate submits with a `FormProvider`. Depth: `references/bindings-actions-checks.md`.
6. **Match each node to its card.** Every component's idiomatic shape, bindable props, and ordering traps are
   in `references/node-idioms.md` (e.g. a Select and its Options MUST share one `updateComponents` message).

Prefer splitting `updateComponents` into several messages when composing a stream — the renderer is
out-of-order tolerant (`protocol.ts` + runtime SPEC-R4), so the root subtree can arrive before the leaves it
names, and the surface paints progressively.

## The bounded compose→verify→self-correct loop (SPEC-R6)

Encode this loop; it is the contract every composed payload passes. Depth and the who-drives-what rules are in
`.claude/docs/specs/llds/a2ui-harness-wiring.lld.md` §6.

1. **Generate** the payload, corpus-conditioned (step above).
2. **Run the deterministic gates FIRST** — the `validate-payload` CLI, before any grading:
   ```
   node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts <payload.json> [--catalog agent-ui]
   # exit 0 → { ok: true, repairs: [...] }   (heal ran first; any auto-repairs are named)
   # exit 1 → [ { code, path, message }, ... ]  (schema · unknown component · dangling child · bad pointer · version pin)
   ```
   The CLI composes the shared healer + validator + the default catalog — the SAME verdict the renderer and
   corpus admission return. On exit 1, read the codes, fix the payload, and re-run. This inner fix→re-run cycle
   is yours to drive freely: **checking your own output against a script is not grading it.**
3. **Grade only on gate-green.** Once the CLI exits 0, the payload is scored against the `a2ui-payload` rubric
   (`.claude/docs/rubrics/a2ui-payload.md`) by the independent `a2ui-reviewer` critic — never by you.
4. **Bound at `maxRounds = 3`**, then halt-and-report the round count and every verdict. Never retry silently.

### Who drives the rounds (get this right)

- **Rounds are HOST-orchestrated.** The composer has no Task tool and cannot invoke the critic; the dispatching
  host runs each round and calls the critic between them.
- **Gate failures loop back to you within a round** — deterministic self-checking against the CLI is free and
  expected.
- **A below-bar critic verdict returns to you VERBATIM** — the per-dimension scores plus the file:line-cited
  findings text — as the next round's input. That is the self-correction channel: revise the payload to close
  the cited gaps.
- **You NEVER self-grade.** You assign no rubric scores to your own output (SPEC-R8, generator ≠ critic).
  Receiving the critic's verdict between rounds is legitimate; producing your own scores is not.

## Validation checklist (run before reporting)

Draft → validate → fix → re-check → finalize only when clean:

- [ ] `createSurface` is the first message; every message carries `version:"v1.0"`.
- [ ] Every `component` and every prop exists in the target catalog (`catalog.json`); bound props are
      `"bindable": true`.
- [ ] Every `child`/`children` id resolves to a node (allowing later-in-stream arrival); no dangling refs.
- [ ] Every `{path}` bind and `${…}` template resolves against the seeded data model; relative paths only
      inside a list-item template.
- [ ] A `Select`/`Tabs` and their `Option`/`Tab`/`TabPanel` children ship in one `updateComponents` message.
- [ ] Required inputs sit under a `FormProvider` with a `submit:true` action to gate them.
- [ ] The `validate-payload` CLI exits 0 (repairs, if any, reviewed) — THEN report gate-green to the host,
      which dispatches `a2ui-reviewer` for grading (you never invoke the critic yourself).

## Common traps (non-obvious)

- **Field uses `child`, not `children`.** It wraps exactly one control; its `label` is that control's
  accessible name (ADR-0051).
- **Select/Options first-connect.** Options added to an already-connected Select never reach its panel — emit
  them together (`node-idioms.md`, ADR-0053).
- **`submit:true` is client-only.** It gates the FormProvider; it never appears on the emitted action wire.
- **Bindable prop = the control's own prop.** Bind `checked` on a Checkbox/Switch, `selected` on Tabs — not a
  generic `value` (ADR-0053 naming law).
- **Positional lists.** A `{path, componentId}` template is index-based; v1.0 has no per-item key (ADR-0024).
- **ISO-canonical values.** `type:"date"`/`type:"time"` fields carry ISO strings in the model
  (`patterns.ts:208`); currency/unit/percent carry the typed number.
- **No danger tone.** A destructive button is carried by its action name + wording, not a red variant.

## References

| Path | Use when |
|---|---|
| `references/node-idioms.md` | The idiomatic node shape, bindable props, and ordering traps for each catalog component |
| `references/trees-and-lists.md` | Building the adjacency-list tree, `child` vs `children`, `ChildList` templates, `${…}` interpolation, nesting |
| `references/bindings-actions-checks.md` | Data bindings, two-way inputs, Button actions, reactive `checks`, FormProvider submit-gating |
| `catalog.json` (`src/catalog/default/`) | The authoritative component/prop/function inventory — never invent a component or prop |
| `src/examples/` + `corpus/exemplar/v1_0/agent-ui.jsonl` | Real payloads to condition on before composing |
| `a2ui-harness-wiring.lld.md` §6 | The full bounded-loop contract and round-orchestration rules |
