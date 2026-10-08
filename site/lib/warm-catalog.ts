// site/lib/warm-catalog.ts: import for effect. Awaits the default `agent-ui` catalog body at module top level, so a
// page entry that imports it evaluates only once the body is in (an importer's body runs after its imports'
// top-level await settles). ADR-0241 (option C, T-0040): the default catalog is a lazy record, so the FIRST renderer
// built on a page registers it asynchronously; every renderer built after a load registers the loaded body at once
// (the warm memo), exactly as the eager catalog did. A page whose own code reads the mount right after `ingest` /
// `finalize`, inside a synchronous function (a gallery card's rendered flag, a form's wired chrome, a stream's
// first-paint readout), is only correct on a warm renderer; importing this first makes every renderer it builds warm
// without turning any of those functions async.
//
// Import it from a PAGE entry (or an entry-like module), never from a shared lib: a top-level await propagates to
// every importer, so a lib that many pages pull in would put the lazy chunk on their critical path whether or not
// they ever render a surface. A failed load is swallowed here on purpose: the renderer reports it on the client
// channel (`CATALOG_LOAD`) when a surface names the catalog, which is the one place a page can already show it.
import { createRenderer } from '@agent-ui/a2ui'

await createRenderer()
  .preload('agent-ui')
  .catch(() => undefined)
