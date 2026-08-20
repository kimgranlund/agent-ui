# Framework state idioms — what the sanctioned mechanisms are

> Slice 3 of the data-model review (2026-08-20). Read-only inventory of `reactive/`, `dom/`,
> `traits/` + the ADR index, by a dedicated reader session. agent-admin-app deliberately out of
> scope (its own slice covers it).

**Headline: the kernel and per-component layers are clean and coherent — but the framework has
NO formal context-providing protocol. Three structurally unrelated point solutions exist
(event-registry for forms, direct signal push for field labelling, pure CSS cascade for theme),
and ADR-0050's own named re-evaluation trigger ("a second context consumer appears → re-evaluate
the community `context-request` protocol") was never pulled when the second provider-shaped
control shipped eight days later.**

## Sanctioned idioms table

| Mechanism | Home | Contract | Ratified by |
|---|---|---|---|
| `signal`/`computed`/`effect` | `reactive/graph.ts:323,326,332` | Push-invalidate/lazy-pull/`Object.is`-cut kernel; effects batched via `scheduler.ts:21` (`schedule`), settled via `scheduler.ts:58` (`whenFlushed`) | goals.md G1 + `rubrics/kernel.md` — **not a numbered ADR** (ported from the "rce" prototype, plan.md:16) |
| `createScope()`/`Scope.dispose()` | `reactive/graph.ts:339` (impl :300) | Ownership container — everything minted under `activeOwner` dies together on dispose; the zero-residue primitive | goals.md G1 |
| `static props` + `finalize()` | `dom/props.ts:97-137, 245-268` | Per-instance signal-backed prototype accessors in a module `WeakMap` (:157); directional-lock'd attribute⇄property reflection (:186-242) | ADR-0005 (upgrade ordering); props-as-signals itself is goals.md G2 |
| `UIElement.effect`/`.listen` | `dom/element.ts:237-254` | The only effect-install primitive on a host — connection-scoped, throws outside connected lifetime | goals.md G2 |
| `RenderContext` (`{effect(fn)}`) | `dom/template.ts:297-299` | Minimal seam so a per-hole directive (`watch`, `dom/watch.ts:57`) installs effects under the HOST's scope — carries zero data, purely a lifetime handle | ADR-0023 |
| `ui-form-connect`/`ui-form-reset` + `formRegistry` | `dom/form.ts:81-103`, `traits/form-registry.ts:64-139` | Composed/bubbling connect event carrying value/validity closures + connection AbortSignal; nearest provider registers into a `members` signal, `stopPropagation()`-scoped nesting, four aggregate computeds on top | **ADR-0050** — "the fleet's first context/provider primitive" |
| `setFieldLabelling`/`fieldLabelling` | `dom/form.ts:478-501` | A SECOND, structurally different handoff on the same base class: plain signal write called imperatively by `ui-field` on a reference it already holds — no event, no registry | ADR-0051 |
| `ui-theme-provider` | `controls/theme-provider/theme-provider.ts:32-44` | Zero JS reactive state beyond one scheme→`style.colorScheme` effect; `scale`/`density`/`theme` are reflected attribute carriers that CSS selectors key off — sharing rides native cascade/inheritance, not the kernel | ADR-0117 — "the fleet's **second** pure-coordination/carrier primitive" |
| traits `(host, opts) => cleanup` | `traits/index.ts:1-2` | Behaviors invoked from `connected()`; state flows in only via `host` + `opts` — the banner states **"there is no `host.use()`"** | plan.md/goals.md convention, no ADR |
| `@agent-ui/data` `DataSource`/`resource()` etc. | sibling package | Verb-optional CRUD seam over kernel signals; instance-scoped structural-sharing store + a documented "soft global" default | ADR-0192 |
| `@agent-ui/shared` `StorageAdapter` | sibling package | Async persistence seam at the DAG bottom; localStorage + IDB tiers | ADR-0193 (+ sync-read amendment 2026-08-17) |
| `:state(pending)`/`:state(working)` | `traits/pending-computed.ts` | Presentation-only host custom-states for async staleness/live mutation | ADR-0191, ADR-0199 |

## Context-providing verdict

**No formal, general context protocol exists.** No Lit-style provide/consume, no DI container,
no `useContext`-shaped lookup. Three structurally UNRELATED point solutions instead:

1. **Event-registry aggregation**, forms only (ADR-0050) — whose own Alternatives section says:
   "if a second context consumer appears, the community `context-request` protocol is the named
   re-evaluation trigger... do not pre-abstract."
2. **Direct imperative signal push**, field labelling (ADR-0051) — one clause later on the SAME
   base class, no event, no registry, no reuse of mechanism 1.
3. **Pure CSS cascade/inheritance**, theming (ADR-0117) — deliberately zero kernel/JS state.

Everything else is prop drilling, or module-level "soft globals" for cross-package concerns
(`@agent-ui/data`'s default store, ADR-0115's `defaultRouter` — both documented as such).

## Gaps / tensions

1. **The named re-evaluation trigger was never pulled.** ADR-0117 shipped a second
   provider-shaped control ~8 days after ADR-0050 without ever mentioning ADR-0050's trigger —
   it built a third, incompatible shape with no discussion of `context-request` adoption.
2. **Same base class, two incompatible hand-off shapes one clause apart** (`dom/form.ts`:
   ADR-0050's registry vs ADR-0051's direct push) with no cross-reference explaining why.
3. **Traits have no cross-trait channel by design** ("there is no `host.use()`") — composing
   controls hand-thread state between trait calls; a second axis with zero shared idiom.
4. **The structural-sharing store is duplicated, self-acknowledged.** ADR-0192 re-implements
   what a2ui already has (DAG forbids `data`→`a2ui` import); its own Consequences: "if a third
   copy ever appears, the mechanism moves down to `components/reactive` or `shared`." Live,
   named tension — the kernel does not own this primitive despite two packages needing it.
5. **Two incompatible persistence contracts coexist by design**: `app`'s sync `SettingsStore`
   vs `shared`'s async `StorageAdapter` (ADR-0193 cl.6 explicitly declines to unify). A
   component author asking "how do I persist state" gets two non-interoperable answers by layer.
6. **`app/src/controls/*` is the predicted blast zone.** grep hits for
   `context`/`provide`/`inject`/`singleton` across settings, entry-list, nav-rail, agent-admin,
   workspace-shell, super-shell, conversation — under a framework with zero blessed context
   mechanism, each likely rolled its own (the agent-admin-app slice confirms the instance-level
   picture). Kim's "mix of implementations" traces to gap #1: there was never a second
   sanctioned option to converge on.

No DOM-bypass-the-kernel violations found in `reactive/`/`dom/`/`traits/` themselves — every
write path read goes signal→effect→imperative-DOM-call. The one deliberate kernel bypass is
theme-provider (ADR-0117), declared as such.
