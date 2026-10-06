// exclusions.ts: the ONE exclusion allowlist (type -> reason): the fleet types the default catalog
// deliberately carries no row for. Extracted verbatim from `index.test.ts` so the coverage gate there and
// the capability-registry loader (`tools/registry/load.ts`) read the SAME map, never two derivations of one
// truth (the GH #346 root cause). Imports nothing, so it is safe from any host.
//
/** The exclusion allowlist — type → reason. Landed EMPTY after Wave D (all ADR-0087 forks resolved INCLUDE,
 *  Kim 2026-07-06) and stayed empty through the M1 chart-family drain (`BarChart`/`Sparkline`, ADR-0107,
 *  LLD-C10). The Wave M1 report/content/feed catalog pass (ADR-0111/0113/0112) DRAINED all eight temporary
 *  "shipped ahead of its catalog row" seeds it had accumulated (`Table`/`Stat`/`Badge`,
 *  report-family.lld.md LLD-C12; `Code`/`Disclosure`, content-family.lld.md LLD-C13;
 *  `Progress`/`Avatar`/`Attachment`, feed-family.lld.md LLD-C13) — their catalog rows now exist, so their
 *  seeds are REMOVED, not left as residue (the residue-guard test below would fail if they weren't). The
 *  token-surface family (ADR-0118, `Swatch`/`Ramp`/`Ladder`) re-seeded this SAME "shipped ahead of its
 *  catalog row" shape at M1 (token-surfaces.lld.md LLD-C10) — deliberately split from M1 (controls +
 *  allowlist seed) into a separate M2 wave (rows + exemplar + guidance, LLD-C13/C14/C15, ADR-0118 fork
 *  F4); the M2 wave lands the three rows below and DRAINS that seed too, the same way the report/content/
 *  feed seeds above were drained. `Image` shipped its control + catalog row in the SAME wave (GH #1189,
 *  the ADR-0087 cl.6 same-wave precedent — no allowlist seed needed). `Video`/`AudioPlayer` shipped their
 *  controls + catalog rows in the SAME wave (GH #1209, the Image/GH #1189 cl.6 precedent — no seed
 *  needed; the old "no ui-video descriptor exists" documentary note is retired with it). A future undispositioned control re-seeds this map with a reason +
 *  citation, same as Wave 0's seed. The color-picker family (ADR-0123, `ColorPicker`) re-seeded this SAME
 *  "shipped ahead of its catalog row" shape at M1 (color-picker.lld.md, the ADR-0118 M1/M2 discipline) —
 *  this M2 wave lands the row below and DRAINS that seed too, the same way the token-surface/report/
 *  content/feed seeds above were drained. The 2026-08-19 nine-ADR campaign re-seeded this SAME "shipped
 *  ahead of its catalog row" shape SEVEN times over (six control-mint waves landing ahead of the
 *  catalog-integration lane, ADR-0087 cl.6): `FileDrop` (ADR-0210) · `SourceList` (ADR-0214) ·
 *  `Suggestions` (ADR-0213) · `Rating` (ADR-0216) · `PieChart` (ADR-0219) · `ChoiceGroup`/`ChoiceCard`
 *  (ADR-0220, one control-mint wave, two rows). The catalog-integration lane (`adr-campaign-catalog-
 *  integration`) DRAINED all seven — their catalog rows + factories now exist (this file's residue guard
 *  would fail if they were left in place), the same way the report/content/feed/token-surface/color-picker
 *  seeds above were drained. ADR-0224 (GH #1429, `ui-service-card`) re-seeded this SAME shape at S1
 *  (control minted ahead of its clause-8 catalog-row-vs-exclusion disposition, RECOMMENDED-not-decided at
 *  ratification) — this S3 wave lands the `ServiceCard` row + factory (clause 8 ratified) and DRAINS that
 *  seed too, the same way every wave above was drained. GH #1515 (`ui-breadcrumb`, the frozen design
 *  intake `.claude/docs/spec/breadcrumb.intake.md`) re-seeded this SAME shape at S1 (core anatomy only,
 *  §4 Catalog posture row: A2UI-EMITTABLE, "row-or-allowlist at ship time" — the row itself was the S3
 *  slice's job, by the intake's own 3-slice build plan) — this S3 wave lands the `Breadcrumb` row +
 *  factory and DRAINS that seed too, the same way every wave above was drained. */
//
// `ToastRegion`/`ThemeProvider`/`StatusStream`/`SwiperPagination`/`SwiperPaddles`/`SwiperLabel`/`CommandModal` are
// the only PERMANENT entries — NOT catalogue-bound AT ALL (app-surface/theming/live-streaming/chrome-anchor
// content) — never drained. `Toast` was one of them (ADR-0112 cl.6) until GH #1184 (Kim ruling 2026-08-17)
// reversed its half: ephemeral outcome announcements ARE agent-emittable, so Toast now has a catalog row
// (see toastFactory) — its entry is DRAINED; ToastRegion (the top-layer host + show()) stays app chrome.
export const EXCLUSION_ALLOWLIST: ReadonlyMap<string, string> = new Map<string, string>([
  ['ToastRegion', 'ADR-0112 cl.6 — PERMANENT exclusion, never catalogue-bound: the top-layer toast HOST driven by show() is app-surface chrome (GH #1184 catalogued Toast itself, but the region + its imperative API stay page/app-frame primitives, never a catalog row).'],
  ['ThemeProvider',
    'ADR-0117 / theme-provider.spec.md SPEC-R8 — PERMANENT exclusion, never catalogue-bound: ' +
    'page/app-owner theming chrome establishing a color-scheme subtree, not agent-emittable content ' +
    '(the ADR-0112 cl.6 Toast/ToastRegion reasoning applied verbatim).'],
  ['StatusStream',
    'ADR-0122 F5 / timeline-family.lld.md §4 — PERMANENT exclusion, never catalogue-bound: a live "what the ' +
    'system is doing now" strip driven entirely by a consumer-owned imperative API (appendEntry/update/' +
    'finalize) over a stream the consumer holds — not a one-shot serializable component tree (the ADR-0112 ' +
    'cl.6 Toast/ToastRegion reasoning applied verbatim: an agent emits a durable Timeline snapshot instead).'],
  ['SwiperPagination',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C9 — PERMANENT exclusion, never catalogue-bound: an author-' +
    'placed chrome anchor the owning ui-swiper fills/wires wherever it is written; an agent reaches the ' +
    'same dots UI via the [pagination] boolean stamp on Swiper itself (F3) — an agent-emitted anchor node ' +
    'would carry no content of its own (the coordinator renders every dot), pure noise (the ADR-0112 cl.6 ' +
    'Toast/ToastRegion reasoning applied verbatim).'],
  ['SwiperPaddles',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C10 — PERMANENT exclusion, same reasoning as SwiperPagination: ' +
    'an author-placed anchor the coordinator fills with two composed prev/next ui-buttons; the [paddles] ' +
    'boolean stamp is the agent-reachable fallback (F3).'],
  ['SwiperLabel',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C11 — PERMANENT exclusion, same reasoning: an author-placed ' +
    'anchor whose light-DOM text becomes the owning ui-swiper\'s accessible name; an agent-emitted empty ' +
    'marker node carries no catalog-visible content, and the region already falls back to "Carousel" absent one.'],
  ['CommandModal',
    'ADR-0125 F8 / command-modal.lld.md LLD-C16 — PERMANENT exclusion: the CMD-K palette is app-owner ' +
    'launcher chrome (the Toast/ThemeProvider/StatusStream class, ADR-0112 cl.6 reasoning) — an agent ' +
    'emitting an app\'s command palette is the wrong trust shape; its items are the consumer\'s actions.'],
  ['SandboxFrame',
    'genui-surface.spec.md SPEC-N1 / PRD-G4 — PERMANENT exclusion, never catalogue-bound: the GenUI ' +
    'containment host is composed by @agent-ui/app into the conversation feed off the (B2) genui wire ' +
    'kind, never authored by an agent through A2UI\'s catalog-typed payload — the two modalities never ' +
    'render through each other (PRD §3/§6). Structurally the same "app-owner surface, not agent-emittable ' +
    'content" class as ThemeProvider/StatusStream above (the ADR-0112 cl.6 reasoning applied verbatim).'],
  ['OtpField',
    'ADR-0176 cl.3 — PERMANENT exclusion, never catalogue-bound: credential-bearing authentication chrome ' +
    'is host-page-only (security inversion, PRD-D2); the ADR-0112 cl.6 Toast/ToastRegion reasoning applied ' +
    'verbatim — a one-time-code entry is the credential-bearing element of the identity family\'s Codes ' +
    'mode (code-entry-control.lld.md §9, GH #490 S2-a).'],
  ['PlayingCard',
    'ADR-0225 cl.2 — PERMANENT exclusion from the DEFAULT catalog, the persona-scoped content-type ' +
    'category (a NEW exclusion reason beside ADR-0112 cl.6\'s chrome family): the type IS agent-' +
    'emittable, but only through the croupier persona catalog (personas/croupier/catalog.json), whose ' +
    'fragment + mini-skills teach it; a default-catalog row would hand every generic agent a casino-' +
    'domain object with no teaching context. Widening to the default catalog is a separate, later ' +
    'intake (the mint-vs-compose TYPE arm), never a drive-by row.'],
])
