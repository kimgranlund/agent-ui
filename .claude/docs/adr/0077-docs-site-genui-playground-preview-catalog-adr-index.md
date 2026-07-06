# ADR-0077 — the docs-site Generative-UI playground: `<component-preview>` + A2UI Catalog + ADR index

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | host-orchestrated docs-site wave (component-preview + catalog: `preview-catalog` seat · ADR index: `adr-index` seat · `Button.variant` catalog fix: host, root-caused by two independent reviewers) |
> | **Ratified by** | Kim (2026-07-04) |
> | **Repairs** | `site/` (new `lib/component-preview.*`, `lib/canvas-surface.*`, `a2ui-catalog.*`, `adr-index.*`, `pages/adr-index.*`, `lib/adr.ts`; `frontmatter.ts` `loadDescriptorByTag`) · `catalog.json` `Button.variant` · new gates `component-preview.browser.test.ts` · `site-preview-catalog.test.ts` · `site-adr-index.test.ts` · decomposition [`site-preview-catalog-adr.decomp.md`](../decompositions/site-preview-catalog-adr.decomp.md) |
> | **Supersedes / Superseded by** | Realizes [ADR-0076](./0076-renderer-honors-catalog-declared-enums.md) for `Button.variant`. Reuses the canvas surface of [ADR-0069](./0069-a2ui-live-agent-demo-shape.md) and the example-seed shape of ADR-0055. Consumes the default catalog (ADR-0016) through the renderer's public host (ADR-0023 `mount`). Extended by [ADR-0079](./0079-component-gallery-kernel-dogfood-architecture.md) (the G8 `<component-gallery>` composes `<component-preview mode="component">`). No prior decision reversed. |

## Context

Three docs-site deliverables were requested (Kim, "plan and orchestrate"): (1) a **Component Preview** — a two-column playground that renders EITHER a plain `ui-*` web component OR an A2UI catalog item, with a live-editable left panel; (2) an **A2UI Catalog** page listing every catalog component through that preview; (3) an **ADR index** page, newest-first, with full-text search. Two forks were ratified up front (`/intent-extract`): the preview's left panel is a **full live-knobs playground** (every attribute → an editable control), and the ADR page is a **searchable list that expands to the full record**.

The site already had the pieces to derive from — the canonical `{name}.md` descriptors (parsed by `frontmatter.ts`), the default `catalog.json`, the renderer's public host (`createRenderer`), and the A2UI-canvas artboard — so the wave's discipline was to DERIVE, not hand-author, and to keep the meta-tooling out of the shipped control fleet.

## Decision

**1. `<component-preview>` is a site-local PLAIN custom element** (light DOM), NOT a `ui-*` control. It is docs infra that COMPOSES controls; keeping it out of the fleet means no descriptor / coverage / canon / bundle-budget obligation. Two modes: `component` (a `ui-*` tag → its `{name}.md` descriptor → a directly-created element) and `a2ui` (a catalog NAME → its `catalog.json` def → the real renderer). Left-panel metadata is **DERIVED** from those canonical sources, never hand-authored — a new attribute/prop/enum member yields a new knob/chip for free.

**2. One knob-derivation rule, both modes:** enum → `<select>` + a variant chip-row · boolean → checkbox · number → number input · string → text input · object/complex → read-only skip · default-slot text → a text knob (component mode).

**3. The rendered specimen is AUTHORITATIVE for its own live state; `#state` is only the seed.** The canvas stays interactive, and direct interaction SURVIVES knob edits via **read-back-before-rebuild**: a2ui reads the live root's mapped `value` (typed text, toggled control, dismissed modal `open`) back into `#state` before the dispose+rebuild, skipping the just-edited knob (the user's explicit edit wins); component mode DIFF-applies only the changed prop and read-back listeners (`change`/`input`/`toggle`/`select`) reflect direct interaction into the matching knob. Documented residual: an a2ui rebuild resets caret/focus (the VALUE survives), and a container root's non-knob sample children reset on its own edit.

**4. A shared `canvas-surface` module** (`site/lib/canvas-surface.*`) holds the translate-centered, definite-width artboard, DERIVED (copied) from the a2ui-live canvas's proven CSS. `a2ui-live` was LEFT UNTOUCHED this wave so the freshly-shipped live-agent gates stayed green; a follow-up wave consolidated `a2ui-live` onto the shared module (its own `.canvas-stage`/`.canvas-surface` CSS removed, construction routed through `createCanvasSurface()`/`applyRootStretch()`), preserving the module's public API unchanged.

**5. Container/nested policy:** hand-authored `SAMPLE_TREES` sample children + a generic single-`Text` fallback give container roots legible content; knobs edit the ROOT only; nested-only helper types (Option/Tab/TabPanel/Card regions) are skipped in the gallery. `site-preview-catalog.test.ts` pins every `A2UI_INITIAL`/`SAMPLE_TREES` key ⊆ the catalog's component names, so a catalog rename/drop fails the build.

**6. The A2UI Catalog page** enumerates `Object.keys(defaultCatalog.components)` — one `<component-preview mode="a2ui">` per type — so it cannot fall behind the catalog.

**7. The ADR index page** globs `.claude/docs/adr/*.md` at build with **`exhaustive: true`** (Vite 8's `import.meta.glob` / tinyglobby skips hidden dirs like `.claude` without it — a silently-empty list would be a defect, so a zero-record load THROWS). It excludes `README.md` and the reserved `0000-template`. Its `statusShort` is a 4-member `StatusKey` union derived by preferring an **ALL-CAPS** `SUPERSEDED`/`DEPRECATED` override (case-sensitive) over the leading Status word — because lowercase clause-level "superseded by …" mentions occur in genuinely-`accepted` records (0007, 0033); ALL-CAPS marks a whole-ADR status (only 0037 uses it). Newest-first by number; live full-text search with an empty-state + `role="status"` aria-live node.

**8. `catalog.json` `Button.variant` is tightened to `enum:["solid","soft","ghost"]`** — bringing the catalog into agreement with the control's OWN declared enum (`button.md` / `button.ts`). This realizes [ADR-0076](./0076-renderer-honors-catalog-declared-enums.md) for `Button` (the renderer now skips a non-member variant), gives a2ui-mode Button a chip switcher at parity with component mode, and closes an agent-emittable invalid-value gap.

## Consequences

- The site gains a live playground + gallery + browsable decision log, all DERIVED from canonical sources (descriptors, catalog, ADR files) — they cannot drift from the fleet.
- `component-preview` incurs NO fleet obligation; the two new pages are site-LEVEL (nav wired as **ungrouped** links, since `site-toc.test.ts` requires the labeled-group TOC to equal the component fleet exactly).
- The `Button.variant` tightening makes ADR-0076 bite for Button; any future catalog enum narrowing gets DOM-faithful rendering for free. Verified safe — every example uses `solid`/`soft`; the corpus is unaffected.
- Two independent reviews (generator ≠ critic) ran before ship and caught real defects a green build hid: a **live** mis-badged status (0037 shown "proposed" though superseded) and a **canvas↔knob desync** (direct interaction silently reverted). Both were fixed with regression tests encoding the exact failure scenarios.

## Acceptance

- `npm run check` (tsc + check:site) green · jsdom **2407** · browser **582** (Chromium + WebKit; component-preview **14**, incl. the canvas→knob direction that hid the desync) · `build` green (a2ui-catalog 11.8 kB js / 4.5 kB css).
- `site/lib/adr.test.ts` (the ADR parser + the status lint gate): every parsed `statusShort ∈ StatusKey`, with 0037→superseded and 0007/0033→accepted (now a LITERAL cell read, not the old ALL-CAPS heuristic — de-hack T2). `site/lib/component-preview-catalog.test.ts`: the hand-authored-map ⊆ catalog gate, with biting negative controls. (Both moved from the packages tree into the new `site` vitest project — de-hack T1.)

## Alternatives considered

- **`component-preview` as a `ui-*` control.** Rejected: a meta docs-tool is not a fleet member; it would incur descriptor/coverage/canon/budget cost for no product value.
- **Knob-panel-authoritative + suppress canvas interaction.** Rejected: a component preview must be interactive; read-back preserves BOTH the live canvas and coherent knobs, instead of inviting interaction then punishing it.
- **a2ui incremental single-prop update instead of read-back + rebuild.** Rejected: the renderer tree is mount-once and only reactively updates data-model-bound props; a static knob prop (size/variant) genuinely needs a rebuild, so read-back-then-rebuild is the correct minimal fix.
- **`Button.variant` enforcement at the validator (reject + self-correct).** Deferred, per ADR-0076's own recorded alternative (broader blast radius); the catalog enum + render-skip is the lower-risk realization.
- **ADR index: full-content-inline / metadata-only.** Rejected per Kim's ratified searchable-expand fork.

## Follow-ups

- ✅ RESOLVED (de-hack / standardization wave — [`de-hack-standardization.decomp.md`](../decompositions/de-hack-standardization.decomp.md)): ADR status is now a machine-readable canonical keyword + a biting lint gate (T2 — the ALL-CAPS heuristic is gone); the shared `canvas-surface` is the single source, a2ui-live consumes it (T3); the repo is off the deprecated `@vitest/browser/context` (T4); and `site/` has its own vitest project so its tests no longer smuggle into the packages tree (T1).
- Open (optional): refine or formally accept the a2ui preview residual (caret/focus reset on rebuild; container non-knob children reset on a root edit).
- Open (optional): a rendered-page browser smoke for the ADR index (unit-floor only today; a smoke would have caught the 0037 mis-badge directly).

## Amendment 1 — 2026-07-05 (accepted — Kim, 2026-07-05) — component mode gains the SLOT_TEXT partition + sample children + demo seeds

**Context (what G8 found).** Component mode's original knob model grew a SLOT_TEXT knob for EVERY target and
applied it as a blind `el.textContent = raw` write — correct for a control whose default slot genuinely is
text (button/checkbox), but a `.textContent` write clears **every** child, and several controls build/own real
structural children in `connected()` (a self-created editor, listbox, dialog, panel, grid, tablist,
rail/thumbs, or label chrome) that the write **silently destroyed**. Three overlay controls additionally
could not even CONSTRUCT bare — `ui-tooltip`/`ui-menu`/`ui-popover` require an anchor/trigger child before
`open` is ever touched. Component mode had **no gating of any kind** for either failure; a2ui mode already
had its counterpart model (`SAMPLE_TREES` + `A2UI_INITIAL`, Decision cl. 5).

**Decision (as built, G8 gallery wave).** Component mode gains the exact counterpart of the a2ui-mode model —
three explicit, hand-maintained, gate-pinned per-tag sets in `site/lib/component-preview.ts`:

1. **The SLOT_TEXT partition** — `NO_SLOT_TEXT` (12: calendar · combo-box · field · icon · menu · modal ·
   popover · select · slider-multi · tabs · text-field · tooltip — `connected()` builds/owns structural
   children the write would destroy; ui-icon's `name`-driven `<svg>` counts) and `SLOT_TEXT_OK` (13: button ·
   card · checkbox · column · form-provider · grid · list · radio · radio-group · row · slider · switch ·
   text — a genuine text slot, or a childless leaf with nothing to lose). A `NO_SLOT_TEXT` target grows **no**
   SLOT_TEXT knob at all (no dead knob). The two sets must **partition the live fleet exactly** — pinned by
   `site/lib/component-preview-slot-text.test.ts` (`partitionDiff` ⇒ `{missing: [], overlap: []}`, with
   bite-tested negative controls), so a new control landing in neither — or both — fails the build loudly.
2. **`COMPONENT_SAMPLE_CHILDREN`** (tooltip/menu/popover → one sample trigger `<button>`) — the anchor a bare
   construction needs; the specimen stays knob-editable, children are never appended by knobs.
3. **`COMPONENT_INITIAL`** (ui-icon → `{name: 'check'}`) — a per-tag demo seed for a control whose own
   descriptor default is CORRECT but not demonstrable (`icon.md`'s `name: ''` legitimately renders nothing);
   the same never-touch-the-canonical-source discipline as `A2UI_INITIAL`.

**The maintenance rule (normative).** Every NEW control's SLOT_TEXT classification MUST land in exactly one of
`NO_SLOT_TEXT` / `SLOT_TEXT_OK` — the partition gate enforces this at build time; there is no default. If the
control needs a construction-time child or a demo seed, `COMPONENT_SAMPLE_CHILDREN` / `COMPONENT_INITIAL` take
the entry (the a2ui-mode orphan check pattern, Acceptance above, applies to those maps too).

**Consequences.** Component mode can now safely preview the WHOLE fleet (the G8 gallery's per-member
whole-shape law depends on it); the cost is three more hand-maintained maps — accepted because each is
gate-pinned (drift fails the build, the cl. 5 discipline) and the descriptor model carries no structural-slot
distinction today (typing `slots[]` is real ADR-0004 schema surgery — deferred, per Kim's mechanism ruling
recorded at `component-preview.ts` §SLOT_TEXT).

**Alternatives considered.** A runtime children-count heuristic ("skip SLOT_TEXT if the element has children
at apply time") — REJECTED: `ui-text` legitimately builds a heading stamp when `as ≠ 'none'` and self-heals
after a `textContent` clobber, so live children-count misclassifies a genuinely safe control. Descriptor-level
slot typing — DEFERRED (ADR-0004 surgery; the named trigger is the next descriptor-schema wave).
