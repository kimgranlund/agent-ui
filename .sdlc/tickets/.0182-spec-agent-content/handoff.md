---
id: T-0182
title: "SPEC: agent content model (kinds, files and registry, overlays and merge, schema forms, one compiler with digests) + agent-model spec and PRD amendments"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The agent content model Kim approved 2026-10-14 (registries and manifests, usable from Builder, CLI, Test Chat and the settings pane) has a contract before T-0160..T-0163 build it: new `.claude/docs/spec/agent-content.spec.md` (SPEC v0.1 proposed), plus amendments to the docs it changes.

## Intent
- Do:
  1. Read first: tickets T-0160..T-0163, `spec/agent-model.spec.md` (SPEC-R5 seed sweep, §3.5 compile, §3.8 persistence, §8 drift list), `references/agent-model.md`, `prd/agent-admin-app.prd.md`, `spec/persona-catalog-composition.spec.md` (manifest digests), `site/lib/agent-manifest/`, `site/pages/agent-admin-presets.ts`, `agent-admin-libraries.ts`, `packages/agent-ui/app/src/controls/agent-admin/` (schema, persona-patch, stores), doc-standards.
  2. New SPEC covers: content kinds (persona, skill, workflow, resource, tool, pack, team); file layout and frontmatter (Agent Skills format for skills; persona as a manifest of id@version refs; packs as refs); registry generation, digests, drift gate; seed vs overlay vs resolved view; overlay ops, 3-way merge on seed update, conflicts, reset, provenance; one write path per kind (teams included); schema-generated settings forms and the Builder patch ops validated by the same schema; one compiler (Test Chat, proxy, Worker, CLI) with resolution trace and bundle digest in every turn trace; zero-dependency constraint; authoring `AGENTS.md` in the content root is context, never runtime. All requirements marked planned with their ticket.
  3. Amend `spec/agent-model.spec.md`: SPEC-R5 and its ACs (sweep on bump becomes overlay merge, planned T-0161), §3.5 compile (planned T-0163), §3.8 tiers, §8 drift list; point to the new SPEC. Note the T-0180 model-id migration (`RETIRED_MODEL_IDS`) once merged, else as planned.
  4. Amend `prd/agent-admin-app.prd.md`: goals for editable content with provenance and reset, and for trace and eval observability (link T-0181).
  5. Update `references/agent-model.md` glossary (preset discriminator, seed home moving to frontmatter, bundle digest).
  6. Decisions cite tickets, never new ADR clauses.
- Done when: doc_lint exit 0 on new and touched docs; `npm run check` exit 0; generated indexes regenerated if any, their tests exit 0.

## Context
- Spec audit 2026-10-14. T-0160 should start after this lands. Commit off origin/main, never push. Docs-only gate.

## Constraints
- No em dashes. Status flips are Kim's.

## Closed

2026-10-14: merged as PR #1978
