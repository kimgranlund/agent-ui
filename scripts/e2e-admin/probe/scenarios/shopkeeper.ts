// scripts/e2e-admin/probe/scenarios/shopkeeper.ts: The Shopkeeper's smoke scenario (T-0343), two turns on its signature
// composite. The `product-grid` skill shows a browse ask as ONE Grid of ProductCard tiles, and `cart-summary` keeps the
// order on THAT SAME surface; each step's `expect` becomes `--expect-turn`. The add step expects ConfirmReceipt: the
// first add opens the order summary as ONE ConfirmReceipt (T-0452), so the turn must ship it. `plan.ts --tag smoke`
// plans it; `plan.test.mjs` checks every expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const SHOPKEEPER_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'browse-and-add',
    tags: ['smoke'],
    steps: [say('What lamps do you have?', 'ProductCard'), say('Add the first one to my order.', 'ConfirmReceipt')],
    expectComponents: ['ProductCard', 'ConfirmReceipt'],
  },
]
