# Line framing, peel and per-line heal

Source of truth: `meta-line.ts` (`readMetaLine`, `isMetaLine`, `formatErrorLine`, `A2uiMetaEnvelope`),
`genui-line.ts` (`readGenuiLine`, `isGenuiCandidate`, `GENUI_MAX_HTML_BYTES`), `corpus/heal.ts`
(`heal`, `HealResult`), and `produce.ts` (`stripOuterFence`, `peelMetaLine`, `peelGenuiLines`,
`assembleFromRaw`), all under `packages/agent-ui/a2ui/src/`. ADR-0088 section 1 is the channel's
decision; ADR-0061 is the healer's.

## Classification

A reader decides by keys, never by position or content:

- `readMetaLine` returns `undefined` for unparseable JSON, a non-object, any line with a `version`
  key, a line without `a2uiMeta`, or an `a2uiMeta` that is not a plain object.
- `readGenuiLine` returns `undefined` for the same structural failures plus an empty or missing
  `surfaceId`, a non-string `html`, an `html` over `GENUI_MAX_HTML_BYTES`, or a line carrying
  `version` or `a2uiMeta`. `isGenuiCandidate` is the cheap probe that separates "not genui at all"
  (leave the line alone) from "a genui line that failed" (reject it whole, never let it fall
  through to heal, which does not know the kind).
- Everything else goes to `heal()`.

## What is peeled, and where

`produce()` peels BEFORE heal and validate, so a prose note or an HTML payload never costs a
self-correct round.

1. `peelMetaLine` takes the first NON-EMPTY line of the round's raw output (a stray leading blank
   line does not defeat it). If `readMetaLine` rejects it, nothing is peeled and `rest` is the raw
   text unchanged.
2. `peelGenuiLines` pulls every genui-shaped line (`isGenuiCandidate`) out of what remains, from
   any position. Only the FIRST candidate is considered for acceptance; every later one is
   dropped and tallied as multiplicity, valid or not. A first candidate that fails
   `readGenuiLine` is dropped and its failure code (`GENUI_ENVELOPE`, or `GENUI_SIZE` for an
   over-cap `html`) lands on the trace, never fed back as a retry on its own.
3. The remainder goes through `stripOuterFence` (one wrapping markdown fence, ```json or
   ```jsonl), is split on newlines, trimmed, and empty lines are skipped.

The trap that follows: a meta-line anywhere but first is not a meta-line to the peel. It goes
to heal, which adds `version`, and the validator rejects it at SCHEMA. Verified with
`heal('{"a2uiMeta":{"note":"x"}}', {protocolVersion:'v1.0'})`, which returns the object with
`version:"v1.0"` added and repairs `single-object-envelope` and `version-fill`.

## Per-arm meta validation (the drop-alone law)

`readMetaLine` validates each arm independently:

| Field | Malformed means | Effect |
|---|---|---|
| `note` | present and not a string | the WHOLE line is rejected |
| `trace` | present and null or a non-object | the WHOLE line is rejected |
| `error` | not a string | field alone dropped |
| `ask` | not an object, or `surfaceId` not a string | arm alone dropped |
| `plan` | `steps` not an array, or any step missing string `id` or `description` | arm alone dropped |
| `personaPatch` | non-object arm, non-object `values`, `entries` not an object of arrays, or neither member present | the whole arm dropped, never a partial value |
| `team` | any malformed `label`, `tagline` or member | the whole arm dropped, never a partial roster |
| `flowEnd` | anything but literal `true` | arm alone dropped |
| `target` | not an object, or `surfaceId` missing, non-string or empty | arm alone dropped |
| `progress` | `stage` outside `TURN_PROGRESS_STAGES`, non-number `round`, non-string `detail` or `source` | arm alone dropped |

Reason it is built this way: a half-parsed roster or patch is the one shape a host must never be
handed, and a wrong-but-present `target` would animate the wrong card with full apparent
authority (ADR-0206 cl.2). A note-only turn is a success; an arm-free meta-line is legal.

Meta-line kinds by author: the model writes `note`, `ask`, `plan`, `personaPatch`, `flowEnd`,
`team`, `target`; the runtime writes `trace`, `progress`, `error`. What the model-authored arms
mean is `a2ui-payload-authoring`'s `references/meta-line-vocabulary.md`.

## The healer

`heal(input, pin?)` repairs FORM only, from a closed list (ADR-0061; widening it is an amendment,
never an ad-hoc addition):

| Repair id | What |
|---|---|
| `fence-strip` | markdown fence or surrounding prose removed |
| `trailing-comma` | trailing commas removed |
| `single-object-envelope` | a lone object wrapped into an array |
| `version-fill` | an ABSENT per-message `version` filled from `pin.protocolVersion` |

Nothing semantic is ever repaired: unknown components, bad pointers, missing roots and wrong
catalogs flow through unchanged and reject at `validateA2ui`. A WRONG `version` is left alone and
rejects downstream as `VERSION_UNSUPPORTED`. `{ok:false, reason:'unparseable'}` is the only
failure; `produce()` maps it to a `PARSE` self-correct round.

Per-line mode (what `assembleFromRaw` does): each line is healed alone and the results are
flattened. Every call reports `single-object-envelope`, because each line is a lone object. So
`healedCount`, which feeds `TurnTrace.healed`, counts a line only when it had a repair OTHER than
`single-object-envelope`. Counting bare `changed` would saturate the number on every well-formed
turn.

## Stamping the catalog

After heal and before validate, `stampCreateSurfaceCatalogId` overwrites every `createSurface`'s
`catalogId` with the server-selected one (ADR-0169 cl.4), unconditionally and idempotently. A
model that guesses another catalog cannot mis-stamp a surface. Which catalog is selected is
`a2ui-multi-catalog`'s.
