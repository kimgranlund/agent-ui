# Live round: composite-moment-checks

Backfilled by hand on 2026-10-15 (before T-0241): there is no `round.json` or `ledger.jsonl`, so the commit, cap and window were not recorded. Described by `run-capped.ts --describe`.

## The round

- Runs: 3 (0 pass, 3 fail, 0 no report)
- Agents: admiral, concierge, lexicographer
- Models: claude-haiku-5-5
- Scenarios: admiral-concede, concierge-spa-booking, lexicographer-six-guesses
- Report times: 2026-10-15T13:50:57.067Z to 2026-10-15T13:53:50.028Z

## Files

- `README.md`: This entry file. Written by `run-capped.ts` (with the archive, or `--describe <round dir>` for a folder backfilled by hand); regenerate it rather than editing it.
- `handoff.md`: The SDLC Lite ticket record for this round (`.sdlc/AGENTS.md`), not round output.
- `runs/.capped-start`: The round start (ISO), written once by `run-capped.ts` so a restart keeps the same spend baseline and trace window.
- `skips.md`: The SDLC Lite ticket record for this round (`.sdlc/AGENTS.md`), not round output.
- `traces/2026-10-15.jsonl`: Dev proxy trace lines (T-0151), one redacted JSON line per agent turn: `at`, `agent`, `model`, `user`, `outcome`, `steps`, `usage`; hand-copied by the conductor on 2026-10-15 from a worktree's `.agent-traces/` (rounds before T-0241). Read: `jq -c '{at, agent, model, outcome, usage}' traces/2026-10-15.jsonl`; same shape as `npm run traces` reads.

## Runs

`runs/<name>/` holds one probe run, written by `npm run chat:probe` (`scripts/chat-probe.mjs`, `probe/run.ts`) at its `--out`:

- `report.json`: `verdict`, `checks[]` (`check`, `turn`, `status`, `detail`), `turns[]` (request, rounds, trace, prose, lint, screenshot), `agent`, `model`, `at`. Read: `jq -c '.checks[] | select(.status=="fail")' runs/<name>/report.json`.
- `fixture.json`: the recorded model answers of the run. Replay it keylessly: `npm run chat:probe -- --replay .sdlc/composite-moment-checks/runs/<name>/fixture.json`.
- `turn-<n>.png`: the Test Chat screenshot after turn n; git-ignored (`runs/*/*.png`), so present only on the disk that ran the round.

| Run | Agent | Model | Verdict | Files |
| --- | --- | --- | --- | --- |
| `runs/admiral-concede-haiku-1/` | admiral | claude-haiku-5-5 | fail | `fixture.json` `report.json` `turn-1.png` `turn-2.png` `turn-3.png` `turn-4.png` |
| `runs/concierge-spa-booking-haiku-1/` | concierge | claude-haiku-5-5 | fail | `fixture.json` `report.json` `turn-1.png` `turn-2.png` `turn-3.png` `turn-4.png` |
| `runs/lexicographer-six-guesses-haiku-1/` | lexicographer | claude-haiku-5-5 | fail | `fixture.json` `report.json` `turn-1.png` `turn-2.png` `turn-3.png` `turn-4.png` `turn-5.png` `turn-6.png` |
