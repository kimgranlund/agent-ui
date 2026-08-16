// core/types.ts — the ONE streaming contract's TYPE, cited by both core and `./stream` (SPEC-R12).
// A type-only alias carries zero runtime bytes: `.` can expose `Streamed<T>` without importing any
// `./stream` module (SPEC-R1 AC3's tree-shake gate). `./stream/bridge.ts` imports this same type so
// core and stream share one definition without either barrel crossing into the other's subpath.

/** `Streamed<T> = AsyncIterable<T>` — the one streaming contract (SPEC-R12; cites `AgentTransport.turn()`, ADR-0137). */
export type Streamed<T> = AsyncIterable<T>
