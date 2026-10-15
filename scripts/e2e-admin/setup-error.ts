// SetupError lives on its own so browser-free modules (probe/trace.ts, loaded by jsdom tests) can throw it
// without importing runner.ts, whose module scope resolves file URLs.

/** A usage or setup problem: the run exits 2. */
export class SetupError extends Error {
  override name = 'SetupError'
}
