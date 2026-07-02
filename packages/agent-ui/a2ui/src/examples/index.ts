// index.ts — the example seed shelf's public surface (ADR-0055). Exposed ONLY via the package.json
// "./examples" subpath export — the root barrel does NOT re-export this module (consumer-bundle
// hygiene: demo payload JSON must never enter a renderer consumer's bundle, the
// `@agent-ui/components/components` subpath precedent).
//
// 11 seeds: 1 canvas + 4 dynamic-list + 1 generative-form + 5 patterns. `allSeeds` is the gate's
// (`examples.test.ts`) iteration surface; each named export is what a `/site` page imports directly.

export type { ExampleSeed } from './types.ts'

export { canvasButtonSeed } from './canvas-button.ts'
export { listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed } from './dynamic-lists.ts'
export { generativeFormSeed } from './generative-form.ts'
export {
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
} from './patterns.ts'

import type { ExampleSeed } from './types.ts'
import { canvasButtonSeed } from './canvas-button.ts'
import { listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed } from './dynamic-lists.ts'
import { generativeFormSeed } from './generative-form.ts'
import {
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
} from './patterns.ts'

/** Every seed on the shelf — the standing gate's (`examples.test.ts`) iteration surface. */
export const allSeeds: readonly ExampleSeed[] = [
  canvasButtonSeed,
  listDisplaySeed,
  listPeopleSeed,
  listFormSeed,
  listNestedSeed,
  generativeFormSeed,
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
]
