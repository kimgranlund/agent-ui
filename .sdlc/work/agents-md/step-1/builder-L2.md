<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `AGENTS.md`: rewrote the part above the managed block as a 67-line router with these sections: identity, packages and DAG, where truth lives, never hand-edit, gates, hard conventions, process, landmines. The managed block is byte-identical.

## Checks
- The seven `grep -qF` criteria (`prompt-equivalence.baseline.json`, `live-agent/prompt-equivalence.baseline.json`, `generate-props.mjs`, `GH #1798`, `agent-model.md`, `seat-map`, `/__a2ui/agent`): all matched.
- awk line count before the managed marker: 67 (limit 80), passed.
- `! grep -q '—' AGENTS.md`: passed.
- Managed-block diff against `$SDLC_BASE_SHA`: no differences.
- `onboard.py check`: printed `current AGENTS.md`.
- Changed-files guard: 0 files other than `AGENTS.md`.
- `doc_lint.py AGENTS.md`: exit 0 ("not a functional document").
- `npm run check`: exit 0.

## Notes
- I checked that every cited path, skill and ADR exists with `ls` before writing: the layering tests, catalog dir, baseline json, `generate-props.mjs`, the four docs, `agent-model.md` section 2, `docs/AGENTS.md`, skills `seat-map`, `due-process` and `a2ui-prompt-authoring`, and ADR-0073, 0139, 0145 and 0202.
- `doc_lint.py` has no `--help` flag; passing `--help` made it treat the flag as a file path and crash. I then ran it on `AGENTS.md` directly.
