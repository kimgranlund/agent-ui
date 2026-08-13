<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-13 (chore-lead-sweep5, seat-reuse mode — no duplicate generations spawned;
  issue-sorter ran fresh, decision-watcher answered via a direct fresh pass, repo-cleaner axis
  re-derived live by chore-planner when the seat's reply lagged). Landed by the host with
  landing-time amendments (the 4.1 decision-watcher pass had ALREADY landed as 8dc5911e by the
  time the payload arrived — recorded RESOLVED below).
- **Live state at compose**: 5 open issues (#802/#804 pixel-holds · #810 ruling-gated ·
  #807/#808 the Kim-authored big-feature pair, filed 2026-08-12 ~23:08Z, dedup-checked NOT
  duplicates — a deliberate component/catalog split) · 0 open PRs · origin main-only · single
  worktree · tree clean, gates green at 77d9142a (evening-wave merges all landed).
- **Ratification drift caught live**: ADR-0182 was ratified 2026-08-12 (real utterance, verified
  in the ADR's status table) — the prior plan's "0182 excluded until ratified" clause LAPSED;
  judged same cycle (below). adr-0178's amendment (GH #696) checked for the
  verified-but-unexecuted-ratification class: NO ratify utterance exists on #696 — it genuinely
  awaits Kim's flip, correctly still pending in the checkpoint.
- **CORRECTED (post-landing): the docs-deploy claim was REAL** — repo-cleaner-sweep-2's late
  reply carried the evidence: every "Deploy docs site" Actions run red for 15+ pushes
  (`fs-shim.ts` missing the `statSync` export `dogfood-inventory.ts` imports; only the wrangler
  bundler sees the alias, so `npm run build`/check/test never could — the host's first probe
  tested the WRONG LAYER). Filed #811, fixed same cycle (PR #812 + a trip-wire test making the
  class visible in `npm test`), deploy run 31654215766 GREEN — the first in 16. Lesson: "gates
  green" claims must name which layers the gates actually exercise; the deploy pipeline was
  never one of them.
- **Verdict**: hygiene fully clean; the queue is human decisions plus this landing leg. The one
  buildable item pair (#807→#808) is design-first and Kim-gated.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

(none — nothing gated this cycle.)

## 2. Blocking other work

(none — nothing blocks; the #807/#808 design leg is gated on 3.3's green-light, not on any repair.)

## 3. Human-decision items

**ALL FOUR RULED in the 2026-08-13 batched confirm (post-landing amendment):** 3.1 both
pixel-CONFIRMED → #802/#804 CLOSED · 3.2 ruled fail-arm-everywhere → #810 build dispatched ·
3.3 green-lit both-sequenced → #807's design leg dispatched (#808 follows the anatomy ruling) ·
3.4 PARKED with condition (revisit on the next nonoun-plugins session; carry-counter stops).
Entries below kept for the record.

### 3.1 Pixel-confirm #802 + #804, then close both (Kim, ~10 min)
- **Action**: both fixes are MERGED and live on :5173 (#802 → PR #803 ask-arm round routing;
  #804 → PR #806 skill-exemplar content). Kim's live checks: (a) answer an intake card — it
  should advance to a new round with the old card left disabled behind (the #805 mechanic rides
  the same flow); (b) mint a skill via the Builder Interview — its content editor should arrive
  non-empty. Confirm → close; a miss on (a) means the model skipped the ask declaration (check
  the Dialog Turns inspector's leading meta-line — a producer-prompting follow-up, not routing).
- **Owner**: Kim.

### 3.2 Rule #810 — standalone-canvas disable-on-action fail arm (Kim, ~10 min)
- **Action**: wire the fail arm on a2ui-live's persistent canvas + replay panels, or rule
  click-once semantics for replay surfaces explicitly. Materially reduced by PR #809's repair
  round (fire-and-forget actions no longer disable at all).
- **Owner**: Kim (ruling); host dispatches any build behind it.

### 3.3 Green-light + sequence the #807 → #808 design leg (Kim + host; hours)
- **Action**: the Kim-authored pair — #807 (ui-card structured-container formatting, the
  component arm) BEFORE #808 (A2UI container vocabulary, the catalog + taught-idiom arm). Both
  share the unresolved header-anatomy question (new ui-card structure vs sub-control vs
  composition idiom) — rule it ONCE in #807's design pass; #808's catalog vocabulary then builds
  on the ruled anatomy. #807 routes through `agent-ui-component-design`'s fork sheet; #808 earns
  SPEC/LLD per its own acceptance. Also open in #807: the letterspaced-mono header type needs a
  token-ladder ruling (no such role exists today).
- **Owner**: Kim green-lights (the mobilize confirm); host dispatches the design seats.
- **Evidence**: GH #807/#808 bodies (owner-ruled scope, intake round 2026-08-12) · the Figma
  dialog-bubble reference frame both cite.

### 3.4 Cross-repo ops-seat encoding — carried ×12: schedule or park (Kim)
- **Action**: the standing nonoun-plugins encoding item (seat-payload landing legs re-verify at
  write time · evidence write-backs) has carried 12 sweeps. Either schedule a session in
  nonoun-plugins or Kim explicitly parks it with a revisit condition — visible staleness is
  worse than either choice.
- **Owner**: Kim (the choice); a nonoun-plugins host session (the work).

## 4. Hygiene debt

### 4.1 Decision-watcher pass (0182/0185/0178) — RESOLVED, landed 8dc5911e
- **Finding**: judged same cycle, 0 new harvest rows: adr-0182 NO (pure reuse-discipline repeat
  of ADR-0178's rules), adr-0185 NO (first-instance technique, below the 2-3-instance frequency
  bar; its concrete fact already repaired into agent-ui-integration-standards per its Repairs
  cell — verified in place), adr-0179 bookkeeping advanced. adr-0178's amendment held pending —
  no ratify utterance exists (verified against #696's comments); Kim's flip when ready:
  comment `ratify ADR-0178 amendment` on GH #696, then
  `python3 scripts/adr_ratify.py 0178 <comment-url>` (dry-run first).
- **Owner**: RESOLVED — no further action this cycle.

### 4.2 This sweep's landing leg — RESOLVED (this commit)
- **Finding**: plan.md written (this payload), `watch-checkpoint.json` advanced to the
  issue-sorter's fresh 2026-08-13T00:07Z pass, committed + pushed by the host per the #125 split.
- **Owner**: RESOLVED.

## Overnight close-out (2026-08-13, the clear-the-board goal) — BOARD ZERO

Everything cleared while Kim slept: **0 open issues · 0 open PRs · single worktree · origin
main-only · gates green · docs deploy green.**

- **#808 arc COMPLETE + closed**: SPEC #816 (doc-checked ×2) · S1 #820 (slot marks + label variant
  + the ADR-0078 amendment drafted proposed) · S2 #819 (CONTAINMENT) · S3 #823 (format mark,
  path-bindable per Kim's ruling) · S4 #824 (structured-container mini-skill, caption wall) ·
  S5 #825 (judged exemplar PASS-5 + the mark-exercising fixture — HOST-BUILT after the seat died
  on the API spend limit; its dry-run caught a real E_POINTER seed defect, fixed + re-judged).
  The judged import's full-coverage law settled GH #729's frontier wave en passant: 3 admitted,
  frontier-trip-card judged REJECT (D1/D2, repair path in disposition-allowlist.ts), stats-grid
  REJECT re-issued (D5). Corpus shard 24→28.
- **#815 + #821 (the two auto-filed booked-repairs trackers) closed**: ADR-0186's five repairs
  verified shipped (PRs #817/#822); ADR-0178's amendment repairs BUILT (PR #826 — the builtin
  update carve-out, updateTargetIndex as the whole fence, SPEC v0.16, LLD REV).
- **Ratified tonight by Kim**: ADR-0186 · ADR-0178's amendment. **Awaiting Kim (doc-tier, not
  board items)**: the ADR-0078 amendment (label wire-enum; on flip, S4's caption wall upgrades —
  one mini-skill line + recapture, booked in the SPEC §7 fork row) · the
  builder-builtin-section-update.lld.md status flip (proposed, ship-state now real).
- **gen-ui-kit (0.8.35)**: handed off to a dedicated session per Kim's ruling — out of this
  board's scope; the handoff prompt carries full state (review GO, repairs merged via the peer's
  PR #1172, test-sync PR #1173 CI-green awaiting Kim's admin merge, then release-pack --go).

## Standing notes (not queue entries)

- **Board shape (this landing)**: 5 open issues — #802/#804 (→3.1) · #810 (→3.2) · #807/#808
  (→3.3) · 0 open PRs · origin main-only · single worktree · gates green (last full run at the
  evening-wave close; `.claude/ops/`-only diffs since).
- **The evening-wave arc (2026-08-13)** is fully recorded in the issues themselves: #616 closed
  (upstream port, Kim's proposal-filing + CLA pending, `UPSTREAM-PROPOSAL.md` ready) · #802/#803
  ask-arm · #804/#806 skill exemplar · #805/#809 disable-on-answer (adversarial review cycle) ·
  #810 follow-up.
- **Seat-reuse lesson (sweep-4, re-proven sweep-5)**: same-day sweeps REUSE idle seats and
  re-verify live at write time; a sweep payload can be part-ahead, part-behind main
  simultaneously — cross-check every claim against live `git`/`gh` before landing.
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings, never re-propose.
- **held-items.md**: empty since first firing — nothing trust-gated.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (sweep-5, seat-reuse mode), 2026-08-13; landing-time amendments by the
host (4.1 already landed, the #696 utterance check, the docs-deploy claim probe) — written and
landed by the dispatching session per the #125 ops-write split.*
