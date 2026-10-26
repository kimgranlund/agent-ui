---
name: package-release
description: >-
  THIS repo's npm release/versioning law for the 8 @agent-ui/* packages (published as @agent-ui-
  kit/*): lockstep versioning, the patch-only 0.0.1-0.0.99 phase, the judgment-gated 0.#.0 bump,
  and the cut-a-release procedure (push a vX.Y.Z tag; .github/workflows/release.yml publishes and
  creates the GitHub release, T-0465). Use for "release a package update", "cut a release", "bump the package version",
  "publish a new agent-ui version", "what version should this be", or before pushing any vX.Y.Z
  tag. NOT for the publish pipeline itself (already-built infra, edit directly) or general third-
  party dependency management.
disable-model-invocation: false
user-invocable: true
---

# agent-ui package release — versioning law & the release procedure

Ratified 2026-07-19, the same session the publish pipeline itself shipped
(`scripts/publish/publish-packages.mjs` · `tsconfig.build.json` ·
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
- **A package's first-ever publish needs interactive/user auth, not CI** (a CI automation token only
  works from the second version of an already-existing package onward) — the unscoped `agent-ui-*`
  launch names are permanently retired (fully unpublished, never republish to them). Full history:
  `references/release-facts.md`.

## The release procedure

1. **Decide the version** per the law above — ask "is this routine, or significant enough to earn a
   minor bump?" before picking the number.
2. **Confirm the standing gate is green on `main`** (`npm run check && npm test`) — nothing re-gates
   it for you now, so run it before publishing.
3. **Write the notes, then tag and push the tag**: commit `.github/release-notes/vX.Y.Z.md` (optional;
   without it the release gets GitHub's generated notes), then `git tag vX.Y.Z` on `main` and
   `git push origin vX.Y.Z`. The tag push runs `.github/workflows/release.yml` (T-0465): it refuses a tag
   that is not a strict `vX.Y.Z`, runs `npm run publish:packages -- X.Y.Z`
   (`scripts/publish/publish-packages.mjs`, which builds, transforms, and publishes all 8 packages in
   lockstep) through npm trusted publishing (GitHub OIDC, no npm token anywhere; the trusted publisher fields are in the
   workflow header, T-0466), then creates the GitHub release for the tag.
   **An ENEEDAUTH in the publish step means npm's OIDC exchange was refused** (T-0471, run 40341014351 on
   v0.2.0). npm hides the reason at the default log level, so the step runs at `verbose`: read the line
   `npm verbose oidc Failed token exchange request with body message: ...` in the job log, or the
   `npm-logs` artifact. Then check each package's trusted publisher on npmjs.com against the workflow
   header: owner `kimgranlund` (GitHub, not the npm user), repository `agent-ui`, workflow filename
   `release.yml`, environment empty, and the "npm publish" allowed action ticked (entries made after
   2026-09-03 allow only `npm stage publish` by default). Once fixed, re-run the failed job; a re-run uses
   the workflow file as it was at the tagged commit, so a tag cut before T-0471 (v0.2.0) re-runs without
   the `verbose` step and the `npm-logs` artifact.
   A prerelease tag is refused (the script publishes without `--tag`, so it would become `latest`).
4. **Dry-run first when unsure**: `npm run publish:packages -- <version> --dry-run` locally.
5. **A failed run mid-fleet is resumable, not stranded.** If a publish dies partway through the 8, re-run
   the failed workflow job (or the same command locally) at the SAME version;
   `publish-packages.mjs` skips any package already live at that version instead of erroring, so it
   picks up exactly where it left off rather than E403-failing on package 1.

**Done when** all 8 packages report live at the chosen version (each
`npm view @agent-ui-kit/<pkg>@<version>` resolves) — a partial fleet is not done, re-run step 5.

## Facts worth knowing (don't re-derive these)

Scoped names, the package-page content transform, the CDN-recipe contracts, license, the app package's
Vite-only-consumer history, the a2ui `./agent` publish exclusion, and how to add a package to the
family: `references/release-facts.md`.

## NOT for

- Building or modifying the publish pipeline itself — `scripts/publish/publish-packages.mjs`
  and `tsconfig.build.json` are already-built infra; edit them directly,
  no routing skill needed for that.
- General third-party dependency management (bumping `@codemirror/*`, security patches, etc.) —
  unrelated to this package's OWN release version.
- Site/docs-site releases — this law governs the npm package fleet only.
