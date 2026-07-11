// message-lifecycle.ts — the ADR-0126/TKT-0016 corpus exemplar (a2ui-message-lifecycle.lld.md LLD-C4,
// SPEC-R4): one worked, single-surface, all-four-type arc a retrieval-conditioned generation can imitate —
// createSurface (open) → updateComponents (restructure) → updateDataModel (react, no re-render) →
// deleteSurface (close), every surface-bearing message addressing the SAME "kpi-panel" surfaceId
// (a2ui-training-corpus SPEC-R2/ADR-0064's single-surface discipline; `deleteSurface` is explicitly among
// the counted surface-bearing kinds).
//
// DEVIATION from the LLD's literal worked JSONL (recorded here, not silent — flagged to the team lead
// during build): the LLD's own example resends `id:"root"` itself to add the second KPI tile. That resend
// is NOT legal — runtime SPEC-R3 AC2 (`renderer/tree.ts`'s `#rootDelivered` guard) treats ANY second
// delivery of `id:"root"` as an id-graph error and drops it, keeping the original root, no exception for a
// same-shape whole-record resend. Proven empirically: the LLD's literal payload fails
// `validate-payload` with `IDGRAPH kpi-panel:root`. Fixed by inserting one stable level: `root` (a Column)
// is delivered ONCE and never resent; the mutable container one level down, `grid` (a Grid, a plain
// non-root id), is what actually gets its FULL record resent with the added child — the SAME SPEC-R2
// whole-record-upsert teaching (a producer must resend a container's complete prop/children set, not a
// diff), just never touching the one id the renderer refuses to re-deliver. This needs a coordinated LLD
// repair (its worked JSONL should be corrected to match) — recorded in TKT-0016's Findings.

import type { ExampleSeed } from './types.ts'

const KPI_PANEL_ID = 'kpi-panel'

export const kpiPanelLifecycleSeed: ExampleSeed = {
  name: 'kpi-panel-lifecycle',
  description:
    'A worked message-lifecycle arc on one surface — open, restructure (a second KPI joins the grid), react (revenue updates live, no re-render), then close (a2ui-message-lifecycle.spec.md SPEC-R1/R2/R4).',
  promptText: 'Show revenue and churn KPIs, update revenue live, then close the panel once we\'re done reviewing it.',
  surfaceId: KPI_PANEL_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // 1. open — a new task boundary (SPEC-R1 rule 3).
    { version: 'v1.0', createSurface: { surfaceId: KPI_PANEL_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: KPI_PANEL_ID,
        components: [
          // `root` is a STABLE wrapper delivered exactly once — never resent (runtime SPEC-R3 AC2;
          // a2ui-compose/SKILL.md's Common-trap entry). `grid`, one level down, is the mutable container.
          { id: 'root', component: 'Column', gap: 'md', children: ['grid'] },
          { id: 'grid', component: 'Grid', min: '12rem', gap: 'md', children: ['revenue'] },
          { id: 'revenue', component: 'Stat', label: 'Revenue', value: { path: '/revenue' } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: KPI_PANEL_ID, path: '/revenue', value: 128000 } },

    // 2. restructure — a second KPI joins the grid (SPEC-R1 rule 2 / SPEC-R2: "grid" resent WHOLE,
    //    including its existing "min"/"gap" props, plus the new child id — root is untouched).
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: KPI_PANEL_ID,
        components: [
          { id: 'grid', component: 'Grid', min: '12rem', gap: 'md', children: ['revenue', 'churn'] },
          { id: 'churn', component: 'Stat', label: 'Churn', value: { path: '/churn' } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: KPI_PANEL_ID, path: '/churn', value: 2.4 } },

    // 3. react — a data-only refresh, NO updateComponents in this step (SPEC-R1 rule 1 / SPEC-R5 AC2).
    { version: 'v1.0', updateDataModel: { surfaceId: KPI_PANEL_ID, path: '/revenue', value: 131500 } },

    // 4. close — the dashboard's task is superseded by the dialog moving on (SPEC-R1 rule 4).
    { version: 'v1.0', deleteSurface: { surfaceId: KPI_PANEL_ID } },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const messageLifecycleSeeds: readonly ExampleSeed[] = [kpiPanelLifecycleSeed]
