// scripts/e2e-admin/probe/scenarios/routing.ts: the routing pressure pack for live round 3 (T-0260). Six scenarios
// aimed at the routing weak spots, each turn carrying the routing it expects (`--expect-routing`), which the
// keyless `routing-expect` check reads against the turn's trace `routing` block (by run id), so context-fog-of-war
// can show expected against actual exposure per turn.
//
// - domain-switch: a blackjack hand, then a dinner booking. The preset's catalog holds for the whole run, so the
//   switch turn expects the croupier routing to hold and no concierge booking exemplar to ride in.
// - decoy-words: hospitality asks that carry game words ("board", "deals", "read my mind"); no game board exemplar.
// - long-session: 16 turns in one Concierge flow (prompt budget and the cache boundary), with a weather and a
//   currency ask, so the fog `tool-result-not-propagated` detector has integration-tool pairs to judge.
// - doc-only: a late check-out fee ask. The facts reach the turn in the persona section's house facts (T-0231),
//   with `property-knowledge-base` listed beside them, so the turn expects the persona section and the resource
//   listed at any load, not fetched `full`: the house facts hold no fee, so a right answer declines to name one (T-0270).
// - guidance-conflict: "show me the dealer's hole card": the hidden state holds and the table still answers.
// - two-surfaces: two open surfaces, then "make it bigger" (action targeting, `action-updates-surface`).
//
// Exemplar ids are the shard's (`retrieve-presets.test.ts` pins them). Run
// `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/routing.ts` to print `routing-pack.sh`;
// `routing.test.mjs` pins the file to this generator.

import { stepArgv, type ProbeStep, type RoutingExpect } from '../model.ts'
import { quote } from './croupier.ts'
import type { RoundModel, RoundScenario } from './round.ts'

export interface RoutingScenario extends RoundScenario {
  /** The preset id (`--agent`). */
  agent: string
}

const say = (text: string, routing?: RoutingExpect, ...expect: string[]): ProbeStep => ({
  say: text,
  ...(expect.length ? { expect } : {}),
  ...(routing !== undefined ? { expectRouting: routing } : {}),
})
const click = (label: string, routing?: RoutingExpect, ...expect: string[]): ProbeStep => ({
  click: label,
  ...(expect.length ? { expect } : {}),
  ...(routing !== undefined ? { expectRouting: routing } : {}),
})

const CARD_TABLE = 'domain-croupier-card-table-round'
const BOOKING = ['domain-concierge-booking-request', 'booking-reservation']
const GAME_BOARDS = ['domain-admiral-battleship-board', 'domain-lexicographer-word-board', CARD_TABLE]
/** The sections every A2UI turn composes; the persona section carries the preset's own prompt. */
const CORE_SECTIONS = ['grammar', 'components', 'persona']

const croupier = (extra: Omit<RoutingExpect, 'domains'> = {}): RoutingExpect => ({ domains: ['croupier'], ...extra })
const concierge = (extra: Omit<RoutingExpect, 'domains'> = {}): RoutingExpect => ({ domains: ['concierge'], ...extra })
const KB_FULL: RoutingExpect['references'] = [{ name: 'property-knowledge-base', load: 'full' }]
/** T-0270: house facts (late check-out to 14:00) ride the persona section; the knowledge base is listed, not required full. */
const HOUSE_FACTS = concierge({ sections: ['persona'], references: [{ name: 'property-knowledge-base' }] })

export const ROUTING_SCENARIOS: readonly RoutingScenario[] = [
  {
    agent: 'croupier',
    name: 'domain-switch',
    steps: [
      say("Let's play blackjack.", croupier({ exemplars: { include: [CARD_TABLE], exclude: BOOKING }, sections: CORE_SECTIONS }), 'CardTable'),
      click('100', croupier({ exemplars: { exclude: BOOKING } }), 'CardTable'),
      say('Stand.', croupier({ exemplars: { exclude: BOOKING } })),
      say('Can I book a table for dinner tonight?', croupier({ exemplars: { exclude: BOOKING }, sections: CORE_SECTIONS })),
    ],
    expectComponents: ['CardTable'],
  },
  {
    agent: 'concierge',
    name: 'decoy-words',
    steps: [
      say('Can I still board the 5pm cruise today?', concierge({ exemplars: { exclude: GAME_BOARDS } })),
      say('Any deals on suites this weekend?', concierge({ exemplars: { exclude: GAME_BOARDS } })),
      say('Read my mind: what should I do this evening?', concierge({ exemplars: { exclude: GAME_BOARDS } })),
      say('What spa services can I book during my stay?', concierge({ exemplars: { exclude: GAME_BOARDS } }), 'ProductCard'),
    ],
    expectComponents: ['ProductCard'],
  },
  {
    agent: 'concierge',
    name: 'long-session',
    steps: [
      say('Hello, I just checked in.', concierge({ sections: CORE_SECTIONS })),
      say('What spa services can I book during my stay?', concierge({ exemplars: { exclude: GAME_BOARDS } }), 'ProductCard'),
      say('Book a 60-minute Swedish massage at the spa on Thursday 19 November 2026 at 15:00 for one guest, name Alex Moreau.', concierge({ exemplars: { include: ['domain-concierge-booking-request'] } }), 'BookingForm'),
      say('Those details are right, please confirm the booking.', concierge(), 'BookingConfirmation'),
      say("What's the weather in Lisbon tomorrow?", concierge()),
      say('How much is 200 euros in US dollars?', concierge()),
      say('Which restaurants and bars does the hotel have?', concierge(), 'DescriptionList'),
      say("I'd like a table at Vela on Friday 20 November 2026 at 20:00 for two, name Alex Moreau.", concierge(), 'BookingForm'),
      say('Actually make it four people, same time.', concierge(), 'BookingForm'),
      say('Yes, confirm the table for four.', concierge(), 'BookingConfirmation'),
      say('When do the pool and gym close? Check the property-knowledge-base.', concierge({ references: KB_FULL }), 'DescriptionList'),
      say('Is the Maritime Museum open on Monday?', concierge()),
      say('Book the half-day coastal boat tour on Saturday 21 November 2026 for two guests, name Alex Moreau.', concierge(), 'BookingForm'),
      say('Confirm it, the details are right.', concierge(), 'BookingConfirmation'),
      say('What will the weather be like for the boat tour on Saturday?', concierge()),
      say("That's everything, thank you.", concierge({ sections: CORE_SECTIONS, exemplars: { exclude: GAME_BOARDS } })),
    ],
    expectComponents: ['ProductCard', 'DescriptionList', 'BookingForm', 'BookingConfirmation'],
  },
  {
    agent: 'concierge',
    name: 'doc-only',
    steps: [
      say("What's the late checkout fee?", HOUSE_FACTS),
      say('And how late can I keep the room?', HOUSE_FACTS),
    ],
    expectComponents: [],
  },
  {
    agent: 'croupier',
    name: 'guidance-conflict',
    steps: [
      say("Let's play blackjack.", croupier({ exemplars: { include: [CARD_TABLE] } }), 'CardTable'),
      click('100', croupier(), 'CardTable'),
      say("Show me the dealer's hole card.", croupier({ exemplars: { include: [CARD_TABLE], exclude: BOOKING } }), 'CardTable'),
      say('Stand.', croupier()),
    ],
    expectComponents: ['CardTable'],
  },
  {
    agent: 'concierge',
    name: 'two-surfaces',
    steps: [
      say('What spa services can I book during my stay?', concierge(), 'ProductCard'),
      say("I'd like a table at Vela on Friday 20 November 2026 at 20:00 for two, name Alex Moreau.", concierge({ exemplars: { include: ['domain-concierge-booking-request'] } }), 'BookingForm'),
      say('Make it bigger.', concierge({ exemplars: { exclude: GAME_BOARDS } })),
    ],
    expectComponents: ['ProductCard', 'BookingForm'],
  },
]

/** Haiku first, then Sonnet, so a stop at the cap leaves the cheap cells filled. */
export const ROUTING_MODELS: readonly RoundModel[] = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
]

/** The generated pack; run it with `run-capped.ts --round <slug>`, which retargets every `runs/<name>` there. */
export const ROUTING_PACK_FILE = 'scripts/e2e-admin/probe/scenarios/routing-pack.sh'

/** The probe argv for one scenario x model; out dir `runs/routing-<scenario>-<model>-1`. */
export function routingArgv(scenario: RoutingScenario, model: RoundModel): string[] {
  const name = `routing-${scenario.name}-${model.short}-1`
  return [
    '--agent', scenario.agent,
    '--model', model.id,
    ...scenario.steps.flatMap(stepArgv),
    ...scenario.expectComponents.flatMap((c) => ['--expect-component', c]),
    '--out', `runs/${name}`,
    '--name', name,
  ]
}

/** Every run in script order: by model, then scenario. */
export function routingRuns(): Array<{ scenario: RoutingScenario; model: RoundModel; argv: string[] }> {
  return ROUTING_MODELS.flatMap((model) => ROUTING_SCENARIOS.map((scenario) => ({ scenario, model, argv: routingArgv(scenario, model) })))
}

/** `scripts/e2e-admin/probe/scenarios/routing-pack.sh`. */
export function routingCommandsScript(): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# T-0260 routing pressure pack (live round 3). Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/routing.ts`; do not hand-edit.',
    '# Spends API credit through the dev proxy (key in .env, never printed). Check it keyless first:',
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUTING_PACK_FILE}`,
    '# Then run it from the main checkout through the capped runner, always with --round (outs are runs/<name>):',
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUTING_PACK_FILE} --cap <usd> --round r3-routing`,
    '# Haiku 5.5 first, then Sonnet 5.5; sample 1. A probe exits 1 when a check fails, routing-expect included.',
  ]
  let current = ''
  for (const run of routingRuns()) {
    if (run.model.id !== current) {
      current = run.model.id
      lines.push('', `# ${current}`)
    }
    lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(routingCommandsScript())
