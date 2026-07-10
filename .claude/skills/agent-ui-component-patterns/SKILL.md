---
name: agent-ui-component-patterns
description: >-
  Route to the fleet's PRIOR-ART map: the settled mechanisms a new or novel ui-* component
  should reuse instead of reinventing — overlay/dismissal, container box-model, value codecs,
  provider/context, field labelling, focus-preserving reorder, swappable packs, z-scoping,
  catalog exclusion. Use when designing anything and asking "has the fleet solved this
  before" — a floating panel, a formatted value, cross-component context, a lazy-loaded
  heavy subtree. One routing sentence + the owning ADR per pattern; the mechanism lives in
  the ADR and its realized source (cite, never copy). NOT for the normative law layer
  (agent-ui-component-standards) or the build procedure (agent-ui-component-create).
user-invocable: false
disable-model-invocation: false
---

# Component patterns — the prior-art map

Before designing a mechanism, sweep this table. Each row: the problem shape → the fleet's
mechanism → the owning ADR (rationale; status noted where not yet ratified) and its realized
home (the working code). Reusing a row is the default; deviating from one is an ADR-worthy
fork, not a local choice.

| Problem shape | The fleet's mechanism | ADR · realized home |
|---|---|---|
| Reusable behaviour shared across controls | a **trait**: a free `(host, opts) => release` function called from `connected()` — no registry, no decorators, no `host.use()` | foundational (plan §5 + the `traits/index.ts` header; earliest trait decision ADR-0010) · `packages/agent-ui/components/src/traits/` |
| Shared value-control base plumbing across a control family | the **`controls/_base/`** widget value-control bases (a sub-layer, deliberately NOT traits — the ADR argues why) | ADR-0042 · `packages/agent-ui/components/src/controls/_base/` |
| A floating panel anchored to a trigger (menu, select, tooltip, combo-box) | the **Overlay controller** + platform-owned dismissal (Escape/outside-click are the platform's; anchor focus-restore; `:popover-open`-resilient close) | ADR-0043 + ADR-0045 · `traits/overlay*`, patterned in `controls/select/`, `controls/menu/` |
| Consistent padding/gaps/sticky regions inside any container surface | the shared **`[data-box]` container box-model** (one spacing layer, nested content levels, adjacent-sibling content gap) | ADR-0046 · `controls/_surface/container-box.css` |
| A container stacking its own children sanely under overlays | **a container is its own z-depth scope** (`isolation: isolate` on `[data-box]`) | ADR-0052 · `controls/_surface/container-box.css` |
| A typed value with a formatted editing surface (currency, unit, percent, date, time) | a **value codec** per `type` (parse/format/step/validity, per-type `AbortSignal`) | ADR-0047 (numeric family) + ADR-0048 (date/time) · `traits/value-codec.ts` + `controls/text-field/` |
| A heavy sub-component only some usages need | **lazy `import()` at the interaction point** so tree-shaking holds (calendar into the text-field overlay) | ADR-0048 · `controls/text-field/` |
| One component needs to know about many descendants (form ⇄ fields) | **connect-time registration event + reactive registry** — the provider/context primitive; guard work on the CONNECTION signal (the bulk-insert cascade lesson) | ADR-0050 · `traits/form-registry.ts` + `controls/form-provider/` |
| A wrapper labels/describes a control it doesn't own | the **field-labelling seam** (`setFieldLabelling`/`applyFieldLabelling`, `formUserInvalid`, reactive error rendering) | ADR-0051 · `controls/field/` + `dom/` |
| Reordering children without losing focus | **`ChildPart.moveBefore`** over native `Node.prototype.moveBefore` — only the native call preserves focus; the seam upgrade is gated | ADR-0022 · `dom/` (repeat) |
| Imperative composition into a template-rendered tree | the public **`mount()` directive-host seam** | ADR-0023 · `dom/` |
| A swappable asset/provider family (icon packs) | **pure core + subpath adapters** in a zero-dep leaf package (default pack vendored at build time as inert TS) | ADR-0065 + ADR-0066 · `packages/agent-ui/icons/` |
| A component that must NEVER be agent-emittable (page/app-owner chrome) | the a2ui **`EXCLUSION_ALLOWLIST`** — a permanent, tested catalog exclusion | ADR-0112 cl.6 (Toast/ToastRegion reasoning), applied by ADR-0117 (**proposed** — awaiting ratification) · `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` |
| Ambient theming context (scheme/scale/density) over a subtree | **`ui-theme-provider`** — reflected props re-rooting `color-scheme`; unset means inherit-ambient, never a forced default | ADR-0117 (**proposed** — awaiting ratification; the control is shipped) · `controls/theme-provider/` |

## How to use a row

1. Read the ADR (the rationale + the forks it settled) — `.claude/docs/adr/README.md` is the
   index with per-ADR consequence trails.
2. Read the realized home end-to-end — the code is the resolved shape, the ADR is why.
3. If your case doesn't fit the row's stated scope, that's a **fork**: name it in the intake
   ([[agent-ui-component-design]]), don't quietly stretch the mechanism.

## Cross-links

The law layer (anatomy/geometry/states/tokens) → [[agent-ui-component-standards]] · packaging
→ [[agent-ui-component-packaging]] · the test bar → [[agent-ui-component-testing]] · the
intake procedure that runs this sweep → [[agent-ui-component-design]].
