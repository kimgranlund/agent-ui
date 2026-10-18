// site/agent-content/seed-history.ts: the committed seed history table (T-0355). Per persona, per PAST seed
// version, the values each store key held as that version's seed. The persona files hold only the current
// seed, so the old values are recovered from git (before T-0160 the presets lived in
// site/pages/agent-admin-presets.ts) and the changelogs. Authored by hand, read only by the generator:
// `scripts/generate-agent-content.mjs` validates it and emits digests (`valueDigest`) as `SEED_DIGESTS` in
// `registry.runtime.gen.ts`, never the values. The migration rule is agent-content spec ACS-R7 item 6.
//
// Authoring rules:
// - A version lists every value a key held as its seed, oldest first: a value changed without a bump gives
//   that version two or more values, and the last is the version's final seed.
// - A value that more than one version seeded is listed under every one of them (no ranges, no carry), so
//   each version's row stands alone.
// - Only scalar store keys (a persona field with a store key that is not an entry list). Entry lists and
//   retired keys are not recorded.
// - `untouchedWins` marks a row whose earlier in-version values also take the new seed, and must cite the
//   ruling that says so (Kim 2026-10-17, T-0355 option C). An unmarked row admits only the final value: an
//   earlier one may be a value a user picked over the later seed, so it is kept and flagged.

export interface SeededValues {
  /** The values this key held as the version's seed, oldest first; the last is its final seed. */
  readonly seeded: readonly unknown[]
  /** The cited ruling (who, date, ticket) under which an earlier in-version value also takes the new seed. */
  readonly untouchedWins?: string
}

export type SeedHistory = Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, SeededValues>>>>>>

export const SEED_HISTORY: SeedHistory = {
  quizmaster: {
    // v1 (TKT-0074, 2026-07-16) seeded the dated Haiku 4.5 id; T-0030 (2026-10-07) moved it to Haiku 5.5
    // without a bump. Versions 2 to 6 moved entry lists only (and T-0185 retired `temperature`).
    '1': {
      model: {
        seeded: ['claude-haiku-4-5-20251001', 'claude-haiku-5-5'],
        untouchedWins: 'Kim 2026-10-17, T-0355 (option C)',
      },
    },
  },
}
