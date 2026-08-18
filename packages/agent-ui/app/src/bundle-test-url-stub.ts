// bundle-test-url-stub.ts — a shared Rolldown plugin for this package's OWN bundle-level trip-wires
// (agent-admin-lazy.bundle.test.ts, dogfood-lazy.bundle.test.ts, markdown-lazy.bundle.test.ts,
// pdf-identity.bundle.test.ts). A bare `rolldown()` call has no Vite asset pipeline, so it can't load a
// Vite `?url`-suffixed specifier on its own (GH #1215/ADR-0202's `lib/pdf-worker.ts` is the first one
// this package's own graph carries: `pdfjs-dist/build/pdf.worker.min.mjs?url`) — this stub resolves it
// via Node's own `import.meta.resolve` (the real node_modules algorithm) and returns a short placeholder
// string in place of the real asset URL, the same approximation `scripts/measure-size.mjs`'s own
// `appCssQuerySuffixPlugin` makes (real byte value is irrelevant to these tests — they check module
// PRESENCE/absence and chunk placement, not the URL's runtime string). Harmless to include in a bundle
// that carries no `?url` specifier at all (`resolveId`/`load` both no-op on anything else).
// Plain string manipulation, deliberately never `node:url`'s `fileURLToPath` — this file ships under
// `src/` (so multiple `.test.ts` files can share one plugin instance) and is therefore itself scanned by
// layering.test.ts's raw-text import trip-wire; a bare Node-builtin import here would trip that gate for
// no real gain (the `file://` prefix strip below is exact on every platform this repo's own test suite
// runs on — POSIX; no Windows CI leg exists to need the URL API's own decoding).
const FILE_URL_PREFIX = 'file://'
export const urlSuffixStubPlugin = {
  name: 'bundle-test-url-suffix-stub',
  resolveId(source: string) {
    if (!source.endsWith('?url')) return null
    const bare = source.slice(0, -'?url'.length)
    const resolved = import.meta.resolve(bare)
    const path = resolved.startsWith(FILE_URL_PREFIX) ? resolved.slice(FILE_URL_PREFIX.length) : resolved
    return { id: `${path}?url`, moduleSideEffects: false }
  },
  load(id: string) {
    if (!id.endsWith('?url')) return null
    return `export default ${JSON.stringify(`/${id.slice(0, -'?url'.length).split('/').pop()}`)}`
  },
}
