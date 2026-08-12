---
name: project-docs
description: >-
  Answers what THIS project (agent-ui) has decided, planned, queued, and specified — from the
  `.claude/docs/` corpus AND the GitHub Issues board (the live work-item tier since ADR-0145).
  Use for "what are the requirements for X", "which issues/tickets are open" (→ `gh issue list`,
  never the frozen tickets/ archive), "what's on the plan / the roadmap / the goals", "what did we
  decide about Y", "is there a spec for Z", "what's the status of TKT-####" (the frozen archive),
  "what's already been queued or shipped". Consult table → the sources; Grep/`gh` first, read the
  matching section. ANSWERS from the records only. NOT for authoring or editing a document (the
  docs plugin's authoring skills); NOT for capturing a new feature idea (/docs:file-feature) or
  bug (/docs:file-bug); NOT for building from a record.
user-invocable: false
disable-model-invocation: false
---

# project-docs — agent-ui's decision and work record

The routing surface over `.claude/docs/` + the GitHub Issues board — so any session can find what
this project has decided, planned, and queued without being told where to look. Answers come from
the records, cited by path (or issue URL); a question the records don't answer is reported as
absent, never guessed. This repo's own doc-grammar dialect (status vocab, ticket sections, ID
spine) is authoritative from `.claude/skills/agent-ui-doc-standards/SKILL.md` — consult it
alongside this table, don't re-derive the grammar here.

| Ask | Look in |
|---|---|
| Problem, users, outcomes — the why | `.claude/docs/prd/` (PRD-G#/D#) |
| Requirements, exact behavior, acceptance criteria | `.claude/docs/spec/` (SPEC-R#/N#) |
| How something is built internally | `.claude/docs/lld/` (LLD-C#) |
| A ratified decision and its alternatives | `.claude/docs/adr/` (ADR-####, accepted = append-only; ADR README indexes them) |
| **What's queued or in flight — LIVE work items** | **GitHub Issues** (`gh issue list`; ADR-0145 — labels: `bug`/`enhancement`/`task` for kind, `size:small`/`size:big`, `doing` for in-progress; status = Issue state + close-reason (`completed`/`not planned`); Findings = dated issue comments). CLAUDE.md's `.claude/docs/` bullet is the owning statement of this convention. |
| Historical ticket records (TKT-0001–0096, all closed) | `.claude/docs/tickets/` — a FROZEN archive since 2026-07-18 (ADR-0145); answer "which tickets are open" from GitHub Issues, NEVER from here (a zero-open read of this directory is the false zero-board) |
| Structural breakdowns behind a build | `.claude/docs/decompositions/` (`*.decomp.json`) |
| Sequenced steps, near-term execution state | `.claude/docs/plan.md` (one file, not a directory) |
| Forward horizon — Now/Next/Later | `.claude/docs/roadmap.md` (one file; named in CLAUDE.md's header line) |
| Goals + per-milestone Definition of Done | `.claude/docs/goals.md` (one file, not a directory) |
| The coherence process itself | `.claude/docs/process.md` |
| Review rubrics | `.claude/docs/rubrics/` |
| Cross-screen flow cards | `.claude/docs/flows/` (`*.flow.json`) |
| Standards / reference docs | `.claude/docs/references/` |
| Investigation + audit reports | `.claude/docs/reports/` (where present — some waves file reports as issue comments instead) |
| Superseded charters, historical records | `.claude/docs/archive/` (banner + pointer, never deleted) |

(Before answering "absent" for any row, sweep for near-miss locations too — a loose `NOTES.md`, a
doc-shaped README section — a false "this project has none of that" is this skill's own worst
failure. The 2026-08-11 audit caught this skill itself committing that failure on the live-work
row: three weeks routing "which tickets are open" to a frozen archive.)

## Consult procedure

1. Classify the ask against the table; for live work items run `gh issue list` (filter by the
   label vocabulary above); for records Grep the corpus for the feature's nouns or the TKT-/ADR-
   id first — the files are records, not linear reads.
2. Answer with **the claim + the file path or issue URL (+ the record's status where it has
   one)**. A record's frontmatter/status-line (`status`, `kind`, `size`) is part of the answer —
   an open issue and a completed one answer "is X built?" oppositely. Status *dialect* differs by
   type (blockquote table for ADRs, YAML frontmatter for archived tickets, blockquote status line
   for SPEC/LLD/PRD, Issue state + labels on GitHub) — see `agent-ui-doc-standards` before
   asserting a status is stale.
3. Cross-references between records use the ID spine (`ADR-####` · `SPEC-R#`/`SPEC-N#` ·
   `LLD-C#` · `PRD-G#`/`PRD-D#` · `TKT-####` · `GH #NN`) — follow them rather than assuming one
   file is complete.
4. Route all making: a new idea → `/docs:file-feature`; a defect → `/docs:file-bug`; building a
   queued record → the project's own build path; authoring or revising any document → the docs
   plugin's doc-authoring skills (all where installed — otherwise name the record that would be
   touched and hand back to the user).
