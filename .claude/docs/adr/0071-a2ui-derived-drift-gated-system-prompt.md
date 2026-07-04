# ADR-0071 — the machine system prompt is DERIVED from `catalog.json` + the `a2ui-compose` grammar and drift-gated, never hand-maintained

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | planner (design seat — the live-agent intake, NEXT item 3) |
> | **Ratified by** | orchestration-coordinator + Kim ("proceed", 2026-07-04) — green gates: coverage --strict · adr_check 5/5 · harness spec/lld 3/3; all 3 independent doc-reviews GO |
> | **Repairs** | `a2ui-live-agent.spec.md` (the derived-prompt requirement + its drift gate) · `a2ui-live-agent.lld.md` (the `buildSystemPrompt` module + the drift-test wiring) |
> | **Supersedes / Superseded by** | Relates ADR-0055 (the `examples.test.ts` derive-and-gate precedent) · ADR-0060/0063 (the judged corpus the few-shot block retrieves over) · the `a2ui-compose` skill (the grammar source) |

## Context

The demo conditions a real model to emit A2UI. The catalog (`src/catalog/default/catalog.json`) is the
SOLE authority on which components, props, and functions exist — the `a2ui-compose` skill's first law
is "never invent a component or prop." A system prompt that hand-lists the catalog is a second copy of
that authority, and the moment a catalog row is added (the fleet grows constantly — 19 components
today, ADR-0053 added the form family), the hand-listed prompt silently drifts: the model is told a
stale component set, and PRD-G6 (no silent drift) is violated with no signal.

The repo already has the answer pattern: the seed shelf is derived and gated (`examples.test.ts`), and
the corpus store's standing gate re-derives from source. The prompt must ride the same discipline.

## Decision

**`buildSystemPrompt(catalog, exemplars)` derives the prompt from canonical sources at run time, and a
standing test gates it against the catalog.**

1. **Three parts, each from a canonical source:**
   - **The grammar** — the three message kinds (`createSurface` / `updateComponents` /
     `updateDataModel`), the flat adjacency-list node shape, `child` vs `children`, `ChildList`
     templating, bindings/actions/checks, and the bounded loop — sourced from the `a2ui-compose`
     references (`node-idioms.md` / `trees-and-lists.md` / `bindings-actions-checks.md`), kept DRY
     (cross-referenced/imported, not a third restatement of `protocol.ts` facts).
   - **The catalog inventory** — the component/prop/function list the model may name — **derived at run
     time from `catalog.json`** (the sole authority). Never a hand-listed set.
   - **The few-shot block** — top-k real payloads from `retrieve()` over the JUDGED shard (ADR-0068),
     so "shown ≡ fed ≡ retrieved ≡ judged."

2. **The drift gate is a standing test — but it guards ONLY the catalog half, mechanically.** It
   asserts the derived prompt's component/prop inventory EQUALS `Object.keys(catalog.components)` (and
   each row's declared props) — so adding a catalog row without the derivation covering it fails the
   gate. Because the inventory is DERIVED (not a static string), it cannot drift by construction; the
   gate is the coverage assertion that proves the derivation reaches the whole catalog and omits
   nothing. **The two halves are NOT equal-strength guarantees, and the ADR does not pretend they are:**
   the *catalog inventory* is mechanically gated (the drift test above — a true machine check); the
   *grammar* half is single-sourced to the `a2ui-compose` references and kept current by MANUAL review
   discipline (the "service on contact" rule when the idioms change), not a machine assertion — there
   is no test that the grammar prose is correct, only that it is not duplicated. Cross-referencing keeps
   it DRY; it does not gate it. Naming the asymmetry is the point: the strong claim ("can't name a
   missing component") is mechanical; the weaker claim ("the idioms are current") is a review habit.

3. **Placement is tools-scoped.** `buildSystemPrompt` is producer/harness concern (the streaming
   producer scope this wave first realizes), not zero-dep renderer runtime — it lands in the tools
   harness (Node-type-stripped, zero-dep), consumed by the loop driver (ADR-0070). It adds nothing to
   the package surface.

## Consequences

- **The model can never be told of a component the catalog lacks** — the prompt is a projection of the
  catalog, not a parallel list.
- **Catalog growth is caught, not silent.** A new `ui-*`-backed catalog row that the prompt doesn't
  surface fails the drift test in the same `npm test` run — the PRD-G6 coherence guarantee, mechanical.
- **The grammar stays single-sourced** with the `a2ui-compose` skill — the same idioms the composer
  agent and the human author read; no third copy to drift.
- **Retrieval quality flows straight into the prompt** — because the few-shot block is the judged
  corpus's top-k, prompt quality tracks corpus quality with no extra maintenance.

## Acceptance

- `buildSystemPrompt(catalog, exemplars)` derives the inventory from `catalog.json` at run time (a read
  confirms no hand-listed component set); pure, zero-dep, Node-type-stripped.
- A standing test asserts the derived component/prop inventory EQUALS the catalog's keys/props; a
  planted catalog row absent from the derived prompt makes it FAIL (negative control); `npm test` green.
- The grammar section cites/imports the `a2ui-compose` references rather than restating `protocol.ts`
  facts.
- The few-shot block is the output of `retrieve()` over the committed judged shard.

## Alternatives considered

- **A hand-maintained system prompt.** Rejected: it is a second copy of the catalog authority that
  drifts silently on every catalog change (PRD-G6 violation) with no signal — exactly the failure the
  derive-and-gate discipline exists to prevent.
- **Derive but don't gate.** Rejected: derivation alone can still silently omit a catalog row (a bug in
  the projection); the coverage gate is what proves completeness, matching `examples.test.ts`.
- **Put `buildSystemPrompt` in the package.** Rejected: prompt-building is producer scope, not zero-dep
  renderer runtime; the package surface stays `.`/`./examples`/`./corpus` (ADR-0062/0069).
