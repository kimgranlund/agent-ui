---
name: project-docs
description: >-
  Answers what THIS project (agent-ui) has decided, planned, queued, and specified — from the
  `.claude/docs/` corpus and the `.sdlc/tickets/` work records. Use for "what are the requirements for X", "which
  tickets are open", "what's on the roadmap / the plan", "what did we decide about Y", "is there
  a spec for Z", "what's the status of issue #NN", "what's already been queued or shipped".
  Consult table → the docs; Grep first, read the matching section. ANSWERS from the corpus only.
  NOT for authoring or editing a document (`doc-standards`); NOT for filing a new ticket
  (`sdlc-lite:ticket`); NOT for building from a ticket (the sdlc-lite solo agent or
  `/sdlc-lite:chain`).
user-invocable: false
disable-model-invocation: false
---

# project-docs — agent-ui's decision and work record

The routing surface over `.claude/docs/` and `.sdlc/tickets/` — so any session can find what
agent-ui has decided, planned, and queued without being told where to look. Answers come from
the files or tickets, cited by path/id; a question the corpus doesn't answer is reported as
absent, never guessed.

Work items are SDLC Lite tickets in `.sdlc/tickets/<NNNN-slug>/handoff.md` (T-0242, 2026-10-15);
GitHub Issues (ADR-0145) hold the items filed before that switch. Everything else (PRD/SPEC/LLD/PLAN/ROADMAP, plus the frozen ADR set) stays files under
`.claude/docs/` — never `docs/` at the repo root.

| Ask | Look in |
|---|---|
| Problem, users, outcomes — the why | `.claude/docs/prd/` (PRD-*) |
| Requirements, exact behavior, acceptance criteria | `.claude/docs/spec/` (SPEC-*) |
| How something is built internally | `.claude/docs/lld/` (LLD-*) |
| A decision and its alternatives | the ticket that made it; a standing rule in its owning `.claude/docs/references/` doc or skill. Decisions before 2026-10-14: `.claude/docs/adr/` (ADR-*, frozen history, T-0164) |
| An intent/requirements record (idr-####) or a locked ratification record (rdd-####) | `.claude/docs/idr/`, `.claude/docs/rdd/` (rdd/ is a deliberate zero-record placeholder — see its `README.md`; this repo maps that tier to req docs + PLAN/ROADMAP/GitHub Issues instead) |
| What's queued, in flight, or done (bug/feature/chore) | **`.sdlc/tickets/`**: the generated `.sdlc/tickets/roadmap.md` lists every ticket by stage; each `handoff.md` front matter carries `type`, `status` and `size`. Items filed before T-0242: GitHub Issues (`gh issue view <NN>`) |
| Historical ticket files predating the GitHub-Issues switch (read-only) | `.claude/docs/tickets/` (`tkt-####-*.md`, frozen, still cited) and the archived uncited ones in `.claude/docs/archive/tickets/` (T-0252); never mint new ones here |
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

1. Classify the ask against the table; Grep `.claude/docs/` for the feature's nouns, or read
   `.sdlc/tickets/roadmap.md` and the ticket's `handoff.md` for work-item status (`gh issue view <NN>`
   for an item filed before T-0242) — records are
   references, not linear reads.
2. Answer with **the claim + the file path or issue URL (+ the record's status where it has
   one)**. A record's frontmatter (`status`, `doc-type`) or an issue's labels/state are part of
   the answer — an open issue and a closed one answer "is X built?" oppositely.
3. Cross-references between records use ids (the ID spine: an issue links its SPEC/LLD by id,
   ADRs cite each other) — follow them rather than assuming one file is complete.
4. Route all making: a new feature, bug or chore → `sdlc-lite:ticket`; building a ticket → the
   lane `steps.py lane` prints (solo agent or `/sdlc-lite:chain`); authoring or revising a document
   → `doc-standards` for the grammar (name the record that would be touched and hand back to the
   user when no seat fits).
