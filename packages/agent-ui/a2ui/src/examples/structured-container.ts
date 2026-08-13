// structured-container.ts — the GH #808 S5 exemplar seed (a2ui-container-vocabulary SPEC-R9): a
// structured container in the Figma dialog-bubble mock's register — a trip-summary card whose header
// is `CardHeader[format='structured']` (ADR-0186's mark, SPEC-R1) composing `Icon[slot='leading']` +
// a bare-text title + `Badge[slot='trailing']` with a BOUND intent (SPEC-R2's slot marks; live status
// binds through the data model), whose body stacks the SPEC-R4 label/value row idiom
// (`Row[justify='between']` › `Text[variant='label']` + `Badge[intent='neutral']` with bound labels),
// and whose footer carries one action. B1–B3 compliant by construction (SPEC-R7: one card level, no
// Card-in-Card, header-first/footer-last).
//
// `variant: 'label'` deliberately exercises SPEC-R4's WIRE mark (shipped in S1 — the enum member is
// live regardless of ADR-0078's amendment ratification state, which governs the DOC record; the
// taught tier's `structured-container` mini-skill stays on its `caption` wall until that flip). This
// seed doubles as the valid conformance fixture's source (SPEC-R9 AC / SPEC-R6's fixture sequencing).

import type { ExampleSeed } from './types.ts'

const SURFACE_ID = 'trip-summary'

export const structuredContainerSeed: ExampleSeed = {
  name: 'structured-container-trip-summary',
  description:
    'A structured trip-summary container: mono-titled header with leading icon and bound status badge, two label/value rows, one footer action.',
  promptText: 'Show my trip booking as a summary card with the dates and its confirmation status.',
  surfaceId: SURFACE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SURFACE_ID,
        value: { status: 'Confirmed', statusIntent: 'success', arrive: 'Aug 18', depart: 'Aug 22' },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', children: ['header', 'content', 'footer'] },
          { id: 'header', component: 'CardHeader', format: 'structured', children: ['hdr-icon', 'hdr-title', 'hdr-status'] },
          { id: 'hdr-icon', component: 'Icon', name: 'calendar', label: 'Dates', slot: 'leading' },
          { id: 'hdr-title', component: 'Text', text: 'Date selection', variant: 'label' },
          { id: 'hdr-status', component: 'Badge', label: { path: '/status' }, intent: { path: '/statusIntent' }, slot: 'trailing' },
          { id: 'content', component: 'CardContent', children: ['row-arrive', 'row-depart'] },
          { id: 'row-arrive', component: 'Row', justify: 'between', align: 'center', children: ['lbl-arrive', 'val-arrive'] },
          { id: 'lbl-arrive', component: 'Text', text: 'Arrive', variant: 'label' },
          { id: 'val-arrive', component: 'Badge', label: { path: '/arrive' }, intent: 'neutral' },
          { id: 'row-depart', component: 'Row', justify: 'between', align: 'center', children: ['lbl-depart', 'val-depart'] },
          { id: 'lbl-depart', component: 'Text', text: 'Depart', variant: 'label' },
          { id: 'val-depart', component: 'Badge', label: { path: '/depart' }, intent: 'neutral' },
          { id: 'footer', component: 'CardFooter', children: ['change-btn'] },
          { id: 'change-btn', component: 'Button', variant: 'soft', label: 'Change dates', action: { action: 'change-dates' } },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent. */
export const structuredContainerSeeds: readonly ExampleSeed[] = [structuredContainerSeed]
