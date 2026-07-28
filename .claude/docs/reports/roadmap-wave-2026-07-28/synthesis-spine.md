# Synthesis — the 6-system dependency spine (2026-07-28)

Sources: inv-1..6 (this directory), roadmap.md §2-4, ADR-0161/0162 (both `proposed`).

## The DAG (provider → consumer)

```
components ──┬──> a2ui ─────┬──> agent-admin ──> SaaS patterns (greenfield)
             ├──> genui ────┤         ▲
             ├──> shells(app) ────────┘
             └──────────────────────> SaaS patterns
   (router, code, icons, a2a: sibling branches, no open edges this pass)
```

Consumer-most layer = SaaS patterns (inv-6), whose "consumer" is the site demo pages +
any external `@agent-ui-kit/*` adopter. agent-admin is both the flagship consumer of
a2ui/genui/shells AND a provider of proto-patterns (entry-list, settings store, game loop).

## Edges, annotated by inventoried gaps

### components → SaaS patterns — THE mismatch edge of this wave
- **ui-table is display-only BY CONTRACT** (`table.md`: tier display, `events: []`,
  ADR-0004/LLD-C9 fixed it that way — inv-4 §3.1) while inv-6 §2c names selection / sort /
  filter / pagination as the #1 data-SaaS need. This is a consumer-need vs provider-plan
  conflict that needs a **ruled contract change** (design intake + ADR), not a drive-by edit.
- Chart family = 2 controls (bar, sparkline); ADR-0107 *deliberately* deferred line/area/pie
  (inv-4 §3.2, inv-6 §2a asks for a scope re-ruling or a documented "no line chart" stance).
- Wholly unbuilt: `ui-pagination` (inv-6 §1c: 100% absent), tree control, file upload
  (ui-attachment is display-only), date-range field, faceted filter-bar composite (inv-4 §3.3-6).

### components → a2ui
- **5 newer controls uncataloged with no recorded decision**: command-modal, status-stream,
  toast, textarea, theme-provider (landed 07-09→14; catalog holds 49 types; form-popover IS in)
  — inv-2 §3.6/§4. Needs a per-control decide-or-defer pass, not silent gaps.
- **ADR-0161 (proposed)**: `value` mark widens to ≥1 slots so Calendar range + SliderMulti can
  write back at all (GH #314's root cause). Component-side blast radius near-zero (inv-4 §2);
  Repairs cell already enumerates every file.

### components → genui
- **ADR-0162 (proposed)**: dogfood mode demands a NEW artifact discipline from components — a
  committed generated CSS+IIFE asset pair under `sandbox-frame/dogfood/` + freshness gate
  (inv-3 §2, inv-4 §2/§5). Decomp S0-S5 exists; **gated solely on Kim's ratification**.
- GH #315 (cosmetic): calendar range band notches — found riding #314.

### a2ui → agent-admin
- Catalog picker exists but has **one catalog by construction**; `catalogId` request field is
  dead weight until a second exists (inv-1 §3.4/6).
- **GH #307** (major, not root-caused): quiz/game personas exhaust round budget on IDGRAPH —
  leading hypothesis is the same-surface RESUME path (inv-2 §2); no taught recovery once the
  budget is spent (inv-2 §3.5).
- **GH #314**: selection state not reaching the model — inv-1 and inv-2 independently converge
  on ADR-0161 as the fix (named conflict: none — they agree).
- Live turns are **DEV-only by construction** (ADR-0131 cl.4/7); no production `agentTurn`
  path exists (inv-1 §3.5) — a ceiling on any "real product" bet.

### genui → agent-admin / site
- Dogfood mode is the only route to real fleet components inside GenUI (inv-1 §4).
- `gen-ui-live` is deliberately recorded-only — no live GenUI demo surface exists anywhere
  outside agent-admin (inv-3 §3.6).

### shells(app) → agent-admin / SaaS
- No command-palette slot/pattern, no breadcrumbs, no shell-level density prop (inv-5 §3.1-3).
- Dashboards get **zero shell help** beyond rail+pane chrome — content is one opaque slot
  (inv-5 §5); no "settings surface" slot type — agent-admin hand-rolls its pane content (inv-5 §5).
- Tab deep-linking would wire `router` into shells for the FIRST time — a deliberate layering
  question, SPEC-R3 says "never navigation" (inv-5 §3.7/§4).
- Provider strength to exploit: R7c survival law — embedded live surfaces survive band/tab
  crossings without remount (inv-5 §5).

### agent-admin → SaaS patterns (proto-pattern extraction edge)
- entry-list (ADR-0132) + the `ui-settings` schema→form generator + the live-apply store are
  domain-agnostic but **agent-admin-local files** — extraction to a shared home is a named
  prerequisite for any reuse without copy-paste (inv-6 §4/§5, inv-1 §5).
- No persona export/import; 14 presets are page-local TS data (inv-1 §3.7).

## Cross-cutting findings (surfaced independently by ≥2 inventories)
1. **Ratification backlog**: ADR-0160 (chat redesign) is BUILT+MERGED but `proposed` (inv-5 §2
   flags shipped-in-tree ≠ ratified); ADR-0161, ADR-0162 proposed with build plans ready.
   Three Kim flips unblock three distinct work streams.
2. **The 5 uncataloged components** (inv-2 §3.6; inv-4's descriptor count vs catalog's 49).
3. **Corpus is 1 exemplar file** — retrieval scaffolding with nothing to retrieve (inv-2 §1/§3.3).
4. **#314/#307 are the same product wound**: flagship personas fail live, from two different
   layers (binding schema vs resume semantics) — inv-1 §3.2-3, inv-2 §2.
5. **DEV-only live path** caps every "demonstrable outcome" at a `vite dev` session (inv-1 §3.5);
   the Cloudflare Worker port (ADR-0152) is the existing beachhead.
