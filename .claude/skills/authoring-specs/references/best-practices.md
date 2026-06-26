# Best Practices — Authoring a SPEC

How to write a SPEC that an implementer or agent can build from without guessing, and that stays tied to the PRD above and the LLD below. Assumes `foundations.md` and `document-relationships.md`. Scored by `rubric.md`.

## What a SPEC is for

A SPEC looks inside-out. It turns the PRD's intent into explicit functional, technical, data, state, API, UX, and acceptance requirements — defining what must be built and how it must behave. In an agentic coding workflow it is the main execution contract: the artifact the agent builds against. It owns behavior. It does not own intent (PRD) or internal implementation (LLD).

## Principles

**Trace every requirement to a PRD goal.** Each requirement cites the `PRD-G*` it serves. A requirement that traces to no goal is scope creep; a goal that no requirement covers is a gap. Traceability is what keeps the SPEC honest about building only what was asked, and all of what was asked.

**Make every requirement testable.** Each carries explicit acceptance criteria — given/when/then or a measurable condition. Acceptance criteria are the executable form of the requirement and the bridge to the tests that later prove the implementation matches. A requirement you cannot test is a requirement you cannot keep in sync with the code.

**Specify behavior at the boundaries, not just the happy path.** For every boundary — where components meet, data changes form, authority transfers — state what crosses, in what form, under whose authority, and what happens on failure. States, errors, empty cases, and edges are where under-specified SPECs become production incidents and where agents invent behavior you didn't choose.

**Type the contracts.** APIs, data structures, and schemas are defined with types, request/response shapes, and error codes — not described in prose. A typed contract fails loudly; a prose one is interpreted differently by every reader.

**Be unambiguous and normative.** One reading per requirement. Use MUST/SHOULD/MAY deliberately. Keep TBDs out of normative sections — track unresolved items as open decisions, not as gaps hidden inside requirements.

**Hold altitude.** Define what and how-it-behaves; defer how-it's-built to the LLD. A SPEC that dictates internal algorithms or file layout has duplicated the LLD's job and created a second home for facts that will drift.

**ID every requirement.** `SPEC-R1`, `SPEC-R2`, … These are what the LLD and the tests reference. Unreferenceable prose cannot be traced, covered, or verified.

**State the non-functionals.** Performance, security, accessibility, scale, and compliance, with measurable targets where they apply. NFRs omitted from the contract are NFRs no one is accountable for.

## Do / don't

Do: trace up to PRD goals; attach testable AC to each requirement; specify states/errors/edges; type every contract; ID every requirement; track open decisions separately.

Don't: write happy-path-only; leave acceptance to interpretation; describe APIs in prose; dictate implementation; bury TBDs in normative text; ship untraceable requirements.

## Best-in-class (shape)

```markdown
# SPEC — Encounter Coding Assist   (implements PRD-07)

## SPEC-R1  ICD-10 suggestion   ← PRD-G1, PRD-G3
The system MUST return ranked ICD-10 candidates for a submitted encounter note.
Interface: POST /suggest { noteText: string } → { codes: Code[] }
  Code = { icd10: string; label: string; confidence: number; hccCategory?: string }
Acceptance:
  - given a note with a documented diagnosis, when submitted, then ≥1 candidate
    with the correct billable code appears in the top 5.
  - given an empty note, then 422 with error code EMPTY_NOTE.
Errors: 422 EMPTY_NOTE · 504 MODEL_TIMEOUT (return cached/last-known, flag stale)

## SPEC-R2  Specificity validation   ← PRD-G2
Each suggested code MUST be checked for billability and specificity...
Acceptance: given an unspecified (.9) code where a more specific code exists,
  then the response flags it with reason UNSPEC_AVAILABLE.

## Non-functional
- NFR-1 p95 suggestion latency < 1.5s. (← runs in EHR iframe, PRD constraint)
```

Every requirement traces up, carries a typed contract and testable AC, and stops at behavior — the LLD picks up from each `SPEC-R*`.
