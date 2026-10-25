---
id: T-0465
title: "Pushing a v* tag publishes the eight packages to npm and creates the GitHub release from GitHub Actions"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Pushing a `vX.Y.Z` tag runs a GitHub Actions workflow that publishes the eight packages to npm at that version and creates the GitHub release, so a release is one tag push (Kim 2026-10-25: "publish via git actions and tagging").

## Context
No release workflow exists: `.github/workflows/` holds `ci.yml` and the manual `deploy-docs.yml`, whose header records Kim's 2026-10-15 rule that GitHub runs only ci.yml automatically (T-0255); this ticket is Kim's ruling that a tag push now also runs. The publish path is `npm run publish:packages -- <version>` (`scripts/publish/publish-packages.mjs`, re-runnable, skips live packages). Repo secret `NPM_TOKEN` exists. T-0460 prepared 0.2.0 and drafted the release body at `.sdlc/runtime/tasks/0460-release-0-2-0/release-notes-0.2.0.md` (git-ignored, so the workflow cannot read it from there). Skill `package-release` owns the procedure.

## Constraints
Trigger only on `push: tags: ['v*.*.*']`. Least-privilege permissions. Read the version from the tag; refuse a tag that does not match semver. Use npm provenance if the script and registry allow it, else say why not. The workflow never pushes commits. Update every record the change invalidates in the same change: the deploy-docs.yml header line, the package-release skill, `.claude/docs/references/commands.md` and any process doc that says only ci.yml runs automatically. No em dashes.

## Done when
- `.github/workflows/release.yml` exists, passes `actionlint` if installed (else a YAML parse plus a stated manual review), and its publish step runs `npm run publish:packages -- <version>` with the npm token from `NPM_TOKEN`.
- A GitHub release is created for the tag, with a committed notes file for 0.2.0 if one is needed.
- A dry exercise of the version-from-tag logic (a local script or the workflow's own shell extracted) proves a good tag passes and a bad one fails.
- `npm run check` passes, and the touched docs pass doc_lint.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release.yml'))"` exits 0 (actionlint is not installed), and a manual review finds the trigger is only `push: tags: ['v*.*.*']`, the publish job holds only `contents: read` plus `id-token: write`, the release job only `contents: write`, and no step pushes commits.
- `grep -qF 'npm run publish:packages -- ${{ steps.version.outputs.version }}' .github/workflows/release.yml` exits 0, and the publish step's env sets `NODE_AUTH_TOKEN` from `secrets.NPM_TOKEN` and `NPM_CONFIG_PROVENANCE`.
- `python3 .sdlc/runtime/tasks/0465-release-workflow/tagcheck.py` exits 0: the workflow's own version step, extracted from the YAML, passes `v0.2.0` and `v10.20.30` and refuses `v1.2`, `v01.2.3`, `1.2.3`, `v1.2.3-rc.1`, `v1.2.3.4` and a branch ref.
- `test -f .github/release-notes/v0.2.0.md` exits 0, and the release job uses it as `--notes-file` for its tag, else `--generate-notes`.
- `npm run check` exits 0.
- No touched record still says GitHub runs only ci.yml automatically or that no workflow publishes: deploy-docs.yml header, skill package-release, commands.md, CHANGELOG.md, publish-packages.mjs usage comment.

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 6053aa6d0d3c
- Changed: Pushing a vX.Y.Z tag publishes the eight packages to npm and creates the GitHub release from GitHub Actions
- Commits: none
- Check: 1 YAML parse and manual review: pass
- Check: 2 publish command and env: pass
- Check: 3 tagcheck: pass
- Check: 4 release notes: pass
- Check: 5 npm run check: pass
- Check: 6 stale records repaired: pass
- Follow-up: note: .sdlc/notes/notes.md:71 still says "GitHub runs only ci.yml"... -> notes.md
- Follow-up: note: .github/workflows/deploy-docs.yml:2-3 the new header line runs long... -> notes.md
- Follow-up: note: tagcheck.py hardcodes the absolute worktree path to release.yml, so... -> notes.md
