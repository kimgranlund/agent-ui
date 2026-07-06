# ADR-0079 — `<component-gallery>`: a site-local, kernel-dogfooding gallery composed over `<component-preview>`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-05 |
> | **Proposed by** | planner — the G8 planning intake (decomp `g8-gallery-release-readiness`) |
> | **Ratified by** | Kim — 2026-07-05 |
> | **Repairs** | `goals.md` §G8 DoD line 1 (realization recorded on ship; its "tone" wording → `scheme` + the reserved `theme` seam) · new `site/lib/component-gallery.{ts,css}` + `site/lib/theme-provider.ts` + `site/pages/gallery.ts` + `site/gallery.html` + `_page.ts` NAV (build-time, gated on ratification) · ADR-0077 `Supersedes/Superseded by` gains the `Extended by ADR-0079` backlink (applied on ratification — the two-way link discipline) · design: [`component-gallery.lld.md`](../llds/component-gallery.lld.md) |
> | **Supersedes / Superseded by** | Extends ADR-0077 (composes `<component-preview mode="component">`; site-local-element precedent) · consumes ADR-0023 (the public `mount`/directive seam — its first out-of-renderer consumer) · relates ADR-0022 (#69 — the reorder constraint below) |

## Context

goals.md §G8 requires a filterable gallery that renders **every** control, themed through **one**
provider, surviving forced-colors — built *with* the foundation (a `filter` signal, a `repeat`-reconciled
grid, `watch` readouts). Two constraints collide: (1) the site already owns a full specimen renderer
(`<component-preview>`, ADR-0077) — rebuilding specimen rendering would fork it; (2) the foundation's
`html``` template entry is **private** (ADR-0023) — a site consumer gets only `mount` + `repeat`/`watch` +
the directive-authoring trio, and a child hole commits text/TemplateResult/array/**directive** only (a raw
Element stringifies, `template.ts:457`). The gallery must dogfood the kernel through exactly that public
seam, or the DoD's dogfooding clause is decorative.

## Decision

We will build `<component-gallery>` as a **site-local element (plain tag, no fleet obligation — the
ADR-0077 precedent) whose class extends the public `UIElement`**, composing one
`<component-preview mode="component">` per fleet member and rendering nothing per-control itself:

1. **Members are derived** from the `ALL_DESCRIPTORS` glob (every descriptor `tag` starting `ui-`),
   sorted alphabetically — never hand-listed; a standing gate pins list ≡ fleet.
2. **The reactive loop is the public seam, end to end:** `#filter`/theme signals → a `computed`
   order-preserving subsequence → `mount(watch(() => visible, ms => repeat(ms, m => m.tag, m =>
   node(card(m)))), grid, this)` — `watch`'s sanctioned nested-directive mapper re-commits `repeat`, the
   element itself serves as the `RenderContext` (scope-owned effects), and a ~15-line site-local `node()`
   directive (built on the public `Directive`/`directive`/`NO_COMMIT` trio) hosts the real card elements.
   Cards are cached per tag, so filtering preserves element identity and preview knob state.
3. **One theme provider — `<theme-provider>` (Kim's ratified reframe; "tone" is dropped from the
   vocabulary):** a single site-local wrapper element carrying **`scheme`** (`light`/`dark` — what the old
   DoD word "tone" meant; the provider maps it to its own `color-scheme`, which `light-dark()` tokens
   resolve per-subtree) + **`scale`** + **`density`**, plus the **reserved `theme` package attribute**
   (`theme="<name>"`, e.g. `mad-max`). G8 ships ONLY the default package: scheme/scale/density are the
   live gallery toggles; `theme` is architecturally present and wired (attribute + one-option selector),
   but the multi-theme PACKAGE-swapping system (alternate branded token packages keyed off
   `[theme='<name>']` CSS layers) is **explicitly deferred to the next tier**, tied to the pending
   scope-dial decision (decomp F2b). Nothing is themed per-card.
4. **Order is fixed; reorder is out of contract:** `ChildPart.moveBefore` (template.ts:442) does not
   relocate nested-directive deep content (`template.ts:435`), so filtering is enter/exit only. A future
   sort feature requires the `repeat` directive-content move seam first (the recorded #69/ADR-0022 tail)
   — a named trigger.
5. **Nav joins ungrouped** (the labeled-group TOC stays ≡ the fleet — the `site-toc` gate).

## Consequences

- The DoD's dogfooding is real: signals, computed, `UIElement` lifecycle, `mount`, `watch`, `repeat`, and
  the directive-authoring trio all get their first non-renderer external consumer — API pain surfaces here
  instead of in a real consumer later.
- Zero specimen-rendering duplication; a new control or attribute appears in the gallery for free
  (descriptor-derived, the ADR-0077 discipline).
- **Costs accepted:** cards are heavyweight (each embeds a full live-knobs preview — ~26 previews on one
  page; acceptable for a docs page, measured in the browser smoke); overlay-class specimens render in
  their honest closed state (the smoke opens them via their descriptor-declared `open` attribute to prove
  paint); the reserved `theme` seam ships as a one-option selector — a visible-but-inert affordance
  invites "why only one?" questions; accepted deliberately: the seam's presence is the point (Kim's
  directive), and the package system is NAMED deferred scope (F2b), not silent scope.
- The `node()` directive is site-local; if a second element-hosting consumer appears, promoting it into
  the dom barrel is a one-line ADR-0023 extension (named trigger, not scoped now).
- **Stale → re-verify:** `goals.md` §G8 DoD line 1 (its "tone" wording — retired for `scheme` + the
  reserved `theme` seam) · the site-gate expected sets (`site-toc`/`site-coverage`/`site-nav` — the
  gallery joins ungrouped, so they must NOT move; a moved set means a mis-wired nav).

## Acceptance

The LLD §8 predicates: `check`(+site)/`build` green; jsdom list/filter/identity/ctx-negative probes; the
cross-engine smoke (every member's specimen box > 0, overlays opened-then-painted, the one
`<theme-provider>`'s scale/density provably change rendered px and `scheme` flips used colors, the
`theme` select shows exactly one option with the attribute landing on the subtree, Chromium
forced-colors); site TOC/coverage/nav gates green unchanged; `component-reviewer` GO pre-commit.

## Alternatives considered

- **A `ui-gallery` fleet control** — rejected: docs meta-infra in the fleet incurs descriptor/coverage/
  budget obligations for zero product value (the exact ADR-0077 reasoning; a gallery is not a component
  consumers ship).
- **Rebuild bespoke specimen rendering inside the gallery** — rejected: forks ADR-0077's derive-don't-
  duplicate estate; every future control/attribute would need double maintenance.
- **A plain non-`UIElement` element with ad-hoc listeners (the a2ui-catalog page pattern)** — rejected:
  it renders a gallery but dogfoods nothing; the DoD names the kernel loop explicitly.
- **Item templates returning raw Elements straight from `repeat`** — rejected by mechanics: a child hole
  stringifies a raw Element; `html``` is private by design (ADR-0023). The `node()` directive is the
  sanctioned public-trio idiom.
- **A sortable grid now** — rejected: reorder of directive-owned card content is unsupported by
  `ChildPart.moveBefore` today (the #69 tail); shipping a sort knob would silently corrupt card placement.
- **Build the multi-theme package-swapping system in G8** — rejected: Kim explicitly deferred it to the
  next tier (the F2b scope-dial); G8 ships the wired seam + the default package only, so the next-tier
  system lands against a proven attribute contract instead of inventing one under pressure.
