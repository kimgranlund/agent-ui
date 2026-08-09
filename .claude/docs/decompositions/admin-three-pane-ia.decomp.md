# Admin three-pane IA family — decomposition (GH #651)

> Status: proposed · v0.1 · 2026-08-09 · planner. Design intake for GH #651's IA restructure —
> agent-admin's six flattened section tabs + the try-it strip become THREE first-class panes
> **[Chat | Author | Settings]**, the toggle dissolves, and the live-hydration adjacency survives
> via a wide-viewport pairing. Run in the GH #633/#490 pattern: one manifest, two-plane coverage,
> per-slice doc-tier right-sizing, named OQs with owners. The companion
> [ADR-0179](../adr/0179-agent-admin-three-pane-ia.md) (PROPOSED — Kim ratifies) carries the
> ratified-direction record + the two genuine forks (wide-pairing mechanism ruled; one-composer
> routing carried as OF-Kim); this doc sequences against it, never re-derives it.
> `break-down-problem` is not installed in this repo's `.claude/`; its two-plane method is applied
> inline — §3's coverage table is the manual equivalent (the `agent-authoring-flow.decomp.md` /
> `identity-flow.decomp.md` precedent).

## 0 · Bound substrate (read, not duplicated — cited by ID below)

- **What this REOPENS:** `agent-authoring-flow.lld.md` §5's dual-context anatomy — precisely
  split at intake: the chat-stack *as a stacking vehicle*, the `#mode`/`#setMode`/`#applyMode`
  seam, and the try-it strip are **IA (retire)**; the two mounted conversations, `#contextFor()`'s
  store/conversation/session/history quadruple-picking, the per-context histories (GH #644), the
  runner's session map, the consumption fence + gate conjunct, the GH #145 reset laws, the
  `persona-patch.ts` apply chain, and the Builder persona are **mechanism (survive, re-homed)**.
  Verified against shipped source at intake: the fence is `drivingStore === this.authoringStore`
  (`agent-admin.ts:1798 (post-#650 numbering; symbol: the `drivingStore === this.authoringStore` conjunct in the patch-receipt check)`) — selector-independent; `#contextFor()` (1094–1108 (post-#650 numbering; symbol: `#contextFor()`)) is the only place
  `#mode` feeds it.
- **PR #650 (`task/646-try-it-tabs`, commits `30f3c7d1`→`787c693e`):** the try-it strip's
  `ui-tabs` rework — ships INDEPENDENTLY first; this family supersedes its PLACEMENT, not its
  mechanisms. Survives regardless: the `chat-shell.css` headerless narrow-tabs split (GH #380's
  `:has(> [data-bar='header'])` idiom — a fleet-shared fact) and the screen-x pixel-truth probe
  method (anchor to the conversation card's border-box edge, frame-independent).
- **Today's anatomy:** `ui-chat-shell` (`narrow-end="tabs"`, GH #52/ADR-0154), content =
  chat-stack, FIVE `options-pane` segments (Agent · Capabilities · Surface · Context: System ·
  Context: Dialog — GH #574/#161's splits), every section a heading-row fold (GH #225), all
  strips visibility-only (SPEC-R7c). Entry architecture: ADR-0132/0164/0170 (one entry-list
  primitive, `validateNewEntry` the single add path) — untouched by this family.
- **The pairing vehicle:** `ui-master-detail` (`@agent-ui/app`) — docked list|detail over
  `ui-split`, drill-in below 40rem OWN-container width, zero bespoke split code (SPEC-R7).
- **Where "wide" legally comes from:** the shell band ladder — `shell-breakpoint.ts`'s two named
  lines only: 40rem narrow (`SHELL_NARROW_BREAKPOINT`) · 52.5rem compact
  (`SHELL_COMPACT_BREAKPOINT`, = ADR-0150's compact-window line); band vocabulary
  `wide · compact · narrow` (ADR-0155/SPEC-R8, GH #229/SPEC-R14's mid-window arms). Never a
  third number.
- **The fence's future (S5):** LLD §14 — capability 4 (NL-edit an existing persona) inherits the
  apply machinery but NOT a consumption path; its intake owns its own ruling. GH #651 asks this
  decomposition to say where its entry point naturally lives, or fence it (§4 OQ5).

## 1 · Doc-tier right-sizing (per `doc-writing-rules` — never the bundle by default)

| Slice | Earns | Why |
|---|---|---|
| X1 companion ADR | **ADR-0179, proposed — authored with this manifest** | A real, hard-to-reverse fork was resolved (Kim's #651 ruling: place-based routing supersedes the just-built mode-toggle anatomy — reversing part of a built LLD's §5 and re-reading ADR-0131 Fork 2) and a second genuine fork (wide-pairing mechanism: shared-region arrangement vs duplicate mount) needed a decision home. One-composer routing rides as OF-Kim. Kim ratifies; never agent-flipped. |
| S1 Three-pane shell | **full LLD** (S1-a) + build | The one slice with real component/interface decomposition: top-level nav vehicle × pane anatomy × conversation re-homing × `#contextFor` re-keying × Author empty state × narrow-tabs vocabulary × IA-entry re-point (`createGeneratedAgent` lands IN Author) × the Settings sub-nav and pairing DESIGNS (§S2/§S3 build against its sections). Amending the authoring LLD instead was considered and rejected: that doc stays the authoring FLOW's record; this is the admin SHELL's record — the new LLD supersedes §5's placement rows by citation, with repairs listed (stale-context law). |
| S2 Settings grouping + sub-nav | **plain GH sub-issue** (builds against S1-a's Settings section) | No separate doc: the five sections and their fold/entry machinery ship; only their nav grouping changes. The sub-nav vehicle fork (OQ2) is ruled in S1-a; a second doc would duplicate one section. |
| S3 Hydration-rail pairing | **plain GH sub-issue** (builds against S1-a's pairing section) + the wide live-fill browser proof | The pairing MECHANISM is ADR-0179 cl.3 (ruled) and its anatomy is S1-a's; what S3 owns is build + the non-vacuous proof (#651's own acceptance line: the live-fill moment demonstrably preserved at wide). |
| S4 Try-it retirement + record repairs | **plain GH sub-issue** | Deletion against ADR-0179 cl.2's named survive/retire lists + the header's Repairs list; no design content of its own. |

No PRD (why/what = GH #651 + `agent-app-surfaces.prd.md`). No SPEC (zero wire change — no
producer contract, no new events, no cross-consumer ambiguity; acceptance lives inline in S1-a
per the doc-tier law — writing a SPEC nobody is unsure about would be manufactured process).

## 2 · OUTSIDE-IN — structure (family → slices → leaves)

```
Admin three-pane IA family (GH #651)
├── X1  ADR-0179 (proposed) — three panes · place-based routing · pairing law · OF-Kim one-composer
│        [authored with this manifest; Kim's ratification + cl.4 ruling GATE S1-a]
├── S1  Three-pane shell (the IA restructure)
│   ├── S1-a  LLD — nav vehicle (OQ2/OQ3 ruled here) · pane anatomy · conversation re-homing ·
│   │         #contextFor re-keyed by pane · Author empty state (OQ4) · narrow-tabs vocabulary ·
│   │         IA-entry re-point · the S2 grouping + S3 pairing designs · inline acceptance
│   ├── S1-b  build: the shell restructure + re-homed contexts + zero-regression asserts
│   └── S1-c  GH sub-issue (ADR-0145 routing)
├── S2  Settings grouping (five sections → one pane + internal sub-nav)
│   ├── S2-a  build per S1-a's Settings section
│   └── S2-b  GH sub-issue
├── S3  Hydration-rail pairing (wide Author + live settings region)
│   ├── S3-a  build per S1-a's pairing section + the wide live-fill browser proof (both engines)
│   └── S3-b  GH sub-issue
└── S4  Try-it retirement + record repairs
    ├── S4-a  build: strip + mode seam + stacking vehicle retire per ADR-0179 cl.2's lists;
    │         probes repointed (method survives); LLD §5/§2 rows + agent-admin.md repaired
    └── S4-b  GH sub-issue
```

Pure-structure nodes (`justify` per the two-plane method): X1 (`justify: decision-record`) and
every `-b`/`-c` issue leaf (`justify: affordance` — ADR-0145 tracking containers).

## 3 · INSIDE-OUT — actions (user-facing verbs the restructure must support)

| # | Action | Hosted by |
|---|---|---|
| a1 | Move between Chat / Author / Settings as first-class places, every band | S1-b |
| a2 | Test the active agent in Chat — pure, zero authoring chrome | S1-b (re-home) + S4-a (chrome retires) |
| a3 | Interview the Builder in Author — the composer routes there by PLACE | S1-b (ADR-0179 cl.4, Kim's IN/OUT bound at S1-a) |
| a4 | Watch settings fill live WHILE interviewing, at wide — without leaving Author | S3-a (the pairing; proof leaf) |
| a5 | Hand-edit the same draft concurrently at wide (rail = the REAL sections) | S3-a (cl.3's one-region law makes this free) |
| a6 | Reach any of the five sections via Settings' internal sub-nav | S2-a |
| a7 | At narrow, flip Author ⇄ Settings tabs to see hydration (the accepted cost) | S1-b (nav) — no new machinery, the trade is contract (cl.3) |
| a8 | Enter the flow: "New agent → Generate" lands IN the Author pane | S1-b (IA-entry re-point; S1/PR #639's mint path reused verbatim) |
| a9 | Exit/switch personas — resets per GH #145, `applyPersona` still clears `authoringStore` first | shipped mechanism (survive-list; S1-b asserts, adds nothing) |
| a10 | Keep/export the authored agent | shipped substrate (persona-file envelope — reuse, no node) |
| a11 | (future) NL-edit an EXISTING persona from Author | S5's own intake — fenced, OQ5 (named host: the Author pane; NOT built here) |

**Coverage verdict:** every action a1–a10 maps to a structure node or an explicitly-cited shipped
host; a11 is deliberately fenced to a named future intake (naming the host without minting a node
is the fence GH #651 asked for). Every leaf hosts an action or carries a `justify`. No
`UNHOSTED` action, no `UNJUSTIFIED-LEAF`. Quadrant: **load-bearing.**

## 4 · Open questions — named, owned; recommendations never self-ruled

- **OQ1 — one-composer routing (GH #651's first question).** IN or OUT: does Author host its own
  composer permanently routed to the Builder (Chat permanently the test context)?
  **Recommendation: IN** — verified mechanics: the consumption fence keys off the DRIVING store
  (`agent-admin.ts:1798 (post-#650 numbering; symbol: the `drivingStore === this.authoringStore` conjunct in the patch-receipt check)`), not the mode seam, so an Author-pane composer IS the authoring context
  and the fence generalizes with ZERO widening; Chat can never drive `authoringStore`, so "Chat
  stays pure test" holds by construction. The single-interleaved-surface model (#646's Findings
  note) stays OUT — it would reopen the dual-context anatomy. **Owner: Kim** — ADR-0179 cl.4
  (OF-Kim); ruled at ratification; S1-a binds the ruling. Until then S1-a does not dispatch.
- **OQ2 — Settings sub-nav vehicle.** Section-tab machinery reused one level down vs the settings
  rail idiom. **Recommendation: the segment/tab machinery** — visibility-only by construction
  (SPEC-R7c), shipped metrics, and #650's cross-strip equality probes transfer verbatim; a rail
  idiom would mint a second nav vocabulary inside the pane that just shed one. **Owner: planner
  at S1-a** (design-time per #651; Kim sees it in the LLD, not as a blocking fork).
- **OQ3 — where "wide" comes from.** **Recommendation: `ui-master-detail`'s own 40rem
  container line** (`SHELL_NARROW_BREAKPOINT`) — composing the shipped element gives the
  narrow drill-in for FREE, and own-container-width is the shell family's law; escalate to the
  52.5rem compact line only if real density proves 40rem too tight, always citing
  `shell-breakpoint.ts` (never a third number — ADR-0179 cl.3 pins this). **Owner: planner at
  S1-a**, evidence-based (a real-engine density check at both lines).
- **OQ4 — the Author pane when no flow is active.** Hidden-until-armed (today's strip law) vs
  always-present with an empty state. **Recommendation: always-present** — a first-class PLACE
  that vanishes isn't one; the empty state hosts the flow entry ("New agent → Generate" — a8's
  affordance where the user already is) and is exactly where S5's future existing-persona entry
  would live (OQ5). **Owner: planner at S1-a; Kim may overrule** (it changes what he sees at
  first paint).
- **OQ5 — S5's entry point (GH #651's fence-or-say question).** **Said AND fenced:** the Author
  pane IS the natural entry for NL-editing an existing persona (arm `authoringStore` while the
  persona is active — the machinery already applies to `this.store`), and this family still
  ships NO consumption-path widening: LLD §14's inheritance stands verbatim — S5's own intake
  makes its own consumption-path ruling + destructive-edit safety. **Owner: Kim, at S5's
  intake** (his earlier IN pre-signal, unchanged). ADR-0179 Consequences records the pointer.

## 5 · Dependency order (dispatchable)

```
ADR-0179 ratification + OQ1 ruling (Kim) ──→ S1-a (LLD) ──→ S1-b (shell build) ──→ S2-a ──→ S3-a ──→ S4-a
PR #650 merge (independent, precedes) ───────────────────────┘ (rebase reality)              (retires what shipped)
```

- **X1 → S1-a:** the LLD must not be authored against an unratified fork (the X1→S2 discipline
  from the authoring family, same reason) — and OQ1's IN/OUT changes S1-a's composer anatomy.
- **#650 → S1-b:** the tabs rework merges first; S1-b builds on post-#650 main so S4-a retires
  the strip that actually shipped (the supersedes-placement-not-blocks law from the charter).
- **S1-b → S2-a → S3-a → S4-a, SERIALIZED:** all four write `agent-admin.ts`/`agent-admin.css`
  (one-writer-per-file law) — no parallel dispatch inside this family; S2 before S3 because the
  pairing arranges the grouped Settings region S2 produces; S4 last because the mode seam stays
  load-bearing until pane routing (S1-b) AND the pairing (S3-a) are proven — retiring it earlier
  would strand the flip with no vehicle.
- **Nothing here gates on S5**; OQ5's fence means S5's intake opens on Kim's schedule, not this
  family's.

## 6 · Recommended first dispatch

**None buildable yet — route ADR-0179 to Kim** with the standing zero-friction affordance (path +
one-liner + the cl.4 IN/OUT question called out as the one ruling S1-a needs beyond the flip).
PR #650 merging meanwhile is the only parallel motion. The moment the ADR ratifies, S1-a (the
LLD) is the sole next dispatch; everything else is serialized behind it (§5).

## 7 · What each future slice still owes

This manifest sequences the family and right-sizes its paperwork; S1-a's LLD is authored at S1's
dispatch (per-slice precedent, `identity-flow.decomp.md` §7's shape) and owes: the nav-vehicle
ruling (OQ2/OQ3/OQ4 closed with evidence), the pane anatomy + re-homing map against ADR-0179
cl.2's survive/retire lists, the S2/S3 design sections its builds cite, inline acceptance
(checkable predicates — the wide live-fill proof named as a browser test, both engines), and the
Repairs execution list (authoring LLD §2/§5 rows, `agent-admin.md`, ADR-0131 index note — the
stale-context law). The `-b`/`-c` sub-issues are filed by the coordinator at dispatch time
(ADR-0145 routing), not pre-filed here. Each slice inherits this manifest's edges and ADR-0179's
clauses by ID; none re-litigates either doc.
