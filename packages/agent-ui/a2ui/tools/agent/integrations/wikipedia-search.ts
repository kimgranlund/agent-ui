// wikipedia-search.ts — LLD-C3 (SPEC-R16): the Wikipedia public-REST search manifest, migrated from the
// retired `integrations.ts` array. Keyless (`auth: 'none'`); returns the top four hits as compact TEXT,
// HTML stripped out of each excerpt. Registers itself on import — the barrel (`index.ts`) is what a host
// imports.

import { registerIntegration } from './registry.ts'
import type { ExecuteContext } from './registry.ts'
import { getJson } from './fetch-json.ts'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

registerIntegration({
  id: 'wikipedia-search',
  version: '1.0.0',
  label: 'Wikipedia search',
  description: 'Search Wikipedia and return the top results with one-line summaries. Keyless.',
  tool: {
    name: 'wikipedia-search',
    description: 'Search Wikipedia for a topic; returns top result titles with short descriptions and extracts.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query' } },
      required: ['query'],
    },
  },
  auth: 'none',
  async execute(input, ctx: ExecuteContext) {
    const query = str(input.query).trim()
    if (query.length === 0) throw new Error('wikipedia-search: `query` is required')
    const data = (await getJson(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=4`,
      ctx.signal,
    )) as { pages?: Array<{ title?: string; description?: string; excerpt?: string }> }
    const pages = data.pages ?? []
    if (pages.length === 0) return `No Wikipedia results for "${query}".`
    return pages
      .map((p) => `${p.title}${p.description ? ` — ${p.description}` : ''}${p.excerpt ? ` (${p.excerpt.replace(/<[^>]+>/g, '')})` : ''}`)
      .join('\n')
  },
})
