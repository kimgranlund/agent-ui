// seeds.ts — the corpus seed set (corpus LLD-C4, SPEC-R14; content per PRD-G3). 15 concept + 2 demo
// records, authored TS (typed against `../../src/protocol/types.ts`/`../../src/rpc/frame.ts`; the
// STANDING type gate covers this file via `check:tools` [tsconfig.tools.json — folded into `npm run
// check` 2026-07-08, closing the LLD §8.6 gap]; the STANDING drift check for these literals is
// `admitRecord`'s replay arm, re-run over the committed shards by `corpus-data.test.ts` on every
// `npm test`).
// Line/array order below IS authoring order — it becomes the committed shard's line order (LLD §4) and
// therefore the concepts page's teaching order (B5, LLD-C9).
//
// Every wire artifact is grounded in an already-validated repo artifact (the protocol fixtures under
// `src/protocol/fixtures/`, the committed match transcripts under `matches/`) — nothing here is authored
// speculatively (LLD §5). The 11-concept + 2-demo LLD §5 table is records #1-13; #14-17 are the
// coordinator-ruled additions (contextId semantics, transport invariance, turn-taking policy, the canary
// mechanism as its own record) admitted into this same B4 wave with the same standard.
import type { A2aCorpusRecord, A2aWireArtifact } from '../../src/corpus/record.ts'
import type { A2aAgentCard, A2aMessage, A2aTask } from '../../src/protocol/types.ts'
import type { JsonRpcRequestFrame, JsonRpcResponseFrame } from '../../src/rpc/frame.ts'

const ORIGIN = 'tools/corpus/seeds.ts'

function inlineMessage(artifact: A2aMessage): A2aWireArtifact {
  return { kind: 'message', artifact }
}
function inlineTask(artifact: A2aTask): A2aWireArtifact {
  return { kind: 'task', artifact }
}
function inlineCard(artifact: A2aAgentCard): A2aWireArtifact {
  return { kind: 'card', artifact }
}
function inlineRpcRequest(artifact: JsonRpcRequestFrame): A2aWireArtifact {
  return { kind: 'rpc-request', artifact }
}
function inlineRpcResponse(artifact: JsonRpcResponseFrame): A2aWireArtifact {
  return { kind: 'rpc-response', artifact }
}
function transcriptRef(path: string, expect: 'clean' | 'contaminated'): A2aWireArtifact {
  return { kind: 'transcript', path, expect }
}

// The referee card (mirrors `src/protocol/fixtures/card.referee.json`, gate-green there — see
// `protocol/fixtures.test.ts`) — reused by both #6 and #7 below (one fixture, two teaching angles).
const REFEREE_CARD: A2aAgentCard = {
  protocolVersion: '0.3.0',
  name: 'tic-tac-toe-referee',
  description: 'Deterministic referee owning board state, legality, and turn order for the A2A tic-tac-toe arena.',
  url: 'https://example.com/a2a/referee',
  version: '1.0.0',
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ['application/json'],
  defaultOutputModes: ['application/json'],
  skills: [{ id: 'referee', name: 'Referee', description: 'Owns board legality and game end.', tags: ['game', 'referee'] }],
}

export const conceptSeeds: A2aCorpusRecord[] = [
  // 1 — message-parts (mirrors src/protocol/fixtures/message.{text,data,file-uri}.json)
  {
    name: 'message-parts',
    description: 'The A2aMessage shape and its three part kinds — TextPart, DataPart, FilePart.',
    body:
      'Every A2A message carries a required "kind":"message" discriminator (HV-4) plus role, parts[], ' +
      'and messageId; taskId/contextId are optional grouping ids. A part is one of three discriminated ' +
      'kinds: text (a plain string), data (an open JSON object — the arena rides its BoardMessage/MoveMessage ' +
      'payloads here), and file, whose body is EITHER FileWithBytes OR FileWithUri — never both, never ' +
      'neither (upstream types this mutual exclusion via `never`).',
    citations: [{ kind: 'hv', row: 'HV-4' }, { kind: 'hv', row: 'HV-11' }],
    wire: [
      inlineMessage({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hello' }], messageId: 'msg-1' }),
      inlineMessage({
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'data', data: { board: ['X', 'O', 'X', '', 'X', '', '', '', 'O'], mark: 'O', legalMoves: [5, 6, 7] } }],
        messageId: 'msg-2',
        taskId: 'task-1',
        contextId: 'ctx-1',
      }),
      inlineMessage({
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'file', file: { uri: 'https://example.com/report.pdf', mimeType: 'application/pdf' } }],
        messageId: 'msg-4',
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 2 — task-lifecycle
  {
    name: 'task-lifecycle',
    description: 'The full 9-state TaskState set, its 4 sealed terminals, and this family\'s own transition policy.',
    body:
      'Upstream (HV-5) defines the 9 states — submitted, working, input-required, completed, canceled, ' +
      'failed, rejected, auth-required, unknown — and names 4 as terminal ("can\'t be restarted"): ' +
      'completed, canceled, rejected, failed. Upstream does NOT define the full (state x event) transition ' +
      'matrix; the 35-legal/46-illegal-pair policy is this family\'s own, owned and tested by ' +
      '`task-state.ts` — a SPEC requirement realized by an LLD decision, not an upstream fact.',
    citations: [{ kind: 'hv', row: 'HV-5' }, { kind: 'repo', path: 'packages/agent-ui/a2a/src/protocol/task-state.ts' }],
    wire: [
      inlineTask({ kind: 'task', id: 'task-2', contextId: 'ctx-2', status: { state: 'completed', timestamp: '2026-07-07T00:05:00Z' } }),
      inlineTask({ kind: 'task', id: 'task-1', contextId: 'ctx-1', status: { state: 'input-required', timestamp: '2026-07-07T00:00:00Z' } }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 3 — error-mapping
  {
    name: 'error-mapping',
    description: 'The 3-tier outbound JSON-RPC error mapping and the seven A2A-specific error codes.',
    body:
      'A raw JSON.parse failure maps to -32700; a malformed envelope (missing jsonrpc/method/id shape) ' +
      'maps to -32600; a schema-shaped-but-invalid params object maps to -32602 (HV-9). Layered on top, ' +
      'A2A defines seven custom codes in the -32001..-32007 server-error range — TaskNotFound (-32001), ' +
      'TaskNotCancelable (-32002), PushNotificationNotSupported (-32003), UnsupportedOperation (-32004), ' +
      'ContentTypeNotSupported (-32005), InvalidAgentResponse (-32006), AuthenticatedExtendedCardNotConfigured (-32007).',
    citations: [{ kind: 'hv', row: 'HV-9' }, { kind: 'repo', path: 'packages/agent-ui/a2a/src/rpc/errors.ts' }],
    wire: [inlineRpcResponse({ jsonrpc: '2.0', id: 4, error: { code: -32001, message: 'Task not found' } })],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 4 — method-split
  {
    name: 'method-split',
    description: 'Known-but-unsupported (-32004) vs unknown (-32601): the two-method-table honesty rule.',
    body:
      'This family frames/serves exactly three of the verified v0.3.0 JSON-RPC methods (message/send, ' +
      'tasks/get, tasks/cancel, HV-3). A request naming a REAL upstream method this family simply doesn\'t ' +
      'implement (message/stream, tasks/resubscribe, the push-notification-config methods, ...) is ' +
      'classified "known-unsupported" and answered -32004; a request naming something not in the upstream ' +
      'surface at all is "unknown" and answered the standard JSON-RPC -32601 (HV-3/HV-9) — the split keeps ' +
      'the error honest about WHICH gap a caller hit.',
    citations: [{ kind: 'hv', row: 'HV-3' }, { kind: 'hv', row: 'HV-9' }, { kind: 'repo', path: 'packages/agent-ui/a2a/src/rpc/frame.ts' }],
    wire: [
      inlineRpcRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: { message: { kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'e5' }], messageId: 'msg-10', taskId: 'task-1', contextId: 'ctx-1' } },
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 5 — byte-fidelity-codec
  {
    name: 'byte-fidelity-codec',
    description: 'Decode composes the shared validator (a judging decode, never a blind parse); encode is canonical.',
    body:
      'decodeA2a never trusts raw JSON — it parses THEN runs the artifact through the same validateA2a ' +
      'the rest of the family uses, so a caller can never observe a value that "decoded" but wouldn\'t ' +
      'validate. Encode is canonical: fixtures assert encode(decode(raw)) === raw byte-for-byte, the ' +
      'round-trip SPEC-R3 AC1 requires.',
    citations: [{ kind: 'hv', row: 'HV-4' }, { kind: 'repo', path: 'packages/agent-ui/a2a/src/protocol/codec.ts' }],
    wire: [inlineMessage({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'hello' }], messageId: 'msg-1' })],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 6 — agent-card-discovery
  {
    name: 'agent-card-discovery',
    description: 'AgentCard required fields and the well-known discovery path.',
    body:
      'An AgentCard is served at the well-known path `/.well-known/agent-card.json` (renamed from the ' +
      'earlier `agent.json` in v0.3.0, HV-7). Required fields include protocolVersion, name, description, ' +
      'url, version, capabilities, defaultInputModes/defaultOutputModes, and skills[]; a card missing any ' +
      'of these fails validation and is never used for discovery (SPEC-R5).',
    citations: [{ kind: 'hv', row: 'HV-7' }],
    wire: [inlineCard(REFEREE_CARD)],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 7 — version-pin
  {
    name: 'version-pin',
    description: 'Why this family pins protocolVersion 0.3.0 — one major behind v1.0.1, deliberately.',
    body:
      'The stable A2A lineage now runs v1.0.1, one major ahead of the v0.3.0 this family pins. The v1.0 ' +
      'migration renames every JSON-RPC method to PascalCase (matching gRPC) and restructures the error ' +
      'set (HV-1/HV-3/HV-9) — churn, not new capability, for this wave\'s scope. `protocolVersion` (the ' +
      'pin) and a card\'s own `version` field are two DISTINCT required fields (SPEC-R2) — never conflate them.',
    citations: [{ kind: 'hv', row: 'HV-1' }, { kind: 'hv', row: 'HV-3' }, { kind: 'hv', row: 'HV-9' }],
    wire: [inlineCard(REFEREE_CARD)],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 8 — loopback-channel-close
  {
    name: 'loopback-channel-close',
    description: 'The A2aChannel contract and close()\'s drain-and-end semantics.',
    body:
      'A2aChannel.close() is BEHAVIORAL, not a bare teardown (ratified at review, SPEC §6): send() after ' +
      'close() rejects loudly with a typed closed-channel error — never a silent drop — while receive() ' +
      'after close() drains any already-buffered messages IN ORDER, then completes (`done`) with no loss. ' +
      'The in-proc loopback pair is the arena\'s own isolation boundary: message-level only, no side channel.',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/channel/loopback.ts' },
      { kind: 'repo', path: '.claude/docs/spec/a2a-foundations.spec.md' },
    ],
    wire: [inlineMessage({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'move 4' }], messageId: 'arena-2' })],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 9 — referee-star-topology
  {
    name: 'referee-star-topology',
    description: 'The referee-mediated star: the board as the only shared truth, and the closed BoardMessage shape.',
    body:
      'Seats never address each other (PRD-D4 topology) — every message a seat receives originates from ' +
      'the deterministic referee and carries only the closed BoardMessage shape: board cells, the seat\'s ' +
      'own mark, lastOpponentMove, legalMoves, and status. lastOpponentMove is the game-theoretic minimum: ' +
      'enough for a seat to reason about the game, never the opponent\'s reasoning or prose.',
    citations: [
      { kind: 'repo', path: '.claude/docs/lld/a2a-tic-tac-toe.lld.md' },
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/arena/referee.ts' },
    ],
    wire: [
      inlineMessage({
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'data', data: { board: ['X', 'O', 'X', '', 'X', '', '', '', 'O'], yourMark: 'O', lastOpponentMove: 4, legalMoves: [5, 6, 7], status: 'in-progress' } }],
        messageId: 'arena-3',
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 10 — isolation-gate
  {
    name: 'isolation-gate',
    description: 'The four isolation checks, the two leak classes, and why negative controls make the gate proven.',
    body:
      'checkIsolation runs four batched checks over a match transcript: canary absence (a seat\'s planted ' +
      'token must never appear in the other seat\'s context or inbound wire), wire origin (every ' +
      'seat-inbound message must come FROM the referee), closed schema (no extra keys on a referee->seat ' +
      'body, including one level into `feedback`), and provenance (context entries trace to real referee ' +
      'sends). Two leak classes exist — an IN-TRANSCRIPT leak (an extra key/foreign canary baked into the ' +
      'recorded wire) and an OUT-OF-TRANSCRIPT leak (a provider/session mechanism bleeding context outside ' +
      'the recorded messages) — and this family commits a negative-control fixture for EACH class so the ' +
      'gate is proven to bite, never merely asserted clean. See record #17 (canary-mechanism) for how the ' +
      'canary token itself is derived.',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/arena/isolation.ts' },
      { kind: 'repo', path: '.claude/docs/lld/a2a-tic-tac-toe.lld.md' },
    ],
    wire: [
      transcriptRef('packages/agent-ui/a2a/matches/contaminated-control.match.jsonl', 'contaminated'),
      transcriptRef('packages/agent-ui/a2a/matches/contaminated-provider-control.match.jsonl', 'contaminated'),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 11 — recorded-default-posture
  {
    name: 'recorded-default-posture',
    description: 'Recorded-default demos: the static build ships a replayable fixture, zero network/keys.',
    body:
      'The site\'s match page replays a COMMITTED transcript in the static build — zero network calls, ' +
      'zero API keys, byte-stable across every build (the a2ui ADR-0073 posture carried over). A live ' +
      'model-vs-model run is dev-only, gated behind a server-side-key proxy; `vite build` output carries no ' +
      'proxy path or key name (SPEC-N2, manually grepped).',
    citations: [
      { kind: 'repo', path: 'site/pages/a2a-tic-tac-toe.ts' },
      { kind: 'repo', path: 'packages/agent-ui/a2a/tools/arena/dev-proxy-plugin.ts' },
    ],
    wire: [transcriptRef('packages/agent-ui/a2a/matches/scripted.match.jsonl', 'clean')],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 14 — context-id-semantics (coordinator-ruled addition)
  {
    name: 'context-id-semantics',
    description: 'contextId: the server-assigned id that groups related tasks/messages into one conversation.',
    body:
      'contextId is an OPTIONAL, server-generated identifier for logically grouping related tasks (HV-10). ' +
      'For a first message the agent responds with a server-generated contextId (and a taskId if it opens ' +
      'a task); subsequent client messages carry the SAME contextId to continue that conversation, ' +
      'optionally naming a specific taskId to continue one task within it. This family reuses contextId for ' +
      'per-seat context separation on the wire (SPEC-R9/R10) — it groups, it never authorizes cross-seat visibility.',
    citations: [{ kind: 'hv', row: 'HV-10' }],
    wire: [
      inlineMessage({
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'text', text: 'context established' }],
        messageId: 'msg-ctx-1',
        contextId: 'ctx-42',
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 15 — transport-invariance (coordinator-ruled addition)
  {
    name: 'transport-invariance',
    description: 'Switching transports (loopback vs. HTTP) must never change message semantics or ordering.',
    body:
      'The family exposes ONE A2aChannel contract with two implementations: an in-proc loopback ' +
      '(deterministic, zero-network — what CI and the scripted arena use) and a dev/server HTTP transport ' +
      '(Node-scoped, never in a consumer bundle). SPEC-R8/N5\'s transport-invariance requirement: the SAME ' +
      'message sequence sent over either transport decodes to an identical, in-order sequence — a sequence ' +
      'test (`transport-invariance.test.ts`) asserts this directly rather than trusting it by construction.',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/channel/transport-invariance.test.ts' },
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/channel/loopback.ts' },
    ],
    wire: [inlineMessage({ kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'sequence member' }], messageId: 'seq-1' })],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 16 — turn-taking-policy (coordinator-ruled addition)
  {
    name: 'turn-taking-policy',
    description: 'Turn alternation, bounded-retry on an illegal/malformed move, and the forfeit arc.',
    body:
      'The referee alternates turns and never accepts a shared-truth deviation from a seat. An illegal or ' +
      'malformed move produces STRUCTURED feedback to the offending seat (the input-required arm of the ' +
      'task lifecycle, HV-5) with a bounded retry (default 2, SPEC-R11); exhausting the bound forfeits the ' +
      'game to the opponent, and a per-move timeout counts as a malformed move for this same bound. Game ' +
      'end — win, draw, or forfeit — notifies both seats and completes the task(s).',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/arena/referee.ts' },
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/arena/referee.test.ts' },
    ],
    wire: [
      inlineMessage({
        kind: 'message',
        role: 'agent',
        parts: [{
          kind: 'data',
          data: {
            board: ['X', 'O', 'X', '', 'X', '', '', '', 'O'],
            yourMark: 'X',
            legalMoves: [5, 6, 7],
            status: 'in-progress',
            feedback: { code: 'ILLEGAL', detail: 'cell 4 is occupied or out of range', retriesLeft: 1 },
          },
        }],
        messageId: 'arena-4',
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 17 — canary-mechanism (coordinator-ruled addition; cross-references #10 isolation-gate)
  {
    name: 'canary-mechanism',
    description: 'A per-seat unique token, deterministically derived, whose absence from the OTHER seat proves isolation.',
    body:
      'Each seat\'s private context is seeded with a canary — a token of the form ' +
      '"A2A-ISOLATION-CANARY-{mark}-{hex}" — derived DETERMINISTICALLY (FNV-1a over matchId+mark), never ' +
      'crypto-random, so the scripted CI backbone stays byte-stable across repeated runs of the same match ' +
      '(SPEC-N3). A fixed-width-hash collision between X\'s and O\'s canary is checked fail-SAFE at match ' +
      'construction (a collision could only ever produce a false-POSITIVE leak report, never hide a real ' +
      'leak, so the guard throws rather than silently retrying). Bleed-detection is NOT adversarial ' +
      'evasion-resistance: the canary catches an ACCIDENTAL cross-seat mechanism (a shared session object, ' +
      'a copy-paste in the runner), not a seat that has deliberately learned to omit foreign-looking tokens ' +
      '— see record #10 (isolation-gate) for the full four-check gate this token feeds.',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/tools/arena/canary.ts' },
      { kind: 'repo', path: 'packages/agent-ui/a2a/src/arena/isolation.ts' },
    ],
    wire: [
      inlineMessage({
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'data', data: { note: 'canary tokens live only in private seat context, never on the wire' } }],
        messageId: 'canary-note-1',
      }),
    ],
    meta: { facet: 'concept', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },
]

export const demoSeeds: A2aCorpusRecord[] = [
  // 12 — demo-flagship-match
  {
    name: 'demo-flagship-match',
    description: 'The real recorded Sonnet-vs-Haiku match: a full A2A exchange end to end, isolation-gate-green.',
    body:
      'A committed, real model-vs-model match (Claude Sonnet vs. Claude Haiku) — every wire message and ' +
      'each seat\'s complete private context recorded, schema-valid, and isolation-clean (SPEC-R12). This ' +
      'is what a full A2A exchange looks like end to end: task lifecycle, turn-taking, and context ' +
      'isolation all holding simultaneously over a real, non-scripted game.',
    citations: [
      { kind: 'repo', path: 'packages/agent-ui/a2a/matches/flagship.match.jsonl' },
      { kind: 'repo', path: '.claude/docs/lld/a2a-tic-tac-toe.lld.md' },
    ],
    wire: [transcriptRef('packages/agent-ui/a2a/matches/flagship.match.jsonl', 'clean')],
    meta: { facet: 'demo', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },

  // 13 — demo-scripted-backbone
  {
    name: 'demo-scripted-backbone',
    description: 'The deterministic CI backbone: a byte-stable scripted match every gate replays offline.',
    body:
      'A fully scripted (no model, no network) match that every standing gate in this family replays under ' +
      '`npm test` — byte-identical across runs (SPEC-R12 AC1), the backbone the arena\'s determinism claims ' +
      'rest on. It is also this corpus\'s own "expect:clean" reference: the same fixture record ' +
      '#11 (recorded-default-posture) cites for the site\'s zero-network default.',
    citations: [{ kind: 'repo', path: 'packages/agent-ui/a2a/matches/scripted.match.jsonl' }],
    wire: [transcriptRef('packages/agent-ui/a2a/matches/scripted.match.jsonl', 'clean')],
    meta: { facet: 'demo', protocolVersion: '0.3.0', provenance: { source: 'authored', origin: ORIGIN }, status: 'valid' },
  },
]
