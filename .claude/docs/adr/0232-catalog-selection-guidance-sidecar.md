# ADR-0232 — Catalog selection guidance (intents and notFor) lives in a Node-only `selection.json` sidecar beside each catalog and renders as a clause on the prompt inventory line

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-05
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-10-05 |
> | **Proposed by** | the sdlc-lite run `catalog-notfor-intents` (tracking issue GH [#1796](https://github.com/kimgranlund/agent-ui/issues/1796)); the architecture was ratified for build by Kim on 2026-10-05 per the run handoff, which approves building the design, not this record |
> | **Ratified by** | pending Kim's ratification; never self-ratified |
> | **Repairs** | [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R6 (v0.18: a new paragraph and AC7) · [`../lld/a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) LLD-C4 (the row names `selection-guidance.ts` and the clause; the module tree gains the file) · [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.2 intro (v0.4: cites `selection.json` as the machine twin) · rubric [`../rubrics/a2ui-catalog.md`](../rubrics/a2ui-catalog.md) D7 (v0.3) · code: `packages/agent-ui/a2ui/src/agent/selection-guidance.ts` (new), `src/agent/system-prompt.ts` (`catalogInventory`), `src/agent/index.ts`, `src/agent/gates.test.ts`, `src/catalog/selection-guidance.test.ts` (new), the five `selection.json` sidecars (new), `src/live-agent/prompt-drift.test.ts`, `src/live-agent/prompt-equivalence.baseline.json`, `tools/agent/worker/fs-shim-content.ts`, `tools/agent/worker/fs-shim.test.ts` |
> | **Supersedes / Superseded by** | **Amends [ADR-0071](./0071-a2ui-derived-drift-gated-system-prompt.md)** (the derived inventory line gains a clause; ADR-0071's body is untouched, accepted ADRs are append-only) · **Extends [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md)** (include-or-recorded coverage, reapplied: every catalog type has a guidance entry or the gate reds) · relates [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (`feed-catalog.ts`: per-type policy beside the agent, never a policy view inside the catalog) · relates [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (Node-only prompt assets read through `node:fs`, served to the Worker by the fs-shim) · relates [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) and [ADR-0172](./0172-persona-catalog-composition-intake.md) (per-catalog and derived catalogs) · relates [ADR-0173](./0173-descriptor-inversion-generation-intake.md) (the descriptor is untouched) · relates [ADR-0091](./0091-a2ui-gen-ui-mini-skill-registry.md) §4 and [ADR-0197](./0197-app-barrel-agent-admin-lazy-split.md) cl.5 (the app marginal budget, zero headroom) |

## Context

A comparison of agent-ui with the maison gen-ui-system reference found that maison's component manifest
carries machine-readable selection guidance: `ontology.intents[]` (the jobs a component does) and
`constraints.notFor[]` (the confusable siblings and why not). Its inclusion rule is that a field earns its
place only when it encodes a delta the model would not infer: it disambiguates similar components, aids
retrieval, or records a domain choice.

agent-ui had no machine-readable equivalent. A search of the repo for `notFor` and `intents` found zero
hits. The guidance existed only as prose for humans (the catalog SPEC §5.2 Notes column,
`site/pages/choosing.ts` `GROUPS`) and as recipes in mini-skills (`variant-picker.md`). The model reads
the catalog-derived `## Available components` inventory (ADR-0071), which lists each type and its props
and nothing about when to pick it over a neighbour.

Three constraints decide where the guidance can live:

1. Every browser consumer of the renderer bundles `catalog/default/catalog.json`, and the app marginal
   bundle budget sits at its cap with the ADR-0197 cl.5 exception already marked final. Prose only the
   model reads cannot ride `catalog.json`.
2. The renderer and validator never read selection guidance. Only `buildSystemPrompt` (Node-only, already
   reading `prompts/*.md` through `node:fs`) and Node-side evals do.
3. `a2ui-basic` types and persona fragment types have no component descriptor, and ADR-0173 cl.5 keeps
   catalog content hand-curated, never descriptor-generated.

## Decision

We will give every agent-emittable catalog type selection guidance in a Node-only JSON sidecar beside its
catalog, and render it as a clause on that type's inventory line.

1. **Sidecar schema.** One `selection.json` per catalog: `catalog/default/selection.json`,
   `catalog/a2ui-basic/selection.json`, and `catalog/personas/<id>/selection.json` for each shipped persona
   fragment. The root carries exactly one pin (`catalogId` for a base catalog, `personaId` for a fragment)
   plus `types`. Each entry is `{ "intents": string[], "notFor": [{ "type": string, "why": string }] }`.
   Caps: 1 to 3 intents of 1 to 60 chars each; 0 to 4 `notFor` edges, each `why` 1 to 90 chars. No text may
   carry the clause separator, an em dash, or (in a `why`) a parenthesis; an intent may not carry `;`.
   There is no `confusableWith` field: a confusable pair IS a `notFor` edge.
2. **Loader API.** `packages/agent-ui/a2ui/src/agent/selection-guidance.ts`, exported from the
   `@agent-ui/a2ui/agent` subpath only (the root barrel is untouched):
   `loadSelectionGuidance(doc)` validates one document and throws a typed `SelectionGuidanceError`
   (`MALFORMED`, `CAP`, `UNRESOLVED`); `selectionGuidanceFor(catalog)` resolves `agent-ui` to the default
   sidecar, `a2ui-basic` to its own, a derived `<base>--<persona>` id to the base entries plus the
   persona's, and any other id to `{}`; `renderSelectionClause(entry, catalog)` renders one clause and
   throws `UNRESOLVED` on a `notFor` target outside the catalog. The five sidecars load at module load with
   `readFileSync` from `process.cwd()` (the TKT-0044 rule); the module joins `NODE_ALLOWED` in
   `src/agent/gates.test.ts`.
3. **Clause format.** `catalogInventory` appends the clause after `(props: ...)` on the same line, so the
   `prompt-drift.test.ts` row regex still reads the type id:
   `- Badge (props: ...) · use: <intents joined by "; "> · not for: <Type (why), ...>`. The `not for:` half
   is omitted when `notFor` is empty. A catalog with no sidecar composes the pre-ADR-0232 line byte for
   byte.
4. **Coverage law.** `catalog/selection-guidance.test.ts` is the gate, with negative controls:
   (a) bijection: each base sidecar carries exactly one entry per catalog type, so a new type without an
   entry reds and so does an orphan entry; (b) reciprocity: inside a first-party catalog or fragment, an
   edge A to B implies B to A, each direction with its own `why`; (c) the persona edge rule: a fragment
   edge may target a type present in every base the fragment targets, one-way, because a base cannot name
   persona types; every derived catalog's guidance covers every fragment type and every clause renders;
   (d) no orphan sidecar under `src/catalog/`. Authoring law for review: intents name the job in the
   user's words; a `why` names the discriminating axis (count, persistence, data shape, interaction),
   never the recipe, which stays in mini-skills.
5. **Budget.** The summed clause length over the default catalog is held at or under
   `SELECTION_GUIDANCE_CHAR_BUDGET` by a `prompt-drift.test.ts` leg, never by runtime truncation. Per the
   constant's doc comment: measured 8 277 chars over 80 types (144 `notFor` edges, 72 reciprocal pairs) on
   2026-10-04; ceiling 9 570 chars (the `## Available components` section it annotates); budget 8 600.
6. **Token cost.** The recaptured `default` prompt is 42 027 chars against a base `default` of 33 750
   chars: +8 277 chars, 24.5% of the base default prompt. `defaultExplicit`, `specific` and `blueSky` move
   by the same 8 277 chars.

## Consequences

- **Four-key recapture.** The inventory is mode-invariant, so `default`, `defaultExplicit`, `specific`
  and `blueSky` all move in `prompt-equivalence.baseline.json`. Every sidecar edit is a deliberate prompt
  change and runs the `recapture-baseline.test.ts` writer.
- **Worker registration.** The Worker has no filesystem. Each sidecar is a JSON import registered in
  `tools/agent/worker/fs-shim-content.ts` `FILES`, and `fs-shim.test.ts` holds the on-disk sidecar set
  equal to those keys. A new persona sidecar also joins the loader's persona list.
- **The genui dogfood inventory carries no guidance.** `dogfood-inventory.ts` is descriptor-derived; this
  is an owned limit of this record, not a gap to patch here.
- **In-page tooling cannot read the sidecar.** `scripts/eval-a2ui-catalog.mjs` and the docs site run in
  the browser; only Node evals through `@agent-ui/a2ui/agent` can. The choosing guide cites the sidecar
  as its machine twin rather than deriving from it.
- **Reciprocity may force weak reverse `why`s.** The gate cannot tell a real axis from filler. Rubric
  `a2ui-catalog.md` D7 is the review half and rejects filler reverse edges.
- **Prompt growth.** The default prompt grows by roughly a quarter. If a later wave blows the budget, the
  named fallback is a separate pairs section rather than per-line clauses; caps are never cut silently.

## Alternatives considered

- **`intents`/`notFor` as `ComponentDef` fields in `catalog.json`**: rejected because it ships prompt-only
  prose into every browser renderer bundle and reds the zero-headroom app marginal budget whose exception
  is marked final; it widens the render contract (`loadCatalog`, `composeCatalog`, catalog SPEC §5.1) for
  data the renderer never reads; and it contradicts the ADR-0097 `feed-catalog.ts` precedent of per-type
  policy living beside the agent.
- **Descriptor frontmatter (`controls/*/*.md`) as the home**: rejected for two reasons. No descriptor
  exists for `a2ui-basic` types or persona fragment types, and `notFor` edges name catalog type ids inside
  one type set. ADR-0173 cl.5 keeps catalog content hand-curated under an agreement gate, never
  descriptor-generated. It would also teach `components` a2ui vocabulary against the inward-only DAG.
- **A separate `confusableWith` field**: rejected because it is redundant with reciprocal `notFor` edges,
  and two fields invite drift.
- **A `## Choosing between components` pairs section instead of per-line clauses**: rejected because it
  loses locality next to the props the model is reading. It stays the named fallback if the measured delta
  exceeds the ceiling.
- **A hand-listed confusable-groups table in the gate**: rejected because it is an allowlist by another
  name; the bijection and reciprocity rules give the gate teeth without one.
- **Exempting sub-types (Option, Tab, CardHeader, ...) from `intents`**: rejected because an exemption
  marker is allowlist drift, and "one choice inside a Select" is a cheap, honest intent.
- **Deriving the site choosing guide from the sidecar**: rejected because the sidecar is Node-only and the
  page runs in the browser. The page cites the sidecar instead; a browser-safe projection is a follow-up.
