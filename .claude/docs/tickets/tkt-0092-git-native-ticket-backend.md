---
doc-type: ticket
id: tkt-0092
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0092 — transition intent-capture from `.claude/docs/tickets/*.md` to GitHub Issues (git-native backend)

## Summary
Kim's seed (2026-07-17, `/feature` intake): "transition repo to use git issues, PR, etc."

**Grounded before sizing (one clarifying round):**
- **PRs are already the norm here** — 12 merged PRs to date, each tied to a `TKT-####` ticket file
  (`gh pr list` confirms), branched off `main` (often via `worktree-tkt-####-*` branches) and merged
  through GitHub's own merge UI. No change needed on the PR side.
- **GitHub Issues are unused** — zero issues exist (`gh issue list --state all` is empty). All
  intent-capture today lives in `.claude/docs/tickets/*.md` (92 files as of this writing): YAML
  frontmatter (`doc-type: ticket`, `id`, `status`, `date`, `owner`, `kind`, `size`) + Summary ·
  Acceptance · Links · Scope/Open · a dated `## Findings` write-back, per the `kind`-specific
  section contract in `agent-ui-doc-standards`. This is wired into `CLAUDE.md`, `CONTRIBUTING.md`,
  the `agent-ui-doc-standards` skill, and enforced by `site/lib/docs-grammar.test.ts`'s lint gates.
- **Scope, confirmed:** full replacement, not a mirror. GitHub Issues become the sole
  intent-capture mechanism going forward; the markdown ticket file convention is retired.
- **Driver, confirmed:** automation/tooling — wanting to use GitHub-native machinery (the
  `forge:ops-issues` intake/triage seat, `gh` CLI scripting, GitHub Projects, issue↔PR linking)
  that expects Issues as the substrate, rather than external visibility for its own sake.
- **No routing-table ruling exists yet.** Per `scribe:feature`'s backend-seam rule, absent an
  ADR-0002-style ruling in the entry files naming a git-native backend, this record itself is
  captured as a ticket file (last one, potentially) — not as a live GitHub Issue.

## Acceptance
This ticket is intake only (`/feature`'s contract: ends in a record, never a build). It is
"done" once a design pass has resolved the Scope/Open items below into an ADR (the fork itself:
ticket-backend file → git-native) and, if the ADR is ratified, a build ships:
- An ADR proposed and (pending Kim's ratification) accepted, naming GitHub Issues as the ticket
  backend, per the ADR-default-no ruling this repo already follows for contract-changing forks.
- `agent-ui-doc-standards` rewritten: the TICKET dialect's section contract re-expressed as an
  Issue body contract (labels for `kind`/`size`, `status` as issue state + label, the ID spine's
  `TKT-####` becoming the issue number or a mapping rule) — decided by the ADR, not this ticket.
- `CLAUDE.md`/`CONTRIBUTING.md` updated to describe the new intake path.
- A decision recorded (in the ADR) for what happens to the 92 existing ticket files: left as
  historical record, bulk-migrated to backfilled Issues, or something narrower — not resolved here.
- The `docs-grammar.test.ts` lint gate updated or replaced to match whatever the ADR settles on
  (a markdown-file lint gate cannot validate GitHub Issue bodies as-is).
- Whatever `forge:ops-issues` needs from this repo (labels, a friendlies allow-list, a routing
  rule) to actually pick up the automation this ticket is motivated by.

## Links
- `CLAUDE.md` / `CONTRIBUTING.md` — the current file-backend contributing process this supersedes.
- `.claude/skills/agent-ui-doc-standards/` — owns the TICKET dialect being replaced.
- `site/lib/docs-grammar.test.ts` — the lint gate enforcing today's ticket shape.
- `.claude/docs/tickets/` — the 92 existing records whose fate the ADR must decide.
- `forge:ops-issues` (plugin skill) — the standing intake/triage seat this transition is meant to
  unlock; not yet wired to this repo (no `.github/` directory exists).
- `forge:github-issue-pr-primitives` (plugin skill) — Issue/PR mechanics reference for whoever
  authors the follow-on ADR/build.

## Scope / Open
- **Backend fork — NOT resolved here:** this ticket names the destination (GitHub Issues, full
  replacement) but the mechanics — how `kind`/`size`/`status` map to labels vs. issue state, how
  `## Findings` write-back works on an issue that closes, how cross-references between an Issue
  and an ADR/SPEC/LLD stay citable — are a design decision for whoever authors the ADR
  (`orchestration:system-planner`, or Kim directly), not decided by this intake.
- **Migration fork — NOT resolved here:** what happens to the 92 existing `.claude/docs/tickets/
  *.md` files (leave as historical archive / bulk-backfill as closed Issues / something else).
- **`.github/` scaffolding — NOT resolved here:** whether an `ISSUE_TEMPLATE` is authored to mirror
  the section contract for human filers, per `scribe:feature`'s own convention for the git-native
  backend.
- **Non-goal (already true, no change needed):** the PR workflow itself — branch → PR → merge —
  already matches standard GitHub practice; this ticket is about Issues, not PRs.
- Size is **big**: contract-changing (retires a fleet-wide doc convention cited by 92 files, a
  skill, two lint gates, and CLAUDE.md/CONTRIBUTING.md) — earns an ADR at minimum, likely a SPEC
  for the new Issue-body contract before any build starts.

## Findings

**2026-07-17 — design pass complete: [ADR-0145](../adr/0145-ticket-tier-github-issues-backend.md)
(proposed, awaits Kim's ratification).** Ran the design pass this ticket's own Acceptance names as
the "done" condition — resolved the backend/migration/scaffolding forks into a proposed ADR, no
build. Grounded against `forge:github-issue-pr-primitives`'s dated, cited platform-fact corpus
(GitHub Issue Types GA 2025-04-09, Issue Fields GA 2026-07-02 — 15 days old at that pack's own
research date, sub-issues GA 2025-04-09) rather than recalled knowledge.

- **The load-bearing correction:** this ticket's own "full replacement... sole intent-capture
  mechanism" framing is narrower than it reads. The scribe plugin ecosystem this repo's
  `bug-report`/`feature` skills come from has already ratified a general routing-table pattern (a
  DIFFERENT workspace's own "ADR-0002 pattern" — never cited bare as "ADR-0002" in ADR-0145 itself,
  since that number is already taken in THIS repo by an unrelated A2UI validator ADR): only the
  work-item (TICKET) tier ever delegates to `gh issue`; ADR/SPEC/LLD/PRD/PLAN/ROADMAP never do —
  they stay files, always. ADR-0145 narrows the scope to match.
- **Mechanism mapping (F2):** `kind` → native Issue Types (the stronger, GA-for-over-a-year
  primitive, exact taxonomy match); `size` → a plain label (Issue Fields is too young to bet a
  migration on); `status` → Issue state + native close-reason (completed/not planned), not a
  status label; `## Findings` write-back → dated Issue comments — the SAME verb
  `scribe:bug-report`'s own dispatch contract already names, not invented here.
- **Migration (F3):** the 92 existing ticket files stay a frozen, unmigrated archive per
  `agent-ui-doc-standards` §6's own historical-record rule — no bulk backfill, no busywork.
- **Scaffolding (F4):** `.github/ISSUE_TEMPLATE/{feature,bug}.yml` (GitHub's native Issue Forms
  YAML) recommended, mirroring the existing section contract — a Repairs deliverable, not built in
  this design-only pass.
- **No build dispatched** — per Acceptance, ADR-0145 needs Kim's ratification first.

**2026-07-18 — ratified and built; this is the LAST edit this file ever gets.** Kim ratified
ADR-0145 to `accepted` (`b349d9f`); the build landed same day (`4c32e8e`): `.github/ISSUE_TEMPLATE/
{feature,bug}.yml` Issue Forms, `CLAUDE.md`/`CONTRIBUTING.md`/`agent-ui-doc-standards` updated to
describe the new mechanism, `docs-grammar.test.ts`'s ticket-YAML STRUCTURAL check retired (nothing
left to lint file-side). One real correction surfaced during the build and amended into ADR-0145
itself: native GitHub Issue Types (F2's original recommendation for `kind`) turned out to be an
org-level-only feature, unavailable on this personal-account repo — Kim ruled a fallback to plain
`bug`/`enhancement` labels rather than converting the repo to an org. `npm run check` clean, full
vitest 353/6373 green. `.claude/docs/tickets/` is now a frozen historical archive (98 files through
TKT-0096) — this ticket's own status flip above is the archive's last legitimate edit, closing the
loop this ticket itself opened, not new work.
