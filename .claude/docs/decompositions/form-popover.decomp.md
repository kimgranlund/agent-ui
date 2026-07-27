# Decomposition + test plan — `ui-form-popover` (GH #294 F4 build)

> Status: proposed · v0.1 · 2026-07-27 · Layer: build plan (refines `form-popover.lld.md` LLD-C1…C7)
> Dispatch rule: one writer per file per slice; every gate runs FOREGROUND; judge by exit codes.

## 1 · Build sequence (dispatchable slices)

| Slice | Seat | Files (sole writer) | Depends on | Accept (cites the testing bar) |
|---|---|---|---|---|
| S1 — element + CSS | component-builder | `controls/form-popover/form-popover.{ts,css}` + barrel/index wiring | — (LLD frozen) | LLD-C1…C4 satisfied; unit probes T1–T4 green; `npm run check` green |
| S2 — descriptor + probes | component-builder (same dispatch as S1 — one seat, sequential files) | `controls/form-popover/form-popover.{md,test.ts,browser.test.ts}` | S1 | LLD-C5; descriptor frontmatter validates; contract↔props trip-wire green; browser probes T5–T10 green; the a2ui fleet-coverage gate acknowledged (see coupling note) |
| S3 — catalog row | a2ui-builder | `a2ui/src/catalog/default/{factories.ts,catalog.json}` + conformance/admission tests (`index.ts` is load-only — NO edit) | S2 (see coupling note) | LLD-C6; catalog conformance + admission-coverage green; NO allowlist diff |
| S4 — site pages + specimen | docs-writer (pages) + example-builder (`site/lib/component-preview.ts`) — two seats, DISJOINT files, never concurrent on component-preview.ts | doc/demo pages · preview specimen + knobs | S1–S3 | LLD-C7; site standing gates green; specimen is the reference content (representative-specimen law); one knob per prop |
| S5 — integration gate | host/orchestrator | none (verification only) | S1–S4 | `npm run check && npm test` + `npm run test:browser` (six shards, sequential) green by exit codes |

**S2↔S3 coupling note (the ADR-0087 fleet-coverage gate):** the a2ui default-catalog test fails
whenever a SHIPPED descriptor lacks a catalog row + factory (`index.test.ts:234-239`). S2's
descriptor therefore must NOT reach main ahead of S3: **S2 + S3 land in ONE PR** (the ruled shape),
with S3 sequenced after S2 inside it; S2's own gates alone do not prove main stays green.

The recipe leg (first intake's acceptance) is a SEPARATE slice already commissioned by #294; its
page gains the S4 cross-link only.

## 2 · Test plan (the `agent-ui-component-testing` bar)

**Unit (jsdom, `form-popover.test.ts`):**
- T1 parts-once: two connects ⇒ one trigger, one panel, stable panel id; author children all in
  panel (SPEC-R1).
- T2 props/descriptor trip-wire: `attributes[]` ↔ `static props` mirror (tag/tier/extends enums
  valid per `validateComponentDescriptor`).
- T3 label effect: writing `label` updates `[data-part=label]` textContent + the reflected
  attribute (fleet label-reflects law).
- T4 layering trip-wire untouched (`controls → dom/traits` inward-only; no `a2ui` import).

**Browser (real engine, `form-popover.browser.test.ts`):**
- T5 overlay lifecycle: trigger click ⇒ `open` true, panel in top layer, `aria-expanded="true"`;
  Escape ⇒ closed + `close` then `toggle`, `open` already false in the `toggle` listener
  (ADR-0101 order, SPEC-R3).
- T5b a11y shape (SPEC-R6/R10): trigger `aria-controls` === panel id; trigger has NO
  `aria-haspopup`; host has NO explicit role; trigger accessible name === the `label` prop text;
  the open panel contains NO control-created close part (`[data-part]` set is exactly
  trigger/label/caret/panel).
- T6 programmatic close: `el.open = false` actually hides (the ADR-0101 erratum regression:
  prop-flip path must not no-op after a trigger-click open).
- T7 native Tab + typing: panel containing checkbox + radio + `ui-text-field` — typing "O" into
  the field stays in the field (no type-ahead steal), Tab walks natively (SPEC-R5, the
  anti-`ui-menu` proof).
- T8 focus contract: focus moves into the panel on open; restores to the trigger on close
  (flake-class candidate → `FOCUS_TIMING_FILES` append if it flakes, never a new shard).
- T9 live-apply bubbling: a child checkbox `change` reaches a host-ancestor listener unmodified;
  the host itself emitted nothing but `toggle`/`close` (SPEC-R4).
- T10 whole-shape gestalt: open panel's bounding box ≥ panel-min-inline-size floor; trigger box =
  Control-class height per `[size]` (the test-the-whole-shape law).

**Catalog (a2ui):**
- T11 conformance: `FormPopover` row renders; `open` two-way via `toggle`; `label` binding
  updates the trigger live (the agent-side summary-state mechanism, SPEC-R9).
- T12 admission coverage green with no `EXCLUSION_ALLOWLIST` diff.

**Built-output leg:** NOT required — no production-CSS-only behavior (no `?raw`/build-time CSS
dependency; `[data-box]` + `@scope` are the shipped runtime path already exercised by siblings).
Recorded as a considered-and-declined TKT-0002-class check, not an omission.

## 3 · Coverage check

Every SPEC requirement maps: R1→S1/T1 · R2→S1/T2,T3 · R3→S1/T5,T6 · R4→T9 · R5→T7 ·
R6→T5,T5b,T7 · R7→T2 (`face: formAssociated false`) + T9 · R8→S1(build)/S2(T10) ·
R9→S3/T11,T12 · R10→T5b (no close part) · R11→S4. No orphan slices; no uncovered requirement.
