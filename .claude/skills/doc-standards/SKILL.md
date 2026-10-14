---
name: doc-standards
description: >-
  THIS repo's design-doc + harness-metadata grammar: per-type status dialects, the status
  vocabulary and WHO may flip each, the ID spine, ticket-kind section contracts, the frozen ADR
  log, the IDR intent tier, and which gates enforce what. Diverges from scribe's doc_lint —
  local authority. Use for "what status vocabulary does a SPEC use", "where does a decision go
  now that ADRs are retired", "should I add a README/index to the ADR folder", "what
  sections does a bug ticket carry", "why is this shipped spec still proposed", "how do docs cite
  each other". NOT for the generic type contracts, owned by the docs plugin's doc-writing-rules
  skill (not loaded in this repo since PR #1791), or component-code law (component-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-ui doc & harness grammar

**The ADR system is retired (Kim, 2026-10-14, T-0164).** `.claude/docs/adr/` is frozen history:
existing ADRs stay citable by `ADR-####` and clause, and nothing is added to the folder or changed in
it (no files, sections, or status flips). A decision is recorded in the ticket that makes it; a
standing rule lands in the reference doc (`.claude/docs/references/`) or skill that owns the area.
The ADR sections below describe the frozen set so a reader can still parse it.

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

- **ADR (frozen)**: blockquote TABLE, six fixed rows; vocabulary `proposed · accepted ·
  superseded · deprecated`. The Status cells are history: no cell is flipped any more, and an
  amendment still marked `proposed` at the freeze stays as written (`references/adr-log-mechanics.md`
  lists each one and where its live rule now sits). `scripts/adr_ratify.py` is retired with the
  system; its selftest still runs in `check:scripts`.
- **Ticket, current (ADR-0145)** — GitHub Issues, not files; `.claude/docs/tickets/` is a frozen
  historical archive. `status`/`kind`/`size` map onto native GitHub primitives (labels, close
  reason) — never a parallel taxonomy.
- **SPEC / LLD / PRD** — blockquote STATUS LINE; vocabulary `proposed · accepted · superseded`.
  PRDs flip when Kim accepts them; SPEC/LLD lag by design — "when it disagrees with the tree, the
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

The frozen ADR log carries no index file (Kim's 2026-08-13 rule): the numbered filename and each
file's own H1 are the index, and `generate-sitemap.mjs` still builds `adr-index.json` from them. A
stale ADR clause is not repaired in the ADR; the owning reference doc states the current rule.

## Consult table

| File | Read when |
|---|---|
| `references/status-dialects.md` (§1 / §1c / §1d / §2) | reading a frozen ADR's status · flipping a ticket · SPEC/LLD/PRD status — the per-type dialect table + the current GitHub-Issue ticket mapping; where a decision is recorded now; the IDR platform-intent-only rule + PRD granularity ladder (§1d, Kim 2026-08-18); why a shipped SPEC still reads `proposed` |
| `references/adr-log-mechanics.md` (§1b) | the frozen ADR log: no-index rule (Kim's 2026-08-13 no-README ruling), numbering history, the amendments left unflipped at the freeze and where each live rule sits |
| `references/id-spine-and-ticket-contracts.md` (§3 / §4) | citing an ID (`ADR-####` / `SPEC-R#` / `LLD-C#` / `PRD-G#`\|`D#` / `TKT-####`) or the supersession/extension vocabulary; a ticket or Issue's required sections by kind (feature vs bug) |
| `references/gates-and-citation-law.md` (§5 / §5b / §6) | which gate enforces what (`adr.test.ts`, `docs-grammar.test.ts`, the retired status-guard hook and `adr_ratify.py`); the cite-by-stable-anchor law (GH #757); the archive/historical-record rule |

NOT for the document types' generic contracts, owned by the docs plugin's doc-writing-rules skill
(not loaded in this repo since PR #1791), or component-code law (`component-standards`).
