# The ID spine & ticket section contracts (doc-standards §3 / §4)

## 3 · The ID spine & cross-references

- IDs: `ADR-####` · `SPEC-R#`/`SPEC-N#` · `LLD-C#` · `PRD-G#`/`PRD-D#` · `TKT-####`.
- Cite by altitude: **bare IDs** at requirement level (`SPEC-R3 AC2`); **relative markdown links**
  at document level (`[ADR-0107](../adr/0107-….md)`). Every relative link must resolve — the
  standing sweep gate (§5) reds a dangling link in any active doc.
- Prose cites tickets UPPERCASE (`TKT-0018`); filenames + YAML `id:` stay lowercase (`tkt-0018`).
- Supersession/extension vocabulary lives in the ADR's `Supersedes / Superseded by` cell as prose
  (`Supersedes · Superseded by [(partial)] · Extends · Extended by · Amends · Amended by ·
  Relates · Resolves`); LLD headers come in TWO live dialects: `Refines:` (→ SPEC+ADR, the canon for new LLDs) and the
  legacy `Implements:` (present across the older LLD corpus at HEAD — read it as history, never
  "fix" it in place; H1 tracks the uniformity as hygiene). `Composes on:` rides both; ADRs use
  `Repairs:` (→ the owning PRD-G/SPEC-R/LLD-C IDs). There is no `Refined-by:` row — don't invent
  one (GH #761 corrected this line's earlier denial that `Implements:` existed at all).
- **Re-derive a cited authority at its source; never transcribe a peer's citation.** A citation
  error propagates through a review chain exactly as easily as it originates in one — ADR-0167's
  3-round ratification review caught this in both directions: the author's own "disposition
  column empty" claim about `agent-admin-shell-rehost.lld.md`'s LLD table was a misread of a
  4-column table with no such column (the `—` cell meant "no dependencies", proven by a
  plainly-shipped sibling row carrying the same `—`); the reviewer's own "table header at `:16`"
  was itself off by one (`:15`), caught only because the author re-ran `grep -n` instead of
  trusting the reviewer's line number. Each error survived exactly as long as the next reader
  took the citation on faith. Grep/Read the actual line before it enters a Decision, a Findings
  comment, or a review verdict — every time, regardless of whose claim it corrects.

## 4 · Ticket section contracts (split by kind — both legal; the shape survives the ADR-0145 backend move, only the container changed from a markdown file to an Issue body)

- `kind: feature` — Summary · Acceptance · Links · Scope/Open · Findings (+ `size` frontmatter, now
  the `size:small`/`size:big` label; on an Issue, Findings is the dated-comment stream, §1).
- `kind: bug` — Summary · Acceptance · Repro · Expected vs actual · Classification · Severity
  (`blocker·major·minor·cosmetic`) · Links · Findings (same Issue-comment mapping).
- Findings entries are dated, appended at each significant result, never only at the end — a file's
  `## Findings` section before ADR-0145, an Issue's comment stream after.
- `.github/ISSUE_TEMPLATE/{feature,bug}.yml` are the current authoring surface for a human filer;
  they carry this SAME contract as GitHub Issue Forms fields, not a paraphrase of it.
