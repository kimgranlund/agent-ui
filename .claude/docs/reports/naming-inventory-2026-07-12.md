# The naming inventory — observed practice, sized (TKT-0025 step 1, 2026-07-12)

> Read-only survey over packages/** + site/**; the evidence base `references/naming.md` is
> authored against. No rules proposed here. Summary of the nine namespaces; the top-10
> exceptions ranked by how much each complicates one canonical grammar.

## Namespace summaries

1. **Tags** — 69 `ui-*` (components 61 · app 5 · router 2 · code 1) + 2 site elements outside the
   namespace (`component-gallery`, `component-preview`). The hyphen is OVERLOADED: 11 compound
   single-component names (ui-combo-box, ui-text-field, …) are undecidable from family-member
   names (ui-card-header, ui-split-pane, …). Two 4-hyphen tags (ui-app-shell-region,
   ui-master-detail-pane). tag↔class↔folder alignment gate-enforced (family-coherence :295).
2. **Classes** — `UI{Name}Element` 100% across 69 shipped elements + the 6-base ladder; the 2
   site classes deviate (ComponentGallery; ComponentPreview extends raw HTMLElement).
3. **Props/attrs** — booleans 100% bare adjective (zero is-/has-); 7 camel→kebab attribute
   overrides, all consistent; `size` ≡ [sm,md,lg] gate-locked across 20 controls; ONE real vocab
   split: `orientation` (7 controls) vs `axis` (1 — ui-split; split-pane consumes it; the review
   corrected an initial "2/ui-text" misread — text.ts uses "axis" only in comment prose) for the same horizontal|vertical concept;
   `variant` deliberately per-control; smells: prop `truncate` (verb) vs state `truncated`,
   `emphasis` (noun) as a boolean. Reserved-by-convention but ungated: value(91) · label(47) ·
   name(20) · open(12).
4. **Events** — the closed set holds at every emit site (change 21 · input 12 · select 17 ·
   toggle 7 · close 4; `click` for pure activation): ZERO out-of-vocabulary producers repo-wide.
   `open` is declared but has zero producers. The allowlist gates descriptors only — NOT the
   emit() seam (the named gate gap).
5. **CSS custom properties** — control tier `--ui-{control}-{role}` (543) + ~40 FOUNDATION
   constants ALSO under `--ui-` (font/space/scale/motion/focus-ring…), separated only by a
   hand-kept allowlist; system tier `--md-sys-{color,typescale}` (2571 + 257 refs), the typescale
   carrying 4 non-Material voices (kicker/lead/overline/quote); `--_x` privates + the JS-seam
   inline props (`--value-pct`) both convention-clean; `--c-*` fully retired.
6. **parts/roles/states** — data-part: 80+ kebab nouns, cross-control reuse same-meaning
   (panel/trigger/marker); smell: `data-part="aria-label"` ×3. data-role: the LIVE vocabulary
   (21 values incl. numeric/currency/stepper/before-sentinel) has drifted far past anatomy.md's
   declared set (icon·caret·tag·badge) — documented-vs-actual gap, ungated. Custom states: 100%
   adjectival (ready 24 · user-invalid 17 · checked · dragging · collapsed · truncated …), zero
   collisions.
7. **Catalog types** — PascalCase(tag) mechanically, ~55 types; two non-tag-backed exceptions by
   design (Option, MenuItem); UAX-31 + the reserved `@` namespace gate-enforced (naming.test.ts).
8. **Packages/subpaths** — `@agent-ui/{pkg}` uniform; the subpath grammar splits THREE ways:
   `./controls/{name}` (components) vs bare `./{name}` (app, router) vs pack/concept names
   (code/icons/a2ui).
9. **Files/folders/traits** — the per-control file set conforms highly; sub-element FOLDER
   placement has no rule (card-*/tab-*/swiper-*/split-pane NEST; timeline-item/segment/
   segmented-control/slider-multi get own folders — segmented-control extends radio-group yet
   radio-group nests in radio/). Traits mix four name grammars.

## Top-10 exceptions (ranked by grammar cost)

1. The tag hyphen's two meanings (compound name vs family member) — blocks tag parsing.
2. `--ui-` carrying both foundation constants and control roles (allowlist-separated only).
3. The three-way subpath grammar split.
4. orientation vs axis (7:1 for one concept).
5. Sub-element folder placement unruled.
6. The two token dialects `--ui-*` vs `--md-sys-*` (the ticket's named Kim fork).
7. data-role's actual vocabulary vs anatomy.md's declared set.
8. The two site elements/classes outside the namespace.
9. `--md-sys-typescale` extending Material under a Material-implying name.
10. Event vocab: `open` declared/zero producers; descriptor-gated but not emit-gated; the
    truncate/truncated + emphasis + `data-part="aria-label"` word-form smells.

Cross-namespace: what IS gated (tag↔class↔folder, the size enum, descriptor events, catalog
UAX-31) has held perfectly; the drift concentrates precisely where no gate runs (data-role, the
--ui- tier split, the emit seam, folder placement).
