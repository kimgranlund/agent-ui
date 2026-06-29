# Best practices — filling the seven fields

Write the block *for the reader who must act on it*: the orchestrator routing, the critic grading, the host committing. Each field has a failure mode; avoid it.

## Per-field how-to

- **Summary** — state the *outcome* in 1–3 sentences ("the positional list reconciler ships; reorders preserve node identity"), not the journey ("first I tried X, then Y broke, so…"). The reader wants what is now true, not how you got there.
- **Files changed** — list *every* path, marked created / edited / deleted, one per line. A missing path hides blast radius. `(none)` for a pure investigation/review.
- **Tests/checks run** — name the **command** and its **result**, never a bare "tests pass". `npm run check && npm test` → "check clean, 1043 passed". A gate you *didn't* run is stated as not-run, not silently omitted — the reader must know the coverage you actually have (e.g. "browser smoke NOT run — no runner here").
- **Evidence** — the *checkable* proof: gate exit codes, the pass count, `file:line` citations for a claim, the coverage result. The test: could the reader confirm your Summary in under a minute from this field alone? If not, it's too thin. Make it **non-vacuous** — "the negative control fails when the fix is reverted" beats "the test passes".
- **Risks** — name what could be wrong, the assumptions you made, and the blast radius — *honestly*. "None" is rarely true; a deferred edge, an untested combination, a schema you didn't extend all belong here. A reassuring Risks field is a failed Risks field.
- **Open questions** — only *real* unresolved forks that need a human or another role to decide. Not rhetorical, not already-answered. Each should be answerable with a decision, and routing-shaped ("input target: reuse the control's user-invalid timing, or a new channel?").
- **Recommended next action** — exactly **one** best next step **and its owner**. "planning-lead designs the error-vocab ADR" routes; "various follow-ups remain" does not. If the work is done and verified, say so plainly and name the owner of the commit.

## Per-seat notes

- **planning-lead** — *Files changed* = the docs authored (PRD / SPEC / LLD / ADR). *Tests/checks run* = `harness_checks.py <type>`, `coverage_check.py`, `trace_check.py`. *Recommended next action* often = "ratify ADR-NNNN, then dispatch the build".
- **execution-lead** — *Files changed* = code / scaffold / tests. *Tests/checks run* = `npm run check && npm test` (+ any browser gate). Map each DoD proof point to its test name in *Evidence*. Surface a discovered constraint as an *Open question* / *Risk* rather than editing the contract.
- **orchestration-lead** — a **rollup**: the same seven fields aggregated across the team. *Recommended next action* = the dispatch-or-ratify decision the host acts on.
- **docs-site-steward** — *Files changed* = site pages / CSS / tests. *Tests/checks run* = the drift gates (`descriptor/site-canon.test.ts`, the contract↔props trip-wires) + `npm run check && npm test`; flag a browser smoke you wrote but couldn't run. *Risks* = the soft content drift a static test can't see.
- **tokens-specialist** — *Files changed* = the token files (`tokens.css` / `dimensions.css`). *Evidence* = the WCAG-AA + forced-colors result across *both* schemes, and that no role ladder collapsed to one step.

## Do / don't

- **Do** drain the inbox before composing (see `foundations.md` §5) — freshness is a correctness property.
- **Do** keep the read-then-commit ordering. **Don't** chain a commit onto a gate with `&&`.
- **Don't** omit a field — `(none)` is information; a missing field is ambiguity.
- **Don't** narrate process where outcome + evidence belong.
- **Don't** mark a maker's own work "verified" — verification is the critic's / coordinator's step. Hand back *gated state* with the evidence; let the gate be read by the next seat.
- **Don't** hand back a block a reviewer would have to re-do the work to trust.
