# Behavior check — P5.3 record (2026-08-05)

**Status: GAP — live with/without comparison not captured.** Both probe agents (baseline and
with-skill) idled without returning output inside the one-round budget; the forge closed on
host direction rather than arming another wait. The four intent.md assertions are therefore
NOT demonstrated by live runs.

What stands in evidence instead (partial, not a substitute):

- The fresh-context skill-checker audit (audit-report.md, verdict PASS) independently
  spot-checked 18 citations against the real files — 16 exact, 2 drifted-and-fixed — which
  covers assertion 4's substance (file:line grounding) at the source level.
- Assertions 1–3 are verifiable by inspection of the body (§1 five join points + roster law;
  §3 selection-outside-the-store + rejected radio-normalized store; §2 frozen signature +
  additive options bag) but their EFFECT on a fresh session is unmeasured.

Debt: the re-run recipe in baseline/README.md. Until run, treat trigger-rate and
answer-shape uplift as asserted, not proven.
