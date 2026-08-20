// index.ts — the example seed shelf's public surface (ADR-0055). Exposed ONLY via the package.json
// "./examples" subpath export — the root barrel does NOT re-export this module (consumer-bundle
// hygiene: demo payload JSON must never enter a renderer consumer's bundle, the
// `@agent-ui/components/components` subpath precedent).
//
// 27 seeds: 1 canvas + 4 dynamic-list + 1 generative-form + 5 patterns + 10 catalog-coverage (the
// ADR-0087/ADR-0093/ADR-0095 wave — booking-reservation, rental-filter-panel, document-row-toolbar,
// stats-grid-dashboard [DROPPED 2026-08-18 per its judged D5 refusals — the ADR-0165 drop path;
// catalog-coverage.ts (4)] — PLUS report-card-dashboard [ADR-0107 chart-family, chart-family.lld.md LLD-C12],
// PLUS the report/content/feed M2 teaching-wave exemplars — ops-report, deployment-report,
// agent-task-status [ADR-0111/0113/0112, LLD-C15 each] — PLUS the token-surface M2 teaching exemplar —
// brand-palette [ADR-0118, token-surfaces.lld.md LLD-C15] — PLUS the color-picker M2 teaching exemplar —
// color-picker-form [ADR-0123, color-picker.lld.md]) + 1 message-lifecycle (the ADR-0126/TKT-0016
// four-type corpus exemplar — kpi-panel-lifecycle, a2ui-message-lifecycle.lld.md LLD-C4) + 3
// corpus-growth (the 2026-07-28 M-B wave, judged against a2ui-corpus.md — feedback-form [Textarea's
// first exemplar, ADMIT], elevation-scale [4 correctly-quoted Card.elevation members, GH #286/#305,
// ADMIT], trivia-round-resume [the GH #307 multi-round resume discipline; held for re-judging after a
// binding-bug fix, corpus-growth.ts's module header]; a fourth candidate, retreat-reschedule, was
// REJECTED and dropped — its claimed gap was false, corpus-growth.ts's module header). `allSeeds` is
// the gate's (`examples.test.ts`) iteration surface, composed from each module's own family array
// (never a hand-counted literal — the drift-gate doctrine); each named export is what a `/site` page
// imports directly.
// GH #1374 — the plan-and-execute exemplar: a Timeline plan snapshot (canvas) beside one ADR-0097
// commit-gated approve ask carrying per-step Checkbox opt-outs (feed), emitted the same turn, then
// per-turn updateDataModel advancing the approved steps' status (the design ruling's own closure path,
// Findings comment 5343203377 — no ADR earned, a teaching-corpus gap only).

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
  reportCardDashboardSeed,
  opsReportSeed,
  deploymentReportSeed,
  agentTaskStatusSeed,
  brandPaletteSeed,
  colorPickerFormSeed,
  catalogCoverageSeeds,
} from './catalog-coverage.ts'
export { kpiPanelLifecycleSeed, messageLifecycleSeeds } from './message-lifecycle.ts'
export { feedbackFormSeed, elevationScaleSeed, triviaRoundResumeSeed, corpusGrowthSeeds } from './corpus-growth.ts'
// GH #729 — the catalog-frontier family: the 2026-08-12 sweep's 13 example-less catalog components, covered.
export { tripCardSeed, inviteModalSeed, reviewSplitSeed, onboardingTourSeed, roundOutcomeToastSeed, bookingReceiptSeed, heroListingCardSeed, cardAnatomyAskSeed, backableWizardSeed, greetCardSeed, latencyLineChartSeed, mediaTourSeed, drillSettingsSeed, paneSwitcherSeed, fileDropAttachSeed, suggestionsChipsSeed, sourceListCitationsSeed, ratingReviewSeed, pieChartBudgetSeed, choiceGroupRoomsSeed, disclosureSummarySwitchSeed, serviceGatewaySeed, catalogFrontierSeeds } from './catalog-frontier.ts'
export { structuredContainerSeed, structuredContainerSeeds } from './structured-container.ts'
// GH #972 — the high-frequency-patterns family: the 2026-08-15 gap-map sweep's 5 missing high-frequency
// chat-feed patterns (comparison table, receipt card, empty/error card, notification stack, media grid).
export {
  comparisonPricingSeed,
  receiptOrderSummarySeed,
  emptyErrorRetryCardSeed,
  notificationStatusStackSeed,
  mediaFileGridSeed,
  highFrequencyPatternSeeds,
} from './high-frequency-patterns.ts'
// GH #1205 — composition seeds pack A (req-a2ui-library R4, now-tier): the four dispositioned
// composition patterns — slideshow · confirmation · trend-list · card-layouts.
export {
  slideshowGallerySeed,
  confirmationViewSeed,
  trendListSeed,
  cardLayoutsSeed,
  compositionPackASeeds,
} from './composition-pack-a.ts'
// GH #1206 — composition seeds pack B (req-a2ui-library R4, next-tier): the dispositioned composition
// patterns — weather · menu · itinerary. The pack's fourth seed, wizard-step-progress (the
// Ladder/Progress presentation), was DROPPED 2026-08-18 per its judged D1 refusals — the ADR-0165 drop
// path; the wizard technique's exemplar is the backable-wizard flow-protocol seed (catalog-frontier.ts).
export {
  fiveDayWeatherSeed,
  restaurantMenuSeed,
  travelItinerarySeed,
  compositionPackBSeeds,
} from './composition-pack-b.ts'
// GH #1355 (the 2026-08-18 preset-vs-catalog gap analysis) — the CRUD entry-list idiom's corpus seed:
// a List of named entries, each toggleable and editable through a validated FormProvider inside a
// Drawer, plus an add-from-library affordance.
export { crudEntryListDrawerSeed, crudEntryListSeeds } from './crud-entry-list.ts'
// GH #1374 — the plan-and-execute exemplar (the design ruling's closure path, comment 5343203377):
// a Timeline plan snapshot beside one ADR-0097 commit-gated approve ask, per-step Checkbox opt-outs,
// then per-turn updateDataModel progress advance.
export { planAndExecutePlanSeed, planAndExecuteApproveAskSeed, planAndExecuteSeeds } from './plan-and-execute.ts'
// GH #1377 — the commerce+hospitality genui-pack: product-presentation (flagship, judged+admitted),
// variant-picker + quantity (product-options-quantity), and media-grid (listing-photo-grid) —
// admission pending the judged wave for the latter two (disposition-allowlist.ts). GH #1480 appended a
// fourth, sibling-not-pack seed to the same module's END — customer-review-card (also pending the
// judged wave, disposition-allowlist.ts).
export {
  commerceProductCardSeed,
  productOptionsQuantitySeed,
  listingPhotoGridSeed,
  customerReviewCardSeed,
  commerceHospitalitySeeds,
} from './commerce-hospitality.ts'

import type { ExampleSeed } from './types.ts'
import { canvasSeeds } from './canvas-button.ts'
import { dynamicListSeeds } from './dynamic-lists.ts'
import { generativeFormSeeds } from './generative-form.ts'
import { patternSeeds } from './patterns.ts'
import { catalogCoverageSeeds } from './catalog-coverage.ts'
import { messageLifecycleSeeds } from './message-lifecycle.ts'
import { corpusGrowthSeeds } from './corpus-growth.ts'
import { catalogFrontierSeeds } from './catalog-frontier.ts'
import { structuredContainerSeeds } from './structured-container.ts'
import { highFrequencyPatternSeeds } from './high-frequency-patterns.ts'
import { compositionPackASeeds } from './composition-pack-a.ts'
import { compositionPackBSeeds } from './composition-pack-b.ts'
import { crudEntryListSeeds } from './crud-entry-list.ts'
import { planAndExecuteSeeds } from './plan-and-execute.ts'
import { commerceHospitalitySeeds } from './commerce-hospitality.ts'

/** Every seed on the shelf — the standing gate's (`examples.test.ts`) iteration surface. Composed from
 *  each module's own family array, so the total is always derived, never a separately-maintained count. */
export const allSeeds: readonly ExampleSeed[] = [
  ...canvasSeeds,
  ...dynamicListSeeds,
  ...generativeFormSeeds,
  ...patternSeeds,
  ...catalogCoverageSeeds,
  ...messageLifecycleSeeds,
  ...corpusGrowthSeeds,
  ...catalogFrontierSeeds,
  ...structuredContainerSeeds,
  ...highFrequencyPatternSeeds,
  ...compositionPackASeeds,
  ...compositionPackBSeeds,
  ...crudEntryListSeeds,
  ...planAndExecuteSeeds,
  ...commerceHospitalitySeeds,
]
