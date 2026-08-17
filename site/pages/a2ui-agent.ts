// a2ui-agent.ts — the A2UI AGENT/PRODUCER guide (GH #1048): how to drive a model into reliably EMITTING
// real A2UI wire messages, using the exported `@agent-ui/a2ui/agent` toolkit (ADR-0137, TKT-0072). Where
// a2ui-authoring.ts is written for someone EXTENDING @agent-ui/a2ui (authoring a catalog row or training
// data), this page is written for someone CONSUMING it — a server-side app that wants its own agent to
// emit real A2UI instead of describing a UI in markdown box-art. Distinct audience, distinct page (the
// site-authoring page-shape rule — see the Findings comment on GH #1048 for the fuller reasoning).
//
// Every interface/signature block below is SLICED, verbatim, out of the real `src/agent/*.ts` source at
// build time (`?raw` imports + a marker-bounded extractor that THROWS if its marker moved — a real
// build-time drift gate, not a best-effort scrape) — the extractInterface/extractSignature idiom
// a2ui-authoring.ts already established (its own header: "duplicated rather than shared — used on
// exactly two pages"). This page is the THIRD use of that idiom; still duplicated rather than hoisted,
// named here so the "exactly two" comment over there is read as descriptive-at-the-time, not current
// (flagged as soft drift on GH #1048's Findings, not silently fixed on a page outside this dispatch's
// slice). The package.json exports map (Part D) is imported and JSON.parsed the same way — real data,
// not a hand-typed copy. Part E is the literal, checked-in consumer example
// (`tools/agent-consumer-example/produce-to-conversation.ts`, ADR-0137 clause 7) shown verbatim — shown
// ≡ shipped, exactly the a2ui-authoring.ts law applied to a runnable script instead of a catalog row.

import { mountPage, pageLead } from './_page.ts' // FIRST import — foundation CSS cascade + ui-* controls (ADR-0003)
import { codeBlock } from '../lib/code-block.ts'
import agentTransportRaw from '../../packages/agent-ui/a2ui/src/agent/agent-transport.ts?raw'
import produceRaw from '../../packages/agent-ui/a2ui/src/agent/produce.ts?raw'
import systemPromptRaw from '../../packages/agent-ui/a2ui/src/agent/system-prompt.ts?raw'
import metaLineRaw from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts?raw'
import a2uiPackageRaw from '../../packages/agent-ui/a2ui/package.json?raw'
import consumerExampleRaw from '../../packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts?raw'

const { content } = mountPage({ title: 'A2UI agent guide' })
content.append(
  pageLead(
    'The RENDER half of "an agent emits real A2UI in chat" ships as `ui-surface-host`/`ui-conversation` — ' +
      'transport-agnostic, it takes whatever validated JSONL you feed it. This page is the PRODUCER half: ' +
      'the exported `@agent-ui/a2ui/agent` subpath (ADR-0137) — the drift-gated, catalog-grounded prompt, ' +
      'the bounded self-correct loop, and the transport seam a consumer app wires its own model call ' +
      'through. Every block below is sliced live from the shipped source — if this page and the code ' +
      'disagree, the page is stale and its derivation is the bug.',
  ),
)

// ── tiny local helpers (the a2ui-authoring.ts precedent, duplicated per-page rather than shared) ────────
function h(level: 2 | 3, text: string, id?: string): HTMLElement {
  const el = document.createElement(`h${level}`)
  el.textContent = text
  if (id) el.id = id
  return el
}
function p(text: string): HTMLElement {
  const el = document.createElement('p')
  el.textContent = text
  return el
}

// ── source-extraction helpers (a2ui-authoring.ts's extractInterface/extractSignature, duplicated) ───────
function extractInterface(source: string, name: string): string {
  const marker = `export interface ${name} {`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`a2ui-agent: interface "${name}" not found — renamed or removed?`)
  let depth = 0
  let i = start
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(start, i)
}
function extractSignature(source: string, marker: string): string {
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`a2ui-agent: signature "${marker}" not found — renamed or removed?`)
  const bodyStart = source.indexOf('{', start)
  return source.slice(start, bodyStart).trim()
}
/** A `export type <name> = …` alias's body — read up to the first BLANK line after the marker (this
 *  codebase's own convention: every exported symbol is blank-line-separated — verified against every
 *  target this page slices). Throws (a real drift gate) if the marker moved. */
function extractTypeAlias(source: string, name: string): string {
  const marker = `export type ${name} =`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`a2ui-agent: type alias "${name}" not found — renamed or removed?`)
  const blank = source.indexOf('\n\n', start)
  return source.slice(start, blank === -1 ? source.length : blank).trim()
}

// ── PART A — the transport seam ────────────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part A — the transport seam'),
  p(
    '`AgentTransport` is the ONE interface a consuming page/app binds to: one agent turn in, an ordered ' +
      'stream of A2UI JSONL lines out. Zero-dep. Where the stream originates — a real model call, a ' +
      'recorded backbone, a dev-only proxy — lives entirely behind it; swapping one for another is a ' +
      'single construction-site edit.',
  ),
  h(3, 'AgentTransport — derived from source', 'a2ui-agent-transport'),
  codeBlock(extractInterface(agentTransportRaw, 'AgentTransport'), 'ts'),
  p(
    '`Session` is the ordered turn history the BROWSER holds (the proxy/server is stateless) — every ' +
      'caller passes it in and gets a new one back, never a mutation.',
  ),
  codeBlock(extractInterface(agentTransportRaw, 'Session'), 'ts'),
  p(
    '`TurnInput` frames what is being sent this turn: a raw user `intent` (turn 1), or a `client` message ' +
      '— an `action`/`functionResponse`/`error` bubbled up from the rendered surface, or a GenUI bridge ' +
      'action — that a pure reducer (`nextTurn`, `session.ts`) turns into the next turn automatically ' +
      '("the agent continues").',
  ),
  codeBlock(extractTypeAlias(agentTransportRaw, 'TurnInput'), 'ts'),
  p(
    'The producer calls a model, so it needs an API key — and a browser cannot hold a secret (ADR-0069). ' +
      'The pack is therefore NODE-FIRST by construction (ADR-0137 clause 4): `buildSystemPrompt` and the ' +
      'mini-skill registry read their prompt files off disk at load. A browser-side consumer imports only ' +
      'the pure, zero-dep seam types — `./agent/meta-line` (Part D) is exactly that subpath, carved out so ' +
      'a renderer-side page can type its progress/plan/ask UI without pulling in a byte of Node-bound ' +
      'producer code.',
  ),
)

// ── PART B — the loop ──────────────────────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part B — produce(): the bounded self-correct loop'),
  p(
    'retrieve exemplars → build the catalog-derived prompt → generate via the injected `AgentProvider` → ' +
      'heal + validate the emitted A2UI text (the SAME shared validator the renderer runs, SPEC-N3) → on ' +
      'failure, feed the validator’s structured failures back and retry → bounded at `maxRounds` → ' +
      'VALIDATE-THEN-STREAM: yield only a FULLY validated payload’s JSONL lines (SPEC-R5) → halt-and-report ' +
      'at the bound, emitting NOTHING invalid (`ProduceHalt`). The three injected surfaces:',
  ),
  codeBlock(extractInterface(produceRaw, 'ProduceDeps'), 'ts'),
  h(3, 'produce() — derived from source', 'a2ui-agent-produce'),
  codeBlock(extractSignature(produceRaw, 'export async function* produce('), 'ts'),
  p(
    'It yields, in order: a leading meta-line (Part D — the agent’s prose `note`, if the model opts into ' +
      'the convention), then only fully-validated A2UI JSONL lines. A consumer feeds those straight to ' +
      '`ui-surface-host`/`ui-conversation`’s `ingestLine()` — no re-validation, exactly what Part E shows.',
  ),
)

// ── PART C — buildSystemPrompt() ───────────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part C — buildSystemPrompt(): the catalog-grounded prompt'),
  p(
    'The drift-gated prompt that teaches a model this fleet’s vocabulary: the grammar, the Gen-UI `mode` ' +
      'disposition, the derived `## Available components` inventory (built straight off the `Catalog` ' +
      'you pass — the SAME authority the renderer validates against), few-shot exemplars from the judged ' +
      'corpus shard, and the mini-skill composition idioms. `produce()` calls it once per turn, outside the ' +
      'round loop.',
  ),
  h(3, 'buildSystemPrompt() — derived from source', 'a2ui-agent-prompt'),
  codeBlock(extractSignature(systemPromptRaw, 'export function buildSystemPrompt('), 'ts'),
)

// ── PART D — the meta-line channel ─────────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part D — the meta-line channel'),
  p(
    'A reserved JSON line, emitted FIRST on the stream, ahead of any A2UI JSONL — carrying no `version` ' +
      'key, so it is provably NOT an `A2uiServerMessage` (every real server message carries `version`). ' +
      '`produce()` peels it off before heal/validate; it never reaches the shared validator and never ' +
      'enters the corpus path.',
  ),
  h(3, 'A2uiMetaEnvelope — derived from source', 'a2ui-agent-meta-envelope'),
  codeBlock(extractInterface(metaLineRaw, 'A2uiMetaEnvelope'), 'ts'),
  codeBlock(extractSignature(metaLineRaw, 'export function readMetaLine('), 'ts'),
  p(
    '`note` is the model’s prose reply; `ask` (ADR-0097) routes a feed-embedded interactive surface; ' +
      '`plan` (ADR-0174) is the model’s own declared step list; `personaPatch` (ADR-0178) is an authoring ' +
      'turn’s persona-state delta; `trace` is the runtime-assembled per-turn decision record; `progress` ' +
      '(ADR-0146, opt-in via `ProduceOptions.progress`) INTERLEAVES live-turn lifecycle events — `sent` / ' +
      '`started` / `reasoning` / `content` / `validating` / `retry` / `tool` / `done` — strictly ahead of ' +
      'any content line. Every field is shallow-validated independently: a malformed one drops only ' +
      'itself, never the whole envelope.',
  ),
)

// ── PART E — two browser-safe subpaths ─────────────────────────────────────────────────────────────────
const a2uiPackage = JSON.parse(a2uiPackageRaw) as { exports: Record<string, string> }
content.append(
  h(2, 'Part E — the package’s exports map'),
  p(
    'The root `.` barrel re-exports NONE of this — a renderer-only consumer bundles zero producer bytes ' +
      '(the identity gate, ADR-0137 clause 8). `./agent` is the full, Node-first producer toolkit (Parts ' +
      'A–D). `./agent/meta-line` and `./agent/genui-line` are separate, additionally-exported subpaths: ' +
      'both modules are pure, zero-import TypeScript (no `node:fs`, no producer code) — so a BROWSER page ' +
      'that only needs the `TurnProgress`/`PlanDeclaration`/`AskDeclaration`/`GenuiEnvelope` wire TYPES ' +
      '(to type its own progress/plan UI, e.g. `ui-conversation`’s own turn handle) imports one of these ' +
      'two subpaths directly, never the whole Node-first `./agent` barrel.',
  ),
  codeBlock(JSON.stringify(a2uiPackage.exports, null, 2), 'json'),
)

// ── PART F — the worked example ────────────────────────────────────────────────────────────────────────
content.append(
  h(2, 'Part F — a runnable consumer example'),
  p(
    'ADR-0137 clause 7’s consumer example, shown verbatim (shown ≡ shipped — this is the literal, ' +
      'checked-in, `npm run check`-typechecked script at ' +
      '`packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts`; `npm test` never ' +
      'runs it, since it needs a real API key by design). It holds its OWN key in its OWN env — this is ' +
      'NOT a second dev-proxy (that key-holding shell stays site-internal, ADR-0137 clause 3) — and wires ' +
      '`produce()`’s output straight at the render side, exactly as a browser would hand each validated ' +
      'line to `ingestLine()`.',
  ),
  codeBlock(consumerExampleRaw.trimEnd(), 'ts'),
)

// ── Sources ─────────────────────────────────────────────────────────────────────────────────────────────
content.append(
  h(3, 'Sources'),
  p(
    'ADR-0137 (the `./agent` export — the portable core, the Node-first pack, the identity/SDK-free/ ' +
      'Node-fence gates, the clause-7 consumer example) · ADR-0069 (the layered demo + key-never-in-a-' +
      'browser posture) · ADR-0073 (the `AgentProvider` seam) · ADR-0088 (the meta-line envelope + ' +
      '`note`/`trace`) · ADR-0097 (feed-embedded `ask`) · ADR-0146 (live-turn `progress`) · ADR-0174 (the ' +
      '`plan` declaration) · ADR-0178 (`personaPatch`) · TKT-0072 (the owning ticket). The derived blocks ' +
      'above import the live `src/agent/*.ts` source, the real `package.json`, and the real checked-in ' +
      'consumer example — if this page and the code disagree, the page is stale and its derivation is the bug.',
  ),
)
