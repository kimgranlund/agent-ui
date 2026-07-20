// process-shim.ts — side-effect only, imported FIRST in worker/index.ts (before anything that
// transitively imports system-prompt.ts or mini-skills.ts). Those two files reference an AMBIENT global
// `process.cwd()` — declared via `declare const process: {...}`, never imported — to build the
// filesystem paths they pass to `readFileSync`/`readdirSync`. Workers has no such global by default; this
// installs one returning `''`, so the computed paths (e.g. `/packages/agent-ui/a2ui/src/agent/prompts/
// grammar.md`) match exactly what `fs-shim-content.ts` keys its bundled content by.
//
// Import-order matters: ES module imports evaluate depth-first in the order they're written, each module
// only once — this file has no imports of its own, so it fully runs before `worker/index.ts` moves on to
// resolving `produce.ts` → `system-prompt.ts`/`mini-skills.ts`, whose module-level `loadPrompt`/
// `loadMiniSkills` calls need the global to already exist.

// `nodejs_compat` (wrangler.jsonc) already installs a global `process` with a WORKING `cwd()` — it just
// returns `/bundle` (a workerd sentinel), not `''`. That's a function that exists and runs, so a
// feature-detect guard (only patch if `cwd` is missing/non-function) never fires — the override must be
// unconditional, not defensive.
const target = globalThis as unknown as { process?: { cwd(): string; env: Record<string, string | undefined> } }

if (target.process === undefined) target.process = { cwd: () => '', env: {} }
else target.process.cwd = () => ''
