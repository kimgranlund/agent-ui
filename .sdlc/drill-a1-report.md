# A1 Drill Report: Survey

**Date:** 2026-09-20  
**Conductor:** kim@sublimeheroics.com  
**Phase:** Adoption discovery (A1)

## Progress

✓ Nine scout agents dispatched in parallel for factual repo survey  
✓ All scouts completed: languages, manifests, tests, CI, branches, harnesses, docs, authorship, hygiene  
✓ `.sdlc/survey.md` assembled with all findings (one section per scout, claims table added)  
✓ Survey sent to verifier for claim grading  
⏳ Verifier working on `.sdlc/verdicts/survey.md`

## Findings

### Repo Scale & Composition
- Large polyglot codebase: 9,242 SVGs (fixtures/icons), 8,309 TypeScript, 3,970 JavaScript, 3,899 Markdown
- 3,656 test files using vitest (npm test runs `vitest run`)
- 10 npm workspaces under `packages/agent-ui/*` (components, app, a2ui, a2a, router, code, data, devtools, icons, shared)
- Zero dependency exceptions enforced (CodeMirror 6 and pdfjs-dist opt-in, lazy-loaded, never on default barrel)

### Testing & Gates
- Standing gate: `npm run check` (tsc, site, tools, scripts checks—all noEmit)
- Comprehensive test sharding: six vitest shards across packages, site, focus-timing, visual
- Catalog evaluation gate runs on every relevant change (`npm run test:eval-catalog`)
- Browser testing enforces real-engine gates (JSdom not sufficient for final verdict)

### Development Harness
- Rich CLAUDE.md (7.5K, updated 2026-08-30) documents KISS principles, standing convictions, and strict conventions
- `.claude/` directory tree: 12,282 files across agents (7), docs (731), skills (98), ops (107), worktrees (11,326 tracked)
- 227 ADRs in canonical home (`.claude/docs/adr/`); newest Aug 21 2026
- 585 additional design docs under `.claude/docs/`; newest Sep 5 2026
- No AGENTS.md, no hooks configured yet (adopt-repo A1 finding: ready for harness integration)

### Authorship & Merge Discipline
- All 50 recent commits authored by Kim Granlund
- Strong agent collaboration signal: 52% of commits carry `Co-Authored-By` trailers (Claude Fable 5 at 66%, Sonnet 5 at 28%)
- Merge discipline: 72% squash-to-main (GitHub-generated), 28% merge commits (intentional on select PRs)

### Repository Hygiene
- No tracked secrets, .env samples, or API keys
- Two large test fixtures intentionally committed (3.1 MB + 1.5 MB for component preview system); both marked since 2026-08-17
- No generated directories committed
- .env properly gitignored; working tree clean

### CI/CD & Deployment
- Six GitHub Actions workflows active: deploy-docs, consumer-smoke, publish, theme-provider-fixture-regen, claude-code-review, ci
- Primary trigger: pull request (opened, synchronize, ready_for_review, reopened) for main CI job
- Tag-based publish (v* pattern) and manual dispatch override available
- Deploy-docs on main push to ui.nonoun.io

### Branch & Protection Strategy
- Default branch: `main` (single remote branch on origin)
- Local branch prefix pattern: `sdlc/adopt` (adoption in progress)
- No explicit GitHub branch protection documented in README; local branch-reap operations active

## Readiness for Next Phases

| Area | Status | Notes |
|------|--------|-------|
| Manifest accuracy | Ready for verification | package.json scripts match CLAUDE.md documented commands |
| Test command fidelity | Ready for verification | vitest configured; six-shard gate structure documented |
| Build/dev tool verification | Ready for verification | vite and TypeScript tooling match manifest specs |
| Dependency clarity | Ready for verification | ADR-0139, ADR-0192, ADR-0202 ratify controlled exceptions |
| Hygiene gates | Ready for verification | Fixture files intentional; no drift detected |
| CI job mapping | Ready for verification | All six workflows match manifest trigger patterns |

## Blockers

None. Awaiting verifier verdict on 11 claims in `.sdlc/survey.md::Claims to verify`.

## Next Step

Once `.sdlc/verdicts/survey.md` is committed:
1. Commit `.sdlc/survey.md` (pins survey facts for drift detection)
2. Planner begins A2 (cartographer) and A3 (records) in parallel per adopt-repo gate order
3. Scouts begin A4 (baseline test/lint/build gate runs)
