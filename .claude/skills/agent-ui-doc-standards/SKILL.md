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
  document types' generic contracts (scribe:doc-authoring-standards) or component-code law
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
| ADR | blockquote TABLE — `> \| **Status** \| <kw> \|`, six fixed rows (Status · Date · Proposed by · Ratified by · Repairs · Supersedes / Superseded by) | `proposed · accepted · superseded · deprecated` — ONE bare keyword, never trailing prose | **Only Kim ratifies → accepted**, via either signal (ADR-0149): the in-tree hand-edit, or a `ratify ADR-####` comment/review by Kim on GitHub, executed by `scripts/adr_ratify.py` (gh-verified owner utterance → Status + Ratified-by + README row + index regen, fail-closed). The registered PreToolUse guard still blocks any agent Edit/Write flip unconditionally — the script is the only agent-side path, and it writes the housekeeping itself |
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
| `## Findings` | dated entries, appended | dated Issue **comments**, appended | same discipline — the SAME verb `scribe:bug-report`'s own dispatch contract already names |

ADR/PRD/SPEC/LLD and living-state docs (PLAN/ROADMAP) are explicitly **never** delegated — they
stay files on this map, always; only the TICKET tier moved.

## 2 · The status philosophy (why shipped specs still read `proposed`)

**Deliberate convention, not rot.** The repo ratifies *decisions* (the ADR Status cell — the one
human-gated field) and *builds* (the tree + gates + `done` tickets). SPEC/LLD statuses lag by
design — "when it disagrees with the tree, the tree wins" — so a `proposed` SPEC whose build
shipped is normal; do NOT sweep-flip statuses to match ship state. A SPEC/LLD flips to `accepted`
only when someone deliberately marks the contract stable (rare; 3 SPECs / 5 LLDs to date).
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
  Relates · Resolves`); LLD headers use `Refines:` (→ SPEC+ADR) and `Composes on:`; ADRs use
  `Repairs:` (→ the owning PRD-G/SPEC-R/LLD-C IDs). There is no `Implements:`/`Refined-by:` row —
  don't invent one.

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
- `site/lib/docs-grammar.test.ts` — the Phase-3 two-tier gate: STRUCTURAL (fails the run):
  SPEC/LLD/PRD status-keyword presence · the dangling-relative-link sweep over active docs ·
  hook-registration liveness both directions. HYGIENE (reported, promoted later): LLD
  dialect/Layer-spelling uniformity · TKT case in prose · ADR numbering gaps. The ticket-YAML
  enum/kind/size STRUCTURAL checks (ADR-0145, 2026-07-18) RETIRED with the file-based ticket
  tier itself — nothing replaces them file-side, since an Issue body isn't a file this gate can
  read; `.github/ISSUE_TEMPLATE/*.yml` is the new authoring-time contract, enforced by GitHub's
  own required-field validation at submission, not a repo-side lint.
- `.claude/hooks/adr-status-guard.py` (PreToolUse, registered) — blocks agent flips → `accepted`.
- scribe's `doc_lint.py` fit ONLY tickets here (YAML) while the file-based tier existed; with no
  new ticket files being authored, that particular fit is now moot going forward — the blockquote
  types stay out of its dialect regardless, do not "fix" a doc to satisfy it.

## 6 · Archive & historical records

`.claude/docs/archive/` holds superseded charters (banner + pointer, never deleted). Historical
records — CHANGELOG, done tickets' bodies, executed decompositions' context strings, dated
reports — keep old paths/claims verbatim; never rewrite them to match the present.
