# GenUI inventory — 2026-08-05

## 1. SHIPPED (B0-B3-scoped work, roadmap.md §2)

- **Identity ruled, unchanged since 07-28**: free-form HTML/CSS/JS in a sandboxed `<iframe>`,
  "contained not forbidden" (PRD v0.4 §4 D1). PRD (`.claude/docs/prd/genui-surface.prd.md`) is
  still `proposed · v0.4 · 2026-07-24`; SPEC (`.claude/docs/spec/genui-surface.spec.md`) is now
  `proposed · v0.6 · 2026-07-28` (bumped from v0.4/v0.3 by the ADR-0162 §11 amendment — see below).
  Neither doc has been ratified to `accepted`; every fork remains ruled, nothing blocks build.
- **Containment host**: `ui-sandbox-frame` (`@agent-ui/components`) unchanged in posture — SPEC-R3
  sandbox, SPEC-R4 CSP, SPEC-R5 srcdoc lifecycle, SPEC-R6 token bridge, SPEC-R7/R8 closed 6-member
  bridge (`action` outward, ADR-0153). Catalog-invisible by construction (PRD-G4).
- **Wire, producer, agent-admin mount** — all as previously shipped (B0-B2): the in-house
  `{"genui":{surfaceId,html}}` line (`genui-line`, `@agent-ui/a2ui/agent`), `produce()` peeling
  genui lines pre-heal/validate, `GENUI_*` failure codes, 3 curated pattern-source packs +
  degradation-safe prompt block (SPEC-R9), the `exclusive` field (SPEC-R10), agent-admin's Surface
  Options GenUI row live in the real turn loop. `gen-ui-live` stays deliberately recorded-only.
- **B0-B2 confirmed DONE, no regression.** roadmap.md §2 states plainly: "**GenUI surface — shipped
  end to end (B0–B2)**." No open issue or doc contradicts this since 07-28.
- **ADR-0162 (dogfood mode) — RATIFIED and BUILT.** Status flipped `accepted` 2026-07-28 (commit
  `7ffaad5`). This is the single biggest change since the 07-28 inventory, which had recorded
  ADR-0162 as still `proposed, not yet ratified` and the whole dogfood arc as gated on that
  ratification. Since then the **M-C milestone ("GenUI speaks fleet") shipped end to end and
  closed 2026-07-29** (roadmap.md §3/§4 dated line): S0-S5 of
  `decompositions/genui-dogfood.decomp.md` all merged (#336/#338/#345), a live Proof-of-mode run
  by Kim on 2026-07-29 (Claude Haiku 4.5, "card game" prompt both ways: OFF gave flat generic
  markup, ON gave theme-tinted, real `ui-*` anatomy), DoD met. Two ratified-contract conflicts the
  build exposed were ruled and repaired in #351 (SPEC-R13(b)'s unsatisfiable single-parser
  requirement resolved to a parity-proven reader; the descriptor format's missing compound-family
  field closed via `.define()`-site derivation) plus the wave's app-barrel size breach in #356. The
  SPEC's own v0.5→v0.6 amendment (§11: SPEC-R12 frame assets, SPEC-R13 dogfood prompt modules, the
  SPEC-R10 dogfood clause) is the record ADR-0162 ratifies.
  - Follow-up bugs found by dogfooding and already closed: #425 (`genui-dogfood-teaching.md`
    referenced "the A2UI section above" that composed to nothing under a2ui-off+dogfood-on),
    #412 (persona "Surface style" prompt sections hardcoded A2UI instructions conflicting with the
    Surface Options toggles), #408 (`gen-ui-live` losing a live turn's output silently), #418 (the
    A2UI Surface Option had zero effect on prompt composition) — all CLOSED per `gh issue list`.
  - One recorded deviation: the live acceptance run happened on `gen-ui-live`, not agent-admin
    (goals.md, M-C section) — the "optional phase 3" (a live GenUI demo surface outside
    agent-admin) was not separately built; the Proof-of-mode run substituted for it.

## 2. IN-FLIGHT / DEFERRED

- **No open build slice for GenUI today.** roadmap.md's 2026-08-05 arc-status line states the
  whole 2026-07-28 three-milestone arc (M-B/M-C/M-A) is **CLOSED**, and "No next milestone is
  ruled: the lane is open for the next intake, which is Kim's call." GenUI has no active PR or
  in-flight decomposition as of this snapshot.
- **B3 — the judged pack-idiom eval. Confirmed DEFERRED**, quoted verbatim from
  `.claude/docs/roadmap.md` §4 ("Later"):

  > **GenUI B3 — the judged pack-idiom eval.** Out of the GenUI SPEC's contract by its own §6 cut:
  > PRD §8 m3 (judge-scored pack-idiom use) realized as a judged corpus-rubric shard plus its docs
  > page (PRD-G6) — a named manual live-model run, never part of the deterministic gates (SPEC-N3).
  > **Revisit when the producer's output quality needs a measured floor.**

  The exact revisit trigger is: **"when the producer's output quality needs a measured floor."**
  This is unchanged in substance from the 07-28 inventory's paraphrase ("when producer output
  quality needs a measured floor") but the roadmap's own wording (quoted above) is the citable
  form. The optional "phase 3" named in M-C's own scope note (goals.md) — "B3's judged pack-idiom
  eval gaining its fleet-idiom dimension" — was explicitly NOT built; M-C's DoD closed without it.
  No new trigger condition, corpus-rubric shard, or docs page (PRD-G6) exists yet.

## 3. CURRENT STATE PER ROADMAP §2 (verbatim scope)

roadmap.md §2 ("Now — current state, as of 2026-08-05") carries one paragraph on GenUI, unchanged
in claim-shape from 07-28 except for the closing sentence:

> **GenUI surface — shipped end to end (B0–B2).** ... `ui-agent-admin` mounting GenUI surfaces
> inside its real turn loop on a parallel path beside the A2UI client. The `gen-ui-live` site demo
> stays deliberately recorded-only. What's left is out of the SPEC's own contract: B3, the judged
> pack-idiom eval (§4).

This is the ruled shape: **B0-B2 is "done," B3 is explicitly framed as out-of-contract, deferred,
not a gap.** The dogfood mode (ADR-0162/M-C) is mentioned separately, higher up in §2's shell/admin
paragraph ("Surface Options (Markdown · A2UI catalog · GenUI — the once-PRD-gated row now live)")
and in §3/§4's dated M-C close line — the §2 GenUI paragraph itself was not rewritten to narrate
M-C's closure explicitly, though M-C's DoD and dated-line entries make the shipped state clear
elsewhere in the same file.

## 4. CANDIDATE INCREMENTS

1. **B3 judged eval + docs page** (PRD-G6) — the one open contract item ever named for GenUI;
   still gated behind its own revisit trigger (quality floor), not scheduled. Would need a
   corpus-rubric shard matching the A2UI corpus discipline (per the 07-28 inventory's framing,
   still accurate).
2. **GH #421 — bespoke per-persona A2UI catalogs** (OPEN, `enhancement`/`size:big`). Not a GenUI
   ticket per se (it's A2UI-catalog-scoped) but explicitly cites GenUI as precedent: "the
   A2UI-side analogue of GenUI's per-agent pattern sources (PRD-G2/SPEC-R11)." Triaged
   2026-08-05 by Kim via issue comment: **"PARKED IDEA, Later-tier ... has no ruled intake; it
   would re-enter through a design intake like the ADR-0169 second-catalog arc did."** Kept open
   as the idea's record, not scheduled.
3. **Naming-collision cleanup** (PRD §9, unresolved as of this snapshot): `GenUiMode`/
   `gen-ui-mode.ts` (ADR-0090, prompt-disposition axis: default/specific/blue-sky) vs. the GenUI
   *surface* — same "genui" spelling, different concepts. The PRD (still `proposed`) flags this
   for "the SPEC" to resolve; SPEC v0.6 does not appear to have picked this up explicitly (no
   `GenUiMode` disambiguation clause found in a scan of the SPEC's amendment sections). Real,
   unresolved, low-cost cleanup candidate.
4. **W3C Generative UI CG — watch item** (PRD §5.1, line 141): "Proposed 2026-01-30, not yet
   chartered" as of the 2026-07-23 survey. The PRD's own text (line 147) flags a freshness
   caveat: "the W3C CG status may have moved — re-check before citing it again." Not re-verified
   in this pass (external web lookup out of scope for this inventory); still an open watch item.
5. **AG-UI exact event shapes** — carried over from 07-28, unchanged: PRD flags a secondary-source
   uncertainty (`ag-ui-protocol/ag-ui`'s `events.ts` was never pulled directly); a real gap if
   GenUI's "one stream, disjoint kinds" claim (SPEC-R1/R2) is ever challenged.
6. **`gen-ui-live` stays recorded-only** — unchanged from 07-28. A live-turn demo surface for
   GenUI outside agent-admin remains a real gap; M-C's "optional phase 3" (a live demo surface)
   was explicitly not built when M-C closed 2026-07-29.
7. **PRD-G7 (`could`) — shareable/exportable pattern sources** across workspaces: still named in
   the PRD, never scheduled. Unchanged from 07-28.
8. **CSP reporting directives unavailable** in meta CSP (SPEC-R4) — unchanged from 07-28; drop
   counters (SPEC-R7) remain the only observability.
9. **Ratify the PRD/SPEC to `accepted`.** Both documents remain `proposed` (PRD v0.4 since
   2026-07-24; SPEC v0.6 since 2026-07-28) even though the whole GenUI B0-B2 arc plus the
   dogfood/M-C arc have shipped and closed. This is not flagged as a defect anywhere in the
   tracked docs (the repo's convention allows `proposed`-status build-contract docs to ship code),
   but it is worth naming as a housekeeping candidate for this wave's synthesis, parallel to how
   ADR-0160 was named purely for "record hygiene" in the 07-28→08-05 arc.

## 5. GITHUB ISSUES — GenUI-tagged or GenUI-referencing (searched 2026-08-05)

`gh issue list --search "GenUI" --state all` returns 15 issues; GenUI-substantive ones:

| # | State | Title | Relevance |
|---|---|---|---|
| 421 | OPEN | bespoke per-persona A2UI catalogs | cites GenUI's pattern-source precedent; parked idea (see §4.2) |
| 425 | CLOSED (2026-08-04) | genui-dogfood-teaching.md dangling A2UI reference under a2ui-off+dogfood-on | M-C follow-up bug, fixed |
| 412 | CLOSED (2026-08-04) | persona prompt sections hardcode A2UI instructions conflicting with Surface Options | fixed |
| 408 | CLOSED (2026-08-04) | gen-ui-live: live turn output silently lost | fixed |
| 418 | CLOSED (2026-08-04) | A2UI Surface Option has zero effect on prompt composition | fixed |
| 316 | CLOSED (2026-07-29) | [Feature] GenUI agent-ui dogfooding MODE | the ADR-0162 source issue; closed on ship |
| 342 | CLOSED (2026-07-28) | SPEC-R13(b) single-parser requirement unsatisfiable | fixed in #351, folded into M-C |
| 260 | CLOSED (2026-07-25) | gen-ui-live: render pane blank on real iOS Safari | pre-arc bug, fixed |

**No open GenUI-substantive issue exists as of this snapshot** other than #421, which is
explicitly a parked idea with no ruled intake (not a build gap).

## 6. CROSS-SYSTEM DEPENDENCIES (EDGES)

### As CONSUMER

- **components**: `ui-sandbox-frame` remains the whole containment contract; unchanged. The
  dogfood arc added a `dogfood/` subpath sibling
  (`packages/agent-ui/components/src/controls/sandbox-frame/dogfood/`) — a committed,
  freshness-gated CSS+IIFE asset pair — GenUI-owned but living in `@agent-ui/components` (a
  cross-package edge, per ADR-0162's Repairs list). Depends on ADR-0004's ONE descriptor parser
  for the dogfood inventory derivation, and reuses ADR-0071's derive-then-drift-gate discipline
  (rather than byte-pinning) for that inventory.
- **a2ui**: the wire (`genui-line`) and `produce()`'s peel-before-heal ordering remain a direct
  dependency on the live-agent producer stack (ADR-0137). SPEC-R5's validate-then-stream law
  stays narrowed for GenUI (structural-only at wire time) — unchanged, still a load-bearing
  exception in a sibling SPEC. The dogfood prompt half (`genui-dogfood-teaching.md`,
  `dogfood-inventory.ts`) extends ADR-0091 (mini-skill/prompt-module injection) and ADR-0135
  (prompt-file + byte-pinning mechanics).
- **shells**: unchanged — GenUI mounts inside agent-admin's chat surface; `router`/`code`/
  app-shell-family stay out by construction. `ui-app-shell` was fully removed in this window
  (ADR-0156) but this has no bearing on GenUI's containment, which never used it.
- **agent-admin**: still the only real production consumer. Its Surface Options store, live-apply
  law, and turn loop remain the edges GenUI depends on. Newly relevant: several of the closed
  bugs above (#412/#418) were specifically about agent-admin's Surface Options / persona prompt
  composition failing to respect GenUI's on/off state correctly — now fixed, tightening this
  dependency's correctness rather than changing its shape.

### As PROVIDER

- **agent-admin / SaaS patterns**: the closed 6-member bridge remains the only sanctioned
  agent→host channel; richer interactivity (multi-step tool calls, streaming partial UI) is
  still an explicit v1 non-goal (PRD §3).
- **Pattern-source packs**: still the reusable `EntryLibraryPack` unit; GH #421's per-persona
  A2UI-catalog idea explicitly names this as its analogue-precedent ("the A2UI-side analogue of
  GenUI's per-agent pattern sources, PRD-G2/SPEC-R11") — meaning GenUI's mechanism is now cited
  as a design template for a DIFFERENT system's parked feature, a new (if informal) provider
  edge since 07-28.
- **Token bridge** (SPEC-R6): unchanged as the template for sandboxed-content theme sync; the
  dogfood frame-asset injection (M-C) reused this exact bridge rather than inventing a second
  one, confirming the pattern held under the dogfood build.

## 7. RISKS

- **Doc-status lag, not scope lag.** PRD stays `proposed v0.4` (2026-07-24) and SPEC `proposed
  v0.6` (2026-07-28) despite B0-B2 and the whole dogfood/M-C arc having shipped and closed live.
  This matches the repo's general convention (build proceeds from ruled/proposed docs, ADRs carry
  ratification separately) but is worth flagging in case the next synthesis wants doc-status
  parity with shipped-state as a hygiene pass (comparable to ADR-0160's "record hygiene" flag in
  the 07-28→08-05 arc).
- **Naming collision (PRD §9) still open.** `GenUiMode` vs. the GenUI surface concept remains
  unresolved in the shipped SPEC text as far as this scan found; a future contributor or an LLM
  agent reading `gen-ui-mode.ts` alongside `genui-line`/`GenuiSurfaceConfig` risks conflating two
  unrelated axes.
- **B3's revisit trigger is a judgment call, not a metric.** "When the producer's output quality
  needs a measured floor" (roadmap §4) has no instrumented signal attached — nothing in the repo
  currently measures "producer output quality" in a way that could trip this trigger
  automatically; it depends on someone (Kim, or a future reviewing agent) subjectively deciding
  quality has degraded enough to warrant it. This is unchanged from 07-28 but remains a real risk
  if pack/prompt drift silently erodes output quality with no gate to catch it before B3's own
  eval would.
- **`gen-ui-live` recorded-only stays a coverage gap for anyone auditing GenUI without
  agent-admin access.** Unchanged from 07-28; the M-C "optional phase 3" that could have closed
  this was explicitly skipped when M-C's DoD closed.
- **W3C Generative UI CG citation is stale by the PRD's own admission** (§5.1) — a small but real
  risk if the PRD's ecosystem-positioning claims are cited elsewhere without a re-check.
