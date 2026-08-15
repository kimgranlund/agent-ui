# The gates, cite-the-owner law, and archive rule (doc-standards §5 / §5b / §6)

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
standing rule, proven by the corpus's own two fully-clean skills (`component-catalog`,
`component-patterns`):

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
