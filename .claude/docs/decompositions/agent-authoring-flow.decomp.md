# Agent-authoring flow family — decomposition (GH #633 / ADR-0178)

> Status: proposed · v0.1 · 2026-08-09 · planner. The design intake for GH #633's four extracted
> capabilities (blank path · generate path · try-it toggle · NL-edit-everywhere), run in the GH #490
> identity-family pattern: one manifest, two-plane coverage, per-slice doc-tier right-sizing,
> named OQs. The companion [ADR-0178](../adr/0178-agent-authoring-conversational-persona-hydration.md)
> (PROPOSED — Kim ratifies) carries the one genuine contract fork this family has (the hydration
> mechanism + its gate + question authorship); this doc does not re-derive it, it sequences against
> it. `break-down-problem` is not installed in this repo's `.claude/`; its two-plane method
> (OUTSIDE-IN structure × INSIDE-OUT action, cross-checked) is applied inline — §3's coverage table
> is the manual equivalent, the `identity-flow.decomp.md` precedent.

## 0 · Bound substrate (read, not duplicated — cited by ID below)

- **Transport reality:** the injectable `agentTurn`/`agentSurfaceTurn` seams
  (`agent-admin-schema.ts`, SPEC-N1-fenced; stub default `runStubAgentTurn`, ADR-0131) implemented
  by `site/lib/admin-live-runner.ts` against the `/__a2ui/agent/chat` proxy, runtime-probed in
  EVERY environment (ADR-0152). The RUNNER owns the meta-line peel; the component consumes typed
  `AdminSurfaceTurnEvent`s. **`identity-mock-transport.spec.md` is NOT this family's seam** — it is
  the identity-flow family's demo transport; nothing here touches it.
- **Persona = enumerated store state:** `PERSONA_STATE_KEYS` + `readPersonaState`'s
  filter-both-ways law + per-key fail-closed sanitizers (`agent-admin-persona-file.ts`, GH #406;
  `agent-admin-schema.ts`); per-persona persisted stores + collision-safe minting on import
  (`agent-admin-presets.ts` / `agent-admin-app.ts`); export via the persona-file envelope.
- **Envelope architecture:** the `agent-ui-a2ui-meta-line-facts` skill (five ask-arm rules, the
  modality-gate two-layer seam), ADR-0097 (`ask`), ADR-0174 + SPEC-R20/R21 (`plan` + gate +
  degrade law, `a2ui-live-agent.spec.md`).
- **Entry/roster architecture:** ADR-0132 (one entry-list primitive, `validateNewEntry` the single
  add path) · ADR-0164 (extraction home) · ADR-0170 (library packs, dimmed-while-off law).
- **The fence:** PRD agent-app-surfaces **PRD-D2** — the trusted frame stays host-authored; the
  generative mode emits persona STATE, never chrome (ADR-0178 cl.2's apply gate derives from it).
- **The trap:** GH #145 — a store-identity swap resets the conversation (drives ADR-0178 cl.5's
  no-store-swap try-it contract).

## 1 · Doc-tier right-sizing (per `doc-writing-rules`' tier law — never the bundle by default)

| Slice | Earns | Why |
|---|---|---|
| X1 companion ADR | **ADR-0178, proposed — already authored with this manifest** | A real, hard-to-reverse contract fork existed (hydration seam: meta-line arm vs fenced prose-JSON vs surface-based form; question authorship: model vs host heuristics; try-it store contract). GH #633 itself names it "genuinely undecided, the design campaign's first question." Kim ratifies; NEVER agent-flipped. |
| S1 Blank path | **plain GH sub-issue**, inline Components/Risks | Pure reuse of the GH #406 mint path + default seeds (`initialValuesFor` + `initialEntryValues`) behind a roster "New agent" action — page-side, no new component decomposition, no ambiguity a SPEC would resolve. |
| S2 `personaPatch` producer arm | **SPEC amendment** to `a2ui-live-agent.spec.md` (new SPEC-R rows: arm shape + merge law + GRAMMAR teaching + gate degrade) + build | The wire contract is genuinely ambiguous pre-build (OF1: patch granularity/merge semantics) and every consumer builds against it — the exact SPEC-R14/SPEC-R20 lineage. NOT a new SPEC: the arm extends the producer SPEC the same way `ask` and `plan` did. Authored at S2 dispatch, AFTER ADR-0178 ratifies. |
| S3 Guided authoring flow (admin side) | **full LLD** + build | Real component/interface decomposition: draft lifecycle × apply gate (three-filter chain) × Builder persona × runner event widening × live-hydrating panes × try-it anatomy (OF2 lands here) × IA entry. The one slice that earns the full seat. |
| S4 Try-it toggle | **plain GH sub-issue** (builds against S3's LLD — the toggle anatomy is DESIGNED in S3-a, built here) | No separate doc: its contract is ADR-0178 cl.5 + the S3 LLD's anatomy section; a second doc would duplicate one fact. |
| S5 NL-edit everywhere | **deferred — future intake issue only** | ADR-0178 cl.6: mechanism generalizes by construction; the slice waits for the pilot. Filing its own SPEC/LLD now would be manufacturing process for an unconfirmed scope (OQ4 is Kim's confirm). |

No PRD anywhere in this family: the why/what is fully carried by GH #633 + `agent-app-surfaces.prd.md`
(the admin surface's own PRD) — writing one would duplicate an established record.

## 2 · OUTSIDE-IN — structure (family → slices → leaves)

```
Agent-authoring flow family (GH #633)
├── X1  ADR-0178 (proposed) — hydration arm + apply gate + Builder-persona questions + try-it contract
│        [authored with this manifest; Kim's ratification GATES S2–S5]
├── S1  Blank-agent path (capability 1)
│   ├── S1-a  roster "New agent → Blank" action: mint identity + fresh default-seeded store + activate (page-side)
│   └── S1-b  GH sub-issue (ADR-0145 routing)
├── S2  personaPatch producer arm (capability 2, wire half)
│   ├── S2-a  SPEC amendment — a2ui-live-agent.spec.md new SPEC-R rows (arm + merge law + GRAMMAR + degrade)
│   ├── S2-b  build: meta-line widening (formatMetaLine/readMetaLine) + GRAMMAR block + gate store key
│   └── S2-c  GH sub-issue
├── S3  Guided authoring flow (capability 2, admin half)
│   ├── S3-a  LLD — draft lifecycle · apply gate · Builder persona · runner event + AdminSurfaceTurnEvent
│   │         widening · live-hydrating panes · try-it anatomy (OF2) · IA entry ("New agent → Generate")
│   ├── S3-b  build: Builder preset + apply loop + runner peel + gate's admin row (dimmed law) + panes proof
│   └── S3-c  GH sub-issue
├── S4  Try-it toggle (capability 3)
│   ├── S4-a  build: authoring ⇄ test flip per ADR-0178 cl.5 + S3-a's anatomy — both transcripts survive,
│   │         one draft store, no identity swap
│   └── S4-b  GH sub-issue
└── S5  NL-edit everywhere (capability 4) — DEFERRED
    └── S5-a  future intake issue (filed after S2–S4 ship): gate-on-existing-persona entry point + edit
              safety; opens with Kim's in/out confirm (OQ4)
```

Pure-structure nodes with no directly-hosted action (`justify` per the two-plane method): X1
(`justify: decision-record` — it hosts the fork, not a user action) and every `-b`/`-c` issue leaf
(`justify: affordance` — ADR-0145 tracking containers for their slice's own actions). S5-a is
`justify: deferral-marker` until Kim's confirm turns it into a real slice.

## 3 · INSIDE-OUT — actions (user-facing verbs the family must support)

| # | Action | Hosted by |
|---|---|---|
| a1 | Create a new blank agent from the admin IA | S1-a |
| a2 | Fill the blank agent out via the existing editing surfaces | shipped substrate (ADR-0131/0132 panes — reuse, no new node; the manifest adds nothing because nothing is missing) |
| a3 | Describe the desired agent in chat, over multiple dialog turns | S3-b (Builder persona conversation over the S2-b arm) |
| a4 | Be asked guiding/clarifying questions steering toward completion | S3-b (model-authored — prose + ADR-0097 ask surfaces, per ADR-0178 cl.4; zero new question machinery) |
| a5 | Watch the schema/config hydrate progressively while conversing | S2-b (the arm) + S3-b (apply loop; panes re-render on store writes — the shipped live-apply law) |
| a6 | Flip to TESTING the drafted agent live in the chat | S4-a |
| a7 | Flip back to authoring — neither side's state lost | S4-a (ADR-0178 cl.5's no-store-swap contract) |
| a8 | Keep/export the authored agent | shipped substrate (per-persona persisted store + persona-file export, GH #406 — reuse, no new node) |
| a9 | Modify an EXISTING agent by describing the change in natural language | S5 (deferred; mechanism-ready per ADR-0178 cl.6) |

**Coverage verdict:** every action a1–a9 maps to a structure node or an explicitly-cited shipped
host — no `UNHOSTED` action. Every leaf hosts an action or carries a `justify` — no
`UNJUSTIFIED-LEAF`. Quadrant: **load-bearing.** The two "shipped substrate" rows (a2/a8) are
deliberate: the blank path and persistence are REUSE by design (ADR-0178 Context), and minting
manifest nodes for them would be decoration — the coverage table names the shipped host instead.

## 4 · Open questions — named, owned; recommendations never self-ruled

- **OQ1 — hydration mechanism (new meta-line arm vs a different seam).** GH #633's own "first
  question." **Status: proposed resolution, not open design** — ADR-0178 cl.1 rules the new
  model-authored `personaPatch` arm (ask/plan precedent, five rules verbatim) over fenced
  prose-JSON / model-emitted config-form / host extraction, with the apply gate (cl.2) built from
  three shipped filters. **Owner: Kim** — the ratification of ADR-0178 IS this OQ's close. Until
  then S2–S5 do not dispatch.
- **OQ2 — schema persistence (entries store? export?).** **Resolved by substrate, no ruling
  needed:** a new agent mints a roster identity + its own persisted localStorage store (the GH #406
  import-mint path, reused); export falls out of the persona-file envelope. The entries store is
  untouched as a concept — entry-list slices ride inside the persona store as they always have.
  Evidence: `agent-admin-presets.ts` (per-persona `persistKey`), `agent-admin-persona-file.ts`
  (`PERSONA_STATE_KEYS` round trip). Nothing here is Kim-gated.
- **OQ3 — try-it state isolation.** The CONTRACT is ruled (ADR-0178 cl.5: one draft store, no
  identity swap, both transcripts survive, test turns write only what ordinary sessions write).
  The ANATOMY (two mounted conversation contexts vs one context with transcript snapshot/restore)
  is **owner: planner at S3-a (the LLD)** — recommendation: dual-context, which avoids inventing
  transcript serialization; ADR-0178 OF2.
- **OQ4 — capability 4, v1 or later.** GH #633 delegates the sequencing call to this
  decomposition: **ruled LATER** (S5, deferred behind the pilot — ADR-0178 cl.6's
  mechanism-generalizes finding means deferral costs no wire redesign). The final IN/OUT plus
  destructive-edit safety (undo/versioning for a persona someone already uses) **stays Kim's**, at
  S5's own intake — recommendation: IN, as the gate-flip + affordance slice it has become.
- **OQ5 — who authors the guiding questions.** **Status: proposed resolution** — ADR-0178 cl.4
  rules model-authored (Builder persona; prose + shipped ask surfaces), host heuristics rejected.
  Closes with OQ1 at ratification. A sub-fork survives as ADR-0178 OF4 (Builder persona
  roster-visible vs flow-only — recommendation: hidden-until-invoked; Kim's, cheap, non-blocking).

## 5 · Dependency order (dispatchable)

```
ADR-0178 ratification (Kim) ──→ S2 (SPEC amendment + arm) ──→ S3 (LLD + guided flow) ──→ S4 (try-it)
                                                                 ▲                          │
S1 (blank path) ────────────────────────────────────────────────┘                          ▼
   [dispatchable NOW — no ADR dependency]                          S5 (NL-edit) ⇠ Kim's in/out (OQ4)
```

- **S1 → S3:** the generate path hydrates INTO a blank-minted draft — S1's mint affordance and
  roster entry are the draft's front door ("New agent → Blank | Generate" is one menu, built
  blank-first). S1 itself depends on nothing and can dispatch immediately, in parallel with
  ratification.
- **X1 → S2:** the SPEC amendment must not be authored against an unratified fork (repairing a
  bounced contract in two docs is the waste the gate exists to prevent).
- **S2 → S3:** the admin half consumes the arm + gate key + event kind S2 lands; S3-a (the LLD)
  MAY be drafted once S2-a's SPEC rows freeze, without waiting for S2-b's build.
- **S3 → S4:** the toggle flips between two things S3 creates (the Builder conversation and the
  draft persona composition); its anatomy is designed in S3-a.
- **S2–S4 shipped → S5:** the pilot must prove the arm before the generalized slice's intake
  opens; S5 additionally gates on Kim's OQ4 confirm.
- Within slices, the `-b`/`-c` issue leaves are parallel-safe with everything (file-disjoint).

## 6 · Recommended first dispatch

**S1 (blank path) — immediately**, in parallel with routing ADR-0178 to Kim. It is the lowest-risk
slice in the family (pure page-side reuse of a shipped mint path), it needs NO OQ answer and NO
ratification, and it lands the roster front door the generate path later reuses. Recommend handing
Kim the ADR-0178 ratification affordance (path + `ratify ADR-0178` one-liner) alongside this
manifest so S2 can dispatch the moment the fork closes.

## 7 · What each future slice still owes

This manifest sequences the family and right-sizes its paperwork; it does not author S2-a's SPEC
rows or S3-a's LLD (each is authored at its slice's dispatch, per the per-slice precedent this
repo already runs — `identity-flow.decomp.md` §7's shape). Each inherits this manifest's dependency
order, ADR-0178's clauses by ID, and the tier ruling in §1; none re-litigates either doc. The
per-slice GH sub-issues (`-b`/`-c` leaves) are filed by the coordinator at dispatch time (ADR-0145
routing), not pre-filed here.
