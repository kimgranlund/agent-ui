# ADR-0154 — The shell-archetype grammar gains resizable inner panes + tab-based narrow collapse; `ui-agent-admin`'s chat+canvas chrome becomes a `ui-chat-shell` parameterization (GH #52's fork ruled: extend the grammar, not "not a fit")

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-20
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-20 |
> | **Proposed by** | planner seat (the GH #52 design dispatch — Kim's direction ruling, 2026-07-20: proceed by EXTENDING the shell-archetype grammar, overruling the "close as not-a-fit" and "cosmetic wrap" options the #52 investigation had scoped out) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-20, via the [`ratify ADR-0154` utterance](https://github.com/kimgranlund/agent-ui/issues/52#issuecomment-5026864182) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) → v0.3 (additive amendment §8: SPEC-R6 resizable inner pane · SPEC-R7 pane segments + `tabs` narrow arm + the grammar-level survival law; SPEC-R1–R5 untouched) |
> | **Supersedes / Superseded by** | (none) — Extends [ADR-0151](./0151-named-shell-archetypes-m5.md) (the archetype family + its grammar-ceiling law; this delivers its F3 "named follow-up") · Relates [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (`ui-agent-admin`, the chrome being generalized) · [ADR-0144](./0144-pane-tab-content-region-rule-system.md) (the pane/tab/content rule system SPEC-R7's segments compose with) · [ADR-0084](./0084-app-shell-narrow-reflow-collapse.md) (the narrow-reflow vocabulary `tabs` joins) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (prop-as-source-of-truth — deliberately NOT adopted for `size-*`; the R2d self-owned collapse-state model is) · TKT-0085 (the live-surface-survival hardening this lifts to grammar level) |

## Context

GH #52 asks for `ui-agent-admin`'s chat+canvas chrome to re-host onto `ui-chat-shell` — ADR-0151
F3's own "biggest win but deepest surgery" named follow-up. A scoping investigation (Findings on
GH #52, 2026-07-20) found the shapes differ **in kind, not degree**:

- **Wide:** agent-admin composes a user-DRAG-RESIZABLE `ui-split` (`min="16rem"` canvas /
  `min="20rem"` pane) between the conversation and a `{Settings ⇄ Context}` tabs pane.
  `ui-super-shell`'s grammar (SPEC-R1c) has only token-FIXED panes (14 modules / 252px) and no
  resizable-split concept at all.
- **Narrow:** agent-admin reflows to a THREE-tab `ui-tabs` (Chat/Settings/Context) via a bespoke
  real-px `ResizeObserver` that REPARENTS the content units between two prebuilt shells.
  `ui-super-shell`'s narrow story (SPEC-R4) is auto-collapse-to-overlay or `stack` — no tabs.
- **The entanglement:** that reparenting logic is TKT-0085-hardened (guarded moves, real
  Chromium/WebKit-proven) against disconnect/reconnect-cycling `ui-conversation`, which silently
  closes live A2UI surfaces mid game-loop. Two browser pins guard it
  (`agent-admin.browser.test.ts`): *"a live surface SURVIVES a 1200→800 resize"* (same split band —
  nothing may move) and *"a live surface open at a crossing INTO narrow shows Closed"* (the honest
  floor: a reparent necessarily cycles the element, so the surface closes with a visible
  annotation rather than vanishing).

The investigation put a three-way fork to Kim: (a) drop resizability + the 3-tab narrow story for
parity with the current grammar — a silent product-behavior regression; (b) a cosmetic-only wrap
(the existing `ui-split` inside the shell's `content`) — fails the issue's own net-negative-LOC
bar; (c) extend the grammar itself. **Kim ruled (c), 2026-07-20.** Per ADR-0151's grammar-ceiling
law ("the M5 SPEC designs the shell grammar … ONCE, so chat and workspace ship as
parameterizations of that grammar rather than three one-off grids"), the extension belongs to
`ui-super-shell`'s grammar — not to a chat-shell one-off.

## Decision

**`ui-super-shell`'s grammar gains two primitives — SPEC-R6 (a per-side, opt-in user-resizable
INNER pane) and SPEC-R7 (pane segments + a `tabs` narrow-collapse arm) — under a grammar-level
survival law: every new state change is visibility-only, never a reparent. `ui-agent-admin`'s
chrome then migrates onto `ui-chat-shell` as a parameterization of the extended grammar, in a
separate build gated on this ADR's ratification.** Six clauses; mechanisms live in the SPEC v0.3
amendment and the migration LLD ([`../lld/agent-admin-shell-rehost.lld.md`](../lld/agent-admin-shell-rehost.lld.md)).

1. **The extension lands at the grammar ceiling.** Both primitives are `ui-super-shell` grammar
   (SPEC §8), not chat-shell specials — the ADR-0151 clause-3 discipline. `ui-chat-shell` stays a
   thin preset and merely FORWARDS the new knobs (`resizable-end`, `size-end`, `narrow-end`,
   the segment/label data-attributes ride the authored children untouched).
2. **SPEC-R6 — resizable inner pane.** At most the innermost pane per side; separator part with
   `ui-split`'s drag/keyboard contract; JS writes only namespaced custom properties; bounds from
   two new R1c-ladder tokens (`--ui-super-shell-pane-min-size` / `--ui-super-shell-canvas-min-size`);
   committed size = the reflected `size-start`/`size-end` prop (the R2d observable+settable
   persistence law — the collapse-state model, a deliberate, named divergence from ADR-0102's
   controlled-`sizes` mode); `change` on commit.
3. **SPEC-R7 — segments + `tabs` narrow arm.** `data-segment` children give a pane a shell-owned
   pane-local tab strip at wide (retiring consumer-composed `ui-tabs`-in-a-pane); `narrow-* =
   'tabs'` flattens content + panes (one tab PER SEGMENT of a segmented pane) into a shell-owned
   top-level strip at narrow — reproducing agent-admin's Chat/Settings/Context trio structurally.
4. **The survival law, and one deliberate behavior delta.** SPEC-R7c makes visibility-only
   mechanics NORMATIVE: no band crossing, tab switch, segment switch, or resize may reparent
   authored content. Consequence for the migrated agent-admin: the *"crossing INTO narrow shows
   Closed"* pin — an artifact of the reparenting mechanism, documented as its honest floor —
   UPGRADES to *"a live surface SURVIVES the crossing into narrow (and tab switches)"*. This is a
   product-visible behavior change on a shipped surface; this ADR ratifies it explicitly so it
   never ships as a refactor's silent side effect. The same-band pin (1200→800 survives) carries
   over unchanged — trivially, since the grammar has no JS layout moves at all.
5. **What the migration deletes.** `#applyLayout`, the `ResizeObserver` wiring, the dual prebuilt
   shells (the `ui-split` composition + the narrow `ui-tabs`), the guarded-move machinery, and
   agent-admin.css's docking rules — the issue's net-negative-LOC bar is the gate. What it KEEPS
   untouched: the store-swap conversation reset (GH #145), the composer/turn arms, entry sections —
   the migration is chrome-only.
6. **Sequencing.** This ADR + SPEC v0.3 + the migration LLD are the design deliverable (GH #52
   stays open, design-phase). The grammar build (super-shell + chat-shell) and the agent-admin
   migration are follow-up builds, dispatched only after Kim ratifies this record — the migration
   files as its own scoped issue carrying the pin-swap of clause 4 as a named acceptance criterion.

## Consequences

- `ui-super-shell` grows real interaction machinery (a separator, two strips) — no longer purely
  compose-and-CSS. The behavior-only law (SPEC-R3) still holds: geometry/collapse/placement only,
  zero data/transport/navigation.
- The narrow `tabs` arm gives the family a THIRD narrow vocabulary member (`collapse` · `stack` ·
  `tabs`), aligned with ADR-0084's region vocabulary rather than a bespoke agent-admin story.
- The fleet gets ONE drag-resize mechanism if the LLD's recommended fork lands (exporting the
  `pane-resize` trait from `@agent-ui/components`' public surface — a public-API widening needing
  its own gate check; the alternative is an independent re-derivation, the LLD's named fork).
- `agent-admin.browser.test.ts`'s pinned DOM shape (`:scope > ui-split`, `:scope > ui-tabs`)
  becomes stale at migration — the LLD maps each existing pin to its analog; the Closed-pin swap is
  clause 4's ratified delta, not test rot.
- Two new tokens join the R1c ladder; the size budget re-measures at the build wave (ADR-0040/0049
  discipline).
- **Stale → re-verify at the build wave:** `super-shell.md`/`chat-shell.md` descriptors (new
  props/parts) · the site's shell pick-table/demo pages · CLAUDE.md's `app` row if the archetype
  list's wording shifts · GH #52 (re-scope to the follow-up build issue at ratification).

## Acceptance

Design-phase (this change): SPEC v0.3 §8 exists and passes the docs-grammar gate; this record
passes the ADR gates and is indexed; the migration LLD exists; GH #52 carries the dated Findings
comment and stays open (`doing`). Build-phase (post-ratification, separately dispatched): SPEC
AC9–AC12 green cross-engine on `ui-super-shell`'s own suite; the agent-admin migration lands
net-negative on bespoke chrome LOC with the clause-4 pin swap and zero regressions on the
untouched arms (store-swap reset, turn arms, entry sections).

## Alternatives considered

- **Parity-by-subtraction (fork a):** migrate onto the current grammar by dropping drag-resize and
  the 3-tab narrow story. Rejected: a real product regression shipped as a refactor side effect —
  the exact failure mode clause 4 exists to prevent.
- **Cosmetic wrap (fork b):** keep the bespoke `ui-split`+`ResizeObserver` composition inside the
  shell's `content`. Rejected: removes almost none of the bespoke docking/reflow code (fails GH
  #52's net-negative bar) and teaches nothing reusable.
- **Extend `ui-chat-shell` instead of the grammar.** Rejected: violates ADR-0151's
  grammar-ceiling law — the next consumer with a resizable pane (a workspace inspector, an editor
  properties pane) would re-derive it; chat-shell stays a thin preset.
- **Compose `ui-split` INSIDE the shell's middle row.** Considered for R6 and rejected at SPEC
  level: `ui-split`'s pane-count MutationObserver + ratio model fights the shell's per-side
  `display:none` collapse (a hidden `ui-split-pane` still counts, still gets a separator); the
  separator TRAIT is the right reuse altitude, not the container element. The LLD carries the
  trait-export fork.
- **A new sibling archetype (`ui-admin-shell` / a resizable-split shell).** Rejected: ADR-0151
  already names extraction the default gate for NEW archetypes, and agent-admin's shape is the
  chat archetype (conversation + tools pane) — a fourth tag would fork the family over two props.
