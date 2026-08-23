# GenUI B3 judged pack-idiom eval — the operator runbook

GH #1584 · LLD: `.claude/docs/lld/genui-b3-judged-eval.lld.md` · Rubric: `.claude/docs/rubrics/genui-pack-idiom.md`

This is a judged corpus shard measuring PRD-G6 / PRD §8's **m3**: "uses the source — judge-scored ≥ 4/5
against the corpus rubric for demonstrable use of the picked pack's idioms." It mirrors the A2UI corpus's
own discipline (record / verdict archive / standing gate) by **pattern**, as a sibling data dir — never
inside `a2ui/corpus/`, whose gates walk every `.jsonl`/`.json` there as an A2UI shard.

## The key boundary

| Leg | Side | Needs a key? |
|---|---|---|
| `collect` | **KEYLESS** | No — materializes pending records from already-captured genui envelopes |
| `generate` | **NEEDS KEY** | Yes — fresh pack-conditioned GenUI turns through the real producer path |
| `judge` | **NEEDS KEY** | Yes — scores pending records against the rubric with a live model |
| `apply` | **KEYLESS** | No — flips named records to `judged` from an already-authored verdicts file |
| `report` | **KEYLESS** | No — derives `index.json` (the docs page's read contract) + a summary |

`generate`/`judge` read `ANTHROPIC_API_KEY` from `process.env` or a repo-root `.env` (gitignored) — the
SAME reader `packages/agent-ui/a2a/tools/arena/run-flagship.ts` uses. No key found ⇒ exit 2, writing
nothing (never a faked result).

## The no-fabrication law

`records/` and `verdicts/` ship **EMPTY**. No stubbed, sample, or illustrative score ever enters a
record, a verdict file, `index.json`, or the docs page. The standing gate
(`src/corpus-genui/corpus-genui-data.test.ts`) REDS any record carrying a `qualityScore` with no
byte-identical archived verdict behind it. The two committed fixtures under `fixtures/` are calibration
material for the rubric ONLY — never records, never scored, asserted absent from every shard/verdict file.

## Running the eval (Kim's named manual run — never `npm test`/`test:browser`)

```sh
# 1. (optional) turn already-captured genui envelopes into pending records — no key needed
npm run eval:genui-corpus -- collect --from <dir|file> --pack <id> --prompt <id>

# 2. generate fresh pack-conditioned turns through the real producer (needs ANTHROPIC_API_KEY)
npm run eval:genui-corpus -- generate
npm run eval:genui-corpus -- generate --control   # the pack-less baseline arm (recommended first run)

# 3. score every pending record against the rubric (needs ANTHROPIC_API_KEY)
npm run eval:genui-corpus -- judge
npm run eval:genui-corpus -- judge --calibrate     # scores each record twice, reports the per-dim Δ

# 4. apply the verdicts file to the records + archive it verbatim under verdicts/ — no key needed
npm run eval:genui-corpus -- apply --verdicts <path>

# 5. derive index.json (the docs page's input) + a markdown summary — no key needed
npm run eval:genui-corpus -- report
npm run eval:genui-corpus -- report --require-m3   # exit 1 if the m3 floor isn't met
```

Every leg accepts `--dry-run` (compute + print, write nothing) and `--help` lists every leg with its
KEYLESS/NEEDS-KEY tag. Exit codes: `0` every leg green · `1` any red (each listed) · `2` a setup failure
(no key on a key leg, an unknown `--model`, an unreadable rubric/data dir).

## What is never hand-authored

- A `qualityScore`/`passed` value — always either `apply`'s own read of a real `GenuiVerdictsFile`, or
  absent (`status:'pending'`).
- The rubric doc read by `judge` — VERBATIM, one source, never a second hand-copied prompt.
- `index.json` — always `report`'s own derivation; a hand edit is caught by the standing gate's
  byte-identity check.

## What is committed vs. derived vs. never-committed

| Path | What |
|---|---|
| `prompts.json` | Committed — the prompt matrix (`promptSetVersion`, 12 prompts across 3 packs) |
| `fixtures/*.genui.json` | Committed — the two rubric calibration fixtures (never records) |
| `records/v1/*.jsonl` | Written ONLY by `collect`/`generate`/`apply` — ships EMPTY |
| `verdicts/*.json` | Written ONLY by `judge`/`apply` — ships EMPTY |
| `index.json` | Derived — `report`'s own output, committed so the docs page has something to read |
| `runs/` | Gitignored — per-run reports (misses, timings, raw replies for `E_JUDGE_PARSE` post-mortems) |
