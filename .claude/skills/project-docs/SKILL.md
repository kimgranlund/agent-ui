---
name: project-docs
description: >-
  Answers what THIS project (agent-ui) has decided, planned, queued, and specified — from the
  `.claude/docs/` corpus. Use for "what are the requirements for X", "which tickets are open",
  "what's on the plan / the goals", "what did we decide about Y", "is there a spec for Z", "what's
  the status of TKT-####", "what's already been queued or shipped". Consult table → the
  `.claude/docs/` files; Grep first, read the matching section. ANSWERS from the corpus only. NOT
  for authoring or editing a document (scribe's doc-authoring skills); NOT for capturing a new
  feature idea (/scribe:feature) or bug (scribe's bug-report); NOT for building from a record.
user-invocable: false
disable-model-invocation: false
---

# project-docs — agent-ui's decision and work record

The routing surface over `.claude/docs/` — so any session can find what this project has decided,
planned, and queued without being told where to look. Answers come from the files, cited by
path; a question the corpus doesn't answer is reported as absent, never guessed. This repo's own
doc-grammar dialect (status vocab, ticket sections, ID spine) is authoritative from
`.claude/skills/agent-ui-doc-standards/SKILL.md` — consult it alongside this table, don't
re-derive the grammar here.

| Ask | Look in |
|---|---|
| Problem, users, outcomes — the why | `.claude/docs/prd/` (PRD-G#/D#) |
| Requirements, exact behavior, acceptance criteria | `.claude/docs/spec/` (SPEC-R#/N#) |
| How something is built internally | `.claude/docs/lld/` (LLD-C#) |
| A ratified decision and its alternatives | `.claude/docs/adr/` (ADR-####, accepted = append-only; ADR README indexes them) |
| What's queued, in flight, or done | `.claude/docs/tickets/` (TKT-####; frontmatter `kind:` bug/feature, `size:` on features, `status:` open/doing/done/wontfix) |
| Structural breakdowns behind a build | `.claude/docs/decompositions/` (`*.decomp.json`) |
| Sequenced steps, current focus | `.claude/docs/plan.md` (one file, not a directory) |
| Goals + per-milestone Definition of Done | `.claude/docs/goals.md` (one file, not a directory) |
| The coherence process itself | `.claude/docs/process.md` |
| Review rubrics | `.claude/docs/rubrics/` |
| Superseded charters, historical records | `.claude/docs/archive/` (banner + pointer, never deleted) |

(This repo has no `docs/roadmap/` or `docs/task/` directories — horizon and single-sitting
records aren't split out; `plan.md`/`goals.md` cover that ground. Before answering "absent" for
any row, sweep for near-miss locations too — a loose `NOTES.md`, a doc-shaped README section — a
false "this project has none of that" is this skill's own worst failure.)

## Consult procedure

1. Classify the ask against the table; Grep the corpus for the feature's nouns or the TKT-/ADR-
   id first — the files are records, not linear reads.
2. Answer with **the claim + the file path (+ the record's status where it has one)**. A record's
   frontmatter/status-line (`status`, `kind`, `size`) is part of the answer — an open ticket and
   a done one answer "is X built?" oppositely. Status *dialect* differs by type (blockquote table
   for ADRs, YAML frontmatter for tickets, blockquote status line for SPEC/LLD/PRD) — see
   `agent-ui-doc-standards` before asserting a status is stale.
3. Cross-references between records use the ID spine (`ADR-####` · `SPEC-R#`/`SPEC-N#` ·
   `LLD-C#` · `PRD-G#`/`PRD-D#` · `TKT-####`) — follow them rather than assuming one file is
   complete.
4. Route all making: a new idea → `/scribe:feature`; building a queued record → the project's own
   build path; authoring or revising any document → scribe's doc-authoring skills (all where
   installed — otherwise name the record that would be touched and hand back to the user).
