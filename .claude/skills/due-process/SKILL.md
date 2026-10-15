---
name: due-process
description: >-
  The mandatory four-phase build loop for every size:big work item in this repo — Understand/
  Research → Plan → Execute → Evaluate — each phase with its own checkable exit artifact (GH
  #969). Use when dispatching, planning, or building a size:big issue/PR, or asked "does this big
  change need due process", "what phase are we in", "what's the exit artifact for this phase",
  "can this size:big issue close yet". NOT ui-* component work itself — build or design intake
  (component-build/component-design); NOT which doc a change earns (doc-standards); NOT the
  artifact/gate architecture this loop sequences, never contradicts (`.claude/docs/process.md`).
disable-model-invocation: false
user-invocable: true
---

# due process — the size:big build loop

Owner ruling (find-intent round, 2026-08-15, GH #969): every `size:big` work item in this repo
runs this four-phase loop before it closes. Each phase names ONE checkable exit artifact — the
loop is auditable from the issue thread alone, never taken on trust. `size:small` is unaffected;
its existing path (the sdlc-lite solo lane, `.sdlc/AGENTS.md`) carries no new step from this
skill.

This skill governs the ORDER a size:big build passes through. `.claude/docs/process.md` governs
a *different* axis — the artifact/gate architecture that prevents drift and bloat once code is
being written. The two complement each other: Phase 3 below is exactly where process.md's
trip-wires, gates, and review discipline apply — this skill never restates them, only sequences
them into the loop.

## Phase 1 — Understand/Research

Read the owning records before any design starts: the issue/ticket body itself, prior ADRs/
SPECs/PRDs it cites or is adjacent to, cited precedents, and any linked brief
(`.claude/docs/briefs/*.brief.md`). Do targeted research for the specific gap — never assume one
exists uninvestigated.

**Exit artifact:** a dated grounding-note comment on the issue stating what already exists and
what the gap actually is. No comment, no proof this phase ran.

## Phase 2 — Plan

Decide which doc(s) the change actually EARNS per `doc-standards`:
PRD/SPEC/LLD where warranted, **never the bundle by default**. A genuine fork in an existing
decision is settled in the ticket, and the standing rule it sets lands in the owning reference doc or
skill (the ADR folder is frozen, T-0164). Design is
ruled before code: a build that starts writing source before this phase's docs land is out of
sequence.

**Exit artifact:** the authored doc(s), linked from the issue (or an explicit one-line note that
none were earned and why, when the change is process/skill-shaped rather than code-shaped).

## Phase 3 — Execute

Sliced builds under the existing dated-Findings write-back contract
(the sdlc-lite lane `steps.py lane` picks for the ticket: the solo agent for levels L1 and L2,
`/sdlc-lite:chain` for an L4 or L5 step, a merge step or cross-cutting scope; `.sdlc/AGENTS.md`). Gates run FOREGROUND, judged by exit codes only — never piped through `grep`/`head`
(`AGENTS.md` "Gates"; a piped grep-count masked a red gate and an OOM'd browser run,
2026-07-19). This is where `.claude/docs/process.md`'s trip-wires and standing gates apply.

**Exit artifact:** one dated `## Findings` entry per significant slice (a slice built, a gate
green, a PR opened) — not only a single entry at the end.

## Phase 4 — Evaluate

Two independent proofs, both required, before the issue closes:

1. **Independent checker verdict** — the artifact's owning critic seat per `seat-map`'s table
   (an sdlc-lite verifier run (`run.sh`) for a non-UI slice, a `ui-*` component against
   `rubrics/component.md`, or a skill; `a2ui-review-agent` for an A2UI artifact). Generator ≠
   critic: the maker
   never grades its own change.
2. **Rendered-on-the-live-surface proof** — pixel-truth: "fixed" means seen working on the real
   running surface, never inferred from a green gate alone (memory/ops precedent: *pixel-truth
   over repo-truth*). **Escape hatch:** a change with no rendered surface at all (a skill, a doc,
   a process/wiring change — this skill's own build is one) has nothing to render; the checker
   verdict plus the gate exit codes stand in for proof 2, named as such in the closing comment —
   never silently skipped, never assumed.

**A checker pass alone never closes a `size:big` issue** — both proofs (or the named stand-in)
are required together.

**Failure branches:** no checker seat is available for the artifact kind → name the gap in the
issue and hold the loop at Phase 4, never close on Phase 3 evidence alone. The live surface is
genuinely unrunnable (no dev server, no deploy target for this slice) → the escape hatch above
applies, named explicitly, not silently assumed.

## Scope

- `size:small` is explicitly out of scope. Its existing lighter path (the sdlc-lite solo lane,
  one independent verifier before the ticket closes) is unchanged.
- Never contradicts `.claude/docs/process.md` — when the two disagree on WHAT artifact a change
  needs, process.md's placement rules win; this skill only ever adds the ORDER, never a
  competing artifact taxonomy.

## Enforcement — how a size:big dispatch actually carries this

Repo-local seam: work in this repo runs through the sdlc-lite lanes (`.sdlc/AGENTS.md`, roles
launched with `run.sh` or the solo agent); no teamwork-plugin build seat is used here:

- **`seat-map`'s "Dispatch laws" section carries the mandatory clause** every
  `repo-orchestrator-agent` dispatch brief copies in (seat-map is that seat's own preloaded
  skill) — a size:big campaign brief cites `due-process` by name before design work starts.
- **Every Agent-tool subagent operating in this repo inherits its `CLAUDE.md`** — including an
  sdlc-lite solo, builder or verifier. (A `context:
  fork`-style skill invocation, e.g. `Explore`/`Plan`, does not carry the same project-CLAUDE.md
  inheritance guarantee — this line covers Agent-tool subagent dispatches only.) The AGENTS.md Process
  one-line pointer is what makes the loop visible even when no `repo-orchestrator-agent` campaign
  is involved.
