// deadlines.ts: T-0023 (GH #1797 gap) — the bounds that cap how long one turn may run, and the one error
// family they throw. The adapter already bounds each wait (first byte, silence between two reads); neither
// bounds a TURN: a stream that keeps emitting events never stalls, and a loop of provider rounds and tool
// rounds restarts every per-wait timer. `withTurnDeadline` is the one absolute clock over all of it.
//
// Platform-neutral on purpose (no `node:*`; the NODE-FENCE leg of `gates.test.ts`): `produce()` and both
// hosts (the dev proxy, the Worker) share this one implementation, the `chat-validation.ts` anti-fork rule.

/** The default whole-turn limit. Generous so it never fires on a healthy turn (a high-effort reply with a
 *  repair round and a tool loop is minutes, not seconds); it exists for the runaway, not the slow. */
export const TURN_DEADLINE_MS = 300_000

/**
 * The family of "a time limit ran out" failures. `message` is the log line (it may name an adapter and a
 * count of milliseconds); `userMessage` is the plain-words text a host may write on the wire's error line
 * VERBATIM: it names no upstream body, key or id, so the GH #144 discipline (never leak provider detail)
 * holds. A retry policy keys on the class: a limit that already ran its full course is never retried.
 */
export class AgentTimeoutError extends Error {
  readonly userMessage: string
  constructor(message: string, userMessage: string) {
    super(message)
    this.name = 'AgentTimeoutError'
    this.userMessage = userMessage
  }
}

/** Thrown by `withTurnDeadline` (and so by `produce()`) when the whole turn ran past its limit. */
export class TurnDeadlineError extends AgentTimeoutError {
  readonly limitMs: number
  constructor(limitMs: number) {
    super(
      `turn exceeded its ${limitMs} ms deadline`,
      `This is taking longer than ${Math.round(limitMs / 1000)} seconds, so I stopped it. Please try again, or ask for something smaller.`,
    )
    this.name = 'TurnDeadlineError'
    this.limitMs = limitMs
  }
}

/**
 * Run `open(signal)` under one absolute deadline and yield what it yields.
 *
 * The signal handed to `open` is the caller's `signal` composed with the deadline, so the abort reaches the
 * provider's fetch, the body reader and every in-flight tool call (`executeTool`'s third argument is that
 * same signal). The deadline also races each `next()`: a source that ignores the signal (a stub, a tool that
 * never settles) is still cut at the limit. After the limit every failure the source throws is relabelled
 * `TurnDeadlineError`, because an abort error there is the deadline's own doing. A caller abort BEFORE the
 * limit keeps its own error untouched.
 *
 * `limitMs <= 0` or non-finite disables the bound (an offline tool that wants none); the source then runs
 * under the caller's signal alone. The timer is cleared however the generator ends, so none outlives a turn.
 */
export async function* withTurnDeadline<T>(
  open: (signal: AbortSignal | undefined) => AsyncIterable<T>,
  signal: AbortSignal | undefined,
  limitMs: number = TURN_DEADLINE_MS,
): AsyncGenerator<T, void, undefined> {
  if (!(limitMs > 0) || !Number.isFinite(limitMs)) {
    yield* open(signal)
    return
  }

  const deadline = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const state: { fired?: TurnDeadlineError } = {} // an object, not a `let`: the timer callback writes it
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new TurnDeadlineError(limitMs)
      state.fired = err
      deadline.abort(err)
      reject(err)
    }, limitMs)
  })
  expired.catch(() => {}) // observed here so a turn that ends first never leaves it unhandled

  const iterator = open(signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal)[Symbol.asyncIterator]()
  try {
    for (;;) {
      const pending = iterator.next()
      pending.catch(() => {}) // if the deadline wins the race below, this one's late rejection is not unhandled
      let step: IteratorResult<T, void>
      try {
        step = await Promise.race([pending, expired])
      } catch (err) {
        throw state.fired ?? err
      }
      if (step.done) return
      yield step.value
    }
  } finally {
    clearTimeout(timer)
    // After the limit the source may still be mid-await on something that ignores the abort, and its
    // `return()` would queue behind that: it is started but not awaited. Otherwise (a normal end, a consumer
    // `break`) the source is idle, so its cleanup is awaited as a plain `for await` would.
    const closing = iterator.return?.()
    if (state.fired) closing?.catch(() => {})
    else await closing
  }
}
