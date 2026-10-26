---
id: T-0466
title: "The release workflow publishes through npm trusted publishing, with no npm token"
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
`.github/workflows/release.yml` publishes the eight packages through npm trusted publishing (GitHub OIDC), with no `NPM_TOKEN`, so the next run of a `vX.Y.Z` tag succeeds once Kim registers the trusted publisher on npmjs.com.

## Context
The first v0.2.0 run (Actions run 40270993010) failed at the first publish: `npm error 404 Not Found - PUT https://registry.npmjs.org/@agent-ui-kit%2fshared`, after the provenance statement was signed, so the `NPM_TOKEN` secret has no publish right on the scope. Nothing was published (npm still shows 0.1.0). Kim ruled 2026-10-25: switch to trusted publishing. Trusted publishing needs `id-token: write` (already set), an npm CLI new enough for OIDC publish (check what Node 24 on ubuntu-latest ships and pin or upgrade npm if it is too old), and no token in the environment, since a set but invalid token can win over OIDC. Provenance is automatic under trusted publishing.

## Constraints
No token anywhere in the publish job. Keep the semver tag check, the never-cancel concurrency and the release job. Update every record that names `NPM_TOKEN` for publishing (the release.yml header, the package-release skill, `.claude/docs/references/commands.md`) and list the exact npmjs.com trusted-publisher fields Kim must enter per package (org or user, repository, workflow filename, environment). No em dashes.

## Done when
- release.yml publishes with no `NODE_AUTH_TOKEN` or `NPM_TOKEN`, and states the npm CLI version requirement it meets.
- The records above no longer tell anyone to set `NPM_TOKEN` for publishing.
- The report lists the trusted-publisher fields for each of the eight packages.
- A YAML parse of release.yml passes, and `npm run check` passes.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: 71190f9330af
- Changed: The release workflow publishes through npm trusted publishing with no npm token
- Commits: none
- Check: 1 release.yml publishes with no NODE_AUTH_TOKEN or NPM_TOKEN, and states the npm CLI version requir...: pass
- Check: 2 The records no longer tell anyone to set NPM_TOKEN for publishing: pass
- Check: 3 The report lists the trusted-publisher fields for each of the eight packages: pass
- Check: 4 A YAML parse of release.yml passes, and npm run check passes: pass
- Follow-up: note: the npm floor step was only logic-tested by the builder; it first... -> notes.md
