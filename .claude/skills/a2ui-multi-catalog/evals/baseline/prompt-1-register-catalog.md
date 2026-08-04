# Baseline 1 — without the skill (2026-08-04)

Prompt: "How do I add another catalog beside the default in @agent-ui/a2ui, so a second
component set (e.g. Google's upstream A2UI Basic catalog) renders on our renderer? Where do
registration, factories, and function implementations go, and how does a request select which
catalog the producer uses?"

Runner: fresh-context Explore agent (haiku), instructed to answer from package source only
(no .claude/skills, no .claude/docs/adr). Capture note: the agent's answer nonetheless cites
ADR-0169 clauses — the ratified decision leaks through code comments/spec cross-references,
so this baseline measures routing-without-the-skill, not ignorance of the ADR.

## Output (verbatim)

To add another catalog beside the default, implement three layers:

**1. Create catalog + factories** (`src/catalog/custom/`):
- `catalog.json` — component declarations with `catalogId`, `protocolVersion`, `components` (each with props/children/value marks), optional `functions`
- `factories.ts` — `WidgetFactory` map keyed by component type, one factory per declared component (SPEC-R7 AC1: coverage is a load-time gate)
- `functions.ts` (optional) — per-catalog function implementations (ADR-0169 cl.8), keyed by function name

**2. Register at runtime** (renderer setup):
```ts
const registry = new Registry()
registry.register(defaultCatalog, defaultFactories)
registry.register(customCatalog, customFactories, customFunctions)
```
`register()` validates shape via `loadCatalog()`, enforces factory coverage, and allows last-wins re-registration.

**3. Route by catalogId**:
- **Producer**: Pass `ProduceDeps.catalog` to `produce()` — it stamps all `createSurface` messages with that catalog's `catalogId`
- **Renderer**: The host resolves `createSurface.catalogId` against the registry, looks up the `CatalogEntry` (catalog + factories + optional functions), and the widget resolver pulls factories from there; unknown IDs raise `CATALOG_UNKNOWN`

The registry is a two-tier model (SPEC-R6/N1) — project catalogs register into a shared registry, and the renderer reads from one authoritative set per runtime. Catalog selection is producer-driven; the server is authoritative (ADR-0169 cl.4 stamps the final catalogId after validation).

## Assertion check (without the skill)

- Assertion 1 (registry + partition coverage gate, cl.1/cl.2/cl.14): PARTIAL — registration
  named; the constructor pre-registration ("always both available") and the cl.14 partition
  coverage-gate discipline are absent.
- Assertion 4 (catalogId threading + per-catalog functions, cl.3/cl.4/cl.8): PARTIAL —
  cl.8/cl.4 surfaced, but the request-body → selectCatalog fail-closed server selection
  (cl.3) and the client threading (cl.5) are absent.
