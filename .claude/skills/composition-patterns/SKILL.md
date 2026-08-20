---
name: composition-patterns
description: >-
  CONSUMER-side assembly patterns for agent-ui surfaces: form rhythm, container box-model,
  overlays, scroll ownership, theming, scale/density, pane visibility, composer routing, retract-
  don't-delete, mint-vs-compose, chat, empty states, CSS-less-consumer law. Use when assembling a
  page/feature: "how do I wire a form", "why is my container double-padded", "how do I open this
  menu programmatically", "why doesn't my page scroll", "how do I theme one section dark", "which
  panes show at this width", "two composers route to the wrong store", "what goes in an empty
  list/grid/no-results state". NOT producer-side mechanisms in controls (component-patterns) or
  which control to pick (component-catalog).
user-invocable: false
disable-model-invocation: false
---

# Composition patterns — the consumer assembly map

How a page correctly *consumes* the fleet. Each pattern: the assembly problem → the fleet's
answer → the owner (rationale) and the worked exemplar (live code). The mechanism stays in
the owner; deviating from a pattern on a shared surface is a fork, not a local choice. The
full pattern table (34 rows) moved to `references/` below, grouped into four axes — nothing
was deleted, every ADR citation and dated ruling reads word-for-word in its new home.

## Consult table

| File | Read when |
|---|---|
| [`references/forms-and-identity.md`](references/forms-and-identity.md) | Wiring any labelled/validated form, or one of the six ADR-0176 auth/onboarding/account surfaces (credentials, magic link, OTP, social sign-in, onboarding, account-settings) |
| [`references/surface-primitives.md`](references/surface-primitives.md) | A single page/panel needs container box-model spacing, a label↔value chip row, overlay open/close, page-CSS discipline, scroll ownership, theming a subtree, scale/density, scheme-divergence — or a composed surface LOOKS broken (the CSS-less-consumer law, ADR-0102) |
| [`references/shell-and-data-surfaces.md`](references/shell-and-data-surfaces.md) | Cross-view navigation, an application-shell region, a schema-driven settings page, a resource-list manager, a data-table toolbar, a record open/validate/save loop, a card-grid view with an edge-docked drawer edit flow, or a zero-data/no-results/first-run empty state |
| [`references/multi-surface-composition.md`](references/multi-surface-composition.md) | Two or more composed surfaces interact — multi-composer routing, multi-pane shown-set visibility, band-driven docking, retracting a painted affordance, the mint-vs-compose test, or declarative chat composition |

## Cross-links

Which control → [[component-catalog]] · the compose procedures → [[ui-composition]] /
[[layout-composition]] / [[app-composition]] · producer-side internals →
[[component-patterns]] · the sizing/states/token LAW →
[[component-standards]].
