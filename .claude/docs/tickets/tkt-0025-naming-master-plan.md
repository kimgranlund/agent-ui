---
doc-type: ticket
id: tkt-0025
status: open
date: 2026-07-12
owner:
kind: feature
size: big
---
# TKT-0025 — the web-component naming master plan: one grammar, per-namespace, gate-backed

## Summary
Kim's ask (2026-07-12, the naming exploration): consolidate the repo's scattered-but-strong naming
law into ONE designed system — a grammar per NAMESPACE (element tags · classes · props/attributes ·
events · control-tier CSS tokens · system-tier tokens · data-part/data-role · custom states · A2UI
catalog types · packages/subpaths · doc IDs), with the principles the fleet already demonstrably
operates on made explicit: one-name-one-meaning (the reserved-word law — `size`), closed
vocabularies with an ADR-gated admission path, prefix-as-ownership-boundary (ADR-0081/0124),
names-as-machine-readable-API, grep-ability over brevity (the `^ui-` palette ruling).

## Acceptance
- The exception-count INVENTORY first (the agreed step 1): per-namespace tables of observed
  practice with every deviation counted — sized evidence before any rule is argued.
- `references/naming.md` beside geometry.md/anatomy.md: per-namespace grammar, reserved words,
  admission paths, and the worked example — deriving a new family's ENTIRE name set (tag, class,
  tokens, parts, states, catalog type, folder, descriptor) from the one family-name decision.
- The gate gaps closed: a descriptor↔DOM `parts[]` truthfulness gate (the exact hole the
  color-picker review's L2 exposed), a custom-state vocabulary check, an event-name allowlist
  assertion at the emit seam.
- The five-question decision rubric for new names (namespace? reserved collision? closed-set
  admission → ADR? prefix = ownership? derivable from the family name?) folded into the
  agent-ui-component-design intake so naming stops being re-litigated per component.
- The ONE open taste fork brought to Kim with migration cost sized, not argued abstractly: the
  two token dialects (`--ui-*` control-tier vs `--md-sys-*` system-tier) — permanent two-tier vs
  convergence.
- Migration policy: fix-on-touch with a recorded exceptions list (the DISPOSITION_ALLOWLIST
  shape); the gates strict for NEW names from day one.

## Links
- The exploration record (this conversation, 2026-07-12) · `references/{geometry,anatomy,tokens}.md`
  · ADR-0078 (token naming) · ADR-0081/0124 (the family-root prefix law) · ADR-0032/0041 (the
  reserved `size`) · the family-coherence A2/A2b gates · `packages/agent-ui/a2ui/src/catalog/naming.test.ts`
  (the catalog namespace's existing gate) · `agent-ui-doc-standards` (the doc-ID namespace, done).
- `.claude/docs/reports/repo-alignment-2026-07-12/follow-up-queue.md` Q2 (the queue entry).

## Scope / Open
- Whether `references/naming.md` subsumes the naming slices currently living inside
  geometry/anatomy/tokens or only cross-references them (one-fact-one-home decides at authoring).
- **Non-goals:** renaming shipped surfaces (fix-on-touch only); the doc-ID namespace (codified in
  agent-ui-doc-standards at the repo-alignment).

## Findings
