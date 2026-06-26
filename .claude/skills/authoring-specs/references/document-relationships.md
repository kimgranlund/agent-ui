# PRD ↔ SPEC ↔ LLD — Relationships, Traceability & Staying in Sync

How the three documents relate and stay coherent over time. This is the connective tissue of the spec family. Assumes `foundations.md`.

## The chain

```
   PRD  ──refines──▶  SPEC  ──refines──▶  LLD  ──implements──▶  Code
   why /            what /              how                    reality
   what-should      how-it-            it's-built
   -exist           behaves            internally
        ◀──────────── discovered reality flows up ────────────
```

Intent flows down the chain, gaining resolution at each step. Reality flows up: a constraint discovered in the LLD or in the code can invalidate a SPEC requirement, which can invalidate a PRD assumption. A healthy family moves in both directions; a drifting one only ever moves down and then stops being updated.

## Ownership map (one fact, one home)

| Fact | Owned by | Referenced by |
|---|---|---|
| User problem, business intent | PRD | — |
| Success metric and target | PRD | SPEC (by goal ID) |
| Scope (in / out) | PRD | SPEC |
| Functional behavior, acceptance criteria | SPEC | LLD (by requirement ID), tests |
| API / data / schema contract | SPEC | LLD |
| Component structure, algorithms, files | LLD | the implementation |

A lower document references an upper fact by its ID. It never restates it. If the SPEC copies the PRD's success metric and the PRD later changes it, they diverge silently — so the SPEC cites `PRD-G3`, it does not paste the number.

## Traceability is the sync contract

Every requirement carries a link upward to the thing it serves:

- Each **SPEC requirement** links to the **PRD goal** it advances.
- Each **LLD element** links to the **SPEC requirement** it implements.
- Each **test** links to the SPEC requirement whose acceptance criteria it checks.

The value of traceability is that it makes divergence **visible as orphans and gaps**, both mechanically detectable:

| Signal | Meaning | Action |
|---|---|---|
| PRD goal with no SPEC requirement | Goal unaddressed (gap) | Add a requirement or cut the goal |
| SPEC requirement with no PRD goal | Scope creep — building the unasked | Trace it to a goal or remove it |
| LLD module with no SPEC requirement | Gold-plating | Trace it or delete it |
| SPEC requirement with no LLD / test | Unimplemented / unverifiable | Implement or descope |

A **traceability matrix** — a table mapping PRD-IDs ↔ SPEC-IDs ↔ LLD-IDs ↔ test-IDs — turns "are these in sync?" from a judgment call into a coverage check. That check is deterministic; route it to a script or a CI gate, not to a reviewer's vigilance. The matrix failing loudly on an orphan is the contract that makes drift hard.

## Identifiers and status

Sync depends on stable IDs. Give every PRD goal, SPEC requirement, and LLD component a unique, stable identifier (`PRD-G3`, `SPEC-R12`, `LLD-C4`). IDs are the join keys of the whole family; without them, references are prose and traceability is manual.

Carry a **status** on each item where it helps: `proposed → accepted → implemented → deprecated`. When a parent item changes, mark downstream items that reference it `stale — re-verify`. Date or version each document. A stamped, ID-keyed family lets you answer "what is affected if PRD-G3 changes?" by following links, not by re-reading everything.

## Change propagation: repair the owner, never patch the symptom

When something changes, edit the document that **owns** the changed fact, then propagate downward.

- A new user need → enters at the **PRD** → the SPEC adds/adjusts requirements → the LLD adjusts implementation.
- A technical impossibility discovered in the **LLD** → flows **up**: it invalidates a SPEC requirement (and maybe a PRD assumption). Fix the SPEC (and PRD), then re-derive the LLD. Do **not** hack the LLD and leave the SPEC describing a system that no longer exists.
- A behavior ambiguity found while coding → fix the **SPEC**, regenerate the affected LLD section and tests.

The rule is invariant: the artifact you edit is the canonical owner of the changed fact; downstream copies are regenerated, never independently patched. Patching the symptom (the lowest doc, or the code) is exactly how a SPEC becomes a fossil.

## Acceptance criteria bridge to code

The SPEC's testable acceptance criteria become the tests. Passing tests are the proof the implementation matches the SPEC — the sync mechanism between the contract and the code. This is why the SPEC rubric gates on testable AC: a requirement you cannot test is a requirement you cannot keep in sync with what gets built. In an agentic workflow this closes the loop: a `/goal` written as "every requirement `SPEC-R*` has a passing acceptance test" is a verifiable end-state, and the agent can self-verify bottom-up — every component traces to a requirement, every requirement to a goal, every requirement has a green test.

## The family in agentic coding

- The **PRD** is the why the humans and the agent align on.
- The **SPEC** is the execution contract the agent builds against — the main artifact in an agentic workflow.
- The **LLD** is the plan the agent executes.
- **Traceability + acceptance tests** are what let the agent (and you) verify the work without re-reading everything: coverage is a query, correctness is a test run.

Build the family this way and staying in sync stops being a discipline you must remember and becomes a property the structure enforces.
