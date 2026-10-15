# A1 Drill Report: Repository Survey

**Date:** 2026-09-20  
**Seat:** Conductor  
**Status:** ✅ Survey complete, ready for verifier claim grading

## Progress

- ✅ Nine scouts dispatched in parallel and completed (languages, manifests, tests, ci, branches, harnesses, docs, authorship, hygiene)
- ✅ Survey document assembled at `.sdlc/survey.md` with 8 scout tables + claims-to-verify section
- ✅ 11 claims extracted for verifier grading (commands, counts, statements)
- ⏳ Verifier claim grading pending

## Findings

### Repository Composition

**Language distribution:** TypeScript and JavaScript dominate (8309 + 3964 = 12273 files, ~60% of tracked code). SVG assets large (9242 files, mostly icons/design system). Markdown documentation substantial (3899 files).

**Test coverage:** 3447 test files with Vitest runner. `npm test` command is the established entry point. Browser test suite (`npm run test:browser`) runs locally only per architecture decision, not in CI—a deliberate carve-out.

**Build & CI:** Vite MPA with dynamic plugin system (a2ui, a2a, devtools, dev-proxy). Deterministic six-shard browser test suite on local machines. CI enforces `npm run check` + `npm test` on all PRs; docs-only changes bypass `npm test` locally but remain gated in CI.

### Harness & Governance

**Standing governance:** CLAUDE.md (7.5 KB, 2026-08-30) is the active root instruction. Six agent .md files in `.claude/agents/` (2026-08-20 to 08-23). `.claude/docs/` is substantial (15 MB, newest activity Sep 5 in SPEC directory). No AGENTS.md, Cursor config, Copilot integration, or hooks.json found—integration is through plugin/skill activation only.

**Documentation maturity:** 357 decision records total (227 ADRs, 50 SPECs, 15 PRDs, 1 RDD, 65 LLDs). Newest updates Sep 5, 2026 (SPEC directory). A3 sized L due to volume.

### Authorship & Workflow

**Agent-first codebase:** 74% of recent commits (37 of 50) agent-authored; 26% human (13 of 50). Early work via Fable 5/5.1, later via Sonnet 5. Merge-to-squash ratio 28:72—most PR work lands via squash commits.

**Branch protection:** Single default branch (`main`). CI requires `check` + `test` on all PRs. No dismissal requests configured. Local-only `test:browser` gate is documented and enforced in CLAUDE.md.

### Hygiene & Secrets

**Clean state:** `.env` tracked and properly gitignored. No `.env.sample` or `.env.example` files needed. All `secret`/`password`/`key`/`token` matches are design-token artifacts (--ui-* color roles), not credentials. No large files >10MB outside ignored directories. Generated directories (node_modules 415M, dist 14M, .publish 10M, .vitest-attachments 2.6M, screenshots 296K) all properly gitignored.

## Next Steps

1. **Verifier:** Grade each claim row in `.sdlc/survey.md` "Claims to verify" table. Record verdict at `.sdlc/verdicts/survey.md`.
2. **Conductor:** Present A1 verdict to human for approval via `AskUserQuestion`.
3. **Orchestrator:** On approval, mobilize A2-A7 per gate order (A2 & A3 & A4 parallel after A1).

## Risks & Notes

- **A3 volume:** 357 records in `.claude/docs/` is large; A3 ingest-records step will process ~36 reader batches. Estimated L-grade work.
- **Ticket backend:** Not chosen yet; `.sdlc/config.json` will be set during A5 adapter phase.
- **Test command verification:** Claims C1 and C2 (check/test determinism on main) require baseline runs in A4.
