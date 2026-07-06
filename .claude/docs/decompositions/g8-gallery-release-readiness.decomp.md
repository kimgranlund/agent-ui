# G8 — gallery demo + release-readiness pass · decomposition

> Companion to the gated manifest [`g8-gallery-release-readiness.decomp-v2.json`](./g8-gallery-release-readiness.decomp-v2.json)
> (`coverage_check.py` exit 0, plan mode — every leaf carries an `accept` predicate). Spec of record:
> **`goals.md` §G8** (its Goal/Scope/DoD). Design doc: [`component-gallery.lld.md`](../llds/component-gallery.lld.md).
> ADRs (all `proposed`; Kim ratifies): **ADR-0079** (gallery architecture) · **ADR-0080** (per-control
> exports + marginal gate) · **ADR-0081** (family coherence gate). · 2026-07-05 · planner
>
> **v2** (2026-07-05; manifest versioned to [`…decomp-v2.json`](./g8-gallery-release-readiness.decomp-v2.json),
> v1 preserved): the doc-review pass (M1 `moveBefore` naming · M2 the mode-"ui" aside deleted · M5 the
> ADR-0077 backlink joins n4b) + **Kim's theming reframe** — "tone" DROPPED, the provider is
> `<theme-provider scheme scale density theme>` (**F1 RESOLVED**); the `theme` package seam is reserved +
> wired, package SWAPPING deferred next-tier (tied to F2b). **F2a confirmed by Kim** (emit defer stands).
> Manifest diff: n1a/n1b/n4b `accept` + the a5 action label updated; nothing structural moved.

## Ground truth this plan stands on (surveyed, not assumed)

- `<component-preview mode="component">` (ADR-0077, `site/lib/component-preview.ts`) ALREADY renders any
  `ui-*` control from its `{name}.md` descriptor with live knobs + read-back. The gallery **composes** it —
  zero specimen-rendering code is re-built. *(Note: the component mode attribute value is `component`, not
  `ui`.)*
- The fleet member list is derivable from `ALL_DESCRIPTORS` (`site/lib/frontmatter.ts:89`, the build-time
  glob) — the same source `loadDescriptorByTag` reads. Derive, never hand-list.
- The public seam the gallery may consume (ADR-0023): `signal/computed/effect` + `UIElement` +
  `mount(result, container, ctx)` + `repeat` + `watch` + the directive trio (`Directive`/`directive`/
  `NO_COMMIT`). `html``` is **private**. `watch`'s mapper may return a nested directive (sanctioned,
  `dom/watch.ts:5-8`) — that is the reactive-grid composition. A `UIElement` structurally satisfies
  `RenderContext` (`{ effect }`, `dom/template.ts:297`).
- **Found constraint:** a `ChildPart` child hole commits text/TemplateResult/array/directive only — a raw
  Element stringifies (`template.ts:457-462`). Cards therefore ride a ~15-line site-local `node()` directive
  on the public trio. And `ChildPart.moveBefore` (template.ts:442) does not relocate directive-owned deep
  content (`template.ts:435`), so the gallery's member order is **fixed alphabetical** — a filter yields an
  order-preserving subsequence (pure enter/exit, zero reorders). Documented in the LLD §6; relates the open
  `repeat` focus-seam item (#69/ADR-0022).
- Theming axes that exist: `[scale]` (ui-sm…content-lg) · `[density]` (compact/comfortable/spacious) ·
  color scheme via `light-dark()` + `color-scheme` (tokens.css:2). **Kim's ratified reframe (2026-07-05;
  F1 RESOLVED): "tone" is DROPPED** — the provider is **`<theme-provider>`** carrying `scheme`
  (light/dark → `color-scheme`) + `scale` + `density`, plus the **reserved `theme` package attribute**
  (`theme="<name>"`, e.g. `mad-max`). G8 ships ONLY the `default` package: the seam is wired (attribute +
  one-option selector), the multi-theme package-SWAPPING system is explicitly next-tier scope (tied to
  F2b). LLD-C4 + ADR-0079 clause 3 carry the design.
- `scripts/measure-size.mjs` measures 2 barrels today; package `exports` exposes no per-control entry —
  ADR-0049 Amendment 1 booked exactly this gap for G8.
- Site constraints: the labeled-group TOC must equal the component fleet exactly (`site-toc` gate) ⇒ the
  gallery page joins the NAV as an **ungrouped** link (ADR-0077 precedent).

## Task components

| # | Node | Task | Owning seat | Depends on |
|---|---|---|---|---|
| T1 | n1a | `<component-gallery>` + `<theme-provider>` (`site/lib/theme-provider.ts`) + `gallery.html`/`pages/gallery.ts` + ungrouped NAV link | `system-builder` (site infra — NOT `component-builder`: the gallery is deliberately not a fleet `ui-*` control) | ADR-0079 ratified or provisionally green-lit |
| T2 | n1b | Gallery gates: jsdom probes + cross-engine browser smoke (whole-shape · theme axes · forced-colors) | same seat as T1 (tests ride with the build) | T1 |
| T3 | n1c | Independent review of the gallery, pre-commit | `component-reviewer` (read-only) | T2 |
| T4 | n2a | Per-control `exports` map + drift gate | `system-builder` (packaging) | ADR-0080 |
| T5 | n2b | `measure-size.mjs` leave-one-out marginal + pinned budget table | same seat as T4 | T4 |
| T6 | n3a | `family-coherence.test.ts` standing gate (+ negative control per invariant) | `system-builder` | ADR-0081 |
| T7 | n3b | Judged read-only cross-family audit + budgets/tree-shake evidence | `component-reviewer` | T5, T6 |
| T8 | n4b | Ratify ADR-0079/0080/0081 + apply the ADR-0077 `Extended by ADR-0079` backlink in the same change (M5 — the two-way link discipline) | Kim (routed by the coordinator; generator ≠ ratifier) | docs authored + revised (this pass) |
| T9 | n4a | Apply the §12 dispositions to plan.md + sync goals.md | `docs-writer` | T8 (+ Kim's answers on F2) |
| T10 | n5a | CHANGELOG/status note; flag the NEXT-tier scope dial | `docs-writer` | T3, T5, T7, T9 |

Fan-out shape: T1→T2→T3 (one seat chain + review), T4→T5 (one seat chain), T6 (parallel single seat) are
**file-disjoint** and can run concurrently; T7 consolidates; T8–T10 are the serial ledger tail. No shared
file has two writers (T1 alone touches `_page.ts`; T4 alone touches `package.json`).

## Acceptance criteria + test plans per task

**T1 — gallery build.** AC: the manifest n1a `accept` predicate. Test plan: `npm run check` (incl.
`check:site`) + `npm run build`; grep-gate that `component-gallery.ts` imports only the public
`@agent-ui/components` barrel (no deep `src/` path); NAV link lands ungrouped so `site-toc.test.ts` stays
green unchanged. Build details: LLD §2–§7.

**T2 — gallery gates.** AC: manifest n1b. Test plan: (jsdom, `site/` vitest project)
`gallery.test.ts` — derived member list ≡ the `ALL_DESCRIPTORS` ui-*-tag set (negative control: a planted
phantom member fails); filter produces an order-preserving subsequence; card node identity survives a
filter toggle (enter/exit only — the same element object returns); the shown-count `watch` readout tracks
without re-running the host render effect; a `mount` WITHOUT ctx leaves the watch hole empty (the
enumerated-failure probe). (browser, Chromium+WebKit) `gallery.browser.test.ts` — every non-overlay
specimen's bounding box > 0 in the grid (the whole-shape law); each overlay-class specimen (descriptor
declares an `open` attribute) is opened first, then its panel box > 0; setting the ONE
`<theme-provider>`'s `scale`/`density` changes a specimen's computed px and `scheme` flips a specimen's
used colors (anti-vacuous both directions); the `theme` select renders exactly one option (`default`) and
the attribute lands on the provider subtree (the wired-seam assertion); Chromium forced-colors leg:
gallery chrome + a sample of specimens keep visible ink (tabs precedent for the WebKit split).

**T3 — gallery review.** AC: manifest n1c. Read-only; verdict GO/NO-GO with both applicable axes ≥ 4
before the commit (the discipline that caught 18 cross-engine bugs in Wave 4 — non-optional).

**T4 — per-control exports.** AC: manifest n2a. Test plan: `barrels.test.ts` extension asserting the
three-way equivalence exports-map ↔ control folders ↔ family-barrel `export *` lines; negative control
(a planted unpaired entry fails). Structure per ADR-0080: explicit
`"./controls/{name}": "./src/controls/{name}/{name}.ts"` entries (+ `./controls/radio-group` →
`radio/radio-group.ts`); compounds resolve to their family main module (card drags its regions by real
dependency — that IS the tree-shake truth).

**T5 — marginal size gate.** AC: manifest n2b. Test plan: `npm run size` prints per-entry
`marginal` (leave-one-out: `gz(ALL) − gz(ALL ∖ {c})`) + informational solo absolute; exit 1 on any breach
of the pinned table (default 2048 B gz; override rows carry a cited reason — expect text-field and calendar
to need one, measured first, then pinned); plant a `budget: 1` locally to prove the gate bites, then
remove. Policy: the gate stays MANUAL (`npm run size`), per Kim's standing ADR-0040 §3 ruling — not wired
into `check && test`.

**T6 — coherence standing gate.** AC: manifest n3a (invariants enumerated there + ADR-0081). Test plan:
each invariant asserted over the live fleet AND proven to bite via a synthetic violation (string-level
fixture, not a real control edit).

**T7 — judged audit.** AC: manifest n3b. Read-only report over: keyboard-contract symmetry across the
five families; internals-only ARIA uniformity; the two-way `open` contract (ADR-0019) uniformity across
overlay/tabs/modal; `formUserInvalid` error-leg presence per form control (the recorded G7 follow-up);
density/scale response uniformity. Evidence = file:line citations + the T5/tree-shake/size runs. Clean =
zero MAJOR open; every finding filed with an owner.

**T9 — §12 ledger.** AC: manifest n4a; the dispositions below, as ratified.

**T10 — status note.** AC: manifest n5a. CHANGELOG.md records G0–G9 + Control Suite + icon adapter + G8
with gate figures; the NEXT-tier fork is flagged as Kim's, not chosen.

## plan.md §12 dispositions (proposed — T9 applies them after T8/F2)

| §12 item | Disposition | Reason / evidence |
|---|---|---|
| Test runner | **RESOLVED** (already, G0) | Vitest; recorded in §12 already — no change. |
| App build/dev entry | **RESOLVE** | The docs site IS the app entry; `vite build` green since the ADR-0077 wave (its Acceptance cites the build). §12's "no entry until the gallery" text is stale — repair it; the G8 gallery joins an already-live build. |
| Library emit | **DEFER with reason** — *Kim CONFIRMED (F2a, 2026-07-05)* | No external consumer/publish target exists. T4's exports map targets TS source (private package) but is shaped emit-ready: at first publish, flip targets to `dist/` + `.d.ts` via a `tsconfig.build.json` — mechanical, no API redesign. Revisit trigger: the first out-of-repo consumer or a publish decision. |
| Password exception | **RESOLVE** | The strict zero-native line HELD: `type=password` shipped on the contenteditable surface with masking (ADR-0044) — the rce allow-listed `<input type=password>` exception was never needed. Residual (accepted, documented in ADR-0044): OS/password-manager autofill does not engage. |
| Shadow vs light for the app shell | **RESOLVE** | Light DOM held everywhere; the site shell is deliberately CSS-only light-DOM (`_page.ts` SHELL NOTE). `static shadow` remains the unused opt-in seam. Revisit only if an app-shell control family is scheduled (that scheduling is the NEXT-tier dial, F2b). |
| declare-merge prop risk | **RESOLVE (close)** | Validated at G2 (`props-typing.test.ts`, negative-control-proven) and load-bearing fleet-wide since. The risk line is retired. |

## Kim decisions — status

- **F1 — theming vocabulary: RESOLVED** (Kim, 2026-07-05). "Tone" is dropped; the provider is
  `<theme-provider>` with `scheme` (light/dark) + `scale` + `density`, plus the reserved `theme` package
  seam (`theme="<name>"`; one `default` package in G8; package swapping = next-tier scope, tied to F2b).
  Recorded in ADR-0079 clause 3 + LLD-C4; goals.md's DoD wording repairs on ratification.
- **F2a — library emit: CONFIRMED** (Kim, 2026-07-05). The defer-with-reason stands as written — exports
  land emit-ready on the TS source; the JS build emit is deferred to first publish. ADR-0080 clause 1 and
  the §12 disposition above already state exactly this (verified consistent).
- **F2b — NEXT-tier scope** (layout/display primitives vs agent-app surfaces) — STILL OPEN; flag only,
  per the DoD. The deferred multi-theme package system (F1) is tied to this dial.
- **F3 — ADR ratification** of 0079/0080/0081 (proposed; never self-accepted) — PENDING (the next step).

## Dependency order (dispatchable)

```
[ratify ADR-0079/0080/0081 — Kim]        (T8; can green-light T1/T4/T6 provisionally on 'proposed' if Kim prefers)
   ├─ T1 gallery build ──→ T2 gallery gates ──→ T3 component-reviewer GO ─┐
   ├─ T4 exports map ────→ T5 marginal gate ──────────────┬──────────────┤
   └─ T6 coherence gate ──────────────────────────────────┴─→ T7 audit ──┤
T8 ──→ T9 §12 ledger ─────────────────────────────────────────────────────┴─→ T10 CHANGELOG
```
