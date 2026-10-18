// scripts/e2e-admin/probe/scenarios/quizmaster.ts: The Quizmaster's smoke scenario (T-0343), one turn on its signature
// composite. The `quiz-round` skill makes each round ONE QuestionCard (its persona catalog); each step's `expect`
// becomes `--expect-turn`. `plan.ts --tag smoke` plans it; `plan.test.mjs` checks every expected type is in the
// preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const QUIZMASTER_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'first-question',
    tags: ['smoke'],
    steps: [say('Start a quiz on world capitals.', 'QuestionCard')],
    expectComponents: ['QuestionCard'],
  },
]
