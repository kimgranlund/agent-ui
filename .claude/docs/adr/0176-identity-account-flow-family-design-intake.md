# ADR-0176 — Identity & account flow family design intake (GH #490): a mixed cut — Registration/Magic-Link/Social/Email+Password compose EXISTING FACE controls, the Codes mode's code-entry field earns the one new components-tier control, Account Management needs no new control at all (`ui-settings` is already general — the gap is a missing worked exemplar); a DEMO-ONLY security fence (no real auth backend, ever, forced by the zero-dep charter); identity/auth stays host-page-only (never A2UI-catalog-driven) per PRD-D2, onboarding/account-management left open to a future catalog-exposure intake; five-slice sequenced build

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-06
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-06 |
> | **Proposed by** | planner (design seat — the GH [#490](https://github.com/kimgranlund/agent-ui/issues/490) design-intake dispatch; Kim's 2026-08-06T10:18:10Z scheduling-ruling comment on #490, quoted in Context, names the one gate this intake waited on — GH [#480](https://github.com/kimgranlund/agent-ui/issues/480) (the M-D build) closing — and #480 closed at 2026-08-06T10:20:03Z, two minutes later, satisfying it) |
> | **Ratified by** | *(pending — proposed)* |
> | **Repairs** | **On ratification:** `roadmap.md` §4 — the GH #490 line (added by PR [#491](https://github.com/kimgranlund/agent-ui/pull/491), merged 2026-08-06T10:33:43Z, *after* #480 had already closed) is stale the moment this ADR is proposed: its "queued behind the live M-D lane; revisit when a milestone slot opens" framing names exactly the gate this ADR's own header shows already satisfied. The line moves out of §4 Later, restated to this ADR's four frozen rulings and cl.4's named sequencing, not the open-question framing it carries today. `.claude/skills/agent-ui-composition-patterns/SKILL.md` gains one forward-pointer note (this ADR is queued; the five per-flow pattern rows land per build slice, mirroring how ADR-0172 handled `a2ui-multi-catalog`'s forward-pointer). `.claude/docs/prd/agent-app-surfaces.prd.md` §3's v1.2 out-of-scope note (*"What STAYS out: remote sync, account/identity, and policy/permission layers — those route to new intakes, never riders"*, `:154-157`) gains a courtesy forward-pointer naming this ADR as that intake — the sentence it predicted, now answered. **On ratification+build (five future per-slice SPECs/LLDs, not authored here):** NEW `packages/agent-ui/components/src/controls/<code-entry-name>/` (cl.1, the one new control) · five new rows in `agent-ui-composition-patterns/SKILL.md`'s assembly table (Registration, the four Auth modes, Onboarding) · a NEW worked "Account Settings" schema + docs-site page composing the EXISTING `ui-settings`/`SettingsSchema`/`SettingsStore` (`packages/agent-ui/app/src/controls/settings/`) in an identity context (cl.1, Account Management — no new control) · a documented identity-mock-transport seam, shape/home decided at each slice's own SPEC/LLD (cl.2) · docs-site pages + representative examples per flow (GH #490's own Acceptance) · flow-checker/layout-checker graded `*.flow.json`/layout cards per flow (GH #490's own Acceptance criterion 1 — pointed back to, not re-litigated here) · GH #490 sub-issues per slice, filed per ADR-0145's git-native routing. |
> | **Supersedes / Superseded by** | **Relates** [ADR-0102](./0102-css-less-consumer-contract-law.md) (the three-lane chooser — component-owned / catalog-prop / taught-idiom — GH #490's own Acceptance criterion 2 names it explicitly; this ADR's cl.1 applies it per flow, repurposed from its native rendered-correctness domain to a new-control-vs-pattern-composition classification, named explicitly as a repurposing, not a re-derivation of the original law) · **Relates** [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) (the multi-catalog registry/threading mechanism cl.3 reasons from) · **Relates** [ADR-0172](./0172-persona-catalog-composition-intake.md) (the compose-time persona-local-pattern-layer mechanism cl.3 distinguishes identity/auth from, and the precedent this ADR's own document shape/Repairs convention follows) · **Relates** `agent-app-surfaces.prd.md` PRD-D2 (host-chrome-primary / trusted-frame-contains-untrusted-mount — the mechanism cl.2/cl.3 both reason from) and its v1.2 out-of-scope line (`:154-157`, the "account/identity... route to new intakes" fence this ADR answers) · **Resolves** the GH [#490](https://github.com/kimgranlund/agent-ui/issues/490) design-intake half of its own Acceptance criterion 1 ("design intake done with the decomposition skills... before build") — the issue stays open, tracking the sequenced build cl.4 rules. |

## Context

**The design problem** (GH #490's own Summary, verbatim): *"Complete the component + pattern
libraries with a full identity & account flow family — the flow-level UI and cross-screen journeys
that every real app needs and the fleet currently lacks: Registration (sign-up); Authentication —
four modes: Magic Link · one-time Codes · Social Auth · Email+Password; Onboarding (post-auth
first-run journey); Account Management — Preferences and Settings patterns. The FACE form
primitives already exist (`ui-text-field`, `ui-form-provider`, `ui-checkbox`, `ui-button`, …);
`@agent-ui/app` has an agent-admin-specific settings surface. What is missing is the pattern/flow
tier: reusable compositions (auth card, code-entry, social-button row, stepper/onboarding shell,
settings/preferences page patterns) plus the designed cross-screen flows connecting them."*

GH #490's own Acceptance criteria this ADR answers (quoted, load-bearing for cl.1/cl.3):

- *"Design intake done with the decomposition skills: each of the four areas has a graded flow
  card (`flow-checker`) and layout grades (`layout-checker`) before build."* — the graded cards are
  build-time deliverables (cl.4's Repairs), not this ADR's own output; this ADR freezes the
  architecture the graded cards then get built against, exactly the ADR-0172 precedent's own
  intake/build split.
- *"Gap analysis names which pieces are new `ui-*` controls vs pattern compositions vs documented
  idioms over existing controls (CSS-less-consumer three-lane law, ADR-0102)."* — cl.1 is that gap
  analysis.
- *"All four auth modes covered... incl. a code-entry input pattern... incl. password field
  affordances."*
- *"Registration, Onboarding..., and Account Management... each ship as reusable patterns."*
- *"Patterns live at the right layer of the DAG (components vs app) per the layering trip-wires."*

**The scheduling gate — verified satisfied, not asserted.** Kim's own comment on GH #490
(2026-08-06T10:18:10Z, verbatim): *"design intake starts after the M-D lane (#480) closes; queued
in roadmap §4 Later until then (PR #491). Intake = the full decomposition campaign (flow/layout
break-downs + critics) per Acceptance, before any build."* GH #480 ("M-D build — per-persona A2UI
catalog composition per ratified ADR-0172") shows `state: CLOSED`, `closedAt:
2026-08-06T10:20:03Z` — two minutes after Kim's comment. PR #491 (the `roadmap.md` §4 placement
Kim's comment itself names) merged at `2026-08-06T10:33:43Z` — thirteen minutes *after* #480 had
already closed, so its "queued... revisit when a milestone slot opens" prose was stale relative to
Kim's own named trigger the moment it landed. This is the one gate Kim set for this design intake
to begin, and it is satisfied by the timestamps above, not by this ADR's own say-so — the Repairs
cell's `roadmap.md` line names the resulting stale-prose repair.

**Facts verified in-tree, standing on the actual mechanisms (not the abstract shape):**

- **The full FACE fleet, confirmed by directory listing** (`packages/agent-ui/components/src/controls/`):
  action (`button`), entry (`text-field`, `textarea`, `combo-box`, `select`), selection
  (`checkbox`, `radio`, `switch`, `segmented-control`), container/layout (`card`, `row`, `column`,
  `grid`, `list`, `split`), overlay (`modal`, `popover`, `form-popover`, `menu`, `tooltip`,
  `command-modal`), display (`text`, `badge`, `avatar`, `icon`, `progress`, `toast`), the form
  spine (`field`, `form-provider`), and `tabs`/`disclosure`/`pagination`. No `stepper`, `wizard`,
  `otp`, `code-entry`, or `one-time-passcode` control exists anywhere in this list or in
  `@agent-ui/app`'s `controls/` (`agent-admin`, `chat-shell`, `conversation`, `entry-list`,
  `master-detail`, `nav-rail`, `settings`, `super-shell`, `surface-host`, `workspace-shell`) — a
  `grep -rli "otp\|one-time\|code-entry"` across both trees returns nothing but doc/build-tooling
  false positives.
- **`ui-text-field`'s `type=password` already ships the reveal affordance GH #490's Acceptance
  names.** `text-field.ts:116` — the Wave-3 `TYPE_CONFIG` map (ADR-0044) rows `password: {
  inputmode: 'text', ..., affordance: 'reveal', ... }`; `text-field.md:36` — `type` reflects so
  `[type=password]` CSS selectors drive `-webkit-text-security` masking, and the reveal toggle is
  already a shipped, component-owned affordance, not a gap this intake needs to fill. GH #490's
  own Acceptance phrasing ("Email+Password (incl. password field affordances)") reads as a
  requirement already met by the fleet — the flow's own build work is composition (wiring the
  existing typed field into a form), not a new affordance.
- **The catalog-composition mechanism (ADR-0169/ADR-0172) operates one layer below identity
  content, not on it.** ADR-0169 cl.2 (`0169:129-154`): both `default` and `a2ui-basic` catalogs
  pre-register, unconditionally, at renderer-construction — package-shipped, not per-session.
  ADR-0172 cl.1/cl.2 (`0172:121-224`) rules that a persona's LOCAL pattern layer is package-level
  catalog-schema content (`ComponentDef`/`PropDef` shape), composed at derive-time over a selected
  base catalog — its own worked examples throughout are DOMAIN content patterns (a booking flow's
  calendar+confirm idiom, a card-table's hand/score layout), never infrastructure/security chrome.
  Neither ADR's mechanism says anything about whether a CREDENTIAL-BEARING flow should be
  agent-driven — that question is PRD-D2's, reasoned in cl.3 below.
- **PRD-D2's own host-chrome ruling, and the exact out-of-scope line this ADR answers.**
  `agent-app-surfaces.prd.md:175-177` (Fork 2, ratified `:195`): *"the shell/chat/tool-call
  surfaces are host chrome: the developer assembles them... Plane (b) [agent-EMITTABLE surfaces] is
  out (security inversion for the shell)."* The same PRD's §3 Out-of-scope (`:149`): *"A backend /
  agent runtime / transport implementation. The `a2ui-live` transport + provider seam already
  exists... app surfaces consume it, they do not reimplement it."* And, precisely on point
  (`:154-157`, the v1.2 fork-answer note): *"What STAYS out: remote sync, account/identity, and
  policy/permission layers — those route to new intakes, never riders. — the fence moved, it did
  not vanish."* GH #490 is exactly that "new intake" the PRD's own sentence named — a direct
  routing precedent, not an analogy.
- **The zero-dependency charter is a MECHANICAL constraint on any real-backend integration, not a
  preference.** CLAUDE.md's own header: `@agent-ui/components`/`a2ui`/`router`/`code`'s default
  barrels ship zero runtime dependencies by construction, with exactly one ruled exception
  (`@agent-ui/code`'s opt-in `./editor` subpath adopting CodeMirror 6, ADR-0139) — irrelevant here.
  A REAL auth backend integration (OAuth redirect handling, a magic-link/OTP delivery provider, a
  credential-hashing/session library) necessarily either (a) pulls in a client SDK dependency,
  breaking the zero-dep barrel by construction, or (b) hand-rolls credential/token/crypto handling
  inside a UI library, a security-surface responsibility this package has never taken on anywhere
  else in the fleet. Both arms are independently disqualifying — the fence in cl.2 is forced by
  mechanism, not asserted as policy.
- **The `agent-ui-composition-patterns` skill's existing row shape is the precedent cl.1's pattern
  rulings follow.** Its table (`SKILL.md:20-36`) already carries a "labelled, validated form" row
  (`ui-form-provider` + `ui-field`, ADR-0050/0051) and a "schema-driven settings/config page" row
  (`ui-settings` + `SettingsSchema` + `SettingsStore`, ADR-0120/ADR-0158, citing
  `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`'s `settingsItem` helper as "a
  thin wrapper over `foldItem`/`ui-disclosure`") — proof, read directly from the skill and the
  cited files, that `ui-settings` itself is ALREADY a general, schema-driven primitive; the
  "agent-admin-specific" surface GH #490's Links line names
  (`packages/agent-ui/app/src/controls/settings/`, confirmed by directory listing:
  `schema.ts`/`generate.ts`/`store.ts`/`validate.ts`, no agent-admin-specific naming anywhere in
  the module) is the SCHEMA INSTANCE `agent-admin.ts` feeds it, not the control. What GH #490 calls
  "generalized beyond agent-admin's bespoke surface" is a missing WORKED EXEMPLAR (a docs-site page
  + a generic account-settings schema), not new component work.
- **No discrete step-progress control exists; the two nearest primitives are shape-mismatched.**
  `progress.md:15-27` — `ui-progress` is a continuous `value`/`max` bar (no discrete-segment
  attribute). `pagination.md` — `ui-pagination`'s attributes are page-number navigation for
  data tables, a different domain (jump-to-page) than a linear first-run step readout. Neither is
  a clean fit for a stepper's "step 2 of 4" semantics without at least a prop widening — named as
  an open question in cl.1, not decided here.

## Decision

### 1 · Pattern-tier vs new components vs mixed cut — per flow, ADR-0102's chooser repurposed

**Ruling: a mixed cut.** ADR-0102's three-lane chooser was built for a different question
(rendered-correctness delegation), but its first test — *"can the [composition] grammar express the
fix by composition at all?"* — is the exact question GH #490's own Acceptance criterion 2 asks this
intake to answer per flow, and is repurposed here explicitly as: (A) component-owned = needs a
genuinely new `ui-*` control because no existing control or composition of controls can express the
needed BEHAVIOR (not merely styling); (B) catalog/prop-reachable = an existing control gains a
small, additive prop; (C) taught-idiom/pattern composition = fully expressible today by composing
shipped controls, recorded as a new row in `agent-ui-composition-patterns`.

- **Registration (sign-up).** Lane C — pattern composition. `ui-form-provider` + `ui-field`-wrapped
  `ui-text-field` (`type=email`/`type=password`) + `ui-checkbox` (terms) + `ui-button` (submit),
  exactly the shipped "labelled, validated form" row's spine. No new control.
- **Authentication — Email+Password.** Lane C. The password-reveal affordance GH #490's own
  Acceptance names is already shipped (`type=password`, Context above) — this flow's only new work
  is the composed card layout + submit wiring. No new control.
- **Authentication — Magic Link.** Lane C. An email-only `ui-text-field` + submit, then a
  "check your email" confirmation state (`ui-text` + a disabled `ui-button` driving a plain
  interval-updated resend countdown — page-level `setInterval`/signal state, not a new control
  capability) composed the same way any two-state page view already is. No new control.
- **Authentication — Codes (one-time passcode).** **Lane A — new control**, for the code-entry
  field specifically, and named explicitly per GH #490's own ask. The behavior a segmented
  code-entry needs — auto-advance focus to the next cell on input, backspace-to-previous, and
  paste-splitting a full code across N cells — is genuinely new INTERACTION LOGIC, not a styling or
  composition concern; nothing in `agent-ui-composition-patterns`' consumer-side assembly
  vocabulary (CSS/attribute wiring over already-behaviored controls) reaches cross-field focus
  orchestration, and stitching it by hand over N independent `ui-text-field` instances on every
  consuming page is exactly the "per-app glue this tier exists to eliminate" PRD-D2's own Fork-3
  reasoning names for a structurally analogous case. This mirrors how `ui-slider-multi` earned its
  own control rather than being composed from two `ui-slider`s — cross-part coordinated behavior is
  the fleet's own standing signal for "new control," not a pattern. The rest of the Codes flow
  (request-code button, resend timer, submit) is Lane C, same shape as Magic Link.
- **Authentication — Social Auth.** Lane C — a `ui-row` of `ui-button`s, each with a provider
  icon via the existing leading-icon adornment slot (ADR-0006/ADR-0012) and label. No new control.
  **Named, not decided here:** whether `@agent-ui/icons`' default pack needs provider brand
  marks (Google/GitHub/etc.) — a separate, smaller scope question with its own licensing/trademark
  dimension, flagged in Open questions.
- **Onboarding (post-auth first-run, multi-step).** Lane C, with one named Lane-B candidate. The
  step SHELL — next/back navigation + conditional step-panel display — composes cleanly from
  `ui-button` (next/back/skip) and page-level signal-driven panel switching, the same shape any
  multi-view page already uses; no new interactive control is required for that part. The step
  PROGRESS READOUT is the one soft spot Context names: `ui-progress`'s continuous `value`/`max` can
  approximate a "step N of M" readout today (a graceful, cosmetic approximation, never a
  destructive failure — ADR-0102's own chooser step (ii) puts this squarely in Lane C/Lane-B
  territory, not Lane A), but a literal discrete numbered/dotted stepper would need a small additive
  `segments`-shaped prop on `ui-progress` (Lane B) if visual fidelity turns out to matter at build
  time. **Not decided here** — flagged as an Open question for the Onboarding slice's own SPEC.
- **Account Management (Preferences + Settings).** Lane C, and lighter than it looks: `ui-settings`
  + `SettingsSchema` + `SettingsStore` (`packages/agent-ui/app/src/controls/settings/`) is ALREADY
  the general, schema-driven primitive GH #490 asks for (Context, verified above) — no new control,
  no extraction, no generalization work on the control itself. The flow's entire build scope is
  authoring the missing WORKED EXEMPLAR: a generic account-settings `SettingsSchema` instance + a
  docs-site page demonstrating it outside agent-admin's bespoke wiring.

**Layer placement (PRD-D3's own cycle argument, reapplied).** Every Lane-C pattern above composes
only `@agent-ui/components` primitives — they live as `components`-tier pattern rows (the
`agent-ui-composition-patterns` skill), the same layer as the existing form-rhythm/box-model rows,
never `@agent-ui/app` (no A2UI import, no cycle risk). The one Lane-A control (code-entry) is a
components-tier leaf control for the same reason `ui-slider-multi` is. Account Management's worked
exemplar composes an `@agent-ui/app` primitive (`ui-settings` already lives there) — it stays at
that layer, matching where its primitive already sits; nothing here proposes moving `ui-settings`.

**Repairs.** *On ratification:* the forward-pointer note on `agent-ui-composition-patterns`
(Repairs cell, header). *On ratification+build:* the new code-entry control, the five pattern rows,
the Account Management worked exemplar (Repairs cell, header).

### 2 · The security fence — DEMO/pattern surface only, forced by mechanism

**Ruling: hard fence, no exceptions.** This family ships as a demo/pattern surface in a component
library: **no real auth backend, no real credential handling, no real network call to an identity
provider, ever, in the default/shipped state.** This is not a scoping preference — it is forced by
two independent mechanisms named in Context: (1) PRD-D2's host-chrome-primary ruling plus its own
"app surfaces consume [a transport/provider seam], they do not reimplement it" out-of-scope line
(`:149`) — this fleet has never owned backend/transport plumbing anywhere, including for the
already-shipped `a2ui-live` agent transport, and identity is not a case for a new exception; (2) the
zero-dependency charter — a real auth integration structurally requires either a client SDK
dependency (breaking the zero-dep barrel) or hand-rolled credential/crypto handling inside a UI
library (a security-surface responsibility this package has never taken on). Either arm alone rules
out a real backend; both hold simultaneously.

**The seam, named at the shape level only (SPEC/LLD territory beyond this).** Each flow's pattern
composes over a documented, consumer-suppliable seam — mirroring the shape (not the specific
interface) of the `AgentTransport` precedent PRD-D2 cites for a different domain: an async
function-per-action contract (e.g. submit-credentials, request-code, verify-code, oauth-redirect)
that the docs-site demo wires to an in-memory fake, and a real consuming app wires to its own
backend. The exact interface name, shape, and demo-fake implementation are each slice's own future
SPEC/LLD to build — not specified here, per this ADR's own charter (freeze the architecture, do not
pre-build the mechanism).

**Repairs.** *On ratification:* the `agent-app-surfaces.prd.md` §3 forward-pointer (Repairs cell,
header) — the "route to new intakes" sentence it already carries gets an explicit pointer to this
answer. *On ratification+build:* the per-slice documented seam contract, home/shape decided at each
flow's own SPEC/LLD (Repairs cell, header).

### 3 · A2UI/catalog angle — identity/auth stays host-page-only; onboarding/account left open

**Ruling: identity and authentication (Registration + all four Authentication modes) stay
host-page-only patterns, not catalog-expressible, for this wave and by PRD-D2's own boundary
logic — not merely "not yet."** PRD-D2 (Context above, citing `agent-app-surfaces.prd.md:175-177`)
already ruled that the shell/chat/tool-call surfaces are host chrome specifically because letting
the agent author its own trusted container is a security inversion; a credential-bearing form is at
least as security-sensitive as the shell itself (it directly handles what the shell only holds
state about) — the same reasoning applies with, if anything, more force. This holds regardless of
wire-grammar CAPABILITY: ADR-0169's own upstream conformance corpus already includes a canonical
`00_simple-login-form.json` fixture (Context above, citing `0169` Context) — proof that the A2UI
wire protocol CAN describe a login-shaped component tree.
That fixture is a protocol-conformance specimen (proving faithful DOM from a generic `Column`/
`TextField`/`Button`/`Action` payload), not a ruling that this repo's own producer should let an
agent decide what a login form does — the PRODUCT-level question is PRD-D2's, and PRD-D2's answer
is host-authored, full stop, for credential-bearing chrome.

**Onboarding's content-collection steps, and Account Management, are the one genuinely different
case — deferred, not ruled out.** Once past authentication, an onboarding conversation ("tell me
about your team," preference collection) or a settings/preferences surface is content-shaped, not
credential-shaped — structurally the same "domain content pattern" ADR-0172 cl.1 already rules is
package-level catalog-schema content composed at derive-time (a booking flow's calendar+confirm
idiom is the cited precedent). **What would need to be true to reopen this** (named per the
ADR-0172 precedent's own Open-forks discipline, not decided here): (a) M-D's compose-time overlay
(ADR-0172 cl.2) actually ships and proves the composition mechanism in production, and (b) a
concrete need surfaces for an agent to drive onboarding/preference-collection conversationally — at
that point a future, separately-scoped design intake (not a rider on this one) would rule whether
Onboarding/Account Management's content steps become catalog-expressible, the same way this
intake's own trigger (#480 closing) unblocked it.

**Repairs.** None on ratification or ratification+build for this clause — it is a non-build ruling
for this wave; a future reopening intake, if one ever lands, would carry its own Repairs.

### 4 · Scope cut + sequencing — five slices, ruled

**Ruling: five sequenced build slices**, size:big per GH #490's own label, each independently
shippable and gated by GH #490's own Acceptance criteria (pointed back to, not re-litigated):

1. **Credentials baseline — Registration + Email+Password Authentication.** Lowest risk: both are
   pure Lane-C composition over already-shipped primitives (Context — the password-reveal
   affordance already exists), zero new controls, and together they establish the one "logged in"
   state every later slice needs to demo against.
2. **Codes + Magic Link.** The single Lane-A control (code-entry) is built and proven in isolation
   here, before any later flow depends on it; Magic Link ships alongside it at near-zero marginal
   cost (Lane C, no new control).
3. **Social Auth.** Cheap Lane-C composition; sequenced after the code-entry control lands so the
   provider-button row can reuse the same auth-card shell the Codes slice establishes. The
   brand-icon open question (cl.1) is resolved or explicitly deferred before this slice starts.
4. **Onboarding.** Sequenced after every Authentication mode ships, since a first-run journey
   presumes a completed sign-in to demo against; the `ui-progress` segmented-steps open question
   (cl.1) is resolved at this slice's own SPEC, before its build.
5. **Account Management.** Sequenced last: it is the lightest-weight slice (no new control, no
   extraction — Context/cl.1) and benefits most from having real login/onboarding demo state to
   generalize the worked exemplar against.

**Each slice's DoD, at the high level GH #490's own Acceptance already sets (not re-litigated
here):** the pattern/control builds; a docs-site page + representative example ships; the flow gets
a graded `*.flow.json` card (`flow-checker`) and layout grades (`layout-checker`) per GH #490
Acceptance criterion 1; `npm run check && npm test` (+ `test:browser` for any new control) green;
the security fence (cl.2) holds — no slice's demo wiring makes a real network call to an identity
provider.

**Repairs.** *On ratification:* the `roadmap.md` §4 line, restated to name this five-slice order
(Repairs cell, header). *On ratification+build:* per-slice GH sub-issues (ADR-0145 routing), the
graded flow/layout cards, docs-site pages (Repairs cell, header).

## Non-goals (recorded, not silent)

- **No real auth backend, ever, in the default/shipped state** (cl.2) — this is a hard fence, not a
  phased "not yet"; reopening it would be its own future ADR with its own forcing argument, not a
  drift.
- **No code built in this ADR.** Every control/pattern named in cl.1 is a future slice's own
  SPEC/LLD/build; this document freezes the architecture only, per this repo's design-intake
  discipline (ADR-0172's own precedent).
- **No `ui-progress` segments prop, no icon-pack brand-mark addition** — both named as real,
  small, per-slice open items (cl.1, Open questions), not built or ruled here.
- **No catalog/A2UI exposure for any identity flow this wave** (cl.3) — Registration/Authentication
  are ruled host-page-only on security grounds, not deferred; Onboarding/Account Management are
  deferred, reopening only through a future, separately-scoped intake.
- **No re-litigation of GH #490's own Acceptance criteria** — the graded flow/layout cards, the
  layering trip-wire, and the `npm run check && npm test` gate are GH #490's own gates, pointed
  back to (cl.4), not restated or altered here.

## Consequences

- GH #490 gains a ratified architecture to build against: a five-slice sequenced plan (cl.4), a
  per-flow new-control-vs-pattern cut (cl.1) that resolves to exactly ONE new components-tier
  control (the code-entry field) plus five pattern rows plus one worked exemplar (no new control at
  all for Account Management — a lighter build than the issue's own framing implied), a hard
  security fence (cl.2), and a settled host-page-only ruling for the credential-bearing half of the
  family (cl.3).
- `roadmap.md` §4's GH #490 line is stale the moment this ADR is proposed (Context) and must be
  restated on ratification (Repairs cell).
- `agent-ui-composition-patterns` gains a forward-pointer immediately and five real rows across the
  five build slices — the skill's "no roster, derive never recall" discipline holds throughout;
  this ADR does not pre-author the rows themselves.
- Two small, named open items (the `ui-progress` segments prop, the icon-pack brand-mark question)
  are inherited by cl.1's own build slices rather than settled here — this intake narrows the
  design space, it does not finish it, exactly ADR-0172's own stated consequence for its own open
  forks.
- A future intake reopening Onboarding/Account-Management catalog-exposure (cl.3) is now a named,
  citable possibility with a stated precondition, not an unbounded "maybe someday."

## Open questions

- **OQ1 — `ui-progress` segmented/discrete-steps prop widening.** Whether Onboarding's step
  readout needs a literal discrete step indicator (a new additive `segments`-shaped prop on
  `ui-progress`, Lane B) or the continuous `value`/`max` approximation is good enough, is a real
  design call with no in-tree precedent settling it either way (cl.1). Flagged for the Onboarding
  slice's own SPEC — Kim's or the build team's call, not derivable from the cited sources alone.
- **OQ2 — provider brand marks in `@agent-ui/icons`.** Whether the Social Auth provider-button row
  needs real brand glyphs (Google/GitHub/etc.) added to the default icon pack, and if so how a
  trademark/licensing concern (distinct from the usual zero-dep byte-budget question) is handled,
  is genuinely Kim's to decide (cl.1) — not a mechanism question this ADR can resolve from source.
- **OQ3 — whether the demo ships any REAL working mock wiring at all, or stays static.** cl.2 rules
  the fence (no real backend); it does not rule whether each flow's docs-site example wires a
  working in-memory fake transport (interactive demo) versus staying a static, non-interactive
  visual specimen. Both are consistent with the fence; the choice affects each slice's own scope
  and is left to that slice's SPEC, flagged here so it isn't silently assumed either way.

## Alternatives considered

- **Leave GH #490 in `roadmap.md` §4 Later, wait for an explicit re-open ruling** — rejected: Kim's
  own 2026-08-06T10:18:10Z comment already names the one gate (#480 closing) and that gate is
  satisfied (Context); waiting further would be honoring a stale placement over Kim's own stated
  trigger.
- **Treat the whole family as one undifferentiated "pattern tier," no per-flow lane analysis** —
  rejected: GH #490's own Acceptance criterion 2 explicitly asks for the gap analysis (new control
  vs pattern vs idiom) per flow; skipping it would leave the Codes mode's code-entry field
  unclassified, the exact new-control question the issue itself names.
- **Build the code-entry control (or any other flow) inside this ADR** — rejected, per this
  repo's design-intake discipline (ADR-0172's own Alternatives-considered precedent): a
  design-intake ADR's job is to freeze the architecture, not pre-build the SPEC/LLD; doing so here
  would risk over-committing to unverified mechanics (OQ1/OQ2/OQ3) that need their own scoped design
  pass.
- **Rule Onboarding/Account Management catalog-exposure OUT permanently, alongside
  Registration/Authentication** — rejected: the security-inversion argument that forces
  Registration/Authentication host-page-only (cl.3) does not transfer to content-collection-shaped,
  post-auth, non-credential flows; foreclosing it permanently would be a stronger claim than the
  mechanism supports. Deferred with a named reopening precondition instead.
- **A single "identity shell" new component wrapping every flow** (one big new `ui-*` control
  covering registration/auth/onboarding/settings) — rejected: it would violate the fleet's own
  leaf-widget/composition discipline (PRD-D3's reasoning for why app chrome doesn't live inside
  `@agent-ui/components`) and contradicts ADR-0102's own chooser, which asks per-CONCERN whether
  composition already expresses the fix — most of these flows demonstrably do.
