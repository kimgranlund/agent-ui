# Rubric — LLD (Low-Level Design)

Scores an LLD: can an engineer or agent implement directly from this with minimal further decisions, is it consistent with the SPEC, and does it cover the realities code must handle? Scoring method summarized at the bottom.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| L1 | SPEC traceability | [gate] | Each component maps to SPEC requirement IDs; all requirements have an implementation home | 1: no mapping · 3: partial · 5: full coverage map, no orphan requirements |
| L2 | Component decomposition | [review] | Clear modules/components with single responsibility and defined boundaries | 1: monolithic hand-wave · 3: rough split · 5: each component one responsibility + boundary |
| L3 | Concrete interfaces & data models | [gate] | Function/class/type signatures, schemas, with types and invariants | 1: prose · 3: partial signatures · 5: signatures + types + invariants stated |
| L4 | Control & state flow | [review] | Algorithms, sequence/state flow for the non-trivial paths | 1: "implement the logic" · 3: described loosely · 5: stepwise flow + state transitions (diagrams where apt) |
| L5 | Error handling & edge cases | [gate] | Explicit failure modes, edge cases, fallbacks | 1: "handle errors appropriately" · 3: main errors · 5: enumerated failures with handling per case |
| L6 | Implementation locality | [review] | Names actual files/modules/dirs to create or change; integration points | 1: no file mapping · 3: some · 5: file/module plan + integration mechanics |
| L7 | Build sequence | [review] | Ordered, dependency-aware implementation plan; each step verifiable | 1: no order · 3: rough order · 5: ordered steps with checkpoints, each independently verifiable |
| L8 | Right altitude | [review] | Adds the how; references SPEC for the what; no re-derivation of behavior | 1: duplicates SPEC behavior · 3: some overlap · 5: pure implementation layer, cites SPEC IDs |

**Gate to promote:** L1, L3, L5 must each score ≥ 3. An LLD without SPEC traceability (L1), concrete typed interfaces (L3), or enumerated error/edge handling (L5) leaves the hardest decisions to whoever (or whatever) writes the code.

**Top failure to look for first:** "handle errors appropriately" and its cousins (L5 low) — enumeration of failure and edge cases is the specific value an LLD adds over a SPEC; without it the document is decoration.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. Failing any gate dimension blocks promotion regardless of other scores.
