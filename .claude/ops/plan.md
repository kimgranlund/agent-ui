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

### 3.2 Release check on pid 30537's two held worktrees (superseding the fifth sweep's "live work" note)
- **Action**: confirm with Kim (or the session itself) that the resumed session at pid 30537
  (up ~8 days, session f3d6d8ad…) is DONE with `.claude/worktrees/agent-a1a8c09e80da8f0b0`
  (branch's PR #708 MERGED 2026-08-11T15:19Z; clean tree; residual commits are the squash-merged
  review fix + a main-sync merge) and `.claude/worktrees/agent-a05fbeb698816197e` (0 unique
  commits vs main, clean tree). On yes: `git worktree remove` FIRST, then `git branch -d`/-D —
  worktree before branch, the GH #613 rule. Never while the lock's pid is alive and unconfirmed.
- **Owner**: Kim / the pid-30537 session (the confirm); host (the reap).
- **Evidence**: `ps -p 30537` alive this dispatch · `git worktree list --porcelain` shows both
  locks naming pid 30537 · `gh pr view 708` = MERGED · `git rev-list --count main..` = 0 for
  a05fbeb, 3 ancestry-only for a1a8c09 · both trees clean per `status --porcelain`.
- **Size**: ~5 min confirm; ~10 min reap

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

### 4.2 Advance PR #784 (GH #781 Agent Schema docs page) out of draft
- **Action**: review the draft; note it shares 2.1's scope gap — sequence its ready-for-review
  after (or alongside) the #783 design leg's scope ruling so the page doesn't document a boundary
  the ruling then moves. Merge is Kim's, never the host's.
- **Owner**: host (review + sequencing); Kim (merge).
- **Evidence**: PR #784 DRAFT, branch `docs/gh-781-agent-schema`, live in locked worktree
  `agent-a878746e201345f86`; GH #781 names the same scope question as #783.
- **Size**: ~30 min review

### 4.3 Decision-watcher pass over the four unjudged accepted ADRs
- **Action**: run a real decision-watcher pass on ADR-0180 (accepted 2026-08-10, still no harvest
  judgment — carried from the fifth sweep), ADR-0181, ADR-0183, ADR-0184 (all newly `accepted`
  since the last real pass) — judge harvest-candidate yes/no each, append rows to
  `adr-queue.json` where warranted.
- **Owner**: decision-watcher seat, next sweep firing.
- **Evidence**: ADR status greps this dispatch: 0180/0181/0183/0184 all `accepted`;
  `adr-queue.json` carries only the adr-0179 row.
- **Size**: ~15–20 min

### 4.4 Verify-then-delete the unattached `worktree-agent-a878746e201345f86` branch
- **Action**: `git rev-list --count main..worktree-agent-a878746e201345f86`; if 0 and no worktree
  attached (its namesake worktree is checked out on `docs/gh-781-agent-schema`, not on it), plain
  `git branch -d`. UNMEASURED this dispatch — the count was not run.
- **Owner**: repo-cleaner seat next sweep, or host.
- **Size**: ~5 min

### 4.5 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×9)
- **Action**: unchanged — one change in the nonoun-plugins repo.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout).
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs".
- **Size**: ~30 min

## Standing notes (not queue entries)

- **Board shape (this dispatch)**: 4 open issues (#783 big/focus · #782 small fork · #781 small
  docs · #616 upstream-blocked) · 1 open PR (#784 DRAFT) · 3 locked worktrees (1 live PR work,
  2 held by pid 30537 → entry 3.2) · 0 surviving remote branches after the prune.
- **#616 upstream wait** — NOT re-verified this dispatch (upstream `a2ui-project/a2ui#2150` status
  UNMEASURED here; last verified OPEN 2026-08-11). The issue's second gate (signed Google CLA) is
  unaffected either way.
- **ADR-0182 remains `proposed`** — the one open proposed ADR; gates nothing else on this board;
  the proposed-marker is Kim's gate, never self-flipped.
- **gitignore KEEP-LIST fence is permanent** — standing Kim-ruled noise, unchanged.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (standalone dispatch, MCP focus), 2026-08-12 — returned as payload;
written and landed by the dispatching session per the #125 ops-write split.*
