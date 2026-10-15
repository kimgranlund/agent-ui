---
doc-type: ticket
id: tkt-0044
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0044 — `npm run dev` crashes on start: ADR-0135's `import.meta.url`-relative prompt loader breaks under Vite's own config bundling

## Summary
Reported live by Kim running `npm run dev` right after ADR-0135 landed:

```
failed to load config from /Users/kimba/Projects/nonoun/agent-ui/vite.config.ts
error when starting dev server:
Error: ENOENT: no such file or directory, scandir '/Users/kimba/Projects/nonoun/agent-ui/node_modules/.vite-temp/prompts/mini-skills'
    at readdirSync (node:fs:1584:26)
    at loadMiniSkills (file:///.../node_modules/.vite-temp/vite.config.ts.timestamp-....mjs:515:9)
```

ADR-0135's Piece C moved `system-prompt.ts`/`mini-skills.ts`'s prompt content into files, loaded via a
path resolved relative to `import.meta.dirname`/`import.meta.url`. The ADR's own Decision clause 13
explicitly reasoned this was safe: "deliberately DIFFERENT from `dev-proxy-plugin.ts`'s `process.cwd()`-
based paths, because the proxy is Vite-bundled into a temp file... whereas `system-prompt.ts`/
`mini-skills.ts` are NOT bundled that way." That reasoning was wrong. `vite.config.ts` imports
`a2uiDevProxyPlugin` from `dev-proxy-plugin.ts`, which imports `produce.ts`, which imports
`mini-skills.ts` and `system-prompt.ts` — when Vite bundles `vite.config.ts` (via esbuild, into
`node_modules/.vite-temp/*.mjs`), esbuild pulls in the WHOLE reachable import graph from that entry
point, not just the plugin's own top-level file. Both prompt-loader modules got relocated into the same
temp bundle, so their `import.meta.url`-relative directory resolved against the TEMP file's location,
not their real source location — a directory that only exists under the real source tree.

The build's own review round (`agent-harness-review-1`) verified the equivalence gate passed under
vitest and confirmed the mechanism was "correct" — but neither the build nor that review actually ran
`npm run dev`, the one code path that exercises Vite's own config-bundling behavior. The jsdom/vitest
leg and the real dev-proxy runtime leg are two DIFFERENT bundling contexts; passing one doesn't prove
the other.

## Acceptance
- `npm run dev` starts cleanly with no ENOENT/scandir error.
- `system-prompt.ts`/`mini-skills.ts` resolve their `prompts/` directory the same way
  `dev-proxy-plugin.ts` already does — `process.cwd()`-anchored, matching the ONE proven-working
  pattern in this exact file, not a second, independently-reasoned mechanism.
- `npx vitest run` for the live-agent test files (`prompt-equivalence`, `agent-config-schema`,
  `prompt-drift`, `mini-skills`, `system-prompt-grammar`) stay green, unmodified in their own
  assertions.
- `npm run check` stays clean.

## Repro
1. On the tree right after ADR-0135's build/commit, run `npm run dev`.
2. The dev server fails to start with `ENOENT: no such file or directory, scandir
   '.../node_modules/.vite-temp/prompts/mini-skills'`.

## Expected vs actual
- **Expected:** `npm run dev` starts and serves the site + the A2UI dev proxy normally.
- **Actual:** Vite's config load crashes before the server ever starts, because
  `mini-skills.ts`'s `loadMiniSkills()` (transitively reachable from `vite.config.ts` via the dev
  proxy plugin) resolves its prompts directory against `import.meta.url`, which points inside Vite's
  own temp bundle output once esbuild relocates the whole reachable module graph there.

## Classification
Axis: **functional** (a real runtime crash, not a visual/structural issue) — the config-bundling
boundary a Node-only tooling module must respect once ANY of its importers is reachable from
`vite.config.ts`, even transitively. Plane: `packages/agent-ui/a2ui/tools/agent/{system-prompt.ts,
mini-skills.ts}` (the two path-resolution sites) · `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts:9`
(the proven-correct precedent both files now follow).

## Severity
**blocker** — `npm run dev` is the primary local dev-server entry point; nothing else in the docs
site or A2UI dev flow is reachable while it's broken.

## Links
- [ADR-0135](../adr/0135-agent-harness-config-schema-and-prompt-files.md) clause 13 (the mechanism
  this ticket corrects) and its Consequences section's own flagged-but-unconfirmed build-time check
  ("the prompt-file reads resolve under both the dev proxy and vitest" — vitest was confirmed, the
  dev proxy was not, and this is exactly where the gap was).
- `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts:9` — the pre-existing, proven
  `process.cwd()` pattern both files now mirror exactly.

## Scope/Open
None — a same-file, mechanical fix; no design fork.

## Findings

**2026-07-14 — fixed and verified.** `system-prompt.ts` and `mini-skills.ts` both switched from
`import.meta.dirname`/`fileURLToPath(import.meta.url)`-relative path resolution to
`process.cwd()`-anchored absolute paths (`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/prompts`
and `.../prompts/mini-skills`), matching `dev-proxy-plugin.ts:9`'s own established, working pattern
exactly — removing the now-unused `node:url`/`node:path` imports from both files.

Verified for real, not just re-typechecked: started `npm run dev` in the background, confirmed a
clean `VITE v8.1.0 ready` startup with zero errors (previously crashed immediately on config load).
`npm run check` clean. Scoped vitest run — `prompt-equivalence.test.ts`, `agent-config-schema.test.ts`,
`prompt-drift.test.ts`, `mini-skills.test.ts`, `system-prompt-grammar.test.ts` — 5 files, 83 tests,
all green, confirming the fix didn't regress the vitest-side behavior that was already correct.

The root lesson this ticket names for future ADR-0135-shaped work: a Node-only tooling module's
"never bundled" assumption must be checked against every REACHABLE entry point, not just the one
the module's own author had in mind — `vite.config.ts` itself is a bundling boundary, and anything
transitively importable from it (however many hops away) is subject to that boundary's relocation
behavior, not just the file literally named in the plugin registration.
