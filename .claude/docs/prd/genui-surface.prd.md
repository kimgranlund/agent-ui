# PRD — GenUI (pattern-sourced generative UI) for the agent-admin surface

> Status: **proposed · v0.1 · 2026-07-19 · Owner: agent-ui** — awaiting Kim's ratification of the five forks (§5). Authored at the vision-rev.5 intake (Kim's Figma frame `33:1693`, node `34:1312` "Surface Options"); no build exists or is scheduled until the forks resolve.
> Altitude: this document owns **why + what-should-exist** for GenUI — the third Surface Options modality. Behavior contracts land in a future SPEC once §5 resolves; nothing below is a design commitment.
> Grounding: Kim's Surface Options list (Figma frame 33:1693): *"Markdown (rendered as Rich-text. Simple text is fallback) · A2UI (catalog picker) · GenUI (pattern source picker)"* — and the 2026-07-19 ruling on the decomposition review: *"Yes we need a PRD for GenUI work."* Sibling modalities: markdown + the A2UI catalog picker ship in the vision rev.6 build (Surface Options), independent of this PRD.

## 1. Problem

The agent-admin surface gives an agent exactly two output modalities: **prose** (markdown-rendered
after rev.6) and **A2UI** — structured UI constrained to a *fixed catalog* of component types, every
payload validated against it. Nothing in between exists: an agent cannot compose a *novel* UI shape —
one the catalog does not enumerate as a single type — even when the fleet's own composition idioms
(`agent-ui-composition-patterns`, the site gallery's compositions, the corpus's judged payloads)
already demonstrate the shape. "GenUI" names that gap: **generative UI drawn from a pattern source**
rather than free invention or a closed enum.

Who has the problem: (1) agent-admin authors configuring richer demo agents; (2) the producer stack,
whose payload quality already depends on idiom examples but has no first-class *source* abstraction;
(3) the docs story — "what can an agent render" currently ends at the catalog boundary.

## 2. Goals

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | The Surface Options card offers **GenUI** with a working **pattern source picker** — selecting a source changes what the agent actually composes on the next turn (live-apply law). |
| **PRD-G2** | must | A first-class **pattern source** model: named, versionable collections of UI patterns an agent may draw from, with a registry the picker enumerates (create / pick-from-library affordances per Kim's 2026-07-19 ruling). |
| **PRD-G3** | must | GenUI output stays **fail-closed**: whatever the wire shape (§5 D1), every rendered result passes the same validation discipline the A2UI renderer already enforces — no unvalidated DOM, no script execution, sanitized by construction. |
| **PRD-G4** | must | Layering holds: the DAG (`shared ← components ← a2ui ← app`, `router`/`code` catalog-invisible) gains no upward import and no new default-barrel dependency. |
| **PRD-G5** | should | A judged GenUI corpus shard + a docs page, matching the A2UI corpus discipline (facets · admission · pins). |
| **PRD-G6** | could | Pattern sources are shareable/exportable (an admin hands a source to another workspace). |

## 3. Non-goals

- **Not** a replacement for A2UI — GenUI composes *through* the validated rendering path, it does not bypass it.
- **Not** arbitrary generated HTML/JS. A modality that executes model-authored script is out of scope permanently (G3).
- **Not** part of the vision-rev.6 build: rev.6 ships the Surface Options card with Markdown + A2UI live and GenUI visible but disabled, pointing at this PRD.

## 4. Deliverable ladder (sketch — real milestones land in the SPEC)

B0 fork resolution (§5, Kim) → B1 pattern-source registry + the admin picker (PRD-G1/G2) →
B2 producer integration (the source reaches the compose loop) → B3 corpus + docs (PRD-G5).

## 5. Open forks — Kim's, all blocking

| ID | Fork | Options (recommendation first) |
|---|---|---|
| **PRD-D1** | What *is* a pattern source, mechanically? | **(a) few-shot idiom packs**: curated payload exemplars the producer's system prompt carries; output stays plain A2UI JSONL (zero new runtime — recommended first step) · (b) **parameterized templates**: pattern = a canned A2UI component tree with typed slots the agent instantiates (new template layer, still catalog-safe) · (c) free-form generated markup in a sandbox — **recommend rejecting** (violates G3's spirit even sandboxed). |
| **PRD-D2** | Where do pattern sources live? | `@agent-ui/a2ui/examples`' seed-shelf mechanism extended with named packs (recommended — the shelf already exists) · a new `./patterns` subpath · site-local only. |
| **PRD-D3** | Picker granularity | source(pack)-level pick (recommended for v1) · per-pattern multi-select. |
| **PRD-D4** | Relationship to the existing entry-library packs (GH #47/#48 `EntryLibraryPack`) | reuse that shape + "From library" affordance for sources (recommended) · a distinct registry type. |
| **PRD-D5** | Does GenUI need its own wire marker? | none — it is A2UI on the wire, provenance in the turn log only (recommended under D1(a)) · a meta-line tag naming the source per surface. |

## 6. Success metrics

Baseline today: 0 (the modality does not exist). At B2: an agent with a chosen source composes a
payload that (m1) validates clean, (m2) demonstrably uses the source's idiom (judge-scored ≥4/5
against the corpus rubric), and (m3) degrades to plain A2UI when the source is absent — with zero
regressions in the existing A2UI conformance suite.
