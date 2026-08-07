# Identity & account flow family — decomposition (GH #490 / ADR-0176)

> Status: proposed · v0.1 · 2026-08-06 · planner. Continues from the RATIFIED
> [ADR-0176](../adr/0176-identity-account-flow-family-design-intake.md) (the architecture: per-flow
> lane cut, the security fence, the catalog-exposure ruling, the five-slice sequence) — this doc
> does not re-derive that decision, it right-sizes the FIVE SLICES into dispatchable leaves per
> `doc-writing-rules`' tier law and runs the two-plane coverage check GH #490's own Acceptance
> criterion 1 asks for ("design intake done with the decomposition skills"). `break-down-problem`
> is not installed in this repo's `.claude/`; its two-plane method (OUTSIDE-IN structure ×
> INSIDE-OUT action, cross-checked) is applied inline below, no script gate available — the
> coverage table in §3 is the manual equivalent. Kim's own scheduling ruling on GH #490
> (2026-08-06T10:18:10Z) named this campaign as the thing that runs before any build.

## 0 · What already landed (read, not duplicated)

- **ADR-0176** (accepted, PR #506) is the architecture of record. Its four rulings, cited by ID
  everywhere below rather than restated: **cl.1** the per-flow lane cut (Lane A/B/C, ADR-0102's
  chooser repurposed) · **cl.2** the demo-only security fence (no real auth backend, ever) plus a
  documented consumer-suppliable seam whose *shape* is left to slice-level SPEC/LLD · **cl.3**
  Registration/Authentication stay host-page-only forever (security inversion, PRD-D2); Onboarding
  content-steps/Account Management are deferred-not-foreclosed for a future catalog-exposure intake
  · **cl.4** five sequenced slices: (1) Registration + Email+Password → (2) Codes + Magic Link →
  (3) Social Auth → (4) Onboarding → (5) Account Management.
- **Three open questions ADR-0176 named and deliberately did not resolve** (OQ1–OQ3, §4 below) —
  carried forward here as the gates on the slices that need them, not re-opened for debate.
- **The ADR's own Repairs cell** (roadmap.md §4's stale placement, a composition-patterns
  forward-pointer, a PRD forward-pointer) is **still unapplied in-tree** as of this manifest
  (verified: `grep -n "0176" .claude/skills/agent-ui-composition-patterns/SKILL.md
  .claude/docs/prd/agent-app-surfaces.prd.md` returns nothing; `roadmap.md` §4 still reads "Queued
  behind the live M-D lane"). Flagged as a pre-existing debt this manifest inherits rather than
  fixes — out of this dispatch's scope (the decomposition manifest only); routed in the handback.
- **`flow-checker`/`layout-checker` (the `screens` plugin) are the graders GH #490's Acceptance
  criterion 1 names**, verified from their own agent contracts: `flow-checker` gates a `*.flow.json`
  state-machine CARD (design-time artifact, `break-down-flow`'s `flow-check.py`) — it does **not**
  require the docs-site demo to be live-wired, so **OQ3 (interactive-vs-static demo) does not block
  card authoring or grading**, only the docs-site example's fidelity. `layout-checker` grades a
  built screen/screenshot/wireframe — naturally a build-time (post-pattern) gate. No `*.flow.json`
  card exists anywhere in this repo yet (`find . -iname "*.flow.json"` — empty); this manifest
  places a home for them (`.claude/docs/flows/`, mirroring the `decompositions/`/`rubrics/` sibling
  tiers) since none is established.

## 1 · Doc-tier right-sizing (this manifest's own ruling, not ADR-0176's)

ADR-0176's Repairs cell names "five future per-slice SPECs/LLDs" at the architecture level. Per
`doc-writing-rules`' tier law (LLD only for real component/interface decomposition; SPEC only for
genuine pre-build ambiguity; ADR only for a real ratified fork), that phrase over-specifies the
paperwork four of the five slices actually earn:

| Slice | Earns | Why |
|---|---|---|
| S1 Registration + Email+Password | **plain GH issue**, inline Components/Risks | Lane C, zero new controls (ADR-0176 cl.1) — no component decomposition to freeze in an LLD, no real ambiguity a SPEC would resolve |
| S2 Codes + Magic Link | **full LLD** for the code-entry control · **plain GH issue** for Magic Link | The code-entry field is ADR-0176's one Lane-A control — real interface/state decomposition (cell focus graph, paste-split algorithm, a11y) earns the full seat; Magic Link stays Lane C, no LLD |
| S3 Social Auth | **plain GH issue**, inline Components/Risks | Lane C; OQ2 (brand marks) is a product/licensing call, not a component-decomposition question — doesn't earn an ADR or SPEC by itself |
| S4 Onboarding | **plain GH issue** for the step shell · **small SPEC amendment, IF OQ1 resolves "build it"** for the `ui-progress` segments prop | Step shell is Lane C; the segments prop (if built) is Lane B — additive, not a full LLD, but the prop shape is genuinely undecided pre-build |
| S5 Account Management | **plain GH issue**, inline Components/Risks | Lane C, no new control, no extraction (ADR-0176 cl.1) — the entire scope is a worked exemplar |
| Cross-cutting seam contract | **one SPEC**, `identity-mock-transport.spec.md` | Genuinely ambiguous pre-build (function-per-action shape, error contract), needs sign-off before ANY slice's demo wiring lands, and every later slice EXTENDS it (new action verbs) rather than re-authoring it — one fact, one home, not five duplicate specs |

No new ADR anywhere in this build — ADR-0176 already resolved the one real fork (pattern-vs-
component lane cut) this family had. If OQ1/OQ2/OQ3's resolution itself turns out to change an
owning doc's substance in a hard-to-reverse way (e.g. a real `@agent-ui/icons` trademark exposure
from OQ2), that would earn its OWN small ADR at that time — named as a possibility, not decided
here.

## 2 · OUTSIDE-IN — structure (family → slices → leaves)

```
Identity & account flow family (GH #490)
├── X1  identity-mock-transport seam SPEC          [cross-cutting, gates S1 build if OQ3 = interactive]
├── S1  Credentials baseline
│   ├── S1-a  Registration pattern (Lane C)
│   ├── S1-b  Email+Password Authentication pattern (Lane C)
│   ├── S1-c  *.flow.json cards (registration, email-password-signin) + flow-checker grade
│   ├── S1-d  layout card(s) + layout-checker grade
│   ├── S1-e  composition-patterns SKILL.md rows (2)
│   ├── S1-f  docs-site page + example
│   └── S1-g  GH sub-issue (ADR-0145 routing)
├── S2  Codes + Magic Link
│   ├── S2-a  code-entry control — LLD + build (the one Lane-A control)
│   ├── S2-b  Magic Link pattern (Lane C)
│   ├── S2-c  *.flow.json cards (otp-signin incl. resend, magic-link-signin) + flow-checker grade
│   ├── S2-d  layout card(s) + layout-checker grade
│   ├── S2-e  composition-patterns SKILL.md rows (2)
│   ├── S2-f  docs-site page + example
│   └── S2-g  GH sub-issue
├── S3  Social Auth
│   ├── S3-a  Social Auth pattern (Lane C, provider-button row)
│   ├── S3-b  *.flow.json card (social-signin incl. redirect/callback) + flow-checker grade
│   ├── S3-c  layout card + layout-checker grade
│   ├── S3-d  composition-patterns SKILL.md row
│   ├── S3-e  docs-site page + example
│   └── S3-f  GH sub-issue
├── S4  Onboarding
│   ├── S4-a  step-shell pattern (Lane C, next/back/skip)
│   ├── S4-b  `ui-progress` segments prop — SPEC amendment + build (Lane B, ONLY if OQ1 → build)
│   ├── S4-c  *.flow.json card (onboarding first-run) + flow-checker grade
│   ├── S4-d  layout card(s) + layout-checker grade
│   ├── S4-e  composition-patterns SKILL.md row
│   ├── S4-f  docs-site page + example
│   └── S4-g  GH sub-issue
└── S5  Account Management
    ├── S5-a  account-settings SchemaSchema instance over EXISTING ui-settings (no new control)
    ├── S5-b  *.flow.json card (view/edit/save a preference) + flow-checker grade
    ├── S5-c  layout card + layout-checker grade
    ├── S5-d  composition-patterns SKILL.md row
    ├── S5-e  docs-site page + example
    └── S5-f  GH sub-issue
```

Pure-structure nodes with no directly-hosted action (`justify` per the two-plane method): X1
(`justify: infrastructure` — a seam contract, not a user-facing flow) and every `-e`/`-f`/`-g` leaf
per slice (`justify: affordance` — docs/pattern-row/tracking-issue nodes exist to carry the flow's
own action, not to add a new one).

## 3 · INSIDE-OUT — actions (user-facing verbs the family must support)

| # | Action | Hosted by |
|---|---|---|
| a1 | Create an account (register) | S1-a |
| a2 | Sign in with email + password, incl. reveal/hide password | S1-b |
| a3 | Request a one-time code | S2-a |
| a4 | Verify a one-time code (auto-advance/backspace/paste-split across cells) | S2-a |
| a5 | Resend a one-time code (rate-limited) | S2-a |
| a6 | Request a magic link | S2-b |
| a7 | Confirm the magic-link "check your email" state | S2-b |
| a8 | Sign in via a social provider (redirect + callback) | S3-a |
| a9 | Advance/retreat through onboarding steps | S4-a |
| a10 | See onboarding progress ("step N of M") | S4-a (continuous approximation) / S4-b (discrete, if built) |
| a11 | Skip onboarding | S4-a |
| a12 | View account settings/preferences | S5-a |
| a13 | Edit and save a preference | S5-a |

**Coverage verdict:** every action (a1–a13) maps to at least one OUTSIDE-IN node — no `UNHOSTED`
action. Every leaf node either hosts an action directly or carries a `justify` — no
`UNJUSTIFIED-LEAF`. Quadrant: **load-bearing** (clean cross-check); nothing in the ADR-0176
architecture describes a capability this manifest's structure fails to host, and nothing in the
structure is decoration with no named action or justification.

## 4 · Open forks — Kim's, stated as OPEN (carried from ADR-0176, not re-decided)

- **OQ1 — `ui-progress` segmented/discrete-steps prop.** Options: **(a)** build a small additive
  `segments`-shaped prop on `ui-progress` before S4-b's step-readout ships (Lane B; earns a short
  SPEC amendment, not a full LLD) — **(b)** ship S4 with the existing continuous `current`/`max`
  approximation, no new prop. Gates only S4-b; does not block S4-a (the step shell itself).
- **OQ2 — provider brand marks in `@agent-ui/icons`.** Options: **(a)** add real
  Google/GitHub/etc. glyphs to the default icon pack (opens a trademark/licensing question distinct
  from the usual zero-dep byte budget) — **(b)** ship S3 with generic/neutral provider icons only,
  no brand marks. Gates S3's start (the provider-button row's visual content depends on the
  answer).
- **OQ3 — interactive fake transport vs. static demo.** Options: **(a)** each slice's docs-site
  example wires a real in-memory fake `identity-mock-transport` implementation (interactive demo;
  larger build surface per slice, richer live specimen) — **(b)** each example stays a static,
  non-interactive visual specimen (smaller build surface; the fence in ADR-0176 cl.2 holds either
  way). **Ground-truth correction to ADR-0176's own framing:** this choice does NOT gate the
  `*.flow.json`/layout-card grading GH #490's Acceptance criterion 1 requires (§0) — it only gates
  whether **X1** (the seam SPEC) is a hard prerequisite before S1's build starts (needed under (a),
  optional/deferrable under (b)).

None of OQ1–OQ3 is pre-decided here. S1/S2 can dispatch without an OQ1/OQ2 answer (neither touches
S1 or S2); S3 cannot start until OQ2 is answered; S4-b cannot start until OQ1 is answered; X1's
urgency (blocking vs. advisory) depends on OQ3.

## 5 · Dependency order (dispatchable)

```
OQ3 (Kim) ──→ X1 seam SPEC ─┐  (hard prereq only if OQ3 = interactive; else X1 runs parallel/deferred)
                             │
S1 (Registration + Email+Password) ──→ S2 (Codes + Magic Link) ──→ S3 (Social Auth) ──→ S4 (Onboarding) ──→ S5 (Account Mgmt)
                                                                     ▲                    ▲
                                                        OQ2 (Kim) ──┘        OQ1 (Kim) ──┘ (gates S4-b only)
```

Edges reproduce ADR-0176 cl.4's own sequencing rationale verbatim, formalized: S1→S2 (S2's auth-card
shell reuses S1's), S2→S3 (S3's provider-button row reuses the same shell S2 establishes), S3→S4
(a first-run journey presumes a completed sign-in to demo against — needs every Authentication mode
live), S4→S5 (S5 generalizes its worked exemplar against real login/onboarding demo state). Within
each slice, the pattern/control build (`-a`/`-b`) precedes its own flow card (`-c`), layout card
(`-d`), pattern-skill row (`-e`), docs page (`-f`), and GH issue (`-g`) — those five are otherwise
parallel-safe with each other (file-disjoint: SKILL.md row / docs-site page / flow-checker input /
layout-checker input / a GH Issue body share no file).

## 6 · Recommended first slice

**S1 — Registration + Email+Password.** Lowest risk (ADR-0176 cl.4's own reasoning): pure Lane-C
composition over already-shipped primitives, zero new controls, establishes the one "logged in"
state every later slice needs to demo against. It needs **no OQ answer** to start. Its only
precondition is **OQ3** — not because OQ3 blocks S1's own build (it doesn't; S1's flow/layout cards
grade independent of transport wiring, §0), but because OQ3's answer determines whether **X1** (the
seam SPEC) must land as a hard-blocking first leaf or can trail S1 as an advisory doc. Recommend
routing OQ3 to Kim alongside this handback so S1 can dispatch immediately either way.

## 7 · What each future slice's own decomposition still owes

This manifest sequences the FAMILY into slices and right-sizes their paperwork tier; it does not
decompose S2's code-entry control into its own components/interfaces (that is S2-a's own LLD,
authored when S2 dispatches, per this repo's own precedent of a per-slice LLD feeding a per-slice
build-level decomposition — e.g. `table-widening.decomp.md`'s S1–S6 shape). Each slice's own future
LLD/build-decomposition inherits this manifest's dependency order and doc-tier ruling; it does not
re-litigate ADR-0176 or this doc.
