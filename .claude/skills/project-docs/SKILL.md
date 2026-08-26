---
name: project-docs
description: >-
  Answers what THIS project (agent-ui) has decided, planned, queued, and specified — from the
  `.claude/docs/` corpus and GitHub Issues. Use for "what are the requirements for X", "which
  tickets are open", "what's on the roadmap / the plan", "what did we decide about Y", "is there
  a spec for Z", "what's the status of issue #NN", "what's already been queued or shipped".
  Consult table → the docs; Grep first, read the matching section. ANSWERS from the corpus only.
  NOT for authoring or editing a document (`/make-doc`, docs plugin); NOT for capturing a new
  feature idea (`/file-feature`), bug (`/file-bug`), or chore (`/file-task`); NOT for building
  from a record (`/build-feature`, teamwork plugin).
user-invocable: false
disable-model-invocation: false
---

# project-docs — agent-ui's decision and work record

The routing surface over `.claude/docs/` and GitHub Issues — so any session can find what
agent-ui has decided, planned, and queued without being told where to look. Answers come from
the files or issues, cited by path/id; a question the corpus doesn't answer is reported as
absent, never guessed.

agent-ui rules **Option B — git-native** (ADR-0002/ADR-0145): work items are GitHub Issues, not
local ticket files. Everything else (ADR/PRD/SPEC/LLD/PLAN/ROADMAP) stays files under
`.claude/docs/` — never `docs/` at the repo root.

| Ask | Look in |
|---|---|
| Problem, users, outcomes — the why | `.claude/docs/prd/` (PRD-*) |
| Requirements, exact behavior, acceptance criteria | `.claude/docs/spec/` (SPEC-*) |
| How something is built internally | `.claude/docs/lld/` (LLD-*) |
| A ratified decision and its alternatives | `.claude/docs/adr/` (ADR-*, accepted = append-only) |
| An intent/requirements record (idr-####) or a locked ratification record (rdd-####) | `.claude/docs/idr/`, `.claude/docs/rdd/` (rdd/ is a deliberate zero-record placeholder — see its `README.md`; this repo maps that tier to req docs + PLAN/ROADMAP/GitHub Issues instead) |
| What's queued, in flight, or done (bug/feature/task) | **GitHub Issues** (`gh issue list` / `gh issue view <NN>`) — labels carry `kind:` (`bug`/`feature`/`task`) and `size:small`/`size:big`; `docs/tickets/` (repo-root) does not exist — `tickets/` is FROZEN per ADR-0145 |
| Historical ticket files predating the GitHub-Issues switch (read-only) | `.claude/docs/tickets/` (`tkt-####-*.md`, frozen — never mint new ones here) |
| Sequenced steps with done-whens | `.claude/docs/plan.md` (single file, not a directory) |
| Horizons of intent — Now / Next / Later | `.claude/docs/roadmap.md` (single file) |
| Goals and definition-of-done | `.claude/docs/goals.md` |
| Process (how work moves through phases) | `.claude/docs/process.md` |
| Standards, conventions, harvested lessons | `.claude/docs/references/` |
| Ratified decompositions (two-plane breakdowns) | `.claude/docs/decompositions/` (`*.decomp.json`) |
| Standing rubrics used by *-checker agents | `.claude/docs/rubrics/` |
| One-off feature briefs (pre-PRD framing) | `.claude/docs/briefs/` |
| Dated research/exploration findings | `.claude/docs/research/` |
| Sweep/audit/ops reports | `.claude/docs/reports/` |
| Superseded or retired docs | `.claude/docs/archive/` |

(A directory under `.claude/docs/` that doesn't exist usually means the project has none of that
record type yet — but before answering "absent", sweep for near-miss locations: the root-level
`docs/` (not used here), loose files (`NOTES.md`, `ARCHITECTURE.md`), doc-shaped README sections.
A hit → answer with the real location, marked non-canonical. A false "this project has no specs"
is this skill's own worst failure. Knowledge corpora authored at intake are linked from their
issue, not mapped here.)

## Consult procedure

1. Classify the ask against the table; Grep `.claude/docs/` for the feature's nouns, or use
   `gh issue view <NN>` / `gh issue list --search "<terms>"` for work-item status — records are
   references, not linear reads.
2. Answer with **the claim + the file path or issue URL (+ the record's status where it has
   one)**. A record's frontmatter (`status`, `doc-type`) or an issue's labels/state are part of
   the answer — an open issue and a closed one answer "is X built?" oppositely.
3. Cross-references between records use ids (the ID spine: an issue links its SPEC/LLD by id,
   ADRs cite each other) — follow them rather than assuming one file is complete.
4. Route all making: a new idea → `/file-feature`; a bug → `/file-bug`; a chore/follow-up →
   `/file-task`; building a queued record → `/build-feature`; authoring or revising any document
   → `/make-doc` (all where installed — otherwise name the record that would be touched and hand
   back to the user).
