# Live round: 2026-10-17-t0329-mix

Archived by `scripts/e2e-admin/probe/run-capped.ts` (T-0241). Regenerated with the archive; do not edit by hand.

## The round

- Runs: 31 (25 pass, 6 fail, 0 no report)
- Agents: croupier
- Models: claude-haiku-5-5
- Scenarios: t0329-mix-1, t0329-mix-10, t0329-mix-11, t0329-mix-12, t0329-mix-13, t0329-mix-14, t0329-mix-15, t0329-mix-16, t0329-mix-17, t0329-mix-18, t0329-mix-19, t0329-mix-2, t0329-mix-20, t0329-mix-21, t0329-mix-22, t0329-mix-23, t0329-mix-24, t0329-mix-25, t0329-mix-26, t0329-mix-27, t0329-mix-28, t0329-mix-29, t0329-mix-3, t0329-mix-30, t0329-mix-4, t0329-mix-5, t0329-mix-6, t0329-mix-7, t0329-mix-8, t0329-mix-9, t0329-mix-pontoon
- Commit: `cedf7c8d1731f90b5d56f08b6383c40e47d7f0bc`
- Cap: $2.5; stopped: done
- Window: 2026-10-17T14:22:09.276Z to 2026-10-17T15:21:20.376Z
- Totals: 81 trace lines, estimated $0.13

## Files

- `README.md`: This entry file. Written by `run-capped.ts` (with the archive, or `--describe <round dir>` for a folder backfilled by hand); regenerate it rather than editing it.
- `ledger.jsonl`: One JSON row per run: `name`, `scenario`, `agent`, `model`, `startedAt`, `endedAt`, `exitCode`, `verdict` (null when the probe wrote no report), `runId` (T-0259, live runs: the id the probe sent as `x-a2ui-run-id`, also in `report.json` and on each of the run's trace lines; `traces` are matched on it, else on the run's time window), `traces` (1-based inclusive line ranges into `traces/<day>.jsonl`), `tokens`, `costUsd` (estimated at the `PRICES` table). Written by `scripts/e2e-admin/probe/run-capped.ts` at commit `cedf7c8d1731f90b5d56f08b6383c40e47d7f0bc` from the runner's own timings and the trace lines. Read: `jq -c '{name, verdict, costUsd, traces}' ledger.jsonl`; a run's turns: `sed -n '<from>,<to>p' traces/<day>.jsonl`.
- `round.json`: The round manifest: commit, live-commands file, cap, `stop` (done, cap or crash), the trace window, the price table and its source, totals. Written by `scripts/e2e-admin/probe/run-capped.ts` at commit `cedf7c8d1731f90b5d56f08b6383c40e47d7f0bc` after every run and at the end. Read: `jq '{commit, cap, stop, window, totals}' round.json`.
- `runs/.capped-start`: The round start (ISO), written once by `run-capped.ts` so a restart keeps the same spend baseline and trace window.
- `traces/2026-10-17.jsonl`: Dev proxy trace lines (T-0151), one redacted JSON line per agent turn: `at`, `agent`, `model`, `user`, `outcome`, `steps`, `usage`; copied by `scripts/e2e-admin/probe/run-capped.ts` at commit `cedf7c8d1731f90b5d56f08b6383c40e47d7f0bc` from `.agent-traces/2026-10-17.jsonl`, only the lines inside the round window. Read: `jq -c '{at, agent, model, outcome, usage}' traces/2026-10-17.jsonl`; same shape as `npm run traces` reads.

## Runs

`runs/<name>/` holds one probe run, written by `npm run chat:probe` (`scripts/chat-probe.mjs`, `probe/run.ts`) at its `--out`:

- `report.json`: `verdict`, `checks[]` (`check`, `turn`, `status`, `detail`), `turns[]` (request, rounds, trace, prose, lint, screenshot), `agent`, `model`, `runId` (live runs, T-0259), `at`. Read: `jq -c '.checks[] | select(.status=="fail")' runs/<name>/report.json`.
- `fixture.json`: the recorded model answers of the run. Replay it keylessly: `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-17-t0329-mix/runs/<name>/fixture.json`.
- `turn-<n>.png`: the Test Chat screenshot after turn n. Not in this folder or in git (T-0256): it is in the local evidence cache, `$AGENT_UI_EVIDENCE_DIR (default `~/Library/Caches/agent-ui/evidence` on macOS, `${XDG_CACHE_HOME:-~/.cache}/agent-ui/evidence` elsewhere)/<round>/<run>/turn-<n>.png`, so present only on the machine that ran the round and possibly gone. Each `report.json` turn names its screenshot by absolute path.

| Run | Agent | Model | Verdict | Files |
| --- | --- | --- | --- | --- |
| `runs/t0329-mix-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-10/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-11/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-12/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-13/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-14/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-15/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-16/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-17/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-18/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-19/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-20/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-21/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-22/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-23/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-24/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-25/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-26/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-27/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-28/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-29/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-3/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-30/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-4/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-5/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-6/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/t0329-mix-7/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-8/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-9/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/t0329-mix-pontoon/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
