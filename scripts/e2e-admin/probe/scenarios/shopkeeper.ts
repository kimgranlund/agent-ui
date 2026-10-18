// scripts/e2e-admin/probe/scenarios/shopkeeper.ts: The Shopkeeper's smoke scenario (T-0343), two turns on its signature
// composite. The `product-grid` skill shows a browse ask as ONE Grid of ProductCard tiles, and `cart-summary` keeps the
// order on THAT SAME surface; each step's `expect` becomes `--expect-turn`. The add step expects ProductCard too: the
// order summary belongs on the storefront surface, so the turn must update the surface that holds the tiles. `plan.ts
// --tag smoke` plans it; `plan.test.mjs` checks every expected type is in the preset's catalog.

import { say } from '../model.ts'
import type { RoundScenario } from './round.ts'


export const SHOPKEEPER_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'browse-and-add',
    tags: ['smoke'],
    steps: [say('What lamps do you have?', 'ProductCard'), say('Add the first one to my order.', 'ProductCard')],
    expectComponents: ['ProductCard'],
  },
]
