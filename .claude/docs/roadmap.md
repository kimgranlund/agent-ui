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
> moment an issue closes and this doc isn't the place re-reading it. Last synthesis pass: 2026-07-25.

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

**The ledger gap — ruled, no longer open.** `goals.md` stopped at the icon adapter (2026-07-04)
and `CHANGELOG.md` at 2026-07-13; the weeks of shipped work after those dates were never
backfilled. Kim ruled on 2026-07-23: **historical-only** — both stay pure historical ledgers,
append-only going forward, **never backfilled**, and this roadmap's §2 is the one source of
"current state." The gap is therefore the ruled shape of the doc set, not a defect awaiting a
decision (dated line in §4).

## 2 · Now — current state (as of 2026-07-25)

- **Component foundation — complete.** G0–G9 + the Control Suite + the icon adapter: the reactive
  kernel, FACE element layer, templating/directives, and ~50 `ui-*` controls across the
  Indicator/Range/Input/Overlay/Container/report/content/feed/chart families. Closed, not actively
  growing — recent additions are single-control refinements riding reviews (`ui-menu`'s
  selectable-item variant, `ui-disclosure`'s `slot="summary"` foreseen extension — ADR-0158), plus
  one genuinely new control: `ui-sandbox-frame`, the GenUI containment host (below).
  `ui-status-stream` grew the most of any single control this window: worst-child escalation with
  the elapsed-timer/retry refinements (ADR-0146 F5/F6, ADR-0153 — which minted `action`, the
  seventh fleet event name), then the **receipt pattern** (ADR-0159, proposed) — closed-table
  live/done label pairs so a settled step never wears a progressive "-ing…" form, two opt-in
  props (`oneline`: one morphing line while a turn runs; `receipt`: auto-collapse to a one-line
  summary on turn end, error stays loud), and a per-step raw-source reveal (a `progressDetail`
  sibling rung, fail-closed, capped) — all riding the shared `ui-timeline-item` disclosure
  anatomy, zero new public surface on that control.
- **The shell system — the current center of gravity.** The named-archetype family (ADR-0151):
  `ui-super-shell`, a two-level recursive rail+pane grammar on an 18px module, with
  `ui-workspace-shell`/`ui-chat-shell` as presets; resizable panes + tab collapse (ADR-0154); the
  responsive band ladder and menu⇄X toggle law (ADR-0155). `ui-app-shell` is **deprecated** in the
  family's favor (ADR-0156, Option C ruled and ratified) — in-tree and functional through a
  migration window, frozen to new consumers; its one production page is already re-hosted. The
  shell-system **laws** are spec'd and enforced ([shell-archetypes
  SPEC](spec/shell-archetypes-m5.spec.md), accepted v0.7): the two-system spacing ladder (SPEC-R11)
  backed by a deterministic spacing-drift gate born at zero (AC19 — every `@agent-ui/app` sheet
  plus the shell-composing site sheets); scope-proximity display overrides (SPEC-R12); live floors
  that hold under passive resize, not just drag (SPEC-R13, AC20) with measurement-based
  auto-collapse; the mid-window overlay keeping an auto-collapsed side reachable (SPEC-R14,
  AC21); and the narrow-stack canvas floor as a dedicated, reachable axis — the canvas can't be
  squeezed to zero, and its floor is a real scroll seam, not a clipped edge (SPEC-R15). The
  docs-site chrome itself rides the family — down to the nav rail's group labels, which read the
  fleet kicker typescale role rather than a bare font-size.
- **`ui-agent-admin` — re-hosted and reworked.** Its chrome now composes the
  chat-shell/super-shell grammar (ADR-0154); its tab strips are the fleet `ui-tabs` control in the
  ADR-0144 `fill` posture; Settings/Context share one fold pattern (heading-row chevrons); summary
  controls ride `slot="summary"` (ADR-0158). Substance grew too: a provider-grouped model grid
  with a default-radio system, add-from-library capability packs (skills/workflows/resources/
  tools) with real tool execution in the live loop, Surface Options (Markdown · A2UI catalog ·
  GenUI — the once-PRD-gated row now live: a fail-closed off-by-default toggle plus the
  pattern-source picker), and a much larger persona roster (games, hospitality/travel). The
  conversation composer now owns the provider and Gen-UI-mode pickers in-field (the site's
  standalone provider-switcher retired), and the full-viewport standalone surface
  (`agent-admin-app.html`) is a listed, discoverable site page — Kim's 2026-07-25 overturn of the
  earlier deliberate opt-out — while staying shell-less, since its whole point is the production
  surface, not a docs-wrapped preview. The long-standing page-freeze was root-caused and fixed —
  an unbounded synchronous client-turn loop, now bounded and deferred. The chat surface itself is
  chromeless: A2UI render surfaces carry no host background/padding/width-cap on the chat path,
  and agent turns de-bubble entirely
  (sender label above, bare full-width content, streaming included) while user turns keep a
  compact bubble.
- **A2UI layer (`@agent-ui/a2ui`)** — the zero-dep renderer/validator/default-catalog, structural
  resend reconciliation (ADR-0128), and the live-agent **producer toolkit** (ADR-0137, persona
  seam ADR-0138) — now with the live-turn lifecycle progress channel built into the transport
  meta-line (ADR-0146), produce-halt surfacing, in-persona self-correct feedback, and the dev
  live-agent proxy ported to a Cloudflare Worker (ADR-0152).
- **GenUI surface — shipped end to end (B0–B2).** The ruled identity: free-form HTML/CSS/JS in a
  sandboxed iframe — "contained, not forbidden" ([PRD](prd/genui-surface.prd.md) v0.4 ·
  [SPEC](spec/genui-surface.spec.md) v0.3, both `proposed`, every fork ruled; D6 = the in-house
  wire, MCP-Apps-shaped safety model, atomic HTML). `ui-sandbox-frame` (components) is the
  fail-closed containment host — CSP · closed agent↔frame bridge · token bridge. B2 made the
  path real: the canonical wire reader/writer at `@agent-ui/a2ui/agent` (`genui-line` — the
  site's B1-era stub is now a thin re-export of it), `produce()` peeling genui lines ahead of
  heal/validate with structural defects tallied as `GENUI_*` failure codes on the turn trace,
  three curated pattern-source packs plus a degradation-safe prompt block (SPEC-R9), and
  `ui-agent-admin` mounting GenUI surfaces inside its real turn loop on a parallel path beside
  the A2UI client. The `gen-ui-live` site demo stays deliberately recorded-only. What's left is
  out of the SPEC's own contract: B3, the judged pack-idiom eval (§4).
- **A2A protocol layer (`@agent-ui/a2a`)** — pinned to spec v0.3.0, the tic-tac-toe
  isolation-proof arena, its own concepts corpus.
- **`@agent-ui/router`** — the memory-first SPA router (ADR-0115).
- **`@agent-ui/code`** — the code+prose family: zero-dep core, `./highlight`, `./markdown`, and
  `./editor` (`ui-code-editor`, CodeMirror 6 — the one sanctioned runtime dependency, ADR-0139) —
  now with a richtext live-preview mode whose revealed line is raw source only (ADR-0147, as
  amended).
- **Theming** — the `--md-sys-*` consolidation (ADR-0140), the theme-pack pipeline (ADR-0141, 10
  packs live in the docs-site header), the theme-provider ink re-root at scheme boundaries
  (ADR-0148), and the fleet's one viewport-responsive token, the compact-body breakpoint
  (ADR-0150).
- **Published and deployed.** The packages publish **scoped as `@agent-ui-kit/*`** to the live npm
  registry — per-package READMEs with CDN usage, an install-from-registry consumer smoke in CI —
  and the docs site auto-deploys to `ui.nonoun.io` on every push to main. This closes the
  library-emit deferral that sat in §4 since G8 (dated line below).
- **Vocabulary + process.** The anatomy-attribute axis vocabulary is law (ADR-0157 →
  [`references/naming.md`](references/naming.md) §6): `data-part` = control-created anatomy,
  `data-slot` = the consumer-side slot claim, orthogonal state/variant axes each their own
  attribute, `data-role` = author content-model kinds. ADR ratification is PR-native and
  mechanized — Kim's utterance, verified and flipped by script (ADR-0149). The ticket archive
  under `.claude/docs/tickets/` is now **fully closed** (98 files; the last two stragglers shipped
  — see §4); all work-item churn lives in GitHub Issues (ADR-0145). Gate hygiene hardened in the
  same window: the browser gate runs six sequential shards including the isolated focus-timing
  class, and the visual gate is deterministic (zero pixel tolerance when re-capturing baselines;
  calendar baselines pinned to a never-today month).

## 3 · Next — concrete, near-term

- **The `ui-app-shell` removal horizon (ADR-0156).** Migration is DONE: the production
  consumer re-hosted, the two reconnect fixtures re-vehicled onto a direct re-parent harness (the
  `<ui-app-shell isolated>` relocation harness retired from both), and the teaching page retired —
  its one surviving teaching, the ADR-0083 landmark-decouple law, re-scoped onto the super-shell
  page as family law. What remains is the removal gate itself (folder + exports retire,
  ADR-0082/0083/0084 flip `superseded`, CLAUDE.md/README/getting-started rows update — ADR-0156
  clauses 4–5 name the full surface), dispatched as its own separately-gated issue.
- **AC19's sheet set — widen deliberately, or not.** The spacing-drift gate covers the shell
  family today (every `@agent-ui/app` sheet + the shell-composing site sheets). Whether it extends
  further — components-package sheets, the remaining site sheets — is an open, per-sheet decision;
  the gate's own design makes each extension a one-line reviewed append, never automatic.
- **Beyond that, the backlog is clear.** The one open item is the removal-gate issue named above —
  its build is in flight, and the ADR-0082/0083/0084 `superseded` flips at its heart remain Kim's
  own to perform, which an agent cannot. Nothing else is
  outstanding; the next feature arc is Kim's call at the next intake. (The older proposed scope
  intakes — content, feed, and report families, the a2ui expert system — remain parked intakes,
  not scheduled work.)

## 4 · Later — deferred, revisit-triggered

- **Linear, for this repo specifically.** ADR-0145 chose GitHub Issues as the work-item backend
  here. If Linear becomes the standard elsewhere in the user's work, the open question is whether
  this repo follows (and how the ID-spine convention — ADR/SPEC/LLD citing an issue — survives a
  backend swap) — not a live fork today, just the thing that would reopen ADR-0145 if raised.
- **GenUI B3 — the judged pack-idiom eval.** Out of the GenUI SPEC's contract by its own §6 cut:
  PRD §8 m3 (judge-scored pack-idiom use) realized as a judged corpus-rubric shard plus its docs
  page (PRD-G6) — a named manual live-model run, never part of the deterministic gates (SPEC-N3).
  Revisit when the producer's output quality needs a measured floor.

---

*Closed items move here, one dated line each, rather than being deleted from §3 silently:*

- **2026-07-18** — [ADR-0143](adr/0143-timeline-item-recursive-nesting-accordion.md) shipped:
  `ui-timeline-item` recursive nesting + shared accordion (TKT-0091, commits `a726a8b`/`fe6fe00`).
- **2026-07-23** — [ADR-0144](adr/0144-pane-tab-content-region-rule-system.md) built: the pane/tab
  content-region rule system — `ui-tabs`' opt-in `fill` posture shipped (CSS-only, `tabs.ts`/
  `tabs.css`) and composes `ui-agent-admin`'s strips; TKT-0093 closed.
- **2026-07-23** — [ADR-0146](adr/0146-live-turn-lifecycle-progress-channel.md) built: the
  live-turn lifecycle progress channel (the transport meta-line) plus the status-stream
  grouping/escalation legs (F5/F6, refined by ADR-0153); TKT-0083 closed. With both stragglers
  done the frozen ticket archive is fully closed.
- **2026-07-23** — the "ratification-lag backlog" item for ADR-0131–0137 verified **moot**: every
  one of those files has carried `accepted` since its shipping session — what actually lagged is
  the README index rows. Repaired the same day the synthesis found it (record hygiene,
  Kim-authorized, no Status cell touched): all seven index rows aligned (six in the first pass,
  the 0134 row — missed by that pass's own row check — in the follow-up that shipped with this
  synthesis) + three contradictory Ratified-by cells corrected.
- **2026-07-23** — the `goals.md`/`CHANGELOG.md` backfill question **decided** (Kim, 2026-07-23):
  historical-only — both stay pure historical ledgers, append-only going forward, never
  backfilled; this roadmap is the one source of "current state" (§1).
- **2026-07-23** — **library emit / publish** (a §4 deferral since G8) resolved: the packages
  publish scoped as `@agent-ui-kit/*` to the live registry, proven by an install-from-registry
  consumer smoke in CI, and the docs site auto-deploys to `ui.nonoun.io` on push to main.
- **2026-07-24** — **GenUI B1 shipped** (§3's named next slice at the last pass): `ui-sandbox-frame`,
  the fail-closed GenUI containment host, landed in components with its doc + demo pages, followed
  the same day by the recorded `gen-ui-live` chat demo.
- **2026-07-25** — **GenUI B2 shipped**, closing the arc's buildable slices (B0–B2): the canonical
  wire reader/writer at `@agent-ui/a2ui/agent`, `produce()`'s genui-line peel with `GENUI_*`
  failure codes on the turn trace, the three pattern-source packs + degradation-safe prompt block
  (SPEC-R9 — its prompt-loading parenthetical corrected by the SPEC's docs-only v0.3 amendment),
  the admin Surface-Options GenUI row gone live, and the parallel mount path into agent-admin's
  real turn loop. The GenUI entry retires from §3 into §2's current state; B3 stays deferred (§4).
