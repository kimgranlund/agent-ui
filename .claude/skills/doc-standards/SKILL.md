---
name: doc-standards
description: >-
  Route to THIS repo's design-doc + harness-metadata grammar: the per-type status dialects (ADR
  blockquote-table · ticket YAML · SPEC/LLD/PRD blockquote status lines), the exact status vocabulary
  and WHO may flip each, the ID spine (ADR-#### · SPEC-R# · LLD-C# · PRD-G#/D# · TKT-####) and
  supersession vocabulary, ticket-kind section contracts, the ADR log's own rules (NO index file in an
  ADR folder; what earns an ADR at all), the IDR intent tier (platform-global intent ONLY — feature
  WHY/WHAT lives in the owning PRD; PRDs are multi-granular), and which gates enforce what. Use for "what status vocabulary
  does a SPEC use", "who flips an ADR to accepted", "does this earn an ADR", "should I add a README/index
  to the ADR folder", "what sections does a bug ticket carry", "why is this shipped spec still proposed",
  "how do docs cite each other" — BEFORE authoring or judging any .claude/docs record. This repo's dialect DIVERGES from scribe's doc_lint (blockquote,
  not YAML; proposed/accepted, not draft/approved) — this skill is the local authority. NOT for the
  document types' generic contracts (docs:doc-writing-rules) or component-code law
  (component-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-ui doc & harness grammar

Codified 2026-07-12 (repo-alignment Phase 3) from observed practice across 126 ADRs · 25 SPECs ·
36 LLDs · 10 PRDs · 24 tickets. The gates in §5 enforce the deterministic slice; this skill owns
the judgment layer. One fact, one home: this file states rules; counts/history live in
`.claude/docs/reports/repo-alignment-2026-07-12/`.

**GH #925 note:** the full per-type dialects, ID spine, ticket-kind section contracts, ADR-log
rules, and gate mapping moved verbatim into `references/` below (body-size overhaul) — the §
numbers a citing ADR/SPEC/LLD/PRD already carries (`doc-standards §1`…`§6`) are preserved
unchanged inside the reference file that now holds that section; use the consult table to find
which file.

## Orientation — the three status dialects, one-liners

- **ADR** — blockquote TABLE, six fixed rows; vocabulary `proposed · accepted · superseded ·
  deprecated`. **Only Kim ratifies → accepted** (ADR-0149): an in-tree hand-edit, or a `ratify
  ADR-####` GitHub utterance executed by `scripts/adr_ratify.py`. The registered PreToolUse guard
  blocks every other agent flip to `accepted` unconditionally.
- **Ticket, current (ADR-0145)** — GitHub Issues, not files; `.claude/docs/tickets/` is a frozen
  historical archive. `status`/`kind`/`size` map onto native GitHub primitives (labels, close
  reason) — never a parallel taxonomy.
- **SPEC / LLD / PRD** — blockquote STATUS LINE; vocabulary `proposed · accepted · superseded`.
  PRDs flip at Kim's ratification; SPEC/LLD lag by design — "when it disagrees with the tree, the
  tree wins," so a `proposed` SPEC whose build shipped is normal and never sweep-flipped.
- **IDR (intent tier, `.claude/docs/idr/`)** — follows the ADR dialect exactly (blockquote table,
  Kim-only flips, append-only accepted bodies, no index file). **Platform-global intent ONLY**
  (Kim's 2026-08-18 tier ruling): a feature's WHY/WHAT lives in the owning app/family PRD, never
  in an IDR; the PRD tier itself is multi-granular (platform-area · app · family · feature, finer
  citing coarser). Full rule + hierarchy: `references/status-dialects.md` §1d.

This repo's dialect DIVERGES from scribe's doc_lint (blockquote, not YAML; proposed/accepted, not
draft/approved) — this skill is the local authority for that divergence, not a paraphrase of it.
ADR/PRD/SPEC/LLD and living-state docs (PLAN/ROADMAP) are explicitly **never** delegated to the
GitHub-Issue backend — they stay files on this map, always; only the TICKET tier moved (ADR-0145).

Accepted ADRs are append-only (extensions land as `## Amendment` sections or a new ADR, never an
edit to the accepted body — REV-annotated mechanical pointer repairs excepted); the ADR log itself
carries no index file (Kim's 2026-08-13 rule) — the numbered filename + each file's own frontmatter
status IS the index.

## Consult table

| File | Read when |
|---|---|
| `references/status-dialects.md` (§1 / §1c / §1d / §2) | flipping or reading an ADR · ticket · SPEC/LLD/PRD status — the per-type dialect table + the current GitHub-Issue ticket mapping; whether something earns an ADR at all; the IDR platform-intent-only rule + PRD granularity ladder (§1d, Kim 2026-08-18); why a shipped SPEC still reads `proposed` |
| `references/adr-log-mechanics.md` (§1b) | the ADR log's no-index / numbering / amendment-vs-supersession rules — Kim's 2026-08-13 no-README ruling |
| `references/id-spine-and-ticket-contracts.md` (§3 / §4) | citing an ID (`ADR-####` / `SPEC-R#` / `LLD-C#` / `PRD-G#`\|`D#` / `TKT-####`) or the supersession/extension vocabulary; a ticket or Issue's required sections by kind (feature vs bug) |
| `references/gates-and-citation-law.md` (§5 / §5b / §6) | which gate enforces what (`adr.test.ts`, `docs-grammar.test.ts`, the status-guard hook, `adr_ratify.py`); the cite-by-stable-anchor law (GH #757); the archive/historical-record rule |

NOT for the document types' generic contracts (`docs:doc-writing-rules`) or component-code law
(`component-standards`).
