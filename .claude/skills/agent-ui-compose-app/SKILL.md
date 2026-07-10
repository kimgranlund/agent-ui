---
name: agent-ui-compose-app
description: >-
  Compose an APPLICATION on agent-ui — the system spine screens plug into: the package DAG
  and imports, the ui-app-shell regions, memory-first routing (createRouter/connectUrl +
  the outlet/link element subpaths), app-wide theming with ui-theme-provider, and the
  optional A2UI arm. Use for "scaffold an app with agent-ui", "wire the router into this
  app", "add an app shell", "theme the whole app / a workspace", "hook a live agent surface
  into this app". NOT for one screen's structure (agent-ui-compose-layout), one feature's
  controls (agent-ui-compose-ui), or authoring the A2UI payloads themselves (a2ui-compose —
  this skill only wires the seam).
user-invocable: true
disable-model-invocation: false
---

# Compose app — the system spine

Assembles the application layer the screens plug into. The realized exemplar IS the docs
site: `site/main.ts` + `site/pages/_page.ts` are an app shell + page system composed
entirely from the fleet — read them before scaffolding a new host.

## Procedure

1. **Respect the package DAG** (enforced by per-package `layering.test.ts`; `CLAUDE.md`
   Layout is the map): `shared` ← `components` ← `a2ui` ← `app`, with `router` a sibling
   branch off `components` — `router` never imports `a2ui` and `a2ui`/`app` never import
   `router` (catalog-invisible by construction, ADR-0115); `icons`/`a2a` are leaves. An app
   composes DOWN this graph; needing an upward edge means the design is wrong.
2. **Foundation imports** — `@agent-ui/shared/tokens.css` (the color system) + the controls
   the app uses (barrel, or subpaths where tree-shaking matters — single-control subpath
   consumers under vitest need the `resolve.alias` precedent,
   [[agent-ui-component-packaging]]).
3. **Shell** — `ui-app-shell` + `ui-app-shell-region` (`@agent-ui/app`): per-instance
   isolation, no global singletons (ADR-0082..0084 own the region contract and the
   isolation law; the shell demo page is `site/pages/app-shell.ts`).
4. **Routing — memory-first, URL opt-in** (ADR-0115): route state is one signal;
   `createRouter` + plain navigate/back/forward from the HEADLESS barrel
   (`@agent-ui/router`); `connectUrl` only when the host wants URL reflection (hash default,
   history opt-in). The elements live on their OWN subpaths — `./router-outlet`,
   `./router-link` — deliberately not re-exported from the barrel (the tree-shake contract;
   a headless consumer never pays for DOM elements). v1 grammar: static · `:param` ·
   trailing `*`, declaration-order first-match.
5. **Theming** — app-wide defaults ride `:root`/ambient; a workspace/panel that differs gets
   a `ui-theme-provider` boundary (unset props inherit ambient; the ink re-root caveat —
   [[agent-ui-composition-patterns]]). `[scale]`/`[density]` set at shell/region roots.
6. **App state** — the props-as-signals surface each control exposes is the reactive
   contract; app-own state follows the same signals model — the kernel
   (`signal`/`computed`/`effect`) is public API off the components barrel (`plan.md` §5
   props on the §4 kernel). Don't bolt a second reactivity system onto the fleet.
7. **The A2UI arm (optional)** — an agent-driven surface = the `@agent-ui/a2ui` renderer +
   default catalog; payload authoring routes to [[a2ui-compose]]; live transports stay
   dev-only behind server-side-key proxies (the ADR-0073 trust boundary — production keys
   stay server-side). The seam is one mount point; the app never re-implements renderer
   concerns.
8. **Prove the spine** — `npm run check` + the app's own probes; tree-shake/size posture per
   the packaging map when the app ships as a bundle; screens and features then compose in
   via [[agent-ui-compose-layout]] / [[agent-ui-compose-ui]].

## Review (generator ≠ critic)

The shell/screen structure → `ui:layout-reviewer`; cross-screen journeys →
`ui:flow-reviewer`; contract-touching code → the house code review. Name the artifact,
hand off.

## Definition of done

- [ ] Imports point down the DAG only; layering tests green.
- [ ] Shell regions per the app package's contract; no global singletons.
- [ ] Router headless-first; elements via subpaths; URL reflection only where opted in.
- [ ] Theme/scale/density boundaries explicit; tokens.css loaded once at the root.
- [ ] A2UI seam (if any) mounted through the public renderer surface; keys server-side.
- [ ] Gates green; independent review passed.
