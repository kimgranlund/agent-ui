# Commands: the full runner list

> Moved from the root `CLAUDE.md` Commands section by T-0249 (2026-10-15), so every harness reads it through
> the root `AGENTS.md`, which links here. The gate law (local gate, exit codes, the docs-only carve-out) stays
> in `AGENTS.md`; this file is the lookup list of what each runner does.

## Gates

- `npm run check`: the standing gate: `tsc && check:site && check:tools && check:scripts` (all noEmit or test steps).
- `npm test`: Vitest (jsdom), once. `npm run test:watch`: watch.
- `npm run test:browser`: the real-engine gate, six sequential vitest shards (packages:{components,app,rest},
  site, focus-timing, visual) then `test:eval-catalog` (boots its own vite and Chromium, gate verdicts only).
  Never re-monolith the shards or add a heap bump (history and the focus-timing extension rule: skill
  `component-testing`).

## Agent evals, probes and traces

- `npm run eval:agent-behavior -- selftest` is keyless and runs inside `check:scripts`;
  `-- live --leg selection|persona|response-type` needs `ANTHROPIC_API_KEY` and is Kim's manual run (exit 0, 1
  or 2). Home: `packages/agent-ui/a2ui/tools/agent-eval/`, GH #1810.
- An org-level Anthropic key (not scoped to a workspace) answers 400 unless every call carries
  `anthropic-workspace-id`: set `ANTHROPIC_WORKSPACE_ID` beside `ANTHROPIC_API_KEY` in `.env` (dev proxy, eval and
  recorder tools read it) and as a Worker secret or var (`wrangler secret put ANTHROPIC_WORKSPACE_ID`).
  Server-side only, never logged (T-0192).
- `npm run e2e:admin`: keyless headless agent-admin flows (Test Chat, Builder, Settings, teams, error and abort
  paths) replayed from fixtures in `scripts/e2e-admin/`; outside the six shards, local only, no CI job.
- `npm run e2e:admin:record`: captures a new admin fixture from the live model; manual, needs a key in `.env`,
  never run in CI.
- `node scripts/agent-content.mjs validate | new <id> | add-skill <id> | compile-check`: the agent content CLI
  (T-0162) over `site/agent-content/`, the same validator as the generator; `new <id> --from <persona file>`
  writes an exported agent as a seed folder. Keyless, local; its test rides the `scripts` project
  (`scripts/agent-content.test.mjs`). Usage in `site/agent-content/AGENTS.md`.
- `npm run chat:probe -- --agent <preset> --model <id> --say "<text>" [--click <label>]`: drives the real Test Chat
  headless (live spends API credit; `--replay <fixture>` is keyless), writes a report, screenshots and named
  checks (no halt, no A2UI JSON as prose, no surface lost to self-correct, render lint), exit 1 on a fail;
  `-- --from-trace last` turns a trace into a keyless replay regression. Local only, no CI job; `-- selftest`
  rides `check:scripts`. Home: `scripts/e2e-admin/README.md`, T-0174. A live round of many probes runs through
  `probe/run-capped.ts <live-commands.sh> --cap <usd> --round <slug>` and archives into `.sdlc/evals/rounds/`
  (T-0225, T-0241; README, Live rounds).
- `npm run eval:signals -- --round <folder> [--against <folder>]`: keyless tables over the committed round
  archive (pass rate per scenario and preset by model, mixed cells, failing checks, retry codes, spend and
  latency per turn, section digests), and churn against a baseline round; `--floor <tag>=<rate>` and
  `--max-drop <delta>` exit 1 on a miss. Each archived round also gets them as `signals.md`. Home:
  `scripts/e2e-admin/probe/signals.ts`, README Live rounds, SPEC CL-R4 and CL-R9 (T-0342).
- `npm run traces`: the last live agent turns from the dev proxy's git-ignored trace log
  (`.agent-traces/YYYY-MM-DD.jsonl`, one redacted line per turn, on under `npm run dev`, `A2UI_AGENT_TRACES=0`
  turns it off); `-- --full 1` prints the newest turn in full (T-0151). The prompt text each line's digests name
  sits beside it in `.agent-traces/prompts/<digest>.txt` (T-0311).
- `python3 scripts/agent-traces-to-fog.py <trace.jsonl> --out <session.json>`: converts one `.agent-traces` day
  file into a context-fog-of-war v2 session (each turn an event, its prompt sections, exemplars, mini-skills and
  referenced entries as sources, index-only or full); `fog.py validate` and `library.py publish` belong to that
  skill (T-0239). Its keyless `selftest` rides `check:scripts`. A whole round folder ingests through the skill's
  own bundle path instead (`engineer.py ingest <round> --mapping .sdlc/evals/fog-manifest.json`, records in
  `.sdlc/evals/fog/`, T-0248); that path maps turns, the `events` block (exemplar ids retrieved against framed, tool results against
  submitted, turn completeness) and one conversation per probe run (the `x-a2ui-run-id` header a probe sends,
  written as `runId` on its trace lines, T-0259), so the fog detectors `retrieved-not-submitted` and
  `tool-result-not-propagated` assess real pairs; the adapter stays for sections, references and failure codes.
- `npm run e2e:devtools`: the `@agent-ui/devtools` keyless browser smoke (`scripts/e2e-devtools.mjs`); local
  only, no CI job.
- `npm run test:a2ui-kit`: the keyless A2UI test kit (T-0011): scenarios, scripted transport, provider, MCP server
  and tools, the catalog-generated per-type matrix, seeded defects per layer, fuzz; jsdom and Node legs plus
  `kit.ts selftest` (which also rides `check:scripts`). `npm run test:a2ui-kit:browser` runs its two real-engine
  legs in `packages-rest`. Home and format: `packages/agent-ui/a2ui/tools/testkit/README.md`.

## Site and ops

- `npm run dev` / `npm run build`: the docs site (`site/`) is the app entry. `npm run deploy:docs`: ui.nonoun.io.
- `npm run ops:reap-worktrees` / `ops:reap-branches` / `ops:reap-scratch-clones`: gated, dry-run-by-default reap
  scripts (append `-- --execute` to apply) for `.claude/worktrees/` and `../<repo>.worktrees/` entries, local branches, and orphaned
  `dispatch_envelope.py` scratch-clone dirs, respectively.
- `npm run ops:bootstrap-scratch-clone -- <clone-dir> [--root <path>]`: deterministic per-entry `node_modules`
  symlink bootstrap for a `dispatch_envelope.py` scratch clone (GH #1695); a build seat in a scratch clone runs
  this instead of improvising the `seat-map` recipe by hand.
