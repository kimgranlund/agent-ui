// produce-to-conversation.ts — ADR-0137 clause 7 / TKT-0072: a minimal, runnable SERVER-SIDE example of a
// consumer wiring its OWN model call through the exported `@agent-ui/a2ui/agent` producer toolkit into a
// validated A2UI JSONL stream — the exact loop TKT-0072's screenshots show broken ("emit real A2UI, not
// markdown box-art"). This is NOT a second dev-proxy: it holds its OWN key in its OWN env and runs where a
// browser cannot (a server), because the producer calls a model and a browser cannot hold a secret
// (ADR-0069). The validated lines it emits are exactly what a browser hands to `ui-conversation` /
// `ui-surface-host`'s `ingestLine()` — see README.md in this folder for the render-side wiring.
//
// Run (from the repo root, with a real key):
//   ANTHROPIC_API_KEY=sk-ant-... node --experimental-strip-types \
//     packages/agent-ui/a2ui/tools/agent-consumer-example/produce-to-conversation.ts "Build me a login form"
//
// It needs a key by design, so it is NOT a standing CI gate (SPEC-R3) — `npm run check` typechecks it
// (check:tools includes `packages/agent-ui/*/tools`), `npm test` never runs it.

// The ENTIRE producer surface a consumer needs — from the ONE real package export. No relative deep-import
// into the package internals; no vendored LLM SDK (the adapter is hand-rolled, plain `fetch`).
import { produce, ProduceHalt, anthropicProvider, readMetaLine } from '@agent-ui/a2ui/agent'
import type { ProduceDeps, ProduceOptions, TurnInput, Session } from '@agent-ui/a2ui/agent'
// The component authority — the same default catalog the renderer validates against (root `.` barrel).
import { defaultCatalog } from '@agent-ui/a2ui'

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit(code: number): never }

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === '') {
    console.error('Set ANTHROPIC_API_KEY in this process’s own env (the consumer’s server-side key boundary).')
    process.exit(1)
  }

  // The three injected surfaces (ProduceDeps):
  //  - provider: the exported hand-rolled Anthropic adapter (bring-your-own-fetch impls satisfy the same
  //    `AgentProvider` seam — see F4). The key is passed IN, never read at module scope.
  //  - retrieve: run EXEMPLAR-LESS here (ADR-0137 clause 5) — the judged corpus shard is not importable, so
  //    `fewShot` degrades to '' by standing contract, and the mini-skill registry (shipped IN the pack)
  //    still delivers the catalog-idiom knowledge. A richer consumer loads its own corpus via
  //    `@agent-ui/a2ui/corpus`'s `createStore` + its own IO and returns real records here.
  //  - catalog: the sole component authority.
  const deps: ProduceDeps = {
    provider: anthropicProvider({ apiKey }),
    retrieve: () => [],
    catalog: defaultCatalog,
  }

  const session: Session = { turns: [] }
  const input: TurnInput = {
    kind: 'intent',
    text: process.argv[2] ?? 'Build me a login form with an email field, a password field, and a submit button.',
    session,
  }
  const opts: ProduceOptions = { maxRounds: 3, model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5' }

  const validatedLines: string[] = []
  try {
    // `produce()` runs the bounded generate → heal+validate → self-correct loop and yields, in order,
    // the leading meta-line (the agent's prose `note`) FIRST, then the FULLY-VALIDATED A2UI JSONL lines
    // (validate-then-stream, SPEC-R5): nothing invalid is ever emitted.
    for await (const line of produce(input, deps, opts)) {
      const meta = readMetaLine(line)
      if (meta !== undefined) {
        if (meta.a2uiMeta.note !== undefined) console.log(`[note] ${meta.a2uiMeta.note}`)
        continue // the meta-line rides BESIDE the payload; never feed it to the renderer.
      }
      validatedLines.push(line)
      // ── In the BROWSER, hand each validated line straight to the render side (no re-validation): ──
      //   host.ingestLine(line)                       // ui-surface-host
      //   conv.beginAgentTurn().ingestLine(line)      // ui-conversation's per-turn AgentTurnHandle
      // Here (server) we just collect them; the transport hands this JSONL to the client.
    }
  } catch (err) {
    if (err instanceof ProduceHalt) {
      // The loop exhausted its round budget without a valid surface — report, never render garbage.
      console.error(`produce halted: ${err.failures.map((f) => f.code).join(', ') || 'unknown'}`)
      process.exit(2)
    }
    throw err
  }

  // The validated A2UI JSONL stream — feedable, line-by-line, to `ingestLine()`.
  console.log(validatedLines.join('\n'))
}

void main()
