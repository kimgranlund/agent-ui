# Best Practices — Authoring Rubrics

How to write a rubric that produces consistent, actionable judgments. A rubric is the verification artifact native to agentic systems: deterministic code either runs or it doesn't, but agentic output is judgment, and judgment needs an externalized standard to check against. A rubric is to qualitative output what a schema is to structured data. Assumes `foundations.md`. Scored by `rubric.md`.

## What a rubric is

A rubric is four things: **criteria** (the dimensions you measure), **levels** (the score scale), **descriptors** (what each level looks like — the behavioral anchors), and an **aggregation rule** (how dimension scores combine into a verdict). Miss any one and the rubric stops being usable: criteria with no descriptors are opinions; descriptors with no aggregation rule produce scores no one can act on.

## Type every dimension

Each dimension is either `[gate]` or `[review]`, and the tag must be accurate.

- **`[gate]`** — mechanically checkable: a count, a presence/absence, a pass/fail. Score it by inspection, not impression ("body = 483 lines, ≤500, pass"). A dimension that needs judgment is not a gate, no matter how much you want it to be.
- **`[review]`** — requires judgment. Score it against the behavioral anchors and cite specific evidence from the artifact. The anchors are what keep two reviewers in agreement.

Mislabeling is the most common rubric defect: a "gate" that actually needs judgment gives false precision; a "review" that is really a count wastes a judgment slot.

## Anchor the levels

Use a 1–5 scale where 1 is the failure anchor, 3 is adequate, and 5 is the excellence anchor — and write concrete descriptors, not "good / adequate / poor." "1: bare scale with no descriptors · 5: concrete anchors a reviewer can match to evidence" is an anchor. "5: excellent" is not. Bare scales are the failure that makes a rubric measure nothing, because every reviewer scores differently.

## Keep criteria independent

Each dimension should measure one distinct thing. Overlapping dimensions double-count the same defect and inflate or deflate the verdict. If two dimensions always move together, merge them.

## State the measurement plan

Every dimension must say *how* to check it — the evidence a reviewer looks for. A criterion with no measurement method cannot be applied consistently. For `[gate]` this is the count or the check; for `[review]` it is the specific text or absence to cite.

## Make failure actionable

Failing a dimension should imply a specific fix. "Description trigger = 1" should map to "add the conditions that summon it, in the user's words." If failing a dimension tells the reader nothing to do, the dimension is descriptive, not diagnostic.

## State the aggregation and gate

End with the rule: which dimensions must score ≥ 3 to promote the artifact, and what the top failure to look for first is. Gate dimensions are the ones whose failure blocks use regardless of the rest. Without this rule, a scorecard is a pile of numbers with no verdict.

## Do / don't

Do: type every dimension and get the tag right; write concrete 1/3/5 anchors; keep dimensions independent; name the evidence for each; state the gate set and threshold; name the top failure to check first.

Don't: ship a bare scale; label a judgment call as a gate; let two dimensions measure the same thing; write "be good" descriptors; omit the aggregation rule.

## Best-in-class (shape)

```markdown
| # | Dimension | Type | What it checks | 1 → 3 → 5 |
|---|---|---|---|---|
| D1 | Description trigger | [gate] | States what it does AND when to use it | 1: capability only · 3: both, generic · 5: both, in the user's words |
...
Gate to promote: D1, D2, D5 ≥ 3.
Top failure to look for first: <the single most damaging, most common defect>.
```

A rubric built this way converges across reviewers, tells you what to fix, and gives the regenerative loop something concrete to check against — which is the entire reason it exists.
