# ADR-0004 — Component descriptor: `{name}.md` frontmatter replaces `{name}.api.json`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-26
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-26 — build unblocked)* |
> | **Date** | 2026-06-26 *(authored)* |
> | **Proposed by** | planning-lead — encoding the host/user-ratified plan-incorporation, forced live by the gold `ui-button` + the `/site` docs consumer (Phase 3) |
> | **Ratified by** | orchestration-lead — 2026-06-26 |
> | **Repairs** | `.claude/docs/plan.md` §10 (the `{name}.api.json` API-contract instrument), `.claude/docs/process.md` §1 + §4 (the contract↔props trip-wire target + the "api-contract schema" referential row), `.claude/docs/goals.md` §G5 DoD (the `button.api.json` bullet), the `component-author` skill (descriptor step 6). |
> | **Supersedes / Superseded by** | *(none)* |

## Context

Ratified G5 design records a component's public surface as `{name}.api.json` — a machine-checkable
"attributes-as-API" descriptor (`plan.md` §10) that is **also** the target of the contract↔props
trip-wire (`process.md` §1) and a first-class referential artifact validated by a draft-2020-12
api-contract schema (`process.md` §4). Separately, Phase 3 ships a `/site` docs page **per component**,
which needs a human-readable source describing each control.

Authoring both a `.api.json` contract **and** a `.md` doc duplicates the public surface across two files
— exactly the drift disease `process.md` is built to prevent (one artifact diverging from another, with
nothing failing when it does). The plan-incorporation resolves this by making the descriptor a `{name}.md`
with **YAML frontmatter**: one artifact carrying both the machine-checkable contract (frontmatter) and the
human doc (body). The gold `ui-button` sets the reference shape, so the choice is made now.

## Decision

We will record a component's public surface as **`{name}.md` with YAML frontmatter**. The frontmatter
carries the attributes-as-API fields unchanged from the `.api.json` design (tag · tier · extends ·
attributes[type/reflect/default] · properties · events · slots · parts · customStates · face · aria ·
keyboard · geometry · forcedColors); the markdown **body** is the component's prose documentation. One
artifact, **two consumers**:

1. the **contract↔props trip-wire** validates the *frontmatter* `attributes[]` against the live
   `finalize(Class)` table (the `.json`→YAML swap is mechanically equivalent), and
2. the **`/site` doc generator** (Phase 3) renders the frontmatter (as the API table) + the body (as prose).

The "api-contract schema" (`process.md` §4) becomes a **frontmatter schema** — the referential standard the
frontmatter is checked against. This repairs `plan.md` §10, `process.md` §1+§4, `goals.md` §G5, and
`component-author` step 6.

## Consequences

- **One source of truth for the public surface**, doubling as the doc — drift between a contract file and a
  doc file is structurally impossible because they are the same file.
- **The contract trip-wire parses frontmatter (YAML) instead of JSON** — the same comparison
  (frontmatter `attributes[]` ≡ `finalize(Class)`), a different reader. Neither the trip-wire nor the
  schema exists yet (both are G5 deliverables), so there is **no rework** — they are authored once, against
  frontmatter.
- **The frontmatter schema is a new authored artifact** replacing the planned `component-api-contract.json`
  (which is absent today). It is a Phase-1 governance slice (see the Phase-1 decomposition).
- **Negative — YAML frontmatter is less strictly typed than schema-validated JSON** unless enforced; so the
  frontmatter **must** be schema-validated (the new schema) and the trip-wire must robustly parse only the
  frontmatter fence, ignoring the prose body. This is a real obligation on the trip-wire slice, not a free
  swap.
- **Propagation:** `component-author` now scaffolds `{name}.{ts,css,md}`; the (unbuilt) contract
  trip-wire + frontmatter schema target the `.md`. No artifact exists to migrate.

## Alternatives considered

- **Keep `{name}.api.json` + a separate `{name}.md` doc** — rejected: duplicates the public surface across
  two files → the drift the coherence process exists to kill; the `/site` consumer would read one while the
  trip-wire checks the other.
- **Frontmatter-only, no body** — rejected: Phase 3 `/site` needs prose per component; a body-less descriptor
  forces a *third* doc artifact, reintroducing the duplication.
- **Keep JSON, generate the doc from it** — rejected: JSON is a poor authoring surface for prose, and a
  generated doc still needs a prose source somewhere; md-with-frontmatter is the natural authoring shape for
  a docs-site consumer (markdown in, page out).
- **Embed the contract in the `.ts` as a static field** — rejected: couples the machine-checkable contract
  to the runtime bundle (size) and loses the human-readable doc; the descriptor is a sibling artifact by
  design (`process.md` "attributes-as-API").
