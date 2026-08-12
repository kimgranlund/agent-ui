---
name: agent-ui-doc-standards
description: >-
  Route to THIS repo's design-doc + harness-metadata grammar: the per-type status dialects (ADR
  blockquote-table · ticket YAML · SPEC/LLD/PRD blockquote status lines), the exact status vocabulary
  and WHO may flip each, the ID spine (ADR-#### · SPEC-R# · LLD-C# · PRD-G#/D# · TKT-####) and
  supersession vocabulary, ticket-kind section contracts, and which gates enforce what. Use for "what
  status vocabulary does a SPEC use", "who flips an ADR to accepted", "what sections does a bug ticket
  carry", "why is this shipped spec still proposed", "how do docs cite each other" — BEFORE authoring
  or judging any .claude/docs record. This repo's dialect DIVERGES from scribe's doc_lint (blockquote,
  not YAML; proposed/accepted, not draft/approved) — this skill is the local authority. NOT for the
  document types' generic contracts (docs:doc-writing-rules) or component-code law
  (agent-ui-component-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-ui doc & harness grammar

Codified 2026-07-12 (repo-alignment Phase 3) from observed practice across 126 ADRs · 25 SPECs ·
36 LLDs · 10 PRDs · 24 tickets. The gates in §5 enforce the deterministic slice; this skill owns
the judgment layer. One fact, one home: this file states rules; counts/history live in
`.claude/docs/reports/repo-alignment-2026-07-12/`.

## 1 · Status dialects (per type — three dialects, deliberate)

| Type | Dialect | Vocabulary | Who flips |
|---|---|---|---|
| ADR | blockquote TABLE — `> \| **Status** \| <kw> \|`, six fixed rows (Status · Date · Proposed by · Ratified by · Repairs · Supersedes / Superseded by) | `proposed · accepted · superseded · deprecated` — ONE bare keyword, never trailing prose | **Only Kim ratifies → accepted**, via either signal (ADR-0149): the in-tree hand-edit, or a `ratify ADR-####` comment/review by Kim on GitHub, executed by `scripts/adr_ratify.py` (gh-verified owner utterance → Status + Ratified-by + README row + index regen, fail-closed). A flip whose **Repairs** cell books items "on ratification" also files ONE OPEN tracking issue holding them verbatim (label `task`, GH #544) — **closing that issue is the record the repairs landed**; leaving it open is the only thing that makes an unexecuted booking visible. The registered PreToolUse guard still blocks any agent Edit/Write flip unconditionally — the script is the only agent-side path, and it writes the housekeeping itself |
| Ticket (HISTORICAL — through TKT-0096) | YAML frontmatter (`doc-type: ticket`) | `open · doing · done · wontfix`; `kind: bug\|feature`; `size` on features only | Agents flip freely as work progresses |
| SPEC / LLD / PRD | blockquote STATUS LINE — `> Status: <kw> · v# · <date> · Layer: …` | `proposed · accepted · superseded` | PRDs flip at Kim's ratification; SPEC/LLD — see §2 |

**Ticket, current (ADR-0145, 2026-07-18):** new work items are GitHub Issues, not files —
`.claude/docs/tickets/` is a frozen historical archive from here on, never a target for new
entries (§6's own archive rule applies retroactively to the whole tier, not just superseded
records). File via `gh issue create` or the repo's `.github/ISSUE_TEMPLATE/{feature,bug}.yml`
forms, which mirror §4's section contract field-for-field. The status/kind/size vocabulary maps
onto real GitHub primitives, not a parallel taxonomy:

| Old field | Old value | GitHub mechanism | Note |
|---|---|---|---|
| `kind` | `bug` / `feature` | the `bug` / `enhancement` label (GitHub's own defaults) | NOT a native Issue Type — that feature is organization-level and unavailable on this personal-account repo (ADR-0145's build-time amendment); reusing the existing default labels avoids minting a parallel `kind:*` pair that would just duplicate them |
| `size` | `small` / `big` | the `size:small` / `size:big` label | same taxonomy, just a label instead of frontmatter |
| `status` | `open` | Issue open, no extra label | |
| `status` | `doing` | Issue open + the `doing` label | GitHub's own state has no "in progress" value |
| `status` | `done` | Issue closed, close reason `completed` | native GitHub field, not a label |
| `status` | `wontfix` | Issue closed, close reason `not planned` | native GitHub field, not a label |
| `## Findings` | dated entries, appended | dated Issue **comments**, appended | same discipline — the SAME verb `docs:file-bug`'s own dispatch contract already names |

ADR/PRD/SPEC/LLD and living-state docs (PLAN/ROADMAP) are explicitly **never** delegated — they
stay files on this map, always; only the TICKET tier moved.

## 2 · The status philosophy (why shipped specs still read `proposed`)

**Deliberate convention, not rot.** The repo ratifies *decisions* (the ADR Status cell — the one
human-gated field) and *builds* (the tree + gates + `done` tickets). SPEC/LLD statuses lag by
design — "when it disagrees with the tree, the tree wins" — so a `proposed` SPEC whose build
shipped is normal; do NOT sweep-flip statuses to match ship state. A SPEC/LLD flips to `accepted`
only when someone deliberately marks the contract stable (rare — grep the corpus for the current set; a copied count here decays, GH #761).
Accepted ADRs are append-only: extensions land as `## Amendment` sections or as rows in the
current wave's OWN proposed ADR, never edits to the accepted body (REV-annotated mechanical
pointer repairs excepted).

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

## 5 · The gates (deterministic tier — cite, never restate)

- `site/lib/adr.test.ts` — ADR filename/table/status-enum/date/summary (the original gate).
- `site/lib/docs-grammar.test.ts` — the two-tier gate: STRUCTURAL S2–S9 fail the run, HYGIENE H1
  reports (its own file-header ledger is the authoritative check list — read the tiers there, never
  from a copy here; GH #761 corrected this line's stale three-item restatement against it). The ticket-YAML
  enum/kind/size STRUCTURAL checks (ADR-0145, 2026-07-18) RETIRED with the file-based ticket
  tier itself — nothing replaces them file-side, since an Issue body isn't a file this gate can
  read; `.github/ISSUE_TEMPLATE/*.yml` is the new authoring-time contract, enforced by GitHub's
  own required-field validation at submission, not a repo-side lint.
- `.claude/hooks/adr-status-guard.py` (PreToolUse, registered) — blocks agent flips → `accepted`
  (and, since GH #745, fails closed on any edit leaving ≠ 1 Status rows — the decoy defense).
- `scripts/adr_ratify.py` — THE sanctioned flip path, BOTH modes: whole-ADR `proposed → accepted`
  (a verified `ratify ADR-####` owner utterance) AND the GH #664 AMENDMENT mode — an in-body
  `## Amendment (DATE, **proposed** — Kim ratifies) — TITLE` header (that literal marker grammar,
  exactly one candidate, or the script fails closed) flipped by a `ratify ADR-#### amendment`
  utterance; the Status cell and every accepted section stay byte-untouched. The script edits
  files but does NOT commit — the host commits and pushes the flip.
- scribe's `doc_lint.py` fit ONLY tickets here (YAML) while the file-based tier existed; with no
  new ticket files being authored, that particular fit is now moot going forward — the blockquote
  types stay out of its dialect regardless, do not "fix" a doc to satisfy it.

## 5b · Cite the owner — the anchor law for skills and docs (GH #757)

The 2026-08-11 audit's dominant finding class (~14 of 27 skills): facts COPIED into skill/doc
bodies drift — line-number anchors rot with every upstream edit, enumerated member lists fork
(the six-vs-seven event set, ×4 copies, GH #754), counts and "newest" superlatives decay. The
standing rule, proven by the corpus's own two fully-clean skills (`agent-ui-catalog`,
`agent-ui-component-patterns`):

- **Cite by STABLE anchor**: a clause id (`ADR-0153 cl.2`), a § heading (`SPEC-R12 §3.6` — §
  anchors into SPECs are allowed WITH their requirement id), a requirement id, a SYMBOL
  (`ALLOWED_EVENTS`, `buildSystemPrompt`), or a directory — these survive edits to the owning
  file.
- **Bare `file:NNN` line-number anchors into mutable files are defects**, as are copied
  enumerable sets, member lists, and counts — bumping a copy re-arms the drift; POINT at the
  owning home instead (the file that a gate enforces, the CLAUDE.md section, the test constant).
- **Escape hatch**: a deliberately frozen snapshot is legal when annotated
  `pinned to commit <sha>` on the same line — a dated pin is a citation; an unpinned line
  number is rot in waiting.
- **The sweep**: `scripts/claude_wiring_check.py`'s advisory tier flags unpinned `file:NNN`
  anchors in `.claude/skills/*/SKILL.md` on every `npm run check` (v1 advisory — the corpus
  carries legitimate exceptions being repaired wave by wave, GH #761).

## 6 · Archive & historical records

`.claude/docs/archive/` holds superseded charters (banner + pointer, never deleted). Historical
records — CHANGELOG, done tickets' bodies, executed decompositions' context strings, dated
reports — keep old paths/claims verbatim; never rewrite them to match the present.
