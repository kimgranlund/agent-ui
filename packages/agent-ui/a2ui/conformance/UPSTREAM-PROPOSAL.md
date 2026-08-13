# Upstream issue draft — a complementary payload/catalog-validation conformance suite

**Status: draft, ready to paste.** This is the text for a NEW issue on `a2ui-project/a2ui`, filed by a
human from their own GitHub account. Nothing in this repo files it, edits it upstream, or otherwise
writes to `a2ui-project/a2ui` — that boundary is absolute (see this pack's own
[README.md](./README.md), "Contributing upstream").

---

## Suggested title

> A complementary payload/catalog-validation conformance suite (sibling to `#2150`/`#2182`'s
> `agent_sdks/conformance/suites/*.yaml`)

## Suggested body

Following up on the `#2150` scoping discussion (2026-08-07 comment thread) and the `agent_sdks`
conformance suites that landed in `#2182` (`validator.yaml` / `catalog.yaml` / `parser.yaml` /
`streaming_parser.yaml` / `accessibility.yaml` / `inference_format.yaml` / `a2a_integration.yaml` /
`adk_extensions.yaml`) — we (kimgranlund/agent-ui, a third-party A2UI catalog + zero-dependency web
renderer) maintain our own **payload-in / verdict-out** conformance pack that predates `#2182`
(originally built against `#2150`'s open scoping gap, tracked on our side as GH #476/#616) and have
now ported it into your exact `suites/*.yaml` row convention.

**We'd like to propose it as a complementary sibling suite, not a duplicate.** The layer split:

- Your `agent_sdks/conformance/suites/*.yaml` tests **SDK behavior**: does a given Python/TS SDK
  implementation of the parser/validator/catalog-pruner/renderer do the right thing, exception
  category and message included (`expect_error: {category, message}`).
- Our suite tests **payload/catalog validation as a portable, implementation-agnostic contract**:
  given ONE catalog document and ONE message payload, does ANY conformant validator (ours, yours, a
  third one) arrive at the same `{valid, failures: {code, path}[]}` verdict — a full SET of
  structural/protocol failures, not a single first-raised exception. That distinction is why our rows
  carry `expect_verdict` rather than your `expect_error` (below).

Two files, `suites/validator.yaml` (protocol-pipeline mechanics — parse/schema/version/pointer/
id-graph integrity) and `suites/catalog.yaml` (catalog-document-scoped concerns — the component
allowlist, plus three payloads pinned verbatim to your own `a2ui.org` Basic Catalog examples for
interop proof), generated from a single canonical fixture set and drift-gated in CI so the two never
diverge.

### The 18 cases

| # | Name | Suite | Catalog | Verdict | What it proves |
| - | --- | --- | --- | --- | --- |
| 1 | `parse-failure` | validator | agent-ui | invalid — `PARSE` | Unparseable JSON is caught at the earliest pipeline stage |
| 2 | `bad-envelope` | validator | agent-ui | invalid — `SCHEMA` | A message with no recognized envelope key is rejected |
| 3 | `missing-surfaceId` | validator | agent-ui | invalid — `SCHEMA` | A required field's absence is pinpointed by path |
| 4 | `unsupported-version` | validator | agent-ui | invalid — `VERSION_UNSUPPORTED` | A version outside the supported set is rejected |
| 5 | `bad-pointer-binding` | validator | agent-ui | invalid — `POINTER` | A malformed RFC-6901 `~` escape in a component-prop binding is caught |
| 6 | `bad-pointer-datamodel` | validator | agent-ui | invalid — `POINTER` | A non-root-relative `updateDataModel.path` is caught |
| 7 | `missing-root` | validator | agent-ui | invalid — `IDGRAPH` | A component set with no `root` id is caught |
| 8 | `duplicate-root` | validator | agent-ui | invalid — `IDGRAPH` | Two components both claiming id `root` is caught |
| 9 | `dangling-child` | validator | agent-ui | invalid — `IDGRAPH` | A `child` reference to a nonexistent id is caught |
| 10 | `cycle` | validator | agent-ui | invalid — `IDGRAPH` | A back-edge in the component child graph is caught |
| 11 | `valid-button` | catalog | agent-ui | valid | A minimal known-good default-catalog payload |
| 12 | `valid-list` | catalog | agent-ui | valid | A dynamic-list template over an `updateDataModel`-seeded array |
| 13 | `unknown-component` | catalog | agent-ui | invalid — `CATALOG` | A component type outside the catalog's declared set is rejected (the security allowlist) |
| 14 | `upstream-interactive-button` | catalog | a2ui-basic | valid | Your own `a2ui.org` Basic Catalog "Interactive Button" example, byte-verbatim except the envelope version |
| 15 | `upstream-simple-login-form` | catalog | a2ui-basic | valid | Your own `a2ui.org` Basic Catalog "Simple Login Form" example, same translation |
| 16 | `upstream-product-card` | catalog | a2ui-basic | valid | Your own `a2ui.org` Basic Catalog "Product Card" example, exercising the `formatCurrency`/`formatString`/`formatNumber`/`pluralize` function chain |
| 17 | `containment-stray-region` | catalog | agent-ui | invalid — `CONTAINMENT` | A `CardHeader`/`CardContent`/`CardFooter` region delivered outside a `Card` is rejected (a container-vocabulary rule layered on our own default catalog) |
| 18 | `valid-structured-card-mark-free` | catalog | agent-ui | valid | A `Card` with `CardHeader`/`CardContent`/`CardFooter` each a direct child — the mark-free containment-valid shape |

### Format — already conforms to your `suites/*.yaml` shape

Every row carries the same top-level keys your own `validator.yaml`/`catalog.yaml` rows use: `name` ·
`description` · `catalog: {version, catalogId, catalog_schema}` · `action` · `payload`. Two
**deliberate, named** differences (not oversights):

1. **`expect_verdict` instead of `expect_error`.** Your `expect_error: {category, message}` (or a
   bare string) names a single first-raised exception. Our validator returns a full verdict — a SET
   of `{code, path}` failures, order-independent — so we carry the whole verdict rather than
   approximating it into your singular field.
2. **`catalog.yaml` here has no `prune`/`render`/`load`/`remove_strict_validation`/
   `verify_cuttable_keys` rows.** Our validator doesn't transform catalog schemas — it only checks
   payload membership against a catalog's declared component set. Every row in both of our suites uses
   `action: "validate"`.

Happy to send the two files (plus the generator that derives them from our canonical fixture set, so
they stay honest) as a PR if there's interest — or to adjust the shape further based on feedback here
first. This is offered as a complement to `#2182`'s SDK-behavior suites, not a replacement for any of
them.
