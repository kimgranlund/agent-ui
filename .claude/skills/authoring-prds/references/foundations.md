# Foundations — The Spec Family (PRD · SPEC · LLD)

Shared mental models for the three documents that carry a product from intent to implementation. Each best-practices guide and rubric in this family assumes these models. See `document-relationships.md` for the sync mechanics across all three.

## The abstraction ladder: why → what → how

Three documents, three altitudes, one chain.

| Doc | Stance | Defines | Owns | Audience |
|---|---|---|---|---|
| **PRD** | outside-in | what should exist and **why** | user problems, business intent, outcomes, scope, constraints, success metrics, priority | humans aligning on the problem |
| **SPEC** | inside-out | what must be built and **how it behaves** | functional / technical / data / state / API / UX / acceptance requirements | implementers and agents — the execution contract |
| **LLD** | implementation | **how it is built** internally | component structure, interfaces, data models, algorithms, state flow, error handling, edge cases, files/modules, integration mechanics | the engineer or agent writing the code |

Each lower document is a refinement of the one above: it commits decisions the parent deliberately left open, adds resolution, and narrows from problem space to solution contract to implementation. Information flows down; discovered reality flows back up.

## One fact, one home

Every fact has exactly one owning document. The PRD owns intent and success metrics; the SPEC owns the behavior contract; the LLD owns the implementation. Lower documents **reference upper facts by ID, they do not restate them.** The moment a fact is copied into a second document, the two begin to diverge and nothing fails when they do. Reference-by-ID is the structural defense; duplication is the precondition for drift.

## Right altitude is a discipline

Each document earns its layer by staying in it. A PRD that prescribes implementation has collapsed the ladder. An LLD that re-derives behavior has duplicated the SPEC. A SPEC that only describes the happy path has abdicated the contract. Altitude is policed by a dedicated rubric dimension in each document (PRD P4, SPEC S6, LLD L8) because straying out of layer is the most common way a fact ends up owned in two places.

## The two diseases (applied to documents)

**Drift** — documents and code diverging over time. A SPEC that no longer matches the PRD's scope; an LLD describing a system the SPEC has since changed; a doc the code outran. Silent, because nothing fails when it happens.

**Brittle-feature infection** — requirements and implementation accreting special cases, each cheap alone, collectively making the system rigid and untestable.

Both are representation–reality divergence. The cures are the same ones applied throughout this family: reference-by-ID (no duplication), traceability that fails loudly (orphans and gaps are visible), repair-the-owner change propagation, and explicit out-of-scope so accretion has something to bounce off.

## Required reliability decides representation

Anything that must hold every time becomes a typed contract or a test, not a sentence. Acceptance criteria are the **executable form** of a requirement — the point where a SPEC stops being prose and becomes something a test (and an agent) can check. Route the verifiable to a contract or a test; reserve prose for the intent and rationale that genuinely need it.

## The calibration test (per line, every document)

1. Does the reader already know this? Cut it.
2. Must it be exact every time? Make it a typed contract or an acceptance test, not prose.
3. Is it specific to this product and non-obvious? State it precisely — the only category that earns space.
