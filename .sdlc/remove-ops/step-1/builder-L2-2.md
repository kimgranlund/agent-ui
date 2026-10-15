<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `.claude/ops/scratch` and `.claude/ops`: deleted with `rmdir`. Both were empty untracked directories left behind by the previous attempt.
- Everything else is unchanged from the previous attempt (builder-L2.md): `.claude/ops` (108 tracked files) removed with `git rm`, plus edits to `scripts/reap-worktrees.mjs`, `scripts/reap-branches.mjs`, `state-grammar-gates.test.ts`, `produce.ts`, `produce-loop.test.ts`, `process.md`, `goals.md`, `product-brief.md`, both PRDs, the decomp JSON and `adr-log-mechanics.md`.

## Checks
- `rmdir .claude/ops/scratch .claude/ops`: exit 0
- `test ! -e .claude/ops`: pass
- Untracked-files guard `test -z "$(git ls-files --others --exclude-standard -- . ':(exclude).sdlc')"`: pass
- `! grep -qi fleet scripts/reap-worktrees.mjs`: pass
- I did not rerun the other criteria. The previous verifier passed them all, and removing two empty directories does not affect them.

## Notes
Decisions without another home. These are carried over from the previous attempt. For each one I ran `git grep` over `.claude/docs/`, and a decision counts as homed only when that search found it.

- rulings.md
  - 2026-08-24, Revalidation stays ADR-only and the IDR arm is out of scope: "0 IDR claims sampled is correct, never a gap finding". The RDD-placeholder rulings (2026-08-20 and 2026-08-24) do have a home in `.claude/docs/rdd/README.md`.
  - 2026-08-09, seat-payload landing leg: "chore-lead's close-out always writes them to `.claude/ops/` before reporting up"
  - 2026-08-08 (reconfirmed 2026-08-09), friendlies standing rule: "hold-first-filing"
  - 2026-08-09, #613 survivor classification: "a survivor classification must run `git fetch --prune` first"
  - 2026-08-09, evidence write-backs: "chore-lead's landing leg owns them"
  - 2026-08-09, #613 practice rule: "reap the branch's worktree BEFORE a --delete-branch merge, or delete the remote branch by hand after"
  - 2026-08-09, ADR harvest targets: "ADR-0173 → new reference file in `component-standards` · ADR-0174 → new skill · ADR-0175 → new reference file in `component-design`". Not checked against the skills.
  - 2026-08-16, ADR-0008 swiper dim: "NOT accepted as an ADR-0008 exception. Ruling: revert it"
  - 2026-08-24, mobilize close-out: "#1609: closed as superseded — the 2026-08-09 keep-list ruling stands" and "#1605: UNPARKED by name"
- plan.md
  - 2026-08-29: "Agent seat retiered to `fable+medium` (Kim's ruling)"
- held-items.md
  - 2026-08-23, #1583: "RULED (a) — APP_MARGINAL_BUDGET bumped ~104 B citing ADR-0008 Am.2"
- handoff-2026-10-04.md
  - none
- fleet.json
  - 2026-08-29, agent seat tier "fable+medium"
  - 2026-08-23, reviewer "sonnet+high"
  - 2026-08-17, planner "fable+medium"
  - 2026-08-22, product "sonnet+xhigh"
  - permission profile, reviewer "deny-edit-write"

With the fleet-seat rule gone, the `agent-ui-planner` and `agent-ui-reviewer` worktrees, if they exist, are classified by rules (a) to (c) only. Running with `--execute` could reap them.
