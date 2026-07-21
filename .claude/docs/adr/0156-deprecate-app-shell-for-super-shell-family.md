# ADR-0156 — `ui-app-shell` is deprecated in favor of the `ui-super-shell` archetype family (the shell-archetypes LLD §7 fork ruled: Option C)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-20
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-20 *(authored)* |
> | **Proposed by** | appshell-packet seat (the shell-archetypes-m5 LLD §7 fork revisit — Kim's ruling, 2026-07-20, in-session batched question round: **Option C**, overriding the §7.1 packet's A+B′ recommendation) |
> | **Ratified by** | *(pending — Kim flips, via the in-tree hand-edit or a `ratify ADR-0156` GitHub utterance per [ADR-0149](./0149-pr-native-adr-ratification.md))* |
> | **Repairs** | [`../lld/shell-archetypes-m5.lld.md`](../lld/shell-archetypes-m5.lld.md) §7 (the open fork → resolved Option C; §7.1 carries the evidence base this record cites) |
> | **Supersedes / Superseded by** | Supersedes [ADR-0082](./0082-app-shell-per-instance-isolation.md) *(in full — the isolation capability retires with the component, not ported)* · Supersedes (partial) [ADR-0083](./0083-app-shell-region-role-decouple.md) + [ADR-0084](./0084-app-shell-narrow-reflow-collapse.md) *(their `ui-app-shell` mechanisms retire; the ratified PATTERNS live on as family law in the super-shell grammar — see clause 3)* · Relates [ADR-0151](./0151-named-shell-archetypes-m5.md) / [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) (the archetype family everything consolidates onto) |

`ui-app-shell`/`ui-app-shell-region` (M1, ADR-0082/0083/0084) are deprecated in favor of the
`ui-super-shell` archetype family (ADR-0151/0154): the component pair stays in-tree, functional, and
gate-covered while its one production consumer (`a2ui-live`) migrates, takes no new consumers from this
record forward, and is removed in a later, separately-gated step. The two ratified capabilities with zero
production consumers — per-instance style isolation (ADR-0082) and per-region `collapse="toggle"`
(ADR-0084) — are dropped with the component, not ported.

## Context

The shell-archetypes M5 LLD deferred one fork for Kim's ruling
([`../lld/shell-archetypes-m5.lld.md`](../lld/shell-archetypes-m5.lld.md) §7): should the package carry
TWO independent shell primitives (`ui-app-shell`, a closed five-named-area grid; `ui-super-shell`, the
open recursive rail+panes grammar), merge them (B), or deprecate the older one (C)? The revisit
precondition fired 2026-07-20 — `ui-workspace-shell` and `ui-chat-shell` exist and compose
`ui-super-shell` (`workspace-shell.ts:41`, `chat-shell.ts:57`), and the docs-site chrome runs on it
(`site/pages/_page.ts:913`). §7.1's evidence, measured against the tree that day:

- `ui-app-shell`'s production consumer surface is ONE page — `site/pages/a2ui-live.ts:64-73` — and
  `ui-super-shell` already has full parity for everything that page actually uses (`nav-pane` →
  `navigation`, the `data-landmark` override, `narrow-start="stack"`; `super-shell.ts:62-98`).
- The two capabilities super-shell does NOT have — `isolated` and per-region `collapse="toggle"` — are
  consumed by docs demo + tests only (including two OTHER components' reconnect fixtures that ride
  `isolated` as a test vehicle — clause 4 names them). No production surface uses either.
- The §7.1 packet recommended Option A plus a small shared-vocabulary extraction (B′), weighing near-term
  cost. **Kim ruled Option C** — consolidate the family onto one grammar — in-session, 2026-07-20, via a
  batched question round. This record is that ruling's decision record; it awaits Kim's own ratification
  signal like any other ADR (the in-session ruling directs the proposal; only the flip ratifies it).

## Decision

**`ui-app-shell` and `ui-app-shell-region` are deprecated. The `ui-super-shell` archetype family
(ADR-0151/0154 — `ui-super-shell` + its `ui-workspace-shell`/`ui-chat-shell` presets) is the one shell
grammar new work composes on.** Six clauses; the migration itself is a separate campaign, not this
record's scope.

1. **Deprecation posture.** The pair stays in-tree, functional, and covered by its existing gates for the
   whole migration window — deprecation is a direction, not a breakage. The consumer freeze is effective
   from the RULING date, 2026-07-20 — the direction is Kim's ruling; ratification flips this record, not
   the freeze start. From that date it takes NO new consumers (no new page, package, test-fixture, or
   example composes it; the existing ones are the migration surface, clause 4). REMOVAL is a later,
   separately-gated step: its own issue, its own green-gate evidence, dispatched only after the migration
   surface is empty.
2. **Capability fates — dropped, not ported.** `isolated` (ADR-0082's per-instance shadow-DOM opt-in) and
   per-region `collapse="toggle"` (ADR-0084/LLD-C11's user-collapsible affordance) retire with the
   component. Neither is ported to `ui-super-shell`: both have zero production consumers (docs demo +
   tests only), and super-shell's own grammar deliberately ruled per-pane collapse YAGNI
   (`super-shell.ts:15-17`). A future need for either re-enters through a NEW ADR against the
   super-shell grammar — never by resurrecting `ui-app-shell`.
3. **Pattern continuity — the partial-supersession content.** ADR-0083's role-decoupled-from-placement
   law and ADR-0084's narrow-reflow PATTERN — the declarative per-X reflow enum with a stay-visible
   `stack` arm — REMAIN IN FORCE as family law, homed in the super-shell grammar: the `data-landmark`
   override (`super-shell.ts:79-85`, which cites ADR-0083 as its precedent) and the `narrow-* ∈
   collapse·stack·tabs` enum (`super-shell.ts:98-99`; ADR-0154 named ADR-0084's vocabulary as its
   alignment precedent). The two enums themselves share only `stack` — clause 2 drops the `toggle`
   member with the component, so it is the pattern that survives, not the member list. Only the
   `ui-app-shell`-specific mechanisms (the `landmark`/`collapse` props on `ui-app-shell-region`) retire.
4. **The migration surface, named** (from §7.1's enumeration — the migration campaign's scope, not
   this record's): `site/pages/a2ui-live.ts:64-73` re-hosts onto the family (its actual usage has full
   parity today); `site/pages/a2ui-live.css:21-57`'s pane rules re-key — they select the page's own
   `.chat-pane`/`.canvas-pane` classes plus one `[data-page-content] > ui-app-shell` element selector
   (`:29`), so the CSS cost is that one selector plus class carry-over, not a region-attribute sweep;
   `site/pages/a2ui-live.browser.test.ts:40-47,75-176`'s measured-rect equivalence baseline re-measures
   against the new markup (a re-baseline, not a regression); the `ui-app-shell` teaching page
   (`site/pages/app-shell.ts`, `site/app-shell.html`, nav row `site/main.ts:868`) gets a deprecation
   banner now and is re-scoped to the super-shell family or retired — the campaign decides which; two
   out-of-folder fixtures compose `<ui-app-shell isolated>` as the relocation-reconnect VEHICLE for
   other components' reconnect-idempotence tests (`settings.browser.test.ts:330-331`,
   `master-detail.browser.test.ts:139-140`) — at removal each needs a REPLACEMENT reconnect vehicle (a
   real detach/reattach harness or another relocating host), not a rename; `@agent-ui/app`'s export
   surface, package README, `getting-started.ts`'s package summary, and CLAUDE.md's `app` row update at
   removal.
5. **Old-record lifecycle, sequenced.** At THIS record's ratification, ADR-0082/0083/0084 gain forward
   pointers (`Superseded by ADR-0156`, `(partial)` marked on 0083/0084) in their Supersedes / Superseded
   by cells — executed as an agent REV-annotated mechanical pointer repair immediately post-flip (the
   doc-standards §2 exception for accepted bodies; `adr_ratify.py` writes only the ratified record's own
   Status/Ratified-by/README-row/index and carries no cross-ADR pointer logic, and `adr-status-guard`
   blocks only Status flips — which stay untouched by that repair). Their **Status cells stay `accepted`
   during the deprecation window** — while the component ships, those records still describe a live,
   functional element — and flip to `superseded` at the REMOVAL gate, not before (Kim's flip or the
   sanctioned script path, never an agent Edit).
6. **This record is docs-only.** No code, test, or page changes ride it — the migration campaign
   (dispatched separately, gated on this ratification) owns all of clause 4's execution.

## Consequences

- The package carries both shells for the whole migration window — §7.1's measured duplication (~30
  lines of copied landmark vocabulary + two role-map homes) persists until removal. The B′ extraction is
  MOOTED by deprecation (extracting a shared module both shells import makes no sense when one is
  leaving), so the duplication is accepted as-is, time-boxed by the campaign.
- The fleet loses its only shell-level style-isolation story when ADR-0082 retires — a consumer needing a
  style boundary has no shell-provided mechanism afterward. Accepted with eyes open: the capability has
  had zero production uptake since M1; a real future need writes a new ADR against the super-shell
  grammar.
- The `a2ui-live` browser baseline (measured rects, ADR-0083/0084's own dogfood evidence) is re-measured,
  not preserved — the migration campaign carries that as a named acceptance criterion, so it never ships
  as silent test rot.
- The teaching investment in `site/pages/app-shell.ts` (the composition-guide page) is re-scoped or
  retired — real authored work retired by a ruling, recorded here rather than quietly deleted.
- **Stale → re-verify at ratification:** the teaching page (deprecation banner) · `a2ui-live.*` (the
  campaign's scope) · ADR-0082/0083/0084 forward pointers (clause 5) · `app/README.md` +
  `getting-started.ts` + CLAUDE.md `app` row (at removal) · the migration campaign's issue (files at
  dispatch, carries clause 4 as its scope).

## Acceptance

Docs-phase (this change): this record passes the ADR gates and is indexed; the shell-archetypes LLD §7
carries the resolution note citing this number; the docs-grammar gate is green. Migration-phase
(separately dispatched, gated on ratification): `a2ui-live` re-hosted with the re-measured baseline
green cross-engine; the teaching-page fate executed; no `ui-app-shell` composition outside its own
folder, historical records, and frozen archives. Removal-phase (its own later gate): the folder +
exports retire; ADR-0082/0083/0084 Status cells flip `superseded`; CLAUDE.md/README rows update.

## Alternatives considered

- **Option A — keep both shells independent (the §7.1 packet's recommendation).** Rejected by Kim's
  ruling: it keeps two frame primitives with overlapping duty in one package indefinitely, and the
  family's long-term coherence (one grammar, presets as parameterizations — ADR-0151's own
  grammar-ceiling law) outweighs the low near-term cost §7.1 measured.
- **Option B — refactor `ui-super-shell` to compose `ui-app-shell-region`.** Rejected on §7.1's fit
  evidence: a closed 5-named-area grid vs an open ordered flex stack (9 slots, asymmetric N-pane sides);
  the region enum cannot address super-shell's slots; custom-elementing super-shell's built-once wrapper
  parts re-opens the relocation-reconnect hazard class — a multi-round LLD buying ~30 shareable lines.
- **B′ — extract the shared landmark vocabulary into one module + a drift gate.** Mooted by C: the
  duplication's second home is being removed rather than shared.
- **Port `isolated` + `collapse="toggle"` to super-shell for full parity before deprecating.** Rejected:
  both capabilities have zero production consumers, porting isolation means a `:host` mirror of a
  246-line sheet plus the reconnect hazards for a demo's benefit, and super-shell already ruled per-pane
  collapse YAGNI. Parity-on-demand via a future ADR is the cheaper honest path.
- **Freeze-only (no new consumers, but no deprecation).** Rejected by the ruling: it leaves the fork
  permanently half-resolved — the package keeps two grammars and every future shell change still asks
  "which one." C with a functional deprecation window costs the same today and converges.
