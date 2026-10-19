# Live round: 2026-10-19-r12-targeted

Archived by `scripts/e2e-admin/probe/run-capped.ts` (T-0241). Regenerated with the archive; do not edit by hand.

## The round

- Runs: 45 (39 pass, 6 fail, 0 no report)
- Agents: croupier, mentalist, negotiator, stylist
- Models: claude-haiku-5-5
- Scenarios: long-croupier-blackjack-hand, regress-croupier-blackjack-moves, regress-croupier-blackjack-rounds, regress-croupier-five-card-draw, regress-croupier-omaha, regress-croupier-pontoon, regress-croupier-seven-card-stud, regress-croupier-spanish-21, regress-croupier-texas-holdem, routing-domain-switch, routing-guidance-conflict, smoke-croupier-blackjack-deal, smoke-mentalist-first-answer, smoke-negotiator-first-offer, smoke-stylist-palette
- Commit: `76aa91fb105f5a125777203fa54e235249664ecc`
- Cap: $12; stopped: done
- Window: 2026-10-19T00:50:50.031Z to 2026-10-19T01:52:57.561Z
- Totals: 296 trace lines, estimated $1.15

## Context fog-of-war

- Report: `6bae5f5b20e6a9741951dd4a` in the context-fog-of-war user library (`library.py list`); 954 events, 299 sources, 6 findings.
- Ingested as a session bundle with `.sdlc/evals/fog-manifest.json` (mapping hash `1999c4dd1cdc`); the record is `.sdlc/evals/fog/2026-10-19-r12-targeted.json` (T-0376).

## Files

- `README.md`: This entry file. Written by `run-capped.ts` (with the archive, or `--describe <round dir>` for a folder backfilled by hand); regenerate it rather than editing it.
- `judged/long-croupier-blackjack-hand-haiku-1.json`: Not described by run-capped.ts.
- `judged/long-croupier-blackjack-hand-haiku-2.json`: Not described by run-capped.ts.
- `judged/long-croupier-blackjack-hand-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-moves-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-moves-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-moves-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-rounds-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-rounds-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-blackjack-rounds-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-five-card-draw-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-five-card-draw-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-five-card-draw-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-omaha-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-omaha-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-omaha-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-pontoon-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-pontoon-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-pontoon-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-seven-card-stud-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-seven-card-stud-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-seven-card-stud-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-spanish-21-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-spanish-21-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-spanish-21-haiku-3.json`: Not described by run-capped.ts.
- `judged/regress-croupier-texas-holdem-haiku-1.json`: Not described by run-capped.ts.
- `judged/regress-croupier-texas-holdem-haiku-2.json`: Not described by run-capped.ts.
- `judged/regress-croupier-texas-holdem-haiku-3.json`: Not described by run-capped.ts.
- `judged/routing-domain-switch-haiku-1.json`: Not described by run-capped.ts.
- `judged/routing-domain-switch-haiku-2.json`: Not described by run-capped.ts.
- `judged/routing-domain-switch-haiku-3.json`: Not described by run-capped.ts.
- `judged/routing-guidance-conflict-haiku-1.json`: Not described by run-capped.ts.
- `judged/routing-guidance-conflict-haiku-2.json`: Not described by run-capped.ts.
- `judged/routing-guidance-conflict-haiku-3.json`: Not described by run-capped.ts.
- `judged/smoke-croupier-blackjack-deal-haiku-1.json`: Not described by run-capped.ts.
- `judged/smoke-croupier-blackjack-deal-haiku-2.json`: Not described by run-capped.ts.
- `judged/smoke-croupier-blackjack-deal-haiku-3.json`: Not described by run-capped.ts.
- `ledger.jsonl`: One JSON row per run: `name`, `scenario`, `sample` and `effort` (T-0342; older rows have neither, and `signals.ts` derives the scenario and sample from `name`), `agent`, `model`, `startedAt`, `endedAt`, `exitCode`, `verdict` (null when the probe wrote no report), `runId` (T-0259, live runs: the id the probe sent as `x-a2ui-run-id`, also in `report.json` and on each of the run's trace lines; `traces` are matched on it, else on the run's time window), `traces` (1-based inclusive line ranges into `traces/<day>.jsonl`), `tokens`, `costUsd` (estimated at the `PRICES` table). Written by `scripts/e2e-admin/probe/run-capped.ts` at commit `76aa91fb105f5a125777203fa54e235249664ecc` from the runner's own timings and the trace lines. Read: `jq -c '{name, verdict, costUsd, traces}' ledger.jsonl`; a run's turns: `sed -n '<from>,<to>p' traces/<day>.jsonl`.
- `live-commands.sh`: The round's probe commands, one `npm run chat:probe` per run, in run order. Generated by `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/plan.ts` (pinned by `plan.test.mjs`); run through `run-capped.ts`. Read: `grep chat:probe live-commands.sh`.
- `report.md`: The phase 2 round report written by the conductor: findings with trace lines as evidence and the tickets filed. Hand-written.
- `round.json`: The round manifest: commit, live-commands file, cap, `stop` (done, cap or crash), `capSkipped` (runs not started because their `# est` would pass the cap, T-0341), the trace window, the price table and its source, totals. Written by `scripts/e2e-admin/probe/run-capped.ts` at commit `76aa91fb105f5a125777203fa54e235249664ecc` after every run and at the end. Read: `jq '{commit, cap, stop, window, totals}' round.json`.
- `runs/.capped-start`: The round start (ISO), written once by `run-capped.ts` so a restart keeps the same spend baseline and trace window.
- `signals.md`: The round's tables: pass rate per scenario and per preset by model, mixed cells, failing checks, producer retry codes (fired, saved, extra USD), spend and latency per turn, section digests per persona, turn outcomes and failure codes, repair and payload shapes, exemplar retrieval per persona (the last three on rounds archived after T-0349; older archives lack them and are never regenerated). Generated by `scripts/e2e-admin/probe/signals.ts` (T-0342) with the archive; do not edit by hand. Compare with another round: `npm run eval:signals -- --round 2026-10-19-r12-targeted --against <round>`.
- `traces/2026-10-19.jsonl`: Dev proxy trace lines (T-0151), one redacted JSON line per agent turn: `at`, `agent`, `model`, `user`, `outcome`, `steps`, `usage`; copied by `scripts/e2e-admin/probe/run-capped.ts` at commit `76aa91fb105f5a125777203fa54e235249664ecc` from `.agent-traces/2026-10-19.jsonl`, only the lines inside the round window. Read: `jq -c '{at, agent, model, outcome, usage}' traces/2026-10-19.jsonl`; same shape as `npm run traces` reads.

## Runs

`runs/<name>/` holds one probe run, written by `npm run chat:probe` (`scripts/chat-probe.mjs`, `probe/run.ts`) at its `--out`:

- `report.json`: `verdict`, `checks[]` (`check`, `turn`, `status`, `detail`), `turns[]` (request, rounds, trace, prose, lint, screenshot), `agent`, `model`, `runId` (live runs, T-0259), `at`. Read: `jq -c '.checks[] | select(.status=="fail")' runs/<name>/report.json`.
- `fixture.json`: the recorded model answers of the run. Replay it keylessly: `npm run chat:probe -- --replay 2026-10-19-r12-targeted/runs/<name>/fixture.json`.
- `turn-<n>.png`: the Test Chat screenshot after turn n. Not in this folder or in git (T-0256): it is in the local evidence cache, `$AGENT_UI_EVIDENCE_DIR (default `~/Library/Caches/agent-ui/evidence` on macOS, `${XDG_CACHE_HOME:-~/.cache}/agent-ui/evidence` elsewhere)/<round>/<run>/turn-<n>.png`, so present only on the machine that ran the round and possibly gone. Each `report.json` turn names its screenshot by absolute path.

| Run | Agent | Model | Verdict | Files |
| --- | --- | --- | --- | --- |
| `runs/long-croupier-blackjack-hand-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/long-croupier-blackjack-hand-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/long-croupier-blackjack-hand-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-moves-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-moves-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-moves-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-rounds-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-rounds-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-blackjack-rounds-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-five-card-draw-haiku-1/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/regress-croupier-five-card-draw-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-five-card-draw-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-omaha-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-omaha-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-omaha-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-pontoon-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-pontoon-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-pontoon-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-seven-card-stud-haiku-1/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/regress-croupier-seven-card-stud-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-seven-card-stud-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-spanish-21-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-spanish-21-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-spanish-21-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-texas-holdem-haiku-1/` | croupier | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/regress-croupier-texas-holdem-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/regress-croupier-texas-holdem-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-domain-switch-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-domain-switch-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-domain-switch-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-guidance-conflict-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-guidance-conflict-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/routing-guidance-conflict-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-croupier-blackjack-deal-haiku-1/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-croupier-blackjack-deal-haiku-2/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-croupier-blackjack-deal-haiku-3/` | croupier | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-mentalist-first-answer-haiku-1/` | mentalist | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-mentalist-first-answer-haiku-2/` | mentalist | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-mentalist-first-answer-haiku-3/` | mentalist | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-negotiator-first-offer-haiku-1/` | negotiator | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-negotiator-first-offer-haiku-2/` | negotiator | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-negotiator-first-offer-haiku-3/` | negotiator | claude-haiku-5-5 | pass | `fixture.json` `report.json` |
| `runs/smoke-stylist-palette-haiku-1/` | stylist | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/smoke-stylist-palette-haiku-2/` | stylist | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
| `runs/smoke-stylist-palette-haiku-3/` | stylist | claude-haiku-5-5 | fail | `fixture.json` `report.json` |
