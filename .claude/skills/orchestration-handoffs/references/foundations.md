# Foundations — the handoff contract's load-bearing models

The handoff block is not a status update; it is the **context transfer** that lets a bounded, fresh-context loop keep its integrity. Every field earns its place against one of these models.

## 1. Verifiable, not narrative

A worker runs in fresh context and is stood down after it reports. The orchestrator (and the critic) **cannot watch the work happen** — they only see what comes back. So the handoff must let the next step *confirm the work without re-doing it*. That is the whole purpose of **Evidence** and **Tests/checks run**: gate exit codes, `file:line` citations, and counts are checkable in seconds; "I tested it and it works" is not. A handoff that forces the reader to re-open the files and re-derive the result has failed, however true its prose.

## 2. The generator/critic split grades on the block

Verification is a step *separate* from making — a maker never grades its own work. The critic (a rubric, a council, or the orchestrator's eval gate) scores the maker's output, and the inputs it scores are precisely **Evidence** + **Tests/checks run**. Write those two fields *for the critic*: name the command and its result, cite the proof. If the critic can't grade it from the block, the block is underspecified.

## 3. The up-loop routes on two fields

`orchestration-lead` decides what happens next from **Recommended next action** (the single step + its owner) and **Open questions** (the unresolved forks). These are the routing surface of the discovered-reality loop: an escalation a worker raises here is what sends planning to repair an owning doc, or the host to ratify. **Risks** feed the eval gate (they tell the critic where to look). Vague entries here stall the loop; a precise "next step + owner" keeps it moving.

## 4. The rollup is the same block

`orchestration-lead` does not invent a new format to report upward — it returns **the same seven fields**, aggregated across the team it ran. *Summary* becomes the wave outcome, *Files changed* the union, *Recommended next action* the dispatch/ratify decision. One shape at every level keeps the loop legible from leaf to host.

## 5. Drain-the-inbox-first is a correctness rule, not etiquette

Messages cross. A worker that composes its handoff before reading a later message ships a block that is *stale on arrival* — and the three failure modes are concrete and costly: re-asking an answered question (wastes a round-trip), re-editing a committed artifact (a write race), retracting a finding a newer commit already fixed (false alarm). The fix is mechanical: read everything pending, *then* compose. Freshness is a property the block must have, not a courtesy.

## 6. Gate ≠ commit is a safety boundary

Treating a green gate as a landed change is how a regression lands: a commit chained onto a test run with `&&` lands code whose gate output was never read. The contract forces the read-then-commit ordering and keeps the two acts distinct — a maker hands back *gated state*; the coordinator/host reads the evidence and commits as its own step. This is also why the committed tree is the source of truth: a stood-down seat is never re-dispatched to edit a landed artifact; a later change is a new commit.
