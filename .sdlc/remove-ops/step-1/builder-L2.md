<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `.claude/ops/` (108 tracked files): removed with `git rm -r -q`
- `scripts/reap-worktrees.mjs`: removed fleet-seat rule (d), `liveFleetSeatNames()`, `fleetSeats`, the `KEEP(fleet-seat)` branch, the selftest fixture with its fleet.json write and 3 asserts, and the now-unused `readFileSync` and `basename` imports. The header now reads "ALL THREE of (a)-(c) hold".
- `scripts/reap-branches.mjs`: comment path replaced with words
- `packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts`: `.claude/ops` removed from `SCAN_ROOTS` and from the header comment; the mb-live-proof ALLOWLIST row and its comment removed
- `packages/agent-ui/a2ui/src/agent/produce.ts`: comment path replaced with words
- `packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts`: comment path replaced with words
- `.claude/docs/process.md`: path replaced with words
- `.claude/docs/goals.md`: 4 paths replaced with words
- `.claude/docs/product-brief.md`: markdown link replaced with plain text
- `.claude/docs/prd/agent-admin-app.prd.md`: path replaced with words
- `.claude/docs/prd/saas-data-utilities.prd.md`: path replaced with words
- `.claude/docs/decompositions/saas-data-utilities.decomp.json`: `grounding` string only
- `.claude/skills/doc-standards/references/adr-log-mechanics.md`: 2 paths replaced with words

## Checks
- `test ! -e .claude/ops`: pass
- `! git grep -n "\.claude/ops" -- scripts packages .claude/skills/doc-standards .claude/docs/process.md .claude/docs/goals.md .claude/docs/product-brief.md .claude/docs/prd .claude/docs/decompositions`: pass (grep exit 1, no hits)
- `! grep -qi fleet scripts/reap-worktrees.mjs`: pass (grep exit 1)
- `node scripts/reap-worktrees.mjs selftest`: exit 0, 0 fail
- `npx vitest run <the 3 named test files>`: exit 0, 3 files and 258 tests passed
- `python3 -m json.tool .claude/docs/decompositions/saas-data-utilities.decomp.json`: exit 0
- doc_lint loop over the 6 docs: exit 0
- Scope guard (`git diff --name-only $SDLC_BASE_SHA` filtered to the allowed list, base d77cd9af): empty, pass
- Untracked-files guard: empty, pass
- `npm run check`: exit 0

## Notes
Decisions without another home (I ran `git grep` over `.claude/docs/` for each one; a decision counts as homed only when the grep found it there):

- rulings.md
  - 2026-08-24 (17:xx), Revalidation stays ADR-only, IDR arm scoped out: "0 IDR claims sampled is correct, never a gap finding". The RDD-placeholder rulings (2026-08-20 and 2026-08-24) do have a home in `.claude/docs/rdd/README.md`.
  - 2026-08-09, seat-payload landing leg: "chore-lead's close-out always writes them to `.claude/ops/` before reporting up"
  - 2026-08-08 (reconfirmed 2026-08-09), friendlies standing rule: "hold-first-filing"
  - 2026-08-09, #613 survivor classification: "a survivor classification must run `git fetch --prune` first"
  - 2026-08-09, evidence write-backs: "chore-lead's landing leg owns them"
  - 2026-08-09, #613 practice rule: "reap the branch's worktree BEFORE a --delete-branch merge, or delete the remote branch by hand after"
  - 2026-08-09, ADR harvest targets: "ADR-0173 → new reference file in `component-standards` · ADR-0174 → new skill · ADR-0175 → new reference file in `component-design`". I did not check whether these landed in skills.
  - 2026-08-16, ADR-0008 swiper dim: "NOT accepted as an ADR-0008 exception. Ruling: revert it". No `.claude/docs` hit for the dim token.
  - 2026-08-24, mobilize close-out: "#1609: closed as superseded — the 2026-08-09 keep-list ruling stands" and "#1605: UNPARKED by name"
- plan.md
  - 2026-08-29: "Agent seat retiered to `fable+medium` (Kim's ruling)". Everything else in plan.md is sweep status, or rulings homed in adr-log-mechanics.md and process.md.
- held-items.md
  - 2026-08-23, #1583: "RULED (a) — APP_MARGINAL_BUDGET bumped ~104 B citing ADR-0008 Am.2". ADR-0197 names `APP_MARGINAL_BUDGET` but does not mention #1583.
- handoff-2026-10-04.md
  - none. The Momentum rules live in process.md; the ADR-0064 errata and the NET_NOOP rejection live in ADR-0064 and ADR-0231. The `validate_cross_harness.py` item is an open thread for Kim to decide, not a decision.
- fleet.json
  - 2026-08-29, agent seat tier "fable+medium" (rigour plan I)
  - 2026-08-23, reviewer "sonnet+high"
  - 2026-08-17, planner "fable+medium"
  - 2026-08-22, product "sonnet+xhigh"
  - permission profile, reviewer "deny-edit-write"

Removing the fleet-seat rule means the standing `agent-ui-planner` and `agent-ui-reviewer` worktrees, if present under `.claude/worktrees/`, now classify under rules (a) to (c) only. Once clean and disposed of, `--execute` would reap them.
