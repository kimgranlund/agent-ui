# Standing ops rulings (Kim, via host AskUserQuestion rounds)

## Revalidation-mode scope — RULED 2026-08-20: ADR/IDR-only, no RDD tier in this repo

`decision-watcher`'s Revalidation mode blocked at the 2026-08-20T22:01:23Z sweep firing: it
requires all three sources (ADR/IDR/RDD) to exist and agent-ui carries no `.claude/docs/rdd/`
directory. Kim ruled: **scope Revalidation to ADR/IDR-only here — no RDD tier minted**, matching
the standing 2026-08-18 ruling that this repo's IDR tier is global-intent-only (no feature-scoped
IDRs either). Future firings should not re-surface this as a blocked/gap finding; treat the
two-source scope as this repo's own shape until a real RDD-shaped need appears.



## Seat-payload landing leg — RULED 2026-08-09: chore-lead lands all

Ops seats (decision-watcher, issue-sorter, repo-cleaner, chore-planner) RETURN their state
payloads and reports; **chore-lead's close-out always writes them to `.claude/ops/` before
reporting up**. Seats do not write ops state directly; the dispatching session verifies nothing —
the landing is chore-lead's own final leg, part of its done-condition.

- Every future chore-lead dispatch brief MUST carry this contract explicitly (the host's dispatch
  prompt is the enforcement point until the agent definition itself encodes it).
- The agent definitions live in the harness plugin (nonoun-plugins repo) — encoding this into
  `chore-lead.md`'s own body is a separate change in that repo, flagged, not done from here.
- Supersedes the per-firing ad-hoc judgment that produced three different landing paths
  (file write / inline / dispatcher-applied) in the 2026-08-08 firings, and retires the
  recurring "verify the landing" queue entries.

## Friendlies standing_rule — RULED 2026-08-08 (recorded in friendlies.json): hold-first-filing

Re-confirmed by Kim 2026-08-09. `friendlies.json` policy block is the canonical record.

## #613 fix path — RULED 2026-08-09: evidence-first

Tracker stays open; capture `gh pr merge`'s verbatim output at the next survivor before manual
cleanup. Best-fitting variable so far: branch checked out in a linked worktree at merge time
(#622) vs. not checked out anywhere (#618–#621, #625, clean). Full evidence: #613's 2026-08-09
comment.

**Amendment 2026-08-09 (third sweep):** a survivor classification must run `git fetch --prune`
first. `git branch -r` alone can show a stale LOCAL remote-tracking ref for an already-deleted
remote branch (hit this firing on `origin/task/624-nav-polish`, PR #625 — traced to a stale ref,
not a real survivor, once pruned). Treating an unpruned ref as a survivor would misattribute a
clean ship as a #613 repeat.

## ADR harvest confirm — RULED 2026-08-09: harvest all three

ADR-0173 → new reference file in `component-standards` · ADR-0174 → new skill (a2ui
producer meta-line/envelope architecture, narrow scope) · ADR-0175 → new reference file in
`component-design`. Dispatched 2026-08-09; adr-queue.json rows advance on landing.

## Evidence write-backs — RULED 2026-08-09: chore-lead's landing leg owns them

Dated evidence comments on tracker issues (e.g. #613) are part of chore-lead's close-out, same as
its ops-state landing: seats report evidence up, chore-lead posts. Agent-definition encode rides
the existing nonoun-plugins follow-up. First instance posted by the host (issue #613, 2026-08-09).

## #613 root-cause test — RULED 2026-08-09: deliberate test (replaces wait-for-natural)

One throwaway PR merged while its branch is checked out in a linked worktree; verbatim
`gh pr merge` output captured to #613. Also ruled same round: the 07fc618 ops commit rides #626's
PR (no cherry-pick), and the 17 stale gitignore rules get trimmed on a small PR after #626 ships.

## #613 CLOSED root-caused 2026-08-09 — the worktree-held-branch merge rule

`gh pr merge --delete-branch` aborts before the REMOTE deletion when the branch is checked out in
any linked worktree (local delete fails → terminal). Practice rule: reap the branch's worktree
BEFORE a --delete-branch merge, or delete the remote branch by hand after. Proven by the PR #627
deliberate test (verbatim output on #613). repo-cleaner's sweep stays the safety net.

## ADR-0040 + ADR-0008 — RULED 2026-08-16 (Kim, in-chat)

**ADR-0040 (components-barrel size budget):** `npm run size` is red on main — the
`@agent-ui/components` barrel sits 312 B over the ADR-0040 line, pre-existing before the
2026-08-16 clear-the-boards run (+0 B from #974/#952). Ruling: re-base the budget line to the
measured value via a PROPOSED ADR-0040 amendment — never self-ratified, Kim flips it. Routed to
task **#1009**.

**ADR-0008 (CSS-native-first exception boundary):** the #953/PR #983 scroll-driven
`filter: brightness()` dim on inactive `ui-swiper` slides is NOT accepted as an ADR-0008
exception. Ruling: revert it — remove the `@supports (animation-timeline: view())` dim block +
`--ui-swiper-inactive-brightness` token + the `[6b] #953 inactive-slide dim` browser probes; keep
the zero-JS proof section and the `scrollsnapchange` adopt-with-fallback; regenerate dogfood
assets after `npm ci` in the worktree; update `swiper.md`. Routed to bug **#1010**; ruling comment
posted on #953.

## Placement forks + ADR harvest — RULED 2026-08-16 (Kim, in-session, clear-the-boards run)

One round settled five issues + two harvest rows: **#955/#956/#957** → mint `@agent-ui/data` as a
zero-dep sibling off `components` (router/code precedent), #957 FOLDS into #956, one PRD/SPEC covers
all three, the package mint rides a proposed ADR. **#959** → seam home `@agent-ui/shared` (Slice 1
may build; layer-contract change = proposed ADR). **#954** → new `ui-drill` container (not a
nav-rail trait); component-design intake → build. **ADR harvest**: BOTH `adr-0187` (atFinalize
validator signal → a2ui-review / a2ui-payload-authoring) and `adr-0178-amendment` (authorship-scoped
re-ruling → composition-patterns or sibling) confirmed for harvest. Rulings posted on each issue.
