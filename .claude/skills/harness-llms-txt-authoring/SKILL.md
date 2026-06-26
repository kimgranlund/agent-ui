---
name: harness-llms-txt-authoring
description: >
  Author or review an llms.txt (and llms-full.txt) — the agent-facing map of a
  documentation corpus — to the standard shape, scoring it against a bundled
  rubric. Use whenever the user mentions llms.txt, an AI-facing docs index, "make
  our docs agent-readable", "generate an llms.txt", or "review our llms.txt".
  Use even when the user describes wanting agents/IDEs to discover their docs
  without naming the file.
---

# Harness — llms.txt Authoring & Review

Author the curated index that tells agents where a corpus's authoritative content lives, or review one against the rubric. `llms.txt` is the knowledge artifact whose entire job is discovery; agentic IDE tools fetch it routinely.

## When to use
The user wants to create or score an llms.txt / llms-full.txt for a docs site or repo.

## Foundations (essentials; full models in `references/foundations.md`)
- **Index, not content delivery** — `/llms.txt` is the lean table of contents; `/llms-full.txt` carries the concatenated corpus.
- **Descriptions are what the agent routes on** — one accurate sentence per link matters more than coverage.
- **Discoverability** — serve at root so tools find it without prior knowledge.

## Author
1. Use the standard shape: H1 project name → blockquote 1–2 sentence summary → H2 sections (Documentation, Examples, API) each listing links with a one-line description per page.
2. Curate to authoritative content; exclude chrome, ads, low-value pages.
3. Ensure links resolve to markdown-accessible pages; split the heavy corpus into `llms-full.txt`.
4. Serve at `/llms.txt` (optionally `/.well-known/llms.txt` + discovery headers); version per release if the surface changes.
5. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D2, D6) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check for links-present-and-valid first (the top failure is a list of concepts with no links).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <llms.txt>  ·  Rubric: rubric-llms-txt
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D1,D2,D6): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When authoring or explaining a finding (covers references and llms.txt) |
| `references/foundations.md` | When a finding turns on a shared model |
