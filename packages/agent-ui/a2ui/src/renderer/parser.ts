// parser.ts — JSONL line decoder + fault isolation (renderer LLD-C1, SPEC-R1 AC2 / N4).
//
// The stream's outermost boundary: one line in → one message out, OR a `ParseError` if the line is not
// valid JSON. `parseLine` MUST NOT throw — a single malformed line becomes a `ParseError` the host maps
// to `error{code:"PARSE"}` and the stream continues with the next line (SPEC-R1 AC2, fault isolation N4).
//
// Scope is exactly *syntax*: did the line parse as JSON? Whether the parsed object is a well-formed
// envelope (an unknown top-level key → `error{code:"SCHEMA"}`) is the dispatcher's job (LLD-C2), not the
// parser's — so a successfully parsed line is returned as `A2uiServerMessage` by structural cast, never
// shape-validated here. Line-splitting the raw stream is the transport's job (runtime SPEC §6); this
// module receives one already-delimited line.

import type { A2uiServerMessage } from '../protocol.ts'

/**
 * A line that failed JSON decode (renderer LLD-C1). Returned — never thrown — from `parseLine`, so one
 * bad line cannot escape past the parser and tear down the stream (SPEC-N4). The renderer host (LLD-C13)
 * consumes this and maps it to `error{code:"PARSE", message}` (runtime SPEC §5.2).
 *
 * A class (not a plain object) so the host discriminates it from a parsed message with a bulletproof
 * `instanceof` / `isParseError` check that no JSON-shaped line can ever forge. It is a returned sentinel,
 * not a thrown error, so it deliberately does not extend `Error` (no per-line stack-trace cost).
 */
export class ParseError {
  /** The wire error code this maps to (runtime SPEC §5.2) — fixed, since the class *is* the PARSE case. */
  readonly code = 'PARSE' as const
  /** The JSON-decode failure message (from the thrown `SyntaxError`), for the host's `error` payload. */
  readonly message: string
  /** The offending raw line, so the error is self-describing for diagnostics as it flows downstream. */
  readonly line: string

  // No constructor parameter properties: `erasableSyntaxOnly` bans them (they emit field assignments).
  constructor(message: string, line: string) {
    this.message = message
    this.line = line
  }
}

/** Narrow a `parseLine` result to the failure case (host convenience; equivalent to `instanceof`). */
export function isParseError(result: A2uiServerMessage | ParseError): result is ParseError {
  return result instanceof ParseError
}

/**
 * Decode one JSONL line into a server message, or a `ParseError` on malformed JSON (renderer LLD-C1).
 * Trims first so trailing `\r` (CRLF splits) and surrounding whitespace around the object are tolerated.
 * Total: never throws — a decode failure is *returned*, so the caller continues the stream (SPEC-N4).
 *
 * The returned message is a structural cast: envelope/schema validity is the dispatcher's concern
 * (LLD-C2 → `error{code:"SCHEMA"}`), not the parser's.
 */
export function parseLine(line: string): A2uiServerMessage | ParseError {
  const trimmed = line.trim()
  try {
    return JSON.parse(trimmed) as A2uiServerMessage
  } catch (err) {
    return new ParseError(err instanceof Error ? err.message : String(err), line)
  }
}
