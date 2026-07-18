# agent-ui — roadmap

> Status: living, forward-looking. Companion to [`plan.md`](./plan.md) (architecture — the closed
> foundation build) and [`goals.md`](./goals.md) (the dated milestone/DoD ledger). Distinct from
> both: this file is prose + priority, not a checklist of what already shipped — it says what's
> current and what's next, and is **revised in place** at each synthesis pass rather than appended
> to forever (the one exception: closed items move to a dated line under §4, never silently
> deleted). Work-item tracking — the churn of individual bugs/features, their status, comments —
> lives in GitHub Issues ([ADR-0145](adr/0145-ticket-tier-github-issues-backend.md)) or, on other
> projects, Linear — **never here**. An issue may cite a section of this doc the same way it cites
> an ADR/SPEC/LLD id; this doc never enumerates issues by number, because that list goes stale the
> moment an issue closes and this doc isn't the place re-reading it. Last synthesis pass: 2026-07-18.

## 1 · Why a fourth doc

Four documents now cover four different questions, and conflating any two of them is exactly the
kind of drift `process.md` exists to prevent:

| Doc | Question it answers | Shape | Update cadence |
|---|---|---|---|
| [`plan.md`](./plan.md) | What is this, architecturally, and why these choices? | Prose, mostly closed/historical | Rare — only when a foundational decision moves |
| [`goals.md`](./goals.md) | What did each milestone require, and is it done? | Dated milestones, DoD checklists | Per milestone close (append-only in spirit) |
| `CHANGELOG.md` | What shipped, and when? | Dated, one entry per ticket/wave | Per ship |
| **`roadmap.md`** (this file) | What's true *right now*, and what's next — and why? | Now/Next/Later, revised in place | Per synthesis pass (milestone boundary or ratification batch) — **not** per commit |
| GitHub Issues (or Linear) | What's the status of *this one* bug/feature? | Individual records | Continuous |

The split that matters: **issues own the churn, this doc owns the narrative.** An issue tracker
fragments into hundreds of atomic, mostly-closed records — nothing in it coalesces into "where is
this project going and why." A roadmap trapped inside a SaaS tool's project view has the opposite
problem — invisible to anyone (or any agent) reading the repo directly, and it doesn't survive a
tool swap. So the narrative stays a versioned file, diffable and git-blamable next to the code it
describes, and issues/PRs *cite into it* rather than replace it.

**Known gap, named rather than silently carried forward:** `goals.md` stopped at the icon adapter
(2026-07-04) and `CHANGELOG.md` stopped at TKT-0026 (2026-07-13). Two weeks of real, shipped,
committed work — the A2UI game-loop arc, `@agent-ui/a2a`, `@agent-ui/router`, the `@agent-ui/code`
family, the `--md-sys-*` token consolidation, 10 theme packs, and the GitHub Issues migration
itself — never got backfilled into either. This roadmap's §2 is accurate as of its synthesis date
regardless; whether `goals.md`/`CHANGELOG.md` get a backfill pass or stay purely historical from
here forward is an open call, listed in §3.

## 2 · Now — current state (as of 2026-07-18)

- **Component foundation — complete.** G0–G9 + the Control Suite (Waves 0–5) + the icon adapter:
  the reactive kernel, FACE element layer, templating/directives, and 37+ `ui-*` controls across
  the Indicator/Range/Input/Overlay/Container/report/content/feed/chart families. This tier is
  closed, not actively growing except by individual component additions.
- **A2UI layer (`@agent-ui/a2ui`)** — the zero-dep renderer/validator/default-catalog, structural
  resend reconciliation (ADR-0128), and a live-agent **producer toolkit**: exportable `./agent`
  subpath (ADR-0137), a persona seam (ADR-0138), and a game-UI mini-skill trio.
- **A2A protocol layer (`@agent-ui/a2a`)** — pinned to spec v0.3.0, the tic-tac-toe isolation-proof
  arena, its own concepts corpus.
- **`@agent-ui/router`** — the memory-first SPA router (ADR-0115).
- **`@agent-ui/code`** — the code+prose family: zero-dep core, `./highlight` (7 tokenizers),
  `./markdown` (`ui-markdown`), and `./editor` (`ui-code-editor`, CodeMirror 6 — the one sanctioned
  runtime dependency in the whole fleet, ADR-0139).
- **`@agent-ui/app`** — the agent-app-shell, the `ui-agent-admin` surface (chat + a generic
  ordered-entry-list Instructions/Capabilities architecture, ADR-0132), the unified nav-rail
  family (ADR-0130), `ui-conversation`/`ui-surface-host` primitives (ADR-0129).
- **Theming** — the `--md-sys-*` system-token consolidation (ADR-0140) and the Ultimate Tokens
  theme-pack pipeline (ADR-0141): **10 theme packs shipped**, dogfooded live in the docs-site
  shell header's scheme/theme controls (TKT-0088/0096).
- **Docs site** — the full component + A2UI/A2A doc corpus, an `llms.txt` index, conceptual guide
  pages (getting-started, theming, tokens, sizing, forms, choosing).
- **Process** — the TICKET tier just moved to GitHub Issues
  ([ADR-0145](adr/0145-ticket-tier-github-issues-backend.md), shipped 2026-07-18);
  `.claude/docs/tickets/` is now a frozen historical archive (98 files through TKT-0096, plus three
  still-open stragglers named in §3). ADR/PRD/SPEC/LLD stay files, always — never delegated.

## 3 · Next — concrete, near-term

- **Three ratified ADRs, not yet built.** Design intake landed and Kim ratified all three
  today, but no build commit exists yet for any of them:
  - [ADR-0143](adr/0143-timeline-item-recursive-nesting-accordion.md) — `ui-timeline-item`
    recursive nesting + shared accordion (ticket: TKT-0091, still `status: open`).
  - [ADR-0144](adr/0144-pane-tab-content-region-rule-system.md) — the pane/tab content-region rule
    system, `ui-tabs` `fill` posture (ticket: TKT-0093, still `status: open`).
  - [ADR-0146](adr/0146-live-turn-lifecycle-progress-channel.md) — the live-turn lifecycle
    progress channel on `AgentTransport` (ticket: TKT-0083, still `status: open`).

  These three are the last open records in the now-frozen ticket archive — building each should
  close its ticket AND, per §1's split, get filed/mirrored as a real GitHub Issue going forward
  rather than a new ticket file.

- **ADR ratification-lag backlog.** The same pattern just cleared for ADRs 0140–0146 (built and
  shipped, but sitting at `proposed` until Kim's explicit flip) recurs for at least
  **ADR-0131 through ADR-0137** (agent-admin instructions/capabilities, button label ellipsis,
  `ui-textarea`, the agent-harness config schema, the dev-only live overlay, the producer-toolkit
  export) — all have real shipped commits but the README still reads `proposed`. Worth a batch
  ratification sweep the same way, rather than each one lingering indefinitely.
- **`goals.md`/`CHANGELOG.md` backfill decision.** Named in §1 as a known gap — either run a
  synthesis pass to bring both current through today, or explicitly decide this roadmap is the
  new source of "current state" and let those two stay pure historical ledgers (never backfilled,
  only appended to going forward). Undecided; listed here so it doesn't silently resolve itself
  by being forgotten.

## 4 · Later — deferred, revisit-triggered

- **Library emit / publish** (`plan.md` §12). Deferred since G8: no external, out-of-repo consumer
  exists yet. Revisit trigger unchanged — the first real consumer, or an explicit publish decision.
- **Linear, for this repo specifically.** ADR-0145 chose GitHub Issues as the work-item backend
  here. If Linear becomes the standard elsewhere in the user's work, the open question is whether
  this repo follows (and how the ID-spine convention — ADR/SPEC/LLD citing an issue — survives a
  backend swap) — not a live fork today, just the thing that would reopen ADR-0145 if raised.

---

*Closed items move here, one dated line each, rather than being deleted from §3 silently:*

- *(none yet — this section seeds the first time a §3 item ships)*
