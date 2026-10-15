<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Add nested AGENTS.md for the a2ui and components packages

## PR body
### Summary
Adds orientation files for an agent working inside `packages/agent-ui/a2ui/` and `packages/agent-ui/components/`. They hold only what is local to each package and link to the root `AGENTS.md` and `CLAUDE.md` for the package DAG, gates and conventions. Docs only.

### Changes
- `packages/agent-ui/a2ui/AGENTS.md` (38 lines) covers:
  - the byte-pinned prompt stack, the golden baseline and the recapture command;
  - the catalog paths, with content hand-curated under ADR-0173 cl.5 and the agreement gate;
  - the trust boundary (`/__a2ui/agent`, ADR-0073, ADR-0200) and the `NODE_ALLOWED` fence (ADR-0137);
  - the wire and validator spine pointers;
  - the five a2ui skills.
- `packages/agent-ui/components/AGENTS.md` (35 lines) covers:
  - layer order, `src/layering.test.ts` and the ban on importing `@agent-ui/a2ui`;
  - the control folder and descriptor layout, and the generated `*.props.gen.ts` files with their regeneration command and drift gate `props-gen-driftwire.test.ts`;
  - naming;
  - the fill-by-default sizing law with the `inline` opt-out, and light DOM with ARIA via `ElementInternals`;
  - the five component skills.
- `packages/agent-ui/a2ui/CLAUDE.md` and `packages/agent-ui/components/CLAUDE.md` are byte copies of `docs/CLAUDE.md`, which wraps `@AGENTS.md`.

The root `AGENTS.md` and `CLAUDE.md`, the managed block and `.sdlc/` are untouched.

### Verification
The verifier passed all 12 criteria. It ran each one on the built tree and showed the checks fail on a base worktree and on planted defects.
- **File shape:** both `AGENTS.md` files are at most 40 lines, contain no em dash, and both `CLAUDE.md` files match `docs/CLAUDE.md` byte for byte.
- **Citations:** every code-span path resolves and every cited ADR exists. The recapture command, the five a2ui skills and the five component skills are all present.
- **Exclusions:** there is no selection-sidecar text, and only the four allowed paths changed.
- **`onboard.py check`:** it still prints `current AGENTS.md` for the root file. It also prints a size note that the root `CLAUDE.md` is over the 60-line target. This diff does not touch that file.
- **`npm run check`:** exit 0 in 28.6 s.

The builder reported that every cited path, ADR and skill resolved, so nothing was left unverified.

## Changelog entry
Added nested `AGENTS.md` files, each with a `CLAUDE.md` sibling, for `@agent-ui/a2ui` and `@agent-ui/components`. They orient agents working inside those packages.

## Follow-ups
- fix-now: add the selection-sidecar line to `packages/agent-ui/a2ui/AGENTS.md` after PR #1800 merges.
