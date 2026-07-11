// index.ts — the example seed shelf's public surface (ADR-0055). Exposed ONLY via the package.json
// "./examples" subpath export — the root barrel does NOT re-export this module (consumer-bundle
// hygiene: demo payload JSON must never enter a renderer consumer's bundle, the
// `@agent-ui/components/components` subpath precedent).
//
// 21 seeds: 1 canvas + 4 dynamic-list + 1 generative-form + 5 patterns + 9 catalog-coverage (the
// ADR-0087/ADR-0093/ADR-0095 wave — booking-reservation, rental-filter-panel, document-row-toolbar,
// stats-grid-dashboard — PLUS report-card-dashboard [ADR-0107 chart-family, chart-family.lld.md LLD-C12],
// PLUS the report/content/feed M2 teaching-wave exemplars — ops-report, deployment-report,
// agent-task-status [ADR-0111/0113/0112, LLD-C15 each] — PLUS the token-surface M2 teaching exemplar —
// brand-palette [ADR-0118, token-surfaces.lld.md LLD-C15]) + 1 message-lifecycle (the ADR-0126/TKT-0016
// four-type corpus exemplar — kpi-panel-lifecycle, a2ui-message-lifecycle.lld.md LLD-C4). `allSeeds` is
// the gate's (`examples.test.ts`) iteration surface, composed from each module's own family array (never
// a hand-counted literal — the drift-gate doctrine); each named export is what a `/site` page imports directly.

export type { ExampleSeed } from './types.ts'

export { canvasButtonSeed, canvasSeeds } from './canvas-button.ts'
export { listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed, dynamicListSeeds } from './dynamic-lists.ts'
export { generativeFormSeed, generativeFormSeeds } from './generative-form.ts'
export {
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
  patternSeeds,
} from './patterns.ts'
export {
  bookingReservationSeed,
  rentalFilterPanelSeed,
  documentRowToolbarSeed,
  statsGridDashboardSeed,
  reportCardDashboardSeed,
  opsReportSeed,
  deploymentReportSeed,
  agentTaskStatusSeed,
  brandPaletteSeed,
  catalogCoverageSeeds,
} from './catalog-coverage.ts'
export { kpiPanelLifecycleSeed, messageLifecycleSeeds } from './message-lifecycle.ts'

import type { ExampleSeed } from './types.ts'
import { canvasSeeds } from './canvas-button.ts'
import { dynamicListSeeds } from './dynamic-lists.ts'
import { generativeFormSeeds } from './generative-form.ts'
import { patternSeeds } from './patterns.ts'
import { catalogCoverageSeeds } from './catalog-coverage.ts'
import { messageLifecycleSeeds } from './message-lifecycle.ts'

/** Every seed on the shelf — the standing gate's (`examples.test.ts`) iteration surface. Composed from
 *  each module's own family array, so the total is always derived, never a separately-maintained count. */
export const allSeeds: readonly ExampleSeed[] = [
  ...canvasSeeds,
  ...dynamicListSeeds,
  ...generativeFormSeeds,
  ...patternSeeds,
  ...catalogCoverageSeeds,
  ...messageLifecycleSeeds,
]
