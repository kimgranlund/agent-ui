// site/agent-content/seed-history.ts: the committed seed history table (T-0355). Per persona, per PAST seed
// version, the store values that version seeded where they differ from a later one. The persona files only
// hold the current seed and git holds no history before T-0160, so a value lands here when a bump moves it
// (or when an old value is recovered from a changelog). Authored by hand, read only by the generator:
// `scripts/generate-agent-content.mjs` validates it and emits each value's digest (`valueDigest`) as
// `SEED_DIGESTS` in `registry.runtime.gen.ts`, never the value. A browser holding a pre-overlay copy saved at
// one of these versions takes the new seed where its stored value's digest equals the old seed's, and keeps
// every other differing value as a user edit, flagged `seedChanged` (agent-content spec ACS-R7).
//
// Shape: persona id, then version (below the persona's current one), then store key (a persona field with a
// store key) to the value that version seeded. Entry lists are not recorded yet.

export type SeedHistory = Readonly<Record<string, Readonly<Record<number, Readonly<Record<string, unknown>>>>>>

export const SEED_HISTORY: SeedHistory = {
  quizmaster: {
    // The v2 changelog line: T-0030 moved the model to claude-haiku-5-5 without a bump; v1 seeded Haiku 4.5.
    1: { model: 'claude-haiku-4-5' },
  },
}
