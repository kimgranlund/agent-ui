# ADR-0217 — Price/Money: locale-correct currency lands as a default-catalog `formatCurrency` function, not a new type and not row widening

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader (design seat — GH #1373, the classic-widget decision lane #1372/#1373/#1375; ADR number host-assigned) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0217` utterance](https://github.com/kimgranlund/agent-ui/issues/1373#issuecomment-5343986574) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | none — new capability intake, no existing doc corrected. On ratification the build wave applies: `a2ui-catalog.spec.md` SPEC-R5 + a §5.2 usage note (the drafted deltas below) · `catalog/default/catalog.json` `functions` block · `catalog/functions.ts` (shared impl table) · corpus/seed riders teaching the idiom |
> | **Supersedes / Superseded by** | (none) — extends ADR-0026 (the `{call,args}` function-binding evaluator) + SPEC-R5's own "a project catalog MAY still register one" seam · relates ADR-0047 (`currencyCodecOptions` — the INPUT half of the same law) · relates ADR-0038 (lookup-not-multiplier: `Intl` IS the lookup) · relates ADR-0169 cl.11 (the a2ui-basic `formatCurrency` impl this ports) |

## Context

Every commerce surface needs locale-correct currency; today agents emit pre-formatted strings
(`"$1,299.00"`) into `Text`/`Stat`, hard-coding one locale's grouping, symbol placement, and
fraction digits into the data model. The geometry-font lesson (ADR-0038: a LOOKUP, never a
multiplier) has its sibling here: `Intl.NumberFormat` is the lookup — the agent should emit
`{value, currency}` and let the client format (GH #1373). The intake named two arms — widen
`Stat`/`Text` rows with `format: 'currency'` + `currency` props vs mint a tiny `Price` type —
and instructed an honest smallest-floor test (`component-design`'s `mint-vs-compose.md`,
ADR-0107→0205 case study), predicting the widening arm.

Testing honestly surfaced a THIRD arm already built into the tree, smaller than both:

- The renderer evaluates `{call, args}` **function-call bindings inside the bound-prop effect**
  (renderer LLD-C10, ADR-0026, `renderer/functions.ts`): a catalog function's return value can
  feed ANY bound prop, and a `{path}` arg re-evaluates reactively on data changes. This is not
  validator-only machinery — the impl table is `(args) => unknown`.
- SPEC-R5 already anticipates exactly this: *"a project catalog needing in-string formatting
  today registers a `{call}`-form function instead."* The default catalog's `functions` block
  exists (`required`/`email`/`regex`/`ping`); adding a member is the designed extension point.
- A `formatCurrency` implementation already ships in-tree for the a2ui-basic catalog
  (`catalog/a2ui-basic/functions.ts`, ADR-0169 cl.11): `Intl.NumberFormat` with
  `{style:'currency', currency}`, zero deps (`Intl` is a platform global, zero-dep per SPEC-N5);
  its own degradation is `String(args.value)` on BOTH a NaN value and an invalid currency code
  (`a2ui-basic/functions.ts:97,106`), and it takes optional `decimals?`/`grouping?` args.
- The display layer's locale precedent is the DEFAULT runtime locale, not a pin: `Stat` formats
  numeric figures via a module-memoized default-locale `Intl.NumberFormat`
  (`controls/stat/stat-model.ts`), `Table` number cells likewise (`controls/table/table-model.ts`,
  the checks_table latency-column precedent). a2ui-basic's `en-US` pin is that catalog's own
  schema-dialect determinism, not a fleet law.
- The consuming rows need NO widening to receive the result: `Text.text` is a bindable string;
  `Stat`'s wire `value` is `string | number` where a string passes through verbatim ("the
  author's own pre-formatted text" — `stat-model.ts`'s documented contract; here the FORMATTER
  is the client, which is the whole point).

## Decision

**We will register `formatCurrency` as a default-catalog client function — declared in
`catalog/default/catalog.json`'s `functions` block (`callableFrom: 'clientOnly'`) with its pure
implementation in the shared table (`catalog/functions.ts`), formatting in the runtime's default
locale — and widen NO row and mint NO type. Agents emit
`{ "call": "formatCurrency", "args": { "value": {"path": "/cart/total"}, "currency": "EUR" } }`
into any text-bearing bound prop (`Text.text`, `Stat.value`, `Badge.label`, …).**

1. **Signature**: named args `value` (number — non-finite degrades to the em-dash placeholder,
   the `Stat` discipline) and `currency` (ISO-4217 string — an invalid code degrades to a
   default-locale plain `Intl.NumberFormat` number string; THIS ADR's posture, deliberately NOT
   a2ui-basic's, whose own impl returns `String(value)` on both NaN and invalid currency —
   `a2ui-basic/functions.ts:97,106`). No `locale` arg in v1: the runtime default
   locale is the display law (the `Stat`/`Table` precedent above); per-fraction-digit correctness
   (USD 2 · JPY 0 · BHD 3) comes from `Intl` itself (ADR-0047 clause 2's mechanism, reused).
   Determinism in tests = pin `en-US` in the test env (ADR-0047's stated discipline), never in
   the shipped impl.
2. **Dialect**: the default catalog's shared-table dialect (return `unknown` — here a string),
   NOT a2ui-basic's boolean-validator dialect; no name collision machinery needed (`formatCurrency`
   is new to the shared table; a2ui-basic's own override table keeps preferring its member for
   that catalog — ADR-0169 cl.8's existing preference order, untouched).
3. **Reactivity for free**: bound inside the existing bound-prop effect, a `{path}` `value` arg
   re-formats on every data-model change — no factory work, no control work, no descriptor work.
4. **The taught idiom is the deliverable's other half**: corpus seeds + the derived prompt must
   teach `{value, currency}` + the call shape, or agents keep emitting pre-formatted strings.
   This rider is priced into the build wave (same class as ADR-0207's append-only corpus rule:
   existing seeds stay valid byte-for-byte — this arm ADDS a function, touching no row schema).
5. **Named residuals, each its own LATER intake, in fence style (ADR-0107 cl.1 / ADR-0205 cl.7)**:
   a `Table` currency COLUMN (the column `type` enum is `'string' | 'number'`; per-column currency
   needs a column-schema decision, not a function) · a currency-formatted `Stat.delta` (delta is
   a number the control sign-formats; a currency delta needs a control-side decision) ·
   the `${fn(arg:val)}` in-string function-expression arm (SPEC-R5 already defers it).
   a2ui-basic's `decimals?`/`grouping?` args are DELIBERATELY DROPPED, not residual: fraction
   digits come from `Intl`'s per-currency lookup (clause 1) and grouping is the locale's own —
   re-admitting either hands the agent back the per-locale knobs this ADR removes.

### Drafted SPEC deltas (UNAPPLIED — land with the build wave, on ratification)

**SPEC-R5** (`a2ui-catalog.spec.md`), the declared-functions sentence widens:

> The default catalog MUST declare its client functions (at least `required`, `email`, `regex`,
> **and `formatCurrency` — named args `value` (number) + `currency` (ISO 4217), returning the
> runtime-default-locale `Intl.NumberFormat` currency string; `clientOnly`; non-finite `value` →
> the placeholder em dash, invalid `currency` → a default-locale plain `Intl.NumberFormat` number
> string — this catalog's own posture, distinct from a2ui-basic's `String(value)` (ADR-0217)**)
> with typed named-args signatures …

**§5.2 usage note** (appended to the `Stat`/`Text` row-adjacent guidance, prompt-facing):

> **Money (ADR-0217):** emit the NUMBER and the currency code, never a pre-formatted string —
> bind `Text.text` / `Stat.value` through
> `{call:'formatCurrency', args:{value:{path:'/…'}, currency:'EUR'}}`; the client owns locale,
> grouping, symbol placement, and fraction digits (`Intl` is the lookup, ADR-0038's law).

## Consequences

- **Discoverability is the honest cost of the smallest arm.** A wire prop announces itself in the
  row schema; a function must be TAUGHT (prompt + seeds). Accepted because the same channel
  already teaches `required`/`regex`, and the function covers every text-bearing surface at once
  where prop widening covers exactly the rows it touches.
- The data model stays numeric (`/cart/total` is a number) — sorting, arithmetic, and re-binding
  keep working; the pre-formatted-string defect class (locale baked into data) is closed at the
  root rather than per-row.
- Two catalogs now both declare `formatCurrency` with DIFFERENT locale AND degradation postures
  (a2ui-basic: pinned `en-US`, `String(value)` on NaN/invalid currency, `decimals?`/`grouping?`
  args; default catalog: runtime locale, em dash / plain number, two args) — correct per ADR-0169 cl.8's
  per-catalog override design, but worth one line in each impl's doc comment to prevent a future
  "unify them" regression.
- Display output varies by end-user locale by DESIGN; goldens/tests pin `en-US` (ADR-0047's
  discipline) — a build-wave test-env obligation, not a runtime pin.
- **Stale → re-verify on land:** `a2ui-catalog.spec.md` SPEC-R5 + the §5.2 usage note (apply the
  drafted deltas) · `catalog/default/catalog.json` functions block + `catalog/functions.ts` +
  their tests (D1 naming gate: `formatCurrency` is a valid UAX-31 name outside `@`) · corpus
  seeds + prompt-baseline recapture (inventory lines).

## Alternatives considered

- **Widen `Stat`/`Text` rows with `format: 'currency'` + `currency` props (the intake's predicted
  arm)** — rejected on the honest smallest-floor test: it touches two row schemas, two control
  descriptors OR two bespoke factories (`Text` formatting collides with its slotted-textContent
  contract, ADR-0025; `Stat` needs a two-prop combine at the per-prop `applyProp` seam), and
  still covers ONLY those two rows — `Badge`, `DescriptionList` values, list items, and every
  future text surface would each need the same widening again. The function arm is one registry
  entry with strictly wider coverage. The intake's own framing predicted widening; the test run
  honestly points one layer lower.
- **Mint a tiny `Price` type** — rejected on the `mint-vs-compose` bar: display-only, no bindable
  aggregate to round-trip, so it doesn't clear the mint test; and a new type costs the full
  §5(iii) rider set (row, factory, seeds, tiers, prompt bytes) to express what one function call
  already can. Also fails the coverage argument above the same way widening does (a `Price` LEAF
  can't format a value already inside a `Table` cell or a composed string).
- **A `locale` arg on the function** — rejected v1: no consumer decides locale per-binding; the
  runtime default is the fleet's display law (`Stat`/`Table` precedent), and a per-call locale
  invites agents to re-pin the exact defect this ADR removes. Foreseen extension if a real
  host-locale-override need lands (it would arrive as a HOST concern, not an agent-emitted arg).
- **Pin `en-US` like a2ui-basic** — rejected: that pin exists for the upstream schema dialect's
  cross-environment determinism; the default catalog renders for the END USER, whose locale is
  the point. Tests pin, the runtime doesn't.
- **Do nothing (keep pre-formatted strings)** — rejected: it IS the defect (GH #1373); every
  emitted string hard-codes the producing model's locale guess into the data model.
