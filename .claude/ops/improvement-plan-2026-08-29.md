# Fleet rigour plan (2026-08-29)

Source: marshal self-review of the 2026-08-28/29 session (fleet cold start, board-clear loop,
naming refactor, ops sweep). Thirteen findings, each with mechanism, fix, owner, size, done-when.
Priority: P0 = caused a real failure this session · P1 = disclosed gap, no failure yet ·
P2 = hygiene or a ruling only Kim can make.

## P0

### A. Overdue handbacks were never chased
- Finding: build-1699 (90 min budget) and build-1701 (60 min) ran 5-6 h before a chase; both
  were alive and simply not reporting.
- Mechanism: the marshal re-anchors only on inbound events (a handback, an idle notice, a task
  notification). Nothing fires at budget expiry. Idle notices carry no progress state.
- Fix: (1) marshal practice, effective now: at every build dispatch, arm a wake-up at the stated
  budget (ScheduleWakeup or a Bash `until` watcher on the claim age) and re-anchor on it;
  (2) teamwork `build-leader`: post a dated progress comment on the ticket at budget/2 and before
  any wait longer than 5 min, so the durable record shows liveness; (3) `fleet-marshal.md`
  Priority 5 names the timer explicitly.
- Owner: marshal (1), teamwork plugin task (2, 3). Size: small.
- Done when: a build past budget is chased within 10 min with no human prompt.

### B. Seat return address does not resolve
- Finding: every named seat this session reported `No agent named 'agent-ui-93' is reachable`
  and fell back to `team-lead`/`main`. Messages arrived, but only by the fallback.
- Mechanism: an in-process named seat addresses its parent as `main`; the harness session name
  (`agent-ui-93`) is a cross-session address only. Dispatch prompts named the wrong one.
- Fix: dispatch template says "deliver via SendMessage to `main`"; `mobilize-chores` step 5,
  `fleet-bootstrap` Phase 5, and the `fleet-manifest-schema` `agent_name` note state the split
  (in-process seats: `main`; cross-session peers: the session name).
- Owner: marshal (template, now), teamwork plugin task (docs). Size: small.
- Done when: a dispatched seat's first SendMessage lands without a fallback line.

### C. Host contention turned three gates red
- Finding: builds 1695, 1699, 1701 each saw `npm test` red under load (timeouts), green in
  isolation. gen-ui-kit vitest workers 23 h old (ppid 1) were pinning the host at load 100+.
- Mechanism: no reap step before a full-suite run; no ceiling on concurrent full-suite builds
  across repos on one host; `import-seeds.test.ts` 5000 ms subprocess timeout is now a third
  sighting.
- Fix: (1) `flaky-gates` reap step runs at dispatch time, not after the red; (2) seat-map
  dispatch law: max two concurrent full-suite builds per host, others queue; (3) file the
  `import-seeds` timeout as a bug (third sighting, Kim's second-sighting bar passed).
- Owner: agent-ui (seat-map line, bug). Size: small.
- Done when: a full-suite build starts only after a zombie reap and a concurrency check, and
  the bug carries a repro.

## P1

### D. Sweep infrastructure is not vendored here
- Finding: `sweep_guard.mjs`, `workflows/chore-sweep.js`, `chore_sweep_apply.mjs` are referenced
  workspace-relative (`harness/...`); agent-ui has no such directory. The sweep ran unguarded and
  payloads were applied by hand.
- Fix: `harness:sweep-chores` resolves `${CLAUDE_PLUGIN_ROOT}/scripts/...` when the
  workspace-relative path is absent, or agent-ui vendors a thin `harness/` shim. Prefer the
  plugin fix; it removes the class.
- Owner: harness plugin task (claude-plugins). Size: small.
- Done when: `/mobilize-chores` in agent-ui runs the guard and the apply script without fallback.

### E. Docs-only gate rule is undefined
- Finding: the planner skipped `npm test` on PR #1700 (load 130) and disclosed it as a deviation.
- Fix: one line in `process.md`: a diff touching only `.claude/docs/**`, `*.md`, or a code
  comment gates on `doc_lint` + `npm run check`; vitest is not required locally; CI stays the
  gate of record. Then it is a rule, not a deviation.
- Owner: agent-ui planner. Size: small.

### F. decision-watcher returned prose, no report file
- Finding: chore-planner had to read ops state directly because no
  `reports/<ts>-decision-watcher.md` existed.
- Fix: every sweep dispatch prompt names the seat's report path; decision-watcher's contract
  writes it as a fenced payload like the other two seats.
- Owner: harness plugin task. Size: small.

### G. IDR revalidation blind spot (plan §4.2)
- Finding: `revalidation_checkpoint.py` requires frontmatter `status: locked`; this repo's IDRs
  use the blockquote dialect, so 0 IDR claims have ever been sampled.
- Fix: file the two-path task (extend the script's IDR scanner, or emit `locked` here).
- Owner: marshal files; build later. Size: small (ticket), medium (fix).

### H. reap-scratch-clones does not see session scratchpad clones
- Finding: the #1699 clone under `/private/tmp/claude-501/.../scratchpad/` was invisible to the
  script's scan roots.
- Fix: add the `CLAUDE` scratchpad root pattern to `scripts/reap-scratch-clones.mjs`.
- Owner: agent-ui task. Size: small.

## P2

### I. fleet.json hygiene and the model deviation
- Finding: a stale `orchestrator/host` row (2026-08-21) sits beside the live `agent` row; the
  marshal terminal ran Fable against a `sonnet+high` seat tier all session.
- Fix: release the stale row with a dated reason. Kim rules: retier `seats.agent` to fable with a
  `justification_date`, or launch the marshal terminal on Sonnet.
- Owner: marshal (row), Kim (ruling). Size: small.

### J. Marshal carve-out via `file-bug` fork
- Finding: the fork built inline from this seat (plugins #961). Upstream fix is docs 1.21.15;
  this repo's cache is 1.21.13.
- Fix: update the docs plugin; the seat-map pointer already landed (`9d2075df`).
- Owner: Kim (plugin update). Size: trivial.

### K. Cross-repo PR authoring from a foreign marshal
- Finding: plugins PR #966 was authored from this seat and lost the version-slot race twice to
  that repo's own loop.
- Fix: seat-map law: in a repo where this session is not a registered peer, intake is
  record-only; never author a PR there.
- Owner: agent-ui (seat-map line). Size: small.

### L. Human decisions still queued
- plan §3.1: home for the adr-0058/0059 phantom-tool-citation harvest (three candidates named).
- plan §4.1: adr-0129 harvest, `/harness:make-pack .claude/skills/component-packaging`, 10
  firings stale.
- plugins #966: hand to `plugins-c4` in that session.
- Owner: Kim.

### M. cwd drift after a bare `cd` in a spawn
- Finding: reviewer rows first landed in the worktree copy of fleet.json.
- Fix: appended to plugins #609; `fleet-bootstrap` reviewer-spawn reference should say
  `(cd <wt> && claude -p ...)`.
- Owner: teamwork plugin. Size: trivial.

## Sequence

Today, marshal: A(1), B(template), G(file), H and K (seat-map lines, one PR), I(row release).
This week, tickets filed and built: C, D, E, F, plus the plugin-side halves of A and B.
Kim: I ruling, J, L.

## Standing practice changes (marshal, effective now)
1. Arm a budget timer on every dispatch; chase on expiry, re-dispatch on a second silence.
2. Address in-process seats as `main`.
3. Reap zombies and check the concurrency ceiling before any full-suite build.
4. Foreign repos: record-only intake, never a PR.
5. Every sweep seat gets a named report path in its prompt.
