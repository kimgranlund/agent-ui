# Inventory: Shell UI Systems (`packages/agent-ui/app`)

## 1 · SHIPPED

- **Archetype family** (ADR-0151, SPEC `shell-archetypes-m5.spec.md` v0.7 accepted): `ui-super-shell`
  — two-level recursive `[header? | side-L? | content | side-R? | footer?]` grammar, 18px module
  (`super-shell.ts`, 893 lines + browser/unit tests, 1018+379+140+252 lines), presets
  `ui-workspace-shell`/`ui-chat-shell` (thin `FORWARD_ATTRS` wrappers). `ui-app-shell` REMOVED
  (ADR-0156, gate closed 2026-07-26 per roadmap.md:141,192).
- **Collapse + resize + narrow arms**: 4-toggle per-side/per-level collapse (R2), user-resizable
  innermost pane w/ drag+keyboard (R6, `pane-resizer` separator), pane segments as real `ui-tabs`
  compositions (R7a, GH #221), 3rd narrow arm `collapse|stack|tabs` incl. `narrow-tabs` strip
  (R7b). Survival law (R7c): every band/tab/segment change is visibility-only, never
  reparents — proven on a live A2UI surface (AC11).
- **Responsive band ladder** (ADR-0155, SPEC-R8-R10): `wide·compact·narrow` cut at 40rem/52.5rem
  (`shell-breakpoint.ts`), `collapse-band` prop for outer-in cascade (GH #44), menu⇄X toggle law
  (R9), scrollbar seam — hidden scroller + `scrollFade` trait everywhere (R10).
- **Spacing/law codification** (v0.5, SPEC-R11-R13): two-system spacing ladder (frame=module,
  content=`--md-sys-space-*`, junction at 0.75rem), scope-proximity display-override law (R12,
  `@scope` beats unscoped on tie regardless of source order), AC19 spacing-drift gate (browser-free,
  `npm test`, zero raw-literal tolerance, 5 named outlier exceptions).
- **`ui-conversation` — heavily reworked this wave** (#291/#306/#308/#313, ADR-0160 `proposed`):
  agent-turn re-bubble (reversing GH #241 fleet-wide), `who`/`narration` moved OUTSIDE the bubble
  into a new `[data-part='turn']` wrapper, `AgentTurnHandle.finalize(actions?)` → pre-hydrated
  action-chip row (`TurnAction`, reuses ADR-0153's `action` event, one-shot commit), empty-bubble
  hiding (`data-empty`, #313) so a pre-content live turn paints nothing. `ui-status-stream` header
  loses its boxed background (token retired). 1032-line `conversation.ts` + 988/798-line tests.
- **`nav-rail`** (family unification ADR-0130 precedent, independent super-shell impl) — group/item
  subcomponents, 187+189+116 lines + tests. **`master-detail`** — separate, smaller (169 lines),
  not part of the super-shell recursion.
- **Router's role**: `@agent-ui/router` (ADR-0115, memory-first SPA router + `connectUrl` opt-in
  URL reflection) is a SIBLING branch off `components`, catalog-invisible, never imported by
  shells/`app` today — shells own no navigation/routing, by SPEC-R3 design ("never data, transport,
  or navigation"). `app` may import `code` but never `router` (CLAUDE.md layering law).

## 2 · IN-FLIGHT

- **ADR-0160 is `proposed`, unratified** — the chat redesign (header de-chrome, agent re-bubble,
  action-chip mechanism) is BUILT and merged as code but the decision record itself awaits Kim's
  ratification. Flag prominently: shipped-in-tree ≠ ratified-decision here.
- **AC19 sheet-set scope is an open per-sheet decision** (roadmap.md:135-137) — drift gate covers
  shell family + shell-composing site sheets only; components-package/remaining site sheets not
  yet swept, deliberately deferred, not automatic.
- **SPEC's own named forks still "proposed default, Kim may re-rule"**: F1 (paired vs progressive
  restore), R7d (ARIA role-swap avoidance at narrow tab strips) — both shipped to the default, not
  re-opened, but not closed as settled either.
- **R13's "one found violation"** (passive-crush window 640-846px) — SPEC states the repairing
  build's mechanism lives in ITS OWN record, not named here; worth confirming closed before
  building more on the ladder.
- Roadmap's own verdict (2026-07-26): "nothing else outstanding — next feature arc is Kim's call."
  No open GH issues currently title-match shell/conversation/nav-rail/router keywords (checked
  #307/#314/#315/#316/#321 — none are shell-shaped).

## 3 · CANDIDATE INCREMENTS (grounded, 6)

1. **Command-palette integration** — SPEC has no palette slot/pattern; SaaS shells universally need
   Cmd-K global search/nav. Nothing hand-rolled for this in agent-admin either — a real gap, not
   just an unbuilt increment.
2. **Breadcrumbs / context-switcher chrome** — header slot vocabulary (R1) has no breadcrumb
   concept; multi-level nesting (R1b, depth-2 normative) has no "where am I" affordance beyond the
   rail state itself.
3. **Density modes at shell level** — the fleet has a density-multiplied `--md-sys-space-*` ladder
   (R11a) but no shell-level density PROP; agent-admin/consumers would have to hand-wire it.
4. **Per-pane collapse** — explicitly YAGNI'd at R5d ("per-pane collapse is out of scope until a
   real frame needs it") — a candidate the SPEC itself names as deferred, not rejected.
5. **A `ui-chip`/`ui-tag` control** — ADR-0160 explicitly rejected minting one, reusing
   `ui-button[variant=soft][size=sm]` instead; if action-chip density grows (multi-select chips,
   filter chips) this precedent may need revisiting — a provider-side gap in `components`, not
   `app`.
6. **Real code reuse vs. independent implementation** — SPEC's own §"corrected 2026-07-20" note:
   `ui-super-shell` mirrors ADR-0082/0083/0084's frame-contract PATTERNS but does not import their
   code; the review-plan LLD's §7 fork ("should real reuse replace this independence") is explicitly
   undecided.
7. **Tab-strip content ROUTING (not just visibility)** — R7c's survival law is deliberately
   visibility-only; a SaaS multi-pane workspace with independently-routable tab content (deep-link
   per tab) would need `router` wired into a shell for the first time — currently structurally
   absent (edge, below).
8. **Scoped/multi-instance settings surfaces** — `settings` (schema/store/generate, own family) is
   NOT shell-integrated as a slot type; every consumer re-composes it into a pane by hand
   (agent-admin's Settings tab is bespoke).

## 4 · EDGES — as CONSUMER (needs from components/router)

- `scrollFade` trait export from `@agent-ui/components` root barrel (R10b) — a named public-API
  widening this wave already required.
- `ui-tabs` control (GH #221) — shells now COMPOSE it directly for pane-tabs/narrow-tabs strips;
  any future `ui-tabs` contract change is a shell-breaking edge.
- `ui-button` as the action-chip idiom (ADR-0160) — a `components`-owned control now load-bearing
  inside `app`'s `ui-conversation`.
- `@agent-ui/router` — zero current dependency; SPEC-R3 draws the line explicitly ("never
  navigation"). Any tab-strip deep-linking candidate (§3.7) would be the FIRST time a shell needed
  router — a deliberate layering question, not a bug.

## 5 · EDGES — as PROVIDER (what agent-admin + SaaS need shells to host)

- agent-admin hand-rolls its own Settings/Context tab content atop the shell's pane-segment
  mechanism (segments are shell-composed, but the CONTENT inside each is 100% agent-admin's own —
  settings schema rendering, context-JSON dump) — the shell hosts the STRUCTURE, agent-admin owns
  every pixel inside it; no shared "settings surface" or "data workspace" slot type exists yet.
  needs (§3.8) if that pattern generalizes.
- Dashboards/data workspaces: nothing in `app` targets a grid/card dashboard shape — `content`/
  `canvas` is a single opaque slot; a SaaS dashboard consumer gets zero shell help beyond
  rail+pane chrome.
- Multi-surface survival (R7c) is the standout PROVIDER strength: any consumer hosting a live,
  stateful embedded surface (A2UI game-loop, editor) gets visibility-only band/tab crossings for
  free — a real differentiator vs. hand-rolled tab systems that remount on switch.
