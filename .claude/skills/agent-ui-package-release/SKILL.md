---
name: agent-ui-package-release
description: >-
  Route to THIS repo's npm-package release/versioning law for the 8 @agent-ui/* packages (published
  unscoped as agent-ui-*, under the agent-ui-kit npm account): lockstep versioning (all 8 always
  publish at the SAME number, every release), a patch-only 0.0.1-0.0.99 phase for routine releases,
  and a judgment-gated 0.#.0 bump reserved for a more significant release — plus the actual cut-a-
  release procedure (decide the version per the law, tag vX.Y.Z, push — the tag itself triggers
  .github/workflows/publish.yml, no manual npm publish). Use for "release a package update", "cut a
  release", "bump the package version", "publish a new agent-ui version", "what version should this
  be", or before pushing any vX.Y.Z tag. NOT for building or modifying the publish pipeline itself
  (scripts/publish/publish-packages.mjs · tsconfig.build.json · the workflow YAML — already-built
  infra, edit directly, no routing needed) or general third-party dependency management.
disable-model-invocation: false
user-invocable: false
---

# agent-ui package release — versioning law & the release procedure

Ratified 2026-07-19, the same session the publish pipeline itself shipped
(`scripts/publish/publish-packages.mjs` · `tsconfig.build.json` · `.github/workflows/publish.yml` ·
commit `fd0b0b7`). This file is the versioning LAW; the pipeline files are the mechanism — cite them,
never restate their internals here.

## The versioning law

- **Lockstep, always.** All 8 packages — `shared`, `icons`, `a2a`, `components`, `router`, `code`,
  `a2ui`, `app` — publish at the exact SAME version number on every release. Never a partial bump of
  one package alone; the publish script already enforces this mechanically (one `<version>` argument
  drives all 8), but the DECISION of what that version is follows this law too.
- **Patch-only phase.** Routine releases increment the patch digit: `0.0.1` → `0.0.2` → … → `0.0.99`.
  "Routine" = bug fixes, small features, docs-adjacent changes, non-breaking additions — the default
  for most releases.
- **The `0.#.0` bump is judgment-gated, not counter-triggered.** The ONLY reason to bump the minor
  digit is that a release is *more significant* than the patch-phase default — e.g. a new package
  joins the fleet, a breaking API change ships, a major new capability lands. This is a call made at
  release time by whoever is cutting the release, not something derived from a rule. When asked
  "should this be a patch or a minor bump," weigh the release's actual content against that bar rather
  than defaulting to either.
- **`0.0.99` is a sanity ceiling, not an auto-trigger.** Reaching it would mean 99 consecutive patch
  releases without ONE significant one — in practice this won't happen; if it ever legitimately did,
  that volume is itself a signal the next release is significant, not a mechanical rollover.
  Convention doesn't hard-stop at 99: don't build tooling that refuses a hypothetical `0.0.100`. It's
  a documented expectation, not a hard boundary this skill was asked to enforce.
- **The same law recurses above `0.1.0`.** `0.1.0` → `0.1.1` → … → `0.1.99` (patch-only) → `0.2.0` on
  the next significant release, and so on.
- **First real release is `v0.0.1`.** No tag exists yet as of this writing — the very first `v*` tag
  pushed for this pipeline should be `v0.0.1`, not `v0.1.0` or `v1.0.0`.

## The release procedure

1. **Decide the version** per the law above — ask "is this routine, or significant enough to earn a
   minor bump?" before picking the number.
2. **Confirm the standing gate is green on `main`** (`npm run check && npm test`) — the workflow
   re-gates this itself before publishing, but don't push a tag expecting it to fail.
3. **Tag and push**: `git tag vX.Y.Z && git push origin vX.Y.Z`. Pushing the tag IS what triggers the
   real, non-dry-run publish (`.github/workflows/publish.yml`'s `push: tags: v*` trigger) — there is no
   separate manual `npm publish` step. The workflow gates, resolves the version from the tag name, and
   runs `scripts/publish/publish-packages.mjs`, which builds, transforms, and publishes all 8 packages
   in lockstep at that version.
4. **Dry-run first when unsure** — either the workflow's own `workflow_dispatch` (Actions tab, defaults
   to dry-run) or locally: `node scripts/publish/publish-packages.mjs <version> --dry-run`.
5. **A failed run mid-fleet is resumable, not stranded.** If a publish dies partway through the 8, just
   re-run at the SAME version (`workflow_dispatch` with `dry_run: false`, or the local command again) —
   `publish-packages.mjs` skips any package already live at that version instead of erroring, so it
   picks up exactly where it left off rather than E403-failing on package 1.

## Facts worth knowing (don't re-derive these)

- Published package names are UNSCOPED (`agent-ui-shared`, `agent-ui-components`, …) under the
  `agent-ui-kit` npm account — npm requires a scope to literally match the owning org login, and this
  repo's internal `@agent-ui/*` names/imports stay completely untouched; the publish script transforms
  a COPY of each `package.json` at publish time only.
- License: MIT (`LICENSE` at repo root) — Kim's decision, 2026-07-19.
- `agent-ui-app` currently targets Vite/Rolldown-family bundlers only (`?url`/`?raw` import-query
  specifiers in `app-shell.ts`, documented in `publish-packages.mjs`'s own header — see there for the
  current count, which can drift as that file changes) — an accepted, deliberate consumer-profile
  constraint, not a defect to chase.
- npm version numbers are burned forever once published, even after unpublish — decide deliberately
  per step 1 above rather than tagging speculatively and fixing forward.

## NOT for

- Building or modifying the publish pipeline itself — `scripts/publish/publish-packages.mjs`,
  `tsconfig.build.json`, `.github/workflows/publish.yml` are already-built infra; edit them directly,
  no routing skill needed for that.
- General third-party dependency management (bumping `@codemirror/*`, security patches, etc.) —
  unrelated to this package's OWN release version.
- Site/docs-site releases — this law governs the npm package fleet only.
