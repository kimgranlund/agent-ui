// canvas-button.ts — the wave-4 capstone seed (ADR-0055 §3): a two-line stream standing up ONE clickable
// `ui-button`, whose click round-trips an `action` client→server message. The simplest possible A2UI
// payload — `createSurface` then one `Button` root — used by the canvas page as the integration proof
// made visible.
//
// The canvas page's two server-initiated `callFunction` RPC literals (`ping` / `required`) stay
// PAGE-LOCAL (ADR-0055 clause 5) — they are protocol probes fired AFTER this seed renders, one of which
// EXPECTS a rejection (`INVALID_FUNCTION_CALL`), not a surface-content exemplar this shelf owns.

import type { ExampleSeed } from './types.ts'

const SURFACE_ID = 'canvas'

export const canvasButtonSeed: ExampleSeed = {
  name: 'canvas-button',
  description: 'One clickable button whose click round-trips an action message.',
  promptText: 'Show a single "Click me" button that reports back when clicked.',
  surfaceId: SURFACE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Click me', action: { action: 'submit' } }],
      },
    },
  ],
}
