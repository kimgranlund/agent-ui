# ADR-0145 — the TICKET tier (only) moves to GitHub Issues; ADR/SPEC/LLD/PRD stay files, always

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat ([TKT-0092](../tickets/tkt-0092-git-native-ticket-backend.md) intake — Kim's `/feature` ask: "transition repo to use git issues, PR, etc.") |
> | **Ratified by** | Kim, 2026-07-18 |
> | **Repairs** | on ratification+build: `CLAUDE.md` (a new entry-file routing-table row: TICKET tier → `gh issue`) · `.claude/skills/agent-ui-doc-standards/SKILL.md` §1/§4 (the ticket dialect row becomes an Issue-Type + label + close-reason contract) · `CONTRIBUTING.md` (the intake-path paragraph) · `site/lib/docs-grammar.test.ts` (the ticket-YAML STRUCTURAL checks retire; nothing replaces them file-side — the Issue-body contract is unenforceable by a markdown-file lint gate) · NEW `.github/ISSUE_TEMPLATE/{feature,bug}.yml` (GitHub issue-forms YAML mirroring the Summary/Acceptance/Links/Scope-Open and Summary/Acceptance/Repro/Expected-Actual/Classification/Severity section contracts) · [TKT-0092](../tickets/tkt-0092-git-native-ticket-backend.md) |
> | **Supersedes / Superseded by** | Narrows [TKT-0092](../tickets/tkt-0092-git-native-ticket-backend.md)'s own literal framing ("GitHub Issues become the sole intent-capture mechanism") to the TICKET tier only — ADR/SPEC/LLD/PRD/PLAN/ROADMAP are explicitly NOT delegated, per the routing-table pattern below. Relates `agent-ui-doc-standards` §1 (the three status dialects — this amends the Ticket row's mechanism, not its taxonomy) and §6 (the archive/historical-record rule, applied to the 92 existing files). Honors the git-native `github-issue-pr-primitives` pack's own boundary: it states platform facts, it does not decide; this ADR is the decision the pack's Findings ground. |

## Context

Kim's ask, as filed: "transition repo to use git issues, PR, etc." TKT-0092's own intake already
confirmed PRs need no change (12 merged PRs, branch→PR→merge already standard here) and that the
gap is entirely on the Issues side (zero GitHub Issues exist; all intent-capture lives in the 92
`.claude/docs/tickets/*.md` files, YAML frontmatter + a dated `## Findings` write-back, per
`agent-ui-doc-standards`).

**A load-bearing correction to the ticket's own framing, found during this design pass.** TKT-0092
reads as "full replacement... the sole intent-capture mechanism going forward" — but this repo's
own doc grammar (`agent-ui-doc-standards` §1) names FOUR document classes with three DIFFERENT
status dialects: TICKET (agent-flippable, work-tracking), and ADR/SPEC/LLD/PRD (ledger/contract
docs, human-ratified, append-only once accepted). The scribe plugin ecosystem this repo's own
`bug-report`/`feature` skills come from has **already ratified a general pattern for exactly this
question, in a different workspace's own ADR-0002** (cited here as "the routing-table pattern" —
never as bare "ADR-0002," to avoid collision with THIS repo's own, unrelated ADR-0002 on A2UI
validator parity): *"a workspace's entry file may route the work-item tier only (TICKET/TASK) to a
git-native backend (`gh issue`)... The decision/contract tiers (ADR, PRD, SPEC, LLD) and
living-state docs (PLAN, ROADMAP) are never delegated — they stay files on this map, always."*
This is not a hypothetical precedent — `scribe:bug-report`'s own dispatch contract already writes
"the ticket's path, **or the issue number + `gh issue comment` as the write-back verb**" as a
first-class alternative, meaning the write-back mechanism this ADR needs (Findings-on-a-closed-
Issue) is already a designed, working pattern elsewhere, not something to invent from scratch here.

**Why the narrower reading is correct, not just cheaper.** ADR/SPEC/LLD/PRD are *decision ledgers* —
append-only once accepted, cited by ID from other docs, versioned as a corpus (`.claude/docs/adr/
README.md`'s Index table, the SPEC↔LLD `Refines:`/`Composes on:` cross-reference spine). GitHub
Issues have no equivalent to an accepted, append-only ledger entry with a stable numeric ID a
sibling document can cite by relative markdown link — an Issue can be edited, reopened, or (rarely)
deleted, none of which this repo's ADR discipline (`adr-status-guard.py`'s own self-flip guard,
the append-only-amendment convention TKT-0091/ADR-0143 used today) tolerates. Migrating THAT tier
to Issues would trade a working, gate-enforced ledger for a weaker primitive with no upside; the
ticket's own motivation ("automation/tooling... GitHub-native machinery... expects Issues as the
substrate") is entirely about work-item TRIAGE (`forge:ops-issues`), which only ever touches the
TICKET tier in the first place.

**Platform facts grounding the mechanism decisions below** (from `github-issue-pr-primitives`,
grounded 2026-07-17 — cited with the pack's own trust markers, not recalled knowledge):
- GitHub's native **Issue Types** — GA 2025-04-09, ships exactly three default types, **Task, Bug,
  Feature** — the same three shapes this repo's ticket `kind` field already names. `[verified]`
- **Issue Fields** (typed, per-Issue-Type-pinned custom metadata, e.g. a Priority/Effort-shaped
  field) reached GA 2026-07-02 — **15 days old** at the cited pack's research date. `[drift-prone]`
- **Sub-issues** (GA 2025-04-09) formalize a hierarchical parent/child Issue link with native
  progress rollup — the now-retired tasklist-block feature (discontinued 2025-04-30) was the
  transitional mechanism; plain markdown checkboxes still work but carry neither hierarchy nor
  rollup. `[verified]`
- A merged PR's `Closes #N` (or `Fixes`/`Resolves`) auto-closes the linked Issue — a
  repository-level toggle, **on by default**, but the exact behavior across all three merge
  strategies (merge/squash/rebase) is `[inferred, not verified]` by GitHub's own docs, not directly
  confirmed. `[verified — toggle] / [inferred — strategy interaction]`
- GitHub Projects v2 wraps Issues/PRs, it never stores a work item on its own — it is not a
  competing backend and needs no ruling here. `[verified]`

## Decision

Four forks (the ticket's own Scope/Open, resolved):

### F1 — scope: the TICKET tier ONLY moves to GitHub Issues; ADR/SPEC/LLD/PRD/PLAN/ROADMAP never do

**Recommendation: narrow TKT-0092's own "full replacement" framing to the TICKET tier**, per the
routing-table pattern quoted in Context. `CLAUDE.md` gains one new routing-table row naming this;
every other document class in `agent-ui-doc-standards` §1's dialect table is completely
untouched — no status-dialect change, no gate change, no citation-convention change for
ADR/SPEC/LLD/PRD. This is the single most consequential decision in this record: it turns a
94-file, four-gate, whole-doc-grammar rewrite into a one-tier, two-gate, much smaller change.

### F2 — Issue mechanism mapping: Issue Types for `kind`, a label for `size`, state+close-reason for `status`

**Recommendation:**
- `kind: bug | feature` → GitHub's native **Issue Type** (`Bug`/`Feature`; the platform's third
  default type, `Task`, is available if a future ticket kind needs it — not used today, since this
  repo's own dialect only names bug/feature). Issue Types are GA, org-wide, and REST/GraphQL
  queryable in a way a label is not — the stronger of the two primitives GitHub offers for exactly
  this taxonomy, and the taxonomy already matches this repo's own naming exactly.
- `size: small | big` → a plain **label** (`size:small`/`size:big`), NOT Issue Fields. Issue Fields
  is 15 days old at the platform-fact pack's own research date and explicitly flagged
  `[drift-prone]` there — betting a whole migration's metadata shape on a feature that young is the
  wrong call when a label does the same job today with zero platform-maturity risk. Revisit as a
  narrow follow-up once Issue Fields has a track record, never bundled into this migration.
- `status: open | doing | done | wontfix` → GitHub Issue **state + close reason**, not a status
  label: `open`/`doing` both map to an OPEN issue (`doing` additionally gets a `doing` label, since
  GitHub's own state has no "in progress" value); `done` maps to a CLOSED issue with GitHub's native
  **"completed"** close reason; `wontfix` maps to a CLOSED issue with the native **"not planned"**
  close reason — both close reasons already exist as a first-class GitHub field, not a label
  standing in for one.
- **`## Findings` write-back** → dated **Issue comments**, appended over time exactly as today's
  dated Findings entries are — GitHub permits commenting on a closed Issue, so `done`/`wontfix`
  status is never a barrier to a later comment. This is not a new mechanism invented here: it is
  the SAME verb `scribe:bug-report`'s own dispatch contract already names ("the issue number +
  `gh issue comment` as the write-back verb").
- **Cross-references to ADR/SPEC/LLD** (which stay files, per F1) → cited from an Issue body as a
  repo-relative path (e.g. `.claude/docs/adr/0143-....md`), which GitHub's Issue markdown renders
  as a working link resolved against the repository's default branch — the SAME citation the ADR
  README's own Index table already uses relative-link form for, just rendered in a different UI
  surface. `[inferred]`: GitHub's exact link-resolution behavior for a bare repo-relative path
  inside Issue markdown (vs. requiring a full `blob/main/...` URL) was not independently
  re-verified against the platform beyond the `github-issue-pr-primitives` pack's own citations —
  named as a build-time check, not assumed silently.

### F3 — migration: the 92 existing ticket files stay a frozen historical archive; NO backfill

**Recommendation: leave every existing `.claude/docs/tickets/*.md` file exactly as committed —
untouched, unmigrated, permanently readable as history.** New tickets from the day this ADR's
build lands go straight to Issues; nothing about the 92 existing files changes. This follows
`agent-ui-doc-standards` §6's own archive rule verbatim ("historical records... keep old paths/
claims verbatim; never rewrite them to match the present") applied to a class of record the repo
is retiring rather than superseding. Bulk-backfilling 92 mostly-`done`/`wontfix` records as closed
Issues would be pure migration busywork with no forward value (nothing queries them going forward;
they are not live work) and risks silently mangling a dated Findings history the tree already
holds correctly. The ID spine (`TKT-####`) simply continues past 0093 as Issue numbers from
whatever number GitHub assigns the first migrated Issue — no attempt to renumber Issues to match
the old TKT sequence; the two numbering spaces coexist, distinguished by where a citation points
(a relative markdown link for a pre-migration `tkt-####`, a bare `#NNN`/issue URL for a
post-migration one).

### F4 — `.github/` scaffolding: yes, author Issue Forms mirroring the TICKET section contract

**Recommendation: author `.github/ISSUE_TEMPLATE/feature.yml` and `bug.yml`** using GitHub's
native Issue Forms YAML (structured fields, not a raw markdown template) so a human filer is
guided into the same Summary/Acceptance/Links/Scope-Open (feature) or Summary/Acceptance/Repro/
Expected-vs-actual/Classification/Severity (bug) shape `agent-ui-doc-standards` §4 already names —
the SAME section contract, carried into the new backend's own native scaffolding mechanism rather
than lost in translation. This is the one piece of this ADR trivial enough it could ship in the
same build wave as the routing-table row itself (two small YAML files, no code/gate risk), but is
recorded here as a Repairs deliverable, not built in this design-only pass.

## Consequences

- `CLAUDE.md` gains one routing-table row; `agent-ui-doc-standards` §1's Ticket dialect row is
  amended (mechanism only — the taxonomy, section contract, and Findings-write-back discipline all
  carry over unchanged, just onto Issues instead of files); §4's section contracts become the Issue
  Forms' own field list, not restated ADR/PRD/SPEC/LLD prose.
- `site/lib/docs-grammar.test.ts`'s ticket-YAML STRUCTURAL checks retire for new tickets (there is
  nothing left on disk to lint once intake moves to Issues) — no file-side replacement exists;
  whatever mechanical check this repo wants over Issue quality going forward is `forge:ops-issues`'
  own job, external to this repo's own vitest gate.
- The 92 existing ticket files remain exactly as they are, forever — this ADR retires the
  CONVENTION going forward, it does not touch the ARCHIVE.
- `forge:ops-issues` becomes wireable against this repo the moment the routing-table row + Issue
  Types + the two templates exist — named as the automation this migration was motivated by,
  confirmed unblocked by this Decision, not built here.
- Nothing about the PR workflow changes (TKT-0092's own non-goal, confirmed still true — 12 merged
  PRs already used GitHub's own merge UI throughout this session).
