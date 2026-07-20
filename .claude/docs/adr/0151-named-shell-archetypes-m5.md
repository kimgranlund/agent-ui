# ADR-0151 — Named shell archetypes join agent-app-surfaces as M5: `ui-chat-shell` + `ui-workspace-shell` + `ui-super-shell`, behavior-only app-tier compositions (two extracted from in-repo chrome, one owner-spec'd)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-18
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-18 |
> | **Proposed by** | host session (the `*-shell` patterns intake — Kim's ask 2026-07-18; scope pinned at the intake question round: a NAMED SHELL FAMILY, not app-shell hardening and not docs-only patterns) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-19, via the [`ratify ADR-0151` utterance](https://github.com/kimgranlund/agent-ui/pull/45#issuecomment-5015949775) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) → v1.3 (additive: PRD-G9 + milestone M5 + one scope row; PRD-D1–D6 and the M1–M4 targets untouched — the ADR-0120 amendment discipline applied a second time) |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0120](./0120-app-surfaces-m4-panes-settings.md) (the "chrome extends agent-app-surfaces" precedent this follows, incl. its F2 shipped-composition-over-taught-pattern ruling) · [ADR-0082](./0082-app-shell-per-instance-isolation.md)/[ADR-0083](./0083-app-shell-region-role-decouple.md)/[ADR-0084](./0084-app-shell-narrow-reflow-collapse.md) (the frame contract the archetypes compose) · [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) (the M2 surfaces the chat archetype docks) · [ADR-0130](./0130-nav-rail-family-unification.md) (the nav-rail family whose mode-1 consumer IS the workspace archetype's extraction source) · [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (`ui-agent-admin`, the chat archetype's third in-repo instance) · [ADR-0115](./0115-spa-router-v1-scope.md) (router stays app-invisible — archetype navigation binding is consumer wiring) |

## Context

The agent-app-surfaces family has shipped its PARTS — the generic frame (`ui-app-shell` +
`ui-app-shell-region`, M1), the agent-native surfaces (`ui-conversation`, `ui-surface-host`, M2/ADR-0129),
the nav-rail family (ADR-0130), and the M4 chrome (master-detail, settings, `ui-split`) — but no layer
names the WHOLE SHAPES those parts keep being assembled into. A developer building "a chat app" or "an
admin workspace" still re-derives the same composition by hand every time: which regions exist, which
surface docks where, what collapses when narrow, and how the pieces wire together.

The gap is not hypothetical — the repo itself keeps paying it:

- **The chat shape is hand-assembled at least three times.** `site/pages/a2ui-live.ts` (the PRD-D5
  reference app), `site/pages/a2ui-chat.ts`, and `ui-agent-admin`'s internal layout (ADR-0132) each
  independently re-answer the same `[ conversation | canvas ]` docking, narrow-reflow, and
  composer↔transport↔canvas wiring questions. (GH #42 — the click→turn e2e gap on two of the three;
  the third, `a2ui-live`, already carries the ADR-0088 §3 harness the other two would have to copy —
  is a downstream symptom: three bespoke copies of one composition need three bespoke test harnesses.)
- **The workspace shape carries a written IOU.** `site/pages/_page.ts`'s SHELL NOTE says it verbatim:
  the nav rail is now the real `ui-nav-rail` (ADR-0130 mode 1), but *"the remaining top-bar / footer /
  CTA are still CSS-only placeholders an app-shell component family will own later."* That "later" has
  no owning record until this one.
- **The pattern language is proven prior art.** The adia-ui `*-shell` family (admin · chat · editor ·
  simple · embed) demonstrates the tier that works: behavior-only page-chrome composites — the shell
  wires slot routing, state reflection, and reflow; the consumer authors the light-DOM children. agent-ui
  has the stronger substrate (the frame primitive + surfaces already exist); what it lacks is only the
  named composition layer on top.
- **The maximal shape now has an owner-supplied spec.** At this intake (2026-07-18) Kim contributed
  the "super shell" sketch — recorded on GH #44 (rows-collapsed, otherwise verbatim) — a two-level
  RECURSIVE shell (app ⊃ canvas):
  a compound side per edge and level (an icon strip + a pane, symmetric left/right), per-level
  header/footer with DIFFERENT corner ownership (app level: the side stacks span full height,
  header/footer span center-only; canvas level: header/footer span the canvas width, panes flank only
  the area — deliberate or artifact is a SPEC question to put to Kim), N panes per side, and a
  breakpoint cascade that collapses OUTER-IN: the app rails first (to `pane-toggle` buttons at the
  app-header's ends), the canvas panes next (to `canvas-pane-toggle` at the canvas-header's ends).
  The `*-toggle` behavior is ADR-0084's `collapse: "toggle"`, already REALIZED at M4 (LLD-C11) — the
  sketch adds the affordance-PLACEMENT contract (the toggle lands in the owning level's header
  corners). Kim also supplied the app-header's internal anatomy (same session, on GH #44): three
  zones — `[ leading | content | trailing ]` — leading = the menu/pane-toggle affordance + brand
  (icon, label); content = actions/tabs; trailing = actions/menus. The narrow-state `pane-toggle` is
  the leading/trailing toggle affordance by construction, and the docs-site header (brand + the
  TKT-0088/0096 scheme/theme controls) already maps onto the zones — convergent with the workspace
  extraction source; whether `canvas-header` shares the anatomy under the sketch's recursion, and the
  zones' realization (slots vs sub-regions), are M5-SPEC business. The rest, the current five-region
  grid cannot express: no compound sides, no full-height side stacks, no shell-in-shell idiom. *(In-tree stale-comment note, recorded not fixed here:
  `app-shell.ts`'s M1 banner still calls `toggle` "a RESERVED future value" — stale since LLD-C11
  realized it lower in the same file.)*

Kim ruled the tier question once already, at the M4 intake: *"panes and a settings shell are chrome —
extend agent-app-surfaces"* (ADR-0120, Q3). Shell archetypes are chrome by the same test, and the same
DAG mechanics hold: nothing needs to import an archetype downward, so the apex (`@agent-ui/app`) is the
right home, and no components-tier primitive is forced out of this intake (the archetypes compose
already-shipped controls only).

## Decision

**Named shell archetypes join `agent-app-surfaces.prd.md` as milestone M5 (goal PRD-G9) — no sibling
PRD — shipped as thin, behavior-only `ui-{archetype}-shell` compositions in `@agent-ui/app`, v1 set =
`ui-chat-shell` + `ui-workspace-shell` (each gated on re-hosting its own in-repo extraction source) +
`ui-super-shell` (Kim's intake ruling, 2026-07-18 — spec-sourced from the GH #44 sketch, the family's
grammar ceiling).** Realized in six clauses; the M5 SPEC/LLD own mechanisms at build.

1. **Ownership (the ADR-0120 precedent, applied):** the chrome tier's PRD owns the archetypes — scope,
   goal, and milestone land in `agent-app-surfaces.prd.md` v1.3, additively (D1–D6/M1–M4 untouched).
   No `shell-family.prd.md` sibling is minted.
2. **The vehicle — shipped, behavior-only compositions.** Each archetype is a real `@agent-ui/app`
   element composing `ui-app-shell` + the shipped surfaces: it OWNS the region preset, the
   narrow-reflow choreography (`collapse` per region), and the wiring seams between the surfaces it
   docks; the CONSUMER authors the content (light-DOM children into named slots/regions). An archetype
   never owns data, transport, or navigation: the chat archetype ACCEPTS a consumer-provided
   session/transport handle at the ADR-0129 boundary (its surfaces never own a transport — that law
   stands; and ADR-0129 F1's reasoning for rejecting a transport-shaped prop — agree on the wire
   format, never on how a turn is produced — is a NAMED reconciliation obligation the M5 SPEC must
   answer explicitly when it draws the handle contract), the workspace archetype exposes selection
   state/events, and router binding stays the consumer's three lines (ADR-0115's app-invisible law).
3. **The v1 set — two extracted, one owner-spec'd (Kim's intake ruling, 2026-07-18).**
   `ui-chat-shell` (the `[ conversation | canvas ]` agent app: three in-repo instances) and
   `ui-workspace-shell` (nav rail + header + content pages: the docs site's own shell, the SHELL NOTE
   IOU) enter extraction-gated. `ui-super-shell` — the maximal two-level recursive shape (Context; the
   GH #44 sketch is its spec) — enters on Kim's explicit ruling at the intake question round,
   OVERRULING this intake's extraction-only recommendation (F2 below): the owner-supplied sketch, not
   an in-repo instance, is its source, and its browser-truth proof is a dedicated demo page exercising
   all three breakpoint states. The super shell is also the family's GRAMMAR CEILING: the M5 SPEC
   designs the shell grammar — shell-in-shell nesting, compound icon-rail+pane sides, per-level corner
   ownership, toggle-affordance placement (composing M4's realized `collapse: "toggle"`), N panes per
   side — against it ONCE, so chat and workspace ship as parameterizations of that grammar rather than
   three one-off grids. Simple/centered and embed remain NAMED, NEED-GATED future archetypes —
   extraction stays the DEFAULT gate for future entries (the PRD-D5 discipline that anchored M1);
   the earlier editor/studio deferral is absorbed, the super shell being that shape's general form.
4. **Naming.** Tags follow the fleet law as `ui-{archetype}-shell`: `ui-chat-shell`,
   `ui-workspace-shell`, `ui-super-shell`. `ui-app-shell` keeps its name and its altitude — it stays
   the generic frame PRIMITIVE beneath every archetype, never renamed, never specialised. "workspace"
   (not adia's "admin") because this repo already spends "admin" on `ui-agent-admin` — a surface, not
   a shell — and a `ui-admin-shell`/`ui-agent-admin` pair would read as parent/child when they are
   neither. "super" keeps Kim's own name for the maximal shape — "studio"/"editor" would mislabel a
   general geometry as one product genre.
5. **Catalog + layering disposition.** Archetypes are trusted frame (PRD-D2): catalog-invisible by
   construction, never agent-emittable, outside the SPEC-N2 gate's scope. Inside the package the
   altitude rule is one-way: archetypes compose surfaces and the frame; no surface or frame element
   ever imports an archetype (the per-package layering trip-wire extends to assert it).
6. **The teaching layer rides the shipped thing.** Each archetype ships its `{name}.md` descriptor
   (fleet DoD), and the docs site gains a "choosing a shell" pick-table + per-archetype page DERIVED
   from those descriptors (the docs-author drift-gate discipline) — documentation accompanies the
   composition; it never substitutes for it (ADR-0120 F2's reasoning, unchanged).

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the vehicle.** *Recommend: shipped `ui-{archetype}-shell` elements (clause 2).* Alternatives:
  (a) taught recipes only — a docs/skill pattern layer over the existing parts; (b) a hybrid
  `preset="chat|workspace"` prop on `ui-app-shell`. (a) re-creates the exact rot this tier exists to
  end — the site's CSS-only placeholders ARE that taught pattern, still un-owned in-tree (PRD §1;
  ADR-0120 F2). (b) is rejected in Alternatives below: archetypes differ in composed CHILDREN and WIRING, which
  a prop on the frame cannot author, and it bloats a ratified primitive's contract.
- **F2 — the v1 set.** *Recommend: chat + workspace, exactly two (clause 3).* The honest alternative is
  adding `ui-embed-shell` (a host page sizes/centers one mounted surface — cheap, and the a2ui
  embedding story wants it eventually); it is deferred because no in-repo instance exists to extract
  from, and a greenfield archetype guessed at v1 is how contracts get invented instead of proven.
  Editor/studio and simple/centered are further still from evidence.

  **ANSWERED by Kim, 2026-07-18 (the intake question round): THREE archetypes — the recommendation is
  OVERRULED.** The super shell joins v1 as a sibling archetype with Kim's own sketch (GH #44) as its
  spec — an owner-supplied source standing in where no in-repo extraction source exists. Clause 3 and
  the Decision headline are amended to match; extraction remains the DEFAULT gate for future
  archetypes (simple/centered, embed).
- **F3 — the acceptance proofs (the gates).** *Recommend: `ui-chat-shell` ⇒ re-host
  `site/pages/a2ui-live.ts` (already the PRD-D5 reference app — its remaining page-level chrome goes
  net-negative again); `ui-workspace-shell` ⇒ re-host the docs-site shell itself (`_page.ts`'s
  top-bar/footer placeholders retire onto the archetype); `ui-super-shell` (per F2's answer) ⇒ a
  dedicated site demo page proving the full GH #44 sketch — all three breakpoint states, the outer-in
  collapse cascade, both toggle tiers — cross-engine, since no re-host exists for it by construction.*
  Re-hosting `ui-agent-admin`'s internal chrome onto `ui-chat-shell` is a NAMED FOLLOW-UP, not an M5
  gate — it is the biggest win (it collapses GH #42's three-surface coverage problem toward one) but
  also the deepest surgery, and gating the wave on it would couple the archetype's contract to
  agent-admin's game-loop arc.

## Consequences

- **The app tier gains a third altitude.** Frame primitive (`ui-app-shell`) → surfaces (conversation ·
  surface-host · nav-rail · master-detail · settings) → archetype compositions (`ui-*-shell`). The
  one-way altitude rule (clause 5) is a new trip-wire obligation on the package.
- **The M5 SPEC owns a GRAMMAR, not just compositions (F2's answer raises the wave's design lift).**
  The super shell forces the shell grammar past the five-region grid — shell-in-shell nesting,
  compound icon-rail+pane sides, per-level corner ownership, toggle-affordance placement, N panes per
  side — and the SPEC designs that grammar once, against the ceiling, before any archetype builds.
  Whether the grammar lands as new `ui-app-shell` region vocabulary, a nesting contract over the
  existing element, or archetype-internal structure is LLD business; the SPEC owns the behavior
  contract either way.
- **PRD-G1's "~0 bespoke chrome" metric gets a second consumer.** The docs site shell — the repo's
  oldest bespoke chrome, predating the tier — becomes a dogfooding consumer at M5 (F3); the SHELL NOTE
  IOU closes. The site build is load-bearing for every docs page, so the re-host lands behind the
  full browser gate, not just jsdom.
- **The chat triplet converges.** a2ui-live re-hosts at M5; agent-admin follows (F3's named
  follow-up); GH #42's e2e coverage concentrates on the archetype's own click→turn probe instead of
  three bespoke harnesses.
- **Size budget.** New `@agent-ui/app` line-items measured at the build wave against the ADR-0040/0049
  re-base discipline — thin behavior-only composites are expected cheap (the composed controls are
  already counted in the components/app bundles), but expected ≠ asserted: the gate decides.
- **Stale → re-verify at the M5 build wave:** `agent-ui-compose-app` §3 (the Shell step gains the
  archetype pick-table) · `site/pages/_page.ts` SHELL NOTE (retires with the re-host) ·
  `roadmap.md` §3 (the intake enters Next at ratification) · CLAUDE.md Layout's `app` row ·
  `llms.txt`/site nav for the new docs pages · GH #42 (its acceptance may re-target the archetype).

## Acceptance

This is an **intake** ADR — realized in stages:

- **Intake (this change):** the PRD v1.3 amendment exists (goal/scope/milestone only — no ratified
  decision edited); this record passes the ADR gates and is indexed; GH #44 records the work item
  (the ADR-0145 backend); doc-review dispatched on the amendment + this record. No code changes.
- **M5 (separately dispatched, post-ratification, as Kim sequences):** `ui-chat-shell` +
  `ui-workspace-shell` + `ui-super-shell` ship app-tier with the full fleet DoD (descriptors,
  contract↔props trip-wire, cross-engine browser-truth, whole-shape, forced-colors, size line-items);
  the two extraction proofs land with net-negative bespoke-chrome LOC and the super-shell demo page
  proves the full GH #44 sketch (three breakpoint states, the outer-in collapse cascade, both toggle
  tiers) cross-engine; the altitude trip-wire (clause 5) is green; the docs pick-table +
  per-archetype pages derive from the shipped descriptors; catalog scope stays clean (no allowlist
  residue).

## Alternatives considered

- **A `preset` prop on `ui-app-shell` (`preset="chat"`).** Rejected: a preset can set a grid, but an
  archetype's value is the composed children and their wiring (composer↔transport↔canvas; rail↔pages
  selection) — authoring children from a prop inverts the host-as-container content model the frame
  ratified (ADR-0082..0084), and every future archetype would grow the one primitive's contract.
- **Taught patterns only (docs site + skill, no shipped element).** Rejected: the tier's founding
  thesis — proving a composition possible is not making it reusable (PRD §1) — plus the standing
  ADR-0120 F2 ruling; the site's own placeholders are the counter-evidence in-tree.
- **The full five-archetype set at v1 (adia parity: + editor, simple, embed).** Rejected as a SET:
  simple/embed have no source of either kind and stay named, need-gated (clause 3). The editor/studio
  shape did enter v1 after all — but as the super shell on Kim's owner-supplied spec (F2's answer),
  not on adia parity; the extract-don't-guess default stands for everything without such a source.
- **A sibling package (`@agent-ui/shells`).** Rejected: the apex exists precisely for chrome
  compositions; a new DAG node adds layering surface and a size line-item for zero isolation benefit —
  nothing imports the apex either way.
- **A sibling PRD.** Rejected: Kim's ADR-0120 Q3 ruling — the chrome tier has ONE owning PRD; a
  sibling splits one tier's story across two documents.

## Amendment (2026-07-20 build finding — stale context corrected, decision unchanged)

This ADR's own Context/Decision text names `site/pages/a2ui-live.ts` as `ui-chat-shell`'s extraction
source ("the third, `a2ui-live`, already carries the ADR-0088 §3 harness the other two would have to
copy"; "a2ui-live re-hosts at M5"). Checked against the actual code during the round-4 build (the
five-round shell-archetypes review plan, `shell-archetypes-m5.lld.md` §6's own amendment) and found
FALSE: neither `a2ui-live.ts`, `ui-agent-admin` (`agent-admin.ts`), nor `a2ui-chat.ts` hand-rolls a
conversation-list/nav-pane pane to extract — `ui-conversation` (the shared primitive all three
compose) is pure message-feed + composer, with no header/nav concept of its own. `a2ui-live.ts` was
not touched by the `ui-chat-shell` build at all.

What genuinely shipped as the extraction: `a2ui-chat.ts`'s own hand-rolled `.chat-shell`/`.chat-head`
PAGE CHROME (not a conversation-list) — deleted from that page's own CSS/DOM construction in favor of
the shared `ui-chat-shell` composition (PR #118, closing GH #98). `nav-pane` ships as part of the
archetype's grammar (matching `ui-workspace-shell`'s sibling shape) but has no content provider in
this migration — the absence law (SPEC-R1), not a gap.

This is a factual correction to the WHERE, not a reversal of the WHAT — the decision to ship
`ui-chat-shell` as a thin, behavior-only composition stands exactly as ratified; only the specific
extraction-source claim was wrong. Recorded here per this repo's own append-only convention (accepted
ADRs are never edited in place) and its "stale context is a defect" operating law.
