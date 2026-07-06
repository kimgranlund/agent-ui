# Changelog

Notable milestones of `agent-ui`. This file is the shipping summary; the sources of truth are the
milestone ledger (`.claude/docs/goals.md`), the plan (`.claude/docs/plan.md`), and the decision log
(`.claude/docs/adr/`).

## 2026-07-05 — the components foundation is COMPLETE (G0–G9 · Control Suite · icons · G8)

The full arc — G0 (tooling) through G8 (gallery + release-readiness) — is done and green. `agent-ui` is a
zero-dependency, signals-based web-component library in strict modern TypeScript: signals reactivity ·
FACE custom elements · tagged-template rendering · traits.

### What shipped

- **The foundation (G0–G7, G9).** The signals kernel (push-staleness / pull-value graph, equality cutoff,
  ownership scopes, budgeted microtask scheduler) · the `UIElement`/`UIFormElement` FACE hosts with
  props-as-typed-signals (`ReactiveProps`, decorator-free) · the tagged-template engine with the public
  `mount` + `repeat`/`watch` + directive-authoring seam (ADR-0023) · the trait system · the
  container/layout family (row/column/list/grid/card/tabs/modal, ADR-0015/0016). Light DOM by default,
  ARIA via `ElementInternals` only, zero native form elements, imports strictly inward.
- **The full FACE Control Suite (Waves 0–5 + the G7 completion).** ~25 `ui-*` controls: button · the
  12-type `ui-text-field` (`text … password · number · currency · unit · percent · date · time`, ADR-0044/
  0047/0048) · the Indicator family (checkbox/switch/radio/radio-group) · the Range family (slider/
  slider-multi) · the Overlay family (popover/tooltip/menu/select/combo-box, ADR-0043/0045) · `ui-calendar`
  · `ui-field` + `ui-form-provider` (ADR-0050/0051) · `ui-text` (ADR-0078). Every control shipped through
  the per-control bar: descriptor + contract trip-wire, jsdom probes, the cross-engine browser smoke
  (Chromium AND WebKit), and an independent review ≥ 4 on both rubric axes.
- **`@agent-ui/icons` + `ui-icon` (ADR-0065/0066).** The swappable icon-pack adapter (registry · resolver ·
  declarative consumer), Phosphor vendored at build time as the default pack — zero runtime dependency.
- **G8 — the gallery + release-readiness pass (ADR-0079/0080/0081).**
  - `<component-gallery>`: the docs-site surface that dogfoods the kernel end to end — a `filter` signal,
    a `watch`+`repeat`-reconciled grid over descriptor-derived members, `watch` readouts — composed over
    `<component-preview>` (hardened for fleet-wide construction: the `NO_SLOT_TEXT`/`SLOT_TEXT_OK`
    partition, sample children, demo seeds — ADR-0077 Amendment 1).
  - `<theme-provider>`: ONE theming subtree — `scheme` (light/dark) · `scale` · `density` live, plus the
    **reserved `theme` package seam** (one `default` package; the multi-theme package-swapping system is
    next-tier scope).
  - **Per-control `exports` + the marginal size gate (ADR-0080):** `@agent-ui/components/controls/{name}`
    public entries + the leave-one-out per-control marginal in `npm run size` — the eventual DISTRIBUTED
    footprint is now what the gate measures (realizes ADR-0049 Amendment 1).
  - **The family-coherence standing gate (ADR-0081):** 3 groups / 9 invariants across the whole fleet
    (events vocabulary + the pure-activation `click` carve-out · size-enum + inverse-`[size]` · base
    ladder · descriptor naming · token discipline · registration · the two-way `open` pair), each with a
    biting negative control — plus a judged read-only audit, clean at zero MAJOR (the one MAJOR found,
    select's missing size axis, closed: `ui-select` joined the sized entry family).

### Final gates (2026-07-05)

- `npm run check` (tsc + check:site) — green.
- `npm test` — **2684** jsdom tests, 0 expected-fail markers.
- `npm run test:browser` — **806** tests, Chromium + WebKit.
- `npm run size` — foundation **6542 / 7168 B gz** · family barrel **22935 / 23552 B gz** · per-control
  marginals within budget (one cited override: text-field **4021 / 4352 B gz** — the 12-type family).

### Decision ledger

ADRs **0001–0081** ratified (log + lifecycle: `.claude/docs/adr/README.md`; supersessions and amendments
recorded append-only). `plan.md` §12's open decisions are all **resolved or explicitly deferred** — the
one deferral: **library emit** (per-control exports are emit-ready on TS source; the `dist/` + `.d.ts`
flip lands at first publish — Kim-confirmed).

### Deferred follow-ups (recorded, owned)

- `ui-combo-box` `size` axis — the second picker's sized-entry-family completion.
- `formUserInvalid` per-control error legs (the recorded G7 follow-up).
- Button-motion browser-test flake hardening.
- The multi-theme `theme` package-swapping system (the seam is wired; one `default` package ships).

### Next tier

Layout/display primitives vs agent-app surfaces (+ the multi-theme package system) is **Kim's scope-dial
decision — deliberately left unchosen here**.
