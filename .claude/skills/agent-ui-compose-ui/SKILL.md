---
name: agent-ui-compose-ui
description: >-
  Compose ONE feature/fragment from shipped agent-ui controls — a form, a toolbar, a
  settings panel, an interactive widget cluster: pick controls via the catalog, wire typed
  attributes/props and allowlisted events, assemble forms on the field/form-provider spine,
  drive overlays by prop, and prove the behavior. Use for "build a signup form with
  agent-ui", "compose a filter bar", "wire these controls together", "add a confirm dialog
  to this flow". NOT for whole-screen structure/scroll/shell (agent-ui-compose-layout), an
  application's packages/routing/theming spine (agent-ui-compose-app), authoring an A2UI
  payload (a2ui-compose), or building a new control (agent-ui-component-create).
user-invocable: true
disable-model-invocation: false
---

# Compose UI — one feature from shipped controls

Assembles a working feature from the fleet **through each control's public surface only** —
attributes/props, slots, and events, exactly as the descriptors declare them. The worked
exemplar to read first: `site/pages/forms.ts` (one live form, narrated end-to-end).

## Procedure

1. **Pick the controls** — [[agent-ui-catalog]]: the choosing guide's by-job groups, then
   READ each chosen control's `{name}.md` descriptor (tag, attributes + enum values, events,
   slots) before writing a line. A job with no control is a gap report →
   [[agent-ui-component-design]], never a hand-rolled substitute on a shared surface.
2. **Structure the fragment** — slots and `data-role` roles per the descriptor; content in
   light DOM. Spacing between controls comes from layout primitives or the `[data-box]`
   model ([[agent-ui-composition-patterns]]) — not ad-hoc margins inside a boxed region.
3. **Wire state and props** — attributes for static configuration, properties for live
   values; closed sets take only the descriptor's enum values (anything else is rejected or
   ignored — check, don't guess). Overlay-bearing controls are driven **by prop**, never by
   platform handle.
4. **Forms ride the spine** — `ui-form-provider` around the fragment, each value-bearing
   control wrapped in `ui-field` (label/description/error wiring is the field's job;
   validation errors render reactively via the control's own validity — don't build a
   parallel error system). Exemplar + the seam law: the patterns map's form row.
5. **Listen on the allowlist** — the fleet emits only the event names `CLAUDE.md`'s
   Conventions allowlist declares (six today; CLAUDE.md is the home — don't trust a copy);
   wire feature logic to those. Needing a different event from a control is a
   fleet-contract question, not a local patch.
6. **No restyling internals** — the fragment's own chrome consumes
   `--md-sys-color-{family}-{role}`; anything visually wrong INSIDE a control routes down
   ADR-0102's three lanes (component defect / prop gap / held-it-wrong) before any CSS is
   written over it.
7. **Prove it** — `npm run check` type-clean; a behavior probe for the fragment's own logic
   (jsdom where DOM-truth suffices; the browser project when layout/scheme/scroll is the
   claim — [[agent-ui-component-testing]]'s blind-spot table says which); honest states
   (real interactions, not mocked visuals).

## Review (generator ≠ critic)

An interactive flow gets `ui:flow-reviewer`; a fragment whose claim is visual/structural
gets `ui:layout-reviewer`; a code-level change riding a repo contract gets
`teamwork:code-checker`. Name the artifact and hand off before shipping.

## Definition of done

- [ ] Every control consumed through its descriptor-declared surface; enum values exact.
- [ ] Forms on the provider/field spine; no parallel labelling/error plumbing.
- [ ] Overlays prop-driven; events ⊂ the allowlist; no `ui-*` internals restyled.
- [ ] Type-check + behavior probe green (browser leg where the claim needs an engine).
- [ ] Independent review passed.
