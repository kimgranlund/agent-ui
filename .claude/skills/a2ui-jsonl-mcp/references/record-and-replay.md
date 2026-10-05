# Recording and replaying turns

Two families, easy to confuse. Pick by what must survive the round trip.

## The a2ui recorded transport (a committed demo script)

Source: `recorded-transport.ts` (`createRecordedTransport`, `RecordedTranscript`, `RecordedTurn`)
in `packages/agent-ui/a2ui/src/agent/`, with the committed script in
`packages/agent-ui/a2ui/tools/agent/transcript.ts` (`recordedTranscript`).

A `RecordedTranscript` is `{intent, turns}`; a `RecordedTurn` is `{lines, note?, ask?, plan?,
progress?, expectClientMessage?}`. `createRecordedTransport(transcript)` ignores its input and
advances one turn per `turn()` call, yielding in this order: each `progress` entry as its own
meta-line, then one leading meta-line, then `lines`. When the turns run out it yields nothing.

Limits, each a real constraint on what a recording can claim:

- Only `note`, `ask`, `plan` and `progress` are re-emitted. `personaPatch`, `flowEnd`, `team` and
  `target` have no field on `RecordedTurn`, so a recording cannot carry them.
- The leading meta-line is built only when `note` is defined. An `ask` or `plan` on a note-less
  turn is not emitted.
- `lines` hold protocol lines only. They are replayed verbatim with no heal or validation, so a
  committed transcript is gated elsewhere (its tests), not by the transport.

Use it for the keyless, networkless demo and the deterministic backbone of a UI test.

## The devtools capture family (a recorded real turn)

Source: `packages/agent-ui/devtools/src/` : `timeline/events.ts` (`recordTurn`, `DevtoolsEvent`),
`capture/format.ts` (`DevtoolsCapture`, `serializeCapture`, `parseCapture`, `CaptureParseError`),
`transports/replay.ts` (`scriptTransport`, `capturedLineTimelines`, `replayTransport`,
`TRANSCRIPT_EXHAUSTED_MESSAGE`). ADR-0200.

- `recordTurn` wraps any `AgentTransport` and yields an event timeline. A line that `readMetaLine`
  accepts becomes a `meta` event; every other line becomes a `line` event. Ordering is a sequence
  number, never the wall clock. Event kinds: `turn-start`, `line`, `meta`, `client`, `render`,
  `turn-end`, `error`. A `turn-end` event carries an optional `usage` (provider-billed token counts
  latched from the meta trace's `trace.usage`, ADR-0234); the capture version stays 1.
- A capture is a versioned, parse-checked artifact (`DEVTOOLS_CAPTURE_KIND`,
  `DEVTOOLS_CAPTURE_VERSION`); `parseCapture` throws a typed `CaptureParseError`.
- `capturedLineTimelines(capture)` extracts only the `line` events, per turn.
  `replayTransport(capture)` and `scriptTransport(timelines)` replay those. Meta events are NOT
  replayed. A replay of a captured real turn therefore has no leading meta-line unless a caller
  re-composes one.
- Replay has zero I/O, zero timers, zero randomness: lines yield on the microtask queue only, so
  playback is byte-identical and swapping replay for a live transport is a one-construction-site
  edit (the unchanged `AgentTransport` seam, ADR-0137).
- Past the last scripted turn, `turn()` yields exactly one terminal error meta-line,
  `formatErrorLine(TRANSCRIPT_EXHAUSTED_MESSAGE)`: never a hang, never a throw.

## Choosing

| Need | Use |
|---|---|
| Keyless demo, or a UI test that wants a note and an ask | `createRecordedTransport` |
| Reproduce a real captured turn, line for line, in CI | devtools `replayTransport` |
| A turn that must carry `target`, `flowEnd`, `team` or `personaPatch` | neither carries them; feed the line directly to the consumer, or extend `RecordedTurn` (a build task, `a2ui-build`) |

The devtools package is a leaf: nothing imports it, and no key, provider or `produce()` ever
enters it (ADR-0200, the ADR-0073 trust boundary stays at `/__a2ui/agent`).
