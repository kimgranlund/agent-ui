---
name: app-composition
description: >-
  Compose an APPLICATION on agent-ui — the system spine screens plug into: the package DAG
  and imports, the ui-super-shell regions, memory-first routing (createRouter/connectUrl +
  the outlet/link element subpaths), app-wide theming with ui-theme-provider, and the
  optional A2UI arm. Use for "scaffold an app with agent-ui", "wire the router into this
  app", "add an app shell", "theme the whole app / a workspace", "hook a live agent surface
  into this app". NOT for one screen's structure (layout-composition), one feature's
  controls (ui-composition), or authoring the A2UI payloads themselves (a2ui-payload-authoring —
  this skill only wires the seam).
user-invocable: true
disable-model-invocation: false
---

# Compose app — the system spine

Assembles the application layer the screens plug into. The realized exemplar IS the docs
site: `site/main.ts` + `site/pages/_page.ts` are an app shell + page system composed
entirely from the fleet — read them before scaffolding a new host.

## Procedure

1. **Respect the package DAG** (`CLAUDE.md` Layout §Conventions is the OWNING map — read it
   there, never from a copy here): `shared` ← `components` ← `a2ui` ← `app`, with `router`
   AND `code` as sibling branches off `components` (ADR-0119) — neither imports `a2ui`;
   `a2ui` imports neither; `app` may import `code` (the editor surface, ADR-0139) but never
   `router` (catalog-invisible by construction, ADR-0115); `icons`/`a2a` are leaves. An app
   composes DOWN this graph; needing an upward edge means the design is wrong.
2. **Foundation imports** — `@agent-ui/components/foundation-styles.css` (tokens.css THEN
   dimensions.css, order load-bearing — ADR-0003; the exemplar is `site/pages/_page.ts`'s
   own first import). NEVER bare `tokens.css` alone: it carries only the color system, so
   every control's `--ui-{height,font,gap}-*` geometry ramp stays unresolved (GH #749 — an
   app built that way renders visibly broken while checklists pass). Then the controls the
   app uses (barrel, or subpaths where tree-shaking matters — single-control subpath
   consumers under vitest need the `resolve.alias` precedent,
   [[component-packaging]]).
3. **Shell** — `ui-super-shell` (`@agent-ui/app`, ADR-0151/0154/0155): ONE element, no
   region sub-element. Mark light-DOM children with `data-slot="header|global-nav|nav-pane|
   section-nav|content|options-section|options-pane|global-options|footer"` (SPEC-R1/R5);
   `content` is mandatory. Per-side behavior rides `collapsed-start|-end`,
   `narrow-start|-end` (`collapse|stack|tabs`), `collapse-band`. Prefer a PRESET when the
   archetype fits — `ui-workspace-shell`, `ui-chat-shell`, or `ui-master-detail` (M4's
   list-pane ⇄ detail archetype; GH #749 added it here) — all behavior-only, zero
   data/transport ownership, the SAME `data-slot` vocabulary; the app package's export map
   is the authoritative surface list. Demo pages: `site/pages/super-shell.ts`,
   `site/pages/chat-shell.ts`, `site/pages/master-detail.ts`.
4. **Routing — memory-first, URL opt-in** (ADR-0115): route state is one signal;
   `createRouter` + plain navigate/back/forward from the HEADLESS barrel
   (`@agent-ui/router`); `connectUrl` only when the host wants URL reflection (hash default,
   history opt-in). The elements live on their OWN subpaths — `./router-outlet`,
   `./router-link` — deliberately not re-exported from the barrel (the tree-shake contract;
   a headless consumer never pays for DOM elements). v1 grammar: static · `:param` ·
   trailing `*`, declaration-order first-match.
5. **Theming** — app-wide defaults ride `:root`/ambient; a workspace/panel that differs gets
   a `ui-theme-provider` boundary (unset props inherit ambient; the ink re-root caveat —
   [[composition-patterns]]). `[scale]`/`[density]` set at shell/region roots.
6. **App state** — the props-as-signals surface each control exposes is the reactive
   contract; app-own state follows the same signals model — the kernel
   (`signal`/`computed`/`effect`) is public API off the components barrel (`plan.md` §5
   props on the §4 kernel). Don't bolt a second reactivity system onto the fleet.
7. **The A2UI arm (optional)** — an agent-driven surface = the `@agent-ui/a2ui` renderer +
   default catalog; payload authoring routes to [[a2ui-payload-authoring]]; live transports stay
   dev-only behind server-side-key proxies (the ADR-0073 trust boundary — production keys
   stay server-side). The seam is one mount point; the app never re-implements renderer
   concerns.
8. **Prove the spine** — `npm run check` + the app's own probes; tree-shake/size posture per
   the packaging map when the app ships as a bundle; screens and features then compose in
   via [[layout-composition]] / [[ui-composition]].

## Review (generator ≠ critic)

The shell/screen structure → `screens:layout-checker`; cross-screen journeys →
`screens:flow-checker`; contract-touching code → the house code review. Name the artifact,
hand off.

## Definition of done

- [ ] Imports point down the DAG only; layering tests green.
- [ ] Shell regions per the app package's contract; no global singletons.
- [ ] Router headless-first; elements via subpaths; URL reflection only where opted in.
- [ ] Theme/scale/density boundaries explicit; foundation-styles.css (tokens THEN dimensions, ADR-0003) loaded once at the root.
- [ ] A2UI seam (if any) mounted through the public renderer surface; keys server-side.
- [ ] Gates green; independent review passed.
