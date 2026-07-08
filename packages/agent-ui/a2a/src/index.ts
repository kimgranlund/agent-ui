// @agent-ui/a2a — package barrel (LLD-C11, S8-owned: this file is edited ONLY in the S8 integration
// slice — one writer, per the fan-out doctrine). Re-exports the zero-dep consumer surface only; `tools/`
// (dev/Node transports, well-known serving) is never reachable from here (SPEC-N1/N2) — the S7
// consumer-surface grep over this barrel's transitive import graph asserts `tools/` is absent.

// protocol/ (LLD-C1/C2/C3/C4) — the typed wire model, byte-fidelity codec, total validator, task lifecycle.
export * from './protocol/types.ts'
export * from './protocol/codec.ts'
export * from './protocol/validate.ts'
export * from './protocol/task-state.ts'

// rpc/ (LLD-C5/C6) — the error-code table + JSON-RPC framing/correlation.
export * from './rpc/errors.ts'
export * from './rpc/frame.ts'

// channel/ (LLD-C7) — the A2aChannel contract + in-proc loopback pair (the arena's isolation boundary).
export * from './channel/loopback.ts'

// arena/ (LLD-C1..C4) — the tic-tac-toe arena's PURE, zero-dep surface (board, referee reducer, transcript
// schema/validator, isolation checker). Exported here (LLD-C11, §6) so the site demo page can run the SAME
// `checkIsolation`/`validateTranscript` over a loaded match transcript IN-BROWSER (SPEC-R13) — never a
// forked/reimplemented checker. Still zero-dep: `tools/arena/*` (the Node-only seats/runner/proxy) stays
// unreachable from this barrel (SPEC-N1/N2), same posture as the protocol/rpc/channel exports above.
export * from './arena/board.ts'
export * from './arena/referee.ts'
export * from './arena/transcript.ts'
export * from './arena/isolation.ts'

// corpus/ (corpus LLD-C1/C2, SPEC-R14) — the record model/validator + the pure shard store (parse ·
// canonical serialize · paths · the admitted-records consumption filter). Exported here (B5, LLD-C9) so
// the site concepts page can parse/consume the SAME committed shards with the SAME zero-dep functions the
// import tool and the standing gate use — never a forked reader. `admit.ts` is deliberately NOT exported
// here (only the import tool and the standing gate call it, LLD §8.3 "S8-owned single writer" — the corpus
// mirror of this same barrel's own rule for `tools/`).
export * from './corpus/record.ts'
export * from './corpus/shard.ts'
