// load.vite.ts: the kit's data under Vite (jsdom legs and the browser shard), as raw files (T-0011). It
// returns names and bytes only and parses nothing: a browser leg applies the browser-safe `parseScenario`
// itself, and a jsdom or Node consumer applies seeded.ts's `parseSeededDoc` (seeded.ts imports the producer
// and is never a browser leg). `load.node.ts` returns the same files from disk for plain Node.

/** One kit data file: its path relative to the kit dir (`scenarios/x.scenario.json`,
 *  `__seeded__/<layer>/x.json`) and its raw bytes. `layer` is set for seeded files. */
export interface KitFile {
  name: string
  layer?: string
  raw: string
}

const scenarioRaw = import.meta.glob('./scenarios/*.scenario.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const seededRaw = import.meta.glob(['./__seeded__/*/*.json', '!./__seeded__/*/pins.json'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const byName = (a: KitFile, b: KitFile): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

export function kitScenarioFiles(): KitFile[] {
  return Object.entries(scenarioRaw).map(([p, raw]) => ({ name: p.slice(2), raw })).sort(byName)
}

export function kitSeededFiles(): KitFile[] {
  return Object.entries(seededRaw)
    .map(([p, raw]) => ({ name: p.slice(2), layer: p.split('/')[2]!, raw }))
    .sort(byName)
}
