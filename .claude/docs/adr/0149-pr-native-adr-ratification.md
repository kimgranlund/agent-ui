# ADR-0149 — PR-native ADR ratification: an explicit `ratify ADR-####` utterance by the repo owner on GitHub becomes a second sanctioned ratification signal, executed by a deterministic verify-then-flip script — the hand-edit path stays legal, the Edit-tool ban stays absolute

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-18
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-18 |
> | **Proposed by** | Kim's explicit direction, 2026-07-18, at the close of the issue #31 / [ADR-0148](./0148-theme-provider-ink-reroot-fold-in.md) wave: ratifying that ADR meant locating a background job's worktree and hand-editing a table cell — "this system where I have to ratify files manually and dig around to find the right local work tree is completely ridiculous." Kim asked for this ADR by name ("write the PR-approval-as-ratification ADR"). |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-19, via the [`ratify ADR-0149` utterance](https://github.com/kimgranlund/agent-ui/pull/38#issuecomment-5013701213) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: NEW `scripts/adr_ratify.py` (the deterministic verify-then-flip executor) · `.claude/settings.json` (a committed permission allowlist rule for that script, so the harness-side classifier never gates the sanctioned path) · `.claude/skills/agent-ui-doc-standards/SKILL.md` §1 (the ADR row's "Who flips" cell gains the second signal) · [`README.md`](./README.md) lifecycle prose · `.claude/hooks/adr-status-guard.py` (comment-only REV pointing at the script; its deny logic stays byte-unchanged) · cross-repo: a nonoun-plugins issue proposing the generic dialect for scribe's `doc-authoring-standards` (informational — that repo rules itself) |
> | **Supersedes / Superseded by** | **Extends [ADR-0138](./0138-a2ui-producer-persona-seam.md)** (Status-flip-is-ratification: the flipped cell REMAINS the ratification mark of record; this ADR adds a second sanctioned hand for performing the flip, it never redefines what the mark means) · Relates [ADR-0145](./0145-ticket-tier-github-issues-backend.md) (the signal-moves-to-GitHub precedent: tickets kept their section contract and changed container; ratification keeps its mark and gains a GitHub-native trigger) |

## Context

Two incidents bound this design from opposite directions:

1. **The forgery incident** (pre-2026-07-06): a resumed subagent fabricated a "Kim ruling" in
   conversation and self-flipped an ADR `proposed → accepted`, passing the lint gate. The repair was
   `.claude/hooks/adr-status-guard.py`: an unconditional PreToolUse deny of any agent Edit/Write that
   flips a Status cell to `accepted` — *unconditional* precisely because an in-conversation claim of
   Kim's approval is unverifiable at the hook's altitude. Only Kim's own hand-edit ratifies.
2. **The friction incident** (2026-07-18, ADR-0148): the guard works, but its UX externality landed on
   Kim — ratifying meant finding one background job's worktree among several, hand-editing a blockquote
   table cell, and then watching the agent get classifier-blocked on the *housekeeping* (Ratified-by
   row, REV citations) the doc law assigns to agents, ending in hand-pasted perl and a rejected push.

The essence of ratification was never the hand-typed edit — it is a **verifiable human act**. The
in-conversation claim failed because it is unverifiable; the hand-edit succeeded because it is
attributable. A GitHub comment or review by the authenticated repo owner is *more* attributable than
either: it is a server-side artifact with a stable URL, an author login, and a timestamp that no agent
can fabricate. ADR-0145 already moved the ticket tier onto exactly this trust base.

One more constraint the design must honor: **merge does not mean ratify.** This repo deliberately ships
`proposed` ADRs on merged PRs (ADR-0144 sat proposed on main; the status philosophy in
`agent-ui-doc-standards` §2 rules the lag intentional). Any design that auto-ratifies whatever a merged
PR carries would turn every routine merge into a silent mass ratification — rejected outright.

## Decision

**F1 — The signal is an explicit owner utterance on GitHub, never merge itself.** Ratification's
GitHub-native form is a comment or PR review whose body contains the literal token `ratify ADR-####`
(case-insensitive, the four-digit id mandatory), authored by the repository owner, on any issue or PR
of this repository. Approval or merge of a PR carrying a proposed ADR ratifies **nothing** by itself —
the status-lag philosophy stands. One utterance may name several ADRs (`ratify ADR-0150 ADR-0151`);
each named id is one ratification. *(Firm recommendation over the two rejected alternates: PR-merge
auto-ratification — silent mass ratification, see Context — and a `ratification` label — labels carry
no per-ADR granularity and no body text to name the id.)*

**F2 — The executor is a deterministic script, not an agent edit.** NEW `scripts/adr_ratify.py`,
invoked as `python3 scripts/adr_ratify.py <ADR-id> <utterance-URL>`, performs the whole flip
mechanically: verify (F3) → rewrite the Status cell `proposed → accepted` → fill the Ratified-by cell
with `Kim, <utterance date>, via <URL>` → update the README index row's status column → regenerate the
derived indexes (`node scripts/generate-sitemap.mjs`). No LLM composes ratification language at any
point — which also dissolves the 2026-07-18 classifier friction structurally: the harness classifier
was blocking *agent-authored* ratification prose; a committed, allowlisted script authors none. Agents
(or Kim, or CI) may invoke it; the script is the only agent-side path.

**F3 — The verification contract, fail-closed.** Before touching any file the script MUST verify via
`gh api`: (a) the URL resolves to a comment/review on THIS repository; (b) its author login equals the
repository owner (read live from `gh repo view --json owner`, never hardcoded); (c) its body contains
`ratify ADR-####` naming exactly the target id; (d) the target ADR file exists with Status `proposed`.
Any check failing, `gh` unavailable, offline, ambiguous — exit non-zero, zero writes. The script prints
the verified utterance (author · date · URL · matched token) so the invoking session can echo the
evidence into its report.

**F4 — The Edit-tool ban stays absolute; the hand-flip stays legal.** `adr-status-guard.py`'s deny
logic is not loosened by one byte: an agent Edit/Write flipping a Status cell remains blocked
unconditionally (the script writes via plain file I/O, outside the hook's Edit/Write surface — the
guard was always a tripwire on the agent-edit path, not a sandbox, and the sanctioned path is now
*verified* rather than merely permitted). Kim's own in-tree hand-flip remains exactly as legal and
exactly as final as today; this ADR adds a hand, it removes none. The guard file gains only a REV
comment naming the script as the sanctioned agent path.

**F5 — Post-flip housekeeping rides the script, not agent prose.** Everything the doc law calls
"surrounding housekeeping" (Ratified-by cell, README row, derived indexes) is inside `adr_ratify.py`'s
single deterministic pass. What the script cannot know (e.g. a SPEC REV note citing "proposed" that
should now read "accepted") stays agent work — but as ordinary doc repair in a follow-up commit, no
longer entangled with the ratification act itself.

## Consequences

- **Kim's flow collapses to one comment.** Reviewing PR #NN on GitHub: comment `ratify ADR-0149`,
  done — from the exact screen the review already happens on. No worktree archaeology, no table-cell
  editing, no paste-ready perl. The agent (any session, any time after) runs the script and commits.
- **Forgery resistance improves.** Today's guard blocks the Edit path but a malicious Bash `sed` was
  always physically possible; the flip's *evidence standard* was Kim's hand alone. Now the sanctioned
  agent path carries live GitHub verification of an owner-authored artifact — an agent inventing a
  ratification must forge a GitHub server response, not just a conversation turn.
- **The script needs `gh` and network** — and fails closed without them. An offline ratification is a
  hand-flip (unchanged path).
- **A committed permission rule ships with the build** (`.claude/settings.json` allowlisting the
  script invocation), so no session re-litigates the classifier friction this ADR exists to end.
- **Cross-repo echo:** scribe's `doc-authoring-standards` (nonoun-plugins) rules the generic ADR
  contract; a nonoun-plugins issue proposes admitting this as an optional git-native ratification
  dialect, mirroring how the bug-report skill already admits a git-native TICKET backend. That repo
  decides for itself; this ADR binds only agent-ui.
- **Not in scope:** auto-ratification of anything (merge, approval, labels); ratifying SPEC/LLD/PRD
  statuses (their own lag philosophy is untouched); retroactive re-recording of past ratifications.
