// validate-payload.ts — the compose→verify loop's deterministic instrument (harness LLD-C6, SPEC-R6).
//
// Composes the pure core's `heal` + `validateA2ui` against the default catalog and prints the ONE
// verdict shape either side of the loop reads (harness LLD §6):
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts \
//     <payload.json> [--catalog agent-ui]
//   # exit 0 → {ok:true, repairs:[…]}   (heal applied first — ADR-0061's closed list; repairs named)
//   # exit 1 → [{code, path, message}]  (the shared validator's verdicts, unforked)
//
// `heal` and `validateA2ui` are read via RELATIVE imports of the platform-neutral pure core
// (`src/corpus/heal.ts`, `src/corpus/validate.ts` — itself a thin re-export of the renderer's shared
// `validate.ts`, ADR-0062: the core computes, this Node shell only does IO). The payload's raw file
// TEXT is handed to `heal` unparsed — heal's own text arms (fence-strip / trailing-comma) are the
// first line of defense against exactly the markdown-wrapped, comma-sloppy output an LLM composer
// emits; a caller with an already-structured `A2uiOutput` still heals cleanly (arms (a)/(b) are no-ops
// on valid JSON text). The catalog's own `protocolVersion` is passed as heal's pin (arm (d): fills an
// ABSENT per-message `version`, never corrects a present-but-wrong one — that stays tier-1's job).
//
// Catalog loading mirrors `tools/corpus/import-seeds.ts`'s `loadDefaultCatalog` exactly: Node's native
// ESM loader rejects an attribute-less JSON import (`ERR_IMPORT_ATTRIBUTE_MISSING`, hit running this
// script under `--experimental-strip-types`), so this Node-side script reads `catalog.json` via `fs`
// and feeds it through the SAME exported `loadCatalog()` — byte-identical to `defaultCatalog`, just
// assembled without an ES-module JSON import in the way.
//
// Zero new deps (SPEC-N5). Plain `.ts`, run via Node type-stripping (`erasableSyntaxOnly` guarantees
// it strips cleanly, ADR-0062).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { heal } from '../../src/corpus/heal.ts'
import { validateA2ui } from '../../src/corpus/validate.ts'
import { loadCatalog } from '../../src/catalog/catalog.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { Failure } from '../../src/protocol.ts'

declare const process: { argv: string[]; cwd(): string; exit(code?: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

interface Args {
  payloadPath: string
  catalogId: string
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)
  let payloadPath: string | undefined
  let catalogId = 'agent-ui'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--catalog') {
      catalogId = args[i + 1] ?? catalogId
      i++
    } else if (payloadPath === undefined) {
      payloadPath = args[i]
    }
  }

  if (payloadPath === undefined) {
    console.error('usage: validate-payload.ts <payload.json> [--catalog <id>]')
    process.exit(1)
  }
  return { payloadPath, catalogId }
}

/** See `tools/corpus/import-seeds.ts`'s `loadDefaultCatalog` — same workaround, same reason
 * (`ERR_IMPORT_ATTRIBUTE_MISSING` under Node's native ESM loader), byte-identical to `defaultCatalog`. */
function loadDefaultCatalog(repoRoot: string): Catalog {
  const path = join(repoRoot, 'packages/agent-ui/a2ui/src/catalog/default/catalog.json')
  const doc: unknown = JSON.parse(readFileSync(path, 'utf8') as string)
  return loadCatalog(doc)
}

// Human-readable text for the shared validator's `Failure.code` (the wire codes carry no `message`
// field themselves — renderer/validate.ts's own header comment documents this stage→code table; this
// is that table transcribed, not a reinterpretation of it).
const FAILURE_DESCRIPTIONS: Record<Failure['code'], string> = {
  PARSE: 'the payload text is not parseable JSON',
  SCHEMA: 'message shape is invalid — a bad envelope, or a missing/extra/mistyped field',
  VERSION_UNSUPPORTED: 'the message version is not in the pinned SUPPORTED_VERSIONS set',
  CATALOG: 'a component or property does not conform to the catalog (unknown type, unknown property, or a type mismatch)',
  CATALOG_UNKNOWN: 'an unknown component type was referenced',
  IDGRAPH: 'the component graph is invalid — a missing/duplicate root, a dangling child reference, or a cycle',
  POINTER: 'a bound path is not a syntactically valid JSON Pointer',
  FUNCTION: 'a render-time function-binding failure (never emitted by the static validator)',
}

function toPrintable(f: Failure): { code: Failure['code']; path: string; message: string } {
  return { code: f.code, path: f.path, message: FAILURE_DESCRIPTIONS[f.code] }
}

function main(): void {
  const { payloadPath, catalogId } = parseArgs(process.argv)
  const repoRoot = process.cwd()
  const catalog = loadDefaultCatalog(repoRoot)

  if (catalogId !== catalog.catalogId) {
    console.error(`validate-payload: unknown catalog "${catalogId}" — only "${catalog.catalogId}" is loadable today`)
    process.exit(1)
  }

  const text = readFileSync(payloadPath, 'utf8') as string
  const healed = heal(text, { protocolVersion: catalog.protocolVersion })

  if (!healed.ok) {
    console.log(JSON.stringify([toPrintable({ code: 'PARSE', path: '' })], null, 2))
    process.exit(1)
  }

  const verdict = validateA2ui(healed.messages, catalog)
  if (!verdict.valid) {
    console.log(JSON.stringify(verdict.failures.map(toPrintable), null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, repairs: healed.repairs }, null, 2))
}

main()
