// currency.ts — LLD-C3 (SPEC-R16): the Frankfurter (ECB reference rates) manifest, migrated from the
// retired `integrations.ts` array. Keyless (`auth: 'none'`); converts an amount between two ISO 4217
// codes and returns compact TEXT. Its hand-rolled input guard stays exactly as shipped — after LLD-C4 the
// shared dispatch validates first, making this guard defense-in-depth rather than the only line
// (ADR-0168 cl.3). Registers itself on import — the barrel (`index.ts`) is what a host imports.

import { registerIntegration } from './registry.ts'
import type { ExecuteContext } from './registry.ts'
import { getJson } from './fetch-json.ts'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

registerIntegration({
  id: 'currency',
  version: '1.0.0',
  label: 'Currency rates (Frankfurter)',
  description: 'Convert an amount between currencies at the latest ECB reference rates. Keyless.',
  tool: {
    name: 'currency',
    description: 'Convert an amount from one currency to another using latest ECB reference rates.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'The amount to convert' },
        from: { type: 'string', description: 'ISO 4217 code, e.g. "EUR"' },
        to: { type: 'string', description: 'ISO 4217 code, e.g. "USD"' },
      },
      required: ['amount', 'from', 'to'],
    },
  },
  auth: 'none',
  async execute(input, ctx: ExecuteContext) {
    const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : NaN
    const from = str(input.from).toUpperCase()
    const to = str(input.to).toUpperCase()
    if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
      throw new Error('currency: needs numeric `amount` + 3-letter `from`/`to` codes')
    }
    const data = (await getJson(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
      ctx.signal,
    )) as { rates?: Record<string, number>; date?: string }
    const rate = data.rates?.[to]
    if (typeof rate !== 'number') throw new Error(`currency: no rate ${from}→${to}`)
    return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to} (rate ${rate}, ECB reference ${data.date ?? 'latest'}).`
  },
})
