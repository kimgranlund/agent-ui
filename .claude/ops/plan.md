<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-12 STANDALONE (no seat reports attached) — chore-planner dispatched with a
  focus instruction: "how would we support MCP services in our Agent Schemas system?" That seed is
  already filed verbatim as GH #783 (2026-08-12, `enhancement`, `size:big`), so the focus resolves
  to reordering attention onto #783's entry — queue order itself unchanged, per contract. Prior
  plan (2026-08-11 fifth sweep, host-approximated) read as carry-forward source.
- **Evidence mode**: durable state (`.claude/ops/`, adr-queue.json, held-items.md) + live state
  (`gh` reachable — 4 open issues, 1 open draft PR; `git` branches/worktrees enumerated; pid
  liveness checked). Nothing UNMEASURED except where named below.
- **Evidence-refresh disclosure**: `git fetch --prune` during evidence collection cleared 27
  remote-tracking refs whose branches were ALREADY deleted on origin (every merged-PR branch from
  the 2026-08-12 audit wave and earlier) — a ref-state sync with server reality, not a queued
  mutation; `git branch -r --merged origin/main` is now empty. No surviving remote branches exist.
- **Supersedes**: the 2026-08-11 fifth-sweep plan; per-item disposition below.
- **Verdict**: the MCP focus lands on a same-day-filed issue with its design leg still undispatched
  — that is the queue's head. Tier 1 is empty (the prune found nothing left to gate). The fifth
  sweep's "live, valuable work" ruling on pid 30537's worktrees is now STALE: PR #708 merged
  2026-08-11T15:19Z, so both held worktrees are release-check candidates gated only on the still-
  live session. All five of the fifth sweep's tracked PRs (#692/#708/#718/#719/#720) merged.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-11 fifth sweep → this dispatch)

| Item | Fate |
|---|---|
| 3.1 adr-0179 harvest confirm | **CARRIED, unchanged** → 3.1 — still exactly one pending row in `adr-queue.json` (queued 2026-08-10T23:52Z) |
| 4.1 land fifth sweep's ops delta | **RESOLVED** — working tree clean at this dispatch; plan.md tracked at HEAD |
| 4.2 encode ops-seat rulings in nonoun-plugins | **CARRIED ×9** — ninth consecutive sweep, no landing evidence (cross-repo) |
| Standing note: pid-30537 worktree = live PR #708 work | **STALE, corrected** → 3.2 — #708 MERGED 2026-08-11T15:19Z; the hold is now post-merge residue under a live lock |
| Standing notes: PRs #718/#719/#720/#692 awaiting merge | **RESOLVED** — all four MERGED 2026-08-11 (verified per-PR via `gh pr view`) |
| Standing note: ADR-0181 `proposed`, gating #695 | **RESOLVED** — ADR-0181 now `accepted`; #695 no longer open |

## 1. Gated mutations already verified safe

(none — the prune left no surviving remote branches; both dead-ish local `worktree-agent-*`
branches sit under LIVE locks, which disqualifies them from this tier → 3.2.)

## 2. Blocking other work

### 2.1 Dispatch GH #783's design leg — per-agent MCP configuration in the Agent Schema system (FOCUS)
- **Action**: dispatch the build pipeline's planner phase (`/build-feature` planner /
  `system-decompose`) for GH #783: a decomposition mapping per-agent MCP declaration onto the
  ADR-0177 manifest registry (schema section shape · storage keys · the id ≠ tool.name ≠ label
  split · key/transport handling confined to the site-internal `tools/agent/` shell, never
  `src/agent/`) and the ADR-0131 `agentConfigSchema()` → `SettingsSchema` surface. The design leg
  ALSO owns the shared scope ruling — "Agent Schemas" = the config `SettingsSchema` only, or
  broader agent record shapes — the same named gap GH #781 carries; ruling it here unblocks the
  #781 docs page (PR #784) from guessing. ADR only if a contract fork emerges (issue's own
  ADR-default-no). This entry queues the design dispatch; it does not answer the design question.
- **Owner**: host dispatches; planner seat executes; Kim ratifies any ADR that emerges.
- **Evidence**: GH #783 body (acceptance clause 1 = ratified design first; seed verbatim matches
  this dispatch's focus) · existing infra: `packages/agent-ui/a2ui/tools/agent/integrations/mcp`,
  `tools/agent/mcp-servers.json`, `src/live-agent/mcp-boot.test.ts` (GH #567, CLOSED) · target
  surface `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts` (no MCP section
  today) · ADR-0177 + `lld/mcp-connector.lld.md` + `decompositions/mcp-manifest-registry.decomp.md`.
- **Size**: ~2–4 h (design leg only; the build behind it is `size:big`, separately planned by that leg)

## 3. Human-decision items

### 3.1 Confirm-gate the adr-0179 harvest candidate (carried, unchanged)
- **Action**: put the single pending row to Kim in one AskUserQuestion confirm — harvest
  ADR-0179's patterns (origin-keyed `#contextFor()` routing · band-driven docking off
  `SHELL_COMPACT_BREAKPOINT` · retract-don't-delete divider-unpaint · the third amendment's
  shown-set dual-rendering + mint-vs-compose test) into `agent-ui-composition-patterns/SKILL.md`;
  skip the superseded-in-part material. On yes → dispatch `/make-pack` scoped to that skill.
- **Owner**: Kim (the confirm); `/make-pack` follows only on a yes.
- **Evidence**: `adr-queue.json` — exactly one pending row, byte-unchanged since 2026-08-10T23:52Z.
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

### 3.2 Release check on pid 30537's two held worktrees — RESOLVED, reaped 2026-08-12
- **Finding (repo-cleaner confirm-pass, then host action)**: pid 30537 is THIS session's own host
  (ancestry: sweep shell → ppid 30537 = `claude.exe --session-id f3d6d8ad…` = the job dir) — the
  two locked worktrees were this session's OWN completed-dispatch residue, not a separate party's:
  `agent-a05fbeb698816197e` (the #778 diagnosis build-lead, completed + relayed; 0 unique commits
  vs main, clean tree) and `agent-a1a8c09e80da8f0b0` (PR #708 MERGED 2026-08-11; clean tree, only
  squash-merge residue). The "confirm" this item gated on was the host's own to give, and the host
  has direct knowledge both dispatches finished — so it ruled release and reaped: `git worktree
  unlock` (the stale lock named this pid) → `git worktree remove --force` → `git branch -D`, both
  worktrees + branches gone (exit 0 each). Only `spec-mcp-agent-schemas` (pid 42424, the separate
  live peer on #783) remains locked — deliberately untouched.
- **Owner**: RESOLVED — no further action.

### 3.3 Rule the GH #782 design fork (super-shell content-fill default + rail+pane overlay seam)
- **Action**: put the fork (surfaced by #778, filed 2026-08-12, `size:small`) to Kim or a design
  seat for a ruling, then dispatch the small build it gates.
- **Owner**: Kim (ruling); host dispatches the build after.
- **Evidence**: GH #782 open, title-tagged `[Design fork]`; body not deep-read this dispatch —
  the entry routes the ruling, it does not presume its content.
- **Size**: ~15 min ruling; small build behind it

## 4. Hygiene debt

### 4.1 Land this dispatch's plan.md delta (recurring)
- **Action**: the DISPATCHING session writes this payload to `.claude/ops/plan.md`, then
  commit+push to `main` (ops bookkeeping, not PR-gated). Never this seat's write — the #125 split.
- **Owner**: dispatching session (host).
- **Size**: ~5 min

### 4.2 PR #784 (GH #781 Agent Schema docs page) — RESOLVED, merged 2026-08-12
- **Finding**: PR #784 MERGED 2026-08-12T15:39:08Z (independently gate-re-verified before merge —
  the classifier was down during the seat's own run); GH #781 CLOSED 2026-08-12T15:39:56Z; its
  holding worktree + `docs/gh-781-agent-schema` branch reaped (no local/remote ref survives).
- **Owner**: RESOLVED — no further action.

### 4.3 Decision-watcher pass over the four unjudged accepted ADRs
- **Action**: run a real decision-watcher pass on ADR-0180 (accepted 2026-08-10, still no harvest
  judgment — carried from the fifth sweep), ADR-0181, ADR-0183, ADR-0184 (all newly `accepted`
  since the last real pass) — judge harvest-candidate yes/no each, append rows to
  `adr-queue.json` where warranted.
- **Owner**: decision-watcher seat, next sweep firing.
- **Evidence**: ADR status greps this dispatch: 0180/0181/0183/0184 all `accepted`;
  `adr-queue.json` carries only the adr-0179 row.
- **Size**: ~15–20 min

### 4.4 `worktree-agent-a878746e201345f86` branch — RESOLVED, already gone
- **Finding (repo-cleaner confirm-pass)**: no such local or remote ref exists; already reaped with
  #784's merge. Moot — nothing to delete.
- **Owner**: RESOLVED — no further action.

### 4.5 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×9)
- **Action**: unchanged — one change in the nonoun-plugins repo.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout).
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs".
- **Size**: ~30 min

## Standing notes (not queue entries)

- **Board shape (2026-08-12 mobilize-run update)**: 3 open issues (#783 big/focus, live-peer
  design leg · #782 small fork, awaits Kim's ruling · #616 upstream-blocked; #781 CLOSED via #784)
  · 0 open PRs (#779/#780/#784/#785 all MERGED) · 1 locked worktree remaining
  (`spec-mcp-agent-schemas`, pid 42424 — the live peer authoring #783's SPEC; the two pid-30537
  own-residue worktrees reaped, entry 3.2) · origin main-only. Mobilize this run: 0 tickets
  mobilizable — #783 in flight (peer), #782 human-decision, #616 blocked.
- **#616 upstream wait** — NOT re-verified this dispatch (upstream `a2ui-project/a2ui#2150` status
  UNMEASURED here; last verified OPEN 2026-08-11). The issue's second gate (signed Google CLA) is
  unaffected either way.
- **ADR-0182 remains `proposed`** — the one open proposed ADR; gates nothing else on this board;
  the proposed-marker is Kim's gate, never self-flipped.
- **gitignore KEEP-LIST fence is permanent** — standing Kim-ruled noise, unchanged.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (standalone dispatch, MCP focus), 2026-08-12 — returned as payload;
written and landed by the dispatching session per the #125 ops-write split.*
