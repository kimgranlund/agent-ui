import re

def patch(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:80])
        s = s.replace(old, new)
    open(p, 'w').write(s)

# ── runtime SPEC ────────────────────────────────────────────────────────────────
patch('.claude/docs/spec/a2ui-runtime.spec.md', [
("""> Status: proposed · v0.1 · 2026-06-26 · Layer: SPEC (execution contract)""",
 """> Status: proposed · v0.2 · 2026-10-05 (v0.1 2026-06-26; v0.2 adds SPEC-R9 AC3, deferred apply behind a catalog's `controls` loader, and the `CONTROL_LOAD` internal code, ADR-0233, accepted) · Layer: SPEC (execution contract)"""),
("""- **AC2** *Given* a `component` type absent from the catalog, *when* rendered, *then* the renderer emits `error{code:"CATALOG"}` and renders a non-fatal placeholder (the rest of the tree still renders).
""",
 """- **AC2** *Given* a `component` type absent from the catalog, *when* rendered, *then* the renderer emits `error{code:"CATALOG"}` and renders a non-fatal placeholder (the rest of the tree still renders).
- **AC3** *(ADR-0233, deferred apply)* *Given* a catalog registered with a `controls` loader and an `updateComponents` whose factory tags are not all defined, *when* ingested, *then* the renderer creates no element for that surface until the loader's `ensure` settles, queues that message and every later `updateComponents`, `updateDataModel` and `finalize` for the surface in arrival order, and drains the queue in order once the tags are defined (re-checking each queued message's tags). *Given* the load fails, *then* the renderer emits `error{code:"CONTROL_LOAD"}` once for that surface, drains anyway, and renders each node whose tag is still undefined as the non-fatal placeholder. A `deleteSurface` while pending tears the surface down and drops its queue; `createSurface` and every other surface are never delayed. *Given* no tag is missing and no queue is pending, or a catalog without `controls`, *then* the message applies synchronously, exactly as without a loader.
"""),
("""  | "POINTER" | "VERSION_UNSUPPORTED" | "FUNCTION" | "DEPTH_EXCEEDED"; // DEPTH_EXCEEDED: SPEC-R15, GH #473""",
 """  | "POINTER" | "VERSION_UNSUPPORTED" | "FUNCTION" | "DEPTH_EXCEEDED" // DEPTH_EXCEEDED: SPEC-R15, GH #473
  | "CONTROL_LOAD"; // SPEC-R9 AC3, ADR-0233: a catalog's controls loader failed; surface-scoped like CATALOG"""),
])

# ── renderer LLD ────────────────────────────────────────────────────────────────
patch('.claude/docs/lld/a2ui-renderer.lld.md', [
("""> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)""",
 """> Status: proposed · v0.2 · 2026-10-05 (v0.1 2026-06-26; v0.2 adds the §6 `ControlLoader` seam and deferred apply, and the §9 `CONTROL_LOAD` row, ADR-0233, accepted) · Layer: LLD (implementation plan)"""),
("""
**LLD-C8 input controller:**""",
 """
**The `ControlLoader` seam (LLD-C7 + LLD-C13, ADR-0233, runtime SPEC-R9 AC3).** `CatalogEntry.controls?: ControlLoader` (from `@agent-ui/components/loader`, type-only in `catalog/types.ts`) is the optional fourth argument of `Registry.register`, `RendererHost.register` and `composePersonaCatalogs`'s derived registration, stored only when provided. `ControlLoader.missing(tags)` is synchronous (the tags with no custom-element definition); `ensure(tags)` defines them. Parents read their children in `connected()`, so the host never creates an element before its tag is defined:
- **Tags.** On `updateComponents` the host (`#onUpdateComponents`) collects the union of `factoriesOf(entry.factories[node.component]).map(f => f.tag)` over the message's components (every arm of a variant table; unknown types skipped).
- **Sync fast path.** No queue for the surface and `missing(tags)` empty: `tree.apply` runs synchronously, as without a loader. An entry without `controls` never reaches this branch.
- **Queue.** Otherwise the message joins a per-surface queue (`#controlQueues`), and so does every later `updateComponents`, `updateDataModel` and `finalize(S)` for that surface while the queue is non-empty. One `ensure` is in flight per surface; the drain (`#drainControls`) runs the queue in order and re-checks `missing` per queued `updateComponents`, starting the next `ensure` when a later message needs a new tag. A queued `finalize` matters for correctness: it must judge the complete set.
- **Failure.** A rejected `ensure`, or a resolve that left a requested tag undefined, emits one `CONTROL_LOAD` (surface-scoped) and drains anyway; LLD-C7's `create` returns the `a2ui-placeholder` for a node whose factory tag `controls.missing` still reports, and the wiring (`wireProps`, the host's action and checks wiring) skips that placeholder, so it stays inert.
- **Teardown.** `deleteSurface`, a re-`createSurface` of the same id, and `dispose()` drop the queue through `#teardownSurfaceDom`; a late settle compares queue identity (and `#disposed`) and is a no-op. `createSurface`, `actionResponse`, `callFunction` and other surfaces are never delayed.
- **Persona controls.** `composeControlLoaders(base.controls, pkg.controls)` gives a derived entry a loader that routes a tag with a persona `ControlRecord` to a `'host'`-mode loader over those records and every other tag to the base loader; `undefined` when both are absent.

**LLD-C8 input controller:**"""),
("""| `CATALOG` | LLD-C7 | `VALIDATION_FAILED` | unknown `component` type → error + placeholder; siblings render (R9 AC2) |
""",
 """| `CATALOG` | LLD-C7 | `VALIDATION_FAILED` | unknown `component` type → error + placeholder; siblings render (R9 AC2) |
| `CONTROL_LOAD` | LLD-C13 | `VALIDATION_FAILED` | a catalog's `controls` loader rejected (or left a tag undefined) → one error per failed load, surface-scoped; the queue drains anyway and still-undefined nodes render as placeholders (R9 AC3, ADR-0233) |
"""),
])
print('ok')
