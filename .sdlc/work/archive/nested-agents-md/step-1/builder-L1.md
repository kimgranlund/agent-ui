<!-- role=builder level=L1 model=sonnet effort=low -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/AGENTS.md`: new, 38 lines.
- `packages/agent-ui/components/AGENTS.md`: new, 35 lines.
- `packages/agent-ui/a2ui/CLAUDE.md`: copy of `docs/CLAUDE.md`.
- `packages/agent-ui/components/CLAUDE.md`: copy of `docs/CLAUDE.md`.

## Checks
- Criteria 1, 2: passed (both files exist and the `CLAUDE.md` copies are byte-identical; line counts are 38 and 35; no em dash).
- Criteria 3, 4, 5, 6, 7, 8, 9: passed.
- Criterion 3 first ran under zsh, which hit a quoting error. I re-ran it under bash and it passed. Criteria 5 to 9 were also run under bash.
- Guard on changed files: passed (only the four allowed paths changed outside `.sdlc`).
- Guard `onboard.py check`: the output contains the line `current AGENTS.md`. It also prints a size note about the root `CLAUDE.md` being over 60 lines. The step did not touch that file.
- Guard `npm run check`: exit 0.

## Notes
- Every cited path, ADR and skill resolved; no unverified items.
- Follow-up: add the selection-sidecar line after #1800 merges.
