---
doc-type: ticket
id: tkt-0022
status: open
date: 2026-07-11
owner:
kind: feature
size: small
---
# TKT-0022 — the corpus-admission drain: exemplar seeds enter the judged corpus store

## Summary
Kim's goal directive (2026-07-11): close the standing corpus-admission gap (recorded at the
token-surfaces M2 wave, carried across ~6 waves since). The example seeds under
`packages/agent-ui/a2ui/src/examples/` (catalog-coverage.ts, message-lifecycle.ts,
generative-form.ts, dynamic-lists.ts, patterns.ts, canvas-button.ts) render on the site gallery
and pass validator gates, but were never ADMITTED through the corpus pipeline — the retrieval
corpus (`corpus-data`) doesn't contain them, so retrieval-conditioned generation can't imitate
exactly the worked shapes the waves built to teach (the kpi-panel lifecycle arc, the
color-picker-form fence, etc.). The machinery all exists: `tools/corpus/import-seeds.ts`,
`src/corpus/{admit,judge,dedup,canonical}.ts`, the ADR-0068 VerdictsFile seam (judge = the
`a2ui-reviewer` seat emitting verdicts against `.claude/docs/rubrics/a2ui-corpus.md`), and the
never-admit-unjudged throw (judge.ts:138).

## Acceptance
- Every current example seed is either ADMITTED to the corpus store (imported → judged via the
  ADR-0068 verdicts flow → passing the gate-to-promote rule) or explicitly DISPOSITIONED with a
  recorded reason (e.g. a deliberately-minimal smoke seed that would teach nothing — the
  disposition list lives where the corpus docs expect it, not in a chat log).
- The judging is REAL generator≠critic: `a2ui-reviewer` scores each candidate record against the
  corpus rubric and emits the VerdictsFile; the import applies it; no self-scored admissions.
- The gap itself gets a TRIP-WIRE so it cannot silently reopen: a gate asserting every
  examples/ seed is either present-in-corpus or on the recorded disposition list (the
  fleet-derived-gate precedent — a future wave adding a seed without dispositioning it goes red).
- Corpus invariants hold: dedup, canonical form, single-surface discipline where the rubric
  demands it; `corpus-data` regenerated through the sanctioned tool (never hand-edited);
  retrieve tests green.
- The derived system prompt / retrieval behavior re-validated per the ADR-0087 consequence
  pattern if admission changes what retrieval returns (run the round-trip/prompt gates).

## Links
- `packages/agent-ui/a2ui/src/examples/` (the candidates) · `src/corpus/` + `tools/corpus/`
  (the pipeline) · `.claude/docs/rubrics/a2ui-corpus.md` (the rubric) · ADR-0068 (VerdictsFile) ·
  ADR-0064 (single-surface) · the a2ui-corpus-curate skill (`.claude/skills/a2ui-corpus-curate/`).

## Scope / Open
- Which seeds are corpus-worthy vs smoke-only — the curate pass decides per the rubric, recorded.
- **Non-goals:** new seeds; rubric changes; retrieval-algorithm changes.

## Findings
