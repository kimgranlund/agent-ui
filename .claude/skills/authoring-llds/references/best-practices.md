# Best Practices — Authoring an LLD

How to write a low-level design an engineer or agent can implement directly, consistent with the SPEC above and ready to become code. Assumes `foundations.md` and `document-relationships.md`. Scored by `rubric.md`.

## What an LLD is for

An LLD defines how the system will be implemented internally: component structure, data models, interfaces, algorithms, state flow, error handling, edge cases, files/modules, and integration mechanics. It is the bottom of the document ladder — the plan an agent executes. It owns implementation. It does not own behavior (that is the SPEC, which it references) or intent (the PRD).

## Principles

**Trace every component to a SPEC requirement.** Each module or component cites the `SPEC-R*` it implements, and every requirement has an implementation home. A component tracing to no requirement is gold-plating; a requirement with no component is unimplemented. The coverage map is the proof the LLD fully and only realizes the SPEC.

**Make interfaces and data models concrete.** Real function/class/type signatures, schemas, and stated invariants — not "a service that handles coding." The LLD is where prose becomes types. If the implementer still has to design the interface, the LLD hasn't done its job.

**Enumerate errors and edge cases — this is the point.** "Handle errors appropriately" is the signature LLD failure. List the failure modes, the edge and empty cases, and the handling or fallback for each. Enumeration of what can go wrong is the specific value an LLD adds over a SPEC.

**Show the control and state flow for non-trivial paths.** Algorithms, sequences, and state transitions for anything that isn't obvious. A diagram where it helps. "Implement the matching logic" is a deferral, not a design.

**Locate the work.** Name the actual files, modules, and directories to create or change, and the integration points with existing code. An LLD that doesn't say where things go forces the implementer to re-derive the structure.

**Sequence the build.** Order the steps by dependency, from the load-bearing core outward, each step independently verifiable. This is what lets an agent execute the LLD as a plan and check itself at each checkpoint rather than at the end.

**Hold altitude — add the how, reference the what.** Do not restate SPEC behavior; cite the `SPEC-R*` and add the implementation. Re-deriving behavior duplicates a fact the SPEC owns and guarantees the two drift.

## Do / don't

Do: map components to SPEC IDs; write concrete typed interfaces; enumerate errors/edges with handling; show non-trivial flow; name files and integration points; order the build with checkpoints.

Don't: hand-wave error handling; describe interfaces in prose; leave structure to the implementer; restate SPEC behavior; present an unordered pile of work.

## Best-in-class (shape)

```markdown
# LLD — Encounter Coding Assist   (implements SPEC-R1, SPEC-R2)

## Components
- LLD-C1 SuggestionController   ← SPEC-R1   `src/api/handlers/suggest.ts`
- LLD-C2 CodeRanker             ← SPEC-R1   `src/coding/ranker.ts`
- LLD-C3 SpecificityValidator   ← SPEC-R2   `src/coding/validate.ts`

## Interfaces
```ts
// LLD-C2
function rankCandidates(note: string): Promise<Code[]>  // sorted desc by confidence
interface Code { icd10: string; label: string; confidence: number; hccCategory?: string }
// invariant: confidence ∈ [0,1]; result length ≤ 20
```

## Control flow (SuggestionController)
1. validate note non-empty → else 422 EMPTY_NOTE
2. rankCandidates(note) with 1.2s timeout
   - on timeout → return last-known cached result, set `stale: true`, 200 (SPEC-R1 504 path)
3. SpecificityValidator.flag(candidates) → attach UNSPEC_AVAILABLE reasons (SPEC-R2)

## Errors & edges
- empty note → 422 EMPTY_NOTE
- model timeout → cached fallback + stale flag; if no cache → 504 MODEL_TIMEOUT
- note with no extractable diagnosis → 200, empty codes[], `reason: NO_DX_FOUND`
- duplicate diagnoses in note → dedupe by icd10 before ranking

## Build sequence
1. Code/types + CodeRanker (pure, unit-testable)  →  2. SpecificityValidator
3. SuggestionController wiring  →  4. timeout/cache path  →  5. integration test vs SPEC AC
```

Every component traces to a requirement, every interface is typed, every failure is enumerated, and the build is ordered — an agent can execute it step by step and verify each against the SPEC's acceptance criteria.
