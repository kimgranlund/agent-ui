# ADR-0227 — the sanctioned context/shared-state grammar: single-owner signal-backed stores, explicitly injected; CSS cascade for presentational axes; the three point solutions ratified in place; community `context-request` NOT adopted (trigger re-scoped fact-shaped) — and `@agent-ui/data` ADOPTED, first consumer the agent-admin persona roster CRUD

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-20
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-20 |
> | **Proposed by** | planning lane against GH [#1538](https://github.com/kimgranlund/agent-ui/issues/1538) (due-process Phases 1–2, GH #969) — pulling ADR-0050's own named re-evaluation trigger, on F3 + F4 of the data-model review corpus (`../reports/data-model-review-2026-08-20/`, Kim's 2026-08-20 fold-into-one-lane ruling on the issue). Number 0227 claimed against the file tree (0226 present at HEAD, zero open PRs claiming a number) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-20, via the [`ratify ADR-0227` utterance](https://github.com/kimgranlund/agent-ui/issues/1538#issuecomment-5358414310) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification + build (wave 1, the roster adoption — none authored here): `CLAUDE.md` §Layout/DAG rows (`app` gains the `data` import edge ADR-0192 cl.1 reserved as "`app` MAY, later") · `packages/agent-ui/app/package.json` (+`@agent-ui/data`) · the inward `layering.test.ts` trip-wires touched by that edge · `site/pages/agent-admin-presets.ts` (the hand-rolled roster keys retire onto the new source) · `site/pages/agent-admin-app.ts` (roster/active-id become derivations of the one resource) · `../reports/data-model-review-2026-08-20/follow-up-queue.md` Q6 mints, Q3/Q4 fold into it (its own ordering note). GH #1538 IS the §1 tracking issue holding these items — this cell gets commented onto it at flip time; the wave PR carries `Refs #1538`, never `Closes` |
> | **Supersedes / Superseded by** | (none) — **Resolves** ADR-0050's Consequences trigger line ("if a second context consumer appears, the community `context-request` protocol is the named re-evaluation trigger") — the re-evaluation this record IS; ADR-0050's decision stands whole. **Relates** [ADR-0051](./0051-uiformelement-field-labelling-seam.md) (the second point solution, ratified in place here) · [ADR-0117](./0117-theme-provider-shipped-component.md) (the third, likewise) · [ADR-0192](./0192-agent-ui-data-package.md) (the package this record gives its first consumer; its structural-sharing move-down condition and soft-global default store are cited, untouched) · [ADR-0193](./0193-shared-storage-adapter-seam.md) (+ its ratified sync-read amendment — the persistence tier the adopted source rides) · [ADR-0115](./0115-spa-router-v1-scope.md) (the `defaultRouter` soft-global posture cl.2 fences as the exception, never the pattern) |

## Context

**The two findings this record resolves** (data-model review 2026-08-20, Kim's charter: "review our
underlying data model/store, data workflows, context providing, signals… there seems to be a mix of
implementations now"; full inventories in `../reports/data-model-review-2026-08-20/`):

**F3 — no general context/shared-state grammar was ever sanctioned.** The framework has three
structurally unrelated point solutions: ADR-0050's connect-event registry (forms), ADR-0051's direct
imperative signal push (field labelling, one clause away on the same base class), ADR-0117's pure CSS
cascade (theme — deliberately zero kernel state beyond one scheme→`colorScheme` effect). ADR-0050
named the re-evaluation trigger — "if a second context consumer appears, the community
`context-request` protocol is the named re-evaluation trigger" (Consequences) … "do not pre-abstract"
(Alternatives (a)) — and it was never pulled when ADR-0117 shipped the second
provider-shaped control ~8 days later. The cost is measured, not speculative: agent-admin-app is FOUR
stacked generations of state pattern (reactive `SettingsStore` → hand-rolled `Persona[]` on raw
localStorage → imperative push-snapshot roster seam → `StorageAdapter` tier), with two live
user-visible bugs from the same defect class (the "New agent 48"/"Wrench" name split and its Team-pane
twin — `agent-admin-app-state-audit.md` §sync-1/2), a triplicated active-agent-id, and the
`admin.libraries` fresh-object reassignment law (F7) enforced only by call-site discipline. The audit's verdict: every generation
was added because there was never a second sanctioned option to converge on. (One honesty note: the
corpus's `context/provide/inject/singleton` grep-hit list over-reads — the `agent-admin.ts`
"singleton" hits are toast-region ownership comments, not DI attempts; the load-bearing app-tier
evidence is the sync-point map, cited above, not the grep.)

**F4 — `@agent-ui/data` (ADR-0192) is built-but-unadopted.** Ratified and shipped 2026-08-16 with
full core/gateway/stream surfaces, budgets, and tests — and zero real consumers of
`DataSource`/`resource()`/`mutation()`/`paginated()`/gateway anywhere; only the `./stream` NDJSON
hoist has genuine users (`data-persistence-layers.md` §adoption-verdict). Meanwhile the CRUD-shaped
state it was built for — agent-admin's persona roster — hand-rolls its own fetch/state/persistence
logic on pre-ADR-0193 raw localStorage (F5). Kim folded the adoption ruling into this same lane
because the two questions are one: "what is the sanctioned app-state grammar?"

**What the community protocol actually is** (verified against the spec, not the corpus's summary:
`webcomponents-cg/community-protocols/proposals/context.md`, Candidate status, last updated
2025-05-02): a consumer fires a composed, bubbling `context-request` event carrying a strict-equality
context key and a callback; the nearest provider that can satisfy it calls
`stopImmediatePropagation()` and invokes the callback — once, or repeatedly with an unsubscribe when
`subscribe` is truthy. It is zero-dependency by nature (a protocol, ~30 lines to implement), and its
own stated goals are relieving *prop drilling* and crossing composition boundaries the consumer's
author doesn't control. Its own Non-Goals: it is not a state-management alternative — state stores
are things you'd *resolve* via it, not build on it.

**The constraints that decide the fork** (derived, not imported from other frameworks): (1) the
zero-dependency law — nothing here may adopt a library, but a protocol implementation is compatible;
(2) light-DOM/FACE architecture — no shadow boundaries to cross, and pages/app-shells compose their
own subtrees, so the composer of a tree almost always holds a reference to the nodes it wants to feed
(drilling depth ≈ 1); (3) ONE reactivity kernel — the spec's callback/unsubscribe delivery is a
second subscription idiom beside signals, so any adoption would deliver a *signal-backed store* once
rather than re-implement change-notification through callbacks; (4) the import DAG — `data` is a
sibling off `components`, catalog-invisible, with `app` MAY-import reserved by ADR-0192 cl.1;
(5) persistence has one ruled seam (`StorageAdapter`, ADR-0193, genuinely adopted — four production
consumers).

**Who would actually use a context protocol here — the inventoried consumers, one by one:**
- *Forms (ADR-0050)*: the provider aggregates passive members — the request/respond direction is
  INVERTED for this case, per ADR-0050's own Alternatives (a). Would not migrate.
- *Field labelling (ADR-0051)*: the field owns the label nodes and their ids; its Alternatives
  explicitly rejected "a control-pulls protocol (context-style)" as inverting ownership. Would not
  migrate.
- *Theme/scale/density (ADR-0117)*: rides native CSS cascade/inheritance with zero reactive state
  beyond the one scheme mapping — strictly superior for inheritable presentational axes (works for non-component subtrees, costs no
  kernel bytes). Would not migrate.
- *App-tier shared state (the audit)*: the pain is never "a descendant can't discover an ancestor's
  value" — every failing surface already HAS a reference to what it needs; the pain is multiple
  never-synchronized copies of one fact fed by manual pushes. A discovery protocol fixes none of
  that; single ownership does.

So the trigger fires, the re-evaluation runs, and the honest result is: **zero current consumers are
served by `context-request`**, while one *future* consumer class genuinely would be — a subtree whose
composer does not control its ancestry (an agent-composed A2UI surface needing an app-tier store; a
shadow-DOM interop consumer embedding these controls). That class is real but not present, and
pre-abstracting for it is exactly what ADR-0050 declined.

## Decision

**We will sanction ONE shared-state grammar — a single-owner, signal-backed store, explicitly
injected at the composition seam, persisting through `StorageAdapter`, with CSS cascade for
presentational axes — ratify the three existing point solutions in place as correct point solutions,
decline `context-request` adoption now with a fact-shaped re-trigger, and ADOPT `@agent-ui/data` with
the agent-admin persona roster CRUD as its first real consumer.** Five clauses:

1. **The three point solutions are ratified in place — as point solutions, not precedents.**
   ADR-0050's event-registry, ADR-0051's element-handoff seam, and ADR-0117's CSS carrier each
   derived its shape from its own constraints, and each *rejected* the generic-context direction on
   its own record (Context above). None migrates, none is deprecated, and none is a template for app
   state — a new feature reaching for "make another provider-shaped mechanism" is out of grammar
   unless it can make the same constraint-derived case those three did.

2. **The sanctioned grammar for shared/app state, four rules:**
   - **One fact, one owner.** Every shared fact lives in exactly ONE signal-backed store; every
     other surface *derives* (computed / effect / subscribe), never copies. A hand-pushed snapshot
     seam (`setAgentRoster`-style "data-in, RE-CALLABLE") is legitimate only at a package boundary
     where the outer owner is not a store — and then the OUTER side must itself derive the push from
     its one owner, so the snapshot cannot go stale silently.
   - **Delivery is explicit injection.** A store reaches its consumer as a typed prop
     (props-as-signals — the reference-identity rewire `agent-admin.ts`'s `store` effect already
     does) or a constructor/factory argument at the composition root. This fleet's light-DOM,
     page-composed architecture means the composer holds references to the nodes it feeds — the
     drilling cost a discovery protocol exists to relieve is not being paid here.
   - **Persistence rides `StorageAdapter`** (ADR-0193, + its sync-read amendment for same-tick
     hydration on the localStorage tier) — never a raw `localStorage` touch-point. (`SettingsStore`'s
     own sync contract stays untouched per ADR-0193 cl.6; this clause governs NEW state, it does not
     retrofit that seam.)
   - **Presentational, inheritable axes ride the CSS cascade** (ADR-0117's mechanism) — delivery to
     descendants is cascade/inheritance, never kernel state; the provider's own typed reflected
     props and its one scheme→`colorScheme` mapping are in-grammar per ADR-0117 itself.
     Module-level default instances (ADR-0115's `defaultRouter`, ADR-0192's default store)
     stay documented soft-global *exceptions*, never the pattern; traits stay channel-less by design
     ("there is no `host.use()`") — neither is widened here.

3. **The community `context-request` protocol is NOT adopted now — and the re-evaluation trigger is
   re-scoped from consumer-count to a fact.** ADR-0050's "a second context consumer appears" fired
   silently because provider-shaped controls kept appearing that a request/respond protocol wouldn't
   have served anyway (Context). The new trigger is the condition that actually selects for the
   protocol: **a consumer that cannot receive an explicit injection because its composer does not
   control its ancestry** — the named candidates being an agent-composed A2UI subtree needing an
   app-tier store, or a shadow-DOM embedding consumer. When that consumer appears: adopt the spec's
   event contract as written (composed bubbling `context-request`, strict-equality keys,
   `stopImmediatePropagation()`, zero-dep inline implementation), delivering **signal-backed stores
   once** (`subscribe: false` semantics) so reactivity stays on the one kernel — never per-value
   callback subscriptions beside it. Enforcement of THIS trigger is structural, not aspirational:
   clause 5 makes this record the convergence point every new mechanism must cite, so the next
   provider-shaped design cannot ship without confronting this clause the way ADR-0117 never had to
   confront ADR-0050's.

4. **`@agent-ui/data` is ADOPTED — first consumer: the agent-admin persona roster CRUD** (the corpus's
   own nomination, F4/Q6; this ruling FOLLOWS FROM clause 2 — the grammar says CRUD-shaped shared
   state is a single-owner signal-backed store, and `DataSource`/`resource()`/`mutation()` is the
   already-ratified realization of exactly that, so blessing the grammar while shelving its
   realization would sanction a third hand-rolled variant instead). The migration shape, decided
   here, built after ratification:
   - A `PersonaRosterSource: DataSource<Persona>` in the app tier (`list · read · create · update ·
     remove`, plus `subscribe` wired to the adapter's cross-tab seam), persisting through
     `createLocalStorageAdapter` — retiring `agent-admin-presets.ts`'s hand-rolled
     `IMPORTED_PERSONAS_KEY`/`ROSTER_ORDER_KEY`/`ACTIVE_PRESET_KEY`/`modifiedAt`/`seedVersion` keys
     (F5). Large-content routing through the existing IDB store is unchanged.
   - The roster read path becomes ONE `resource()`; renames/saves/reorders/deletes become
     `mutation()`s with prefix invalidation. The page's `roster`/`active` module vars and the
     component's `#pendingRoster` push become *derivations* of that one resource (the active-agent
     id collapses to one owner + two derivations — F6/Q4), and `setAgentRoster` is fed from a
     subscription, closing the write-only-no-read-path class at its root. (The raw
     `localStorage[ACTIVE_PRESET_KEY]` write at `agent-admin-app.ts:330` retires with the keys —
     the Acceptance predicate covers BOTH page modules, not just the presets file.)
   - The DAG edge activates: `app` depends on `@agent-ui/data` (ADR-0192 cl.1's reserved "MAY,
     later"), with `CLAUDE.md`'s DAG row and the inward layering trip-wires updated in the same
     build. `data` stays catalog-invisible; nothing else in the DAG moves. ADR-0192's
     structural-sharing move-down condition (third copy → `components/reactive` or `shared`) is NOT
     tripped by this adoption and stays a watch item (F9/Q8).
   - Follow-up-queue Q6 mints as the build wave; Q3/Q4 fold into it per that file's own ordering
     note. **Honest cost, accepted:** `resource()`'s SWR/dedup/abort machinery is heavier than a
     purely local roster strictly needs — priced against carrying ONE grammar instead of a fifth
     generation, the roster already genuinely spanning two storage tiers (with cross-tab staleness
     unguarded today — the subscription this wave adds), and the alternative leaving ADR-0192 at
     zero consumers indefinitely.
   - **Coupling, stated for a partial ratification:** if Kim rejects clause 2 (ratifying the
     status-quo fork instead), this clause's default flips to SHELVE — a dated deferral so
     built-but-unadopted stops reading as drift — because without the grammar the roster migration
     is churn, not convergence. The two rulings travel together by design (the issue folded them for
     exactly this reason).

5. **Convergence enforcement.** Any NEW provider-shaped control, app-tier shared-state mechanism, or
   persistence touch-point must cite this ADR — conforming to clause 2, or recording a named
   exception with its constraint-derived case (the bar clauses 1's three solutions met). The
   F1/F2 product ruling ("one name or two" — Fork 1 of the review) stays its OWN call, explicitly
   not made here; whichever way it goes, its fix lands in this grammar (one owner, derivations).

## Consequences

- **The next app-tier feature has a default** — for the first time since ADR-0050, "where does shared
  state live" has a sanctioned answer (clause 2) instead of four precedents to pick from. The
  four-generations accretion mode (each feature minting a new pattern) is closed by convergence
  pressure, not by a migration mandate: existing Gen 1/4 code is already conformant; Gen 2/3 retires
  through the roster wave; nothing else is forcibly rewritten.
- **ADR-0050's dangling trigger is resolved** — the re-evaluation it named has now actually run,
  with its outcome recorded here (adopt-later on a fact-shaped condition, with named candidates and
  a structural enforcement path). ADR-0050/0051/0117 stay accepted and byte-untouched.
- **`@agent-ui/data` stops being drift either way** — adopted with a real consumer on ratification,
  or (the clause-4 coupling) explicitly shelved with a dated record. The zero-adoption reading of
  ADR-0192 ends the day this flips.
- **Two build waves mint after ratification, one immediately, one unchanged:** wave 1 = Q6 (roster
  onto `DataSource` + StorageAdapter, subsuming Q3/Q4) — `size:big`, its own due-process loop;
  the independent items Q5 (libraries fresh-object law) and Q7 (site localStorage hygiene) proceed
  on their own and now cite clause 2's persistence rule. The F1/F2 name-bug fix (Q1) stays blocked
  on Fork 1's product ruling, not on this record.
- **Costs named:** `app` gains a workspace dependency edge (budgeted, tree-shaken — ADR-0192's
  measured `.` barrel is 2822 B br); the roster wave touches the app's most central state and needs
  behavior-parity tests (the audit's sync-point map is the test plan's checklist); and clause 3's
  deferred protocol means a future agent-composed consumer pays the adoption THEN rather than
  finding it pre-built — accepted, that is the do-not-pre-abstract discipline holding.
- **Stale → re-verify at the build wave:** `CLAUDE.md` DAG/Layout rows · `app/package.json` + inward
  `layering.test.ts` scans · `agent-admin-presets.ts` / `agent-admin-app.ts` · follow-up-queue
  Q3/Q4/Q6 rows · this record's Ratified-by field.

## Acceptance

- **This record:** ratification only via Kim's `ratify ADR-0227` utterance executed by
  `scripts/adr_ratify.py` (ADR-0149); the status guard blocks every other flip. Rejection of clause 2
  converts clause 4 to the dated shelve record per its own coupling paragraph.
- **Wave 1 (the roster adoption), checkable at its PR:** `packages/agent-ui/app/package.json`
  declares `@agent-ui/data`; every inward layering trip-wire green; `grep -n 'localStorage'
  site/pages/agent-admin-presets.ts site/pages/agent-admin-app.ts` returns ZERO hits and
  `ACTIVE_PRESET_KEY` has zero references outside the new source module (the hand-rolled keys
  retired onto the source); exactly ONE owner for the active-agent id (the audit's three cited sites reduced to one
  write path + derivations); the roster select, Edit-Agents drawer, and Team-pane GM line all render
  from derivations of the one resource; `npm run check` and `npm test` green by exit code.
- **Grammar conformance, standing:** every post-ratification PR introducing a provider-shaped
  control, an app-tier shared-state mechanism, or a new persistence touch-point (clause 5's three
  categories) cites ADR-0227 (conformance or named exception) in its
  descriptor/LLD/PR body — reviewable by grep, enforced at review per clause 5.
- **Trigger hygiene:** if clause 3's fact-shaped condition fires (an ancestry-blind consumer
  appears), the adopting record must cite this clause and deliver stores-once on the one kernel —
  a per-value callback-subscription implementation is out of grammar.

## Alternatives considered

- **Adopt `context-request` wholesale now** — rejected: the re-evaluation ran and found zero current
  consumers it serves (Context — each of the three existing solutions rejected the request/respond
  direction on its own constraint-derived record, and the app-tier pain is ownership, not
  discovery). Implementing a protocol with no consumer is pre-abstraction, the exact failure
  ADR-0050 declined; the one real future consumer class is named as the re-trigger instead, with
  the adoption shape pre-ruled so firing it is cheap.
- **Ratify the status quo ("three point solutions, no general protocol — by design")** — rejected:
  the corpus prices that option — four stacked generations, two live user-visible bugs, a
  triplicated id, and a discipline-only invariant all grew in the vacuum where a second sanctioned
  option should have been. A "by design" plaque stops nothing; only a convergence default does.
  The point solutions ARE ratified in place (clause 1) — what is rejected is leaving app state
  grammar-less.
- **Grow a generic provide/inject seam into `UIElement` itself** (a `host.context()` /
  `host.provide()` base API) — rejected: a base-contract change every control inherits, bought for
  consumers that don't exist — ADR-0050's own reasoning against pre-abstraction, plus the traits
  banner's deliberate "no `host.use()`" channel-less design, which this would quietly reverse.
- **Shelve `@agent-ui/data` (a dated deferral record)** — rejected while clause 2 stands: the
  grammar makes `DataSource` the natural home for the fleet's most central CRUD-shaped state, and
  shelving the ratified realization while sanctioning its grammar would mandate a third hand-rolled
  variant. Kept as the explicit fallback if clause 2 is rejected (clause 4's coupling paragraph) —
  a partial ratification stays coherent either way.
- **A different first consumer (ADR-0192 cl.6's own M2 dogfood — "one `site/` page migrated onto
  `resource()`/`fromFetchStream()`")** —
  rejected: doc-page dogfood is exactly what left the package at zero *real* consumers; the roster
  is live, central, symptomatic, and buys the F5/F6 modernization as a side effect of adoption
  instead of as separate migration chores.
- **Adopt `data` for the roster but keep its persistence on the existing raw-localStorage keys**
  ("smaller diff") — rejected: it re-creates the persistence-style split (F5) inside the very wave
  meant to close it; clause 2's persistence rule and ADR-0193's seam are the point, not an
  accessory.
